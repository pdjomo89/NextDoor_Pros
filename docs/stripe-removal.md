# Stripe removal

The Stripe integration was **completely removed** on 2026-07-18. The app no
longer has any online payments, subscriptions, or escrow. This note records what
was removed and the product decisions behind it, so the absence is intentional
and traceable.

## Product decisions

- **Publishing a pro listing and posting a job are now free.** The previous
  paid-membership paywall (`hasActiveMembership`) was removed from
  `contractors.upsertMine` and `jobs.create`.
- **Paid bookings and escrow were removed entirely.** Contractors still keep a
  service catalog, but it is now an **informational price list** only —
  customers reach out via the contact button; there is no online payment.
- The unused Stripe database tables and fields were dropped from the schema.

## What was removed

### Backend (`convex/`)
- `stripeWebhook.ts` and `membership.ts` — deleted.
- `payments.ts` — stripped down to the non-Stripe service-catalog CRUD
  (`listMyServices`, `listPublicServices`, `upsertService`, `deleteService`).
- `http.ts` — removed the `/stripe/webhook` route.
- `crons.ts` — removed the escrow auto-release cron.
- `schema.ts` — dropped the `payments`, `memberships`, and `stripeEvents`
  tables and the `stripeAccountId` / `stripeOnboardingComplete` fields (and
  their index) on `contractors`.

### Frontend (`src/`)
- Deleted: `payments-section`, `bookings-section`, `membership-status-card`,
  `membership-picker`, `checkout-success-client`, `confirm-completion-client`,
  `booking-section`, and the `/checkout`, `/membership`,
  `/pros/onboard/membership`, and `/pricing` routes.
- Added: `services-section.tsx` (Stripe-free dashboard service manager) and
  `public-services.tsx` (read-only price list on the public profile).
- Removed the pricing link from the header, footer, and sitemap.

### i18n (`messages/`)
- Removed the Stripe namespaces (`Pricing`, `Checkout`, `membershipPicker`,
  `dashboard.membership`, `dashboard.bookings`, `dashboard.payments`,
  `Jobs.paid`) from `en.json` and `fr.json`; added a `dashboard.services`
  namespace.

### Dependencies
- Removed the `stripe` package.

## Data & credentials cleanup

- Removed all `STRIPE_*` env vars from Convex (dev + prod), Vercel, and
  `.env.local`.
- Purged the orphaned rows left in the dropped tables (`payments`,
  `memberships`, `stripeEvents`) and the pre-existing empty `jobApplications`
  table, on both the dev and prod deployments.

> **Note:** rolling/deleting the Stripe **secret key** and the `…/stripe/webhook`
> **endpoint(s)** must still be done in the Stripe dashboard — that cannot be
> done from the codebase. The keys in use were test-mode.
