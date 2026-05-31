import Stripe from 'stripe';
import { httpAction, type ActionCtx } from './_generated/server';
import { internal } from './_generated/api';
import type { Doc } from './_generated/dataModel';
import { reversalDeltaCents } from './payments';

function stripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not set');
  return new Stripe(key, { httpClient: Stripe.createFetchHttpClient() });
}

/** Secret token authorizing an account-less customer's completion link. */
function newConfirmToken(): string {
  return (
    crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
  );
}

export const handler = httpAction(async (ctx, request) => {
  const signature = request.headers.get('stripe-signature');
  const rawBody = await request.text();

  // This URL is registered as two Stripe webhook endpoints: one for
  // platform-account events (checkout, subscriptions, charges) and one for
  // Connect events on connected accounts (account.updated). Each endpoint has
  // its own signing secret, so we try each until one verifies.
  const secrets = [
    process.env.STRIPE_WEBHOOK_SECRET,
    process.env.STRIPE_WEBHOOK_SECRET_CONNECT,
  ].filter((s): s is string => Boolean(s) && s !== 'whsec_placeholder');

  if (!signature || secrets.length === 0) {
    return new Response('Webhook not configured', { status: 400 });
  }

  const stripe = stripeClient();
  let event: Stripe.Event | undefined;
  for (const secret of secrets) {
    try {
      // Async variant uses Web Crypto API — required in the Convex V8 runtime.
      event = await stripe.webhooks.constructEventAsync(rawBody, signature, secret);
      break;
    } catch {
      // Signature didn't match this secret — try the next one.
    }
  }
  if (!event) {
    console.error('stripe webhook signature verification failed for all secrets');
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
        if (session.metadata?.kind === 'membership') {
          await handleMembershipCheckoutCompleted(ctx, session);
        } else {
          await handleCheckoutCompleted(ctx, session);
        }
        break;
      }
      case 'checkout.session.async_payment_failed': {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutFailed(ctx, session);
        break;
      }
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionChanged(ctx, event.data.object as Stripe.Subscription);
        break;
      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(ctx, event.data.object as Stripe.Subscription);
        break;
      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(ctx, event.data.object as Stripe.Invoice);
        break;
      case 'charge.refunded':
        await handleChargeRefunded(ctx, event.data.object as Stripe.Charge);
        break;
      case 'charge.dispute.created':
        await handleDispute(ctx, event.data.object as Stripe.Dispute, 'created');
        break;
      case 'charge.dispute.closed':
        await handleDispute(ctx, event.data.object as Stripe.Dispute, 'closed');
        break;
      default:
        // Ignore unrelated events — Stripe retries when we 5xx, so we
        // explicitly 200 here.
        break;
    }
  } catch (err) {
    console.error(`stripe webhook ${event.type} handler failed`, err);
    // Release the idempotency claim so the 500 below makes Stripe retry the
    // event — without this, the retry would be skipped as "already processed"
    // and the event would be lost permanently.
    await ctx.runMutation(internal.payments.unrecordStripeEvent, {
      eventId: event.id,
    });
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

  // We hold the funds on the platform balance (separate charges & transfers),
  // so we need the charge id to use as the transfer's `source_transaction`
  // when the booking is later released to the pro.
  let chargeId: string | undefined;
  if (paymentIntentId) {
    try {
      const stripe = stripeClient();
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
      chargeId =
        typeof pi.latest_charge === 'string'
          ? pi.latest_charge
          : pi.latest_charge?.id;
    } catch (err) {
      console.error('could not retrieve payment intent for charge id', err);
    }
  }

  // Mint the secret the (account-less) customer uses to confirm completion.
  const confirmToken = payment.confirmToken ?? newConfirmToken();

  await ctx.runMutation(internal.payments.patchPaymentRow, {
    id: payment._id,
    status: 'held',
    confirmToken,
    ...(paymentIntentId ? { stripePaymentIntentId: paymentIntentId } : {}),
    ...(chargeId ? { stripeChargeId: chargeId } : {}),
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

  // If the booking was already released, the pro holds their share — pull it
  // back proportionally to what's been refunded. Idempotent: we only reverse
  // the delta beyond what we've reversed before, so webhook retries and our
  // own refundBooking action (which also fires this event) never double-count.
  let transferReversedCents: number | undefined;
  if (payment.stripeTransferId) {
    const delta = reversalDeltaCents(payment, charge.amount_refunded);
    if (delta > 0) {
      const stripe = stripeClient();
      await stripe.transfers.createReversal(payment.stripeTransferId, {
        amount: delta,
        metadata: { platform: 'nextdoor_pros', paymentId: payment._id },
      });
      transferReversedCents = (payment.transferReversedCents ?? 0) + delta;
    }
  }

  // Mark fully refunded only when the whole charge is refunded; a partial
  // refund leaves the booking in its current state (with the reversal logged).
  const fullyRefunded = charge.amount_refunded >= charge.amount;

  await ctx.runMutation(internal.payments.patchPaymentRow, {
    id: payment._id,
    stripeChargeId: charge.id,
    ...(transferReversedCents !== undefined ? { transferReversedCents } : {}),
    ...(fullyRefunded ? { status: 'refunded', refundedAt: Date.now() } : {}),
  });
}

async function handleDispute(
  ctx: ActionCtx,
  dispute: Stripe.Dispute,
  phase: 'created' | 'closed',
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

  if (phase === 'created') {
    // Freeze the booking and remember where it was so we can put it back if the
    // dispute is won. We intentionally do NOT reverse the pro's transfer yet —
    // only on a lost outcome (reverse-on-loss) — so a winning dispute needs no
    // re-transfer. While 'disputed', confirmCompletion and the auto-release
    // cron both skip it (they only act on 'held').
    if (payment.status === 'disputed') return; // already frozen
    await ctx.runMutation(internal.payments.patchPaymentRow, {
      id: payment._id,
      status: 'disputed',
      preDisputeStatus: payment.status,
    });
    return;
  }

  // phase === 'closed'
  if (dispute.status === 'lost') {
    // Chargeback stands — the customer keeps the money. Recover the pro's
    // released share (proportional to the disputed amount), then settle as
    // refunded. reversalDeltaCents is idempotent via transferReversedCents.
    let transferReversedCents: number | undefined;
    if (payment.stripeTransferId) {
      const delta = reversalDeltaCents(payment, dispute.amount);
      if (delta > 0) {
        const stripe = stripeClient();
        await stripe.transfers.createReversal(payment.stripeTransferId, {
          amount: delta,
          metadata: { platform: 'nextdoor_pros', paymentId: payment._id },
        });
        transferReversedCents = (payment.transferReversedCents ?? 0) + delta;
      }
    }
    await ctx.runMutation(internal.payments.patchPaymentRow, {
      id: payment._id,
      status: 'refunded',
      refundedAt: Date.now(),
      ...(transferReversedCents !== undefined ? { transferReversedCents } : {}),
    });
    return;
  }

  // Won (or a warning closed without a chargeback) — restore the prior state.
  // The funds were never reversed, so nothing else to do.
  await ctx.runMutation(internal.payments.patchPaymentRow, {
    id: payment._id,
    status: payment.preDisputeStatus ?? 'held',
  });
}

// ── Membership (Phase 3) handlers ────────────────────────────────────────

async function handleMembershipCheckoutCompleted(
  ctx: ActionCtx,
  session: Stripe.Checkout.Session,
) {
  const customerId =
    typeof session.customer === 'string' ? session.customer : session.customer?.id;
  if (!customerId) return;

  const membership: Doc<'memberships'> | null = await ctx.runQuery(
    internal.membership.getMembershipByCustomer,
    { stripeCustomerId: customerId },
  );
  if (!membership) return;

  const subscriptionId =
    typeof session.subscription === 'string'
      ? session.subscription
      : session.subscription?.id;
  const plan = (session.metadata?.plan as string | undefined) ?? null;

  await ctx.runMutation(internal.membership.upsertMembership, {
    userId: membership.userId,
    status: 'active',
    ...(plan ? { plan } : {}),
    ...(subscriptionId ? { stripeSubscriptionId: subscriptionId } : {}),
  });
}

async function handleSubscriptionChanged(
  ctx: ActionCtx,
  subscription: Stripe.Subscription,
) {
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id;

  const membership: Doc<'memberships'> | null = await ctx.runQuery(
    internal.membership.getMembershipByCustomer,
    { stripeCustomerId: customerId },
  );
  if (!membership) return;

  // Translate Stripe statuses to our enum.
  // Stripe: 'incomplete' | 'incomplete_expired' | 'trialing' | 'active'
  //       | 'past_due' | 'canceled' | 'unpaid' | 'paused'
  const status =
    subscription.status === 'active' || subscription.status === 'trialing'
      ? 'active'
      : subscription.status === 'past_due' || subscription.status === 'unpaid'
        ? 'past_due'
        : subscription.status === 'canceled'
          ? 'cancelled'
          : 'incomplete';

  // Stripe.Subscription doesn't always type current_period_end at the top level
  // in newer API versions — fall back to reading from the first item.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const sub = subscription as any;
  const periodEnd: number | undefined =
    typeof sub.current_period_end === 'number'
      ? sub.current_period_end
      : sub.items?.data?.[0]?.current_period_end;

  await ctx.runMutation(internal.membership.upsertMembership, {
    userId: membership.userId,
    status,
    stripeSubscriptionId: subscription.id,
    ...(periodEnd ? { currentPeriodEnd: periodEnd * 1000 } : {}),
  });
}

async function handleSubscriptionDeleted(
  ctx: ActionCtx,
  subscription: Stripe.Subscription,
) {
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id;

  const membership: Doc<'memberships'> | null = await ctx.runQuery(
    internal.membership.getMembershipByCustomer,
    { stripeCustomerId: customerId },
  );
  if (!membership) return;

  await ctx.runMutation(internal.membership.upsertMembership, {
    userId: membership.userId,
    status: 'cancelled',
  });
}

async function handleInvoicePaymentFailed(ctx: ActionCtx, invoice: Stripe.Invoice) {
  const customerId =
    typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
  if (!customerId) return;

  const membership: Doc<'memberships'> | null = await ctx.runQuery(
    internal.membership.getMembershipByCustomer,
    { stripeCustomerId: customerId },
  );
  if (!membership) return;

  await ctx.runMutation(internal.membership.upsertMembership, {
    userId: membership.userId,
    status: 'past_due',
  });
}
