export const dynamic = 'force-dynamic';
export const config = { maxDuration: 30 };

// Hardened image proxy for edge-caching museum thumbnails.
// Security: HTTPS only · domain whitelist (blocks SSRF to arbitrary/internal
// hosts) · private/loopback IP block (belt-and-suspenders) · require image/*
// content-type · 10MB cap. Rate limiting is handled at the edge by the Vercel
// firewall `RL api` rule (per-image Neon rate-limiting would add a DB round-trip
// to every thumbnail — far too costly for this endpoint).

// Exact-match hosts (shared platforms like cloudfront/blob/googleusercontent are
// listed as specific hosts, NOT wildcarded, so the proxy can't be pointed at
// arbitrary content hosted on those platforms).
const ALLOWED = new Set([
  'framemark.vam.ac.uk', 'collections.vam.ac.uk',
  'www.artic.edu',
  'openaccess-api.clevelandart.org', 'openaccess-cdn.clevelandart.org',
  'collectionapi.metmuseum.org', 'images.metmuseum.org',
  'www.rijksmuseum.nl',
  'api.smk.dk', 'iip.smk.dk',
  'images.nypl.org', 'digitalcollections.nypl.org',
  'tile.loc.gov',
  'gallica.bnf.fr',
  'media.nga.gov',
  'iiif.harvardartmuseums.org', 'ids.lib.harvard.edu',
  'api.dp.la',
  'iiif.wellcomecollection.org',
  'iiif.artsmia.org', '1.api.artsmia.org',
  'ids.si.edu',
  'ark.digitalcommonwealth.org', 'bpldcassets.blob.core.windows.net',
  'images.collection.cooperhewitt.org',
  'd32dm0rphc51dk.cloudfront.net',
  'media.gettyimages.com',
  'www.wikidata.org',
  'lh3.googleusercontent.com', 'storage.googleapis.com',
]);
// Museum-owned parent domains safe to wildcard (any subdomain is theirs).
const ALLOWED_SUFFIX = [
  '.wikimedia.org', '.archive.org', '.clevelandart.org', '.si.edu',
  '.loc.gov', '.artsmia.org', '.vam.ac.uk', '.metmuseum.org',
  '.harvardartmuseums.org', '.wellcomecollection.org', '.cdninstagram.com',
];
const PRIVATE_IP = /^(10\.|127\.|0\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/;

export default async function handler(req, res) {
  const raw = req.query.url;
  if (!raw) return res.status(400).json({ error: 'No URL' });
  const decoded = decodeURIComponent(raw);

  if (!decoded.startsWith('https://')) return res.status(403).json({ error: 'HTTPS only' });

  let hostname;
  try { hostname = new URL(decoded).hostname.toLowerCase(); }
  catch (e) { return res.status(400).json({ error: 'Invalid URL' }); }

  if (['localhost', '0.0.0.0', '::1'].includes(hostname) || PRIVATE_IP.test(hostname)) {
    return res.status(403).json({ error: 'Blocked host' });
  }
  const allowed = ALLOWED.has(hostname) || ALLOWED_SUFFIX.some(s => hostname.endsWith(s));
  if (!allowed) return res.status(403).json({ error: 'Domain not allowed' });

  try {
    const upstream = await fetch(decoded, {
      headers: {
        'User-Agent': 'PublicArtCollections/1.0 (+https://publicartcollections.net)',
        'Accept': 'image/*',
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!upstream.ok) return res.status(upstream.status).end();

    const contentType = upstream.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) return res.status(415).json({ error: 'Not an image' });

    const MAX = 10 * 1024 * 1024;
    const declared = parseInt(upstream.headers.get('content-length') || '0', 10);
    if (declared > MAX) return res.status(413).json({ error: 'Image too large' });

    const buffer = await upstream.arrayBuffer();
    if (buffer.byteLength > MAX) return res.status(413).json({ error: 'Image too large' });

    // Cache 7 days at the Vercel edge + browser.
    res.setHeader('Cache-Control', 'public, max-age=604800, s-maxage=604800, stale-while-revalidate=86400');
    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.end(Buffer.from(buffer));
  } catch (e) {
    return res.status(504).end();
  }
}
