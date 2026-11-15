import { neon } from '@neondatabase/serverless';
import { ensureFulfillTables, fulfillPaidOrder } from '../../lib/fulfill';

export const dynamic = 'force-dynamic';

// Safety sweep (Vercel cron, every 15 min). Finds print orders that were saved at
// payment start but never reached Printful (webhook missed, Printful was down,
// browser closed) and submits the PAID ones. Unpaid/abandoned checkouts are
// detected via Stripe and left alone. Auth: Authorization: Bearer CRON_SECRET
// (or SYNC_SECRET for a manual run).
const MAX_ATTEMPTS = 40;

export default async function handler(req, res) {
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const ok = token && ((process.env.CRON_SECRET && token === process.env.CRON_SECRET) ||
                       (process.env.SYNC_SECRET && token === process.env.SYNC_SECRET));
  if (!ok) return res.status(401).json({ error: 'Unauthorized' });

  const sql = neon(process.env.DATABASE_URL);
  await ensureFulfillTables(sql);

  // Old unpaid checkouts are just abandoned carts: stop re-checking them.
  await sql`UPDATE pending_orders SET status='abandoned'
            WHERE status='pending' AND created_at < NOW() - INTERVAL '2 days'`;

  const rows = await sql`SELECT payment_intent_id FROM pending_orders
    WHERE status IN ('pending','failed','processing')
      AND created_at < NOW() - INTERVAL '5 minutes'
      AND attempts < ${MAX_ATTEMPTS}
    ORDER BY created_at LIMIT 15`;

  const results = [];
  for (const r of rows) {
    try {
      const out = await fulfillPaidOrder(sql, r.payment_intent_id);
      results.push({ pi: r.payment_intent_id, ok: out.ok, reason: out.reason || (out.already ? 'already' : out.inProgress ? 'in_progress' : 'submitted') });
      if (!out.ok && out.retry) console.error('reconcile-orders: still failing', r.payment_intent_id, out.error);
    } catch (e) {
      console.error('reconcile-orders error', r.payment_intent_id, e.message);
      results.push({ pi: r.payment_intent_id, ok: false, reason: 'exception' });
    }
  }

  const stuck = await sql`SELECT payment_intent_id, product, last_error, attempts, created_at FROM pending_orders
    WHERE status='failed' ORDER BY created_at DESC LIMIT 20`;
  if (stuck.length) console.error('reconcile-orders: PAID ORDERS NOT YET SHIPPED:', JSON.stringify(stuck));

  return res.status(200).json({ checked: rows.length, results, failing: stuck });
}

export const config = { maxDuration: 60 };
