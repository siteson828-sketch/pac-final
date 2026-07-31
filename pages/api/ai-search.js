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
    const { data: ai, error: aiError } = await expandQuery(query);
    const terms = (ai?.search_terms && ai.search_terms.length ? ai.search_terms : [query])
      .map(t => cleanStr(t, 60)).filter(Boolean).slice(0, 5);

    const results = [];
    for (const term of terms) {
      const like = '%' + term + '%';
      const rows = await sql`
        SELECT id, title, artist, date_text, medium, source, thumb_url, full_url,
               iiif_info, iiif_manifest, detail_url, rights_label, bio
        FROM artworks
        WHERE commercial_ok = true
          AND thumb_url IS NOT NULL AND thumb_url != ''
          AND thumb_url NOT LIKE ${DEAD}
          AND (title ILIKE ${like} OR artist ILIKE ${like} OR medium ILIKE ${like}
               OR source ILIKE ${like} OR bio ILIKE ${like})
        ORDER BY synced_at DESC
        LIMIT 20`;
      results.push(...rows);
    }

    const seen = new Set();
    const unique = results.filter(r => (seen.has(r.id) ? false : (seen.add(r.id), true)));

    return res.status(200).json({
      works: unique.slice(0, 48),
      total: unique.length,
      ai_description: ai?.description || '',
      ai_mood: ai?.mood || '',
      search_terms: terms,
      original_query: query,
      ai: !!ai,
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
