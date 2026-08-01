// Honest pricing page — advertises ONLY features that exist and are delivered:
// free browsing/AI/zoom/downloads for everyone, and paid tiers that unlock
// ordering real Printful prints with a real checkout discount. No fabricated
// dpi-download tiers, API access, white-label, bulk, "commercial license" (the
// works are CC0 — already free for commercial use), or account-manager perks.
import { useState } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';

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
      color: '#8A8178',
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
      color: '#B8942A',
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
      color: '#F0EAD8',
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
    <div style={{ minHeight: '100vh', background: '#1A1714', color: '#F0EAD8', fontFamily: 'system-ui,sans-serif' }}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;1,400&family=DM+Sans:wght@300;400;500&display=swap" rel="stylesheet" />

      <nav style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '24px 48px', borderBottom: '0.5px solid rgba(240,234,214,0.1)' }}>
        <a href="/" style={{ fontFamily: 'Georgia,serif', fontSize: 20, color: '#F0EAD8', textDecoration: 'none' }}>
          Public Art <span style={{ color: '#B8942A' }}>Collections</span>
        </a>
        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <a href="/sign-in" style={{ color: '#8A8178', fontSize: 13, textDecoration: 'none' }}>Sign in</a>
          <a href="/viewer" style={{ background: 'transparent', color: '#F0EAD8', border: '0.5px solid rgba(240,234,214,0.25)', padding: '8px 20px', borderRadius: 4, fontSize: 13, textDecoration: 'none' }}>
            Browse gallery
          </a>
        </div>
      </nav>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '64px 32px' }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <div style={{ fontSize: 11, letterSpacing: '.15em', textTransform: 'uppercase', color: '#B8942A', marginBottom: 16 }}>Simple pricing</div>
          <h1 style={{ fontFamily: 'Georgia,serif', fontSize: 'clamp(36px,5vw,60px)', fontWeight: 300, marginBottom: 16, lineHeight: 1.1 }}>
            Access the world&apos;s art
          </h1>
          <p style={{ fontSize: 16, color: '#8A8178', maxWidth: 520, margin: '0 auto', lineHeight: 1.7 }}>
            Browsing, AI search, gigapixel zoom, and full-resolution downloads are free for everyone. Upgrade to order museum-quality prints with a member discount.
          </p>
          {error && (
            <div style={{ marginTop: 20, display: 'inline-block', background: 'rgba(180,60,40,0.12)', border: '0.5px solid rgba(200,80,60,0.4)', color: '#E0A090', borderRadius: 6, padding: '9px 16px', fontSize: 13 }}>
              {error}
            </div>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24, alignItems: 'start' }}>
          {tiers.map(tier => (
            <div key={tier.name} style={{
              background: tier.highlighted ? 'rgba(184,148,42,0.08)' : 'rgba(44,35,24,0.5)',
              border: '0.5px solid ' + (tier.highlighted ? '#B8942A' : 'rgba(240,234,214,0.1)'),
              borderRadius: 12, padding: 32, position: 'relative',
            }}>
              {tier.highlighted && (
                <div style={{ position: 'absolute', top: -12, left: '50%', transform: 'translateX(-50%)', background: '#B8942A', color: '#1A1714', padding: '4px 16px', borderRadius: 20, fontSize: 11, fontWeight: 600, whiteSpace: 'nowrap' }}>
                  Most popular
                </div>
              )}
              <div style={{ fontFamily: 'Georgia,serif', fontSize: 24, fontWeight: 300, color: tier.color, marginBottom: 8 }}>{tier.name}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4 }}>
                <span style={{ fontFamily: 'Georgia,serif', fontSize: 40, fontWeight: 300, color: '#F0EAD8' }}>{tier.price}</span>
                <span style={{ fontSize: 13, color: '#8A8178' }}>{tier.period}</span>
              </div>
              <div style={{ height: '0.5px', background: 'rgba(240,234,214,0.1)', margin: '20px 0' }} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
                {tier.features.map(f => (
                  <div key={f} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: '#B0A898', lineHeight: 1.4 }}>
                    <span style={{ color: '#B8942A', flexShrink: 0, marginTop: 1 }}>✓</span>
                    {f}
                  </div>
                ))}
              </div>
              {(() => {
                const ctaStyle = {
                  display: 'block', width: '100%', textAlign: 'center', padding: '12px', borderRadius: 4,
                  fontSize: 14, fontWeight: 600, textDecoration: 'none', fontFamily: 'inherit', cursor: 'pointer',
                  background: tier.highlighted ? '#B8942A' : 'transparent',
                  color: tier.highlighted ? '#1A1714' : '#F0EAD8',
                  border: tier.highlighted ? 'none' : '0.5px solid rgba(240,234,214,0.25)',
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

        <div style={{ textAlign: 'center', marginTop: 48, fontSize: 13, color: '#6A6058' }}>
          All artwork is CC0 public domain · Prints fulfilled by Printful · Cancel anytime
        </div>
      </div>
    </div>
  );
}
