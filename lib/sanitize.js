// Shared input sanitization / validation + output shaping helpers.
//
// The DB layer already uses parameterized neon tagged templates (no SQL
// injection), and React escapes rendered values (no reflected XSS from JSON
// responses). These helpers are defense-in-depth: they cap lengths, strip HTML
// tags and control characters from stored strings, and validate the few
// structured fields (email/phone/country) before we act on them.

// Coerce to a trimmed, tag-free, control-char-free string capped at maxLen.
export function cleanStr(v, maxLen = 200) {
  if (v == null) return '';
  let s = String(v);
  s = s.replace(/<[^>]*>/g, '');     // strip HTML tags
  s = s.replace(/\p{Cc}/gu, ' ');    // strip Unicode control chars
  s = s.replace(/\s+/g, ' ').trim(); // collapse whitespace
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

export function isEmail(v) {
  const s = String(v || '');
  return s.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

// Permissive international phone check (digits, spaces, +, -, parens; 7-20 chars).
export function isPhone(v) {
  const s = String(v || '').trim();
  return /^[+()\-\s\d]{7,20}$/.test(s);
}

export function isCountryCode(v) {
  return /^[A-Za-z]{2}$/.test(String(v || '').trim());
}

// Sanitize a shipping recipient object, returning { recipient, errors }.
// Caller decides whether errors are fatal (create-order) or best-effort (track).
export function sanitizeRecipient(r) {
  r = r || {};
  const out = {
    name:         cleanStr(r.name, 120),
    email:        cleanStr(r.email, 254),
    phone:        cleanStr(r.phone, 20),
    address1:     cleanStr(r.address1, 200),
    address2:     cleanStr(r.address2, 200),
    city:         cleanStr(r.city, 120),
    state_code:   cleanStr(r.state_code, 60),
    zip:          cleanStr(r.zip, 20),
    country_code: cleanStr(r.country_code, 2).toUpperCase(),
  };
  const errors = [];
  if (out.email && !isEmail(out.email)) errors.push('email');
  if (out.phone && !isPhone(out.phone)) errors.push('phone');
  if (out.country_code && !isCountryCode(out.country_code)) errors.push('country_code');
  return { recipient: out, errors };
}

// Public field allowlist for artwork rows — excludes internal columns like
// synced_at so no sync/system metadata leaks in public API responses.
export const PUBLIC_ARTWORK_FIELDS = [
  'id', 'source', 'source_id', 'title', 'artist', 'date_text', 'medium',
  'thumb_url', 'full_url', 'iiif_info', 'iiif_manifest', 'print_url',
  'detail_url', 'rights', 'rights_label', 'commercial_ok', 'bio',
];

export function shapeArtwork(w) {
  return Object.fromEntries(PUBLIC_ARTWORK_FIELDS.map(f => [f, w?.[f] ?? null]));
}

// Extract the client IP from Vercel's forwarding headers.
export function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return req.socket?.remoteAddress || '';
}

// Same-origin guard for state-changing POSTs. Blocks cross-site browser-forged
// requests (CSRF) without cookies: if an Origin/Referer is present it must match
// the request host. Missing header (server-to-server, curl) is allowed so we
// don't break non-browser callers — the order-token gate covers those paths.
export function sameOrigin(req) {
  const host = req.headers['host'];
  const src = req.headers['origin'] || req.headers['referer'];
  if (!src || !host) return true;
  try { return new URL(src).host === host; } catch { return false; }
}
