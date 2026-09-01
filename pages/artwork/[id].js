import { useState } from 'react';
import Head from 'next/head';
import { neon } from '@neondatabase/serverless';
import { useShopGate, PinModal, TradeAccessPanel } from '../../lib/useShopGate';
import AuthNav from '../../components/AuthNav';
import CheckoutSheet, { PRODUCTS } from '../../components/CheckoutSheet';

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

export async function getServerSideProps({ params }) {
  try {
    const sql = neon(process.env.DATABASE_URL);
    const rows = await sql`SELECT * FROM artworks WHERE id = ${parseInt(params.id)} LIMIT 1`;
    if (!rows.length) return { notFound: true };
    const work = JSON.parse(JSON.stringify(rows[0]));

    const related = await sql`
      SELECT id, title, artist, date_text, thumb_url, source, rights_label
      FROM artworks
      WHERE commercial_ok = true AND thumb_url IS NOT NULL AND thumb_url != ''
        AND thumb_url NOT LIKE '%artic.edu%'
        AND source = ${work.source} AND id != ${work.id}
      ORDER BY RANDOM() LIMIT 4
    `;

    return { props: { work, related: JSON.parse(JSON.stringify(related)) } };
  } catch (e) {
    return { notFound: true };
  }
}

const CSS = `
/* Fonts + palette tokens live in styles/globals.css (shared system).
   This block styles the artwork detail page in the Neoclassical Museum aesthetic. */

/* NAV */
.nav{position:sticky;top:0;z-index:100;background:rgba(250,248,244,0.94);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);border-bottom:1px solid var(--line);height:68px;display:flex;align-items:center;gap:20px;padding:0 36px}
.nav-logo{font-family:var(--serif);font-size:23px;font-weight:500;text-decoration:none;color:var(--ink);white-space:nowrap;letter-spacing:.02em}
.nav-logo span{color:var(--gold);font-style:italic}
.nav-back{font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-soft);text-decoration:none;transition:color .2s var(--ease);white-space:nowrap}
.nav-back:hover{color:var(--gold)}
.nav-spacer{flex:1}
.nav-api{font-size:11px;font-weight:600;letter-spacing:.12em;text-transform:uppercase;color:var(--ink-soft);text-decoration:none;padding:9px 14px;border:1px solid var(--line);border-radius:var(--radius);transition:all .2s var(--ease)}
.nav-api:hover{color:var(--ink);border-color:var(--ink)}

/* BREADCRUMB */
.breadcrumb{padding:16px 36px;font-size:11px;letter-spacing:.04em;color:var(--muted-solid);border-bottom:1px solid var(--line-soft);display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.breadcrumb a{color:var(--muted-solid);text-decoration:none;transition:color .2s var(--ease)}
.breadcrumb a:hover{color:var(--gold)}
.breadcrumb-sep{color:var(--line-gold)}
.breadcrumb-current{color:var(--ink);font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:320px}

/* MAIN LAYOUT — sticky image left, scrollable info right */
.detail-main{display:grid;grid-template-columns:55% 45%;align-items:start;min-height:calc(100vh - 68px)}

.detail-img-panel{position:sticky;top:68px;height:calc(100vh - 68px);background:var(--charcoal);display:flex;align-items:center;justify-content:center;overflow:hidden}
.detail-img{width:100%;height:100%;object-fit:contain;padding:48px;display:block}
.detail-img-placeholder{font-family:var(--serif);font-size:80px;font-style:italic;color:var(--gold-bright);opacity:.6}

.detail-info{padding:56px 48px 80px;overflow-y:auto}

/* ARTWORK INFO */
.detail-museum{font-size:10px;text-transform:uppercase;letter-spacing:.22em;color:var(--gold);margin-bottom:14px;font-weight:600}
.detail-title{font-family:var(--serif);font-size:clamp(26px,3vw,44px);font-weight:500;line-height:1.08;margin-bottom:12px}
.detail-artist{font-size:15px;font-style:italic;color:var(--ink-soft);margin-bottom:0;line-height:1.6}

.divider{height:1px;background:var(--line);margin:26px 0}

/* METADATA */
.meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}
.meta-item label{font-size:9px;text-transform:uppercase;letter-spacing:.16em;color:var(--muted-solid);display:block;margin-bottom:5px}
.meta-item span{font-size:13px;font-weight:500;color:var(--ink);line-height:1.4;display:block}

.detail-bio{font-size:14px;color:var(--ink-soft);line-height:1.9;font-family:var(--serif)}

/* PRODUCTS */
.products-label{font-size:9px;text-transform:uppercase;letter-spacing:.2em;color:var(--gold);margin-bottom:14px;font-weight:600}
.products-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:24px}
.prod{background:transparent;border:1px solid var(--line);border-radius:var(--radius);padding:14px 8px;text-align:center;cursor:pointer;font-size:12px;color:var(--ink);transition:all .2s var(--ease);font-family:var(--serif);line-height:1.4}
.prod:hover{background:var(--ink);color:var(--ivory);border-color:var(--ink)}
.prod-price{display:block;margin-top:3px;opacity:.7;font-size:10px;letter-spacing:.06em;text-transform:uppercase;font-family:var(--sans)}

/* CTA BUTTONS */
.detail-cta{display:flex;flex-direction:column;gap:10px}
.cta-btn{display:block;text-align:center;padding:14px 20px;border-radius:var(--radius);font-size:11px;font-weight:600;letter-spacing:.14em;text-transform:uppercase;cursor:pointer;font-family:var(--sans);transition:all .2s var(--ease);border:1px solid transparent;text-decoration:none}
.cta-primary{background:var(--ink);color:var(--ivory)}
.cta-primary:hover{background:var(--charcoal-2)}
.cta-secondary{background:transparent;color:var(--ink);border-color:var(--line)}
.cta-secondary:hover{background:rgba(26,23,20,0.04);border-color:var(--ink)}

/* RELATED */
.related{padding:60px 36px 80px;border-top:1px solid var(--line);background:var(--ivory)}
.related-heading{font-family:var(--serif);font-size:30px;font-weight:400;margin-bottom:32px;max-width:1360px;margin-left:auto;margin-right:auto}
.related-heading span{color:var(--gold);font-style:italic}
.related-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:28px;max-width:1360px;margin:0 auto}
.related-card{text-decoration:none;color:inherit;border-radius:0;overflow:hidden;background:var(--paper);border:1px solid var(--line);display:flex;flex-direction:column;box-shadow:0 1px 2px rgba(26,23,20,0.04);transition:transform .3s var(--ease),box-shadow .3s var(--ease),border-color .3s var(--ease)}
.related-card:hover{transform:translateY(-4px);box-shadow:0 16px 44px rgba(26,23,20,0.16);border-color:var(--line-gold)}
.related-img{aspect-ratio:3/4;overflow:hidden;background:var(--cream-dk);border-bottom:1px solid var(--line)}
.related-img img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .5s var(--ease)}
.related-card:hover .related-img img{transform:scale(1.045)}
.related-body{padding:15px 16px 16px;background:var(--paper);flex:1}
.card-museum{font-size:8.5px;text-transform:uppercase;letter-spacing:.2em;color:var(--gold);margin-bottom:6px;font-weight:600}
.card-title{font-family:var(--serif);font-size:16px;font-weight:500;line-height:1.25;margin-bottom:4px;color:var(--ink);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.card-artist{font-size:11px;font-style:italic;color:var(--muted-solid);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

/* FOOTER */
footer{background:var(--charcoal);color:#B0A898;padding:60px 36px 32px;border-top:1px solid var(--gold)}
.footer-inner{max-width:1360px;margin:0 auto;display:grid;grid-template-columns:2fr 1fr 1fr;gap:56px}
.footer-logo{font-family:var(--serif);font-size:24px;color:#F3EFE8;margin-bottom:12px;font-weight:500}
.footer-logo span{color:var(--gold);font-style:italic}
.footer-desc{font-size:13px;line-height:1.85;color:#8A8178}
.footer-col-title{font-size:9px;text-transform:uppercase;letter-spacing:.2em;color:var(--gold);margin-bottom:16px;font-weight:600}
.footer-link{display:block;font-size:13px;color:#A69C8E;text-decoration:none;margin-bottom:9px;transition:color .2s var(--ease)}
.footer-link:hover{color:#F3EFE8}
.footer-bottom{max-width:1360px;margin:32px auto 0;border-top:1px solid rgba(240,234,214,0.1);padding-top:20px;font-size:11px;letter-spacing:.04em;color:#6A6058}

/* RESPONSIVE */
@media(max-width:960px){
  .detail-main{grid-template-columns:1fr}
  .detail-img-panel{position:relative;top:0;height:50vw;min-height:300px;max-height:520px}
  .detail-info{padding:40px 28px 60px}
  .related-grid{grid-template-columns:repeat(2,1fr)}
  .footer-inner{grid-template-columns:1fr;gap:36px}
}
@media(max-width:600px){
  .nav{padding:0 16px}
  .breadcrumb{padding:14px 16px}
  .detail-img-panel{height:72vw}
  .detail-info{padding:32px 20px 52px}
  .detail-title{font-size:26px}
  .meta-grid{grid-template-columns:1fr}
  .related-grid{gap:14px}
  .related{padding:40px 16px 60px}
}
`;

export default function ArtworkPage({ work, related }) {
  const [imgErr, setImgErr] = useState(false);
  const [checkout, setCheckout] = useState(null);  // { product, art } when the checkout sheet is open
  const gate = useShopGate();

  // Open the shared checkout sheet in place — never navigates off this page.
  const openCheckout = product => setCheckout({ product, art: work });

  const metaTitle = `${work.title}${work.artist ? ` by ${work.artist}` : ''} — Public Art Collections`;
  const metaDesc = [work.title, work.artist, work.medium, work.date_text].filter(Boolean).join(' · ')
    + '. Available as a fine art print from $18.';

  return (
    <>
      <Head>
        <title>{metaTitle}</title>
        <meta name="description" content={metaDesc} />
        {work.thumb_url && <meta property="og:image" content={work.thumb_url} />}
        <meta property="og:title" content={metaTitle} />
        <meta property="og:description" content={metaDesc} />
      </Head>
      <style>{CSS}</style>

      {/* NAV */}
      <nav className="nav">
        <a href="/" className="nav-logo">Public Art <span>Collections</span></a>
        <a href="/#gallery" className="nav-back">← Back to gallery</a>
        <span className="nav-spacer" />
        <a href="/api/artworks" className="nav-api">API</a>
        <AuthNav />
      </nav>

      {/* BREADCRUMB */}
      <div className="breadcrumb">
        <a href="/">Gallery</a>
        <span className="breadcrumb-sep">›</span>
        <a href={`/#gallery`}>{fmt(work.source)}</a>
        <span className="breadcrumb-sep">›</span>
        <span className="breadcrumb-current">{work.title}</span>
      </div>

      {/* MAIN: sticky image + scrollable info */}
      <div className="detail-main">
        <div className="detail-img-panel">
          {!imgErr && (work.full_url || work.thumb_url) ? (
            <img
              src={work.full_url || work.thumb_url}
              alt={work.title}
              className="detail-img"
              onError={e => {
                if (work.thumb_url && e.target.src !== work.thumb_url) {
                  e.target.src = work.thumb_url;
                } else {
                  setImgErr(true);
                }
              }}
            />
          ) : (
            <div className="detail-img-placeholder">—</div>
          )}
        </div>

        <div className="detail-info">
          <div className="detail-museum">{fmt(work.source)}</div>
          <h1 className="detail-title">{work.title}</h1>
          <p className="detail-artist">
            {[work.artist, work.date_text].filter(Boolean).join(' · ') || 'Unknown artist'}
          </p>

          <div className="divider" />

          <div className="meta-grid">
            {work.medium && (
              <div className="meta-item"><label>Medium</label><span>{work.medium}</span></div>
            )}
            {work.dimensions && (
              <div className="meta-item"><label>Dimensions</label><span>{work.dimensions}</span></div>
            )}
            {work.department && (
              <div className="meta-item"><label>Department</label><span>{work.department}</span></div>
            )}
            {work.country && (
              <div className="meta-item"><label>Origin</label><span>{work.country}</span></div>
            )}
            {work.movement && (
              <div className="meta-item"><label>Classification</label><span>{work.movement}</span></div>
            )}
            {work.period && (
              <div className="meta-item"><label>Period</label><span>{work.period}</span></div>
            )}
            <div className="meta-item">
              <label>Rights</label>
              <span style={{ color: 'var(--gold)' }}>{work.rights_label || 'CC0 — Public Domain'}</span>
            </div>
            <div className="meta-item">
              <label>Collection</label>
              <span>{fmt(work.source)}</span>
            </div>
          </div>

          {work.bio && (
            <>
              <div className="divider" />
              <p className="detail-bio">{work.bio}</p>
            </>
          )}

          <div className="divider" />

          {gate.shopUnlocked ? (
            <>
              <div className="products-label">Order as</div>
              <div className="products-grid">
                {PRODUCTS.map(p => (
                  <button key={p.name} className="prod" onClick={() => openCheckout(p)}>
                    {p.name}
                    <span className="prod-price">{p.price}</span>
                  </button>
                ))}
              </div>

              <div className="detail-cta">
                <button className="cta-btn cta-primary" onClick={() => openCheckout(PRODUCTS[0])}>Order a Print →</button>
              </div>
            </>
          ) : (
            <>
              <TradeAccessPanel gate={gate} />
            </>
          )}
        </div>
      </div>

      {/* RELATED */}
      {related.length > 0 && (
        <section className="related">
          <h2 className="related-heading">
            More from <span>{fmt(work.source)}</span>
          </h2>
          <div className="related-grid">
            {related.map(r => (
              <a key={r.id} href={`/artwork/${r.id}`} className="related-card">
                <div className="related-img">
                  <img src={r.thumb_url} alt={r.title} loading="lazy" />
                </div>
                <div className="related-body">
                  <div className="card-museum">{fmt(r.source)}</div>
                  <div className="card-title">{r.title}</div>
                  <div className="card-artist">{r.artist || 'Unknown artist'}</div>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* FOOTER */}
      <footer>
        <div className="footer-inner">
          <div>
            <div className="footer-logo">Public Art <span>Collections</span></div>
            <p className="footer-desc">Museum-quality art for every home. All works public domain.</p>
          </div>
          <div>
            <div className="footer-col-title">Browse</div>
            <a href="/" className="footer-link">All collections</a>
            <a href="/#gallery" className="footer-link">{fmt(work.source)}</a>
          </div>
          <div>
            <div className="footer-col-title">Info</div>
            <a href="/api/artworks" className="footer-link">API Access</a>
            <a href="#" className="footer-link">How Prints Work</a>
            <a href="#" className="footer-link">Shipping &amp; Returns</a>
          </div>
        </div>
        <div className="footer-bottom">
          © 2025 publicartcollections.net · All artwork public domain · Prints fulfilled by Printful
          <div style={{fontSize: 12, color: '#6A6058', marginTop: 8}}>
            🎨 35% of every membership is set aside for arts education in Asheville &amp; Buncombe County
          </div>
        </div>
      </footer>

      {/* CHECKOUT — shared in-place sheet (Stripe or no-charge draft) */}
      <CheckoutSheet checkout={checkout} onClose={() => setCheckout(null)} />

      {/* PIN MODAL — trade access */}
      <PinModal gate={gate} />
    </>
  );
}
