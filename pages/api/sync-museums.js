import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';

// The 95 Wikidata-backed museum sources added to /api/sync. Each is a single bounded
// SPARQL query, so fanning a group out in parallel completes well within maxDuration.
// Split into groups to keep concurrency (and Wikidata load) reasonable per invocation.
const ALL = [
  'lacma','sfmoma','guggenheim','whitney','walker','carnegie','cincinnati','noma','denver','seattle',
  'dallas','houston','columbus','indianapolis','wadsworth','clark','frick','morgan','gardner','barnes',
  'chrysler','albright','joslyn','memphis','birmingham','honolulu','phoenix','sandiego','norton','hammer',
  'freer','npgdc','hirshhorn','kimbell','menil','blanton','nelsonatk','dayton','toledo','grandrapids',
  'kemper','desmoines','gemaldegal','altepina','stadel','albertina','belvedere','reinasofia','mauritshuis',
  'stedelijk','vangogh','rodin','pompidou','royalbelg','ngireland','wales','scotland','ashmolean','fitzwilliam',
  'courtauld','wallace','dulwich','gugbilbao','norway','nasjonalg','finland','ateneum','moderna','ngcanada',
  'montreal','vancouver','ontario','mexnac','fridakahlo','colombia','brasil','pinacoteca','malba','miaqatar',
  'louvreabu','israel','egyptian','topkapi','tretyakov','pushkin','russian','warsaw','prague','budapest',
  'palace','shanghai','korea','australia','agnsw','safrica',
];
const GROUPS = 3;

export default async function handler(req, res) {
  const cronAuth = req.headers['authorization'];
  const validCron   = process.env.CRON_SECRET && cronAuth === `Bearer ${process.env.CRON_SECRET}`;
  const validSecret = req?.query?.secret && req.query.secret === process.env.SYNC_SECRET;
  if (!validCron && !validSecret) return res.status(401).json({ error: 'Unauthorized' });

  const group = parseInt(req.query.group || '0', 10) || 0; // 0 = all groups
  const sources = group
    ? ALL.filter((_, i) => (i % GROUPS) === (group - 1))
    : ALL;

  const proto   = (req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const baseUrl = `${proto}://${req.headers['host']}`;
  const subHeaders = {
    'Accept': 'application/json',
    'User-Agent': 'sync-museums/1.0',
    ...(process.env.CRON_SECRET ? { 'Authorization': `Bearer ${process.env.CRON_SECRET}` } : {}),
  };
  const secretParam = !process.env.CRON_SECRET && process.env.SYNC_SECRET
    ? `&secret=${encodeURIComponent(process.env.SYNC_SECRET)}` : '';

  const results = await Promise.allSettled(
    sources.map(async (key) => {
      const signal = AbortSignal.timeout(270_000);
      const r = await fetch(`${baseUrl}/api/sync?source=${key}${secretParam}`, { headers: subHeaders, signal });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      return { key, newWorks: d.newWorks || 0 };
    })
  );

  const sourcesOut = {};
  let total = 0;
  results.forEach((r, i) => {
    const key = sources[i];
    if (r.status === 'fulfilled') { total += r.value.newWorks; sourcesOut[key] = { saved: r.value.newWorks, error: null }; }
    else sourcesOut[key] = { saved: 0, error: r.reason?.message || 'failed' };
  });

  const sql = neon(process.env.DATABASE_URL);
  const countRows = await sql`SELECT COUNT(*) as total FROM artworks`;
  return res.status(200).json({ success: true, group: group || 'all', count: sources.length, newWorks: total, totalInDb: parseInt(countRows[0].total), sources: sourcesOut });
}

export const config = { maxDuration: 300 };
