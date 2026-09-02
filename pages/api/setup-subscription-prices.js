export const dynamic = 'force-dynamic';

// One-time setup helper (gated by SYNC_SECRET). Programmatically creates the two
// subscription Products + monthly recurring Prices and the Stripe webhook
// endpoint, so no dashboard clicking is needed. Returns the price IDs and the
// webhook signing secret — set these as env vars afterward:
//   STRIPE_PRICE_EXPLORER, STRIPE_PRICE_COLLECTOR, STRIPE_PRICE_PATRON, STRIPE_WEBHOOK_SECRET
//
// GET /api/setup-subscription-prices?secret=<SYNC_SECRET>
// Refuses to run if prices already exist unless &force=1 (avoids duplicates).

import { hasStripe, createProduct, createPrice, createWebhookEndpoint, hasSubscriptionPrices } from '../../lib/stripe';

const WEBHOOK_EVENTS = [
  'checkout.session.completed',
  'customer.subscription.updated',
  'customer.subscription.deleted',
];

// 35% of every membership is set aside to support arts education for children in
// Asheville and Buncombe County; partnerships to deliver the funds are in progress.
const GIVES = ' 35% of your membership is set aside to support arts education for children in Asheville and Buncombe County.';
const TIERS = [
  { key: 'explorer', name: 'Explorer', amount: 999, description: 'Browse 1.9M+ museum artworks, AI search, gigapixel zoom, and free screen-quality downloads.' + GIVES },
  { key: 'collector', name: 'Collector', amount: 1999, description: 'Everything in Explorer plus order museum-quality prints with a 10% member discount.' + GIVES },
  { key: 'patron', name: 'Patron', amount: 4999, description: 'Everything in Collector with a 20% member discount, higher-res downloads, and priority handling.' + GIVES },
];

export default async function handler(req, res) {
  if (req.query.secret !== process.env.SYNC_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!hasStripe()) return res.status(501).json({ error: 'STRIPE_SECRET_KEY not configured' });
  if (hasSubscriptionPrices() && req.query.force !== '1') {
    return res.status(409).json({ error: 'Subscription prices already configured. Pass &force=1 to create new ones.' });
  }

  const origin = 'https://www.publicartcollections.net';
  try {
    const prices = {};
    for (const t of TIERS) {
      const product = await createProduct({ name: `Public Art Collections — ${t.name}`, description: t.description });
      const price = await createPrice({ productId: product.id, unitAmount: t.amount });
      prices[t.key] = { productId: product.id, priceId: price.id, amount: t.amount };
    }
    const webhook = await createWebhookEndpoint({ url: `${origin}/api/stripe-webhook`, events: WEBHOOK_EVENTS });

    return res.status(200).json({
      ok: true,
      note: 'Set these as Vercel env vars, then redeploy.',
      STRIPE_PRICE_EXPLORER: prices.explorer.priceId,
      STRIPE_PRICE_COLLECTOR: prices.collector.priceId,
      STRIPE_PRICE_PATRON: prices.patron.priceId,
      STRIPE_WEBHOOK_SECRET: webhook.secret,
      webhookId: webhook.id,
      webhookUrl: webhook.url,
    });
  } catch (e) {
    console.error('setup-subscription-prices error:', e.message);
    return res.status(502).json({ error: e.message });
  }
}
