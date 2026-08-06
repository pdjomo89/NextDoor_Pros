// ──────────────────────────────────────────────────────────────────────────
// Market config — THE single source of truth for what a market charges.
//
// Imported by BOTH sides:
//   convex/markets.ts   → backend helpers; feeds Stripe/Fapshi (authoritative
//                         for what a card is actually charged)
//   src/lib/markets.ts  → frontend helpers + UI-only fields (country name,
//                         languages); feeds displayed prices and copy
//
// These used to be two hand-synced copies, which let a pricing edit land in the
// displayed copy but not in the billing call. Money numbers now live here only.
//
// Deliberately dependency-free (no convex/* server imports, no `@/*` aliases) so
// the Convex bundler and the Next.js bundler can each pull it in unchanged.
//
// Amounts are ALWAYS in the currency's MINOR UNIT (XAF → whole francs, CAD →
// cents) — see the money convention in convex/schema.ts.
// ──────────────────────────────────────────────────────────────────────────

/** ISO 3166-1 alpha-2 country code. Also the region in BCP 47 locales. */
export type CountryCode = 'CM' | 'CA';

/** Payment rails a market can be wired to. */
export type PaymentProvider = 'fapshi' | 'stripe';

/** The two sides of the marketplace that can be monetized. */
export type MembershipRole = 'poster' | 'pro';

/**
 * How a market charges.
 *
 *  - 'payg'         Cameroon: no membership. Pros pay a small fee per lead they
 *                   unlock; posters post for free.
 *  - 'subscription' Canada: posters and pros each hold a monthly/yearly
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
      /**
       * Fee a pro pays to reply to ONE inbound guest inquiry, minor units of the
       * market currency. Priced below the lead-unlock fee on purpose: an inquiry
       * is a warm customer who came to the pro, whereas a lead is a cold job the
       * pro goes looking for. Customers are never charged — see
       * convex/inquiryUnlocks.ts.
       */
      inquiryReplyFeeMinor: number;
    }
  | {
      model: 'subscription';
      /** Free-trial length (days) — card collected but not charged until it ends. */
      trialDays: number;
      poster: MembershipPlanConfig;
      pro: MembershipPlanConfig;
    };

/** What a market charges and through which rail. UI-only fields (country name,
 *  languages) hang off this in src/lib/markets.ts — they never affect billing. */
export type MarketConfig = {
  country: CountryCode;
  /** ISO 4217, uppercase (e.g. 'XAF'). */
  currency: string;
  paymentProvider: PaymentProvider;
  monetization: Monetization;
};

export const MARKET_CONFIG: Record<CountryCode, MarketConfig> = {
  CM: {
    country: 'CM',
    currency: 'XAF',
    paymentProvider: 'fapshi',
    // Confirmed 2026-07-29: pro pays 300 XAF (whole francs) per lead unlocked.
    // Added 2026-08-06: pro pays 200 XAF to reply to an inbound guest inquiry.
    monetization: {
      model: 'payg',
      leadUnlockFeeMinor: 300,
      inquiryReplyFeeMinor: 200,
    },
  },
  CA: {
    country: 'CA',
    currency: 'CAD',
    paymentProvider: 'stripe',
    // Confirmed 2026-07-29: $15/mo, $160/yr, both sides; hard cap of 2
    // actions/billing period (block until renewal — no overage). Card is
    // collected at checkout but the first 90 days (~3 months) are free
    // (trial length raised from 30 on 2026-08-06).
    monetization: {
      model: 'subscription',
      trialDays: 90,
      poster: { monthlyMinor: 1500, yearlyMinor: 16000, quotaPerPeriod: 2 },
      pro: { monthlyMinor: 1500, yearlyMinor: 16000, quotaPerPeriod: 2 },
    },
  },
};

/**
 * The country the app defaults to: the market a visitor sees before picking a
 * city, and the fallback for any row that doesn't carry its own country. Note
 * this also selects the fallback payment rail (CA → Stripe subscriptions), so a
 * row with no country is billed as Canadian.
 */
export const DEFAULT_COUNTRY: CountryCode = 'CA';

/** Look up a market's charging config; falls back to the default market. */
export function getMarketConfig(country?: string | null): MarketConfig {
  if (country && country in MARKET_CONFIG) {
    return MARKET_CONFIG[country as CountryCode];
  }
  return MARKET_CONFIG[DEFAULT_COUNTRY];
}

/** How a country charges: pay-as-you-go (CM) or subscription (CA). */
export function monetizationModel(country?: string | null): MonetizationModel {
  return getMarketConfig(country).monetization.model;
}

/** Free-trial length (days) for a subscription market; 0 if not applicable. */
export function membershipTrialDays(country?: string | null): number {
  const m = getMarketConfig(country).monetization;
  return m.model === 'subscription' ? m.trialDays : 0;
}
