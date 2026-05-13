import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';

const SOURCES = [
  { key: 'met',         label: 'Met Museum' },
  { key: 'artic',       label: 'Art Inst. Chicago' },
  { key: 'cleveland',   label: 'Cleveland' },
  { key: 'rijks',       label: 'Rijksmuseum' },
  { key: 'smk',         label: 'SMK Denmark' },
  { key: 'vam',         label: 'V&A Museum' },
  { key: 'europeana',   label: 'Europeana' },
  { key: 'smithsonian', label: 'Smithsonian' },
  { key: 'harvard',     label: 'Harvard' },
  { key: 'getty',       label: 'Getty Museum' },
  { key: 'walters',     label: 'Walters Art Museum' },
  { key: 'mia',         label: 'Minneapolis Inst. of Art' },
  { key: 'yale',        label: 'Yale Art Gallery' },
  { key: 'loc',         label: 'Library of Congress' },
  { key: 'bnf',         label: 'BnF Gallica' },
  { key: 'nypl',        label: 'NYPL' },
  { key: 'wikimedia',   label: 'Wikimedia Commons' },
  { key: 'dpla',        label: 'DPLA' },
  { key: 'tepapa',      label: 'Te Papa' },
];

export default async function handler(req, res) {
  const cronAuth = req.headers['authorization'];
  const validCron   = process.env.CRON_SECRET && cronAuth === `Bearer ${process.env.CRON_SECRET}`;
  const validSecret = req?.query?.secret && req.query.secret === process.env.SYNC_SECRET;
  if (!validCron && !validSecret) return res.status(401).json({ error: 'Unauthorized' });

  const proto   = (req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host    = req.headers['host'];
  const baseUrl = `${proto}://${host}`;

  // Prefer CRON_SECRET (Authorization header) so sub-calls never expose SYNC_SECRET in URLs
  const subHeaders = {
    'Accept': 'application/json',
    'User-Agent': 'sync-parallel/1.0',
    ...(process.env.CRON_SECRET
      ? { 'Authorization': `Bearer ${process.env.CRON_SECRET}` }
      : {}),
  };
  const secretParam = !process.env.CRON_SECRET && process.env.SYNC_SECRET
    ? `&secret=${encodeURIComponent(process.env.SYNC_SECRET)}`
    : '';

  const results = await Promise.allSettled(
    SOURCES.map(async ({ key }) => {
      const r = await fetch(`${baseUrl}/api/sync?source=${key}${secretParam}`, { headers: subHeaders });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || `HTTP ${r.status}`);
      return { key, newWorks: d.newWorks || 0, log: d.log || [] };
    })
  );

  const log = [];
  const sources = {};
  let total = 0;

  for (const [i, r] of results.entries()) {
    const { key, label } = SOURCES[i];
    if (r.status === 'fulfilled') {
      const { newWorks, log: srcLog } = r.value;
      total += newWorks;
      sources[key] = { saved: newWorks, error: null };
      srcLog.forEach(entry => log.push(entry));
    } else {
      const msg = r.reason?.message || 'failed';
      sources[key] = { saved: 0, error: msg };
      log.push(`${label} error: ${msg}`);
    }
  }

  const sql = neon(process.env.DATABASE_URL);
  const countRows = await sql`SELECT COUNT(*) as total FROM artworks`;
  return res.status(200).json({
    success: true,
    newWorks: total,
    totalInDb: parseInt(countRows[0].total),
    log,
    sources,
  });
}

export const config = { maxDuration: 300 };
