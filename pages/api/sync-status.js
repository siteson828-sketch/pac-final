import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';

// Read-only sync progress monitor (no secret — exposes only catalog counts and
// per-source sync progress, nothing sensitive). Creates sync_state if the
// orchestrator hasn't run yet so this never errors on a cold table.
export default async function handler(req, res) {
  const sql = neon(process.env.DATABASE_URL);
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS sync_state (
        source TEXT PRIMARY KEY,
        current_offset INTEGER DEFAULT 0,
        total_synced INTEGER DEFAULT 0,
        synced_today INTEGER DEFAULT 0,
        last_run TIMESTAMP DEFAULT NOW(),
        last_reset DATE DEFAULT CURRENT_DATE,
        priority INTEGER DEFAULT 3,
        max_daily INTEGER DEFAULT 2000,
        offset_step INTEGER DEFAULT 1000
      )`;
    const [total, states, recent] = await Promise.all([
      sql`SELECT COUNT(*) AS count FROM artworks WHERE commercial_ok = true`,
      sql`SELECT source, priority, total_synced, synced_today, max_daily, current_offset, last_run FROM sync_state ORDER BY priority ASC, total_synced DESC`,
      sql`SELECT COUNT(*) AS count FROM artworks WHERE synced_at > NOW() - INTERVAL '24 hours'`,
    ]);
    return res.status(200).json({
      total_works: parseInt(total[0].count),
      added_last_24h: parseInt(recent[0].count),
      source_count: states.length,
      estimated_daily_max: states.reduce((a, r) => a + (r.max_daily || 0), 0),
      sources: states,
    });
  } catch (e) {
    console.error('sync-status error:', e.message);
    return res.status(500).json({ error: 'Could not read sync status' });
  }
}
