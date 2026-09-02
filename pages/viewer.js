import { useState, useEffect, useCallback, useRef } from 'react';
import { useShopGate, PinModal, TradeAccessPanel } from '../lib/useShopGate';
import AuthNav from '../components/AuthNav';
import LeadPopup from '../components/LeadPopup';
import CheckoutSheet, { PRODUCTS } from '../components/CheckoutSheet';
import { loadIdentity } from '../lib/identity';

const OSD_VERSION = '4.1.0';
const OSD_SRC = `https://cdnjs.cloudflare.com/ajax/libs/openseadragon/${OSD_VERSION}/openseadragon.min.js`;
const OSD_PREFIX = `https://cdnjs.cloudflare.com/ajax/libs/openseadragon/${OSD_VERSION}/images/`;

const REGIONS = [
  {
    // Real war/military museum holdings only (via ?warmuseums=1 → the curated
    // WAR_MUSEUM_SOURCES list in /api/artworks), not war-themed art from other
    // museums. Sourced from Europeana (Army Museum, Estonian War Museum, etc.).
    region: '⚔️ War & Military Art',
    museums: [
      { label: 'Military & War Museums', warMuseums: true },
    ],
  },
  {
    region: 'United States',
    museums: [
      { label: 'Metropolitan Museum',       source: 'Metropolitan Museum of Art' },
      { label: 'Art Inst. Chicago',         source: 'Art Institute of Chicago' },
      { label: 'Cleveland Museum',          source: 'Cleveland Museum of Art' },
      { label: 'Cooper Hewitt Design',     source: 'Cooper Hewitt, Smithsonian Design Museum' },
      { label: 'Smithsonian American Art', source: 'Smithsonian American Art Museum' },
      { label: 'Nat. Portrait Gallery',    source: 'National Portrait Gallery' },
      { label: 'African American History', source: 'National Museum of African American History and Culture' },
      { label: 'Nat. Museum Amer. History',source: 'National Museum of American History' },
      { label: 'Nat. Museum Asian Art',    source: 'National Museum of Asian Art' },
      { label: 'National Postal Museum',   source: 'National Postal Museum' },
      { label: 'Smithsonian Archives',     source: 'Smithsonian Institution Archives' },
      { label: 'Nat. Museum Amer. Indian', source: 'National Museum of the American Indian' },
      { label: 'Hirshhorn Museum',         source: 'Hirshhorn Museum and Sculpture Garden' },
      { label: 'Smithsonian Gardens',      source: 'Smithsonian Gardens' },
      { label: 'Anacostia Community',      source: 'Anacostia Community Museum' },
      { label: 'Nat. Museum African Art',  source: 'National Museum of African Art' },
      { label: 'Smithsonian Libraries',    source: 'Smithsonian Libraries' },
      { label: 'Smithsonian (misc.)',      source: 'Smithsonian Institution' },
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

// PRODUCTS + the Stripe checkout flow now live in components/CheckoutSheet.js
// (shared across the home page, viewer, and artwork detail page).

// AudienceLab tracking pixel — injected only when a pixel id is configured.
// The script src is overridable so the exact CDN endpoint can be set without a
// code change (defaults to AudienceLab's pixel host).
const AUDIENCELAB_PIXEL_ID = process.env.NEXT_PUBLIC_AUDIENCELAB_PIXEL_ID || '';
const AUDIENCELAB_SRC = process.env.NEXT_PUBLIC_AUDIENCELAB_SRC || 'https://cdn.audiencelab.io/pixel.js';

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

// Faster grid thumbnails. Three strategies, in order:
//  1) Shrink at the source (direct, no proxy) for sources with a size knob.
//  2) Edge-cache dominant, server-fetchable sources through the hardened proxy
//     (/api/img) — exempted from the 100/min firewall limit by the "RL img" rule.
//  3) Everything else loads direct — importantly Europeana/DPLA (hundreds of
//     arbitrary hosts the proxy can't whitelist) and Smithsonian (its WAF blocks
//     server-side fetches), which would 403/502 if proxied.
const PROXY_HOSTS = new Set([
  'bpldcassets.blob.core.windows.net', // Digital Commonwealth (dominant in the default feed)
  'openaccess-cdn.clevelandart.org',   // Cleveland
  'images.metmuseum.org',              // Met
]);
function getThumbUrl(url) {
  if (!url) return '';
  // NOTE: do NOT proxy artic.edu (AIC) through /api/img — AIC's origin blocks
  // Vercel's datacenter egress IPs (403), while direct browser loads succeed.
  // Loading AIC IIIF thumbnails directly is the working path.
  if (url.includes('/full/!400,400/')) return url.replace('/full/!400,400/', '/full/!300,300/'); // IIIF: V&A, AIC, MIA, LoC…
  if (url.includes('commons.wikimedia.org') && /[?&]width=\d+/.test(url)) return url.replace(/width=\d+/, 'width=300'); // Wikimedia/Wikidata
  if (url.includes('ids.si.edu/ids/deliveryService')) return url + (url.includes('?') ? '&' : '?') + 'max=300'; // Smithsonian (direct — WAF blocks proxy fetch)
  try {
    if (PROXY_HOSTS.has(new URL(url).hostname)) return '/api/img?url=' + encodeURIComponent(url);
  } catch (e) {}
  return url;
}

// Mobile-first: base rules target small (360px+) screens; min-width media
// queries scale the layout up to tablet and desktop. No layout dimensions are
// set inline in the JSX — every grid and element is driven by a class here.
const CSS = `
/* Fonts + palette tokens + reset live in styles/globals.css (shared system).
   This block styles the World Museum Viewer in the Neoclassical Museum aesthetic.
   Mobile-first: base rules target small screens; min-width queries scale up. */
html,body{height:100%;-webkit-text-size-adjust:100%}
/* Fixed-height app shell so only the grid scrolls and the top/filter bars stay
   pinned. 100dvh keeps it correct under iOS Safari's dynamic toolbar; the 100vh
   line above it is a fallback for older Android browsers without dvh support. */
.layout{display:flex;height:100vh;height:100dvh;overflow:hidden;position:relative}

/* SIDEBAR — a slide-in drawer on mobile, static rail on desktop */
.sidebar{position:fixed;top:0;left:0;bottom:0;z-index:210;width:82%;max-width:300px;flex-shrink:0;background:var(--parchment);border-right:1px solid var(--line);display:flex;flex-direction:column;overflow:hidden;transform:translateX(-100%);transition:transform .22s var(--ease);box-shadow:0 0 40px rgba(20,17,14,.35)}
.sidebar.open{transform:translateX(0)}
.sidebar-backdrop{position:fixed;inset:0;background:rgba(20,17,14,.5);z-index:205}
.sidebar-head{padding:18px 16px 14px;border-bottom:1px solid var(--line);flex-shrink:0}
.sidebar-logo{font-family:var(--serif);font-size:clamp(16px,4.5vw,19px);font-weight:500;color:var(--ink);text-decoration:none;display:block;margin-bottom:4px;letter-spacing:.02em}
.sidebar-logo span{color:var(--gold);font-style:italic}
.sidebar-sub{font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:var(--muted-solid);font-weight:600}
.sidebar-scroll{overflow-y:auto;-webkit-overflow-scrolling:touch;flex:1;padding:6px 0 24px}
.sidebar-scroll::-webkit-scrollbar{width:3px}
.sidebar-scroll::-webkit-scrollbar-thumb{background:var(--line);border-radius:2px}
.region-label{font-size:9px;text-transform:uppercase;letter-spacing:.2em;color:var(--gold);padding:14px 14px 4px;font-weight:600}
.museum-btn{display:flex;align-items:center;width:100%;text-align:left;min-height:44px;padding:8px 16px;font-size:14px;color:var(--ink-soft);background:none;border:none;border-left:2px solid transparent;cursor:pointer;font-family:var(--sans);transition:background .15s var(--ease),color .15s var(--ease),border-color .15s var(--ease);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.4}
.museum-btn:hover{background:rgba(156,124,56,0.06);color:var(--ink)}
.museum-btn.active{background:rgba(156,124,56,0.1);color:var(--ink);font-weight:500;border-left-color:var(--gold)}

/* MAIN */
.main{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0;width:100%}

/* TOPBAR */
.topbar{border-bottom:1px solid var(--line);display:flex;align-items:center;flex-wrap:wrap;padding:8px 12px;gap:8px;flex-shrink:0;background:var(--ivory)}
.topbar-menu{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;background:none;border:1px solid var(--line);border-radius:var(--radius);min-width:44px;min-height:44px;font-size:18px;line-height:1;cursor:pointer;color:var(--ink)}
.topbar-title{font-family:var(--serif);font-size:clamp(16px,4vw,19px);font-weight:400;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.topbar-title span{color:var(--gold);font-style:italic}
.topbar-search-btn{display:inline-flex;align-items:center;justify-content:center;flex-shrink:0;background:none;border:1px solid var(--line);border-radius:var(--radius);min-width:44px;min-height:44px;font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;line-height:1;cursor:pointer;color:var(--ink);padding:0 10px}
/* search field is hidden on mobile until the search control toggles it open */
.topbar-search{display:none;order:5;width:100%;padding:0 12px;min-height:44px;border:1px solid var(--line);border-radius:var(--radius);font-size:16px;background:var(--paper);outline:none;font-family:var(--sans);color:var(--ink)}
.topbar-search.open{display:block}
.topbar-search:focus{border-color:var(--gold);box-shadow:0 0 0 3px rgba(156,124,56,0.12)}
.topbar-search::placeholder{color:var(--muted-solid)}
.topbar-count{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted-solid);white-space:nowrap;flex-shrink:0}
.topbar-home{display:inline-flex;align-items:center;min-height:44px;font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-soft);text-decoration:none;padding:0 14px;border:1px solid var(--line);border-radius:var(--radius);transition:all .2s var(--ease);white-space:nowrap;flex-shrink:0}
.topbar-home:hover{color:var(--ink);border-color:var(--ink)}

/* GENRE + ORDER BAR — horizontally scrollable on narrow screens */
.filter-row{border-bottom:1px solid var(--line-soft);display:flex;align-items:stretch;background:var(--parchment);flex-shrink:0;gap:0;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none}
.filter-row::-webkit-scrollbar{display:none}
.genre-chip{display:inline-flex;align-items:center;min-height:44px;padding:0 15px;font-size:10px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--muted-solid);cursor:pointer;background:none;border:none;border-bottom:2px solid transparent;white-space:nowrap;transition:color .2s var(--ease),border-color .2s var(--ease);font-family:var(--sans);flex-shrink:0}
.genre-chip:hover{color:var(--ink)}
.genre-chip.active{color:var(--ink);border-bottom-color:var(--gold)}
.filter-sep{width:1px;background:var(--line);margin:8px 0;flex-shrink:0}
.order-chip{display:inline-flex;align-items:center;gap:5px;min-height:44px;padding:0 13px;font-size:10px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;color:var(--muted-solid);cursor:pointer;background:none;border:none;border-bottom:2px solid transparent;white-space:nowrap;transition:all .2s var(--ease);font-family:var(--sans);flex-shrink:0}
.order-chip:hover{color:var(--ink)}
.order-chip.active{color:var(--ink);border-bottom-color:var(--gold)}

/* GRID — 2 columns on mobile, auto-fill from tablet up */
.grid-area{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:14px}
.grid-area::-webkit-scrollbar{width:5px}
.grid-area::-webkit-scrollbar-thumb{background:var(--line);border-radius:3px}
.art-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
.art-card{cursor:pointer;border-radius:0;overflow:hidden;background:var(--paper);border:1px solid var(--line);box-shadow:0 1px 2px rgba(26,23,20,0.04);transition:box-shadow .3s var(--ease),transform .3s var(--ease),border-color .3s var(--ease);display:flex;flex-direction:column}
.art-card:hover{box-shadow:0 14px 38px rgba(26,23,20,0.16);transform:translateY(-3px);border-color:var(--line-gold)}
.card-img{aspect-ratio:3/4;background:var(--cream-dk);overflow:hidden;position:relative;flex-shrink:0;border-bottom:1px solid var(--line)}
.card-img img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .5s var(--ease)}
.art-card:hover .card-img img{transform:scale(1.045)}
.card-hover-overlay{position:absolute;inset:0;background:linear-gradient(transparent 50%,rgba(20,17,14,0.72));opacity:0;transition:opacity .3s var(--ease);display:flex;align-items:flex-end;padding:10px}
.art-card:hover .card-hover-overlay{opacity:1}
.card-quick-order{position:absolute;left:10px;right:10px;bottom:10px;z-index:2;min-height:38px;padding:8px 10px;border:none;border-radius:var(--radius);background:var(--gold-bright,#B8942A);color:#1A1714;font-size:11px;font-weight:700;letter-spacing:.03em;cursor:pointer;font-family:var(--sans);opacity:0;transform:translateY(6px);transition:opacity .25s var(--ease),transform .25s var(--ease)}
.art-card:hover .card-quick-order{opacity:1;transform:translateY(0)}
@media(hover:none){.card-quick-order{opacity:1;transform:none}}
.scroll-sentinel{height:1px;width:100%}
.load-spinner{display:flex;align-items:center;justify-content:center;gap:10px;padding:24px 0 36px;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--muted-solid)}
.load-spinner .spinner{width:16px;height:16px;border:2px solid var(--line);border-top-color:var(--gold-bright,#B8942A);border-radius:50%;animation:pac-spin .7s linear infinite;display:inline-block}
@keyframes pac-spin{to{transform:rotate(360deg)}}
.card-add-cart{position:absolute;top:8px;right:8px;z-index:3;width:32px;height:32px;border-radius:50%;border:none;background:rgba(20,17,14,0.62);color:#F0EAD8;font-size:18px;line-height:1;cursor:pointer;opacity:0;transition:opacity .25s var(--ease),background .2s}
.art-card:hover .card-add-cart{opacity:1}
@media(hover:none){.card-add-cart{opacity:1}}
.card-add-cart:hover{background:var(--gold-bright,#B8942A);color:#1A1714}
.cart-fab{position:fixed;right:20px;bottom:20px;z-index:1200;min-width:56px;height:56px;border-radius:28px;border:none;background:var(--gold-bright,#B8942A);color:#1A1714;font-size:22px;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,0.3);display:flex;align-items:center;justify-content:center}
.cart-fab-count{position:absolute;top:-4px;right:-4px;min-width:22px;height:22px;padding:0 6px;border-radius:11px;background:#B33;color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;font-family:var(--sans)}
.cart-drawer{position:fixed;top:0;right:0;bottom:0;width:min(360px,90vw);z-index:1300;background:var(--ivory,#F5F1E8);border-left:1px solid var(--line);box-shadow:-8px 0 30px rgba(0,0,0,0.18);display:flex;flex-direction:column;font-family:var(--sans)}
.cart-drawer-head{display:flex;align-items:center;justify-content:space-between;padding:16px 18px;border-bottom:1px solid var(--line);font-family:var(--serif);font-size:18px;color:var(--ink)}
.cart-drawer-head button{background:none;border:none;font-size:22px;cursor:pointer;color:var(--ink);line-height:1}
.cart-drawer-body{flex:1;overflow-y:auto;padding:10px 14px}
.cart-empty{color:var(--muted-solid);font-size:13px;padding:24px 6px;line-height:1.6;text-align:center}
.cart-line{display:flex;gap:10px;align-items:center;padding:10px 4px;border-bottom:1px solid var(--line)}
.cart-line img{width:48px;height:60px;object-fit:cover;flex-shrink:0;background:var(--cream-dk)}
.cart-line-info{flex:1;min-width:0}
.cart-line-title{font-size:13px;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cart-line-sub{font-size:11px;color:var(--muted-solid);margin-top:2px}
.cart-line-actions{display:flex;flex-direction:column;gap:4px;align-items:flex-end}
.cart-order-btn{background:var(--gold-bright,#B8942A);color:#1A1714;border:none;border-radius:var(--radius);font-size:11px;font-weight:700;padding:6px 10px;cursor:pointer}
.cart-remove-btn{background:none;border:none;color:var(--muted-solid);font-size:16px;cursor:pointer;line-height:1}
.cart-drawer-foot{padding:12px 18px;border-top:1px solid var(--line);display:flex;flex-direction:column;gap:6px}
.cart-clear{background:none;border:1px solid var(--line);border-radius:var(--radius);padding:9px;font-size:11px;text-transform:uppercase;letter-spacing:.12em;cursor:pointer;color:var(--ink)}
.cart-note{font-size:10px;color:var(--muted-solid);text-align:center;line-height:1.5}
.cart-backdrop{position:fixed;inset:0;z-index:1250;background:rgba(20,17,14,0.35)}
.live-section{margin-top:36px;padding-top:18px;border-top:1px solid var(--line)}
.live-head{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted-solid);margin-bottom:14px}
.live-badge{position:absolute;top:8px;left:8px;background:var(--gold-bright);color:var(--ivory);font-size:9px;font-weight:600;padding:3px 9px;border-radius:var(--radius);z-index:2;letter-spacing:.1em;text-transform:uppercase}
a.art-card{text-decoration:none;color:inherit}
.live-adding{position:absolute;inset:0;background:rgba(20,17,14,0.55);color:var(--ivory);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;z-index:3}
.card-hover-label{font-size:10px;font-weight:600;color:var(--ivory);letter-spacing:.14em;text-transform:uppercase}
.card-ph{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-family:var(--serif);font-size:32px;font-style:italic;color:var(--gold);opacity:.6}
.card-info{padding:11px 12px 12px;background:var(--paper);flex:1;display:flex;flex-direction:column}
.card-source{font-size:8.5px;text-transform:uppercase;letter-spacing:.2em;color:var(--gold);margin-bottom:5px;font-weight:600}
.card-title{font-family:var(--serif);font-size:clamp(14px,3.4vw,16px);font-weight:500;line-height:1.25;color:var(--ink);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:4px;flex:1}
.card-artist{font-size:10px;font-style:italic;color:var(--muted-solid);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.card-date{font-size:10px;color:var(--muted-solid);margin-top:2px}

/* SKELETON */
.skeleton{animation:pulse 1.6s ease-in-out infinite}
.sk-img{aspect-ratio:3/4;background:var(--cream-dk)}
.sk-body{padding:11px 12px 12px;background:var(--paper)}
.sk-line{height:9px;background:var(--cream-dk);border-radius:2px;margin-bottom:7px}
.sk-line-sm{width:40%}
.sk-line-md{width:60%}
.sk-line-lg{width:80%}
@keyframes pulse{0%,100%{opacity:.5}50%{opacity:1}}

/* EMPTY */
.empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;color:var(--muted-solid);gap:12px;padding:40px 24px;text-align:center}
.empty-icon{font-family:var(--serif);font-size:clamp(34px,9vw,42px);font-style:italic;color:var(--gold);opacity:.55}
.empty-title{font-family:var(--serif);font-size:clamp(20px,5vw,24px);font-weight:400;font-style:italic;color:var(--ink-soft)}
.empty-sub{font-size:13px;max-width:320px;line-height:1.7}

/* LOAD MORE */
.load-more-wrap{text-align:center;padding:24px 0 36px}
.load-btn{min-height:44px;padding:9px 24px;border:1px solid var(--line);border-radius:var(--radius);font-size:10px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;cursor:pointer;background:transparent;font-family:var(--sans);color:var(--ink);transition:all .2s var(--ease)}
.load-btn:hover{border-color:var(--ink)}

/* MODAL — bottom sheet that slides up full width on mobile */
.modal-bg{position:fixed;inset:0;background:rgba(20,17,14,0.78);z-index:200;display:flex;align-items:flex-end;justify-content:center;backdrop-filter:blur(5px)}
.modal{background:var(--ivory);border-radius:4px 4px 0 0;width:100%;max-width:100%;max-height:92vh;max-height:92dvh;overflow-y:auto;-webkit-overflow-scrolling:touch;position:relative;box-shadow:0 -8px 40px rgba(20,17,14,0.35);display:flex;flex-direction:column;animation:slideUp .28s var(--ease)}
@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
.modal-img{position:relative;background:var(--charcoal);flex:0 0 auto;display:flex;align-items:center;justify-content:center;min-height:200px;max-height:50vh}
.modal-img img{width:100%;height:100%;object-fit:contain;max-height:50vh;transition:opacity .25s}
.modal-img-ph{font-family:var(--serif);font-size:56px;font-style:italic;color:var(--gold);opacity:.6}
.modal-detail{flex:1;padding:24px 20px;display:flex;flex-direction:column;gap:12px;min-width:0}
.modal-close{position:absolute;top:12px;right:12px;width:44px;height:44px;border-radius:50%;background:rgba(20,17,14,0.55);border:1px solid rgba(240,234,216,0.25);color:var(--ivory);font-size:22px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:10;line-height:1;transition:background .2s var(--ease)}
.modal-close:hover{background:rgba(20,17,14,0.9)}
.modal-source{font-size:9px;text-transform:uppercase;letter-spacing:.24em;color:var(--gold);font-weight:600}
.modal-title{font-family:var(--serif);font-size:clamp(22px,5.5vw,28px);font-weight:500;line-height:1.1}
.modal-artist{font-size:13px;font-style:italic;color:var(--ink-soft)}
.divider{height:1px;background:var(--line);flex-shrink:0}
.meta-row{display:flex;gap:18px;flex-wrap:wrap}
.meta-item label{font-size:9px;text-transform:uppercase;letter-spacing:.16em;color:var(--muted-solid);display:block;margin-bottom:3px}
.meta-item span{font-size:12px;font-weight:500;color:var(--ink)}
.meta-rights{color:var(--gold)}
.modal-bio{font-size:13px;color:var(--ink-soft);line-height:1.8;font-family:var(--serif)}
.prod-label{font-size:9px;text-transform:uppercase;letter-spacing:.16em;color:var(--muted-solid);margin-bottom:8px;font-weight:600}
.prod-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
.prod-item{min-height:56px;background:transparent;border:1px solid var(--line);border-radius:var(--radius);padding:11px 8px;text-align:center;cursor:pointer;transition:all .2s var(--ease);color:var(--ink);display:flex;flex-direction:column;justify-content:center}
.prod-item:hover{background:var(--ink);color:var(--ivory);border-color:var(--ink)}
.prod-name{font-size:12px;font-weight:500;margin-bottom:2px;font-family:var(--serif)}
.prod-price{font-size:10px;letter-spacing:.06em;text-transform:uppercase;opacity:.7;font-family:var(--sans)}
.modal-links{display:flex;flex-direction:column;gap:8px;margin-top:auto}
.mlink{display:flex;align-items:center;justify-content:center;min-height:44px;text-align:center;padding:12px;border-radius:var(--radius);font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;cursor:pointer;font-family:var(--sans);transition:all .2s var(--ease);border:1px solid transparent;text-decoration:none}
.mlink-primary{background:var(--ink);color:var(--ivory)}
.mlink-primary:hover{background:var(--charcoal-2)}
.mlink-sec{background:transparent;color:var(--ink);border-color:var(--line)}
.mlink-sec:hover{background:rgba(26,23,20,0.04);border-color:var(--ink)}
.zoom-btn{position:absolute;bottom:10px;right:10px;min-height:44px;background:rgba(20,17,14,0.72);color:var(--ivory);border:1px solid rgba(240,234,216,0.25);border-radius:var(--radius);padding:6px 16px;font-size:10px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;cursor:pointer;font-family:var(--sans);z-index:6;display:flex;align-items:center;gap:5px;transition:background .2s var(--ease),color .2s var(--ease)}
.zoom-btn:hover{background:var(--gold);color:var(--ivory);border-color:var(--gold)}
.osd-container{width:100%;height:100%;min-height:260px;background:var(--charcoal)}

/* Checkout sheet styles now live in components/CheckoutSheet.js */

/* ---------- TABLET / DESKTOP (min-width:769px) ---------- */
@media(min-width:769px){
  .layout{height:100vh}
  .sidebar{position:static;transform:none;box-shadow:none;width:212px;max-width:none}
  .sidebar-backdrop{display:none}
  .museum-btn{min-height:0;padding:5px 16px;font-size:12px}
  .topbar{flex-wrap:nowrap;height:56px;padding:0 18px;gap:12px}
  .topbar-menu,.topbar-search-btn{display:none}
  .topbar-search{display:block;order:0;width:190px;flex-shrink:0;min-height:0;padding:7px 12px;font-size:12px}
  .topbar-home{min-height:0;padding:7px 12px;font-size:10px}
  .genre-chip{min-height:0;padding:9px 15px;font-size:10px}
  .order-chip{min-height:0;padding:9px 13px;font-size:10px}
  .grid-area{padding:18px}
  .art-grid{grid-template-columns:repeat(auto-fill,minmax(165px,1fr));gap:16px}
  .modal-bg{align-items:center;padding:20px}
  .modal{flex-direction:row;border-radius:2px;max-width:840px;max-height:90vh;overflow:hidden;box-shadow:0 32px 70px rgba(20,17,14,0.35);border:1px solid var(--gold);animation:none}
  .modal-img{flex:0 0 320px;min-height:400px;max-height:none;padding:20px}
  .modal-img img{max-height:560px}
  .modal-detail{padding:30px 26px;overflow-y:auto;max-height:90vh}
  .modal-close{width:34px;height:34px;font-size:18px}
}
`;

export default function Viewer() {
  const [selected, setSelected]     = useState(null);
  const [genre, setGenre]           = useState(GENRES[0]);
  const [sortOrder, setSortOrder]   = useState('random');
  const [works, setWorks]           = useState([]);
  const [loading, setLoading]       = useState(false);
  const [hasMore, setHasMore]       = useState(false);
  const [modal, setModal]           = useState(null);
  const [imgErrors, setImgErrors]   = useState({});
  const [searchInput, setSearch]    = useState('');
  const [totalDb, setTotalDb]       = useState(null);
  const [museumCounts, setMuseumCounts] = useState(null); // {source: n} — hide empty museum buttons
  const [collCount, setCollCount]   = useState(null);
  const [navOpen, setNavOpen]       = useState(false); // mobile museum drawer
  const [searchOpen, setSearchOpen] = useState(false); // mobile search field toggle
  const [fullReady, setFullReady]   = useState(false); // museum full image finished loading
  const [zoomOpen, setZoomOpen]     = useState(false); // OpenSeadragon IIIF viewer open
  const [aiActive, setAiActive]     = useState(false); // showing AI-search results (no museum selected)
  const [aiQuery, setAiQuery]       = useState('');
  const [artistQuery, setArtistQuery] = useState(''); // dedicated "search by artist" box
  const [aiSearching, setAiSearching] = useState(false);
  const [aiInfo, setAiInfo]         = useState(null);  // { description, mood } from the AI
  const [liveWorks, setLiveWorks]   = useState([]);    // live museum-API results
  const [liveLoading, setLiveLoading] = useState(false);
  const [addingLive, setAddingLive] = useState(null);  // id of a live work being added to catalog
  const osdRef  = useRef(null);
  const osdInst = useRef(null);
  const gate = useShopGate();

  // --- checkout (shared CheckoutSheet) ---
  const [checkout, setCheckout] = useState(null);  // { product, art } when the sheet is open

  // Local cart (UI only, localStorage-persisted). Items check out one at a time
  // via the existing single-item CheckoutSheet — no multi-item payment backend.
  const [cart, setCart] = useState([]);
  const [cartOpen, setCartOpen] = useState(false);
  useEffect(() => { try { const s = JSON.parse(localStorage.getItem('pac_cart') || '[]'); if (Array.isArray(s)) setCart(s); } catch (e) {} }, []);
  useEffect(() => { try { localStorage.setItem('pac_cart', JSON.stringify(cart)); } catch (e) {} }, [cart]);
  const cartKey = (art, product) => `${art?.id}::${product?.name}`;
  const addToCart = (art, product = PRODUCTS[0]) => {
    setCart(prev => prev.some(it => cartKey(it.art, it.product) === cartKey(art, product)) ? prev : [...prev, { art, product }]);
    setCartOpen(true);
  };
  const removeFromCart = key => setCart(prev => prev.filter(it => cartKey(it.art, it.product) !== key));

  // Fire a journey event (fire-and-forget) to /api/ghl-event for artwork views.
  // Identity comes from a stored identity captured at a prior checkout; events
  // with no known email/phone are skipped. (Checkout-step events — order_started,
  // cart_started/abandoned, order_completed — are emitted by CheckoutSheet.)
  const trackGHL = (event, extra = {}) => {
    try {
      const id = loadIdentity() || {};
      const email = id.email || '';
      const phone = id.phone || '';
      if (!email && !phone) return;
      const payload = JSON.stringify({ email, phone, event, ...extra });
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        navigator.sendBeacon('/api/ghl-event', new Blob([payload], { type: 'application/json' }));
      } else {
        fetch('/api/ghl-event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true }).catch(() => {});
      }
    } catch (e) {}
  };

  useEffect(() => {
    document.title = 'World Museum Viewer — Public Art Collections';
    fetch('/api/artworks?count=true').then(r => r.json()).then(d => setTotalDb(d.total));
    fetch('/api/artworks?sourceCounts=1').then(r => r.json()).then(d => setMuseumCounts(d.counts || {})).catch(() => {});
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
    // When the pixel resolves an identity, forward whatever it actually exposes
    // (plus URL attribution) to our tracker. Best-effort + defensive: if the
    // pixel has no client identity API, nothing is sent (no fabricated data).
    const forwardEnrichment = () => {
      try {
        const AL = window.AudienceLab || {};
        try { AL.identify && AL.identify({ page: window.location.href }); } catch (e) {}
        const id = (typeof AL.getIdentity === 'function' && AL.getIdentity()) || AL.identity || window.AudienceLabIdentity || null;
        const q = new URLSearchParams(window.location.search);
        const hasAttr = q.get('utm_source') || q.get('gt_id') || q.get('gt_campaign');
        if (!id && !hasAttr) return;
        const nm = id && (id.name || [id.firstName, id.lastName].filter(Boolean).join(' ')) || undefined;
        const payload = {
          audiencelab_id: id?.id, audiencelab_email: id?.email, audiencelab_phone: id?.phone, audiencelab_name: nm,
          audiencelab_age_range: id?.ageRange || id?.age_range, audiencelab_gender: id?.gender,
          audiencelab_income: id?.householdIncome || id?.income, audiencelab_homeowner: id?.homeowner,
          audiencelab_net_worth: id?.netWorth || id?.net_worth, audiencelab_education: id?.education,
          audiencelab_occupation: id?.occupation, audiencelab_marital_status: id?.maritalStatus || id?.marital_status,
          audiencelab_children: id?.children, audiencelab_interests: id?.interests || undefined, audiencelab_raw: id || undefined,
          groundtruth_id: q.get('gt_id') || undefined, groundtruth_campaign: q.get('gt_campaign') || q.get('utm_campaign') || undefined,
          groundtruth_ad_group: q.get('gt_adgroup') || undefined, groundtruth_creative: q.get('gt_creative') || undefined,
          groundtruth_location: q.get('gt_location') || undefined, groundtruth_venue_type: q.get('gt_venue') || undefined,
          utm_source: q.get('utm_source') || undefined, utm_medium: q.get('utm_medium') || undefined, utm_campaign: q.get('utm_campaign') || undefined,
          utm_content: q.get('utm_content') || undefined, utm_term: q.get('utm_term') || undefined,
          referrer: document.referrer, landing_page: window.location.href,
          source: q.get('utm_source') || (document.referrer ? new URL(document.referrer).hostname : 'direct'),
        };
        // Only send if we have an identifier the server can key on.
        if (!payload.audiencelab_id && !payload.audiencelab_email) {
          const { email, phone } = loadIdentity() || {};
          if (email) payload.email = email;
          if (phone) payload.phone = phone;
          if (!payload.email && !payload.phone) return; // anonymous → nothing to store
        }
        fetch('/api/track', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), keepalive: true }).catch(() => {});
      } catch (e) {}
    };
    s.onload = () => { forwardEnrichment(); setTimeout(forwardEnrichment, 2500); };
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
      if (museum.warMuseums) {
        url += `&warmuseums=1`;
        if (genreFilter?.search) url += `&search=${encodeURIComponent(genreFilter.search)}`;
      } else if (museum.searchMode) {
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

  // Infinite scroll: when the bottom sentinel nears the viewport, auto-append the
  // next page (browse/search-tile mode only; AI results are a fixed set).
  const infiniteRef = useRef(null);
  useEffect(() => {
    const el = infiniteRef.current;
    if (!el || aiActive || !selected || !hasMore) return;
    const io = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && !loading) {
        loadWorks(selected, genre, sortOrder, works.length, true);
      }
    }, { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, [aiActive, selected, hasMore, loading, works.length, genre, sortOrder, loadWorks]);

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
    setLiveWorks([]);
    setHasMore(false);
    setNavOpen(false);
    try {
      const d = await fetch('/api/ai-search?query=' + encodeURIComponent(query)).then(r => r.json());
      setWorks(d.works || []);
      setAiInfo({ description: d.ai_description || '', mood: d.ai_mood || '' });
    } catch (e) { console.error('AI search error:', e); }
    setAiSearching(false);

    // Live museum-API results stream in separately (non-blocking) so the DB
    // results above render instantly. View-only — they link out to the museum.
    setLiveLoading(true);
    fetch('/api/ai-search-live?query=' + encodeURIComponent(query))
      .then(r => r.json())
      .then(d => setLiveWorks(Array.isArray(d.works) ? d.works : []))
      .catch(() => {})
      .finally(() => setLiveLoading(false));
  };

  // Cross-museum "by artist" study search: our catalog (direct artist match) PLUS
  // live results from every connected museum API (mode=artist), shown in the same
  // aiActive viewer. Live results are view-only until added to the catalog.
  const doArtistSearch = async (artist) => {
    const name = (artist || '').trim();
    if (!name || name === 'Unknown') return;
    setAiSearching(true); setAiInfo(null); setSelected(null); setModal(null);
    setGenre(GENRES[0]); setAiActive(true); setAiQuery(name);
    setWorks([]); setLiveWorks([]); setHasMore(false); setNavOpen(false);
    try {
      const d = await fetch('/api/artworks?limit=48&search=' + encodeURIComponent(name)).then(r => r.json());
      setWorks(d.works || []);
      setAiInfo({ description: `Works by “${name}” — from our collection and live across museums.`, mood: '' });
    } catch (e) { console.error('artist search error:', e); }
    setAiSearching(false);
    setLiveLoading(true);
    fetch('/api/ai-search-live?query=' + encodeURIComponent(name) + '&mode=artist')
      .then(r => r.json())
      .then(d => setLiveWorks(Array.isArray(d.works) ? d.works : []))
      .catch(() => {})
      .finally(() => setLiveLoading(false));
  };

  // Promote a live museum result into the catalog, then open it in the order
  // modal (same flow as any DB work). Adding is free; ordering stays tier-gated.
  const addLiveToCatalog = async (w) => {
    if (addingLive) return;
    setAddingLive(w.id);
    try {
      const d = await fetch('/api/add-to-catalog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(w),
      }).then(r => r.json());
      if (d.ok && d.work) {
        setModal(d.work);
        trackGHL('artwork_view', { artwork: d.work.title, museum: d.work.source });
      } else {
        alert(d.error || 'Could not add this work.');
      }
    } catch (e) {
      alert('Could not add this work.');
    } finally {
      setAddingLive(null);
    }
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
    if (selected.warMuseums) url += `&warmuseums=1&search=${encodeURIComponent(q)}`;
    else if (selected.searchMode) url += `&search=${encodeURIComponent(selected.source + ' ' + q)}`;
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
            {REGIONS.map(r => {
              // Hide museums with no works yet (searchMode/live sources always shown);
              // drop a whole region if nothing in it is populated. Self-heals as syncs land.
              const ms = r.museums.filter(m => m.searchMode || !museumCounts || (museumCounts[m.source] || 0) > 0);
              if (!ms.length) return null;
              return (
                <div key={r.region}>
                  <div className="region-label">{r.region}</div>
                  {ms.map(m => (
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
              );
            })}
          </div>
        </aside>
        {navOpen && <div className="sidebar-backdrop" onClick={() => setNavOpen(false)} />}

        {/* MAIN */}
        <div className="main">

          {/* GIVING BANNER — prominent */}
          <a href="/pricing" style={{ display: 'block', textDecoration: 'none', background: 'linear-gradient(90deg,#1A1714 0%,#2C2318 100%)', color: '#F0EAD8', textAlign: 'center', padding: '18px 20px', borderBottom: '2px solid #B8942A', flexShrink: 0 }}>
            <div style={{ fontSize: 24, marginBottom: 4 }}>🎨</div>
            <div style={{ fontFamily: 'Georgia,serif', fontSize: 'clamp(16px,2.4vw,23px)', fontWeight: 400, lineHeight: 1.25, maxWidth: 760, margin: '0 auto' }}>
              <strong style={{ color: '#B8942A' }}>35% of every membership</strong> supports arts education for children in Asheville &amp; Buncombe County, NC
            </div>
            <div style={{ fontSize: 11, color: '#B0A898', marginTop: 8, textTransform: 'uppercase', letterSpacing: '.16em' }}>
              Become a member → every plan gives back
            </div>
          </a>

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
                Search
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
            <AuthNav />
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
                  {o.label}
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
                  placeholder="The curator's search — mood, colour, era, style… e.g. “blue melancholy landscapes”"
                  style={{ flex: 1, padding: '10px 14px', border: '1px solid var(--line)', borderRadius: 'var(--radius)', fontSize: 14, background: 'var(--paper)', color: 'var(--ink)', outline: 'none', minHeight: 44, fontFamily: 'var(--sans)' }}
                />
                <button onClick={() => doAISearch()} disabled={aiSearching}
                  style={{ background: 'var(--gold)', color: 'var(--ivory)', border: 'none', padding: '0 20px', borderRadius: 'var(--radius)', fontSize: 11, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap', minHeight: 44, fontFamily: 'var(--sans)' }}>
                  {aiSearching ? 'Searching…' : 'Search'}
                </button>
              </div>
              {/* SEARCH BY ARTIST — our catalog + live across every connected museum */}
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <input
                  value={artistQuery}
                  onChange={e => setArtistQuery(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && doArtistSearch(artistQuery)}
                  placeholder="Search by artist — e.g. “Rembrandt”, “Monet”, “Hokusai” (across all museums, live)"
                  style={{ flex: 1, padding: '10px 14px', border: '1px solid var(--line)', borderRadius: 'var(--radius)', fontSize: 14, background: 'var(--paper)', color: 'var(--ink)', outline: 'none', minHeight: 44, fontFamily: 'var(--sans)' }}
                />
                <button onClick={() => doArtistSearch(artistQuery)} disabled={aiSearching}
                  style={{ background: 'var(--ink)', color: 'var(--ivory)', border: 'none', padding: '0 20px', borderRadius: 'var(--radius)', fontSize: 11, fontWeight: 600, letterSpacing: '.12em', textTransform: 'uppercase', cursor: 'pointer', whiteSpace: 'nowrap', minHeight: 44, fontFamily: 'var(--sans)' }}>
                  By Artist
                </button>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                {['Rembrandt', 'Monet', 'Van Gogh', 'Hokusai', 'Vermeer', 'Degas', 'Turner', 'Klimt', 'Cézanne', 'Goya'].map(a => (
                  <button key={a} onClick={() => { setArtistQuery(a); doArtistSearch(a); }}
                    style={{ padding: '5px 14px', borderRadius: 'var(--radius)', fontSize: 11, letterSpacing: '.04em', cursor: 'pointer', border: '1px solid var(--line)', background: 'transparent', color: 'var(--ink-soft)', fontFamily: 'var(--sans)' }}>
                    {a}
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                {['blue and melancholy', 'powerful women', 'Japanese nature', 'Dutch golden age', 'war and suffering', 'impressionist light'].map(s => (
                  <button key={s} onClick={() => { setAiQuery(s); doAISearch(s); }}
                    style={{ padding: '5px 14px', borderRadius: 'var(--radius)', fontSize: 11, letterSpacing: '.04em', cursor: 'pointer', border: '1px solid var(--line)', background: 'transparent', color: 'var(--muted-solid)', fontFamily: 'var(--sans)' }}>
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {aiActive && aiInfo?.description && (
              <div style={{ marginBottom: 12, padding: '12px 14px', background: 'var(--parchment)', borderRadius: 'var(--radius)', border: '1px solid var(--line-soft)', borderLeft: '2px solid var(--gold)' }}>
                <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '.16em', color: 'var(--gold)', marginBottom: 5, fontWeight: 600 }}>Curator's interpretation</div>
                <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.55 }}>{aiInfo.description}</div>
                {aiInfo.mood && <div style={{ fontSize: 11, color: 'var(--muted-solid)', marginTop: 4 }}>Mood: {aiInfo.mood}</div>}
              </div>
            )}

            {(!selected && !aiActive) ? (
              <div className="empty">
                <div className="empty-icon">—</div>
                <div className="empty-title">World Museums</div>
                <div className="empty-sub">
                  Select a museum from the sidebar, or use the curator's search above.
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
                <div className="empty-icon">—</div>
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
                    <div key={w.id} className="art-card" onClick={() => { setModal(w); trackGHL('artwork_view', { artwork: w.title, museum: w.source }); }}>
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
                          <div className="card-ph">—</div>
                        )}
                        <div className="card-hover-overlay">
                          <span className="card-hover-label">View &amp; Order →</span>
                        </div>
                        <button
                          className="card-quick-order"
                          title="Order a print of this work"
                          onClick={e => { e.stopPropagation(); setCheckout({ product: PRODUCTS[0], art: w }); }}
                        >
                          Order print — {PRODUCTS[0].price}
                        </button>
                        <button
                          className="card-add-cart"
                          title="Add to cart"
                          onClick={e => { e.stopPropagation(); addToCart(w); }}
                        >＋</button>
                      </div>
                      <div className="card-info">
                        <div className="card-source">{fmt(w.source)}</div>
                        <div className="card-title">{w.title}</div>
                        <div className="card-artist"
                          onClick={w.artist && w.artist !== 'Unknown' ? (e => { e.stopPropagation(); doArtistSearch(w.artist); }) : undefined}
                          style={{ cursor: w.artist && w.artist !== 'Unknown' ? 'pointer' : 'default' }}
                          title={w.artist && w.artist !== 'Unknown' ? `More by ${w.artist}` : ''}>
                          {w.artist || 'Unknown'}
                        </div>
                        {w.date_text && <div className="card-date">{w.date_text}</div>}
                      </div>
                    </div>
                  ))}
                </div>

                {aiActive && (liveLoading || liveWorks.length > 0) && (
                  <div className="live-section">
                    <div className="live-head">
                      {liveLoading
                        ? 'Searching museums live…'
                        : `Also found live from museums (${liveWorks.length}) — click to add to the catalog & order`}
                    </div>
                    <div className="art-grid">
                      {liveWorks.map(w => (
                        <div key={w.id} className="art-card" onClick={() => addLiveToCatalog(w)} title="Add to catalog & order">
                          <div className="card-img">
                            {w.thumb_url ? (
                              <img
                                src={getThumbUrl(w.thumb_url)}
                                alt={w.title}
                                loading="lazy"
                                style={{ opacity: 0, transition: 'opacity .35s ease' }}
                                onLoad={e => { e.currentTarget.style.opacity = 1; }}
                                onError={e => { e.currentTarget.style.display = 'none'; }}
                              />
                            ) : (<div className="card-ph">—</div>)}
                            <div className="live-badge">Live · {w.live_source}</div>
                            <div className="card-hover-overlay">
                              <span className="card-hover-label">{addingLive === w.id ? 'Adding…' : '+ Add & Order →'}</span>
                            </div>
                            {addingLive === w.id && <div className="live-adding">Adding…</div>}
                          </div>
                          <div className="card-info">
                            <div className="card-source">{w.live_source}</div>
                            <div className="card-title">{w.title}</div>
                            <div className="card-artist">{w.artist || 'Unknown'}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {loading && works.length > 0 && (
                  <div className="load-spinner"><span className="spinner" />Loading more works…</div>
                )}
                {hasMore && !aiActive && <div ref={infiniteRef} className="scroll-sentinel" aria-hidden="true" />}
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
                <div className="modal-img-ph">—</div>
              )}
              {modal.iiif_info && !zoomOpen && (
                <button className="zoom-btn" onClick={() => setZoomOpen(true)}>Gigapixel zoom</button>
              )}
            </div>
            <div className="modal-detail">
              <div className="modal-source">{fmt(modal.source)}</div>
              <div className="modal-title">{modal.title}</div>
              <div className="modal-artist">
                {[modal.artist, modal.date_text].filter(Boolean).join(' · ') || 'Unknown artist'}
              </div>
              {modal.artist && modal.artist !== 'Unknown' && (
                <button onClick={() => doArtistSearch(modal.artist)}
                  style={{ alignSelf: 'flex-start', background: 'none', border: 'none', color: 'var(--gold)', fontSize: 12, cursor: 'pointer', padding: 0, fontFamily: 'inherit' }}>
                  → More by {modal.artist} across museums
                </button>
              )}
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
                        onClick={() => setCheckout({ product: p, art: modal })}
                      >
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
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CHECKOUT — shared in-place sheet (Stripe or no-charge draft) */}
      {/* FLOATING CART */}
      <button className="cart-fab" onClick={() => setCartOpen(o => !o)} aria-label={`Cart (${cart.length})`}>
        🛒{cart.length > 0 && <span className="cart-fab-count">{cart.length}</span>}
      </button>
      {cartOpen && (
        <>
          <div className="cart-backdrop" onClick={() => setCartOpen(false)} />
          <div className="cart-drawer" role="dialog" aria-label="Cart">
            <div className="cart-drawer-head">
              <span>Your Cart ({cart.length})</span>
              <button onClick={() => setCartOpen(false)} aria-label="Close cart">×</button>
            </div>
            <div className="cart-drawer-body">
              {cart.length === 0 && (
                <div className="cart-empty">Your cart is empty.<br />Hover any artwork and press ＋ to add it.</div>
              )}
              {cart.map(it => {
                const k = cartKey(it.art, it.product);
                return (
                  <div key={k} className="cart-line">
                    {it.art?.thumb_url && <img src={getThumbUrl(it.art.thumb_url)} alt="" />}
                    <div className="cart-line-info">
                      <div className="cart-line-title">{it.art?.title || 'Artwork'}</div>
                      <div className="cart-line-sub">{it.product?.name} · {it.product?.price}</div>
                    </div>
                    <div className="cart-line-actions">
                      <button className="cart-order-btn" onClick={() => { setCheckout({ product: it.product, art: it.art }); setCartOpen(false); }}>Order</button>
                      <button className="cart-remove-btn" title="Remove" onClick={() => removeFromCart(k)}>×</button>
                    </div>
                  </div>
                );
              })}
            </div>
            {cart.length > 0 && (
              <div className="cart-drawer-foot">
                <button className="cart-clear" onClick={() => setCart([])}>Clear cart</button>
                <div className="cart-note">Items check out individually — click Order on each.</div>
              </div>
            )}
          </div>
        </>
      )}

      <CheckoutSheet
        checkout={checkout}
        onClose={() => setCheckout(null)}
        onOrdered={(art, product) => removeFromCart(cartKey(art, product))}
      />

      {/* PIN MODAL — trade access */}
      <PinModal gate={gate} />

      {/* LEAD CAPTURE POPUP — appears after 8s */}
      <LeadPopup />
    </>
  );
}
