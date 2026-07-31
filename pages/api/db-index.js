import { neon } from '@neondatabase/serverless';
import { clientIp } from '../../lib/sanitize';
import { isIpBlocked, recordAuthFailure, logSecurityEvent } from '../../lib/security';

export const dynamic = 'force-dynamic';

// Admin-only (SYNC_SECRET) one-off: create pg_trgm + GIN trigram indexes on the
// columns the AI search matches (title/artist/medium) so `ILIKE '%term%'` uses a
// bitmap index scan instead of a full-table scan. Idempotent (IF NOT EXISTS), so
// it's safe to re-run — re-running also skips already-built indexes if a prior
// call timed out mid-build. Returns an EXPLAIN so you can confirm index usage.
export default async function handler(req, res) {
  const ip = clientIp(req);
  if (await isIpBlocked(ip)) return res.status(403).json({ error: 'Temporarily blocked' });
  if (req.query.secret !== process.env.SYNC_SECRET) {
    await recordAuthFailure(ip);
    await logSecurityEvent({ ip, ua: req.headers['user-agent'], endpoint: 'db-index', result: 'unauthorized' });
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const sql = neon(process.env.DATABASE_URL);
  const done = [];
  try {
    await sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`; done.push('ext:pg_trgm');
    await sql`CREATE INDEX IF NOT EXISTS artworks_title_trgm ON artworks USING gin (title gin_trgm_ops)`; done.push('idx:title');
    await sql`CREATE INDEX IF NOT EXISTS artworks_artist_trgm ON artworks USING gin (artist gin_trgm_ops)`; done.push('idx:artist');
    await sql`CREATE INDEX IF NOT EXISTS artworks_medium_trgm ON artworks USING gin (medium gin_trgm_ops)`; done.push('idx:medium');

    // Verify the planner uses the trgm index for an ILIKE query.
    const plan = await sql`EXPLAIN SELECT id FROM artworks
      WHERE title ILIKE '%blue%' OR artist ILIKE '%blue%' OR medium ILIKE '%blue%' LIMIT 48`;
    const planText = plan.map(r => r['QUERY PLAN']).join('\n');
    return res.status(200).json({
      ok: true,
      created_or_existing: done,
      uses_index: /Bitmap Index Scan|gin|trgm/i.test(planText),
      explain: planText,
    });
  } catch (e) {
    console.error('db-index error:', e);
    return res.status(502).json({ error: e.message, done });
  }
}

export const config = { maxDuration: 300 };
