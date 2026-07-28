// Minimal GoHighLevel (LeadConnector) CRM client. Same convention as
// lib/printful.js / lib/twilio.js: raw fetch + env-var auth, and a no-op when
// unconfigured so nothing is sent until keys are set in Vercel.
//
// Env vars (all optional):
//   GHL_API_KEY      — a v2 Private Integration / API token (Bearer)
//   GHL_LOCATION_ID  — the sub-account (location) id contacts belong to
const GHL_BASE = 'https://services.leadconnectorhq.com';
const GHL_VERSION = '2021-07-28';

export function hasGhl() {
  return !!(process.env.GHL_API_KEY && process.env.GHL_LOCATION_ID);
}

// Upsert a contact. GHL requires an identifier (email or phone) to create/match
// a contact, so callers without one get a clean skip. Extra visit metadata is
// attached as tags + source. Never throws; returns { ok, skipped?, error? }.
export async function upsertContact({ email, phone, name, firstName, lastName, source, tags, customFields } = {}) {
  if (!hasGhl()) return { ok: false, skipped: true, reason: 'ghl_not_configured' };
  if (!email && !phone) return { ok: false, skipped: true, reason: 'no_identifier' };

  const payload = {
    locationId: process.env.GHL_LOCATION_ID,
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
    ...(name ? { name } : {}),
    ...(firstName ? { firstName } : {}),
    ...(lastName ? { lastName } : {}),
    ...(source ? { source } : {}),
    ...(Array.isArray(tags) && tags.length ? { tags } : {}),
    ...(customFields ? { customFields } : {}),
  };

  try {
    // upsert = create-or-update by email/phone within the location
    const res = await fetch(`${GHL_BASE}/contacts/upsert`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GHL_API_KEY}`,
        Version: GHL_VERSION,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
    });
    let data = {};
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) return { ok: false, error: data?.message || `GHL HTTP ${res.status}` };
    return { ok: true, contactId: data?.contact?.id || data?.id };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
