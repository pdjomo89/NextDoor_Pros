import { v } from 'convex/values';
import { getAuthUserId } from '@convex-dev/auth/server';
import {
  action,
  internalMutation,
  internalQuery,
  query,
} from './_generated/server';
import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import { getProvider } from './paymentProviders';
import { countryOfCity, currencyForCountry, providerForCountry } from './markets';

// ──────────────────────────────────────────────────────────────────────────
// Paid job posting via the market's payment provider (Phase 2 abstraction).
//
//   1. Client calls `startJobPosting` (action). We create the job as
//      'pending_payment' (hidden from the public board) plus a `jobPayments`
//      row, then call provider.initiatePay and return the hosted-checkout
//      `link`.
//   2. Client redirects the poster to `link`. They pay, then get returned to
//      `redirectUrl` (the "my jobs" page).
//   3. The provider calls our webhook (convex/http.ts). We re-verify via
//      provider.getStatus and, on success, publish the job.
//
// The fee is fixed server-side and the final status comes from the provider —
// never from the browser. Provider is the market's (Fapshi for Cameroon today).
// ──────────────────────────────────────────────────────────────────────────

/**
 * Fixed job-posting fee, in the MINOR UNIT of the job's market currency. For
 * XAF (exponent 0) this is whole francs; Fapshi's minimum is 100. The currency
 * and payment provider are derived from the job's country (see convex/markets).
 * A per-market fee amount can replace this constant when a second market opens.
 */
export const JOB_POSTING_FEE = 1000;

// ── internal: create pending job + payment row (transactional, authenticated) ─

type PendingJob = {
  jobId: Id<'jobs'>;
  paymentId: Id<'jobPayments'>;
  posterId: Id<'users'>;
  provider: string;
  amount: number;
  currency: string;
  email?: string;
};

export const createPendingJob = internalMutation({
  args: {
    title: v.string(),
    description: v.string(),
    category: v.string(),
    citySlug: v.string(),
    province: v.string(),
    budget: v.optional(v.string()),
    timing: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<PendingJob> => {
    const posterId = await getAuthUserId(ctx);
    if (!posterId) throw new Error('Not signed in');
    if (args.title.trim() === '' || args.description.trim() === '') {
      throw new Error('Title and description are required.');
    }

    // The job's market (from its city) drives country, currency and provider.
    const country = countryOfCity(args.citySlug);
    const provider = providerForCountry(country);
    const currency = currencyForCountry(country);

    const jobId = await ctx.db.insert('jobs', {
      posterId,
      status: 'pending_payment', // hidden until the fee is confirmed
      country,
      ...args,
    });

    const paymentId = await ctx.db.insert('jobPayments', {
      jobId,
      posterId,
      provider,
      externalId: jobId, // Convex ids are [a-zA-Z0-9]; valid as a provider externalId
      amount: JOB_POSTING_FEE,
      currency: currency.toLowerCase(),
      status: 'created',
    });

    const user: Doc<'users'> | null = await ctx.db.get(posterId);

    return {
      jobId,
      paymentId,
      posterId,
      provider,
      amount: JOB_POSTING_FEE,
      currency,
      email: user?.email,
    };
  },
});

export const attachTransaction = internalMutation({
  args: {
    paymentId: v.id('jobPayments'),
    transId: v.string(),
    link: v.string(),
  },
  handler: async (ctx, { paymentId, transId, link }) => {
    await ctx.db.patch(paymentId, { transId, link, status: 'pending' });
  },
});

// ── public action: kick off a paid job posting ───────────────────────────────

export const startJobPosting = action({
  args: {
    title: v.string(),
    description: v.string(),
    category: v.string(),
    citySlug: v.string(),
    province: v.string(),
    budget: v.optional(v.string()),
    timing: v.optional(v.string()),
    locale: v.string(),
  },
  handler: async (
    ctx,
    args,
  ): Promise<{ jobId: Id<'jobs'>; link: string }> => {
    const { locale, ...jobFields } = args;

    const pending: PendingJob = await ctx.runMutation(
      internal.jobFees.createPendingJob,
      jobFields,
    );

    const siteUrl = (process.env.SITE_URL ?? '').replace(/\/$/, '');
    const redirectUrl = `${siteUrl}/${locale}/jobs/mine?paid=${pending.jobId}`;

    const result = await getProvider(pending.provider).initiatePay({
      amount: pending.amount,
      currency: pending.currency,
      email: pending.email,
      userId: pending.posterId,
      externalId: pending.jobId,
      redirectUrl,
      message: 'NextDoor Pros job posting fee',
    });

    await ctx.runMutation(internal.jobFees.attachTransaction, {
      paymentId: pending.paymentId,
      transId: result.transId,
      link: result.link,
    });

    return { jobId: pending.jobId, link: result.link };
  },
});

// ── settlement (called by the webhook, and by the fallback poll below) ───────

export const applyPaymentResult = internalMutation({
  args: {
    transId: v.string(),
    status: v.union(
      v.literal('successful'),
      v.literal('failed'),
      v.literal('expired'),
      v.literal('pending'),
    ),
  },
  handler: async (ctx, { transId, status }) => {
    const payment = await ctx.db
      .query('jobPayments')
      .withIndex('by_transId', (q) => q.eq('transId', transId))
      .unique();
    if (!payment) return; // unknown transaction — ignore

    // Idempotent: once successful, never downgrade or re-publish.
    if (payment.status === 'successful') return;

    await ctx.db.patch(payment._id, { status });

    if (status === 'successful') {
      const job = await ctx.db.get(payment.jobId);
      if (job && job.status === 'pending_payment') {
        await ctx.db.patch(payment.jobId, { status: 'open' });
      }
    }
  },
});

// ── poster-facing read + fallback poll (in case a webhook is missed) ─────────

export const myJobPaymentStatus = query({
  args: { jobId: v.id('jobs') },
  handler: async (ctx, { jobId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const payment = await ctx.db
      .query('jobPayments')
      .withIndex('by_job', (q) => q.eq('jobId', jobId))
      .order('desc')
      .first();
    if (!payment || payment.posterId !== userId) return null;
    return {
      status: payment.status,
      amount: payment.amount,
      currency: payment.currency,
    };
  },
});

export const getOwnedPaymentByJob = internalQuery({
  args: { jobId: v.id('jobs') },
  handler: async (ctx, { jobId }): Promise<Doc<'jobPayments'> | null> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const payment = await ctx.db
      .query('jobPayments')
      .withIndex('by_job', (q) => q.eq('jobId', jobId))
      .order('desc')
      .first();
    if (!payment || payment.posterId !== userId) return null;
    return payment;
  },
});

/**
 * Fallback: re-check a job's payment against Fapshi and settle it. Safe to call
 * from the "my jobs" page after the payer is redirected back, in case the
 * webhook was delayed or missed. Only settles jobs owned by the caller.
 */
export const refreshJobPayment = action({
  args: { jobId: v.id('jobs') },
  handler: async (ctx, { jobId }): Promise<{ status: string } | null> => {
    const payment = await ctx.runQuery(internal.jobFees.getOwnedPaymentByJob, {
      jobId,
    });
    if (!payment?.transId) return null;

    const remote = await getProvider(payment.provider).getStatus(payment.transId);
    await ctx.runMutation(internal.jobFees.applyPaymentResult, {
      transId: payment.transId,
      status: remote.status,
    });
    return { status: remote.status };
  },
});
