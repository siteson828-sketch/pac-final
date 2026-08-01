import { hasGhl, findContactByEmail, upsertContact, updateContact, addTags, addNote } from '../../lib/ghl';
import { crmDb, logEvent, updateVisitorJourney } from '../../lib/crm';
import { checkRateLimit } from '../../lib/rate-limit';
import { cleanStr, isEmail, isPhone, sameOrigin, clientIp } from '../../lib/sanitize';

export const dynamic = 'force-dynamic';

// Journey-stage tracker: maps a client-fired event to a GHL tag + pipeline
// stage, then upserts/updates the contact and drops a timeline note. Fired
// fire-and-forget from the browser; no-ops cleanly when GHL isn't configured.
const STAGES = {
  page_view:        { tag: 'visitor',       stage: 'Visitor' },
  artwork_view:     { tag: 'browser',        stage: 'Browsing' },
  order_started:    { tag: 'interested',     stage: 'Interested' },
  cart_started:     { tag: 'checkout',       stage: 'In Checkout' },
  cart_abandoned:   { tag: 'abandoned-cart', stage: 'Abandoned Cart' },
  order_completed:  { tag: 'buyer',          stage: 'Buyer' },
  subscription:     { tag: 'subscriber',     stage: 'Subscriber' },
  repeat_purchase:  { tag: 'repeat-buyer',   stage: 'Repeat Buyer' },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  // Reject cross-site forged POSTs (Origin/Referer must match when present).
  if (!sameOrigin(req)) return res.status(403).json({ ok: false });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
  body = body || {};

  // Rate-limit so this public endpoint can't be scripted to spam.
  const rl = await checkRateLimit({ scope: 'ghl-event', ip: clientIp(req), limit: 30, windowSeconds: 600 });
  if (!rl.allowed) return res.status(200).json({ ok: true, skipped: 'rate_limited' });

  const email = isEmail(cleanStr(body.email, 254)) ? cleanStr(body.email, 254) : '';
  const phone = isPhone(cleanStr(body.phone, 20)) ? cleanStr(body.phone, 20) : '';
  if (!email && !phone) return res.status(200).json({ ok: true, skipped: 'no_identifier' });

  const event = cleanStr(body.event, 40);
  const artwork = cleanStr(body.artwork, 200);
  const museum = cleanStr(body.museum, 120);
  const orderTotal = cleanStr(body.orderTotal, 20);
  const tier = cleanStr(body.tier, 20);
  const s = STAGES[event] || { tag: event || 'event', stage: 'Visitor' };

  // Always record locally for the admin dashboard (this is our own queryable
  // copy; it works whether or not GHL is configured).
  const cdb = crmDb();
  await logEvent(cdb, { event, email, phone, name: cleanStr(body.name, 120), artwork, museum, orderTotal });
  await updateVisitorJourney(cdb, { email, phone, name: cleanStr(body.name, 120), event, artwork, museum, orderTotal });

  // The rest pushes to GoHighLevel only when it's configured.
  if (!hasGhl()) return res.status(200).json({ ok: true, stage: s.stage, local: true });

  try {
    let contact = email ? await findContactByEmail(email) : null;
    if (!contact) {
      const up = await upsertContact({
        email, phone,
        tags: ['pac-visitor', s.tag],
        custom: { journey_stage: s.stage, last_artwork: artwork, last_museum: museum },
      });
      contact = up.contact;
    } else {
      await addTags(contact.id, [s.tag]); // add, don't replace existing tags
      await updateContact(contact.id, {
        customField: {
          journey_stage: s.stage,
          last_artwork: artwork,
          last_museum: museum,
          ...(orderTotal ? { last_order_total: orderTotal } : {}),
          ...(tier ? { subscription_tier: tier } : {}),
        },
      });
    }
    if (contact?.id) {
      await addNote(contact.id, `${event}: ${artwork || museum || ''}${orderTotal ? ' — $' + orderTotal : ''}`.trim());
    }
    return res.status(200).json({ ok: true, stage: s.stage });
  } catch (e) {
    console.error('ghl-event error:', e.message);
    return res.status(200).json({ ok: true, error: true });
  }
}
