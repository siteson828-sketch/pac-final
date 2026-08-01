import { hasBloo, upsertContact } from '../../lib/bloo';
import { hasGhl, upsertContact as ghlUpsert } from '../../lib/ghl';
import { crmDb, bumpDaily, logEvent, upsertVisitor } from '../../lib/crm';
import { checkRateLimit } from '../../lib/rate-limit';
import { cleanStr, isEmail, isPhone, sameOrigin } from '../../lib/sanitize';

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
    ? `Hi ${name||'there'}! Thanks for visiting Public Art Collections. We noticed you're interested in "${artworkTitle}" from ${museum}. Browse and order museum-quality prints at publicartcollections.net`
    : `Hi ${name||'there'}! Thanks for visiting Public Art Collections — your gateway to every museum in the world. Browse and order prints at publicartcollections.net`;

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

  // Reject cross-site browser-forged beacons (Origin/Referer must match when present).
  if (!sameOrigin(req)) return res.status(403).json({ ok: false });

  // Honeypot: the real beacon (pages/_app.js) never sends this field. A filled
  // value means a bot replaying a form-like payload — acknowledge and do nothing
  // (don't tip it off, don't run any SMS/CRM side effects).
  if (body.website) return res.status(200).json({ ok: true });

  // Sanitize the free-text fields before they reach the CRM/SMS side effects.
  // Invalid email/phone are dropped (best-effort — a beacon must never 400).
  const cleanEmail = isEmail(cleanStr(body.email, 254)) ? cleanStr(body.email, 254) : '';
  const cleanPhone = isPhone(cleanStr(body.phone, 20)) ? cleanStr(body.phone, 20) : '';
  const cleanName = cleanStr(body.name, 120);
  const cleanArtwork = cleanStr(body.artwork_title, 200);
  const cleanMuseum = cleanStr(body.museum, 120);
  body = { ...body, email: cleanEmail, phone: cleanPhone, name: cleanName, artwork_title: cleanArtwork, museum: cleanMuseum };

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

  // Local analytics for the admin dashboard: a per-day counter (all visits) plus
  // an identified page_view event when we know who it is. Bounded + safe.
  const cdb = crmDb();
  await bumpDaily(cdb, firstVisit);
  if (body.email || body.phone) {
    await logEvent(cdb, { event: 'page_view', email: body.email, phone: body.phone, name: body.name, artwork: body.artwork_title, museum: body.museum });
  }

  // Rich enrichment profile — identified visitors only (keeps the table bounded).
  // Device parsed from the UA server-side; coarse geo from Vercel edge headers
  // (falls back to whatever the pixel supplies). Demographic/attribution fields
  // are pass-through: they only populate if the pixel actually sends them.
  if (body.email || body.phone || body.audiencelab_id || body.audiencelab_email) {
    const ua = req.headers['user-agent'] || '';
    const device = /Mobi/i.test(ua) ? 'mobile' : /Tablet|iPad/i.test(ua) ? 'tablet' : 'desktop';
    const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Other';
    const os = /Windows/.test(ua) ? 'Windows' : /iPhone|iPad|iOS/.test(ua) ? 'iOS' : /Mac OS/.test(ua) ? 'Mac' : /Android/.test(ua) ? 'Android' : /Linux/.test(ua) ? 'Linux' : 'Other';
    const hdr = k => { const v = req.headers[k]; if (!v) return null; try { return decodeURIComponent(v); } catch (e) { return v; } };
    await upsertVisitor(cdb, {
      email: body.email || null, phone: body.phone || null, name: body.name || null,
      first_name: body.first_name, last_name: body.last_name,
      audiencelab_id: body.audiencelab_id, audiencelab_email: body.audiencelab_email, audiencelab_phone: body.audiencelab_phone, audiencelab_name: body.audiencelab_name,
      audiencelab_age_range: body.audiencelab_age_range, audiencelab_gender: body.audiencelab_gender, audiencelab_income: body.audiencelab_income,
      audiencelab_homeowner: body.audiencelab_homeowner, audiencelab_net_worth: body.audiencelab_net_worth, audiencelab_education: body.audiencelab_education,
      audiencelab_occupation: body.audiencelab_occupation, audiencelab_marital_status: body.audiencelab_marital_status, audiencelab_children: body.audiencelab_children,
      audiencelab_interests: body.audiencelab_interests, audiencelab_raw: body.audiencelab_raw,
      groundtruth_id: body.groundtruth_id, groundtruth_campaign: body.groundtruth_campaign, groundtruth_ad_group: body.groundtruth_ad_group,
      groundtruth_creative: body.groundtruth_creative, groundtruth_location: body.groundtruth_location, groundtruth_venue_type: body.groundtruth_venue_type,
      groundtruth_visit_time: body.groundtruth_visit_time, groundtruth_raw: body.groundtruth_raw,
      source: body.source, utm_source: body.utm_source, utm_medium: body.utm_medium, utm_campaign: body.utm_campaign, utm_content: body.utm_content, utm_term: body.utm_term,
      referrer: body.referrer, landing_page: body.landing_page,
      ip, user_agent: ua, device_type: body.device_type || device, browser: body.browser || browser, os: body.os || os,
      city: body.city || hdr('x-vercel-ip-city'), state: body.state || hdr('x-vercel-ip-country-region'), country: body.country || hdr('x-vercel-ip-country'),
      latitude: body.latitude || hdr('x-vercel-ip-latitude'), longitude: body.longitude || hdr('x-vercel-ip-longitude'),
    });
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

  // Mirror the visit into GoHighLevel when configured (parallel to Bloo).
  if (hasGhl() && (body.email || body.phone)) {
    notified.ghl = await ghlUpsert({
      email: body.email,
      phone: body.phone,
      name: body.name,
      tags: ['pac-visitor', body.museum, body.source],
      custom: {
        last_artwork: body.artwork_title,
        last_museum: body.museum,
        audiencelab_id: body.audiencelab_id,
        visitor_ip: ip,
        journey_stage: 'visitor',
      },
    });
  }

  return res.status(200).json({ ok: true, firstVisit, notified });
}
