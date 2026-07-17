// one-pass-sync.js — single full pass over all handled sources (no infinite loop)
const https = require('https');

const BASE = 'https://pac-final.vercel.app';
const SECRET = 'pac-sync-2025';

// Only sources actually handled by pages/api/sync.js
const SOURCES = [
  'met','artic','cleveland','rijks','smk','vam','europeana','smithsonian','harvard',
  'getty','walters','mia','yale','loc','bnf','nypl','wikimedia','dpla','tepapa',
  'louvre','british','national','tate','orsay','prado','uffizi','hermitage','moma',
  'rijkswiki','khm','cluny','vawiki','npm','tokyo','saam','phila','mfa','detroit',
  'ngvic','auckland','picassobcn','brera','vasariano','pitti','doria','spada',
  'capodimonte','romano','vatican','internetarchive',
];

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { timeout: 320000 }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch(e) { reject(new Error('bad JSON: ' + data.slice(0,80))); } });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function syncOne(source) {
  const url = `${BASE}/api/sync?secret=${SECRET}&source=${source}`;
  try {
    const r = await fetchUrl(url);
    return { source, saved: r.newWorks || 0, total: r.totalInDb || 0, error: null };
  } catch(e) {
    return { source, saved: 0, total: 0, error: e.message };
  }
}

(async () => {
  let grand = 0, lastTotal = 0;
  console.log(`One-pass sync of ${SOURCES.length} sources...`);
  // batches of 6 to limit concurrent load
  for (let i = 0; i < SOURCES.length; i += 6) {
    const chunk = SOURCES.slice(i, i + 6);
    const res = await Promise.all(chunk.map(syncOne));
    for (const r of res) {
      grand += r.saved;
      if (r.total) lastTotal = r.total;
      console.log(`${r.source.padEnd(16)} ${r.error ? 'ERR ' + r.error : '+' + r.saved + ' (db=' + r.total + ')'}`);
    }
  }
  console.log(`\nDONE. New this pass: +${grand}. DB total: ${lastTotal}`);
})();
