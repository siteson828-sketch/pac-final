import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';
export const config = { maxDuration: 300 };

// Sync driver. Fires every 10 min (vercel.json) and runs the N stalest eligible
// sources IN PARALLEL (was: one source per run, serially). Each picks up its
// per-source offset, calls /api/sync, advances the offset while it keeps finding
// NET-NEW works, and wraps the offset back to 0 on a dry run (so a paginated
// source re-sweeps for new works instead of paging past the end forever).
//
// Selection is tier-balanced stale-first: each parallel batch takes the stalest
// eligible source from EACH priority tier (then backfills). The old
// `ORDER BY priority ASC` let dead P1 sources sit ahead of the museum APIs
// forever (every P2/P3 starved since 2026-09-05). But pure `last_run ASC` over-
// corrected — the 124 dormant P3 long-tail sources buried the high-value P1
// aggregators (Europeana landed 131st in line, ~7h out). One-per-tier guarantees
// P1 (Europeana), P2 (museums), and P3 (long tail) each get a slot every tick.
//
// Cursor-based syncs (smithsonian, metcomplete/clevelandcomplete/miacomplete)
// self-manage their own cursors and keep dedicated crons — not driven here.

const PARALLEL = 3;

// P1 — big aggregators (always-fresh, huge): pull most often.
const P1 = ['europeana', 'dpla', 'wikidataglobal', 'wikimedia', 'internetarchive', 'loc', 'locmaps', 'bnf', 'digitalcommonwealth', 'tepapa', 'trove', 'digitalnz', 'bhl'];
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

// Sources verified to return 0 works after many runs (sync-status: total_synced=0
// despite recent last_run). Excluded from the rotation so they stop burning
// parallel slots on dead endpoints. Re-enable a key once it's fixed/provisioned:
//   bhl            → needs BHL_KEY in Vercel
//   wikidataglobal → SPARQL 20-type set is exhausted (needs a broader query)
//   wikimedia/trove/digitalnz/tepapa → endpoints currently return nothing
const DISABLED = new Set(['trove', 'wikidataglobal', 'digitalnz', 'bhl', 'tepapa', 'wikimedia']);

const ALL_SOURCES = [
  ...P1.map(key => ({ key, priority: 1, maxDaily: 30000, offsetStep: 3000 })),
  ...P2.map(key => ({ key, priority: 2, maxDaily: 8000, offsetStep: 1000 })),
  ...P3.map(key => ({ key, priority: 3, maxDaily: 2000, offsetStep: 1000 })),
].filter(s => !DISABLED.has(s.key));

// One /api/sync call for a single source. Never throws — a failure resolves to a
// zero-work result so one bad source can't abort the whole parallel batch.
async function runSync(s) {
  try {
    const resp = await fetch(
      `https://www.publicartcollections.net/api/sync?source=${encodeURIComponent(s.source)}&offset=${s.current_offset}`,
      { headers: { Authorization: 'Bearer ' + process.env.SYNC_SECRET }, signal: AbortSignal.timeout(240000) }
    ).then(r => r.json());
    return { source: s.source, offset_step: s.offset_step, current_offset: s.current_offset, newWorks: resp.newWorks || 0, error: resp.error || null };
  } catch (e) {
    return { source: s.source, offset_step: s.offset_step, current_offset: s.current_offset, newWorks: 0, error: e.message };
  }
}

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

  // Eligible sources (under daily cap, not disabled), stalest first.
  const disabledArr = [...DISABLED];
  const eligible = await sql`
    SELECT source, priority, current_offset, offset_step
    FROM sync_state
    WHERE synced_today < max_daily AND NOT (source = ANY(${disabledArr}))
    ORDER BY last_run ASC`;

  if (!eligible.length) {
    return res.status(200).json({ message: 'All sources at daily maximum — resumes at midnight UTC' });
  }

  // Take the stalest from each priority tier first (so the P3 long tail can't
  // bury Europeana/other P1 aggregators), then backfill remaining slots with the
  // next-stalest overall.
  const picks = [];
  const takenTiers = new Set();
  for (const r of eligible) {
    if (picks.length >= PARALLEL) break;
    if (!takenTiers.has(r.priority)) { picks.push(r); takenTiers.add(r.priority); }
  }
  for (const r of eligible) {
    if (picks.length >= PARALLEL) break;
    if (!picks.includes(r)) picks.push(r);
  }

  // Run the batch in parallel, then persist each source's result.
  const results = await Promise.all(picks.map(runSync));
  for (const r of results) {
    // newWorks is now NET-NEW (true inserts) — see upsert() in sync.js. Advance
    // the offset only when the source actually found new works; otherwise wrap to
    // 0 to re-sweep from the start next time.
    const nextOffset = r.newWorks > 0 ? r.current_offset + r.offset_step : 0;
    await sql`
      UPDATE sync_state SET
        current_offset = ${nextOffset},
        total_synced = total_synced + ${r.newWorks},
        synced_today = synced_today + ${r.newWorks},
        last_run = NOW()
      WHERE source = ${r.source}`;
  }

  const [dbTotal, states] = await Promise.all([
    sql`SELECT COUNT(*) AS count FROM artworks WHERE commercial_ok = true`,
    sql`SELECT source, total_synced, synced_today, max_daily, current_offset FROM sync_state ORDER BY priority, last_run DESC LIMIT 20`,
  ]);

  return res.status(200).json({
    success: true,
    ran: results.map(r => ({
      source: r.source,
      new_works: r.newWorks,
      offset_advanced_to: r.newWorks > 0 ? r.current_offset + r.offset_step : 0,
      error: r.error,
    })),
    total_in_db: parseInt(dbTotal[0].count),
    sources_status: states,
  });
}
