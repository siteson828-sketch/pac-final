import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';

export default async function handler(req, res) {
  const { id } = req.query;
  try {
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`SELECT * FROM artworks WHERE id = ${parseInt(id)} LIMIT 1`;
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
    return res.status(200).json({ work: rows[0] });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
