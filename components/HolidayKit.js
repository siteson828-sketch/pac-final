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
export function useCurated(cat, { similar = true, pages = 1 } = {}) {
  const [state, setState] = useState({ famous: [], similar: [], loading: true, error: false, hasMore: false, page: 0, busy: false });
  const url = (page) => '/api/holiday-curated?cat=' + encodeURIComponent(cat) + (similar ? '&page=' + page : '&similar=0');
  useEffect(() => {
    let dead = false;
    setState({ famous: [], similar: [], loading: true, error: false, hasMore: false, page: 0, busy: false });
    const n = similar ? Math.max(1, pages) : 1;
    Promise.all(Array.from({ length: n }, (_, k) => fetch(url(k)).then(r => r.json()).catch(() => ({ similar: [], famous: [], error: true }))))
      .then(rs => {
        if (dead) return;
        const seen = new Set();
        const famous = (rs[0].famous || []).filter(w => !seen.has(w.id) && seen.add(w.id));
        const more = rs.flatMap(r => r.similar || []).filter(w => !seen.has(w.id) && seen.add(w.id));
        setState({ famous, similar: more, loading: false, error: rs.every(r => r.error), hasMore: !!rs[rs.length - 1].hasMore, page: n - 1, busy: false });
      });
    return () => { dead = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat, similar, pages]);
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
  const first = getThumbUrl(w.thumb_url);
  const [src, setSrc] = useState(first);
  const [bad, setBad] = useState(false);
  // If a museum's own server refuses or is slow, retry once through our cached proxy;
  // if that fails too, drop the card so the wall never shows a blank tile.
  const onError = () => {
    if (!src.startsWith('/api/img') && /^https:\/\//.test(w.thumb_url || '')) setSrc('/api/img?url=' + encodeURIComponent(w.thumb_url));
    else setBad(true);
  };
  if (bad || !first) return null;
  return (
    <a href={'/artwork/' + w.id} className="hl-art">
      <div className="hl-art-img"><img src={src} alt={w.title || 'Artwork'} loading="lazy" decoding="async" onError={onError} /></div>
      <div className="hl-art-body">
        <div className="hl-art-t">{w.title || 'Untitled'}</div>
        {artist && artist !== 'Unknown' && <div className="hl-art-a">{artist}</div>}
        <div className="hl-art-go">Choose as a gift →</div>
      </div>
    </a>
  );
}

// Simple drawn product with a famous work on it (we have no product photos).
export function GiftArt({ kind, src, uid }) {
  const id = 'ga-' + uid;
  const img = (x, y, w, h, clip) => src
    ? <image href={src} x={x} y={y} width={w} height={h} preserveAspectRatio="xMidYMid slice" clipPath={'url(#' + clip + ')'} />
    : <rect x={x} y={y} width={w} height={h} fill="#6b3a2e" clipPath={'url(#' + clip + ')'} />;
  return (
    <svg viewBox="0 0 200 200" role="img" aria-label={kind} style={{ width: '100%', height: '100%', display: 'block' }}>
      <defs>
        <clipPath id={id + 'p'}><rect x="56" y="38" width="88" height="124" /></clipPath>
        <clipPath id={id + 'm'}><rect x="46" y="52" width="86" height="96" rx="10" /></clipPath>
        <clipPath id={id + 't'}><rect x="66" y="96" width="68" height="68" /></clipPath>
        <clipPath id={id + 'b'}><rect x="26" y="52" width="148" height="96" rx="4" /></clipPath>
      </defs>
      {kind === 'Framed Poster' && (<g>
        <rect x="40" y="22" width="120" height="156" fill="#D8B565" /><rect x="47" y="29" width="106" height="142" fill="#F4EEE2" />
        {img(56, 38, 88, 124, id + 'p')}<rect x="56" y="38" width="88" height="124" fill="none" stroke="#00000033" />
      </g>)}
      {kind === 'Mug' && (<g>
        <path d="M130 70 h14 a18 18 0 0 1 0 50 h-14" fill="none" stroke="#F4EEE2" strokeWidth="11" />
        <rect x="46" y="52" width="86" height="96" rx="10" fill="#F4EEE2" />{img(46, 52, 86, 96, id + 'm')}
        <rect x="52" y="56" width="10" height="88" rx="5" fill="#ffffff" opacity=".22" /><ellipse cx="89" cy="152" rx="46" ry="6" fill="#00000040" />
      </g>)}
      {kind === 'Tote Bag' && (<g>
        <path d="M72 80 C72 30 128 30 128 80" fill="none" stroke="#C9B48A" strokeWidth="8" strokeLinecap="round" />
        <rect x="42" y="72" width="116" height="106" fill="#E9DFC8" /><rect x="42" y="72" width="116" height="106" fill="none" stroke="#00000022" />
        {img(66, 96, 68, 68, id + 't')}<rect x="66" y="96" width="68" height="68" fill="none" stroke="#00000030" />
      </g>)}
      {kind === 'Throw Blanket' && (<g>
        <rect x="26" y="52" width="148" height="96" rx="4" fill="#E9DFC8" />{img(26, 52, 148, 96, id + 'b')}
        <rect x="26" y="52" width="148" height="96" rx="4" fill="none" stroke="#D8B565" strokeWidth="5" />
        {Array.from({ length: 19 }).map((_, i) => <line key={i} x1={32 + i * 7.7} y1="148" x2={32 + i * 7.7} y2="162" stroke="#D8B565" strokeWidth="2.5" strokeLinecap="round" />)}
        <path d="M26 52 L174 148" stroke="#ffffff" opacity=".07" strokeWidth="40" clipPath={'url(#' + id + 'b)'} />
      </g>)}
    </svg>
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

const BASE_CSS = `
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

// ---- Holiday cheer on the site's cream + navy palette (overrides the base rules above) ----
const LIGHT_CSS = `
body{margin:0;background:#FBF6EA}
.hl{--gold:#B3262E;--ink:#1F2B4D;--mut:#5E6584;--line:#E6DBC3;--ink-soft:#3B4668;--pine:#1F5B45;--cran:#B3262E;--brass:#D4A23A;background:#FBF6EA;color:var(--ink)}
.hl-bar{background:linear-gradient(90deg,#8E1F2B,#B3262E 50%,#8E1F2B);border-bottom:0;color:#FFF6E3;font-weight:600}
.hl-nav{background:transparent}
.hl-logo{color:var(--ink)}
.hl-logo span{color:var(--cran)}
.hl-links a{color:var(--ink-soft)}
.hl-links a:hover{color:var(--cran)}
.hl h1 em,.hl h2 em{color:var(--cran)}
.hl-eyebrow{color:var(--cran)}
.hl-eyebrow-light{color:#FFE7A8}
.hl-lead,.hl-sub,.hl-card-n,.hl-save p{color:var(--ink-soft)}
.hl-lead-light{color:#FFF1EE}
.hl-btn-gold{background:var(--cran);color:#FFF8EC;box-shadow:0 6px 18px rgba(179,38,46,.28)}
.hl-btn-gold:hover{background:#8E1F2B}
.hl-btn-ghost{border:1.5px solid var(--ink);color:var(--ink)}
.hl-btn-ghost:hover{border-color:var(--cran);color:var(--cran)}
.hl-fine{color:var(--mut);border-top-color:var(--line)}
/* festive stage behind the framed pictures */
.hl-hero-art{padding:64px 30px 34px;border-radius:30px;isolation:isolate;
  background:
   radial-gradient(circle at 12% 22%,#fff 0 2px,transparent 3px) 0 0/90px 90px,
   radial-gradient(circle at 70% 64%,#ffffffcc 0 1.6px,transparent 2.6px) 0 0/70px 70px,
   radial-gradient(circle at 40% 8%,#ffffff99 0 1.2px,transparent 2px) 0 0/50px 50px,
   radial-gradient(ellipse at 50% 120%,#B3262E55,transparent 60%),
   linear-gradient(165deg,#1F2B4D,#1B4A3B 120%)}
.hl-hero-art::before{content:"";position:absolute;left:0;right:0;top:0;height:30px;z-index:1;border-radius:30px 30px 0 0;
  background:
   radial-gradient(circle,#E8423F 0 6px,transparent 7px) 0 12px/64px 30px,
   radial-gradient(circle,#F3C34E 0 6px,transparent 7px) 16px 12px/64px 30px,
   radial-gradient(circle,#4FB286 0 6px,transparent 7px) 32px 12px/64px 30px,
   radial-gradient(circle,#6FA8FF 0 6px,transparent 7px) 48px 12px/64px 30px,
   linear-gradient(#0000,#0000)}
.hl-hero-art::after{content:"";position:absolute;left:0;right:0;top:11px;height:2px;background:#0a1a14;opacity:.55;z-index:0}
.hl-frame{position:relative;z-index:2;border-color:var(--brass);background:#FFFBF0;box-shadow:0 24px 50px rgba(0,0,0,.45)}
/* cards */
.hl-art{background:#fff;border:1px solid var(--line);box-shadow:0 4px 14px rgba(31,43,77,.07)}
.hl-art:hover,.hl-art:focus-visible{border-color:var(--cran);box-shadow:0 10px 24px rgba(31,43,77,.15)}
.hl-art-img{background:#EFE6D2}
.hl-art-t{color:var(--ink)}
.hl-art-a{color:var(--mut)}
.hl-art-go{color:var(--cran)}
.hl-skel{background:linear-gradient(110deg,#EFE6D2 30%,#F7F0E0 50%,#EFE6D2 70%);background-size:200% 100%}
.hl-tile,.hl-gift{background:#fff;border-color:var(--line);box-shadow:0 4px 14px rgba(31,43,77,.07)}
.hl-tile:hover,.hl-gift:hover{border-color:var(--cran)}
.hl-tile-for{color:var(--cran)}
.hl-tile-sub{color:var(--mut)}
.hl-gift-img{background:linear-gradient(150deg,#F3E8CF,#EADCBB)}
.hl-price{color:var(--cran)}
/* bands */
.hl-band-dark{background:linear-gradient(180deg,#1F2B4D,#18223D);border:0;color:#FBF6EA}
.hl-band-dark .hl-sub{color:#D9DDF0}
.hl-band-dark h2{color:#FFF6E3}
.hl-band-dark .hl-chip{border-color:#5A6794;color:#FBF6EA}
.hl-band-dark .hl-chip:hover{border-color:#FFE7A8;color:#FFE7A8}
.hl-band-dark .hl-search input{background:#fff;color:var(--ink);border-color:#fff}
.hl-band-dark .hl-btn-gold{background:#F3C34E;color:#1F2B4D;box-shadow:none}
.hl-band-dark .hl-btn-gold:hover{background:#FFE08A}
.hl-band-green{background:linear-gradient(160deg,#1F5B45,#17382E);color:#F6F1E4}
.hl-band-green h2{color:#FFF6E3}
.hl-band-green .hl-step{border-top-color:#F3C34E}
.hl-band-green .hl-step p{color:#E6EFE6}
.hl-band-green .hl-num{color:#F3C34E}
.hl-band-red{background:linear-gradient(160deg,#B3262E,#8E1F2B);color:#FFF6E3}
.hl-band-red h2{color:#FFF6E3}
.hl-card{background:#FFFBF0;color:var(--ink)}
.hl-card-k{color:var(--mut)}
.hl-card-v{color:var(--cran)}
.hl-band-red .hl-btn-gold{background:var(--ink);color:#FFF6E3;box-shadow:none}
.hl-band-red .hl-btn-gold:hover{background:#0F1730}
.hl-chip{border-color:#CDBF9F;color:var(--ink-soft);background:#fff}
.hl-chip:hover{border-color:var(--cran);color:var(--cran)}
.hl-search input{background:#fff;border-color:#CDBF9F;color:var(--ink)}
.hl-search input:focus{outline-color:var(--cran)}
.hl-save{background:#fff;border-color:var(--line)}
.hl-save b{color:var(--cran)}
.hl-msg{color:var(--mut)}
.hl-msg a{color:var(--cran)!important}
.hl-foot{border-top-color:var(--line);color:var(--mut)}
.hl-foot a{color:var(--cran)}
.hl a.hl-btn-gold{color:#FFF8EC}
.hl a.hl-btn-ghost{color:var(--ink)}
.hl a.hl-btn-ghost:hover{color:var(--cran)}
.hl .hl-band-dark a.hl-btn-gold,.hl .hl-band-dark button.hl-btn-gold{color:#1F2B4D}
.hl .hl-band-red a.hl-btn-gold{color:#FFF6E3}
.hl .hl-band-dark .hl-btn-ghost{color:#FBF6EA;border-color:#5A6794}
.hl-shelf{color:var(--ink)}
.hl-sec h2,.hl-wrap h2{color:var(--ink)}
.hl .hl-band-red h2,.hl .hl-band-dark h2,.hl .hl-band-green h2{color:#FFF6E3}
.hl .hl-band-green h3{color:#FFF6E3}
`;

export const CSS = BASE_CSS + LIGHT_CSS;
