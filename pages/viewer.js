import { useState, useEffect, useCallback } from 'react';

const REGIONS = [
  {
    region: 'United States',
    museums: [
      { label: 'Metropolitan Museum',        source: 'Metropolitan Museum of Art' },
      { label: 'Art Inst. Chicago',          source: 'Art Institute of Chicago' },
      { label: 'Cleveland Museum',           source: 'Cleveland Museum of Art' },
      { label: 'Smithsonian',               source: 'Smithsonian Institution' },
      { label: 'Harvard Art Museums',        source: 'Harvard Art Museums' },
      { label: 'Getty Museum',              source: 'Getty Museum' },
      { label: 'Walters Art Museum',        source: 'Walters Art Museum' },
      { label: 'Minneapolis Inst. of Art',  source: 'Minneapolis Institute of Art' },
      { label: 'Yale Art Gallery',          source: 'Yale University Art Gallery' },
      { label: 'Library of Congress',       source: 'Library of Congress' },
      { label: 'NYPL',                      source: 'NYPL' },
      { label: 'DPLA',                      source: 'DPLA' },
      { label: 'Smithsonian American Art',  source: 'Smithsonian American Art Museum' },
      { label: 'Philadelphia Museum',       source: 'Philadelphia Museum of Art' },
      { label: 'Boston MFA',               source: 'Museum of Fine Arts Boston' },
      { label: 'Detroit Institute of Arts', source: 'Detroit Institute of Arts' },
      { label: 'MoMA',                      source: 'MoMA' },
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
      { label: 'Louvre',           source: 'Louvre' },
      { label: "Musée d'Orsay",   source: "Musée d'Orsay" },
      { label: 'Musée de Cluny',  source: 'Musée de Cluny' },
      { label: 'BnF Gallica',     source: 'BnF Gallica' },
    ],
  },
  {
    region: 'Netherlands',
    museums: [
      { label: 'Rijksmuseum',       source: 'Rijksmuseum' },
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
      { label: 'Europeana',       source: 'Europeana', searchMode: true },
      { label: 'Wikimedia Commons', source: 'Wikimedia Commons' },
      { label: 'Internet Archive', source: 'Internet Archive' },
      { label: 'Wikidata Global',  source: 'Wikidata Global' },
    ],
  },
];

const ALL_MUSEUMS = REGIONS.flatMap(r => r.museums);

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=DM+Sans:opsz,wght@9..40,400;9..40,500&display=swap');
*{box-sizing:border-box;margin:0;padding:0}
html,body{height:100%;font-family:'DM Sans',system-ui,sans-serif;background:#FAF8F4;color:#1A1714}
.layout{display:flex;height:100vh;overflow:hidden}

/* SIDEBAR */
.sidebar{width:220px;flex-shrink:0;background:#F2EDE6;border-right:0.5px solid rgba(26,23,20,0.12);display:flex;flex-direction:column;overflow:hidden}
.sidebar-head{padding:18px 16px 12px;border-bottom:0.5px solid rgba(26,23,20,0.1);flex-shrink:0}
.sidebar-logo{font-family:'Cormorant Garamond',Georgia,serif;font-size:15px;font-weight:400;color:#1A1714;text-decoration:none;display:block;margin-bottom:4px}
.sidebar-logo span{color:#B8942A}
.sidebar-sub{font-size:10px;color:#8A8178;letter-spacing:.04em}
.sidebar-scroll{overflow-y:auto;flex:1;padding:8px 0 24px}
.sidebar-scroll::-webkit-scrollbar{width:4px}
.sidebar-scroll::-webkit-scrollbar-track{background:transparent}
.sidebar-scroll::-webkit-scrollbar-thumb{background:rgba(26,23,20,0.15);border-radius:2px}
.region-label{font-size:9px;text-transform:uppercase;letter-spacing:.14em;color:#8A8178;padding:12px 14px 4px;font-weight:500}
.museum-btn{display:block;width:100%;text-align:left;padding:6px 14px;font-size:12px;color:#4A4540;background:none;border:none;cursor:pointer;font-family:'DM Sans',sans-serif;transition:background .12s,color .12s;border-radius:0;line-height:1.4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.museum-btn:hover{background:rgba(184,148,42,0.08);color:#1A1714}
.museum-btn.active{background:rgba(184,148,42,0.14);color:#1A1714;font-weight:500}

/* MAIN */
.main{flex:1;display:flex;flex-direction:column;overflow:hidden}
.topbar{height:52px;border-bottom:0.5px solid rgba(26,23,20,0.1);display:flex;align-items:center;padding:0 20px;gap:12px;flex-shrink:0;background:#FAF8F4}
.topbar-title{font-family:'Cormorant Garamond',Georgia,serif;font-size:18px;font-weight:300;flex:1}
.topbar-title span{color:#B8942A}
.topbar-count{font-size:11px;color:#8A8178}
.topbar-search{padding:6px 12px;border:0.5px solid rgba(26,23,20,0.18);border-radius:4px;font-size:12px;background:#FAF8F4;outline:none;font-family:'DM Sans',sans-serif;color:#1A1714;width:200px}
.topbar-search:focus{border-color:#B8942A;box-shadow:0 0 0 2px rgba(184,148,42,0.1)}
.topbar-home{font-size:12px;color:#8A8178;text-decoration:none;padding:6px 10px;border:0.5px solid rgba(26,23,20,0.15);border-radius:4px;transition:all .15s}
.topbar-home:hover{color:#1A1714;border-color:rgba(26,23,20,0.3)}

/* GRID */
.grid-area{flex:1;overflow-y:auto;padding:20px}
.grid-area::-webkit-scrollbar{width:6px}
.grid-area::-webkit-scrollbar-track{background:transparent}
.grid-area::-webkit-scrollbar-thumb{background:rgba(26,23,20,0.15);border-radius:3px}
.art-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:14px}
.art-card{cursor:pointer;border-radius:6px;overflow:hidden;background:#EDE8DF;box-shadow:0 1px 3px rgba(26,23,20,0.08);transition:box-shadow .2s,transform .2s}
.art-card:hover{box-shadow:0 8px 28px rgba(26,23,20,0.16);transform:translateY(-2px)}
.card-img{aspect-ratio:3/4;background:#D4CEC3;overflow:hidden;position:relative}
.card-img img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .35s ease}
.art-card:hover .card-img img{transform:scale(1.04)}
.card-ph{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:32px;color:#B8942A}
.card-info{padding:8px 10px 10px;background:#FAF8F4}
.card-title{font-family:'Cormorant Garamond',Georgia,serif;font-size:13px;line-height:1.25;color:#1A1714;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;margin-bottom:3px}
.card-artist{font-size:10px;color:#8A8178;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.card-date{font-size:10px;color:#6A6058;margin-top:2px}

/* SKELETON */
.skeleton{animation:pulse 1.5s ease-in-out infinite}
.sk-img{aspect-ratio:3/4;background:#E0DAD0;border-radius:6px 6px 0 0}
.sk-body{padding:8px 10px 10px;background:#FAF8F4;border-radius:0 0 6px 6px}
.sk-line{height:9px;background:#D4CEC3;border-radius:3px;margin-bottom:6px}
@keyframes pulse{0%,100%{opacity:.5}50%{opacity:1}}

/* EMPTY */
.empty{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;color:#8A8178;gap:12px;padding:40px}
.empty-icon{font-size:48px}
.empty-text{font-family:'Cormorant Garamond',Georgia,serif;font-size:22px;font-weight:300}
.empty-sub{font-size:13px;text-align:center;max-width:320px;line-height:1.6}

/* LOAD MORE */
.load-more-wrap{text-align:center;padding:20px 0 32px}
.load-btn{padding:8px 22px;border:0.5px solid rgba(26,23,20,0.2);border-radius:4px;font-size:12px;font-weight:500;cursor:pointer;background:transparent;font-family:'DM Sans',sans-serif;color:#1A1714;transition:background .15s}
.load-btn:hover{background:rgba(26,23,20,0.05)}

/* MODAL */
.modal-bg{position:fixed;inset:0;background:rgba(26,23,20,0.72);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(4px)}
.modal{background:#FAF8F4;border-radius:10px;max-width:800px;width:100%;max-height:90vh;overflow:hidden;position:relative;box-shadow:0 28px 70px rgba(26,23,20,0.3);display:flex}
.modal-img{background:#2C2318;flex:0 0 320px;display:flex;align-items:center;justify-content:center}
.modal-img img{width:100%;height:100%;object-fit:contain;max-height:560px}
.modal-img-ph{font-size:64px;color:#B8942A}
.modal-detail{flex:1;padding:28px 24px;overflow-y:auto;display:flex;flex-direction:column;gap:10px}
.modal-close{position:absolute;top:12px;right:12px;width:30px;height:30px;border-radius:50%;background:rgba(26,23,20,0.5);border:none;color:#FAF8F4;font-size:18px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:10;line-height:1;transition:background .15s}
.modal-close:hover{background:rgba(26,23,20,0.8)}
.modal-source{font-size:9px;text-transform:uppercase;letter-spacing:.18em;color:#B8942A;font-weight:500}
.modal-title{font-family:'Cormorant Garamond',Georgia,serif;font-size:22px;font-weight:300;line-height:1.15}
.modal-artist{font-size:13px;color:#4A4540}
.divider{height:0.5px;background:rgba(26,23,20,0.1)}
.meta-row{display:flex;gap:20px;flex-wrap:wrap}
.meta-item label{font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:#8A8178;display:block;margin-bottom:2px}
.meta-item span{font-size:12px;font-weight:500;color:#1A1714}
.modal-bio{font-size:12px;color:#4A4540;line-height:1.75}
.modal-links{display:flex;flex-direction:column;gap:7px;margin-top:auto}
.mlink{display:block;text-align:center;padding:10px;border-radius:4px;font-size:12px;font-weight:500;cursor:pointer;font-family:'DM Sans',sans-serif;transition:all .15s;border:none;text-decoration:none}
.mlink-primary{background:#1A1714;color:#FAF8F4}
.mlink-primary:hover{background:#2C2318}
.mlink-sec{background:transparent;color:#1A1714;border:0.5px solid rgba(26,23,20,0.2)}
.mlink-sec:hover{background:rgba(26,23,20,0.05)}

@media(max-width:700px){
  .sidebar{display:none}
  .modal{flex-direction:column}
  .modal-img{flex:0 0 220px}
  .art-grid{grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:10px}
}
`;

function fmt(s) {
  return (s || '')
    .replace('Metropolitan Museum of Art', 'Met')
    .replace('Art Institute of Chicago', 'Art Inst. Chicago')
    .replace('Victoria & Albert Museum', 'V&A')
    .replace('Smithsonian Institution', 'Smithsonian')
    .replace(/^Europeana — /, '')
    .split(',')[0];
}

export default function Viewer() {
  const [selected, setSelected]   = useState(null);
  const [works, setWorks]         = useState([]);
  const [loading, setLoading]     = useState(false);
  const [hasMore, setHasMore]     = useState(false);
  const [modal, setModal]         = useState(null);
  const [imgErrors, setImgErrors] = useState({});
  const [searchInput, setSearch]  = useState('');
  const [totalDb, setTotalDb]     = useState(null);

  useEffect(() => {
    document.title = 'Global Museum Viewer — Public Art Collections';
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

  const loadWorks = useCallback(async (museum, offset = 0, append = false) => {
    if (!museum) return;
    setLoading(true);
    try {
      let url;
      if (museum.searchMode) {
        url = `/api/artworks?limit=48&offset=${offset}&search=${encodeURIComponent(museum.source)}`;
      } else {
        url = `/api/artworks?limit=48&offset=${offset}&source=${encodeURIComponent(museum.source)}`;
      }
      const data = await fetch(url).then(r => r.json());
      const w = data.works || [];
      if (append) {
        setWorks(prev => [...prev, ...w]);
      } else {
        setWorks(w);
        setImgErrors({});
      }
      setHasMore(w.length === 48);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  const handleSelect = museum => {
    setSelected(museum);
    setSearch('');
    loadWorks(museum, 0, false);
  };

  const handleSearch = e => {
    if (e.key !== 'Enter' || !searchInput.trim() || !selected) return;
    setLoading(true);
    const url = `/api/artworks?limit=48&offset=0&source=${encodeURIComponent(selected.source)}&search=${encodeURIComponent(searchInput.trim())}`;
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
            <div className="sidebar-sub">{totalDb ? `${Number(totalDb).toLocaleString()} works` : 'World Museums'}</div>
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
          <div className="topbar">
            <div className="topbar-title">
              {selected ? selected.label : <span>Select a museum</span>}
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
            {works.length > 0 && !loading && (
              <span className="topbar-count">{works.length}{hasMore ? '+' : ''} works</span>
            )}
            <a href="/" className="topbar-home">← Home</a>
          </div>

          <div className="grid-area">
            {!selected ? (
              <div className="empty">
                <div className="empty-icon">🏛️</div>
                <div className="empty-text">World Museums</div>
                <div className="empty-sub">
                  Select a museum from the sidebar to browse its collection.
                  {totalDb && ` ${Number(totalDb).toLocaleString()} works across ${ALL_MUSEUMS.length} institutions.`}
                </div>
              </div>
            ) : loading && works.length === 0 ? (
              <div className="art-grid">
                {Array.from({ length: 24 }).map((_, i) => (
                  <div key={i} className="skeleton">
                    <div className="sk-img" />
                    <div className="sk-body">
                      <div className="sk-line" style={{ width: '70%' }} />
                      <div className="sk-line" style={{ width: '45%' }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : works.length === 0 ? (
              <div className="empty">
                <div className="empty-icon">🔍</div>
                <div className="empty-text">No works found</div>
                <div className="empty-sub">
                  {selected.label} may not have synced yet, or no public-domain images are available.
                </div>
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
                      </div>
                      <div className="card-info">
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
                      onClick={() => loadWorks(selected, works.length, true)}
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
              <div className="modal-source">{fmt(modal.source)}</div>
              <div className="modal-title">{modal.title}</div>
              <div className="modal-artist">
                {[modal.artist, modal.date_text].filter(Boolean).join(' · ') || 'Unknown artist'}
              </div>
              <div className="divider" />
              <div className="meta-row">
                {modal.medium && (
                  <div className="meta-item">
                    <label>Medium</label>
                    <span>{modal.medium}</span>
                  </div>
                )}
                <div className="meta-item">
                  <label>Rights</label>
                  <span style={{ color: '#16a34a' }}>{modal.rights_label || 'CC0'}</span>
                </div>
                {modal.department && (
                  <div className="meta-item">
                    <label>Department</label>
                    <span>{modal.department}</span>
                  </div>
                )}
              </div>
              {modal.bio && (
                <>
                  <div className="divider" />
                  <div className="modal-bio">{modal.bio.slice(0, 300)}</div>
                </>
              )}
              <div className="divider" />
              <div>
                <div style={{fontSize:10,textTransform:'uppercase',letterSpacing:'.1em',color:'#8A8178',marginBottom:10}}>Order as</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}}>
                  {[
                    {emoji:'🖼️', name:'Fine Art Print', price:'from $18'},
                    {emoji:'🎨', name:'Canvas Wrap',    price:'from $45'},
                    {emoji:'👕', name:'T-Shirt',        price:'from $24'},
                    {emoji:'☕', name:'Mug',            price:'from $14'},
                    {emoji:'📱', name:'Phone Case',     price:'from $19'},
                    {emoji:'🛍️', name:'Tote Bag',       price:'from $16'},
                  ].map(p => (
                    <div key={p.name}
                      onClick={() => window.location.href = `/?order=1&product=${encodeURIComponent(p.name)}&work=${encodeURIComponent(modal.title)}&img=${encodeURIComponent(modal.full_url||modal.thumb_url||'')}`}
                      style={{background:'#2C2318',border:'0.5px solid #3A3028',borderRadius:6,padding:'10px 8px',textAlign:'center',cursor:'pointer',transition:'all .15s',color:'#F0EAD8'}}
                      onMouseEnter={e=>{e.currentTarget.style.background='#B8942A';e.currentTarget.style.color='#1A1714';}}
                      onMouseLeave={e=>{e.currentTarget.style.background='#2C2318';e.currentTarget.style.color='#F0EAD8';}}>
                      <div style={{fontSize:20,marginBottom:4}}>{p.emoji}</div>
                      <div style={{fontSize:11,fontWeight:500,marginBottom:2}}>{p.name}</div>
                      <div style={{fontSize:10,opacity:.7}}>{p.price}</div>
                    </div>
                  ))}
                </div>
              </div>
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
    </>
  );
}
