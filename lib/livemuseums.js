// Live keyword/artist search against museum open-access APIs, for works not yet
// in our DB — a "study/consideration" viewer that links out to the museum.
// Sources: Met, AIC, Cleveland, SMK, V&A (no key), Europeana (EUROPEANA_KEY —
// a multi-institution aggregator, big coverage). Each fetcher is time-boxed and
// fails soft ([] on any error) so one slow/broken API never sinks the batch.
// Results are VIEW-ONLY (not in our catalog → not orderable).
//
// mode: 'keyword' (default) uses the query as a free-text search; 'artist' uses
// each API's artist/maker-specific field where it has one (Met artistOrCulture,
// V&A q_actor, Europeana who:) so "more by <artist>" is precise.

async function fj(url, ms = 6000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'User-Agent': 'PublicArtCollections/1.0' } });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) { return null; }
  finally { clearTimeout(t); }
}

const clean = (s, n = 200) => (s == null ? '' : String(s).slice(0, n));
const q = encodeURIComponent;

// Metropolitan Museum — search returns objectIDs; fetch details for the top few.
async function liveMet(query, limit = 6, mode = 'keyword') {
  const artistFlag = mode === 'artist' ? '&artistOrCulture=true' : '';
  const s = await fj(`https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&isPublicDomain=true${artistFlag}&q=${q(query)}`);
  const ids = (s?.objectIDs || []).slice(0, limit);
  if (!ids.length) return [];
  const details = await Promise.all(ids.map(id =>
    fj(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`, 5000)));
  const out = [];
  for (const o of details) {
    if (!o?.primaryImageSmall || !o.isPublicDomain) continue;
    out.push({
      id: 'live-met-' + o.objectID, live: true, live_source: 'The Met',
      source: 'Metropolitan Museum of Art', source_id: String(o.objectID),
      title: clean(o.title) || 'Untitled', artist: clean(o.artistDisplayName), date_text: clean(o.objectDate),
      medium: clean(o.medium), thumb_url: o.primaryImageSmall, full_url: o.primaryImage || o.primaryImageSmall,
      print_url: o.primaryImage || o.primaryImageSmall,
      iiif_manifest: `https://collectionapi.metmuseum.org/public/collection/v1/iiif/${o.objectID}/manifest.json`,
      detail_url: o.objectURL || '', rights_label: 'Public Domain',
    });
  }
  return out;
}

// Art Institute of Chicago — /search with fields + IIIF image ids.
async function liveAIC(query, limit = 8) {
  const d = await fj(`https://api.artic.edu/api/v1/artworks/search?q=${q(query)}&query[term][is_public_domain]=true&fields=id,title,artist_display,date_display,image_id,medium_display&limit=${limit}`);
  const out = [];
  for (const o of (d?.data || [])) {
    if (!o.image_id) continue;
    out.push({
      id: 'live-aic-' + o.id, live: true, live_source: 'Art Institute of Chicago',
      source: 'Art Institute of Chicago', source_id: String(o.id),
      title: clean(o.title) || 'Untitled', artist: clean(o.artist_display), date_text: clean(o.date_display),
      medium: clean(o.medium_display),
      thumb_url: `https://www.artic.edu/iiif/2/${o.image_id}/full/!400,400/0/default.jpg`,
      full_url: `https://www.artic.edu/iiif/2/${o.image_id}/full/843,/0/default.jpg`,
      print_url: `https://www.artic.edu/iiif/2/${o.image_id}/full/full/0/default.jpg`,
      iiif_info: `https://www.artic.edu/iiif/2/${o.image_id}/info.json`,
      detail_url: `https://www.artic.edu/artworks/${o.id}`, rights_label: 'CC0 — Public Domain',
    });
  }
  return out;
}

// Cleveland Museum of Art — open-access search with image + cc0.
async function liveCleveland(query, limit = 8) {
  const d = await fj(`https://openaccess-api.clevelandart.org/api/artworks/?q=${q(query)}&has_image=1&cc0=1&limit=${limit}`);
  const out = [];
  for (const o of (d?.data || [])) {
    if (!o.images?.web?.url) continue;
    out.push({
      id: 'live-cle-' + o.id, live: true, live_source: 'Cleveland Museum of Art',
      source: 'Cleveland Museum of Art', source_id: String(o.id),
      title: clean(o.title) || 'Untitled', artist: clean(o.creators?.[0]?.description), date_text: clean(o.creation_date),
      medium: clean(o.technique), thumb_url: o.images.web.url, full_url: o.images.full?.url || o.images.web.url,
      print_url: o.images.full?.url || o.images.web.url,
      detail_url: o.url || '', rights_label: 'CC0 — Public Domain',
    });
  }
  return out;
}

// SMK (National Gallery of Denmark) — keyword search, public domain + image.
async function liveSMK(query, limit = 8) {
  const d = await fj(`https://api.smk.dk/api/v1/art/search?keys=${q(query)}&has_image=true&rows=${limit}&filters=public_domain:true`);
  const out = [];
  for (const o of (d?.items || [])) {
    if (!o.has_image || !o.image_thumbnail || !o.public_domain) continue;
    const thumb = o.image_thumbnail.replace(/\/full\/![0-9]+,/, '/full/!400,');
    const title = (Array.isArray(o.titles) && o.titles.length) ? (o.titles.find(t => t.language === 'en') || o.titles[0])?.title : '';
    out.push({
      id: 'live-smk-' + o.object_number, live: true, live_source: 'SMK Denmark',
      source: 'SMK National Gallery of Denmark', source_id: String(o.object_number),
      title: clean(title) || 'Untitled', artist: clean(Array.isArray(o.production) && o.production[0]?.creator),
      date_text: clean(Array.isArray(o.production_date) && o.production_date[0]?.period),
      thumb_url: thumb, full_url: o.image_iiif_id ? `${o.image_iiif_id}/full/!1200,/0/default.jpg` : thumb,
      print_url: o.image_iiif_id ? `${o.image_iiif_id}/full/!2000,/0/default.jpg` : thumb,
      iiif_info: o.image_iiif_info || '',
      detail_url: o.frontend_url || '', rights_label: 'Public Domain',
    });
  }
  return out;
}

// Victoria & Albert Museum — no key. IIIF images. Artist mode uses q_actor.
async function liveVAM(query, limit = 8, mode = 'keyword') {
  const param = mode === 'artist' ? `q_actor=${q(query)}` : `q=${q(query)}`;
  const d = await fj(`https://api.vam.ac.uk/v2/objects/search?${param}&images_exist=1&page_size=${limit}`);
  const out = [];
  for (const o of (d?.records || [])) {
    const base = o._images?._iiif_image_base_url;
    const thumb = base ? `${base}full/!400,400/0/default.jpg` : (o._primaryThumbnailUrl || '');
    if (!thumb) continue;
    out.push({
      id: 'live-vam-' + o.systemNumber, live: true, live_source: 'V&A Museum',
      source: 'Victoria & Albert Museum', source_id: String(o.systemNumber),
      title: clean(o._primaryTitle) || clean(o.objectType) || 'Untitled',
      artist: clean(o._primaryMaker?.name), date_text: clean(o._primaryDate),
      thumb_url: thumb, full_url: base ? `${base}full/!1400,/0/default.jpg` : thumb,
      print_url: base ? `${base}full/full/0/default.jpg` : thumb,
      detail_url: `https://collections.vam.ac.uk/item/${o.systemNumber}`, rights_label: 'V&A — see rights',
    });
  }
  return out;
}

// Europeana — multi-institution aggregator (needs EUROPEANA_KEY). Artist mode
// uses the who: field. VIEW-ONLY: rights vary per item, so it links out.
async function liveEuropeana(query, limit = 10, mode = 'keyword') {
  const key = process.env.EUROPEANA_KEY;
  if (!key) return [];
  const query_ = mode === 'artist' ? `who:"${query}"` : query;
  const d = await fj(`https://api.europeana.eu/record/v2/search.json?wskey=${key}&query=${q(query_)}&qf=TYPE:IMAGE&media=true&thumbnail=true&rows=${limit}`);
  const out = [];
  for (const o of (d?.items || [])) {
    const thumb = o.edmPreview?.[0];
    if (!thumb) continue;
    const provider = clean(o.dataProvider?.[0] || o.provider?.[0] || 'Europeana', 60);
    out.push({
      id: 'live-eu-' + clean(o.id, 80), live: true, live_source: 'Europeana · ' + provider,
      source: 'Europeana — ' + provider, source_id: clean(o.id, 120),
      title: clean(o.title?.[0]) || 'Untitled', artist: clean(o.dcCreator?.[0]),
      date_text: clean(o.year?.[0]),
      thumb_url: thumb, full_url: o.edmIsShownBy?.[0] || thumb, print_url: o.edmIsShownBy?.[0] || thumb,
      detail_url: o.guid || o.edmIsShownAt?.[0] || '', rights_label: clean(o.rights?.[0] || 'see rights', 80),
    });
  }
  return out;
}

// Run all sources in parallel, fail-soft, dedupe by id, cap the total.
export async function liveSearch(query, opts = {}) {
  const mode = opts.mode === 'artist' ? 'artist' : 'keyword';
  const cap = opts.cap || 30;
  const results = await Promise.allSettled([
    liveMet(query, 6, mode), liveAIC(query), liveCleveland(query), liveSMK(query),
    liveVAM(query, 8, mode), liveEuropeana(query, 10, mode),
  ]);
  const seen = new Set();
  const works = [];
  const sources = {};
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    for (const w of r.value) {
      if (seen.has(w.id)) continue;
      seen.add(w.id);
      works.push(w);
      sources[w.live_source] = (sources[w.live_source] || 0) + 1;
    }
  }
  return { works: works.slice(0, cap), sources, mode };
}
