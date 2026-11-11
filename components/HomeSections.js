import { useState, useEffect, useRef, useCallback } from 'react';

// Homepage sections for the "fun + clear" redesign. Self-contained on purpose:
// pages/index.js keeps ownership of data loading, checkout, tracking and SEO;
// this file only renders presentation + tiny local interactions.
//
// GIVING-COPY RULE (legal accuracy): memberships "set aside" 35% for arts
// education for children in Asheville & Buncombe County. Never say "donated" or
// imply a formal nonprofit partnership exists yet.

const GIVE = 0.35;
const TIERS = [
  { key: 'explorer',  name: 'Explorer',  price: 9.99,  perk: 'Order prints & gifts, all-access browsing' },
  { key: 'collector', name: 'Collector', price: 19.99, perk: '10% off every order', popular: true },
  { key: 'patron',    name: 'Patron',    price: 49.99, perk: '20% off every order' },
];
// Same amounts as lib/giving.js (kept literal so the page never miscalculates a cent).
const SET_ASIDE = { explorer: 3.5, collector: 7.0, patron: 17.5 };
const money = n => '$' + n.toFixed(2);

// ---- scroll helpers --------------------------------------------------------
// Fades a section in once as it scrolls into view. Safe by default: content is
// fully visible on the server, with JS off, and with reduced-motion; we only
// "arm" the hidden state for blocks that start below the fold.
function useInView(threshold = 0.15) {
  const ref = useRef(null);
  const [armed, setArmed] = useState(false);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') { setSeen(true); return; }
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setSeen(true); return; }
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) { setSeen(true); return; }
    setArmed(true);
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setSeen(true); io.disconnect(); }
    }, { threshold });
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, seen, armed];
}

function Reveal({ children, delay = 0, className = '', ...rest }) {
  const [ref, seen, armed] = useInView(0.12);
  const hidden = armed && !seen;
  return (
    <div
      ref={ref}
      className={'hs-reveal ' + (hidden ? 'hs-hide ' : '') + className}
      style={{ transitionDelay: hidden ? '0ms' : delay + 'ms' }}
      {...rest}
    >
      {children}
    </div>
  );
}

// ---- styles ----------------------------------------------------------------
export const HOME_CSS = `
.hs *{box-sizing:border-box}
.hs-sec{padding:72px 24px;scroll-margin-top:76px}
.hs-wrap{max-width:1100px;margin:0 auto}
.hs-center{text-align:center}
.hs-eyebrow{font-size:11px;letter-spacing:.22em;text-transform:uppercase;font-weight:600;color:var(--gold);margin-bottom:12px}
.hs-h2{font-family:var(--serif);font-size:clamp(30px,5vw,52px);font-weight:400;line-height:1.08;margin-bottom:14px}
.hs-h2 em{font-style:italic;color:var(--gold-bright)}
.hs-lead{font-size:16px;line-height:1.75;max-width:640px;margin:0 auto 32px;color:var(--ink-soft)}
.hs-reveal{transition:opacity .6s var(--ease),transform .6s var(--ease)}
.hs-hide{opacity:0;transform:translateY(22px)}
.hs-btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:0 28px;border-radius:var(--radius);font-size:12px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;text-decoration:none;cursor:pointer;border:1px solid transparent;font-family:var(--sans);transition:transform .2s var(--ease),background .2s var(--ease),border-color .2s var(--ease)}
.hs-btn:hover{transform:translateY(-2px)}
.hs-btn-gold{background:var(--gold-bright);color:#1A1714}
.hs-btn-gold:hover{background:#C9A43A}
.hs-btn-dark{background:var(--ink);color:var(--ivory)}
.hs-btn-ghost{background:transparent;color:inherit;border-color:currentColor}
.hs-row{display:flex;gap:12px;flex-wrap:wrap;justify-content:center}

/* TRUST STRIP */
.hs-strip{background:var(--charcoal);color:#D8D0BE;border-top:1px solid rgba(240,234,216,.08)}
.hs-strip-in{max-width:1100px;margin:0 auto;display:grid;grid-template-columns:repeat(4,1fr);text-align:center}
.hs-strip-item{padding:18px 10px;border-right:1px solid rgba(240,234,216,.08)}
.hs-strip-item:last-child{border-right:none}
.hs-strip-num{font-family:var(--serif);font-size:26px;color:var(--gold-bright);line-height:1.1}
.hs-strip-lbl{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#9A9080;margin-top:2px}

/* HOW IT WORKS */
.hs-how{background:var(--ivory)}
.hs-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;text-align:left}
.hs-step{background:var(--paper);border:1px solid var(--line);padding:28px 24px;position:relative}
.hs-step-n{font-family:var(--serif);font-size:54px;font-style:italic;color:var(--gold);opacity:.55;line-height:1;margin-bottom:8px}
.hs-step h3{font-size:24px;margin-bottom:8px}
.hs-step p{font-size:14px;line-height:1.7;color:var(--ink-soft)}
.hs-step-kids{border-color:var(--line-gold);background:linear-gradient(180deg,#FBF6E9,var(--paper))}

/* SURPRISE ME */
.hs-surprise{background:var(--parchment);border-top:1px solid var(--line-soft);border-bottom:1px solid var(--line-soft)}
.hs-stage{display:grid;grid-template-columns:minmax(220px,360px) 1fr;gap:40px;align-items:center;max-width:860px;margin:0 auto;text-align:left}
.hs-frame{background:#fff;padding:14px;border:1px solid var(--line);box-shadow:0 22px 50px rgba(26,23,20,.18);transition:transform .4s var(--ease)}
.hs-frame:hover{transform:rotate(-.6deg) scale(1.01)}
.hs-frame-in{aspect-ratio:4/5;background:var(--cream-dk);overflow:hidden;display:flex;align-items:center;justify-content:center}
.hs-frame-in img{width:100%;height:100%;object-fit:contain;display:block;animation:hsFade .5s var(--ease)}
@keyframes hsFade{from{opacity:0;transform:scale(1.03)}to{opacity:1;transform:none}}
.hs-art-museum{font-size:10px;letter-spacing:.22em;text-transform:uppercase;color:var(--gold);font-weight:600;margin-bottom:8px}
.hs-art-title{font-family:var(--serif);font-size:clamp(26px,3.4vw,38px);line-height:1.12;margin-bottom:6px}
.hs-art-artist{font-style:italic;color:var(--ink-soft);margin-bottom:22px}

/* KIDS IMPACT */
.hs-kids{background:radial-gradient(1200px 500px at 50% -10%,#2C2318 0%,#14110E 60%);color:#F0EAD8}
.hs-kids .hs-lead{color:#B9AFA0}
.hs-tabs{display:inline-flex;gap:6px;background:rgba(240,234,216,.06);padding:5px;border-radius:999px;margin-bottom:28px}
.hs-tab{border:none;background:transparent;color:#CFC6B4;font-size:13px;font-weight:600;padding:11px 20px;border-radius:999px;cursor:pointer;min-height:44px;font-family:var(--sans);transition:background .2s var(--ease),color .2s var(--ease)}
.hs-tab[aria-pressed="true"]{background:var(--gold-bright);color:#1A1714}
.hs-big{font-family:var(--serif);font-size:clamp(64px,13vw,128px);line-height:1;color:var(--gold-bright);font-weight:400}
.hs-big-cap{font-size:15px;color:#CFC6B4;margin:6px 0 4px}
.hs-year{font-size:13px;color:#9A9080;margin-bottom:26px}
.hs-bar-wrap{max-width:520px;margin:0 auto 12px}
.hs-bar{height:16px;border-radius:999px;background:rgba(240,234,216,.1);overflow:hidden}
.hs-bar-fill{height:100%;width:0;background:linear-gradient(90deg,#8F6F25,#E0B84A);border-radius:999px;transition:width 1.1s var(--ease)}
.hs-bar-lbl{display:flex;justify-content:space-between;font-size:12px;color:#9A9080;margin-top:8px}
.hs-bar-lbl b{color:#E8C766;font-weight:600}
.hs-live{display:inline-block;margin:22px 0 4px;padding:9px 16px;border:1px solid rgba(224,184,74,.45);border-radius:999px;font-size:13px;color:#E8C766;background:rgba(224,184,74,.08)}
.hs-note{max-width:620px;margin:22px auto 30px;font-size:13px;line-height:1.75;color:#8A8178}

/* TIERS */
.hs-tiers{background:var(--ivory)}
.hs-tier-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-bottom:12px;text-align:left}
.hs-tier{position:relative;background:var(--paper);border:1px solid var(--line);padding:28px 24px;display:flex;flex-direction:column;transition:transform .25s var(--ease),box-shadow .25s var(--ease)}
.hs-tier:hover{transform:translateY(-5px);box-shadow:0 18px 40px rgba(26,23,20,.14)}
.hs-tier-pop{border:2px solid var(--gold-bright);background:#FBF6E9}
.hs-badge{position:absolute;top:-12px;left:50%;transform:translateX(-50%);background:var(--gold-bright);color:#1A1714;font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;padding:5px 12px;border-radius:999px;white-space:nowrap}
.hs-tier h3{font-size:26px}
.hs-price{font-family:var(--serif);font-size:42px;line-height:1.1;margin:4px 0 12px}
.hs-price small{font-family:var(--sans);font-size:13px;color:var(--muted-solid)}
.hs-give{background:rgba(22,163,74,.1);border:1px solid rgba(22,163,74,.35);color:#136B35;border-radius:6px;padding:10px 12px;font-size:13px;font-weight:700;margin-bottom:12px}
.hs-perk{font-size:14px;color:var(--ink-soft);margin-bottom:20px;flex:1}
.hs-fine{font-size:12px;color:var(--muted-solid);margin-top:14px}

/* FINAL CTA */
.hs-final{background:var(--gold-bright);color:#1A1714;padding:64px 24px}
.hs-final h2{font-family:var(--serif);font-size:clamp(30px,5vw,48px);font-weight:400;margin-bottom:22px;line-height:1.1}
.hs-final .hs-btn-dark{background:#1A1714;color:#F5F1E8}
.hs-final .hs-btn-ghost{color:#1A1714}

/* STICKY MOBILE BAR */
.hs-sticky{position:fixed;left:0;right:0;bottom:0;z-index:90;display:none;gap:10px;padding:10px 12px calc(10px + env(safe-area-inset-bottom));background:rgba(20,17,14,.96);border-top:1px solid var(--gold);transform:translateY(110%);transition:transform .3s var(--ease)}
.hs-sticky.on{transform:none}
.hs-sticky .hs-btn{flex:1;min-height:46px;padding:0 10px;font-size:11px}
.hs-sticky-space{display:none;height:68px}

/* GALLERY POP — ink + cream base, one hot accent, bold colour blocks */
:root{--gold:#E23A1C;--gold-bright:#FF5A36;--line-gold:#FF5A36;--pop-yellow:#FFD23F;--pop-blue:#2B3FE0;--pop-pink:#FF9EC4;--pop-peach:#FFE6D2}
.hs-btn-gold{color:#fff}
.hs-btn-gold:hover{background:#E23A1C}
.hs-strip-num{color:var(--pop-yellow)}
.hs-steps .hs-step{border:2px solid #1A1714;box-shadow:6px 6px 0 #1A1714;transition:transform .2s var(--ease),box-shadow .2s var(--ease)}
.hs-steps .hs-step:hover{transform:translate(-2px,-2px);box-shadow:8px 8px 0 #1A1714}
.hs-steps .hs-step:nth-child(1){background:var(--pop-yellow)}
.hs-steps .hs-step:nth-child(2){background:var(--pop-blue);color:#fff}
.hs-steps .hs-step:nth-child(2) p{color:#E3E7FF}
.hs-steps .hs-step:nth-child(3){background:var(--pop-pink)}
.hs-steps .hs-step p{color:#1A1714}
.hs-steps .hs-step:nth-child(2) p{color:#E3E7FF}
.hs-step-n{color:inherit;opacity:1}
.hs-surprise{background:var(--pop-peach)}
.hs-frame{border:2px solid #1A1714;box-shadow:10px 10px 0 var(--pop-blue)}
.hs-art-museum{color:#E23A1C}
.hs-kids{background:var(--pop-blue);color:#fff}
.hs-kids .hs-lead,.hs-big-cap{color:#E3E7FF}
.hs-year,.hs-bar-lbl,.hs-note{color:#C9D1FF}
.hs-bar{background:rgba(255,255,255,.18)}
.hs-bar-fill{background:linear-gradient(90deg,#FF5A36,var(--pop-yellow))}
.hs-bar-lbl b,.hs-live{color:var(--pop-yellow)}
.hs-live{border-color:var(--pop-yellow);background:rgba(255,210,63,.12)}
.hs-tabs{background:rgba(255,255,255,.16)}
.hs-tab{color:#fff}
.hs-tab[aria-pressed="true"]{background:var(--pop-yellow);color:#1A1714}
.hs-tier{border:2px solid #1A1714;box-shadow:5px 5px 0 #1A1714}
.hs-tier-pop{background:var(--pop-yellow);border:2px solid #1A1714}
.hs-badge{background:#E23A1C;color:#fff;border:2px solid #1A1714}
.hs-final{background:var(--pop-pink)}
.hs-final .hs-btn-dark{background:#1A1714;color:#fff}
.hs-kids .hs-eyebrow,.hs-kids .hs-h2 em,.hs-kids .hs-big{color:var(--pop-yellow)}

@media(max-width:860px){
  .hs-sec{padding:52px 18px}
  .hs-steps,.hs-tier-grid{grid-template-columns:1fr}
  .hs-stage{grid-template-columns:1fr;gap:24px;text-align:center}
  .hs-stage .hs-row{justify-content:center}
  .hs-frame{max-width:320px;margin:0 auto}
  .hs-strip-in{grid-template-columns:repeat(2,1fr)}
  .hs-strip-item:nth-child(2){border-right:none}
  .hs-strip-item:nth-child(-n+2){border-bottom:1px solid rgba(240,234,216,.08)}
  .hs-sticky{display:flex}
  .hs-sticky-space{display:block}
  .hs-tab{padding:11px 14px;font-size:12px}
}
@media(prefers-reduced-motion:reduce){
  .hs-reveal,.hs-bar-fill,.hs-frame,.hs-btn,.hs-tier{transition:none}
  .hs-frame-in img{animation:none}
}
`;

// ---- sections --------------------------------------------------------------
export function GivingBanner() {
  return (
    <a href="#kids" style={{ display: 'block', textDecoration: 'none', background: 'linear-gradient(90deg,#1A1714,#2C2318)', color: '#F0EAD8', textAlign: 'center', padding: '11px 16px', fontSize: 13, lineHeight: 1.5, borderBottom: '1px solid #B8942A' }}>
      🎨 <strong style={{ color: '#E0B84A' }}>35% of every membership</strong> is set aside for kids&apos; art education in Asheville, NC &mdash; <span style={{ textDecoration: 'underline' }}>see how it works</span>
    </a>
  );
}

export function TrustStrip({ total }) {
  const items = [
    [total ? Number(total).toLocaleString() : '2M+', 'artworks'],
    ['120+', 'world museums'],
    ['Free', 'to browse & zoom'],
    ['35%', 'set aside for kids'],
  ];
  return (
    <div className="hs hs-strip">
      <div className="hs-strip-in">
        {items.map(([n, l]) => (
          <div key={l} className="hs-strip-item">
            <div className="hs-strip-num">{n}</div>
            <div className="hs-strip-lbl">{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function HowItWorks() {
  const steps = [
    ['1', 'Find art you love', 'Search 2 million+ works from 120+ world museums. Browsing, AI search and deep zoom are free.'],
    ['2', 'Take it home', 'Order a museum-quality print, canvas, mug, tote and more. Made and shipped by Printful.'],
    ['3', 'Back a kid’s art class', 'Join as a member and 35% of your membership is set aside for arts education for children in Asheville & Buncombe County.', true],
  ];
  return (
    <section className="hs hs-sec hs-how" id="how">
      <div className="hs-wrap hs-center">
        <Reveal>
          <div className="hs-eyebrow">How it works</div>
          <h2 className="hs-h2">Three easy steps. <em>One big heart.</em></h2>
          <p className="hs-lead">No catch, no clutter. Explore for free, order what you love, and give back if you want to.</p>
        </Reveal>
        <div className="hs-steps">
          {steps.map(([n, t, d, kids], i) => (
            <Reveal key={n} delay={i * 110} className={'hs-step' + (kids ? ' hs-step-kids' : '')}>
              <div className="hs-step-n">{n}</div>
              <h3>{t}</h3>
              <p>{d}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

// "Surprise me": picks from the works the page already loaded, so it costs no
// extra database queries.
export function SurpriseMe({ works, getThumbUrl, fmt }) {
  const pool = (works || []).filter(w => w && w.thumb_url);
  const [idx, setIdx] = useState(0);
  const [bad, setBad] = useState({});

  const another = useCallback(() => {
    if (pool.length < 2) return;
    setIdx(cur => {
      let n = cur;
      for (let tries = 0; tries < 8 && (n === cur || bad[pool[n]?.id]); tries++) n = Math.floor(Math.random() * pool.length);
      return n;
    });
  }, [pool.length, bad]); // eslint-disable-line react-hooks/exhaustive-deps

  // Start on a random work once the feed arrives.
  useEffect(() => { if (pool.length) setIdx(Math.floor(Math.random() * pool.length)); }, [pool.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const art = pool[idx % Math.max(pool.length, 1)];
  if (!art) return null;

  return (
    <section className="hs hs-sec hs-surprise" id="surprise">
      <div className="hs-wrap hs-center">
        <Reveal>
          <div className="hs-eyebrow">Feeling lucky?</div>
          <h2 className="hs-h2">Let the museum <em>surprise you</em></h2>
        </Reveal>
        <Reveal className="hs-stage" delay={100}>
          <div className="hs-frame">
            <div className="hs-frame-in">
              <img
                key={art.id}
                src={getThumbUrl(art.thumb_url)}
                alt={art.title || 'Artwork'}
                onError={() => { setBad(b => ({ ...b, [art.id]: true })); another(); }}
              />
            </div>
          </div>
          <div>
            <div className="hs-art-museum">{fmt(art.source)}</div>
            <div className="hs-art-title">{art.title || 'Untitled'}</div>
            <div className="hs-art-artist">{[art.artist, art.date_text].filter(Boolean).join(' · ') || 'Unknown artist'}</div>
            <div className="hs-row" style={{ justifyContent: 'flex-start' }}>
              <button type="button" className="hs-btn hs-btn-dark" onClick={another}>Show me another ↻</button>
              <a className="hs-btn hs-btn-ghost" href={'/artwork/' + art.id}>See it &amp; order →</a>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function KidsImpact({ givingTotal }) {
  const [tier, setTier] = useState('collector');
  const [ref, seen] = useInView(0.25);
  const t = TIERS.find(x => x.key === tier);
  const amt = SET_ASIDE[tier];
  const live = givingTotal && givingTotal.members > 0;

  return (
    <section className="hs hs-sec hs-kids" id="kids">
      <div className="hs-wrap hs-center" ref={ref}>
        <Reveal>
          <div className="hs-eyebrow">The mission</div>
          <h2 className="hs-h2">35% of every membership<br /><em>is set aside for Asheville&apos;s kids</em></h2>
          <p className="hs-lead">Pick a membership below and see exactly what it sets aside for arts education for children in Asheville &amp; Buncombe County, NC.</p>
        </Reveal>

        <Reveal delay={80}>
          <div className="hs-tabs" role="group" aria-label="Choose a membership">
            {TIERS.map(x => (
              <button key={x.key} type="button" className="hs-tab" aria-pressed={tier === x.key} onClick={() => setTier(x.key)}>
                {x.name} · ${x.price}
              </button>
            ))}
          </div>
          <div className="hs-big" aria-live="polite">{money(amt)}</div>
          <div className="hs-big-cap">set aside for Asheville kids <b>every month</b></div>
          <div className="hs-year">That&apos;s {money(amt * 12)} a year from one membership.</div>

          <div className="hs-bar-wrap">
            <div className="hs-bar"><div className="hs-bar-fill" style={{ width: seen ? (GIVE * 100) + '%' : '0%' }} /></div>
            <div className="hs-bar-lbl"><span><b>35%</b> kids&apos; art education</span><span>of your ${t.price}/mo</span></div>
          </div>
        </Reveal>

        {live && (
          <div className="hs-live">
            ✨ {givingTotal.members.toLocaleString()} {givingTotal.members === 1 ? 'member has' : 'members have'} already set aside ${Number(givingTotal.total).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
        )}

        <p className="hs-note">
          We&apos;re actively building partnerships with local schools and arts organizations so these funds reach kids directly. Until then, every dollar is tracked in a dedicated giving fund.
        </p>
        <div className="hs-row">
          <a className="hs-btn hs-btn-gold" href="/pricing">Join &amp; set aside {money(amt)}/mo →</a>
          <a className="hs-btn hs-btn-ghost" href="/viewer" style={{ color: '#F0EAD8' }}>Just browse the art</a>
        </div>
      </div>
    </section>
  );
}

export function MembershipTiers() {
  return (
    <section className="hs hs-sec hs-tiers" id="plans">
      <div className="hs-wrap hs-center">
        <Reveal>
          <div className="hs-eyebrow">Membership</div>
          <h2 className="hs-h2">Pick a plan. <em>Save on prints. Give back.</em></h2>
          <p className="hs-lead">Browsing is free for everyone. Members get discounts on every order, and 35% of the fee is set aside for kids.</p>
        </Reveal>
        <div className="hs-tier-grid">
          {TIERS.map((x, i) => (
            <Reveal key={x.key} delay={i * 100} className={'hs-tier' + (x.popular ? ' hs-tier-pop' : '')}>
              {x.popular && <div className="hs-badge">Most popular</div>}
              <h3>{x.name}</h3>
              <div className="hs-price">${x.price}<small> /month</small></div>
              <div className="hs-give">🎨 {money(SET_ASIDE[x.key])}/mo set aside for kids</div>
              <div className="hs-perk">{x.perk}</div>
              <a className={'hs-btn ' + (x.popular ? 'hs-btn-gold' : 'hs-btn-dark')} href="/pricing">Join {x.name}</a>
            </Reveal>
          ))}
        </div>
        <p className="hs-fine">Cancel anytime. Prices in USD.</p>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="hs hs-final hs-center">
      <Reveal>
        <h2>Ready to find your masterpiece?</h2>
        <div className="hs-row">
          <a className="hs-btn hs-btn-dark" href="/viewer">Explore the art</a>
          <a className="hs-btn hs-btn-ghost" href="#kids">See how kids benefit</a>
        </div>
      </Reveal>
    </section>
  );
}

// Mobile-only bottom bar that appears after the hero so the two main actions are
// always one tap away.
export function StickyCta() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const fn = () => setOn(window.scrollY > 520);
    fn();
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);
  return (
    <>
      <div className="hs hs-sticky-space" aria-hidden="true" />
      <div className={'hs hs-sticky' + (on ? ' on' : '')}>
        <a className="hs-btn hs-btn-gold" href="/viewer">Browse art</a>
        <a className="hs-btn hs-btn-ghost" href="#kids" style={{ color: '#F0EAD8' }}>Help kids</a>
      </div>
    </>
  );
}
