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
