import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { signIn, useSession } from 'next-auth/react';

export default function SignInPage() {
  const router = useRouter();
  const { status } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [googleAvailable, setGoogleAvailable] = useState(false);

  // Only show the Google button if the Google provider is actually configured.
  useEffect(() => {
    fetch('/api/auth/providers')
      .then(r => r.json())
      .then(p => setGoogleAvailable(!!p?.google))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (status === 'authenticated') router.replace('/viewer');
  }, [status, router]);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    const res = await signIn('credentials', { redirect: false, email, password });
    setBusy(false);
    if (res?.error) setError('Invalid email or password.');
    else router.replace('/viewer');
  }

  return (
    <div style={wrap}>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400&display=swap" rel="stylesheet" />
      <div style={card}>
        <a href="/" style={{ ...brand, textDecoration: 'none', display: 'block', textAlign: 'center' }}>
          Public Art <span style={{ color: '#B8942A' }}>Collections</span>
        </a>
        <h1 style={title}>Sign in</h1>

        {googleAvailable && (
          <>
            <button onClick={() => signIn('google', { callbackUrl: '/viewer' })} style={googleBtn}>
              Continue with Google
            </button>
            <div style={divider}><span style={dividerText}>or</span></div>
          </>
        )}

        <form onSubmit={onSubmit}>
          <label style={label}>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={input} autoComplete="email" />
          <label style={label}>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required style={input} autoComplete="current-password" />
          {error && <div style={errBox}>{error}</div>}
          <button type="submit" disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }}>
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div style={foot}>
          No account? <a href="/sign-up" style={link}>Create one</a>
        </div>
      </div>
    </div>
  );
}

const wrap = { minHeight: '100vh', background: '#1A1714', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'system-ui,sans-serif' };
const card = { width: '100%', maxWidth: 380, background: 'rgba(44,35,24,0.5)', border: '0.5px solid rgba(240,234,214,0.12)', borderRadius: 12, padding: 36 };
const brand = { fontFamily: 'Georgia,serif', fontSize: 18, color: '#F0EAD8', marginBottom: 8 };
const title = { fontFamily: 'Georgia,serif', fontWeight: 300, fontSize: 28, color: '#F0EAD8', textAlign: 'center', margin: '4px 0 28px' };
const label = { display: 'block', fontSize: 12, color: '#8A8178', margin: '14px 0 6px', letterSpacing: '.03em' };
const input = { width: '100%', boxSizing: 'border-box', background: '#1A1714', border: '0.5px solid rgba(240,234,214,0.2)', borderRadius: 6, padding: '11px 12px', color: '#F0EAD8', fontSize: 14, outline: 'none' };
const primaryBtn = { width: '100%', marginTop: 22, background: '#B8942A', color: '#1A1714', border: 'none', borderRadius: 6, padding: '12px', fontSize: 14, fontWeight: 600, cursor: 'pointer' };
const googleBtn = { width: '100%', background: '#F0EAD8', color: '#1A1714', border: 'none', borderRadius: 6, padding: '11px', fontSize: 14, fontWeight: 500, cursor: 'pointer' };
const divider = { display: 'flex', alignItems: 'center', textAlign: 'center', margin: '20px 0 4px', borderTop: '0.5px solid rgba(240,234,214,0.12)' };
const dividerText = { position: 'relative', top: -10, margin: '0 auto', background: 'rgba(44,35,24,1)', padding: '0 12px', color: '#6A6058', fontSize: 12 };
const errBox = { marginTop: 14, background: 'rgba(180,60,40,0.12)', border: '0.5px solid rgba(200,80,60,0.4)', color: '#E0A090', borderRadius: 6, padding: '9px 12px', fontSize: 13 };
const foot = { marginTop: 22, textAlign: 'center', fontSize: 13, color: '#8A8178' };
const link = { color: '#B8942A', textDecoration: 'none' };
