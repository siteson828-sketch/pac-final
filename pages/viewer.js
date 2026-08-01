import { useState, useEffect, useCallback, useRef } from 'react';
import { useShopGate, PinModal, TradeAccessPanel } from '../lib/useShopGate';
import { saveIdentity } from '../lib/identity';

const OSD_VERSION = '4.1.0';
const OSD_SRC = `https://cdnjs.cloudflare.com/ajax/libs/openseadragon/${OSD_VERSION}/openseadragon.min.js`;
const OSD_PREFIX = `https://cdnjs.cloudflare.com/ajax/libs/openseadragon/${OSD_VERSION}/images/`;

const REGIONS = [
  {
    region: 'United States',
    museums: [
      { label: 'Metropolitan Museum',       source: 'Metropolitan Museum of Art' },
      { label: 'Art Inst. Chicago',         source: 'Art Institute of Chicago' },
      { label: 'Cleveland Museum',          source: 'Cleveland Museum of Art' },
      { label: 'Smithsonian',              source: 'Smithsonian Institution' },
      { label: 'Smithsonian American Art', source: 'Smithsonian American Art Museum' },
      { label: 'Harvard Art Museums',       source: 'Harvard Art Museums' },
      { label: 'Getty Museum',             source: 'Getty Museum' },
      { label: 'Walters Art Museum',       source: 'Walters Art Museum' },
      { label: 'Minneapolis Inst. of Art', source: 'Minneapolis Institute of Art' },
      { label: 'Yale Art Gallery',         source: 'Yale University Art Gallery' },
      { label: 'Philadelphia Museum',      source: 'Philadelphia Museum of Art' },
      { label: 'Boston MFA',              source: 'Museum of Fine Arts Boston' },
      { label: 'Detroit Institute',        source: 'Detroit Institute of Arts' },
      { label: 'Library of Congress',      source: 'Library of Congress' },
      { label: 'NYPL',                     source: 'NYPL' },
      { label: 'DPLA',                     source: 'DPLA' },
      { label: 'MoMA',                     source: 'MoMA' },
    ],
  },
  {
    region: 'United Kingdom',
    museums: [
      { label: 'V&A Museum',       source: 'Victoria & Albert Museum' },
      { label: 'British Museum',   source: 'British Museum' },
      { label: 'National Gallery', source: 'National Gallery' },
      { label: 'Tate',             source: 'Tate' },
    ],
  },
  {
    region: 'France',
    museums: [
      { label: 'Louvre',          source: 'Louvre' },
      { label: "Musée d'Orsay",  source: "Musée d'Orsay" },
      { label: 'Musée de Cluny', source: 'Musée de Cluny' },
      { label: 'BnF Gallica',    source: 'BnF Gallica' },
    ],
  },
  {
    region: 'Netherlands',
    museums: [
      { label: 'Rijksmuseum',        source: 'Rijksmuseum' },
      { label: 'Rijksmuseum (Wiki)', source: 'Rijksmuseum Amsterdam' },
    ],
  },
  {
    region: 'Denmark',
    museums: [
      { label: 'SMK Denmark', source: 'SMK National Gallery of Denmark' },
    ],
  },
  {
    region: 'Italy',
    museums: [
      { label: 'Uffizi',                  source: 'Uffizi' },
      { label: 'Vatican Museums',         source: 'Vatican Museums' },
      { label: 'Pinacoteca di Brera',     source: 'Pinacoteca di Brera' },
      { label: 'Palazzo Pitti',           source: 'Palazzo Pitti' },
      { label: 'Galleria Doria Pamphilj', source: 'Galleria Doria Pamphilj' },
      { label: 'Galleria Spada',          source: 'Galleria Spada' },
      { label: 'Capodimonte',             source: 'Museo di Capodimonte' },
      { label: 'Museo Nazionale Romano',  source: 'Museo Nazionale Romano' },
    ],
  },
  {
    region: 'Spain',
    museums: [
      { label: 'Prado',                   source: 'Prado' },
      { label: 'Museu Picasso Barcelona', source: 'Museu Picasso Barcelona' },
    ],
  },
  {
    region: 'Austria',
    museums: [
      { label: 'KHM Vienna', source: 'Kunsthistorisches Museum' },
    ],
  },
  {
    region: 'Russia',
    museums: [
      { label: 'Hermitage', source: 'Hermitage' },
    ],
  },
  {
    region: 'East Asia',
    museums: [
      { label: 'National Palace Museum', source: 'National Palace Museum' },
      { label: 'Tokyo National Museum',  source: 'Tokyo National Museum' },
    ],
  },
  {
    region: 'Oceania',
    museums: [
      { label: 'National Gallery Victoria', source: 'National Gallery of Victoria' },
      { label: 'Auckland Art Gallery',      source: 'Auckland Art Gallery' },
      { label: 'Te Papa',                   source: 'Museum of New Zealand Te Papa Tongarewa' },
    ],
  },
  {
    region: 'Global',
    museums: [
      { label: 'Europeana',        source: 'Europeana',       searchMode: true },
      { label: 'Wikimedia Commons', source: 'Wikimedia Commons' },
      { label: 'Internet Archive', source: 'Internet Archive' },
      { label: 'Wikidata Global',  source: 'Wikidata Global' },
    ],
  },
];

const GENRES = [
  { label: 'All',          search: '' },
  { label: 'Painting',     search: 'painting' },
  { label: 'Portrait',     search: 'portrait' },
  { label: 'Landscape',    search: 'landscape' },
  { label: 'Still Life',   search: 'still life' },
  { label: 'Drawing',      search: 'drawing' },
  { label: 'Watercolor',   search: 'watercolor' },
  { label: 'Engraving',    search: 'engraving' },
  { label: 'Sculpture',    search: 'sculpture' },
  { label: 'Photography',  search: 'photograph' },
  { label: 'Illustration', search: 'illustration' },
];

const ORDERS = [
  { label: 'Recent',  value: 'recent' },
  { label: 'Shuffle', value: 'random' },
];

// Product selector. `name` MUST match a key in lib/printful-catalog.js CATALOG;
// the server resolves the Printful product + per-size variant id at runtime
// (resolveCatalogVariant), so no ids live here. Kept in sync with the same list
// in pages/index.js. All sizes below verified to resolve against the live catalog.
const PRODUCTS = [
  { emoji: '🖼️', name: 'Fine Art Print', price: 'from $18', sizes: ['8×10"', '11×14"', '16×20"', '24×36"'] },
  { emoji: '🎨', name: 'Canvas Wrap',    price: 'from $45', sizes: ['12×16"', '16×20"', '20×24"', '24×30"'] },
  { emoji: '👕', name: 'T-Shirt',        price: 'from $24', sizes: ['S', 'M', 'L', 'XL', '2XL'] },
  { emoji: '☕', name: 'Mug',            price: 'from $14', sizes: ['11oz', '15oz'] },
  { emoji: '📱', name: 'Phone Case',     price: 'from $22', sizes: ['iPhone 15', 'iPhone 14'] },
  { emoji: '🛍️', name: 'Tote Bag',       price: 'from $29', sizes: ['Standard'] },
  { emoji: '🏛️', name: 'Framed Poster',  price: 'from $45', sizes: ['8×10"', '11×14"', '16×20"', '24×36"'] },
  { emoji: '🪞', name: 'Metal Print',    price: 'from $79', sizes: ['8×10"', '11×14"', '16×20"'] },
  { emoji: '🏷️', name: 'Sticker',        price: 'from $8',  sizes: ['3×3"', '4×4"', '5×5"'] },
  { emoji: '🛋️', name: 'Throw Pillow',   price: 'from $29', sizes: ['14×14"', '16×16"', '18×18"', '22×22"'] },
  { emoji: '🛌', name: 'Throw Blanket',  price: 'from $49', sizes: ['30×40"', '50×60"', '60×80"'] },
  { emoji: '🧥', name: 'Hoodie',         price: 'from $44', sizes: ['S', 'M', 'L', 'XL', '2XL'] },
  { emoji: '🥤', name: 'Tumbler',        price: 'from $24', sizes: ['16oz'] },
  { emoji: '📓', name: 'Notebook',       price: 'from $18', sizes: ['One Size'] },
  { emoji: '💌', name: 'Greeting Card',  price: 'from $5',  sizes: ['4×6"', '5×7"'] },
  { emoji: '🧩', name: 'Jigsaw Puzzle',  price: 'from $29', sizes: ['252 pieces', '520 pieces'] },
];

// Client-side Stripe publishable key (inlined at build). Empty when unset →
// checkout falls back to the legacy no-charge draft-order flow.
const STRIPE_PK = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '';
const STRIPE_JS = 'https://js.stripe.com/v3';

// AudienceLab tracking pixel — injected only when a pixel id is configured.
// The script src is overridable so the exact CDN endpoint can be set without a
// code change (defaults to AudienceLab's pixel host).
const AUDIENCELAB_PIXEL_ID = process.env.NEXT_PUBLIC_AUDIENCELAB_PIXEL_ID || '';
const AUDIENCELAB_SRC = process.env.NEXT_PUBLIC_AUDIENCELAB_SRC || 'https://cdn.audiencelab.io/pixel.js';

// Load Stripe.js once (same dynamic-script pattern as OpenSeadragon below).
function loadStripeJs() {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return reject(new Error('no window'));
    if (window.Stripe) return resolve(window.Stripe);
    let s = document.getElementById('stripe-js');
    if (!s) {
      s = document.createElement('script');
      s.id = 'stripe-js';
      s.src = STRIPE_JS;
      document.head.appendChild(s);
    }
    s.addEventListener('load', () => resolve(window.Stripe));
    s.addEventListener('error', () => reject(new Error('Failed to load Stripe.js')));
  });
}

const ALL_MUSEUMS = REGIONS.flatMap(r => r.museums);

function fmt(s) {
  return (s || '')
    .replace('Metropolitan Museum of Art', 'Met')
    .replace('Art Institute of Chicago', 'Art Inst. Chicago')
    .replace('Victoria & Albert Museum', 'V&A')
    .replace('Smithsonian Institution', 'Smithsonian')
    .replace(/^Europeana — /, '')
    .split(',')[0];
}

// Faster grid thumbnails: ask IIIF/CDN sources for a smaller derivative (fewer
// bytes, still served directly by the museum — no proxy hop or bandwidth cost).
// Sources without a known size knob (Met web-large, already-small blobs) pass
// through unchanged.
function getThumbUrl(url) {
  if (!url) return '';
  if (url.includes('/full/!400,400/')) return url.replace('/full/!400,400/', '/full/!300,300/'); // IIIF: V&A, AIC, MIA, LoC…
  if (url.includes('commons.wikimedia.org') && /[?&]width=\d+/.test(url)) return url.replace(/width=\d+/, 'width=300'); // Wikimedia/Wikidata
  if (url.includes('ids.si.edu/ids/deliveryService')) return url + (url.includes('?') ? '&' : '?') + 'max=300'; // Smithsonian
  return url;
}

// Mobile-first: base rules target small (360px+) screens; min-width media
// queries scale the layout up to tablet and desktop. No layout dimensions are
// set inline in the JSX — every grid and element is driven by a class here.
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=DM+Sans:opsz,wght@9..40,400;9..40,500&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;font-family:'DM Sans',system-ui,sans-serif;background:#FAF8F4;color:#1A1714;-webkit-text-size-adjust:100%}
/* Fixed-height app shell so only the grid scrolls and the top/filter bars stay
   pinned. 100dvh keeps it correct under iOS Safari's dynamic toolbar; the 100vh
   line above it is a fallback for older Android browsers without dvh support. */
.layout{display:flex;height:100vh;height:100dvh;overflow:hidden;position:relative}

/* SIDEBAR — a slide-in drawer on mobile, static rail on desktop */
.sidebar{position:fixed;top:0;left:0;bottom:0;z-index:210;width:82%;max-width:300px;flex-shrink:0;background:#F2EDE6;border-right:0.5px solid rgba(26,23,20,0.12);display:flex;flex-direction:column;overflow:hidden;transform:translateX(-100%);transition:transform .22s ease;box-shadow:0 0 40px rgba(0,0,0,.35)}
.sidebar.open{transform:translateX(0)}
.sidebar-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.45);z-index:205}
.sidebar-head{padding:16px 14px 12px;border-bottom:0.5px solid rgba(26,23,20,0.1);flex-shrink:0}
.sidebar-logo{font-family:'Cormorant Garamond',Georgia,serif;font-size:clamp(15px,4.5vw,17px);font-weight:400;color:#1A1714;text-decoration:none;display:block;margin-bottom:3px;letter-spacing:.01em}
.sidebar-logo span{color:#B8942A}
.sidebar-sub{font-size:11px;color:#8A8178}
.sidebar-scroll{overflow-y:auto;-webkit-overflow-scrolling:touch;flex:1;padding:6px 0 24px}
.sidebar-scroll::-webkit-scrollbar{width:3px}
.sidebar-scroll::-webkit-scrollbar-thumb{background:rgba(26,23,20,0.15);border-radius:2px}
.region-label{font-size:9px;text-transform:uppercase;letter-spacing:.14em;color:#8A8178;padding:10px 12px 3px;font-weight:500}
.museum-btn{display:flex;align-items:center;width:100%;text-align:left;min-height:44px;padding:8px 14px;font-size:14px;color:#4A4540;background:none;border:none;cursor:pointer;font-family:'DM Sans',sans-serif;transition:background .12s,color .12s;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.4}
.museum-btn:hover{background:rgba(184,148,42,0.08);color:#1A1714}
.museum-btn.active{background:rgba(184,148,42,0.15);color:#1A1714;font-weight:500}

/* MAIN */
.main{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0;width:100%}

/* TOPBAR */
.topbar{border-bottom:0.5px solid rgba(26,23,20,0.1);display:flex;align-items:center;flex-wrap:wrap;padding:8px 12px;gap:8px;flex-shrink:0;background:#FAF8F4}
.topbar-menu{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;background:none;border:0.5px solid rgba(26,23,20,0.18);border-radius:6px;min-width:44px;min-height:44px;font-size:18px;line-height:1;cursor:pointer;color:#1A1714}
.topbar-title{font-family:'Cormorant Garamond',Georgia,serif;font-size:clamp(15px,4vw,17px);font-weight:300;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.topbar-title span{color:#B8942A}
.topbar-search-btn{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;background:none;border:0.5px solid rgba(26,23,20,0.18);border-radius:6px;min-width:44px;min-height:44px;font-size:16px;line-height:1;cursor:pointer;color:#1A1714}
/* search field is hidden on mobile until the search icon toggles it open */
.topbar-search{display:none;order:5;width:100%;padding:0 12px;min-height:44px;border:0.5px solid rgba(26,23,20,0.18);border-radius:6px;font-size:16px;background:#FAF8F4;outline:none;font-family:'DM Sans',sans-serif;color:#1A1714}
.topbar-search.open{display:block}
.topbar-search:focus{border-color:#B8942A;box-shadow:0 0 0 2px rgba(184,148,42,0.1)}
.topbar-count{font-size:11px;color:#8A8178;white-space:nowrap;flex-shrink:0}
.topbar-home{display:inline-flex;align-items:center;min-height:44px;font-size:13px;color:#8A8178;text-decoration:none;padding:0 12px;border:0.5px solid rgba(26,23,20,0.15);border-radius:6px;transition:all .15s;white-space:nowrap;flex-shrink:0}
.topbar-home:hover{color:#1A1714;border-color:rgba(26,23,20,0.3)}

/* GENRE + ORDER BAR — horizontally scrollable on narrow screens */
.filter-row{border-bottom:0.5px solid rgba(26,23,20,0.08);display:flex;align-items:stretch;background:#F8F5F0;flex-shrink:0;gap:0;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none}
.filter-row::-webkit-scrollbar{display:none}
.genre-chip{display:inline-flex;align-items:center;min-height:44px;padding:0 14px;font-size:11px;font-weight:500;letter-spacing:.07em;text-transform:uppercase;color:#8A8178;cursor:pointer;background:none;border:none;border-bottom:2px solid transparent;white-space:nowrap;transition:color .15s,border-color .15s;font-family:'DM Sans',sans-serif;flex-shrink:0}
.genre-chip:hover{color:#1A1714}
.genre-chip.active{color:#1A1714;border-bottom-color:#B8942A}
.filter-sep{width:0.5px;background:rgba(26,23,20,0.1);margin:8px 0;flex-shrink:0}
.order-chip{display:inline-flex;align-items:center;gap:5px;min-height:44px;padding:0 12px;font-size:11px;font-weight:500;letter-spacing:.07em;text-transform:uppercase;color:#8A8178;cursor:pointer;background:none;border:none;border-bottom:2px solid transparent;white-space:nowrap;transition:all .15s;font-family:'DM Sans',sans-serif;flex-shrink:0}
.order-chip:hover{color:#1A1714}
.order-chip.active{color:#1A1714;border-bottom-color:#B8942A}

/* GRID — 2 columns on mobile, auto-fill from tablet up */
.grid-area{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:12px}
.grid-area::-webkit-scrollbar{width:5px}
.grid-area::-webkit-scrollbar-thumb{background:rgba(26,23,20,0.12);border-radius:3px}
.art-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
.art-card{cursor:pointer;border-radius:6px;overflow:hidden;background:#EDE8DF;box-shadow:0 1px 3px rgba(26,23,20,0.08);transition:box-shadow .2s,transform .2s;display:flex;flex-direction:column}
.art-card:hover{box-shadow:0 8px 28px rgba(26,23,20,0.16);transform:translateY(-2px)}
.card-img{aspect-ratio:3/4;background:#D4CEC3;overflow:hidden;position:relative;flex-shrink:0}
.card-img img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .35s ease}
.art-card:hover .card-img img{transform:scale(1.04)}
.card-hover-overlay{position:absolute;inset:0;background:linear-gradient(transparent 55%,rgba(26,23,20,0.7));opacity:0;transition:opacity .2s;display:flex;align-items:flex-end;padding:8px}
.art-card:hover .card-hover-overlay{opacity:1}
.card-hover-label{font-size:10px;font-weight:500;color:#FAF8F4;letter-spacing:.04em}
.card-ph{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:32px;color:#B8942A}
.card-info{padding:8px 10px 10px;background:#FAF8F4;flex:1;display:flex;flex-direction:column}
.card-source{font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:#B8942A;margin-bottom:3px;font-weight:500}
.card-title{font-family:'Cormorant Garamond',Georgia,serif;font-size:clamp(13px,3.4vw,15px);line-height:1.25;color:#1A1714;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:3px;flex:1}
.card-artist{font-size:10px;color:#8A8178;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.card-date{font-size:10px;color:#6A6058;margin-top:2px}

/* SKELETON */
.skeleton{animation:pulse 1.5s ease-in-out infinite}
.sk-img{aspect-ratio:3/4;background:#E0DAD0;border-radius:6px 6px 0 0}
.sk-body{padding:8px 10px 10px;background:#FAF8F4;border-radius:0 0 6px 6px}
.sk-line{height:9px;background:#D4CEC3;border-radius:3px;margin-bottom:6px}
.sk-line-sm{width:40%}
.sk-line-md{width:60%}
.sk-line-lg{width:80%}
@keyframes pulse{0%,100%{opacity:.5}50%{opacity:1}}

/* EMPTY */
.empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#8A8178;gap:10px;padding:40px 24px;text-align:center}
.empty-icon{font-size:clamp(38px,10vw,44px)}
.empty-title{font-family:'Cormorant Garamond',Georgia,serif;font-size:clamp(18px,5vw,20px);font-weight:300}
.empty-sub{font-size:13px;max-width:300px;line-height:1.65}

/* LOAD MORE */
.load-more-wrap{text-align:center;padding:20px 0 32px}
.load-btn{min-height:44px;padding:8px 22px;border:0.5px solid rgba(26,23,20,0.2);border-radius:6px;font-size:13px;font-weight:500;cursor:pointer;background:transparent;font-family:'DM Sans',sans-serif;color:#1A1714;transition:background .15s}
.load-btn:hover{background:rgba(26,23,20,0.05)}

/* MODAL — bottom sheet that slides up full width on mobile */
.modal-bg{position:fixed;inset:0;background:rgba(26,23,20,0.72);z-index:200;display:flex;align-items:flex-end;justify-content:center;backdrop-filter:blur(4px)}
.modal{background:#FAF8F4;border-radius:16px 16px 0 0;width:100%;max-width:100%;max-height:92vh;max-height:92dvh;overflow-y:auto;-webkit-overflow-scrolling:touch;position:relative;box-shadow:0 -8px 40px rgba(26,23,20,0.3);display:flex;flex-direction:column;animation:slideUp .28s ease}
@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
.modal-img{position:relative;background:#2C2318;flex:0 0 auto;display:flex;align-items:center;justify-content:center;min-height:200px;max-height:50vh}
.modal-img img{width:100%;height:100%;object-fit:contain;max-height:50vh;transition:opacity .25s}
.modal-img-ph{font-size:64px;color:#B8942A}
.modal-detail{flex:1;padding:22px 18px;display:flex;flex-direction:column;gap:10px;min-width:0}
.modal-close{position:absolute;top:12px;right:12px;width:44px;height:44px;border-radius:50%;background:rgba(26,23,20,0.5);border:none;color:#FAF8F4;font-size:22px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:10;line-height:1;transition:background .15s}
.modal-close:hover{background:rgba(26,23,20,0.8)}
.modal-source{font-size:9px;text-transform:uppercase;letter-spacing:.18em;color:#B8942A;font-weight:500}
.modal-title{font-family:'Cormorant Garamond',Georgia,serif;font-size:clamp(20px,5.5vw,24px);font-weight:300;line-height:1.12}
.modal-artist{font-size:13px;color:#4A4540}
.divider{height:0.5px;background:rgba(26,23,20,0.1);flex-shrink:0}
.meta-row{display:flex;gap:16px;flex-wrap:wrap}
.meta-item label{font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:#8A8178;display:block;margin-bottom:2px}
.meta-item span{font-size:12px;font-weight:500;color:#1A1714}
.meta-rights{color:#16a34a}
.modal-bio{font-size:12px;color:#4A4540;line-height:1.75}
.prod-label{font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:#8A8178;margin-bottom:8px}
.prod-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
.prod-item{min-height:56px;background:#2C2318;border:0.5px solid #3A3028;border-radius:5px;padding:9px 6px;text-align:center;cursor:pointer;transition:all .15s;color:#F0EAD8}
.prod-item:hover{background:#B8942A;color:#1A1714}
.prod-emoji{font-size:18px;margin-bottom:3px}
.prod-name{font-size:11px;font-weight:500;margin-bottom:1px;font-family:'DM Sans',sans-serif}
.prod-price{font-size:10px;opacity:.7}
.modal-links{display:flex;flex-direction:column;gap:6px;margin-top:auto}
.mlink{display:flex;align-items:center;justify-content:center;min-height:44px;text-align:center;padding:10px;border-radius:6px;font-size:13px;font-weight:500;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .15s;border:none;text-decoration:none}
.mlink-primary{background:#1A1714;color:#FAF8F4}
.mlink-primary:hover{background:#2C2318}
.mlink-sec{background:transparent;color:#1A1714;border:0.5px solid rgba(26,23,20,0.2)}
.mlink-sec:hover{background:rgba(26,23,20,0.05)}
.zoom-btn{position:absolute;bottom:10px;right:10px;min-height:44px;background:rgba(26,23,20,0.72);color:#FAF8F4;border:none;border-radius:6px;padding:6px 14px;font-size:12px;font-weight:500;cursor:pointer;font-family:'DM Sans',sans-serif;z-index:6;display:flex;align-items:center;gap:5px;transition:background .15s}
.zoom-btn:hover{background:#B8942A;color:#1A1714}
.osd-container{width:100%;height:100%;min-height:260px;background:#111}

/* CHECKOUT — mobile-first bottom sheet, same as the artwork modal */
.co-bg{position:fixed;inset:0;background:rgba(26,23,20,0.72);z-index:400;display:flex;align-items:flex-end;justify-content:center;backdrop-filter:blur(4px)}
.co-sheet{background:#FAF8F4;border-radius:16px 16px 0 0;width:100%;max-width:100%;max-height:92vh;max-height:92dvh;overflow-y:auto;-webkit-overflow-scrolling:touch;position:relative;box-shadow:0 -8px 40px rgba(26,23,20,0.3);display:flex;flex-direction:column;animation:slideUp .28s ease;padding:22px 18px 26px;gap:12px}
.co-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.co-title{font-family:'Cormorant Garamond',Georgia,serif;font-size:clamp(20px,5.5vw,24px);font-weight:300;line-height:1.12}
.co-sub{font-size:12px;color:#8A8178;margin-top:2px}
.co-close{width:40px;height:40px;flex-shrink:0;border-radius:50%;background:rgba(26,23,20,0.08);border:none;color:#1A1714;font-size:22px;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1}
.co-close:hover{background:rgba(26,23,20,0.16)}
.co-field{display:flex;flex-direction:column;gap:4px}
.co-label{font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:#8A8178;font-weight:500}
.co-input,.co-select{width:100%;min-height:44px;padding:0 12px;border:0.5px solid rgba(26,23,20,0.25);border-radius:6px;font-size:16px;background:#fff;font-family:'DM Sans',sans-serif;color:#1A1714;outline:none}
.co-input:focus,.co-select:focus{border-color:#B8942A;box-shadow:0 0 0 2px rgba(184,148,42,0.12)}
.co-row{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.co-qty{display:flex;align-items:center;gap:12px}
.co-qty button{width:38px;height:38px;border-radius:50%;border:0.5px solid rgba(26,23,20,0.22);background:transparent;color:#1A1714;font-size:18px;line-height:1;cursor:pointer;display:flex;align-items:center;justify-content:center}
.co-pay-element{min-height:44px;padding:4px 0}
.co-btn{width:100%;min-height:48px;background:#1A1714;color:#FAF8F4;border:none;border-radius:6px;font-size:15px;font-weight:600;cursor:pointer;font-family:'DM Sans',sans-serif;transition:background .15s}
.co-btn:hover{background:#2C2318}
.co-btn:disabled{background:#8A8178;cursor:default}
.co-btn-gold{background:#B8942A;color:#1A1714}
.co-btn-gold:hover{background:#C9A84C}
.co-note{font-size:11px;color:#8A8178;text-align:center;line-height:1.5}
.co-error{font-size:13px;color:#dc2626;line-height:1.5;background:rgba(220,38,38,0.06);border-radius:6px;padding:10px 12px}
.co-result{text-align:center;display:flex;flex-direction:column;align-items:center;gap:8px;padding:16px 0}
.co-result-icon{font-size:44px}
.co-result-msg{font-size:14px;line-height:1.5}
.co-total{display:flex;align-items:baseline;justify-content:space-between;font-size:14px;padding-top:4px}
.co-total strong{font-size:20px;font-family:'Cormorant Garamond',Georgia,serif;font-weight:400}

/* ---------- TABLET / DESKTOP (min-width:769px) ---------- */
@media(min-width:769px){
  .layout{height:100vh}
  .sidebar{position:static;transform:none;box-shadow:none;width:210px;max-width:none}
  .sidebar-backdrop{display:none}
  .museum-btn{min-height:0;padding:5px 12px;font-size:12px}
  .topbar{flex-wrap:nowrap;height:52px;padding:0 16px;gap:10px}
  .topbar-menu,.topbar-search-btn{display:none}
  .topbar-search{display:block;order:0;width:180px;flex-shrink:0;min-height:0;padding:6px 11px;border-radius:4px;font-size:12px}
  .topbar-home{min-height:0;padding:5px 10px;border-radius:4px;font-size:12px}
  .genre-chip{min-height:0;padding:8px 14px;font-size:10px}
  .order-chip{min-height:0;padding:8px 12px;font-size:10px}
  .grid-area{padding:16px}
  .art-grid{grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:12px}
  .modal-bg{align-items:center;padding:20px}
  .modal{flex-direction:row;border-radius:10px;max-width:820px;max-height:90vh;overflow:hidden;box-shadow:0 28px 70px rgba(26,23,20,0.3);animation:none}
  .modal-img{flex:0 0 300px;min-height:380px;max-height:none}
  .modal-img img{max-height:560px}
  .modal-detail{padding:26px 22px;overflow-y:auto;max-height:90vh}
  .modal-close{width:30px;height:30px;font-size:18px}
  .co-bg{align-items:center;padding:20px}
  .co-sheet{border-radius:12px;max-width:460px;max-height:90vh;animation:none}
  .co-input,.co-select{font-size:14px;min-height:42px}
}
`;

export default function Viewer() {
  const [selected, setSelected]     = useState(null);
  const [genre, setGenre]           = useState(GENRES[0]);
  const [sortOrder, setSortOrder]   = useState('recent');
  const [works, setWorks]           = useState([]);
  const [loading, setLoading]       = useState(false);
  const [hasMore, setHasMore]       = useState(false);
  const [modal, setModal]           = useState(null);
  const [imgErrors, setImgErrors]   = useState({});
  const [searchInput, setSearch]    = useState('');
  const [totalDb, setTotalDb]       = useState(null);
  const [collCount, setCollCount]   = useState(null);
  const [navOpen, setNavOpen]       = useState(false); // mobile museum drawer
  const [searchOpen, setSearchOpen] = useState(false); // mobile search field toggle
  const [fullReady, setFullReady]   = useState(false); // museum full image finished loading
  const [zoomOpen, setZoomOpen]     = useState(false); // OpenSeadragon IIIF viewer open
  const [aiActive, setAiActive]     = useState(false); // showing AI-search results (no museum selected)
  const [aiQuery, setAiQuery]       = useState('');
  const [aiSearching, setAiSearching] = useState(false);
  const [aiInfo, setAiInfo]         = useState(null);  // { description, mood } from the AI
  const osdRef  = useRef(null);
  const osdInst = useRef(null);
  const gate = useShopGate();

  // --- checkout (Stripe Elements) ---
  const [checkout, setCheckout] = useState(null);      // { product, art } when open
  const [coStep, setCoStep]     = useState('details');  // details | payment | result
  const [coSize, setCoSize]     = useState(null);
  const [coQty, setCoQty]       = useState(1);
  const [ship, setShip]         = useState({ name: '', email: '', phone: '', address1: '', city: '', state_code: '', zip: '', country_code: 'US' });
  const [coBusy, setCoBusy]     = useState(false);
  const [coError, setCoError]   = useState(null);
  const [coResult, setCoResult] = useState(null);
  const [clientSecret, setClientSecret] = useState(null);
  const [amountCents, setAmountCents]   = useState(null);
  const stripeRef   = useRef(null);
  const elementsRef = useRef(null);
  const payElRef    = useRef(null);

  const openCheckout = (product, art) => {
    setCheckout({ product, art });
    setCoStep('details');
    setCoSize(product.sizes?.[0] || null);
    setCoQty(1);
    setCoError(null);
    setCoResult(null);
    setClientSecret(null);
    setAmountCents(null);
    stripeRef.current = null;
    elementsRef.current = null;
  };

  const closeCheckout = () => { setCheckout(null); setCoBusy(false); };

  // Redirect fallback to the legacy no-charge draft-order flow on the home page.
  const draftRedirect = (product, art) => {
    const img = art?.full_url || art?.thumb_url || '';
    const print = art?.print_url || img;
    window.location.href =
      `/?order=1&product=${encodeURIComponent(product.name)}&work=${encodeURIComponent(art?.title || '')}` +
      `&img=${encodeURIComponent(img)}&print=${encodeURIComponent(print)}`;
  };

  // Step 1 → 2: validate shipping, create a PaymentIntent, advance to card entry.
  const goToPayment = async () => {
    setCoError(null);
    const missing = ['name', 'email', 'address1', 'city', 'country_code', 'zip']
      .filter(f => !String(ship[f] || '').trim());
    if (missing.length) { setCoError(`Please fill in: ${missing.join(', ')}`); return; }

    // Stash the validated identity so the tracking beacon can attach it to
    // later page views and the CRM push has an email to match on.
    saveIdentity({ email: ship.email, phone: ship.phone, name: ship.name });

    if (!STRIPE_PK) { draftRedirect(checkout.product, checkout.art); return; }

    setCoBusy(true);
    try {
      const resp = await fetch('/api/create-payment-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: checkout.product.name,
          size: coSize,
          quantity: coQty,
          work: checkout.art?.title || '',
          email: ship.email, // -> Stripe receipt_email for the confirmation receipt
        }),
      });
      if (resp.status === 501) { draftRedirect(checkout.product, checkout.art); return; }
      const data = await resp.json();
      if (!resp.ok) { setCoError(data.error || 'Could not start checkout'); return; }
      setClientSecret(data.client_secret);
      setAmountCents(data.amount);
      setCoStep('payment');
    } catch (e) {
      setCoError(e.message);
    } finally {
      setCoBusy(false);
    }
  };

  // Step 2 → 3: confirm the card payment, then create the (paid) Printful order.
  const payAndOrder = async () => {
    if (!stripeRef.current || !elementsRef.current) return;
    setCoBusy(true);
    setCoError(null);
    try {
      const { error, paymentIntent } = await stripeRef.current.confirmPayment({
        elements: elementsRef.current,
        redirect: 'if_required',
      });
      if (error) { setCoError(error.message); return; }
      if (paymentIntent?.status !== 'succeeded') {
        setCoError(`Payment ${paymentIntent?.status || 'not completed'}`);
        return;
      }
      const art = checkout.art;
      let sessionToken = null;
      try { sessionToken = (await fetch('/api/order-token').then(r => r.json())).token; } catch (e) {}
      const resp = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: checkout.product.name,
          size: coSize,
          quantity: coQty,
          print_url: art?.print_url || art?.full_url || art?.thumb_url,
          work: art?.title,
          recipient: ship,
          payment_intent_id: paymentIntent.id,
          session_token: sessionToken,
        }),
      });
      const data = await resp.json();
      setCoResult(resp.ok
        ? { ok: true, msg: data.message || 'Order placed', data }
        : { ok: false, msg: data.error || 'Payment succeeded but the order could not be created — contact support.' });
      setCoStep('result');
    } catch (e) {
      setCoError(e.message);
    } finally {
      setCoBusy(false);
    }
  };

  // Mount the Stripe Payment Element once we have a client secret.
  useEffect(() => {
    if (coStep !== 'payment' || !clientSecret || !STRIPE_PK) return;
    let cancelled = false;
    loadStripeJs()
      .then(Stripe => {
        if (cancelled || !payElRef.current) return;
        stripeRef.current = Stripe(STRIPE_PK);
        elementsRef.current = stripeRef.current.elements({ clientSecret });
        const el = elementsRef.current.create('payment');
        el.mount(payElRef.current);
      })
      .catch(e => { if (!cancelled) setCoError(e.message); });
    return () => { cancelled = true; };
  }, [coStep, clientSecret]);

  // Lock body scroll while the checkout sheet is open.
  useEffect(() => {
    if (!checkout) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [checkout]);

  useEffect(() => {
    document.title = 'World Museum Viewer — Public Art Collections';
    fetch('/api/artworks?count=true').then(r => r.json()).then(d => setTotalDb(d.total));
  }, []);

  // AudienceLab pixel — load once, only when a pixel id is configured.
  useEffect(() => {
    if (!AUDIENCELAB_PIXEL_ID || typeof window === 'undefined') return;
    if (document.getElementById('audiencelab-pixel')) return;
    window.AudienceLabPixelId = AUDIENCELAB_PIXEL_ID;
    const s = document.createElement('script');
    s.id = 'audiencelab-pixel';
    s.async = true;
    s.src = `${AUDIENCELAB_SRC}?id=${encodeURIComponent(AUDIENCELAB_PIXEL_ID)}`;
    document.head.appendChild(s);
  }, []);

  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') setModal(null); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);

  useEffect(() => {
    document.body.style.overflow = modal ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [modal]);

  // On open: show thumbnail immediately, preload the museum's full image, swap when ready.
  useEffect(() => {
    setFullReady(false);
    setZoomOpen(false);
    if (!modal?.full_url) return;
    let cancelled = false;
    const img = new Image();
    img.onload = () => { if (!cancelled) setFullReady(true); };
    img.src = modal.full_url;
    return () => { cancelled = true; };
  }, [modal]);

  // Gigapixel zoom: stream the museum's IIIF info.json through OpenSeadragon (nothing stored by us).
  useEffect(() => {
    if (!zoomOpen || !modal?.iiif_info) return;
    let cancelled = false;
    const destroy = () => { if (osdInst.current) { try { osdInst.current.destroy(); } catch (e) {} osdInst.current = null; } };
    const init = () => {
      if (cancelled || !osdRef.current || !window.OpenSeadragon) return;
      destroy();
      osdInst.current = window.OpenSeadragon({
        element: osdRef.current,
        prefixUrl: OSD_PREFIX,
        tileSources: modal.iiif_info, // IIIF info.json served directly from the museum
        showNavigator: true,
        gestureSettingsMouse: { clickToZoom: false },
      });
    };
    if (window.OpenSeadragon) { init(); }
    else {
      let s = document.getElementById('osd-script');
      if (!s) {
        s = document.createElement('script');
        s.id = 'osd-script';
        s.src = OSD_SRC;
        document.head.appendChild(s);
      }
      s.addEventListener('load', init);
    }
    return () => { cancelled = true; destroy(); };
  }, [zoomOpen, modal]);

  const loadWorks = useCallback(async (museum, genreFilter, ord, offset = 0, append = false) => {
    if (!museum) return;
    setLoading(true);
    try {
      let url = `/api/artworks?limit=48&offset=${offset}`;
      if (museum.searchMode) {
        url += `&search=${encodeURIComponent(museum.source)}`;
        if (genreFilter?.search) url += `+${encodeURIComponent(genreFilter.search)}`;
      } else {
        url += `&source=${encodeURIComponent(museum.source)}`;
        if (genreFilter?.search) url += `&search=${encodeURIComponent(genreFilter.search)}`;
      }
      if (ord === 'random') url += `&order=random`;
      const data = await fetch(url).then(r => r.json());
      const w = data.works || [];
      if (append) setWorks(prev => [...prev, ...w]);
      else { setWorks(w); setImgErrors({}); }
      setHasMore(w.length === 48);
      if (!append) setCollCount(w.length < 48 ? w.length : null);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  const handleSelect = museum => {
    setSelected(museum);
    setAiActive(false);
    setGenre(GENRES[0]);
    setSearch('');
    setNavOpen(false); // close the mobile drawer after picking a museum
    loadWorks(museum, GENRES[0], sortOrder, 0, false);
  };

  // AI natural-language search: /api/ai-search expands the query via Claude
  // (server-side) and returns matching works. Results render without a museum
  // selection (aiActive), so we clear the museum/genre and drive the grid directly.
  const doAISearch = async (q) => {
    const query = ((q ?? aiQuery) || '').trim();
    if (!query) return;
    setAiSearching(true);
    setAiInfo(null);
    setSelected(null);
    setModal(null);
    setGenre(GENRES[0]);
    setAiActive(true);
    setWorks([]);
    setHasMore(false);
    setNavOpen(false);
    try {
      const d = await fetch('/api/ai-search?query=' + encodeURIComponent(query)).then(r => r.json());
      setWorks(d.works || []);
      setAiInfo({ description: d.ai_description || '', mood: d.ai_mood || '' });
    } catch (e) { console.error('AI search error:', e); }
    setAiSearching(false);
  };

  const handleGenre = g => {
    setGenre(g);
    setSearch('');
    if (selected) loadWorks(selected, g, sortOrder, 0, false);
  };

  const handleOrder = ord => {
    setSortOrder(ord);
    if (selected) loadWorks(selected, genre, ord, 0, false);
  };

  const handleSearch = e => {
    if (e.key !== 'Enter' || !searchInput.trim() || !selected) return;
    setLoading(true);
    const q = searchInput.trim();
    let url = `/api/artworks?limit=48&offset=0`;
    if (selected.searchMode) url += `&search=${encodeURIComponent(selected.source + ' ' + q)}`;
    else url += `&source=${encodeURIComponent(selected.source)}&search=${encodeURIComponent(q)}`;
    fetch(url).then(r => r.json()).then(data => {
      setWorks(data.works || []);
      setHasMore(false);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  return (
    <>
      <style>{CSS}</style>
      <div className="layout">

        {/* SIDEBAR */}
        <aside className={`sidebar${navOpen ? ' open' : ''}`}>
          <div className="sidebar-head">
            <a href="/" className="sidebar-logo">Public Art <span>Collections</span></a>
            <div className="sidebar-sub">
              {totalDb ? `${Number(totalDb).toLocaleString()} works` : `${ALL_MUSEUMS.length} institutions`}
            </div>
          </div>
          <div className="sidebar-scroll">
            {REGIONS.map(r => (
              <div key={r.region}>
                <div className="region-label">{r.region}</div>
                {r.museums.map(m => (
                  <button
                    key={m.source}
                    className={`museum-btn${selected?.source === m.source ? ' active' : ''}`}
                    onClick={() => handleSelect(m)}
                    title={m.source}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            ))}
          </div>
        </aside>
        {navOpen && <div className="sidebar-backdrop" onClick={() => setNavOpen(false)} />}

        {/* MAIN */}
        <div className="main">

          {/* TOPBAR */}
          <div className="topbar">
            <button className="topbar-menu" onClick={() => setNavOpen(true)} aria-label="Open museum list">☰</button>
            <div className="topbar-title">
              {selected
                ? <>{selected.label}{genre.label !== 'All' && <span> · {genre.label}</span>}</>
                : <span>Select a museum</span>}
            </div>
            {selected && (
              <button
                className="topbar-search-btn"
                onClick={() => setSearchOpen(o => !o)}
                aria-label="Search this collection"
                aria-expanded={searchOpen}
              >
                🔍
              </button>
            )}
            {selected && (
              <input
                className={`topbar-search${searchOpen ? ' open' : ''}`}
                placeholder="Search this collection…"
                value={searchInput}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={handleSearch}
              />
            )}
            {!loading && works.length > 0 && (
              <span className="topbar-count">
                {collCount !== null ? collCount : `${works.length}+`} works
              </span>
            )}
            <a href="/" className="topbar-home">← Home</a>
          </div>

          {/* GENRE + ORDER BAR */}
          {selected && (
            <div className="filter-row">
              {GENRES.map(g => (
                <button
                  key={g.label}
                  className={`genre-chip${genre.label === g.label ? ' active' : ''}`}
                  onClick={() => handleGenre(g)}
                >
                  {g.label}
                </button>
              ))}
              <div className="filter-sep" />
              {ORDERS.map(o => (
                <button
                  key={o.value}
                  className={`order-chip${sortOrder === o.value ? ' active' : ''}`}
                  onClick={() => handleOrder(o.value)}
                >
                  {o.value === 'random' ? '↺ ' : ''}{o.label}
                </button>
              ))}
            </div>
          )}

          {/* GRID AREA */}
          <div className="grid-area">
            {/* AI natural-language search — always available */}
            <div style={{ paddingBottom: 12 }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={aiQuery}
                  onChange={e => setAiQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && doAISearch()}
                  placeholder="✨ AI search — mood, color, era, style… e.g. “blue melancholy landscapes”"
                  style={{ flex: 1, padding: '10px 14px', border: '0.5px solid rgba(26,23,20,0.2)', borderRadius: 6, fontSize: 14, background: '#FAF8F4', color: '#1A1714', outline: 'none', minHeight: 44 }}
                />
                <button onClick={() => doAISearch()} disabled={aiSearching}
                  style={{ background: '#B8942A', color: '#1A1714', border: 'none', padding: '0 18px', borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', minHeight: 44 }}>
                  {aiSearching ? '🤔 Thinking…' : '✨ AI Search'}
                </button>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                {['blue and melancholy', 'powerful women', 'Japanese nature', 'Dutch golden age', 'war and suffering', 'impressionist light'].map(s => (
                  <button key={s} onClick={() => { setAiQuery(s); doAISearch(s); }}
                    style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, cursor: 'pointer', border: '0.5px solid rgba(26,23,20,0.2)', background: 'transparent', color: '#8A8178' }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {aiActive && aiInfo?.description && (
              <div style={{ marginBottom: 12, padding: '12px 14px', background: '#F5F0E8', borderRadius: 6, border: '0.5px solid rgba(26,23,20,0.12)' }}>
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: '#B8942A', marginBottom: 4 }}>✨ AI interpretation</div>
                <div style={{ fontSize: 13, color: '#1A1714', lineHeight: 1.5 }}>{aiInfo.description}</div>
                {aiInfo.mood && <div style={{ fontSize: 11, color: '#8A8178', marginTop: 4 }}>Mood: {aiInfo.mood}</div>}
              </div>
            )}

            {(!selected && !aiActive) ? (
              <div className="empty">
                <div className="empty-icon">🏛️</div>
                <div className="empty-title">World Museums</div>
                <div className="empty-sub">
                  Select a museum from the sidebar, or use ✨ AI search above.
                  {totalDb && ` ${Number(totalDb).toLocaleString()} works across ${ALL_MUSEUMS.length} institutions.`}
                </div>
              </div>
            ) : (loading || aiSearching) && works.length === 0 ? (
              <div className="art-grid">
                {Array.from({ length: 24 }).map((_, i) => (
                  <div key={i} className="skeleton">
                    <div className="sk-img" />
                    <div className="sk-body">
                      <div className="sk-line sk-line-md" />
                      <div className="sk-line sk-line-lg" />
                      <div className="sk-line sk-line-sm" />
                    </div>
                  </div>
                ))}
              </div>
            ) : works.length === 0 ? (
              <div className="empty">
                <div className="empty-icon">🔍</div>
                <div className="empty-title">No works found</div>
                <div className="empty-sub">
                  {aiActive
                    ? 'No works matched that search. Try different words.'
                    : genre.label !== 'All'
                      ? `No "${genre.label}" works found in ${selected.label}. Try a different genre or clear the filter.`
                      : `${selected.label} may not have synced yet.`}
                </div>
                {!aiActive && genre.label !== 'All' && (
                  <button className="load-btn" onClick={() => handleGenre(GENRES[0])}>Clear genre filter</button>
                )}
              </div>
            ) : (
              <>
                <div className="art-grid">
                  {works.map(w => (
                    <div key={w.id} className="art-card" onClick={() => setModal(w)}>
                      <div className="card-img">
                        {w.thumb_url && !imgErrors[w.id] ? (
                          <img
                            src={getThumbUrl(w.thumb_url)}
                            alt={w.title}
                            loading="lazy"
                            style={{ opacity: 0, transition: 'opacity .35s ease' }}
                            onLoad={e => { e.currentTarget.style.opacity = 1; }}
                            onError={() => setImgErrors(e => ({ ...e, [w.id]: true }))}
                          />
                        ) : (
                          <div className="card-ph">🖼️</div>
                        )}
                        <div className="card-hover-overlay">
                          <span className="card-hover-label">View &amp; Order →</span>
                        </div>
                      </div>
                      <div className="card-info">
                        <div className="card-source">{fmt(w.source)}</div>
                        <div className="card-title">{w.title}</div>
                        <div className="card-artist">{w.artist || 'Unknown'}</div>
                        {w.date_text && <div className="card-date">{w.date_text}</div>}
                      </div>
                    </div>
                  ))}
                </div>
                {hasMore && (
                  <div className="load-more-wrap">
                    <button
                      className="load-btn"
                      onClick={() => loadWorks(selected, genre, sortOrder, works.length, true)}
                      disabled={loading}
                    >
                      {loading ? 'Loading…' : 'Load more'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* MODAL */}
      {modal && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <button className="modal-close" onClick={() => setModal(null)}>×</button>
            <div className="modal-img">
              {zoomOpen && modal.iiif_info ? (
                <div ref={osdRef} className="osd-container" />
              ) : (modal.thumb_url || modal.full_url) ? (
                <img
                  src={(fullReady && modal.full_url) ? modal.full_url : (modal.thumb_url || modal.full_url)}
                  alt={modal.title}
                  onError={e => { if (modal.thumb_url && e.target.src !== modal.thumb_url) e.target.src = modal.thumb_url; }}
                />
              ) : (
                <div className="modal-img-ph">🖼️</div>
              )}
              {modal.iiif_info && !zoomOpen && (
                <button className="zoom-btn" onClick={() => setZoomOpen(true)}>🔍 Gigapixel zoom</button>
              )}
            </div>
            <div className="modal-detail">
              <div className="modal-source">{fmt(modal.source)}</div>
              <div className="modal-title">{modal.title}</div>
              <div className="modal-artist">
                {[modal.artist, modal.date_text].filter(Boolean).join(' · ') || 'Unknown artist'}
              </div>
              <div className="divider" />
              <div className="meta-row">
                {modal.medium && <div className="meta-item"><label>Medium</label><span>{modal.medium}</span></div>}
                <div className="meta-item"><label>Rights</label><span className="meta-rights">{modal.rights_label || 'CC0'}</span></div>
                {modal.department && <div className="meta-item"><label>Dept.</label><span>{modal.department}</span></div>}
              </div>
              {modal.bio && (
                <>
                  <div className="divider" />
                  <div className="modal-bio">{modal.bio.slice(0, 280)}</div>
                </>
              )}
              <div className="divider" />
              {gate.shopUnlocked ? (
                <>
                  <div className="prod-label">Order as</div>
                  <div className="prod-grid">
                    {PRODUCTS.map(p => (
                      <div
                        key={p.name}
                        className="prod-item"
                        onClick={() => openCheckout(p, modal)}
                      >
                        <div className="prod-emoji">{p.emoji}</div>
                        <div className="prod-name">{p.name}</div>
                        <div className="prod-price">{p.price}</div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <TradeAccessPanel gate={gate} />
              )}
              <div className="divider" />
              <div className="modal-links">
                <a href={`/artwork/${modal.id}`} className="mlink mlink-primary">View full page →</a>
                {modal.detail_url && (
                  <a href={modal.detail_url} target="_blank" rel="noopener noreferrer" className="mlink mlink-sec">
                    View on museum website ↗
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CHECKOUT — Stripe Elements (charge, then create the Printful order) */}
      {checkout && (
        <div className="co-bg" onClick={e => e.target === e.currentTarget && closeCheckout()}>
          <div className="co-sheet">
            <div className="co-head">
              <div>
                <div className="co-title">
                  {checkout.product.emoji} {checkout.product.name}
                </div>
                <div className="co-sub">{checkout.art?.title || 'Selected artwork'}</div>
              </div>
              <button className="co-close" onClick={closeCheckout} aria-label="Close checkout">×</button>
            </div>

            {coStep === 'details' && (
              <>
                {checkout.product.sizes?.length > 1 && (
                  <div className="co-field">
                    <label className="co-label">Size / Option</label>
                    <select className="co-select" value={coSize || ''} onChange={e => setCoSize(e.target.value)}>
                      {checkout.product.sizes.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                )}
                <div className="co-field">
                  <label className="co-label">Quantity</label>
                  <div className="co-qty">
                    <button onClick={() => setCoQty(q => Math.max(1, q - 1))} aria-label="Decrease">−</button>
                    <span>{coQty}</span>
                    <button onClick={() => setCoQty(q => Math.min(25, q + 1))} aria-label="Increase">+</button>
                  </div>
                </div>
                <div className="divider" />
                {[['name', 'Full name'], ['email', 'Email'], ['phone', 'Phone (optional)'], ['address1', 'Address'], ['city', 'City'],
                  ['state_code', 'State / Province'], ['zip', 'ZIP / Postal'], ['country_code', 'Country code (e.g. US)']].map(([k, label]) => (
                  <div className="co-field" key={k}>
                    <label className="co-label">{label}</label>
                    <input
                      className="co-input"
                      value={ship[k]}
                      inputMode={k === 'email' ? 'email' : k === 'phone' ? 'tel' : 'text'}
                      onChange={e => setShip(s => ({ ...s, [k]: e.target.value }))}
                    />
                  </div>
                ))}
                {coError && <div className="co-error">{coError}</div>}
                <button className="co-btn" disabled={coBusy} onClick={goToPayment}>
                  {coBusy ? 'Starting…' : (STRIPE_PK ? 'Continue to payment →' : 'Continue →')}
                </button>
                <div className="co-note">
                  {STRIPE_PK
                    ? 'Secure payment by Stripe. Prints fulfilled by Printful, shipped worldwide.'
                    : 'Checkout is not fully configured yet — continues to a no-charge draft order.'}
                </div>
              </>
            )}

            {coStep === 'payment' && (
              <>
                {amountCents != null && (
                  <div className="co-total">
                    <span>{checkout.product.name}{coSize ? ` · ${coSize}` : ''} × {coQty}</span>
                    <strong>${(amountCents / 100).toFixed(2)}</strong>
                  </div>
                )}
                <div className="divider" />
                <div className="co-field">
                  <label className="co-label">Card details</label>
                  <div className="co-pay-element" ref={payElRef} />
                </div>
                {coError && <div className="co-error">{coError}</div>}
                <button className="co-btn co-btn-gold" disabled={coBusy} onClick={payAndOrder}>
                  {coBusy ? 'Processing…' : `Pay${amountCents != null ? ` $${(amountCents / 100).toFixed(2)}` : ''} & place order`}
                </button>
                <button className="co-btn" style={{ background: 'transparent', color: '#1A1714', border: '0.5px solid rgba(26,23,20,0.2)' }}
                  disabled={coBusy} onClick={() => { setCoStep('details'); setCoError(null); }}>
                  ← Back
                </button>
              </>
            )}

            {coStep === 'result' && coResult && (
              <div className="co-result">
                <div className="co-result-icon">{coResult.ok ? '✅' : '⚠️'}</div>
                <p className="co-result-msg" style={{ color: coResult.ok ? '#166534' : '#dc2626' }}>{coResult.msg}</p>
                {coResult.ok && coResult.data?.orderId && (
                  <p className="co-note">
                    Order #{coResult.data.orderId}
                    {coResult.data.printful_order_id ? ` · Printful ${coResult.data.printful_order_id}` : ''}
                  </p>
                )}
                <button className="co-btn" onClick={closeCheckout}>Done</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* PIN MODAL — trade access */}
      <PinModal gate={gate} />
    </>
  );
}
