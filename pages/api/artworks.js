import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  try {
    const sql = neon(process.env.DATABASE_URL);
    const { search, source, order, limit = '24', offset = '0', count } = req.query;
    const lim = parseInt(limit);
    const off = parseInt(offset);
    const rand = order === 'random';

    if (count === 'true') {
      const rows = await sql`SELECT COUNT(*) as total FROM artworks WHERE commercial_ok = true`;
      return res.status(200).json({ total: parseInt(rows[0].total) });
    }

    let works;
    if (search && source) {
      works = rand
        ? await sql`SELECT * FROM artworks WHERE commercial_ok=true AND thumb_url IS NOT NULL AND thumb_url!='' AND source=${source} AND (title ILIKE ${'%'+search+'%'} OR artist ILIKE ${'%'+search+'%'} OR medium ILIKE ${'%'+search+'%'}) ORDER BY RANDOM() LIMIT ${lim}`
        : await sql`SELECT * FROM artworks WHERE commercial_ok=true AND thumb_url IS NOT NULL AND thumb_url!='' AND source=${source} AND (title ILIKE ${'%'+search+'%'} OR artist ILIKE ${'%'+search+'%'} OR medium ILIKE ${'%'+search+'%'}) ORDER BY synced_at DESC LIMIT ${lim} OFFSET ${off}`;
    } else if (search) {
      works = rand
        ? await sql`SELECT * FROM artworks WHERE commercial_ok=true AND thumb_url IS NOT NULL AND thumb_url!='' AND (title ILIKE ${'%'+search+'%'} OR artist ILIKE ${'%'+search+'%'} OR source ILIKE ${'%'+search+'%'} OR medium ILIKE ${'%'+search+'%'}) ORDER BY RANDOM() LIMIT ${lim}`
        : await sql`SELECT * FROM artworks WHERE commercial_ok=true AND thumb_url IS NOT NULL AND thumb_url!='' AND (title ILIKE ${'%'+search+'%'} OR artist ILIKE ${'%'+search+'%'} OR source ILIKE ${'%'+search+'%'} OR medium ILIKE ${'%'+search+'%'}) ORDER BY synced_at DESC LIMIT ${lim} OFFSET ${off}`;
    } else if (source) {
      works = rand
        ? await sql`SELECT * FROM artworks WHERE commercial_ok=true AND thumb_url IS NOT NULL AND thumb_url!='' AND source=${source} ORDER BY RANDOM() LIMIT ${lim}`
        : await sql`SELECT * FROM artworks WHERE commercial_ok=true AND thumb_url IS NOT NULL AND thumb_url!='' AND source=${source} ORDER BY synced_at DESC LIMIT ${lim} OFFSET ${off}`;
    } else {
      works = rand
        ? await sql`SELECT * FROM artworks WHERE commercial_ok=true AND thumb_url IS NOT NULL AND thumb_url!='' ORDER BY RANDOM() LIMIT ${lim}`
        : await sql`SELECT * FROM artworks WHERE commercial_ok=true AND thumb_url IS NOT NULL AND thumb_url!='' ORDER BY synced_at DESC LIMIT ${lim} OFFSET ${off}`;
    }
    return res.status(200).json({ works, count: works.length });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
