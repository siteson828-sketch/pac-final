import { neon } from '@neondatabase/serverless';
import { shapeArtwork } from '../../lib/sanitize';

export const dynamic = 'force-dynamic';

// GUARD: legacy Digital Commonwealth rows used a dead thumbnail endpoint
// (ark.digitalcommonwealth.org/.../thumbnail => 404). The sync now stores the
// correct Azure Blob URLs (bpldcassets.blob.core.windows.net), so re-synced rows
// pass this filter; only not-yet-re-synced legacy rows stay hidden.
// (Smithsonian ids.si.edu is NOT excluded: its WAF rejects the headless
// automation signature but serves 200 image/jpeg to real browsers — verified
// with a de-automated headless Chrome — so those images display fine.)

// Cross-language synonym expansion for themed searches, so e.g. "nude" also
// surfaces French "nu"/"nue", German "Akt", Dutch "naakt", Italian "nudo",
// Spanish "desnudo". Matched with word boundaries (Postgres \y) so it never hits
// "avenue"/"continue"/"contact"/"abstrakt". Extend this map with more concepts.
const SYNONYMS = {
  nude: ['nude', 'nudes', 'naked', 'nu', 'nue', 'nus', 'nues', 'nackt', 'akt', 'akte', 'nudo', 'nuda', 'nudi', 'desnudo', 'desnuda', 'naakt', 'nudité', 'nudita'],
};
function synonymRegex(q) {
  const norm = String(q || '').trim().toLowerCase().replace(/s$/, ''); // nude/nudes → nude
  const set = SYNONYMS[norm];
  if (!set) return null;
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return '\\y(' + [...new Set(set)].map(esc).join('|') + ')\\y';
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  try {
    const sql = neon(process.env.DATABASE_URL);
    const { search, source, order, count } = req.query;
    const lim = Math.min(Math.abs(parseInt(req.query.limit) || 24), 100);
    const off = Math.abs(parseInt(req.query.offset) || 0);
    const rand = order === 'random' || req.query.random === 'true';

    if (count === 'true') {
      const rows = await sql`SELECT COUNT(*) as total FROM artworks WHERE commercial_ok = true`;
      return res.status(200).json({ total: parseInt(rows[0].total) });
    }

    let works;
    if (search && source) {
      works = rand
        ? await sql`SELECT * FROM artworks WHERE commercial_ok=true AND thumb_url IS NOT NULL AND thumb_url!='' AND thumb_url NOT LIKE '%ark.digitalcommonwealth.org%' AND thumb_url LIKE 'http%' AND source=${source} AND (title ILIKE ${'%'+search+'%'} OR artist ILIKE ${'%'+search+'%'} OR medium ILIKE ${'%'+search+'%'}) ORDER BY RANDOM() LIMIT ${lim}`
        : await sql`SELECT * FROM artworks WHERE commercial_ok=true AND thumb_url IS NOT NULL AND thumb_url!='' AND thumb_url NOT LIKE '%ark.digitalcommonwealth.org%' AND thumb_url LIKE 'http%' AND source=${source} AND (title ILIKE ${'%'+search+'%'} OR artist ILIKE ${'%'+search+'%'} OR medium ILIKE ${'%'+search+'%'}) ORDER BY synced_at DESC LIMIT ${lim} OFFSET ${off}`;
    } else if (search) {
      const syn = synonymRegex(search); // multilingual word-boundary regex, or null
      if (syn) {
        works = rand
          ? await sql`SELECT * FROM artworks WHERE commercial_ok=true AND thumb_url IS NOT NULL AND thumb_url!='' AND thumb_url NOT LIKE '%ark.digitalcommonwealth.org%' AND thumb_url LIKE 'http%' AND (title ~* ${syn} OR medium ~* ${syn} OR artist ~* ${syn}) ORDER BY RANDOM() LIMIT ${lim}`
          : await sql`SELECT * FROM artworks WHERE commercial_ok=true AND thumb_url IS NOT NULL AND thumb_url!='' AND thumb_url NOT LIKE '%ark.digitalcommonwealth.org%' AND thumb_url LIKE 'http%' AND (title ~* ${syn} OR medium ~* ${syn} OR artist ~* ${syn}) ORDER BY synced_at DESC LIMIT ${lim} OFFSET ${off}`;
      } else {
        works = rand
          ? await sql`SELECT * FROM artworks WHERE commercial_ok=true AND thumb_url IS NOT NULL AND thumb_url!='' AND thumb_url NOT LIKE '%ark.digitalcommonwealth.org%' AND thumb_url LIKE 'http%' AND (title ILIKE ${'%'+search+'%'} OR artist ILIKE ${'%'+search+'%'} OR source ILIKE ${'%'+search+'%'} OR medium ILIKE ${'%'+search+'%'}) ORDER BY RANDOM() LIMIT ${lim}`
          : await sql`SELECT * FROM artworks WHERE commercial_ok=true AND thumb_url IS NOT NULL AND thumb_url!='' AND thumb_url NOT LIKE '%ark.digitalcommonwealth.org%' AND thumb_url LIKE 'http%' AND (title ILIKE ${'%'+search+'%'} OR artist ILIKE ${'%'+search+'%'} OR source ILIKE ${'%'+search+'%'} OR medium ILIKE ${'%'+search+'%'}) ORDER BY synced_at DESC LIMIT ${lim} OFFSET ${off}`;
      }
    } else if (source) {
      works = rand
        ? await sql`SELECT * FROM artworks WHERE commercial_ok=true AND thumb_url IS NOT NULL AND thumb_url!='' AND thumb_url NOT LIKE '%ark.digitalcommonwealth.org%' AND thumb_url LIKE 'http%' AND source=${source} ORDER BY RANDOM() LIMIT ${lim}`
        : await sql`SELECT * FROM artworks WHERE commercial_ok=true AND thumb_url IS NOT NULL AND thumb_url!='' AND thumb_url NOT LIKE '%ark.digitalcommonwealth.org%' AND thumb_url LIKE 'http%' AND source=${source} ORDER BY synced_at DESC LIMIT ${lim} OFFSET ${off}`;
    } else {
      works = rand
        ? await sql`SELECT * FROM artworks WHERE commercial_ok=true AND thumb_url IS NOT NULL AND thumb_url!='' AND thumb_url NOT LIKE '%ark.digitalcommonwealth.org%' AND thumb_url LIKE 'http%' ORDER BY RANDOM() LIMIT ${lim}`
        : await sql`SELECT * FROM artworks WHERE commercial_ok=true AND thumb_url IS NOT NULL AND thumb_url!='' AND thumb_url NOT LIKE '%ark.digitalcommonwealth.org%' AND thumb_url LIKE 'http%' ORDER BY synced_at DESC LIMIT ${lim} OFFSET ${off}`;
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
