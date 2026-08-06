// ──────────────────────────────────────────────────────────────────────────
// Market config (backend).
//
// Backend helpers over the shared registry in convex/marketsConfig.ts — which
// is the single source of truth for prices, fees and trial length, imported by
// this file AND by src/lib/markets.ts. Do not redeclare money numbers here.
//
// This file adds what only the backend needs: the city→country mapping used to
// stamp a listing/job's country on insert (convex/geo.ts), and the throwing
// accessors callers rely on to fail loudly when they ask a market for something
// its model doesn't have.
// ──────────────────────────────────────────────────────────────────────────

import type { ProviderName } from './paymentTypes';
import { countryOfCity as geoCountryOfCity } from './geo';
import {
  DEFAULT_COUNTRY,
  getMarketConfig,
  MARKET_CONFIG,
  membershipTrialDays,
  monetizationModel,
  type CountryCode,
  type MarketConfig,
  type MembershipPlanConfig,
  type MembershipRole,
  type Monetization,
  type MonetizationModel,
} from './marketsConfig';

// Re-exported so existing backend imports (`from './markets'`) keep working.
export {
  DEFAULT_COUNTRY,
  MARKET_CONFIG as MARKETS,
  membershipTrialDays,
  monetizationModel,
};
export type {
  CountryCode,
  MembershipPlanConfig,
  MembershipRole,
  Monetization,
  MonetizationModel,
};

/** A market as the backend sees it: what it charges, and through which rail. */
export type Market = MarketConfig;

/**
 * Country a city belongs to; unknown/empty slugs fall back to the default.
 * Reads the shared city→country data in convex/geo.ts (single source of truth),
 * so backend and frontend can never disagree.
 */
export function countryOfCity(citySlug: string | undefined | null): CountryCode {
  return geoCountryOfCity(citySlug) as CountryCode;
}

export function getMarket(country?: string | null): Market {
  return getMarketConfig(country);
}

/** Payment provider a country's fees are collected through. */
export function providerForCountry(country?: string | null): ProviderName {
  return getMarket(country).paymentProvider;
}

/** Currency (uppercase ISO 4217) a country transacts in. */
export function currencyForCountry(country?: string | null): string {
  return getMarket(country).currency;
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
 * The fee (minor units) a pro pays to reply to one inbound guest inquiry in a
 * pay-as-you-go market. Throws if the market is subscription-based — replying
 * there is covered by the pro's membership, not charged per inquiry.
 */
export function inquiryReplyFeeMinor(country?: string | null): number {
  const m = getMarket(country).monetization;
  if (m.model !== 'payg') {
    throw new Error(
      `Market ${getMarket(country).country} is subscription-based; replying to an inquiry is covered by membership.`,
    );
  }
  return m.inquiryReplyFeeMinor;
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
