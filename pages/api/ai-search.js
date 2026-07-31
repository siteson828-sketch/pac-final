import { neon } from '@neondatabase/serverless';
import { checkRateLimit } from '../../lib/rate-limit';
import { cleanStr, clientIp } from '../../lib/sanitize';

export const dynamic = 'force-dynamic';

// Natural-language art search. Uses Claude to expand the query into keywords,
// then ILIKE-searches the artworks table. NOTE: this is keyword expansion, not
// semantic/embedding search — results depend on the terms appearing in the
// title/artist/medium/source/bio text.
//
// This endpoint calls the PAID Anthropic API on every request, so it is
// rate-limited per IP (fail-open) and the query is length-capped. Falls back to
// a plain title/artist search if the AI call fails or the key is unset.
const ANTHROPIC_MODEL = 'claude-sonnet-4-6';

async function expandQuery(query) {
  if (!process.env.ANTHROPIC_API_KEY) return { data: null, error: 'ANTHROPIC_API_KEY unset' };
  const prompt = `You are an art expert helping search a database of 350,000+ museum artworks.

The user searched for: "${query}"

Generate a JSON response with:
1. search_terms: array of 5-10 keywords to search the database (titles, artists, mediums, styles, periods)
2. description: one sentence explaining what artworks this search will find
3. mood: the emotional quality of this search (e.g. "peaceful", "dramatic", "joyful")

Return ONLY valid JSON, no other text.`;
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
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    const j = await resp.json();
    if (!resp.ok) return { data: null, error: `anthropic ${resp.status}: ${JSON.stringify(j?.error || j).slice(0, 160)}` };
    let text = j?.content?.[0]?.text || '';
    // Claude sometimes wraps JSON in ```json fences — extract the object.
    const m = text.match(/\{[\s\S]*\}/);
    if (m) text = m[0];
    try { return { data: JSON.parse(text), error: null }; }
    catch (e) { return { data: null, error: 'parse_fail: ' + String(text).slice(0, 120) }; }
  } catch (e) { return { data: null, error: 'fetch_fail: ' + e.message }; }
}

// --- term-expansion cache (Neon-backed, shared across serverless instances,
// unlike an in-memory Map that each cold start would lose). Expansions are
// stable per query, so entries don't expire. All ops fail-open. ---
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
  } catch (e) { return null; } // treat any error as a cache miss
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

  // Rate limit — this endpoint spends Anthropic tokens per call.
  const rl = await checkRateLimit({ scope: 'ai-search', ip: clientIp(req), limit: 20, windowSeconds: 600 });
  if (!rl.allowed) return res.status(429).json({ error: 'Too many searches. Please wait a moment.' });

  const sql = neon(process.env.DATABASE_URL);
  // Shared guard: exclude the dead Digital Commonwealth thumbnail endpoint,
  // matching /api/artworks so AI results don't surface broken images.
  const DEAD = '%ark.digitalcommonwealth.org%';

  try {
    // Cache Claude's term expansion by normalized query so repeat searches skip
    // the ~2-3s paid Claude call.
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
    const terms = (ai?.search_terms && ai.search_terms.length ? ai.search_terms : [query])
      .map(t => cleanStr(t, 60)).filter(Boolean).slice(0, 5);

    // Pad to a fixed 5 terms with a non-matching sentinel so the scored query is
    // fixed-shape (no dynamic SQL). The sentinel can't appear in real metadata.
    const SENT = '~~no~match~sentinel~~';
    const padded = [...terms];
    while (padded.length < 5) padded.push(SENT);
    const [l0, l1, l2, l3, l4] = padded.map(t => '%' + t + '%');

    // Relevance ranking (replaces ORDER BY synced_at DESC, which flooded results
    // with freshly bulk-synced Digital Commonwealth archival docs). Score each
    // row by where terms match — title/artist weighted far above medium/bio —
    // plus a source bonus that lifts fine-art museums and penalizes Digital
    // Commonwealth documents. `source` is used ONLY for the bonus, never for
    // matching (matching on source caused incidental "art"-in-a-name hits).
    const works = await sql`
      SELECT id, title, artist, date_text, medium, source, thumb_url, full_url,
             iiif_info, iiif_manifest, detail_url, rights_label, bio,
             ( (CASE WHEN title ILIKE ${l0} THEN 10 ELSE 0 END + CASE WHEN artist ILIKE ${l0} THEN 8 ELSE 0 END + CASE WHEN medium ILIKE ${l0} THEN 3 ELSE 0 END + CASE WHEN bio ILIKE ${l0} THEN 1 ELSE 0 END)
             + (CASE WHEN title ILIKE ${l1} THEN 10 ELSE 0 END + CASE WHEN artist ILIKE ${l1} THEN 8 ELSE 0 END + CASE WHEN medium ILIKE ${l1} THEN 3 ELSE 0 END + CASE WHEN bio ILIKE ${l1} THEN 1 ELSE 0 END)
             + (CASE WHEN title ILIKE ${l2} THEN 10 ELSE 0 END + CASE WHEN artist ILIKE ${l2} THEN 8 ELSE 0 END + CASE WHEN medium ILIKE ${l2} THEN 3 ELSE 0 END + CASE WHEN bio ILIKE ${l2} THEN 1 ELSE 0 END)
             + (CASE WHEN title ILIKE ${l3} THEN 10 ELSE 0 END + CASE WHEN artist ILIKE ${l3} THEN 8 ELSE 0 END + CASE WHEN medium ILIKE ${l3} THEN 3 ELSE 0 END + CASE WHEN bio ILIKE ${l3} THEN 1 ELSE 0 END)
             + (CASE WHEN title ILIKE ${l4} THEN 10 ELSE 0 END + CASE WHEN artist ILIKE ${l4} THEN 8 ELSE 0 END + CASE WHEN medium ILIKE ${l4} THEN 3 ELSE 0 END + CASE WHEN bio ILIKE ${l4} THEN 1 ELSE 0 END)
             + (CASE WHEN source ILIKE '%Digital Commonwealth%' THEN -6
                     WHEN source ~* 'Metropolitan|Art Institute|Cleveland|Rijksmuseum|Wikidata|Wikimedia|Louvre|Getty|National Gallery|Smithsonian|Europeana|Museum of Fine Arts|Harvard|Yale|Uffizi|Prado|Tate|British Museum|Internet Archive' THEN 5
                     ELSE 0 END)
             ) AS score
      FROM artworks
      WHERE commercial_ok = true
        AND thumb_url IS NOT NULL AND thumb_url != ''
        AND thumb_url NOT LIKE ${DEAD}
        AND ( title ILIKE ${l0} OR artist ILIKE ${l0} OR medium ILIKE ${l0}
           OR title ILIKE ${l1} OR artist ILIKE ${l1} OR medium ILIKE ${l1}
           OR title ILIKE ${l2} OR artist ILIKE ${l2} OR medium ILIKE ${l2}
           OR title ILIKE ${l3} OR artist ILIKE ${l3} OR medium ILIKE ${l3}
           OR title ILIKE ${l4} OR artist ILIKE ${l4} OR medium ILIKE ${l4} )
        -- bio stays in the score (below) but not in WHERE: it's an unindexed large
        -- text field, so matching on it here would force a full-table scan
      ORDER BY score DESC, synced_at DESC
      LIMIT 48`;

    return res.status(200).json({
      works,
      total: works.length,
      ai_description: ai?.description || '',
      ai_mood: ai?.mood || '',
      search_terms: terms,
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
      WHERE commercial_ok = true AND thumb_url IS NOT NULL AND thumb_url != ''
        AND thumb_url NOT LIKE ${DEAD}
        AND (title ILIKE ${like} OR artist ILIKE ${like})
      LIMIT 48`;
    return res.status(200).json({ works, total: works.length, original_query: query, ai: false });
  }
}

export const config = { maxDuration: 30 };
