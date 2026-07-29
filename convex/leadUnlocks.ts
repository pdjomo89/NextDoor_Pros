import { v } from 'convex/values';
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
import { getProvider } from './paymentProviders';
import {
  countryOfCity,
  currencyForCountry,
  leadUnlockFeeMinor,
  monetizationModel,
  providerForCountry,
} from './markets';
import { assertMembershipQuota } from './memberships';

// ──────────────────────────────────────────────────────────────────────────
// Lead unlocks — a pro pays to open a conversation with a job's poster.
//
// Pay-as-you-go markets (Cameroon): the pro pays a small per-lead fee via the
// market's provider (Fapshi). Flow:
//
//   1. `startLeadUnlock` (action) creates a `leadUnlocks` row ('created'),
//      calls provider.initiatePay for the unlock fee, and returns the hosted
//      checkout `link`.
//   2. The pro pays and is returned to the job page.
//   3. The provider webhook (convex/http.ts) re-verifies via getStatus and
//      flips the unlock to 'successful' — after which the pro may contact the
//      poster (enforced in convex/messaging.startJobConversation).
//
// Subscription markets (Canada) do NOT charge per unlock — an unlock is covered
// by the pro's membership quota. That path lands in Phase 2; here we reject it
// with MEMBERSHIP_REQUIRED so nothing silently charges the wrong way.
// ──────────────────────────────────────────────────────────────────────────

/** Does the signed-in user already hold a successful unlock for this job? */
export const isUnlocked = query({
  args: { jobId: v.id('jobs') },
  handler: async (
    ctx,
    { jobId },
  ): Promise<{ unlocked: boolean; pending: boolean }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { unlocked: false, pending: false };
    const rows = await ctx.db
      .query('leadUnlocks')
      .withIndex('by_pro_job', (q) => q.eq('proId', userId).eq('jobId', jobId))
      .collect(); // bounded: at most a handful of attempts per (pro, job)
    return {
      unlocked: rows.some((r) => r.status === 'successful'),
      pending: rows.some((r) => r.status === 'pending'),
    };
  },
});

// ── internal: create (or reuse) a pending unlock row (authenticated) ─────────

type PendingUnlock = {
  unlockId: Id<'leadUnlocks'>;
  proId: Id<'users'>;
  jobId: Id<'jobs'>;
  provider: string;
  amount: number;
  currency: string; // uppercase ISO 4217, for the provider
  externalId: string;
  email?: string;
};

export const createPendingUnlock = internalMutation({
  args: { jobId: v.id('jobs') },
  handler: async (ctx, { jobId }): Promise<PendingUnlock> => {
    const proId = await getAuthUserId(ctx);
    if (!proId) throw new Error('Not signed in');

    const job = await ctx.db.get(jobId);
    if (!job) throw new Error('Job not found');
    if (job.status !== 'open') throw new Error('NOT_OPEN');
    if (job.posterId === proId) throw new Error('OWN_JOB'); // can't unlock your own post

    const country = job.country ?? countryOfCity(job.citySlug);
    if (monetizationModel(country) !== 'payg') {
      // Canada & other subscription markets are covered by the membership quota,
      // not a per-lead charge. Wired in Phase 2.
      throw new Error('MEMBERSHIP_REQUIRED');
    }

    // Idempotent: never charge twice for the same lead.
    const existing = await ctx.db
      .query('leadUnlocks')
      .withIndex('by_pro_job', (q) => q.eq('proId', proId).eq('jobId', jobId))
      .collect();
    if (existing.some((r) => r.status === 'successful')) {
      throw new Error('ALREADY_UNLOCKED');
    }

    const provider = providerForCountry(country);
    const currency = currencyForCountry(country);
    const amount = leadUnlockFeeMinor(country);
    // One idempotency key per (pro, job) — stable across retries; charset is
    // [a-zA-Z0-9_] (Convex ids are alphanumeric), well under the 100-char cap.
    const externalId = `${jobId}_${proId}`;

    const unlockId = await ctx.db.insert('leadUnlocks', {
      proId,
      jobId,
      country,
      provider,
      externalId,
      amount,
      currency: currency.toLowerCase(),
      status: 'created',
    });

    const user: Doc<'users'> | null = await ctx.db.get(proId);

    return {
      unlockId,
      proId,
      jobId,
      provider,
      amount,
      currency,
      externalId,
      email: user?.email,
    };
  },
});

export const attachUnlockTransaction = internalMutation({
  args: {
    unlockId: v.id('leadUnlocks'),
    transId: v.string(),
    link: v.string(),
  },
  handler: async (ctx, { unlockId, transId, link }) => {
    await ctx.db.patch(unlockId, { transId, link, status: 'pending' });
  },
});

// ── public action: kick off a paid lead unlock ───────────────────────────────

export const startLeadUnlock = action({
  args: { jobId: v.id('jobs'), locale: v.string() },
  handler: async (ctx, { jobId, locale }): Promise<{ link: string }> => {
    const pending: PendingUnlock = await ctx.runMutation(
      internal.leadUnlocks.createPendingUnlock,
      { jobId },
    );

    const siteUrl = (process.env.SITE_URL ?? '').replace(/\/$/, '');
    const redirectUrl = `${siteUrl}/${locale}/jobs/${pending.jobId}?unlocked=1`;

    const result = await getProvider(pending.provider).initiatePay({
      amount: pending.amount,
      currency: pending.currency,
      email: pending.email,
      userId: pending.proId,
      externalId: pending.externalId,
      redirectUrl,
      message: 'NextDoor Pros lead unlock',
    });

    await ctx.runMutation(internal.leadUnlocks.attachUnlockTransaction, {
      unlockId: pending.unlockId,
      transId: result.transId,
      link: result.link,
    });

    return { link: result.link };
  },
});

// ── subscription markets: unlock covered by the pro's membership quota ───────

/**
 * Unlock a lead using the pro's active membership (subscription markets, e.g.
 * Canada) — no per-lead charge. Enforces an active pro membership with quota
 * left, then records a zero-amount successful unlock so the pro may contact the
 * poster. Idempotent per (pro, job). Pay-as-you-go markets must use
 * `startLeadUnlock` instead.
 */
export const unlockWithMembership = mutation({
  args: { jobId: v.id('jobs') },
  handler: async (ctx, { jobId }): Promise<{ unlocked: boolean }> => {
    const proId = await getAuthUserId(ctx);
    if (!proId) throw new Error('Not signed in');

    const job = await ctx.db.get(jobId);
    if (!job) throw new Error('Job not found');
    if (job.status !== 'open') throw new Error('NOT_OPEN');
    if (job.posterId === proId) throw new Error('OWN_JOB');

    const country = job.country ?? countryOfCity(job.citySlug);
    if (monetizationModel(country) !== 'subscription') {
      throw new Error('NOT_SUBSCRIPTION_MARKET');
    }

    // Idempotent: already unlocked → nothing to consume.
    const existing = await ctx.db
      .query('leadUnlocks')
      .withIndex('by_pro_job', (q) => q.eq('proId', proId).eq('jobId', jobId))
      .collect();
    if (existing.some((r) => r.status === 'successful')) {
      return { unlocked: true };
    }

    // Membership + remaining quota (counts this pro's unlocks this period).
    await assertMembershipQuota(ctx, proId, 'pro', country);

    const currency = currencyForCountry(country);
    await ctx.db.insert('leadUnlocks', {
      proId,
      jobId,
      country,
      provider: 'stripe',
      externalId: `${jobId}_${proId}`,
      amount: 0, // covered by the membership — no charge
      currency: currency.toLowerCase(),
      status: 'successful',
    });
    return { unlocked: true };
  },
});

// ── settlement (called by the webhook, and by the fallback poll below) ───────

export const applyUnlockResult = internalMutation({
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
    const unlock = await ctx.db
      .query('leadUnlocks')
      .withIndex('by_transId', (q) => q.eq('transId', transId))
      .unique();
    if (!unlock) return; // unknown transaction (belongs to another table) — ignore

    // Idempotent: once successful, never downgrade.
    if (unlock.status === 'successful') return;

    await ctx.db.patch(unlock._id, { status });
  },
});

// ── fallback poll (in case a webhook is missed) ──────────────────────────────

export const getOwnedUnlockByJob = internalQuery({
  args: { jobId: v.id('jobs') },
  handler: async (ctx, { jobId }): Promise<Doc<'leadUnlocks'> | null> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const unlock = await ctx.db
      .query('leadUnlocks')
      .withIndex('by_pro_job', (q) => q.eq('proId', userId).eq('jobId', jobId))
      .order('desc')
      .first();
    return unlock ?? null;
  },
});

/**
 * Re-check a lead unlock against the provider and settle it. Safe to call from
 * the job page after the payer is redirected back, in case the webhook was
 * delayed or missed. Only settles unlocks owned by the caller.
 */
export const refreshLeadUnlock = action({
  args: { jobId: v.id('jobs') },
  handler: async (ctx, { jobId }): Promise<{ status: string } | null> => {
    const unlock = await ctx.runQuery(
      internal.leadUnlocks.getOwnedUnlockByJob,
      { jobId },
    );
    if (!unlock?.transId) return null;

    const remote = await getProvider(unlock.provider).getStatus(unlock.transId);
    await ctx.runMutation(internal.leadUnlocks.applyUnlockResult, {
      transId: unlock.transId,
      status: remote.status,
    });
    return { status: remote.status };
  },
});
