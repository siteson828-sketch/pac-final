import { useState, useEffect, useCallback } from 'react';
import { useShopGate, PinModal, TradeAccessPanel } from '../lib/useShopGate';
import AuthNav from '../components/AuthNav';
import LeadPopup from '../components/LeadPopup';
import CheckoutSheet, { PRODUCTS } from '../components/CheckoutSheet';

// `ai: true` routes a chip through the AI search (Claude term expansion + quality
// gating). Two reasons a chip needs it:
//  - art-movement names ("impressionism", "baroque") almost never appear literally
//    in title/artist/medium — a plain ILIKE returns ~nothing.
//  - "photography" matches literally but floods with archival/documentary scans
//    (LoC/Smithsonian archives, Digital Commonwealth, Internet Archive) where
//    "photograph" is just the medium; the AI path penalizes those sources and
//    boosts fine-art museums, so results are actual art photography.
// Only the "All" chip uses the plain feed; every themed chip routes through the
// AI search so results are quality-gated (fine-art museums boosted, Internet
// Archive excluded, Digital Commonwealth documents penalized) and paginated.
const COLLECTIONS = [
  { label: 'All',           search: '',                    source: '' },
  { label: 'Impressionism', search: 'impressionism',       source: '', ai: true },
  { label: 'Baroque',       search: 'baroque art',         source: '', ai: true,
    artists: 'Caravaggio,Rubens,Rembrandt,Vermeer,Velázquez,Velazquez,Van Dyck,Frans Hals,Poussin,Claude Lorrain,Guido Reni,Guercino,Ribera,Zurbarán,Murillo,Gentileschi,La Tour,Carracci,Domenichino,Jan Steen' },
  { label: 'Renaissance',   search: 'renaissance art',      source: '', ai: true,
    // Tight fit: gate on genuine Renaissance masters (by artist), not loose terms.
    artists: 'Leonardo,Raphael,Michelangelo,Titian,Botticelli,Dürer,Durer,Bellini,Mantegna,Giorgione,del Sarto,Veronese,Tintoretto,Correggio,Bronzino,Ghirlandaio,Fra Angelico,Piero della Francesca,van Eyck,Memling,Holbein,Cranach,Perugino,Carpaccio,Pontormo,Parmigianino,Raffaello' },
  { label: 'Modern Art',    search: 'modern art',          source: '', ai: true,
    // Post-impressionist / early-modern masters (the PD-era slice of "modern").
    artists: 'Cézanne,Cezanne,Van Gogh,Gauguin,Seurat,Signac,Toulouse-Lautrec,Munch,Klimt,Schiele,Matisse,Picasso,Kandinsky,Modigliani,Mondrian,Paul Klee,Kirchner,Bonnard,Vuillard,Redon,Ensor' },
  { label: 'Photography',   search: 'fine art photography', source: '', ai: true,
    // Tight fit: require a photographic medium/title; drop paintings, prints, etc.
    must: 'photograph,photography,photographic,daguerreotype,ambrotype,albumen,tintype,gelatin silver,cyanotype,collodion,photogravure',
    exclude: 'painting,oil on,watercolor,engraving,etching,lithograph,woodcut,drawing,sculpture,tapestry,porcelain,ceramic,furniture,fresco,textile,correspondence,typescript,holograph,manuscript,document' },
  { label: 'Portraits',     search: 'portrait',            source: '', ai: true },
  { label: 'Landscapes',    search: 'landscape painting',   source: '', ai: true },
  { label: 'American Art',  search: 'american art',         source: '', ai: true,
    artists: 'Winslow Homer,Sargent,Whistler,Cassatt,Eakins,Hopper,Copley,Peale,Gilbert Stuart,Bierstadt,Frederic Edwin Church,Thomas Cole,Georgia O,Remington,Hassam,William Merritt Chase,Inness,Sully' },
  { label: 'Asian Art',     search: 'japanese woodblock ukiyo-e', source: '', ai: true,
    // Genuine Asian art (mostly Japanese ukiyo-e masters), not Western works about Asia.
    artists: 'Hokusai,Hiroshige,Utamaro,Kuniyoshi,Kunisada,Toyokuni,Yoshitoshi,Sharaku,Harunobu,Kiyonaga,Shunsho,Hasui,Yoshida,Sesshu,Eishi,Koryusai,Kunichika,Chikanobu' },
  { label: 'Still Life',    search: 'still life',           source: '', ai: true },
  { label: 'Mythology',     search: 'mythology',            source: '', ai: true },
];

const MUSEUMS = [
  { key: 'Metropolitan Museum of Art',      label: 'Met Museum' },
  { key: 'Art Institute of Chicago',        label: 'Art Inst. Chicago' },
  { key: 'Cleveland Museum of Art',         label: 'Cleveland' },
  { key: 'Victoria & Albert Museum',        label: 'V&A Museum' },
  { key: 'Rijksmuseum',                     label: 'Rijksmuseum' },
  { key: 'SMK National Gallery of Denmark', label: 'SMK Denmark' },
  { key: 'Cooper Hewitt, Smithsonian Design Museum',                     label: 'Cooper Hewitt' },
  { key: 'Smithsonian American Art Museum',                              label: 'Smithsonian Art' },
  { key: 'National Portrait Gallery',                                    label: 'Nat. Portrait Gallery' },
  { key: 'National Museum of African American History and Culture',      label: 'African American Hist.' },
  { key: 'National Museum of American History',                          label: 'Amer. History' },
  { key: 'National Museum of Asian Art',                                 label: 'Asian Art (Freer|Sackler)' },
  { key: 'National Postal Museum',                                       label: 'Postal Museum' },
  { key: 'Harvard Art Museums',             label: 'Harvard' },
  { key: 'Getty Museum',                    label: 'Getty' },
  { key: 'Louvre',                          label: 'Louvre' },
  { key: 'British Museum',                  label: 'British Museum' },
  { key: 'National Gallery',                label: 'National Gallery' },
  { key: 'Prado',                           label: 'Prado' },
  { key: 'Uffizi',                          label: 'Uffizi' },
  { key: 'Hermitage',                       label: 'Hermitage' },
  { key: 'Library of Congress',             label: 'Lib. of Congress' },
  { key: 'Wikimedia Commons',               label: 'Wikimedia' },
  { key: 'Internet Archive',                label: 'Internet Archive' },
];

function fmt(s) {
  return (s || '')
    .replace('Metropolitan Museum of Art', 'Met')
    .replace('Art Institute of Chicago', 'Art Inst. Chicago')
    .replace('Victoria & Albert Museum', 'V&A')
    .replace('Smithsonian Institution', 'Smithsonian')
    .replace(/^Europeana — /, '')
    .split(',')[0];
}

// Faster grid thumbnails (kept in sync with pages/viewer.js):
//  1) Shrink at the source (direct) where a size knob exists.
//  2) Edge-cache dominant, server-fetchable sources via the hardened /api/img
//     proxy (exempted from the 100/min firewall limit by the "RL img" rule).
//  3) Everything else loads direct — notably Europeana/DPLA (arbitrary hosts the
//     proxy can't whitelist) and Smithsonian (WAF blocks server-side fetches).
const PROXY_HOSTS = new Set([
  'bpldcassets.blob.core.windows.net', // Digital Commonwealth
  'openaccess-cdn.clevelandart.org',   // Cleveland
  'images.metmuseum.org',              // Met
]);
function getThumbUrl(url) {
  if (!url) return '';
  if (url.includes('/full/!400,400/')) return url.replace('/full/!400,400/', '/full/!300,300/'); // IIIF
  if (url.includes('commons.wikimedia.org') && /[?&]width=\d+/.test(url)) return url.replace(/width=\d+/, 'width=300'); // Wikimedia/Wikidata
  if (url.includes('ids.si.edu/ids/deliveryService')) return url + (url.includes('?') ? '&' : '?') + 'max=300'; // Smithsonian (direct)
  try {
    if (PROXY_HOSTS.has(new URL(url).hostname)) return '/api/img?url=' + encodeURIComponent(url);
  } catch (e) {}
  return url;
}

function timeAgo(iso) {
  if (!iso) return null;
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function abbr(n) {
  if (!n) return '0';
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(n);
}

const CSS = `
/* Fonts + palette tokens are defined in styles/globals.css (shared system).
   This block styles the homepage in the Neoclassical Museum aesthetic. */

/* NAV */
.nav{position:sticky;top:0;z-index:100;background:rgba(250,248,244,0.94);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-bottom:1px solid var(--line);height:68px;display:flex;align-items:center;gap:20px;padding:0 36px}
.nav-logo{font-family:var(--serif);font-size:23px;font-weight:500;text-decoration:none;color:var(--ink);white-space:nowrap;flex-shrink:0;letter-spacing:.02em}
.nav-logo span{color:var(--gold);font-style:italic}
.nav-search{flex:1;max-width:520px;display:flex;gap:10px}
.nav-input{flex:1;padding:9px 14px;border:1px solid var(--line);border-radius:var(--radius);font-size:13px;background:var(--paper);outline:none;font-family:var(--sans);color:var(--ink);transition:border-color .2s var(--ease),box-shadow .2s var(--ease)}
.nav-input::placeholder{color:var(--muted-solid)}
.nav-input:focus{border-color:var(--gold);box-shadow:0 0 0 3px rgba(156,124,56,0.12)}
.nav-count{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--muted-solid);white-space:nowrap;flex-shrink:0;margin-left:auto}
.btn{display:inline-flex;align-items:center;justify-content:center;padding:9px 18px;border-radius:var(--radius);font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;cursor:pointer;border:1px solid var(--line);color:var(--ink);background:transparent;font-family:var(--sans);transition:background .2s var(--ease),border-color .2s var(--ease),color .2s var(--ease);white-space:nowrap;text-decoration:none}
.btn:hover{background:rgba(26,23,20,0.04);border-color:var(--ink)}
.btn-dark{background:var(--ink);color:var(--ivory);border-color:var(--ink)}
.btn-dark:hover{background:var(--charcoal-2);color:var(--ivory)}
.btn-icon{padding:9px 12px;font-size:15px;line-height:1;letter-spacing:0}
.nav-link{font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-soft);text-decoration:none;white-space:nowrap;flex-shrink:0;transition:color .2s var(--ease)}
.nav-link:hover{color:var(--gold)}

/* ORDER BANNER */
.order-banner{background:var(--charcoal);color:#EDE7DA;padding:16px 36px;display:flex;align-items:center;gap:18px;flex-wrap:wrap;border-bottom:1px solid var(--gold)}
.order-banner-img{width:54px;height:54px;object-fit:cover;border-radius:var(--radius);flex-shrink:0;background:#3A3028;border:1px solid rgba(237,231,218,0.18)}
.order-banner-info{flex:1;min-width:0}
.order-banner-label{font-size:9px;text-transform:uppercase;letter-spacing:.2em;color:var(--gold);margin-bottom:4px;font-weight:600}
.order-banner-work{font-family:var(--serif);font-size:18px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.order-banner-prod{font-size:11px;color:#B0A898;margin-top:3px;letter-spacing:.02em}
.order-banner-actions{display:flex;align-items:center;gap:12px;flex-shrink:0}
.order-qty{display:flex;align-items:center;gap:8px;font-size:13px}
.order-qty button{width:28px;height:28px;border-radius:50%;border:1px solid rgba(237,231,218,0.3);background:transparent;color:#EDE7DA;cursor:pointer;font-size:16px;line-height:1;display:flex;align-items:center;justify-content:center;transition:background .2s var(--ease)}
.order-qty button:hover{background:rgba(237,231,218,0.1)}
.order-confirm{padding:10px 22px;background:var(--gold);color:var(--ivory);border:none;border-radius:var(--radius);font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;cursor:pointer;font-family:var(--sans);white-space:nowrap;transition:background .2s var(--ease)}
.order-confirm:hover{background:var(--gold-bright)}
.order-dismiss{background:none;border:none;color:#6A6058;font-size:22px;cursor:pointer;line-height:1;padding:4px;transition:color .2s var(--ease);flex-shrink:0}
.order-dismiss:hover{color:#EDE7DA}

/* HERO */
.hero{position:relative;height:560px;overflow:hidden;background:var(--charcoal)}
.hero-mosaic{position:absolute;inset:0;display:grid;grid-template-columns:repeat(6,1fr);grid-auto-rows:50%}
.hero-mosaic img{width:100%;height:100%;object-fit:cover;display:block;filter:saturate(0.92) brightness(0.94)}
.hero-gradient{position:absolute;inset:0;background:linear-gradient(180deg,rgba(20,17,14,0.55) 0%,rgba(20,17,14,0.35) 32%,rgba(20,17,14,0.72) 78%,rgba(20,17,14,0.94) 100%)}
.hero-frame{position:absolute;inset:22px;border:1px solid rgba(240,234,216,0.28);pointer-events:none;z-index:2}
.hero-content{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:56px;z-index:3}
.hero-eyebrow{font-size:10px;text-transform:uppercase;letter-spacing:.32em;color:var(--gold);margin-bottom:22px;font-weight:600}
.hero-title{font-family:var(--serif);font-size:clamp(42px,6vw,84px);font-weight:400;line-height:1.02;color:#F5F1E8;margin-bottom:20px;letter-spacing:.01em}
.hero-title em{font-style:italic;color:var(--gold-bright)}
.hero-ornament{display:flex;align-items:center;gap:16px;color:rgba(240,234,216,0.65);font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.26em;margin-bottom:26px}
.hero-ornament::before,.hero-ornament::after{content:'';width:56px;height:1px;background:rgba(240,234,216,0.4)}
.hero-sub{font-size:14px;color:rgba(240,234,216,0.72);margin-bottom:34px;max-width:500px;line-height:1.8}
.hero-actions{display:flex;gap:14px;flex-wrap:wrap;justify-content:center}
.hero-btn{padding:13px 30px;font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;border-radius:var(--radius);cursor:pointer;font-family:var(--sans);transition:all .22s var(--ease);text-decoration:none;border:1px solid transparent}
.hero-btn-light{background:var(--ivory);color:var(--ink)}
.hero-btn-light:hover{background:#EDE8DF}
.hero-btn-outline{background:transparent;color:#F3EFE8;border-color:rgba(240,234,216,0.5)}
.hero-btn-outline:hover{background:rgba(240,234,216,0.1);border-color:rgba(240,234,216,0.85)}
.hero-caption{position:absolute;bottom:34px;right:44px;font-size:10px;color:rgba(240,234,216,0.45);text-align:right;max-width:260px;line-height:1.6;z-index:3;letter-spacing:.04em}
.hero-caption strong{display:block;font-family:var(--serif);font-size:15px;font-weight:400;font-style:italic;color:rgba(240,234,216,0.78);margin-bottom:2px}

/* SEARCH SECTION (AI + artist) */
.search-sec{max-width:720px;margin:0 auto;padding:48px 20px 8px}
.search-head{text-align:center;margin-bottom:22px}
.search-head .eyebrow{margin-bottom:10px;display:block}
.search-head p{font-family:var(--serif);font-size:22px;font-weight:400;font-style:italic;color:var(--ink-soft)}
.search-row{display:flex;gap:10px;margin-bottom:12px}
.search-input{flex:1;background:var(--paper);border:1px solid var(--line);border-radius:var(--radius);padding:13px 16px;color:var(--ink);font-size:13px;font-family:var(--sans);outline:none;transition:border-color .2s var(--ease),box-shadow .2s var(--ease)}
.search-input::placeholder{color:var(--muted-solid)}
.search-input:focus{border-color:var(--gold);box-shadow:0 0 0 3px rgba(156,124,56,0.12)}
.search-submit{border:none;padding:13px 24px;border-radius:var(--radius);font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;cursor:pointer;white-space:nowrap;font-family:var(--sans);transition:background .2s var(--ease),opacity .2s}
.search-submit--gold{background:var(--gold);color:var(--ivory)}
.search-submit--gold:hover{background:var(--gold-bright)}
.search-submit--ink{background:var(--ink);color:var(--ivory)}
.search-submit--ink:hover{background:var(--charcoal-2)}
.search-submit:disabled{opacity:.55;cursor:default}
.chip-row{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-bottom:10px}
.taste-chip{padding:5px 14px;border-radius:var(--radius);font-size:11px;letter-spacing:.04em;cursor:pointer;border:1px solid var(--line);background:transparent;color:var(--ink-soft);font-family:var(--sans);transition:all .2s var(--ease)}
.taste-chip:hover{border-color:var(--gold);color:var(--gold);background:rgba(156,124,56,0.05)}
.ai-note{margin-top:14px;padding:12px 16px;background:var(--parchment);border-radius:var(--radius);border:1px solid var(--line-soft);border-left:2px solid var(--gold);font-size:12px;color:var(--ink-soft);line-height:1.6}
.ai-note b{color:var(--gold);font-weight:600;text-transform:uppercase;letter-spacing:.1em;font-size:10px}

/* COLLECTION BAR — uniform classical chips */
.coll-bar{background:var(--ivory);border-top:1px solid var(--line-soft);border-bottom:1px solid var(--line);padding:16px 28px;display:flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:10px;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none}
.coll-bar::-webkit-scrollbar{display:none}
.coll-chip{padding:8px 18px;font-size:10px;font-weight:600;letter-spacing:.16em;text-transform:uppercase;color:var(--ink-soft);cursor:pointer;background:transparent;border:1px solid var(--line);border-radius:var(--radius);white-space:nowrap;transition:all .2s var(--ease);font-family:var(--sans);flex-shrink:0}
.coll-chip:hover{border-color:var(--gold);color:var(--gold)}
.coll-chip.active{background:var(--ink);color:var(--ivory);border-color:var(--ink)}

/* MUSEUM BAR */
.museum-bar{background:var(--parchment);border-bottom:1px solid var(--line-soft);padding:0 36px;display:flex;align-items:stretch;justify-content:center;overflow-x:auto;scrollbar-width:none;gap:0}
.museum-bar::-webkit-scrollbar{display:none}
.museum-chip{padding:12px 16px;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--muted-solid);cursor:pointer;background:none;border:none;white-space:nowrap;font-family:var(--sans);flex-shrink:0;border-bottom:2px solid transparent;transition:color .2s var(--ease),border-color .2s var(--ease)}
.museum-chip:hover{color:var(--ink)}
.museum-chip.active{color:var(--ink);border-bottom-color:var(--gold);font-weight:600}

/* GALLERY HEADER */
.gallery-header{max-width:1360px;margin:0 auto;padding:44px 36px 0;display:flex;align-items:baseline;justify-content:space-between;flex-wrap:wrap;gap:12px}
.gallery-title{font-family:var(--serif);font-size:34px;font-weight:400;letter-spacing:.01em}
.gallery-title span{color:var(--gold);font-style:italic;font-size:.7em}
.gallery-meta{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted-solid)}
.btn-shuffle{display:inline-flex;align-items:center;gap:8px;padding:9px 16px;border-radius:var(--radius);font-size:10px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;cursor:pointer;border:1px solid var(--line);color:var(--ink);background:transparent;font-family:var(--sans);transition:all .2s var(--ease)}
.btn-shuffle:hover{border-color:var(--ink)}
.btn-shuffle.active{background:var(--ink);color:var(--ivory);border-color:var(--ink)}

/* GALLERY GRID — framed prints */
.gallery-grid{max-width:1360px;margin:0 auto;display:grid;grid-template-columns:repeat(4,1fr);gap:28px;padding:28px 36px 72px}
.gallery-card{cursor:pointer;border-radius:0;overflow:hidden;background:var(--paper);border:1px solid var(--line);box-shadow:0 1px 2px rgba(26,23,20,0.04);transition:box-shadow .3s var(--ease),transform .3s var(--ease),border-color .3s var(--ease);display:flex;flex-direction:column}
.gallery-card:hover{box-shadow:0 16px 44px rgba(26,23,20,0.16);transform:translateY(-4px);border-color:var(--line-gold)}
.card-img-wrap{position:relative;overflow:hidden;background:var(--cream-dk);aspect-ratio:3/4;flex-shrink:0;border-bottom:1px solid var(--line)}
.card-img-wrap img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .5s var(--ease)}
.gallery-card:hover .card-img-wrap img{transform:scale(1.045)}
.card-hover{position:absolute;inset:0;background:linear-gradient(transparent 45%,rgba(20,17,14,0.72));opacity:0;transition:opacity .3s var(--ease);display:flex;align-items:flex-end;padding:14px}
.gallery-card:hover .card-hover{opacity:1}
.card-hover-label{font-size:10px;font-weight:600;color:var(--ivory);letter-spacing:.16em;text-transform:uppercase}
.card-placeholder{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-family:var(--serif);font-size:38px;font-style:italic;color:var(--gold);opacity:.6}
.card-body{padding:15px 16px 16px;background:var(--paper);flex:1;display:flex;flex-direction:column}
.card-museum{font-size:8.5px;text-transform:uppercase;letter-spacing:.2em;color:var(--gold);margin-bottom:6px;font-weight:600}
.card-title{font-family:var(--serif);font-size:17px;font-weight:500;line-height:1.25;margin-bottom:4px;color:var(--ink);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;flex:1}
.card-artist{font-size:11px;font-style:italic;color:var(--muted-solid);margin-bottom:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.card-foot{display:flex;align-items:center;justify-content:space-between;padding-top:10px;border-top:1px solid var(--line-soft)}
.card-price{font-size:10px;letter-spacing:.08em;text-transform:uppercase;font-weight:600;color:var(--ink-soft)}
.card-badge{font-size:8.5px;padding:3px 9px;border-radius:var(--radius);background:transparent;border:1px solid var(--line-gold);color:var(--gold);font-weight:600;letter-spacing:.1em;text-transform:uppercase;white-space:nowrap}

/* SKELETON */
.skeleton{animation:pulse 1.6s ease-in-out infinite}
.skeleton-card{border:1px solid var(--line);overflow:hidden;background:var(--paper)}
.skeleton-img{aspect-ratio:3/4;background:var(--cream-dk)}
.skeleton-body{padding:15px 16px 16px}
.skeleton-line{height:10px;background:var(--cream-dk);border-radius:2px;margin-bottom:9px}
@keyframes pulse{0%,100%{opacity:.5}50%{opacity:1}}

/* LOAD MORE / EMPTY */
.load-more{text-align:center;padding:0 0 72px}
.empty-state{padding:110px 32px;text-align:center;color:var(--muted-solid)}
.empty-icon{font-family:var(--serif);font-size:44px;font-style:italic;color:var(--gold);opacity:.5;margin-bottom:14px}
.empty-text{font-family:var(--serif);font-size:26px;font-weight:400;font-style:italic;margin-bottom:22px;color:var(--ink-soft)}

/* MODAL */
.modal-bg{position:fixed;inset:0;background:rgba(20,17,14,0.78);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px)}
.modal{background:var(--ivory);border-radius:0;max-width:900px;width:100%;max-height:92vh;overflow:hidden;position:relative;box-shadow:0 40px 90px rgba(20,17,14,0.45);border:1px solid var(--gold)}
.modal-layout{display:grid;grid-template-columns:1fr 1fr;max-height:92vh;overflow-y:auto}
.modal-img-side{background:var(--charcoal);display:flex;align-items:center;justify-content:center;min-height:400px;position:sticky;top:0;max-height:92vh;padding:20px}
.modal-img-side img{width:100%;height:100%;object-fit:contain;max-height:calc(92vh - 40px)}
.modal-img-ph{font-family:var(--serif);font-size:60px;font-style:italic;color:var(--gold);opacity:.6}
.modal-close{position:absolute;top:16px;right:16px;width:36px;height:36px;border-radius:50%;background:rgba(20,17,14,0.6);border:1px solid rgba(240,234,216,0.25);color:var(--ivory);font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:10;transition:background .2s var(--ease);line-height:1}
.modal-close:hover{background:rgba(20,17,14,0.9)}
.modal-detail{padding:34px 30px 30px;overflow-y:auto;display:flex;flex-direction:column;gap:14px}
.modal-museum{font-size:9px;text-transform:uppercase;letter-spacing:.24em;color:var(--gold);font-weight:600}
.modal-title{font-family:var(--serif);font-size:30px;font-weight:500;line-height:1.08}
.modal-artist{font-size:14px;font-style:italic;color:var(--ink-soft)}
.divider{height:1px;background:var(--line);flex-shrink:0}
.meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.meta-item label{font-size:9px;text-transform:uppercase;letter-spacing:.16em;color:var(--muted-solid);display:block;margin-bottom:4px}
.meta-item span{font-size:13px;font-weight:500;color:var(--ink)}
.modal-bio{font-size:13px;color:var(--ink-soft);line-height:1.85;font-family:var(--serif)}
.prod-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.prod-item{background:transparent;border:1px solid var(--line);border-radius:var(--radius);padding:12px 10px;text-align:center;cursor:pointer;transition:all .2s var(--ease);color:var(--ink)}
.prod-item:hover{background:var(--ink);color:var(--ivory);border-color:var(--ink)}
.prod-name{font-size:12px;font-weight:500;margin-bottom:3px;font-family:var(--serif)}
.prod-price{font-size:10px;letter-spacing:.06em;opacity:.7;font-family:var(--sans);text-transform:uppercase}
.modal-cta{display:flex;flex-direction:column;gap:10px;margin-top:auto}
.cta-btn{display:block;text-align:center;padding:13px;border-radius:var(--radius);font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;cursor:pointer;font-family:var(--sans);transition:all .2s var(--ease);border:1px solid transparent;text-decoration:none}
.cta-primary{background:var(--ink);color:var(--ivory)}
.cta-primary:hover{background:var(--charcoal-2)}
.cta-secondary{background:transparent;color:var(--ink);border-color:var(--line)}
.cta-secondary:hover{background:rgba(26,23,20,0.04);border-color:var(--ink)}

/* FOOTER */
footer{background:var(--charcoal);color:#B0A898;padding:64px 36px 32px;border-top:1px solid var(--gold)}
.footer-inner{max-width:1360px;margin:0 auto}
.footer-grid{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:56px;margin-bottom:48px}
.footer-logo{font-family:var(--serif);font-size:24px;color:#F3EFE8;margin-bottom:12px;font-weight:500}
.footer-logo span{color:var(--gold);font-style:italic}
.footer-desc{font-size:13px;line-height:1.85;color:#8A8178;max-width:340px}
.footer-col-title{font-size:9px;text-transform:uppercase;letter-spacing:.2em;color:var(--gold);margin-bottom:16px;font-weight:600}
.footer-link{display:block;font-size:13px;color:#A69C8E;text-decoration:none;margin-bottom:9px;cursor:pointer;background:none;border:none;font-family:var(--sans);padding:0;text-align:left;transition:color .2s var(--ease)}
.footer-link:hover{color:#F3EFE8}
.footer-bottom{border-top:1px solid rgba(240,234,214,0.1);padding-top:20px;font-size:11px;letter-spacing:.04em;color:#6A6058}

/* RESPONSIVE */
@media(max-width:1200px){.gallery-grid{grid-template-columns:repeat(3,1fr)}}
@media(max-width:900px){.footer-grid{grid-template-columns:1fr 1fr;gap:36px}}
@media(max-width:800px){
  .nav{padding:0 16px;gap:12px}
  .hero{height:480px}
  .hero-content{padding:32px 24px}
  .hero-frame{inset:14px}
  .coll-bar,.museum-bar{padding-left:16px;padding-right:16px;justify-content:flex-start}
  .gallery-header{padding:32px 16px 0}
  .gallery-grid{grid-template-columns:repeat(2,1fr);gap:16px;padding:22px 16px 52px}
  .modal-layout{grid-template-columns:1fr}
  .modal-img-side{position:relative;min-height:260px;max-height:320px}
  .footer-grid{grid-template-columns:1fr;gap:32px}
}
@media(max-width:500px){
  .nav-count,.nav-link{display:none}
  .gallery-grid{grid-template-columns:repeat(2,1fr);gap:12px;padding:16px 12px 44px}
  .gallery-title{font-size:27px}
  .order-banner{padding:12px 16px;gap:12px}
  .order-banner-actions{flex-wrap:wrap}
  .hero-content{padding:24px 18px}
  .hero-caption{display:none}
}
`;

export default function Home() {
  const [works, setWorks]               = useState([]);
  const [searchInput, setSearchInput]   = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [collection, setCollection]     = useState(COLLECTIONS[0]);
  const [museum, setMuseum]             = useState('');
  const [order, setOrder]               = useState('recent');
  const [loading, setLoading]           = useState(false);
  const [total, setTotal]               = useState(null);
  const [museumCounts, setMuseumCounts] = useState(null); // {source: n} — hide empty museum chips
  const [hasMore, setHasMore]           = useState(false);
  const [modal, setModal]               = useState(null);
  const [heroIdx, setHeroIdx]           = useState(0);
  const [heroFading, setHeroFading]     = useState(false);
  const [imgErrors, setImgErrors]       = useState({});
  const [aiQuery, setAiQuery]           = useState('');
  const [artistQuery, setArtistQuery]   = useState(''); // dedicated "search by artist" box
  const [aiSearching, setAiSearching]   = useState(false);
  const [aiInfo, setAiInfo]             = useState(null); // { description, mood } from AI search
  const [aiMode, setAiMode]             = useState(null); // active AI query string (null when browsing normally)
  const [aiPageMode, setAiPageMode]     = useState(null); // 'strict'|'broad' — echoed to page the same set
  const [aiCurated, setAiCurated]       = useState(false); // curated (fine-art sources only) — for category buttons
  const [aiExtra, setAiExtra]           = useState('');    // tuned gate params (&must/&exclude/&artists) preserved across load-more
  const [checkout, setCheckout] = useState(null);  // { product, art } when the shared checkout sheet is open
  const gate = useShopGate();

  const load = useCallback(async (reset, q, src, ord, coll, currentOffset = 0) => {
    const off = reset ? 0 : currentOffset;
    setLoading(true);
    try {
      let url = `/api/artworks?limit=24&offset=${off}`;
      if (q)           url += `&search=${encodeURIComponent(q)}`;
      else if (coll?.search) url += `&search=${encodeURIComponent(coll.search)}`;
      if (src)         url += `&source=${encodeURIComponent(src)}`;
      if (ord === 'random') url += `&order=random`;
      const data = await fetch(url).then(r => r.json());
      const w = data.works || [];
      if (reset) setWorks(w); else setWorks(prev => [...prev, ...w]);
      setHasMore(w.length === 24);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  // AI search: /api/ai-search (Claude term expansion + relevance ranking) →
  // populate the gallery with the results and show what the AI understood.
  // Paginated: `append` fetches the next page (offset = current count) in the same
  // result set (aiPageMode is echoed back so 'broad' movement queries keep paging).
  const doAISearch = async (q, { append = false, curated = false, extra = '' } = {}) => {
    const query = ((q ?? aiQuery) || '').trim();
    if (!query) return;
    setLoading(true);
    const useCurated = append ? aiCurated : curated;
    const useExtra = append ? aiExtra : extra;
    if (!append) { setAiSearching(true); setAiInfo(null); setAiMode(query); setAiCurated(curated); setAiExtra(extra); }
    try {
      const off = append ? works.length : 0;
      const url = '/api/ai-search?query=' + encodeURIComponent(query) + '&offset=' + off +
        (append && aiPageMode ? '&mode=' + aiPageMode : '') +
        (useCurated ? '&curated=1' : '') + useExtra;
      const d = await fetch(url).then(r => r.json());
      const w = d.works || [];
      // Dedup by id on append so a cross-page overlap never creates duplicate React keys.
      setWorks(prev => {
        if (!append) return w;
        const seen = new Set(prev.map(x => x.id));
        return [...prev, ...w.filter(x => !seen.has(x.id))];
      });
      setHasMore(!!d.has_more);
      setAiPageMode(d.mode || aiPageMode);
      if (!append) setAiInfo({ description: d.ai_description || '', mood: d.ai_mood || '' });
    } catch (e) { console.error('AI search error:', e); }
    setLoading(false);
    setAiSearching(false);
    if (!append && typeof document !== 'undefined') document.getElementById('gallery')?.scrollIntoView({ behavior: 'smooth' });
  };

  // Search by artist — fills the gallery with our catalog works by that maker
  // (reuses load()'s search). The full live cross-museum artist view is in the Viewer.
  const doArtistSearch = (a) => {
    const name = ((a ?? artistQuery) || '').trim();
    if (!name) return;
    setAiMode(null);
    setMuseum(''); setCollection(COLLECTIONS[0]); setSearchInput(''); setAppliedSearch(name);
    setAiInfo({ description: `Works by “${name}” in the collection — explore more live across museums in the Viewer →`, mood: '' });
    load(true, name, '', order, null, 0);
    if (typeof document !== 'undefined') document.getElementById('gallery')?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    document.title = 'Public Art Collections — Museum Prints & Art Marketplace';
    fetch('/api/artworks?count=true').then(r => r.json()).then(d => setTotal(d.total));
    fetch('/api/artworks?sourceCounts=1').then(r => r.json()).then(d => setMuseumCounts(d.counts || {})).catch(() => {});
    load(true, '', '', 'random', COLLECTIONS[0], 0);
  }, [load]);

  useEffect(() => {
    if (works.length < 2) return;
    const t = setInterval(() => {
      setHeroFading(true);
      setTimeout(() => {
        setHeroIdx(i => (i + 1) % Math.min(works.length, 8));
        setHeroFading(false);
      }, 600);
    }, 6000);
    return () => clearInterval(t);
  }, [works.length]);

  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') setModal(null); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, []);

  useEffect(() => {
    document.body.style.overflow = modal ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [modal]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('order') === '1') {
        const productName = params.get('product');
        const work = params.get('work') || '';
        const img  = params.get('img')  || '';
        // Museum's highest-res URL — handed to Printful for fulfillment; we never store the image.
        const print = params.get('print') || img;
        const found = PRODUCTS.find(p => p.name === productName) || PRODUCTS[0];
        const fakeWork = {
          title: work,
          thumb_url: img,
          full_url: img,
          print_url: print,
          source: '',
          artist: '',
          rights_label: 'CC0'
        };
        // Legacy inbound links: open the shared checkout sheet directly.
        setCheckout({ product: found, art: fakeWork });
        window.history.replaceState({}, '', '/');
      }
    }
  }, []);

  const handleSearch = () => {
    setAiMode(null);
    setAppliedSearch(searchInput);
    setMuseum('');
    setCollection(COLLECTIONS[0]);
    load(true, searchInput, '', order, null, 0);
  };
  const handleClear = () => {
    setAiMode(null);
    setSearchInput(''); setAppliedSearch('');
    load(true, '', museum, order, collection, 0);
  };
  const handleCollection = coll => {
    setCollection(coll); setMuseum(''); setAppliedSearch(''); setSearchInput('');
    // Themed chips (ai:true) expand via AI in curated mode (fine-art sources only,
    // so buyers see saleable art — not archival documents or record photos).
    // Some chips carry tuned gate params (must/exclude/artists) for a tighter fit.
    if (coll.ai) {
      const extra = [
        coll.must    ? 'must='    + encodeURIComponent(coll.must)    : '',
        coll.exclude ? 'exclude=' + encodeURIComponent(coll.exclude) : '',
        coll.artists ? 'artists=' + encodeURIComponent(coll.artists) : '',
      ].filter(Boolean).map(s => '&' + s).join('');
      doAISearch(coll.search || coll.label, { curated: true, extra });
      return;
    }
    setAiMode(null);
    load(true, '', '', order, coll, 0);
  };
  const handleMuseum = src => {
    setAiMode(null);
    const next = src === museum ? '' : src;
    setMuseum(next); setAppliedSearch(''); setSearchInput('');
    load(true, '', next, order, next ? null : collection, 0);
  };
  const handleShuffle = () => {
    const next = order === 'random' ? 'recent' : 'random';
    setOrder(next);
    if (aiMode) { doAISearch(aiMode); return; } // re-run the AI query (shuffle isn't applicable)
    load(true, appliedSearch, museum, next, collection, 0);
  };
  // Load-more continues the active AI result set when in AI mode, else the DB feed.
  const handleLoadMore = () => {
    if (aiMode) { doAISearch(aiMode, { append: true }); return; }
    load(false, appliedSearch, museum, order, collection, works.length);
  };

  const hero = works[heroIdx % Math.max(works.length, 1)];
  const galleryLabel = appliedSearch
    ? `"${appliedSearch}"`
    : museum
      ? fmt(museum)
      : collection.label === 'All' ? 'The Collection' : collection.label;

  return (
    <>
      <style>{CSS}</style>

      {/* NAV */}
      <nav className="nav">
        <a href="/" className="nav-logo">Public Art <span>Collections</span></a>
        <div className="nav-search">
          <input
            className="nav-input"
            type="text"
            placeholder="Search title, artist, medium…"
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
          <button className="btn btn-dark" onClick={handleSearch}>Search</button>
          {appliedSearch && <button className="btn btn-icon" onClick={handleClear} title="Clear">×</button>}
        </div>
        {total !== null && <span className="nav-count">{Number(total).toLocaleString()} works</span>}
        <a href="/viewer" className="nav-link">Browse by Museum →</a>
        <AuthNav />
      </nav>


      {/* HERO */}
      {hero && (
        <div className="hero">
          <div className="hero-mosaic">
            {works.slice(0, 12).map((w, i) => (
              w.thumb_url
                ? <img key={w.id || i} src={getThumbUrl(w.thumb_url)} alt="" loading="lazy"
                    onError={e => { e.currentTarget.style.visibility = 'hidden'; }} />
                : <div key={i} />
            ))}
          </div>
          <div className="hero-gradient" />
          <div className="hero-frame" />
          <div className="hero-content">
            <p className="hero-eyebrow">Public Art · Collections</p>
            <h1 className="hero-title">The World's Art,<br /><em>in Your Home</em></h1>
            <div className="hero-ornament">
              {total ? `${Number(total).toLocaleString()} works · est. collection` : 'est. collection'}
            </div>
            <p className="hero-sub">
              Museum masterpieces from the world's great collections — each in the public domain, available as archival fine-art prints, canvas, and gifts.
            </p>
            <div className="hero-actions">
              <a href="#gallery" className="hero-btn hero-btn-light">Browse the Collection</a>
              <button className="hero-btn hero-btn-outline" onClick={() => setModal(hero)}>View This Work</button>
            </div>
          </div>
          {hero.title && (
            <div className="hero-caption">
              <strong>{hero.title}</strong>{[hero.artist, fmt(hero.source)].filter(Boolean).join(' · ')}
            </div>
          )}
        </div>
      )}

      {/* SEARCH — curator's search (AI) + search by artist */}
      <div className="search-sec">
        <div className="search-head">
          <span className="eyebrow">The Curator's Search</span>
          <p>Search by mood, colour, era, or feeling</p>
        </div>
        <div className="search-row">
          <input
            className="search-input"
            value={aiQuery}
            onChange={e => setAiQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doAISearch(aiQuery)}
            placeholder="Try: blue melancholy · powerful women · Dutch golden age · war and suffering…"
          />
          <button className="search-submit search-submit--gold" onClick={() => doAISearch(aiQuery)} disabled={aiSearching}>
            {aiSearching ? 'Searching…' : 'Search'}
          </button>
        </div>
        {/* SEARCH BY ARTIST */}
        <div className="search-row">
          <input
            className="search-input"
            value={artistQuery}
            onChange={e => setArtistQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && doArtistSearch(artistQuery)}
            placeholder="Search by artist — Rembrandt, Monet, Hokusai, Van Gogh…"
          />
          <button className="search-submit search-submit--ink" onClick={() => doArtistSearch(artistQuery)} disabled={aiSearching}>
            By Artist
          </button>
        </div>
        <div className="chip-row">
          {['Rembrandt', 'Monet', 'Van Gogh', 'Hokusai', 'Vermeer', 'Degas', 'Turner', 'Klimt', 'Cézanne', 'Goya'].map(a => (
            <button key={a} className="taste-chip" onClick={() => { setArtistQuery(a); doArtistSearch(a); }}>{a}</button>
          ))}
        </div>
        <div className="chip-row">
          {['blue melancholy', 'powerful women', 'Dutch golden age', 'war and suffering', 'Japanese nature', 'impressionist light', 'ancient mythology', 'romantic landscapes'].map(s => (
            <button key={s} className="taste-chip" onClick={() => { setAiQuery(s); doAISearch(s, { curated: true }); }}>{s}</button>
          ))}
        </div>
        {aiInfo?.description && (
          <div className="ai-note">
            <b>Curator</b>&nbsp;&nbsp;{aiInfo.description}{aiInfo.mood ? ` · Mood: ${aiInfo.mood}` : ''}
          </div>
        )}
      </div>

      {/* COLLECTION FILTER BAR */}
      <div className="coll-bar" id="gallery">
        {COLLECTIONS.map(c => (
          <button
            key={c.label}
            className={`coll-chip${collection.label === c.label && !museum && !appliedSearch ? ' active' : ''}`}
            onClick={() => handleCollection(c)}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* MUSEUM FILTER BAR — hide chips whose collection has no works yet
          (e.g. a Smithsonian unit still syncing), so a filter is never empty. */}
      <div className="museum-bar">
        {MUSEUMS.filter(m => !museumCounts || (museumCounts[m.key] || 0) > 0).map(m => (
          <button
            key={m.key}
            className={`museum-chip${museum === m.key ? ' active' : ''}`}
            onClick={() => handleMuseum(m.key)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* GALLERY HEADER */}
      <div className="gallery-header">
        <h2 className="gallery-title">
          {galleryLabel}
          {total !== null && !appliedSearch && !museum && collection.label === 'All' && (
            <span> — {Number(total).toLocaleString()}+ works</span>
          )}
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {appliedSearch && <p className="gallery-meta">Search results</p>}
          <button
            className={`btn-shuffle${order === 'random' ? ' active' : ''}`}
            onClick={handleShuffle}
          >
            {order === 'random' ? 'Shuffled' : 'Shuffle'}
          </button>
        </div>
      </div>

      {/* GALLERY GRID */}
      {loading && works.length === 0 ? (
        <div className="gallery-grid">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="skeleton-card skeleton">
              <div className="skeleton-img" />
              <div className="skeleton-body">
                <div className="skeleton-line" style={{ width: '50%' }} />
                <div className="skeleton-line" style={{ width: '75%' }} />
                <div className="skeleton-line" style={{ width: '35%' }} />
              </div>
            </div>
          ))}
        </div>
      ) : works.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">—</div>
          <p className="empty-text">No works found</p>
          <button className="btn" onClick={handleClear}>Clear filters</button>
        </div>
      ) : (
        <div className="gallery-grid">
          {works.map(w => (
            <div key={w.id} className="gallery-card" onClick={() => setModal(w)}>
              <div className="card-img-wrap">
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
                  <div className="card-placeholder">—</div>
                )}
                <div className="card-hover">
                  <span className="card-hover-label">View &amp; Order →</span>
                </div>
              </div>
              <div className="card-body">
                <div className="card-museum">{fmt(w.source)}</div>
                <div className="card-title">{w.title}</div>
                <div className="card-artist">
                  {w.artist || 'Artist unknown'}{w.date_text ? ` · ${w.date_text}` : ''}
                </div>
                <div className="card-foot">
                  <span className="card-price">Prints from $18</span>
                  <span className="card-badge">{(w.rights_label || 'CC0').split('—')[0].trim()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* LOAD MORE */}
      {hasMore && (
        <div className="load-more">
          <button className="btn" onClick={handleLoadMore} disabled={loading}>
            {loading ? 'Loading…' : 'Load more works'}
          </button>
        </div>
      )}

      {/* FOOTER */}
      <footer>
        <div className="footer-inner">
          <div className="footer-grid">
            <div>
              <div className="footer-logo">Public Art <span>Collections</span></div>
              <p className="footer-desc">Museum-quality art for every home. All works public domain — ethically sourced from the world's great collections.</p>
            </div>
            <div>
              <div className="footer-col-title">Collections</div>
              {['All Museums', 'Impressionism', 'Baroque', 'Renaissance', 'Modern Art', 'Photography'].map(c => (
                <button
                  key={c}
                  className="footer-link"
                  onClick={() => {
                    const match = COLLECTIONS.find(x => x.label === c);
                    if (match) handleCollection(match);
                    else handleSearch();
                    document.getElementById('gallery')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
            <div>
              <div className="footer-col-title">Museums</div>
              {MUSEUMS.slice(0, 8).map(m => (
                <button key={m.key} className="footer-link" onClick={() => handleMuseum(m.key)}>{m.label}</button>
              ))}
              <a href="/viewer" className="footer-link">All museums →</a>
            </div>
            <div>
              <div className="footer-col-title">Info</div>
              <a href="/viewer" className="footer-link">Museum Viewer</a>
              <a href="/api/artworks" className="footer-link">API Access</a>
              <a className="footer-link" href="#">How Prints Work</a>
              <a className="footer-link" href="#">Shipping &amp; Returns</a>
              <a className="footer-link" href="#">About</a>
            </div>
          </div>
          <div className="footer-bottom">
            © 2025 publicartcollections.net · All artwork public domain · Prints fulfilled by Printful · Ships worldwide
          </div>
        </div>
      </footer>

      {/* MODAL */}
      {modal && (
        <div className="modal-bg" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <button className="modal-close" onClick={() => setModal(null)}>×</button>
            <div className="modal-layout">
              <div className="modal-img-side">
                {(modal.full_url || modal.thumb_url) ? (
                  <img
                    src={modal.full_url || modal.thumb_url}
                    alt={modal.title}
                    onError={e => { if (modal.thumb_url && e.target.src !== modal.thumb_url) e.target.src = modal.thumb_url; }}
                  />
                ) : (
                  <div className="modal-img-ph">—</div>
                )}
              </div>
              <div className="modal-detail">
                <div className="modal-museum">{fmt(modal.source)}</div>
                <div className="modal-title">{modal.title}</div>
                <div className="modal-artist">
                  {[modal.artist, modal.date_text].filter(Boolean).join(' · ') || 'Unknown artist'}
                </div>
                <div className="divider" />
                <div className="meta-grid">
                  {modal.medium && <div className="meta-item"><label>Medium</label><span>{modal.medium}</span></div>}
                  <div className="meta-item"><label>Rights</label><span style={{ color: '#16a34a' }}>{modal.rights_label || 'CC0'}</span></div>
                  {modal.department && <div className="meta-item"><label>Department</label><span>{modal.department}</span></div>}
                </div>
                {modal.bio && (
                  <>
                    <div className="divider" />
                    <p className="modal-bio">{modal.bio.slice(0, 300)}</p>
                  </>
                )}
                <div className="divider" />
                {gate.shopUnlocked ? (
                  <>
                    <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: '#8A8178', marginBottom: 10 }}>Order as</div>
                    <div className="prod-grid">
                      {PRODUCTS.map(p => (
                        <div
                          key={p.name}
                          className="prod-item"
                          // Open the shared checkout sheet in place, on top of the
                          // artwork modal — no navigation. (Was a /?order=1 redirect.)
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
                <div className="modal-cta">
                  <a href={`/artwork/${modal.id}`} className="cta-btn cta-primary">View full page →</a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CHECKOUT — shared in-place sheet (Stripe or no-charge draft) */}
      <CheckoutSheet checkout={checkout} onClose={() => setCheckout(null)} />

      {/* PIN MODAL — trade access */}
      <PinModal gate={gate} />

      {/* LEAD CAPTURE POPUP — appears after 8s */}
      <LeadPopup />
    </>
  );
}
