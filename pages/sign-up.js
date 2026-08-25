import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { signIn, useSession } from 'next-auth/react';

export default function SignUpPage() {
  const router = useRouter();
  const { status } = useSession();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (status === 'authenticated') router.replace('/pricing');
  }, [status, router]);

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setBusy(true);
    // 1) create the account, 2) sign the new user straight in.
    const reg = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });
    if (!reg.ok) {
      const j = await reg.json().catch(() => ({}));
      setBusy(false);
      setError(j.error || 'Could not create your account.');
      return;
    }
    const res = await signIn('credentials', { redirect: false, email, password });
    setBusy(false);
    if (res?.error) router.replace('/sign-in');
    else router.replace('/pricing');
  }

  return (
    <div style={wrap}>
      <div style={card}>
        <a href="/" style={{ ...brand, textDecoration: 'none', display: 'block', textAlign: 'center' }}>
          Public Art <span style={{ color: 'var(--gold-bright)', fontStyle: 'italic' }}>Collections</span>
        </a>
        <div style={eyebrow}>Join</div>
        <h1 style={title}>Create your account</h1>

        <form onSubmit={onSubmit}>
          <label style={label}>Name (optional)</label>
          <input value={name} onChange={e => setName(e.target.value)} style={input} autoComplete="name" />
          <label style={label}>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required style={input} autoComplete="email" />
          <label style={label}>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={8} style={input} autoComplete="new-password" />
          {error && <div style={errBox}>{error}</div>}
          <button type="submit" disabled={busy} style={{ ...primaryBtn, opacity: busy ? 0.6 : 1 }}>
            {busy ? 'Creating…' : 'Create account'}
          </button>
        </form>

        <div style={foot}>
          Already have an account? <a href="/sign-in" style={link}>Sign in</a>
        </div>
      </div>
    </div>
  );
}

const wrap = { minHeight: '100vh', background: 'var(--charcoal)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: 'var(--sans)' };
const card = { width: '100%', maxWidth: 380, background: 'var(--charcoal-2)', border: '1px solid rgba(240,234,214,0.14)', boxShadow: 'inset 0 0 0 1px rgba(156,124,56,0.22)', borderRadius: 'var(--radius)', padding: '40px 38px' };
const brand = { fontFamily: 'var(--serif)', fontSize: 20, fontWeight: 500, color: '#F5F1E8', marginBottom: 22, letterSpacing: '.02em' };
const eyebrow = { textAlign: 'center', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.24em', color: 'var(--gold-bright)', marginBottom: 10 };
const title = { fontFamily: 'var(--serif)', fontWeight: 500, fontSize: 30, color: '#F5F1E8', textAlign: 'center', margin: '0 0 28px' };
const label = { display: 'block', fontSize: 10, fontWeight: 600, textTransform: 'uppercase', color: 'var(--gold-bright)', margin: '16px 0 7px', letterSpacing: '.18em' };
const input = { width: '100%', boxSizing: 'border-box', background: '#1A1714', border: '1px solid rgba(240,234,214,0.2)', borderRadius: 'var(--radius)', padding: '12px 13px', color: '#F5F1E8', fontSize: 14, outline: 'none', fontFamily: 'var(--sans)' };
const primaryBtn = { width: '100%', marginTop: 26, background: 'var(--gold-bright)', color: 'var(--charcoal)', border: 'none', borderRadius: 'var(--radius)', padding: '13px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.14em', cursor: 'pointer', fontFamily: 'var(--sans)' };
const errBox = { marginTop: 16, background: 'rgba(180,60,40,0.14)', border: '1px solid rgba(200,80,60,0.4)', color: '#E0A090', borderRadius: 'var(--radius)', padding: '10px 12px', fontSize: 13 };
const foot = { marginTop: 24, textAlign: 'center', fontSize: 13, color: 'var(--muted-solid)' };
const link = { color: 'var(--gold-bright)', textDecoration: 'none' };
