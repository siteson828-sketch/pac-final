// Minimal Bloo.io client (CRM contacts + SMS). Same convention as
// lib/printful.js: raw fetch + env-var auth, and a no-op when unconfigured so
// nothing is sent until keys are set in Vercel.
//
// Env vars (all optional):
//   BLOO_API_KEY       — a Bloo.io API key (Bearer)
//   BLOO_PHONE_NUMBER  — sender number for outbound SMS
//   OWNER_PHONE_NUMBER — destination for owner alerts (falls back to TWILIO_NOTIFY_TO)
const BLOO_BASE = 'https://api.bloo.io/v1';

export function hasBloo() {
  return !!process.env.BLOO_API_KEY;
}

// True when Bloo SMS can send (API key + a sender number configured).
export function hasBlooSms() {
  return !!(process.env.BLOO_API_KEY && process.env.BLOO_PHONE_NUMBER);
}

// Owner alert destination. Prefers OWNER_PHONE_NUMBER; falls back to the legacy
// TWILIO_NOTIFY_TO so existing config keeps working after the Twilio migration.
export function ownerNumber() {
  return process.env.OWNER_PHONE_NUMBER || process.env.TWILIO_NOTIFY_TO || '';
}

// Send one SMS via Bloo.io. Never throws; returns { ok, skipped?, error? } so an
// order/alert path can fire-and-forget without risking the request.
export async function sendSms({ to, message }) {
  if (!process.env.BLOO_API_KEY) return { ok: false, skipped: true, reason: 'bloo_not_configured' };
  if (!process.env.BLOO_PHONE_NUMBER) return { ok: false, skipped: true, reason: 'no_sender' };
  if (!to) return { ok: false, skipped: true, reason: 'no_recipient' };
  if (!message) return { ok: false, skipped: true, reason: 'no_message' };

  try {
    const res = await fetch(`${BLOO_BASE}/sms/send`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.BLOO_API_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ to, from: process.env.BLOO_PHONE_NUMBER, message }),
    });
    let data = {};
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) return { ok: false, error: data?.message || `Bloo SMS HTTP ${res.status}` };
    return { ok: true, id: data?.id || data?.message_id };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// Create/upsert a contact. Bloo matches on email/phone, so callers without an
// identifier get a clean skip. Visit/order metadata rides along as source, tags
// and a free-form `custom` object. Never throws; returns { ok, skipped?, error? }.
export async function upsertContact({ email, phone, name, source, tags, custom } = {}) {
  if (!hasBloo()) return { ok: false, skipped: true, reason: 'bloo_not_configured' };
  if (!email && !phone) return { ok: false, skipped: true, reason: 'no_identifier' };

  const payload = {
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
    ...(name ? { name } : {}),
    ...(source ? { source } : {}),
    ...(Array.isArray(tags) && tags.filter(Boolean).length ? { tags: tags.filter(Boolean) } : {}),
    ...(custom ? { custom } : {}),
  };

  try {
    const res = await fetch(`${BLOO_BASE}/contacts`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.BLOO_API_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });
    let data = {};
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) return { ok: false, error: data?.message || `Bloo HTTP ${res.status}` };
    return { ok: true, contactId: data?.contact?.id || data?.id };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
