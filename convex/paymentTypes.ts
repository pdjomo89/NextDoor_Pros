// ──────────────────────────────────────────────────────────────────────────
// Payment-provider abstraction — shared types.
//
// One interface every payment rail implements, so the app collects fees the
// same way regardless of country. Fapshi (Cameroon mobile money) and Stripe
// (global cards) are the first two adapters; a market picks its provider.
//
// Types live in their own module (no imports of adapters or the registry) so
// adapters and the registry can both depend on it without an import cycle.
// ──────────────────────────────────────────────────────────────────────────

export type ProviderName = 'fapshi' | 'stripe';

/** Status we persist on a `leadUnlocks` row. */
export type LocalPaymentStatus =
  | 'created' // local-only: row exists, no provider transaction yet
  | 'pending'
  | 'successful'
  | 'failed'
  | 'expired';

/** Statuses a provider can settle to ('created' only exists before a txn id). */
export type SettleStatus = Exclude<LocalPaymentStatus, 'created'>;

export type InitiatePayInput = {
  /** Integer amount in the MINOR UNIT of `currency` (XAF→francs, USD→cents). */
  amount: number;
  /** ISO 4217 currency code, uppercase (e.g. 'XAF', 'USD'). */
  currency: string;
  email?: string;
  /** Where the payer is returned after checkout. */
  redirectUrl?: string;
  /** Our user id, for the provider's records. */
  userId?: string;
  /** Idempotency key we control (= jobId). 1-100 chars, [a-zA-Z0-9-_]. */
  externalId?: string;
  message?: string;
};

export type InitiatePayResult = {
  /** Hosted-checkout URL to redirect the payer to. */
  link: string;
  /** Provider transaction/session id we store and later re-verify against. */
  transId: string;
};

export type PaymentStatusResult = {
  transId: string;
  /** Already mapped to our local settle status — callers don't see provider enums. */
  status: SettleStatus;
  /** Amount in minor units, when the provider reports it. */
  amount?: number;
  externalId?: string;
};

/** Outcome of authenticating + parsing an inbound provider webhook. */
export type WebhookResult =
  | { ok: true; transId: string }
  | { ok: false; status: number; message: string };

/**
 * Contract implemented by every payment rail. Amounts are always minor units +
 * an explicit currency; statuses returned are already mapped to `SettleStatus`.
 */
export interface PaymentProvider {
  readonly name: ProviderName;
  /** Create a hosted-checkout payment; return its link + transaction id. */
  initiatePay(input: InitiatePayInput): Promise<InitiatePayResult>;
  /** Fetch the authoritative status for a transaction (never trust webhooks). */
  getStatus(transId: string): Promise<PaymentStatusResult>;
  /**
   * Authenticate an inbound webhook request and extract its transaction id.
   * Reads the request body itself (raw text may be needed for signatures), so
   * callers must not have consumed it. Never trusts the body's status — callers
   * re-verify via `getStatus`.
   */
  verifyWebhook(req: Request): Promise<WebhookResult>;
}
