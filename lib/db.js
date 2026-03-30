// lib/db.js — uses Neon serverless driver (replaces deprecated @vercel/postgres)
import { neon } from '@neondatabase/serverless';

function getDb() {
  return neon(process.env.DATABASE_URL);
}

export async function createTable() {
  const sql = getDb();
  await sql`
    CREATE TABLE IF NOT EXISTS artworks (
      id            SERIAL PRIMARY KEY,
      source        TEXT NOT NULL,
      source_id     TEXT NOT NULL,
      title         TEXT NOT NULL,
      artist        TEXT,
      date_text     TEXT,
      medium        TEXT,
      dimensions    TEXT,
      department    TEXT,
      country       TEXT,
      movement      TEXT,
      period        TEXT,
      subject       TEXT,
      thumb_url     TEXT,
      full_url      TEXT,
      iiif_info     TEXT,
      iiif_manifest TEXT,
      detail_url    TEXT,
      rights        TEXT,
      rights_label  TEXT,
      commercial_ok BOOLEAN DEFAULT true,
      bio           TEXT,
      raw_data      JSONB,
      synced_at     TIMESTAMP DEFAULT NOW(),
      UNIQUE(source, source_id)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_source     ON artworks(source)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_commercial ON artworks(commercial_ok)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_synced     ON artworks(synced_at)`;
  console.log('Database ready');
}

export async function upsertArtwork(work) {
  const sql = getDb();
  try {
    await sql`
      INSERT INTO artworks (
        source, source_id, title, artist, date_text, medium,
        dimensions, department, country, movement, period, subject,
        thumb_url, full_url, iiif_info, iiif_manifest, detail_url,
        rights, rights_label, commercial_ok, bio, raw_data, synced_at
      ) VALUES (
        ${work.source}, ${work.sourceId}, ${work.title}, ${work.artist||null},
        ${work.date||null}, ${work.medium||null}, ${work.dimensions||null},
        ${work.department||null}, ${work.country||null}, ${work.movement||null},
        ${work.period||null}, ${work.subject||null}, ${work.thumbUrl||null},
        ${work.fullUrl||null}, ${work.iiifInfo||null}, ${work.iiifManifest||null},
        ${work.detailUrl||null}, ${work.rights||null}, ${work.rightsLabel||null},
        ${work.commercialOk !== false}, ${work.bio||null},
        ${JSON.stringify(work.raw||{})}::jsonb, NOW()
      )
      ON CONFLICT (source, source_id) DO UPDATE SET
        thumb_url  = EXCLUDED.thumb_url,
        full_url   = EXCLUDED.full_url,
        iiif_info  = EXCLUDED.iiif_info,
        rights     = EXCLUDED.rights,
        synced_at  = NOW()
    `;
    return true;
  } catch(e) {
    console.error('upsert failed:', work.sourceId, e.message);
    return false;
  }
}

export async function upsertBatch(works) {
  let saved = 0;
  for (let i = 0; i < works.length; i += 50) {
    const chunk = works.slice(i, i + 50);
    await Promise.all(chunk.map(w => upsertArtwork(w).then(ok => { if(ok) saved++; })));
  }
  return saved;
}

export async function getArtworks({ search, movement, period, subject, source, limit=24, offset=0 } = {}) {
  const sql = getDb();
  if (search) {
    return await sql`
      SELECT * FROM artworks
      WHERE commercial_ok = true AND thumb_url IS NOT NULL
        AND (title ILIKE ${'%'+search+'%'} OR artist ILIKE ${'%'+search+'%'})
      ORDER BY synced_at DESC LIMIT ${limit} OFFSET ${offset}
    `;
  }
  return await sql`
    SELECT * FROM artworks
    WHERE commercial_ok = true AND thumb_url IS NOT NULL
    ORDER BY synced_at DESC LIMIT ${limit} OFFSET ${offset}
  `;
}

export async function getCount() {
  const sql = getDb();
  const rows = await sql`SELECT COUNT(*) as total FROM artworks WHERE commercial_ok = true`;
  return parseInt(rows[0].total);
}
