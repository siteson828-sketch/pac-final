import { hasTwilio, sendSms, ownerNumber } from '../../lib/twilio';

export const dynamic = 'force-dynamic';

// Visitor tracking beacon. Called fire-and-forget from _app.js on every page
// view. On a visitor's FIRST visit (no pac_seen cookie) it sends the owner an
// SMS alert via Twilio. It never throws to the client and no-ops cleanly when
// integrations aren't configured.
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

  const firstVisit = !readCookie(req, SEEN_COOKIE);
  if (firstVisit) {
    res.setHeader('Set-Cookie',
      `${SEEN_COOKIE}=1; Path=/; Max-Age=${ONE_YEAR}; SameSite=Lax`);
  }

  const notified = { twilio: null };

  // Owner alert SMS — first visit only, so we don't text on every page view.
  if (firstVisit && hasTwilio() && ownerNumber()) {
    notified.twilio = await sendSms({
      body: `New visitor on Public Art Collections\nPage: ${path}` +
            (referrer ? `\nFrom: ${referrer}` : '') +
            (ip ? `\nIP: ${ip}` : ''),
    });
  }

  return res.status(200).json({ ok: true, firstVisit, notified });
}
