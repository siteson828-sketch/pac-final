// Environment-variable validation.
//
// NOTE: intentionally NON-FATAL by default. Throwing at module load in a
// serverless runtime would crash EVERY route (including public read-only pages)
// if a single secret were missing — a self-inflicted outage. Instead callers
// inspect the returned report (see /api/security-status). Use validateEnvOrThrow
// only in build/CI contexts where a hard failure is desirable.

// Hard requirement: the app cannot serve anything meaningful without the DB.
const REQUIRED = ['DATABASE_URL'];

// Features degrade gracefully when these are unset (documented no-op behavior),
// but production should have them all set.
const RECOMMENDED = [
  'SYNC_SECRET',        // admin/cron auth
  'CRON_SECRET',        // cron auth
  'ORDER_TOKEN_SECRET', // order request-signing
  'PRINTFUL_API_KEY',   // fulfillment
];

export function validateEnv() {
  const missingRequired = REQUIRED.filter(k => !process.env[k]);
  const missingRecommended = RECOMMENDED.filter(k => !process.env[k]);
  return {
    ok: missingRequired.length === 0,
    missingRequired,
    missingRecommended,
    checked: [...REQUIRED, ...RECOMMENDED],
  };
}

export function validateEnvOrThrow() {
  const r = validateEnv();
  if (!r.ok) throw new Error(`Missing required env vars: ${r.missingRequired.join(', ')}`);
  return r;
}
