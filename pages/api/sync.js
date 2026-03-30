import { neon } from '@neondatabase/serverless';

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'Accept': 'application/json' } });
  return res.json();
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function upsert(sql, works) {
  let saved = 0;
  for (const w of works) {
    try {
      await sql`
        INSERT INTO artworks (source, source_id, title, artist, date_text, medium,
          department, thumb_url, full_url, iiif_info, iiif_manifest, detail_url,
          rights, rights_label, commercial_ok, bio, synced_at)
        VALUES (
          ${w.source}, ${w.source_id}, ${w.title}, ${w.artist||''}, ${w.date_text||''},
          ${w.medium||''}, ${w.department||''}, ${w.thumb_url||''}, ${w.full_url||''},
          ${w.iiif_info||''}, ${w.iiif_manifest||''}, ${w.detail_url||''},
          ${'CC0'}, ${'CC0 — Public Domain'}, ${true}, ${w.bio||''}, NOW()
        )
        ON CONFLICT (source, source_id) DO UPDATE SET
          thumb_url = EXCLUDED.thumb_url, synced_at = NOW()
      `;
      saved++;
    } catch(e) { /* skip duplicates */ }
  }
  return saved;
}

export default async function handler(req, res) {
  if (req.query.secret !== process.env.SYNC_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const sql = neon(process.env.DATABASE_URL);
  const log = [];
  let total = 0;

  // Create table if needed
  await sql`
    CREATE TABLE IF NOT EXISTS artworks (
      id SERIAL PRIMARY KEY,
      source TEXT NOT NULL,
      source_id TEXT NOT NULL,
      title TEXT NOT NULL,
      artist TEXT,
      date_text TEXT,
      medium TEXT,
      department TEXT,
      thumb_url TEXT,
      full_url TEXT,
      iiif_info TEXT,
      iiif_manifest TEXT,
      detail_url TEXT,
      rights TEXT,
      rights_label TEXT,
      commercial_ok BOOLEAN DEFAULT true,
      bio TEXT,
      synced_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(source, source_id)
    )
  `;

  // Met Museum
  try {
    const s = await fetchJson('https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&isPublicDomain=true&q=painting');
    const ids = (s.objectIDs || []).slice(0, 500);
    const works = [];
    for (let i = 0; i < ids.length; i += 20) {
      const batch = ids.slice(i, i + 20);
      const details = await Promise.all(batch.map(id =>
        fetchJson(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`).catch(() => null)
      ));
      for (const o of details) {
        if (!o?.primaryImageSmall || !o.isPublicDomain) continue;
        works.push({ source:'Metropolitan Museum of Art', source_id:String(o.objectID),
          title:o.title||'Untitled', artist:o.artistDisplayName||'', date_text:o.objectDate||'',
          medium:o.medium||'', department:o.department||'', thumb_url:o.primaryImageSmall,
          full_url:o.primaryImage, iiif_manifest:`https://collectionapi.metmuseum.org/public/collection/v1/iiif/${o.objectID}/manifest.json`,
          detail_url:o.objectURL||'', bio:o.creditLine||'' });
      }
      await sleep(50);
    }
    const saved = await upsert(sql, works);
    total += saved;
    log.push(`Met: ${saved} saved`);
  } catch(e) { log.push(`Met error: ${e.message}`); }

  // Art Institute Chicago
  try {
    const works = [];
    for (let page = 1; page <= 10; page++) {
      const d = await fetchJson(`https://api.artic.edu/api/v1/artworks?page=${page}&limit=100&fields=id,title,artist_display,date_display,image_id,medium_display,department_title&query[term][is_public_domain]=true&query[exists][field]=image_id`);
      if (!d.data?.length) break;
      for (const o of d.data) {
        if (!o.image_id) continue;
        works.push({ source:'Art Institute of Chicago', source_id:String(o.id),
          title:o.title||'Untitled', artist:o.artist_display||'', date_text:o.date_display||'',
          medium:o.medium_display||'', department:o.department_title||'',
          thumb_url:`https://www.artic.edu/iiif/2/${o.image_id}/full/!400,400/0/default.jpg`,
          full_url:`https://www.artic.edu/iiif/2/${o.image_id}/full/full/0/default.jpg`,
          iiif_info:`https://www.artic.edu/iiif/2/${o.image_id}/info.json`,
          detail_url:`https://www.artic.edu/artworks/${o.id}`, bio:'' });
      }
      await sleep(100);
    }
    const saved = await upsert(sql, works);
    total += saved;
    log.push(`AIC: ${saved} saved`);
  } catch(e) { log.push(`AIC error: ${e.message}`); }

  // Cleveland
  try {
    const works = [];
    for (let skip = 0; skip < 2000; skip += 100) {
      const d = await fetchJson(`https://openaccess-api.clevelandart.org/api/artworks/?has_image=1&cc0=1&limit=100&skip=${skip}`);
      if (!d.data?.length) break;
      for (const o of d.data) {
        if (!o.images?.web) continue;
        works.push({ source:'Cleveland Museum of Art', source_id:String(o.id),
          title:o.title||'Untitled', artist:o.creators?.[0]?.description||'',
          date_text:o.creation_date||'', medium:o.technique||'',
          thumb_url:o.images.web.url, full_url:o.images.full?.url||o.images.web.url,
          detail_url:o.url||'', bio:o.did_you_know||'' });
      }
      await sleep(100);
    }
    const saved = await upsert(sql, works);
    total += saved;
    log.push(`Cleveland: ${saved} saved`);
  } catch(e) { log.push(`Cleveland error: ${e.message}`); }

  const countRows = await sql`SELECT COUNT(*) as total FROM artworks`;
  return res.status(200).json({ success: true, newWorks: total, totalInDb: parseInt(countRows[0].total), log });
}

export const config = { maxDuration: 300 };
