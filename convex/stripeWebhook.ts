import Stripe from 'stripe';
import { httpAction, type ActionCtx } from './_generated/server';
import { internal } from './_generated/api';
import type { Doc } from './_generated/dataModel';

function stripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not set');
  return new Stripe(key, { httpClient: Stripe.createFetchHttpClient() });
}

export const handler = httpAction(async (ctx, request) => {
  const signature = request.headers.get('stripe-signature');
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const rawBody = await request.text();

  if (!signature || !secret || secret === 'whsec_placeholder') {
    return new Response('Webhook not configured', { status: 400 });
  }

  const stripe = stripeClient();
  let event: Stripe.Event;
  try {
    // Async variant uses Web Crypto API — required in the Convex V8 runtime.
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, secret);
  } catch (err) {
    console.error('stripe webhook signature verification failed', err);
    return new Response('Invalid signature', { status: 400 });
  }

  // Idempotency — bail out if we've already processed this event.
  const fresh = await ctx.runMutation(internal.payments.recordStripeEvent, {
    eventId: event.id,
    type: event.type,
  });
  if (!fresh) {
    return new Response('Already processed', { status: 200 });
  }

  try {
    switch (event.type) {
      case 'account.updated':
        await handleAccountUpdated(ctx, event.data.object as Stripe.Account);
        break;
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.metadata?.kind === 'job') {
          await handleJobCheckoutCompleted(ctx, session);
        } else {
          await handleCheckoutCompleted(ctx, session);
        }
        break;
      }
      case 'checkout.session.async_payment_failed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.metadata?.kind === 'job') {
          await handleJobCheckoutFailed(ctx, session);
        } else {
          await handleCheckoutFailed(ctx, session);
        }
        break;
      }
      case 'charge.refunded':
        await handleChargeRefunded(ctx, event.data.object as Stripe.Charge);
        break;
      case 'charge.dispute.created':
        await handleDispute(ctx, event.data.object as Stripe.Dispute, 'disputed');
        break;
      case 'charge.dispute.closed':
        await handleDispute(ctx, event.data.object as Stripe.Dispute, null);
        break;
      default:
        // Ignore unrelated events — Stripe retries when we 5xx, so we
        // explicitly 200 here.
        break;
    }
  } catch (err) {
    console.error(`stripe webhook ${event.type} handler failed`, err);
    return new Response('Handler error', { status: 500 });
  }

  return new Response('ok', { status: 200 });
});

// ──────────────────────────────────────────────────────────────────────────
// Event handlers
// ──────────────────────────────────────────────────────────────────────────

async function handleAccountUpdated(
  ctx: ActionCtx,
  account: Stripe.Account,
) {
  const contractor: Doc<'contractors'> | null = await ctx.runQuery(
    internal.payments.getContractorByStripeAccount,
    { stripeAccountId: account.id },
  );
  if (!contractor) return;

  const complete = Boolean(account.charges_enabled && account.payouts_enabled);
  await ctx.runMutation(internal.payments.setOnboardingComplete, {
    contractorId: contractor._id,
    complete,
  });
}

async function handleCheckoutCompleted(
  ctx: ActionCtx,
  session: Stripe.Checkout.Session,
) {
  const payment: Doc<'payments'> | null = await ctx.runQuery(
    internal.payments.getPaymentRowBySession,
    { sessionId: session.id },
  );
  if (!payment) return;

  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id;

  await ctx.runMutation(internal.payments.patchPaymentRow, {
    id: payment._id,
    status: 'paid',
    ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
  });

  await ctx.scheduler.runAfter(0, internal.payments.sendPaymentConfirmation, {
    paymentId: payment._id,
  });
}

async function handleCheckoutFailed(
  ctx: ActionCtx,
  session: Stripe.Checkout.Session,
) {
  const payment: Doc<'payments'> | null = await ctx.runQuery(
    internal.payments.getPaymentRowBySession,
    { sessionId: session.id },
  );
  if (!payment) return;
  await ctx.runMutation(internal.payments.patchPaymentRow, {
    id: payment._id,
    status: 'failed',
  });
}

// ── Job (Phase 2) handlers ───────────────────────────────────────────────

async function handleJobCheckoutCompleted(
  ctx: ActionCtx,
  session: Stripe.Checkout.Session,
) {
  const job: Doc<'jobs'> | null = await ctx.runQuery(internal.jobs.getJobBySession, {
    sessionId: session.id,
  });
  if (!job) return;

  const paymentIntentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : session.payment_intent?.id;

  // We need the charge id later to do `transfers.create(... source_transaction)`.
  // Fetch the PaymentIntent to grab the latest_charge.
  let chargeId: string | undefined;
  if (paymentIntentId && process.env.STRIPE_SECRET_KEY) {
    try {
      const stripe = stripeClient();
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
      const latest = pi.latest_charge;
      chargeId = typeof latest === 'string' ? latest : latest?.id;
    } catch (err) {
      console.error('paymentIntents.retrieve failed', err);
    }
  }

  await ctx.runMutation(internal.jobs.markJobFunded, {
    jobId: job._id,
    stripePaymentIntentId: paymentIntentId,
    stripeChargeId: chargeId,
  });
}

async function handleJobCheckoutFailed(
  ctx: ActionCtx,
  session: Stripe.Checkout.Session,
) {
  const job: Doc<'jobs'> | null = await ctx.runQuery(internal.jobs.getJobBySession, {
    sessionId: session.id,
  });
  if (!job) return;
  await ctx.runMutation(internal.jobs.setJobPaymentFailed, { jobId: job._id });
}

async function handleChargeRefunded(
  ctx: ActionCtx,
  charge: Stripe.Charge,
) {
  const paymentIntentId =
    typeof charge.payment_intent === 'string'
      ? charge.payment_intent
      : charge.payment_intent?.id;
  if (!paymentIntentId) return;

  const payment: Doc<'payments'> | null = await ctx.runQuery(
    internal.payments.getPaymentRowByPaymentIntent,
    { paymentIntentId },
  );
  if (!payment) return;

  await ctx.runMutation(internal.payments.patchPaymentRow, {
    id: payment._id,
    status: 'refunded',
    stripeChargeId: charge.id,
  });
}

async function handleDispute(
  ctx: ActionCtx,
  dispute: Stripe.Dispute,
  newStatus: string | null,
) {
  const paymentIntentId =
    typeof dispute.payment_intent === 'string'
      ? dispute.payment_intent
      : dispute.payment_intent?.id;
  if (!paymentIntentId) return;

  const payment: Doc<'payments'> | null = await ctx.runQuery(
    internal.payments.getPaymentRowByPaymentIntent,
    { paymentIntentId },
  );
  if (!payment) return;

  await ctx.runMutation(internal.payments.patchPaymentRow, {
    id: payment._id,
    ...(newStatus ? { status: newStatus } : { status: 'paid' }), // restore on close
  });
}
