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
import type { QueryCtx } from './_generated/server';
import { getProvider } from './paymentProviders';
import {
  countryOfCity,
  currencyForCountry,
  inquiryReplyFeeMinor,
  monetizationModel,
  providerForCountry,
} from './markets';

// ──────────────────────────────────────────────────────────────────────────
// Inquiry unlocks — a pro pays to REPLY to an inbound guest inquiry.
//
// The demand side is never charged: a customer messages a pro for free and with
// no account (convex/messaging.startGuestConversation). The fee falls on the
// pro, who is the side that gets commercial value from the conversation — the
// same principle as the per-lead unlock, in the opposite direction of travel.
//
// Pay-as-you-go markets (Cameroon), flow:
//   1. `startInquiryUnlock` (action) creates an `inquiryUnlocks` row ('created'),
//      calls provider.initiatePay for the reply fee, returns the hosted
//      checkout `link`.
//   2. The pro pays (MoMo / Orange Money) and is returned to their inbox.
//   3. The provider webhook (convex/http.ts) re-verifies via getStatus and flips
//      the unlock to 'successful' — after which the pro may send in that thread
//      (enforced in convex/messaging.sendMessage).
//
// The fee buys the THREAD, not one message: once successful, every later reply
// in that conversation is free. Subscription markets (Canada) are not gated at
// all — replying to a customer is part of what the membership already pays for.
// ──────────────────────────────────────────────────────────────────────────

/**
 * Whether `proId` may send in `conversationId` without paying. True when the
 * market doesn't charge for replies, when the thread isn't a guest inquiry (job
 * threads are already paid for via the lead unlock), when a successful unlock
 * exists, or when the pro has already sent a message in the thread — which
 * grandfathers conversations that predate this gate.
 *
 * Shared with convex/messaging.ts so the gate and the UI can never disagree.
 */
export async function canReplyFree(
  ctx: QueryCtx,
  proId: Id<'users'>,
  convo: Doc<'conversations'>,
): Promise<boolean> {
  // Job threads live in the POSTER's inbox and were already paid for by the pro
  // at lead-unlock time. Only contractor (service) threads are inquiries.
  if (!convo.contractorId) return true;

  const contractor = await ctx.db.get(convo.contractorId);
  const country = contractor?.country ?? countryOfCity(contractor?.citySlug);
  if (monetizationModel(country) !== 'payg') return true;

  const alreadyReplied = await ctx.db
    .query('messages')
    .withIndex('by_conversation', (q) => q.eq('conversationId', convo._id))
    .filter((q) => q.eq(q.field('senderId'), proId))
    .first();
  if (alreadyReplied) return true;

  const unlocks = await ctx.db
    .query('inquiryUnlocks')
    .withIndex('by_pro_conversation', (q) =>
      q.eq('proId', proId).eq('conversationId', convo._id),
    )
    .collect(); // bounded: at most a handful of attempts per (pro, thread)
  return unlocks.some((u) => u.status === 'successful');
}

// ── read: what the inbox needs to render the reply gate ──────────────────────

/**
 * The reply gate for one thread, from the signed-in pro's perspective. Returns
 * `null` when the thread isn't theirs, so the UI reveals nothing about other
 * people's conversations.
 */
export const replyAccess = query({
  args: { conversationId: v.id('conversations') },
  handler: async (
    ctx,
    { conversationId },
  ): Promise<{
    locked: boolean;
    pending: boolean;
    declined: boolean;
    fee: number | null;
    currency: string | null;
  } | null> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const convo = await ctx.db.get(conversationId);
    if (!convo || convo.contractorOwnerId !== userId) return null;

    // Closed for going unanswered (convex/inquiryFollowUps.ts) — no reply, and
    // no further chance to pay for a customer who has moved on.
    if (convo.status === 'declined') {
      return {
        locked: true,
        pending: false,
        declined: true,
        fee: null,
        currency: null,
      };
    }

    if (await canReplyFree(ctx, userId, convo)) {
      return {
        locked: false,
        pending: false,
        declined: false,
        fee: null,
        currency: null,
      };
    }

    const contractor = convo.contractorId
      ? await ctx.db.get(convo.contractorId)
      : null;
    const country = contractor?.country ?? countryOfCity(contractor?.citySlug);
    const pending = (
      await ctx.db
        .query('inquiryUnlocks')
        .withIndex('by_pro_conversation', (q) =>
          q.eq('proId', userId).eq('conversationId', conversationId),
        )
        .collect()
    ).some((u) => u.status === 'pending');

    return {
      locked: true,
      pending,
      declined: false,
      fee: inquiryReplyFeeMinor(country),
      currency: currencyForCountry(country),
    };
  },
});

// ── internal: create (or reuse) a pending unlock row (authenticated) ─────────

type PendingInquiryUnlock = {
  unlockId: Id<'inquiryUnlocks'>;
  proId: Id<'users'>;
  conversationId: Id<'conversations'>;
  provider: string;
  amount: number;
  currency: string; // uppercase ISO 4217, for the provider
  externalId: string;
  email?: string;
};

export const createPendingInquiryUnlock = internalMutation({
  args: { conversationId: v.id('conversations') },
  handler: async (ctx, { conversationId }): Promise<PendingInquiryUnlock> => {
    const proId = await getAuthUserId(ctx);
    if (!proId) throw new Error('Not signed in');

    const convo = await ctx.db.get(conversationId);
    if (!convo) throw new Error('NOT_FOUND');
    if (convo.contractorOwnerId !== proId) throw new Error('FORBIDDEN');
    if (!convo.contractorId) throw new Error('NOT_AN_INQUIRY');
    // Auto-declined for going unanswered (convex/inquiryFollowUps.ts) — never
    // take a pro's money for a customer who has been told to look elsewhere.
    if (convo.status === 'declined') throw new Error('INQUIRY_DECLINED');

    const contractor = await ctx.db.get(convo.contractorId);
    const country = contractor?.country ?? countryOfCity(contractor?.citySlug);
    if (monetizationModel(country) !== 'payg') {
      // Canada & other subscription markets don't charge to reply.
      throw new Error('NOT_CHARGEABLE');
    }

    // Idempotent: never charge twice for the same thread.
    if (await canReplyFree(ctx, proId, convo)) {
      throw new Error('ALREADY_UNLOCKED');
    }

    const provider = providerForCountry(country);
    const currency = currencyForCountry(country);
    const amount = inquiryReplyFeeMinor(country);
    // One idempotency key per (pro, conversation) — stable across retries;
    // charset is [a-zA-Z0-9_] (Convex ids are alphanumeric), under the 100-char
    // cap. Prefixed so it can never collide with a lead unlock's key.
    const externalId = `inq_${conversationId}_${proId}`;

    const unlockId = await ctx.db.insert('inquiryUnlocks', {
      proId,
      conversationId,
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
      conversationId,
      provider,
      amount,
      currency,
      externalId,
      email: user?.email,
    };
  },
});

export const attachInquiryTransaction = internalMutation({
  args: {
    unlockId: v.id('inquiryUnlocks'),
    transId: v.string(),
    link: v.string(),
  },
  handler: async (ctx, { unlockId, transId, link }) => {
    await ctx.db.patch(unlockId, { transId, link, status: 'pending' });
  },
});

// ── public action: kick off a paid reply unlock ──────────────────────────────

export const startInquiryUnlock = action({
  args: { conversationId: v.id('conversations'), locale: v.string() },
  handler: async (ctx, { conversationId, locale }): Promise<{ link: string }> => {
    const pending: PendingInquiryUnlock = await ctx.runMutation(
      internal.inquiryUnlocks.createPendingInquiryUnlock,
      { conversationId },
    );

    const siteUrl = (process.env.SITE_URL ?? '').replace(/\/$/, '');
    const redirectUrl = `${siteUrl}/${locale}/messages?c=${pending.conversationId}&unlocked=1`;

    const result = await getProvider(pending.provider).initiatePay({
      amount: pending.amount,
      currency: pending.currency,
      email: pending.email,
      userId: pending.proId,
      externalId: pending.externalId,
      redirectUrl,
      message: 'NextDoor Pros inquiry reply',
    });

    await ctx.runMutation(internal.inquiryUnlocks.attachInquiryTransaction, {
      unlockId: pending.unlockId,
      transId: result.transId,
      link: result.link,
    });

    return { link: result.link };
  },
});

// ── settlement (called by the webhook, and by the fallback poll below) ───────

export const applyInquiryUnlockResult = internalMutation({
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
      .query('inquiryUnlocks')
      .withIndex('by_transId', (q) => q.eq('transId', transId))
      .unique();
    if (!unlock) return; // unknown transaction (belongs to another table) — ignore

    // Idempotent: once successful, never downgrade.
    if (unlock.status === 'successful') return;

    await ctx.db.patch(unlock._id, { status });
  },
});

// ── fallback poll (in case a webhook is missed) ──────────────────────────────

export const getOwnedUnlockByConversation = internalQuery({
  args: { conversationId: v.id('conversations') },
  handler: async (
    ctx,
    { conversationId },
  ): Promise<Doc<'inquiryUnlocks'> | null> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const unlock = await ctx.db
      .query('inquiryUnlocks')
      .withIndex('by_pro_conversation', (q) =>
        q.eq('proId', userId).eq('conversationId', conversationId),
      )
      .order('desc')
      .first();
    return unlock ?? null;
  },
});

/**
 * Re-check an inquiry unlock against the provider and settle it. Safe to call
 * from the inbox after the payer is redirected back, in case the webhook was
 * delayed or missed. Only settles unlocks owned by the caller.
 */
export const refreshInquiryUnlock = action({
  args: { conversationId: v.id('conversations') },
  handler: async (ctx, { conversationId }): Promise<{ status: string } | null> => {
    const unlock = await ctx.runQuery(
      internal.inquiryUnlocks.getOwnedUnlockByConversation,
      { conversationId },
    );
    if (!unlock?.transId) return null;

    const remote = await getProvider(unlock.provider).getStatus(unlock.transId);
    await ctx.runMutation(internal.inquiryUnlocks.applyInquiryUnlockResult, {
      transId: unlock.transId,
      status: remote.status,
    });
    return { status: remote.status };
  },
});
