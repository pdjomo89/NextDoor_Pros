import { v } from 'convex/values';
import Stripe from 'stripe';
import { getAuthUserId } from '@convex-dev/auth/server';
import {
  action,
  internalAction,
  internalMutation,
  internalQuery,
  mutation,
  query,
  type ActionCtx,
} from './_generated/server';
import { internal } from './_generated/api';
import type { Doc, Id } from './_generated/dataModel';

/** Platform commission on every payment (basis points). 10% = 1000 bp. */
export const APPLICATION_FEE_BPS = 1000;

function stripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      'STRIPE_SECRET_KEY is not set on this Convex deployment.',
    );
  }
  return new Stripe(key, {
    httpClient: Stripe.createFetchHttpClient(),
    appInfo: { name: 'NextDoor Pros', url: 'https://nextdoor-pros.vercel.app' },
  });
}

function siteUrl(): string {
  return process.env.SITE_URL?.replace(/\/$/, '') ?? 'http://localhost:3000';
}

// ──────────────────────────────────────────────────────────────────────────
// Internal helpers — queries/mutations used by the actions below.
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

export const setStripeAccount = internalMutation({
  args: {
    contractorId: v.id('contractors'),
    stripeAccountId: v.string(),
  },
  handler: async (ctx, { contractorId, stripeAccountId }) => {
    await ctx.db.patch(contractorId, { stripeAccountId });
  },
});

export const setOnboardingComplete = internalMutation({
  args: {
    contractorId: v.id('contractors'),
    complete: v.boolean(),
  },
  handler: async (ctx, { contractorId, complete }) => {
    await ctx.db.patch(contractorId, { stripeOnboardingComplete: complete });
  },
});

// ──────────────────────────────────────────────────────────────────────────
// Public query — what the dashboard reads to render the Payments section.
// ──────────────────────────────────────────────────────────────────────────

export const myStripeStatus = query({
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
      hasAccount: Boolean(contractor.stripeAccountId),
      onboardingComplete: contractor.stripeOnboardingComplete === true,
    };
  },
});

// ──────────────────────────────────────────────────────────────────────────
// Shared helper used by createExpressAccount + getOnboardingLink.
// Returns the Stripe account id, creating one on demand if missing.
// ──────────────────────────────────────────────────────────────────────────

async function ensureExpressAccount(
  ctx: ActionCtx,
  contractor: Doc<'contractors'>,
): Promise<string> {
  if (contractor.stripeAccountId) return contractor.stripeAccountId;

  const stripe = stripeClient();
  const account = await stripe.accounts.create({
    type: 'express',
    country: 'CA',
    email: contractor.email,
    business_type: 'individual',
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    business_profile: {
      name: contractor.businessName,
      mcc: '7299', // "Miscellaneous Personal Services" — overrideable by Stripe.
      url: `${siteUrl()}/en/pros/${contractor._id}`,
    },
    metadata: {
      platform: 'nextdoor_pros',
      contractorId: contractor._id,
    },
  });

  await ctx.runMutation(internal.payments.setStripeAccount, {
    contractorId: contractor._id,
    stripeAccountId: account.id,
  });

  return account.id;
}

// ──────────────────────────────────────────────────────────────────────────
// Public actions — invoked from the contractor dashboard.
// ──────────────────────────────────────────────────────────────────────────

/**
 * Create a Stripe Express account for the signed-in contractor if missing,
 * then return a hosted onboarding URL the browser should redirect to.
 */
export const startOnboarding = action({
  args: { locale: v.string() },
  handler: async (ctx, { locale }) => {
    const contractor: Doc<'contractors'> | null = await ctx.runQuery(
      internal.payments.getMyContractor,
      {},
    );
    if (!contractor) {
      throw new Error('NO_CONTRACTOR_PROFILE');
    }

    const accountId = await ensureExpressAccount(ctx, contractor);

    const stripe = stripeClient();
    const link = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${siteUrl()}/${locale}/pros/dashboard?stripe=refresh`,
      return_url: `${siteUrl()}/${locale}/pros/dashboard?stripe=return`,
      type: 'account_onboarding',
    });

    return { url: link.url };
  },
});

/**
 * Pull the latest account state from Stripe and update the contractor row.
 * Called by the dashboard after the pro returns from the onboarding link
 * (and as a backstop until the production webhook is wired up).
 */
export const refreshAccountStatus = action({
  args: {},
  handler: async (ctx) => {
    const contractor: Doc<'contractors'> | null = await ctx.runQuery(
      internal.payments.getMyContractor,
      {},
    );
    if (!contractor?.stripeAccountId) {
      return { onboardingComplete: false };
    }

    const stripe = stripeClient();
    const account = await stripe.accounts.retrieve(contractor.stripeAccountId);
    const complete = Boolean(account.charges_enabled && account.payouts_enabled);

    await ctx.runMutation(internal.payments.setOnboardingComplete, {
      contractorId: contractor._id,
      complete,
    });

    return { onboardingComplete: complete };
  },
});

/**
 * Return a one-shot Stripe Express dashboard login link for the
 * signed-in contractor. Used by the "Manage in Stripe" button.
 */
export const getDashboardLink = action({
  args: {},
  handler: async (ctx) => {
    const contractor: Doc<'contractors'> | null = await ctx.runQuery(
      internal.payments.getMyContractor,
      {},
    );
    if (!contractor?.stripeAccountId) {
      throw new Error('NO_STRIPE_ACCOUNT');
    }
    const stripe = stripeClient();
    const link = await stripe.accounts.createLoginLink(contractor.stripeAccountId);
    return { url: link.url };
  },
});

// ──────────────────────────────────────────────────────────────────────────
// Service-catalog mutations (used both by the dashboard and by checkout).
// These are CRUD over the contractorServices table.
// ──────────────────────────────────────────────────────────────────────────

export const listMyServices = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];
    const contractor = await ctx.db
      .query('contractors')
      .withIndex('by_owner', (q) => q.eq('ownerId', userId))
      .unique();
    if (!contractor) return [];
    return await ctx.db
      .query('contractorServices')
      .withIndex('by_contractor', (q) => q.eq('contractorId', contractor._id))
      .collect();
  },
});

export const listPublicServices = query({
  args: { contractorId: v.id('contractors') },
  handler: async (ctx, { contractorId }) => {
    const rows = await ctx.db
      .query('contractorServices')
      .withIndex('by_contractor', (q) => q.eq('contractorId', contractorId))
      .collect();
    return rows.filter((s) => s.active);
  },
});

export const upsertService = mutation({
  args: {
    id: v.optional(v.id('contractorServices')),
    title: v.string(),
    description: v.optional(v.string()),
    priceCents: v.number(),
    active: v.boolean(),
  },
  handler: async (ctx, { id, title, description, priceCents, active }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('UNAUTHENTICATED');

    const contractor = await ctx.db
      .query('contractors')
      .withIndex('by_owner', (q) => q.eq('ownerId', userId))
      .unique();
    if (!contractor) throw new Error('NO_CONTRACTOR_PROFILE');

    const cleanTitle = title.trim().slice(0, 120);
    const cleanDescription = description?.trim().slice(0, 600) || undefined;
    if (!cleanTitle) throw new Error('TITLE_REQUIRED');
    if (!Number.isInteger(priceCents) || priceCents < 100 || priceCents > 5_000_000) {
      // 1 CAD minimum, 50,000 CAD maximum.
      throw new Error('INVALID_PRICE');
    }

    if (id) {
      const existing = await ctx.db.get(id);
      if (!existing || existing.contractorId !== contractor._id) {
        throw new Error('NOT_FOUND');
      }
      await ctx.db.patch(id, {
        title: cleanTitle,
        description: cleanDescription,
        priceCents,
        active,
      });
      return id;
    }

    return await ctx.db.insert('contractorServices', {
      contractorId: contractor._id,
      title: cleanTitle,
      description: cleanDescription,
      priceCents,
      currency: 'cad',
      active,
    });
  },
});

export const deleteService = mutation({
  args: { id: v.id('contractorServices') },
  handler: async (ctx, { id }) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('UNAUTHENTICATED');

    const row = await ctx.db.get(id);
    if (!row) return;

    const contractor = await ctx.db.get(row.contractorId);
    if (!contractor || contractor.ownerId !== userId) {
      throw new Error('FORBIDDEN');
    }

    await ctx.db.delete(id);
  },
});

// Re-export the Id type so the UI can type-check `contractorServices` ids.
export type ContractorServiceId = Id<'contractorServices'>;

// ──────────────────────────────────────────────────────────────────────────
// Customer checkout (Phase 1b)
// ──────────────────────────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Public: create a Stripe Checkout Session for a priced service.
 * Returns the URL the browser should redirect to.
 */
export const createCheckoutSession = action({
  args: {
    contractorServiceId: v.id('contractorServices'),
    customerEmail: v.string(),
    customerName: v.optional(v.string()),
    customerCitySlug: v.optional(v.string()),
    note: v.optional(v.string()),
    locale: v.string(),
  },
  handler: async (
    ctx,
    { contractorServiceId, customerEmail, customerName, customerCitySlug, note, locale },
  ): Promise<{ url: string }> => {
    const email = customerEmail.trim().slice(0, 320);
    if (!EMAIL_RE.test(email)) {
      throw new Error('INVALID_EMAIL');
    }

    const data: {
      service: Doc<'contractorServices'>;
      contractor: Doc<'contractors'>;
    } | null = await ctx.runQuery(internal.payments.getServiceForCheckout, {
      id: contractorServiceId,
    });
    if (!data) throw new Error('SERVICE_NOT_FOUND');

    const { service, contractor } = data;
    if (!service.active) throw new Error('SERVICE_INACTIVE');
    if (!contractor.published) throw new Error('CONTRACTOR_NOT_PUBLISHED');
    if (!contractor.stripeAccountId || contractor.stripeOnboardingComplete !== true) {
      throw new Error('CONTRACTOR_NOT_READY');
    }

    const applicationFeeCents = Math.round((service.priceCents * APPLICATION_FEE_BPS) / 10000);

    const stripe = stripeClient();
    const successUrl = `${siteUrl()}/${locale}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${siteUrl()}/${locale}/pros/${contractor._id}?checkout=cancelled`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: service.currency,
            unit_amount: service.priceCents,
            product_data: {
              name: `${contractor.businessName} — ${service.title}`,
              ...(service.description ? { description: service.description } : {}),
            },
          },
          quantity: 1,
        },
      ],
      payment_intent_data: {
        application_fee_amount: applicationFeeCents,
        transfer_data: { destination: contractor.stripeAccountId },
        metadata: {
          platform: 'nextdoor_pros',
          contractorId: contractor._id,
          contractorServiceId: service._id,
        },
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        platform: 'nextdoor_pros',
        contractorId: contractor._id,
        contractorServiceId: service._id,
        customerName: customerName?.slice(0, 200) ?? '',
        note: note?.slice(0, 1000) ?? '',
      },
    });

    if (!session.url || !session.id) {
      throw new Error('STRIPE_SESSION_FAILED');
    }

    await ctx.runMutation(internal.payments.insertPaymentRow, {
      contractorId: contractor._id,
      contractorServiceId: service._id,
      customerEmail: email,
      customerName: customerName?.trim().slice(0, 200) || undefined,
      customerCitySlug: customerCitySlug || undefined,
      note: note?.trim().slice(0, 1000) || undefined,
      amountCents: service.priceCents,
      applicationFeeCents,
      currency: service.currency,
      stripeCheckoutSessionId: session.id,
    });

    return { url: session.url };
  },
});

/**
 * Public: read a payment row by its Checkout Session id. Used by the
 * /checkout/success page so we can show a confirmation even if the webhook
 * hasn't arrived yet.
 */
export const getPaymentBySession = query({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    const row = await ctx.db
      .query('payments')
      .withIndex('by_session', (q) => q.eq('stripeCheckoutSessionId', sessionId))
      .unique();
    if (!row) return null;
    const contractor = await ctx.db.get(row.contractorId);
    return {
      status: row.status,
      amountCents: row.amountCents,
      currency: row.currency,
      contractorBusinessName: contractor?.businessName ?? null,
      contractorId: row.contractorId,
    };
  },
});

// ──────────────────────────────────────────────────────────────────────────
// Internal helpers used by the checkout action and the webhook handler.
// ──────────────────────────────────────────────────────────────────────────

export const getServiceForCheckout = internalQuery({
  args: { id: v.id('contractorServices') },
  handler: async (ctx, { id }) => {
    const service = await ctx.db.get(id);
    if (!service) return null;
    const contractor = await ctx.db.get(service.contractorId);
    if (!contractor) return null;
    return { service, contractor };
  },
});

export const insertPaymentRow = internalMutation({
  args: {
    contractorId: v.id('contractors'),
    contractorServiceId: v.id('contractorServices'),
    customerEmail: v.string(),
    customerName: v.optional(v.string()),
    customerCitySlug: v.optional(v.string()),
    note: v.optional(v.string()),
    amountCents: v.number(),
    applicationFeeCents: v.number(),
    currency: v.string(),
    stripeCheckoutSessionId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert('payments', { ...args, status: 'pending' });
  },
});

export const getPaymentRowBySession = internalQuery({
  args: { sessionId: v.string() },
  handler: async (ctx, { sessionId }) => {
    return await ctx.db
      .query('payments')
      .withIndex('by_session', (q) => q.eq('stripeCheckoutSessionId', sessionId))
      .unique();
  },
});

export const getPaymentRowByPaymentIntent = internalQuery({
  args: { paymentIntentId: v.string() },
  handler: async (ctx, { paymentIntentId }) => {
    const rows = await ctx.db
      .query('payments')
      .filter((q) => q.eq(q.field('stripePaymentIntentId'), paymentIntentId))
      .take(1);
    return rows[0] ?? null;
  },
});

export const patchPaymentRow = internalMutation({
  args: {
    id: v.id('payments'),
    status: v.optional(v.string()),
    stripePaymentIntentId: v.optional(v.string()),
    stripeChargeId: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...patch }) => {
    const cleaned: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) {
      if (v !== undefined) cleaned[k] = v;
    }
    if (Object.keys(cleaned).length > 0) {
      await ctx.db.patch(id, cleaned);
    }
  },
});

export const getContractorByStripeAccount = internalQuery({
  args: { stripeAccountId: v.string() },
  handler: async (ctx, { stripeAccountId }) => {
    return await ctx.db
      .query('contractors')
      .withIndex('by_stripeAccount', (q) => q.eq('stripeAccountId', stripeAccountId))
      .unique();
  },
});

/**
 * Atomically claim a Stripe event for idempotency.
 * Returns `true` if this is the first time we see this event id, `false` if
 * it's already claimed (and the caller should skip).
 *
 * The claim is provisional: if the webhook handler throws, the caller must
 * release it via `unrecordStripeEvent` so Stripe's retry can re-process the
 * event. Otherwise a transient handler failure would drop the event forever.
 */
export const recordStripeEvent = internalMutation({
  args: { eventId: v.string(), type: v.string() },
  handler: async (ctx, { eventId, type }) => {
    const existing = await ctx.db
      .query('stripeEvents')
      .withIndex('by_eventId', (q) => q.eq('eventId', eventId))
      .unique();
    if (existing) return false;
    await ctx.db.insert('stripeEvents', { eventId, type });
    return true;
  },
});

/**
 * Release an idempotency claim made by `recordStripeEvent`. Called when a
 * webhook handler fails, so the 5xx response we return prompts Stripe to
 * retry — and that retry sees the event as fresh again instead of being
 * skipped as "already processed".
 */
export const unrecordStripeEvent = internalMutation({
  args: { eventId: v.string() },
  handler: async (ctx, { eventId }) => {
    const existing = await ctx.db
      .query('stripeEvents')
      .withIndex('by_eventId', (q) => q.eq('eventId', eventId))
      .unique();
    if (existing) await ctx.db.delete(existing._id);
  },
});

/**
 * Best-effort confirmation emails to the customer and the contractor after a
 * successful payment. Uses Resend (same setup as contactMessages).
 */
export const sendPaymentConfirmation = internalAction({
  args: { paymentId: v.id('payments') },
  handler: async (ctx, { paymentId }) => {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) return;

    const data: {
      payment: Doc<'payments'>;
      contractor: Doc<'contractors'> | null;
      service: Doc<'contractorServices'> | null;
    } | null = await ctx.runQuery(internal.payments.getPaymentForEmail, { paymentId });
    if (!data?.payment || !data.contractor) return;

    const { payment, contractor, service } = data;
    const from = process.env.CONTACT_FROM_EMAIL ?? 'NextDoor Pros <onboarding@resend.dev>';
    const platform = process.env.CONTACT_TO_EMAIL ?? 'hello@nextdoorpros.ca';

    const amount = (payment.amountCents / 100).toFixed(2);
    const serviceTitle = service?.title ?? 'Service';

    const customerLines = [
      `Hi${payment.customerName ? ` ${payment.customerName}` : ''},`,
      '',
      `Thanks for your payment of $${amount} CAD to ${contractor.businessName} for "${serviceTitle}".`,
      `They'll be in touch shortly to coordinate the work.`,
      payment.note ? `\nYour note to the pro:\n${payment.note}` : '',
      '',
      'NextDoor Pros',
    ].filter(Boolean);

    const proLines = [
      `Hi ${contractor.businessName},`,
      '',
      `${payment.customerName || payment.customerEmail} just paid you $${amount} CAD for "${serviceTitle}".`,
      `Reply-to: ${payment.customerEmail}`,
      payment.customerCitySlug ? `City: ${payment.customerCitySlug}` : '',
      payment.note ? `\nNote from the customer:\n${payment.note}` : '',
      '',
      `Funds will be deposited to your bank on Stripe's payout schedule.`,
      '',
      'NextDoor Pros',
    ].filter(Boolean);

    async function send(to: string, replyTo: string | null, subject: string, text: string) {
      try {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from,
            to: [to],
            ...(replyTo ? { reply_to: replyTo } : {}),
            subject,
            text,
          }),
        });
      } catch (err) {
        console.error('payment confirmation email failed', err);
      }
    }

    await send(
      payment.customerEmail,
      contractor.email ?? null,
      `[NextDoor Pros] Payment confirmation — ${contractor.businessName}`,
      customerLines.join('\n'),
    );
    if (contractor.email) {
      await send(
        contractor.email,
        payment.customerEmail,
        `[NextDoor Pros] You got paid $${amount} CAD`,
        proLines.join('\n'),
      );
    }
    // Always BCC the platform inbox so we have a paper trail.
    await send(
      platform,
      null,
      `[NextDoor Pros] Booking — ${contractor.businessName} — $${amount}`,
      `Payment ${payment._id}\n\n${proLines.join('\n')}`,
    );
  },
});

export const getPaymentForEmail = internalQuery({
  args: { paymentId: v.id('payments') },
  handler: async (ctx, { paymentId }) => {
    const payment = await ctx.db.get(paymentId);
    if (!payment) return null;
    const contractor = await ctx.db.get(payment.contractorId);
    const service = payment.contractorServiceId
      ? await ctx.db.get(payment.contractorServiceId)
      : null;
    return { payment, contractor, service };
  },
});
