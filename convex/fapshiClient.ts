// ──────────────────────────────────────────────────────────────────────────
// Fapshi payment adapter (Cameroon — MTN MoMo / Orange Money, collect-only).
//
// Implements the shared `PaymentProvider` interface (convex/paymentTypes.ts).
// Pure helpers (NOT registered Convex functions) so the payment action
// (convex/jobFees.ts) and the HTTP webhook (convex/http.ts) can share them via
// the provider registry. Uses the global `fetch`, available in the default
// Convex runtime — no "use node" required.
//
// Base URLs:  sandbox → https://sandbox.fapshi.com   live → https://live.fapshi.com
// Auth:       `apiuser` + `apikey` request headers.
// Currency:   XAF only (Fapshi has no currency parameter).
// Docs:       https://docs.fapshi.com/en
// ──────────────────────────────────────────────────────────────────────────

import type {
  InitiatePayInput,
  InitiatePayResult,
  PaymentProvider,
  PaymentStatusResult,
  SettleStatus,
  WebhookResult,
} from './paymentTypes';

type FapshiConfig = { baseUrl: string; apiuser: string; apikey: string };

function config(): FapshiConfig {
  const baseUrl = process.env.FAPSHI_BASE_URL; // e.g. https://sandbox.fapshi.com
  const apiuser = process.env.FAPSHI_API_USER;
  const apikey = process.env.FAPSHI_API_KEY;
  if (!baseUrl || !apiuser || !apikey) {
    throw new Error(
      'Missing Fapshi env vars: set FAPSHI_BASE_URL, FAPSHI_API_USER, FAPSHI_API_KEY.',
    );
  }
  return { baseUrl: baseUrl.replace(/\/$/, ''), apiuser, apikey };
}

// ── low-level REST calls (Fapshi-shaped) ─────────────────────────────────────

type FapshiInitiateBody = {
  amount: number; // whole XAF, integer >= 100
  email?: string;
  redirectUrl?: string;
  userId?: string;
  externalId?: string;
  message?: string;
};

type FapshiInitiateResult = {
  message: string;
  link: string;
  transId: string;
  dateInitiated: string;
};

type FapshiStatus = 'CREATED' | 'PENDING' | 'SUCCESSFUL' | 'FAILED' | 'EXPIRED';

type FapshiStatusResult = {
  transId: string;
  status: FapshiStatus;
  amount: number;
  externalId?: string;
  userId?: string;
};

async function fapshiInitiate(
  body: FapshiInitiateBody,
): Promise<FapshiInitiateResult> {
  const { baseUrl, apiuser, apikey } = config();
  const res = await fetch(`${baseUrl}/initiate-pay`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apiuser, apikey },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `Fapshi initiate-pay failed (${res.status}): ${JSON.stringify(data)}`,
    );
  }
  return data as FapshiInitiateResult;
}

async function fapshiStatus(transId: string): Promise<FapshiStatusResult> {
  const { baseUrl, apiuser, apikey } = config();
  const res = await fetch(
    `${baseUrl}/payment-status/${encodeURIComponent(transId)}`,
    { method: 'GET', headers: { apiuser, apikey } },
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      `Fapshi payment-status failed (${res.status}): ${JSON.stringify(data)}`,
    );
  }
  return data as FapshiStatusResult;
}

/** Map Fapshi's UPPERCASE status onto the lowercase status we persist. */
function toLocalStatus(s: FapshiStatus | string): SettleStatus {
  switch (s) {
    case 'SUCCESSFUL':
      return 'successful';
    case 'FAILED':
      return 'failed';
    case 'EXPIRED':
      return 'expired';
    case 'PENDING':
      return 'pending';
    default:
      return 'pending'; // CREATED / anything unexpected → treat as in-flight
  }
}

// ── adapter ──────────────────────────────────────────────────────────────────

export const fapshiProvider: PaymentProvider = {
  name: 'fapshi',

  async initiatePay(input: InitiatePayInput): Promise<InitiatePayResult> {
    // Fapshi is XAF-only, whose minor-unit exponent is 0, so `amount` (minor
    // units) already equals whole francs. Guard against a mis-routed currency.
    if (input.currency !== 'XAF') {
      throw new Error(`Fapshi only supports XAF, got ${input.currency}.`);
    }
    const result = await fapshiInitiate({
      amount: input.amount,
      email: input.email,
      userId: input.userId,
      externalId: input.externalId,
      redirectUrl: input.redirectUrl,
      message: input.message,
    });
    return { link: result.link, transId: result.transId };
  },

  async getStatus(transId: string): Promise<PaymentStatusResult> {
    const remote = await fapshiStatus(transId);
    return {
      transId: remote.transId,
      status: toLocalStatus(remote.status),
      amount: remote.amount,
      externalId: remote.externalId,
    };
  },

  async verifyWebhook(req: Request): Promise<WebhookResult> {
    // Fapshi POSTs the transaction object with the configured secret in the
    // `x-wh-secret` header. We authenticate on the header, then only trust the
    // transId — the caller re-verifies status via getStatus.
    const expected = process.env.FAPSHI_WEBHOOK_SECRET;
    if (!expected || req.headers.get('x-wh-secret') !== expected) {
      return { ok: false, status: 401, message: 'Unauthorized' };
    }
    let body: { transId?: string };
    try {
      body = await req.json();
    } catch {
      return { ok: false, status: 400, message: 'Bad Request' };
    }
    if (!body?.transId) {
      return { ok: false, status: 400, message: 'Missing transId' };
    }
    return { ok: true, transId: body.transId };
  },
};
