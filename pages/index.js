import { useState, useEffect, useCallback } from 'react';

const COLLECTIONS = [
  { label: 'All',           search: '',              source: '' },
  { label: 'Impressionism', search: 'impressionism', source: '' },
  { label: 'Baroque',       search: 'baroque',       source: '' },
  { label: 'Renaissance',   search: 'renaissance',   source: '' },
  { label: 'Modern Art',    search: 'modern',        source: '' },
  { label: 'Photography',   search: 'photograph',    source: '' },
  { label: 'Portraits',     search: 'portrait',      source: '' },
  { label: 'Landscapes',    search: 'landscape',     source: '' },
];

const PRODUCTS = [
  { emoji: '🖼️', name: 'Fine Art Print', price: 'from $18',
    sizes: ['8×10"', '11×14"', '16×20"', '24×30"'],
    materials: ['Archival Matte', 'Photo Gloss', 'Fine Art Cotton'],
    frames: [null, 'Black', 'White', 'Natural Wood'] },
  { emoji: '🎨', name: 'Canvas Wrap', price: 'from $45',
    sizes: ['12×16"', '16×20"', '20×24"', '24×30"'],
    materials: ['Gallery Canvas', 'Premium Canvas'],
    frames: null },
  { emoji: '👕', name: 'T-Shirt', price: 'from $24',
    sizes: ['S', 'M', 'L', 'XL', '2XL'],
    materials: ['100% Cotton', 'Tri-blend'],
    frames: null },
  { emoji: '☕', name: 'Mug', price: 'from $14',
    sizes: ['11oz', '15oz'],
    materials: ['Ceramic'],
    frames: null },
  { emoji: '📱', name: 'Phone Case', price: 'from $19',
    sizes: ['iPhone 15', 'iPhone 14', 'Samsung S24', 'Pixel 8'],
    materials: ['Tough', 'Slim'],
    frames: null },
  { emoji: '🛍️', name: 'Tote Bag', price: 'from $16',
    sizes: ['Standard'],
    materials: ['Natural Canvas', 'Black Canvas'],
    frames: null },
];

const MUSEUMS = [
  { key: 'Metropolitan Museum of Art',      label: 'Met Museum' },
  { key: 'Art Institute of Chicago',        label: 'Art Inst. Chicago' },
  { key: 'Cleveland Museum of Art',         label: 'Cleveland' },
  { key: 'Victoria & Albert Museum',        label: 'V&A Museum' },
  { key: 'Rijksmuseum',                     label: 'Rijksmuseum' },
  { key: 'SMK National Gallery of Denmark', label: 'SMK Denmark' },
  { key: 'Smithsonian Institution',         label: 'Smithsonian' },
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
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=DM+Sans:opsz,wght@9..40,400;9..40,500&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:'DM Sans',system-ui,-apple-system,sans-serif;background:#FAF8F4;color:#1A1714}

/* NAV */
.nav{position:sticky;top:0;z-index:100;background:rgba(250,248,244,0.97);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border-bottom:0.5px solid rgba(26,23,20,0.12);height:62px;display:flex;align-items:center;gap:16px;padding:0 32px}
.nav-logo{font-family:'Cormorant Garamond',Georgia,serif;font-size:20px;font-weight:400;text-decoration:none;color:#1A1714;white-space:nowrap;flex-shrink:0;letter-spacing:.01em}
.nav-logo span{color:#B8942A}
.nav-search{flex:1;max-width:520px;display:flex;gap:8px}
.nav-input{flex:1;padding:8px 14px;border:0.5px solid rgba(26,23,20,0.22);border-radius:4px;font-size:13px;background:#FAF8F4;outline:none;font-family:'DM Sans',sans-serif;color:#1A1714}
.nav-input:focus{border-color:#B8942A;box-shadow:0 0 0 3px rgba(184,148,42,0.1)}
.nav-count{font-size:12px;color:#8A8178;white-space:nowrap;flex-shrink:0;margin-left:auto}
.btn{display:inline-flex;align-items:center;padding:8px 16px;border-radius:4px;font-size:13px;font-weight:500;cursor:pointer;border:0.5px solid rgba(26,23,20,0.2);color:#1A1714;background:transparent;font-family:'DM Sans',sans-serif;transition:background .15s;white-space:nowrap;text-decoration:none}
.btn:hover{background:rgba(26,23,20,0.06)}
.btn-dark{background:#1A1714;color:#FAF8F4;border-color:#1A1714}
.btn-dark:hover{background:#2C2318}
.btn-icon{padding:8px 10px;font-size:16px;line-height:1}
.nav-link{font-size:13px;color:#4A4540;text-decoration:none;white-space:nowrap;flex-shrink:0;transition:color .15s}
.nav-link:hover{color:#1A1714}

/* ORDER BANNER */
.order-banner{background:#2C2318;color:#F0EAD8;padding:14px 32px;display:flex;align-items:center;gap:16px;flex-wrap:wrap}
.order-banner-img{width:52px;height:52px;object-fit:cover;border-radius:4px;flex-shrink:0;background:#3A3028}
.order-banner-info{flex:1;min-width:0}
.order-banner-label{font-size:9px;text-transform:uppercase;letter-spacing:.14em;color:#B8942A;margin-bottom:3px}
.order-banner-work{font-family:'Cormorant Garamond',Georgia,serif;font-size:16px;font-weight:300;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.order-banner-prod{font-size:12px;color:#B0A898;margin-top:2px}
.order-banner-actions{display:flex;align-items:center;gap:8px;flex-shrink:0}
.order-qty{display:flex;align-items:center;gap:6px;font-size:13px}
.order-qty button{width:26px;height:26px;border-radius:50%;border:0.5px solid rgba(240,234,216,0.25);background:transparent;color:#F0EAD8;cursor:pointer;font-size:16px;line-height:1;display:flex;align-items:center;justify-content:center;transition:background .15s}
.order-qty button:hover{background:rgba(240,234,216,0.1)}
.order-confirm{padding:8px 20px;background:#B8942A;color:#1A1714;border:none;border-radius:4px;font-size:13px;font-weight:500;cursor:pointer;font-family:'DM Sans',sans-serif;white-space:nowrap;transition:background .15s}
.order-confirm:hover{background:#C9A84C}
.order-dismiss{background:none;border:none;color:#6A6058;font-size:20px;cursor:pointer;line-height:1;padding:4px;transition:color .15s;flex-shrink:0}
.order-dismiss:hover{color:#F0EAD8}

/* HERO */
.hero{position:relative;height:540px;overflow:hidden;background:#2C2318}
.hero-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0.55;transition:opacity 1s ease}
.hero-img.fade{opacity:0}
.hero-gradient{position:absolute;inset:0;background:linear-gradient(105deg,rgba(26,23,20,0.92) 0%,rgba(26,23,20,0.5) 55%,rgba(26,23,20,0.18) 100%)}
.hero-content{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:flex-end;padding:52px 56px}
.hero-eyebrow{font-size:10px;text-transform:uppercase;letter-spacing:.2em;color:#B8942A;margin-bottom:16px;font-weight:500}
.hero-title{font-family:'Cormorant Garamond',Georgia,serif;font-size:clamp(38px,5vw,72px);font-weight:300;line-height:1.04;color:#F3EFE8;margin-bottom:14px;max-width:640px}
.hero-title em{font-style:italic;color:#C9A84C}
.hero-sub{font-size:14px;color:rgba(240,234,216,0.65);margin-bottom:32px;max-width:440px;line-height:1.7}
.hero-actions{display:flex;gap:12px;flex-wrap:wrap}
.hero-btn{padding:12px 28px;font-size:13px;font-weight:500;border-radius:4px;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .18s;text-decoration:none;border:none;letter-spacing:.01em}
.hero-btn-light{background:#FAF8F4;color:#1A1714}
.hero-btn-light:hover{background:#EDE8DF}
.hero-btn-outline{background:transparent;color:#F3EFE8;border:0.5px solid rgba(240,234,216,0.45)}
.hero-btn-outline:hover{background:rgba(240,234,216,0.08);border-color:rgba(240,234,216,0.75)}
.hero-caption{position:absolute;bottom:22px;right:32px;font-size:11px;color:rgba(240,234,216,0.4);text-align:right;max-width:260px;line-height:1.5}
.hero-caption strong{display:block;font-family:'Cormorant Garamond',Georgia,serif;font-size:14px;font-weight:400;color:rgba(240,234,216,0.7)}

/* COLLECTION BAR */
.coll-bar{background:#FAF8F4;border-bottom:0.5px solid rgba(26,23,20,0.1);padding:0 32px;display:flex;align-items:stretch;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none}
.coll-bar::-webkit-scrollbar{display:none}
.coll-chip{padding:14px 18px;font-size:11px;font-weight:500;letter-spacing:.08em;text-transform:uppercase;color:#8A8178;cursor:pointer;background:none;border:none;border-bottom:2px solid transparent;white-space:nowrap;transition:color .15s,border-color .15s;font-family:'DM Sans',sans-serif;flex-shrink:0}
.coll-chip:hover{color:#1A1714}
.coll-chip.active{color:#1A1714;border-bottom-color:#B8942A}

/* MUSEUM BAR */
.museum-bar{background:#F5F2ED;border-bottom:0.5px solid rgba(26,23,20,0.07);padding:0 32px;display:flex;align-items:stretch;overflow-x:auto;scrollbar-width:none;gap:0}
.museum-bar::-webkit-scrollbar{display:none}
.museum-chip{padding:10px 14px;font-size:11px;color:#6A6058;cursor:pointer;background:none;border:none;white-space:nowrap;font-family:'DM Sans',sans-serif;flex-shrink:0;border-bottom:1.5px solid transparent;transition:color .15s,border-color .15s}
.museum-chip:hover{color:#1A1714}
.museum-chip.active{color:#1A1714;border-bottom-color:#B8942A;font-weight:500}

/* GALLERY HEADER */
.gallery-header{padding:32px 32px 0;display:flex;align-items:baseline;justify-content:space-between;flex-wrap:wrap;gap:10px}
.gallery-title{font-family:'Cormorant Garamond',Georgia,serif;font-size:28px;font-weight:300;letter-spacing:.01em}
.gallery-title span{color:#B8942A}
.gallery-meta{font-size:12px;color:#8A8178}
.btn-shuffle{display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:4px;font-size:12px;font-weight:500;cursor:pointer;border:0.5px solid rgba(26,23,20,0.2);color:#1A1714;background:transparent;font-family:'DM Sans',sans-serif;transition:all .15s}
.btn-shuffle:hover{background:rgba(26,23,20,0.06)}
.btn-shuffle.active{background:#1A1714;color:#FAF8F4;border-color:#1A1714}

/* GALLERY GRID */
.gallery-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;padding:24px 32px 64px}
.gallery-card{cursor:pointer;border-radius:8px;overflow:hidden;background:#EDE8DF;box-shadow:0 1px 4px rgba(26,23,20,0.08);transition:box-shadow .22s,transform .22s;display:flex;flex-direction:column}
.gallery-card:hover{box-shadow:0 12px 40px rgba(26,23,20,0.18);transform:translateY(-3px)}
.card-img-wrap{position:relative;overflow:hidden;background:#D4CEC3;aspect-ratio:3/4;flex-shrink:0}
.card-img-wrap img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .4s ease}
.gallery-card:hover .card-img-wrap img{transform:scale(1.05)}
.card-hover{position:absolute;inset:0;background:linear-gradient(transparent 50%,rgba(26,23,20,0.75));opacity:0;transition:opacity .22s;display:flex;align-items:flex-end;padding:12px}
.gallery-card:hover .card-hover{opacity:1}
.card-hover-label{font-size:11px;font-weight:500;color:#FAF8F4;letter-spacing:.05em}
.card-placeholder{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:48px;color:#B8942A}
.card-body{padding:12px 14px 14px;background:#FAF8F4;flex:1;display:flex;flex-direction:column}
.card-museum{font-size:9px;text-transform:uppercase;letter-spacing:.14em;color:#B8942A;margin-bottom:4px;font-weight:500}
.card-title{font-family:'Cormorant Garamond',Georgia,serif;font-size:15px;font-weight:400;line-height:1.3;margin-bottom:3px;color:#1A1714;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;flex:1}
.card-artist{font-size:11px;color:#8A8178;margin-bottom:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.card-foot{display:flex;align-items:center;justify-content:space-between}
.card-price{font-size:11px;font-weight:500;color:#4A4540}
.card-badge{font-size:9px;padding:2px 7px;border-radius:10px;background:#DCFCE7;color:#166534;font-weight:500;letter-spacing:.04em;white-space:nowrap}

/* SKELETON */
.skeleton{animation:pulse 1.5s ease-in-out infinite}
.skeleton-card{border-radius:8px;overflow:hidden;background:#EDE8DF}
.skeleton-img{aspect-ratio:3/4;background:#E0DAD0}
.skeleton-body{padding:12px 14px 14px}
.skeleton-line{height:10px;background:#D4CEC3;border-radius:3px;margin-bottom:8px}
@keyframes pulse{0%,100%{opacity:.5}50%{opacity:1}}

/* LOAD MORE / EMPTY */
.load-more{text-align:center;padding:0 0 64px}
.empty-state{padding:96px 32px;text-align:center;color:#8A8178}
.empty-icon{font-size:52px;margin-bottom:16px}
.empty-text{font-family:'Cormorant Garamond',Georgia,serif;font-size:24px;font-weight:300;margin-bottom:20px}

/* MODAL */
.modal-bg{position:fixed;inset:0;background:rgba(26,23,20,0.72);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}
.modal{background:#FAF8F4;border-radius:12px;max-width:880px;width:100%;max-height:92vh;overflow:hidden;position:relative;box-shadow:0 32px 80px rgba(26,23,20,0.35)}
.modal-layout{display:grid;grid-template-columns:1fr 1fr;max-height:92vh;overflow-y:auto}
.modal-img-side{background:#2C2318;display:flex;align-items:center;justify-content:center;min-height:400px;position:sticky;top:0;max-height:92vh}
.modal-img-side img{width:100%;height:100%;object-fit:contain;max-height:92vh}
.modal-img-ph{font-size:72px;color:#B8942A}
.modal-close{position:absolute;top:14px;right:14px;width:34px;height:34px;border-radius:50%;background:rgba(26,23,20,0.55);border:none;color:#FAF8F4;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:10;transition:background .15s;line-height:1}
.modal-close:hover{background:rgba(26,23,20,0.85)}
.modal-detail{padding:28px 24px 24px;overflow-y:auto;display:flex;flex-direction:column;gap:12px}
.modal-museum{font-size:9px;text-transform:uppercase;letter-spacing:.18em;color:#B8942A;font-weight:500}
.modal-title{font-family:'Cormorant Garamond',Georgia,serif;font-size:24px;font-weight:300;line-height:1.1}
.modal-artist{font-size:13px;color:#4A4540}
.divider{height:0.5px;background:rgba(26,23,20,0.1);flex-shrink:0}
.meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.meta-item label{font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:#8A8178;display:block;margin-bottom:3px}
.meta-item span{font-size:13px;font-weight:500;color:#1A1714}
.modal-bio{font-size:12px;color:#4A4540;line-height:1.78}
.prod-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.prod-item{background:#2C2318;border:0.5px solid #3A3028;border-radius:6px;padding:10px 8px;text-align:center;cursor:pointer;transition:all .15s;color:#F0EAD8}
.prod-item:hover{background:#B8942A;color:#1A1714}
.prod-emoji{font-size:20px;margin-bottom:4px}
.prod-name{font-size:11px;font-weight:500;margin-bottom:2px;font-family:'DM Sans',sans-serif}
.prod-price{font-size:10px;opacity:.7;font-family:'DM Sans',sans-serif}
.modal-cta{display:flex;flex-direction:column;gap:8px;margin-top:auto}
.cta-btn{display:block;text-align:center;padding:11px;border-radius:5px;font-size:13px;font-weight:500;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .15s;border:none;text-decoration:none}
.cta-primary{background:#1A1714;color:#FAF8F4}
.cta-primary:hover{background:#2C2318}
.cta-secondary{background:transparent;color:#1A1714;border:0.5px solid rgba(26,23,20,0.22)}
.cta-secondary:hover{background:rgba(26,23,20,0.05)}

/* FOOTER */
footer{background:#2C2318;color:#B0A898;padding:52px 32px 28px}
.footer-inner{max-width:1280px;margin:0 auto}
.footer-grid{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:48px;margin-bottom:40px}
.footer-logo{font-family:'Cormorant Garamond',Georgia,serif;font-size:22px;color:#F3EFE8;margin-bottom:10px;font-weight:300}
.footer-logo span{color:#B8942A}
.footer-desc{font-size:13px;line-height:1.75;color:#6A6058}
.footer-col-title{font-size:9px;text-transform:uppercase;letter-spacing:.14em;color:#6A6058;margin-bottom:14px}
.footer-link{display:block;font-size:13px;color:#8A8178;text-decoration:none;margin-bottom:7px;cursor:pointer;background:none;border:none;font-family:'DM Sans',sans-serif;padding:0;text-align:left;transition:color .15s}
.footer-link:hover{color:#F3EFE8}
.footer-bottom{border-top:0.5px solid rgba(240,234,214,0.08);padding-top:16px;font-size:12px;color:#6A6058}

/* RESPONSIVE */
@media(max-width:1200px){.gallery-grid{grid-template-columns:repeat(3,1fr)}}
@media(max-width:900px){.footer-grid{grid-template-columns:1fr 1fr;gap:32px}}
@media(max-width:800px){
  .nav{padding:0 16px;gap:10px}
  .hero{height:440px}
  .hero-content{padding:32px 24px 40px}
  .coll-bar,.museum-bar{padding-left:16px;padding-right:16px}
  .gallery-header{padding:24px 16px 0}
  .gallery-grid{grid-template-columns:repeat(2,1fr);gap:14px;padding:20px 16px 48px}
  .modal-layout{grid-template-columns:1fr}
  .modal-img-side{position:relative;min-height:260px;max-height:300px}
  .footer-grid{grid-template-columns:1fr;gap:28px}
}
@media(max-width:500px){
  .nav-count,.nav-link{display:none}
  .gallery-grid{grid-template-columns:repeat(2,1fr);gap:10px;padding:16px 12px 40px}
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
  const [hasMore, setHasMore]           = useState(false);
  const [modal, setModal]               = useState(null);
  const [heroIdx, setHeroIdx]           = useState(0);
  const [heroFading, setHeroFading]     = useState(false);
  const [imgErrors, setImgErrors]       = useState({});
  const [activeTab, setActiveTab]             = useState(null);
  const [selected, setSelected]               = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedSize, setSelectedSize]       = useState(null);
  const [selectedMaterial, setSelectedMaterial] = useState(null);
  const [selectedFrame, setSelectedFrame]     = useState(null);
  const [quantity, setQuantity]               = useState(1);

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

  useEffect(() => {
    document.title = 'Public Art Collections — Museum Prints & Art Marketplace';
    fetch('/api/artworks?count=true').then(r => r.json()).then(d => setTotal(d.total));
    load(true, '', '', 'recent', COLLECTIONS[0], 0);
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
        setSelected(fakeWork);
        setSelectedProduct(found);
        setSelectedSize(found.sizes[1] || found.sizes[0]);
        setSelectedMaterial(found.materials[0]);
        setSelectedFrame(found.frames?.[0] || null);
        setQuantity(1);
        setActiveTab('order');
        window.history.replaceState({}, '', '/');
      }
    }
  }, []);

  const handleSearch = () => {
    setAppliedSearch(searchInput);
    setMuseum('');
    setCollection(COLLECTIONS[0]);
    load(true, searchInput, '', order, null, 0);
  };
  const handleClear = () => {
    setSearchInput(''); setAppliedSearch('');
    load(true, '', museum, order, collection, 0);
  };
  const handleCollection = coll => {
    setCollection(coll); setMuseum(''); setAppliedSearch(''); setSearchInput('');
    load(true, '', '', order, coll, 0);
  };
  const handleMuseum = src => {
    const next = src === museum ? '' : src;
    setMuseum(next); setAppliedSearch(''); setSearchInput('');
    load(true, '', next, order, next ? null : collection, 0);
  };
  const handleShuffle = () => {
    const next = order === 'random' ? 'recent' : 'random';
    setOrder(next);
    load(true, appliedSearch, museum, next, collection, 0);
  };
  const handleLoadMore = () => load(false, appliedSearch, museum, order, collection, works.length);

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
      </nav>

      {/* ORDER BANNER */}
      {activeTab === 'order' && selectedProduct && selected && (
        <div className="order-banner">
          {selected.thumb_url && <img src={selected.thumb_url} alt={selected.title} className="order-banner-img" onError={e => { e.target.style.display = 'none'; }} />}
          <div className="order-banner-info">
            <div className="order-banner-label">Ordering as {selectedProduct.emoji} {selectedProduct.name}</div>
            <div className="order-banner-work">{selected.title || 'Selected artwork'}</div>
            <div className="order-banner-prod">
              {selectedSize && <span>{selectedSize} · </span>}
              {selectedMaterial && <span>{selectedMaterial} · </span>}
              {selectedProduct.price} · Public domain · Ships worldwide
            </div>
          </div>
          <div className="order-banner-actions">
            <div className="order-qty">
              <button onClick={() => setQuantity(q => Math.max(1, q - 1))}>−</button>
              <span>{quantity}</span>
              <button onClick={() => setQuantity(q => q + 1)}>+</button>
            </div>
            <button className="order-confirm">Confirm Order →</button>
          </div>
          <button className="order-dismiss" onClick={() => setActiveTab(null)} title="Dismiss">×</button>
        </div>
      )}

      {/* HERO */}
      {hero && (
        <div className="hero">
          {hero.thumb_url && (
            <img
              key={hero.id}
              src={hero.full_url || hero.thumb_url}
              alt={hero.title}
              className={`hero-img${heroFading ? ' fade' : ''}`}
            />
          )}
          <div className="hero-gradient" />
          <div className="hero-content">
            <p className="hero-eyebrow">{fmt(hero.source)}</p>
            <h1 className="hero-title">The world's art,<br /><em>in your home</em></h1>
            <p className="hero-sub">
              {total ? `${Number(total).toLocaleString()}+ museum masterpieces` : 'Museum masterpieces'} — available as fine art prints, canvas wraps, and gifts.
            </p>
            <div className="hero-actions">
              <a href="#gallery" className="hero-btn hero-btn-light">Browse Collection</a>
              <button className="hero-btn hero-btn-outline" onClick={() => setModal(hero)}>View This Work</button>
            </div>
          </div>
          {hero.title && (
            <div className="hero-caption">
              <strong>{hero.title}</strong>{hero.artist || ''}
            </div>
          )}
        </div>
      )}

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

      {/* MUSEUM FILTER BAR */}
      <div className="museum-bar">
        {MUSEUMS.map(m => (
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
            ↺ {order === 'random' ? 'Shuffled' : 'Shuffle'}
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
          <div className="empty-icon">🔍</div>
          <p className="empty-text">No artworks found</p>
          <button className="btn" onClick={handleClear}>Clear filters</button>
        </div>
      ) : (
        <div className="gallery-grid">
          {works.map(w => (
            <div key={w.id} className="gallery-card" onClick={() => setModal(w)}>
              <div className="card-img-wrap">
                {w.thumb_url && !imgErrors[w.id] ? (
                  <img
                    src={w.thumb_url}
                    alt={w.title}
                    loading="lazy"
                    onError={() => setImgErrors(e => ({ ...e, [w.id]: true }))}
                  />
                ) : (
                  <div className="card-placeholder">🖼️</div>
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
            © 2025 publicartcollections.org · All artwork public domain · Prints fulfilled by Printful · Ships worldwide
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
                  <div className="modal-img-ph">🖼️</div>
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
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: '#8A8178', marginBottom: 10 }}>Order as</div>
                <div className="prod-grid">
                  {PRODUCTS.map(p => (
                    <div
                      key={p.name}
                      className="prod-item"
                      onClick={() => window.location.href = `/?order=1&product=${encodeURIComponent(p.name)}&work=${encodeURIComponent(modal.title)}&img=${encodeURIComponent(modal.full_url || modal.thumb_url || '')}`}
                    >
                      <div className="prod-emoji">{p.emoji}</div>
                      <div className="prod-name">{p.name}</div>
                      <div className="prod-price">{p.price}</div>
                    </div>
                  ))}
                </div>
                <div className="divider" />
                <div className="modal-cta">
                  <a href={`/artwork/${modal.id}`} className="cta-btn cta-primary">View full page →</a>
                  {modal.detail_url && (
                    <a href={modal.detail_url} target="_blank" rel="noopener noreferrer" className="cta-btn cta-secondary">
                      View on museum website ↗
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
