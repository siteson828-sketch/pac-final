export const dynamic = 'force-dynamic';

// Read-only Printful catalog explorer used to build the product selector.
// Gated by SYNC_SECRET. Uses PRINTFUL_API_KEY (the env var the rest of the app uses).
//
// Two modes:
//   GET /api/setup-products?secret=...
//       -> every catalog product grouped into 4 store buckets
//          (Wall Art, Apparel, Accessories, Home & Living), each with
//          id, title, image, type and variant_count. ONE Printful call — fast.
//
//   GET /api/setup-products?secret=...&id=<productId>
//       -> full variant list (id, size, color, price, name) + price range for a
//          single product. Fetch this on demand when wiring a product into
//          lib/printful-catalog.js — do NOT try to pull variants for all 500+
//          products at once (hundreds of calls => rate limits + timeouts).
//
// NOTE: the app resolves the per-size variant id at runtime (see
// resolveCatalogVariant in lib/printful.js). This endpoint is a build/setup aid
// for choosing product ids, sizes and prices — it does not itself add products.

import { clientIp } from '../../lib/sanitize';
import { isIpBlocked, recordAuthFailure, logSecurityEvent } from '../../lib/security';

const PRINTFUL_BASE = 'https://api.printful.com';

// Map a Printful category title into one of the store's 4 buckets by keyword.
const BUCKETS = [
  ['Wall Art',       ['poster', 'canvas', 'framed', 'metal print', 'wall art', 'print']],
  ['Apparel',        ['shirt', 'tee', 'hoodie', 'sweatshirt', 'sweatpant', 'jogger', 'tank',
                      'dress', 'legging', 'short', 'sock', 'hat', 'cap', 'beanie', 'snapback',
                      'trucker', 'visor', 'bra', 'jacket', 'vest', 'pant', 'skirt', 'crop',
                      'bodysuit', 'swim', 'polo', 'knitwear', 'underwear', 'clothing', 'flip flop']],
  ['Home & Living',  ['mug', 'pillow', 'blanket', 'towel', 'tumbler', 'bottle', 'candle',
                      'coaster', 'apron', 'glass', 'home', 'magnet', 'mouse pad', 'tableware',
                      'drinkware', 'living']],
  // Accessories is the catch-all (bags, cases, stickers, stationery, pins, etc.)
];

function bucketFor(categoryTitle, type) {
  const hay = `${categoryTitle || ''} ${type || ''}`.toLowerCase();
  for (const [name, kws] of BUCKETS) {
    if (kws.some(kw => hay.includes(kw))) return name;
  }
  return 'Accessories';
}

async function pf(path, key) {
  const res = await fetch(`${PRINTFUL_BASE}${path}`, {
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.message || data?.error || `Printful HTTP ${res.status}`);
  return data.result;
}

export default async function handler(req, res) {
  const ip = clientIp(req);
  if (await isIpBlocked(ip)) return res.status(403).json({ error: 'Temporarily blocked' });
  if (req.query.secret !== process.env.SYNC_SECRET) {
    await recordAuthFailure(ip);
    await logSecurityEvent({ ip, ua: req.headers['user-agent'], endpoint: 'setup-products', result: 'unauthorized' });
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const key = process.env.PRINTFUL_API_KEY;
  if (!key) return res.status(400).json({ error: 'PRINTFUL_API_KEY not configured', key_configured: false });

  try {
    // --- single-product detail mode ---
    if (req.query.id) {
      const detail = await pf(`/products/${encodeURIComponent(req.query.id)}`, key);
      const variants = (detail.variants || []).map(v => ({
        variant_id: v.id, size: v.size, color: v.color, price: v.price, name: v.name,
      }));
      const prices = variants.map(v => parseFloat(v.price)).filter(n => !isNaN(n));
      return res.status(200).json({
        key_configured: true,
        product: {
          id: detail.product.id,
          title: detail.product.title,
          type: detail.product.type,
          image: detail.product.image,
        },
        sizes: [...new Set(variants.map(v => v.size).filter(Boolean))],
        price_range: prices.length ? { min: Math.min(...prices), max: Math.max(...prices) } : null,
        variants,
      });
    }

    // --- grouped catalog mode (one call) ---
    const [products, categories] = await Promise.all([
      pf('/products', key),
      pf('/categories', key),
    ]);
    const catName = {};
    for (const c of (categories.categories || categories)) catName[c.id] = c.title;

    const groups = { 'Wall Art': [], 'Apparel': [], 'Home & Living': [], 'Accessories': [] };
    for (const p of products) {
      const bucket = bucketFor(catName[p.main_category_id], p.type);
      groups[bucket].push({
        id: p.id,
        title: p.title,
        type: p.type,
        image: p.image,
        variant_count: p.variant_count,
        category: catName[p.main_category_id] || null,
      });
    }
    for (const k of Object.keys(groups)) groups[k].sort((a, b) => a.id - b.id);

    return res.status(200).json({
      key_configured: true,
      total: products.length,
      counts: Object.fromEntries(Object.entries(groups).map(([k, v]) => [k, v.length])),
      groups,
      note: 'For variant ids + prices of a specific product, call again with &id=<productId>.',
    });
  } catch (e) {
    console.error('setup-products error:', e);
    return res.status(502).json({ error: e.message || 'Could not connect to Printful' });
  }
}

export const config = { maxDuration: 30 };
