import { v } from 'convex/values';
import { getAuthUserId } from '@convex-dev/auth/server';
import {
  action,
  internalMutation,
  internalQuery,
  query,
} from './_generated/server';
import { internal } from './_generated/api';
import type { Id } from './_generated/dataModel';
import {
  createAccountLink,
  createExpressAccount,
} from './stripeConnect';
import { countryOfCity, monetizationModel } from './markets';

// ──────────────────────────────────────────────────────────────────────────
// Pro payout onboarding (Stripe Connect Express).
//
// A pro must complete Connect onboarding before the platform can pay them out
// for a job. `createOnboardingLink` creates (once) their Express account and
// returns a hosted onboarding URL; Stripe then reports capability changes via
// the account.updated webhook (convex/http.ts → upsertConnectFromStripe).
//
// Platform-collected job payments (and therefore payouts) only run in
// subscription markets today (Canada), so onboarding is gated to those.
// ──────────────────────────────────────────────────────────────────────────

type ConnectContext = {
  userId: Id<'users'>;
  email?: string;
  country: string;
  accountId: string | null;
};

export const connectContext = internalQuery({
  args: {},
  handler: async (ctx): Promise<ConnectContext> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('NOT_SIGNED_IN');
    const contractor = await ctx.db
      .query('contractors')
      .withIndex('by_owner', (q) => q.eq('ownerId', userId))
      .unique();
    if (!contractor) throw new Error('NO_CONTRACTOR_PROFILE');

    const user = await ctx.db.get(userId);
    const account = await ctx.db
      .query('connectAccounts')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();

    return {
      userId,
      email: (user as { email?: string } | null)?.email,
      country: contractor.country ?? countryOfCity(contractor.citySlug),
      accountId: account?.stripeAccountId ?? null,
    };
  },
});

export const saveAccountId = internalMutation({
  args: { userId: v.id('users'), stripeAccountId: v.string(), country: v.string() },
  handler: async (ctx, { userId, stripeAccountId, country }) => {
    const existing = await ctx.db
      .query('connectAccounts')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();
    if (existing) {
      await ctx.db.patch(existing._id, { stripeAccountId, country });
      return;
    }
    await ctx.db.insert('connectAccounts', {
      userId,
      stripeAccountId,
      country,
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
    });
  },
});

export const createOnboardingLink = action({
  args: { locale: v.string() },
  handler: async (ctx, { locale }): Promise<{ url: string }> => {
    const info: ConnectContext = await ctx.runQuery(
      internal.connect.connectContext,
      {},
    );
    if (monetizationModel(info.country) !== 'subscription') {
      // Platform-collected job payments (and payouts) aren't offered in
      // pay-as-you-go markets yet.
      throw new Error('PAYOUTS_NOT_SUPPORTED');
    }

    let accountId = info.accountId;
    if (!accountId) {
      const acct = await createExpressAccount({
        country: info.country,
        email: info.email,
        userId: info.userId,
      });
      accountId = acct.id;
      await ctx.runMutation(internal.connect.saveAccountId, {
        userId: info.userId,
        stripeAccountId: accountId,
        country: info.country,
      });
    }

    const siteUrl = (process.env.SITE_URL ?? '').replace(/\/$/, '');
    const link = await createAccountLink(
      accountId,
      `${siteUrl}/${locale}/pros/dashboard?connect=refresh`,
      `${siteUrl}/${locale}/pros/dashboard?connect=done`,
    );
    return { url: link.url };
  },
});

// ── read: the signed-in pro's payout status ──────────────────────────────────

export const myConnectStatus = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const account = await ctx.db
      .query('connectAccounts')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();
    if (!account) {
      return { hasAccount: false, detailsSubmitted: false, payoutsEnabled: false };
    }
    return {
      hasAccount: true,
      detailsSubmitted: account.detailsSubmitted,
      payoutsEnabled: account.payoutsEnabled,
      chargesEnabled: account.chargesEnabled,
    };
  },
});

// ── settle: update capability status from Stripe (account.updated webhook) ────

export const upsertConnectFromStripe = internalMutation({
  args: {
    stripeAccountId: v.string(),
    chargesEnabled: v.boolean(),
    payoutsEnabled: v.boolean(),
    detailsSubmitted: v.boolean(),
  },
  handler: async (ctx, args) => {
    const account = await ctx.db
      .query('connectAccounts')
      .withIndex('by_stripeAccount', (q) =>
        q.eq('stripeAccountId', args.stripeAccountId),
      )
      .unique();
    if (!account) return; // not one of ours (or created out-of-band) — ignore
    await ctx.db.patch(account._id, {
      chargesEnabled: args.chargesEnabled,
      payoutsEnabled: args.payoutsEnabled,
      detailsSubmitted: args.detailsSubmitted,
    });
  },
});

/** The pro's payout-ready connected account id, if any (internal use by escrow). */
export const payoutAccountForUser = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }): Promise<string | null> => {
    const account = await ctx.db
      .query('connectAccounts')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();
    return account?.payoutsEnabled ? account.stripeAccountId : null;
  },
});
