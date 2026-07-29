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
import type { MutationCtx, QueryCtx } from './_generated/server';
import {
  createPortalSession,
  createSubscriptionCheckout,
  type SubscriptionInterval,
} from './stripeSubscriptions';
import {
  membershipPlanConfig,
  membershipTrialDays,
  monetizationModel,
} from './markets';
import type { MembershipRole } from './markets';

// ──────────────────────────────────────────────────────────────────────────
// Memberships (subscription markets, e.g. Canada).
//
// A recurring Stripe subscription grants a per-billing-period quota of actions
// (job posts for a poster, lead unlocks for a pro). Hard cap: once the quota is
// spent, the member is blocked until renewal (no overage). Quota USAGE is
// derived by counting jobs / successful leadUnlocks created within the current
// period — never stored — so it can't drift from reality. Prices + quotas live
// in convex/markets.ts. Lifecycle is driven by Stripe webhooks (convex/http.ts →
// upsertFromStripe); nothing here trusts the browser for subscription state.
// ──────────────────────────────────────────────────────────────────────────

/** Map Stripe's subscription status onto the status we persist. */
function toLocalStatus(stripeStatus: string): string {
  switch (stripeStatus) {
    case 'active':
    case 'trialing':
      return 'active';
    case 'past_due':
    case 'unpaid':
      return 'past_due';
    case 'canceled':
    case 'incomplete_expired':
      return 'canceled';
    case 'incomplete':
      return 'incomplete';
    default:
      return 'expired';
  }
}

// ── shared helpers (imported by jobs.ts / leadUnlocks.ts for gating) ─────────

/** The user's membership for a role, only if it is currently 'active'. */
export async function getActiveMembership(
  ctx: QueryCtx,
  userId: Id<'users'>,
  role: MembershipRole,
): Promise<Doc<'memberships'> | null> {
  const membership = await ctx.db
    .query('memberships')
    .withIndex('by_user_role', (q) => q.eq('userId', userId).eq('role', role))
    .order('desc')
    .first();
  return membership && membership.status === 'active' ? membership : null;
}

/**
 * Actions the user has taken in the current billing period (poster → jobs
 * posted, pro → leads unlocked). Bounded read — the quota is tiny, so scanning
 * the most-recent rows and counting those in-period is exact for the comparison.
 */
export async function countUsageInPeriod(
  ctx: QueryCtx,
  userId: Id<'users'>,
  role: MembershipRole,
  periodStart: number,
): Promise<number> {
  if (role === 'poster') {
    const recent = await ctx.db
      .query('jobs')
      .withIndex('by_poster', (q) => q.eq('posterId', userId))
      .order('desc')
      .take(50);
    return recent.filter((j) => j._creationTime >= periodStart).length;
  }
  const recent = await ctx.db
    .query('leadUnlocks')
    .withIndex('by_pro', (q) => q.eq('proId', userId))
    .order('desc')
    .take(50);
  return recent.filter(
    (u) => u.status === 'successful' && u._creationTime >= periodStart,
  ).length;
}

/**
 * Enforce a subscription market's gate for one action: the user must hold an
 * active membership for `role` and have quota left this period. Throws
 * MEMBERSHIP_REQUIRED or QUOTA_EXCEEDED. No-op sugar callers use before the
 * action they are gating (posting a job, unlocking a lead).
 */
export async function assertMembershipQuota(
  ctx: MutationCtx,
  userId: Id<'users'>,
  role: MembershipRole,
  country: string,
): Promise<Doc<'memberships'>> {
  const membership = await getActiveMembership(ctx, userId, role);
  if (!membership) throw new Error('MEMBERSHIP_REQUIRED');
  const quota = membershipPlanConfig(country, role).quotaPerPeriod;
  const start = membership.currentPeriodStart ?? 0;
  const used = await countUsageInPeriod(ctx, userId, role, start);
  if (used >= quota) throw new Error('QUOTA_EXCEEDED');
  return membership;
}

// ── read: the signed-in user's membership + quota for a role ─────────────────

export const myMembership = query({
  args: { role: v.union(v.literal('poster'), v.literal('pro')), country: v.string() },
  handler: async (ctx, { role, country }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const membership = await ctx.db
      .query('memberships')
      .withIndex('by_user_role', (q) => q.eq('userId', userId).eq('role', role))
      .order('desc')
      .first();
    if (!membership) return null;

    const quota =
      monetizationModel(country) === 'subscription'
        ? membershipPlanConfig(country, role).quotaPerPeriod
        : 0;
    const used =
      membership.status === 'active'
        ? await countUsageInPeriod(
            ctx,
            userId,
            role,
            membership.currentPeriodStart ?? 0,
          )
        : 0;
    return {
      status: membership.status,
      plan: membership.plan,
      active: membership.status === 'active',
      currentPeriodEnd: membership.currentPeriodEnd,
      cancelAtPeriodEnd: membership.cancelAtPeriodEnd ?? false,
      quota,
      used,
      remaining: Math.max(0, quota - used),
      hasBilling: !!membership.stripeCustomerId,
    };
  },
});

// ── start a subscription (hosted Stripe Checkout) ────────────────────────────

export const startContext = internalQuery({
  args: { role: v.union(v.literal('poster'), v.literal('pro')) },
  handler: async (
    ctx,
    { role },
  ): Promise<{ userId: Id<'users'>; email?: string; alreadyActive: boolean }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('NOT_SIGNED_IN');
    const user = await ctx.db.get(userId);
    const active = await getActiveMembership(ctx, userId, role);
    return {
      userId,
      email: (user as { email?: string } | null)?.email,
      alreadyActive: !!active,
    };
  },
});

export const startMembership = action({
  args: {
    role: v.union(v.literal('poster'), v.literal('pro')),
    plan: v.union(v.literal('monthly'), v.literal('yearly')),
    country: v.string(),
    locale: v.string(),
  },
  handler: async (ctx, { role, plan, country, locale }): Promise<{ url: string }> => {
    if (monetizationModel(country) !== 'subscription') {
      throw new Error('NOT_A_SUBSCRIPTION_MARKET');
    }
    const cfg = membershipPlanConfig(country, role);
    const currency = country === 'CA' ? 'CAD' : 'USD'; // subscription markets are CAD today

    const context = await ctx.runQuery(internal.memberships.startContext, {
      role,
    });
    if (context.alreadyActive) throw new Error('ALREADY_ACTIVE');

    const amountMinor = plan === 'monthly' ? cfg.monthlyMinor : cfg.yearlyMinor;
    const interval: SubscriptionInterval = plan === 'monthly' ? 'month' : 'year';
    const siteUrl = (process.env.SITE_URL ?? '').replace(/\/$/, '');

    const { url } = await createSubscriptionCheckout({
      amountMinor,
      currency,
      interval,
      productName: `NextDoor Pros ${role} membership (${plan})`,
      email: context.email,
      userId: context.userId,
      role,
      country,
      successUrl: `${siteUrl}/${locale}/membership?status=success`,
      cancelUrl: `${siteUrl}/${locale}/membership?status=cancel`,
      trialDays: membershipTrialDays(country),
    });
    return { url };
  },
});

// ── settle: upsert a membership from Stripe's authoritative state ─────────────

export const upsertFromStripe = internalMutation({
  args: {
    subscriptionId: v.string(),
    stripeStatus: v.string(),
    customerId: v.optional(v.string()),
    currentPeriodStart: v.optional(v.number()),
    currentPeriodEnd: v.optional(v.number()),
    cancelAtPeriodEnd: v.boolean(),
    interval: v.optional(v.union(v.literal('month'), v.literal('year'))),
    userId: v.string(),
    role: v.string(),
    country: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const status = toLocalStatus(args.stripeStatus);
    const plan = args.interval === 'year' ? 'yearly' : 'monthly';

    const patch = {
      status,
      plan,
      provider: 'stripe',
      stripeCustomerId: args.customerId,
      stripeSubscriptionId: args.subscriptionId,
      currentPeriodStart: args.currentPeriodStart,
      currentPeriodEnd: args.currentPeriodEnd,
      cancelAtPeriodEnd: args.cancelAtPeriodEnd,
      country: args.country,
    };

    // Prefer matching the exact subscription; fall back to the user+role slot.
    const bySub = await ctx.db
      .query('memberships')
      .withIndex('by_stripeSubscription', (q) =>
        q.eq('stripeSubscriptionId', args.subscriptionId),
      )
      .first();
    if (bySub) {
      await ctx.db.patch(bySub._id, patch);
      return;
    }

    const userId = args.userId as Id<'users'>;
    const existing = await ctx.db
      .query('memberships')
      .withIndex('by_user_role', (q) =>
        q.eq('userId', userId).eq('role', args.role),
      )
      .order('desc')
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return;
    }

    await ctx.db.insert('memberships', {
      userId,
      role: args.role,
      ...patch,
    });
  },
});

// ── billing portal (manage / cancel) ─────────────────────────────────────────

export const portalContext = internalQuery({
  args: { role: v.union(v.literal('poster'), v.literal('pro')) },
  handler: async (ctx, { role }): Promise<{ customerId: string | null }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('NOT_SIGNED_IN');
    const membership = await ctx.db
      .query('memberships')
      .withIndex('by_user_role', (q) => q.eq('userId', userId).eq('role', role))
      .order('desc')
      .first();
    return { customerId: membership?.stripeCustomerId ?? null };
  },
});

export const openBillingPortal = action({
  args: {
    role: v.union(v.literal('poster'), v.literal('pro')),
    locale: v.string(),
  },
  handler: async (ctx, { role, locale }): Promise<{ url: string }> => {
    const { customerId } = await ctx.runQuery(
      internal.memberships.portalContext,
      { role },
    );
    if (!customerId) throw new Error('NO_BILLING_ACCOUNT');
    const siteUrl = (process.env.SITE_URL ?? '').replace(/\/$/, '');
    return await createPortalSession(
      customerId,
      `${siteUrl}/${locale}/membership`,
    );
  },
});
