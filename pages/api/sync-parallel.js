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
  { key: 'louvre',      label: 'Louvre' },
  { key: 'british',     label: 'British Museum' },
  { key: 'national',    label: 'National Gallery' },
  { key: 'tate',        label: 'Tate' },
  { key: 'orsay',       label: 'Musée d\'Orsay' },
  { key: 'prado',       label: 'Prado' },
  { key: 'uffizi',      label: 'Uffizi' },
  { key: 'hermitage',   label: 'Hermitage' },
  { key: 'moma',        label: 'MoMA' },
  { key: 'rijkswiki',   label: 'Rijksmuseum (Wiki)' },
  { key: 'khm',         label: 'KHM Vienna' },
  { key: 'cluny',       label: 'Musée de Cluny' },
  { key: 'vawiki',      label: 'V&A (Wiki)' },
  { key: 'npm',         label: 'National Palace Museum' },
  { key: 'tokyo',       label: 'Tokyo National Museum' },
  { key: 'saam',        label: 'Smithsonian American Art' },
  { key: 'phila',       label: 'Philadelphia Museum' },
  { key: 'mfa',         label: 'Boston MFA' },
  { key: 'detroit',     label: 'Detroit Institute' },
  { key: 'ngvic',       label: 'National Gallery Victoria' },
  { key: 'auckland',    label: 'Auckland Art Gallery' },
  { key: 'picassobcn',  label: 'Museu Picasso Barcelona' },
  { key: 'brera',       label: 'Pinacoteca Brera' },
  { key: 'vasariano',   label: 'Corridoio Vasariano' },
  { key: 'pitti',       label: 'Palazzo Pitti' },
  { key: 'doria',       label: 'Galleria Doria Pamphilj' },
  { key: 'spada',       label: 'Galleria Spada' },
  { key: 'capodimonte', label: 'Capodimonte Naples' },
  { key: 'romano',      label: 'Museo Nazionale Romano' },
  { key: 'vatican',     label: 'Vatican Museums' },
];

export default async function handler(req, res) {
  // Auth via Authorization: Bearer header only (see /api/sync). ?secret= removed.
  const auth = req.headers['authorization'] || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const authorized =
    (process.env.CRON_SECRET && token === process.env.CRON_SECRET) ||
    (process.env.SYNC_SECRET && token === process.env.SYNC_SECRET);
  if (!authorized) return res.status(401).json({ error: 'Unauthorized' });

  const proto   = (req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host    = req.headers['host'];
  const baseUrl = `${proto}://${host}`;

  // Sub-calls authenticate with the Authorization header only (never ?secret= in a URL).
  const bearer = process.env.CRON_SECRET || process.env.SYNC_SECRET || '';
  const subHeaders = {
    'Accept': 'application/json',
    'User-Agent': 'sync-parallel/1.0',
    ...(bearer ? { 'Authorization': `Bearer ${bearer}` } : {}),
  };

  const results = await Promise.allSettled(
    SOURCES.map(async ({ key }) => {
      const signal = AbortSignal.timeout(270_000);
      const r = await fetch(`${baseUrl}/api/sync?source=${key}`, { headers: subHeaders, signal });
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
