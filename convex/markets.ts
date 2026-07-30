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

/** The two sides of the marketplace that can be monetized. */
export type MembershipRole = 'poster' | 'pro';

/**
 * How a market charges. Amounts are ALWAYS in the currency's MINOR UNIT (see the
 * money convention in convex/schema.ts). Placeholder numbers below are marked
 * TODO(pricing) — tune them before a market goes live.
 *
 *  - 'payg'         Cameroon: no membership. Pros pay a small fee per lead they
 *                   unlock; posters post for free.
 *  - 'subscription' Canada: both posters and pros hold a monthly/yearly
 *                   membership granting a quota of actions per billing period.
 */
export type MonetizationModel = 'payg' | 'subscription';

/** Per-side recurring plan config (subscription markets). */
export type MembershipPlanConfig = {
  /** Monthly price, minor units of the market currency. */
  monthlyMinor: number;
  /** Yearly price, minor units of the market currency. */
  yearlyMinor: number;
  /** Actions allowed per billing period (posts for a poster, unlocks for a pro). */
  quotaPerPeriod: number;
};

export type Monetization =
  | {
      model: 'payg';
      /** Fee a pro pays to unlock one lead, minor units of the market currency. */
      leadUnlockFeeMinor: number;
    }
  | {
      model: 'subscription';
      /** Free-trial length (days) — card is collected but not charged until it ends. */
      trialDays: number;
      poster: MembershipPlanConfig;
      pro: MembershipPlanConfig;
    };

export type Market = {
  country: CountryCode;
  /** ISO 4217, uppercase (e.g. 'XAF'). */
  currency: string;
  paymentProvider: ProviderName;
  monetization: Monetization;
};

export const MARKETS: Record<CountryCode, Market> = {
  CM: {
    country: 'CM',
    currency: 'XAF',
    paymentProvider: 'fapshi',
    // Confirmed 2026-07-29: pro pays 300 XAF (whole francs) per lead unlocked.
    monetization: { model: 'payg', leadUnlockFeeMinor: 300 },
  },
  CA: {
    country: 'CA',
    currency: 'CAD',
    paymentProvider: 'stripe',
    // Confirmed 2026-07-29: $15/mo, $160/yr, both sides; hard cap of 2
    // actions/billing period (block until renewal — no overage). Card is
    // collected at checkout but the first 30 days (~1 month) are free.
    monetization: {
      model: 'subscription',
      trialDays: 30,
      poster: { monthlyMinor: 1500, yearlyMinor: 16000, quotaPerPeriod: 2 },
      pro: { monthlyMinor: 1500, yearlyMinor: 16000, quotaPerPeriod: 2 },
    },
  },
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

/** How a country charges: pay-as-you-go (CM) or subscription (CA). */
export function monetizationModel(country?: string | null): MonetizationModel {
  return getMarket(country).monetization.model;
}

/**
 * The lead-unlock fee (minor units) for a pay-as-you-go market. Throws if the
 * market is subscription-based — unlocks there are covered by the membership
 * quota, not charged per lead.
 */
export function leadUnlockFeeMinor(country?: string | null): number {
  const m = getMarket(country).monetization;
  if (m.model !== 'payg') {
    throw new Error(
      `Market ${getMarket(country).country} is subscription-based; it has no per-lead unlock fee.`,
    );
  }
  return m.leadUnlockFeeMinor;
}

/**
 * The membership plan config for a side of a subscription market. Throws if the
 * market is pay-as-you-go (no memberships there).
 */
export function membershipPlanConfig(
  country: string | null | undefined,
  role: MembershipRole,
): MembershipPlanConfig {
  const m = getMarket(country).monetization;
  if (m.model !== 'subscription') {
    throw new Error(
      `Market ${getMarket(country).country} is pay-as-you-go; it has no memberships.`,
    );
  }
  return m[role];
}

/** Free-trial length (days) for a subscription market; 0 if not applicable. */
export function membershipTrialDays(country?: string | null): number {
  const m = getMarket(country).monetization;
  return m.model === 'subscription' ? m.trialDays : 0;
}
