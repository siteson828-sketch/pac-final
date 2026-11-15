import Head from 'next/head';
import { CATALOG } from '../lib/printful-catalog';
import { getThumbUrl } from '../lib/thumb';
import { THEMES, FRONT_CAT, ALL_PICKS } from '../lib/holidayThemes';
import { CSS, FONT_LINKS, Holly, HolidayNav, HolidayFoot, PicksGrid, GiftArt, useArtPicks, useCurated, useCovers } from '../components/HolidayKit';

// /holiday — seasonal "front door" for ads, email and social. Same shop and checkout
// as the rest of the site; this page only changes the story and the way in:
//   front: a wall of colorful holiday picks  →  each opens the normal artwork/product page
//   boxes: curated choice pages (/holiday/<theme>)  →  not the giant search room
//   after: an option to search every museum, and the member-savings upsell
// Keep the URL live all year (swap the content later) so search ranking is not lost.

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

export default function Holiday() {
  const front = useCurated(FRONT_CAT, { pages: 4 });
  // If none of the hand-picked works are in the collection, fall back to a search.
  const needFallback = !front.loading && front.famous.length === 0;
  const fallback = useArtPicks(needFallback ? ALL_PICKS.q : '');
  const works = front.famous.length + front.similar.length ? [...front.famous, ...front.similar] : fallback.works;
  const loading = front.loading || (needFallback && fallback.loading);
  const covers = useCovers();
  const frames = works.slice(0, 2);

  return (
    <>
      <Head>
        <title>Holiday Art Gifts — Great Art Classics</title>
        <meta name="description" content="Give a masterpiece this holiday. Choose from colorful museum artworks, printed as framed posters, mugs, totes and blankets, with your personal message." />
        <meta property="og:title" content="Holiday Art Gifts — Great Art Classics" />
        <meta property="og:description" content="Pick a masterpiece. We print it as a holiday gift and ship it with your message." />
        <link rel="canonical" href="https://www.greatartclassics.org/holiday" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href={FONT_LINKS} rel="stylesheet" />
      </Head>
      <style>{CSS}</style>

      <div className="hl">
        <HolidayNav />

        <section className="hl-hero">
          <div className="hl-hero-text">
            <div className="hl-eyebrow">Holiday art, printed as gifts</div>
            <h1>Give a <em>masterpiece.</em></h1>
            <p className="hl-lead">Pick a masterpiece from the world's museums. We print it as a holiday gift, add your personal message, and ship it to their door.</p>
            <div className="hl-cta">
              <a href="#picks" className="hl-btn hl-btn-gold">See holiday picks</a>
              <a href="#personal" className="hl-btn hl-btn-ghost">How it works</a>
            </div>
            <p className="hl-fine">Printed to order &nbsp;·&nbsp; Your message ships with the gift &nbsp;·&nbsp; Prints, mugs, totes, blankets and more</p>
          </div>
          <div className="hl-hero-art">
            <Holly w={250} style={{ top: -52, left: -24, transform: 'rotate(18deg)' }} />
            <Holly w={220} style={{ bottom: -34, right: -14, transform: 'scaleX(-1) rotate(10deg)' }} />
            {[0, 1].map(i => (
              <a key={i} href={frames[i] ? '/artwork/' + frames[i].id : '#picks'} className={'hl-frame hl-frame-' + (i + 1)} aria-label={frames[i]?.title || 'Holiday pick'}>
                <div className="hl-frame-in" style={{ background: THEMES[i].grad }}>
                  {frames[i] && <img src={getThumbUrl(frames[i].thumb_url)} alt={frames[i].title || ''} />}
                </div>
              </a>
            ))}
          </div>
        </section>

        <section id="picks" className="hl-sec hl-wrap" style={{ paddingTop: 20 }}>
          <h2>Famous favorites, ready to gift</h2>
          <p className="hl-sub">Hundreds of our best, brightest works, starting with the masterpieces everyone knows. Tap one to make it a gift: a framed poster, mug, tote or blanket.</p>
          <PicksGrid works={works} loading={loading} limit={works.length} />
          {!loading && !works.length && (
            <p className="hl-msg">Our holiday picks are taking a moment to load. <a href={'/holiday/' + ALL_PICKS.slug} style={{ color: 'var(--gold)' }}>Try the full picks page</a> or <a href="#browse" style={{ color: 'var(--gold)' }}>search every museum</a>.</p>
          )}
          <div className="hl-more">
            {front.hasMore
              ? <button type="button" disabled={front.busy} className="hl-btn hl-btn-ghost" style={{ background: 'none', cursor: 'pointer', fontFamily: 'inherit' }} onClick={front.loadMore}>{front.busy ? 'Loading…' : 'Show more art'}</button>
              : <a href={'/holiday/' + ALL_PICKS.slug} className="hl-btn hl-btn-ghost">See all famous favorites</a>}
          </div>
        </section>

        <section id="holiday" className="hl-band hl-band-dark">
          <div className="hl-wrap hl-sec">
            <h2>Or shop by who it's for</h2>
            <p className="hl-sub">Each one opens a hand-picked shelf of famous pieces, then more in the same spirit.</p>
            <div className="hl-grid">
              {THEMES.map(t => (
                <a key={t.slug} href={'/holiday/' + t.slug} className="hl-tile">
                  <div className="hl-tile-img" style={{ background: t.grad }}>
                    {covers[t.slug] && <img src={getThumbUrl(covers[t.slug].thumb_url)} alt={covers[t.slug].title || t.name} loading="lazy" />}
                  </div>
                  <div className="hl-tile-body">
                    <div className="hl-tile-for">{t.for}</div>
                    <div className="hl-tile-name">{t.name}</div>
                    <div className="hl-tile-sub">{t.sub}</div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>

        <section id="shop" className="hl-wrap hl-sec" style={{ position: 'relative' }}>
          <Holly w={230} style={{ top: 14, right: 8, transform: 'scaleX(-1) rotate(8deg)' }} />
          <h2>Something for everyone on the list</h2>
          <p className="hl-sub">Pick the artwork, then pick the gift. We print it and ship it.</p>
          <div className="hl-grid hl-grid-4">
            {GIFTS.map((g, gi) => {
              const p = fromPrice(g.product);
              return (
                <a key={g.product} href="#picks" className="hl-gift">
                  <div className="hl-gift-img"><GiftArt kind={g.product} uid={gi} src={works[gi + 2] ? getThumbUrl(works[gi + 2].thumb_url) : ''} /></div>
                  <div className="hl-tile-name">{g.product}</div>
                  <div className="hl-tile-sub">{g.blurb}</div>
                  {p != null && <div className="hl-price">From ${p.toFixed(2)}</div>}
                </a>
              );
            })}
          </div>
        </section>

        <section id="personal" className="hl-band hl-band-green">
          <div className="hl-wrap hl-sec">
            <h2 style={{ maxWidth: 700 }}>Make it personal in three steps</h2>
            <div className="hl-steps">
              <div className="hl-step"><div className="hl-num">1</div><h3>Choose the art</h3><p>Tap a holiday pick, or search the museums for something that sounds like them.</p></div>
              <div className="hl-step"><div className="hl-num">2</div><h3>Add your message</h3><p>Write a note and pick the occasion. It prints on the packing slip that arrives with the gift.</p></div>
              <div className="hl-step"><div className="hl-num">3</div><h3>We print and ship</h3><p>Printed to order and sent straight to their door, or to yours.</p></div>
            </div>
          </div>
        </section>

        <section id="browse" className="hl-wrap hl-sec">
          <h2>Want something that's all theirs?</h2>
          <p className="hl-sub">Search every museum for a place, a painter, a pet, a color. Whatever sounds like them.</p>
          <form className="hl-search" action="/viewer" method="get" role="search">
            <input type="search" name="q" placeholder="Try: sailboats, Monet, blue roses" aria-label="Search every museum" maxLength={120} />
            <button type="submit" className="hl-btn hl-btn-gold" style={{ border: 0, cursor: 'pointer', fontFamily: 'inherit' }}>Search all museums</button>
          </form>
          <div className="hl-chips">
            <a className="hl-chip" href="/viewer">Browse all museums</a>
            <a className="hl-chip" href="/viewer?q=flowers">Flowers</a>
            <a className="hl-chip" href="/viewer?q=sailboats%20and%20harbors">Boats and harbors</a>
            <a className="hl-chip" href="/viewer?q=dogs%20and%20cats">Pets</a>
            <a className="hl-chip" href="/viewer?q=city%20skyline">Cities</a>
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

        <HolidayFoot />
      </div>
    </>
  );
}
