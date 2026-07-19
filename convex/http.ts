import { httpRouter } from 'convex/server';
import { httpAction } from './_generated/server';
import { internal } from './_generated/api';
import { auth } from './auth';
import { PROVIDER_NAMES, getProvider } from './paymentProviders';

const http = httpRouter();
auth.addHttpRoutes(http);

// ─── Payment webhooks (one route per provider) ───────────────────────────────
//
// Each provider authenticates the request its own way (Fapshi: `x-wh-secret`
// header; Stripe: HMAC `stripe-signature`). We never trust the body's status —
// after verifying + extracting the transaction id, we re-fetch the
// authoritative status via provider.getStatus before settling the job.
//
// Configure each provider's dashboard to POST here:
//   Fapshi:  https://<deployment>.convex.site/fapshi/webhook
//   Stripe:  https://<deployment>.convex.site/stripe/webhook
for (const name of PROVIDER_NAMES) {
  http.route({
    path: `/${name}/webhook`,
    method: 'POST',
    handler: httpAction(async (ctx, req) => {
      const provider = getProvider(name);
      const verified = await provider.verifyWebhook(req);
      if (!verified.ok) {
        return new Response(verified.message, { status: verified.status });
      }

      const remote = await provider.getStatus(verified.transId);
      await ctx.runMutation(internal.jobFees.applyPaymentResult, {
        transId: verified.transId,
        status: remote.status,
      });

      return new Response('OK', { status: 200 });
    }),
  });
}

export default http;
