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

// Actual war/military museum sources present in the DB (ingested via Europeana /
// Digital Commonwealth). The viewer's "Military & War Art" tile pulls ONLY from
// these (see ?warmuseums=1), not war-themed art from other museums. "Warsaw"
// sources are deliberately excluded — a city, not a war museum.
const WAR_MUSEUM_SOURCES = [
  'Europeana — Army Museum',
  'Europeana — Estonian War Museum',
  'Europeana — King Ferdinand I National Military Museum',
  'Europeana — National Museum of Romanian Navy',
  'Europeana — Netherlands Institute for Military History',
  'Europeana — The Military Archives of Sweden',
  'Europeana — Vytautas the Great War Museum',
  'Digital Commonwealth — U.S. Army Natick Soldier Systems Center',
];
function synonymRegex(q) {
  const norm = String(q || '').trim().toLowerCase().replace(/s$/, ''); // nude/nudes → nude
  const set = SYNONYMS[norm];
  if (!set) return null;
  const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return '\\y(' + [...new Set(set)].map(esc).join('|') + ')\\y';
}

// Saleability ranking: when browsing a museum/category (not random), lift
// blue-chip, print-selling masters to the top so the most sellable, recognizable
// work leads and the obscure long tail follows. Kept in sync with the same list
// in pages/api/ai-search.js.
const FAMOUS_ARTISTS_RE = 'Monet|Manet|Renoir|Degas|C[eé]zanne|Van Gogh|Gauguin|Toulouse-Lautrec|Seurat|Pissarro|Sisley|Caillebotte|Rembrandt|Vermeer|Rubens|Frans Hals|Caravaggio|Titian|Raphael|Michelangelo|Leonardo|Botticelli|Bruegel|Brueghel|D[uü]rer|Goya|Vel[aá]zquez|El Greco|Turner|Constable|Gainsborough|Klimt|Schiele|Munch|Hokusai|Hiroshige|Utamaro|Whistler|Sargent|Cassatt|Winslow Homer|Waterhouse|Hieronymus Bosch|Delacroix|Ingres|Caspar David Friedrich|Rossetti|Millais|Burne-Jones|Alphonse Mucha|Tissot|Bouguereau|Corot|Courbet|Millet|Fragonard|Watteau|Canaletto|Hopper|Georgia O.Keeffe';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
  try {
    const sql = neon(process.env.DATABASE_URL);
    const { search, source, order, count } = req.query;
    const lim = Math.min(Math.abs(parseInt(req.query.limit) || 24), 100);
    const off = Math.abs(parseInt(req.query.offset) || 0);
    const rand = order === 'random' || req.query.random === 'true';
    // Artist normalization (first line, before "(") for the diversity partition —
    // passed as params to avoid SQL-in-template backslash escaping.
    const NL = '\n';
    const STRIP = '\\s*\\(.*$';
    // Visual-appeal ranking (kept in sync with pages/api/ai-search.js).
    const COLOR_RE  = '(oil|tempera|acrylic|gouache|watercolo|pastel|colou?r|polychrome|painting|canvas)';
    const MONO_RE   = '(engrav|etch|drypoint|mezzotint|drawing|sketch|charcoal|graphite|pencil|pen and ink|album|photostat)';
    const ICONIC_RE = '(water lil|starry night|sunflower|great wave|girl with a pearl|american gothic|birth of venus|night watch|las meninas|mona lisa|the kiss|the scream|nighthawks|liberty leading|luncheon of the boating|moulin de la galette|card players|the bathers|haystack|rouen cathedral|impression, sunrise|irises|the bedroom|whistler|venus de|the swing|the hay wain|fighting temeraire|rain, steam)';

    if (count === 'true') {
      const rows = await sql`SELECT COUNT(*) as total FROM artworks WHERE commercial_ok = true`;
      return res.status(200).json({ total: parseInt(rows[0].total) });
    }

    // Per-source counts (renderable rows only) — the homepage uses this to hide
    // museum chips that currently have no works, so a filter is never a dead end.
    if (req.query.sourceCounts) {
      const rows = await sql`
        SELECT source, COUNT(*)::int AS n FROM artworks
        WHERE commercial_ok = true AND thumb_url LIKE 'http%' AND thumb_url NOT LIKE '%ark.digitalcommonwealth.org%' AND thumb_url NOT LIKE '%artic.edu%'
        GROUP BY source`;
      const counts = {};
      for (const r of rows) counts[r.source] = r.n;
      return res.status(200).json({ counts });
    }

    let works;
    if (req.query.warmuseums) {
      const sv = search || ''; // optional in-tile keyword filter; '' = no filter
      works = rand
        ? await sql`SELECT * FROM artworks WHERE commercial_ok=true AND thumb_url IS NOT NULL AND thumb_url!='' AND thumb_url NOT LIKE '%ark.digitalcommonwealth.org%' AND thumb_url NOT LIKE '%artic.edu%' AND thumb_url LIKE 'http%' AND source = ANY(${WAR_MUSEUM_SOURCES}) AND (${sv} = '' OR title ILIKE ${'%'+sv+'%'} OR artist ILIKE ${'%'+sv+'%'} OR medium ILIKE ${'%'+sv+'%'}) ORDER BY RANDOM() LIMIT ${lim}`
        : await sql`SELECT * FROM artworks WHERE commercial_ok=true AND thumb_url IS NOT NULL AND thumb_url!='' AND thumb_url NOT LIKE '%ark.digitalcommonwealth.org%' AND thumb_url NOT LIKE '%artic.edu%' AND thumb_url LIKE 'http%' AND source = ANY(${WAR_MUSEUM_SOURCES}) AND (${sv} = '' OR title ILIKE ${'%'+sv+'%'} OR artist ILIKE ${'%'+sv+'%'} OR medium ILIKE ${'%'+sv+'%'}) ORDER BY synced_at DESC LIMIT ${lim} OFFSET ${off}`;
    } else if (search && source) {
      works = rand
        ? await sql`SELECT * FROM artworks WHERE commercial_ok=true AND thumb_url IS NOT NULL AND thumb_url!='' AND thumb_url NOT LIKE '%ark.digitalcommonwealth.org%' AND thumb_url NOT LIKE '%artic.edu%' AND thumb_url LIKE 'http%' AND source=${source} AND (title ILIKE ${'%'+search+'%'} OR artist ILIKE ${'%'+search+'%'} OR medium ILIKE ${'%'+search+'%'}) ORDER BY RANDOM() LIMIT ${lim}`
        : await sql`SELECT * FROM artworks WHERE commercial_ok=true AND thumb_url IS NOT NULL AND thumb_url!='' AND thumb_url NOT LIKE '%ark.digitalcommonwealth.org%' AND thumb_url NOT LIKE '%artic.edu%' AND thumb_url LIKE 'http%' AND source=${source} AND (title ILIKE ${'%'+search+'%'} OR artist ILIKE ${'%'+search+'%'} OR medium ILIKE ${'%'+search+'%'}) ORDER BY synced_at DESC LIMIT ${lim} OFFSET ${off}`;
    } else if (search) {
      const syn = synonymRegex(search); // multilingual word-boundary regex, or null
      if (syn) {
        works = rand
          ? await sql`SELECT * FROM artworks WHERE commercial_ok=true AND thumb_url IS NOT NULL AND thumb_url!='' AND thumb_url NOT LIKE '%ark.digitalcommonwealth.org%' AND thumb_url NOT LIKE '%artic.edu%' AND thumb_url LIKE 'http%' AND (title ~* ${syn} OR medium ~* ${syn} OR artist ~* ${syn}) ORDER BY RANDOM() LIMIT ${lim}`
          : await sql`SELECT * FROM artworks WHERE commercial_ok=true AND thumb_url IS NOT NULL AND thumb_url!='' AND thumb_url NOT LIKE '%ark.digitalcommonwealth.org%' AND thumb_url NOT LIKE '%artic.edu%' AND thumb_url LIKE 'http%' AND (title ~* ${syn} OR medium ~* ${syn} OR artist ~* ${syn}) ORDER BY synced_at DESC LIMIT ${lim} OFFSET ${off}`;
      } else {
        works = rand
          ? await sql`SELECT * FROM artworks WHERE commercial_ok=true AND thumb_url IS NOT NULL AND thumb_url!='' AND thumb_url NOT LIKE '%ark.digitalcommonwealth.org%' AND thumb_url NOT LIKE '%artic.edu%' AND thumb_url LIKE 'http%' AND (title ILIKE ${'%'+search+'%'} OR artist ILIKE ${'%'+search+'%'} OR source ILIKE ${'%'+search+'%'} OR medium ILIKE ${'%'+search+'%'}) ORDER BY RANDOM() LIMIT ${lim}`
          : await sql`SELECT * FROM artworks WHERE commercial_ok=true AND thumb_url IS NOT NULL AND thumb_url!='' AND thumb_url NOT LIKE '%ark.digitalcommonwealth.org%' AND thumb_url NOT LIKE '%artic.edu%' AND thumb_url LIKE 'http%' AND (title ILIKE ${'%'+search+'%'} OR artist ILIKE ${'%'+search+'%'} OR source ILIKE ${'%'+search+'%'} OR medium ILIKE ${'%'+search+'%'}) ORDER BY synced_at DESC LIMIT ${lim} OFFSET ${off}`;
      }
    } else if (source) {
      works = rand
        ? await sql`SELECT * FROM artworks WHERE commercial_ok=true AND thumb_url IS NOT NULL AND thumb_url!='' AND thumb_url NOT LIKE '%ark.digitalcommonwealth.org%' AND thumb_url NOT LIKE '%artic.edu%' AND thumb_url LIKE 'http%' AND source=${source} ORDER BY RANDOM() LIMIT ${lim}`
        : await sql`SELECT * FROM (SELECT * FROM artworks WHERE commercial_ok=true AND thumb_url IS NOT NULL AND thumb_url!='' AND thumb_url NOT LIKE '%ark.digitalcommonwealth.org%' AND thumb_url NOT LIKE '%artic.edu%' AND thumb_url LIKE 'http%' AND source=${source}) s ORDER BY ROW_NUMBER() OVER (PARTITION BY lower(trim(regexp_replace(split_part(coalesce(artist,''), ${NL}, 1), ${STRIP}, ''))) ORDER BY (CASE WHEN artist ~* ${FAMOUS_ARTISTS_RE} THEN 30 ELSE 0 END + CASE WHEN medium ~* ${COLOR_RE} THEN 14 ELSE 0 END + CASE WHEN medium ~* ${MONO_RE} THEN -10 ELSE 0 END + CASE WHEN title ~* ${ICONIC_RE} THEN 25 ELSE 0 END) DESC, synced_at DESC), (CASE WHEN artist ~* ${FAMOUS_ARTISTS_RE} THEN 30 ELSE 0 END + CASE WHEN medium ~* ${COLOR_RE} THEN 14 ELSE 0 END + CASE WHEN medium ~* ${MONO_RE} THEN -10 ELSE 0 END + CASE WHEN title ~* ${ICONIC_RE} THEN 25 ELSE 0 END) DESC, synced_at DESC LIMIT ${lim} OFFSET ${off}`;
    } else {
      works = rand
        ? await sql`SELECT * FROM artworks WHERE commercial_ok=true AND thumb_url IS NOT NULL AND thumb_url!='' AND thumb_url NOT LIKE '%ark.digitalcommonwealth.org%' AND thumb_url NOT LIKE '%artic.edu%' AND thumb_url LIKE 'http%' ORDER BY RANDOM() LIMIT ${lim}`
        : await sql`SELECT * FROM artworks WHERE commercial_ok=true AND thumb_url IS NOT NULL AND thumb_url!='' AND thumb_url NOT LIKE '%ark.digitalcommonwealth.org%' AND thumb_url NOT LIKE '%artic.edu%' AND thumb_url LIKE 'http%' ORDER BY synced_at DESC LIMIT ${lim} OFFSET ${off}`;
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
