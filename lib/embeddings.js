// OpenAI text embeddings for semantic search. Uses text-embedding-3-small at
// 512 dimensions (via the `dimensions` param) — a good quality/size tradeoff:
// 512 floats ≈ 2KB/row, so ~0.75GB across 370k works (vs ~2.3GB at 1536).
//
// Requires OPENAI_API_KEY (add it in Vercel). All calls are server-side.
const OPENAI_URL = 'https://api.openai.com/v1/embeddings';
const MODEL = 'text-embedding-3-small';
export const EMBED_DIMS = 512;

export function hasEmbeddings() {
  return !!process.env.OPENAI_API_KEY;
}

// Embed an array of strings -> array of number[] (one vector per input).
export async function embed(texts) {
  if (!process.env.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not configured');
  const input = (Array.isArray(texts) ? texts : [texts]).map(t => (t && String(t).trim()) || 'artwork');
  const res = await fetch(OPENAI_URL, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + process.env.OPENAI_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: MODEL, input, dimensions: EMBED_DIMS }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`OpenAI embeddings ${res.status}: ${JSON.stringify(j?.error || j).slice(0, 180)}`);
  // Preserve input order (OpenAI returns objects with an index).
  return j.data.sort((a, b) => a.index - b.index).map(d => d.embedding);
}

// pgvector text literal, e.g. "[0.12,-0.34,...]" — pass as a param and cast ::vector.
export function toVectorLiteral(vec) {
  return '[' + vec.join(',') + ']';
}

// Build the text we embed for a work: title + artist + medium + bio (capped).
export function workText(w) {
  const t = [w.title, w.artist, w.medium, w.bio].filter(Boolean).join(' — ').trim();
  return (t || w.title || 'artwork').slice(0, 800);
}
