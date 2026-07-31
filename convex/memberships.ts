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
  setSubscriptionCancelAtPeriodEnd,
  type SubscriptionInterval,
} from './stripeSubscriptions';
import {
  countryOfCity,
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
      trialEnd: membership.trialEnd,
      quota,
      used,
      remaining: Math.max(0, quota - used),
      hasBilling: !!membership.stripeCustomerId,
      // Only a live Stripe subscription can be cancelled in-app.
      canCancel: !!membership.stripeSubscriptionId,
    };
  },
});

// ── pro access gate (subscription markets) ───────────────────────────────────

/**
 * Which market a pro belongs to, from the most trustworthy signal available.
 * Their listing's city is server-derived and wins; before onboarding there is no
 * listing, so we fall back to the market their membership was bought in, then to
 * the request's geo-IP country. Unknown → the default (pay-as-you-go) market, so
 * an unrecognised signal can never lock a pro out of a market that has no
 * memberships to buy in the first place.
 */
async function proCountry(
  ctx: QueryCtx,
  userId: Id<'users'>,
  membership: Doc<'memberships'> | null,
  geoCountry?: string,
): Promise<string | undefined> {
  const contractor = await ctx.db
    .query('contractors')
    .withIndex('by_owner', (q) => q.eq('ownerId', userId))
    .unique();
  if (contractor) return countryOfCity(contractor.citySlug);
  return membership?.country ?? geoCountry ?? undefined;
}

/**
 * Whether the signed-in user may use the pro area. In subscription markets a pro
 * must hold an active membership — a card entered at Stripe Checkout — before
 * onboarding or the dashboard opens to them; a trialing subscription counts as
 * active, so the free trial grants access immediately. Pay-as-you-go markets are
 * never gated (there is nothing to subscribe to).
 */
export const proAccess = query({
  args: { geoCountry: v.optional(v.string()) },
  handler: async (ctx, { geoCountry }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return { signedIn: false, required: false, blocked: false, country: null, status: null };

    const membership = await ctx.db
      .query('memberships')
      .withIndex('by_user_role', (q) => q.eq('userId', userId).eq('role', 'pro'))
      .order('desc')
      .first();

    const country = await proCountry(ctx, userId, membership, geoCountry);
    const required = monetizationModel(country) === 'subscription';
    const active = membership?.status === 'active';
    return {
      signedIn: true,
      required,
      blocked: required && !active,
      country: country ?? null,
      status: membership?.status ?? null,
    };
  },
});

// ── free trial: new accounts only ────────────────────────────────────────────

const normalizeEmail = (email?: string | null) =>
  email ? email.trim().toLowerCase() : undefined;

/**
 * Whether this account has already had its free trial. True when any of:
 *   - a trial was recorded for this user, or for this email address (which
 *     survives the account being deleted and re-created);
 *   - the account already holds a membership row of any status — having
 *     subscribed before, even a cancelled one, means it is not a new account.
 * The trial is a joining offer; cancelling and re-subscribing bills from day one.
 */
async function trialAlreadyUsed(
  ctx: QueryCtx,
  userId: Id<'users'>,
  email?: string,
): Promise<boolean> {
  const byUser = await ctx.db
    .query('membershipTrials')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .first();
  if (byUser) return true;

  const normalized = normalizeEmail(email);
  if (normalized) {
    const byEmail = await ctx.db
      .query('membershipTrials')
      .withIndex('by_email', (q) => q.eq('email', normalized))
      .first();
    if (byEmail) return true;
  }

  for (const role of ['poster', 'pro'] as const) {
    const prior = await ctx.db
      .query('memberships')
      .withIndex('by_user_role', (q) => q.eq('userId', userId).eq('role', role))
      .first();
    if (prior) return true;
  }
  return false;
}

/** Whether the signed-in account can still be offered a free trial. */
export const trialAvailable = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return true; // no account yet — a sign-up is a new account
    const user = await ctx.db.get(userId);
    const email = (user as { email?: string } | null)?.email;
    return !(await trialAlreadyUsed(ctx, userId, email));
  },
});

// ── start a subscription (hosted Stripe Checkout) ────────────────────────────

export const startContext = internalQuery({
  args: { role: v.union(v.literal('poster'), v.literal('pro')) },
  handler: async (
    ctx,
    { role },
  ): Promise<{
    userId: Id<'users'>;
    email?: string;
    alreadyActive: boolean;
    trialUsed: boolean;
    customerId?: string;
  }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('NOT_SIGNED_IN');
    const user = await ctx.db.get(userId);
    const email = (user as { email?: string } | null)?.email;
    const active = await getActiveMembership(ctx, userId, role);

    // Re-use the Stripe customer from any earlier membership so a returning
    // subscriber keeps one billing history instead of spawning a new customer
    // per checkout — and so their saved cards are already there.
    const prior = await ctx.db
      .query('memberships')
      .withIndex('by_user_role', (q) => q.eq('userId', userId).eq('role', role))
      .order('desc')
      .first();

    return {
      userId,
      email,
      alreadyActive: !!active,
      trialUsed: await trialAlreadyUsed(ctx, userId, email),
      customerId: prior?.stripeCustomerId,
    };
  },
});

/** Record that this account consumed its free trial. Idempotent. */
async function writeTrialUse(
  ctx: MutationCtx,
  userId: Id<'users'>,
): Promise<void> {
  const existing = await ctx.db
    .query('membershipTrials')
    .withIndex('by_user', (q) => q.eq('userId', userId))
    .first();
  if (existing) return;
  const user = await ctx.db.get(userId);
  if (!user) return;
  await ctx.db.insert('membershipTrials', {
    userId,
    email: normalizeEmail((user as { email?: string }).email),
    startedAt: Date.now(),
  });
}

/**
 * Mark an account's trial as spent without waiting for a Stripe webhook — used
 * to backfill accounts that subscribed before this ledger existed.
 */
export const recordTrialUse = internalMutation({
  args: { userId: v.string() },
  handler: async (ctx, { userId }) => {
    await writeTrialUse(ctx, userId as Id<'users'>);
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
      // New accounts only — a returning subscriber is billed from day one.
      trialDays: context.trialUsed ? 0 : membershipTrialDays(country),
      customerId: context.customerId,
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
    trialEnd: v.optional(v.number()),
    interval: v.optional(v.union(v.literal('month'), v.literal('year'))),
    userId: v.string(),
    role: v.string(),
    country: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const status = toLocalStatus(args.stripeStatus);
    const plan = args.interval === 'year' ? 'yearly' : 'monthly';

    // Burn the trial only once Stripe confirms one actually started, so an
    // abandoned checkout doesn't cost someone their free month.
    if (args.trialEnd) {
      await writeTrialUse(ctx, args.userId as Id<'users'>);
    }

    const patch = {
      status,
      plan,
      provider: 'stripe',
      stripeCustomerId: args.customerId,
      stripeSubscriptionId: args.subscriptionId,
      currentPeriodStart: args.currentPeriodStart,
      currentPeriodEnd: args.currentPeriodEnd,
      cancelAtPeriodEnd: args.cancelAtPeriodEnd,
      trialEnd: args.trialEnd,
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

// ── cancel / resume the subscription in-app ──────────────────────────────────
//
// Cancelling sets Stripe's `cancel_at_period_end` rather than deleting the
// subscription: the member keeps the access they already paid for until the
// period ends, and someone still inside the free trial is never charged at all
// (Stripe just lets it expire at trial end). The same action resumes — flipping
// the flag back — as long as the period hasn't ended yet. Stripe stays the
// source of truth; we persist what it returns and the webhook confirms it again.

export const subscriptionContext = internalQuery({
  args: { role: v.union(v.literal('poster'), v.literal('pro')) },
  handler: async (ctx, { role }): Promise<{ subscriptionId: string | null }> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('NOT_SIGNED_IN');
    // Looked up from the caller's own row, so a user can only ever act on their
    // own subscription — the client never supplies a subscription id.
    const membership = await ctx.db
      .query('memberships')
      .withIndex('by_user_role', (q) => q.eq('userId', userId).eq('role', role))
      .order('desc')
      .first();
    return { subscriptionId: membership?.stripeSubscriptionId ?? null };
  },
});

/** Persist an auto-renew flip. Narrow patch — it must not race the webhook's status. */
export const applyAutoRenew = internalMutation({
  args: {
    subscriptionId: v.string(),
    cancelAtPeriodEnd: v.boolean(),
    currentPeriodEnd: v.optional(v.number()),
    trialEnd: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const membership = await ctx.db
      .query('memberships')
      .withIndex('by_stripeSubscription', (q) =>
        q.eq('stripeSubscriptionId', args.subscriptionId),
      )
      .first();
    if (!membership) return;
    await ctx.db.patch(membership._id, {
      cancelAtPeriodEnd: args.cancelAtPeriodEnd,
      currentPeriodEnd: args.currentPeriodEnd,
      trialEnd: args.trialEnd,
    });
  },
});

export const setAutoRenew = action({
  args: {
    role: v.union(v.literal('poster'), v.literal('pro')),
    /** false = cancel at period end, true = resume. */
    renew: v.boolean(),
  },
  handler: async (
    ctx,
    { role, renew },
  ): Promise<{ cancelAtPeriodEnd: boolean; endsAt?: number }> => {
    const { subscriptionId } = await ctx.runQuery(
      internal.memberships.subscriptionContext,
      { role },
    );
    if (!subscriptionId) throw new Error('NO_SUBSCRIPTION');

    const sub = await setSubscriptionCancelAtPeriodEnd(subscriptionId, !renew);
    await ctx.runMutation(internal.memberships.applyAutoRenew, {
      subscriptionId: sub.id,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      currentPeriodEnd: sub.currentPeriodEnd,
      trialEnd: sub.trialEnd,
    });
    return {
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      endsAt: sub.currentPeriodEnd,
    };
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
