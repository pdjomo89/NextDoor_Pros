import { DEFAULT_MARKET } from '@/lib/markets';

/**
 * ─── Money formatting (currency-aware) ─────────────────────────────────────
 *
 * Stored convention: every monetary amount is an integer in the currency's
 * *minor unit* (the smallest indivisible amount). The exponent is currency-
 * specific — XAF has 0 minor units (1 = 1 franc), USD/EUR have 2 (100 = $1.00),
 * BHD has 3. `formatMoney` divides by the right power of ten before display.
 *
 * Because XAF's exponent is 0, existing whole-franc amounts are already valid
 * minor-unit values — no data conversion is needed to adopt this convention.
 */

/**
 * Minor-unit exponent for an ISO 4217 currency (XAF → 0, USD → 2, BHD → 3).
 * Derived from the runtime's Intl currency data rather than a hand table.
 */
export function currencyMinorUnits(currency: string): number {
  // `maximumFractionDigits` is always defined for style:'currency', but the DOM
  // typings mark it optional — fall back to the common 2-decimal case.
  return (
    new Intl.NumberFormat('en', {
      style: 'currency',
      currency,
    }).resolvedOptions().maximumFractionDigits ?? 2
  );
}

const formatterCache = new Map<string, Intl.NumberFormat>();

function getFormatter(locale: string, currency: string, region: string): Intl.NumberFormat {
  const key = `${locale}-${region}|${currency}`;
  let fmt = formatterCache.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat(`${locale}-${region}`, {
      style: 'currency',
      currency,
      maximumFractionDigits: currencyMinorUnits(currency),
    });
    formatterCache.set(key, fmt);
  }
  return fmt;
}

/**
 * Format an integer minor-unit amount for display in a given currency.
 * @param minorAmount whole number in the currency's smallest unit
 * @param currency    ISO 4217 code, e.g. 'XAF', 'USD'
 * @param locale      UI language ('en' | 'fr'); drives digit grouping & symbol
 * @param region      BCP 47 region; defaults to the current market's country
 */
export function formatMoney(
  minorAmount: number,
  currency: string,
  locale: string,
  region: string = DEFAULT_MARKET.country,
): string {
  const value = minorAmount / 10 ** currencyMinorUnits(currency);
  return getFormatter(locale, currency, region).format(value);
}

/**
 * Back-compat shim for the single-currency (Cameroon) era: formats a whole-FCFA
 * amount. New code should prefer `formatMoney(amount, currency, locale)` with
 * the currency taken from the listing's market.
 * @deprecated use formatMoney with an explicit currency.
 */
export function formatFcfa(amount: number, locale: string): string {
  return formatMoney(amount, DEFAULT_MARKET.currency, locale);
}
