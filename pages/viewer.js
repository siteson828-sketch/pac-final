import { useState, useEffect, useCallback, useRef } from 'react';
import { useShopGate, PinModal, TradeAccessPanel } from '../lib/useShopGate';

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

const PRODUCTS = [
  { emoji: '🖼️', name: 'Fine Art Print', price: 'from $18' },
  { emoji: '🎨', name: 'Canvas Wrap',    price: 'from $45' },
  { emoji: '👕', name: 'T-Shirt',        price: 'from $24' },
  { emoji: '☕', name: 'Mug',            price: 'from $14' },
  { emoji: '📱', name: 'Phone Case',     price: 'from $19' },
  { emoji: '🛍️', name: 'Tote Bag',       price: 'from $16' },
];

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

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=DM+Sans:opsz,wght@9..40,400;9..40,500&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;font-family:'DM Sans',system-ui,sans-serif;background:#FAF8F4;color:#1A1714}
.layout{display:flex;height:100vh;overflow:hidden}

/* SIDEBAR */
.sidebar{width:210px;flex-shrink:0;background:#F2EDE6;border-right:0.5px solid rgba(26,23,20,0.12);display:flex;flex-direction:column;overflow:hidden}
.sidebar-head{padding:16px 14px 12px;border-bottom:0.5px solid rgba(26,23,20,0.1);flex-shrink:0}
.sidebar-logo{font-family:'Cormorant Garamond',Georgia,serif;font-size:15px;font-weight:400;color:#1A1714;text-decoration:none;display:block;margin-bottom:3px;letter-spacing:.01em}
.sidebar-logo span{color:#B8942A}
.sidebar-sub{font-size:10px;color:#8A8178}
.sidebar-scroll{overflow-y:auto;flex:1;padding:6px 0 24px}
.sidebar-scroll::-webkit-scrollbar{width:3px}
.sidebar-scroll::-webkit-scrollbar-thumb{background:rgba(26,23,20,0.15);border-radius:2px}
.region-label{font-size:9px;text-transform:uppercase;letter-spacing:.14em;color:#8A8178;padding:10px 12px 3px;font-weight:500}
.museum-btn{display:block;width:100%;text-align:left;padding:5px 12px;font-size:12px;color:#4A4540;background:none;border:none;cursor:pointer;font-family:'DM Sans',sans-serif;transition:background .12s,color .12s;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;line-height:1.4}
.museum-btn:hover{background:rgba(184,148,42,0.08);color:#1A1714}
.museum-btn.active{background:rgba(184,148,42,0.15);color:#1A1714;font-weight:500}

/* MAIN */
.main{flex:1;display:flex;flex-direction:column;overflow:hidden;min-width:0}

/* TOPBAR */
.topbar{height:52px;border-bottom:0.5px solid rgba(26,23,20,0.1);display:flex;align-items:center;padding:0 16px;gap:10px;flex-shrink:0;background:#FAF8F4}
.topbar-title{font-family:'Cormorant Garamond',Georgia,serif;font-size:17px;font-weight:300;flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.topbar-title span{color:#B8942A}
.topbar-search{padding:6px 11px;border:0.5px solid rgba(26,23,20,0.18);border-radius:4px;font-size:12px;background:#FAF8F4;outline:none;font-family:'DM Sans',sans-serif;color:#1A1714;width:180px;flex-shrink:0}
.topbar-search:focus{border-color:#B8942A;box-shadow:0 0 0 2px rgba(184,148,42,0.1)}
.topbar-count{font-size:11px;color:#8A8178;white-space:nowrap;flex-shrink:0}
.topbar-home{font-size:12px;color:#8A8178;text-decoration:none;padding:5px 10px;border:0.5px solid rgba(26,23,20,0.15);border-radius:4px;transition:all .15s;white-space:nowrap;flex-shrink:0}
.topbar-home:hover{color:#1A1714;border-color:rgba(26,23,20,0.3)}

/* GENRE + ORDER BAR */
.filter-row{border-bottom:0.5px solid rgba(26,23,20,0.08);display:flex;align-items:stretch;background:#F8F5F0;flex-shrink:0;gap:0;overflow-x:auto;scrollbar-width:none}
.filter-row::-webkit-scrollbar{display:none}
.genre-chip{padding:8px 14px;font-size:10px;font-weight:500;letter-spacing:.07em;text-transform:uppercase;color:#8A8178;cursor:pointer;background:none;border:none;border-bottom:2px solid transparent;white-space:nowrap;transition:color .15s,border-color .15s;font-family:'DM Sans',sans-serif;flex-shrink:0}
.genre-chip:hover{color:#1A1714}
.genre-chip.active{color:#1A1714;border-bottom-color:#B8942A}
.filter-sep{width:0.5px;background:rgba(26,23,20,0.1);margin:8px 0;flex-shrink:0}
.order-chip{padding:8px 12px;font-size:10px;font-weight:500;letter-spacing:.07em;text-transform:uppercase;color:#8A8178;cursor:pointer;background:none;border:none;border-bottom:2px solid transparent;white-space:nowrap;transition:all .15s;font-family:'DM Sans',sans-serif;flex-shrink:0;display:flex;align-items:center;gap:5px}
.order-chip:hover{color:#1A1714}
.order-chip.active{color:#1A1714;border-bottom-color:#B8942A}

/* GRID */
.grid-area{flex:1;overflow-y:auto;padding:16px}
.grid-area::-webkit-scrollbar{width:5px}
.grid-area::-webkit-scrollbar-thumb{background:rgba(26,23,20,0.12);border-radius:3px}
.art-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(155px,1fr));gap:12px}
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
.card-title{font-family:'Cormorant Garamond',Georgia,serif;font-size:13px;line-height:1.25;color:#1A1714;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:3px;flex:1}
.card-artist{font-size:10px;color:#8A8178;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.card-date{font-size:10px;color:#6A6058;margin-top:2px}

/* SKELETON */
.skeleton{animation:pulse 1.5s ease-in-out infinite}
.sk-img{aspect-ratio:3/4;background:#E0DAD0;border-radius:6px 6px 0 0}
.sk-body{padding:8px 10px 10px;background:#FAF8F4;border-radius:0 0 6px 6px}
.sk-line{height:9px;background:#D4CEC3;border-radius:3px;margin-bottom:6px}
@keyframes pulse{0%,100%{opacity:.5}50%{opacity:1}}

/* EMPTY */
.empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#8A8178;gap:10px;padding:40px;text-align:center}
.empty-icon{font-size:44px}
.empty-title{font-family:'Cormorant Garamond',Georgia,serif;font-size:20px;font-weight:300}
.empty-sub{font-size:12px;max-width:300px;line-height:1.65}

/* LOAD MORE */
.load-more-wrap{text-align:center;padding:20px 0 32px}
.load-btn{padding:8px 22px;border:0.5px solid rgba(26,23,20,0.2);border-radius:4px;font-size:12px;font-weight:500;cursor:pointer;background:transparent;font-family:'DM Sans',sans-serif;color:#1A1714;transition:background .15s}
.load-btn:hover{background:rgba(26,23,20,0.05)}

/* MODAL */
.modal-bg{position:fixed;inset:0;background:rgba(26,23,20,0.72);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(4px)}
.modal{background:#FAF8F4;border-radius:10px;max-width:820px;width:100%;max-height:90vh;overflow:hidden;position:relative;box-shadow:0 28px 70px rgba(26,23,20,0.3);display:flex}
.modal-img{background:#2C2318;flex:0 0 300px;display:flex;align-items:center;justify-content:center;min-height:380px}
.modal-img img{width:100%;height:100%;object-fit:contain;max-height:560px}
.modal-img-ph{font-size:64px;color:#B8942A}
.modal-detail{flex:1;padding:26px 22px;overflow-y:auto;display:flex;flex-direction:column;gap:10px;min-width:0}
.modal-close{position:absolute;top:12px;right:12px;width:30px;height:30px;border-radius:50%;background:rgba(26,23,20,0.5);border:none;color:#FAF8F4;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:10;line-height:1;transition:background .15s}
.modal-close:hover{background:rgba(26,23,20,0.8)}
.modal-source{font-size:9px;text-transform:uppercase;letter-spacing:.18em;color:#B8942A;font-weight:500}
.modal-title{font-family:'Cormorant Garamond',Georgia,serif;font-size:22px;font-weight:300;line-height:1.12}
.modal-artist{font-size:12px;color:#4A4540}
.divider{height:0.5px;background:rgba(26,23,20,0.1);flex-shrink:0}
.meta-row{display:flex;gap:16px;flex-wrap:wrap}
.meta-item label{font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:#8A8178;display:block;margin-bottom:2px}
.meta-item span{font-size:12px;font-weight:500;color:#1A1714}
.modal-bio{font-size:11px;color:#4A4540;line-height:1.75}
.prod-label{font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:#8A8178;margin-bottom:8px}
.prod-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px}
.prod-item{background:#2C2318;border:0.5px solid #3A3028;border-radius:5px;padding:9px 6px;text-align:center;cursor:pointer;transition:all .15s;color:#F0EAD8}
.prod-item:hover{background:#B8942A;color:#1A1714}
.prod-emoji{font-size:18px;margin-bottom:3px}
.prod-name{font-size:10px;font-weight:500;margin-bottom:1px;font-family:'DM Sans',sans-serif}
.prod-price{font-size:9px;opacity:.7}
.modal-links{display:flex;flex-direction:column;gap:6px;margin-top:auto}
.mlink{display:block;text-align:center;padding:10px;border-radius:4px;font-size:12px;font-weight:500;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .15s;border:none;text-decoration:none}
.mlink-primary{background:#1A1714;color:#FAF8F4}
.mlink-primary:hover{background:#2C2318}
.mlink-sec{background:transparent;color:#1A1714;border:0.5px solid rgba(26,23,20,0.2)}
.mlink-sec:hover{background:rgba(26,23,20,0.05)}
.zoom-btn{position:absolute;bottom:10px;right:10px;background:rgba(26,23,20,0.72);color:#FAF8F4;border:none;border-radius:4px;padding:6px 11px;font-size:11px;font-weight:500;cursor:pointer;font-family:'DM Sans',sans-serif;z-index:6;display:flex;align-items:center;gap:5px;transition:background .15s}
.zoom-btn:hover{background:#B8942A;color:#1A1714}
.osd-container{width:100%;height:100%;min-height:340px;background:#111}
.modal-img{position:relative}
.modal-img img{transition:opacity .25s}

@media(max-width:768px){
  .sidebar{display:none}
  .modal{flex-direction:column}
  .modal-img{flex:0 0 220px;min-height:220px}
  .art-grid{grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px}
  .topbar-search{width:130px}
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
  const [fullReady, setFullReady]   = useState(false); // museum full image finished loading
  const [zoomOpen, setZoomOpen]     = useState(false); // OpenSeadragon IIIF viewer open
  const osdRef  = useRef(null);
  const osdInst = useRef(null);
  const gate = useShopGate();

  useEffect(() => {
    document.title = 'World Museum Viewer — Public Art Collections';
    fetch('/api/artworks?count=true').then(r => r.json()).then(d => setTotalDb(d.total));
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
    setGenre(GENRES[0]);
    setSearch('');
    loadWorks(museum, GENRES[0], sortOrder, 0, false);
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
        <aside className="sidebar">
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

        {/* MAIN */}
        <div className="main">

          {/* TOPBAR */}
          <div className="topbar">
            <div className="topbar-title">
              {selected
                ? <>{selected.label}{genre.label !== 'All' && <span> · {genre.label}</span>}</>
                : <span>Select a museum</span>}
            </div>
            {selected && (
              <input
                className="topbar-search"
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
            {!selected ? (
              <div className="empty">
                <div className="empty-icon">🏛️</div>
                <div className="empty-title">World Museums</div>
                <div className="empty-sub">
                  Select a museum from the sidebar to browse its public-domain collection.
                  {totalDb && ` ${Number(totalDb).toLocaleString()} works across ${ALL_MUSEUMS.length} institutions.`}
                </div>
              </div>
            ) : loading && works.length === 0 ? (
              <div className="art-grid">
                {Array.from({ length: 24 }).map((_, i) => (
                  <div key={i} className="skeleton">
                    <div className="sk-img" />
                    <div className="sk-body">
                      <div className="sk-line" style={{ width: '60%' }} />
                      <div className="sk-line" style={{ width: '80%' }} />
                      <div className="sk-line" style={{ width: '40%' }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : works.length === 0 ? (
              <div className="empty">
                <div className="empty-icon">🔍</div>
                <div className="empty-title">No works found</div>
                <div className="empty-sub">
                  {genre.label !== 'All'
                    ? `No "${genre.label}" works found in ${selected.label}. Try a different genre or clear the filter.`
                    : `${selected.label} may not have synced yet.`}
                </div>
                {genre.label !== 'All' && (
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
                            src={w.thumb_url}
                            alt={w.title}
                            loading="lazy"
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
                <div className="meta-item"><label>Rights</label><span style={{ color: '#16a34a' }}>{modal.rights_label || 'CC0'}</span></div>
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
                        onClick={() => window.location.href = `/?order=1&product=${encodeURIComponent(p.name)}&work=${encodeURIComponent(modal.title)}&img=${encodeURIComponent(modal.full_url || modal.thumb_url || '')}&print=${encodeURIComponent(modal.print_url || modal.full_url || modal.thumb_url || '')}`}
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

      {/* PIN MODAL — trade access */}
      <PinModal gate={gate} />
    </>
  );
}
