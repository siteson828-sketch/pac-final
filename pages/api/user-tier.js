import { getServerSession } from 'next-auth/next';
import { authOptions } from './auth/[...nextauth]';
import { db, ensureAuthTables, getTierForUser } from '../../lib/authdb';

export const dynamic = 'force-dynamic';

// Returns the caller's subscription tier. Signed-out users are 'free'. The tier
// is read fresh from Neon (source of truth for gating print-ordering and the
// order discount); it's updated by the Stripe subscription webhook.
export default async function handler(req, res) {
  let session = null;
  try { session = await getServerSession(req, res, authOptions); } catch (e) {}
  const uid = session?.user?.id;
  if (!uid) return res.status(200).json({ tier: 'free', authenticated: false });

  try {
    const sql = db();
    await ensureAuthTables(sql);
    const tier = await getTierForUser(sql, uid);
    return res.status(200).json({ tier, authenticated: true });
  } catch (e) {
    console.error('user-tier error:', e.message);
    // Fail safe: never grant a paid tier on error.
    return res.status(200).json({ tier: 'free', authenticated: true, error: true });
  }
}
