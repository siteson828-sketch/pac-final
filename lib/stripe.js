// Minimal Stripe client (REST API, no SDK). Same convention as lib/printful.js:
// raw fetch + env-var auth (Basic auth with the secret key as username), and a
// clear error when unconfigured so callers can no-op gracefully.
//
// Env vars:
//   STRIPE_SECRET_KEY                  — server-side secret ("sk_…")
//   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY — client-side publishable ("pk_…")
const STRIPE_BASE = 'https://api.stripe.com/v1';

export function hasStripe() {
  return !!process.env.STRIPE_SECRET_KEY;
}

function authHeader() {
  const key = process.env.STRIPE_SECRET_KEY;
  return `Basic ${Buffer.from(`${key}:`).toString('base64')}`;
}

async function stripeFetch(path, { method = 'GET', form } = {}) {
  if (!hasStripe()) throw new Error('STRIPE_SECRET_KEY not configured');
  const res = await fetch(`${STRIPE_BASE}${path}`, {
    method,
    headers: {
      Authorization: authHeader(),
      ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
    },
    body: form ? new URLSearchParams(form).toString() : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) {
    throw new Error(data?.error?.message || `Stripe HTTP ${res.status}`);
  }
  return data;
}

// Create a PaymentIntent. amountCents is an integer (e.g. 1800 = $18.00).
// When receiptEmail is set, Stripe emails the customer a receipt on a
// successful charge (requires "Email customers for successful payments" enabled
// in the Stripe Dashboard; test mode does not send real emails).
export async function createPaymentIntent({ amountCents, currency = 'usd', metadata = {}, receiptEmail } = {}) {
  const form = {
    amount: String(Math.max(50, Math.round(amountCents || 0))), // Stripe min ~$0.50
    currency,
    'automatic_payment_methods[enabled]': 'true',
  };
  if (receiptEmail) form.receipt_email = String(receiptEmail).slice(0, 254);
  for (const [k, v] of Object.entries(metadata)) {
    if (v != null) form[`metadata[${k}]`] = String(v).slice(0, 500);
  }
  return stripeFetch('/payment_intents', { method: 'POST', form });
}

export async function retrievePaymentIntent(id) {
  return stripeFetch(`/payment_intents/${encodeURIComponent(id)}`);
}

// ─── Subscriptions ────────────────────────────────────────────────────────

// Subscription price IDs are configured via env once created (see
// /api/setup-subscription-prices). Ordering/tier upgrades no-op until set.
export const SUBSCRIPTION_PRICES = {
  collector: () => process.env.STRIPE_PRICE_COLLECTOR,
  trade: () => process.env.STRIPE_PRICE_TRADE,
};

export function hasSubscriptionPrices() {
  return !!(process.env.STRIPE_PRICE_COLLECTOR && process.env.STRIPE_PRICE_TRADE);
}

// Create a hosted Checkout Session in subscription mode. Returns { id, url }.
export async function createCheckoutSession({ priceId, customerEmail, clientReferenceId, successUrl, cancelUrl, metadata = {} }) {
  const form = {
    mode: 'subscription',
    'line_items[0][price]': priceId,
    'line_items[0][quantity]': '1',
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: 'true',
  };
  if (customerEmail) form.customer_email = customerEmail;
  if (clientReferenceId) form.client_reference_id = String(clientReferenceId);
  for (const [k, v] of Object.entries(metadata)) {
    if (v != null) {
      form[`metadata[${k}]`] = String(v);
      form[`subscription_data[metadata][${k}]`] = String(v);
    }
  }
  return stripeFetch('/checkout/sessions', { method: 'POST', form });
}

export async function retrieveSubscription(id) {
  return stripeFetch(`/subscriptions/${encodeURIComponent(id)}`);
}

// ─── One-time programmatic setup (products, prices, webhook) ────────────────

export async function createProduct({ name, description }) {
  const form = { name };
  if (description) form.description = description;
  return stripeFetch('/products', { method: 'POST', form });
}

// unitAmount in cents; monthly recurring by default.
export async function createPrice({ productId, unitAmount, currency = 'usd', interval = 'month' }) {
  return stripeFetch('/prices', {
    method: 'POST',
    form: {
      product: productId,
      unit_amount: String(unitAmount),
      currency,
      'recurring[interval]': interval,
    },
  });
}

export async function createWebhookEndpoint({ url, events }) {
  const form = { url };
  events.forEach((e, i) => { form[`enabled_events[${i}]`] = e; });
  return stripeFetch('/webhook_endpoints', { method: 'POST', form });
}

// ─── Webhook signature verification (no SDK) ────────────────────────────────
// Verifies the Stripe-Signature header against the raw request body using the
// webhook signing secret (whsec_…). Returns the parsed event, or throws.
import crypto from 'crypto';
export function constructWebhookEvent(rawBody, sigHeader, secret, toleranceSec = 300) {
  if (!secret) throw new Error('STRIPE_WEBHOOK_SECRET not configured');
  if (!sigHeader) throw new Error('Missing Stripe-Signature header');
  const parts = Object.fromEntries(
    String(sigHeader).split(',').map(kv => kv.split('=').map(s => s.trim()))
  );
  const t = parts.t;
  const v1 = parts.v1;
  if (!t || !v1) throw new Error('Malformed Stripe-Signature header');
  const payload = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf8');
  const expected = crypto.createHmac('sha256', secret).update(`${t}.${payload}`, 'utf8').digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error('Signature verification failed');
  }
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(t)) > toleranceSec) {
    throw new Error('Timestamp outside tolerance');
  }
  return JSON.parse(payload);
}
