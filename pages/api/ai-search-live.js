import { neon } from '@neondatabase/serverless';
import { checkRateLimit } from '../../lib/rate-limit';
import { cleanStr, clientIp } from '../../lib/sanitize';
import { liveSearch } from '../../lib/livemuseums';

export const dynamic = 'force-dynamic';

// Live museum-API search, kept SEPARATE from /api/ai-search so DB results render
// instantly and this streams in after (the client fires it non-blocking).
// Results are cached in Neon (per normalized query, 7-day TTL) so repeat
// searches skip the external API round-trips. Fail-open throughout.
const TTL_DAYS = 7;

let ensured = false;
async function ensureTable(sql) {
  if (ensured) return;
  await sql`CREATE TABLE IF NOT EXISTS live_search_cache (
    query TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  ensured = true;
}

export default async function handler(req, res) {
  const query = cleanStr(req.query.query, 200);
  if (!query) return res.status(400).json({ error: 'No query' });

  const rl = await checkRateLimit({ scope: 'ai-search-live', ip: clientIp(req), limit: 20, windowSeconds: 600 });
  if (!rl.allowed) return res.status(429).json({ error: 'Too many searches. Please wait a moment.' });

  const sql = neon(process.env.DATABASE_URL);
  const mode = req.query.mode === 'artist' ? 'artist' : 'keyword';
  const key = (mode === 'artist' ? 'artist:' : '') + query.toLowerCase();

  // Cache lookup (fresh within TTL).
  try {
    await ensureTable(sql);
    const rows = await sql`SELECT data, created_at FROM live_search_cache WHERE query = ${key}`;
    if (rows.length) {
      const ageDays = (Date.now() - new Date(rows[0].created_at).getTime()) / 86400000;
      if (ageDays < TTL_DAYS) {
        const d = rows[0].data;
        return res.status(200).json({ ...d, cached: true });
      }
    }
  } catch (e) { /* cache miss on any error */ }

  // Live fetch (bounded + fail-soft inside liveSearch).
  let result = { works: [], sources: {} };
  try { result = await liveSearch(query, { mode }); } catch (e) { console.error('live-search error:', e.message); }

  const payload = { works: result.works, sources: result.sources, total: result.works.length };
  // Best-effort cache write.
  try {
    await ensureTable(sql);
    await sql`INSERT INTO live_search_cache (query, data) VALUES (${key}, ${JSON.stringify(payload)}::jsonb)
              ON CONFLICT (query) DO UPDATE SET data = EXCLUDED.data, created_at = NOW()`;
  } catch (e) { /* best-effort */ }

  return res.status(200).json({ ...payload, cached: false });
}

export const config = { maxDuration: 30 };
