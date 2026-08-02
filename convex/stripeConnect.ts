// ──────────────────────────────────────────────────────────────────────────
// Stripe Connect helpers (pro payouts).
//
// Pros receive job payouts through a Stripe Connect **Express** account: Stripe
// hosts the identity/bank onboarding, and the platform later transfers escrowed
// funds to the account (minus commission). Raw Stripe REST via `fetch`, no SDK,
// default Convex runtime.
//
// Requires Connect to be enabled on the platform's Stripe account (a dashboard
// step). Until then, account creation returns an error.
// ──────────────────────────────────────────────────────────────────────────

const STRIPE_API = 'https://api.stripe.com/v1';

function secretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('Missing STRIPE_SECRET_KEY.');
  return key;
}

async function stripeFetch(
  path: string,
  init: {
    method: 'GET' | 'POST';
    body?: URLSearchParams;
    /**
     * Stripe dedupes POSTs carrying the same key, returning the original
     * response instead of repeating the side effect. Stripe retains a key for
     * 24h, so this protects retries inside that window — long enough for the
     * escrow auto-release cron, which retries every 6h.
     */
    idempotencyKey?: string;
  },
): Promise<Record<string, unknown>> {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      ...(init.body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      ...(init.idempotencyKey ? { 'Idempotency-Key': init.idempotencyKey } : {}),
    },
    body: init.body,
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(`Stripe ${path} failed (${res.status}): ${JSON.stringify(data)}`);
  }
  return data;
}

// ── connected account ─────────────────────────────────────────────────────────

export type ConnectAccount = {
  id: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  country?: string;
};

function normalizeAccount(a: Record<string, unknown>): ConnectAccount {
  return {
    id: a.id as string,
    chargesEnabled: Boolean(a.charges_enabled),
    payoutsEnabled: Boolean(a.payouts_enabled),
    detailsSubmitted: Boolean(a.details_submitted),
    country: typeof a.country === 'string' ? a.country : undefined,
  };
}

/** Create an Express connected account able to receive transfers (payouts). */
export async function createExpressAccount(input: {
  country: string;
  email?: string;
  userId: string;
}): Promise<{ id: string }> {
  const form = new URLSearchParams();
  form.set('type', 'express');
  form.set('country', input.country.toUpperCase());
  if (input.email) form.set('email', input.email);
  // We only pay the pro out (destination transfers), so `transfers` is the only
  // capability we request; Stripe collects card payments on the platform account.
  form.set('capabilities[transfers][requested]', 'true');
  form.set('metadata[userId]', input.userId);

  const a = await stripeFetch('/accounts', { method: 'POST', body: form });
  const id = a.id as string | undefined;
  if (!id) throw new Error(`Stripe account missing id: ${JSON.stringify(a)}`);
  return { id };
}

/** A one-time hosted onboarding URL for the pro to complete their Express setup. */
export async function createAccountLink(
  accountId: string,
  refreshUrl: string,
  returnUrl: string,
): Promise<{ url: string }> {
  const form = new URLSearchParams();
  form.set('account', accountId);
  form.set('refresh_url', refreshUrl);
  form.set('return_url', returnUrl);
  form.set('type', 'account_onboarding');
  const l = await stripeFetch('/account_links', { method: 'POST', body: form });
  const url = l.url as string | undefined;
  if (!url) throw new Error(`Stripe account_link missing url: ${JSON.stringify(l)}`);
  return { url };
}

/** Authoritative capability status for a connected account. */
export async function retrieveConnectAccount(
  accountId: string,
): Promise<ConnectAccount> {
  const a = await stripeFetch(`/accounts/${encodeURIComponent(accountId)}`, {
    method: 'GET',
  });
  return normalizeAccount(a);
}

/**
 * Transfer escrowed funds from the platform balance to a connected account.
 *
 * Pass `idempotencyKey` (callers use the escrow id) so a retry after a partial
 * failure — transfer created, but the local status write lost — returns the
 * original transfer instead of paying the pro twice.
 */
export async function createTransfer(input: {
  amountMinor: number;
  currency: string;
  destination: string;
  sourceTransaction?: string; // the charge to draw from, when set
  metadata?: Record<string, string>;
  idempotencyKey?: string;
}): Promise<{ id: string }> {
  const form = new URLSearchParams();
  form.set('amount', String(input.amountMinor));
  form.set('currency', input.currency.toLowerCase());
  form.set('destination', input.destination);
  if (input.sourceTransaction) {
    form.set('source_transaction', input.sourceTransaction);
  }
  for (const [k, val] of Object.entries(input.metadata ?? {})) {
    form.set(`metadata[${k}]`, val);
  }
  const t = await stripeFetch('/transfers', {
    method: 'POST',
    body: form,
    idempotencyKey: input.idempotencyKey,
  });
  const id = t.id as string | undefined;
  if (!id) throw new Error(`Stripe transfer missing id: ${JSON.stringify(t)}`);
  return { id };
}
