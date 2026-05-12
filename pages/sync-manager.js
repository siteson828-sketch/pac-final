import { useEffect, useRef } from 'react';

export async function getServerSideProps({ query }) {
  if (query.secret !== 'pac-sync-2025') return { notFound: true };
  return { props: {} };
}

export default function SyncManager() {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.querySelectorAll('script').forEach(old => {
      const s = document.createElement('script');
      s.textContent = old.textContent;
      document.body.appendChild(s);
      document.body.removeChild(s);
    });
  }, []);

  const html = `
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: #1A1714; }
    #wrap {
      max-width: 960px; margin: 0 auto; padding: 2.5rem 1.5rem;
      font-family: 'DM Sans', system-ui, sans-serif; color: #F5F0E8;
    }
    .hdr {
      display: flex; align-items: flex-start; justify-content: space-between;
      padding-bottom: 1.25rem; border-bottom: 1px solid #2a2522; margin-bottom: 2rem;
    }
    .hdr-title { font-size: 1.3rem; font-weight: 600; letter-spacing: 0.03em; color: #B8942A; }
    .hdr-sub { font-size: 0.78rem; color: #5a5248; margin-top: 0.3rem; }
    .count-pill {
      background: #1d1a17; border: 1px solid #3a3230; border-radius: 20px;
      padding: 0.35rem 1rem; font-size: 0.82rem; color: #B8942A;
      font-variant-numeric: tabular-nums; white-space: nowrap; margin-top: 0.15rem;
    }
    .section-label {
      font-size: 0.66rem; font-weight: 700; letter-spacing: 0.12em;
      text-transform: uppercase; color: #5a5248; margin-bottom: 0.65rem;
    }
    .quick-actions { display: flex; gap: 0.6rem; margin-bottom: 2rem; flex-wrap: wrap; align-items: center; }
    .btn {
      border: none; border-radius: 6px; font-size: 0.845rem; font-weight: 500;
      cursor: pointer; transition: opacity .15s, transform .1s; padding: 0.55rem 1.25rem;
    }
    .btn:hover:not(:disabled) { opacity: 0.82; }
    .btn:active:not(:disabled) { transform: scale(0.97); }
    .btn:disabled { opacity: 0.35; cursor: not-allowed; }
    .btn-gold { background: #B8942A; color: #1A1714; }
    .btn-outline { background: transparent; border: 1px solid #3a3230; color: #D0C8BC; }
    .btn-outline:hover:not(:disabled) { background: #231f1c; opacity: 1; }
    .btn-stop { background: #5e1a1a; color: #f5c0c0; border: 1px solid #7a2020; }
    .btn-sm { padding: 0.3rem 0.75rem; font-size: 0.775rem; }
    .sources-grid { display: grid; gap: 0.45rem; margin-bottom: 2rem; }
    .src-row {
      display: flex; align-items: center; gap: 0.75rem;
      background: #1d1a17; border: 1px solid #252220;
      border-radius: 7px; padding: 0.65rem 0.95rem;
      transition: border-color .2s;
    }
    .src-row:hover { border-color: #3a3230; }
    .dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: #3a3230; flex-shrink: 0; transition: background .3s;
    }
    .dot.syncing { background: #B8942A; animation: pulse .85s ease-in-out infinite; }
    .dot.done    { background: #2e8a54; }
    .dot.error   { background: #a02828; }
    @keyframes pulse {
      0%,100% { opacity: 1; transform: scale(1); }
      50%      { opacity: .4; transform: scale(.75); }
    }
    .src-name { flex: 1; font-size: 0.845rem; color: #c0b8ac; }
    .src-stat {
      font-size: 0.74rem; color: #4a4440; min-width: 76px;
      text-align: right; font-variant-numeric: tabular-nums;
    }
    .src-stat.active { color: #B8942A; }
    .src-stat.saved  { color: #2e8a54; }
    .src-stat.fail   { color: #a02828; }
    .divider { border: none; border-top: 1px solid #1e1b18; margin: 1.5rem 0; }
    .log-box {
      background: #0c0a08; border: 1px solid #1e1b18; border-radius: 8px;
      padding: 0.85rem 1rem; height: 300px; overflow-y: auto;
      font-family: Menlo, 'Cascadia Code', Consolas, monospace;
      font-size: 0.755rem; line-height: 1.7;
    }
    .log-box::-webkit-scrollbar { width: 5px; }
    .log-box::-webkit-scrollbar-track { background: transparent; }
    .log-box::-webkit-scrollbar-thumb { background: #2a2522; border-radius: 3px; }
    .ll.info { color: #6a6258; }
    .ll.ok   { color: #2e8a54; }
    .ll.err  { color: #a02828; }
    .ll.warn { color: #B8942A; }
  </style>

  <div id="wrap">
    <div class="hdr">
      <div>
        <div class="hdr-title">Sync Manager</div>
        <div class="hdr-sub">Public Art Collections — database sync dashboard</div>
      </div>
      <div class="count-pill" id="db-count">loading…</div>
    </div>

    <div class="section-label">Actions</div>
    <div class="quick-actions">
      <button class="btn btn-gold" id="btn-all" onclick="syncAll()">Sync All Sources</button>
      <button class="btn btn-stop btn-sm" id="btn-stop" onclick="stopSync()" disabled>Stop</button>
    </div>

    <div class="section-label">Sources</div>
    <div class="sources-grid" id="sources-list"></div>

    <hr class="divider">
    <div class="section-label">Activity Log</div>
    <div class="log-box" id="log-box"></div>
  </div>

  <script>
    var SECRET = new URLSearchParams(location.search).get('secret') || '';
    var stopRequested = false;
    var running = false;

    var SOURCES = [
      { key: 'met',         label: 'Metropolitan Museum of Art' },
      { key: 'artic',       label: 'Art Institute of Chicago' },
      { key: 'cleveland',   label: 'Cleveland Museum of Art' },
      { key: 'rijks',       label: 'Rijksmuseum' },
      { key: 'smk',         label: 'SMK National Gallery of Denmark' },
      { key: 'vam',         label: 'Victoria & Albert Museum' },
      { key: 'europeana',   label: 'Europeana' },
      { key: 'smithsonian', label: 'Smithsonian Institution' },
      { key: 'harvard',     label: 'Harvard Art Museums' },
      { key: 'getty',       label: 'Getty Museum' },
      { key: 'walters',     label: 'Walters Art Museum' },
      { key: 'brooklyn',    label: 'Brooklyn Museum' },
      { key: 'yale',        label: 'Yale University Art Gallery' },
      { key: 'loc',         label: 'Library of Congress' },
      { key: 'bnf',         label: 'BnF Gallica' },
      { key: 'nypl',        label: 'NYPL' },
      { key: 'wikimedia',   label: 'Wikimedia Commons' },
      { key: 'dpla',        label: 'DPLA' },
    ];

    function log(msg, type) {
      var box = document.getElementById('log-box');
      if (!box) return;
      var ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      var line = document.createElement('div');
      line.className = 'll ' + (type || 'info');
      line.textContent = ts + '  ' + msg;
      box.appendChild(line);
      box.scrollTop = box.scrollHeight;
    }

    function setDot(key, status) {
      var el = document.getElementById('dot-' + key);
      if (el) el.className = 'dot' + (status ? ' ' + status : '');
    }

    function setStat(key, text, cls) {
      var el = document.getElementById('stat-' + key);
      if (!el) return;
      el.textContent = text || '';
      el.className = 'src-stat' + (cls ? ' ' + cls : '');
    }

    async function syncSource(key) {
      var src = SOURCES.find(function(s) { return s.key === key; });
      var label = src ? src.label : key;
      setDot(key, 'syncing');
      setStat(key, 'syncing…', 'active');
      log('Starting ' + label + '…', 'info');
      try {
        var r = await fetch(
          '/api/sync?secret=' + encodeURIComponent(SECRET) + '&source=' + encodeURIComponent(key)
        );
        var d = await r.json();
        if (!r.ok) throw new Error(d.error || ('HTTP ' + r.status));
        var n = d.newWorks != null ? d.newWorks : 0;
        setDot(key, 'done');
        setStat(key, n + ' saved', 'saved');
        log(label + ' — ' + n + ' saved', 'ok');
        checkCount();
      } catch(e) {
        setDot(key, 'error');
        setStat(key, 'error', 'fail');
        log(label + ' error: ' + e.message, 'err');
      }
    }

    async function syncAll() {
      if (running) return;
      running = true;
      stopRequested = false;
      document.getElementById('btn-all').disabled = true;
      document.getElementById('btn-stop').disabled = false;
      log('Full sync started — ' + SOURCES.length + ' sources', 'warn');
      for (var i = 0; i < SOURCES.length; i++) {
        if (stopRequested) { log('Stopped by user.', 'warn'); break; }
        await syncSource(SOURCES[i].key);
        if (!stopRequested && i < SOURCES.length - 1) {
          await new Promise(function(res) { setTimeout(res, 600); });
        }
      }
      if (!stopRequested) log('Full sync complete.', 'ok');
      running = false;
      document.getElementById('btn-all').disabled = false;
      document.getElementById('btn-stop').disabled = true;
    }

    function stopSync() {
      stopRequested = true;
      log('Stopping...', 'info');
      SOURCES.forEach(function(s) { setDot(s.key, ''); });
    }

    function renderSources() {
      var list = document.getElementById('sources-list');
      if (!list) return;
      list.innerHTML = SOURCES.map(function(s) {
        return '<div class="src-row">' +
          '<div class="dot" id="dot-' + s.key + '"></div>' +
          '<span class="src-name">' + s.label + '</span>' +
          '<span class="src-stat" id="stat-' + s.key + '"></span>' +
          '<button class="btn btn-outline btn-sm" onclick="syncSource(\'' + s.key + '\')">Sync</button>' +
        '</div>';
      }).join('');
    }

    function checkCount() {
      fetch('/api/status')
        .then(function(r) { return r.json(); })
        .then(function(d) {
          var el = document.getElementById('db-count');
          if (el && d.total != null) el.textContent = d.total.toLocaleString() + ' artworks';
        })
        .catch(function() {});
    }

    renderSources();
    checkCount();
  </script>
  `;

  return <div ref={ref} dangerouslySetInnerHTML={{ __html: html }} />;
}
