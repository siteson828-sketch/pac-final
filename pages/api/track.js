import { hasBloo, upsertContact } from '../../lib/bloo';
import { checkRateLimit } from '../../lib/rate-limit';

export const dynamic = 'force-dynamic';

// Visitor tracking beacon. Called fire-and-forget from _app.js on every page
// view. On a visitor's FIRST visit (no pac_seen cookie) — and only when the
// beacon carries a phone — it texts the visitor a marketing SMS via Bloo.io.
// On every visit it pushes the visitor to Bloo.io when an identifier
// (email/phone) is available. It never throws to the client and no-ops cleanly
// when integrations aren't configured.
//
// COMPLIANCE: the outbound SMS is promotional. Only send to numbers for which
// you have lawful marketing consent, and ensure STOP/opt-out handling — see
// TCPA/CTIA. A phone captured at checkout is not, by itself, marketing consent.
const SEEN_COOKIE = 'pac_seen';
const ONE_YEAR = 60 * 60 * 24 * 365;

function readCookie(req, name) {
  const raw = req.headers.cookie || '';
  for (const part of raw.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return req.socket?.remoteAddress || '';
}

// Sends the visitor a marketing SMS via Bloo.io. No-ops without BLOO_API_KEY.
// Fire-and-forget: never throws (the beacon must not fail the client).
async function sendSMS(phone, name, artworkTitle, museum) {
  if (!process.env.BLOO_API_KEY) return;

  const message = artworkTitle
    ? `Hi ${name||'there'}! Thanks for visiting Public Art Collections. We noticed you're interested in "${artworkTitle}" from ${museum}. Browse and order museum-quality prints at publicartcollections.org`
    : `Hi ${name||'there'}! Thanks for visiting Public Art Collections — your gateway to every museum in the world. Browse and order prints at publicartcollections.org`;

  try {
    await fetch('https://api.bloo.io/v1/sms/send', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + process.env.BLOO_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        to: phone,
        from: process.env.BLOO_PHONE_NUMBER,
        message: message
      })
    });
  } catch (e) {
    console.error('Bloo SMS error:', e.message);
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};

  const ip = clientIp(req);

  // Honeypot: the real beacon (pages/_app.js) never sends this field. A filled
  // value means a bot replaying a form-like payload — acknowledge and do nothing
  // (don't tip it off, don't run any SMS/CRM side effects).
  if (body.website) return res.status(200).json({ ok: true });

  // Rate limit tracking events per IP so this public endpoint can't be scripted
  // to trigger marketing SMS or inject CRM contacts. Stored in Neon (shared
  // across serverless instances). Fails open if the store is unavailable.
  const rl = await checkRateLimit({ scope: 'track', ip, limit: 5, windowSeconds: 600 });
  if (!rl.allowed) return res.status(429).json({ ok: false, error: 'rate_limited' });

  const firstVisit = !readCookie(req, SEEN_COOKIE);
  if (firstVisit) {
    res.setHeader('Set-Cookie',
      `${SEEN_COOKIE}=1; Path=/; Max-Age=${ONE_YEAR}; SameSite=Lax`);
  }

  const notified = { sms: null, bloo: null };

  // First-visit marketing SMS to the visitor (Bloo.io) — only when the beacon
  // carries a phone, and only once per visitor (first-visit cookie) so we never
  // re-text on later page views. Gated behind ENABLE_VISITOR_SMS so that simply
  // configuring BLOO_API_KEY (which enables owner order alerts) does NOT start
  // texting visitors — that requires the explicit opt-in flag. Requires lawful
  // marketing consent + STOP handling before enabling.
  if (firstVisit && body.phone && process.env.ENABLE_VISITOR_SMS === 'true') {
    await sendSMS(body.phone, body.name, body.artwork_title, body.museum);
    notified.sms = 'attempted';
  }

  // CRM push on every visit — Bloo needs an identifier, so this only lands when
  // the beacon carries a known email/phone (e.g. an identified/returning lead).
  // Anonymous visits are acknowledged but produce a clean skip.
  if (hasBloo() && (body.email || body.phone)) {
    notified.bloo = await upsertContact({
      email: body.email,
      phone: body.phone,
      name: body.name,
      source: 'Public Art Collections',
      tags: ['art-collector', 'pac-visitor', body.museum],
      custom: {
        last_artwork: body.artwork_title,
        last_museum: body.museum,
        audiencelab_id: body.audiencelab_id,
        ip,
      },
    });
  }

  return res.status(200).json({ ok: true, firstVisit, notified });
}
