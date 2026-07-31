import { neon } from '@neondatabase/serverless';
import { shapeArtwork } from '../../lib/sanitize';

export const dynamic = 'force-dynamic';

// GUARD — exclude sources whose stored thumbnails don't render in a browser:
//  - Digital Commonwealth legacy rows used a dead endpoint
//    (ark.digitalcommonwealth.org/.../thumbnail => 404). The sync now stores
//    correct Azure Blob URLs (bpldcassets.blob.core.windows.net); re-synced rows
//    pass this filter, only not-yet-re-synced legacy rows stay hidden.
//  - Smithsonian ids.si.edu/deliveryService is behind a WAF that rejects
//    hotlinked/automated requests. Confirmed via headless Chrome: those <img>s
//    fail to load and fall back to placeholders, so they're excluded. (A plain
//    curl with a browser UA gets 200, which is misleading — the WAF blocks the
//    actual browser hotlink.) Revisit if these move to a stable CDN or a proxy.

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  try {
    const sql = neon(process.env.DATABASE_URL);
    const { search, source, order, count } = req.query;
    const lim = Math.min(Math.abs(parseInt(req.query.limit) || 24), 100);
    const off = Math.abs(parseInt(req.query.offset) || 0);
    const rand = order === 'random';

    if (count === 'true') {
      const rows = await sql`SELECT COUNT(*) as total FROM artworks WHERE commercial_ok = true`;
      return res.status(200).json({ total: parseInt(rows[0].total) });
    }

    let works;
    if (search && source) {
      works = rand
        ? await sql`SELECT * FROM artworks WHERE commercial_ok=true AND thumb_url IS NOT NULL AND thumb_url!='' AND thumb_url NOT LIKE '%ark.digitalcommonwealth.org%' AND thumb_url NOT LIKE '%ids.si.edu%' AND source=${source} AND (title ILIKE ${'%'+search+'%'} OR artist ILIKE ${'%'+search+'%'} OR medium ILIKE ${'%'+search+'%'}) ORDER BY RANDOM() LIMIT ${lim}`
        : await sql`SELECT * FROM artworks WHERE commercial_ok=true AND thumb_url IS NOT NULL AND thumb_url!='' AND thumb_url NOT LIKE '%ark.digitalcommonwealth.org%' AND thumb_url NOT LIKE '%ids.si.edu%' AND source=${source} AND (title ILIKE ${'%'+search+'%'} OR artist ILIKE ${'%'+search+'%'} OR medium ILIKE ${'%'+search+'%'}) ORDER BY synced_at DESC LIMIT ${lim} OFFSET ${off}`;
    } else if (search) {
      works = rand
        ? await sql`SELECT * FROM artworks WHERE commercial_ok=true AND thumb_url IS NOT NULL AND thumb_url!='' AND thumb_url NOT LIKE '%ark.digitalcommonwealth.org%' AND thumb_url NOT LIKE '%ids.si.edu%' AND (title ILIKE ${'%'+search+'%'} OR artist ILIKE ${'%'+search+'%'} OR source ILIKE ${'%'+search+'%'} OR medium ILIKE ${'%'+search+'%'}) ORDER BY RANDOM() LIMIT ${lim}`
        : await sql`SELECT * FROM artworks WHERE commercial_ok=true AND thumb_url IS NOT NULL AND thumb_url!='' AND thumb_url NOT LIKE '%ark.digitalcommonwealth.org%' AND thumb_url NOT LIKE '%ids.si.edu%' AND (title ILIKE ${'%'+search+'%'} OR artist ILIKE ${'%'+search+'%'} OR source ILIKE ${'%'+search+'%'} OR medium ILIKE ${'%'+search+'%'}) ORDER BY synced_at DESC LIMIT ${lim} OFFSET ${off}`;
    } else if (source) {
      works = rand
        ? await sql`SELECT * FROM artworks WHERE commercial_ok=true AND thumb_url IS NOT NULL AND thumb_url!='' AND thumb_url NOT LIKE '%ark.digitalcommonwealth.org%' AND thumb_url NOT LIKE '%ids.si.edu%' AND source=${source} ORDER BY RANDOM() LIMIT ${lim}`
        : await sql`SELECT * FROM artworks WHERE commercial_ok=true AND thumb_url IS NOT NULL AND thumb_url!='' AND thumb_url NOT LIKE '%ark.digitalcommonwealth.org%' AND thumb_url NOT LIKE '%ids.si.edu%' AND source=${source} ORDER BY synced_at DESC LIMIT ${lim} OFFSET ${off}`;
    } else {
      works = rand
        ? await sql`SELECT * FROM artworks WHERE commercial_ok=true AND thumb_url IS NOT NULL AND thumb_url!='' AND thumb_url NOT LIKE '%ark.digitalcommonwealth.org%' AND thumb_url NOT LIKE '%ids.si.edu%' ORDER BY RANDOM() LIMIT ${lim}`
        : await sql`SELECT * FROM artworks WHERE commercial_ok=true AND thumb_url IS NOT NULL AND thumb_url!='' AND thumb_url NOT LIKE '%ark.digitalcommonwealth.org%' AND thumb_url NOT LIKE '%ids.si.edu%' ORDER BY synced_at DESC LIMIT ${lim} OFFSET ${off}`;
    }
    // Return each record as a lightweight pointer (URLs point at the museum's own
    // servers). shapeArtwork applies a public field allowlist — internal columns
    // like synced_at never leak to clients.
    const shaped = (works || []).map(shapeArtwork);
    return res.status(200).json({ works: shaped, count: shaped.length });
  } catch (e) {
    console.error('artworks error:', e);
    return res.status(500).json({ error: 'An error occurred' });
  }
}
