import { neon } from '@neondatabase/serverless';

// IP auto-blocking + security event logging. All Neon-backed and FAIL-OPEN:
// if the DB is unavailable, auth still works and requests are never wrongly
// blocked. This is abuse mitigation layered on top of the real auth gates.

const AUTHFAIL_SCOPE = 'authfail';
const FAIL_LIMIT = 5;          // failures that trip a block
const BLOCK_SECONDS = 3600;    // block window: 1 hour

let logEnsured = false;
let failEnsured = false;

// Reuses the rate_limit_events table (scope, ip, created_at) from lib/rate-limit.js.
async function ensureFailTable(sql) {
  if (failEnsured) return;
  await sql`CREATE TABLE IF NOT EXISTS rate_limit_events (
    id BIGSERIAL PRIMARY KEY,
    scope TEXT NOT NULL,
    ip TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  failEnsured = true;
}

// Record one failed authentication attempt for an IP.
export async function recordAuthFailure(ip) {
  if (!process.env.DATABASE_URL || !ip) return;
  try {
    const sql = neon(process.env.DATABASE_URL);
    await ensureFailTable(sql);
    await sql`INSERT INTO rate_limit_events (scope, ip) VALUES (${AUTHFAIL_SCOPE}, ${ip})`;
  } catch (e) { console.error('recordAuthFailure:', e.message); }
}

// True once an IP has >= FAIL_LIMIT auth failures within the trailing block
// window. Effect: 5 failed attempts => blocked for up to ~1h, the events aging
// out of the window after that. Fails open (returns false) on any DB error.
export async function isIpBlocked(ip) {
  if (!process.env.DATABASE_URL || !ip) return false;
  try {
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`SELECT COUNT(*)::int AS c FROM rate_limit_events
      WHERE scope = ${AUTHFAIL_SCOPE} AND ip = ${ip}
        AND created_at >= NOW() - (${BLOCK_SECONDS} * INTERVAL '1 second')`;
    return (rows[0]?.c || 0) >= FAIL_LIMIT;
  } catch (e) { return false; }
}

// Best-effort security audit log for sensitive endpoints. Never throws.
export async function logSecurityEvent({ ip, ua, endpoint, result, meta } = {}) {
  if (!process.env.DATABASE_URL) return;
  try {
    const sql = neon(process.env.DATABASE_URL);
    if (!logEnsured) {
      await sql`CREATE TABLE IF NOT EXISTS security_logs (
        id BIGSERIAL PRIMARY KEY,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        ip TEXT, user_agent TEXT, endpoint TEXT, result TEXT, meta JSONB
      )`;
      await sql`CREATE INDEX IF NOT EXISTS security_logs_created_at ON security_logs (created_at)`;
      logEnsured = true;
    }
    await sql`INSERT INTO security_logs (ip, user_agent, endpoint, result, meta)
      VALUES (${ip || ''}, ${String(ua || '').slice(0, 300)}, ${endpoint || ''}, ${result || ''},
              ${meta ? JSON.stringify(meta) : null})`;
  } catch (e) { console.error('logSecurityEvent:', e.message); }
}

export const SECURITY = { AUTHFAIL_SCOPE, FAIL_LIMIT, BLOCK_SECONDS };
