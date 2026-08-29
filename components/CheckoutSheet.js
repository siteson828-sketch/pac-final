import { useState, useEffect, useRef } from 'react';
import { saveIdentity, loadIdentity } from '../lib/identity';

// Shared checkout sheet — Stripe Elements when configured, otherwise a no-charge
// draft order. Ported verbatim from the viewer's in-place flow so every surface
// (viewer, artwork detail page, …) orders the same way and never navigates off
// the current page. Parent controls visibility via the `checkout` prop
// ({ product, art } to open, null to close) and `onClose`.

// Canonical product list. `name` MUST match a key in lib/printful-catalog.js
// CATALOG; the server resolves the Printful product + per-size variant id at
// runtime. Kept in sync with pages/index.js / pages/viewer.js.
export const PRODUCTS = [
  { emoji: '🖼️', name: 'Fine Art Print', price: 'from $18', sizes: ['8×10"', '11×14"', '16×20"', '24×36"'] },
  { emoji: '🎨', name: 'Canvas Wrap',    price: 'from $45', sizes: ['12×16"', '16×20"', '20×24"', '24×30"'] },
  { emoji: '👕', name: 'T-Shirt',        price: 'from $24', sizes: ['S', 'M', 'L', 'XL', '2XL'] },
  { emoji: '☕', name: 'Mug',            price: 'from $14', sizes: ['11oz', '15oz'] },
  { emoji: '📱', name: 'Phone Case',     price: 'from $22', sizes: ['iPhone 15', 'iPhone 14'] },
  { emoji: '🛍️', name: 'Tote Bag',       price: 'from $29', sizes: ['Standard'] },
  { emoji: '🏛️', name: 'Framed Poster',  price: 'from $45', sizes: ['8×10"', '11×14"', '16×20"', '24×36"'] },
  { emoji: '🪞', name: 'Metal Print',    price: 'from $79', sizes: ['8×10"', '11×14"', '16×20"'] },
  { emoji: '🏷️', name: 'Sticker',        price: 'from $8',  sizes: ['3×3"', '4×4"', '5×5"'] },
  { emoji: '🛋️', name: 'Throw Pillow',   price: 'from $29', sizes: ['14×14"', '16×16"', '18×18"', '22×22"'] },
  { emoji: '🛌', name: 'Throw Blanket',  price: 'from $49', sizes: ['30×40"', '50×60"', '60×80"'] },
  { emoji: '🧥', name: 'Hoodie',         price: 'from $44', sizes: ['S', 'M', 'L', 'XL', '2XL'] },
  { emoji: '🥤', name: 'Tumbler',        price: 'from $24', sizes: ['16oz'] },
  { emoji: '📓', name: 'Notebook',       price: 'from $18', sizes: ['One Size'] },
  { emoji: '💌', name: 'Greeting Card',  price: 'from $5',  sizes: ['4×6"', '5×7"'] },
  { emoji: '🧩', name: 'Jigsaw Puzzle',  price: 'from $29', sizes: ['252 pieces', '520 pieces'] },
];

// Client-side Stripe publishable key (inlined at build). Empty when unset →
// checkout falls back to the legacy no-charge draft-order flow.
const STRIPE_PK = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
const STRIPE_JS = 'https://js.stripe.com/v3';

// Load Stripe.js once via a shared <script id="stripe-js">.
function loadStripeJs() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('no window'));
    if (window.Stripe) return resolve(window.Stripe);
    let s = document.getElementById('stripe-js');
    if (!s) {
      s = document.createElement('script');
      s.id = 'stripe-js';
      s.src = STRIPE_JS;
      document.head.appendChild(s);
    }
    s.addEventListener('load', () => resolve(window.Stripe));
    s.addEventListener('error', () => reject(new Error('Failed to load Stripe.js')));
  });
}

const CO_CSS = `
.co-bg{position:fixed;inset:0;background:rgba(20,17,14,0.78);z-index:400;display:flex;align-items:flex-end;justify-content:center;backdrop-filter:blur(5px)}
.co-sheet{background:var(--ivory);border-radius:4px 4px 0 0;width:100%;max-width:100%;max-height:92vh;max-height:92dvh;overflow-y:auto;-webkit-overflow-scrolling:touch;position:relative;box-shadow:0 -8px 40px rgba(20,17,14,0.35);display:flex;flex-direction:column;animation:slideUp .28s var(--ease);padding:24px 20px 28px;gap:12px}
.co-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.co-title{font-family:var(--serif);font-size:clamp(22px,5.5vw,28px);font-weight:500;line-height:1.1}
.co-sub{font-size:12px;color:var(--muted-solid);margin-top:3px;font-style:italic}
.co-close{width:40px;height:40px;flex-shrink:0;border-radius:50%;background:rgba(26,23,20,0.06);border:1px solid var(--line);color:var(--ink);font-size:22px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1}
.co-close:hover{background:rgba(26,23,20,0.12)}
.co-field{display:flex;flex-direction:column;gap:4px}
.co-label{font-size:9px;text-transform:uppercase;letter-spacing:.16em;color:var(--muted-solid);font-weight:600}
.co-input,.co-select{width:100%;min-height:44px;padding:0 12px;border:1px solid var(--line);border-radius:var(--radius);font-size:16px;background:var(--paper);font-family:var(--sans);color:var(--ink);outline:none}
.co-input:focus,.co-select:focus{border-color:var(--gold);box-shadow:0 0 0 3px rgba(156,124,56,0.12)}
.co-qty{display:flex;align-items:center;gap:12px}
.co-qty button{width:38px;height:38px;border-radius:50%;border:1px solid var(--line);background:transparent;color:var(--ink);font-size:18px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center}
.co-pay-element{min-height:44px;padding:4px 0}
.co-btn{width:100%;min-height:48px;background:var(--ink);color:var(--ivory);border:1px solid var(--ink);border-radius:var(--radius);font-size:12px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;cursor:pointer;font-family:var(--sans);transition:background .2s var(--ease)}
.co-btn:hover{background:var(--charcoal-2)}
.co-btn:disabled{background:var(--muted-solid);border-color:var(--muted-solid);cursor:default}
.co-btn-gold{background:var(--gold);border-color:var(--gold);color:var(--ivory)}
.co-btn-gold:hover{background:var(--gold-bright);border-color:var(--gold-bright)}
.co-note{font-size:11px;color:var(--muted-solid);text-align:center;line-height:1.6}
.co-error{font-size:13px;color:#B0402C;line-height:1.5;background:rgba(176,64,44,0.06);border:1px solid rgba(176,64,44,0.2);border-radius:var(--radius);padding:10px 12px}
.co-result{text-align:center;display:flex;flex-direction:column;align-items:center;gap:10px;padding:16px 0}
.co-result-icon{font-family:var(--serif);font-size:40px;font-style:italic;color:var(--gold)}
.co-result-msg{font-size:14px;line-height:1.6}
.co-total{display:flex;align-items:baseline;justify-content:space-between;font-size:14px;padding-top:4px}
.co-total strong{font-size:22px;font-family:var(--serif);font-weight:500}
.co-divider{height:1px;background:var(--line);margin:16px 0}
@media(min-width:769px){
  .co-bg{align-items:center;padding:20px}
  .co-sheet{border-radius:2px;max-width:460px;max-height:90vh;border:1px solid var(--gold);animation:none}
  .co-input,.co-select{font-size:14px;min-height:42px}
}
`;

export default function CheckoutSheet({ checkout, onClose }) {
  const [coStep, setCoStep]     = useState('details');  // details | payment | result
  const [coSize, setCoSize]     = useState(null);
  const [coQty, setCoQty]       = useState(1);
  const [ship, setShip]         = useState({ name: '', email: '', phone: '', address1: '', city: '', state_code: '', zip: '', country_code: 'US' });
  const [coBusy, setCoBusy]     = useState(false);
  const [coError, setCoError]   = useState(null);
  const [coResult, setCoResult] = useState(null);
  const [clientSecret, setClientSecret] = useState(null);
  const [amountCents, setAmountCents]   = useState(null);
  const stripeRef   = useRef(null);
  const elementsRef = useRef(null);
  const payElRef    = useRef(null);

  // Fire a journey event (fire-and-forget) to /api/ghl-event. Identity comes
  // from the shipping form or a stored identity from a prior checkout; events
  // with no known email/phone are skipped.
  const trackGHL = (event, extra = {}) => {
    try {
      const id = loadIdentity() || {};
      const email = ship.email || id.email || '';
      const phone = ship.phone || id.phone || '';
      if (!email && !phone) return;
      const payload = JSON.stringify({ email, phone, event, ...extra });
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        navigator.sendBeacon('/api/ghl-event', new Blob([payload], { type: 'application/json' }));
      } else {
        fetch('/api/ghl-event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true }).catch(() => {});
      }
    } catch (e) {}
  };

  // Reset internal step state whenever a new checkout opens.
  useEffect(() => {
    if (!checkout) return;
    setCoStep('details');
    setCoSize(checkout.product.sizes?.[0] || null);
    setCoQty(1);
    setCoError(null);
    setCoResult(null);
    setClientSecret(null);
    setAmountCents(null);
    stripeRef.current = null;
    elementsRef.current = null;
    trackGHL('order_started', { artwork: checkout.art?.title, museum: checkout.art?.source });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkout]);

  const close = () => { setCoBusy(false); onClose(); };

  // No Stripe configured → place a no-charge draft order in place, showing the
  // result in the open sheet (never navigates away).
  const placeDraftOrder = async () => {
    setCoBusy(true);
    setCoError(null);
    try {
      const art = checkout.art;
      let sessionToken = null;
      try { sessionToken = (await fetch('/api/order-token').then(r => r.json())).token; } catch (e) {}
      const resp = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: checkout.product.name,
          size: coSize,
          quantity: coQty,
          print_url: art?.print_url || art?.full_url || art?.thumb_url,
          work: art?.title,
          recipient: ship,
          session_token: sessionToken,
        }),
      });
      const data = await resp.json();
      setCoResult(resp.ok
        ? { ok: true, msg: data.message || 'Order placed', data }
        : { ok: false, msg: data.error || 'Order failed' });
      setCoStep('result');
      if (resp.ok) trackGHL('order_completed', { artwork: art?.title, museum: art?.source });
    } catch (e) {
      setCoError(e.message);
    } finally {
      setCoBusy(false);
    }
  };

  // Step 1 → 2: validate shipping, create a PaymentIntent, advance to card entry.
  const goToPayment = async () => {
    setCoError(null);
    const missing = ['name', 'email', 'address1', 'city', 'country_code', 'zip']
      .filter(f => !String(ship[f] || '').trim());
    if (missing.length) { setCoError(`Please fill in: ${missing.join(', ')}`); return; }

    saveIdentity({ email: ship.email, phone: ship.phone, name: ship.name });

    if (!STRIPE_PK) { await placeDraftOrder(); return; }

    setCoBusy(true);
    try {
      const resp = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: checkout.product.name,
          size: coSize,
          quantity: coQty,
          work: checkout.art?.title || '',
          email: ship.email,
        }),
      });
      if (resp.status === 501) { await placeDraftOrder(); return; }
      const data = await resp.json();
      if (!resp.ok) { setCoError(data.error || 'Could not start checkout'); return; }
      setClientSecret(data.client_secret);
      setAmountCents(data.amount);
      setCoStep('payment');
      trackGHL('cart_started', { artwork: checkout.art?.title, museum: checkout.art?.source, orderTotal: (data.amount / 100).toFixed(2) });
    } catch (e) {
      setCoError(e.message);
    } finally {
      setCoBusy(false);
    }
  };

  // Step 2 → 3: confirm the card payment, then create the (paid) Printful order.
  const payAndOrder = async () => {
    if (!stripeRef.current || !elementsRef.current) return;
    setCoBusy(true);
    setCoError(null);
    try {
      const { error, paymentIntent } = await stripeRef.current.confirmPayment({
        elements: elementsRef.current,
        redirect: 'if_required',
      });
      if (error) { setCoError(error.message); return; }
      if (paymentIntent?.status !== 'succeeded') {
        setCoError(`Payment ${paymentIntent?.status || 'not completed'}`);
        return;
      }
      const art = checkout.art;
      let sessionToken = null;
      try { sessionToken = (await fetch('/api/order-token').then(r => r.json())).token; } catch (e) {}
      const resp = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: checkout.product.name,
          size: coSize,
          quantity: coQty,
          print_url: art?.print_url || art?.full_url || art?.thumb_url,
          work: art?.title,
          recipient: ship,
          payment_intent_id: paymentIntent.id,
          session_token: sessionToken,
        }),
      });
      const data = await resp.json();
      setCoResult(resp.ok
        ? { ok: true, msg: data.message || 'Order placed', data }
        : { ok: false, msg: data.error || 'Payment succeeded but the order could not be created — contact support.' });
      setCoStep('result');
      if (resp.ok) trackGHL('order_completed', { artwork: art?.title, museum: art?.source, orderTotal: amountCents ? (amountCents / 100).toFixed(2) : undefined });
    } catch (e) {
      setCoError(e.message);
    } finally {
      setCoBusy(false);
    }
  };

  // Mount the Stripe Payment Element once we have a client secret.
  useEffect(() => {
    if (coStep !== 'payment' || !clientSecret || !STRIPE_PK) return;
    let cancelled = false;
    loadStripeJs()
      .then(Stripe => {
        if (cancelled || !payElRef.current) return;
        stripeRef.current = Stripe(STRIPE_PK);
        elementsRef.current = stripeRef.current.elements({ clientSecret });
        const el = elementsRef.current.create('payment');
        el.mount(payElRef.current);
      })
      .catch(e => { if (!cancelled) setCoError(e.message); });
    return () => { cancelled = true; };
  }, [coStep, clientSecret]);

  // Lock body scroll while the sheet is open.
  useEffect(() => {
    if (!checkout) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [checkout]);

  // Abandoned-cart: fire cart_abandoned if the user leaves mid-checkout.
  useEffect(() => {
    if (!checkout || coStep === 'result') return;
    const onLeave = () => trackGHL('cart_abandoned', {
      artwork: checkout.art?.title, museum: checkout.art?.source,
      orderTotal: amountCents ? (amountCents / 100).toFixed(2) : undefined,
    });
    window.addEventListener('beforeunload', onLeave);
    return () => window.removeEventListener('beforeunload', onLeave);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkout, coStep, ship, amountCents]);

  if (!checkout) return null;

  return (
    <>
      <style>{CO_CSS}</style>
      <div className="co-bg" onClick={e => e.target === e.currentTarget && close()}>
        <div className="co-sheet">
          <div className="co-head">
            <div>
              <div className="co-title">{checkout.product.name}</div>
              <div className="co-sub">{checkout.art?.title || 'Selected artwork'}</div>
            </div>
            <button className="co-close" onClick={close} aria-label="Close checkout">×</button>
          </div>

          {coStep === 'details' && (
            <>
              {checkout.product.sizes?.length > 1 && (
                <div className="co-field">
                  <label className="co-label">Size / Option</label>
                  <select className="co-select" value={coSize || ''} onChange={e => setCoSize(e.target.value)}>
                    {checkout.product.sizes.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}
              <div className="co-field">
                <label className="co-label">Quantity</label>
                <div className="co-qty">
                  <button onClick={() => setCoQty(q => Math.max(1, q - 1))} aria-label="Decrease">−</button>
                  <span>{coQty}</span>
                  <button onClick={() => setCoQty(q => Math.min(25, q + 1))} aria-label="Increase">+</button>
                </div>
              </div>
              <div className="co-divider" />
              {[['name', 'Full name'], ['email', 'Email'], ['phone', 'Phone (optional)'], ['address1', 'Address'], ['city', 'City'],
                ['state_code', 'State / Province'], ['zip', 'ZIP / Postal'], ['country_code', 'Country code (e.g. US)']].map(([k, label]) => (
                <div className="co-field" key={k}>
                  <label className="co-label">{label}</label>
                  <input
                    className="co-input"
                    value={ship[k]}
                    inputMode={k === 'email' ? 'email' : k === 'phone' ? 'tel' : 'text'}
                    onChange={e => setShip(s => ({ ...s, [k]: e.target.value }))}
                  />
                </div>
              ))}
              {coError && <div className="co-error">{coError}</div>}
              <button className="co-btn" disabled={coBusy} onClick={goToPayment}>
                {coBusy ? 'Starting…' : (STRIPE_PK ? 'Continue to payment →' : 'Continue →')}
              </button>
              <div className="co-note">
                {STRIPE_PK
                  ? 'Secure payment by Stripe. Prints fulfilled by Printful, shipped worldwide.'
                  : 'Checkout is not fully configured yet — continues to a no-charge draft order.'}
              </div>
            </>
          )}

          {coStep === 'payment' && (
            <>
              {amountCents != null && (
                <div className="co-total">
                  <span>{checkout.product.name}{coSize ? ` · ${coSize}` : ''} × {coQty}</span>
                  <strong>${(amountCents / 100).toFixed(2)}</strong>
                </div>
              )}
              <div className="co-divider" />
              <div className="co-field">
                <label className="co-label">Card details</label>
                <div className="co-pay-element" ref={payElRef} />
              </div>
              {coError && <div className="co-error">{coError}</div>}
              <button className="co-btn co-btn-gold" disabled={coBusy} onClick={payAndOrder}>
                {coBusy ? 'Processing…' : `Pay${amountCents != null ? ` $${(amountCents / 100).toFixed(2)}` : ''} & place order`}
              </button>
              <button className="co-btn" style={{ background: 'transparent', color: 'var(--ink)', border: '1px solid var(--line)' }}
                disabled={coBusy} onClick={() => { setCoStep('details'); setCoError(null); }}>
                ← Back
              </button>
            </>
          )}

          {coStep === 'result' && coResult && (
            <div className="co-result">
              <div className="co-result-icon">{coResult.ok ? '✓' : '×'}</div>
              <p className="co-result-msg" style={{ color: coResult.ok ? 'var(--gold)' : '#B0402C' }}>{coResult.msg}</p>
              {coResult.ok && coResult.data?.orderId && (
                <p className="co-note">
                  Order #{coResult.data.orderId}
                  {coResult.data.printful_order_id ? ` · Printful ${coResult.data.printful_order_id}` : ''}
                </p>
              )}
              <button className="co-btn" onClick={close}>Done</button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
