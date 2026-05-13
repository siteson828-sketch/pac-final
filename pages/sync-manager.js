import { useEffect, useRef } from 'react';

export async function getServerSideProps({ query }) {
  if (query.secret !== 'pac-sync-2025') return { notFound: true };
  return { props: {} };
}

const SRCS = [
  { k: 'met',         l: 'Metropolitan Museum of Art' },
  { k: 'artic',       l: 'Art Institute of Chicago' },
  { k: 'cleveland',   l: 'Cleveland Museum of Art' },
  { k: 'rijks',       l: 'Rijksmuseum' },
  { k: 'smk',         l: 'SMK National Gallery of Denmark' },
  { k: 'vam',         l: 'Victoria & Albert Museum' },
  { k: 'europeana',   l: 'Europeana' },
  { k: 'smithsonian', l: 'Smithsonian Institution' },
  { k: 'harvard',     l: 'Harvard Art Museums' },
  { k: 'getty',       l: 'Getty Museum' },
  { k: 'walters',     l: 'Walters Art Museum' },
  { k: 'mia',         l: 'Minneapolis Institute of Art' },
  { k: 'yale',        l: 'Yale University Art Gallery' },
  { k: 'loc',         l: 'Library of Congress' },
  { k: 'bnf',         l: 'BnF Gallica' },
  { k: 'nypl',        l: 'NYPL' },
  { k: 'wikimedia',   l: 'Wikimedia Commons' },
  { k: 'dpla',        l: 'DPLA' },
  { k: 'tepapa',      l: 'Museum of New Zealand Te Papa Tongarewa' },
];

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

  // Pre-render rows so the grid shows immediately without script execution
  const rows = SRCS.map(s =>
    `<div class="row">` +
    `<i class="dot" id="d-${s.k}"></i>` +
    `<span class="lbl">${s.l}</span>` +
    `<span class="st" id="st-${s.k}"></span>` +
    `<button class="btn out sm" onclick="syncSrc('${s.k}')">Sync</button>` +
    `</div>`
  ).join('');

  const html = `<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{background:#1A1714}
#w{max-width:960px;margin:0 auto;padding:2.5rem 1.5rem;font-family:'DM Sans',system-ui,sans-serif;color:#F5F0E8}
.hdr{display:flex;align-items:flex-start;justify-content:space-between;padding-bottom:1.25rem;border-bottom:1px solid #2a2522;margin-bottom:2rem}
.hdr h1{font-size:1.3rem;font-weight:600;letter-spacing:.03em;color:#B8942A}
.hdr p{font-size:.78rem;color:#5a5248;margin-top:.3rem}
#cnt{background:#1d1a17;border:1px solid #3a3230;border-radius:20px;padding:.35rem 1rem;font-size:.82rem;color:#B8942A;white-space:nowrap;margin-top:.15rem}
.sec{font-size:.66rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#5a5248;margin-bottom:.65rem}
.acts{display:flex;gap:.6rem;margin-bottom:2rem;flex-wrap:wrap;align-items:center}
.btn{border:none;border-radius:6px;font-size:.845rem;font-weight:500;cursor:pointer;transition:opacity .15s,transform .1s;padding:.55rem 1.25rem}
.btn:hover:not(:disabled){opacity:.82}
.btn:active:not(:disabled){transform:scale(.97)}
.btn:disabled{opacity:.35;cursor:not-allowed}
.gld{background:#B8942A;color:#1A1714}
.out{background:transparent;border:1px solid #3a3230;color:#D0C8BC}
.out:hover:not(:disabled){background:#231f1c;opacity:1}
.stp{background:#5e1a1a;color:#f5c0c0;border:1px solid #7a2020}
.sm{padding:.3rem .75rem;font-size:.775rem}
.grid{display:grid;gap:.45rem;margin-bottom:2rem}
.row{display:flex;align-items:center;gap:.75rem;background:#1d1a17;border:1px solid #252220;border-radius:7px;padding:.65rem .95rem;transition:border-color .2s}
.row:hover{border-color:#3a3230}
.dot{display:inline-block;width:8px;height:8px;border-radius:50%;background:#3a3230;flex-shrink:0;transition:background .3s;font-style:normal}
.dot.s{background:#B8942A;animation:p .85s ease-in-out infinite}
.dot.ok{background:#2e8a54}
.dot.er{background:#a02828}
@keyframes p{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(.75)}}
.lbl{flex:1;font-size:.845rem;color:#c0b8ac}
.st{font-size:.74rem;color:#4a4440;min-width:76px;text-align:right;font-variant-numeric:tabular-nums}
.st.a{color:#B8942A}.st.g{color:#2e8a54}.st.r{color:#a02828}
hr{border:none;border-top:1px solid #1e1b18;margin:1.5rem 0}
#log{background:#0c0a08;border:1px solid #1e1b18;border-radius:8px;padding:.85rem 1rem;height:300px;overflow-y:auto;font-family:Menlo,'Cascadia Code',Consolas,monospace;font-size:.755rem;line-height:1.7}
#log::-webkit-scrollbar{width:5px}
#log::-webkit-scrollbar-thumb{background:#2a2522;border-radius:3px}
.ll.i{color:#6a6258}.ll.o{color:#2e8a54}.ll.e{color:#a02828}.ll.w{color:#B8942A}
</style>
<div id="w">
  <div class="hdr">
    <div><h1>Sync Manager</h1><p>Public Art Collections — database sync dashboard</p></div>
    <span id="cnt">—</span>
  </div>
  <div class="sec">Actions</div>
  <div class="acts">
    <button class="btn gld" id="ball" onclick="syncAll()">Sync All Sources</button>
    <button class="btn stp sm" id="bstop" onclick="stopSync()" disabled>Stop</button>
  </div>
  <div class="sec">Sources</div>
  <div class="grid" id="srcs">${rows}</div>
  <hr>
  <div class="sec">Activity Log</div>
  <div id="log"></div>
</div>
<script>
var SECRET=new URLSearchParams(location.search).get('secret')||'';
var SRCS=${JSON.stringify(SRCS)};
var running=false;
function log(m,t){
  var b=document.getElementById('log');if(!b)return;
  var ts=new Date().toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  var d=document.createElement('div');d.className='ll '+(t||'i');d.textContent=ts+'  '+m;
  b.appendChild(d);b.scrollTop=b.scrollHeight;
}
function dot(k,s){var e=document.getElementById('d-'+k);if(e)e.className='dot'+(s?' '+s:'');}
function stat(k,t,c){var e=document.getElementById('st-'+k);if(!e)return;e.textContent=t||'';e.className='st'+(c?' '+c:'');}
async function syncSrc(k){
  var src=SRCS.find(function(s){return s.k===k;});
  var label=src?src.l:k;
  dot(k,'s');stat(k,'syncing…','a');
  log('Starting '+label+'…','i');
  try{
    var r=await fetch('/api/sync?secret='+encodeURIComponent(SECRET)+'&source='+encodeURIComponent(k));
    var d=await r.json();
    if(!r.ok)throw new Error(d.error||'HTTP '+r.status);
    var n=d.newWorks!=null?d.newWorks:0;
    dot(k,'ok');stat(k,n+' saved','g');
    log(label+' — '+n+' saved','o');
    checkCount();
  }catch(e){dot(k,'er');stat(k,'error','r');log(label+' error: '+e.message,'e');}
}
async function syncAll(){
  if(running)return;
  running=true;
  document.getElementById('ball').disabled=true;
  document.getElementById('bstop').disabled=true;
  SRCS.forEach(function(s){dot(s.k,'s');stat(s.k,'syncing…','a');});
  log('Parallel sync started — all '+SRCS.length+' sources firing simultaneously','w');
  try{
    var r=await fetch('/api/sync-parallel?secret='+encodeURIComponent(SECRET));
    var d=await r.json();
    if(!r.ok)throw new Error(d.error||'HTTP '+r.status);
    var srcs=d.sources||{};
    SRCS.forEach(function(s){
      var src=srcs[s.k];
      if(!src){dot(s.k,'');stat(s.k,'','');}
      else if(src.error){dot(s.k,'er');stat(s.k,'error','r');}
      else{dot(s.k,'ok');stat(s.k,src.saved+' saved','g');}
    });
    (d.log||[]).forEach(function(entry){
      log(entry,entry.toLowerCase().includes('error')?'e':'o');
    });
    log('Parallel sync complete — '+(d.newWorks||0)+' new works, '+(d.totalInDb||0).toLocaleString()+' total in DB','o');
    checkCount();
  }catch(e){
    SRCS.forEach(function(s){dot(s.k,'er');stat(s.k,'error','r');});
    log('Parallel sync error: '+e.message,'e');
  }
  running=false;
  document.getElementById('ball').disabled=false;
}
function stopSync(){
  log('Cannot stop a parallel sync in flight.','i');
}
function render(){SRCS.forEach(s=>dot(s.k,''));}
function checkCount(){
  fetch('/api/status').then(r=>r.json()).then(d=>{
    var e=document.getElementById('cnt');
    if(e&&d.total!=null)e.textContent=d.total.toLocaleString()+' artworks';
  }).catch(()=>{});
}
render();checkCount();
</script>
</body></html>`;

  return (
    <div ref={ref} dangerouslySetInnerHTML={{ __html: html }} />
  );
}
