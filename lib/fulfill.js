import { CATALOG } from './printful-catalog';
import { retrievePaymentIntent } from './stripe';
import { printfulFetch, resolveCatalogVariant, hasPrintfulKey } from './printful';

// Paid-order safety net.
//
// Problem this solves: the browser used to be the ONLY thing that sent a paid
// order to Printful. If the customer closed the tab (or Printful hiccuped)
// right after paying, the card was charged and nothing shipped.
//
// Now every paid order is (1) saved server-side in `pending_orders` when the
// PaymentIntent is created, and (2) fulfilled by ONE guarded function that can be
// triggered by the browser, the Stripe webhook, or the reconcile cron. An atomic
// claim guarantees a given payment creates at most one Printful order.

export async function ensureFulfillTables(sql) {
  await sql`CREATE TABLE IF NOT EXISTS pending_orders (
    payment_intent_id TEXT PRIMARY KEY,
    created_at TIMESTAMP DEFAULT NOW(),
    claimed_at TIMESTAMP,
    status TEXT DEFAULT 'pending',
    attempts INT DEFAULT 0,
    last_error TEXT,
    user_id TEXT,
    product TEXT, size TEXT, quantity INT,
    print_url TEXT, work_title TEXT, retail_price TEXT,
    recipient JSONB, gift JSONB
  )`;
  await sql`CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP DEFAULT NOW(),
    product TEXT, size TEXT, material TEXT, frame TEXT, quantity INT,
    print_url TEXT, work_title TEXT, retail_price TEXT,
    recipient JSONB,
    printful_order_id TEXT, printful_status TEXT,
    status TEXT, error TEXT
  )`;
  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_intent_id TEXT`;
  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT`;
  // One Printful order per payment, enforced by the database too. Best effort:
  // skipped silently if old duplicate rows already exist.
  try {
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS orders_pi_printful_uniq
              ON orders (payment_intent_id) WHERE printful_order_id IS NOT NULL`;
  } catch (e) {}
}

// Save the order details at payment start. First writer wins (ON CONFLICT DO
// NOTHING) so a later browser call can't overwrite what the server stored.
export async function savePendingOrder(sql, p) {
  await ensureFulfillTables(sql);
  await sql`INSERT INTO pending_orders
    (payment_intent_id, user_id, product, size, quantity, print_url, work_title, retail_price, recipient, gift)
    VALUES (${p.payment_intent_id}, ${p.user_id ? String(p.user_id) : null}, ${p.product}, ${p.size || ''},
            ${p.quantity || 1}, ${p.print_url}, ${p.work || ''}, ${p.retail_price || null},
            ${JSON.stringify(p.recipient)}, ${JSON.stringify(p.gift || {})})
    ON CONFLICT (payment_intent_id) DO NOTHING`;
}

// Submit one PAID order to Printful, exactly once. Safe to call repeatedly and
// concurrently. `deps` exists only so tests can stub Stripe/Printful.
export async function fulfillPaidOrder(sql, piId, deps = {}) {
  const d = { retrievePaymentIntent, resolveCatalogVariant, printfulFetch, hasPrintfulKey, ...deps };
  await ensureFulfillTables(sql);

  // Already sent to Printful for this payment? Done.
  const done = await sql`SELECT id, printful_order_id, printful_status FROM orders
                         WHERE payment_intent_id=${piId} AND printful_order_id IS NOT NULL LIMIT 1`;
  if (done.length) {
    await sql`UPDATE pending_orders SET status='fulfilled' WHERE payment_intent_id=${piId} AND status<>'fulfilled'`;
    return { ok: true, already: true, orderId: done[0].id, printful_order_id: done[0].printful_order_id };
  }

  // Atomic claim: only one caller wins. A claim abandoned >3 minutes ago (a
  // crashed function) can be taken over.
  const claimed = await sql`UPDATE pending_orders
    SET status='processing', claimed_at=NOW(), attempts=attempts+1
    WHERE payment_intent_id=${piId}
      AND (status IN ('pending','failed') OR (status='processing' AND claimed_at < NOW() - INTERVAL '3 minutes'))
    RETURNING *`;
  if (!claimed.length) {
    const ex = await sql`SELECT status FROM pending_orders WHERE payment_intent_id=${piId}`;
    if (!ex.length) return { ok: false, reason: 'no_pending' };
    if (ex[0].status === 'fulfilled') return { ok: true, already: true };
    return { ok: true, inProgress: true };
  }
  const row = claimed[0];

  const setStatus = (status, err, undoAttempt) => sql`UPDATE pending_orders
    SET status=${status}, last_error=${err || null},
        attempts = attempts - ${undoAttempt ? 1 : 0}
    WHERE payment_intent_id=${piId}`;

  try {
    const pi = await d.retrievePaymentIntent(piId);
    if (pi?.status !== 'succeeded') {
      await setStatus('pending', `payment ${pi?.status || 'unknown'}`, true);
      return { ok: false, reason: 'not_paid', status: pi?.status };
    }
    if (!d.hasPrintfulKey()) {
      await setStatus('failed', 'PRINTFUL_API_KEY not set');
      return { ok: false, reason: 'no_printful_key', retry: true, error: 'PRINTFUL_API_KEY not set' };
    }
    const cfg = CATALOG[row.product];
    if (!cfg) {
      await setStatus('failed', `unknown product ${row.product}`);
      return { ok: false, reason: 'bad_product', error: `unknown product ${row.product}` };
    }

    const variant = await d.resolveCatalogVariant(cfg.printfulProductId, row.size);
    if (!variant || variant.error) {
      const msg = `Could not map "${row.product} / ${row.size || '(no size)'}" to a Printful variant`;
      await setStatus('failed', msg);
      return { ok: false, reason: 'variant', retry: true, error: msg };
    }

    const r = row.recipient || {};
    const g = row.gift || {};
    const payload = {
      recipient: {
        name: r.name, email: r.email || undefined, phone: r.phone || undefined,
        address1: r.address1, city: r.city, state_code: r.state_code || undefined,
        country_code: r.country_code, zip: r.zip,
      },
      items: [{
        variant_id: variant.variant_id,
        quantity: row.quantity || 1,
        files: [{ url: row.print_url }],
        retail_price: row.retail_price || undefined,
        name: `${row.work_title || row.product}${row.size ? ` — ${row.size}` : ''} (${row.product})`,
      }],
      confirmed: true, // payment already verified above
      gift: g.message ? {
        subject: g.occasion ? String(g.occasion).replace(/_/g, ' ') : 'A gift for you',
        message: g.message + (g.recipient ? '\n\nFor: ' + g.recipient : ''),
      } : undefined,
    };

    let pf;
    try {
      pf = await d.printfulFetch('/orders', { method: 'POST', body: payload });
    } catch (e) {
      await setStatus('failed', String(e.message || e).slice(0, 500));
      return { ok: false, reason: 'printful', retry: true, error: e.message };
    }

    let orderId = null;
    try {
      const ins = await sql`INSERT INTO orders
        (product,size,quantity,print_url,work_title,retail_price,recipient,printful_order_id,printful_status,status,payment_intent_id,payment_status)
        VALUES (${row.product},${row.size || ''},${row.quantity || 1},${row.print_url},${row.work_title || ''},${row.retail_price},
                ${JSON.stringify(r)},${String(pf.id)},${pf.status || null},'order_confirmed',${piId},'succeeded')
        RETURNING id`;
      orderId = ins[0]?.id;
    } catch (e) {
      // Printful order exists; only our bookkeeping failed. Never retry (would duplicate).
      console.error('fulfill: orders insert failed after Printful success:', e.message);
    }
    await setStatus('fulfilled', null);
    return { ok: true, orderId, printful_order_id: pf.id, printful_status: pf.status, retail_price: row.retail_price };
  } catch (e) {
    await setStatus('failed', String(e.message || e).slice(0, 500));
    return { ok: false, reason: 'error', retry: true, error: e.message };
  }
}
