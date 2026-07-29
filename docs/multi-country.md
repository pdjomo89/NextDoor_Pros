# Multi-country marketplace

> **Payment/fee sections below are historical.** The charge-on-post posting fee
> (`jobFees.ts`, `JOB_POSTING_FEE`, the `jobPayments` table) has been **removed**.
> The current billing model — free posting + per-lead unlock fees (Cameroon) and
> Stripe subscriptions (Canada) — lives in **`docs/monetization.md`**. The
> country/geography foundation described here is still accurate.

Goal: turn the app from a single hardcoded country (Cameroon) into a global
marketplace where **country is a first-class dimension** — each market has its
own cities, currency, payment rail, and isolated listings — launched one country
at a time on a shared foundation.

Country is orthogonal to language. Language (`en`/`fr`) is already handled by
`next-intl`; a French speaker exists in both Cameroon and France. Don't conflate
the two.

## Phasing

- **Phase 1 — Foundation (done).** Code-only, no stored-data change, invisible to users.
  - `src/lib/markets.ts` — the per-country `Market` registry (currency, locales,
    payment provider, name). Cameroon is the sole/default market.
  - `src/lib/currency.ts` — currency-aware `formatMoney(minorAmount, currency,
    locale)`; `formatFcfa` kept as a deprecated back-compat shim.
  - Money storage convention documented in `convex/schema.ts`: **amounts are
    integers in the currency's minor unit.** XAF's exponent is 0, so existing
    whole-franc data is already valid — no migration needed.
  - Single-country copy in `src/app/layout.tsx` now reads from the default market.
- **Phase 2 — Payment abstraction (done).**
  - `convex/paymentTypes.ts` — the `PaymentProvider` interface (`initiatePay` /
    `getStatus` / `verifyWebhook`), minor-unit amounts + explicit currency,
    local settle-status enums. Types-only, to avoid registry↔adapter cycles.
  - `convex/fapshiClient.ts` — Fapshi refactored behind the interface
    (`fapshiProvider`), behavior-preserving.
  - `convex/stripeProvider.ts` — Stripe adapter via REST (Checkout Sessions) +
    Web Crypto HMAC webhook verification. **Implemented but untested pending
    live keys** — env vars + an end-to-end test are Phase 4 (launch) work.
  - `convex/paymentProviders.ts` — `getProvider(name)` registry +
    `DEFAULT_PAYMENT_PROVIDER`. `jobFees.ts` and `http.ts` route through it;
    `http.ts` mounts one webhook route per provider.
  - Provider selection is still the default (`'fapshi'`) because no job carries
    a country yet — it becomes market-driven in Phase 3.
  - Env vars: Fapshi → `FAPSHI_BASE_URL`, `FAPSHI_API_USER`, `FAPSHI_API_KEY`,
    `FAPSHI_WEBHOOK_SECRET`. Stripe → `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`.
  - Note: Convex bundles only `convex/`, so `DEFAULT_PAYMENT_PROVIDER` mirrors
    `DEFAULT_MARKET.paymentProvider` rather than importing it. Phase 3 should
    give the backend a shared/mirrored market config (see the note atop
    `src/lib/markets.ts`) and derive the provider from the job's market.
- **Phase 3 — Country dimension (mostly done).** See below.
- **Phase 4 — Launch market #2 (Canada, in progress).**
  - **Canada market added** — `CA` in `src/lib/markets.ts` + `convex/markets.ts`
    (CAD, en+fr, **Stripe**). All **13 provinces/territories** + ~100 major
    cities.
  - **Geography is single-sourced** — region/city DATA now lives once in
    `convex/geo.ts` (Convex-bundlable, imported by the frontend too);
    `src/data/geography.ts` is a typed wrapper and `convex/markets.ts` reads
    `countryOfCity` from it. No more hand-kept mirror to drift. Add a
    city/region in that one file; slugs + region codes stay globally unique.
  - **Country selector** — `src/components/country-picker.tsx` in the header
    (hidden when only one market exists). Active market is explicit + persisted
    in `city-picker-context` (`setCountry` clears a mismatched city; picking a
    city implies its market).
  - **Scoped browse** — the city picker lists only the active country's cities;
    the jobs board (`jobs.list`) and the review picker (`listAllPublished`) pass
    the active `country`.
  - Still to do for a real CA launch: Stripe keys + webhook, geo-detected
    default, per-market fee (`JOB_POSTING_FEE`), French-Canadian copy nuances,
    and the legal/tax items below.
  - Repeat this shape per additional country.

## Phase 3 — Country dimension

Country **derives from city**: every listing/job has a `citySlug`, each city
belongs to a country, so a row's market follows its location. No URL restructure
— the existing city-picker preference carries the active market.

Done:

1. **Geography is country-aware** — `src/data/cameroon-cities.ts` cities carry a
   `country`; `countryOfCity()` / `citiesForCountry()` added (all exports kept).
   Backend mirror: `convex/markets.ts` (`countryOfCity`, `providerForCountry`,
   `currencyForCountry`) — self-contained because Convex can't import `src/`.
2. **`country` on `contractors` + `jobs`** (`v.optional`), with `by_country_published`
   / `by_country_status` indexes. Stamped server-side from `citySlug` on every
   insert/update (`upsertMine`, `jobs.create/update`, `createPendingJob`) — never
   trusted from the client.
3. **Backfill** — `convex/migrations.ts::backfillCountry` (idempotent). Ran with
   0 rows to update (tables were empty post-wipe); tighten `country` to required
   once real data exists everywhere.
4. **Provider/currency derive from the job's market** — `createPendingJob` uses
   `providerForCountry` / `currencyForCountry`; the dead `DEFAULT_PAYMENT_PROVIDER`
   was removed.
5. **Country-scoped query capability** — `jobs.list`, `contractors.listByService`
   / `listAllPublished` accept an optional `country` and use the country indexes.
   `useCity()` now also exposes the active `country`.

Deferred to Phase 4 (need a real second market to be meaningful, not premature):

- **Country selector widget + call-site wiring** — passing the active `country`
  into the browse/board queries. A one-country selector is pointless UI; the
  capability + index are in place, so activation is a one-arg change per caller.
- **Currency required + `Cents`→ minor-unit field renames** — cosmetic; the
  minor-unit convention already holds. When done: add new field, dual-write,
  backfill, migrate readers, drop old (Convex has no rename primitive). Values
  copy verbatim (XAF exponent 0 → minor units == whole francs).
- **Per-market fee** — `JOB_POSTING_FEE` becomes per-market when market #2 opens.
- **Geo-detected default country**, and generalizing sitemap/SEO city pages to
  iterate markets.

### Non-code, per-country (gates a launch, not the build)
KYC/identity, tax (VAT/GST), payout compliance, and Terms per jurisdiction.

## Invariants
- Store money as integer minor units + a currency; never format by dividing by a
  hardcoded 100 or assuming zero decimals. Use `formatMoney`.
- Never hardcode a country/currency/city in a component — read from the market.
