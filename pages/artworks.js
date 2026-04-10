import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export default async function handler(req, res) {
  try {
    const sql = neon(process.env.DATABASE_URL);
    const query = req.query || {};
    const { search, limit='24', offset='0', count } = query;

    if (count === 'true') {
      const rows = await sql`SELECT COUNT(*) as total FROM artworks WHERE commercial_ok=true`;
      return res.status(200).json({total:parseInt(rows[0].total)});
    }

    let works;
    if (search) {
      works = await sql`SELECT * FROM artworks WHERE commercial_ok=true AND thumb_url IS NOT NULL AND thumb_url!='' AND (title ILIKE ${'%'+search+'%'} OR artist ILIKE ${'%'+search+'%'} OR source ILIKE ${'%'+search+'%'}) ORDER BY synced_at DESC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;
    } else {
      works = await sql`SELECT * FROM artworks WHERE commercial_ok=true AND thumb_url IS NOT NULL AND thumb_url!='' ORDER BY synced_at DESC LIMIT ${parseInt(limit)} OFFSET ${parseInt(offset)}`;
    }
    return res.status(200).json({works,count:works.length});
  } catch(e) {
    return res.status(500).json({error:e.message});
  }
}
