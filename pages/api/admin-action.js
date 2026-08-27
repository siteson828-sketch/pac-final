import { hasGhl, upsertContact, addNote } from '../../lib/ghl';

export const dynamic = 'force-dynamic';

// Admin-only actions from the dashboard (currently: queue a follow-up to a
// visitor). Gated by SYNC_SECRET — only the dashboard operator can call it, so
// it's not an open relay. SMS is delivered by GoHighLevel automations natively
// via Signal House: this endpoint upserts the contact in GHL and tags it so the
// operator's follow-up automation fires; the message text rides along as a note.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};

  if (body.secret !== process.env.SYNC_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (body.action === 'send_sms' && body.phone) {
    if (!hasGhl()) return res.status(200).json({ success: false, skipped: 'ghl_not_configured' });
    const up = await upsertContact({
      phone: body.phone,
      tags: ['pac-visitor', 'admin-followup'],
      custom: { journey_stage: 'admin-followup' },
    });
    const contactId = up?.contact?.id;
    if (contactId && body.message) await addNote(contactId, body.message);
    return res.status(200).json({ success: !!up?.ok, result: up });
  }

  return res.status(400).json({ error: 'Unknown action' });
}
