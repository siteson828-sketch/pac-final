import { crmDb, upsertVisitor } from '../../lib/crm';
import { checkRateLimit } from '../../lib/rate-limit';
import { clientIp } from '../../lib/sanitize';

export const dynamic = 'force-dynamic';

// Server-to-server webhook for AudienceLab identity-resolution events. It writes
// enriched (sensitive) PII into the visitors table, so it MUST be authenticated:
// a shared secret (AUDIENCELAB_WEBHOOK_SECRET) supplied as an `x-webhook-secret`
// header, `Authorization: Bearer <secret>`, or `?secret=` in the webhook URL.
// Fails CLOSED — if the secret is unset or wrong, nothing is written. No CORS:
// this is called by AudienceLab's servers, not browsers, so it stays same-origin
// closed to drive-by cross-site POSTs. Reuses upsertVisitor (keys on visitor_key,
// caps the raw JSON, and never regresses an existing visitor's journey stage).
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const provided =
    req.headers['x-webhook-secret'] ||
    (req.headers.authorization || '').replace(/^Bearer\s+/i, '') ||
    req.query.secret;
  if (!process.env.AUDIENCELAB_WEBHOOK_SECRET || provided !== process.env.AUDIENCELAB_WEBHOOK_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Generous rate limit as defense-in-depth against a runaway/abusive sender.
  const rl = await checkRateLimit({ scope: 'al-webhook', ip: clientIp(req), limit: 300, windowSeconds: 60 });
  if (!rl.allowed) return res.status(429).json({ error: 'Rate limited' });

  let d = req.body;
  if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { d = {}; } }
  d = d || {};

  const name = d.name || [d.first_name, d.last_name].filter(Boolean).join(' ') || null;
  const identifier = d.email || d.phone || d.id || d.visitor_id || d.audiencelab_id;
  if (!identifier) return res.status(200).json({ ok: true, skipped: 'no_identifier' });

  try {
    await upsertVisitor(crmDb(), {
      email: d.email || null,
      phone: d.phone || null,
      name,
      first_name: d.first_name,
      last_name: d.last_name,
      audiencelab_id: d.id || d.visitor_id || d.audiencelab_id,
      audiencelab_email: d.email,
      audiencelab_phone: d.phone,
      audiencelab_name: name,
      audiencelab_age_range: d.age_range || d.ageRange,
      audiencelab_gender: d.gender,
      audiencelab_income: d.household_income || d.income || d.householdIncome,
      audiencelab_homeowner: d.homeowner || d.home_owner,
      audiencelab_net_worth: d.net_worth || d.netWorth,
      audiencelab_education: d.education,
      audiencelab_occupation: d.occupation,
      audiencelab_marital_status: d.marital_status || d.maritalStatus,
      audiencelab_children: d.children ?? d.has_children,
      audiencelab_interests: d.interests || d.categories || [],
      audiencelab_raw: d,
      source: 'audiencelab_webhook',
    });
    return res.status(200).json({ success: true });
  } catch (e) {
    console.error('AudienceLab webhook error:', e.message);
    // 200 so AudienceLab doesn't hammer retries on a transient DB blip.
    return res.status(200).json({ ok: true });
  }
}
