// ──────────────────────────────────────────────────────────────────────────
// Payment-provider registry.
//
// Resolves a `ProviderName` to its adapter. Callers (convex/leadUnlocks.ts, the
// webhook in convex/http.ts) talk only to the `PaymentProvider` interface, so
// adding a rail is: write an adapter + register it here.
// ──────────────────────────────────────────────────────────────────────────

import type { PaymentProvider, ProviderName } from './paymentTypes';
import { fapshiProvider } from './fapshiClient';
import { stripeProvider } from './stripeProvider';

const PROVIDERS: Record<ProviderName, PaymentProvider> = {
  fapshi: fapshiProvider,
  stripe: stripeProvider,
};

/** Provider names that have a webhook route mounted (see convex/http.ts). */
export const PROVIDER_NAMES: ProviderName[] = ['fapshi', 'stripe'];

// A payment's provider is chosen from its job's market — see providerForCountry
// in convex/markets.ts — and stored on the leadUnlocks row.

export function getProvider(name: string): PaymentProvider {
  const provider = PROVIDERS[name as ProviderName];
  if (!provider) throw new Error(`Unknown payment provider: ${name}`);
  return provider;
}
