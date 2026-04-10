import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';

const API_BASE = '/api';

const SOURCES = [
  { key: 'all',         label: 'All sources' },
  { key: 'met',         label: 'Met Museum' },
  { key: 'artic',       label: 'Art Inst. Chicago' },
  { key: 'cleveland',   label: 'Cleveland' },
  { key: 'vam',         label: 'V&A Museum' },
  { key: 'smk',         label: 'SMK Denmark' },
  { key: 'smithsonian', label: 'Smithsonian' },
];

const MOVEMENTS = [
  { key: 'all',          label: 'All movements' },
  { key: 'impressionism',label: 'Impressionism' },
  { key: 'baroque',      label: 'Baroque' },
  { key: 'renaissance',  label: 'Renaissance' },
  { key: 'modern',       label: 'Modern' },
  { key: 'portrait',     label: 'Portrait' },
  { key: 'landscape',    label: 'Landscape' },
  { key: 'still life',   label: 'Still life' },
];

const PRODUCTS = [
  { emoji: '🖼️', name: 'Fine art print', from: 18 },
  { emoji: '🎨', name: 'Canvas wrap',    from: 45 },
  { emoji: '👕', name: 'T-shirt',        from: 24 },
  { emoji: '☕', name: 'Mug',            from: 14 },
  { emoji: '📱', name: 'Phone case',     from: 19 },
  { emoji: '🛍️', name: 'Tote bag',       from: 16 },
];

export default function Gallery() {
  const [works,       setWorks]       = useState([]);
  const [total,       setTotal]       = useState(null);
  const [loading,     setLoading]     = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset,      setOffset]      = useState(0);
  const [hasMore,     setHasMore]     = useState(true);
  const [search,      setSearch]      = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [movement,    setMovement]    = useState('all');
  const [source,      setSource]      = useState('all');
  const [selected,    setSelected]    = useState(null);
  const [heroIdx,     setHeroIdx]     = useState(0);
  const [navOpen,     setNavOpen]     = useState(false);

  const PAGE = 24;

  // ── FETCH COUNT ───────────────────────────────────────────
  useEffect(() => {
    fetch(`${API_BASE}/artworks?count=true`)
      .then(r => r.json())
      .then(d => setTotal(d.total))
      .catch(() => {});
  }, []);

  // ── FETCH WORKS ───────────────────────────────────────────
  const fetchWorks = useCallback(async (reset = false) => {
    const currentOffset = reset ? 0 : offset;
    if (!reset && loadingMore) return;

    reset ? setLoading(true) : setLoadingMore(true);

    try {
      const params = new URLSearchParams({ limit: PAGE, offset: currentOffset });
      if (search)              params.set('search', search);
      if (movement !== 'all')  params.set('search', movement);
      if (source !== 'all')    params.set('search', source);

      const d = await fetch(`${API_BASE}/artworks?${params}`).then(r => r.json());
      const newWorks = d.works || [];

      setWorks(prev => reset ? newWorks : [...prev, ...newWorks]);
      setOffset(currentOffset + newWorks.length);
      setHasMore(newWorks.length === PAGE);
    } catch(e) {}

    reset ? setLoading(false) : setLoadingMore(false);
  }, [search, movement, source, offset, loadingMore]);

  useEffect(() => {
    setOffset(0);
    setWorks([]);
    setHasMore(true);
    fetchWorks(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, movement, source]);

  // ── HERO ROTATION ─────────────────────────────────────────
  useEffect(() => {
    if (!works.length) return;
    const t = setInterval(() => setHeroIdx(i => (i + 1) % Math.min(works.length, 8)), 5000);
    return () => clearInterval(t);
  }, [works.length]);

  const heroWork = works[heroIdx] || null;

  // ── HELPERS ───────────────────────────────────────────────
  const sourceShort = (s) => (s || '')
    .replace('Victoria & Albert Museum', 'V&A')
    .replace('Metropolitan Museum of Art', 'Met Museum')
    .replace('Art Institute of Chicago', 'Art Inst. Chicago')
    .replace('SMK National Gallery of Denmark', 'SMK Denmark')
    .replace('Smithsonian Institution', 'Smithsonian')
    .replace(/^Europeana — /, '')
    .split(',')[0];

  const handleSearch = (e) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  // ── STYLES ────────────────────────────────────────────────
  const s = {
    // Layout
    body:      { margin:0, fontFamily:"'DM Sans', system-ui, sans-serif", background:'#FAF8F4', color:'#1A1714' },
    nav:       { position:'fixed', top:0, left:0, right:0, height:64, display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 32px', background:'rgba(250,248,244,0.95)', backdropFilter:'blur(12px)', borderBottom:'0.5px solid rgba(26,23,20,0.12)', zIndex:100 },
    logo:      { fontFamily:"'Cormorant Garamond', Georgia, serif", fontSize:20, fontWeight:400, color:'#1A1714', textDecoration:'none' },
    logoSpan:  { color:'#B8942A' },
    navLinks:  { display:'flex', gap:28, fontSize:13, color:'#4A4540' },
    navLink:   { textDecoration:'none', color:'inherit', cursor:'pointer' },
    btnPrimary:{ background:'#1A1714', color:'#FAF8F4', padding:'9px 22px', borderRadius:4, fontSize:13, fontWeight:500, border:'none', cursor:'pointer', textDecoration:'none', display:'inline-block' },
    btnOutline:{ background:'transparent', color:'#1A1714', padding:'9px 22px', borderRadius:4, fontSize:13, fontWeight:500, border:'1px solid rgba(26,23,20,0.25)', cursor:'pointer', display:'inline-block', textDecoration:'none' },
    btnGold:   { background:'#B8942A', color:'#FAF8F4', padding:'9px 22px', borderRadius:4, fontSize:13, fontWeight:500, border:'none', cursor:'pointer', display:'inline-block', textDecoration:'none' },

    // Hero
    hero:      { marginTop:64, minHeight:'85vh', display:'grid', gridTemplateColumns:'1fr 1fr', alignItems:'center', gap:64, padding:'64px 64px', maxWidth:1280, margin:'64px auto 0' },
    heroEyebrow:{ fontSize:11, letterSpacing:'0.12em', textTransform:'uppercase', color:'#8A8178', marginBottom:16 },
    heroH1:    { fontFamily:"'Cormorant Garamond', Georgia, serif", fontSize:'clamp(48px,5.5vw,80px)', fontWeight:300, lineHeight:1.05, marginBottom:24 },
    heroSub:   { fontSize:16, color:'#4A4540', lineHeight:1.7, marginBottom:40, maxWidth:440 },
    heroActions:{ display:'flex', gap:16, flexWrap:'wrap' },
    frameOuter:{ background:'#2C2318', padding:18, borderRadius:2, boxShadow:'0 8px 48px rgba(26,23,20,0.2)', position:'relative' },
    frameInner:{ width:'100%', aspectRatio:'4/5', overflow:'hidden', position:'relative', background:'#EDE8DF' },
    frameImg:  { width:'100%', height:'100%', objectFit:'cover', transition:'opacity 0.8s' },
    frameCaption:{ position:'absolute', bottom:0, left:0, right:0, background:'linear-gradient(transparent,rgba(26,23,20,0.75))', color:'#F0EAD8', padding:'24px 16px 12px', fontSize:12 },

    // Repos bar
    reposBar:  { background:'#EDE8DF', borderTop:'0.5px solid rgba(26,23,20,0.12)', borderBottom:'0.5px solid rgba(26,23,20,0.12)', padding:'14px 64px', display:'flex', alignItems:'center', gap:24, overflowX:'auto' },
    reposLabel:{ fontSize:11, textTransform:'uppercase', letterSpacing:'0.1em', color:'#8A8178', whiteSpace:'nowrap' },

    // Gallery
    gallerySection:{ maxWidth:1280, margin:'0 auto', padding:'48px 32px' },
    galleryHeader: { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 },
    galleryH2: { fontFamily:"'Cormorant Garamond', Georgia, serif", fontSize:36, fontWeight:300 },

    // Search
    searchForm:{ display:'flex', gap:8, marginBottom:24 },
    searchInput:{ flex:1, padding:'10px 16px', border:'0.5px solid rgba(26,23,20,0.25)', borderRadius:4, fontSize:14, fontFamily:"'DM Sans', system-ui, sans-serif", background:'#FAF8F4', outline:'none' },
    searchBtn: { padding:'10px 20px', background:'#1A1714', color:'#FAF8F4', border:'none', borderRadius:4, fontSize:13, cursor:'pointer', fontFamily:"'DM Sans', system-ui, sans-serif" },

    // Filters
    filters:   { display:'flex', gap:8, flexWrap:'wrap', marginBottom:24, paddingBottom:16, borderBottom:'0.5px solid rgba(26,23,20,0.12)' },
    pill:      { padding:'5px 14px', borderRadius:20, fontSize:12, cursor:'pointer', border:'0.5px solid rgba(26,23,20,0.25)', background:'transparent', color:'#4A4540', fontFamily:"'DM Sans', system-ui, sans-serif", whiteSpace:'nowrap' },
    pillActive:{ padding:'5px 14px', borderRadius:20, fontSize:12, cursor:'pointer', border:'0.5px solid #1A1714', background:'#1A1714', color:'#FAF8F4', fontFamily:"'DM Sans', system-ui, sans-serif", whiteSpace:'nowrap' },

    // Grid
    grid:      { display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:24, marginBottom:40 },
    card:      { cursor:'pointer', transition:'transform .2s' },
    cardThumb: { aspectRatio:'3/4', background:'#EDE8DF', overflow:'hidden', position:'relative', marginBottom:12 },
    cardImg:   { width:'100%', height:'100%', objectFit:'cover', transition:'opacity .3s' },
    cardOverlay:{ position:'absolute', inset:0, background:'rgba(26,23,20,0.6)', display:'flex', alignItems:'center', justifyContent:'center', opacity:0, transition:'opacity .2s' },
    overlayBtn:{ background:'#FAF8F4', color:'#1A1714', padding:'8px 20px', borderRadius:4, fontSize:12, fontWeight:500 },
    cardSource:{ fontSize:10, textTransform:'uppercase', letterSpacing:'0.1em', color:'#B8942A', marginBottom:4 },
    cardTitle: { fontFamily:"'Cormorant Garamond', Georgia, serif", fontSize:18, fontWeight:400, marginBottom:2, lineHeight:1.2 },
    cardArtist:{ fontSize:12, color:'#8A8178', marginBottom:6 },
    cardBottom:{ display:'flex', alignItems:'center', justifyContent:'space-between' },
    cardPrice: { fontSize:12, fontWeight:500 },
    cardRights:{ fontSize:10, padding:'2px 7px', borderRadius:10, background:'#DCFCE7', color:'#166534' },

    // Loading
    loadingWrap:{ gridColumn:'1/-1', padding:'64px 0', textAlign:'center', color:'#8A8178' },
    loadMoreWrap:{ textAlign:'center', paddingBottom:32 },

    // Modal
    modalBg:   { position:'fixed', inset:0, background:'rgba(26,23,20,0.65)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:24 },
    modal:     { background:'#FAF8F4', borderRadius:12, maxWidth:820, width:'100%', maxHeight:'90vh', overflowY:'auto', position:'relative', boxShadow:'0 8px 48px rgba(26,23,20,0.2)' },
    modalLayout:{ display:'grid', gridTemplateColumns:'1fr 1fr' },
    modalImg:  { background:'#EDE8DF', minHeight:400, overflow:'hidden' },
    modalInfo: { padding:'36px 28px', display:'flex', flexDirection:'column', gap:10 },
    modalClose:{ position:'absolute', top:14, right:18, background:'none', border:'none', fontSize:28, cursor:'pointer', color:'#8A8178', lineHeight:1, zIndex:1 },
    modalSource:{ fontSize:10, textTransform:'uppercase', letterSpacing:'0.12em', color:'#B8942A' },
    modalTitle:{ fontFamily:"'Cormorant Garamond', Georgia, serif", fontSize:30, fontWeight:300, lineHeight:1.15 },
    modalArtist:{ fontSize:13, color:'#4A4540' },
    modalMeta: { display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, padding:'12px 0', borderTop:'0.5px solid rgba(26,23,20,0.12)', borderBottom:'0.5px solid rgba(26,23,20,0.12)' },
    metaItem:  { display:'flex', flexDirection:'column', gap:2 },
    metaLabel: { fontSize:10, textTransform:'uppercase', letterSpacing:'0.1em', color:'#8A8178' },
    metaValue: { fontSize:13, fontWeight:500 },
    modalBio:  { fontSize:12, color:'#4A4540', lineHeight:1.7 },
    prodsLabel:{ fontSize:11, textTransform:'uppercase', letterSpacing:'0.1em', color:'#8A8178' },
    prodsGrid: { display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6 },
    prodOpt:   { background:'#EDE8DF', border:'0.5px solid rgba(26,23,20,0.12)', borderRadius:4, padding:'8px 4px', textAlign:'center', cursor:'pointer', fontSize:11, color:'#4A4540' },
    prodIcon:  { fontSize:18, display:'block', marginBottom:4 },
    prodPrice: { fontSize:10, opacity:.7 },
    modalActions:{ display:'flex', flexDirection:'column', gap:8 },

    // Footer
    footer:    { background:'#2C2318', color:'#B0A898', padding:'48px 32px 24px' },
    footerTop: { maxWidth:1280, margin:'0 auto', display:'grid', gridTemplateColumns:'1fr 2fr', gap:48, marginBottom:32 },
    footerBrand:{ display:'flex', flexDirection:'column', gap:12 },
    footerLogo:{ fontFamily:"'Cormorant Garamond', Georgia, serif", fontSize:20, fontWeight:400, color:'#F3EFE8' },
    footerP:   { fontSize:13, lineHeight:1.7 },
    footerLinks:{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:24 },
    footerCol: { display:'flex', flexDirection:'column', gap:8 },
    footerH4:  { fontFamily:"'Cormorant Garamond', Georgia, serif", fontSize:18, fontWeight:400, color:'#F3EFE8', marginBottom:6 },
    footerLink:{ fontSize:13, color:'#B0A898', textDecoration:'none', cursor:'pointer' },
    footerBottom:{ borderTop:'0.5px solid rgba(240,234,214,0.1)', paddingTop:20, maxWidth:1280, margin:'0 auto', fontSize:12, color:'#6A6058' },
  };

  return (
    <>
      <Head>
        <title>Public Art Collections — The World's Art, In Your Home</title>
        <meta name="viewport" content="width=device-width, initial-scale=1"/>
        <link rel="preconnect" href="https://fonts.googleapis.com"/>
        <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,300;1,400&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet"/>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { background: #FAF8F4; }
          .art-card:hover .card-overlay { opacity: 1 !important; }
          .art-card:hover { transform: translateY(-3px); }
          .art-card:hover .card-img { transform: scale(1.03); }
          .pill-btn:hover { background: #EDE8DF !important; }
          .prod-opt:hover { background: #1A1714 !important; color: #FAF8F4 !important; }
          input:focus { border-color: #B8942A !important; }
          @media (max-width: 900px) {
            .hero-grid { grid-template-columns: 1fr !important; }
            .gallery-grid { grid-template-columns: repeat(2,1fr) !important; }
            .modal-layout { grid-template-columns: 1fr !important; }
            .footer-top { grid-template-columns: 1fr !important; }
            .footer-links { grid-template-columns: 1fr 1fr !important; }
          }
          @media (max-width: 540px) {
            .gallery-grid { grid-template-columns: 1fr !important; }
            .hero-grid { padding: 32px 20px !important; }
          }
        `}</style>
      </Head>

      <div style={s.body}>

        {/* NAV */}
        <nav style={s.nav}>
          <span style={s.logo}>Public Art <span style={s.logoSpan}>Collections</span></span>
          <div style={s.navLinks}>
            <a style={s.navLink} href="#gallery">Gallery</a>
            <a style={s.navLink} href="/api/artworks">API</a>
            <a style={s.navLink} href={`/api/sync?secret=${process.env.NEXT_PUBLIC_SYNC_HINT||''}`}>Sync</a>
          </div>
          <div style={{display:'flex',gap:10,alignItems:'center'}}>
            {total && <span style={{fontSize:12,color:'#8A8178'}}>{Number(total).toLocaleString()} works</span>}
            <a href="/api/artworks" style={s.btnPrimary}>Browse API</a>
          </div>
        </nav>

        {/* HERO */}
        <div style={{...s.hero, paddingTop:96}} className="hero-grid">
          <div>
            <p style={s.heroEyebrow}>{total ? Number(total).toLocaleString() + '+ works' : '5,000+ works'} · 7 museum sources</p>
            <h1 style={s.heroH1}>
              The world's art,<br/>
              <em style={{fontStyle:'italic',color:'#B8942A'}}>in your home</em>
            </h1>
            <p style={s.heroSub}>
              Stream museum masterpieces to your TV. Buy any piece as a fine art print,
              canvas, mug, or tee — shipped to your door.
            </p>
            <div style={s.heroActions}>
              <a href="#gallery" style={s.btnPrimary}>Browse the collection</a>
              <a href="/api/artworks" style={s.btnOutline}>View API</a>
            </div>
          </div>
          <div style={s.frameOuter}>
            <div style={s.frameInner}>
              {heroWork?.thumb_url ? (
                <img
                  key={heroWork.id}
                  src={heroWork.thumb_url}
                  alt={heroWork.title}
                  style={s.frameImg}
                  onError={e => { e.target.style.display='none'; }}
                />
              ) : (
                <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',fontSize:96,color:'#B8942A'}}>🖼️</div>
              )}
              {heroWork && (
                <div style={s.frameCaption}>
                  <strong style={{display:'block',fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:16,fontWeight:400}}>
                    {heroWork.title}
                  </strong>
                  {heroWork.artist} {heroWork.date_text ? '· ' + heroWork.date_text : ''}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* REPOS BAR */}
        <div style={s.reposBar}>
          <span style={s.reposLabel}>Works sourced from</span>
          <span style={{fontSize:12,color:'#4A4540',whiteSpace:'nowrap'}}>
            Metropolitan Museum · Art Institute of Chicago · Cleveland Museum · V&A Museum · SMK Denmark · Smithsonian · Europeana
          </span>
        </div>

        {/* GALLERY */}
        <section style={s.gallerySection} id="gallery">
          <div style={s.galleryHeader}>
            <h2 style={s.galleryH2}>
              Browse the collection
              {total && <span style={{color:'#B8942A',fontWeight:300,fontSize:24}}> — {Number(total).toLocaleString()}+ works</span>}
            </h2>
          </div>

          {/* SEARCH */}
          <form style={s.searchForm} onSubmit={handleSearch}>
            <input
              style={s.searchInput}
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              placeholder="Search by title, artist, or keyword…"
            />
            <button type="submit" style={s.searchBtn}>Search</button>
            {search && (
              <button type="button" style={s.btnOutline} onClick={() => { setSearch(''); setSearchInput(''); }}>
                Clear
              </button>
            )}
          </form>

          {/* MOVEMENT FILTERS */}
          <div style={s.filters}>
            {MOVEMENTS.map(m => (
              <button
                key={m.key}
                className="pill-btn"
                style={movement === m.key ? s.pillActive : s.pill}
                onClick={() => setMovement(m.key)}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* SOURCE FILTERS */}
          <div style={{...s.filters, marginBottom:32}}>
            {SOURCES.map(src => (
              <button
                key={src.key}
                className="pill-btn"
                style={source === src.key ? s.pillActive : s.pill}
                onClick={() => setSource(src.key)}
              >
                {src.label}
              </button>
            ))}
          </div>

          {/* GRID */}
          {loading ? (
            <div style={{...s.loadingWrap, display:'grid'}}>
              <div style={s.loadingWrap}>
                <div style={{fontSize:32,marginBottom:12}}>⏳</div>
                <p style={{fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:24,fontWeight:300}}>Loading artworks…</p>
              </div>
            </div>
          ) : works.length === 0 ? (
            <div style={{padding:'64px 0',textAlign:'center',color:'#8A8178'}}>
              <div style={{fontSize:48,marginBottom:16}}>🔍</div>
              <p style={{fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:24,fontWeight:300}}>No works found</p>
              <p style={{fontSize:13,marginTop:8}}>Try a different search term or filter</p>
            </div>
          ) : (
            <div style={s.grid} className="gallery-grid">
              {works.map(w => (
                <div
                  key={w.id}
                  className="art-card"
                  style={s.card}
                  onClick={() => setSelected(w)}
                >
                  <div style={s.cardThumb}>
                    {w.thumb_url ? (
                      <img
                        src={w.thumb_url}
                        alt={w.title}
                        className="card-img"
                        style={s.cardImg}
                        loading="lazy"
                        onError={e => {
                          e.target.parentNode.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:48px;color:#B8942A">🖼️</div>';
                        }}
                      />
                    ) : (
                      <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',fontSize:48,color:'#B8942A'}}>🖼️</div>
                    )}
                    <div className="card-overlay" style={s.cardOverlay}>
                      <span style={s.overlayBtn}>View & order</span>
                    </div>
                  </div>
                  <div>
                    <div style={s.cardSource}>{sourceShort(w.source)}</div>
                    <div style={s.cardTitle}>{w.title}</div>
                    <div style={s.cardArtist}>{w.artist || 'Artist unknown'}{w.date_text ? ' · ' + w.date_text : ''}</div>
                    <div style={s.cardBottom}>
                      <div style={s.cardPrice}>Prints from $18</div>
                      <div style={s.cardRights}>{w.rights_label || 'CC0'}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* LOAD MORE */}
          {!loading && hasMore && works.length > 0 && (
            <div style={s.loadMoreWrap}>
              <button
                style={s.btnOutline}
                onClick={() => fetchWorks(false)}
                disabled={loadingMore}
              >
                {loadingMore ? 'Loading…' : 'Load more works'}
              </button>
            </div>
          )}
        </section>

        {/* STREAMING BANNER */}
        <div style={{background:'#2C2318',color:'#F3EFE8',padding:'64px 32px'}}>
          <div style={{maxWidth:1280,margin:'0 auto',display:'flex',alignItems:'center',gap:48,flexWrap:'wrap'}}>
            <div style={{flex:1,minWidth:280}}>
              <h2 style={{fontFamily:"'Cormorant Garamond',Georgia,serif",fontSize:40,fontWeight:300,marginBottom:16}}>
                Turn your TV into a gallery
              </h2>
              <p style={{fontSize:15,color:'#B0A898',lineHeight:1.7,marginBottom:28,maxWidth:480}}>
                Stream masterpieces to any TV. Scan the QR code on screen with your phone
                to read the artist story and order a print — all from your sofa.
              </p>
              <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
                <span style={s.btnGold}>Get the streaming app</span>
                <span style={{...s.btnOutline,color:'#F3EFE8',borderColor:'rgba(240,234,214,0.3)'}}>Buy USB drive — $39</span>
              </div>
            </div>
            <div style={{width:120,height:120,background:'#FAF8F4',borderRadius:10,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
              <svg width="72" height="72" viewBox="0 0 60 60" fill="none">
                <rect x="2" y="2" width="24" height="24" rx="2" stroke="#2C2318" strokeWidth="2" fill="none"/>
                <rect x="8" y="8" width="12" height="12" fill="#2C2318"/>
                <rect x="34" y="2" width="24" height="24" rx="2" stroke="#2C2318" strokeWidth="2" fill="none"/>
                <rect x="40" y="8" width="12" height="12" fill="#2C2318"/>
                <rect x="2" y="34" width="24" height="24" rx="2" stroke="#2C2318" strokeWidth="2" fill="none"/>
                <rect x="8" y="40" width="12" height="12" fill="#2C2318"/>
                <rect x="34" y="34" width="8" height="8" fill="#2C2318"/>
                <rect x="46" y="34" width="8" height="8" fill="#2C2318"/>
                <rect x="34" y="46" width="8" height="8" fill="#2C2318"/>
                <rect x="46" y="46" width="8" height="8" fill="#2C2318"/>
              </svg>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <footer style={s.footer}>
          <div style={s.footerTop} className="footer-top">
            <div style={s.footerBrand}>
              <div style={s.footerLogo}>Public Art <span style={{color:'#B8942A'}}>Collections</span></div>
              <p style={s.footerP}>Museum-quality art for every home. All works public domain, sourced from 7+ global repositories.</p>
            </div>
            <div style={s.footerLinks} className="footer-links">
              <div style={s.footerCol}>
                <div style={s.footerH4}>Gallery</div>
                <a style={s.footerLink} href="#gallery">Browse all</a>
                <a style={s.footerLink} onClick={() => setMovement('impressionism')}>Impressionism</a>
                <a style={s.footerLink} onClick={() => setMovement('portrait')}>Portraits</a>
                <a style={s.footerLink} onClick={() => setMovement('landscape')}>Landscapes</a>
              </div>
              <div style={s.footerCol}>
                <div style={s.footerH4}>Sources</div>
                <a style={s.footerLink} onClick={() => setSource('met')}>Met Museum</a>
                <a style={s.footerLink} onClick={() => setSource('artic')}>Art Inst. Chicago</a>
                <a style={s.footerLink} onClick={() => setSource('vam')}>V&A Museum</a>
                <a style={s.footerLink} onClick={() => setSource('smk')}>SMK Denmark</a>
              </div>
              <div style={s.footerCol}>
                <div style={s.footerH4}>Company</div>
                <a style={s.footerLink} href="mailto:hello@publicartcollections.org">Contact</a>
                <a style={s.footerLink} href="/api/artworks?count=true">Database stats</a>
              </div>
            </div>
          </div>
          <div style={s.footerBottom}>
            © 2025 publicartcollections.org · All artwork public domain · Prints fulfilled by Printful
          </div>
        </footer>

        {/* MODAL */}
        {selected && (
          <div style={s.modalBg} onClick={() => setSelected(null)}>
            <div style={s.modal} onClick={e => e.stopPropagation()} className="modal-layout-wrap">
              <button style={s.modalClose} onClick={() => setSelected(null)}>×</button>
              <div style={s.modalLayout} className="modal-layout">
                <div style={s.modalImg}>
                  {selected.thumb_url ? (
                    <img src={selected.full_url || selected.thumb_url} alt={selected.title}
                      style={{width:'100%',height:'100%',objectFit:'cover'}}
                      onError={e => { e.target.src = selected.thumb_url; }}
                    />
                  ) : (
                    <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',fontSize:96}}>🖼️</div>
                  )}
                </div>
                <div style={s.modalInfo}>
                  <div style={s.modalSource}>{sourceShort(selected.source)}</div>
                  <div style={s.modalTitle}>{selected.title}</div>
                  <div style={s.modalArtist}>{[selected.artist, selected.date_text].filter(Boolean).join(' · ')}</div>
                  <div style={s.modalMeta}>
                    <div style={s.metaItem}><div style={s.metaLabel}>Medium</div><div style={s.metaValue}>{selected.medium || '—'}</div></div>
                    <div style={s.metaItem}><div style={s.metaLabel}>Rights</div><div style={{...s.metaValue,color:'#16a34a'}}>{selected.rights_label || 'CC0'}</div></div>
                    <div style={s.metaItem}><div style={s.metaLabel}>Source</div><div style={s.metaValue}>{sourceShort(selected.source)}</div></div>
                    <div style={s.metaItem}><div style={s.metaLabel}>Date</div><div style={s.metaValue}>{selected.date_text || '—'}</div></div>
                  </div>
                  {selected.bio && <div style={s.modalBio}>{selected.bio.slice(0,300)}{selected.bio.length > 300 ? '…' : ''}</div>}
                  <div>
                    <div style={s.prodsLabel}>Order as</div>
                    <div style={s.prodsGrid}>
                      {PRODUCTS.map(p => (
                        <div key={p.name} className="prod-opt" style={s.prodOpt}>
                          <span style={s.prodIcon}>{p.emoji}</span>
                          {p.name}<br/>
                          <span style={s.prodPrice}>from ${p.from}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div style={s.modalActions}>
                    <button style={s.btnPrimary}>Order a print →</button>
                    {selected.detail_url && (
                      <a href={selected.detail_url} target="_blank" rel="noopener noreferrer" style={s.btnOutline}>
                        View on museum website ↗
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );
}
