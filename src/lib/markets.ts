import type { Locale } from '@/i18n/routing';
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
  type PaymentProvider,
} from '../../convex/marketsConfig';

/**
 * ─── Markets (multi-country foundation) ────────────────────────────────────
 *
 * A "market" is a country the marketplace operates in. Everything that used to
 * be hardcoded to Cameroon (currency, supported languages, payment rail, and
 * geography) is expressed as per-country config, so adding a country is a data
 * change rather than a code hunt.
 *
 * What a market CHARGES — prices, per-lead fee, trial length, quotas — lives in
 * convex/marketsConfig.ts, imported by this file and by the Convex backend
 * alike. That module is authoritative: it is what actually reaches Stripe and
 * Fapshi, and this file only presents it. The two used to be separate copies,
 * which let a pricing edit change the displayed price without changing the
 * charged one.
 *
 * What this file adds is presentation-only: the country's display name and the
 * languages its UI is offered in. Those never affect billing, so they stay on
 * the frontend side.
 */

export type {
  CountryCode,
  MembershipPlanConfig,
  MembershipRole,
  Monetization,
  MonetizationModel,
  PaymentProvider,
};
export { DEFAULT_COUNTRY, membershipTrialDays, monetizationModel };

/** Presentation-only per-country fields; the rest of a Market comes from the
 *  shared config. */
type MarketPresentation = {
  /** Human-readable country name, per supported UI language. */
  name: Record<Locale, string>;
  /** UI languages offered in this market (subset of the app's routing locales). */
  locales: Locale[];
  /** Preferred language when the visitor has no explicit preference. */
  defaultLocale: Locale;
};

export type Market = MarketConfig & MarketPresentation;

const PRESENTATION: Record<CountryCode, MarketPresentation> = {
  CM: {
    name: { en: 'Cameroon', fr: 'Cameroun' },
    locales: ['en', 'fr'],
    defaultLocale: 'en',
  },
  CA: {
    name: { en: 'Canada', fr: 'Canada' },
    locales: ['en', 'fr'],
    defaultLocale: 'en',
  },
};

export const MARKETS: Record<CountryCode, Market> = {
  CM: { ...MARKET_CONFIG.CM, ...PRESENTATION.CM },
  CA: { ...MARKET_CONFIG.CA, ...PRESENTATION.CA },
};

export const DEFAULT_MARKET: Market = MARKETS[DEFAULT_COUNTRY];

/** All configured markets, insertion order. */
export function allMarkets(): Market[] {
  return Object.values(MARKETS);
}

/** Look up a market by country code; falls back to the default market. */
export function getMarket(country?: string | null): Market {
  return MARKETS[getMarketConfig(country).country];
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

/**
 * The fee (minor units) a pro pays to reply to one inbound guest inquiry;
 * `null` if the market is subscription-based (replying covered by membership).
 */
export function inquiryReplyFeeMinor(country?: string | null): number | null {
  const m = getMarket(country).monetization;
  return m.model === 'payg' ? m.inquiryReplyFeeMinor : null;
}
