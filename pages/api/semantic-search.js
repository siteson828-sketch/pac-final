import { neon } from '@neondatabase/serverless';
import { embed, toVectorLiteral, hasEmbeddings } from '../../lib/embeddings';
import { checkRateLimit } from '../../lib/rate-limit';
import { cleanStr, clientIp } from '../../lib/sanitize';

export const dynamic = 'force-dynamic';

// True semantic search: embed the query, then rank works by cosine distance
// against their stored pgvector embeddings. Only returns works that have been
// embedded (embedding IS NOT NULL). Rate-limited (calls the paid embeddings API).
export default async function handler(req, res) {
  const query = cleanStr(req.query.query, 200);
  if (!query) return res.status(400).json({ error: 'No query' });

  const rl = await checkRateLimit({ scope: 'semantic-search', ip: clientIp(req), limit: 30, windowSeconds: 600 });
  if (!rl.allowed) return res.status(429).json({ error: 'Too many searches. Please wait a moment.' });
  if (!hasEmbeddings()) return res.status(400).json({ error: 'Semantic search not configured (OPENAI_API_KEY unset)' });

  const sql = neon(process.env.DATABASE_URL);
  try {
    const [qvec] = await embed([query]);
    const lit = toVectorLiteral(qvec);
    // Cosine distance operator <=>; smaller = closer. Guard dead DC thumbnails.
    const works = await sql`
      SELECT id, title, artist, date_text, medium, source, thumb_url, full_url,
             iiif_info, iiif_manifest, detail_url, rights_label, bio,
             ROUND((1 - (embedding <=> ${lit}::vector))::numeric, 3) AS similarity
      FROM artworks
      WHERE embedding IS NOT NULL AND commercial_ok = true
        AND thumb_url IS NOT NULL AND thumb_url != ''
        AND thumb_url NOT LIKE '%ark.digitalcommonwealth.org%'
      ORDER BY embedding <=> ${lit}::vector
      LIMIT 48`;
    return res.status(200).json({ works, total: works.length, original_query: query, semantic: true });
  } catch (e) {
    console.error('semantic-search error:', e);
    return res.status(502).json({ error: 'Semantic search failed' });
  }
}

export const config = { maxDuration: 30 };
