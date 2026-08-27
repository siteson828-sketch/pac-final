export const dynamic = 'force-dynamic';

// Receives automation callbacks from GoHighLevel. SMS delivery is now handled by
// GHL natively via Signal House, so this endpoint no longer sends any messages
// itself — it authenticates and acknowledges the callback. Extend the body-
// handling below if you later need to mirror GHL events into local analytics.
//
// SECURITY: requires a shared secret (GHL_WEBHOOK_SECRET) supplied as ?secret=
// or the x-ghl-secret header — configure that in the GHL webhook URL/headers. It
// fails CLOSED: if the secret is unset or wrong, nothing is processed.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const provided = req.query.secret || req.headers['x-ghl-secret'];
  if (!process.env.GHL_WEBHOOK_SECRET || provided !== process.env.GHL_WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  return res.status(200).json({ received: true });
}
