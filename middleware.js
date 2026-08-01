import { clerkMiddleware } from '@clerk/nextjs/server';

// Clerk v6 requires clerkMiddleware for getAuth() to work. It does NOT protect
// routes by default (everything stays public / auth-aware) — we just need the
// session available. Scoped to pages + the API routes that call getAuth, so the
// high-frequency public endpoints (/api/img, /api/artworks, /api/track, /api/sync*)
// don't pay any auth overhead.
export default clerkMiddleware();

export const config = {
  matcher: [
    '/((?!api|_next|.*\\..*).*)',
    '/api/user-tier',
    '/api/create-order',
    '/api/create-payment-intent',
    '/api/create-subscription',
  ],
};
