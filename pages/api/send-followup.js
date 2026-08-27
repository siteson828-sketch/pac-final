import { neon } from '@neondatabase/serverless';
import { ensureLeadsTable, markStageSent } from '../../lib/leads';
import { sendEmail, emailShell, hasEmail } from '../../lib/email';

export const dynamic = 'force-dynamic';
export const config = { maxDuration: 300 };

// Automated EMAIL drip follow-ups. Targets ONLY the consented `leads` table
// (explicit popup opt-ins) — NEVER the pixel-filled `visitors` table. Every
// stage:
//   • skips unsubscribed leads (unsubscribed_at)
//   • is idempotent (per-stage sent timestamp, so a lead gets each stage once)
//   • email via Resend (no-ops until RESEND_API_KEY set)
// SMS drips are NOT sent here — leads are pushed to GoHighLevel (see /api/track),
// and GHL automations own all SMS follow-ups natively via Signal House.
// Auth: Vercel Cron Bearer (CRON_SECRET) or ?secret=SYNC_SECRET for manual runs.
const COPY = {
  day1: {
    col: 'day1_sent_at',
    subject: 'Your favorite artwork is waiting 🎨',
    html: (f) => `<p style="font-size:15px;color:#B0A898;line-height:1.8;">Hi ${f || 'there'},</p>
      <p style="font-size:15px;color:#B0A898;line-height:1.8;margin-bottom:24px;">Yesterday you discovered our collection of a million+ museum masterpieces. Try the AI search — type "blue melancholy" or "stormy seascape" and watch what happens.</p>
      <a href="https://www.publicartcollections.net/viewer" style="display:inline-block;background:#B8942A;color:#1A1714;padding:12px 24px;border-radius:4px;text-decoration:none;font-weight:600;">Browse the collection →</a>`,
  },
  day3: {
    col: 'day3_sent_at',
    subject: 'Turn any masterpiece into wall art from $18',
    html: (f) => `<p style="font-size:15px;color:#B0A898;line-height:1.8;">Hi ${f || 'there'},</p>
      <p style="font-size:15px;color:#B0A898;line-height:1.8;">Any of our million+ artworks can be ordered as a museum-quality print — fine-art prints from $18, canvas from $45, shipped to 180+ countries.</p>
      <a href="https://www.publicartcollections.net/viewer" style="display:inline-block;background:#B8942A;color:#1A1714;padding:12px 24px;border-radius:4px;text-decoration:none;font-weight:600;margin-top:12px;">Order your print →</a>`,
  },
  weekly: {
    col: 'weekly_last_at',
    subject: 'New masterpieces arrived this week 🎨',
    html: (f) => `<p style="font-size:15px;color:#B0A898;line-height:1.8;">Hi ${f || 'there'},</p>
      <p style="font-size:15px;color:#B0A898;line-height:1.8;">Thousands of new artworks were added this week from museums around the world. Discover something new with AI search — it understands mood, color, and style.</p>
      <a href="https://www.publicartcollections.net/viewer" style="display:inline-block;background:#B8942A;color:#1A1714;padding:12px 24px;border-radius:4px;text-decoration:none;font-weight:600;margin-top:12px;">Discover new works →</a>`,
  },
};

export default async function handler(req, res) {
  const authed =
    req.headers.authorization === 'Bearer ' + process.env.CRON_SECRET ||
    req.query.secret === process.env.SYNC_SECRET;
  if (!authed) return res.status(401).json({ error: 'Unauthorized' });

  const type = req.query.type || 'day1';
  const copy = COPY[type];
  if (!copy) return res.status(400).json({ error: 'unknown type', valid: Object.keys(COPY) });

  const sql = neon(process.env.DATABASE_URL);
  await ensureLeadsTable(sql);

  let leads = [];
  if (type === 'day1') {
    leads = await sql`SELECT lead_key, email, name FROM leads
      WHERE unsubscribed_at IS NULL AND day1_sent_at IS NULL
        AND consent_at < NOW() - INTERVAL '24 hours' AND consent_at > NOW() - INTERVAL '5 days'
      LIMIT 500`;
  } else if (type === 'day3') {
    leads = await sql`SELECT lead_key, email, name FROM leads
      WHERE unsubscribed_at IS NULL AND day3_sent_at IS NULL
        AND consent_at < NOW() - INTERVAL '3 days' AND consent_at > NOW() - INTERVAL '10 days'
      LIMIT 500`;
  } else if (type === 'weekly') {
    leads = await sql`SELECT lead_key, email, name FROM leads
      WHERE unsubscribed_at IS NULL AND email IS NOT NULL
        AND consent_at < NOW() - INTERVAL '7 days'
        AND (weekly_last_at IS NULL OR weekly_last_at < NOW() - INTERVAL '6 days')
      LIMIT 500`;
  }

  let sentEmail = 0;
  for (const l of leads) {
    const first = (l.name || '').split(' ')[0];
    try {
      if (l.email && hasEmail()) {
        const r = await sendEmail({ to: l.email, subject: copy.subject, html: emailShell(copy.html(first), l.email) });
        if (r.ok) sentEmail++;
      }
      await markStageSent(sql, l.lead_key, copy.col); // mark once — idempotent per stage
      await new Promise((r) => setTimeout(r, 150));
    } catch (e) { /* skip this lead, keep going */ }
  }

  return res.status(200).json({ ok: true, type, matched: leads.length, sentEmail,
    note: hasEmail() ? undefined : 'RESEND_API_KEY unset — emails skipped (no-op until provisioned)' });
}
