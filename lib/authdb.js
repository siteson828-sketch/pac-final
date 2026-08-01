import { neon } from '@neondatabase/serverless';

// Single-table user + tier storage for NextAuth. We use the JWT session strategy
// (required by the Credentials provider), but all durable state — accounts,
// password hashes, Google identities, and the subscription tier — lives here in
// Postgres. Authorization decisions (print-order gating, discount) re-read the
// tier from this table; the JWT only carries a hint. Stripe columns are present
// so the subscription webhook can update tier without a later migration.

export function db() {
  return neon(process.env.DATABASE_URL);
}

let ensured = false;
export async function ensureAuthTables(sql) {
  if (ensured) return;
  await sql`CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    password_hash TEXT,
    image TEXT,
    google_id TEXT UNIQUE,
    provider TEXT NOT NULL DEFAULT 'credentials',
    tier TEXT NOT NULL DEFAULT 'free',
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    subscription_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  ensured = true;
}

export async function getUserByEmail(sql, email) {
  const rows = await sql`SELECT * FROM users WHERE email = ${email}`;
  return rows[0] || null;
}

// Creates an email/password account (default 'free' tier).
export async function createUser(sql, { email, passwordHash, name }) {
  const rows = await sql`
    INSERT INTO users (email, password_hash, name, provider, tier)
    VALUES (${email}, ${passwordHash}, ${name}, 'credentials', 'free')
    RETURNING *`;
  return rows[0];
}

// Upserts a Google user by email. Existing email/password accounts get their
// google_id linked so both login methods resolve to one account + one tier.
export async function upsertGoogleUser(sql, { email, name, image, googleId }) {
  const rows = await sql`
    INSERT INTO users (email, name, image, google_id, provider, tier)
    VALUES (${email}, ${name}, ${image}, ${googleId}, 'google', 'free')
    ON CONFLICT (email) DO UPDATE SET
      name = COALESCE(users.name, EXCLUDED.name),
      image = COALESCE(EXCLUDED.image, users.image),
      google_id = COALESCE(users.google_id, EXCLUDED.google_id)
    RETURNING *`;
  return rows[0];
}

// Member order discount by tier — advertised on the pricing page, enforced on
// the charge (create-payment-intent) and recorded price (create-order).
export function tierDiscount(tier) {
  if (tier === 'trade') return 0.20;
  if (tier === 'collector') return 0.10;
  return 0;
}

export const PAID_TIERS = new Set(['collector', 'trade']);

// Authoritative tier read. A paid tier only counts while the subscription is
// active (or has no end date). Fails safe to 'free'.
export async function getTierForUser(sql, userId) {
  const id = parseInt(userId, 10);
  if (!Number.isFinite(id)) return 'free';
  const rows = await sql`SELECT tier, subscription_end FROM users WHERE id = ${id}`;
  if (!rows.length) return 'free';
  const u = rows[0];
  const active = !u.subscription_end || new Date(u.subscription_end) > new Date();
  return active ? (u.tier || 'free') : 'free';
}
