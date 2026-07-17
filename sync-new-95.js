// sync-new-95.js — sync the 95 newly-added museum sources, small batches, report sorted by saved
const https = require('https');
const BASE = 'https://pac-final.vercel.app';
const SECRET = 'pac-sync-2025';

const SOURCES = [
  'lacma','sfmoma','guggenheim','whitney','walker','carnegie','cincinnati','noma','denver','seattle',
  'dallas','houston','columbus','indianapolis','wadsworth','clark','frick','morgan','gardner','barnes',
  'chrysler','albright','joslyn','memphis','birmingham','honolulu','phoenix','sandiego','norton','hammer',
  'freer','npgdc','hirshhorn','kimbell','menil','blanton','nelsonatk','dayton','toledo','grandrapids',
  'kemper','desmoines','gemaldegal','altepina','stadel','albertina','belvedere','reinasofia','mauritshuis',
  'stedelijk','vangogh','rodin','pompidou','royalbelg','ngireland','wales','scotland','ashmolean','fitzwilliam',
  'courtauld','wallace','dulwich','gugbilbao','norway','nasjonalg','finland','ateneum','moderna','ngcanada',
  'montreal','vancouver','ontario','mexnac','fridakahlo','colombia','brasil','pinacoteca','malba','miaqatar',
  'louvreabu','israel','egyptian','topkapi','tretyakov','pushkin','russian','warsaw','prague','budapest',
  'palace','shanghai','korea','australia','agnsw','safrica',
];

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 300000 }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch(e) { reject(new Error('bad JSON: ' + d.slice(0,60))); } });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}
async function syncOne(source) {
  try {
    const r = await fetchUrl(`${BASE}/api/sync?secret=${SECRET}&source=${source}`);
    return { source, saved: r.newWorks || 0, total: r.totalInDb || 0, error: null };
  } catch(e) { return { source, saved: 0, total: 0, error: e.message }; }
}
(async () => {
  console.log(`Syncing ${SOURCES.length} new sources (batches of 4)...`);
  const results = [];
  let lastTotal = 0;
  for (let i = 0; i < SOURCES.length; i += 4) {
    const chunk = SOURCES.slice(i, i + 4);
    const res = await Promise.all(chunk.map(syncOne));
    for (const r of res) { if (r.total) lastTotal = r.total; results.push(r); console.log(`  ${r.source.padEnd(14)} ${r.error ? 'ERR '+r.error : '+'+r.saved}`); }
  }
  results.sort((a,b) => b.saved - a.saved);
  console.log('\n=== SORTED BY WORKS SAVED ===');
  for (const r of results) console.log(`${String(r.saved).padStart(6)}  ${r.source}${r.error ? '  (ERR: '+r.error+')' : ''}`);
  const grand = results.reduce((s,r)=>s+r.saved,0);
  console.log(`\nTotal saved across new sources: ${grand}`);
  console.log(`DB total (last observed): ${lastTotal}`);
})();
