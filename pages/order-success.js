// Subscription success page. Stripe Checkout redirects here after a membership
// starts (/order-success?tier=explorer|collector|patron). Shows the giving
// amount set aside for the tier, a message personalized to the visitor's
// location (Vercel IP geo), and how many members they're joining.
import { db } from '../lib/authdb';
import { givingForTier, givingLocationMessage, publicGivingTotal } from '../lib/giving';

const TIER_NAMES = { explorer: 'Explorer', collector: 'Collector', patron: 'Patron' };

export default function OrderSuccess({ tier, giving, locationMessage, members }) {
  const tierName = TIER_NAMES[tier] || 'member';
  return (
    <div style={{ minHeight: '100vh', background: 'var(--charcoal,#1A1714)', color: '#F0EAD8', fontFamily: 'system-ui,sans-serif', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px' }}>
      <div style={{ maxWidth: 560, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🎨</div>
        <div style={{ fontSize: 11, letterSpacing: '.18em', textTransform: 'uppercase', color: '#B8942A', marginBottom: 12 }}>
          Welcome, {tierName}
        </div>
        <h1 style={{ fontFamily: 'Georgia,serif', fontSize: 'clamp(28px,5vw,40px)', fontWeight: 300, lineHeight: 1.15, marginBottom: 20 }}>
          Your membership is active
        </h1>

        {giving > 0 && (
          <div style={{ background: 'rgba(22,163,74,0.1)', border: '0.5px solid rgba(22,163,74,0.3)', borderRadius: 10, padding: '18px 22px', marginBottom: 20, color: '#16a34a', fontSize: 15, lineHeight: 1.6 }}>
            Thank you! <strong>${giving.toFixed(2)}</strong> of your membership is set aside to
            support arts education for children in Asheville &amp; Buncombe County, NC.
          </div>
        )}

        <p style={{ fontSize: 15, color: '#B0A898', lineHeight: 1.8, marginBottom: members ? 16 : 28 }}>
          {locationMessage}
        </p>

        {members > 0 && (
          <p style={{ fontSize: 13, color: '#8A8178', marginBottom: 28 }}>
            Your contribution joins <strong style={{ color: '#B8942A' }}>{members.toLocaleString()}</strong> other
            art {members === 1 ? 'lover' : 'lovers'} setting aside funds for Asheville kids.
          </p>
        )}

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="/viewer" style={{ background: '#B8942A', color: '#1A1714', padding: '13px 28px', borderRadius: 4, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
            Browse the gallery →
          </a>
          <a href="/pricing" style={{ background: 'transparent', color: '#F0EAD8', border: '1px solid rgba(240,234,214,0.3)', padding: '13px 28px', borderRadius: 4, fontSize: 13, fontWeight: 600, textDecoration: 'none' }}>
            View plans
          </a>
        </div>
      </div>
    </div>
  );
}

export async function getServerSideProps({ query, req }) {
  const tier = String(query.tier || '').toLowerCase();
  const { giving } = givingForTier(tier);

  const country = req.headers['x-vercel-ip-country'] || null;
  const region = req.headers['x-vercel-ip-country-region'] || null;
  const locationMessage = givingLocationMessage({ country, region });

  let members = 0;
  try {
    const { members: m } = await publicGivingTotal(db());
    members = m;
  } catch (e) { /* fund table may be empty/unavailable — omit the join line */ }

  return { props: { tier, giving, locationMessage, members } };
}
