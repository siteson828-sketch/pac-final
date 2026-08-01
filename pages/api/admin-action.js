import { sendSms } from '../../lib/bloo';

export const dynamic = 'force-dynamic';

// Admin-only actions from the dashboard (currently: send a follow-up SMS via
// Bloo). Gated by SYNC_SECRET — only the dashboard operator can call it, so it's
// not an open SMS relay. Uses lib/bloo (no-ops without Bloo config).
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};

  if (body.secret !== process.env.SYNC_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (body.action === 'send_sms' && body.phone) {
    const r = await sendSms({ to: body.phone, message: body.message || 'A note from Public Art Collections.' });
    return res.status(200).json({ success: !!r.ok, result: r });
  }

  return res.status(400).json({ error: 'Unknown action' });
}
