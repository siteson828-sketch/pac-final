import { useState, useEffect } from 'react';

// Single source of truth for the "trade access" PIN gate shared across the
// viewer, homepage, and artwork detail pages.
//
// NOTE: this is a CLIENT-SIDE SOFT GATE only. SHOP_PIN ships in the browser
// bundle and `shopUnlocked` is client state, so it is trivially bypassable.
// It restricts the casual UI; it is NOT access control. A real gate requires a
// server-side check on an actual order backend.
export const SHOP_PIN = '730492';
const STORAGE_KEY = 'shopUnlocked';

export function useShopGate() {
  const [shopUnlocked, setShopUnlocked] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinInput, setPinInput]         = useState('');
  const [pinError, setPinError]         = useState('');

  // Restore unlock for the session (shared across all pages, same origin).
  useEffect(() => {
    if (typeof window !== 'undefined' && sessionStorage.getItem(STORAGE_KEY) === 'true') {
      setShopUnlocked(true);
    }
  }, []);

  function checkPin() {
    if (pinInput === SHOP_PIN) {
      setShopUnlocked(true);
      setShowPinModal(false);
      setPinInput('');
      setPinError('');
      if (typeof window !== 'undefined') sessionStorage.setItem(STORAGE_KEY, 'true');
    } else {
      setPinError('Incorrect PIN. Please try again.');
      setPinInput('');
    }
  }

  return {
    shopUnlocked, showPinModal, setShowPinModal,
    pinInput, setPinInput, pinError, setPinError,
    checkPin, openPin: () => setShowPinModal(true),
  };
}

// Locked placeholder shown in place of an order UI when the shop is locked.
export function TradeAccessPanel({ gate }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 12px', textAlign: 'center' }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
      <div style={{ fontFamily: 'Georgia,serif', fontSize: 22, fontWeight: 300, marginBottom: 8, color: '#1A1714' }}>Trade access only</div>
      <p style={{ fontSize: 13, color: '#8A8178', marginBottom: 20, lineHeight: 1.6, maxWidth: 280 }}>
        Ordering is available to authorized trade members. Enter your PIN to access the print shop.
      </p>
      <button onClick={gate.openPin}
        style={{ background: '#B8942A', color: '#1A1714', border: 'none', padding: '12px 28px', borderRadius: 4, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'system-ui' }}>
        Enter PIN →
      </button>
    </div>
  );
}

// Shared PIN entry modal. Renders nothing unless gate.showPinModal is true.
export function PinModal({ gate }) {
  if (!gate.showPinModal) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#FAF8F4', borderRadius: 12, padding: 40, maxWidth: 360, width: '100%', textAlign: 'center', boxShadow: '0 8px 48px rgba(0,0,0,0.3)' }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>🔐</div>
        <div style={{ fontFamily: 'Georgia,serif', fontSize: 24, fontWeight: 300, marginBottom: 8, color: '#1A1714' }}>Enter your PIN</div>
        <p style={{ fontSize: 13, color: '#8A8178', marginBottom: 20 }}>Enter your trade access PIN to unlock ordering</p>
        <input
          type="password"
          value={gate.pinInput}
          onChange={e => gate.setPinInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && gate.checkPin()}
          placeholder="Enter PIN"
          autoFocus
          style={{ width: '100%', padding: '12px 16px', border: '0.5px solid rgba(26,23,20,0.25)', borderRadius: 4, fontSize: 18, textAlign: 'center', letterSpacing: '0.3em', marginBottom: 8, fontFamily: 'system-ui', background: '#FAF8F4', color: '#1A1714' }}
        />
        {gate.pinError && <p style={{ color: '#dc2626', fontSize: 12, marginBottom: 8 }}>{gate.pinError}</p>}
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <button onClick={() => { gate.setShowPinModal(false); gate.setPinInput(''); gate.setPinError(''); }}
            style={{ flex: 1, background: 'transparent', color: '#8A8178', border: '0.5px solid rgba(26,23,20,0.25)', padding: '10px', borderRadius: 4, fontSize: 13, cursor: 'pointer', fontFamily: 'system-ui' }}>
            Cancel
          </button>
          <button onClick={gate.checkPin}
            style={{ flex: 1, background: '#1A1714', color: '#FAF8F4', border: 'none', padding: '10px', borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'system-ui' }}>
            Unlock →
          </button>
        </div>
        <p style={{ fontSize: 11, color: '#8A8178', marginTop: 16 }}>
          Don&apos;t have a PIN? <a href="mailto:hello@publicartcollections.org" style={{ color: '#B8942A' }}>Request trade access</a>
        </p>
      </div>
    </div>
  );
}
