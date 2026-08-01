import { neon } from '@neondatabase/serverless';

// Local, bounded CRM/analytics storage that powers the admin dashboard.
// Two tables, both storage-safe for the near-full Neon DB:
//   daily_visits — ONE row per day (pageviews + first-visit uniques counters)
//   crm_events   — append log, but ONLY for IDENTIFIED events (email/phone
//                  present), so anonymous pageviews never create rows.
// This runs alongside the external CRM push (Bloo/GHL); it's our own queryable
// copy so the dashboard reflects real data instead of an empty external system.
export function crmDb() {
  return neon(process.env.DATABASE_URL);
}

let ensured = false;
export async function ensureCrmTables(sql) {
  if (ensured) return;
  await sql`CREATE TABLE IF NOT EXISTS daily_visits (
    day DATE PRIMARY KEY,
    pageviews INTEGER NOT NULL DEFAULT 0,
    uniques INTEGER NOT NULL DEFAULT 0
  )`;
  await sql`CREATE TABLE IF NOT EXISTS crm_events (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event TEXT NOT NULL,
    email TEXT, phone TEXT, name TEXT,
    artwork TEXT, museum TEXT,
    order_total NUMERIC
  )`;
  ensured = true;
}

// One counter row per day; uniques increments only on a visitor's first visit.
export async function bumpDaily(sql, firstVisit) {
  try {
    await ensureCrmTables(sql);
    const u = firstVisit ? 1 : 0;
    await sql`INSERT INTO daily_visits (day, pageviews, uniques)
      VALUES (CURRENT_DATE, 1, ${u})
      ON CONFLICT (day) DO UPDATE SET
        pageviews = daily_visits.pageviews + 1,
        uniques = daily_visits.uniques + ${u}`;
  } catch (e) { /* analytics must never break the beacon */ }
}

// Append an identified journey event. Anonymous (no email/phone) is skipped to
// keep the table bounded.
export async function logEvent(sql, { event, email, phone, name, artwork, museum, orderTotal } = {}) {
  try {
    if (!email && !phone) return;
    await ensureCrmTables(sql);
    let total = null;
    if (orderTotal != null && orderTotal !== '') {
      const n = Number(String(orderTotal).replace(/[^0-9.]/g, ''));
      total = Number.isFinite(n) ? n : null;
    }
    await sql`INSERT INTO crm_events (event, email, phone, name, artwork, museum, order_total)
      VALUES (${event || 'event'}, ${email || null}, ${phone || null}, ${name || null},
              ${artwork || null}, ${museum || null}, ${total})`;
  } catch (e) { /* swallow */ }
}
