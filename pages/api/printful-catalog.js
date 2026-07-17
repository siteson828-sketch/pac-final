// Helper to verify Printful catalog product/variant IDs (secret-gated).
//   GET /api/printful-catalog?secret=<SYNC_SECRET>&list=1        -> list catalog products
//   GET /api/printful-catalog?secret=<SYNC_SECRET>&product=<id>  -> list a product's variants
import { printfulFetch, hasPrintfulKey } from '../../lib/printful';

export const dynamic = 'force-dynamic';

export default async function handler(req, res) {
  if (req.query.secret !== process.env.SYNC_SECRET) return res.status(401).json({ error: 'Unauthorized' });
  if (!hasPrintfulKey()) return res.status(400).json({ error: 'PRINTFUL_API_KEY not configured' });
  try {
    if (req.query.product) {
      const r = await printfulFetch(`/products/${encodeURIComponent(req.query.product)}`);
      const variants = (r?.variants || []).map(v => ({ id: v.id, size: v.size, color: v.color, name: v.name }));
      return res.status(200).json({ product_id: req.query.product, title: r?.product?.title, variantCount: variants.length, variants });
    }
    const r = await printfulFetch('/products');
    const products = (r || []).map(p => ({ id: p.id, title: p.title, type: p.type_name }));
    return res.status(200).json({ count: products.length, products });
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
}

export const config = { maxDuration: 30 };
