import { getAuth } from '@clerk/nextjs/server';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';

// Returns the caller's subscription tier. Signed-out users are 'free'. The tier
// is the source of truth for gating print-ordering (see create-order) and the
// order discount; it's updated by the Stripe subscription webhook.
let ensured = false;
async function ensureTable(sql) {
  if (ensured) return;
  await sql`CREATE TABLE IF NOT EXISTS user_subscriptions (
    id SERIAL PRIMARY KEY,
    clerk_user_id TEXT UNIQUE NOT NULL,
    tier TEXT NOT NULL DEFAULT 'free',
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    subscription_start TIMESTAMPTZ,
    subscription_end TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  ensured = true;
}

export default async function handler(req, res) {
  let userId = null;
  try { ({ userId } = getAuth(req)); } catch (e) {}
  if (!userId) return res.status(200).json({ tier: 'free', authenticated: false });

  try {
    const sql = neon(process.env.DATABASE_URL);
    await ensureTable(sql);
    let rows = await sql`SELECT tier, subscription_end FROM user_subscriptions WHERE clerk_user_id = ${userId}`;
    if (rows.length === 0) {
      await sql`INSERT INTO user_subscriptions (clerk_user_id, tier) VALUES (${userId}, 'free')
                ON CONFLICT (clerk_user_id) DO NOTHING`;
      return res.status(200).json({ tier: 'free', authenticated: true, userId });
    }
    const sub = rows[0];
    // A paid tier only counts while the subscription is active (or has no end date).
    const active = !sub.subscription_end || new Date(sub.subscription_end) > new Date();
    const tier = active ? sub.tier : 'free';
    return res.status(200).json({ tier, authenticated: true, userId, subscriptionEnd: sub.subscription_end });
  } catch (e) {
    console.error('user-tier error:', e.message);
    // Fail safe: never grant a paid tier on error.
    return res.status(200).json({ tier: 'free', authenticated: true, userId, error: true });
  }
}
