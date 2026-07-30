// auto-sync.js
// Run with: node auto-sync.js   (set SYNC_SECRET or CRON_SECRET in your env)
//
// Repeatedly pokes /api/sync-fast, which advances a per-source cursor so each
// run ingests NEW works. Runs forever with a short pause between cycles. All the
// heavy lifting, cross-provider parallelism, and per-provider rate limiting live
// server-side in sync-fast — this script just keeps it ticking.

const https = require('https');
const http = require('http');

const BASE = process.env.SYNC_BASE || 'https://pac-final.vercel.app';
// Sent as an Authorization: Bearer header (never in the URL).
const SECRET = process.env.SYNC_SECRET || process.env.CRON_SECRET || '';
const PAUSE_MS = Number(process.env.SYNC_PAUSE_MS || 3000);

function getJson(path) {
  return new Promise((resolve, reject) => {
    const url = `${BASE}${path}`;
    const lib = url.startsWith('https') ? https : http;
    const req = lib.get(url, { timeout: 300000, headers: { Authorization: `Bearer ${SECRET}` } }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch (e) { reject(new Error('bad JSON: ' + data.slice(0, 120))); } });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('timeout')); });
  });
}

async function main() {
  if (!SECRET) {
    console.error('Set SYNC_SECRET (or CRON_SECRET) in your environment first.');
    process.exit(1);
  }
  console.log(`AUTO-SYNC → ${BASE}/api/sync-fast   (Ctrl+C to stop)`);

  let cycle = 0;
  let sessionAdded = 0;
  const start = Date.now();

  while (true) {
    cycle++;
    try {
      const r = await getJson('/api/sync-fast');
      const added = r.added || 0;
      sessionAdded += added;
      const mins = Math.floor((Date.now() - start) / 60000);
      const took = Math.round((r.tookMs || 0) / 1000);
      const total = r.totalInDb != null ? r.totalInDb.toLocaleString() : '?';
      console.log(`cycle ${cycle}: +${added} in ${took}s | session +${sessionAdded} over ${mins}m | db total ${total}`);
    } catch (e) {
      console.log(`cycle ${cycle}: error ${e.message}`);
    }
    await new Promise(res => setTimeout(res, PAUSE_MS));
  }
}

main().catch(console.error);
