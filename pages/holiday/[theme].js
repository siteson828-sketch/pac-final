import { useState } from 'react';
import Head from 'next/head';
import { CATALOG } from '../../lib/printful-catalog';
import { THEMES, ALL_PICKS, themeBySlug } from '../../lib/holidayThemes';
import { CSS, FONT_LINKS, Holly, HolidayNav, HolidayFoot, PicksGrid, useArtPicks, useCurated } from '../../components/HolidayKit';

// /holiday/<theme>: a short list of choices for one mood. Every card opens the normal
// artwork page (product, size, gift message, checkout). Below the picks: a way to
// search every museum, and the member-savings offer.

export async function getStaticPaths() {
  return { paths: [...THEMES, ALL_PICKS].map(t => ({ params: { theme: t.slug } })), fallback: false };
}
export async function getStaticProps({ params }) {
  const t = themeBySlug(params.theme);
  if (!t) return { notFound: true };
  return { props: { theme: { slug: t.slug, name: t.name, sub: t.sub, q: t.q } } };
}

function posterPrice() {
  const p = CATALOG['Framed Poster'];
  const nums = p ? [...Object.values(p.prices || {}), p.defaultPrice].map(parseFloat).filter(n => n > 0) : [];
  return nums.length ? Math.min(...nums) : null;
}

export default function HolidayTheme({ theme }) {
  const cur = useCurated(theme.slug, { pages: 3 });
  const needFallback = !cur.loading && cur.famous.length + cur.similar.length === 0;
  const fb = useArtPicks(needFallback ? theme.q : '');
  const [shown, setShown] = useState(24);
  const empty = !cur.loading && !fb.loading && cur.famous.length + cur.similar.length + fb.works.length === 0;
  const price = posterPrice();
  const others = [...THEMES, ALL_PICKS].filter(t => t.slug !== theme.slug);
  const title = `${theme.name} — Holiday Art Gifts | Great Art Classics`;

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={`${theme.name}: ${theme.sub}. Choose a masterpiece and we'll print it as a holiday gift with your personal message.`} />
        <link rel="canonical" href={`https://www.greatartclassics.org/holiday/${theme.slug}`} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href={FONT_LINKS} rel="stylesheet" />
      </Head>
      <style>{CSS}</style>
      <div className="hl">
        <HolidayNav />

        <section className="hl-wrap" style={{ paddingTop: 36, paddingBottom: 8, position: 'relative' }}>
          <Holly w={230} style={{ top: 0, right: 8, transform: 'scaleX(-1) rotate(8deg)' }} />
          <a href="/holiday" className="hl-chip" style={{ marginBottom: 22 }}>← All holiday art</a>
          <div className="hl-eyebrow">Holiday collection</div>
          <h1 style={{ fontSize: 'clamp(44px,7vw,80px)' }}>{theme.name}</h1>
          <p className="hl-lead" style={{ marginBottom: 12 }}>{theme.sub}. Tap a piece to turn it into a gift.</p>
        </section>

        <section className="hl-wrap hl-sec" style={{ paddingTop: 28 }}>
          {(cur.loading || cur.famous.length > 0) && (
            <>
              <h2 className="hl-shelf">Famous favorites</h2>
              <PicksGrid works={cur.famous} loading={cur.loading} limit={24} />
            </>
          )}
          {cur.similar.length > 0 && (
            <>
              <h2 className="hl-shelf" style={{ marginTop: 44 }}>More in the same spirit</h2>
              <p className="hl-sub" style={{ marginBottom: 18 }}>Loved those? These are by the same hands and in the same mood.</p>
              <PicksGrid works={cur.similar} limit={cur.similar.length} />
              {cur.hasMore && (
                <div className="hl-more"><button type="button" disabled={cur.busy} className="hl-btn hl-btn-ghost" style={{ background: 'none', color: 'inherit', cursor: 'pointer', fontFamily: 'inherit' }} onClick={cur.loadMore}>{cur.busy ? 'Loading…' : 'Show more'}</button></div>
              )}
            </>
          )}
          {needFallback && <PicksGrid works={fb.works} loading={fb.loading} limit={shown} />}
          {empty && (
            <p className="hl-msg">{cur.error ? "We couldn't load this list just now." : 'No pieces found for this shelf yet.'} <a href={'/viewer?q=' + encodeURIComponent(theme.q)} style={{ color: 'var(--gold)' }}>Search every museum for “{theme.q}”</a>.</p>
          )}
        </section>

        <section className="hl-wrap" style={{ paddingBottom: 60 }}>
          <div className="hl-save">
            <p>
              <b>Gifting more than one?</b> Members save on every order. Collector members save 10% and Patron members save 20%
              {price != null ? <>, so on a ${price.toFixed(2)} framed poster, a Patron saves ${(price * 0.2).toFixed(2)}.</> : '.'}
            </p>
            <a href="/pricing" className="hl-btn hl-btn-gold">See membership plans</a>
          </div>
        </section>

        <section className="hl-band hl-band-dark">
          <div className="hl-wrap hl-sec">
            <h2>Not quite it? Search every museum.</h2>
            <p className="hl-sub">Look for a place, a painter, a pet or a color, and make it a gift too.</p>
            <form className="hl-search" action="/viewer" method="get" role="search">
              <input type="search" name="q" placeholder="Try: sailboats, Monet, blue roses" aria-label="Search every museum" maxLength={120} />
              <button type="submit" className="hl-btn hl-btn-gold" style={{ border: 0, cursor: 'pointer', fontFamily: 'inherit' }}>Search all museums</button>
            </form>
            <div className="hl-chips">
              <a className="hl-chip" href="/viewer">Browse all museums</a>
              {others.map(t => <a key={t.slug} className="hl-chip" href={'/holiday/' + t.slug}>{t.name}</a>)}
            </div>
          </div>
        </section>

        <HolidayFoot />
      </div>
    </>
  );
}
