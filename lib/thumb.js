// Grid-thumbnail URL helper (same logic as pages/index.js and pages/viewer.js).
const PROXY_HOSTS = new Set([
  'bpldcassets.blob.core.windows.net', // Digital Commonwealth
  'openaccess-cdn.clevelandart.org',   // Cleveland
  'images.metmuseum.org',              // Met
]);
export function getThumbUrl(url) {
  if (!url) return '';
  // Library of Congress: normalize the sync's malformed thumb URLs (see viewer.js).
  if (url.includes('tile.loc.gov')) {
    const u = url.split('#')[0];
    if (u.includes('_150px.jpg')) return u.slice(0, u.indexOf('_150px.jpg') + 10);
    const m = u.match(/^(.*\.(?:gif|jpe?g|png|tif))\/full\/[^/]*\/\d+\/default\.\w+$/i);
    if (m) return m[1];
    return u;
  }
  if (url.includes('/full/!400,400/')) return url.replace('/full/!400,400/', '/full/!300,300/'); // IIIF
  // Wikimedia Commons throttles Special:FilePath hotlinks at grid scale → proxy
  // through our edge cache (covers Vatican, Picasso, Hermitage, Wikidata, etc.).
  if (url.includes('commons.wikimedia.org')) {
    // Force a width so Special:FilePath renders a thumbnail (no-width URLs return
    // the original file — huge JPEGs or unrenderable TIFF/SVG → blank).
    const sized = /[?&]width=\d+/.test(url)
      ? url.replace(/width=\d+/, 'width=300')
      : url + (url.includes('?') ? '&' : '?') + 'width=300';
    return '/api/img?url=' + encodeURIComponent(sized);
  }
  if (url.includes('ids.si.edu/ids/deliveryService')) return url + (url.includes('?') ? '&' : '?') + 'max=300'; // Smithsonian (direct)
  try {
    if (PROXY_HOSTS.has(new URL(url).hostname)) return '/api/img?url=' + encodeURIComponent(url);
  } catch (e) {}
  return url;
}
