import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';

// Removes ONLY genuinely unrenderable rows: a missing thumb_url or one that
// isn't an http(s) URL (e.g. a stray source identifier the API never resolved
// to an image). Dry-run by default — pass &confirm=1 to actually delete.
//
// Deliberately does NOT delete the patterns in the original spec, because they
// match huge amounts of LEGITIMATE data (measured against the live DB):
//   • thumb_url LIKE '%default%'  → ~50,887 valid Europeana/IIIF thumbnails
//     (the standard IIIF image filename is `default.jpg`)
//   • title = 'Untitled'          → ~4,328 real works (much modern art is Untitled)
//   • LENGTH(title) < 3           → real short titles
//   • dedupe by (source,title,artist) → deletes distinct works that merely share
//     a title/artist; true dupes are already impossible (UNIQUE(source,source_id))
export default async function handler(req, res) {
  if (req.query.secret !== process.env.SYNC_SECRET) return res.status(401).json({ error: 'Unauthorized' });
  const sql = neon(process.env.DATABASE_URL);

  // Read-only breakdown: per-category counts, an informational empty-title
  // count (NOT deleted — much modern art is legitimately Untitled), and the
  // live remaining total. Never deletes. Pass &report=1.
  if (req.query.report === '1') {
    const [r] = await sql`
      SELECT
        COUNT(*) FILTER (WHERE thumb_url IS NULL)::int                                      AS null_thumb,
        COUNT(*) FILTER (WHERE thumb_url = '')::int                                          AS empty_thumb,
        COUNT(*) FILTER (WHERE thumb_url IS NOT NULL AND thumb_url != '' AND thumb_url NOT LIKE 'http%')::int AS non_http_thumb,
        COUNT(*) FILTER (WHERE thumb_url IS NULL OR thumb_url = '' OR thumb_url NOT LIKE 'http%')::int         AS would_delete,
        COUNT(*) FILTER (WHERE title IS NULL OR TRIM(title) = '')::int                       AS empty_title_info,
        COUNT(*)::int                                                                        AS total
      FROM artworks`;
    return res.status(200).json({
      report: true,
      null_thumb: r.null_thumb,
      empty_thumb: r.empty_thumb,
      non_http_thumb: r.non_http_thumb,
      would_delete: r.would_delete,                 // union of the three thumb categories above
      empty_title_info: r.empty_title_info,          // informational only — cleanup does NOT delete these
      total: r.total,
      remaining_after_cleanup: r.total - r.would_delete,
    });
  }

  const COND = "thumb_url IS NULL OR thumb_url = '' OR thumb_url NOT LIKE 'http%'";
  const [{ n: candidates }] = await sql([`SELECT COUNT(*)::int n FROM artworks WHERE ${COND}`]);

  if (req.query.confirm !== '1') {
    return res.status(200).json({ dry_run: true, would_delete: candidates, hint: 'append &confirm=1 to delete' });
  }

  const deleted = await sql([`DELETE FROM artworks WHERE ${COND} RETURNING id`]);
  const [{ n: remaining }] = await sql`SELECT COUNT(*)::int n FROM artworks`;
  return res.status(200).json({ deleted: deleted.length, remaining });
}
