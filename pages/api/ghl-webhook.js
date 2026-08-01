import { sendSms } from '../../lib/bloo';

export const dynamic = 'force-dynamic';

// Receives automation callbacks from GoHighLevel (e.g. an "abandoned cart, 1h"
// workflow) and takes an action such as an SMS nudge via Bloo.
//
// SECURITY: this endpoint can send SMS, so it MUST NOT be an open relay. It
// requires a shared secret (GHL_WEBHOOK_SECRET) supplied as ?secret= or the
// x-ghl-secret header — configure that in the GHL webhook URL/headers. It fails
// CLOSED: if the secret is unset or wrong, nothing is sent.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const provided = req.query.secret || req.headers['x-ghl-secret'];
  if (!process.env.GHL_WEBHOOK_SECRET || provided !== process.env.GHL_WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};
  const { type, phone } = body;

  try {
    if (type === 'abandoned_cart_followup' && phone) {
      // sendSms no-ops without Bloo config and never throws.
      await sendSms({
        to: phone,
        message: 'You left something behind at Public Art Collections! Complete your order and bring a museum masterpiece home: https://www.publicartcollections.net/viewer',
      });
    }
  } catch (e) {
    console.error('ghl-webhook error:', e.message);
  }

  return res.status(200).json({ received: true });
}
