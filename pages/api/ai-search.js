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
  const prompt = `You are an expert art curator and visual search specialist.

The user searched for: "${query}"

CRITICAL: Only produce terms that will find artworks whose VISUAL CONTENT matches this exact subject — think about what the artwork literally DEPICTS.

Rules:
- Do NOT include generic terms like "painting", "art", "artwork", "canvas" — they match almost everything.
- Do NOT include loosely-related or administrative words. (e.g. for "cityscapes", "metropolitan" is bad — it matches "Metropolitan Borough" documents.)
- ONLY words describing the VISUAL SUBJECT of the artwork itself.

Return ONLY valid JSON (no other text):
{
  "search_terms": [8-12 specific terms for ranking/recall: subject words, art movements, notable artists, techniques],
  "must_include": [2-3 CORE subject words that EVERY relevant result must contain in its title or medium — the strict gate; keep them tight and unambiguous],
  "exclude_terms": [2-5 words that signal a NON-matching result to filter out],
  "visual_description": "2-3 sentences on what these artworks actually look like — colors, composition, mood, lighting",
  "mood": "one-word emotional quality (peaceful, dramatic, melancholic, joyful, mysterious, ...)"
}

Examples:
- "cityscapes" → search_terms: ["cityscape","city","urban","street scene","architecture","skyline","rooftops","boulevard","Canaletto","Venice"], must_include: ["cityscape","city","urban"], exclude_terms: ["portrait","still life","landscape (rural)","botanical"]
- "stormy seascape" → search_terms: ["Turner","Aivazovsky","storm","sea","ocean","waves","ship","tempest","maritime","shipwreck"], must_include: ["sea","ocean","seascape"], exclude_terms: ["portrait","still life","cityscape"]
- "Japanese woodblock" → search_terms: ["Hokusai","Hiroshige","ukiyo-e","woodblock","Mount Fuji","cherry blossom","kabuki","Edo"], must_include: ["woodblock","ukiyo-e","japanese"], exclude_terms: ["oil painting","sculpture","photograph"]

Be strict. must_include must be the tightest words that define the subject. Return ONLY JSON.`;
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
        max_tokens: 800,
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
  // Pagination: `offset` pages the result set; `mode` ('strict'|'broad') is echoed
  // back from the first page so later pages continue in the SAME set (the endpoint
  // is stateless, so the client tells us which set it's paging through).
  const off = Math.abs(parseInt(req.query.offset) || 0);
  const reqMode = req.query.mode === 'broad' ? 'broad' : null;
  const PAGE = 48;
  // Curated mode (category buttons): hard-restrict to saleable FINE-ART museum
  // collections and drop archival/documentary sources (Library of Congress,
  // Smithsonian archives, Digital Commonwealth, Internet Archive, NYPL, DPLA,
  // BnF Gallica, Europeana grab-bag) that flood themed searches with blank
  // documents and obscure record photos. `source ~* '.'` = match-all (no gate)
  // when curated is off, so free-text search keeps its full reach.
  const CURATED_SOURCE_RE = 'Metropolitan Museum|Art Institute of Chicago|Cleveland Museum|Rijksmuseum|SMK|Getty|Walters|Minneapolis Institute|Yale University Art|Philadelphia Museum|Museum of Fine Arts|Detroit Institute|Museum of Modern Art|MoMA|Louvre|Orsay|Cluny|Uffizi|Vatican|Brera|Palazzo Pitti|Doria Pamphilj|Capodimonte|Nazionale Romano|Prado|Picasso|Kunsthistorisches|Hermitage|National Palace Museum|Tokyo National|National Gallery|National Galleries|Tate|Smithsonian American Art|Cooper Hewitt|National Museum of Asian Art|Hirshhorn|National Portrait Gallery|Harvard Art|Victoria & Albert|Van Gogh|Mauritshuis|Nelson-Atkins|LACMA|Los Angeles County|Guggenheim|Whitney|Frick|Gardner|Barnes|Norton Simon|Hammer|Ashmolean|Fitzwilliam|Courtauld|Wallace Collection|Dulwich|Nasjonalmuseet|Moderna Museet|National Gallery of Canada|Montreal Museum|Art Gallery of Ontario|Tretyakov|Pushkin|Russian Museum|Städel|Alte Pinakothek|Gemäldegalerie|Belvedere|Albertina|Reina Sof|Stedelijk|Rodin|Centre Pompidou|Boston|Toledo Museum|Kimbell|Blanton';
  const srcGate = req.query.curated === '1' ? CURATED_SOURCE_RE : '.';

  const sql = neon(process.env.DATABASE_URL);
  const DEAD = '%ark.digitalcommonwealth.org%'; // dead DC thumbnail endpoint

  try {
    const cacheKey = 'v2:' + query.toLowerCase(); // v2 = must_include/exclude shape
    let ai = await getCachedExpansion(sql, cacheKey);
    let aiError = null;
    const cached = !!ai;
    if (!ai) {
      // Rate-limit ONLY the paid Claude expansion (cache miss). Cached queries —
      // including every load-more page — skip the limit so paging is never blocked.
      const rl = await checkRateLimit({ scope: 'ai-search', ip: clientIp(req), limit: 20, windowSeconds: 600 });
      if (!rl.allowed) return res.status(429).json({ error: 'Too many searches. Please wait a moment.' });
      const r = await expandQuery(query);
      ai = r.data;
      aiError = r.error;
      if (ai) await putCachedExpansion(sql, cacheKey, ai);
    }

    // search_terms → broad recall + weighted ranking (as before).
    const terms = (ai?.search_terms && ai.search_terms.length ? ai.search_terms : [query])
      .map(t => cleanStr(t, 60)).filter(Boolean).slice(0, 8);

    // must_include → the STRICT gate. Every result must contain one of these in
    // its title or medium, so a "cityscapes" search can't be flooded by works
    // that merely matched a peripheral term (e.g. "metropolitan"). We always fold
    // in the raw query and its singular so a literal match is never gated out.
    // Fold a query's likely singular into the gate so a plural query ("cityscapes")
    // still matches singular titles ("Cityscape"). Skip words that merely END in
    // 's' but aren't plurals (religious, famous, canvas, virus, analysis).
    const singular = (s) => {
      if (s.length <= 4 || !s.endsWith('s')) return s;
      if (/(ss|us|is|ous|as)$/.test(s)) return s;                     // not plurals
      if (/ies$/.test(s)) return s.slice(0, -3) + 'y';                // berries → berry
      if (/(ches|shes|sses|xes|zes)$/.test(s)) return s.slice(0, -2); // churches → church
      return s.slice(0, -1);                                          // flowers → flower
    };
    const mustTerms = [...new Set(
      [...(ai?.must_include || []), query, singular(query)]
        .map(t => cleanStr(t, 60).toLowerCase()).filter(t => t && t.length >= 3)
    )].slice(0, 6);
    const excludeTerms = [...new Set(
      (ai?.exclude_terms || []).map(t => cleanStr(t, 60).toLowerCase()).filter(t => t && t.length >= 3)
    )].slice(0, 6);

    // Fixed 8-slot shape for scoring (no dynamic SQL). Pad with a non-matching sentinel.
    const SENT = '~~no~match~sentinel~~';
    const padded = [...terms];
    while (padded.length < 8) padded.push(SENT);
    const [l0, l1, l2, l3, l4, l5, l6, l7] = padded.map(t => '%' + t + '%');

    // Word-boundary alternation regex (Postgres \y) so "city" matches the WORD
    // "city", not "electriCITY"/"capaCITY" — this is the partial-word fix.
    const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const mustRe = mustTerms.length ? '\\y(' + mustTerms.map(reEsc).join('|') + ')\\y' : null;
    const exclRe = excludeTerms.length ? '\\y(' + excludeTerms.map(reEsc).join('|') + ')\\y' : '~~no~exclude~~';

    // Weighted relevance: title 10 · artist 8 · medium 5 · bio 1 per term, plus a
    // source bonus lifting fine-art museums and penalizing Digital Commonwealth
    // documents. Image-quality guard: renderable http thumbnails only.
    // STRICT pass: mandatory word-boundary gate on must_include (title/medium),
    // exclude filter applied, ranked by the weighted search-term score.
    const strict = (mustRe && reqMode !== 'broad') ? await sql`
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
                     WHEN source ~* 'Metropolitan|Art Institute|Cleveland|Rijksmuseum|Wikidata|Wikimedia|Louvre|Getty|National Gallery|Smithsonian|Europeana|Museum of Fine Arts|Harvard|Yale|Uffizi|Prado|Tate|British Museum' THEN 5
                     ELSE 0 END)
             + (CASE WHEN artist ~* 'FiveThirtyEight|Pics Wire' THEN -10 ELSE 0 END)
             ) AS score
      FROM artworks
      WHERE commercial_ok = true
        AND thumb_url IS NOT NULL AND thumb_url != '' AND thumb_url LIKE 'http%'
        AND thumb_url NOT LIKE ${DEAD}
        AND (title ~* ${mustRe} OR medium ~* ${mustRe})
        AND NOT (title ~* ${exclRe} OR medium ~* ${exclRe})
        AND title NOT LIKE '%©%' AND artist NOT LIKE '%©%'
        AND source NOT ILIKE '%Internet Archive%'
        AND source ~* ${srcGate}
      ORDER BY score DESC, synced_at DESC
      LIMIT ${PAGE} OFFSET ${off}` : [];

    let works = strict;
    let broadened = false;
    let mode = 'strict';
    // Fallback: if the strict gate is sparse (rare/mood queries — includes art
    // MOVEMENTS like "impressionism", whose name isn't in any title/medium), fill
    // from the broad OR-match. This is also the paginated set for such queries:
    // once page 0 broadens, the client sends mode=broad so later pages page the
    // broad set directly.
    if (reqMode === 'broad' || (off === 0 && works.length < 12)) {
      broadened = true;
      mode = 'broad';
      const broad = await sql`
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
                       WHEN source ~* 'Metropolitan|Art Institute|Cleveland|Rijksmuseum|Wikidata|Wikimedia|Louvre|Getty|National Gallery|Smithsonian|Europeana|Museum of Fine Arts|Harvard|Yale|Uffizi|Prado|Tate|British Museum' THEN 5
                       ELSE 0 END)
               + (CASE WHEN artist ~* 'FiveThirtyEight|Pics Wire' THEN -10 ELSE 0 END)
               ) AS score
        FROM artworks
        WHERE commercial_ok = true
          AND thumb_url IS NOT NULL AND thumb_url != '' AND thumb_url LIKE 'http%'
          AND thumb_url NOT LIKE ${DEAD}
          AND NOT (title ~* ${exclRe} OR medium ~* ${exclRe})
          AND title NOT LIKE '%©%' AND artist NOT LIKE '%©%'
          AND source NOT ILIKE '%Internet Archive%'
          AND source ~* ${srcGate}
          AND ( title ILIKE ${l0} OR artist ILIKE ${l0} OR medium ILIKE ${l0}
             OR title ILIKE ${l1} OR artist ILIKE ${l1} OR medium ILIKE ${l1}
             OR title ILIKE ${l2} OR artist ILIKE ${l2} OR medium ILIKE ${l2}
             OR title ILIKE ${l3} OR artist ILIKE ${l3} OR medium ILIKE ${l3}
             OR title ILIKE ${l4} OR artist ILIKE ${l4} OR medium ILIKE ${l4}
             OR title ILIKE ${l5} OR artist ILIKE ${l5} OR medium ILIKE ${l5}
             OR title ILIKE ${l6} OR artist ILIKE ${l6} OR medium ILIKE ${l6}
             OR title ILIKE ${l7} OR artist ILIKE ${l7} OR medium ILIKE ${l7} )
        ORDER BY score DESC, synced_at DESC
        LIMIT ${PAGE} OFFSET ${off}`;
      const seen = new Set(works.map(w => w.id));
      for (const w of broad) if (!seen.has(w.id)) { works.push(w); seen.add(w.id); }
      works = works.slice(0, PAGE);
    }
    // A full page implies there is likely a next page (client shows "Load more").
    const hasMore = works.length === PAGE;

    // Point (4): log what actually happened so relevance is auditable.
    console.log(`ai-search "${query}" → strict=${strict.length}${broadened ? ` +broad(total ${works.length})` : ''} | must=[${mustTerms.join(', ')}] | terms=[${terms.join(', ')}]`);

    const description = ai?.visual_description || ai?.description || '';
    return res.status(200).json({
      works,
      total: works.length,
      ai_description: description,
      ai_visual_description: ai?.visual_description || '',
      ai_mood: ai?.mood || '',
      search_terms: terms,
      must_include: mustTerms,
      exclude_terms: excludeTerms,
      has_more: hasMore,                 // another page exists → client can load more
      mode,                              // 'strict'|'broad' — echo back on load-more
      offset: off,
      broadened,                         // true = strict set was sparse, broadened to fill
      low_confidence: works.length < 6,  // UI can surface a "few strong matches" note
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
