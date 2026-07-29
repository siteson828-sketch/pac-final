import { neon } from '@neondatabase/serverless';

// Neon-backed fixed-window rate limiter. One row is written per event; a request
// is allowed while fewer than `limit` events exist for (scope, ip) within the
// trailing `windowSeconds`. Backed by the DB (not in-memory) so the limit holds
// across the many serverless instances Vercel may run concurrently.
//
// Best-effort and FAIL-OPEN: if the DB is unavailable or a query throws, the
// request is allowed and the error is logged. This is abuse mitigation, not
// authentication — it must never take down a legitimate request path.
let ensured = false;

async function ensureTable(sql) {
  if (ensured) return;
  await sql`CREATE TABLE IF NOT EXISTS rate_limit_events (
    id BIGSERIAL PRIMARY KEY,
    scope TEXT NOT NULL,
    ip TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  await sql`CREATE INDEX IF NOT EXISTS rate_limit_events_lookup
            ON rate_limit_events (scope, ip, created_at)`;
  ensured = true;
}

export async function checkRateLimit({ scope, ip, limit, windowSeconds }) {
  if (!process.env.DATABASE_URL || !ip) return { allowed: true, skipped: true };
  try {
    const sql = neon(process.env.DATABASE_URL);
    await ensureTable(sql);
    // Prune this scope/ip's expired rows so the table stays small and the count cheap.
    await sql`DELETE FROM rate_limit_events
              WHERE scope = ${scope} AND ip = ${ip}
                AND created_at < NOW() - (${windowSeconds} * INTERVAL '1 second')`;
    const rows = await sql`SELECT COUNT(*)::int AS c FROM rate_limit_events
                           WHERE scope = ${scope} AND ip = ${ip}
                             AND created_at >= NOW() - (${windowSeconds} * INTERVAL '1 second')`;
    const count = rows[0]?.c || 0;
    if (count >= limit) return { allowed: false, count };
    await sql`INSERT INTO rate_limit_events (scope, ip) VALUES (${scope}, ${ip})`;
    return { allowed: true, count: count + 1 };
  } catch (e) {
    console.error('rate-limit error:', e.message);
    return { allowed: true, error: true };
  }
}
