import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Unsubscribe() {
  const router = useRouter();
  const [state, setState] = useState('processing'); // processing | done | failed

  useEffect(() => {
    if (!router.isReady) return;
    const { email, phone } = router.query;
    if (!email && !phone) { setState('failed'); return; }
    const qs = new URLSearchParams();
    if (email) qs.set('email', String(email));
    if (phone) qs.set('phone', String(phone));
    fetch('/api/unsubscribe?' + qs.toString(), { method: 'POST' })
      .then(r => setState(r.ok ? 'done' : 'failed'))
      .catch(() => setState('failed'));
  }, [router.isReady, router.query]);

  return (
    <div style={{ minHeight: '100vh', background: '#1A1714', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#F0EAD8', fontFamily: 'Georgia,serif', textAlign: 'center', padding: 32 }}>
      <div>
        <div style={{ fontSize: 40, marginBottom: 16 }}>{state === 'failed' ? '⚠️' : '✓'}</div>
        <h1 style={{ fontSize: 28, fontWeight: 300, marginBottom: 8 }}>
          {state === 'done' ? 'You have been unsubscribed'
            : state === 'failed' ? "We couldn't process that"
            : 'Processing…'}
        </h1>
        <p style={{ fontSize: 14, color: '#8A8178', marginBottom: 24 }}>
          {state === 'done' ? 'You will no longer receive marketing emails or SMS from Public Art Collections.'
            : state === 'failed' ? 'The unsubscribe link may be missing its address. Contact hello@publicartcollections.net and we will remove you.'
            : 'One moment while we update your preferences.'}
        </p>
        <a href="/" style={{ color: '#B8942A', fontSize: 14 }}>Return to homepage</a>
      </div>
    </div>
  );
}
