import { emailShell } from '../../lib/email';

export const dynamic = 'force-dynamic';

// TEMPORARY admin welcome-email smoke test (SYNC_SECRET-gated). Renders the REAL
// welcome template via emailShell (so MAIL_POSTAL_ADDRESS + unsubscribe footer
// show) and sends it. Defaults to Resend's sandbox sender so it validates even
// before the domain is verified (sandbox delivers only to your Resend account
// email). Remove after confirming.
export default async function handler(req, res) {
  if ((req.query.secret || '') !== process.env.SYNC_SECRET) return res.status(401).json({ error: 'Unauthorized' });
  if (!process.env.RESEND_API_KEY) return res.status(400).json({ error: 'RESEND_API_KEY not set on this deployment' });

  const to = String(req.query.to || '').slice(0, 254).trim();
  if (!to) return res.status(400).json({ error: '?to= required' });
  const from = String(req.query.from || 'onboarding@resend.dev').slice(0, 160).trim();

  const inner = `
    <h1 style="font-size:28px;font-weight:300;margin:0 0 16px;line-height:1.2;">Welcome!</h1>
    <p style="font-size:15px;color:#B0A898;line-height:1.8;margin-bottom:24px;">You now have access to over a million public-domain artworks from 120+ museums worldwide. Browse, search by AI, and order museum-quality prints delivered to your door.</p>
    <a href="https://www.publicartcollections.net/viewer" style="display:inline-block;background:#B8942A;color:#1A1714;padding:14px 24px;border-radius:4px;font-size:15px;font-weight:600;text-decoration:none;">Browse the collection →</a>`;

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, subject: 'Welcome to Public Art Collections 🎨', html: emailShell(inner, to) }),
    });
    let d = {};
    try { d = await r.json(); } catch (e) {}
    return res.status(r.ok ? 200 : 502).json({
      ok: r.ok, http: r.status, id: d?.id || null,
      error: r.ok ? null : (d?.message || d?.name || `HTTP ${r.status}`),
      from, to,
    });
  } catch (e) {
    return res.status(502).json({ ok: false, error: e.message });
  }
}
