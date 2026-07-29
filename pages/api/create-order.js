import { neon } from '@neondatabase/serverless';
import { printfulFetch, resolveCatalogVariant, hasPrintfulKey } from '../../lib/printful';
import { CATALOG, getPrice } from '../../lib/printful-catalog';
import { hasStripe, retrievePaymentIntent } from '../../lib/stripe';
import { hasTwilio, sendSms } from '../../lib/twilio';
import { hasBloo, upsertContact } from '../../lib/bloo';

export const dynamic = 'force-dynamic';

const bad = (res, code, error) => res.status(code).json({ error });

async function ensureTable(sql) {
  await sql`CREATE TABLE IF NOT EXISTS orders (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP DEFAULT NOW(),
    product TEXT, size TEXT, material TEXT, frame TEXT, quantity INT,
    print_url TEXT, work_title TEXT, retail_price TEXT,
    recipient JSONB,
    printful_order_id TEXT, printful_status TEXT,
    status TEXT, error TEXT
  )`;
  // Payment columns (added idempotently for tables created before Stripe wiring).
  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_intent_id TEXT`;
  await sql`ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_status TEXT`;
}

// Owner SMS + CRM push after an order is recorded. Fire-and-forget: all no-op
// without keys, and failures here must never fail the order response.
async function notifyOrder({ orderId, productName, size, qty, price, recipient, paid }) {
  try {
    if (hasTwilio()) {
      await sendSms({
        body: `New order #${orderId} on Public Art Collections\n` +
              `${productName}${size ? ` · ${size}` : ''} × ${qty}` +
              (price ? ` · ${price}` : '') +
              `\nPayment: ${paid ? 'PAID' : 'draft/unpaid'}` +
              `\nShip to: ${recipient?.name || ''} (${recipient?.city || ''}, ${recipient?.country_code || ''})`,
      });
    }
  } catch (e) {}
  try {
    if (hasBloo() && (recipient?.email || recipient?.phone)) {
      await upsertContact({
        email: recipient.email,
        phone: recipient.phone,
        name: recipient.name,
        source: 'Public Art Collections — order',
        tags: ['customer', paid ? 'paid-order' : 'draft-order'],
        custom: { last_order_id: String(orderId) },
      });
    }
  } catch (e) {}
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return bad(res, 405, 'Method not allowed');

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};
  const { productName, size, material, frame, quantity, print_url, recipient, work, payment_intent_id } = body;

  // --- validation ---
  if (!productName || !CATALOG[productName]) return bad(res, 400, 'Unknown or missing product');
  if (!print_url) return bad(res, 400, 'Missing print_url (museum image URL)');
  const qty = Math.max(1, Math.min(parseInt(quantity) || 1, 25));
  const r = recipient || {};
  for (const f of ['name', 'address1', 'city', 'country_code', 'zip']) {
    if (!r[f] || !String(r[f]).trim()) return bad(res, 400, `Missing recipient.${f}`);
  }

  const cfg = CATALOG[productName];
  const price = getPrice(productName, size);
  const sql = neon(process.env.DATABASE_URL);
  await ensureTable(sql);

  // --- payment gate (Stripe "charge then create order") ---
  // If a payment_intent_id is supplied and Stripe is configured, the payment
  // must have succeeded before we create a fulfillment order. Orders placed
  // without a PaymentIntent stay on the legacy no-charge draft path.
  let paid = false;
  let paymentStatus = null;
  if (payment_intent_id) {
    if (!hasStripe()) return bad(res, 400, 'payment_intent_id supplied but Stripe is not configured');
    let pi;
    try { pi = await retrievePaymentIntent(payment_intent_id); }
    catch (e) { return bad(res, 502, `Could not verify payment: ${e.message}`); }
    paymentStatus = pi?.status || 'unknown';
    if (pi?.status !== 'succeeded') return bad(res, 402, `Payment not completed (status: ${paymentStatus})`);
    paid = true;
  }

  // If Printful isn't configured yet, still persist the request so nothing is lost.
  if (!hasPrintfulKey()) {
    const rows = await sql`INSERT INTO orders
      (product,size,material,frame,quantity,print_url,work_title,retail_price,recipient,status,payment_intent_id,payment_status)
      VALUES (${productName},${size || ''},${material || ''},${frame || ''},${qty},${print_url},
              ${work || ''},${price},${JSON.stringify(r)},'pending_no_printful_key',${payment_intent_id || null},${paymentStatus})
      RETURNING id`;
    await notifyOrder({ orderId: rows[0].id, productName, size, qty, price, recipient: r, paid });
    return res.status(202).json({
      ok: true, saved: true, orderId: rows[0].id, printful: false, paid,
      message: 'Order saved. PRINTFUL_API_KEY is not set, so no fulfillment order was created yet.',
    });
  }

  // Resolve the catalog variant from the live Printful catalog (no hardcoded variant ids).
  let variant;
  try {
    variant = await resolveCatalogVariant(cfg.printfulProductId, size);
  } catch (e) {
    return bad(res, 502, `Printful catalog lookup failed: ${e.message}`);
  }
  if (!variant || variant.error) {
    return bad(res, 422,
      `Could not map "${productName} / ${size || '(no size)'}" to a Printful variant` +
      (variant?.available ? ` — available sizes: ${variant.available.join(', ')}.` : '.') +
      ` Verify printfulProductId + size in lib/printful-catalog.js.`);
  }

  // Create a DRAFT order (confirmed:false). You review, pay, and confirm in Printful.
  const payload = {
    recipient: {
      name: r.name,
      email: r.email || undefined,
      phone: r.phone || undefined,
      address1: r.address1,
      city: r.city,
      state_code: r.state_code || undefined,
      country_code: r.country_code,
      zip: r.zip,
    },
    items: [{
      variant_id: variant.variant_id,
      quantity: qty,
      files: [{ url: print_url }], // museum's own full-res URL — we never host the file
      retail_price: price || undefined,
      name: `${work || productName}${size ? ` — ${size}` : ''} (${productName})`,
    }],
    // Auto-confirm the Printful order only when payment already succeeded;
    // otherwise leave it as an unconfirmed draft for manual review.
    confirmed: paid,
  };

  let pfOrder = null, errMsg = null;
  try {
    pfOrder = await printfulFetch('/orders', { method: 'POST', body: payload });
  } catch (e) { errMsg = e.message; }

  const rows = await sql`INSERT INTO orders
    (product,size,material,frame,quantity,print_url,work_title,retail_price,recipient,printful_order_id,printful_status,status,error,payment_intent_id,payment_status)
    VALUES (${productName},${size || ''},${material || ''},${frame || ''},${qty},${print_url},${work || ''},${price},
            ${JSON.stringify(r)},${pfOrder?.id ? String(pfOrder.id) : null},${pfOrder?.status || null},
            ${errMsg ? 'printful_error' : (paid ? 'order_confirmed' : 'draft_created')},${errMsg},${payment_intent_id || null},${paymentStatus})
    RETURNING id`;

  if (errMsg) return bad(res, 502, `Order saved but Printful rejected it: ${errMsg}`);
  await notifyOrder({ orderId: rows[0].id, productName, size, qty, price, recipient: r, paid });
  return res.status(201).json({
    ok: true,
    orderId: rows[0].id,
    printful_order_id: pfOrder.id,
    printful_status: pfOrder.status,
    variant,
    retail_price: price,
    paid,
    message: paid
      ? 'Payment received and order submitted to Printful (confirmed).'
      : 'Draft order created in Printful (unconfirmed). Review, pay & confirm in your Printful dashboard.',
  });
}

export const config = { maxDuration: 60 };
