import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { db, ensureAuthTables, getUserByEmail } from '../../lib/authdb';
import { hasStripe, hasSubscriptionPrices, SUBSCRIPTION_PRICES, createCheckoutSession } from '../../lib/stripe';

export const dynamic = 'force-dynamic';

// Starts a Stripe Checkout Session (subscription mode) for the requested tier.
// Requires an authenticated user; returns { url } to redirect the browser to.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  const tier = (body?.tier || '').toLowerCase();
  if (tier !== 'explorer' && tier !== 'collector' && tier !== 'patron') {
    return res.status(400).json({ error: 'tier must be "explorer", "collector", or "patron"' });
  }

  if (!hasStripe() || !hasSubscriptionPrices()) {
    return res.status(501).json({ error: 'Subscriptions are not configured yet. Run /api/setup-subscription-prices and set the price env vars.' });
  }

  let session = null;
  try { session = await getServerSession(req, res, authOptions); } catch (e) {}
  if (!session?.user?.email) {
    return res.status(401).json({ error: 'Please sign in first.' });
  }

  const priceId = SUBSCRIPTION_PRICES[tier]();
  const origin = 'https://www.publicartcollections.net';

  try {
    // Ensure the user row exists (so the webhook can match by id/email).
    const sql = db();
    await ensureAuthTables(sql);
    const user = await getUserByEmail(sql, session.user.email.toLowerCase());

    const checkout = await createCheckoutSession({
      priceId,
      customerEmail: session.user.email,
      clientReferenceId: user?.id || session.user.id,
      successUrl: `${origin}/viewer?subscribed=${tier}`,
      cancelUrl: `${origin}/pricing?canceled=1`,
      metadata: { tier, userId: String(user?.id || session.user.id || ''), email: session.user.email },
    });
    return res.status(200).json({ url: checkout.url });
  } catch (e) {
    console.error('create-subscription error:', e.message);
    return res.status(502).json({ error: 'Could not start checkout. Please try again.' });
  }
}
