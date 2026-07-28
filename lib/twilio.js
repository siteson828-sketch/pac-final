// Minimal Twilio SMS client (REST API, no SDK). Mirrors lib/printful.js:
// raw fetch + env-var auth, and a no-op when unconfigured so nothing breaks
// and no message is ever sent until the keys are set in Vercel.
//
// Env vars (all optional):
//   TWILIO_ACCOUNT_SID  — starts with "AC…"
//   TWILIO_AUTH_TOKEN
//   TWILIO_FROM         — a Twilio phone number (E.164, e.g. +14155550123)
//   TWILIO_NOTIFY_TO    — the owner number that receives visitor/order alerts
const TWILIO_BASE = 'https://api.twilio.com/2010-04-01';

export function hasTwilio() {
  return !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM);
}

// The default alert recipient (owner). Callers may override with an explicit `to`.
export function ownerNumber() {
  return process.env.TWILIO_NOTIFY_TO || '';
}

// Send one SMS. Returns { ok, skipped?, sid?, error? } and never throws, so a
// tracking/order path can fire-and-forget without risking the request.
export async function sendSms({ to, body }) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM;
  const dest = to || ownerNumber();

  if (!sid || !token || !from) return { ok: false, skipped: true, reason: 'twilio_not_configured' };
  if (!dest) return { ok: false, skipped: true, reason: 'no_recipient' };
  if (!body) return { ok: false, skipped: true, reason: 'no_body' };

  try {
    const auth = Buffer.from(`${sid}:${token}`).toString('base64');
    const res = await fetch(`${TWILIO_BASE}/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: dest, From: from, Body: body }).toString(),
    });
    let data = {};
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) return { ok: false, error: data?.message || `Twilio HTTP ${res.status}` };
    return { ok: true, sid: data.sid };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
