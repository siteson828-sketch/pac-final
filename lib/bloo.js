// Minimal Bloo.io CRM client. Same convention as lib/printful.js / lib/twilio.js:
// raw fetch + env-var auth, and a no-op when unconfigured so nothing is sent
// until keys are set in Vercel.
//
// Env vars (all optional):
//   BLOO_API_KEY — a Bloo.io API key (Bearer)
const BLOO_BASE = 'https://api.bloo.io/v1';

export function hasBloo() {
  return !!process.env.BLOO_API_KEY;
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
