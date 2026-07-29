# Monetization model

The current source of truth for how the marketplace charges. It **supersedes**
the payment/fee descriptions in `multi-country.md` and `stripe-removal.md`, which
are kept only as history.

Monetization is **per market** — the model is data on each `Market`
(`convex/markets.ts` + mirror in `src/lib/markets.ts`), never hardcoded.

| | Cameroon (`CM`, active) | Canada (`CA`, dormant) |
|---|---|---|
| Model | Pay-as-you-go (`payg`) | Subscription |
| Provider | Fapshi (MTN MoMo / Orange Money) | Stripe |
| Poster | **Posts for free** | Membership → quota of **job posts** / period |
| Pro | **Pays per lead unlocked** (300 XAF) | Membership → quota of **lead unlocks** / period |
| Membership price | — | $15 CAD/mo, $160 CAD/yr (same both sides) |
| Quota | — | **2 actions / billing period, hard cap** (block until renewal, no overage) |

"Unlock a lead" = a signed-in pro gains the right to open the on-platform
conversation with a job's poster (no phone/email is ever shared). It is the one
gated pro action in both markets — paid per-unlock in `payg`, quota-covered under
a subscription.

## Where it lives

- **Config** — `convex/markets.ts`: `monetization` on each market
  (`leadUnlockFeeMinor` for `payg`; `poster`/`pro` plan prices + `quotaPerPeriod`
  for subscriptions), with accessors `monetizationModel`, `leadUnlockFeeMinor`,
  `membershipPlanConfig`. Mirrored in `src/lib/markets.ts` for the UI.
- **Lead unlocks** — `convex/leadUnlocks.ts`: `startLeadUnlock` (payg → Fapshi
  hosted checkout), `unlockWithMembership` (subscription → consumes quota, zero
  charge), `isUnlocked`, settlement + fallback poll. Data in the `leadUnlocks`
  table.
- **Memberships** — `convex/memberships.ts`: `startMembership` (→ Stripe
  subscription Checkout), `myMembership` (status + quota used/remaining),
  `upsertFromStripe` (webhook settle), `openBillingPortal`, and the gating
  helpers `getActiveMembership` / `countUsageInPeriod` / `assertMembershipQuota`.
  Stripe REST lives in `convex/stripeSubscriptions.ts`. Data in the `memberships`
  table. **Quota usage is derived** (count jobs / successful leadUnlocks in the
  current period) — never stored, so it can't drift.
- **Gating** — `jobs.create` requires a poster membership + quota in subscription
  markets; contacting is gated in `messaging.startJobConversation` (requires
  sign-in + a successful unlock).
- **Webhooks** — `convex/http.ts`: `/fapshi/webhook` settles lead-unlock
  payments; `/stripe/webhook` drives the subscription lifecycle.
- **UI** — `src/components/contact-employer-button.tsx` (sign-in → unlock/pay or
  join → message) and the `/[locale]/membership` page + `membership-client.tsx`
  (subscribe / manage). i18n under the `Membership` namespace + `Jobs.unlock*` /
  `Jobs.joinToContact`.

## Required env vars

- Fapshi: `FAPSHI_BASE_URL`, `FAPSHI_API_USER`, `FAPSHI_API_KEY`,
  `FAPSHI_WEBHOOK_SECRET`.
- Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`. Webhook events:
  `checkout.session.completed`, `customer.subscription.updated`,
  `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`.
- Also `SITE_URL` (post-checkout redirects). Until keys are set, the pay/subscribe
  buttons throw "Missing … env var" and the UI shows a generic error.

## Notes / still open

- **Canada is dormant** — no CA cities are selectable, so the subscription path
  isn't reachable by real users yet; it's preview-able at `/membership?country=CA`.
  Activating it needs the CA market switched on + a user→market signal.
- Prices/quota are set in `markets.ts` — change them there (both files).
