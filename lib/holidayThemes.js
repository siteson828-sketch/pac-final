// Holiday landing pages: shared theme list. `q` goes to /api/ai-search (the same
// curated-ish search the viewer uses); the choice pages at /holiday/<slug> show its results.
export const FRONT_Q = 'colorful festive christmas holiday celebration';

export const THEMES = [
  { slug: 'winter-landscapes', term: 'winter', name: 'Winter landscapes', sub: 'Snow, frost and quiet fields', q: 'winter landscape snow', grad: 'linear-gradient(160deg,#2B3A4A,#0E141B 70%,#D8B565 170%)' },
  { slug: 'candlelit-rooms', term: 'candle', name: 'Candlelit rooms', sub: 'Warm light and long evenings', q: 'candlelit interior warm light', grad: 'linear-gradient(200deg,#7A4A1E,#1A0F08 65%,#D8B565 170%)' },
  { slug: 'festive-tables', term: 'still life', name: 'Festive tables', sub: 'Fruit, feasts and still life', q: 'still life fruit feast table', grad: 'linear-gradient(150deg,#8E1F2B,#2B0F14 70%,#17382E 160%)' },
  { slug: 'madonna-and-child', term: 'madonna', name: 'Madonna and child', sub: 'Classic sacred art', q: 'madonna and child nativity', grad: 'linear-gradient(170deg,#17382E,#0A1612 70%,#D8B565 190%)' },
  { slug: 'snowy-villages', term: 'snow', name: 'Snowy villages', sub: 'Skaters, markets and rooftops', q: 'snow village winter skaters', grad: 'linear-gradient(190deg,#3C4B5C,#10161D 70%,#F4EEE2 200%)' },
  { slug: 'stars-and-night-skies', term: 'night', name: 'Stars and night skies', sub: 'Winter nights, painted', q: 'night sky stars moon', grad: 'linear-gradient(160deg,#1B2450,#070A1A 70%,#D8B565 190%)' },
];

// The "all colorful picks" page (linked from the front of /holiday).
export const ALL_PICKS = { slug: 'colorful-picks', name: 'Colorful holiday picks', sub: 'Bright, festive and ready to gift', q: FRONT_Q };

export function themeBySlug(slug) {
  if (slug === ALL_PICKS.slug) return ALL_PICKS;
  return THEMES.find(t => t.slug === slug) || null;
}
