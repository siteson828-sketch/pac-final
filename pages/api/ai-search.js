import { neon } from '@neondatabase/serverless';
import { checkRateLimit } from '../../lib/rate-limit';
import { cleanStr, clientIp } from '../../lib/sanitize';

export const dynamic = 'force-dynamic';

// Natural-language art search. Uses Claude to expand the query into visual
// keywords, then ILIKE-searches the artworks table with weighted relevance.
// NOTE: keyword expansion, not embedding search — results depend on the terms
// appearing in title/artist/medium/source/bio text (GIN trigram indexes on
// title/artist/medium make the ILIKEs fast).
//
// Calls the PAID Anthropic API per request → rate-limited per IP (fail-open),
// query length-capped, expansion cached. Falls back to a plain title/artist
// search if the AI call fails or the key is unset.
const ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';

async function expandQuery(query) {
  if (!process.env.ANTHROPIC_API_KEY) return { data: null, error: 'ANTHROPIC_API_KEY unset' };
  const prompt = `You are an expert art curator and visual search specialist with deep knowledge of art history, styles, periods, and techniques.

The user searched for: "${query}"

Find artworks that VISUALLY match this description. Think about what these works actually LOOK LIKE — colors, composition, mood, lighting — plus the art movements/periods/styles, the specific artists known for this look, and the medium/technique that produces it.

Return ONLY valid JSON (no other text):
{
  "search_terms": [8-12 SPECIFIC keywords likely to appear in artwork titles/artists/mediums: specific artist names, art-movement names, visual descriptors (chiaroscuro, plein air, sfumato), medium/technique (oil on canvas, watercolor, engraving), subject matter (seascape, portrait, still life), period terms (Renaissance, Baroque, 17th century)],
  "visual_description": "2-3 sentences describing exactly what these artworks look like — colors, composition, mood, lighting, technique",
  "mood": "one-word emotional quality (peaceful, dramatic, melancholic, joyful, mysterious, ...)",
  "exclude_terms": [3-5 terms to filter out irrelevant results]
}

Examples:
- "blue melancholy" → search_terms: ["Picasso","Munch","Whistler","blue","melancholy","nocturne","moonlight","sorrow","cool tones","twilight"]
- "stormy seascape" → search_terms: ["Turner","Winslow Homer","Aivazovsky","storm","sea","ocean","waves","ship","tempest","maritime","shipwreck"]
- "Japanese woodblock" → search_terms: ["Hokusai","Hiroshige","Utamaro","ukiyo-e","woodblock","edo","Mount Fuji","cherry blossom","kabuki","landscape"]

Be very specific about visual qualities. Return ONLY JSON.`;
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 700,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const j = await resp.json();
    if (!resp.ok) return { data: null, error: `anthropic ${resp.status}: ${JSON.stringify(j?.error || j).slice(0, 160)}` };
    let text = j?.content?.[0]?.text || '';
    const m = text.match(/\{[\s\S]*\}/); // Claude sometimes wraps JSON in ```json fences
    if (m) text = m[0];
    try { return { data: JSON.parse(text), error: null }; }
    catch (e) { return { data: null, error: 'parse_fail: ' + String(text).slice(0, 120) }; }
  } catch (e) { return { data: null, error: 'fetch_fail: ' + e.message }; }
}

// --- term-expansion cache (Neon-backed; stable per query, fail-open) ---
let cacheEnsured = false;
async function ensureCacheTable(sql) {
  if (cacheEnsured) return;
  await sql`CREATE TABLE IF NOT EXISTS ai_search_cache (
    query TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`;
  cacheEnsured = true;
}
async function getCachedExpansion(sql, key) {
  try {
    await ensureCacheTable(sql);
    const rows = await sql`SELECT data FROM ai_search_cache WHERE query = ${key}`;
    return rows[0]?.data || null;
  } catch (e) { return null; }
}
async function putCachedExpansion(sql, key, data) {
  try {
    await ensureCacheTable(sql);
    await sql`INSERT INTO ai_search_cache (query, data) VALUES (${key}, ${JSON.stringify(data)}::jsonb)
              ON CONFLICT (query) DO UPDATE SET data = EXCLUDED.data, created_at = NOW()`;
  } catch (e) { /* best-effort */ }
}

export default async function handler(req, res) {
  const query = cleanStr(req.query.query, 200);
  if (!query) return res.status(400).json({ error: 'No query' });

  const rl = await checkRateLimit({ scope: 'ai-search', ip: clientIp(req), limit: 20, windowSeconds: 600 });
  if (!rl.allowed) return res.status(429).json({ error: 'Too many searches. Please wait a moment.' });

  const sql = neon(process.env.DATABASE_URL);
  const DEAD = '%ark.digitalcommonwealth.org%'; // dead DC thumbnail endpoint

  try {
    const cacheKey = query.toLowerCase();
    let ai = await getCachedExpansion(sql, cacheKey);
    let aiError = null;
    const cached = !!ai;
    if (!ai) {
      const r = await expandQuery(query);
      ai = r.data;
      aiError = r.error;
      if (ai) await putCachedExpansion(sql, cacheKey, ai);
    }

    // Up to 8 expansion terms (was 5) for better recall on visual queries.
    const terms = (ai?.search_terms && ai.search_terms.length ? ai.search_terms : [query])
      .map(t => cleanStr(t, 60)).filter(Boolean).slice(0, 8);

    // Fixed 8-slot shape (no dynamic SQL). Pad with a sentinel that can't match.
    const SENT = '~~no~match~sentinel~~';
    const padded = [...terms];
    while (padded.length < 8) padded.push(SENT);
    const [l0, l1, l2, l3, l4, l5, l6, l7] = padded.map(t => '%' + t + '%');

    // Weighted relevance: title 10 · artist 8 · medium 5 · bio 1 per term, plus a
    // source bonus lifting fine-art museums and penalizing Digital Commonwealth
    // documents. Image-quality guard: renderable http thumbnails only.
    const works = await sql`
      SELECT id, title, artist, date_text, medium, source, thumb_url, full_url,
             iiif_info, iiif_manifest, detail_url, rights_label, bio,
             ( (CASE WHEN title ILIKE ${l0} THEN 10 ELSE 0 END + CASE WHEN artist ILIKE ${l0} THEN 8 ELSE 0 END + CASE WHEN medium ILIKE ${l0} THEN 5 ELSE 0 END + CASE WHEN bio ILIKE ${l0} THEN 1 ELSE 0 END)
             + (CASE WHEN title ILIKE ${l1} THEN 10 ELSE 0 END + CASE WHEN artist ILIKE ${l1} THEN 8 ELSE 0 END + CASE WHEN medium ILIKE ${l1} THEN 5 ELSE 0 END + CASE WHEN bio ILIKE ${l1} THEN 1 ELSE 0 END)
             + (CASE WHEN title ILIKE ${l2} THEN 10 ELSE 0 END + CASE WHEN artist ILIKE ${l2} THEN 8 ELSE 0 END + CASE WHEN medium ILIKE ${l2} THEN 5 ELSE 0 END + CASE WHEN bio ILIKE ${l2} THEN 1 ELSE 0 END)
             + (CASE WHEN title ILIKE ${l3} THEN 10 ELSE 0 END + CASE WHEN artist ILIKE ${l3} THEN 8 ELSE 0 END + CASE WHEN medium ILIKE ${l3} THEN 5 ELSE 0 END + CASE WHEN bio ILIKE ${l3} THEN 1 ELSE 0 END)
             + (CASE WHEN title ILIKE ${l4} THEN 10 ELSE 0 END + CASE WHEN artist ILIKE ${l4} THEN 8 ELSE 0 END + CASE WHEN medium ILIKE ${l4} THEN 5 ELSE 0 END + CASE WHEN bio ILIKE ${l4} THEN 1 ELSE 0 END)
             + (CASE WHEN title ILIKE ${l5} THEN 10 ELSE 0 END + CASE WHEN artist ILIKE ${l5} THEN 8 ELSE 0 END + CASE WHEN medium ILIKE ${l5} THEN 5 ELSE 0 END + CASE WHEN bio ILIKE ${l5} THEN 1 ELSE 0 END)
             + (CASE WHEN title ILIKE ${l6} THEN 10 ELSE 0 END + CASE WHEN artist ILIKE ${l6} THEN 8 ELSE 0 END + CASE WHEN medium ILIKE ${l6} THEN 5 ELSE 0 END + CASE WHEN bio ILIKE ${l6} THEN 1 ELSE 0 END)
             + (CASE WHEN title ILIKE ${l7} THEN 10 ELSE 0 END + CASE WHEN artist ILIKE ${l7} THEN 8 ELSE 0 END + CASE WHEN medium ILIKE ${l7} THEN 5 ELSE 0 END + CASE WHEN bio ILIKE ${l7} THEN 1 ELSE 0 END)
             + (CASE WHEN source ILIKE '%Digital Commonwealth%' THEN -6
                     WHEN source ~* 'Metropolitan|Art Institute|Cleveland|Rijksmuseum|Wikidata|Wikimedia|Louvre|Getty|National Gallery|Smithsonian|Europeana|Museum of Fine Arts|Harvard|Yale|Uffizi|Prado|Tate|British Museum|Internet Archive' THEN 5
                     ELSE 0 END)
             ) AS score
      FROM artworks
      WHERE commercial_ok = true
        AND thumb_url IS NOT NULL AND thumb_url != '' AND thumb_url LIKE 'http%'
        AND thumb_url NOT LIKE ${DEAD}
        AND ( title ILIKE ${l0} OR artist ILIKE ${l0} OR medium ILIKE ${l0}
           OR title ILIKE ${l1} OR artist ILIKE ${l1} OR medium ILIKE ${l1}
           OR title ILIKE ${l2} OR artist ILIKE ${l2} OR medium ILIKE ${l2}
           OR title ILIKE ${l3} OR artist ILIKE ${l3} OR medium ILIKE ${l3}
           OR title ILIKE ${l4} OR artist ILIKE ${l4} OR medium ILIKE ${l4}
           OR title ILIKE ${l5} OR artist ILIKE ${l5} OR medium ILIKE ${l5}
           OR title ILIKE ${l6} OR artist ILIKE ${l6} OR medium ILIKE ${l6}
           OR title ILIKE ${l7} OR artist ILIKE ${l7} OR medium ILIKE ${l7} )
      ORDER BY score DESC, synced_at DESC
      LIMIT 48`;

    const description = ai?.visual_description || ai?.description || '';
    return res.status(200).json({
      works,
      total: works.length,
      ai_description: description,
      ai_visual_description: ai?.visual_description || '',
      ai_mood: ai?.mood || '',
      search_terms: terms,
      exclude_terms: ai?.exclude_terms || [],
      original_query: query,
      ai: !!ai,
      cached,
      ai_error: aiError || undefined,
    });
  } catch (e) {
    console.error('ai-search error:', e);
    const like = '%' + query + '%';
    const works = await sql`
      SELECT id, title, artist, date_text, medium, source, thumb_url, full_url,
             iiif_info, iiif_manifest, detail_url, rights_label, bio
      FROM artworks
      WHERE commercial_ok = true AND thumb_url IS NOT NULL AND thumb_url != '' AND thumb_url LIKE 'http%'
        AND thumb_url NOT LIKE ${DEAD}
        AND (title ILIKE ${like} OR artist ILIKE ${like})
      LIMIT 48`;
    return res.status(200).json({ works, total: works.length, original_query: query, ai: false });
  }
}

export const config = { maxDuration: 30 };
