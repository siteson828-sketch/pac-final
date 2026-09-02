import { db } from '../../lib/authdb';
import { ensureGivingTable, publicGivingTotal } from '../../lib/giving';

export const dynamic = 'force-dynamic';

// Public, PII-free giving aggregate for the pricing page:
//   { members, total }  — distinct contributing members and total $ set aside.
// No emails/names/locations are exposed. Fails soft to zeros so the pricing
// page can render even if the fund table is empty or the DB hiccups.
export default async function handler(req, res) {
  try {
    const sql = db();
    await ensureGivingTable(sql);
    const t = await publicGivingTotal(sql);
    res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    return res.status(200).json(t);
  } catch (e) {
    return res.status(200).json({ members: 0, total: 0 });
  }
}
