import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';

// NOTE: distinct "sources" is not the same as distinct institutions — aggregator
// sources (Wikidata/Europeana/DPLA/Trove/...) each cover thousands of museums,
// so estimated_world_coverage (vs a rough ~95k world-museum figure) is a loose
// lower-bound indicator, not a precise metric.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
  try {
    const sql = neon(process.env.DATABASE_URL);
    const [total, bySource, recent24h, recent1h] = await Promise.all([
      sql`SELECT COUNT(*) as total FROM artworks WHERE commercial_ok = true`,
      sql`SELECT source, COUNT(*) as count FROM artworks GROUP BY source ORDER BY count DESC`,
      sql`SELECT COUNT(*) as count FROM artworks WHERE synced_at > NOW() - INTERVAL '24 hours'`,
      sql`SELECT COUNT(*) as count FROM artworks WHERE synced_at > NOW() - INTERVAL '1 hour'`,
    ]);
    const distinctMuseums = bySource.length;
    return res.status(200).json({
      total_works: parseInt(total[0].total),
      distinct_museums: distinctMuseums,
      works_last_24h: parseInt(recent24h[0].count),
      works_last_1h: parseInt(recent1h[0].count),
      estimated_world_coverage: ((distinctMuseums / 95000) * 100).toFixed(2) + '%',
      by_source: bySource,
    });
  } catch (e) {
    console.error('museum-count error:', e);
    return res.status(500).json({ error: 'An error occurred' });
  }
}
