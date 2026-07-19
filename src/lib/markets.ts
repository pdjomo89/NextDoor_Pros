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
};

export const MARKETS: Record<CountryCode, Market> = {
  CM: {
    country: 'CM',
    name: { en: 'Cameroon', fr: 'Cameroun' },
    currency: 'XAF',
    locales: ['en', 'fr'],
    defaultLocale: 'en',
    paymentProvider: 'fapshi',
  },
  CA: {
    country: 'CA',
    name: { en: 'Canada', fr: 'Canada' },
    currency: 'CAD',
    locales: ['en', 'fr'],
    defaultLocale: 'en',
    paymentProvider: 'stripe',
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
