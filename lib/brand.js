import { useState, useEffect } from 'react';

// Candidate brand names for the homepage PREVIEW only. `?brand=<key>` swaps the
// name shown in the nav, footer and tab title so the owner can compare options
// on the real page. Anything not listed (or no param) falls back to the current
// brand, so production behaves exactly as before. Delete this file once a name
// is chosen.
export const BRANDS = {
  pac:   { first: 'Public Art',       accent: 'Collections' },
  wwwoa: { first: 'World Wide Works', accent: 'of Art' },
  finds: { first: 'Great Art',        accent: 'Finds' },
  gap:   { first: 'Great Art',        accent: 'Prints' },
  stuff: { first: 'Prints &',         accent: 'Stuff' },
  classics: { first: 'Great Art',      accent: 'Classics' },
};

export function useBrand() {
  const [key, setKey] = useState('classics');
  useEffect(() => {
    try {
      const k = new URLSearchParams(window.location.search).get('brand');
      if (k && BRANDS[k]) setKey(k);
    } catch (e) {}
  }, []);
  return { key, ...BRANDS[key] };
}
