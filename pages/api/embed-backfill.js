import { neon } from '@neondatabase/serverless';
import { embed, toVectorLiteral, workText, hasEmbeddings, EMBED_DIMS } from '../../lib/embeddings';
import { clientIp } from '../../lib/sanitize';
import { isIpBlocked, recordAuthFailure, logSecurityEvent } from '../../lib/security';

export const dynamic = 'force-dynamic';

// Admin-only (SYNC_SECRET) embedding backfill. Idempotent + resumable: each run
// embeds up to `limit` works that don't yet have an embedding, so repeated runs
// page through the collection. First run also enables pgvector + adds the column.
//   GET /api/embed-backfill?secret=...&limit=500
async function ensureSchema(sql) {
  await sql`CREATE EXTENSION IF NOT EXISTS vector`;
  // 512 = EMBED_DIMS; DDL can't be parameterized, and the value is a fixed constant.
  await sql`ALTER TABLE artworks ADD COLUMN IF NOT EXISTS embedding vector(512)`;
}

export default async function handler(req, res) {
  const ip = clientIp(req);
  if (await isIpBlocked(ip)) return res.status(403).json({ error: 'Temporarily blocked' });
  if (req.query.secret !== process.env.SYNC_SECRET) {
    await recordAuthFailure(ip);
    await logSecurityEvent({ ip, ua: req.headers['user-agent'], endpoint: 'embed-backfill', result: 'unauthorized' });
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (EMBED_DIMS !== 512) return res.status(500).json({ error: 'EMBED_DIMS/column mismatch — column is vector(512)' });
  if (!hasEmbeddings()) return res.status(400).json({ error: 'OPENAI_API_KEY not configured' });

  const sql = neon(process.env.DATABASE_URL);
  try {
    await ensureSchema(sql);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 500, 1), 1000);

    const rows = await sql`
      SELECT id, title, artist, medium, bio FROM artworks
      WHERE embedding IS NULL AND commercial_ok = true
        AND thumb_url IS NOT NULL AND thumb_url != ''
        AND thumb_url NOT LIKE '%ark.digitalcommonwealth.org%'
      ORDER BY id LIMIT ${limit}`;

    if (!rows.length) {
      const tot = await sql`SELECT COUNT(*)::int c FROM artworks WHERE embedding IS NOT NULL`;
      return res.status(200).json({ done: true, this_run: 0, embedded_total: tot[0].c });
    }

    // One embedding call for the whole batch, then update rows individually.
    const vectors = await embed(rows.map(workText));
    let updated = 0;
    for (let i = 0; i < rows.length; i++) {
      const lit = toVectorLiteral(vectors[i]);
      await sql`UPDATE artworks SET embedding = ${lit}::vector WHERE id = ${rows[i].id}`;
      updated++;
    }

    const [{ c: embedded }] = await sql`SELECT COUNT(*)::int c FROM artworks WHERE embedding IS NOT NULL`;
    const [{ c: remaining }] = await sql`
      SELECT COUNT(*)::int c FROM artworks
      WHERE embedding IS NULL AND commercial_ok = true AND thumb_url IS NOT NULL AND thumb_url != ''
        AND thumb_url NOT LIKE '%ark.digitalcommonwealth.org%'`;
    return res.status(200).json({ this_run: updated, embedded_total: embedded, remaining });
  } catch (e) {
    console.error('embed-backfill error:', e);
    return res.status(502).json({ error: e.message || 'backfill failed' });
  }
}

export const config = { maxDuration: 300 };
