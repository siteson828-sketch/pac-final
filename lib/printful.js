// Minimal Printful API (v1) client. Requires the PRINTFUL_API_KEY env var
// (add it in Vercel → Project → Settings → Environment Variables).
const PRINTFUL_BASE = 'https://api.printful.com';

export function hasPrintfulKey() {
  return !!process.env.PRINTFUL_API_KEY;
}

export async function printfulFetch(path, { method = 'GET', body } = {}) {
  const key = process.env.PRINTFUL_API_KEY;
  if (!key) throw new Error('PRINTFUL_API_KEY not configured');
  const res = await fetch(`${PRINTFUL_BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = {};
  try { data = await res.json(); } catch (e) {}
  if (!res.ok) {
    const msg = data?.error?.message || data?.error || `Printful HTTP ${res.status}`;
    throw new Error(typeof msg === 'string' ? msg : `Printful HTTP ${res.status}`);
  }
  return data.result !== undefined ? data.result : data;
}

// Resolve a catalog product's per-size variant id at runtime, so we never hardcode
// brittle variant IDs — only the top-level product id lives in config. Matches the
// requested size against the live catalog by normalized comparison.
export async function resolveCatalogVariant(productId, sizeLabel) {
  const result = await printfulFetch(`/products/${productId}`);
  const variants = result?.variants || [];
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const target = norm(sizeLabel);
  let v = null;
  if (target) {
    v = variants.find(x => norm(x.size) === target)
      || variants.find(x => norm(x.size).includes(target) || norm(x.name).includes(target));
  }
  if (!v && variants.length === 1) v = variants[0]; // single-variant products (e.g. one-size tote)
  if (!v) {
    const available = variants.map(x => x.size).filter(Boolean);
    return { error: `no variant matched size "${sizeLabel}"`, available };
  }
  return { variant_id: v.id, name: v.name, size: v.size };
}
