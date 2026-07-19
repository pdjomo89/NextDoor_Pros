// ──────────────────────────────────────────────────────────────────────────
// Stripe payment adapter (global cards + wallets, multi-currency).
//
// Implements the shared `PaymentProvider` interface using Stripe's REST API
// directly via `fetch` — no SDK, no "use node" — so it runs in the default
// Convex runtime alongside Fapshi. Webhook signatures are verified with the
// Web Crypto API (HMAC-SHA256), which Convex supports.
//
// Auth:    Bearer secret key (STRIPE_SECRET_KEY).
// Amounts: Stripe uses the currency's minor unit — the same convention we
//          store in — so amounts pass through unchanged.
// Docs:    https://stripe.com/docs/api/checkout/sessions
//
// Status:  Implemented but UNTESTED pending live keys. Wiring a market to
//          Stripe + configuring env vars + an end-to-end test is Phase 4 work.
// ──────────────────────────────────────────────────────────────────────────

import type {
  InitiatePayInput,
  InitiatePayResult,
  PaymentProvider,
  PaymentStatusResult,
  SettleStatus,
  WebhookResult,
} from './paymentTypes';

const STRIPE_API = 'https://api.stripe.com/v1';

function secretKey(): string {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('Missing STRIPE_SECRET_KEY.');
  return key;
}

async function stripeFetch(
  path: string,
  init: { method: 'GET' | 'POST'; body?: URLSearchParams },
): Promise<Record<string, unknown>> {
  const res = await fetch(`${STRIPE_API}${path}`, {
    method: init.method,
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      ...(init.body
        ? { 'Content-Type': 'application/x-www-form-urlencoded' }
        : {}),
    },
    body: init.body,
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(`Stripe ${path} failed (${res.status}): ${JSON.stringify(data)}`);
  }
  return data;
}

/**
 * Map a Checkout Session's state to our local settle status.
 * `status`: open | complete | expired · `payment_status`: paid | unpaid | no_payment_required
 */
function toLocalStatus(
  status: string | undefined,
  paymentStatus: string | undefined,
): SettleStatus {
  if (paymentStatus === 'paid' || paymentStatus === 'no_payment_required') {
    return 'successful';
  }
  if (status === 'expired') return 'expired';
  if (status === 'complete') return 'failed'; // completed but not paid
  return 'pending'; // still open
}

// ── webhook signature verification (Web Crypto) ──────────────────────────────

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Length-safe constant-time-ish comparison of two hex strings. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** Max age of a webhook we accept, in seconds (mirrors Stripe's default). */
const WEBHOOK_TOLERANCE_SECONDS = 300;

async function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
): Promise<boolean> {
  if (!header) return false;
  // Header form: "t=timestamp,v1=sig[,v1=sig2,...]"
  let timestamp = '';
  const v1: string[] = [];
  for (const part of header.split(',')) {
    const [k, val] = part.split('=');
    if (k === 't') timestamp = val;
    else if (k === 'v1' && val) v1.push(val);
  }
  if (!timestamp || v1.length === 0) return false;

  // Reject stale timestamps to blunt replay attacks.
  const age = Math.floor(Date.now() / 1000) - Number(timestamp);
  if (!Number.isFinite(age) || Math.abs(age) > WEBHOOK_TOLERANCE_SECONDS) {
    return false;
  }

  const expected = await hmacSha256Hex(secret, `${timestamp}.${payload}`);
  return v1.some((sig) => timingSafeEqual(sig, expected));
}

// ── adapter ──────────────────────────────────────────────────────────────────

export const stripeProvider: PaymentProvider = {
  name: 'stripe',

  async initiatePay(input: InitiatePayInput): Promise<InitiatePayResult> {
    const redirect = input.redirectUrl ?? '';
    const form = new URLSearchParams();
    form.set('mode', 'payment');
    form.set('success_url', redirect);
    form.set('cancel_url', redirect);
    form.set('line_items[0][quantity]', '1');
    form.set('line_items[0][price_data][currency]', input.currency.toLowerCase());
    form.set('line_items[0][price_data][unit_amount]', String(input.amount));
    form.set(
      'line_items[0][price_data][product_data][name]',
      input.message ?? 'Payment',
    );
    if (input.email) form.set('customer_email', input.email);
    if (input.externalId) {
      form.set('client_reference_id', input.externalId);
      form.set('metadata[externalId]', input.externalId);
    }
    if (input.userId) form.set('metadata[userId]', input.userId);

    const session = await stripeFetch('/checkout/sessions', {
      method: 'POST',
      body: form,
    });

    const id = session.id as string | undefined;
    const url = session.url as string | undefined;
    if (!id || !url) {
      throw new Error(`Stripe session missing id/url: ${JSON.stringify(session)}`);
    }
    return { link: url, transId: id };
  },

  async getStatus(transId: string): Promise<PaymentStatusResult> {
    const session = await stripeFetch(
      `/checkout/sessions/${encodeURIComponent(transId)}`,
      { method: 'GET' },
    );
    const metadata = (session.metadata as Record<string, string> | undefined) ?? {};
    return {
      transId,
      status: toLocalStatus(
        session.status as string | undefined,
        session.payment_status as string | undefined,
      ),
      amount:
        typeof session.amount_total === 'number' ? session.amount_total : undefined,
      externalId: metadata.externalId,
    };
  },

  async verifyWebhook(req: Request): Promise<WebhookResult> {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) return { ok: false, status: 500, message: 'Webhook secret not set' };

    // Signature is computed over the RAW body — read text, never parse first.
    const payload = await req.text();
    const ok = await verifyStripeSignature(
      payload,
      req.headers.get('stripe-signature'),
      secret,
    );
    if (!ok) return { ok: false, status: 401, message: 'Invalid signature' };

    let event: { data?: { object?: { id?: string } } };
    try {
      event = JSON.parse(payload);
    } catch {
      return { ok: false, status: 400, message: 'Bad Request' };
    }
    const sessionId = event?.data?.object?.id;
    if (!sessionId) return { ok: false, status: 400, message: 'Missing session id' };
    return { ok: true, transId: sessionId };
  },
};
