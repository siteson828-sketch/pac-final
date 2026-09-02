import { db } from '../../lib/authdb';
import { ensureGivingTable, givingAggregates, markTransferred } from '../../lib/giving';

export const dynamic = 'force-dynamic';

// Admin giving report (gated by SYNC_SECRET, same as /admin and admin-dashboard).
//   GET  /api/giving-report?secret=…          → monthly + all-time totals, tier
//                                                and location breakdowns, and the
//                                                list/sum of pending transfers.
//   POST /api/giving-report?secret=…  { action:'mark_transferred', ids?:[…] }
//                                              → marks rows transferred (all
//                                                pending if ids omitted).
export default async function handler(req, res) {
  const secret = req.method === 'POST' ? (req.body?.secret || req.query.secret) : req.query.secret;
  if (!process.env.SYNC_SECRET || secret !== process.env.SYNC_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const sql = db();
    await ensureGivingTable(sql);

    if (req.method === 'POST') {
      let body = req.body;
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = {}; } }
      if (body?.action !== 'mark_transferred') {
        return res.status(400).json({ error: 'Unknown action' });
      }
      const ids = Array.isArray(body.ids) ? body.ids.map(n => parseInt(n, 10)).filter(Number.isFinite) : null;
      await markTransferred(sql, ids);
      const agg = await givingAggregates(sql);
      return res.status(200).json({ ok: true, ...agg });
    }

    const agg = await givingAggregates(sql);
    return res.status(200).json(agg);
  } catch (e) {
    console.error('giving-report error:', e.message);
    return res.status(500).json({ error: 'Could not load giving report' });
  }
}
