import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';
import { internal } from './_generated/api';
import { auth } from './auth';
import { getProvider } from './paymentProviders';
import { parseStripeWebhook, retrieveSubscription } from './stripeSubscriptions';
import { retrieveConnectAccount } from './stripeConnect';
import { retrieveEscrowSession } from './stripeEscrow';

const http = httpRouter();
auth.addHttpRoutes(http);

// ─── Fapshi webhook — pro-side fees (Cameroon) ───────────────────────────────
//
// Fapshi authenticates with the `x-wh-secret` header. We never trust the body's
// status: after verifying + extracting the transaction id, we re-fetch the
// authoritative status via getStatus, then settle the matching row. A transId
// belongs to exactly one of the two payment kinds (per-lead unlock, or the fee
// to reply to a guest inquiry), so both settlers run and the one that doesn't
// own it no-ops. Idempotent either way.
//   Configure Fapshi to POST here: https://<deployment>.convex.site/fapshi/webhook
http.route({
  path: '/fapshi/webhook',
  method: 'POST',
  handler: httpAction(async (ctx, req) => {
    const provider = getProvider('fapshi');
    const verified = await provider.verifyWebhook(req);
    if (!verified.ok) {
      return new Response(verified.message, { status: verified.status });
    }
    const remote = await provider.getStatus(verified.transId);
    await ctx.runMutation(internal.leadUnlocks.applyUnlockResult, {
      transId: verified.transId,
      status: remote.status,
    });
    await ctx.runMutation(internal.inquiryUnlocks.applyInquiryUnlockResult, {
      transId: verified.transId,
      status: remote.status,
    });
    return new Response('OK', { status: 200 });
  }),
});

// ─── Stripe webhook — subscription memberships (Canada) ───────────────────────
//
// Handles the recurring lifecycle: checkout.session.completed (subscription),
// customer.subscription.*, invoice.paid / invoice.payment_failed. We verify the
// signature, extract the subscription id, then re-fetch the authoritative
// subscription (never trusting the event body) and upsert the membership from
// its metadata (userId/role/country set at checkout).
//   Configure Stripe to POST here: https://<deployment>.convex.site/stripe/webhook
//   Subscribe to: checkout.session.completed, customer.subscription.updated,
//                 customer.subscription.deleted, invoice.paid, invoice.payment_failed
http.route({
  path: '/stripe/webhook',
  method: 'POST',
  handler: httpAction(async (ctx, req) => {
    const parsed = await parseStripeWebhook(req);
    if (!parsed.ok) {
      return new Response(parsed.message, { status: parsed.status });
    }

    // Connect account onboarding progress (pro payout capability).
    if (parsed.accountId) {
      const acct = await retrieveConnectAccount(parsed.accountId);
      await ctx.runMutation(internal.connect.upsertConnectFromStripe, {
        stripeAccountId: acct.id,
        chargesEnabled: acct.chargesEnabled,
        payoutsEnabled: acct.payoutsEnabled,
        detailsSubmitted: acct.detailsSubmitted,
      });
      return new Response('OK', { status: 200 });
    }

    // Job escrow payment (employer paid the agreed amount → held on platform).
    if (parsed.paymentSessionId) {
      const sess = await retrieveEscrowSession(parsed.paymentSessionId);
      if (sess.paid && sess.escrowId) {
        await ctx.runMutation(internal.jobEscrow.markEscrowHeld, {
          sessionId: parsed.paymentSessionId,
          paymentIntentId: sess.paymentIntentId,
        });
      }
      return new Response('OK', { status: 200 });
    }

    // An event type we don't act on — acknowledge so Stripe stops retrying.
    if (!parsed.subscriptionId) return new Response('OK', { status: 200 });

    const sub = await retrieveSubscription(parsed.subscriptionId);
    const userId = sub.metadata.userId;
    const role = sub.metadata.role;
    // Not one of our subscriptions (no attribution metadata) — ignore.
    if (!userId || (role !== 'poster' && role !== 'pro')) {
      return new Response('OK', { status: 200 });
    }

    await ctx.runMutation(internal.memberships.upsertFromStripe, {
      subscriptionId: sub.id,
      stripeStatus: sub.status,
      customerId: sub.customerId,
      currentPeriodStart: sub.currentPeriodStart,
      currentPeriodEnd: sub.currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
      trialEnd: sub.trialEnd,
      interval: sub.interval,
      userId,
      role,
      country: sub.metadata.country,
    });
    return new Response('OK', { status: 200 });
  }),
});

export default http;
