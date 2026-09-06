import { neon } from '@neondatabase/serverless';
import { SITE, CHUNK } from '../lib/sitemap';

// Dynamic sitemap INDEX. Lists the static core-pages sitemap plus one artwork
// sitemap per 45k-URL chunk (sitemaps cap at 50k URLs / 50MB). Chunk count is
// derived from the live artworks count, so it grows automatically as the
// collection does. Cached a day at the edge — Googlebot fetches this rarely and
// the DB is hit at most once/day. Artwork chunks are paginated via ?p= (Next's
// pages router can't express a dynamic segment with a literal .xml suffix, and
// Google fully supports query-string sitemap URLs).

export async function getServerSideProps({ res }) {
  let numChunks = 0;
  try {
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`SELECT COUNT(*)::int AS c FROM artworks`;
    numChunks = Math.ceil((rows[0].c || 0) / CHUNK);
  } catch (e) {
    numChunks = 0; // still emit a valid index with just the core pages
  }

  const entries = [`  <sitemap><loc>${SITE}/sitemap-pages.xml</loc></sitemap>`];
  for (let p = 0; p < numChunks; p++) {
    entries.push(`  <sitemap><loc>${SITE}/sitemap-artworks.xml?p=${p}</loc></sitemap>`);
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${entries.join('\n')}\n</sitemapindex>\n`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=43200');
  res.write(xml);
  res.end();
  return { props: {} };
}

export default function SitemapIndex() { return null; }
