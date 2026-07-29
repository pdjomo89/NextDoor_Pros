import type { Locale } from '@/i18n/routing';

/**
 * ─── Markets (multi-country foundation) ────────────────────────────────────
 *
 * A "market" is a country the marketplace operates in. Everything that used to
 * be hardcoded to Cameroon (currency, supported languages, payment rail, and
 * — later — geography) is expressed here as per-country config, so adding a
 * country is a data change rather than a code hunt.
 *
 * Phase 1 keeps Cameroon as the only (and default) market; no listing carries a
 * country yet. The `country` dimension on stored data (contractors/jobs/etc.)
 * and the payment-provider *adapters* land in later phases — this file is the
 * registry those phases read from.
 *
 * NOTE: this module is imported by the Next.js app only. Convex functions
 * bundle just the `convex/` directory, so when Phase 2 needs market/provider
 * routing on the backend, the pure data below should move to a location both
 * sides can import (or be mirrored under `convex/`). Kept frontend-only for now
 * to avoid premature indirection.
 */

/** ISO 3166-1 alpha-2 country code. */
export type CountryCode = 'CM' | 'CA';

/** Payment rails a market can be wired to. Adapters arrive in Phase 2. */
export type PaymentProvider = 'fapshi' | 'stripe';

/** The two sides of the marketplace that can be monetized. */
export type MembershipRole = 'poster' | 'pro';

/**
 * How a market charges. MIRRORS convex/markets.ts — keep the two in sync.
 * Amounts are always in the currency's MINOR UNIT (XAF→francs, CAD→cents).
 *
 *  - 'payg'         Cameroon: pros pay a small fee per lead unlocked; posting is
 *                   free.
 *  - 'subscription' Canada: posters and pros each hold a monthly/yearly
 *                   membership with a per-period quota.
 */
export type MonetizationModel = 'payg' | 'subscription';

export type MembershipPlanConfig = {
  monthlyMinor: number;
  yearlyMinor: number;
  quotaPerPeriod: number;
};

export type Monetization =
  | { model: 'payg'; leadUnlockFeeMinor: number }
  | {
      model: 'subscription';
      /** Free-trial length (days) — card collected but not charged until it ends. */
      trialDays: number;
      poster: MembershipPlanConfig;
      pro: MembershipPlanConfig;
    };

export type Market = {
  /** ISO 3166-1 alpha-2, e.g. 'CM'. Also used as the region in BCP 47 locales. */
  country: CountryCode;
  /** Human-readable country name, per supported UI language. */
  name: Record<Locale, string>;
  /** ISO 4217 currency code, e.g. 'XAF'. Minor units are derived from this. */
  currency: string;
  /** UI languages offered in this market (subset of the app's routing locales). */
  locales: Locale[];
  /** Preferred language when the visitor has no explicit preference. */
  defaultLocale: Locale;
  /** Payment rail used to collect fees in this market. */
  paymentProvider: PaymentProvider;
  /** How this market charges (mirrors convex/markets.ts — TODO(pricing) values). */
  monetization: Monetization;
};

export const MARKETS: Record<CountryCode, Market> = {
  CM: {
    country: 'CM',
    name: { en: 'Cameroon', fr: 'Cameroun' },
    currency: 'XAF',
    locales: ['en', 'fr'],
    defaultLocale: 'en',
    paymentProvider: 'fapshi',
    // Confirmed 2026-07-29: pro pays 300 XAF per lead unlocked.
    monetization: { model: 'payg', leadUnlockFeeMinor: 300 },
  },
  CA: {
    country: 'CA',
    name: { en: 'Canada', fr: 'Canada' },
    currency: 'CAD',
    locales: ['en', 'fr'],
    defaultLocale: 'en',
    paymentProvider: 'stripe',
    // Confirmed 2026-07-29: $15/mo, $160/yr, both sides; hard cap of 2
    // actions/billing period (block until renewal — no overage). Card collected
    // at checkout, but the first 60 days (~2 months) are free.
    monetization: {
      model: 'subscription',
      trialDays: 60,
      poster: { monthlyMinor: 1500, yearlyMinor: 16000, quotaPerPeriod: 2 },
      pro: { monthlyMinor: 1500, yearlyMinor: 16000, quotaPerPeriod: 2 },
    },
  },
};

/**
 * The country the app defaults to until listings carry their own country
 * (Phase 3) and a country selector exists. Single source of truth for the
 * "current market" during the single-country era.
 */
export const DEFAULT_COUNTRY: CountryCode = 'CM';

export const DEFAULT_MARKET: Market = MARKETS[DEFAULT_COUNTRY];

/** All configured markets, insertion order. */
export function allMarkets(): Market[] {
  return Object.values(MARKETS);
}

/** Look up a market by country code; falls back to the default market. */
export function getMarket(country?: string | null): Market {
  if (country && country in MARKETS) return MARKETS[country as CountryCode];
  return DEFAULT_MARKET;
}

/** How a market charges: pay-as-you-go (CM) or subscription (CA). */
export function monetizationModel(country?: string | null): MonetizationModel {
  return getMarket(country).monetization.model;
}

/**
 * The market region (country code) that transacts in a given currency — used to
 * format a stored amount whose currency is known but country isn't (e.g. a
 * service-price row). Falls back to the default market.
 */
export function regionForCurrency(currency: string): CountryCode {
  const cur = currency.toUpperCase();
  for (const m of Object.values(MARKETS)) {
    if (m.currency === cur) return m.country;
  }
  return DEFAULT_COUNTRY;
}

/**
 * The lead-unlock fee (minor units) for a pay-as-you-go market; `null` if the
 * market is subscription-based (unlocks covered by membership quota).
 */
export function leadUnlockFeeMinor(country?: string | null): number | null {
  const m = getMarket(country).monetization;
  return m.model === 'payg' ? m.leadUnlockFeeMinor : null;
}

/** Free-trial length (days) for a subscription market; 0 if not applicable. */
export function membershipTrialDays(country?: string | null): number {
  const m = getMarket(country).monetization;
  return m.model === 'subscription' ? m.trialDays : 0;
}
