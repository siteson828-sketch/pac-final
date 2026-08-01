import { neon } from '@neondatabase/serverless';
import { ensureCrmTables } from '../../lib/crm';

export const dynamic = 'force-dynamic';

// Admin dashboard data, assembled from REAL tables:
//   daily_visits  → visitor counts (all-time / today / week)
//   crm_events    → identified visitor journeys, abandoned carts, top viewed
//   orders        → order list, revenue
//   users         → active subscribers
//   artworks      → DB health (total, by source, recently added)
// Gated by SYNC_SECRET. Every query is guarded so a missing table/column
// degrades to a zero/empty rather than 500-ing the whole dashboard.

const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
async function safe(fn, fb) { try { return await fn(); } catch (e) { return fb; } }
function parseRecipient(r) { if (!r) return {}; if (typeof r === 'string') { try { return JSON.parse(r); } catch { return {}; } } return r; }

const STAGE_RANK = { visitor: 1, browser: 2, interested: 3, abandoned: 4, buyer: 5, subscriber: 6 };
const EVENT_STAGE = {
  page_view: 'visitor', artwork_view: 'browser', order_started: 'interested', cart_started: 'interested',
  cart_abandoned: 'abandoned', order_completed: 'buyer', subscription: 'subscriber', repeat_purchase: 'buyer',
};
const PRICE_EXPR = `COALESCE(NULLIF(regexp_replace(COALESCE(retail_price,''),'[^0-9.]','','g'),'')::numeric,0) * COALESCE(quantity,1)`;

export default async function handler(req, res) {
  if (req.query.secret !== process.env.SYNC_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const sql = neon(process.env.DATABASE_URL);
  await safe(() => ensureCrmTables(sql), null);

  // --- visitor counters (daily_visits) ---
  const visits = (await safe(() => sql`SELECT
      COALESCE(SUM(uniques),0) AS total_u,
      COALESCE(SUM(uniques) FILTER (WHERE day = CURRENT_DATE),0) AS today_u,
      COALESCE(SUM(uniques) FILTER (WHERE day >= CURRENT_DATE - 6),0) AS week_u,
      COALESCE(SUM(pageviews),0) AS total_pv
    FROM daily_visits`, [{}]))[0] || {};

  // --- orders + revenue ---
  const o = (await safe(() => sql([`SELECT
      COUNT(*) AS total,
      COALESCE(SUM(${PRICE_EXPR}) FILTER (WHERE payment_status='succeeded'),0) AS revenue_total,
      COALESCE(SUM(${PRICE_EXPR}) FILTER (WHERE payment_status='succeeded' AND created_at >= CURRENT_DATE),0) AS revenue_today
    FROM orders`]), [{}]))[0] || {};
  const ordersList = await safe(() => sql`SELECT id, created_at, product, size, quantity, work_title,
      retail_price, recipient, status, payment_status, printful_order_id
    FROM orders ORDER BY created_at DESC LIMIT 50`, []);

  // --- subscribers + works ---
  const subs = num((await safe(() => sql`SELECT COUNT(*) AS n FROM users WHERE tier <> 'free'`, [{ n: 0 }]))[0]?.n);
  const totalWorks = num((await safe(() => sql`SELECT COUNT(*) AS n FROM artworks`, [{ n: 0 }]))[0]?.n);
  const bySource = await safe(() => sql`SELECT source, COUNT(*) AS count FROM artworks GROUP BY source ORDER BY count DESC LIMIT 20`, []);

  // --- artworks "recently added" (detect a timestamp column at runtime) ---
  let added24 = 0, added1 = 0;
  const tsCol = (await safe(() => sql`SELECT column_name FROM information_schema.columns
      WHERE table_name='artworks' AND column_name IN ('synced_at','created_at','inserted_at','added_at','updated_at')
      ORDER BY CASE column_name WHEN 'synced_at' THEN 1 WHEN 'created_at' THEN 2 ELSE 3 END LIMIT 1`, []))[0]?.column_name;
  if (tsCol) {
    added24 = num((await safe(() => sql([`SELECT COUNT(*) n FROM artworks WHERE ${tsCol} > NOW() - INTERVAL '24 hours'`]), [{ n: 0 }]))[0]?.n);
    added1 = num((await safe(() => sql([`SELECT COUNT(*) n FROM artworks WHERE ${tsCol} > NOW() - INTERVAL '1 hour'`]), [{ n: 0 }]))[0]?.n);
  }

  // --- identified visitor profiles from crm_events ---
  const events = await safe(() => sql`SELECT event, email, phone, name, artwork, museum, order_total, created_at
    FROM crm_events WHERE email IS NOT NULL ORDER BY created_at DESC LIMIT 1000`, []);
  const byEmail = new Map();
  for (const e of events) {
    let p = byEmail.get(e.email);
    if (!p) { p = { email: e.email, phone: e.phone || null, name: e.name || null, last_artwork: null, museums: new Set(), journey_stage: 'visitor', rank: 0, first_seen: e.created_at, last_seen: e.created_at, order_total: null }; byEmail.set(e.email, p); }
    if (!p.phone && e.phone) p.phone = e.phone;
    if (!p.name && e.name) p.name = e.name;
    if (e.museum) p.museums.add(e.museum);
    if (!p.last_artwork && e.artwork) p.last_artwork = e.artwork;   // events are DESC → first seen is latest
    if (e.order_total != null && p.order_total == null) p.order_total = num(e.order_total);
    if (new Date(e.created_at) < new Date(p.first_seen)) p.first_seen = e.created_at;
    if (new Date(e.created_at) > new Date(p.last_seen)) p.last_seen = e.created_at;
    const rk = STAGE_RANK[EVENT_STAGE[e.event]] || 0;
    if (rk > p.rank) { p.rank = rk; p.journey_stage = EVENT_STAGE[e.event]; }
  }
  const profiles = [...byEmail.values()].sort((a, b) => new Date(b.last_seen) - new Date(a.last_seen));
  const visitorsOut = profiles.slice(0, 50).map(p => ({
    name: p.name, email: p.email, phone: p.phone, journey_stage: p.journey_stage,
    last_artwork: p.last_artwork, museums_viewed: [...p.museums], first_seen: p.first_seen, last_seen: p.last_seen,
  }));
  const abandonedOut = profiles.filter(p => p.journey_stage === 'abandoned')
    .map(p => ({ name: p.name, email: p.email, phone: p.phone, last_artwork: p.last_artwork, last_seen: p.last_seen, order_total: p.order_total }))
    .slice(0, 25);

  // funnel (distinct identified emails reaching each stage; subscriber from users)
  const funnel = { visitor: Math.max(num(visits.total_u), byEmail.size), browser: 0, interested: 0, abandoned: 0, buyer: 0, subscriber: subs };
  for (const p of byEmail.values()) {
    if (p.rank >= STAGE_RANK.browser) funnel.browser++;
    if (p.rank >= STAGE_RANK.interested) funnel.interested++;
    if (p.rank === STAGE_RANK.abandoned) funnel.abandoned++;
    if (p.rank >= STAGE_RANK.buyer) funnel.buyer++;
  }

  const topArtworks = await safe(() => sql`SELECT artwork AS title, COUNT(*) AS views FROM crm_events
    WHERE event='artwork_view' AND artwork IS NOT NULL AND artwork <> '' GROUP BY artwork ORDER BY views DESC LIMIT 10`, []);
  const topMuseums = await safe(() => sql`SELECT museum, COUNT(*) AS views FROM crm_events
    WHERE event='artwork_view' AND museum IS NOT NULL AND museum <> '' GROUP BY museum ORDER BY views DESC LIMIT 10`, []);

  const ordersOut = (ordersList || []).map(r => {
    const rp = parseRecipient(r.recipient);
    const unit = num(String(r.retail_price || '').replace(/[^0-9.]/g, ''));
    const total = unit * num(r.quantity || 1);
    return {
      customer_name: rp.name || null, customer_email: rp.email || null,
      artwork_title: r.work_title || null, product_name: r.product || null, size: r.size || null,
      created_at: r.created_at, total: total ? total.toFixed(2) : '0.00',
      status: (r.status === 'order_confirmed' || r.payment_status === 'succeeded') ? 'completed' : (r.status || 'pending'),
      printful_order_id: r.printful_order_id || null,
    };
  });

  return res.status(200).json({
    stats: {
      total_visitors: num(visits.total_u),
      visitors_today: num(visits.today_u),
      visitors_week: num(visits.week_u),
      abandoned_carts: abandonedOut.length,
      total_orders: num(o.total),
      total_revenue: num(o.revenue_total),
      revenue_today: num(o.revenue_today),
      total_works: totalWorks,
      subscribers: subs,
      stage_visitor: funnel.visitor, stage_browser: funnel.browser, stage_interested: funnel.interested,
      stage_abandoned: funnel.abandoned, stage_buyer: funnel.buyer, stage_subscriber: funnel.subscriber,
    },
    visitors: visitorsOut,
    orders: ordersOut,
    abandoned: abandonedOut,
    top_artworks: (topArtworks || []).map(a => ({ title: a.title, views: num(a.views) })),
    top_museums: (topMuseums || []).map(m => ({ museum: m.museum, views: num(m.views) })),
    db_health: { total_works: totalWorks, added_24h: added24, added_1h: added1, by_source: (bySource || []).map(s => ({ source: s.source, count: num(s.count) })) },
  });
}
