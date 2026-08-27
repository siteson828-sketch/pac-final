// One-off Smithsonian backfill: ingests all 15 art/cultural CC0 units to
// completion against the production Neon DB, then reports per-unit + total counts.
// Mirrors syncSmithsonian() in pages/api/sync.js but batches inserts (one
// multi-row INSERT per page) so a full ~120k pass finishes quickly. The nightly
// cron keeps it fresh going forward via the per-row resumable path.
import { readFileSync } from 'fs';
import { neon } from '@neondatabase/serverless';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n')
    .map(l => l.match(/^([A-Z0-9_]+)="?([^"]*)"?$/)).filter(Boolean)
    .map(m => [m[1], m[2]])
);
const sql = neon(env.DATABASE_URL);
const KEY = env.SMITHSONIAN_KEY;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const SI_UNITS = [
  { code: 'SAAM',   name: 'Smithsonian American Art Museum' },
  { code: 'NPG',    name: 'National Portrait Gallery' },
  { code: 'NMAAHC', name: 'National Museum of African American History and Culture' },
  { code: 'NMAH',   name: 'National Museum of American History' },
  { code: 'NPM',    name: 'National Postal Museum' },
  { code: 'SIA',    name: 'Smithsonian Institution Archives' },
  { code: 'NMAA',   name: 'National Museum of Asian Art' },
  { code: 'NMAI',   name: 'National Museum of the American Indian' },
  { code: 'HMSG',   name: 'Hirshhorn Museum and Sculpture Garden' },
  { code: 'HAC',    name: 'Smithsonian Gardens' },
  { code: 'ACM',    name: 'Anacostia Community Museum' },
  { code: 'NMAfA',  name: 'National Museum of African Art' },
  { code: 'SIL',    name: 'Smithsonian Libraries' },
];

function siImageUrl(media, id, max) {
  const base = media?.content || media?.thumbnail ||
    (media?.idsId ? `https://ids.si.edu/ids/deliveryService?id=${media.idsId}` : null) ||
    (id ? `https://ids.si.edu/ids/deliveryService?id=${id}` : null);
  if (!base) return null;
  if (base.includes('deliveryService') && !/[?&]max=/.test(base)) {
    return base + (base.includes('?') ? '&' : '?') + 'max=' + max;
  }
  return base;
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'PublicArtCollections/1.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function upsertBatch(works) {
  if (!works.length) return 0;
  // neon 0.9.5: no sql.query(text,params); batch tagged-template inserts in one
  // round-trip via sql.transaction([...]).
  const queries = works.map(w => {
    const printUrl = w.full_url || w.thumb_url || '';
    return sql`
      INSERT INTO artworks (source,source_id,title,artist,date_text,medium,department,
        thumb_url,full_url,detail_url,print_url,rights,rights_label,commercial_ok,bio,synced_at)
      VALUES (${w.source},${w.source_id},${w.title},${w.artist||''},${w.date_text||''},
        ${w.medium||''},${w.department||''},${w.thumb_url||''},${w.full_url||''},
        ${w.detail_url||''},${printUrl},${'CC0'},${'CC0 — Public Domain'},${true},${w.bio||''},NOW())
      ON CONFLICT (source,source_id) DO UPDATE SET
        thumb_url=EXCLUDED.thumb_url, full_url=EXCLUDED.full_url, print_url=EXCLUDED.print_url,
        synced_at=NOW()`;
  });
  await sql.transaction(queries);
  return works.length;
}

function extract(o, unit) {
  const mediaArr = o.content?.descriptiveNonRepeating?.online_media?.media;
  const mediaList = Array.isArray(mediaArr) ? mediaArr : (mediaArr ? [mediaArr] : []);
  const media = mediaList.find(m => m?.type === 'Images' && m?.usage?.access === 'CC0') ||
                mediaList.find(m => m?.usage?.access === 'CC0');
  if (!media) return null;
  const thumb = siImageUrl(media, o.id, 400);
  const full = siImageUrl(media, o.id, 1200);
  if (!thumb || !thumb.startsWith('http')) return null;
  const freetext = o.content?.freetext || {};
  const names = Array.isArray(freetext.name) ? freetext.name : [];
  const artist = names.find(n => ['Artist','Creator','Maker','Designer','Photographer','Manufacturer','Author'].includes(n.label))?.content
                 || names[0]?.content || '';
  return {
    source: unit.name, source_id: `${unit.code}_${o.id}`,
    title: o.title || 'Untitled', artist,
    date_text: freetext.date?.[0]?.content || '',
    medium: freetext.physicalDescription?.[0]?.content || freetext.medium?.[0]?.content || '',
    department: unit.name, thumb_url: thumb, full_url: full || thumb,
    detail_url: o.content?.descriptiveNonRepeating?.record_link || `https://collections.si.edu/search/detail/${o.id}`,
    bio: freetext.notes?.[0]?.content || freetext.creditLine?.[0]?.content || '',
  };
}

const PAGE = 100;
const perUnit = {};
let grand = 0;
for (const unit of SI_UNITS) {
  let start = 0, saved = 0;
  while (true) {
    const q = encodeURIComponent(`unit_code:${unit.code} AND online_media_type:"Images" AND media_usage:"CC0"`);
    let rows;
    try {
      const d = await fetchJson(`https://api.si.edu/openaccess/api/v1.0/search?q=${q}&rows=${PAGE}&start=${start}&api_key=${KEY}`);
      rows = d.response?.rows || [];
    } catch (e) { console.error(`${unit.code} @${start}: ${e.message}`); await sleep(1500); continue; }
    if (!rows.length) break;
    const works = rows.map(o => extract(o, unit)).filter(Boolean);
    try { saved += await upsertBatch(works); }
    catch (e) { console.error(`${unit.code} upsert @${start}: ${e.message}`); }
    start += rows.length;
    if (rows.length < PAGE) break;
    await sleep(120);
  }
  perUnit[unit.code] = saved;
  grand += saved;
  console.log(`${unit.code.padEnd(7)} ${unit.name.padEnd(58)} ${saved}`);
}

const total = await sql`SELECT COUNT(*)::int AS n FROM artworks`;
console.log('---');
console.log('Smithsonian upserted this run:', grand);
console.log('Total artworks in DB now:', total[0].n);
