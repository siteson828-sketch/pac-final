import { neon } from '@neondatabase/serverless';

// Consented marketing-lead store — SEPARATE from the pixel-filled `visitors`
// table (lib/crm.js). A row here means the person EXPLICITLY opted in (submitted
// the lead popup). Automated email/SMS drips target ONLY this table, never
// `visitors` (which contains AudienceLab pixel-resolved identities and checkout
// contacts that never consented to marketing). This is the compliance boundary.
export function leadsDb() {
  return neon(process.env.DATABASE_URL);
}

let ensured = false;
export async function ensureLeadsTable(sql) {
  if (ensured) return;
  await sql`CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY,
    lead_key TEXT UNIQUE NOT NULL,          -- em:<email> or ph:<phone>
    email TEXT, phone TEXT, name TEXT, source TEXT,
    sms_consent BOOLEAN DEFAULT false,       -- true when they gave a phone at opt-in
    consent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    unsubscribed_at TIMESTAMPTZ,             -- set by /api/unsubscribe; honored by every send
    welcome_sent_at TIMESTAMPTZ,
    day1_sent_at TIMESTAMPTZ,
    day3_sent_at TIMESTAMPTZ,
    weekly_last_at TIMESTAMPTZ,
    last_sent_at TIMESTAMPTZ
  )`;
  ensured = true;
}

function keyFor(email, phone) {
  if (email) return 'em:' + String(email).toLowerCase();
  if (phone) return 'ph:' + String(phone);
  return null;
}

// Record/refresh an explicit opt-in. Returns the row (so the caller can check
// welcome_sent_at / unsubscribed_at) or null if there's no identifier.
export async function upsertLead(sql, { email, phone, name, source, smsConsent }) {
  const lead_key = keyFor(email, phone);
  if (!lead_key) return null;
  try {
    await ensureLeadsTable(sql);
    const rows = await sql`
      INSERT INTO leads (lead_key, email, phone, name, source, sms_consent)
      VALUES (${lead_key}, ${email || null}, ${phone || null}, ${name || null}, ${source || 'lead_popup'}, ${!!smsConsent})
      ON CONFLICT (lead_key) DO UPDATE SET
        email = COALESCE(EXCLUDED.email, leads.email),
        phone = COALESCE(EXCLUDED.phone, leads.phone),
        name  = COALESCE(EXCLUDED.name, leads.name),
        sms_consent = leads.sms_consent OR EXCLUDED.sms_consent
      RETURNING *`;
    return rows[0] || null;
  } catch (e) { return null; }
}

export async function markWelcomeSent(sql, lead_key) {
  try { await sql`UPDATE leads SET welcome_sent_at = NOW(), last_sent_at = NOW() WHERE lead_key = ${lead_key}`; } catch (e) {}
}

export async function markStageSent(sql, lead_key, stageColumn) {
  // Explicit per-column updates (no dynamic identifier interpolation), fully parameterized.
  try {
    if (stageColumn === 'day1_sent_at') await sql`UPDATE leads SET day1_sent_at = NOW(), last_sent_at = NOW() WHERE lead_key = ${lead_key}`;
    else if (stageColumn === 'day3_sent_at') await sql`UPDATE leads SET day3_sent_at = NOW(), last_sent_at = NOW() WHERE lead_key = ${lead_key}`;
    else if (stageColumn === 'weekly_last_at') await sql`UPDATE leads SET weekly_last_at = NOW(), last_sent_at = NOW() WHERE lead_key = ${lead_key}`;
  } catch (e) {}
}

// Mark a lead unsubscribed (idempotent). Matches by email or phone. Returns count.
export async function unsubscribeLead(sql, { email, phone }) {
  try {
    await ensureLeadsTable(sql);
    const em = email ? 'em:' + String(email).toLowerCase() : null;
    const ph = phone ? 'ph:' + String(phone) : null;
    const rows = await sql`
      UPDATE leads SET unsubscribed_at = NOW()
      WHERE unsubscribed_at IS NULL
        AND ( (${em}::text IS NOT NULL AND lead_key = ${em})
           OR (${ph}::text IS NOT NULL AND lead_key = ${ph})
           OR (${email}::text IS NOT NULL AND lower(email) = lower(${email}))
           OR (${phone}::text IS NOT NULL AND phone = ${phone}) )
      RETURNING id`;
    return rows.length;
  } catch (e) { return 0; }
}
