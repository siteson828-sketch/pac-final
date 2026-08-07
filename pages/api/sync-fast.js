import { neon } from '@neondatabase/serverless';
import { getCursor, setCursor, advance } from '../../lib/sync-cursor';

export const dynamic = 'force-dynamic';

// Turbo sync: the high-volume, offset-capable sources run in parallel (one
// concurrent run per provider — parallelism is ACROSS providers, so no single
// API gets hammered), each starting from its saved cursor and advancing it so
// consecutive runs ingest new records. It reuses /api/sync, so the full
// metadata (incl. print_url/full_url) and each source's built-in rate limiting
// are preserved — this is "fast" by not re-scanning page 1, not by stripping
// data or removing politeness. Scheduled every 15 min via vercel.json.
//
// `step` = records/indexes covered per run; `cap` = wrap point (list length for
// finite query/term sources, or a corpus-depth ceiling for deep offset sources).
const FAST_SOURCES = [
  { key: 'wikidataglobal', step: 3000, cap: 300000 }, // SPARQL LIMIT 3000 OFFSET
  { key: 'rijks',          step: 2000, cap: 120000 }, // SQL LIMIT 2000 OFFSET
  { key: 'smk',            step: 3000, cap: 300000 }, // record offset, 3000/run
  { key: 'vam',            step: 3000, cap: 300000 }, // record offset, ~3000/run
  { key: 'bnf',            step: 1000, cap: 200000 }, // startRecord, 1000/run
  { key: 'europeana',      step: 5,    cap: 15 },     // query-list index (15 queries)
  { key: 'dpla',           step: 2,    cap: 10 },     // term-list index (10 terms)
  { key: 'loc',            step: 2,    cap: 5 },      // term-list index (5 terms)
  { key: 'metcomplete',    step: 1000, cap: 503000 }, // Met object-ID list slice, 1000/run (fills the full ~502k)
];

export default async function handler(req, res) {
  // Auth via Authorization: Bearer header only (see /api/sync).
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const authorized =
    (process.env.CRON_SECRET && token === process.env.CRON_SECRET) ||
    (process.env.SYNC_SECRET && token === process.env.SYNC_SECRET);
  if (!authorized) return res.status(401).json({ error: 'Unauthorized' });

  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const baseUrl = `${proto}://${req.headers['host']}`;
  const bearer = process.env.CRON_SECRET || process.env.SYNC_SECRET || '';
  const subHeaders = {
    'Accept': 'application/json',
    'User-Agent': 'sync-fast/1.0',
    ...(bearer ? { 'Authorization': `Bearer ${bearer}` } : {}),
  };

  const sql = neon(process.env.DATABASE_URL);
  const started = Date.now();

  const results = await Promise.allSettled(
    FAST_SOURCES.map(async (s) => {
      const offset = await getCursor(sql, s.key);
      const signal = AbortSignal.timeout(280_000);
      const r = await fetch(`${baseUrl}/api/sync?source=${s.key}&offset=${offset}`, { headers: subHeaders, signal });
      let d = {};
      try { d = await r.json(); } catch (e) { throw new Error(`bad JSON from /api/sync (HTTP ${r.status})`); }
      if (!r.ok) {
        // d.error may be a string OR an object — stringify objects so the real
        // detail survives instead of collapsing to "[object Object]".
        const detail = typeof d.error === 'string' ? d.error
          : d.error ? JSON.stringify(d.error) : `HTTP ${r.status}`;
        throw new Error(detail);
      }
      // /api/sync catches each source's failure internally and records it in
      // d.log as "<Name> error: <message>" while still returning HTTP 200. Surface
      // that line so the real cause is visible instead of a silent added:0.
      const errLine = Array.isArray(d.log) ? d.log.find(l => /error:/i.test(l)) : null;
      // Only advance the cursor on a CLEAN run (no logged error), so a failed
      // window retries next time rather than being skipped.
      if (!errLine) await setCursor(sql, s.key, advance(offset, s.step, s.cap));
      return { key: s.key, offset, added: d.newWorks || 0, error: errLine || null };
    })
  );

  const sources = {};
  let added = 0;
  results.forEach((r, i) => {
    const key = FAST_SOURCES[i].key;
    if (r.status === 'fulfilled') {
      added += r.value.added;
      sources[key] = { offset: r.value.offset, added: r.value.added, error: r.value.error };
    } else {
      const e = r.reason;
      const msg = e?.message || (typeof e === 'string' ? e : e ? JSON.stringify(e) : 'failed');
      sources[key] = { added: 0, error: msg };
    }
  });

  let totalInDb = null;
  try { const c = await sql`SELECT COUNT(*) AS total FROM artworks`; totalInDb = parseInt(c[0].total); } catch (e) {}

  return res.status(200).json({ ok: true, added, tookMs: Date.now() - started, totalInDb, sources });
}

export const config = { maxDuration: 300 };
