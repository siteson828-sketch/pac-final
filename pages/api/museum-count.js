import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';

// ICOM estimates ~104,000 museums worldwide. Our aggregator sources (Wikidata,
// Europeana, DPLA, ...) each surface thousands of institutions, so
// `distinctSources` is a floor, not the true institutional count — the coverage
// figure below is a deliberately rough lower bound, not a precise metric.
const WORLD_MUSEUMS_ESTIMATE = 104000;

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
  try {
    const sql = neon(process.env.DATABASE_URL);
    const [totals, perSource, recent] = await Promise.all([
      sql`SELECT COUNT(*)::int AS total, COUNT(DISTINCT source)::int AS sources FROM artworks`,
      sql`SELECT source, COUNT(*)::int AS count FROM artworks GROUP BY source ORDER BY count DESC`,
      sql`SELECT
            COUNT(*) FILTER (WHERE synced_at >= NOW() - INTERVAL '24 hours')::int AS last24h,
            COUNT(*) FILTER (WHERE synced_at >= NOW() - INTERVAL '1 hour')::int  AS lasthour
          FROM artworks`,
    ]);

    const total = totals[0]?.total || 0;
    const distinctSources = totals[0]?.sources || 0;

    return res.status(200).json({
      total,
      distinctSources,
      perSource: perSource.map(r => ({ source: r.source, count: r.count })),
      addedLast24h: recent[0]?.last24h || 0,   // rows synced in window (includes re-syncs)
      addedLastHour: recent[0]?.lasthour || 0,
      estimatedWorldCoveragePct:
        Math.round((distinctSources / WORLD_MUSEUMS_ESTIMATE) * 10000) / 100,
      note:
        'distinctSources counts sync sources, not institutions. Aggregator sources ' +
        '(Wikidata/Europeana/DPLA/etc.) each cover thousands of museums, so true ' +
        'institutional coverage is far higher. Coverage % is a rough lower bound vs ~104k museums.',
    });
  } catch (e) {
    console.error('museum-count error:', e);
    return res.status(500).json({ error: 'An error occurred' });
  }
}
