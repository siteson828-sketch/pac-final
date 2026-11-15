import { useState, useEffect } from 'react';
import Head from 'next/head';
import AuthNav from '../components/AuthNav';
import { CATALOG } from '../lib/printful-catalog';
import { getThumbUrl } from '../lib/thumb';

// /holiday — a seasonal "front door" for ads, email and social. Same shop and
// checkout as the rest of the site; this page only changes the story and the way in.
// Keep the URL live all year (swap the content later) so search ranking is not lost.

const THEMES = [
  { name: 'Winter landscapes', sub: 'Snow, frost and quiet fields', q: 'winter landscape', term: 'winter', grad: 'linear-gradient(160deg,#2B3A4A,#0E141B 70%,#D8B565 170%)' },
  { name: 'Candlelit rooms', sub: 'Warm light and long evenings', q: 'candlelit interior', term: 'candle', grad: 'linear-gradient(200deg,#7A4A1E,#1A0F08 65%,#D8B565 170%)' },
  { name: 'Festive tables', sub: 'Fruit, feasts and still life', q: 'still life fruit feast', term: 'still life', grad: 'linear-gradient(150deg,#8E1F2B,#2B0F14 70%,#17382E 160%)' },
  { name: 'Madonna and child', sub: 'Classic sacred art', q: 'madonna and child', term: 'madonna', grad: 'linear-gradient(170deg,#17382E,#0A1612 70%,#D8B565 190%)' },
  { name: 'Snowy villages', sub: 'Skaters, markets and rooftops', q: 'snow village winter scene', term: 'snow', grad: 'linear-gradient(190deg,#3C4B5C,#10161D 70%,#F4EEE2 200%)' },
  { name: 'Stars and night skies', sub: 'Winter nights, painted', q: 'night sky stars', term: 'night', grad: 'linear-gradient(160deg,#1B2450,#070A1A 70%,#D8B565 190%)' },
];

const GIFTS = [
  { product: 'Framed Poster', blurb: "For the wall they've been meaning to fill" },
  { product: 'Mug', blurb: 'A masterpiece with the morning coffee' },
  { product: 'Tote Bag', blurb: 'Carry some culture' },
  { product: 'Throw Blanket', blurb: 'Wrapped in a work of art' },
];

function fromPrice(name) {
  const p = CATALOG[name];
  if (!p) return null;
  const nums = [...Object.values(p.prices || {}), p.defaultPrice].map(parseFloat).filter(n => n > 0);
  return nums.length ? Math.min(...nums) : null;
}

function Holly({ w = 220, style }) {
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

export default function Holiday() {
  // Real artwork for each theme tile (plain title search; falls back to a gradient).
  const [imgs, setImgs] = useState({});
  useEffect(() => {
    let dead = false;
    THEMES.forEach(t => {
      fetch('/api/artworks?limit=12&search=' + encodeURIComponent(t.term))
        .then(r => r.json())
        .then(d => {
          const w = (d.works || []).find(x => x.thumb_url);
          if (w && !dead) setImgs(prev => ({ ...prev, [t.term]: { src: getThumbUrl(w.thumb_url), title: w.title || '' } }));
        })
        .catch(() => {});
    });
    return () => { dead = true; };
  }, []);

  return (
    <>
      <Head>
        <title>Holiday Art Gifts — Great Art Classics</title>
        <meta name="description" content="Give a masterpiece this holiday. Choose from over two million museum artworks, printed as framed posters, mugs, totes and blankets, with your personal message." />
        <meta property="og:title" content="Holiday Art Gifts — Great Art Classics" />
        <meta property="og:description" content="Pick a masterpiece. We print it as a holiday gift and ship it with your message." />
        <link rel="canonical" href="https://www.greatartclassics.org/holiday" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;1,500&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </Head>
      <style>{CSS}</style>

      <div className="hl">
        <div className="hl-bar">Holiday gift edition &nbsp;·&nbsp; Add a personal message to any gift</div>

        <nav className="hl-nav">
          <a href="/" className="hl-logo">Great Art <span>Classics</span></a>
          <div className="hl-links">
            <a href="#shop">Shop gifts</a>
            <a href="#personal">Make it personal</a>
            <a href="#holiday">Holiday collection</a>
            <AuthNav />
          </div>
        </nav>

        <section className="hl-hero">
          <div className="hl-hero-text">
            <div className="hl-eyebrow">Holiday art, printed as gifts</div>
            <h1>Give a <em>masterpiece.</em></h1>
            <p className="hl-lead">Pick a masterpiece from over two million museum works. We print it as a holiday gift, add your personal message, and ship it to their door.</p>
            <div className="hl-cta">
              <a href="#holiday" className="hl-btn hl-btn-gold">Shop holiday gifts</a>
              <a href="#personal" className="hl-btn hl-btn-ghost">How it works</a>
            </div>
            <p className="hl-fine">Printed to order &nbsp;·&nbsp; Your message ships with the gift &nbsp;·&nbsp; Prints, mugs, totes, blankets and more</p>
          </div>
          <div className="hl-hero-art">
            <Holly w={250} style={{ top: -52, left: -24, transform: 'rotate(18deg)' }} />
            <Holly w={220} style={{ bottom: -34, right: -14, transform: 'scaleX(-1) rotate(10deg)' }} />
            {THEMES.slice(0, 2).map((t, i) => (
              <a key={t.term} href={'/viewer?q=' + encodeURIComponent(t.q)} className={'hl-frame hl-frame-' + (i + 1)} aria-label={t.name}>
                <div className="hl-frame-in" style={{ background: t.grad }}>
                  {imgs[t.term] && <img src={imgs[t.term].src} alt={imgs[t.term].title} loading="lazy" />}
                </div>
              </a>
            ))}
          </div>
        </section>

        <section id="holiday" className="hl-sec hl-wrap">
          <h2>Holiday art from the world's great museums</h2>
          <p className="hl-sub">Winter snow, candlelit rooms and festive tables. Classic art that feels like the season, ready to print as a gift.</p>
          <div className="hl-grid">
            {THEMES.map(t => (
              <a key={t.term} href={'/viewer?q=' + encodeURIComponent(t.q)} className="hl-tile">
                <div className="hl-tile-img" style={{ background: t.grad }}>
                  {imgs[t.term] && <img src={imgs[t.term].src} alt={imgs[t.term].title} loading="lazy" />}
                </div>
                <div className="hl-tile-body">
                  <div className="hl-tile-name">{t.name}</div>
                  <div className="hl-tile-sub">{t.sub}</div>
                </div>
              </a>
            ))}
          </div>
        </section>

        <section id="shop" className="hl-band hl-band-dark">
          <div className="hl-wrap hl-sec" style={{ position: 'relative' }}>
            <Holly w={230} style={{ top: 14, right: 8, transform: 'scaleX(-1) rotate(8deg)' }} />
            <h2>Something for everyone on the list</h2>
            <p className="hl-sub">Pick the artwork, then pick the gift. We print it and ship it.</p>
            <div className="hl-grid hl-grid-4">
              {GIFTS.map(g => {
                const p = fromPrice(g.product);
                return (
                  <a key={g.product} href="/viewer" className="hl-gift">
                    <div className="hl-gift-img" />
                    <div className="hl-tile-name">{g.product}</div>
                    <div className="hl-tile-sub">{g.blurb}</div>
                    {p != null && <div className="hl-price">From ${p.toFixed(2)}</div>}
                  </a>
                );
              })}
            </div>
          </div>
        </section>

        <section id="personal" className="hl-band hl-band-green">
          <div className="hl-wrap hl-sec">
            <h2 style={{ maxWidth: 700 }}>Make it personal in three steps</h2>
            <div className="hl-steps">
              <div className="hl-step"><div className="hl-num">1</div><h3>Choose the art</h3><p>Search over two million works from the world's museums. Find the one that sounds like them.</p></div>
              <div className="hl-step"><div className="hl-num">2</div><h3>Add your message</h3><p>Write a note and pick the occasion. It prints on the packing slip that arrives with the gift.</p></div>
              <div className="hl-step"><div className="hl-num">3</div><h3>We print and ship</h3><p>Printed to order and sent straight to their door, or to yours.</p></div>
            </div>
          </div>
        </section>

        <section id="members" className="hl-band hl-band-red">
          <div className="hl-wrap hl-sec hl-members">
            <div className="hl-members-text">
              <div className="hl-eyebrow hl-eyebrow-light">Members save</div>
              <h2>Buy the whole list. Save on every gift.</h2>
              <p className="hl-lead hl-lead-light">Join the club and take a percentage off every order, all year, including the holiday rush.</p>
            </div>
            <div className="hl-card">
              <Holly w={210} style={{ top: -46, right: -18, transform: 'rotate(-8deg)' }} />
              <div className="hl-card-k">Collector members</div>
              <div className="hl-card-v">10% off</div>
              <div className="hl-card-n">every order, all year</div>
              <div className="hl-card-k">Patron members</div>
              <div className="hl-card-v">20% off</div>
              <div className="hl-card-n">every order, all year</div>
              <a href="/pricing" className="hl-btn hl-btn-gold hl-btn-block">See membership plans</a>
            </div>
          </div>
        </section>

        <section className="hl-wrap hl-final">
          <h2>The gift they'll <em>actually keep.</em></h2>
          <p className="hl-sub" style={{ margin: '0 auto 32px' }}>Start with the art. We'll handle the rest.</p>
          <a href="#holiday" className="hl-btn hl-btn-gold hl-btn-lg">Shop holiday gifts</a>
        </section>

        <footer className="hl-foot">
          <Holly w={190} style={{ top: -8, left: '50%', marginLeft: -95 }} />
          © {new Date().getFullYear()} greatartclassics.org &nbsp;·&nbsp; Prints from public-domain and commercially usable museum collections
          <div style={{ marginTop: 10 }}><a href="/">Home</a> &nbsp;·&nbsp; <a href="/viewer">Browse all art</a> &nbsp;·&nbsp; <a href="/pricing">Membership</a></div>
        </footer>
      </div>
    </>
  );
}

const CSS = `
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
`;
