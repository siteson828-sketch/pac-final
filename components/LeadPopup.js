import { useState, useEffect } from 'react';

export default function LeadPopup() {
  const [show, setShow] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Don't show if already submitted this session
    if (localStorage.getItem('pac_lead_captured')) return;

    // Show after 8 seconds
    const timer = setTimeout(() => setShow(true), 8000);
    return () => clearTimeout(timer);
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);

    try {
      await fetch('/api/track', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          email: form.email,
          source: 'lead_popup',
          landing_page: window.location.href,
          referrer: document.referrer,
          utm_source: new URLSearchParams(window.location.search).get('utm_source'),
          utm_campaign: new URLSearchParams(window.location.search).get('utm_campaign'),
          journey_stage: 'interested'
        })
      });

      localStorage.setItem('pac_lead_captured', 'true');
      setSubmitted(true);
      setTimeout(() => setShow(false), 3000);
    } catch(e) {}

    setLoading(false);
  }

  if (!show) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(0,0,0,0.7)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
    }}>
      <div style={{
        background: '#FAF8F4',
        borderRadius: 12,
        padding: 32,
        maxWidth: 420,
        width: '100%',
        position: 'relative',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
      }}>
        <button onClick={() => setShow(false)} style={{
          position: 'absolute', top: 12, right: 16,
          background: 'none', border: 'none', fontSize: 24,
          cursor: 'pointer', color: '#8A8178', lineHeight: 1
        }}>×</button>

        {submitted ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎨</div>
            <div style={{ fontFamily: 'Georgia,serif', fontSize: 24, fontWeight: 300, color: '#1A1714', marginBottom: 8 }}>
              Welcome!
            </div>
            <p style={{ fontSize: 14, color: '#8A8178', lineHeight: 1.6 }}>
              Thank you! We will be in touch with exclusive collections and offers.
            </p>
          </div>
        ) : (
          <>
            {/* HEADER */}
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: '#B8942A', marginBottom: 8 }}>
                Exclusive access
              </div>
              <div style={{ fontFamily: 'Georgia,serif', fontSize: 26, fontWeight: 300, color: '#1A1714', marginBottom: 8, lineHeight: 1.2 }}>
                Get the world's art<br/>delivered to you
              </div>
              <p style={{ fontSize: 13, color: '#8A8178', lineHeight: 1.6 }}>
                Join thousands of collectors who receive curated masterpieces, exclusive print offers, and new museum arrivals.
              </p>
            </div>

            {/* FORM */}
            <form onSubmit={handleSubmit}>
              <input
                value={form.name}
                onChange={e => setForm({ ...form, name: e.target.value })}
                placeholder="Your name"
                required
                style={{
                  width: '100%', padding: '11px 14px',
                  border: '0.5px solid rgba(26,23,20,0.2)',
                  borderRadius: 4, fontSize: 14, marginBottom: 10,
                  fontFamily: 'system-ui', background: '#FAF8F4', color: '#1A1714',
                  outline: 'none'
                }}
              />
              <input
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="Email address"
                type="email"
                required
                style={{
                  width: '100%', padding: '11px 14px',
                  border: '0.5px solid rgba(26,23,20,0.2)',
                  borderRadius: 4, fontSize: 14, marginBottom: 10,
                  fontFamily: 'system-ui', background: '#FAF8F4', color: '#1A1714',
                  outline: 'none'
                }}
              />
              <input
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                placeholder="Mobile number (for exclusive SMS offers)"
                type="tel"
                style={{
                  width: '100%', padding: '11px 14px',
                  border: '0.5px solid rgba(26,23,20,0.2)',
                  borderRadius: 4, fontSize: 14, marginBottom: 16,
                  fontFamily: 'system-ui', background: '#FAF8F4', color: '#1A1714',
                  outline: 'none'
                }}
              />

              {/* BENEFITS */}
              <div style={{ marginBottom: 16 }}>
                {[
                  '✓ Free screen quality downloads',
                  '✓ New museum collections first',
                  '✓ Exclusive print offers',
                  '✓ No spam ever — unsubscribe anytime',
                ].map(b => (
                  <div key={b} style={{ fontSize: 12, color: '#4A4540', marginBottom: 4 }}>{b}</div>
                ))}
              </div>

              <button type="submit" disabled={loading} style={{
                width: '100%',
                background: '#B8942A',
                color: '#1A1714',
                border: 'none',
                padding: '13px',
                borderRadius: 4,
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'system-ui',
                marginBottom: 8
              }}>
                {loading ? 'Joining...' : 'Get exclusive access →'}
              </button>

              <div style={{ textAlign: 'center', fontSize: 11, color: '#8A8178' }}>
                Free forever · No credit card required
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
