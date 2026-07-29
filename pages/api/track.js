import { hasTwilio, sendSms, ownerNumber } from '../../lib/twilio';
import { hasBloo, upsertContact } from '../../lib/bloo';
import { checkRateLimit } from '../../lib/rate-limit';

export const dynamic = 'force-dynamic';

// Visitor tracking beacon. Called fire-and-forget from _app.js on every page
// view. On a visitor's FIRST visit (no pac_seen cookie) it sends the owner an
// SMS alert via Twilio. On every visit it pushes the visitor to Bloo.io
// when an identifier (email/phone) is available. It never throws to the client
// and no-ops cleanly when integrations aren't configured.
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

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};

  const path = body.path || req.headers.referer || '/';
  const referrer = body.referrer || '';
  const ua = req.headers['user-agent'] || '';
  const ip = clientIp(req);

  // Honeypot: the real beacon (pages/_app.js) never sends this field. A filled
  // value means a bot replaying a form-like payload — acknowledge and do nothing
  // (don't tip it off, don't run any SMS/CRM side effects).
  if (body.website) return res.status(200).json({ ok: true });

  // Rate limit tracking events per IP so this public endpoint can't be scripted
  // to spam owner SMS alerts or inject CRM contacts. Stored in Neon (shared
  // across serverless instances). Fails open if the store is unavailable.
  const rl = await checkRateLimit({ scope: 'track', ip, limit: 5, windowSeconds: 600 });
  if (!rl.allowed) return res.status(429).json({ ok: false, error: 'rate_limited' });

  const firstVisit = !readCookie(req, SEEN_COOKIE);
  if (firstVisit) {
    res.setHeader('Set-Cookie',
      `${SEEN_COOKIE}=1; Path=/; Max-Age=${ONE_YEAR}; SameSite=Lax`);
  }

  const notified = { twilio: null, bloo: null };

  // Owner alert SMS — first visit only, so we don't text on every page view.
  if (firstVisit && hasTwilio() && ownerNumber()) {
    notified.twilio = await sendSms({
      body: `New visitor on Public Art Collections\nPage: ${path}` +
            (referrer ? `\nFrom: ${referrer}` : '') +
            (ip ? `\nIP: ${ip}` : ''),
    });
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
