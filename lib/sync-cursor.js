import { neon } from '@neondatabase/serverless';

// Per-source ingestion cursor, persisted in Neon. This is the real growth lever:
// each scheduled run reads a source's saved offset, syncs that window, then
// advances the cursor so the NEXT run pulls unseen records instead of
// re-scanning page 1. When the cursor passes a source's cap it wraps to 0 to
// refresh (ON CONFLICT dedupes, so wrapping is cheap). Never throws.
let ensured = false;

async function ensureTable(sql) {
  if (ensured) return;
  await sql`CREATE TABLE IF NOT EXISTS sync_cursors (
    source TEXT PRIMARY KEY,
    next_offset BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  ensured = true;
}

export async function getCursor(sql, source) {
  try {
    await ensureTable(sql);
    const rows = await sql`SELECT next_offset FROM sync_cursors WHERE source = ${source}`;
    return rows.length ? Number(rows[0].next_offset) : 0;
  } catch (e) {
    console.error('sync-cursor get error:', e.message);
    return 0;
  }
}

export async function setCursor(sql, source, offset) {
  try {
    await ensureTable(sql);
    await sql`INSERT INTO sync_cursors (source, next_offset, updated_at)
              VALUES (${source}, ${offset}, NOW())
              ON CONFLICT (source) DO UPDATE SET next_offset = ${offset}, updated_at = NOW()`;
  } catch (e) {
    console.error('sync-cursor set error:', e.message);
  }
}

// Advance an offset by one window, wrapping to 0 at the cap.
export function advance(offset, step, cap) {
  const next = offset + step;
  return next >= cap ? 0 : next;
}
