// ──────────────────────────────────────────────────────────────────────────
// Stripe escrow helpers (platform-collected job payments).
//
// Uses "separate charges & transfers": the employer's payment is charged to the
// PLATFORM account (no destination), so the funds sit on the platform balance
// (escrow). When the job is confirmed done, convex/jobEscrow.ts issues a Transfer
// (see stripeConnect.createTransfer) to the pro's connected account, minus the
// platform commission. Refunds go against the original PaymentIntent.
//
// Raw Stripe REST via `fetch`, no SDK, default Convex runtime.
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

/**
 * Hosted Checkout for a one-time job payment charged to the platform (held).
 * `escrowId` is carried on both the session and the PaymentIntent so the webhook
 * can attribute the completed payment.
 */
export async function createEscrowCheckout(input: {
  amountMinor: number;
  currency: string;
  productName: string;
  email?: string;
  escrowId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<{ url: string; sessionId: string }> {
  const form = new URLSearchParams();
  form.set('mode', 'payment');
  form.set('success_url', input.successUrl);
  form.set('cancel_url', input.cancelUrl);
  form.set('line_items[0][quantity]', '1');
  form.set('line_items[0][price_data][currency]', input.currency.toLowerCase());
  form.set('line_items[0][price_data][unit_amount]', String(input.amountMinor));
  form.set('line_items[0][price_data][product_data][name]', input.productName);
  if (input.email) form.set('customer_email', input.email);
  form.set('client_reference_id', input.escrowId);
  form.set('metadata[escrowId]', input.escrowId);
  form.set('payment_intent_data[metadata][escrowId]', input.escrowId);

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

export type EscrowSession = {
  escrowId?: string;
  paid: boolean;
  paymentIntentId?: string;
};

/** Authoritative state for an escrow Checkout Session (never trust the webhook body). */
export async function retrieveEscrowSession(
  sessionId: string,
): Promise<EscrowSession> {
  const s = await stripeFetch(
    `/checkout/sessions/${encodeURIComponent(sessionId)}`,
    { method: 'GET' },
  );
  const metadata = (s.metadata as Record<string, string> | undefined) ?? {};
  return {
    escrowId: metadata.escrowId,
    paid: s.payment_status === 'paid',
    paymentIntentId:
      typeof s.payment_intent === 'string' ? s.payment_intent : undefined,
  };
}

/**
 * The charge id backing a PaymentIntent — used as a transfer's `source_transaction`
 * so the payout can draw from the specific escrowed charge even before the
 * platform balance settles.
 */
export async function retrieveLatestCharge(
  paymentIntentId: string,
): Promise<string | null> {
  const pi = await stripeFetch(
    `/payment_intents/${encodeURIComponent(paymentIntentId)}`,
    { method: 'GET' },
  );
  return typeof pi.latest_charge === 'string' ? pi.latest_charge : null;
}

/** Refund an escrowed charge (full when `amountMinor` omitted). */
export async function refundPaymentIntent(
  paymentIntentId: string,
  amountMinor?: number,
): Promise<{ id: string }> {
  const form = new URLSearchParams();
  form.set('payment_intent', paymentIntentId);
  if (amountMinor !== undefined) form.set('amount', String(amountMinor));
  const r = await stripeFetch('/refunds', { method: 'POST', body: form });
  const id = r.id as string | undefined;
  if (!id) throw new Error(`Stripe refund missing id: ${JSON.stringify(r)}`);
  return { id };
}
