import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { db, ensureAuthTables, getUserByEmail } from '../../lib/authdb';
import { hasStripe, createBillingPortalSession } from '../../lib/stripe';

export const dynamic = 'force-dynamic';

// Returns a Stripe Billing Portal URL for the signed-in subscriber to manage or
// cancel their plan. Requires auth + an existing Stripe customer on the account.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!hasStripe()) return res.status(501).json({ error: 'Stripe not configured' });

  let session = null;
  try { session = await getServerSession(req, res, authOptions); } catch (e) {}
  if (!session?.user?.email) return res.status(401).json({ error: 'Please sign in first.' });

  try {
    const sql = db();
    await ensureAuthTables(sql);
    const user = await getUserByEmail(sql, session.user.email.toLowerCase());
    if (!user?.stripe_customer_id) {
      return res.status(400).json({ error: 'No active subscription to manage.', noSubscription: true });
    }
    const portal = await createBillingPortalSession({
      customerId: user.stripe_customer_id,
      returnUrl: 'https://www.publicartcollections.net/pricing',
    });
    return res.status(200).json({ url: portal.url });
  } catch (e) {
    console.error('billing-portal error:', e.message);
    // Most common first-run failure: the portal hasn't been enabled in the
    // Stripe Dashboard yet (Settings → Billing → Customer portal → Save).
    const needsConfig = /configuration|portal/i.test(e.message);
    return res.status(502).json({
      error: needsConfig
        ? 'Billing portal is not enabled in Stripe yet (Dashboard → Settings → Billing → Customer portal).'
        : 'Could not open the billing portal. Please try again.',
    });
  }
}
