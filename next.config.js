/** @type {import('next').NextConfig} */

// Content-Security-Policy is shipped in Report-Only mode first: the app's
// gigapixel zoom (OpenSeadragon) fetches IIIF info.json from many museum domains
// and the AudienceLab pixel loads cross-origin, so an enforced CSP risks breaking
// them. Report-Only lets the policy ride along without blocking anything; flip
// the header key to 'Content-Security-Policy' to enforce once validated.
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://cdnjs.cloudflare.com https://cdn.audiencelab.io",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "img-src 'self' data: https: blob:",
  "font-src 'self' https://fonts.gstatic.com data:",
  // 'https:' allows OpenSeadragon to fetch IIIF info.json/tiles from arbitrary
  // museum hosts and the client to reach Stripe / AudienceLab; tighten later.
  "connect-src 'self' https:",
  "frame-src https://js.stripe.com",
].join('; ');

const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Content-Security-Policy-Report-Only', value: csp },
];

const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

module.exports = nextConfig;
