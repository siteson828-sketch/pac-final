import crypto from 'crypto';

// Short-lived HMAC token minted by /api/order-token and required by
// /api/create-order. It proves the order request came from a client that first
// loaded our token endpoint (i.e. a real browser session running our checkout)
// rather than a blind script POSTing straight at the order API.
//
// Signed with ORDER_TOKEN_SECRET. When that env var is unset the helpers report
// `not_configured` so callers can fail open — matching the rest of the app's
// no-op-when-unconfigured convention, and avoiding a checkout outage before the
// secret is provisioned in Vercel. SET ORDER_TOKEN_SECRET in production for the
// protection to actually engage.
const TTL_SECONDS = 2 * 60 * 60; // 2 hours

function secret() {
  return process.env.ORDER_TOKEN_SECRET || '';
}

export function hasTokenSecret() {
  return !!secret();
}

export function signToken() {
  const iat = Math.floor(Date.now() / 1000);
  const nonce = crypto.randomBytes(9).toString('base64url');
  const payload = `${iat}.${nonce}`;
  const sig = crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyToken(token) {
  if (!secret()) return { valid: false, reason: 'not_configured' };
  if (!token || typeof token !== 'string') return { valid: false, reason: 'missing' };
  const parts = token.split('.');
  if (parts.length !== 3) return { valid: false, reason: 'malformed' };
  const [iat, nonce, sig] = parts;
  const expected = crypto.createHmac('sha256', secret()).update(`${iat}.${nonce}`).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { valid: false, reason: 'bad_signature' };
  const age = Math.floor(Date.now() / 1000) - parseInt(iat, 10);
  if (!Number.isFinite(age) || age < 0 || age > TTL_SECONDS) return { valid: false, reason: 'expired' };
  return { valid: true };
}
