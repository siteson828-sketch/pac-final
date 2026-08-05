import { neon } from '@neondatabase/serverless';
import { unsubscribeLead } from '../../lib/leads';

export const dynamic = 'force-dynamic';

// Public, no-auth by design — unsubscribe links must work without login. Keyed by
// email (or phone) from the link. Sets leads.unsubscribed_at, which every send
// path (welcome + all drips) checks, so the opt-out is actually honored
// (CAN-SPAM). Idempotent. Guessable by email, but the only action is suppression
// (fail-safe: worst case someone gets unsubscribed, never spammed).
export default async function handler(req, res) {
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};
  const email = String(req.query.email || body.email || '').slice(0, 254).trim();
  const phone = String(req.query.phone || body.phone || '').slice(0, 40).trim();
  if (!email && !phone) return res.status(400).json({ error: 'email or phone required' });

  try {
    const sql = neon(process.env.DATABASE_URL);
    const n = await unsubscribeLead(sql, { email: email || null, phone: phone || null });
    return res.status(200).json({ ok: true, unsubscribed: n });
  } catch (e) {
    return res.status(500).json({ ok: false, error: 'An error occurred' });
  }
}
