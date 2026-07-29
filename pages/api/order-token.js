import { signToken, hasTokenSecret } from '../../lib/order-token';

export const dynamic = 'force-dynamic';

// Mints a short-lived signed token for the checkout flow. The browser fetches
// this just before submitting an order and echoes it back to /api/create-order,
// which verifies it. Never cached. Returns token:null when unconfigured so the
// client still sends a value and the server fails open.
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  const configured = hasTokenSecret();
  return res.status(200).json({
    configured,
    token: configured ? signToken() : null,
  });
}
