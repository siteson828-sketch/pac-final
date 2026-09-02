// Giving fund: 35% of every membership fee is set aside to support arts
// education for children in Asheville and Buncombe County, NC. This module owns
// the giving_fund ledger (schema + idempotent recording + aggregates) and the
// tier→amount math.
//
// Wording is deliberately "set aside" (funds reserved; partnerships with local
// schools/arts orgs are being built) — NOT "donated". The `transferred` flag
// tracks manual payouts once a delivery mechanism exists.
import { db } from './authdb';

export const GIVING_RATE = 0.35;

// Monthly membership price per tier (USD). Mirrors pricing.js and the Stripe
// prices; giving is 35% of this.
export const TIER_PRICE = { explorer: 9.99, collector: 19.99, patron: 49.99 };

export function givingForTier(tier) {
  const membership = TIER_PRICE[tier] || 0;
  const giving = Math.round(membership * GIVING_RATE * 100) / 100;
  return { membership, giving };
}

export async function ensureGivingTable(sql) {
  await sql`CREATE TABLE IF NOT EXISTS giving_fund (
    id SERIAL PRIMARY KEY,
    month DATE NOT NULL,
    subscriber_email TEXT,
    subscriber_name TEXT,
    tier TEXT,
    membership_amount NUMERIC,
    giving_amount NUMERIC,
    subscriber_city TEXT,
    subscriber_state TEXT,
    subscriber_country TEXT,
    stripe_subscription_id TEXT,
    dedupe_key TEXT,
    transferred BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
  )`;
  // Idempotency: one row per payment. dedupe_key = subscription id for the
  // signup charge, invoice id for renewals. Unique so retried Stripe webhook
  // deliveries can't double-count the fund.
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS giving_fund_dedupe ON giving_fund(dedupe_key)`;
}

// Idempotent insert. Returns true if a new row was recorded, false if the
// dedupe_key already existed or the tier has no giving amount.
export async function recordGiving(sql, {
  tier, subscriberEmail, subscriberName,
  city, state, country, stripeSubscriptionId, dedupeKey,
}) {
  if (!dedupeKey) return false;
  const { membership, giving } = givingForTier(tier);
  if (!giving) return false; // unknown/free tier — nothing to set aside
  const rows = await sql`
    INSERT INTO giving_fund
      (month, subscriber_email, subscriber_name, tier, membership_amount, giving_amount,
       subscriber_city, subscriber_state, subscriber_country, stripe_subscription_id, dedupe_key)
    VALUES
      (date_trunc('month', now())::date, ${subscriberEmail || null}, ${subscriberName || null},
       ${tier}, ${membership}, ${giving}, ${city || null}, ${state || null}, ${country || null},
       ${stripeSubscriptionId || null}, ${dedupeKey})
    ON CONFLICT (dedupe_key) DO NOTHING
    RETURNING id`;
  return rows.length > 0;
}

// Full admin aggregates for /api/giving-report and the admin GIVING tab.
export async function givingAggregates(sql) {
  const [totals] = await sql`
    SELECT
      COALESCE(SUM(giving_amount) FILTER (WHERE month = date_trunc('month', now())::date), 0) AS this_month,
      COALESCE(SUM(giving_amount), 0) AS all_time,
      COUNT(DISTINCT subscriber_email) AS subscribers,
      COALESCE(SUM(giving_amount) FILTER (WHERE transferred = false), 0) AS pending_total
    FROM giving_fund`;
  const byTier = await sql`
    SELECT tier, COUNT(*) AS count, COALESCE(SUM(giving_amount), 0) AS giving
    FROM giving_fund GROUP BY tier ORDER BY giving DESC`;
  const byState = await sql`
    SELECT COALESCE(subscriber_state, '—') AS state, COALESCE(subscriber_country, '—') AS country,
           COUNT(*) AS count, COALESCE(SUM(giving_amount), 0) AS giving
    FROM giving_fund GROUP BY subscriber_state, subscriber_country ORDER BY giving DESC LIMIT 60`;
  const pending = await sql`
    SELECT id, month, subscriber_email, subscriber_name, tier, giving_amount,
           subscriber_state, subscriber_country, created_at
    FROM giving_fund WHERE transferred = false ORDER BY created_at DESC LIMIT 500`;
  return {
    this_month: Number(totals.this_month),
    all_time: Number(totals.all_time),
    subscribers: Number(totals.subscribers),
    pending_total: Number(totals.pending_total),
    by_tier: byTier.map(r => ({ tier: r.tier, count: Number(r.count), giving: Number(r.giving) })),
    by_state: byState.map(r => ({ state: r.state, country: r.country, count: Number(r.count), giving: Number(r.giving) })),
    pending: pending.map(r => ({ ...r, giving_amount: Number(r.giving_amount) })),
  };
}

// Public, PII-free aggregate for the pricing page ("X members have set aside $Y").
export async function publicGivingTotal(sql) {
  const [row] = await sql`
    SELECT COUNT(DISTINCT subscriber_email) AS members, COALESCE(SUM(giving_amount), 0) AS total
    FROM giving_fund`;
  return { members: Number(row.members), total: Number(row.total) };
}

// Mark rows transferred (admin "I sent the money" button). ids optional; when
// omitted, marks every pending row.
export async function markTransferred(sql, ids) {
  if (Array.isArray(ids) && ids.length) {
    await sql`UPDATE giving_fund SET transferred = true WHERE id = ANY(${ids})`;
  } else {
    await sql`UPDATE giving_fund SET transferred = true WHERE transferred = false`;
  }
}

// ─── Location-personalized copy for the subscription success page ───────────
// Geo comes from Vercel IP headers (x-vercel-ip-country / -country-region).
const US_STATES = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'Washington, D.C.',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois',
  IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
  ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota',
  MS: 'Mississippi', MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada',
  NH: 'New Hampshire', NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York',
  NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon',
  PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota',
  TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia',
  WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
};

function countryName(code) {
  try { return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) || code; }
  catch (e) { return code; }
}

export function givingLocationMessage({ country, region } = {}) {
  if (country === 'US' && region === 'NC') {
    return 'Your membership supports arts education for children right here in North Carolina — starting with Asheville and Buncombe County schools.';
  }
  if (country === 'US') {
    const state = US_STATES[region] || 'your state';
    return `Your membership in ${state} supports arts education for children in Asheville & Buncombe County, NC — giving kids across America access to the world's greatest art.`;
  }
  if (country) {
    return `Your membership from ${countryName(country)} helps bring arts education to children in Asheville, NC — one of America's most vibrant art communities.`;
  }
  return 'Your membership helps bring arts education to children in Asheville & Buncombe County, NC.';
}

// Shared db handle re-export so pages/api can import from one place if desired.
export { db };
