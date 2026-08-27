// Minimal GoHighLevel (GHL) CRM client — REST v1 (rest.gohighlevel.com/v1).
// Same convention as lib/stripe.js: raw fetch + env-var auth, and
// a clean no-op when unconfigured so nothing is sent until GHL_API_KEY is set.
//
// GHL_API_KEY should be a Location API key (Bearer). NOTE: v1 is GHL's legacy
// API surface; the customField keys written below map to YOUR GHL custom fields
// and may need adjusting to your account's field ids/keys once live. This module
// is unverified against a live GHL account until a key is provided.
const GHL_BASE = 'https://rest.gohighlevel.com/v1';

export function hasGhl() {
  return !!process.env.GHL_API_KEY;
}

function ghlHeaders() {
  return {
    Authorization: `Bearer ${process.env.GHL_API_KEY}`,
    'Content-Type': 'application/json',
    Version: '2021-07-28',
  };
}

async function ghlFetch(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${GHL_BASE}${path}`, {
    method,
    headers: ghlHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) throw new Error(data?.msg || data?.message || `GHL HTTP ${res.status}`);
  return data;
}

export async function findContactByEmail(email) {
  if (!hasGhl() || !email) return null;
  try {
    const d = await ghlFetch(`/contacts/lookup?email=${encodeURIComponent(email)}`);
    return d?.contacts?.[0] || null;
  } catch (e) {
    // lookup endpoint shape varies by account — fall back to a query search.
    try {
      const d = await ghlFetch(`/contacts/?query=${encodeURIComponent(email)}`);
      return d?.contacts?.[0] || null;
    } catch (e2) { return null; }
  }
}

// Create/upsert a contact. GHL matches on email; callers without an identifier
// get a clean skip. Never throws; returns { ok, skipped?, error?, contact? }.
export async function upsertContact({ email, phone, name, tags = [], custom = {}, source = 'Public Art Collections' } = {}) {
  if (!hasGhl()) return { ok: false, skipped: true };
  if (!email && !phone) return { ok: false, skipped: true };
  const parts = String(name || '').trim().split(' ').filter(Boolean);
  const body = {
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
    ...(parts.length ? { firstName: parts[0] } : {}),
    ...(parts.length > 1 ? { lastName: parts.slice(1).join(' ') } : {}),
    source,
    tags: (tags || []).filter(Boolean),
    customField: custom,
  };
  try {
    const d = await ghlFetch('/contacts/', { method: 'POST', body });
    return { ok: true, contact: d?.contact || d };
  } catch (e) {
    console.error('GHL upsert:', e.message);
    return { ok: false, error: e.message };
  }
}

export async function updateContact(contactId, { customField = {} } = {}) {
  if (!hasGhl() || !contactId) return { ok: false, skipped: true };
  try {
    await ghlFetch(`/contacts/${contactId}`, { method: 'PUT', body: { customField } });
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
}

// Adds tags without clobbering existing ones (unlike a PUT with a tags array).
export async function addTags(contactId, tags = []) {
  if (!hasGhl() || !contactId) return { ok: false, skipped: true };
  const t = (tags || []).filter(Boolean);
  if (!t.length) return { ok: false, skipped: true };
  try {
    await ghlFetch(`/contacts/${contactId}/tags/`, { method: 'POST', body: { tags: t } });
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
}

export async function addNote(contactId, noteBody) {
  if (!hasGhl() || !contactId || !noteBody) return { ok: false, skipped: true };
  try {
    await ghlFetch(`/contacts/${contactId}/notes/`, { method: 'POST', body: { body: noteBody } });
    return { ok: true };
  } catch (e) { return { ok: false, error: e.message }; }
}
