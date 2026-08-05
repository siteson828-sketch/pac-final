// auto-sync.js
// Run with: node auto-sync.js   (set SYNC_SECRET or CRON_SECRET in your env)
//
// Repeatedly pokes /api/sync-fast, which advances a per-source cursor so each
// run ingests NEW works. Fully sequential: the next cycle only fires after the
// current request completes (never on a timer), so overlapping server-side runs
// can't pile up. /api/sync-fast is a long (~30-100s+) call, so we give it room:
//   • 120s pause between successful cycles (SYNC_PAUSE_MS)
//   • 180s per-request timeout so a hung connection is cleaned up, not left open
//   • exponential backoff on failure (ECONNRESET etc.) instead of a 3s hammer:
//     30s → 60s → 120s → 180s (4+), reset back to no-backoff after a clean cycle.
//
// Transport is HTTP/2 (node's `http2`), NOT the `https` module. The Vercel edge
// resets HTTP/1.1 connections to this endpoint at a hard ~38s ceiling, so any
// cycle doing more than ~38s of work died with ECONNRESET. curl never hit this
// because it negotiates HTTP/2 via ALPN; HTTP/2 from node clears it cleanly.

const http2 = require('http2');

const BASE = process.env.SYNC_BASE || 'https://pac-final.vercel.app';
// Sent as an Authorization: Bearer header (never in the URL).
const SECRET = process.env.SYNC_SECRET || process.env.CRON_SECRET || '';
const PAUSE_MS = Number(process.env.SYNC_PAUSE_MS || 120_000);   // between successful cycles
const REQ_TIMEOUT_MS = Number(process.env.SYNC_REQ_TIMEOUT_MS || 180_000);

// Backoff schedule (seconds) by consecutive-failure count: 1st→30, 2nd→60,
// 3rd→120, 4th and beyond→180.
const BACKOFF_S = [30, 60, 120, 180];
const backoffSeconds = (failures) => BACKOFF_S[Math.min(failures, BACKOFF_S.length) - 1];

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

// One-shot HTTP/2 GET returning parsed JSON, with a hard overall timeout.
function fetchJson(path, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let hardTimer = null;
    let client = null;
    const finish = (err, val) => {
      if (settled) return;
      settled = true;
      clearTimeout(hardTimer);
      try { if (client) client.close(); } catch (e) { /* ignore */ }
      if (err) reject(err); else resolve(val);
    };
    try { client = http2.connect(BASE); } catch (e) { return finish(e); }
    client.on('error', (e) => finish(e));

    const req = client.request({
      ':path': path,
      ':method': 'GET',
      authorization: `Bearer ${SECRET}`,
      'user-agent': 'pac-auto-sync/1.0',
      accept: 'application/json',
    });
    let status = 0;
    let data = '';
    req.on('response', (h) => { status = h[':status']; });
    req.on('data', (c) => (data += c));
    req.on('end', () => {
      if (status && status !== 200) return finish(new Error(`HTTP ${status}: ${data.slice(0, 120)}`));
      try { finish(null, JSON.parse(data)); } catch (e) { finish(new Error('bad JSON: ' + data.slice(0, 120))); }
    });
    req.on('error', (e) => finish(e));

    // Hard ceiling on the whole request so a hung/half-open stream is torn down.
    hardTimer = setTimeout(() => {
      try { req.close(http2.constants.NGHTTP2_CANCEL); } catch (e) { /* ignore */ }
      finish(new Error('request timeout'));
    }, timeoutMs);
  });
}

async function main() {
  if (!SECRET) {
    console.error('Set SYNC_SECRET (or CRON_SECRET) in your environment first.');
    process.exit(1);
  }
  console.log(`AUTO-SYNC → ${BASE}/api/sync-fast  (HTTP/2, Ctrl+C to stop)`);
  console.log(`pause=${PAUSE_MS / 1000}s  req-timeout=${REQ_TIMEOUT_MS / 1000}s  backoff=${BACKOFF_S.join('/')}s`);

  let cycle = 0;
  let sessionAdded = 0;
  let failures = 0;               // consecutive failures; drives backoff
  const start = Date.now();

  while (true) {
    cycle++;
    try {
      const r = await fetchJson('/api/sync-fast', REQ_TIMEOUT_MS);
      const added = r.added || 0;
      sessionAdded += added;
      failures = 0;               // clean cycle → reset backoff
      const mins = Math.floor((Date.now() - start) / 60000);
      const took = Math.round((r.tookMs || 0) / 1000);
      const total = r.totalInDb != null ? r.totalInDb.toLocaleString() : '?';
      console.log(`cycle ${cycle}: +${added} in ${took}s | session +${sessionAdded} over ${mins}m | db total ${total}`);
      // Only fire the next cycle after this one fully completed.
      await sleep(PAUSE_MS);
    } catch (e) {
      failures++;
      const wait = backoffSeconds(failures);
      const label = /ECONNRESET/i.test(e.message) ? 'ECONNRESET' : (e.message || 'error');
      const shown = Math.min(failures, BACKOFF_S.length);
      console.log(`cycle ${cycle}: ${label} - backing off ${wait}s before retry (attempt ${shown}/${BACKOFF_S.length})`);
      await sleep(wait * 1000);
    }
  }
}

main().catch(console.error);
