import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  try {
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`
      SELECT source, COUNT(*) as count, MAX(synced_at) as last_synced
      FROM artworks
      WHERE commercial_ok = true AND thumb_url IS NOT NULL AND thumb_url != ''
      GROUP BY source
      ORDER BY COUNT(*) DESC
    `;
    const total = rows.reduce((s, r) => s + parseInt(r.count), 0);
    const lastSync = rows.reduce((latest, r) => {
      const t = r.last_synced ? new Date(r.last_synced).getTime() : 0;
      return t > latest ? t : latest;
    }, 0);
    return res.status(200).json({
      total,
      lastSync: lastSync ? new Date(lastSync).toISOString() : null,
      sources: rows.map(r => ({
        source: r.source,
        count: parseInt(r.count),
        lastSync: r.last_synced ? new Date(r.last_synced).toISOString() : null,
      })),
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
