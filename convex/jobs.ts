import { v } from 'convex/values';
import Stripe from 'stripe';
import { getAuthUserId } from '@convex-dev/auth/server';
import {
  action,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server';
import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';

/** Platform commission (basis points). Mirrors APPLICATION_FEE_BPS in payments.ts. */
const APPLICATION_FEE_BPS = 1000; // 10%
const MIN_BUDGET_CENTS = 500; // $5
const MAX_BUDGET_CENTS = 5_000_000; // $50,000

function stripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set on this Convex deployment.');
  return new Stripe(key, { httpClient: Stripe.createFetchHttpClient() });
}

function siteUrl(): string {
  return process.env.SITE_URL?.replace(/\/$/, '') ?? 'http://localhost:3000';
}

// ──────────────────────────────────────────────────────────────────────────
// Public read queries
// ──────────────────────────────────────────────────────────────────────────

/**
 * Public list of open jobs. Optionally filter by city slug and/or category.
 */
export const list = query({
  args: {
    citySlug: v.optional(v.string()),
    category: v.optional(v.string()),
  },
  handler: async (ctx, { citySlug, category }) => {
    const rows = await ctx.db
      .query('jobs')
      .withIndex('by_status', (q) => q.eq('status', 'open'))
      .order('desc')
      .collect();
    return rows.filter((j) => {
      if (citySlug && j.citySlug !== citySlug) return false;
      if (category && j.category !== category) return false;
      // Pending-payment paid jobs are hidden from listings until funded.
      if (j.paymentStatus === 'pending') return false;
      return true;
    });
  },
});

/**
 * Single job by id.
 */
export const get = query({
  args: { id: v.id('jobs') },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});

/**
 * Jobs posted by the signed-in user.
 */
export const listMine = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    return await ctx.db
      .query('jobs')
      .withIndex('by_poster', (q) => q.eq('posterId', userId))
      .order('desc')
      .collect();
  },
});

// ──────────────────────────────────────────────────────────────────────────
// Free posts (no money). Kept for backward compat / quote-style postings.
// ──────────────────────────────────────────────────────────────────────────

export const create = mutation({
  args: {
    title: v.string(),
    description: v.string(),
    category: v.string(),
    citySlug: v.string(),
    province: v.string(),
    budget: v.optional(v.string()),
    timing: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not signed in');

    if (args.title.trim() === '' || args.description.trim() === '') {
      throw new Error('Title and description are required.');
    }
    if (!args.contactEmail && !args.contactPhone) {
      throw new Error('Add at least one way for interested folks to reach you.');
    }

    return await ctx.db.insert('jobs', {
      posterId: userId,
      status: 'open',
      ...args,
    });
  },
});

export const update = mutation({
  args: {
    id: v.id('jobs'),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    category: v.optional(v.string()),
    citySlug: v.optional(v.string()),
    province: v.optional(v.string()),
    budget: v.optional(v.string()),
    timing: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    status: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...patch }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not signed in');

    const existing = await ctx.db.get(id);
    if (!existing) throw new Error('Job not found');
    if (existing.posterId !== userId) throw new Error('Not your job');

    // Don't let editors touch paid jobs once payment has flowed.
    if (
      existing.paymentStatus &&
      existing.paymentStatus !== 'none' &&
      existing.paymentStatus !== 'failed' &&
      existing.paymentStatus !== 'refunded'
    ) {
      throw new Error('PAID_JOB_LOCKED');
    }

    await ctx.db.patch(id, patch);
  },
});

export const deleteMine = mutation({
  args: { id: v.id('jobs') },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not signed in');

    const existing = await ctx.db.get(id);
    if (!existing) return;
    if (existing.posterId !== userId) throw new Error('Not your job');

    // Refuse to delete funded jobs — customer must cancel (which refunds) first.
    if (existing.paymentStatus === 'funded' || existing.paymentStatus === 'released') {
      throw new Error('PAID_JOB_CANNOT_DELETE');
    }

    // Clean up any applications first.
    const apps = await ctx.db
      .query('jobApplications')
      .withIndex('by_job', (q) => q.eq('jobId', id))
      .collect();
    for (const a of apps) await ctx.db.delete(a._id);

    await ctx.db.delete(id);
  },
});

// ──────────────────────────────────────────────────────────────────────────
// Paid-job flow (Phase 2)
// ──────────────────────────────────────────────────────────────────────────

/**
 * Create a paid job posting and a Stripe Checkout Session for the budget.
 * The job is inserted in `pending` payment state; funds land in the platform
 * balance, with no destination set. Once a pro is assigned and the customer
 * marks the job complete, funds transfer to the pro minus the 10% fee.
 */
export const createPaidCheckout = action({
  args: {
    title: v.string(),
    description: v.string(),
    category: v.string(),
    citySlug: v.string(),
    province: v.string(),
    budgetCents: v.number(),
    timing: v.optional(v.string()),
    customerEmail: v.string(),
    customerName: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    locale: v.string(),
  },
  handler: async (ctx, args): Promise<{ jobId: Id<'jobs'>; url: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('UNAUTHENTICATED');

    if (!Number.isInteger(args.budgetCents)) throw new Error('INVALID_BUDGET');
    if (args.budgetCents < MIN_BUDGET_CENTS) throw new Error('BUDGET_TOO_LOW');
    if (args.budgetCents > MAX_BUDGET_CENTS) throw new Error('BUDGET_TOO_HIGH');

    const currency = 'cad';
    const applicationFeeCents = Math.round((args.budgetCents * APPLICATION_FEE_BPS) / 10000);

    const jobId: Id<'jobs'> = await ctx.runMutation(internal.jobs.insertPendingPaidJob, {
      posterId: userId,
      title: args.title,
      description: args.description,
      category: args.category,
      citySlug: args.citySlug,
      province: args.province,
      budgetCents: args.budgetCents,
      currency,
      applicationFeeCents,
      timing: args.timing,
      customerEmail: args.customerEmail,
      customerName: args.customerName,
      contactPhone: args.contactPhone,
    });

    const stripe = stripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: args.customerEmail,
      line_items: [
        {
          price_data: {
            currency,
            unit_amount: args.budgetCents,
            product_data: {
              name: `NextDoor Pros job — ${args.title}`.slice(0, 120),
              description: args.description.slice(0, 300),
            },
          },
          quantity: 1,
        },
      ],
      success_url: `${siteUrl()}/${args.locale}/jobs/${jobId}?paid=1`,
      cancel_url: `${siteUrl()}/${args.locale}/jobs/post?cancelled=1&jobId=${jobId}`,
      // Distinguish job sessions from service-booking sessions in the webhook.
      metadata: { kind: 'job', jobId },
      payment_intent_data: {
        metadata: { kind: 'job', jobId },
      },
    });

    if (!session.url || !session.id) throw new Error('STRIPE_SESSION_FAILED');

    await ctx.runMutation(internal.jobs.setJobCheckoutSession, {
      id: jobId,
      stripeCheckoutSessionId: session.id,
    });

    return { jobId, url: session.url };
  },
});

/**
 * A pro applies to a funded job. Requires Stripe onboarding to be complete
 * so we can pay them later when the customer releases funds.
 */
export const applyToJob = mutation({
  args: {
    jobId: v.id('jobs'),
    message: v.optional(v.string()),
  },
  handler: async (ctx, { jobId, message }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('UNAUTHENTICATED');

    const contractor = await ctx.db
      .query('contractors')
      .withIndex('by_owner', (q) => q.eq('ownerId', userId))
      .unique();
    if (!contractor) throw new Error('NO_PRO_PROFILE');
    if (contractor.stripeOnboardingComplete !== true) throw new Error('STRIPE_NOT_READY');

    const job = await ctx.db.get(jobId);
    if (!job) throw new Error('NOT_FOUND');
    if (job.status !== 'open') throw new Error('NOT_OPEN');
    if (job.paymentStatus !== 'funded') throw new Error('NOT_FUNDED');
    if (job.posterId === userId) throw new Error('CANNOT_APPLY_OWN');

    const cleanMessage = message?.trim().slice(0, 1000) || undefined;

    const existing = await ctx.db
      .query('jobApplications')
      .withIndex('by_job_contractor', (q) =>
        q.eq('jobId', jobId).eq('contractorId', contractor._id),
      )
      .unique();

    if (existing) {
      if (existing.status === 'withdrawn') {
        await ctx.db.patch(existing._id, { status: 'pending', message: cleanMessage });
        return existing._id;
      }
      throw new Error('ALREADY_APPLIED');
    }

    return await ctx.db.insert('jobApplications', {
      jobId,
      contractorId: contractor._id,
      posterId: job.posterId,
      message: cleanMessage,
      status: 'pending',
    });
  },
});

export const withdrawApplication = mutation({
  args: { applicationId: v.id('jobApplications') },
  handler: async (ctx, { applicationId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('UNAUTHENTICATED');

    const app = await ctx.db.get(applicationId);
    if (!app) return;

    const contractor = await ctx.db.get(app.contractorId);
    if (!contractor || contractor.ownerId !== userId) throw new Error('FORBIDDEN');
    if (app.status === 'accepted') throw new Error('ALREADY_ACCEPTED');

    await ctx.db.patch(applicationId, { status: 'withdrawn' });
  },
});

/** Customer (job owner) picks one of the applicants. Funds NOT released yet. */
export const selectApplicant = mutation({
  args: { applicationId: v.id('jobApplications') },
  handler: async (ctx, { applicationId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('UNAUTHENTICATED');

    const app = await ctx.db.get(applicationId);
    if (!app) throw new Error('NOT_FOUND');
    if (app.posterId !== userId) throw new Error('FORBIDDEN');

    const job = await ctx.db.get(app.jobId);
    if (!job) throw new Error('JOB_GONE');
    if (job.paymentStatus !== 'funded') throw new Error('NOT_FUNDED');
    if (job.selectedContractorId) throw new Error('ALREADY_SELECTED');

    await ctx.db.patch(applicationId, { status: 'accepted' });

    const others = await ctx.db
      .query('jobApplications')
      .withIndex('by_job', (q) => q.eq('jobId', app.jobId))
      .collect();
    for (const o of others) {
      if (o._id !== applicationId && o.status === 'pending') {
        await ctx.db.patch(o._id, { status: 'rejected' });
      }
    }

    await ctx.db.patch(app.jobId, {
      selectedContractorId: app.contractorId,
      status: 'filled',
    });
  },
});

/**
 * Customer marks the job complete and releases funds.
 * Performs a Stripe Transfer from the platform's balance to the pro's
 * connected account, deducted from the original charge.
 */
export const markJobComplete = action({
  args: { jobId: v.id('jobs') },
  handler: async (ctx, { jobId }): Promise<void> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('UNAUTHENTICATED');

    const data: {
      job: Doc<'jobs'>;
      contractor: Doc<'contractors'> | null;
    } | null = await ctx.runQuery(internal.jobs.getJobAndContractor, { jobId });
    if (!data?.job) throw new Error('NOT_FOUND');

    const { job, contractor } = data;
    if (job.posterId !== userId) throw new Error('FORBIDDEN');
    if (job.paymentStatus !== 'funded') throw new Error('WRONG_STATE');
    if (!job.selectedContractorId) throw new Error('NO_PRO_SELECTED');
    if (!contractor?.stripeAccountId) throw new Error('PRO_NO_STRIPE');
    if (!job.stripeChargeId) throw new Error('NO_CHARGE_RECORDED');
    if (!job.budgetCents || !job.applicationFeeCents) throw new Error('INVALID_AMOUNTS');

    const transferAmount = job.budgetCents - job.applicationFeeCents;
    if (transferAmount <= 0) throw new Error('INVALID_TRANSFER_AMOUNT');

    const stripe = stripeClient();
    const transfer = await stripe.transfers.create({
      amount: transferAmount,
      currency: job.currency ?? 'cad',
      destination: contractor.stripeAccountId,
      source_transaction: job.stripeChargeId,
      transfer_group: `job_${job._id}`,
      metadata: { jobId: job._id, contractorId: contractor._id },
    });

    await ctx.runMutation(internal.jobs.markJobReleased, {
      jobId: job._id,
      stripeTransferId: transfer.id,
    });
  },
});

/** Customer cancels and gets refunded (only before a pro is assigned). */
export const cancelJob = action({
  args: { jobId: v.id('jobs') },
  handler: async (ctx, { jobId }): Promise<void> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('UNAUTHENTICATED');

    const job: Doc<'jobs'> | null = await ctx.runQuery(internal.jobs.getJob, { jobId });
    if (!job) throw new Error('NOT_FOUND');
    if (job.posterId !== userId) throw new Error('FORBIDDEN');
    if (job.paymentStatus === 'released') throw new Error('ALREADY_RELEASED');
    if (job.selectedContractorId) throw new Error('PRO_ALREADY_SELECTED');

    if (job.paymentStatus === 'funded' && job.stripePaymentIntentId) {
      const stripe = stripeClient();
      const refund = await stripe.refunds.create({
        payment_intent: job.stripePaymentIntentId,
        reason: 'requested_by_customer',
      });
      await ctx.runMutation(internal.jobs.markJobRefunded, {
        jobId: job._id,
        stripeRefundId: refund.id,
      });
    } else {
      // No money flowed — just close the post.
      await ctx.runMutation(internal.jobs.setJobStatus, {
        jobId: job._id,
        status: 'closed',
      });
    }
  },
});

// ──────────────────────────────────────────────────────────────────────────
// Queries that power the UI around applications
// ──────────────────────────────────────────────────────────────────────────

export const listApplicationsForJob = query({
  args: { jobId: v.id('jobs') },
  handler: async (ctx, { jobId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const job = await ctx.db.get(jobId);
    if (!job || job.posterId !== userId) return [];

    const apps = await ctx.db
      .query('jobApplications')
      .withIndex('by_job', (q) => q.eq('jobId', jobId))
      .collect();

    const out: Array<{
      _id: Id<'jobApplications'>;
      _creationTime: number;
      status: string;
      message?: string;
      contractor: {
        _id: Id<'contractors'>;
        businessName: string;
        citySlug: string;
        province: string;
        ratingCount: number;
        ratingSum: number;
        stripeOnboardingComplete: boolean;
      } | null;
    }> = [];

    for (const a of apps) {
      const c = await ctx.db.get(a.contractorId);
      out.push({
        _id: a._id,
        _creationTime: a._creationTime,
        status: a.status,
        message: a.message,
        contractor: c
          ? {
              _id: c._id,
              businessName: c.businessName,
              citySlug: c.citySlug,
              province: c.province,
              ratingCount: c.ratingCount ?? 0,
              ratingSum: c.ratingSum ?? 0,
              stripeOnboardingComplete: c.stripeOnboardingComplete === true,
            }
          : null,
      });
    }
    return out;
  },
});

/** Has the signed-in pro applied to this job? Returns the application if so. */
export const myApplicationForJob = query({
  args: { jobId: v.id('jobs') },
  handler: async (ctx, { jobId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const contractor = await ctx.db
      .query('contractors')
      .withIndex('by_owner', (q) => q.eq('ownerId', userId))
      .unique();
    if (!contractor) return null;
    return await ctx.db
      .query('jobApplications')
      .withIndex('by_job_contractor', (q) =>
        q.eq('jobId', jobId).eq('contractorId', contractor._id),
      )
      .unique();
  },
});

// ──────────────────────────────────────────────────────────────────────────
// Internal helpers (used by createPaidCheckout, the webhook, etc.)
// ──────────────────────────────────────────────────────────────────────────

export const insertPendingPaidJob = internalMutation({
  args: {
    posterId: v.id('users'),
    title: v.string(),
    description: v.string(),
    category: v.string(),
    citySlug: v.string(),
    province: v.string(),
    budgetCents: v.number(),
    currency: v.string(),
    applicationFeeCents: v.number(),
    timing: v.optional(v.string()),
    customerEmail: v.string(),
    customerName: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('jobs', {
      ...args,
      contactEmail: args.customerEmail,
      status: 'open',
      paymentStatus: 'pending',
    });
  },
});

export const setJobCheckoutSession = internalMutation({
  args: {
    id: v.id('jobs'),
    stripeCheckoutSessionId: v.string(),
  },
  handler: async (ctx, { id, stripeCheckoutSessionId }) => {
    await ctx.db.patch(id, { stripeCheckoutSessionId });
  },
});

export const getJob = internalQuery({
  args: { jobId: v.id('jobs') },
  handler: async (ctx, { jobId }) => {
    return await ctx.db.get(jobId);
  },
});

export const getJobBySession = internalQuery({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    return await ctx.db
      .query('jobs')
      .withIndex('by_session', (q) => q.eq('stripeCheckoutSessionId', sessionId))
      .unique();
  },
});

export const markJobFunded = internalMutation({
  args: {
    jobId: v.id('jobs'),
    stripePaymentIntentId: v.optional(v.string()),
    stripeChargeId: v.optional(v.string()),
  },
  handler: async (ctx, { jobId, stripePaymentIntentId, stripeChargeId }) => {
    await ctx.db.patch(jobId, {
      paymentStatus: 'funded',
      ...(stripePaymentIntentId ? { stripePaymentIntentId } : {}),
      ...(stripeChargeId ? { stripeChargeId } : {}),
    });
  },
});

export const markJobReleased = internalMutation({
  args: { jobId: v.id('jobs'), stripeTransferId: v.string() },
  handler: async (ctx, { jobId, stripeTransferId }) => {
    await ctx.db.patch(jobId, {
      paymentStatus: 'released',
      stripeTransferId,
      status: 'filled',
      completedAt: Date.now(),
    });
  },
});

export const markJobRefunded = internalMutation({
  args: { jobId: v.id('jobs'), stripeRefundId: v.string() },
  handler: async (ctx, { jobId, stripeRefundId }) => {
    await ctx.db.patch(jobId, {
      paymentStatus: 'refunded',
      stripeRefundId,
      status: 'closed',
    });
  },
});

export const setJobPaymentFailed = internalMutation({
  args: { jobId: v.id('jobs') },
  handler: async (ctx, { jobId }) => {
    await ctx.db.patch(jobId, { paymentStatus: 'failed', status: 'closed' });
  },
});

export const setJobStatus = internalMutation({
  args: { jobId: v.id('jobs'), status: v.string() },
  handler: async (ctx, { jobId, status }) => {
    await ctx.db.patch(jobId, { status });
  },
});

export const getJobAndContractor = internalQuery({
  args: { jobId: v.id('jobs') },
  handler: async (ctx, { jobId }) => {
    const job = await ctx.db.get(jobId);
    if (!job) return null;
    const contractor = job.selectedContractorId
      ? await ctx.db.get(job.selectedContractorId)
      : null;
    return { job, contractor };
  },
});
