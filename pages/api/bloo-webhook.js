import { neon } from '@neondatabase/serverless';
import { ensureLeadsTable } from '../../lib/leads';

export const dynamic = 'force-dynamic';

// Inbound SMS webhook (point Bloo's inbound-message webhook here). Its ONLY job
// is compliance: honor SMS opt-out/opt-in so we never text someone who replied
// STOP. On a STOP keyword it sets leads.unsubscribed_at for that number (every
// send path — welcome + all drips — skips unsubscribed leads). This is the
// TCPA/CTIA opt-out handling that must exist before ENABLE_VISITOR_SMS is on.
//
// Security: optional shared secret (BLOO_WEBHOOK_SECRET) via ?secret= or the
// x-bloo-secret header. When set, mismatches are rejected. When UNSET it still
// processes — the only action here is suppression (fail-safe), and silently
// dropping STOPs would itself be a compliance failure. Never sends any SMS
// (carriers/Bloo emit the standard opt-out confirmation themselves).
//
// CTIA standard keywords.
const STOP_WORDS = new Set(['stop', 'stopall', 'unsubscribe', 'cancel', 'end', 'quit', 'optout', 'opt-out', 'revoke', 'remove']);
const START_WORDS = new Set(['start', 'unstop', 'yes', 'subscribe', 'optin', 'opt-in']);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const secret = process.env.BLOO_WEBHOOK_SECRET;
  if (secret) {
    const provided = req.query.secret || req.headers['x-bloo-secret'];
    if (provided !== secret) return res.status(401).json({ error: 'Unauthorized' });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};

  // Bloo's exact inbound shape isn't documented — accept the common variants for
  // the sender number and the message text.
  const from = String(body.from || body.sender || body.phone || body.msisdn || body.From || '').trim();
  const text = String(body.body || body.message || body.text || body.content || body.Body || '').trim();
  if (!from || !text) return res.status(200).json({ ok: true, action: 'ignored', reason: 'missing from/text' });

  // First word, letters only ("STOP", "Stop please", "STOP." → "stop").
  const word = text.toLowerCase().replace(/[^a-z-]/g, ' ').trim().split(/\s+/)[0] || '';

  // Match a lead by phone tolerant of formatting (compare digit-only suffix).
  const digits = from.replace(/\D/g, '');
  const key = digits.length >= 10 ? digits.slice(-10) : digits;
  if (!key) return res.status(200).json({ ok: true, action: 'ignored', reason: 'no digits' });

  try {
    const sql = neon(process.env.DATABASE_URL);
    await ensureLeadsTable(sql);

    if (STOP_WORDS.has(word)) {
      const rows = await sql`
        UPDATE leads SET unsubscribed_at = NOW()
        WHERE unsubscribed_at IS NULL AND phone IS NOT NULL
          AND right(regexp_replace(phone, '[^0-9]', '', 'g'), ${key.length}) = ${key}
        RETURNING id`;
      return res.status(200).json({ ok: true, action: 'unsubscribed', matched: rows.length });
    }
    if (START_WORDS.has(word)) {
      const rows = await sql`
        UPDATE leads SET unsubscribed_at = NULL
        WHERE unsubscribed_at IS NOT NULL AND phone IS NOT NULL
          AND right(regexp_replace(phone, '[^0-9]', '', 'g'), ${key.length}) = ${key}
        RETURNING id`;
      return res.status(200).json({ ok: true, action: 'resubscribed', matched: rows.length });
    }
    return res.status(200).json({ ok: true, action: 'none' });
  } catch (e) {
    // Acknowledge so Bloo doesn't retry-storm; log server-side for diagnosis.
    console.error('bloo-webhook error:', e.message);
    return res.status(200).json({ ok: true, action: 'error' });
  }
}
