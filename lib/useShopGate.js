import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';

// Tier gate for print-ordering, shared across the viewer, homepage, and artwork
// detail pages. This REPLACED the old client-side PIN gate: ordering is now
// Ordering is open to any SIGNED-IN user (membership tiers grant a discount, not
// access), so the shop unlocks on authentication. The old exported names
// (useShopGate / PinModal / TradeAccessPanel) are kept so the pages consuming
// them didn't need structural changes.
//
// This is still a UI hint — real access control lives in the order backend
// (create-payment-intent + create-order require a signed-in session), so
// bypassing this client state buys nothing.

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
  const shopUnlocked = authenticated; // any signed-in user can order; tier only affects discount

  // "Open the gate" = send the user where they can actually unlock ordering:
  // signed-out → sign in (then back to pricing); signed-in free user → pricing.
  function open() {
    if (authenticated) { router.push('/pricing'); return; }
    // Signed-out: send to sign-in, but return to the CURRENT page (mid-order),
    // not /pricing — sign-in honors this callbackUrl.
    const back = typeof window !== 'undefined' ? (window.location.pathname + window.location.search) : '/viewer';
    router.push('/sign-in?callbackUrl=' + encodeURIComponent(back));
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

// Sign-in prompt shown in place of the order UI for signed-out visitors.
// Ordering is open to any signed-in user, so this only appears when not signed
// in; gate.open() routes to sign-in.
export function TradeAccessPanel({ gate }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 12px', textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
      <div style={{ fontFamily: 'Georgia,serif', fontSize: 22, fontWeight: 300, marginBottom: 8, color: '#1A1714' }}>
        Order museum-quality prints
      </div>
      <p style={{ fontSize: 13, color: '#8A8178', marginBottom: 20, lineHeight: 1.6, maxWidth: 300 }}>
        Sign in to order prints, canvas, and more of this work. Browsing and full-resolution downloads stay free.
      </p>
      <button onClick={gate.open}
        style={{ background: '#B8942A', color: '#1A1714', border: 'none', padding: '12px 28px', borderRadius: 4, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'system-ui' }}>
        Sign in to order →
      </button>
    </div>
  );
}

// The PIN modal is gone — gating now navigates to sign-in/pricing. Kept as a
// no-op export so pages that still render <PinModal gate={gate} /> don't break.
export function PinModal() {
  return null;
}
