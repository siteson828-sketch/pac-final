// Maps this site's products to Printful catalog products + retail prices.
//
// ⚠️ VERIFY BEFORE REAL FULFILLMENT ⚠️
// The `printfulProductId` values are best-effort defaults from Printful's catalog
// and MUST be confirmed against the live catalog with your key. This file is the
// single place to edit them. Verification helpers (secret = SYNC_SECRET):
//   • list catalog products:      GET /api/printful-catalog?secret=...&list=1
//   • list a product's variants:  GET /api/printful-catalog?secret=...&product=<id>
// The per-size variant id itself is resolved at RUNTIME from the live catalog
// (see resolveCatalogVariant), so only the ~6 product ids + prices live here.
//
// Known caveats to verify: on Printful, a mug's 11oz vs 15oz and different phone-case
// models are often SEPARATE products (not size-variants of one product). If so, split
// those into per-size entries with their own product ids.

export const CATALOG = {
  'Fine Art Print': {
    printfulProductId: 1,   // Enhanced Matte Paper Poster (VERIFY)
    prices: { '8×10"': '18.00', '11×14"': '24.00', '16×20"': '34.00', '24×30"': '49.00' },
    defaultPrice: '18.00',
  },
  'Canvas Wrap': {
    printfulProductId: 3,   // Canvas (VERIFY)
    prices: { '12×16"': '45.00', '16×20"': '59.00', '20×24"': '75.00', '24×30"': '95.00' },
    defaultPrice: '45.00',
  },
  'T-Shirt': {
    printfulProductId: 71,  // Unisex Staple T-Shirt | Bella+Canvas 3001 (VERIFY)
    prices: { S: '24.00', M: '24.00', L: '24.00', XL: '24.00', '2XL': '26.00' },
    defaultPrice: '24.00',
  },
  'Mug': {
    printfulProductId: 19,  // White Glossy Mug 11oz (VERIFY — 15oz is a different product)
    prices: { '11oz': '14.00', '15oz': '16.00' },
    defaultPrice: '14.00',
  },
  'Phone Case': {
    printfulProductId: 181, // Phone case (VERIFY — models may map to different products)
    prices: { 'iPhone 15': '19.00', 'iPhone 14': '19.00', 'Samsung S24': '19.00', 'Pixel 8': '19.00' },
    defaultPrice: '19.00',
  },
  'Tote Bag': {
    printfulProductId: 84,  // All-Over Print Tote (VERIFY)
    prices: { Standard: '16.00' },
    defaultPrice: '16.00',
  },
};

export function getPrice(productName, size) {
  const p = CATALOG[productName];
  if (!p) return null;
  return (size && p.prices[size]) || p.defaultPrice;
}
