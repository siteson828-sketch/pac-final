import { hasStripe, createPaymentIntent } from '../../lib/stripe';
import { CATALOG, getPrice } from '../../lib/printful-catalog';

export const dynamic = 'force-dynamic';

// Creates a Stripe PaymentIntent for a product order. The amount is computed
// server-side from the catalog (never trusted from the client). Returns the
// client_secret for Stripe Elements to confirm on the browser. Responds 501
// when Stripe isn't configured so the client can fall back gracefully.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!hasStripe()) return res.status(501).json({ error: 'Stripe not configured', configured: false });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};

  const { productName, size, quantity, work } = body;
  if (!productName || !CATALOG[productName]) return res.status(400).json({ error: 'Unknown or missing product' });

  const qty = Math.max(1, Math.min(parseInt(quantity) || 1, 25));
  const unit = getPrice(productName, size);
  const unitCents = Math.round(parseFloat(unit || '0') * 100);
  if (!unitCents) return res.status(400).json({ error: 'Could not price this product' });
  const amountCents = unitCents * qty;

  try {
    const pi = await createPaymentIntent({
      amountCents,
      currency: 'usd',
      metadata: { product: productName, size: size || '', quantity: String(qty), work: work || '' },
    });
    return res.status(200).json({
      configured: true,
      client_secret: pi.client_secret,
      payment_intent_id: pi.id,
      amount: amountCents,
      currency: 'usd',
    });
  } catch (e) {
    console.error('create-payment-intent error:', e);
    return res.status(502).json({ error: 'Could not start checkout' });
  }
}

export const config = { maxDuration: 30 };
