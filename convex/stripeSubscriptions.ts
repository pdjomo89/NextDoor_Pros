// ──────────────────────────────────────────────────────────────────────────
// Stripe subscription helpers (Canada memberships).
//
// One-time payments use stripeProvider.ts; this module handles the recurring
// subscription lifecycle: create a subscription Checkout Session, verify + parse
// webhooks, retrieve a subscription's authoritative state, and open the billing
// portal. Raw Stripe REST via `fetch`, no SDK, default Convex runtime; webhook
// signatures verified with the Web Crypto API (same scheme as stripeProvider).
//
// Prices are created inline (`price_data` with a `recurring` interval) so no
// Stripe Product/Price objects need pre-provisioning — the amount/interval come
// from the market's membership config (convex/markets.ts).
// ──────────────────────────────────────────────────────────────────────────

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
      ...(init.body ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: init.body,
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(`Stripe ${path} failed (${res.status}): ${JSON.stringify(data)}`);
  }
  return data;
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

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

const WEBHOOK_TOLERANCE_SECONDS = 300;

async function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
): Promise<boolean> {
  if (!header) return false;
  let timestamp = '';
  const v1: string[] = [];
  for (const part of header.split(',')) {
    const [k, val] = part.split('=');
    if (k === 't') timestamp = val;
    else if (k === 'v1' && val) v1.push(val);
  }
  if (!timestamp || v1.length === 0) return false;

  const age = Math.floor(Date.now() / 1000) - Number(timestamp);
  if (!Number.isFinite(age) || Math.abs(age) > WEBHOOK_TOLERANCE_SECONDS) {
    return false;
  }
  const expected = await hmacSha256Hex(secret, `${timestamp}.${payload}`);
  return v1.some((sig) => timingSafeEqual(sig, expected));
}

// ── subscription checkout ─────────────────────────────────────────────────────

export type SubscriptionInterval = 'month' | 'year';

export async function createSubscriptionCheckout(input: {
  /** Integer amount in the currency's minor unit. */
  amountMinor: number;
  /** ISO 4217 currency code (any case). */
  currency: string;
  interval: SubscriptionInterval;
  productName: string;
  email?: string;
  userId: string;
  role: string;
  country: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string; sessionId: string }> {
  const form = new URLSearchParams();
  form.set('mode', 'subscription');
  form.set('success_url', input.successUrl);
  form.set('cancel_url', input.cancelUrl);
  form.set('line_items[0][quantity]', '1');
  form.set('line_items[0][price_data][currency]', input.currency.toLowerCase());
  form.set('line_items[0][price_data][unit_amount]', String(input.amountMinor));
  form.set('line_items[0][price_data][recurring][interval]', input.interval);
  form.set('line_items[0][price_data][product_data][name]', input.productName);
  if (input.email) form.set('customer_email', input.email);
  form.set('client_reference_id', input.userId);
  // Carry identity on the session AND the resulting subscription, so the webhook
  // can attribute lifecycle events to the right user/role without extra lookups.
  for (const [k, val] of Object.entries({
    userId: input.userId,
    role: input.role,
    country: input.country,
  })) {
    form.set(`metadata[${k}]`, val);
    form.set(`subscription_data[metadata][${k}]`, val);
  }

  const session = await stripeFetch('/checkout/sessions', {
    method: 'POST',
    body: form,
  });
  const url = session.url as string | undefined;
  const id = session.id as string | undefined;
  if (!url || !id) {
    throw new Error(`Stripe session missing url/id: ${JSON.stringify(session)}`);
  }
  return { url, sessionId: id };
}

// ── retrieve authoritative subscription state ────────────────────────────────

export type StripeSubscription = {
  id: string;
  /** Raw Stripe status: active | trialing | past_due | canceled | unpaid | incomplete | ... */
  status: string;
  customerId?: string;
  currentPeriodStart?: number; // ms
  currentPeriodEnd?: number; // ms
  cancelAtPeriodEnd: boolean;
  interval?: SubscriptionInterval;
  metadata: Record<string, string>;
};

function normalizeSubscription(s: Record<string, unknown>): StripeSubscription {
  const items = (s.items as { data?: unknown[] } | undefined)?.data;
  const firstItem = items?.[0] as
    | { price?: { recurring?: { interval?: string } } }
    | undefined;
  const rawInterval = firstItem?.price?.recurring?.interval;
  const interval =
    rawInterval === 'month' || rawInterval === 'year' ? rawInterval : undefined;
  const secToMs = (n: unknown) =>
    typeof n === 'number' ? n * 1000 : undefined;
  return {
    id: s.id as string,
    status: String(s.status ?? ''),
    customerId: typeof s.customer === 'string' ? s.customer : undefined,
    currentPeriodStart: secToMs(s.current_period_start),
    currentPeriodEnd: secToMs(s.current_period_end),
    cancelAtPeriodEnd: Boolean(s.cancel_at_period_end),
    interval,
    metadata: (s.metadata as Record<string, string> | undefined) ?? {},
  };
}

export async function retrieveSubscription(
  id: string,
): Promise<StripeSubscription> {
  const s = await stripeFetch(`/subscriptions/${encodeURIComponent(id)}`, {
    method: 'GET',
  });
  return normalizeSubscription(s);
}

// ── billing portal (manage / cancel) ─────────────────────────────────────────

export async function createPortalSession(
  customerId: string,
  returnUrl: string,
): Promise<{ url: string }> {
  const form = new URLSearchParams();
  form.set('customer', customerId);
  form.set('return_url', returnUrl);
  const s = await stripeFetch('/billing_portal/sessions', {
    method: 'POST',
    body: form,
  });
  const url = s.url as string | undefined;
  if (!url) throw new Error('Stripe portal session missing url');
  return { url };
}

// ── webhook parse ─────────────────────────────────────────────────────────────

/**
 * Result of authenticating a Stripe webhook and extracting the subscription it
 * concerns. We only ever trust the subscription id — the caller re-fetches the
 * authoritative state via retrieveSubscription before persisting anything.
 */
export type StripeWebhookParse =
  | { ok: true; subscriptionId: string | null }
  | { ok: false; status: number; message: string };

export async function parseStripeWebhook(
  req: Request,
): Promise<StripeWebhookParse> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return { ok: false, status: 500, message: 'Webhook secret not set' };

  const payload = await req.text(); // signature is over the RAW body
  const valid = await verifyStripeSignature(
    payload,
    req.headers.get('stripe-signature'),
    secret,
  );
  if (!valid) return { ok: false, status: 401, message: 'Invalid signature' };

  let evt: { type?: string; data?: { object?: Record<string, unknown> } };
  try {
    evt = JSON.parse(payload);
  } catch {
    return { ok: false, status: 400, message: 'Bad Request' };
  }

  const type = evt.type;
  const obj = evt.data?.object ?? {};
  let subscriptionId: string | null = null;

  if (type === 'checkout.session.completed') {
    if (obj.mode === 'subscription' && typeof obj.subscription === 'string') {
      subscriptionId = obj.subscription;
    }
  } else if (typeof type === 'string' && type.startsWith('customer.subscription.')) {
    if (typeof obj.id === 'string') subscriptionId = obj.id;
  } else if (type === 'invoice.paid' || type === 'invoice.payment_failed') {
    if (typeof obj.subscription === 'string') subscriptionId = obj.subscription;
  }

  // subscriptionId null = an event we don't act on; caller returns 200 anyway.
  return { ok: true, subscriptionId };
}
