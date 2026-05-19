// auto-sync.js
// Run with: node auto-sync.js
// Continuously syncs all museum sources forever

const https = require('https');
const http = require('http');
const fs = require('fs');

const BASE = 'https://pac-final.vercel.app';
const SECRET = 'pac-sync-2025';
const PROGRESS_FILE = 'sync-progress.json';

const SOURCES = [
  'vam','cleveland','artic','met','dpla','loc','smk','smithsonian',
  'wikimedia','rijks','europeana','harvard','getty','walters','mia',
  'yale','bnf','louvre','british','national','tate','orsay','prado',
  'uffizi','hermitage','moma','rijkswiki','khm','vawiki','saam','phila',
  'mfa','detroit','picassobcn','brera','pitti','vatican','lacma','sfmoma',
  'guggenheim','whitney','walker','carnegie','cincinnati','noma','denver',
  'seattle','dallas','houston','columbus','indianapolis','wadsworth','clark',
  'frick','morgan','gardner','barnes','chrysler','albright','joslyn',
  'memphis','birmingham','honolulu','phoenix','sandiego','norton','hammer',
  'freer','npgdc','hirshhorn','kimbell','menil','blanton','nelsonatk',
  'dayton','toledo','grandrapids','kemper','desmoines','gemaldegal',
  'altepina','stadel','albertina','belvedere','reinasofia','mauritshuis',
  'stedelijk','vangogh','rodin','pompidou','royalbelg','ngireland','wales',
  'scotland','ashmolean','fitzwilliam','courtauld','wallace','dulwich',
  'gugbilbao','norway','nasjonalg','finland','ateneum','moderna','ngcanada',
  'montreal','vancouver','ontario','mexnac','fridakahlo','colombia','brasil',
  'pinacoteca','malba','miaqatar','louvreabu','israel','egyptian','topkapi',
  'tretyakov','pushkin','russian','warsaw','prague','budapest','palace',
  'shanghai','korea','india','australia','agnsw','nigeria','safrica',
  'internetarchive','wikidataglobal',
];

// Load or init progress
let progress = { cycle: 0, totalAdded: 0, wikidataOffset: 0, startTime: Date.now() };
if (fs.existsSync(PROGRESS_FILE)) {
  try { progress = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8')); }
  catch(e) {}
}

function saveProgress() {
  fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { timeout: 320000 }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch(e) { reject(new Error('JSON parse error')); }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function syncSource(source) {
  let url = `${BASE}/api/sync?secret=${SECRET}&source=${source}`;
  if (source === 'wikidataglobal') {
    url += `&offset=${progress.wikidataOffset}`;
  }
  try {
    const result = await fetchUrl(url);
    return { source, saved: result.newWorks || 0, total: result.totalInDb || 0, error: null };
  } catch(e) {
    return { source, saved: 0, total: 0, error: e.message };
  }
}

async function getCount() {
  try {
    const d = await fetchUrl(`${BASE}/api/artworks?count=true`);
    return d.total || 0;
  } catch(e) { return 0; }
}

function clearScreen() { process.stdout.write('\x1Bc'); }

function pad(str, len) { return String(str).padEnd(len).slice(0, len); }

function printDashboard(results, cycleTotal, dbTotal) {
  clearScreen();
  const elapsed = Math.floor((Date.now() - progress.startTime) / 1000);
  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const rate = elapsed > 0 ? Math.round((progress.totalAdded / elapsed) * 60) : 0;

  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║         PUBLIC ART COLLECTIONS — AUTO SYNC             ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log(`  Database total : ${dbTotal.toLocaleString()} works`);
  console.log(`  Added session  : ${progress.totalAdded.toLocaleString()} works`);
  console.log(`  Rate           : ${rate.toLocaleString()} works/minute`);
  console.log(`  Cycle          : ${progress.cycle}`);
  console.log(`  Runtime        : ${mins}m ${secs}s`);
  console.log(`  Wikidata offset: ${progress.wikidataOffset}`);
  console.log('');
  console.log('  ── This cycle results ──────────────────────────────────');
  console.log(`  ${'Source'.padEnd(28)} ${'Saved'.padEnd(8)} Status`);
  console.log('  ' + '─'.repeat(50));

  const sorted = [...results].sort((a, b) => b.saved - a.saved);
  for (const r of sorted) {
    const status = r.error ? '✗ ' + r.error.slice(0, 20) : r.saved > 0 ? '✓' : '○ up to date';
    console.log(`  ${pad(r.source, 28)} ${pad(r.saved > 0 ? '+' + r.saved : '0', 8)} ${status}`);
  }

  console.log('');
  console.log(`  Cycle total: +${cycleTotal.toLocaleString()} new works`);
  console.log('');
  console.log('  Press Ctrl+C to stop');
}

async function runCycle() {
  progress.cycle++;
  console.log(`\nStarting cycle ${progress.cycle} — syncing ${SOURCES.length} sources in batches of 10...`);

  const allResults = [];
  for (let i = 0; i < SOURCES.length; i += 10) {
    const chunk = SOURCES.slice(i, i + 10);
    const batch = await Promise.allSettled(chunk.map(s => syncSource(s)));
    allResults.push(...batch);
    if (i + 10 < SOURCES.length) await new Promise(r => setTimeout(r, 3000));
  }

  const settled = allResults.map(r => r.value || { source: '?', saved: 0, total: 0, error: r.reason?.message });
  const cycleTotal = settled.reduce((sum, r) => sum + r.saved, 0);

  progress.totalAdded += cycleTotal;
  progress.wikidataOffset += 3000;

  const dbTotal = await getCount();
  printDashboard(settled, cycleTotal, dbTotal);
  saveProgress();

  return cycleTotal;
}

async function main() {
  console.log('PUBLIC ART COLLECTIONS — AUTO SYNC');
  console.log('===================================');
  console.log(`Syncing ${SOURCES.length} museum sources`);
  console.log('Press Ctrl+C to stop\n');

  while (true) {
    await runCycle();
    console.log('\nWaiting 15 seconds before next cycle...');
    await new Promise(r => setTimeout(r, 15000));
  }
}

main().catch(console.error);
