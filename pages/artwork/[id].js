import { useState } from 'react';
import Head from 'next/head';
import { neon } from '@neondatabase/serverless';

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
        AND source = ${work.source} AND id != ${work.id}
      ORDER BY RANDOM() LIMIT 4
    `;

    return { props: { work, related: JSON.parse(JSON.stringify(related)) } };
  } catch (e) {
    return { notFound: true };
  }
}

const CSS = `
*{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth}
body{font-family:system-ui,-apple-system,sans-serif;background:#FAF8F4;color:#1A1714}

/* NAV */
.nav{position:sticky;top:0;z-index:100;background:rgba(250,248,244,0.97);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);border-bottom:0.5px solid rgba(26,23,20,0.12);height:62px;display:flex;align-items:center;gap:20px;padding:0 32px}
.nav-logo{font-family:Georgia,serif;font-size:18px;font-weight:400;text-decoration:none;color:#1A1714;white-space:nowrap}
.nav-logo span{color:#B8942A}
.nav-back{font-size:13px;color:#8A8178;text-decoration:none;transition:color .15s;white-space:nowrap}
.nav-back:hover{color:#1A1714}
.nav-spacer{flex:1}
.nav-api{font-size:12px;color:#8A8178;text-decoration:none;padding:6px 12px;border:0.5px solid rgba(26,23,20,0.18);border-radius:4px;transition:all .15s}
.nav-api:hover{color:#1A1714;border-color:rgba(26,23,20,0.4)}

/* BREADCRUMB */
.breadcrumb{padding:14px 32px;font-size:12px;color:#8A8178;border-bottom:0.5px solid rgba(26,23,20,0.07);display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.breadcrumb a{color:#8A8178;text-decoration:none;transition:color .15s}
.breadcrumb a:hover{color:#1A1714}
.breadcrumb-sep{color:#C8C0B8}
.breadcrumb-current{color:#1A1714;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:320px}

/* MAIN LAYOUT — sticky image left, scrollable info right */
.detail-main{display:grid;grid-template-columns:55% 45%;align-items:start;min-height:calc(100vh - 62px)}

.detail-img-panel{position:sticky;top:62px;height:calc(100vh - 62px);background:#1C1814;display:flex;align-items:center;justify-content:center;overflow:hidden}
.detail-img{width:100%;height:100%;object-fit:contain;padding:40px;display:block}
.detail-img-placeholder{font-size:96px;color:#B8942A;opacity:0.5}

.detail-info{padding:48px 44px 72px;overflow-y:auto}

/* ARTWORK INFO */
.detail-museum{font-size:10px;text-transform:uppercase;letter-spacing:.18em;color:#B8942A;margin-bottom:12px;font-weight:500}
.detail-title{font-family:Georgia,serif;font-size:clamp(24px,2.8vw,40px);font-weight:300;line-height:1.1;margin-bottom:10px}
.detail-artist{font-size:14px;color:#4A4540;margin-bottom:0;line-height:1.6}

.divider{height:0.5px;background:rgba(26,23,20,0.1);margin:24px 0}

/* METADATA */
.meta-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.meta-item label{font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:#8A8178;display:block;margin-bottom:4px}
.meta-item span{font-size:13px;font-weight:500;color:#1A1714;line-height:1.4;display:block}

.detail-bio{font-size:13px;color:#4A4540;line-height:1.85}

/* PRODUCTS */
.products-label{font-size:9px;text-transform:uppercase;letter-spacing:.14em;color:#8A8178;margin-bottom:12px;font-weight:500}
.products-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:20px}
.prod{background:#EDE8DF;border:none;border-radius:6px;padding:12px 6px;text-align:center;cursor:pointer;font-size:11px;color:#4A4540;transition:all .15s;font-family:inherit;line-height:1.45}
.prod:hover{background:#1A1714;color:#FAF8F4}
.prod-icon{font-size:20px;display:block;margin-bottom:3px}
.prod-price{opacity:.65;font-size:10px}

/* CTA BUTTONS */
.detail-cta{display:flex;flex-direction:column;gap:8px}
.cta-btn{display:block;text-align:center;padding:13px 20px;border-radius:5px;font-size:13px;font-weight:500;cursor:pointer;font-family:inherit;transition:all .15s;border:none;text-decoration:none}
.cta-primary{background:#1A1714;color:#FAF8F4}
.cta-primary:hover{background:#2C2318}
.cta-secondary{background:transparent;color:#1A1714;border:0.5px solid rgba(26,23,20,0.22)}
.cta-secondary:hover{background:rgba(26,23,20,0.05)}

/* RELATED */
.related{padding:52px 32px 72px;border-top:0.5px solid rgba(26,23,20,0.08);background:#FAF8F4}
.related-heading{font-family:Georgia,serif;font-size:26px;font-weight:300;margin-bottom:28px}
.related-heading span{color:#B8942A}
.related-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:20px}
.related-card{text-decoration:none;color:inherit;border-radius:8px;overflow:hidden;background:#EDE8DF;display:flex;flex-direction:column;box-shadow:0 1px 4px rgba(26,23,20,0.08);transition:transform .22s,box-shadow .22s}
.related-card:hover{transform:translateY(-3px);box-shadow:0 10px 32px rgba(26,23,20,0.16)}
.related-img{aspect-ratio:3/4;overflow:hidden;background:#D4CEC3}
.related-img img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .3s}
.related-card:hover .related-img img{transform:scale(1.05)}
.related-body{padding:12px 14px 14px;background:#FAF8F4;flex:1}
.card-museum{font-size:9px;text-transform:uppercase;letter-spacing:.12em;color:#B8942A;margin-bottom:4px;font-weight:500}
.card-title{font-family:Georgia,serif;font-size:14px;font-weight:400;line-height:1.3;margin-bottom:3px;color:#1A1714;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.card-artist{font-size:11px;color:#8A8178;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

/* FOOTER */
footer{background:#2C2318;color:#B0A898;padding:48px 32px 28px}
.footer-inner{max-width:1280px;margin:0 auto;display:grid;grid-template-columns:2fr 1fr 1fr;gap:48px}
.footer-logo{font-family:Georgia,serif;font-size:20px;color:#F3EFE8;margin-bottom:10px}
.footer-logo span{color:#B8942A}
.footer-desc{font-size:13px;line-height:1.75;color:#6A6058}
.footer-col-title{font-size:9px;text-transform:uppercase;letter-spacing:.14em;color:#6A6058;margin-bottom:14px}
.footer-link{display:block;font-size:13px;color:#8A8178;text-decoration:none;margin-bottom:7px;transition:color .15s}
.footer-link:hover{color:#F3EFE8}
.footer-bottom{max-width:1280px;margin:28px auto 0;border-top:0.5px solid rgba(240,234,214,0.08);padding-top:20px;font-size:12px;color:#4A4540}

/* RESPONSIVE */
@media(max-width:960px){
  .detail-main{grid-template-columns:1fr}
  .detail-img-panel{position:relative;top:0;height:50vw;min-height:300px;max-height:520px}
  .detail-info{padding:36px 28px 56px}
  .related-grid{grid-template-columns:repeat(2,1fr)}
  .footer-inner{grid-template-columns:1fr;gap:32px}
}
@media(max-width:600px){
  .nav{padding:0 16px}
  .breadcrumb{padding:12px 16px}
  .detail-img-panel{height:72vw}
  .detail-info{padding:28px 20px 48px}
  .detail-title{font-size:24px}
  .meta-grid{grid-template-columns:1fr}
  .related-grid{gap:12px}
  .related{padding:36px 16px 56px}
}
`;

export default function ArtworkPage({ work, related }) {
  const [imgErr, setImgErr] = useState(false);

  const metaTitle = `${work.title}${work.artist ? ` by ${work.artist}` : ''} — Public Art Collections`;
  const metaDesc = [work.title, work.artist, work.medium, work.date_text].filter(Boolean).join(' · ')
    + '. Available as a fine art print from $18.';

  return (
    <>
      <Head>
        <title>{metaTitle}</title>
        <meta name="description" content={metaDesc} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
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
            <div className="detail-img-placeholder">🖼️</div>
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
              <span style={{ color: '#16a34a' }}>{work.rights_label || 'CC0 — Public Domain'}</span>
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

          <div className="detail-cta">
            <button className="cta-btn cta-primary">Order a Print →</button>
            {work.detail_url && (
              <a
                href={work.detail_url}
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
          © 2025 publicartcollections.org · All artwork public domain · Prints fulfilled by Printful
        </div>
      </footer>
    </>
  );
}
