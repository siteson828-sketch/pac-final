import { useState, useEffect, useCallback } from 'react';

export default function Gallery() {
  const [works, setWorks] = useState([]);
  const [total, setTotal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [selected, setSelected] = useState(null);
  const [heroIdx, setHeroIdx] = useState(0);

  const PAGE = 24;

  useEffect(() => {
    fetch('/api/artworks?count=true')
      .then(r => r.json())
      .then(d => setTotal(d.total))
      .catch(() => {});
  }, []);

  const fetchWorks = useCallback(async (reset) => {
    const off = reset ? 0 : offset;
    if (!reset && loadingMore) return;
    reset ? setLoading(true) : setLoadingMore(true);
    try {
      const params = new URLSearchParams({ limit: PAGE, offset: off });
      if (search) params.set('search', search);
      const d = await fetch('/api/artworks?' + params).then(r => r.json());
      const newWorks = d.works || [];
      setWorks(prev => reset ? newWorks : [...prev, ...newWorks]);
      setOffset(off + newWorks.length);
      setHasMore(newWorks.length === PAGE);
    } catch(e) {}
    reset ? setLoading(false) : setLoadingMore(false);
  }, [search, offset, loadingMore]);

  useEffect(() => {
    setOffset(0);
    setWorks([]);
    fetchWorks(true);
  // eslint-disable-next-line
  }, [search]);

  useEffect(() => {
    if (!works.length) return;
    const t = setInterval(() => setHeroIdx(i => (i + 1) % Math.min(works.length, 8)), 5000);
    return () => clearInterval(t);
  }, [works.length]);

  const heroWork = works[heroIdx] || null;

  const shortSource = (s) => (s || '')
    .replace('Victoria & Albert Museum', 'V&A')
    .replace('Metropolitan Museum of Art', 'Met Museum')
    .replace('Art Institute of Chicago', 'Art Inst. Chicago')
    .replace('SMK National Gallery of Denmark', 'SMK Denmark')
    .replace('Smithsonian Institution', 'Smithsonian')
    .replace(/^Europeana — /, '');

  const PRODS = [
    { e:'🖼️', n:'Fine art print', f:18 },
    { e:'🎨', n:'Canvas wrap', f:45 },
    { e:'👕', n:'T-shirt', f:24 },
    { e:'☕', n:'Mug', f:14 },
    { e:'📱', n:'Phone case', f:19 },
    { e:'🛍️', n:'Tote bag', f:16 },
  ];

  return (
    <div style={{fontFamily:'system-ui,sans-serif',background:'#FAF8F4',color:'#1A1714',minHeight:'100vh'}}>

      {/* FONTS */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,400&family=DM+Sans:wght@400;500&display=swap" rel="stylesheet" />

      {/* NAV */}
      <nav style={{position:'fixed',top:0,left:0,right:0,height:64,display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 32px',background:'rgba(250,248,244,0.95)',borderBottom:'0.5px solid rgba(26,23,20,0.12)',zIndex:100}}>
        <span style={{fontFamily:'Georgia,serif',fontSize:20,fontWeight:400}}>
          Public Art <span style={{color:'#B8942A'}}>Collections</span>
        </span>
        <span style={{fontSize:13,color:'#8A8178'}}>
          {total ? Number(total).toLocaleString() + ' works' : ''}
        </span>
        <a href="/api/artworks" style={{fontSize:12,padding:'8px 18px',border:'1px solid rgba(26,23,20,0.25)',borderRadius:4,textDecoration:'none',color:'#1A1714'}}>API</a>
      </nav>

      {/* HERO */}
      <div style={{marginTop:64,display:'grid',gridTemplateColumns:'1fr 1fr',alignItems:'center',gap:48,padding:'64px',maxWidth:1280,marginLeft:'auto',marginRight:'auto'}}>
        <div>
          <p style={{fontSize:11,letterSpacing:'0.12em',textTransform:'uppercase',color:'#8A8178',marginBottom:16,fontFamily:'system-ui'}}>
            {total ? Number(total).toLocaleString() + '+ works' : '5,000+ works'} · 7 museum sources
          </p>
          <h1 style={{fontFamily:'Georgia,serif',fontSize:'clamp(44px,5vw,72px)',fontWeight:300,lineHeight:1.05,marginBottom:20}}>
            The world&apos;s art,<br/><em style={{fontStyle:'italic',color:'#B8942A'}}>in your home</em>
          </h1>
          <p style={{fontSize:15,color:'#4A4540',lineHeight:1.7,marginBottom:32,maxWidth:420}}>
            Browse 5,000+ museum masterpieces. Buy any piece as a fine art print, canvas, mug, or tee — shipped to your door.
          </p>
          <div style={{display:'flex',gap:14,flexWrap:'wrap'}}>
            <a href="#gallery" style={{background:'#1A1714',color:'#FAF8F4',padding:'10px 24px',borderRadius:4,fontSize:13,fontWeight:500,textDecoration:'none'}}>Browse collection</a>
            <a href="/api/artworks" style={{background:'transparent',color:'#1A1714',padding:'10px 24px',borderRadius:4,fontSize:13,fontWeight:500,textDecoration:'none',border:'1px solid rgba(26,23,20,0.25)'}}>View API</a>
          </div>
        </div>
        <div style={{background:'#2C2318',padding:16,borderRadius:2,boxShadow:'0 8px 48px rgba(26,23,20,0.2)'}}>
          <div style={{aspectRatio:'4/5',overflow:'hidden',background:'#EDE8DF',position:'relative'}}>
            {heroWork?.thumb_url ? (
              <img key={heroWork.id} src={heroWork.thumb_url} alt={heroWork.title}
                style={{width:'100%',height:'100%',objectFit:'cover',transition:'opacity .8s'}}
                onError={e => { e.currentTarget.style.display='none'; }}
              />
            ) : (
              <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',fontSize:80,color:'#B8942A'}}>🖼️</div>
            )}
            {heroWork && (
              <div style={{position:'absolute',bottom:0,left:0,right:0,background:'linear-gradient(transparent,rgba(26,23,20,0.75))',color:'#F0EAD8',padding:'20px 14px 10px',fontSize:12}}>
                <strong style={{display:'block',fontFamily:'Georgia,serif',fontSize:15,fontWeight:400}}>{heroWork.title}</strong>
                {heroWork.artist}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SOURCES BAR */}
      <div style={{background:'#EDE8DF',borderTop:'0.5px solid rgba(26,23,20,0.12)',borderBottom:'0.5px solid rgba(26,23,20,0.12)',padding:'12px 48px',display:'flex',alignItems:'center',gap:20,overflowX:'auto',fontSize:12,color:'#4A4540'}}>
        <span style={{fontSize:10,textTransform:'uppercase',letterSpacing:'.1em',color:'#8A8178',whiteSpace:'nowrap'}}>Sources</span>
        <span>Met Museum · Art Institute of Chicago · Cleveland Museum · V&amp;A Museum · SMK Denmark · Smithsonian</span>
      </div>

      {/* GALLERY */}
      <section style={{maxWidth:1280,margin:'0 auto',padding:'48px 32px'}} id="gallery">
        <h2 style={{fontFamily:'Georgia,serif',fontSize:34,fontWeight:300,marginBottom:24}}>
          Browse the collection
          {total && <span style={{color:'#B8942A'}}> — {Number(total).toLocaleString()}+ works</span>}
        </h2>

        {/* SEARCH */}
        <div style={{display:'flex',gap:8,marginBottom:28}}>
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && setSearch(searchInput)}
            placeholder="Search by title, artist, or keyword…"
            style={{flex:1,padding:'10px 16px',border:'0.5px solid rgba(26,23,20,0.25)',borderRadius:4,fontSize:14,background:'#FAF8F4',outline:'none',fontFamily:'system-ui'}}
          />
          <button onClick={() => setSearch(searchInput)} style={{background:'#1A1714',color:'#FAF8F4',padding:'10px 20px',border:'none',borderRadius:4,fontSize:13,cursor:'pointer',fontFamily:'system-ui'}}>Search</button>
          {search && <button onClick={() => { setSearch(''); setSearchInput(''); }} style={{background:'transparent',color:'#1A1714',padding:'10px 16px',border:'1px solid rgba(26,23,20,0.25)',borderRadius:4,fontSize:13,cursor:'pointer',fontFamily:'system-ui'}}>Clear</button>}
        </div>

        {/* GRID */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:20,marginBottom:40}}>
          {loading ? (
            <div style={{gridColumn:'1/-1',padding:'64px 0',textAlign:'center',color:'#8A8178'}}>
              <div style={{fontSize:32,marginBottom:12}}>⏳</div>
              <p style={{fontFamily:'Georgia,serif',fontSize:24,fontWeight:300}}>Loading artworks…</p>
            </div>
          ) : works.length === 0 ? (
            <div style={{gridColumn:'1/-1',padding:'64px 0',textAlign:'center',color:'#8A8178'}}>
              <div style={{fontSize:40,marginBottom:12}}>🔍</div>
              <p style={{fontFamily:'Georgia,serif',fontSize:24,fontWeight:300}}>No works found</p>
            </div>
          ) : works.map(w => (
            <div key={w.id} onClick={() => setSelected(w)}
              style={{cursor:'pointer',transition:'transform .2s'}}
              onMouseEnter={e => e.currentTarget.style.transform='translateY(-3px)'}
              onMouseLeave={e => e.currentTarget.style.transform='translateY(0)'}
            >
              <div style={{aspectRatio:'3/4',background:'#EDE8DF',overflow:'hidden',position:'relative',marginBottom:10}}>
                {w.thumb_url ? (
                  <img src={w.thumb_url} alt={w.title} loading="lazy"
                    style={{width:'100%',height:'100%',objectFit:'cover'}}
                    onError={e => { e.currentTarget.parentNode.innerHTML='<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:40px;color:#B8942A">🖼️</div>'; }}
                  />
                ) : (
                  <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',fontSize:40,color:'#B8942A'}}>🖼️</div>
                )}
              </div>
              <div style={{fontSize:10,textTransform:'uppercase',letterSpacing:'.1em',color:'#B8942A',marginBottom:3}}>{shortSource(w.source)}</div>
              <div style={{fontFamily:'Georgia,serif',fontSize:17,fontWeight:400,marginBottom:2,lineHeight:1.2}}>{w.title}</div>
              <div style={{fontSize:11,color:'#8A8178',marginBottom:5}}>{w.artist || 'Artist unknown'}{w.date_text ? ' · ' + w.date_text : ''}</div>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <span style={{fontSize:12,fontWeight:500}}>Prints from $18</span>
                <span style={{fontSize:10,padding:'2px 6px',borderRadius:10,background:'#DCFCE7',color:'#166534'}}>{w.rights_label || 'CC0'}</span>
              </div>
            </div>
          ))}
        </div>

        {!loading && hasMore && works.length > 0 && (
          <div style={{textAlign:'center',paddingBottom:32}}>
            <button onClick={() => fetchWorks(false)} disabled={loadingMore}
              style={{background:'transparent',color:'#1A1714',padding:'10px 28px',border:'1px solid rgba(26,23,20,0.25)',borderRadius:4,fontSize:13,cursor:'pointer',fontFamily:'system-ui'}}>
              {loadingMore ? 'Loading…' : 'Load more works'}
            </button>
          </div>
        )}
      </section>

      {/* FOOTER */}
      <footer style={{background:'#2C2318',color:'#B0A898',padding:'40px 32px 24px'}}>
        <div style={{maxWidth:1280,margin:'0 auto'}}>
          <div style={{fontFamily:'Georgia,serif',fontSize:20,color:'#F3EFE8',marginBottom:10}}>
            Public Art <span style={{color:'#B8942A'}}>Collections</span>
          </div>
          <p style={{fontSize:13,lineHeight:1.7,marginBottom:16}}>Museum-quality art for every home. All works public domain.</p>
          <div style={{borderTop:'0.5px solid rgba(240,234,214,0.1)',paddingTop:16,fontSize:12,color:'#6A6058'}}>
            © 2025 publicartcollections.org · All artwork public domain · Prints fulfilled by Printful
          </div>
        </div>
      </footer>

      {/* MODAL */}
      {selected && (
        <div onClick={() => setSelected(null)}
          style={{position:'fixed',inset:0,background:'rgba(26,23,20,0.65)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
          <div onClick={e => e.stopPropagation()}
            style={{background:'#FAF8F4',borderRadius:10,maxWidth:800,width:'100%',maxHeight:'90vh',overflowY:'auto',position:'relative',boxShadow:'0 8px 48px rgba(26,23,20,0.2)'}}>
            <button onClick={() => setSelected(null)}
              style={{position:'absolute',top:12,right:16,background:'none',border:'none',fontSize:28,cursor:'pointer',color:'#8A8178',lineHeight:1,zIndex:1}}>×</button>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr'}}>
              <div style={{background:'#EDE8DF',minHeight:380}}>
                {selected.thumb_url ? (
                  <img src={selected.full_url || selected.thumb_url} alt={selected.title}
                    style={{width:'100%',height:'100%',objectFit:'cover'}}
                    onError={e => { e.currentTarget.src = selected.thumb_url; }}
                  />
                ) : (
                  <div style={{display:'flex',alignItems:'center',justifyContent:'center',height:'100%',fontSize:80}}>🖼️</div>
                )}
              </div>
              <div style={{padding:'32px 24px',display:'flex',flexDirection:'column',gap:10}}>
                <div style={{fontSize:10,textTransform:'uppercase',letterSpacing:'.12em',color:'#B8942A'}}>{shortSource(selected.source)}</div>
                <div style={{fontFamily:'Georgia,serif',fontSize:28,fontWeight:300,lineHeight:1.15}}>{selected.title}</div>
                <div style={{fontSize:13,color:'#4A4540'}}>{[selected.artist,selected.date_text].filter(Boolean).join(' · ')}</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,padding:'12px 0',borderTop:'0.5px solid rgba(26,23,20,0.12)',borderBottom:'0.5px solid rgba(26,23,20,0.12)'}}>
                  <div><div style={{fontSize:10,textTransform:'uppercase',letterSpacing:'.1em',color:'#8A8178',marginBottom:2}}>Medium</div><div style={{fontSize:13,fontWeight:500}}>{selected.medium||'—'}</div></div>
                  <div><div style={{fontSize:10,textTransform:'uppercase',letterSpacing:'.1em',color:'#8A8178',marginBottom:2}}>Rights</div><div style={{fontSize:13,fontWeight:500,color:'#16a34a'}}>{selected.rights_label||'CC0'}</div></div>
                  <div><div style={{fontSize:10,textTransform:'uppercase',letterSpacing:'.1em',color:'#8A8178',marginBottom:2}}>Source</div><div style={{fontSize:13,fontWeight:500}}>{shortSource(selected.source)}</div></div>
                  <div><div style={{fontSize:10,textTransform:'uppercase',letterSpacing:'.1em',color:'#8A8178',marginBottom:2}}>Date</div><div style={{fontSize:13,fontWeight:500}}>{selected.date_text||'—'}</div></div>
                </div>
                {selected.bio && <div style={{fontSize:12,color:'#4A4540',lineHeight:1.7}}>{selected.bio.slice(0,280)}</div>}
                <div>
                  <div style={{fontSize:10,textTransform:'uppercase',letterSpacing:'.1em',color:'#8A8178',marginBottom:8}}>Order as</div>
                  <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:5}}>
                    {PRODS.map(p => (
                      <div key={p.n} style={{background:'#EDE8DF',borderRadius:4,padding:'8px 4px',textAlign:'center',cursor:'pointer',fontSize:11,color:'#4A4540'}}>
                        <span style={{fontSize:18,display:'block',marginBottom:3}}>{p.e}</span>
                        {p.n}<br/><span style={{opacity:.7,fontSize:10}}>from ${p.f}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div style={{display:'flex',flexDirection:'column',gap:8,marginTop:4}}>
                  <button style={{background:'#1A1714',color:'#FAF8F4',padding:'10px 20px',border:'none',borderRadius:4,fontSize:13,cursor:'pointer',fontFamily:'system-ui',fontWeight:500}}>Order a print →</button>
                  {selected.detail_url && (
                    <a href={selected.detail_url} target="_blank" rel="noopener noreferrer"
                      style={{background:'transparent',color:'#1A1714',padding:'10px 20px',border:'1px solid rgba(26,23,20,0.25)',borderRadius:4,fontSize:13,cursor:'pointer',textDecoration:'none',textAlign:'center'}}>
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
  );
}
