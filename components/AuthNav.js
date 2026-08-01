import { useSession, signOut } from 'next-auth/react';

// Compact, self-styled auth control dropped into each page's nav so the
// sign-in / account flow is discoverable everywhere. Dark text on the light
// nav background used across the site.
const link = {
  display: 'inline-flex', alignItems: 'center', height: 30, padding: '0 10px',
  fontSize: 12, color: '#8A8178', textDecoration: 'none', whiteSpace: 'nowrap',
  border: '0.5px solid rgba(26,23,20,0.15)', borderRadius: 6, background: 'none',
  cursor: 'pointer', fontFamily: 'inherit', lineHeight: 1,
};
const primary = { ...link, color: '#1A1714', borderColor: 'rgba(184,148,42,0.6)', background: 'rgba(184,148,42,0.08)' };

export default function AuthNav() {
  const { data: session, status } = useSession();

  // Render the signed-out links while loading too, so they appear immediately
  // (and in SSR HTML); swap to the account view once a session resolves. First
  // client render matches the server (both non-authenticated), so no hydration
  // mismatch — the account view appears on the subsequent state update.
  if (status !== 'authenticated') {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
        <a href="/pricing" style={link}>Pricing</a>
        <a href="/sign-in" style={primary}>Sign in</a>
      </span>
    );
  }

  const email = session?.user?.email || '';
  const label = email.length > 22 ? email.slice(0, 20) + '…' : email;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
      <a href="/pricing" style={link}>Pricing</a>
      <span style={{ ...link, cursor: 'default', color: '#1A1714' }} title={email}>{label || 'Account'}</span>
      <button onClick={() => signOut({ callbackUrl: '/' })} style={link}>Sign out</button>
    </span>
  );
}
