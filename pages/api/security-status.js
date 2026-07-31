import { neon } from '@neondatabase/serverless';
import { clientIp } from '../../lib/sanitize';
import { isIpBlocked, recordAuthFailure, logSecurityEvent, SECURITY } from '../../lib/security';
import { validateEnv } from '../../lib/validateEnv';

export const dynamic = 'force-dynamic';

// Admin-only security dashboard (read-only), gated by SYNC_SECRET. Summarizes
// rate-limit activity, blocked IPs, failed auth, request volume and a few
// heuristic "suspicious pattern" flags. All queries are best-effort; a missing
// table (nothing logged yet) yields zeros rather than an error.
async function safe(fn, fallback) {
  try { return await fn(); } catch (e) { return fallback; }
}

export default async function handler(req, res) {
  const ip = clientIp(req);
  if (await isIpBlocked(ip)) return res.status(403).json({ error: 'Temporarily blocked' });
  if (req.query.secret !== process.env.SYNC_SECRET) {
    await recordAuthFailure(ip);
    await logSecurityEvent({ ip, ua: req.headers['user-agent'], endpoint: 'security-status', result: 'unauthorized' });
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!process.env.DATABASE_URL) return res.status(200).json({ env: validateEnv(), note: 'DATABASE_URL unset — no stats' });

  const sql = neon(process.env.DATABASE_URL);

  const rateByScope = await safe(() => sql`
    SELECT scope, COUNT(*)::int AS events, COUNT(DISTINCT ip)::int AS ips
    FROM rate_limit_events
    WHERE created_at >= NOW() - INTERVAL '1 hour'
    GROUP BY scope ORDER BY events DESC`, []);

  const blockedIps = await safe(() => sql`
    SELECT ip, COUNT(*)::int AS fails, MAX(created_at) AS last_fail
    FROM rate_limit_events
    WHERE scope = ${SECURITY.AUTHFAIL_SCOPE}
      AND created_at >= NOW() - (${SECURITY.BLOCK_SECONDS} * INTERVAL '1 second')
    GROUP BY ip HAVING COUNT(*) >= ${SECURITY.FAIL_LIMIT}
    ORDER BY fails DESC LIMIT 50`, []);

  const failedAuthLastHour = await safe(async () => (await sql`
    SELECT COUNT(*)::int AS c FROM rate_limit_events
    WHERE scope = ${SECURITY.AUTHFAIL_SCOPE} AND created_at >= NOW() - INTERVAL '1 hour'`)[0]?.c || 0, 0);

  const requests24h = await safe(async () => (await sql`
    SELECT COUNT(*)::int AS c FROM security_logs
    WHERE created_at >= NOW() - INTERVAL '24 hours'`)[0]?.c || 0, 0);

  const byResult24h = await safe(() => sql`
    SELECT endpoint, result, COUNT(*)::int AS c FROM security_logs
    WHERE created_at >= NOW() - INTERVAL '24 hours'
    GROUP BY endpoint, result ORDER BY c DESC LIMIT 50`, []);

  // Heuristic suspicious-pattern flags.
  const suspicious = [];
  for (const b of blockedIps) suspicious.push({ type: 'ip_blocked', ip: b.ip, fails: b.fails });
  const burstIps = await safe(() => sql`
    SELECT ip, COUNT(*)::int AS c FROM rate_limit_events
    WHERE created_at >= NOW() - INTERVAL '1 minute'
    GROUP BY ip HAVING COUNT(*) > 60 ORDER BY c DESC LIMIT 20`, []);
  for (const b of burstIps) suspicious.push({ type: 'request_burst', ip: b.ip, count: b.c });

  return res.status(200).json({
    generated_at: new Date().toISOString(),
    env: validateEnv(),
    rate_limit_by_scope_1h: rateByScope,
    blocked_ips: blockedIps,
    failed_auth_last_hour: failedAuthLastHour,
    requests_logged_24h: requests24h,
    results_24h: byResult24h,
    suspicious,
    thresholds: SECURITY,
  });
}

export const config = { maxDuration: 30 };
