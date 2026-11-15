import { useState, useEffect } from 'react';
import AuthNav from './AuthNav';
import { getThumbUrl } from '../lib/thumb';

export function Holly({ w = 220, style }) {
  const leaf = (x, y, r, s, fill) => (
    <g transform={`translate(${x} ${y}) rotate(${r}) scale(${s})`}>
      <path d="M0 0 Q6 -12 12 -6 Q14 -16 22 -10 Q28 -20 34 -10 Q42 -16 44 -6 Q52 -12 58 0 Q52 12 44 6 Q42 16 34 10 Q28 20 22 10 Q14 16 12 6 Q6 12 0 0 Z" fill={fill} />
      <path d="M2 0 L54 0" stroke="#0A0908" strokeWidth="1.2" opacity=".35" fill="none" />
    </g>
  );
  return (
    <svg width={w} height={Math.round(w * 0.5)} viewBox="0 0 260 130" aria-hidden="true" focusable="false"
      style={{ position: 'absolute', pointerEvents: 'none', ...style }}>
      <path d="M8 82 C60 78 110 66 215 52" stroke="#1B4332" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      {leaf(40, 70, -155, 1.0, '#2F6B4F')}{leaf(40, 70, -25, 1.0, '#245A41')}
      {leaf(95, 62, -150, 0.9, '#3E8A62')}{leaf(95, 62, -30, 0.9, '#2F6B4F')}
      {leaf(150, 56, -155, 0.8, '#245A41')}{leaf(150, 56, -20, 0.8, '#3E8A62')}
      {leaf(200, 52, -10, 0.7, '#2F6B4F')}
      <circle cx="78" cy="68" r="7" fill="#C0262F" /><circle cx="92" cy="74" r="7" fill="#A81F29" /><circle cx="86" cy="58" r="7" fill="#D13840" />
      <circle cx="76" cy="66" r="2" fill="#F08A8F" /><circle cx="90" cy="72" r="2" fill="#F08A8F" /><circle cx="84" cy="56" r="2" fill="#F08A8F" />
    </svg>
  );
}


// Fetch artwork picks for a search phrase (same engine as the viewer's search box).
export function useArtPicks(query) {
  const [state, setState] = useState({ works: [], loading: !!query, error: false });
  useEffect(() => {
    if (!query) { setState({ works: [], loading: false, error: false }); return undefined; }
    let dead = false;
    setState({ works: [], loading: true, error: false });
    fetch('/api/ai-search?query=' + encodeURIComponent(query))
      .then(r => r.json())
      .then(d => {
        const seen = new Set();
        const works = (d.works || []).filter(w => {
          if (!w || !w.id || !w.thumb_url || seen.has(w.id)) return false;
          seen.add(w.id); return true;
        });
        if (!dead) setState({ works, loading: false, error: false });
      })
      .catch(() => { if (!dead) setState({ works: [], loading: false, error: true }); });
    return () => { dead = true; };
  }, [query]);
  return state;
}

// Famous, hand-picked works from our stored collection (see /api/holiday-curated).
export function useCurated(cat, { similar = true } = {}) {
  const [state, setState] = useState({ famous: [], similar: [], loading: true, error: false, hasMore: false, page: 0, busy: false });
  const url = (page) => '/api/holiday-curated?cat=' + encodeURIComponent(cat) + (similar ? '&page=' + page : '&similar=0');
  useEffect(() => {
    let dead = false;
    setState({ famous: [], similar: [], loading: true, error: false, hasMore: false, page: 0, busy: false });
    fetch(url(0)).then(r => r.json())
      .then(d => { if (!dead) setState({ famous: d.famous || [], similar: d.similar || [], loading: false, error: !!d.error, hasMore: !!d.hasMore, page: 0, busy: false }); })
      .catch(() => { if (!dead) setState(s => ({ ...s, loading: false, error: true })); });
    return () => { dead = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat, similar]);
  const loadMore = () => {
    if (state.busy || !state.hasMore) return;
    const next = state.page + 1;
    setState(s => ({ ...s, busy: true }));
    fetch(url(next)).then(r => r.json()).then(d => {
      setState(c => {
        const ids = new Set([...c.famous, ...c.similar].map(w => w.id));
        const add = (d.similar || []).filter(w => !ids.has(w.id));
        return { ...c, similar: [...c.similar, ...add], hasMore: !!d.hasMore && (d.similar || []).length > 0, page: next, busy: false };
      });
    }).catch(() => setState(c => ({ ...c, busy: false, hasMore: false })));
  };
  return { ...state, loadMore };
}

// One cover image per category, for the mood boxes.
export function useCovers() {
  const [covers, setCovers] = useState({});
  useEffect(() => {
    let dead = false;
    fetch('/api/holiday-curated?cat=covers').then(r => r.json()).then(d => { if (!dead) setCovers(d.covers || {}); }).catch(() => {});
    return () => { dead = true; };
  }, []);
  return covers;
}

export function ArtCard({ w }) {
  const artist = (w.artist || '').split('\n')[0].split('(')[0].trim();
  return (
    <a href={'/artwork/' + w.id} className="hl-art">
      <div className="hl-art-img"><img src={getThumbUrl(w.thumb_url)} alt={w.title || 'Artwork'} loading="lazy" /></div>
      <div className="hl-art-body">
        <div className="hl-art-t">{w.title || 'Untitled'}</div>
        {artist && artist !== 'Unknown' && <div className="hl-art-a">{artist}</div>}
        <div className="hl-art-go">Choose as a gift →</div>
      </div>
    </a>
  );
}

export function PicksGrid({ works, loading, limit }) {
  if (loading) {
    return <div className="hl-picks" aria-busy="true">{Array.from({ length: Math.min(limit || 12, 12) }).map((_, i) => <div key={i} className="hl-skel" />)}</div>;
  }
  if (!works || !works.length) return null;
  return <div className="hl-picks">{works.slice(0, limit || 24).map(w => <ArtCard key={w.id} w={w} />)}</div>;
}

export function HolidayNav() {
  return (
    <>
      <div className="hl-bar">Holiday gift edition &nbsp;·&nbsp; Add a personal message to any gift</div>
      <nav className="hl-nav">
        <a href="/" className="hl-logo">Great Art <span>Classics</span></a>
        <div className="hl-links">
          <a href="/holiday#picks">Holiday picks</a>
          <a href="/holiday#holiday">Collections</a>
          <a href="/holiday#personal">Make it personal</a>
          <AuthNav />
        </div>
      </nav>
    </>
  );
}

export function HolidayFoot() {
  return (
    <footer className="hl-foot">
      <Holly w={190} style={{ top: -8, left: '50%', marginLeft: -95 }} />
      © {new Date().getFullYear()} greatartclassics.org &nbsp;·&nbsp; Prints from public-domain and commercially usable museum collections
      <div style={{ marginTop: 10 }}><a href="/">Home</a> &nbsp;·&nbsp; <a href="/viewer">Browse all art</a> &nbsp;·&nbsp; <a href="/pricing">Membership</a></div>
    </footer>
  );
}

export const FONT_LINKS = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Manrope:wght@400;500;600;700&display=swap';

export const CSS = `
body{margin:0;background:#0A0908}
.hl{--gold:#D8B565;--ink:#F4EEE2;--mut:#B8AE9C;--line:#2A241E;--ink-soft:#CFC6B5;--radius:999px;--sans:'Manrope',system-ui,sans-serif;background:#0A0908;color:var(--ink);font-family:'Manrope',system-ui,-apple-system,sans-serif;line-height:1.55;overflow-x:clip}
.hl *{box-sizing:border-box}
.hl a{color:inherit}
.hl-wrap{max-width:1200px;margin:0 auto;padding-left:24px;padding-right:24px}
.hl-sec{padding-top:80px;padding-bottom:80px}
.hl-bar{background:#14110F;border-bottom:1px solid var(--line);padding:10px 24px;text-align:center;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold)}
.hl-nav{max-width:1200px;margin:0 auto;padding:20px 24px;display:flex;flex-wrap:wrap;gap:14px 32px;align-items:center;justify-content:space-between}
.hl-logo{font-family:'Cormorant Garamond',Georgia,serif;font-size:30px;font-weight:600;text-decoration:none}
.hl-logo span{color:var(--gold);font-style:italic}
.hl-links{display:flex;flex-wrap:wrap;gap:8px 26px;align-items:center;font-size:15px}
.hl-links a{text-decoration:none}
.hl-hero{max-width:1200px;margin:0 auto;padding:48px 24px 90px;display:flex;flex-wrap:wrap;gap:56px;align-items:center}
.hl-hero-text{flex:1 1 460px;min-width:0}
.hl-eyebrow{font-size:13px;letter-spacing:.2em;text-transform:uppercase;color:var(--gold);font-weight:600;margin-bottom:20px}
.hl-eyebrow-light{color:#F0D48F;margin-bottom:14px}
.hl h1{margin:0 0 22px;font-family:'Cormorant Garamond',Georgia,serif;font-weight:500;font-size:clamp(52px,8vw,96px);line-height:.98;letter-spacing:-.01em}
.hl h1 em,.hl h2 em{font-style:italic;color:var(--gold)}
.hl h2{margin:0 0 12px;font-family:'Cormorant Garamond',Georgia,serif;font-weight:500;font-size:clamp(34px,5vw,54px);line-height:1.05}
.hl h3{font-size:20px;font-weight:600;margin:10px 0 6px}
.hl-lead{margin:0 0 32px;font-size:19px;color:#CFC6B5;max-width:540px}
.hl-lead-light{color:#F4E6E3;font-size:18px;margin:0}
.hl-sub{margin:0 0 40px;font-size:17px;color:#CFC6B5;max-width:600px}
.hl-cta{display:flex;flex-wrap:wrap;gap:14px;margin-bottom:34px}
.hl-btn{display:inline-block;text-decoration:none;font-weight:700;padding:16px 30px;border-radius:999px;font-size:16px;text-align:center}
.hl-btn-gold{background:var(--gold);color:#0A0908}
.hl-btn-gold:hover{background:#F0D48F}
.hl-btn-ghost{border:1px solid #6B5E4D;font-weight:600;padding:15px 28px}
.hl-btn-ghost:hover{border-color:var(--gold)}
.hl-btn-block{display:block}
.hl-btn-lg{padding:17px 36px;font-size:17px}
.hl-fine{margin:0;font-size:14px;color:var(--mut);max-width:520px;border-top:1px solid var(--line);padding-top:18px}
.hl-hero-art{position:relative;flex:1 1 440px;min-width:0;display:flex;gap:20px;align-items:flex-end;justify-content:center}
.hl-frame{display:block;border:2px solid var(--gold);padding:10px;background:#14110F;box-shadow:0 30px 60px rgba(0,0,0,.6);text-decoration:none}
.hl-frame-1{width:46%;max-width:230px;aspect-ratio:3/4}
.hl-frame-2{width:50%;max-width:250px;aspect-ratio:4/5;margin-bottom:56px}
.hl-frame-in{width:100%;height:100%;overflow:hidden}
.hl-frame-in img,.hl-tile-img img{width:100%;height:100%;object-fit:cover;display:block}
.hl-grid{display:flex;flex-wrap:wrap;gap:22px}
.hl-tile{flex:1 1 300px;min-width:0;border:1px solid var(--line);border-radius:18px;overflow:hidden;background:#0A0908;text-decoration:none;transition:transform .2s,border-color .2s}
.hl-tile:hover{transform:translateY(-3px);border-color:var(--gold)}
.hl-tile-img{aspect-ratio:4/3;overflow:hidden}
.hl-tile-body{padding:18px 20px 22px}
.hl-tile-name{font-family:'Cormorant Garamond',Georgia,serif;font-size:26px;font-weight:600}
.hl-tile-sub{font-size:14px;color:var(--mut);margin-top:4px}
.hl-band-dark{background:#14110F;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.hl-band-green{background:#17382E}
.hl-band-red{background:#8E1F2B}
.hl-gift{flex:1 1 230px;min-width:0;background:#0A0908;border:1px solid var(--line);border-radius:18px;padding:22px;text-decoration:none;transition:border-color .2s}
.hl-gift:hover{border-color:var(--gold)}
.hl-gift-img{aspect-ratio:1/1;border-radius:10px;background:linear-gradient(150deg,#2A241E,#0F0D0B);margin-bottom:18px}
.hl-price{font-size:15px;color:var(--gold);font-weight:600;margin-top:14px}
.hl-steps{display:flex;flex-wrap:wrap;gap:28px;margin-top:40px}
.hl-step{flex:1 1 280px;min-width:0;border-top:1px solid var(--gold);padding-top:20px}
.hl-step p{margin:0;font-size:16px;color:#E4DDCD}
.hl-num{font-family:'Cormorant Garamond',Georgia,serif;font-size:44px;color:var(--gold);line-height:1}
.hl-members{display:flex;flex-wrap:wrap;gap:40px 64px;align-items:center}
.hl-members-text{flex:1 1 440px;min-width:0}
.hl-card{position:relative;flex:1 1 360px;min-width:0;background:#0A0908;border-radius:22px;padding:32px}
.hl-card-k{font-size:14px;color:var(--mut);margin-bottom:6px}
.hl-card-v{font-family:'Cormorant Garamond',Georgia,serif;font-size:60px;line-height:1;color:var(--gold)}
.hl-card-n{font-size:15px;color:#CFC6B5;margin:6px 0 22px}
.hl-card .hl-btn{margin-top:4px}
.hl-final{text-align:center;padding-top:90px;padding-bottom:90px}
.hl-foot{position:relative;border-top:1px solid var(--line);padding:58px 24px 34px;text-align:center;font-size:14px;color:var(--mut)}
.hl-foot a{color:var(--gold);text-decoration:none}
@media(max-width:640px){
  .hl-sec{padding-top:56px;padding-bottom:56px}
  .hl-hero{padding-top:28px;padding-bottom:64px}
  .hl-btn{width:100%}
  .hl-cta{flex-direction:column}
  .hl-card-v{font-size:48px}
}

.hl-picks{display:grid;grid-template-columns:repeat(auto-fill,minmax(170px,1fr));gap:16px}
.hl-art{display:block;text-decoration:none;border-radius:14px;overflow:hidden;background:#14110F;border:1px solid var(--line);transition:transform .2s,border-color .2s}
.hl-art:hover,.hl-art:focus-visible{transform:translateY(-3px);border-color:var(--gold)}
.hl-art-img{aspect-ratio:4/5;background:#1a1612;overflow:hidden}
.hl-art-img img{width:100%;height:100%;object-fit:cover;display:block}
.hl-art-body{padding:10px 12px 12px}
.hl-art-t{font-size:14px;font-weight:600;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.hl-art-a{font-size:12px;color:var(--mut);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.hl-art-go{font-size:12px;color:var(--gold);font-weight:600;margin-top:6px}
.hl-skel{aspect-ratio:4/5;border-radius:14px;background:linear-gradient(110deg,#14110F 30%,#1d1814 50%,#14110F 70%);background-size:200% 100%;animation:hlsk 1.4s linear infinite}
@keyframes hlsk{to{background-position:-200% 0}}
@media(prefers-reduced-motion:reduce){.hl-skel{animation:none}}
.hl-shelf{font-size:clamp(24px,3vw,34px);margin:0 0 16px}
.hl-tile-for{font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);margin-bottom:6px}
.hl-more{display:flex;justify-content:center;margin-top:28px}
.hl-msg{color:var(--mut);font-size:16px;padding:20px 0}
.hl-chips{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}
.hl-chip{display:inline-block;border:1px solid #4A4036;border-radius:999px;padding:9px 16px;font-size:14px;text-decoration:none}
.hl-chip:hover{border-color:var(--gold);color:var(--gold)}
.hl-search{display:flex;flex-wrap:wrap;gap:12px;max-width:640px}
.hl-search input{flex:1 1 260px;min-width:0;background:#14110F;border:1px solid #4A4036;border-radius:999px;color:var(--ink);font:inherit;font-size:16px;padding:15px 22px}
.hl-search input:focus{outline:2px solid var(--gold);outline-offset:2px}
.hl-save{background:#14110F;border:1px solid var(--line);border-radius:18px;padding:26px 28px;display:flex;flex-wrap:wrap;gap:20px 40px;align-items:center;justify-content:space-between}
.hl-save p{margin:0;font-size:17px;color:#CFC6B5;max-width:640px}
.hl-save b{color:var(--gold)}
@media(max-width:640px){.hl-picks{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}}
`;
