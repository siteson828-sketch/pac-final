export const dynamic = 'force-dynamic';

// Admin-only email smoke test (SYNC_SECRET-gated, like /api/cleanup & /api/db-index).
// Sends ONE fixed test message via Resend so we can confirm RESEND_API_KEY works
// on the live deployment (Sensitive env vars can't be pulled locally). Defaults
// to Resend's sandbox sender so it validates the key even before the sending
// domain is verified (sandbox only delivers to your Resend account email).
export default async function handler(req, res) {
  if ((req.query.secret || '') !== process.env.SYNC_SECRET) return res.status(401).json({ error: 'Unauthorized' });
  if (!process.env.RESEND_API_KEY) return res.status(400).json({ error: 'RESEND_API_KEY not set on this deployment' });

  const to = String(req.query.to || '').slice(0, 254).trim();
  if (!to) return res.status(400).json({ error: '?to= required' });
  const from = String(req.query.from || 'onboarding@resend.dev').slice(0, 160).trim();

  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from, to,
        subject: 'Resend smoke test — Public Art Collections',
        html: '<p>Resend smoke test ✓ — if you received this, the API key and sending path are working.</p>',
      }),
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
