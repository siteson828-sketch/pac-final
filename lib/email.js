// Minimal Resend email client. Same convention as lib/bloo.js / lib/printful.js:
// raw fetch + env-var auth, and a clean no-op when unconfigured so nothing is
// sent until RESEND_API_KEY is provisioned (via `vercel integration add
// resend/resend-email`). Never throws — callers fire-and-forget.
//
// Env vars:
//   RESEND_API_KEY    — Resend API key (Bearer), injected by the integration
//   RESEND_FROM_EMAIL — verified sender, e.g. "Public Art Collections <hello@publicartcollections.net>"
//                       (falls back to BLOO_FROM_EMAIL then a safe default)
const RESEND_URL = 'https://api.resend.com/emails';

export function hasEmail() {
  return !!process.env.RESEND_API_KEY;
}

function fromAddress() {
  return process.env.RESEND_FROM_EMAIL
    || process.env.BLOO_FROM_EMAIL
    || 'Public Art Collections <hello@publicartcollections.net>';
}

// Send one transactional/marketing email. Returns { ok, skipped?, error? }.
export async function sendEmail({ to, subject, html }) {
  if (!process.env.RESEND_API_KEY) return { ok: false, skipped: true, reason: 'email_not_configured' };
  if (!to || !subject || !html) return { ok: false, skipped: true, reason: 'missing_fields' };

  try {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: fromAddress(), to, subject, html }),
    });
    let data = {};
    try { data = await res.json(); } catch (e) {}
    if (!res.ok) return { ok: false, error: data?.message || `Resend HTTP ${res.status}` };
    return { ok: true, id: data?.id };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// CAN-SPAM: marketing email must carry a physical postal address + working
// unsubscribe. Wrap body content in the branded shell with both. `unsubEmail`
// is the recipient's address so the unsubscribe link is pre-filled.
export function emailShell(bodyHtml, unsubEmail) {
  const addr = process.env.MAIL_POSTAL_ADDRESS || 'Public Art Collections';
  const unsub = `https://www.publicartcollections.net/unsubscribe?email=${encodeURIComponent(unsubEmail || '')}`;
  return `
    <div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;background:#1A1714;color:#F0EAD8;padding:40px;">
      <div style="font-size:22px;font-weight:300;margin-bottom:20px;">
        Public Art <span style="color:#B8942A">Collections</span>
      </div>
      ${bodyHtml}
      <div style="margin-top:32px;padding-top:16px;border-top:0.5px solid rgba(240,234,214,0.1);font-size:12px;color:#6A6058;line-height:1.6;">
        You're receiving this because you signed up at publicartcollections.net.<br/>
        ${addr}<br/>
        <a href="${unsub}" style="color:#6A6058;">Unsubscribe</a>
      </div>
    </div>`;
}
