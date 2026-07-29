import { v } from 'convex/values';
import { getAuthUserId } from '@convex-dev/auth/server';
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
} from './_generated/server';
import type { ActionCtx } from './_generated/server';
import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';
import { createTransfer } from './stripeConnect';
import {
  createEscrowCheckout,
  refundPaymentIntent,
  retrieveLatestCharge,
} from './stripeEscrow';
import { countryOfCity, currencyForCountry, monetizationModel } from './markets';

// ──────────────────────────────────────────────────────────────────────────
// Job escrow: employer pays the agreed job amount to the platform (held), and
// the pro is paid out once the work is confirmed done, minus commission.
//
//   1. Pro sends a payment request (agreed amount)     → escrow 'requested'
//   2. Employer pays via hosted Checkout               → charge held on platform
//   3. Pro marks the work done                         → starts the release clock
//   4. Employer confirms (or 7 days pass)              → Transfer to pro − 5%
//
// Money uses Stripe "separate charges & transfers": the charge lands on the
// platform balance; a Transfer pays the pro's connected account. Only runs in
// subscription markets (Canada) today. Amounts are server-authoritative.
// ──────────────────────────────────────────────────────────────────────────

/** Platform commission kept from each job payment (basis points; 500 = 5%). */
export const JOB_COMMISSION_BPS = 500;
/** Days after the pro marks a job done before escrow auto-releases to them. */
export const ESCROW_AUTO_RELEASE_DAYS = 7;

const MIN_AMOUNT_MINOR = 100;
const MAX_AMOUNT_MINOR = 50_000_000;

function commissionOf(amount: number, bps: number): number {
  return Math.floor((amount * bps) / 10000);
}

// ── read: the escrow for a job, scoped to the signed-in participant ──────────

export const myJobEscrow = query({
  args: { jobId: v.id('jobs') },
  handler: async (ctx, { jobId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const escrow = await ctx.db
      .query('jobEscrows')
      .withIndex('by_job', (q) => q.eq('jobId', jobId))
      .order('desc')
      .first();
    if (!escrow) return null;
    if (escrow.proId !== userId && escrow.employerId !== userId) return null;

    const commission = commissionOf(escrow.amount, escrow.commissionBps);
    return {
      _id: escrow._id,
      status: escrow.status,
      amount: escrow.amount,
      currency: escrow.currency,
      commission,
      proReceives: escrow.amount - commission,
      role: escrow.proId === userId ? ('pro' as const) : ('employer' as const),
      proMarkedDone: escrow.proMarkedDoneAt !== undefined,
    };
  },
});

// ── pro: request payment (agree an amount) ───────────────────────────────────

export const requestJobPayment = mutation({
  args: { jobId: v.id('jobs'), amount: v.number() },
  handler: async (ctx, { jobId, amount }): Promise<Id<'jobEscrows'>> => {
    const proId = await getAuthUserId(ctx);
    if (!proId) throw new Error('Not signed in');
    if (
      !Number.isInteger(amount) ||
      amount < MIN_AMOUNT_MINOR ||
      amount > MAX_AMOUNT_MINOR
    ) {
      throw new Error('INVALID_AMOUNT');
    }

    const job = await ctx.db.get(jobId);
    if (!job) throw new Error('Job not found');
    if (job.posterId === proId) throw new Error('OWN_JOB');

    const country = job.country ?? countryOfCity(job.citySlug);
    if (monetizationModel(country) !== 'subscription') {
      throw new Error('ESCROW_NOT_SUPPORTED'); // platform payments = subscription markets
    }

    // Only a pro who unlocked this lead can request payment for it.
    const unlocks = await ctx.db
      .query('leadUnlocks')
      .withIndex('by_pro_job', (q) => q.eq('proId', proId).eq('jobId', jobId))
      .collect();
    if (!unlocks.some((u) => u.status === 'successful')) {
      throw new Error('NOT_UNLOCKED');
    }

    // The pro must be able to receive payouts before requesting money.
    const account = await ctx.db
      .query('connectAccounts')
      .withIndex('by_user', (q) => q.eq('userId', proId))
      .unique();
    if (!account?.payoutsEnabled) throw new Error('PAYOUTS_NOT_SET_UP');

    const currency = currencyForCountry(country).toLowerCase();

    // Reuse an outstanding (unpaid) request for this job+pro; block if already paid.
    const existing = await ctx.db
      .query('jobEscrows')
      .withIndex('by_job', (q) => q.eq('jobId', jobId))
      .collect();
    const mine = existing.filter((e) => e.proId === proId);
    if (mine.some((e) => e.status === 'held' || e.status === 'released')) {
      throw new Error('ALREADY_PAID');
    }
    const outstanding = mine.find((e) => e.status === 'requested');
    if (outstanding) {
      await ctx.db.patch(outstanding._id, { amount, currency });
      return outstanding._id;
    }

    return await ctx.db.insert('jobEscrows', {
      jobId,
      proId,
      employerId: job.posterId,
      amount,
      currency,
      commissionBps: JOB_COMMISSION_BPS,
      status: 'requested',
    });
  },
});

// ── employer: pay the request (hosted Checkout → held) ───────────────────────

export const escrowById = internalQuery({
  args: { escrowId: v.id('jobEscrows') },
  handler: async (ctx, { escrowId }): Promise<Doc<'jobEscrows'> | null> => {
    return await ctx.db.get(escrowId);
  },
});

export const attachEscrowSession = internalMutation({
  args: { escrowId: v.id('jobEscrows'), sessionId: v.string() },
  handler: async (ctx, { escrowId, sessionId }) => {
    await ctx.db.patch(escrowId, { stripeSessionId: sessionId });
  },
});

export const payJobEscrow = action({
  args: { escrowId: v.id('jobEscrows'), locale: v.string() },
  handler: async (ctx, { escrowId, locale }): Promise<{ url: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not signed in');

    const escrow: Doc<'jobEscrows'> | null = await ctx.runQuery(
      internal.jobEscrow.escrowById,
      { escrowId },
    );
    if (!escrow) throw new Error('NOT_FOUND');
    if (escrow.employerId !== userId) throw new Error('FORBIDDEN'); // only the payer
    if (escrow.status !== 'requested') throw new Error('NOT_PAYABLE');

    const siteUrl = (process.env.SITE_URL ?? '').replace(/\/$/, '');
    const { url, sessionId } = await createEscrowCheckout({
      amountMinor: escrow.amount,
      currency: escrow.currency,
      productName: 'NextDoor Pros job payment',
      escrowId,
      successUrl: `${siteUrl}/${locale}/jobs/${escrow.jobId}?paid=1`,
      cancelUrl: `${siteUrl}/${locale}/jobs/${escrow.jobId}?canceled=1`,
    });
    await ctx.runMutation(internal.jobEscrow.attachEscrowSession, {
      escrowId,
      sessionId,
    });
    return { url };
  },
});

/** Settle a paid escrow checkout (called by the webhook). Idempotent. */
export const markEscrowHeld = internalMutation({
  args: { sessionId: v.string(), paymentIntentId: v.optional(v.string()) },
  handler: async (ctx, { sessionId, paymentIntentId }) => {
    const escrow = await ctx.db
      .query('jobEscrows')
      .withIndex('by_session', (q) => q.eq('stripeSessionId', sessionId))
      .unique();
    if (!escrow) return;
    if (escrow.status !== 'requested') return; // already held/released — no-op
    await ctx.db.patch(escrow._id, {
      status: 'held',
      stripePaymentIntentId: paymentIntentId,
    });
  },
});

// ── pro: mark the work done (starts the auto-release clock) ───────────────────

export const markJobDone = mutation({
  args: { escrowId: v.id('jobEscrows') },
  handler: async (ctx, { escrowId }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not signed in');
    const escrow = await ctx.db.get(escrowId);
    if (!escrow) throw new Error('NOT_FOUND');
    if (escrow.proId !== userId) throw new Error('FORBIDDEN');
    if (escrow.status !== 'held') throw new Error('NOT_HELD');
    if (escrow.proMarkedDoneAt === undefined) {
      await ctx.db.patch(escrowId, { proMarkedDoneAt: Date.now() });
    }
  },
});

// ── release: transfer to the pro minus commission ────────────────────────────

type ReleaseInfo = {
  status: string;
  amount: number;
  currency: string;
  commissionBps: number;
  proId: Id<'users'>;
  paymentIntentId?: string;
  destination: string | null;
};

export const releaseContext = internalQuery({
  args: { escrowId: v.id('jobEscrows') },
  handler: async (ctx, { escrowId }): Promise<ReleaseInfo | null> => {
    const escrow = await ctx.db.get(escrowId);
    if (!escrow) return null;
    const account = await ctx.db
      .query('connectAccounts')
      .withIndex('by_user', (q) => q.eq('userId', escrow.proId))
      .unique();
    return {
      status: escrow.status,
      amount: escrow.amount,
      currency: escrow.currency,
      commissionBps: escrow.commissionBps,
      proId: escrow.proId,
      paymentIntentId: escrow.stripePaymentIntentId,
      destination: account?.payoutsEnabled ? account.stripeAccountId : null,
    };
  },
});

export const setEscrowReleased = internalMutation({
  args: { escrowId: v.id('jobEscrows'), transferId: v.string() },
  handler: async (ctx, { escrowId, transferId }) => {
    const escrow = await ctx.db.get(escrowId);
    if (!escrow || escrow.status !== 'held') return; // idempotent
    await ctx.db.patch(escrowId, {
      status: 'released',
      stripeTransferId: transferId,
      releasedAt: Date.now(),
    });
  },
});

/**
 * Transfer escrowed funds to the pro minus commission. Shared by the employer's
 * confirm action and the auto-release cron. Safe to call once per held escrow.
 */
async function doRelease(
  ctx: ActionCtx,
  escrowId: Id<'jobEscrows'>,
): Promise<'released' | 'skipped'> {
  const info: ReleaseInfo | null = await ctx.runQuery(
    internal.jobEscrow.releaseContext,
    { escrowId },
  );
  if (!info || info.status !== 'held') return 'skipped';
  if (!info.destination) throw new Error('PRO_PAYOUTS_NOT_SET_UP');

  const commission = commissionOf(info.amount, info.commissionBps);
  const payout = info.amount - commission;
  const sourceCharge = info.paymentIntentId
    ? await retrieveLatestCharge(info.paymentIntentId)
    : null;

  const transfer = await createTransfer({
    amountMinor: payout,
    currency: info.currency,
    destination: info.destination,
    sourceTransaction: sourceCharge ?? undefined,
    metadata: { escrowId },
  });
  await ctx.runMutation(internal.jobEscrow.setEscrowReleased, {
    escrowId,
    transferId: transfer.id,
  });
  return 'released';
}

export const confirmAndRelease = action({
  args: { escrowId: v.id('jobEscrows') },
  handler: async (ctx, { escrowId }): Promise<{ status: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not signed in');
    const escrow: Doc<'jobEscrows'> | null = await ctx.runQuery(
      internal.jobEscrow.escrowById,
      { escrowId },
    );
    if (!escrow) throw new Error('NOT_FOUND');
    if (escrow.employerId !== userId) throw new Error('FORBIDDEN'); // only the payer confirms
    const result = await doRelease(ctx, escrowId);
    return { status: result };
  },
});

// ── refund (employer/admin, before release) ──────────────────────────────────

export const setEscrowRefunded = internalMutation({
  args: { escrowId: v.id('jobEscrows') },
  handler: async (ctx, { escrowId }) => {
    const escrow = await ctx.db.get(escrowId);
    if (!escrow || escrow.status !== 'held') return;
    await ctx.db.patch(escrowId, { status: 'refunded' });
  },
});

export const refundJobEscrow = action({
  args: { escrowId: v.id('jobEscrows') },
  handler: async (ctx, { escrowId }): Promise<{ status: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Not signed in');
    const escrow: Doc<'jobEscrows'> | null = await ctx.runQuery(
      internal.jobEscrow.escrowById,
      { escrowId },
    );
    if (!escrow) throw new Error('NOT_FOUND');
    if (escrow.employerId !== userId) throw new Error('FORBIDDEN');
    if (escrow.status !== 'held') throw new Error('NOT_HELD');
    if (escrow.stripePaymentIntentId) {
      await refundPaymentIntent(escrow.stripePaymentIntentId);
    }
    await ctx.runMutation(internal.jobEscrow.setEscrowRefunded, { escrowId });
    return { status: 'refunded' };
  },
});

// ── auto-release cron: release held escrows the pro marked done N days ago ─────

export const dueForAutoRelease = internalQuery({
  args: {},
  handler: async (ctx): Promise<Array<Id<'jobEscrows'>>> => {
    const cutoff = Date.now() - ESCROW_AUTO_RELEASE_DAYS * 24 * 60 * 60 * 1000;
    const held = await ctx.db
      .query('jobEscrows')
      .withIndex('by_status', (q) => q.eq('status', 'held'))
      .take(200);
    return held
      .filter(
        (e) => e.proMarkedDoneAt !== undefined && e.proMarkedDoneAt <= cutoff,
      )
      .map((e) => e._id);
  },
});

export const autoReleaseDueEscrows = internalAction({
  args: {},
  handler: async (ctx): Promise<{ released: number }> => {
    const due: Array<Id<'jobEscrows'>> = await ctx.runQuery(
      internal.jobEscrow.dueForAutoRelease,
      {},
    );
    let released = 0;
    for (const escrowId of due) {
      try {
        const r = await doRelease(ctx, escrowId);
        if (r === 'released') released += 1;
      } catch {
        // Leave it held; the next run retries.
      }
    }
    return { released };
  },
});
