import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';
export const config = { maxDuration: 300 };

// Single sync driver. Fires every 10 min (vercel.json), picks ONE source per
// run by priority then least-recently-run, calls /api/sync for it, advances a
// per-source offset, and wraps the offset back to 0 when a run yields nothing
// (so exhausted/paginated sources re-sweep for new works instead of paging into
// the void). Replaces the old per-source + sync-museums/sync-heavy crons.
//
// Only REAL /api/sync source keys are listed (verified against sync.js). The
// cursor-based syncs (smithsonian, metcomplete/clevelandcomplete/miacomplete)
// self-manage their own cursors and keep their own dedicated crons — they are
// intentionally NOT driven here.

// P1 — big aggregators (always-fresh, huge): pull most often.
const P1 = ['europeana', 'dpla', 'wikidataglobal', 'wikimedia', 'internetarchive', 'loc', 'bnf', 'digitalcommonwealth', 'tepapa', 'trove', 'digitalnz', 'bhl'];
// P2 — major museums with direct APIs.
const P2 = ['met', 'artic', 'cleveland', 'rijks', 'vam', 'smk', 'walters', 'mia', 'yale', 'harvard', 'getty', 'nypl', 'europeanafashion'];
// P3 — everything else (Wikidata museums + regional collections). Long tail.
const P3 = [
  'agnsw', 'albertina', 'albright', 'altepina', 'ashmolean', 'ateneum', 'auckland', 'australia', 'barnes', 'belvedere',
  'birmingham', 'blanton', 'brasil', 'brera', 'british', 'budapest', 'capodimonte', 'carnegie', 'chrysler', 'cincinnati',
  'clark', 'cluny', 'colombia', 'columbus', 'courtauld', 'dallas', 'dayton', 'denver', 'desmoines', 'detroit', 'doria',
  'dulwich', 'egyptian', 'finland', 'fitzwilliam', 'freer', 'frick', 'fridakahlo', 'gardner', 'gemaldegal', 'grandrapids',
  'gugbilbao', 'guggenheim', 'hammer', 'hermitage', 'hirshhorn', 'honolulu', 'houston', 'indianapolis', 'israel', 'joslyn',
  'kemper', 'khm', 'kimbell', 'korea', 'lacma', 'louvre', 'louvreabu', 'malba', 'mauritshuis', 'memphis', 'menil', 'mexnac',
  'mfa', 'moderna', 'moma', 'montreal', 'morgan', 'nasjonalg', 'national', 'nelsonatk', 'ngcanada', 'ngireland', 'ngvic',
  'noma', 'norton', 'norway', 'npgdc', 'npm', 'ontario', 'orsay', 'palace', 'phila', 'phoenix', 'picassobcn', 'pinacoteca',
  'pitti', 'pompidou', 'prado', 'prague', 'pushkin', 'reinasofia', 'rijkswiki', 'rodin', 'romano', 'royalbelg', 'russian',
  'saam', 'safrica', 'sandiego', 'scotland', 'seattle', 'sfmoma', 'shanghai', 'spada', 'stadel', 'stedelijk', 'tate',
  'tokyo', 'toledo', 'topkapi', 'tretyakov', 'uffizi', 'vancouver', 'vangogh', 'vasariano', 'vatican', 'vawiki', 'wadsworth',
  'wales', 'walker', 'wallace', 'warsaw', 'whitney',
];

const ALL_SOURCES = [
  ...P1.map(key => ({ key, priority: 1, maxDaily: 30000, offsetStep: 3000 })),
  ...P2.map(key => ({ key, priority: 2, maxDaily: 8000, offsetStep: 1000 })),
  ...P3.map(key => ({ key, priority: 3, maxDaily: 2000, offsetStep: 1000 })),
];

export default async function handler(req, res) {
  const auth = req.headers.authorization || '';
  const secret = req.query.secret;
  const S = process.env.SYNC_SECRET, C = process.env.CRON_SECRET;
  const authorized =
    (S && (auth === 'Bearer ' + S || secret === S)) ||
    (C && auth === 'Bearer ' + C);
  if (!authorized) return res.status(401).json({ error: 'Unauthorized' });

  const sql = neon(process.env.DATABASE_URL);

  await sql`
    CREATE TABLE IF NOT EXISTS sync_state (
      source TEXT PRIMARY KEY,
      current_offset INTEGER DEFAULT 0,
      total_synced INTEGER DEFAULT 0,
      synced_today INTEGER DEFAULT 0,
      last_run TIMESTAMP DEFAULT NOW(),
      last_reset DATE DEFAULT CURRENT_DATE,
      priority INTEGER DEFAULT 3,
      max_daily INTEGER DEFAULT 2000,
      offset_step INTEGER DEFAULT 1000
    )`;

  for (const s of ALL_SOURCES) {
    await sql`
      INSERT INTO sync_state (source, priority, max_daily, offset_step, last_run)
      VALUES (${s.key}, ${s.priority}, ${s.maxDaily}, ${s.offsetStep}, NOW() - INTERVAL '1 hour')
      ON CONFLICT (source) DO UPDATE SET
        priority = ${s.priority}, max_daily = ${s.maxDaily}, offset_step = ${s.offsetStep}`;
  }

  // New UTC day → reset daily counters.
  await sql`UPDATE sync_state SET synced_today = 0, last_reset = CURRENT_DATE WHERE last_reset < CURRENT_DATE`;

  // Next source: highest priority, under its daily cap, least recently run.
  const next = await sql`
    SELECT source, current_offset, offset_step, max_daily, synced_today
    FROM sync_state WHERE synced_today < max_daily
    ORDER BY priority ASC, last_run ASC LIMIT 1`;

  if (!next.length) {
    return res.status(200).json({ message: 'All sources at daily maximum — resumes at midnight UTC' });
  }
  const s = next[0];

  let newWorks = 0, error = null;
  try {
    const resp = await fetch(
      `https://www.publicartcollections.net/api/sync?source=${encodeURIComponent(s.source)}&offset=${s.current_offset}`,
      { headers: { Authorization: 'Bearer ' + process.env.SYNC_SECRET }, signal: AbortSignal.timeout(250000) }
    ).then(r => r.json());
    newWorks = resp.newWorks || 0;
  } catch (e) { error = e.message; }

  // Advance offset while productive; wrap to 0 on a dry/errored run so the
  // source re-sweeps instead of paging past the end forever.
  const nextOffset = newWorks > 0 ? s.current_offset + s.offset_step : 0;
  await sql`
    UPDATE sync_state SET
      current_offset = ${nextOffset},
      total_synced = total_synced + ${newWorks},
      synced_today = synced_today + ${newWorks},
      last_run = NOW()
    WHERE source = ${s.source}`;

  const [dbTotal, states] = await Promise.all([
    sql`SELECT COUNT(*) AS count FROM artworks WHERE commercial_ok = true`,
    sql`SELECT source, total_synced, synced_today, max_daily, current_offset FROM sync_state ORDER BY priority, last_run DESC LIMIT 20`,
  ]);

  return res.status(200).json({
    success: true,
    synced_source: s.source,
    new_works: newWorks,
    offset_advanced_to: nextOffset,
    error,
    total_in_db: parseInt(dbTotal[0].count),
    sources_status: states,
  });
}
