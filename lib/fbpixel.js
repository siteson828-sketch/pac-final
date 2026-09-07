// Facebook Pixel event helper. Deliberately a no-op unless the pixel actually
// loaded — it only loads when NEXT_PUBLIC_FACEBOOK_PIXEL_ID is set (see _app.js).
// This means callers never need their own guard, and a missing/blocked pixel can
// NEVER throw inside a checkout handler (a bare `fbq(...)` would ReferenceError
// and could abort an order mid-flow).
export function fbTrack(event, params) {
  if (typeof window !== 'undefined' && typeof window.fbq === 'function') {
    try { window.fbq('track', event, params); } catch (e) { /* never break UX */ }
  }
}

// Parse a "from $18" / "$44" style price string to a number (18 / 44).
// Returns undefined when there's no parseable amount.
export function priceValue(str) {
  const m = /\$\s*([0-9]+(?:\.[0-9]{1,2})?)/.exec(String(str || ''));
  return m ? parseFloat(m[1]) : undefined;
}
