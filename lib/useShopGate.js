import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';

// Tier gate for print-ordering, shared across the viewer, homepage, and artwork
// detail pages. This REPLACED the old client-side PIN gate: ordering is now
// unlocked only for paid tiers (collector/trade), resolved server-side from the
// authoritative /api/user-tier endpoint (backed by NextAuth + Neon). The old
// exported names (useShopGate / PinModal / TradeAccessPanel) are kept so the
// pages consuming them didn't need structural changes.
//
// This is still a UI gate — real access control lives in the order backend
// (create-order re-checks the tier), so bypassing this client state buys nothing.
const PAID_TIERS = new Set(['collector', 'trade']);

export function useShopGate() {
  const router = useRouter();
  const { status } = useSession(); // 'loading' | 'authenticated' | 'unauthenticated'
  const [tier, setTier] = useState('free');
  const [tierLoaded, setTierLoaded] = useState(false);

  useEffect(() => {
    if (status === 'loading') return;
    if (status !== 'authenticated') { setTier('free'); setTierLoaded(true); return; }
    let cancelled = false;
    fetch('/api/user-tier')
      .then(r => r.json())
      .then(d => { if (!cancelled) { setTier(d?.tier || 'free'); setTierLoaded(true); } })
      .catch(() => { if (!cancelled) { setTier('free'); setTierLoaded(true); } });
    return () => { cancelled = true; };
  }, [status]);

  const authenticated = status === 'authenticated';
  const shopUnlocked = PAID_TIERS.has(tier);

  // "Open the gate" = send the user where they can actually unlock ordering:
  // signed-out → sign in (then back to pricing); signed-in free user → pricing.
  function open() {
    if (authenticated) router.push('/pricing');
    else router.push('/sign-in?callbackUrl=' + encodeURIComponent('/pricing'));
  }

  return {
    shopUnlocked,
    tier,
    tierLoaded,
    authenticated,
    open,
    openPin: open, // legacy alias kept for existing callers
    // legacy no-op fields so any lingering PIN-modal JSX renders harmlessly
    showPinModal: false,
    setShowPinModal: () => {},
    pinInput: '', setPinInput: () => {},
    pinError: '', setPinError: () => {},
    checkPin: () => {},
  };
}

// Upgrade prompt shown in place of the order UI when the caller's tier can't
// order yet. Message adapts to signed-out vs. signed-in-free.
export function TradeAccessPanel({ gate }) {
  const signedIn = gate?.authenticated;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 12px', textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
      <div style={{ fontFamily: 'Georgia,serif', fontSize: 22, fontWeight: 300, marginBottom: 8, color: '#1A1714' }}>
        Order museum-quality prints
      </div>
      <p style={{ fontSize: 13, color: '#8A8178', marginBottom: 20, lineHeight: 1.6, maxWidth: 300 }}>
        {signedIn
          ? 'Upgrade to a Collector or Trade plan to order prints, canvas, and more of this work.'
          : 'Sign in and choose a plan to order prints of this work. Browsing and full-resolution downloads stay free.'}
      </p>
      <button onClick={gate.open}
        style={{ background: '#B8942A', color: '#1A1714', border: 'none', padding: '12px 28px', borderRadius: 4, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'system-ui' }}>
        {signedIn ? 'View plans →' : 'Sign in to order →'}
      </button>
    </div>
  );
}

// The PIN modal is gone — gating now navigates to sign-in/pricing. Kept as a
// no-op export so pages that still render <PinModal gate={gate} /> don't break.
export function PinModal() {
  return null;
}
