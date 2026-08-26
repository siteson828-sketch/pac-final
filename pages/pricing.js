// Honest pricing page — advertises ONLY features that exist and are delivered:
// free browsing/AI/zoom/downloads for everyone, and paid tiers that unlock
// ordering real Printful prints with a real checkout discount. No fabricated
// dpi-download tiers, API access, white-label, bulk, "commercial license" (the
// works are CC0 — already free for commercial use), or account-manager perks.
import { useState } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';

// Responsive layout lives in classes (inline styles can't do media queries): the
// 3-tier grid stacks to a single column on phones and padding tightens up.
const CSS = `
.pricing-nav{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:22px 48px;border-bottom:1px solid rgba(240,234,214,0.12)}
.pricing-wrap{max-width:1100px;margin:0 auto;padding:72px 32px}
.pricing-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;align-items:start}
@media(max-width:860px){.pricing-grid{grid-template-columns:1fr;gap:20px;max-width:440px;margin:0 auto}}
@media(max-width:600px){
  .pricing-nav{padding:16px 18px}
  .pricing-wrap{padding:40px 18px 56px}
}
`;

export default function Pricing() {
  const { status } = useSession();
  const router = useRouter();
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  async function startCheckout(tier) {
    setError('');
    // Not signed in → send to sign-in, then back here to pick a plan.
    if (status !== 'authenticated') {
      router.push('/sign-in?callbackUrl=' + encodeURIComponent('/pricing'));
      return;
    }
    setBusy(tier);
    try {
      const r = await fetch('/api/create-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      });
      const d = await r.json();
      if (r.ok && d.url) { window.location.href = d.url; return; }
      setError(d.error || 'Could not start checkout. Please try again.');
    } catch (e) {
      setError('Could not start checkout. Please try again.');
    }
    setBusy('');
  }

  const tiers = [
    {
      name: 'Free',
      price: '$0',
      period: 'forever',
      color: 'var(--muted-solid)',
      features: [
        '370,000+ artworks from 120+ museums',
        'AI-powered natural language search',
        'Gigapixel IIIF zoom viewer',
        'Free full-resolution downloads (each museum’s maximum size, CC0 public domain)',
        'Browse by museum, genre, and era',
      ],
      cta: 'Start browsing',
      href: '/viewer',
      highlighted: false,
    },
    {
      name: 'Collector',
      price: '$9.99',
      period: 'per month',
      color: 'var(--gold-bright)',
      features: [
        'Everything in Free',
        'Order museum-quality fine art prints, canvas, mugs, apparel & more',
        '10% discount on every print order',
        'Fulfilled by Printful, ships to 180+ countries',
      ],
      cta: 'Become a Collector',
      key: 'collector',
      paid: true,
      highlighted: true,
    },
    {
      name: 'Trade',
      price: '$29.99',
      period: 'per month',
      color: '#F5F1E8',
      features: [
        'Everything in Collector',
        '20% discount on every print order',
        'Priority order handling',
      ],
      cta: 'Start a Trade account',
      key: 'trade',
      paid: true,
      highlighted: false,
    },
  ];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--charcoal)', color: '#F5F1E8', fontFamily: 'var(--sans)' }}>
      <style>{CSS}</style>

      <nav className="pricing-nav">
        <a href="/" style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 500, color: '#F5F1E8', textDecoration: 'none', letterSpacing: '.02em' }}>
          Public Art <span style={{ color: 'var(--gold-bright)', fontStyle: 'italic' }}>Collections</span>
        </a>
        <div style={{ display: 'flex', gap: 18, alignItems: 'center' }}>
          <a href="/sign-in" style={{ color: 'var(--muted-solid)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.12em', textDecoration: 'none' }}>Sign in</a>
          <a href="/viewer" style={{ background: 'transparent', color: '#F5F1E8', border: '1px solid rgba(240,234,214,0.3)', padding: '9px 20px', borderRadius: 'var(--radius)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.12em', textDecoration: 'none' }}>
            Browse gallery
          </a>
        </div>
      </nav>

      <div className="pricing-wrap">
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.24em', textTransform: 'uppercase', color: 'var(--gold-bright)', marginBottom: 18 }}>Simple Pricing</div>
          <h1 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(38px,5vw,64px)', fontWeight: 400, marginBottom: 18, lineHeight: 1.06 }}>
            Access the World&apos;s Art
          </h1>
          <p style={{ fontSize: 16, color: 'var(--muted-solid)', maxWidth: 520, margin: '0 auto', lineHeight: 1.8 }}>
            Browsing, AI search, gigapixel zoom, and full-resolution downloads are free for everyone. Upgrade to order museum-quality prints with a member discount.
          </p>
          {error && (
            <div style={{ marginTop: 22, display: 'inline-block', background: 'rgba(180,60,40,0.14)', border: '1px solid rgba(200,80,60,0.4)', color: '#E0A090', borderRadius: 'var(--radius)', padding: '10px 16px', fontSize: 13 }}>
              {error}
            </div>
          )}
        </div>

        <div className="pricing-grid">
          {tiers.map(tier => (
            <div key={tier.name} style={{
              background: tier.highlighted ? 'rgba(184,148,42,0.08)' : 'var(--charcoal-2)',
              border: '1px solid ' + (tier.highlighted ? 'var(--gold-bright)' : 'rgba(240,234,214,0.12)'),
              boxShadow: tier.highlighted ? 'inset 0 0 0 1px rgba(156,124,56,0.3)' : 'inset 0 0 0 1px rgba(156,124,56,0.12)',
              borderRadius: 'var(--radius)', padding: 34, position: 'relative',
            }}>
              {tier.highlighted && (
                <div style={{ position: 'absolute', top: -11, left: '50%', transform: 'translateX(-50%)', background: 'var(--gold-bright)', color: 'var(--charcoal)', padding: '5px 16px', borderRadius: 'var(--radius)', fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.16em', whiteSpace: 'nowrap' }}>
                  Most Popular
                </div>
              )}
              <div style={{ fontFamily: 'var(--serif)', fontSize: 26, fontWeight: 500, color: tier.color, marginBottom: 10 }}>{tier.name}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
                <span style={{ fontFamily: 'var(--serif)', fontSize: 44, fontWeight: 400, color: '#F5F1E8' }}>{tier.price}</span>
                <span style={{ fontSize: 12, color: 'var(--muted-solid)', textTransform: 'uppercase', letterSpacing: '.08em' }}>{tier.period}</span>
              </div>
              <div style={{ height: '1px', background: 'rgba(240,234,214,0.12)', margin: '22px 0' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginBottom: 30 }}>
                {tier.features.map(f => (
                  <div key={f} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', fontSize: 13, color: '#B0A898', lineHeight: 1.5 }}>
                    <span style={{ color: 'var(--gold-bright)', flexShrink: 0, lineHeight: 1.5 }}>—</span>
                    {f}
                  </div>
                ))}
              </div>
              {(() => {
                const ctaStyle = {
                  display: 'block', width: '100%', textAlign: 'center', padding: '13px', borderRadius: 'var(--radius)',
                  fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.14em', textDecoration: 'none', fontFamily: 'var(--sans)', cursor: 'pointer',
                  background: tier.highlighted ? 'var(--gold-bright)' : 'transparent',
                  color: tier.highlighted ? 'var(--charcoal)' : '#F5F1E8',
                  border: tier.highlighted ? '1px solid var(--gold-bright)' : '1px solid rgba(240,234,214,0.3)',
                };
                return tier.paid ? (
                  <button onClick={() => startCheckout(tier.key)} disabled={busy === tier.key} style={{ ...ctaStyle, opacity: busy === tier.key ? 0.6 : 1 }}>
                    {busy === tier.key ? 'Starting checkout…' : tier.cta}
                  </button>
                ) : (
                  <a href={tier.href} style={ctaStyle}>{tier.cta}</a>
                );
              })()}
            </div>
          ))}
        </div>

        <div style={{ textAlign: 'center', marginTop: 52, fontSize: 11, letterSpacing: '.08em', color: '#6A6058' }}>
          All artwork is CC0 public domain · Prints fulfilled by Printful · Cancel anytime
        </div>
      </div>
    </div>
  );
}
