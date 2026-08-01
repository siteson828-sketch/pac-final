/** @type {import('next').NextConfig} */

// Content-Security-Policy — ENFORCED. Tuned to be enforce-safe: 'connect-src'
// and 'img-src' allow any https origin so OpenSeadragon can fetch IIIF
// info.json/tiles from arbitrary museum domains; 'script-src' allowlists Stripe,
// cdnjs (OpenSeadragon) and the AudienceLab pixel, plus 'unsafe-inline'/'unsafe-eval'
// for Next's inline bootstrap. To roll back quickly, rename the header key below
// to 'Content-Security-Policy-Report-Only'.
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
  { key: 'Content-Security-Policy', value: csp },
];

const nextConfig = {
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  async redirects() {
    // Canonical-domain redirect: 308 the bare Vercel production alias straight to
    // the canonical host (www — Vercel already redirects the apex to www), so it's
    // a single hop and there's one live URL (SEO). Scoped to that host only
    // (per-deploy preview URLs like pac-final-<hash>-glee.vercel.app are NOT
    // matched, so previews keep working), and EXCLUDES /api/* so cron jobs and
    // server-to-server calls that hit the .vercel.app host aren't redirected.
    return [
      {
        source: '/:path((?!api/).*)',
        has: [{ type: 'host', value: 'pac-final.vercel.app' }],
        destination: 'https://www.publicartcollections.net/:path',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
