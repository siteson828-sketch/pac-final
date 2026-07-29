// Lightweight visitor identity store (localStorage).
//
// The checkout form is the only place a visitor hands us an email today, so we
// stash it here on checkout and the tracking beacon (pages/_app.js) reads it
// back to attach identity to subsequent page views — which is what lets the
// Bloo CRM push in /api/track actually fire for known leads instead of always
// skipping on "no identifier".
//
// `phone` is plumbed through but nothing captures it yet (no phone field in the
// checkout form), so it stays absent until such a field is added.
const IDENTITY_KEY = 'pac_identity';

// Merge-and-persist known fields. No-ops server-side, when nothing identifying
// is passed, or if storage is unavailable (private mode / quota).
export function saveIdentity({ email, phone, name } = {}) {
  if (typeof window === 'undefined') return;
  if (!email && !phone) return;
  try {
    const next = {
      ...loadIdentity(),
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {}),
      ...(name ? { name } : {}),
    };
    localStorage.setItem(IDENTITY_KEY, JSON.stringify(next));
  } catch (e) {}
}

// Read the stored identity ({} when absent/unavailable). Never throws.
export function loadIdentity() {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(IDENTITY_KEY) || '{}') || {};
  } catch (e) {
    return {};
  }
}
