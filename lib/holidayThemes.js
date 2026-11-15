// Holiday landing pages: shared theme list (client-safe). Slugs match lib/holidayCurated.js.
// `for` = the gift idea shown on each box ("for the ..."), which is what makes it feel personal.
export const FRONT_CAT = 'famous-favorites';

export const THEMES = [
  { slug: 'winter-wonderland', name: 'Winter wonderland', sub: 'Snow, skaters and frosty fields', for: 'For the cozy homebody', q: 'winter landscape snow', grad: 'linear-gradient(160deg,#2B3A4A,#0E141B 70%,#D8B565 170%)' },
  { slug: 'starry-nights', name: 'Starry nights', sub: 'Moonlight, stars and glowing skies', for: 'For the dreamer', q: 'night sky stars moon', grad: 'linear-gradient(160deg,#1B2450,#070A1A 70%,#D8B565 190%)' },
  { slug: 'nativity-and-angels', name: 'Nativity and angels', sub: 'Classic sacred art of the season', for: 'For a faith-filled home', q: 'madonna and child nativity', grad: 'linear-gradient(170deg,#17382E,#0A1612 70%,#D8B565 190%)' },
  { slug: 'festive-feasts', name: 'Festive feasts', sub: 'Fruit, wine and a full table', for: 'For the host with the most', q: 'still life fruit feast table', grad: 'linear-gradient(150deg,#8E1F2B,#2B0F14 70%,#17382E 160%)' },
  { slug: 'candlelight', name: 'Candlelight', sub: 'Warm glow and long evenings', for: 'For quiet nights in', q: 'candlelit interior warm light', grad: 'linear-gradient(200deg,#7A4A1E,#1A0F08 65%,#D8B565 170%)' },
  { slug: 'flowers-and-gardens', name: 'Flowers and gardens', sub: 'Bright blooms, all year round', for: 'For the gardener', q: 'flowers garden bouquet', grad: 'linear-gradient(160deg,#8E3A7A,#2B0F28 70%,#E0A84A 180%)' },
];

// The wall of famous favorites (front of /holiday) and its full page.
export const ALL_PICKS = { slug: 'famous-favorites', name: 'Famous favorites', sub: 'The pieces everyone knows and loves', for: 'For everyone on the list', q: 'colorful famous masterpiece' };

export function themeBySlug(slug) {
  if (slug === ALL_PICKS.slug) return ALL_PICKS;
  return THEMES.find(t => t.slug === slug) || null;
}
