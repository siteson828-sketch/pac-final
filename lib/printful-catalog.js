// Maps this site's products to Printful catalog products + retail prices.
//
// ⚠️ VERIFY BEFORE REAL FULFILLMENT ⚠️
// The `printfulProductId` values are best-effort defaults and MUST be confirmed
// against the live catalog with your key. This file is the single place to edit
// them. Confirm real product ids by querying Printful directly with your key:
//   curl -H "Authorization: Bearer $PRINTFUL_API_KEY" https://api.printful.com/products
//   curl -H "Authorization: Bearer $PRINTFUL_API_KEY" https://api.printful.com/products/<id>
// The per-size variant id itself is resolved at RUNTIME from the live catalog
// (see resolveCatalogVariant), so only the product ids + prices live here.
//
// Known caveats to verify: on Printful, a mug's 11oz vs 15oz and different phone-case
// models are often SEPARATE products (not size-variants of one product). If so, split
// those into per-size entries with their own product ids.

export const CATALOG = {
  'Fine Art Print': {
    printfulProductId: 1,   // Enhanced Matte Paper Poster (VERIFY)
    prices: { '8×10"': '18.00', '11×14"': '24.00', '16×20"': '34.00', '24×36"': '49.00' },
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
    printfulProductId: 181, // Clear Case for iPhone® — iPhone models ONLY (verified against live catalog)
    prices: { 'iPhone 15': '22.00', 'iPhone 14': '22.00' },
    defaultPrice: '22.00',
  },
  'Tote Bag': {
    printfulProductId: 84,  // All-Over Print Tote Bag — one size, 3 colors (verified). Base cost $17.25.
    prices: { Standard: '29.00' },
    defaultPrice: '29.00',
  },

  // --- Curated expansion (all product ids + sizes verified against the live
  // Printful catalog; every size below resolves via resolveCatalogVariant) ---
  'Framed Poster': {
    printfulProductId: 2,    // Enhanced Matte Paper Framed Poster (in)
    prices: { '8×10"': '45.00', '11×14"': '65.00', '16×20"': '89.00', '24×36"': '149.00' },
    defaultPrice: '45.00',
  },
  'Metal Print': {
    printfulProductId: 588,  // Glossy Metal Print (in) — 24×36 dropped (base cost ~$209, unsellable)
    prices: { '8×10"': '79.00', '11×14"': '109.00', '16×20"': '159.00' },
    defaultPrice: '79.00',
  },
  'Sticker': {
    printfulProductId: 957,  // Die-Cut Stickers (single-unit base cost is high, ~$4–5)
    prices: { '3×3"': '8.00', '4×4"': '9.00', '5×5"': '10.00' },
    defaultPrice: '8.00',
  },
  'Throw Pillow': {
    printfulProductId: 83,   // All-Over Print Basic Pillow
    prices: { '14×14"': '29.00', '16×16"': '34.00', '18×18"': '39.00', '22×22"': '45.00' },
    defaultPrice: '29.00',
  },
  'Throw Blanket': {
    printfulProductId: 395,  // Throw Blanket (all-over sublimation)
    prices: { '30×40"': '49.00', '50×60"': '69.00', '60×80"': '89.00' },
    defaultPrice: '49.00',
  },
  'Hoodie': {
    printfulProductId: 146,  // Unisex Heavy Blend Hoodie | Gildan 18500 (defaults to first color)
    prices: { S: '44.00', M: '44.00', L: '44.00', XL: '44.00', '2XL': '47.00' },
    defaultPrice: '44.00',
  },
  'Tumbler': {
    printfulProductId: 751,  // Double Wall Clear Plastic Tumbler (16 oz)
    prices: { '16oz': '24.00' },
    defaultPrice: '24.00',
  },
  'Notebook': {
    printfulProductId: 946,  // Ruled Line Spiral Notebook
    prices: { 'One Size': '18.00' },
    defaultPrice: '18.00',
  },
  'Greeting Card': {
    printfulProductId: 568,  // Greeting Card
    prices: { '4×6"': '5.00', '5×7"': '6.00' },
    defaultPrice: '5.00',
  },
  'Jigsaw Puzzle': {
    printfulProductId: 534,  // Jigsaw Puzzle
    prices: { '252 pieces': '29.00', '520 pieces': '49.00' },
    defaultPrice: '29.00',
  },
};

export function getPrice(productName, size) {
  const p = CATALOG[productName];
  if (!p) return null;
  return (size && p.prices[size]) || p.defaultPrice;
}
