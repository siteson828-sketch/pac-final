import { hasGhl, upsertContact as ghlUpsert } from '../../lib/ghl';
import { crmDb, bumpDaily, logEvent, upsertVisitor } from '../../lib/crm';
import { leadsDb, upsertLead, markWelcomeSent } from '../../lib/leads';
import { sendEmail, emailShell, hasEmail } from '../../lib/email';
import { checkRateLimit } from '../../lib/rate-limit';
import { cleanStr, isEmail, isPhone, sameOrigin } from '../../lib/sanitize';

export const dynamic = 'force-dynamic';

// Visitor tracking beacon. Called fire-and-forget from _app.js on every page
// view. On every visit it pushes the visitor to GoHighLevel when an identifier
// (email/phone) is available; GHL automations handle all SMS delivery natively
// via Signal House. It never throws to the client and no-ops cleanly when GHL
// isn't configured.
//
// COMPLIANCE: any promotional SMS is triggered inside GHL. Only message numbers
// for which you have lawful marketing consent, and keep STOP/opt-out handling on
// — see TCPA/CTIA. A phone captured at checkout is not, by itself, marketing
// consent.
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
  // Explicit lead-capture submissions (the after-8s popup) get a SEPARATE scope
  // so the per-page-view beacons from _app.js can't exhaust the budget and cause
  // a real lead to be dropped with a 429. Both stay bounded to deter abuse.
  const isLead = body.source === 'lead_popup';
  const rl = await checkRateLimit({ scope: isLead ? 'track-lead' : 'track', ip, limit: 5, windowSeconds: 600 });
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

  const notified = { ghl: null };

  // Push every identified visit into GoHighLevel. GHL is the single CRM +
  // messaging system of record: it stores the contact and its journey data, and
  // GHL automations fire any SMS natively via Signal House. GHL matches on
  // email/phone, so this only lands when the beacon carries a known identifier;
  // anonymous visits are acknowledged but produce a clean skip.
  if (hasGhl() && (body.email || body.phone)) {
    notified.ghl = await ghlUpsert({
      email: body.email,
      phone: body.phone,
      name: body.name,
      tags: ['art-collector', 'pac-visitor', body.museum, body.source],
      custom: {
        journey_stage: 'visitor',
        last_artwork: body.artwork_title,
        last_museum: body.museum,
        audiencelab_id: body.audiencelab_id,
        visitor_ip: ip,
      },
    });
  }

  // ─── Explicit lead-popup opt-in → consented welcome ────────────────────────
  // This is the ONLY entry point into the consented `leads` table. It records
  // the opt-in, sends a ONE-TIME welcome email via Resend, and pushes the lead
  // into GoHighLevel with an explicit `lead` journey stage + sms-consent flag so
  // GHL automations can fire the welcome SMS natively via Signal House. Dedup via
  // welcome_sent_at. Fire-and-forget — never fails the beacon. All drip
  // follow-ups later target ONLY this table (never `visitors`).
  if (isLead && (body.email || body.phone)) {
    try {
      const ldb = leadsDb();
      const lead = await upsertLead(ldb, {
        email: body.email, phone: body.phone, name: body.name,
        source: 'lead_popup', smsConsent: !!body.phone,
      });
      if (lead && !lead.welcome_sent_at && !lead.unsubscribed_at) {
        const first = (body.name || '').split(' ')[0];
        if (body.email && hasEmail()) {
          const inner = `
            <h1 style="font-size:28px;font-weight:300;margin:0 0 16px;line-height:1.2;">Welcome${first ? ', ' + first : ''}!</h1>
            <p style="font-size:15px;color:#B0A898;line-height:1.8;margin-bottom:24px;">You now have access to over a million public-domain artworks from 120+ museums worldwide. Browse, search by AI, and order museum-quality prints delivered to your door.</p>
            <a href="https://www.publicartcollections.net/viewer" style="display:inline-block;background:#B8942A;color:#1A1714;padding:14px 24px;border-radius:4px;font-size:15px;font-weight:600;text-decoration:none;">Browse the collection →</a>`;
          await sendEmail({ to: body.email, subject: 'Welcome to Public Art Collections 🎨', html: emailShell(inner, body.email) });
        }
        // Hand the lead to GHL with a `lead` stage; GHL automations own the SMS.
        if (hasGhl()) {
          await ghlUpsert({
            email: body.email, phone: body.phone, name: body.name,
            tags: ['pac-visitor', 'pac-lead', body.museum, body.source],
            custom: {
              journey_stage: 'lead',
              sms_consent: body.phone ? 'true' : 'false',
              last_artwork: body.artwork_title,
              last_museum: body.museum,
            },
          });
        }
        await markWelcomeSent(ldb, lead.lead_key);
      }
    } catch (e) { /* never fail the beacon */ }
  }

  return res.status(200).json({ ok: true, firstVisit, notified });
}
