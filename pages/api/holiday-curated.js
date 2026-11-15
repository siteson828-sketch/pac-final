import { neon } from '@neondatabase/serverless';
import { shapeArtwork } from '../../lib/sanitize';
import { CURATED } from '../../lib/holidayCurated';

export const dynamic = 'force-dynamic';

// Famous, colorful, occasion-appropriate works for the /holiday pages, looked up in
// OUR stored collection (nothing is fetched from museums). The list lives in
// lib/holidayCurated.js. Results change only when the list or the collection does, so
// they are cached at the edge for a day (cheap on Neon).
//
//   GET /api/holiday-curated?cat=<slug>            -> { famous: [...], similar: [...] }
//   GET /api/holiday-curated?cat=<slug>&similar=0  -> famous only
//   GET /api/holiday-curated?cat=covers            -> { covers: { <slug>: work } }
//   add &debug=1 to see which curated entries were / were not found (not cached).

const PREFERRED = 'metropolitan|rijks|cleveland|national gallery|wikimedia|wikidata|smithsonian|harvard|yale|minneapolis|walters';
const COLOR = '(oil|tempera|acrylic|gouache|watercolo|pastel|colou?r|polychrome|painting|canvas|panel|woodblock)';

async function findEntry(sql, e) {
  const rows = await sql`SELECT * FROM artworks
    WHERE commercial_ok=true AND thumb_url IS NOT NULL AND thumb_url!=''
      AND thumb_url NOT LIKE '%ark.digitalcommonwealth.org%' AND thumb_url NOT LIKE '%artic.edu%' AND thumb_url LIKE 'http%'
      AND title ~* ${e.t} AND COALESCE(artist,'') ~* ${e.a || ''}
    ORDER BY (CASE WHEN source ~* ${PREFERRED} THEN 0 ELSE 1 END),
             (CASE WHEN title ~* ${'^(' + e.t + ')'} THEN 0 ELSE 1 END),
             length(title), id
    LIMIT 1`;
  return rows[0] || null;
}

const PAGE = 48;

// "More in the same spirit": painted/printed work by the shelf's artists OR with the shelf's
// subject words in the title, round-robin by artist (rn) so no painter takes over.
async function moreLike(sql, def, page) {
  return sql`WITH m AS (
      SELECT *, row_number() OVER (PARTITION BY lower(COALESCE(artist,'')) ORDER BY (CASE WHEN source ~* ${PREFERRED} THEN 0 ELSE 1 END), id) AS rn
      FROM artworks
      WHERE commercial_ok=true AND thumb_url IS NOT NULL AND thumb_url!=''
        AND thumb_url NOT LIKE '%ark.digitalcommonwealth.org%' AND thumb_url NOT LIKE '%artic.edu%' AND thumb_url LIKE 'http%'
        AND COALESCE(artist,'')!='' AND COALESCE(medium,'') ~* ${COLOR}
        AND (artist ~* ${def.more || def.artists.join('|')} OR title ~* ${def.terms || '$^'}))
    SELECT * FROM m WHERE rn <= 25 ORDER BY rn, id LIMIT ${PAGE} OFFSET ${page * PAGE}`;
}

const key = w => `${(w.title || '').toLowerCase().slice(0, 40)}|${(w.artist || '').toLowerCase().slice(0, 20)}`;

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const cat = String(req.query.cat || '');
  const debug = req.query.debug === '1';
  res.setHeader('Cache-Control', debug ? 'no-store' : 'public, s-maxage=86400, stale-while-revalidate=604800');

  try {
    const sql = neon(process.env.DATABASE_URL);

    if (cat === 'covers') {
      const slugs = Object.keys(CURATED);
      const out = {};
      await Promise.all(slugs.map(async slug => {
        const found = await Promise.all(CURATED[slug].entries.slice(0, 4).map(e => findEntry(sql, e).catch(() => null)));
        const w = found.find(Boolean);
        if (w) out[slug] = shapeArtwork(w);
      }));
      return res.status(200).json({ covers: out });
    }

    const def = CURATED[cat];
    if (!def) return res.status(404).json({ error: 'Unknown category' });

    const page = Math.max(0, Math.min(200, parseInt(req.query.page, 10) || 0));
    const seen = new Set();
    const famous = [];
    let found = [];
    if (page === 0) {
      found = await Promise.all(def.entries.map(e => findEntry(sql, e).catch(() => null)));
      found.forEach(w => {
        if (!w || seen.has(w.id) || seen.has(key(w))) return;
        seen.add(w.id); seen.add(key(w));
        famous.push(shapeArtwork(w));
      });
    }

    let similar = [];
    let hasMore = false;
    if (req.query.similar !== '0') {
      const rows = await moreLike(sql, def, page).catch(() => []);
      hasMore = rows.length === PAGE;
      for (const w of rows) {
        if (seen.has(w.id) || seen.has(key(w))) continue;
        seen.add(w.id); seen.add(key(w));
        similar.push(shapeArtwork(w));
      }
    }

    const body = { famous, similar, hasMore };
    if (debug) body.debug = def.entries.map((e, i) => ({ entry: e.n, found: !!found[i], title: found[i]?.title || null, artist: found[i]?.artist || null, source: found[i]?.source || null }));
    return res.status(200).json(body);
  } catch (e) {
    console.error('holiday-curated error:', e.message);
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ famous: [], similar: [], error: true });
  }
}

export const config = { maxDuration: 30 };
