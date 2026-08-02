import { neon } from '@neondatabase/serverless';
import { checkRateLimit } from '../../lib/rate-limit';
import { cleanStr, sameOrigin, clientIp } from '../../lib/sanitize';

export const dynamic = 'force-dynamic';

// Promotes a live museum-search result into our catalog so it becomes orderable
// via the normal modal/checkout flow. Public (any visitor can add a work), so it
// is defended: same-origin only, rate-limited, and it accepts ONLY works from
// the known live sources with valid https image URLs (prevents catalog spam /
// arbitrary-URL injection). Upserts on (source,source_id) and returns the DB row.
const KNOWN_SOURCES = new Set([
  'Metropolitan Museum of Art',
  'Art Institute of Chicago',
  'Cleveland Museum of Art',
  'SMK National Gallery of Denmark',
]);
// Image URLs must come from these museum hosts (also matches the /api/img proxy
// allowlist, so added works actually render).
const ALLOWED_HOST = /^(https:\/\/)([a-z0-9-]+\.)*(metmuseum\.org|artic\.edu|clevelandart\.org|smk\.dk)\//i;
const okImg = u => typeof u === 'string' && u.length < 800 && ALLOWED_HOST.test(u);
const okUrl = u => typeof u === 'string' && u.length < 800 && /^https:\/\//i.test(u);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!sameOrigin(req)) return res.status(403).json({ error: 'Cross-origin request rejected' });

  const rl = await checkRateLimit({ scope: 'add-catalog', ip: clientIp(req), limit: 30, windowSeconds: 600 });
  if (!rl.allowed) return res.status(429).json({ error: 'Too many requests. Please slow down.' });

  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
  b = b || {};

  const source = cleanStr(b.source, 120);
  if (!KNOWN_SOURCES.has(source)) return res.status(400).json({ error: 'Unknown source' });
  const source_id = cleanStr(b.source_id, 120);
  if (!source_id) return res.status(400).json({ error: 'Missing source_id' });

  const thumb_url = cleanStr(b.thumb_url, 800);
  if (!okImg(thumb_url)) return res.status(400).json({ error: 'Invalid or disallowed image URL' });
  const full_url = okImg(b.full_url) ? cleanStr(b.full_url, 800) : thumb_url;
  const print_url = okImg(b.print_url) ? cleanStr(b.print_url, 800) : full_url;

  const title = cleanStr(b.title, 300) || 'Untitled';
  const artist = cleanStr(b.artist, 200);
  const date_text = cleanStr(b.date_text, 80);
  const medium = cleanStr(b.medium, 200);
  const detail_url = okUrl(b.detail_url) ? cleanStr(b.detail_url, 800) : '';
  const iiif_info = okUrl(b.iiif_info) ? cleanStr(b.iiif_info, 800) : '';
  const iiif_manifest = okUrl(b.iiif_manifest) ? cleanStr(b.iiif_manifest, 800) : '';
  const bio = cleanStr(b.bio, 1000);

  const sql = neon(process.env.DATABASE_URL);
  try {
    const rows = await sql`
      INSERT INTO artworks
        (source, source_id, title, artist, date_text, medium, thumb_url, full_url,
         iiif_info, iiif_manifest, detail_url, print_url, rights, rights_label, commercial_ok, bio, synced_at)
      VALUES
        (${source}, ${source_id}, ${title}, ${artist}, ${date_text}, ${medium}, ${thumb_url}, ${full_url},
         ${iiif_info}, ${iiif_manifest}, ${detail_url}, ${print_url}, 'CC0', 'CC0 — Public Domain', true, ${bio}, NOW())
      ON CONFLICT (source, source_id) DO UPDATE SET
        thumb_url = EXCLUDED.thumb_url, full_url = EXCLUDED.full_url, print_url = EXCLUDED.print_url,
        iiif_info = EXCLUDED.iiif_info, iiif_manifest = EXCLUDED.iiif_manifest, synced_at = NOW()
      RETURNING id, title, artist, date_text, medium, source, thumb_url, full_url, print_url,
                iiif_info, iiif_manifest, detail_url, rights_label, bio`;
    return res.status(200).json({ ok: true, work: rows[0] });
  } catch (e) {
    console.error('add-to-catalog error:', e.message);
    return res.status(500).json({ error: 'Could not add this work to the catalog.' });
  }
}
