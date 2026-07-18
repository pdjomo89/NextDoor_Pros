const FCFA = new Intl.NumberFormat('en-CM', {
  style: 'currency',
  currency: 'XAF',
  maximumFractionDigits: 0,
});
const FCFA_FR = new Intl.NumberFormat('fr-CM', {
  style: 'currency',
  currency: 'XAF',
  maximumFractionDigits: 0,
});

/**
 * Format a whole-FCFA amount (CFA franc / XAF has no minor units) for display.
 * Prices are stored as whole francs, so there is no division here.
 */
export function formatFcfa(amount: number, locale: string): string {
  return (locale === 'fr' ? FCFA_FR : FCFA).format(amount);
}
