export const dynamic = 'force-dynamic';

// Printful setup/verification helper (read-only). Returns your store info plus
// the first 30 global catalog products so you can confirm real product IDs for
// lib/printful-catalog.js. Gated by SYNC_SECRET.
//
// Uses PRINTFUL_API_KEY (the env var the rest of the app uses). If it is not
// set, key_configured is false and calls fail.
export default async function handler(req, res) {
  if (req.query.secret !== process.env.SYNC_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const key = process.env.PRINTFUL_API_KEY;
  if (!key) {
    return res.status(400).json({ error: 'PRINTFUL_API_KEY not configured', key_configured: false });
  }

  try {
    const headers = { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' };
    const [store, products] = await Promise.all([
      fetch('https://api.printful.com/store', { headers }).then(r => r.json()),
      fetch('https://api.printful.com/products', { headers }).then(r => r.json()),
    ]);

    return res.status(200).json({
      key_configured: true,
      store: store.result,
      products: products.result?.slice(0, 30),
    });
  } catch (e) {
    console.error('printful-catalog error:', e);
    return res.status(502).json({ error: 'Could not connect to Printful' });
  }
}

export const config = { maxDuration: 30 };
