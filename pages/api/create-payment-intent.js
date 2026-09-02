import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { hasStripe, createPaymentIntent } from '../../lib/stripe';
import { CATALOG, getPrice } from '../../lib/printful-catalog';
import { checkRateLimit } from '../../lib/rate-limit';
import { cleanStr, isEmail, sameOrigin, clientIp } from '../../lib/sanitize';
import { db, getTierForUser, tierDiscount } from '../../lib/authdb';

export const dynamic = 'force-dynamic';

// Creates a Stripe PaymentIntent for a product order. The amount is computed
// server-side from the catalog (never trusted from the client). Returns the
// client_secret for Stripe Elements to confirm on the browser. Responds 501
// when Stripe isn't configured so the client can fall back gracefully.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!sameOrigin(req)) return res.status(403).json({ error: 'Cross-origin request rejected' });
  if (!hasStripe()) return res.status(501).json({ error: 'Stripe not configured', configured: false });

  // Rate limit so the endpoint can't be scripted to create endless PaymentIntents.
  const rl = await checkRateLimit({ scope: 'payment-intent', ip: clientIp(req), limit: 20, windowSeconds: 600 });
  if (!rl.allowed) return res.status(429).json({ error: 'Too many requests. Please try again shortly.' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};

  const productName = cleanStr(body.productName, 60);
  const size = cleanStr(body.size, 40);
  const work = cleanStr(body.work, 200);
  const emailRaw = cleanStr(body.email, 254);
  const receiptEmail = isEmail(emailRaw) ? emailRaw : undefined; // for the Stripe receipt
  const giftMessage = cleanStr(body.gift_message, 200);
  const giftRecipient = cleanStr(body.gift_recipient, 50);
  const giftOccasion = cleanStr(body.gift_occasion, 40);
  if (!productName || !CATALOG[productName]) return res.status(400).json({ error: 'Unknown or missing product' });

  const qty = Math.max(1, Math.min(parseInt(body.quantity) || 1, 25));
  const unit = getPrice(productName, size);
  const unitCents = Math.round(parseFloat(unit || '0') * 100);
  if (!unitCents) return res.status(400).json({ error: 'Could not price this product' });

  // Ordering is open to any signed-in user. Membership tiers grant an order
  // discount (see tierDiscount below), not access — anonymous users must sign in.
  let session = null;
  try { session = await getServerSession(req, res, authOptions); } catch (e) {}
  if (!session?.user?.id) return res.status(401).json({ error: 'Please sign in to order prints.' });
  let tier = 'free';
  try { tier = await getTierForUser(db(), session.user.id); } catch (e) {}

  const discount = tierDiscount(tier);
  const amountCents = Math.round(unitCents * qty * (1 - discount));

  try {
    const pi = await createPaymentIntent({
      amountCents,
      currency: 'usd',
      receiptEmail,
      metadata: { product: productName, size: size || '', quantity: String(qty), work: work || '', tier, discount: String(discount),
        gift_message: giftMessage || '', gift_recipient: giftRecipient || '', gift_occasion: giftOccasion || '' },
    });
    return res.status(200).json({
      configured: true,
      client_secret: pi.client_secret,
      payment_intent_id: pi.id,
      amount: amountCents,
      full_amount: unitCents * qty,
      discount,
      tier,
      currency: 'usd',
    });
  } catch (e) {
    console.error('create-payment-intent error:', e);
    return res.status(502).json({ error: 'Could not start checkout' });
  }
}

export const config = { maxDuration: 30 };
