import { neon } from '@neondatabase/serverless';
import { SITE, CHUNK } from '../lib/sitemap';

// One artwork sitemap chunk: /artwork/<id> URLs for the p-th CHUNK-sized slice,
// ordered by the primary key (stable, index-only scan). lastmod = synced_at.
// Referenced only for in-range p by the index, so an out-of-range p (manual
// probe) 404s rather than emitting an empty, invalid <urlset>.

function ymd(d) { try { return new Date(d).toISOString().slice(0, 10); } catch (e) { return null; } }

export async function getServerSideProps({ res, query }) {
  const p = Math.max(0, parseInt(query.p || '0', 10) || 0);
  let rows = [];
  try {
    const sql = neon(process.env.DATABASE_URL);
    rows = await sql`SELECT id, synced_at FROM artworks ORDER BY id LIMIT ${CHUNK} OFFSET ${p * CHUNK}`;
  } catch (e) {
    rows = [];
  }

  if (!rows.length) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Not found');
    return { props: {} };
  }

  const urls = rows.map(r => {
    const lm = ymd(r.synced_at);
    return `  <url><loc>${SITE}/artwork/${r.id}</loc>${lm ? `<lastmod>${lm}</lastmod>` : ''}</url>`;
  }).join('\n');
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=43200');
  res.write(xml);
  res.end();
  return { props: {} };
}

export default function ArtworkSitemap() { return null; }
