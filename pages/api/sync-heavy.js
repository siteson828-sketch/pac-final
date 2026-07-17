import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';

// The heavy sources that overran the 300s limit as single calls. Each entry is one
// bounded offset-chunk (same pattern as wikidataglobal); the source's sync function
// processes just that window. Fanning the chunks out in parallel covers the full range
// nightly without any single call timing out.
const CHUNKS = [
  ['rijks', 0], ['rijks', 2000], ['rijks', 4000],
  ['rijkswiki', 0], ['rijkswiki', 5000],
  ['yale', 0], ['yale', 5000],
  ['smk', 0], ['smk', 3000], ['smk', 6000], ['smk', 9000], ['smk', 12000],
  ['vam', 0], ['vam', 3000], ['vam', 6000], ['vam', 9000], ['vam', 12000], ['vam', 15000],
  ['bnf', 1], ['bnf', 1001], ['bnf', 2001], ['bnf', 3001], ['bnf', 4001],
  ['europeana', 0], ['europeana', 5], ['europeana', 10],
  ['loc', 0], ['loc', 2], ['loc', 4],
  ['dpla', 0], ['dpla', 2], ['dpla', 4], ['dpla', 6], ['dpla', 8],
  ['internetarchive', 0], ['internetarchive', 2], ['internetarchive', 4], ['internetarchive', 6],
];
const GROUPS = 2;

export default async function handler(req, res) {
  const cronAuth = req.headers['authorization'];
  const validCron   = process.env.CRON_SECRET && cronAuth === `Bearer ${process.env.CRON_SECRET}`;
  const validSecret = req?.query?.secret && req.query.secret === process.env.SYNC_SECRET;
  if (!validCron && !validSecret) return res.status(401).json({ error: 'Unauthorized' });

  const group = parseInt(req.query.group || '0', 10) || 0; // 0 = all chunks
  const chunks = group
    ? CHUNKS.filter((_, i) => (i % GROUPS) === (group - 1))
    : CHUNKS;

  const proto   = (req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const baseUrl = `${proto}://${req.headers['host']}`;
  const subHeaders = {
    'Accept': 'application/json',
    'User-Agent': 'sync-heavy/1.0',
    ...(process.env.CRON_SECRET ? { 'Authorization': `Bearer ${process.env.CRON_SECRET}` } : {}),
  };
  const secretParam = !process.env.CRON_SECRET && process.env.SYNC_SECRET
    ? `&secret=${encodeURIComponent(process.env.SYNC_SECRET)}` : '';

  const results = await Promise.allSettled(
    chunks.map(async ([key, offset]) => {
      const signal = AbortSignal.timeout(280_000);
      const r = await fetch(`${baseUrl}/api/sync?source=${key}&offset=${offset}${secretParam}`, { headers: subHeaders, signal });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      return { key, offset, newWorks: d.newWorks || 0 };
    })
  );

  const out = [];
  let total = 0;
  results.forEach((r, i) => {
    const [key, offset] = chunks[i];
    if (r.status === 'fulfilled') { total += r.value.newWorks; out.push({ key, offset, saved: r.value.newWorks, error: null }); }
    else out.push({ key, offset, saved: 0, error: r.reason?.message || 'failed' });
  });

  const sql = neon(process.env.DATABASE_URL);
  const countRows = await sql`SELECT COUNT(*) as total FROM artworks`;
  return res.status(200).json({ success: true, group: group || 'all', chunks: chunks.length, newWorks: total, totalInDb: parseInt(countRows[0].total), results: out });
}

export const config = { maxDuration: 300 };
