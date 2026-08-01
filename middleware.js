import { clerkMiddleware } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

// Clerk v6 requires clerkMiddleware for getAuth() to work. It does NOT protect
// routes by default (everything stays public / auth-aware) — we just need the
// session available. Scoped to pages + the API routes that call getAuth, so the
// high-frequency public endpoints (/api/img, /api/artworks, /api/track, /api/sync*)
// don't pay any auth overhead.
//
// DEFENSIVE: clerkMiddleware() throws MIDDLEWARE_INVOCATION_FAILED at runtime if
// CLERK_SECRET_KEY is missing/invalid — which would take down EVERY matched route,
// i.e. the whole site. So we only engage Clerk when it's actually configured;
// otherwise we fall through to normal routing. Auth-gated features already fail
// safe to the "free" tier in /api/user-tier, so a missing key degrades gracefully
// (no gating) instead of nuking the store.
const clerkConfigured = !!process.env.CLERK_SECRET_KEY;
const handler = clerkConfigured ? clerkMiddleware() : () => NextResponse.next();
export default handler;

export const config = {
  matcher: [
    '/((?!api|_next|.*\\..*).*)',
    '/api/user-tier',
    '/api/create-order',
    '/api/create-payment-intent',
    '/api/create-subscription',
  ],
};
