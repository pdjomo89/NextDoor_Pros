// ──────────────────────────────────────────────────────────────────────────
// Market config (backend).
//
// The Convex-side source of truth for per-country currency + payment provider,
// and the city→country mapping used to stamp a listing/job's country on insert.
//
// Convex bundles only `convex/`, so this cannot import src/. It intentionally
// mirrors the frontend registries — src/lib/markets.ts (countries) and
// src/data/cameroon-cities.ts (city→country). Keep them in sync when adding a
// country or its cities.
// ──────────────────────────────────────────────────────────────────────────

import type { ProviderName } from './paymentTypes';
import { countryOfCity as geoCountryOfCity } from './geo';

export type CountryCode = 'CM' | 'CA';

export type Market = {
  country: CountryCode;
  /** ISO 4217, uppercase (e.g. 'XAF'). */
  currency: string;
  paymentProvider: ProviderName;
};

export const MARKETS: Record<CountryCode, Market> = {
  CM: { country: 'CM', currency: 'XAF', paymentProvider: 'fapshi' },
  CA: { country: 'CA', currency: 'CAD', paymentProvider: 'stripe' },
};

export const DEFAULT_COUNTRY: CountryCode = 'CM';

/**
 * Country a city belongs to; unknown/empty slugs fall back to the default.
 * Reads the shared city→country data in convex/geo.ts (single source of truth),
 * so backend and frontend can never disagree.
 */
export function countryOfCity(citySlug: string | undefined | null): CountryCode {
  return geoCountryOfCity(citySlug) as CountryCode;
}

export function getMarket(country?: string | null): Market {
  if (country && country in MARKETS) return MARKETS[country as CountryCode];
  return MARKETS[DEFAULT_COUNTRY];
}

/** Payment provider a country's fees are collected through. */
export function providerForCountry(country?: string | null): ProviderName {
  return getMarket(country).paymentProvider;
}

/** Currency (uppercase ISO 4217) a country transacts in. */
export function currencyForCountry(country?: string | null): string {
  return getMarket(country).currency;
}
