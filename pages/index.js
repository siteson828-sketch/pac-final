import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';

const MUSEUMS = [
  { key: 'all', label: 'All Collections' },
  { key: 'Metropolitan Museum of Art', label: 'Met Museum' },
  { key: 'Art Institute of Chicago', label: 'Art Inst. Chicago' },
  { key: 'Cleveland Museum of Art', label: 'Cleveland' },
  { key: 'Victoria & Albert Museum', label: 'V&A Museum' },
  { key: 'SMK National Gallery of Denmark', label: 'SMK Denmark' },
  { key: 'Rijksmuseum', label: 'Rijksmuseum' },
  { key: 'Smithsonian Institution', label: 'Smithsonian' },
  { key: 'Harvard Art Museums', label: 'Harvard' },
];

const PRODUCTS = [
  { icon: '🖼️', name: 'Fine Art Print', price: 'from $18' },
  { icon: '🎨', name: 'Canvas Wrap', price: 'from $45' },
  { icon: '👕', name: 'T-Shirt', price: 'from $24' },
  { icon: '☕', name: 'Mug', price: 'from $14' },
  { icon: '📱', name: 'Phone Case', price: 'from $19' },
  { icon: '🛍️', name: 'Tote Bag', price: 'from $16' },
];

function fmt(s) {
  return (s || '')
    .replace('Metropolitan Museum of Art', 'Met Museum')
    .replace('Art Institute of Chicago', 'Art Inst. Chicago')
    .replace('Victoria & Albert Museum', 'V&A')
    .replace('SMK National Gallery of Denmark', 'SMK Denmark')
    .replace('Smithsonian Institution', 'Smithsonian')
    .replace(/^Europeana — /, '')
    .split(',')[0];
}

const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:system-ui,-apple-system,sans-serif;background:#FAF8F4;color:#1A1714}

/* NAV */
.nav{position:sticky;top:0;z-index:100;background:rgba(250,248,244,0.97);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border-bottom:0.5px solid rgba(26,23,20,0.12);height:62px;display:flex;align-items:center;gap:16px;padding:0 32px}
.nav-logo{font-family:Georgia,serif;font-size:18px;font-weight:400;text-decoration:none;color:#1A1714;white-space:nowrap;flex-shrink:0}
.nav-logo span{color:#B8942A}
.nav-search{flex:1;max-width:520px;display:flex;gap:8px}
.nav-input{flex:1;padding:8px 14px;border:0.5px solid rgba(26,23,20,0.22);border-radius:4px;font-size:13px;background:#FAF8F4;outline:none;font-family:inherit;color:#1A1714}
.nav-input:focus{border-color:#B8942A;box-shadow:0 0 0 3px rgba(184,148,42,0.1)}
.nav-count{font-size:12px;color:#8A8178;white-space:nowrap;margin-left:auto;flex-shrink:0}
.btn{display:inline-flex;align-items:center;padding:8px 16px;border-radius:4px;font-size:13px;font-weight:500;cursor:pointer;border:0.5px solid rgba(26,23,20,0.2);color:#1A1714;background:transparent;font-family:inherit;transition:background .15s;white-space:nowrap;text-decoration:none}
.btn:hover{background:rgba(26,23,20,0.06)}
.btn-dark{background:#1A1714;color:#FAF8F4;border-color:#1A1714}
.btn-dark:hover{background:#2C2318}
.btn-icon{padding:8px 10px;font-size:16px;line-height:1}

/* HERO */
.hero{position:relative;height:500px;overflow:hidden;background:#2C2318}
.hero-img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:0.55;transition:opacity 1s ease}
.hero-img.fade{opacity:0}
.hero-gradient{position:absolute;inset:0;background:linear-gradient(105deg,rgba(26,23,20,0.88) 0%,rgba(26,23,20,0.45) 55%,rgba(26,23,20,0.15) 100%)}
.hero-content{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:flex-end;padding:52px 56px 48px}
.hero-eyebrow{font-size:10px;text-transform:uppercase;letter-spacing:.18em;color:#B8942A;margin-bottom:14px;font-weight:500}
.hero-title{font-family:Georgia,serif;font-size:clamp(30px,3.8vw,56px);font-weight:300;line-height:1.08;color:#F3EFE8;margin-bottom:10px;max-width:560px}
.hero-title em{font-style:italic;color:#C9A84C}
.hero-sub{font-size:14px;color:rgba(240,234,216,0.65);margin-bottom:28px;max-width:420px;line-height:1.6}
.hero-actions{display:flex;gap:12px;flex-wrap:wrap}
.hero-btn{padding:11px 24px;font-size:13px;font-weight:500;border-radius:4px;cursor:pointer;font-family:inherit;transition:all .18s;text-decoration:none;border:none}
.hero-btn-light{background:#FAF8F4;color:#1A1714}
.hero-btn-light:hover{background:#EDE8DF}
.hero-btn-outline{background:transparent;color:#F3EFE8;border:0.5px solid rgba(240,234,216,0.4)}
.hero-btn-outline:hover{background:rgba(240,234,216,0.08);border-color:rgba(240,234,216,0.7)}
.hero-caption{position:absolute;bottom:20px;right:32px;font-size:11px;color:rgba(240,234,216,0.45);text-align:right;max-width:260px;line-height:1.5}
.hero-caption strong{display:block;font-family:Georgia,serif;font-size:13px;font-weight:400;color:rgba(240,234,216,0.7)}

/* FILTER BAR */
.filter-bar{background:#FAF8F4;border-bottom:0.5px solid rgba(26,23,20,0.1);padding:0 32px;display:flex;align-items:stretch;gap:0;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none}
.filter-bar::-webkit-scrollbar{display:none}
.filter-chip{padding:14px 18px;font-size:11px;font-weight:500;letter-spacing:.07em;text-transform:uppercase;color:#8A8178;cursor:pointer;background:none;border:none;border-bottom:2px solid transparent;white-space:nowrap;transition:color .15s,border-color .15s;font-family:inherit;flex-shrink:0}
.filter-chip:hover{color:#1A1714}
.filter-chip.active{color:#1A1714;border-bottom-color:#B8942A}

/* GALLERY */
.gallery-header{padding:32px 32px 0;display:flex;align-items:baseline;justify-content:space-between;flex-wrap:wrap;gap:8px}
.gallery-title{font-family:Georgia,serif;font-size:26px;font-weight:300;line-height:1}
.gallery-title span{color:#B8942A}
.gallery-meta{font-size:12px;color:#8A8178}
.btn-shuffle{display:inline-flex;align-items:center;gap:6px;padding:7px 14px;border-radius:4px;font-size:12px;font-weight:500;cursor:pointer;border:0.5px solid rgba(26,23,20,0.2);color:#1A1714;background:transparent;font-family:inherit;transition:all .15s;white-space:nowrap}
.btn-shuffle:hover{background:rgba(26,23,20,0.06)}
.btn-shuffle.active{background:#1A1714;color:#FAF8F4;border-color:#1A1714}

.gallery-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;padding:24px 32px 64px}
.gallery-card{cursor:pointer;border-radius:8px;overflow:hidden;background:#EDE8DF;box-shadow:0 1px 4px rgba(26,23,20,0.08);transition:box-shadow .22s,transform .22s;display:flex;flex-direction:column}
.gallery-card:hover{box-shadow:0 12px 40px rgba(26,23,20,0.18);transform:translateY(-3px)}
.card-img-wrap{position:relative;overflow:hidden;background:#D4CEC3;aspect-ratio:3/4;flex-shrink:0}
.card-img-wrap img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .4s ease}
.gallery-card:hover .card-img-wrap img{transform:scale(1.05)}
.card-hover{position:absolute;inset:0;background:linear-gradient(transparent 50%,rgba(26,23,20,0.75));opacity:0;transition:opacity .22s;display:flex;align-items:flex-end;padding:12px}
.gallery-card:hover .card-hover{opacity:1}
.card-hover-label{font-size:11px;font-weight:500;color:#FAF8F4;letter-spacing:.05em}
.card-placeholder{aspect-ratio:3/4;display:flex;align-items:center;justify-content:center;font-size:48px;color:#B8942A;background:#EDE8DF}
.card-body{padding:12px 14px 14px;background:#FAF8F4}
.card-museum{font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:#B8942A;margin-bottom:4px;font-weight:500}
.card-title{font-family:Georgia,serif;font-size:14px;font-weight:400;line-height:1.3;margin-bottom:3px;color:#1A1714;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
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

/* LOAD MORE */
.load-more{text-align:center;padding:0 0 64px}

/* EMPTY */
.empty-state{padding:96px 32px;text-align:center;color:#8A8178}
.empty-icon{font-size:52px;margin-bottom:16px}
.empty-text{font-family:Georgia,serif;font-size:22px;font-weight:300;margin-bottom:20px}

/* MODAL */
.modal-bg{position:fixed;inset:0;background:rgba(26,23,20,0.72);z-index:200;display:flex;align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px)}
.modal{background:#FAF8F4;border-radius:12px;max-width:900px;width:100%;max-height:92vh;overflow:hidden;position:relative;box-shadow:0 32px 80px rgba(26,23,20,0.35);display:flex;flex-direction:column}
.modal-layout{display:grid;grid-template-columns:1fr 1fr;overflow-y:auto;max-height:92vh}
.modal-img-side{background:#2C2318;display:flex;align-items:center;justify-content:center;min-height:420px;position:relative;overflow:hidden}
.modal-img-side img{width:100%;height:100%;object-fit:contain;max-height:680px}
.modal-img-placeholder{font-size:72px;color:#B8942A}
.modal-close{position:absolute;top:14px;right:14px;width:34px;height:34px;border-radius:50%;background:rgba(26,23,20,0.55);border:none;color:#FAF8F4;font-size:20px;cursor:pointer;display:flex;align-items:center;justify-content:center;z-index:10;transition:background .15s;line-height:1}
.modal-close:hover{background:rgba(26,23,20,0.85)}
.modal-detail{padding:32px 28px 28px;overflow-y:auto;display:flex;flex-direction:column;gap:0}
.modal-museum{font-size:9px;text-transform:uppercase;letter-spacing:.18em;color:#B8942A;margin-bottom:10px;font-weight:500}
.modal-title{font-family:Georgia,serif;font-size:24px;font-weight:300;line-height:1.15;margin-bottom:6px}
.modal-artist{font-size:13px;color:#4A4540;margin-bottom:20px}
.divider{height:0.5px;background:rgba(26,23,20,0.1);margin:16px 0}
.meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.meta-item label{font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:#8A8178;display:block;margin-bottom:3px}
.meta-item span{font-size:13px;font-weight:500;color:#1A1714}
.modal-bio{font-size:12px;color:#4A4540;line-height:1.78}
.products-label{font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:#8A8178;margin-bottom:10px}
.products-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:16px}
.prod{background:#EDE8DF;border:none;border-radius:5px;padding:10px 4px;text-align:center;cursor:pointer;font-size:11px;color:#4A4540;transition:all .15s;font-family:inherit;line-height:1.4}
.prod:hover{background:#1A1714;color:#FAF8F4}
.prod-icon{font-size:18px;display:block;margin-bottom:2px}
.prod-price{opacity:.65;font-size:10px}
.modal-cta{display:flex;flex-direction:column;gap:8px;margin-top:auto;padding-top:4px}
.cta-btn{display:block;text-align:center;padding:12px;border-radius:5px;font-size:13px;font-weight:500;cursor:pointer;font-family:inherit;transition:all .15s;border:none}
.cta-primary{background:#1A1714;color:#FAF8F4}
.cta-primary:hover{background:#2C2318}
.cta-secondary{background:transparent;color:#1A1714;border:0.5px solid rgba(26,23,20,0.22);text-decoration:none}
.cta-secondary:hover{background:rgba(26,23,20,0.05)}

/* FOOTER */
footer{background:#2C2318;color:#B0A898;padding:52px 32px 28px}
.footer-grid{max-width:1280px;margin:0 auto;display:grid;grid-template-columns:2fr 1fr 1fr;gap:48px}
.footer-logo{font-family:Georgia,serif;font-size:20px;color:#F3EFE8;margin-bottom:10px}
.footer-logo span{color:#B8942A}
.footer-desc{font-size:13px;line-height:1.75;color:#6A6058}
.footer-col-title{font-size:9px;text-transform:uppercase;letter-spacing:.14em;color:#6A6058;margin-bottom:14px}
.footer-link{display:block;font-size:13px;color:#8A8178;text-decoration:none;margin-bottom:7px;cursor:pointer;background:none;border:none;font-family:inherit;padding:0;text-align:left;transition:color .15s}
.footer-link:hover{color:#F3EFE8}
.footer-bottom{max-width:1280px;margin:32px auto 0;border-top:0.5px solid rgba(240,234,214,0.08);padding-top:20px;font-size:12px;color:#4A4540}

/* RESPONSIVE */
@media(max-width:1200px){.gallery-grid{grid-template-columns:repeat(3,1fr)}}
@media(max-width:800px){
  .nav{padding:0 16px;gap:10px}
  .hero{height:400px}
  .hero-content{padding:32px 24px 36px}
  .filter-bar{padding:0 16px}
  .gallery-header{padding:24px 16px 0}
  .gallery-grid{grid-template-columns:repeat(2,1fr);gap:14px;padding:20px 16px 48px}
  .modal-layout{grid-template-columns:1fr}
  .modal-img-side{min-height:260px}
  .footer-grid{grid-template-columns:1fr;gap:32px}
}
@media(max-width:500px){
  .nav-count{display:none}
  .gallery-grid{grid-template-columns:repeat(2,1fr);gap:10px;padding:16px 12px 40px}
  .hero-title{font-size:28px}
}
`;

export default function Home() {
  const [works, setWorks] = useState([]);
  const [searchInput, setSearchInput] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');
  const [source, setSource] = useState('all');
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [modal, setModal] = useState(null);
  const [heroIdx, setHeroIdx] = useState(0);
  const [heroFading, setHeroFading] = useState(false);
  const [imgErrors, setImgErrors] = useState({});
  const [order, setOrder] = useState('recent');
  const offsetRef = useRef(0);

  useEffect(() => {
    fetch('/api/artworks?count=true').then(r => r.json()).then(d => setTotal(d.total));
    load(true, '', 'all');
  }, []);

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

  async function load(reset, q, src, ord) {
    const off = reset ? 0 : offsetRef.current;
    const o = ord !== undefined ? ord : order;
    setLoading(true);
    try {
      let url = `/api/artworks?limit=24&offset=${off}`;
      if (q) url += `&search=${encodeURIComponent(q)}`;
      if (src && src !== 'all') url += `&source=${encodeURIComponent(src)}`;
      if (o === 'random') url += `&order=random`;
      const data = await fetch(url).then(r => r.json());
      const w = data.works || [];
      if (reset) {
        setWorks(w);
        offsetRef.current = w.length;
      } else {
        setWorks(prev => {
          const merged = [...prev, ...w];
          offsetRef.current = merged.length;
          return merged;
        });
      }
      setHasMore(w.length === 24);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  const handleSearch = () => {
    setAppliedSearch(searchInput);
    load(true, searchInput, source);
  };

  const handleClear = () => {
    setSearchInput('');
    setAppliedSearch('');
    load(true, '', source);
  };

  const handleSource = (src) => {
    setSource(src);
    load(true, appliedSearch, src, order);
  };

  const handleShuffle = () => {
    const next = order === 'random' ? 'recent' : 'random';
    setOrder(next);
    load(true, appliedSearch, source, next);
  };

  const handleLoadMore = () => load(false, appliedSearch, source, order);

  const hero = works[heroIdx % Math.max(works.length, 1)];

  const SKELETON_COUNT = 12;

  return (
    <>
      <Head>
        <title>Public Art Collections — Museum Prints & Art Marketplace</title>
        <meta name="description" content="Browse museum masterpieces from the Met, V&A, Rijksmuseum and more. Buy any artwork as a fine art print, canvas, or gift." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
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
          {appliedSearch && (
            <button className="btn btn-icon" onClick={handleClear} title="Clear search">×</button>
          )}
        </div>
        {total !== null && (
          <span className="nav-count">{Number(total).toLocaleString()} works</span>
        )}
      </nav>

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
            <h1 className="hero-title">
              The world's art,<br /><em>in your home</em>
            </h1>
            <p className="hero-sub">
              {total ? `${Number(total).toLocaleString()}+ museum masterpieces` : 'Museum masterpieces'} — available as fine art prints, canvas wraps, and gifts.
            </p>
            <div className="hero-actions">
              <a href="#gallery" className="hero-btn hero-btn-light">Browse Collection</a>
              <button className="hero-btn hero-btn-outline" onClick={() => setModal(hero)}>
                View This Work
              </button>
            </div>
          </div>
          {hero.title && (
            <div className="hero-caption">
              <strong>{hero.title}</strong>
              {hero.artist || ''}
            </div>
          )}
        </div>
      )}

      {/* FILTER BAR */}
      <div className="filter-bar" id="gallery">
        {MUSEUMS.map(m => (
          <button
            key={m.key}
            className={`filter-chip${source === m.key ? ' active' : ''}`}
            onClick={() => handleSource(m.key)}
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* GALLERY HEADER */}
      <div className="gallery-header">
        <h2 className="gallery-title">
          {source === 'all' ? 'The Collection' : fmt(source)}
          {total !== null && <span> — {Number(total).toLocaleString()}+ works</span>}
        </h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {appliedSearch && (
            <p className="gallery-meta">Results for "{appliedSearch}"</p>
          )}
          <button
            className={`btn-shuffle${order === 'random' ? ' active' : ''}`}
            onClick={handleShuffle}
            title={order === 'random' ? 'Back to recent' : 'Shuffle artworks'}
          >
            ↺ {order === 'random' ? 'Shuffled' : 'Shuffle'}
          </button>
        </div>
      </div>

      {/* GALLERY */}
      {loading && works.length === 0 ? (
        <div className="gallery-grid">
          {Array.from({ length: SKELETON_COUNT }).map((_, i) => (
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
        <div className="footer-grid">
          <div>
            <div className="footer-logo">Public Art <span>Collections</span></div>
            <p className="footer-desc">
              Museum-quality art for every home. All works public domain — ethically sourced from the world's great collections.
            </p>
          </div>
          <div>
            <div className="footer-col-title">Collections</div>
            {MUSEUMS.slice(1).map(m => (
              <button key={m.key} className="footer-link" onClick={() => handleSource(m.key)}>
                {m.label}
              </button>
            ))}
          </div>
          <div>
            <div className="footer-col-title">Info</div>
            <a href="/api/artworks" className="footer-link">API Access</a>
            <a href="#" className="footer-link">How Prints Work</a>
            <a href="#" className="footer-link">Shipping &amp; Returns</a>
          </div>
        </div>
        <div className="footer-bottom">
          © 2025 publicartcollections.org · All artwork public domain · Prints fulfilled by Printful
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
                    onError={e => {
                      if (modal.thumb_url && e.target.src !== modal.thumb_url) {
                        e.target.src = modal.thumb_url;
                      }
                    }}
                  />
                ) : (
                  <div className="modal-img-placeholder">🖼️</div>
                )}
              </div>
              <div className="modal-detail">
                <div className="modal-museum">{fmt(modal.source)}</div>
                <h2 className="modal-title">{modal.title}</h2>
                <p className="modal-artist">
                  {[modal.artist, modal.date_text].filter(Boolean).join(' · ') || 'Unknown artist'}
                </p>
                <div className="divider" />
                <div className="meta-grid">
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
                  {modal.country && (
                    <div className="meta-item">
                      <label>Origin</label>
                      <span>{modal.country}</span>
                    </div>
                  )}
                </div>
                {modal.bio && (
                  <>
                    <div className="divider" />
                    <p className="modal-bio">{modal.bio.slice(0, 340)}</p>
                  </>
                )}
                <div className="divider" />
                <div className="products-label">Order as</div>
                <div className="products-grid">
                  {PRODUCTS.map(p => (
                    <button key={p.name} className="prod">
                      <span className="prod-icon">{p.icon}</span>
                      {p.name}<br />
                      <span className="prod-price">{p.price}</span>
                    </button>
                  ))}
                </div>
                <div className="modal-cta">
                  <button className="cta-btn cta-primary">Order a Print →</button>
                  <a href={`/artwork/${modal.id}`} className="cta-btn cta-secondary">View full page →</a>
                  {modal.detail_url && (
                    <a
                      href={modal.detail_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="cta-btn cta-secondary"
                    >
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
