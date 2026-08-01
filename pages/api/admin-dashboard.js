import { neon } from '@neondatabase/serverless';
import { ensureCrmTables, ensureVisitorsTable } from '../../lib/crm';

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
  await safe(() => ensureVisitorsTable(sql), null);

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

  // --- rich visitor profiles (visitors table) ---
  const asArr = v => Array.isArray(v) ? v : (() => { try { return JSON.parse(v || '[]'); } catch (e) { return []; } })();
  const visitorRows = await safe(() => sql`SELECT
      id, email, phone, name, first_name, last_name,
      audiencelab_id, audiencelab_email, audiencelab_phone, audiencelab_name,
      audiencelab_age_range, audiencelab_gender, audiencelab_income, audiencelab_homeowner,
      audiencelab_net_worth, audiencelab_education, audiencelab_occupation,
      audiencelab_marital_status, audiencelab_children, audiencelab_interests,
      groundtruth_id, groundtruth_campaign, groundtruth_location, groundtruth_venue_type,
      utm_source, utm_medium, utm_campaign, utm_content, referrer, landing_page,
      ip, device_type, browser, os, city, state, country,
      journey_stage, artworks_viewed, museums_viewed, ai_searches,
      pages_viewed, cart_value, last_cart_artwork, total_orders, total_spent,
      first_seen, last_seen, first_visit_date, first_visit_time, last_visit_date, last_visit_time,
      sms_sent, sms_sent_at
    FROM visitors ORDER BY last_seen DESC LIMIT 100`, []);
  const visitorsOut = (visitorRows || []).map(v => ({
    ...v,
    audiencelab_interests: asArr(v.audiencelab_interests),
    artworks_viewed: asArr(v.artworks_viewed),
    museums_viewed: asArr(v.museums_viewed),
    ai_searches: asArr(v.ai_searches),
  }));

  const abandonedRows = await safe(() => sql`SELECT name, email, phone, last_cart_artwork, cart_value, last_seen
    FROM visitors WHERE cart_value > 0 AND journey_stage IN ('interested','abandoned')
    ORDER BY last_seen DESC LIMIT 25`, []);
  const abandonedOut = (abandonedRows || []).map(a => ({
    name: a.name, email: a.email, phone: a.phone, last_artwork: a.last_cart_artwork, last_seen: a.last_seen, order_total: num(a.cart_value),
  }));

  // funnel from the visitors table (subscriber count from users)
  const f = (await safe(() => sql`SELECT
      COUNT(*) AS identified,
      COUNT(*) FILTER (WHERE stage_rank >= 2) AS browser,
      COUNT(*) FILTER (WHERE stage_rank >= 3) AS interested,
      COUNT(*) FILTER (WHERE journey_stage = 'abandoned') AS abandoned,
      COUNT(*) FILTER (WHERE stage_rank >= 5) AS buyer
    FROM visitors`, [{}]))[0] || {};
  const funnel = {
    visitor: Math.max(num(visits.total_u), num(f.identified)),
    browser: num(f.browser), interested: num(f.interested),
    abandoned: num(f.abandoned), buyer: num(f.buyer), subscriber: subs,
  };

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
