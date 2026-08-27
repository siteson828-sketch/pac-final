import { neon } from '@neondatabase/serverless';

// Local, bounded CRM/analytics storage that powers the admin dashboard.
// Two tables, both storage-safe for the near-full Neon DB:
//   daily_visits — ONE row per day (pageviews + first-visit uniques counters)
//   crm_events   — append log, but ONLY for IDENTIFIED events (email/phone
//                  present), so anonymous pageviews never create rows.
// This runs alongside the external CRM push (GHL); it's our own queryable
// copy so the dashboard reflects real data instead of an empty external system.
export function crmDb() {
  return neon(process.env.DATABASE_URL);
}

let ensured = false;
export async function ensureCrmTables(sql) {
  if (ensured) return;
  await sql`CREATE TABLE IF NOT EXISTS daily_visits (
    day DATE PRIMARY KEY,
    pageviews INTEGER NOT NULL DEFAULT 0,
    uniques INTEGER NOT NULL DEFAULT 0
  )`;
  await sql`CREATE TABLE IF NOT EXISTS crm_events (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    event TEXT NOT NULL,
    email TEXT, phone TEXT, name TEXT,
    artwork TEXT, museum TEXT,
    order_total NUMERIC
  )`;
  ensured = true;
}

// One counter row per day; uniques increments only on a visitor's first visit.
export async function bumpDaily(sql, firstVisit) {
  try {
    await ensureCrmTables(sql);
    const u = firstVisit ? 1 : 0;
    await sql`INSERT INTO daily_visits (day, pageviews, uniques)
      VALUES (CURRENT_DATE, 1, ${u})
      ON CONFLICT (day) DO UPDATE SET
        pageviews = daily_visits.pageviews + 1,
        uniques = daily_visits.uniques + ${u}`;
  } catch (e) { /* analytics must never break the beacon */ }
}

// ─── Rich per-visitor enrichment profiles ──────────────────────────────────
// One row per IDENTIFIED visitor (keyed by visitor_key), upserted. Anonymous
// hits never create rows, so the table stays bounded on the near-full DB.
// Stores identity + AudienceLab/GroundTruth enrichment + UTM + device/geo +
// behavior. Sensitive demographic fields are only populated if the pixel
// actually supplies them (never fabricated).
let visitorsEnsured = false;
export async function ensureVisitorsTable(sql) {
  if (visitorsEnsured) return;
  await sql`CREATE TABLE IF NOT EXISTS visitors (
    id SERIAL PRIMARY KEY,
    visitor_key TEXT UNIQUE NOT NULL,
    email TEXT, phone TEXT, name TEXT, first_name TEXT, last_name TEXT,
    audiencelab_id TEXT, audiencelab_email TEXT, audiencelab_phone TEXT, audiencelab_name TEXT,
    audiencelab_age_range TEXT, audiencelab_gender TEXT, audiencelab_income TEXT,
    audiencelab_homeowner TEXT, audiencelab_net_worth TEXT, audiencelab_education TEXT,
    audiencelab_occupation TEXT, audiencelab_marital_status TEXT, audiencelab_children TEXT,
    audiencelab_interests JSONB DEFAULT '[]', audiencelab_raw JSONB DEFAULT '{}',
    groundtruth_id TEXT, groundtruth_campaign TEXT, groundtruth_ad_group TEXT,
    groundtruth_creative TEXT, groundtruth_location TEXT, groundtruth_venue_type TEXT,
    groundtruth_visit_time TEXT, groundtruth_raw JSONB DEFAULT '{}',
    source TEXT, utm_source TEXT, utm_medium TEXT, utm_campaign TEXT, utm_content TEXT, utm_term TEXT,
    referrer TEXT, landing_page TEXT,
    ip TEXT, user_agent TEXT, device_type TEXT, browser TEXT, os TEXT,
    city TEXT, state TEXT, country TEXT, latitude NUMERIC, longitude NUMERIC,
    journey_stage TEXT DEFAULT 'visitor', stage_rank INTEGER DEFAULT 1,
    artworks_viewed JSONB DEFAULT '[]', museums_viewed JSONB DEFAULT '[]', ai_searches JSONB DEFAULT '[]',
    pages_viewed INTEGER DEFAULT 1, time_on_site INTEGER DEFAULT 0,
    cart_value NUMERIC DEFAULT 0, last_cart_artwork TEXT, last_cart_product TEXT,
    total_orders INTEGER DEFAULT 0, total_spent NUMERIC DEFAULT 0,
    first_seen TIMESTAMPTZ DEFAULT NOW(), last_seen TIMESTAMPTZ DEFAULT NOW(),
    first_visit_date DATE DEFAULT CURRENT_DATE, first_visit_time TIME DEFAULT CURRENT_TIME,
    last_visit_date DATE DEFAULT CURRENT_DATE, last_visit_time TIME DEFAULT CURRENT_TIME,
    sms_sent BOOLEAN DEFAULT false, sms_sent_at TIMESTAMPTZ, crm_id TEXT, notes TEXT
  )`;
  visitorsEnsured = true;
}

const STAGE_RANK = { visitor: 1, browser: 2, interested: 3, abandoned: 4, buyer: 5, subscriber: 6 };
function keyFor(f) {
  if (f.email) return 'em:' + String(f.email).toLowerCase();
  if (f.audiencelab_email) return 'em:' + String(f.audiencelab_email).toLowerCase();
  if (f.audiencelab_id) return 'al:' + f.audiencelab_id;
  if (f.phone) return 'ph:' + f.phone;
  return null;
}
const capStr = (v, n = 300) => (v == null || v === '') ? null : String(v).slice(0, n);
const capJson = (v, isArr, max = 8000) => {
  try { const s = typeof v === 'string' ? v : JSON.stringify(v ?? (isArr ? [] : {})); return s.length > max ? (isArr ? '[]' : '{}') : s; }
  catch (e) { return isArr ? '[]' : '{}'; }
};

// Upsert a visitor's identity + enrichment (from /api/track). Identified only.
export async function upsertVisitor(sql, f = {}) {
  const visitor_key = keyFor(f);
  if (!visitor_key) return; // anonymous → no row (bounded)
  try {
    await ensureVisitorsTable(sql);
    await sql`INSERT INTO visitors (
      visitor_key, email, phone, name, first_name, last_name,
      audiencelab_id, audiencelab_email, audiencelab_phone, audiencelab_name,
      audiencelab_age_range, audiencelab_gender, audiencelab_income, audiencelab_homeowner,
      audiencelab_net_worth, audiencelab_education, audiencelab_occupation,
      audiencelab_marital_status, audiencelab_children, audiencelab_interests, audiencelab_raw,
      groundtruth_id, groundtruth_campaign, groundtruth_ad_group, groundtruth_creative,
      groundtruth_location, groundtruth_venue_type, groundtruth_visit_time, groundtruth_raw,
      source, utm_source, utm_medium, utm_campaign, utm_content, utm_term, referrer, landing_page,
      ip, user_agent, device_type, browser, os, city, state, country, latitude, longitude
    ) VALUES (
      ${visitor_key}, ${capStr(f.email,254)}, ${capStr(f.phone,40)}, ${capStr(f.name,120)}, ${capStr(f.first_name,80)}, ${capStr(f.last_name,80)},
      ${capStr(f.audiencelab_id,120)}, ${capStr(f.audiencelab_email,254)}, ${capStr(f.audiencelab_phone,40)}, ${capStr(f.audiencelab_name,120)},
      ${capStr(f.audiencelab_age_range,40)}, ${capStr(f.audiencelab_gender,40)}, ${capStr(f.audiencelab_income,60)}, ${capStr(f.audiencelab_homeowner,40)},
      ${capStr(f.audiencelab_net_worth,60)}, ${capStr(f.audiencelab_education,80)}, ${capStr(f.audiencelab_occupation,120)},
      ${capStr(f.audiencelab_marital_status,40)}, ${capStr(f.audiencelab_children,40)}, ${capJson(f.audiencelab_interests,true)}::jsonb, ${capJson(f.audiencelab_raw,false)}::jsonb,
      ${capStr(f.groundtruth_id,120)}, ${capStr(f.groundtruth_campaign,160)}, ${capStr(f.groundtruth_ad_group,160)}, ${capStr(f.groundtruth_creative,160)},
      ${capStr(f.groundtruth_location,160)}, ${capStr(f.groundtruth_venue_type,80)}, ${capStr(f.groundtruth_visit_time,60)}, ${capJson(f.groundtruth_raw,false)}::jsonb,
      ${capStr(f.source,160)}, ${capStr(f.utm_source,120)}, ${capStr(f.utm_medium,120)}, ${capStr(f.utm_campaign,160)}, ${capStr(f.utm_content,160)}, ${capStr(f.utm_term,160)}, ${capStr(f.referrer,500)}, ${capStr(f.landing_page,500)},
      ${capStr(f.ip,60)}, ${capStr(f.user_agent,400)}, ${capStr(f.device_type,20)}, ${capStr(f.browser,40)}, ${capStr(f.os,40)}, ${capStr(f.city,120)}, ${capStr(f.state,120)}, ${capStr(f.country,80)},
      ${Number.isFinite(Number(f.latitude)) ? Number(f.latitude) : null}, ${Number.isFinite(Number(f.longitude)) ? Number(f.longitude) : null}
    )
    ON CONFLICT (visitor_key) DO UPDATE SET
      last_seen = NOW(), last_visit_date = CURRENT_DATE, last_visit_time = CURRENT_TIME,
      pages_viewed = visitors.pages_viewed + 1,
      email = COALESCE(EXCLUDED.email, visitors.email),
      phone = COALESCE(EXCLUDED.phone, visitors.phone),
      name = COALESCE(EXCLUDED.name, visitors.name),
      first_name = COALESCE(EXCLUDED.first_name, visitors.first_name),
      last_name = COALESCE(EXCLUDED.last_name, visitors.last_name),
      audiencelab_id = COALESCE(EXCLUDED.audiencelab_id, visitors.audiencelab_id),
      audiencelab_email = COALESCE(EXCLUDED.audiencelab_email, visitors.audiencelab_email),
      audiencelab_phone = COALESCE(EXCLUDED.audiencelab_phone, visitors.audiencelab_phone),
      audiencelab_name = COALESCE(EXCLUDED.audiencelab_name, visitors.audiencelab_name),
      audiencelab_age_range = COALESCE(EXCLUDED.audiencelab_age_range, visitors.audiencelab_age_range),
      audiencelab_gender = COALESCE(EXCLUDED.audiencelab_gender, visitors.audiencelab_gender),
      audiencelab_income = COALESCE(EXCLUDED.audiencelab_income, visitors.audiencelab_income),
      audiencelab_homeowner = COALESCE(EXCLUDED.audiencelab_homeowner, visitors.audiencelab_homeowner),
      audiencelab_net_worth = COALESCE(EXCLUDED.audiencelab_net_worth, visitors.audiencelab_net_worth),
      audiencelab_education = COALESCE(EXCLUDED.audiencelab_education, visitors.audiencelab_education),
      audiencelab_occupation = COALESCE(EXCLUDED.audiencelab_occupation, visitors.audiencelab_occupation),
      audiencelab_marital_status = COALESCE(EXCLUDED.audiencelab_marital_status, visitors.audiencelab_marital_status),
      audiencelab_children = COALESCE(EXCLUDED.audiencelab_children, visitors.audiencelab_children),
      audiencelab_interests = CASE WHEN EXCLUDED.audiencelab_interests <> '[]'::jsonb THEN EXCLUDED.audiencelab_interests ELSE visitors.audiencelab_interests END,
      audiencelab_raw = CASE WHEN EXCLUDED.audiencelab_raw <> '{}'::jsonb THEN EXCLUDED.audiencelab_raw ELSE visitors.audiencelab_raw END,
      groundtruth_id = COALESCE(EXCLUDED.groundtruth_id, visitors.groundtruth_id),
      groundtruth_campaign = COALESCE(EXCLUDED.groundtruth_campaign, visitors.groundtruth_campaign),
      groundtruth_location = COALESCE(EXCLUDED.groundtruth_location, visitors.groundtruth_location),
      groundtruth_venue_type = COALESCE(EXCLUDED.groundtruth_venue_type, visitors.groundtruth_venue_type),
      groundtruth_raw = CASE WHEN EXCLUDED.groundtruth_raw <> '{}'::jsonb THEN EXCLUDED.groundtruth_raw ELSE visitors.groundtruth_raw END,
      source = COALESCE(visitors.source, EXCLUDED.source),
      utm_source = COALESCE(visitors.utm_source, EXCLUDED.utm_source),
      utm_medium = COALESCE(visitors.utm_medium, EXCLUDED.utm_medium),
      utm_campaign = COALESCE(visitors.utm_campaign, EXCLUDED.utm_campaign),
      utm_content = COALESCE(visitors.utm_content, EXCLUDED.utm_content),
      utm_term = COALESCE(visitors.utm_term, EXCLUDED.utm_term),
      referrer = COALESCE(visitors.referrer, EXCLUDED.referrer),
      landing_page = COALESCE(visitors.landing_page, EXCLUDED.landing_page),
      ip = COALESCE(EXCLUDED.ip, visitors.ip),
      user_agent = COALESCE(EXCLUDED.user_agent, visitors.user_agent),
      device_type = COALESCE(EXCLUDED.device_type, visitors.device_type),
      browser = COALESCE(EXCLUDED.browser, visitors.browser),
      os = COALESCE(EXCLUDED.os, visitors.os),
      city = COALESCE(EXCLUDED.city, visitors.city),
      state = COALESCE(EXCLUDED.state, visitors.state),
      country = COALESCE(EXCLUDED.country, visitors.country),
      latitude = COALESCE(EXCLUDED.latitude, visitors.latitude),
      longitude = COALESCE(EXCLUDED.longitude, visitors.longitude)`;
  } catch (e) { /* analytics must never break the beacon */ }
}

// Advance a visitor's journey + append behavior (from /api/ghl-event). Upserts
// so a checkout-email with no prior pixel row still gets a profile.
export async function updateVisitorJourney(sql, { email, phone, name, event, artwork, museum, orderTotal } = {}) {
  const visitor_key = keyFor({ email, phone });
  if (!visitor_key) return;
  const STAGE_FOR = { page_view: 'visitor', artwork_view: 'browser', order_started: 'interested', cart_started: 'interested', cart_abandoned: 'abandoned', order_completed: 'buyer', subscription: 'subscriber', repeat_purchase: 'buyer' };
  const stage = STAGE_FOR[event] || 'visitor';
  const rank = STAGE_RANK[stage] || 1;
  const artJson = artwork ? JSON.stringify([{ title: String(artwork).slice(0, 200), museum: museum ? String(museum).slice(0, 120) : null, at: null }]) : '[]';
  const musJson = museum ? JSON.stringify([String(museum).slice(0, 120)]) : '[]';
  let total = null;
  if (orderTotal != null && orderTotal !== '') { const n = Number(String(orderTotal).replace(/[^0-9.]/g, '')); total = Number.isFinite(n) ? n : null; }
  const isCart = event === 'order_started' || event === 'cart_started' || event === 'cart_abandoned';
  const isOrder = event === 'order_completed';
  try {
    await ensureVisitorsTable(sql);
    await sql`INSERT INTO visitors (visitor_key, email, phone, name, journey_stage, stage_rank, artworks_viewed, museums_viewed, cart_value, last_cart_artwork)
      VALUES (${visitor_key}, ${capStr(email,254)}, ${capStr(phone,40)}, ${capStr(name,120)}, ${stage}, ${rank}, ${artJson}::jsonb, ${musJson}::jsonb, ${isCart ? (total || 0) : 0}, ${isCart ? capStr(artwork,200) : null})
      ON CONFLICT (visitor_key) DO UPDATE SET
        last_seen = NOW(), last_visit_date = CURRENT_DATE, last_visit_time = CURRENT_TIME,
        email = COALESCE(EXCLUDED.email, visitors.email),
        phone = COALESCE(EXCLUDED.phone, visitors.phone),
        name = COALESCE(EXCLUDED.name, visitors.name),
        stage_rank = GREATEST(visitors.stage_rank, ${rank}),
        journey_stage = CASE WHEN ${rank} >= visitors.stage_rank THEN ${stage} ELSE visitors.journey_stage END,
        artworks_viewed = CASE WHEN ${artwork ? true : false} AND jsonb_array_length(visitors.artworks_viewed) < 100 THEN visitors.artworks_viewed || ${artJson}::jsonb ELSE visitors.artworks_viewed END,
        museums_viewed = CASE WHEN ${museum ? true : false} AND NOT (visitors.museums_viewed ? ${museum || ''}) THEN visitors.museums_viewed || ${musJson}::jsonb ELSE visitors.museums_viewed END,
        cart_value = CASE WHEN ${isOrder} THEN 0 WHEN ${isCart} THEN ${total || 0} ELSE visitors.cart_value END,
        last_cart_artwork = CASE WHEN ${isCart} THEN ${capStr(artwork, 200)} ELSE visitors.last_cart_artwork END,
        total_orders = CASE WHEN ${isOrder} THEN visitors.total_orders + 1 ELSE visitors.total_orders END,
        total_spent = CASE WHEN ${isOrder} THEN visitors.total_spent + ${total || 0} ELSE visitors.total_spent END`;
  } catch (e) { /* swallow */ }
}

// Append an identified journey event. Anonymous (no email/phone) is skipped to
// keep the table bounded.
export async function logEvent(sql, { event, email, phone, name, artwork, museum, orderTotal } = {}) {
  try {
    if (!email && !phone) return;
    await ensureCrmTables(sql);
    let total = null;
    if (orderTotal != null && orderTotal !== '') {
      const n = Number(String(orderTotal).replace(/[^0-9.]/g, ''));
      total = Number.isFinite(n) ? n : null;
    }
    await sql`INSERT INTO crm_events (event, email, phone, name, artwork, museum, order_total)
      VALUES (${event || 'event'}, ${email || null}, ${phone || null}, ${name || null},
              ${artwork || null}, ${museum || null}, ${total})`;
  } catch (e) { /* swallow */ }
}
