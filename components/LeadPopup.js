import { useState, useEffect } from 'react';

const leadInput = {
  width: '100%', padding: '11px 14px',
  border: '1px solid var(--line)',
  borderRadius: 'var(--radius)', fontSize: 14, marginBottom: 10,
  fontFamily: 'var(--sans)', background: 'var(--paper)', color: 'var(--ink)',
  outline: 'none',
};

export default function LeadPopup() {
  const [show, setShow] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
    setError('');

    try {
      const res = await fetch('/api/track', {
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

      // Only mark captured / show success when the submit actually succeeded, so a
      // rate-limited (429) or failed request doesn't silently drop the lead and
      // permanently suppress the popup. The visitor can retry instead.
      if (res.ok) {
        localStorage.setItem('pac_lead_captured', 'true');
        setSubmitted(true);
        setTimeout(() => setShow(false), 3000);
      } else {
        setError('Something went wrong — please try again in a moment.');
      }
    } catch(e) {
      setError('Network error — please try again.');
    }

    setLoading(false);
  }

  if (!show) return null;

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      background: 'rgba(20,17,14,0.78)',
      zIndex: 1000,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 16,
    }}>
      <div style={{
        background: 'var(--ivory)',
        borderRadius: 'var(--radius)',
        border: '1px solid var(--line)',
        borderTop: '2px solid var(--gold)',
        padding: 32,
        maxWidth: 420,
        width: '100%',
        position: 'relative',
        boxShadow: '0 30px 80px rgba(20,17,14,0.4)',
      }}>
        <button onClick={() => setShow(false)} style={{
          position: 'absolute', top: 12, right: 16,
          background: 'none', border: 'none', fontSize: 24,
          cursor: 'pointer', color: 'var(--muted-solid)', lineHeight: 1
        }}>×</button>

        {submitted ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 40, color: 'var(--gold)', marginBottom: 10, lineHeight: 1 }}>—</div>
            <div style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 500, color: 'var(--ink)', marginBottom: 8 }}>
              Welcome
            </div>
            <p style={{ fontSize: 14, color: 'var(--muted-solid)', lineHeight: 1.6 }}>
              Thank you! We will be in touch with exclusive collections and offers.
            </p>
          </div>
        ) : (
          <>
            {/* HEADER */}
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase', color: 'var(--gold)', marginBottom: 10, fontWeight: 600 }}>
                Exclusive Access
              </div>
              <div style={{ fontFamily: 'var(--serif)', fontSize: 28, fontWeight: 500, color: 'var(--ink)', marginBottom: 10, lineHeight: 1.15 }}>
                Get the World's Art<br/>Delivered to You
              </div>
              <p style={{ fontSize: 13, color: 'var(--muted-solid)', lineHeight: 1.6 }}>
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
                style={leadInput}
              />
              <input
                value={form.email}
                onChange={e => setForm({ ...form, email: e.target.value })}
                placeholder="Email address"
                type="email"
                required
                style={leadInput}
              />
              <input
                value={form.phone}
                onChange={e => setForm({ ...form, phone: e.target.value })}
                placeholder="Mobile number (for exclusive SMS offers)"
                type="tel"
                style={{ ...leadInput, marginBottom: 16 }}
              />

              {/* BENEFITS */}
              <div style={{ marginBottom: 16 }}>
                {[
                  'Free screen-quality downloads',
                  'New museum collections first',
                  'Exclusive print offers',
                  'No spam ever — unsubscribe anytime',
                ].map(b => (
                  <div key={b} style={{ fontSize: 12, color: 'var(--ink-soft)', marginBottom: 5, display: 'flex', gap: 8, alignItems: 'baseline' }}>
                    <span style={{ color: 'var(--gold)', flexShrink: 0 }}>—</span>{b}
                  </div>
                ))}
              </div>

              {error && (
                <div style={{ fontSize: 12, color: '#B91C1C', marginBottom: 10, textAlign: 'center' }}>
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading} style={{
                width: '100%',
                background: 'var(--gold)',
                color: 'var(--ivory)',
                border: 'none',
                padding: '13px',
                borderRadius: 'var(--radius)',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '.14em',
                textTransform: 'uppercase',
                cursor: 'pointer',
                fontFamily: 'var(--sans)',
                marginBottom: 10
              }}>
                {loading ? 'Joining…' : 'Get Exclusive Access →'}
              </button>

              <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--muted-solid)' }}>
                Free forever · No credit card required
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
