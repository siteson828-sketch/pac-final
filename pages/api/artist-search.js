import { neon } from '@neondatabase/serverless';
import { shapeArtwork, cleanStr } from '../../lib/sanitize';

export const dynamic = 'force-dynamic';

// Exact-artist search: returns all works whose ARTIST matches the query, with
// exact / "Lastname, Firstname" / starts-with matches ranked first. Unlike the
// AI/keyword search, this never matches title/medium — so "Rembrandt" returns
// Rembrandt's works, not works that merely mention him. Renderable rows only.
export default async function handler(req, res) {
  const q = cleanStr(req.query.q, 100);
  if (!q) return res.status(400).json({ error: 'No query' });
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  try {
    const sql = neon(process.env.DATABASE_URL);
    const lim = Math.min(Math.abs(parseInt(req.query.limit) || 96), 200);
    const off = Math.abs(parseInt(req.query.offset) || 0);
    const like = '%' + q + '%';
    const works = await sql`
      SELECT * FROM artworks
      WHERE commercial_ok = true
        AND thumb_url IS NOT NULL AND thumb_url LIKE 'http%'
        AND thumb_url NOT LIKE '%ark.digitalcommonwealth.org%' AND thumb_url NOT LIKE '%artic.edu%'
        AND artist ILIKE ${like}
      ORDER BY
        CASE
          WHEN artist ILIKE ${q} THEN 1
          WHEN artist ILIKE ${q + ',%'} THEN 2
          WHEN artist ILIKE ${q + '%'} THEN 3
          WHEN artist ILIKE ${'%' + q} THEN 4
          ELSE 5
        END,
        synced_at DESC
      LIMIT ${lim} OFFSET ${off}`;
    const [{ count }] = await sql`
      SELECT COUNT(*)::int AS count FROM artworks
      WHERE commercial_ok = true AND thumb_url LIKE 'http%'
        AND thumb_url NOT LIKE '%ark.digitalcommonwealth.org%' AND thumb_url NOT LIKE '%artic.edu%'
        AND artist ILIKE ${like}`;
    return res.status(200).json({
      works: works.map(shapeArtwork),
      total: count,
      has_more: off + works.length < count,
      offset: off,
      query: q,
      type: 'artist',
    });
  } catch (e) {
    console.error('artist-search error:', e.message);
    return res.status(500).json({ error: 'An error occurred' });
  }
}
