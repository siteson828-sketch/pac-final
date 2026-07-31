import { neon } from '@neondatabase/serverless';
import { shapeArtwork } from '../../../lib/sanitize';

export const dynamic = 'force-dynamic';

export default async function handler(req, res) {
  const id = parseInt(req.query.id, 10);
  if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'Invalid id' });
  try {
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`SELECT * FROM artworks WHERE id = ${id} LIMIT 1`;
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    // Allowlist output so internal columns (synced_at, etc.) never leak.
    return res.status(200).json({ work: shapeArtwork(rows[0]) });
  } catch (e) {
    console.error('artwork/[id] error:', e);
    return res.status(500).json({ error: 'An error occurred' });
  }
}
