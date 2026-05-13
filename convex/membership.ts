import { v } from 'convex/values';
import Stripe from 'stripe';
import { getAuthUserId } from '@convex-dev/auth/server';
import {
  action,
  internalMutation,
  internalQuery,
  query,
} from './_generated/server';
import { internal } from './_generated/api';
import type { Doc } from './_generated/dataModel';

/** Monthly: $15 CAD. Annual: $160 CAD (≈ $13.33/mo). */
export const MEMBERSHIP_PRICES = {
  monthly: { unit_amount: 1500, interval: 'month' as const, name: 'NextDoor Pros — Monthly Pro' },
  annual: { unit_amount: 16000, interval: 'year' as const, name: 'NextDoor Pros — Annual Pro' },
};

function stripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not set on this Convex deployment.');
  return new Stripe(key, { httpClient: Stripe.createFetchHttpClient() });
}

function siteUrl(): string {
  return process.env.SITE_URL?.replace(/\/$/, '') ?? 'http://localhost:3000';
}

// ──────────────────────────────────────────────────────────────────────────
// Public read
// ──────────────────────────────────────────────────────────────────────────

/**
 * Return the signed-in pro's membership state (or null if not signed in).
 */
export const myMembership = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const contractor = await ctx.db
      .query('contractors')
      .withIndex('by_owner', (q) => q.eq('ownerId', userId))
      .unique();
    if (!contractor) return null;
    return {
      hasContractor: true as const,
      status: contractor.membershipStatus ?? 'none',
      plan: contractor.membershipPlan ?? null,
      currentPeriodEnd: contractor.membershipCurrentPeriodEnd ?? null,
    };
  },
});

// ──────────────────────────────────────────────────────────────────────────
// Internal helpers
// ──────────────────────────────────────────────────────────────────────────

export const getMyContractor = internalQuery({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db
      .query('contractors')
      .withIndex('by_owner', (q) => q.eq('ownerId', userId))
      .unique();
  },
});

export const setStripeCustomer = internalMutation({
  args: { contractorId: v.id('contractors'), stripeCustomerId: v.string() },
  handler: async (ctx, { contractorId, stripeCustomerId }) => {
    await ctx.db.patch(contractorId, { stripeCustomerId });
  },
});

export const getContractorByCustomer = internalQuery({
  args: { stripeCustomerId: v.string() },
  handler: async (ctx, { stripeCustomerId }) => {
    return await ctx.db
      .query('contractors')
      .withIndex('by_stripeCustomer', (q) => q.eq('stripeCustomerId', stripeCustomerId))
      .unique();
  },
});

export const patchMembership = internalMutation({
  args: {
    contractorId: v.id('contractors'),
    status: v.optional(v.string()),
    plan: v.optional(v.string()),
    stripeSubscriptionId: v.optional(v.string()),
    membershipCurrentPeriodEnd: v.optional(v.number()),
  },
  handler: async (ctx, { contractorId, ...patch }) => {
    const cleaned: Record<string, unknown> = {};
    if (patch.status !== undefined) cleaned.membershipStatus = patch.status;
    if (patch.plan !== undefined) cleaned.membershipPlan = patch.plan;
    if (patch.stripeSubscriptionId !== undefined)
      cleaned.stripeSubscriptionId = patch.stripeSubscriptionId;
    if (patch.membershipCurrentPeriodEnd !== undefined)
      cleaned.membershipCurrentPeriodEnd = patch.membershipCurrentPeriodEnd;
    if (Object.keys(cleaned).length > 0) await ctx.db.patch(contractorId, cleaned);
  },
});

// ──────────────────────────────────────────────────────────────────────────
// Public actions — invoked from the membership UI.
// ──────────────────────────────────────────────────────────────────────────

/**
 * Create a Stripe Checkout Session (subscription mode) and return the URL.
 * Creates a Stripe Customer the first time and saves the id on the contractor.
 */
export const startMembershipCheckout = action({
  args: {
    plan: v.union(v.literal('monthly'), v.literal('annual')),
    locale: v.string(),
  },
  handler: async (ctx, { plan, locale }): Promise<{ url: string }> => {
    const contractor: Doc<'contractors'> | null = await ctx.runQuery(
      internal.membership.getMyContractor,
      {},
    );
    if (!contractor) throw new Error('NO_CONTRACTOR_PROFILE');
    if (contractor.membershipStatus === 'active') throw new Error('ALREADY_ACTIVE');

    const stripe = stripeClient();

    // Reuse or create the Stripe Customer.
    let customerId = contractor.stripeCustomerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: contractor.email,
        name: contractor.businessName,
        metadata: { contractorId: contractor._id },
      });
      customerId = customer.id;
      await ctx.runMutation(internal.membership.setStripeCustomer, {
        contractorId: contractor._id,
        stripeCustomerId: customerId,
      });
    }

    const price = MEMBERSHIP_PRICES[plan];

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: 'cad',
            unit_amount: price.unit_amount,
            recurring: { interval: price.interval },
            product_data: { name: price.name },
          },
          quantity: 1,
        },
      ],
      success_url: `${siteUrl()}/${locale}/pros/dashboard?membership=active`,
      cancel_url: `${siteUrl()}/${locale}/pros/onboard/membership?cancelled=1`,
      metadata: {
        kind: 'membership',
        contractorId: contractor._id,
        plan,
      },
      subscription_data: {
        metadata: {
          kind: 'membership',
          contractorId: contractor._id,
          plan,
        },
      },
    });

    if (!session.url) throw new Error('STRIPE_SESSION_FAILED');
    return { url: session.url };
  },
});

/**
 * Return a Stripe Customer Portal URL so the pro can manage their card,
 * cancel, or upgrade/downgrade.
 */
export const getCustomerPortalLink = action({
  args: { locale: v.string() },
  handler: async (ctx, { locale }): Promise<{ url: string }> => {
    const contractor: Doc<'contractors'> | null = await ctx.runQuery(
      internal.membership.getMyContractor,
      {},
    );
    if (!contractor?.stripeCustomerId) throw new Error('NO_STRIPE_CUSTOMER');

    const stripe = stripeClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: contractor.stripeCustomerId,
      return_url: `${siteUrl()}/${locale}/pros/dashboard`,
    });
    return { url: session.url };
  },
});
