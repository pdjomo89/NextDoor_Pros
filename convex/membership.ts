import { v } from 'convex/values';
import Stripe from 'stripe';
import { getAuthUserId } from '@convex-dev/auth/server';
import {
  action,
  internalMutation,
  internalQuery,
  query,
  type QueryCtx,
  type MutationCtx,
} from './_generated/server';
import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';

/**
 * Resolve the Stripe Price ID for a plan. Same prices power both the pro
 * listing and job-posting entitlement — one subscription grants both.
 *   STRIPE_PRICE_MEMBERSHIP_MONTHLY  ($15 CAD / month)
 *   STRIPE_PRICE_MEMBERSHIP_ANNUAL   ($160 CAD / year)
 */
function membershipPriceId(plan: 'monthly' | 'annual'): string {
  const envKey =
    plan === 'monthly'
      ? 'STRIPE_PRICE_MEMBERSHIP_MONTHLY'
      : 'STRIPE_PRICE_MEMBERSHIP_ANNUAL';
  const id = process.env[envKey];
  if (!id) throw new Error(`${envKey} is not set on this Convex deployment.`);
  return id;
}

function stripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set on this Convex deployment.');
  return new Stripe(key, { httpClient: Stripe.createFetchHttpClient() });
}

function siteUrl(): string {
  return process.env.SITE_URL?.replace(/\/$/, '') ?? 'http://localhost:3000';
}

/**
 * Shared gate used by job posting and pro-listing publishing: does this user
 * have an active platform subscription? Plain helper (not a Convex function)
 * so it can run inside other mutations.
 */
export async function hasActiveMembership(
  ctx: QueryCtx | MutationCtx,
  userId: Id<'users'>,
): Promise<boolean> {
  const row = await ctx.db
    .query('memberships')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .unique();
  return row?.status === 'active';
}

// ──────────────────────────────────────────────────────────────────────────
// Public read
// ──────────────────────────────────────────────────────────────────────────

/** The signed-in user's subscription state (or null if not signed in). */
export const myMembership = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const row = await ctx.db
      .query('memberships')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();
    return {
      status: row?.status ?? 'none',
      plan: row?.plan ?? null,
      currentPeriodEnd: row?.currentPeriodEnd ?? null,
    };
  },
});

// ──────────────────────────────────────────────────────────────────────────
// Internal helpers
// ──────────────────────────────────────────────────────────────────────────

export const getUser = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    return await ctx.db.get(userId);
  },
});

export const getMembershipByUser = internalQuery({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    return await ctx.db
      .query('memberships')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();
  },
});

export const getMembershipByCustomer = internalQuery({
  args: { stripeCustomerId: v.string() },
  handler: async (ctx, { stripeCustomerId }) => {
    return await ctx.db
      .query('memberships')
      .withIndex('by_stripeCustomer', (q) => q.eq('stripeCustomerId', stripeCustomerId))
      .unique();
  },
});

/** Insert-or-patch the user's membership row (used by checkout + webhook). */
export const upsertMembership = internalMutation({
  args: {
    userId: v.id('users'),
    stripeCustomerId: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    plan: v.optional(v.string()),
    status: v.optional(v.string()),
    currentPeriodEnd: v.optional(v.number()),
  },
  handler: async (ctx, { userId, ...patch }) => {
    const cleaned: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(patch)) {
      if (val !== undefined) cleaned[k] = val;
    }

    const existing = await ctx.db
      .query('memberships')
      .withIndex('by_user', (q) => q.eq('userId', userId))
      .unique();

    if (existing) {
      if (Object.keys(cleaned).length > 0) await ctx.db.patch(existing._id, cleaned);
      return existing._id;
    }
    return await ctx.db.insert('memberships', {
      userId,
      status: 'none',
      ...cleaned,
    });
  },
});

// ──────────────────────────────────────────────────────────────────────────
// Public actions — invoked from the subscription UI.
// ──────────────────────────────────────────────────────────────────────────

/**
 * Create a Stripe Checkout Session (subscription mode) and return the URL.
 * Works for any signed-in user (pro or not). `returnTo` is a locale-relative
 * path the user lands on after success (e.g. '/jobs/new' or '/pros/dashboard').
 */
export const startMembershipCheckout = action({
  args: {
    plan: v.union(v.literal('monthly'), v.literal('annual')),
    locale: v.string(),
    returnTo: v.optional(v.string()),
  },
  handler: async (ctx, { plan, locale, returnTo }): Promise<{ url: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('UNAUTHENTICATED');

    const membership = await ctx.runQuery(internal.membership.getMembershipByUser, { userId });
    if (membership?.status === 'active') throw new Error('ALREADY_ACTIVE');

    const user: Doc<'users'> | null = await ctx.runQuery(internal.membership.getUser, { userId });

    const stripe = stripeClient();
    let customerId = membership?.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user?.email,
        metadata: { platform: 'nextdoor_pros', userId },
      });
      customerId = customer.id;
      await ctx.runMutation(internal.membership.upsertMembership, {
        userId,
        stripeCustomerId: customerId,
      });
    }

    const ret = returnTo && returnTo.startsWith('/') ? returnTo : '/pros/dashboard';
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: membershipPriceId(plan), quantity: 1 }],
      success_url: `${siteUrl()}/${locale}${ret}?membership=active`,
      cancel_url: `${siteUrl()}/${locale}/membership?cancelled=1`,
      metadata: { platform: 'nextdoor_pros', kind: 'membership', userId, plan },
      subscription_data: {
        metadata: { platform: 'nextdoor_pros', kind: 'membership', userId, plan },
      },
    });

    if (!session.url) throw new Error('STRIPE_SESSION_FAILED');
    return { url: session.url };
  },
});

/**
 * Return a Stripe Customer Portal URL so the user can manage their card,
 * cancel, or switch plans.
 */
export const getCustomerPortalLink = action({
  args: { locale: v.string(), returnTo: v.optional(v.string()) },
  handler: async (ctx, { locale, returnTo }): Promise<{ url: string }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('UNAUTHENTICATED');
    const membership = await ctx.runQuery(internal.membership.getMembershipByUser, { userId });
    if (!membership?.stripeCustomerId) throw new Error('NO_STRIPE_CUSTOMER');

    const ret = returnTo && returnTo.startsWith('/') ? returnTo : '/pros/dashboard';
    const stripe = stripeClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: membership.stripeCustomerId,
      return_url: `${siteUrl()}/${locale}${ret}`,
    });
    return { url: session.url };
  },
});
