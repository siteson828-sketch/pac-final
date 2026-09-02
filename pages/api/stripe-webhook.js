import { db, ensureAuthTables } from '../../lib/authdb';
import { constructWebhookEvent, retrieveSubscription } from '../../lib/stripe';
import { ensureGivingTable, recordGiving } from '../../lib/giving';

// Stripe webhook: keeps users.tier in sync with subscription lifecycle.
// Requires the RAW body for signature verification, so Next's body parser is off.
export const config = { api: { bodyParser: false } };

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks);
}

function tierForPrice(priceId) {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_EXPLORER) return 'explorer';
  if (priceId === process.env.STRIPE_PRICE_COLLECTOR) return 'collector';
  if (priceId === process.env.STRIPE_PRICE_PATRON) return 'patron';
  return null;
}

const toIso = sec => (sec ? new Date(sec * 1000).toISOString() : null);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let event;
  try {
    const raw = await readRawBody(req);
    event = constructWebhookEvent(raw, req.headers['stripe-signature'], process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    console.error('stripe-webhook signature error:', e.message);
    return res.status(400).json({ error: `Webhook Error: ${e.message}` });
  }

  try {
    const sql = db();
    await ensureAuthTables(sql);
    await ensureGivingTable(sql);
    const obj = event.data.object;

    // Record 35% into the giving fund, isolated so a giving failure can NEVER
    // block the tier update below (which is the webhook's primary job).
    const logGiving = async (args) => {
      try { await recordGiving(sql, args); }
      catch (e) { console.error('giving record error:', e.message); }
    };

    switch (event.type) {
      case 'checkout.session.completed': {
        const userId = parseInt(obj.client_reference_id, 10);
        const tier = obj.metadata?.tier;
        const customerId = obj.customer || null;
        const subId = obj.subscription || null;
        let subEnd = null;
        if (subId) {
          try { const sub = await retrieveSubscription(subId); subEnd = toIso(sub.current_period_end); }
          catch (e) { /* period end will land via subscription.updated */ }
        }
        if (Number.isFinite(userId) && tier) {
          await sql`UPDATE users SET tier=${tier}, stripe_customer_id=${customerId},
                    stripe_subscription_id=${subId}, subscription_end=${subEnd} WHERE id=${userId}`;
        }
        // First (signup) payment → giving fund. Dedup by subscription id so a
        // retried delivery of this event can't double-record.
        if (tier) {
          const addr = obj.customer_details?.address || {};
          await logGiving({
            tier,
            subscriberEmail: obj.customer_details?.email || obj.metadata?.email,
            subscriberName: obj.customer_details?.name,
            city: addr.city, state: addr.state, country: addr.country,
            stripeSubscriptionId: subId,
            dedupeKey: subId ? `sub:${subId}:signup` : `sess:${obj.id}`,
          });
        }
        break;
      }
      // Recurring monthly renewals. Only delivered if 'invoice.payment_succeeded'
      // is enabled on the Stripe webhook endpoint; harmless no-op until then.
      // Skipped for the very first invoice (billing_reason 'subscription_create'),
      // which checkout.session.completed already recorded.
      case 'invoice.payment_succeeded': {
        if (obj.billing_reason === 'subscription_create') break;
        const priceId = obj.lines?.data?.[0]?.price?.id;
        const tier = tierForPrice(priceId);
        if (tier) {
          const addr = obj.customer_address || {};
          await logGiving({
            tier,
            subscriberEmail: obj.customer_email,
            subscriberName: obj.customer_name,
            city: addr.city, state: addr.state, country: addr.country,
            stripeSubscriptionId: obj.subscription || null,
            dedupeKey: `inv:${obj.id}`,
          });
        }
        break;
      }
      case 'customer.subscription.updated': {
        const priceId = obj.items?.data?.[0]?.price?.id;
        const tier = tierForPrice(priceId);
        const active = ['active', 'trialing'].includes(obj.status);
        const newTier = active && tier ? tier : 'free';
        const subEnd = active ? toIso(obj.current_period_end) : null;
        await sql`UPDATE users SET tier=${newTier}, subscription_end=${subEnd},
                  stripe_customer_id=COALESCE(stripe_customer_id, ${obj.customer || null})
                  WHERE stripe_subscription_id=${obj.id} OR stripe_customer_id=${obj.customer || null}`;
        break;
      }
      case 'customer.subscription.deleted': {
        await sql`UPDATE users SET tier='free', subscription_end=NULL
                  WHERE stripe_subscription_id=${obj.id} OR stripe_customer_id=${obj.customer || null}`;
        break;
      }
      default:
        break;
    }
  } catch (e) {
    console.error('stripe-webhook handler error:', e.message);
    // Return 200 anyway so Stripe doesn't hammer retries on a transient DB blip;
    // subscription.updated events will reconcile tier on the next cycle.
    return res.status(200).json({ received: true, warning: 'handler error logged' });
  }

  return res.status(200).json({ received: true });
}
