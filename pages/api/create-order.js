import { neon } from '@neondatabase/serverless';
import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { db, getTierForUser, tierDiscount } from '../../lib/authdb';
import { printfulFetch, resolveCatalogVariant, hasPrintfulKey } from '../../lib/printful';
import { CATALOG, getPrice } from '../../lib/printful-catalog';
import { hasStripe, retrievePaymentIntent } from '../../lib/stripe';
import { hasGhl, upsertContact as ghlUpsert } from '../../lib/ghl';
import { verifyToken } from '../../lib/order-token';
import { checkRateLimit } from '../../lib/rate-limit';
import { sanitizeRecipient, sameOrigin } from '../../lib/sanitize';
import { isIpBlocked, recordAuthFailure, logSecurityEvent } from '../../lib/security';

export const dynamic = 'force-dynamic';

const bad = (res, code, error) => res.status(code).json({ error });

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  return req.socket?.remoteAddress || '';
}

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

// CRM push after an order is recorded. Fire-and-forget: no-ops without GHL
// config, and failures here must never fail the order response. GHL is the sole
// CRM + messaging system of record — any owner alert or customer receipt SMS is
// fired by a GHL automation (triggered off the tag/journey stage below) natively
// via Signal House.
async function notifyOrder({ orderId, productName, size, qty, price, recipient, paid }) {
  try {
    if (hasGhl() && (recipient?.email || recipient?.phone)) {
      await ghlUpsert({
        email: recipient.email,
        phone: recipient.phone,
        name: recipient.name,
        tags: ['pac-visitor', 'customer', paid ? 'paid-order' : 'draft-order'],
        custom: {
          journey_stage: paid ? 'buyer' : 'order_started',
          last_order_id: String(orderId),
          last_product: productName,
          ...(price ? { last_order_total: String(price) } : {}),
        },
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
  // Optional gift/personalization (strip control chars but keep newlines in the message).
  const cleanGift = (v, n) => String(v || "").replace(/[\x00-\x1F\x7F]/g, " ").trim().slice(0, n);
  const giftMessage = cleanGift(body.gift_message, 200);
  const giftRecipient = cleanGift(body.gift_recipient, 50);
  const giftOccasion = cleanGift(body.gift_occasion, 40);
  const ip = clientIp(req);

  // --- anti-abuse gate ---
  // Reject cross-site browser-forged POSTs (Origin/Referer must match host when
  // present), and IPs auto-blocked after repeated auth failures.
  if (!sameOrigin(req)) return bad(res, 403, 'Cross-origin request rejected.');
  if (await isIpBlocked(ip)) {
    await logSecurityEvent({ ip, ua: req.headers['user-agent'], endpoint: 'create-order', result: 'ip_blocked' });
    return bad(res, 403, 'Temporarily blocked. Try again later.');
  }
  // Require a valid short-lived session token (proves a real browser session ran
  // our checkout, not a blind script). Enforcement is skipped only when
  // ORDER_TOKEN_SECRET is unset (unconfigured => fail open). Then rate-limit
  // orders per IP so the endpoint can't be scripted to spam SMS/CRM/orders.
  const tokenCheck = verifyToken(body.session_token);
  if (!tokenCheck.valid && tokenCheck.reason !== 'not_configured') {
    await recordAuthFailure(ip);
    await logSecurityEvent({ ip, ua: req.headers['user-agent'], endpoint: 'create-order', result: 'bad_token', meta: { reason: tokenCheck.reason } });
    return bad(res, 403, 'Invalid or expired session. Please reload the page and try again.');
  }
  const rl = await checkRateLimit({ scope: 'order', ip, limit: 10, windowSeconds: 3600 });
  if (!rl.allowed) return bad(res, 429, 'Too many orders from this address. Please try again later.');

  // --- auth gate (real, server-side) ---
  // Ordering is open to any signed-in user; tier only sets the discount applied
  // below (not access). Reject anonymous callers. Must stay in sync with the
  // create-payment-intent gate so a charge is never taken without an order.
  let authSession = null;
  try { authSession = await getServerSession(req, res, authOptions); } catch (e) {}
  if (!authSession?.user?.id) {
    return bad(res, 401, 'Please sign in to order.');
  }
  let callerTier = 'free';
  try { callerTier = await getTierForUser(db(), authSession.user.id); } catch (e) { callerTier = 'free'; }

  // --- validation ---
  if (!productName || !CATALOG[productName]) return bad(res, 400, 'Unknown or missing product');
  if (!print_url) return bad(res, 400, 'Missing print_url (museum image URL)');
  const qty = Math.max(1, Math.min(parseInt(quantity) || 1, 25));
  // Sanitize recipient (length caps, HTML/control-char stripping, format checks).
  const { recipient: r, errors: recipientErrors } = sanitizeRecipient(recipient);
  for (const f of ['name', 'address1', 'city', 'country_code', 'zip']) {
    if (!r[f]) return bad(res, 400, `Missing recipient.${f}`);
  }
  if (recipientErrors.length) return bad(res, 400, `Invalid recipient field(s): ${recipientErrors.join(', ')}`);

  const cfg = CATALOG[productName];
  // Apply the member discount so the recorded + Printful retail price matches the
  // discounted amount actually charged in create-payment-intent for this tier.
  const basePrice = getPrice(productName, size);
  const discount = tierDiscount(callerTier);
  const price = discount && basePrice
    ? (parseFloat(basePrice) * (1 - discount)).toFixed(2)
    : basePrice;
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
    catch (e) { console.error('create-order: payment verify failed:', e); return bad(res, 502, 'Could not verify payment'); }
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
    console.error('create-order: printful catalog lookup failed:', e);
    return bad(res, 502, 'Printful catalog lookup failed');
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
    // Optional gift message — printed on the Printful packing slip. `gift` is a
    // real Printful order field; we do NOT send a `notes` field (not supported,
    // would risk the order being rejected).
    gift: giftMessage ? {
      subject: giftOccasion ? giftOccasion.replace(/_/g, ' ') : 'A gift for you',
      message: giftMessage + (giftRecipient ? '\n\nFor: ' + giftRecipient : ''),
    } : undefined,
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

  if (errMsg) { console.error('create-order: printful rejected order:', errMsg); return bad(res, 502, 'Order saved but could not be submitted for fulfillment'); }
  await notifyOrder({ orderId: rows[0].id, productName, size, qty, price, recipient: r, paid });
  await logSecurityEvent({ ip, ua: req.headers['user-agent'], endpoint: 'create-order', result: 'ok', meta: { orderId: rows[0].id, paid } });
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
