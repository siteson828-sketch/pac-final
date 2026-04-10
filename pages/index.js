export default function Home() {
  const html = `<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,sans-serif;background:#FAF8F4;color:#1A1714}
nav{position:fixed;top:0;left:0;right:0;height:64px;display:flex;align-items:center;justify-content:space-between;padding:0 32px;background:rgba(250,248,244,0.95);border-bottom:0.5px solid rgba(26,23,20,0.12);z-index:100}
.logo{font-size:20px;font-weight:400;font-family:Georgia,serif}.logo span{color:#B8942A}
.btn{display:inline-block;padding:9px 20px;border-radius:4px;font-size:13px;font-weight:500;cursor:pointer;text-decoration:none;border:1px solid rgba(26,23,20,0.25);color:#1A1714;background:transparent;font-family:system-ui}
.btn-dark{background:#1A1714;color:#FAF8F4;border-color:#1A1714}
.hero{display:grid;grid-template-columns:1fr 1fr;align-items:center;gap:48px;padding:80px 64px 48px;max-width:1280px;margin:64px auto 0}
.hero h1{font-family:Georgia,serif;font-size:clamp(44px,5vw,72px);font-weight:300;line-height:1.05;margin-bottom:20px}
.hero h1 em{font-style:italic;color:#B8942A}
.hero p{font-size:15px;color:#4A4540;line-height:1.7;margin-bottom:32px;max-width:420px}
.hero-btns{display:flex;gap:14px;flex-wrap:wrap}
.frame{background:#2C2318;padding:16px;border-radius:2px;box-shadow:0 8px 48px rgba(26,23,20,0.2)}
.frame-inner{aspect-ratio:4/5;overflow:hidden;background:#EDE8DF;position:relative}
.frame-inner img{width:100%;height:100%;object-fit:cover}
.frame-cap{position:absolute;bottom:0;left:0;right:0;background:linear-gradient(transparent,rgba(26,23,20,0.75));color:#F0EAD8;padding:20px 14px 10px;font-size:12px}
.frame-cap strong{display:block;font-family:Georgia,serif;font-size:15px;font-weight:400}
.repos{background:#EDE8DF;border-top:0.5px solid rgba(26,23,20,0.12);border-bottom:0.5px solid rgba(26,23,20,0.12);padding:12px 48px;display:flex;align-items:center;gap:20px;overflow-x:auto;font-size:12px;color:#4A4540}
.repos-label{font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#8A8178;white-space:nowrap}
section{max-width:1280px;margin:0 auto;padding:48px 32px}
section h2{font-family:Georgia,serif;font-size:34px;font-weight:300;margin-bottom:24px}
section h2 span{color:#B8942A}
.search-row{display:flex;gap:8px;margin-bottom:28px}
.search-row input{flex:1;padding:10px 16px;border:0.5px solid rgba(26,23,20,0.25);border-radius:4px;font-size:14px;background:#FAF8F4;outline:none;font-family:system-ui}
.search-row input:focus{border-color:#B8942A}
#grid{display:grid;grid-template-columns:repeat(4,1fr);gap:20px;margin-bottom:40px}
.card{cursor:pointer;transition:transform .2s}
.card:hover{transform:translateY(-3px)}
.card-thumb{aspect-ratio:3/4;background:#EDE8DF;overflow:hidden;position:relative;margin-bottom:10px}
.card-thumb img{width:100%;height:100%;object-fit:cover}
.card-source{font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#B8942A;margin-bottom:3px}
.card-title{font-family:Georgia,serif;font-size:17px;font-weight:400;margin-bottom:2px;line-height:1.2}
.card-artist{font-size:11px;color:#8A8178;margin-bottom:5px}
.card-foot{display:flex;align-items:center;justify-content:space-between}
.badge{font-size:10px;padding:2px 6px;border-radius:10px;background:#DCFCE7;color:#166534}
.load-more{text-align:center;padding-bottom:32px}
.empty{grid-column:1/-1;padding:64px 0;text-align:center;color:#8A8178}
.empty p{font-family:Georgia,serif;font-size:24px;font-weight:300;margin-top:12px}
.modal-bg{display:none;position:fixed;inset:0;background:rgba(26,23,20,0.65);z-index:200;align-items:center;justify-content:center;padding:20px}
.modal-bg.open{display:flex}
.modal{background:#FAF8F4;border-radius:10px;max-width:800px;width:100%;max-height:90vh;overflow-y:auto;position:relative}
.modal-layout{display:grid;grid-template-columns:1fr 1fr}
.modal-img{background:#EDE8DF;min-height:380px}
.modal-img img{width:100%;height:100%;object-fit:cover}
.modal-info{padding:32px 24px;display:flex;flex-direction:column;gap:10px}
.modal-close{position:absolute;top:12px;right:16px;background:none;border:none;font-size:28px;cursor:pointer;color:#8A8178;z-index:1}
.modal-source{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:#B8942A}
.modal-title{font-family:Georgia,serif;font-size:28px;font-weight:300;line-height:1.15}
.modal-artist{font-size:13px;color:#4A4540}
.modal-meta{display:grid;grid-template-columns:1fr 1fr;gap:10px;padding:12px 0;border-top:0.5px solid rgba(26,23,20,0.12);border-bottom:0.5px solid rgba(26,23,20,0.12)}
.meta-label{font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#8A8178;margin-bottom:2px}
.meta-value{font-size:13px;font-weight:500}
.modal-bio{font-size:12px;color:#4A4540;line-height:1.7}
.prods-label{font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:#8A8178;margin-bottom:8px}
.prods{display:grid;grid-template-columns:repeat(3,1fr);gap:5px}
.prod{background:#EDE8DF;border-radius:4px;padding:8px 4px;text-align:center;cursor:pointer;font-size:11px;color:#4A4540;border:none;transition:all .15s;font-family:system-ui}
.prod:hover{background:#1A1714;color:#FAF8F4}
.modal-actions{display:flex;flex-direction:column;gap:8px;margin-top:4px}
footer{background:#2C2318;color:#B0A898;padding:40px 32px 24px}
.footer-inner{max-width:1280px;margin:0 auto}
.footer-logo{font-family:Georgia,serif;font-size:20px;color:#F3EFE8;margin-bottom:10px}
.footer-logo span{color:#B8942A}
.footer-bottom{border-top:0.5px solid rgba(240,234,214,0.1);padding-top:16px;margin-top:16px;font-size:12px;color:#6A6058}
@media(max-width:900px){.hero{grid-template-columns:1fr;padding:80px 24px 40px}#grid{grid-template-columns:repeat(2,1fr)}.modal-layout{grid-template-columns:1fr}}
@media(max-width:540px){#grid{grid-template-columns:1fr}}
</style>
<nav>
  <span class="logo">Public Art <span>Collections</span></span>
  <span id="total-count" style="font-size:13px;color:#8A8178"></span>
  <a href="/api/artworks" class="btn">API</a>
</nav>
<div class="hero">
  <div>
    <p id="hero-eyebrow" style="font-size:11px;letter-spacing:0.12em;text-transform:uppercase;color:#8A8178;margin-bottom:16px">Loading...</p>
    <h1>The world's art,<br/><em>in your home</em></h1>
    <p>Browse museum masterpieces. Buy any piece as a fine art print, canvas, mug, or tee — shipped to your door.</p>
    <div class="hero-btns">
      <a href="#gallery" class="btn btn-dark">Browse collection</a>
      <a href="/api/artworks" class="btn">View API</a>
    </div>
  </div>
  <div class="frame">
    <div class="frame-inner" id="hero-frame">
      <div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:80px;color:#B8942A">🖼️</div>
    </div>
  </div>
</div>
<div class="repos">
  <span class="repos-label">Sources</span>
  <span>Met Museum · Art Institute of Chicago · Cleveland Museum · V&A Museum · SMK Denmark · Smithsonian</span>
</div>
<section id="gallery">
  <h2>Browse the collection <span id="count-label"></span></h2>
  <div class="search-row">
    <input id="search-input" type="text" placeholder="Search by title, artist, or keyword…" onkeydown="if(event.key==='Enter')doSearch()"/>
    <button class="btn btn-dark" onclick="doSearch()">Search</button>
    <button class="btn" id="clear-btn" style="display:none" onclick="clearSearch()">Clear</button>
  </div>
  <div id="grid"><div class="empty"><div style="font-size:32px">⏳</div><p>Loading artworks…</p></div></div>
  <div class="load-more" id="load-more" style="display:none">
    <button class="btn" onclick="loadMore()">Load more works</button>
  </div>
</section>
<footer>
  <div class="footer-inner">
    <div class="footer-logo">Public Art <span>Collections</span></div>
    <p style="font-size:13px;line-height:1.7;margin-bottom:16px">Museum-quality art for every home. All works public domain.</p>
    <div class="footer-bottom">© 2025 publicartcollections.org · All artwork public domain · Prints fulfilled by Printful</div>
  </div>
</footer>
<div class="modal-bg" id="modal" onclick="if(event.target===this)closeModal()">
  <div class="modal">
    <button class="modal-close" onclick="closeModal()">×</button>
    <div class="modal-layout">
      <div class="modal-img" id="modal-img"></div>
      <div class="modal-info">
        <div class="modal-source" id="modal-source"></div>
        <div class="modal-title" id="modal-title"></div>
        <div class="modal-artist" id="modal-artist"></div>
        <div class="modal-meta" id="modal-meta"></div>
        <div class="modal-bio" id="modal-bio"></div>
        <div>
          <div class="prods-label">Order as</div>
          <div class="prods">
            <button class="prod">🖼️<br/>Fine art print<br/><span style="opacity:.7;font-size:10px">from $18</span></button>
            <button class="prod">🎨<br/>Canvas wrap<br/><span style="opacity:.7;font-size:10px">from $45</span></button>
            <button class="prod">👕<br/>T-shirt<br/><span style="opacity:.7;font-size:10px">from $24</span></button>
            <button class="prod">☕<br/>Mug<br/><span style="opacity:.7;font-size:10px">from $14</span></button>
            <button class="prod">📱<br/>Phone case<br/><span style="opacity:.7;font-size:10px">from $19</span></button>
            <button class="prod">🛍️<br/>Tote bag<br/><span style="opacity:.7;font-size:10px">from $16</span></button>
          </div>
        </div>
        <div class="modal-actions">
          <button class="btn btn-dark">Order a print →</button>
          <a id="modal-link" href="#" target="_blank" rel="noopener" class="btn" style="text-align:center;display:none">View on museum website ↗</a>
        </div>
      </div>
    </div>
  </div>
</div>
<script>
var works=[],offset=0,search='',heroIdx=0,heroTimer=null;
function ss(s){return(s||'').replace('Victoria & Albert Museum','V&A').replace('Metropolitan Museum of Art','Met Museum').replace('Art Institute of Chicago','Art Inst. Chicago').replace('SMK National Gallery of Denmark','SMK Denmark').replace('Smithsonian Institution','Smithsonian').replace(/^Europeana — /,'').split(',')[0];}
function esc(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function load(reset){
  if(reset){offset=0;works=[];}
  var url='/api/artworks?limit=24&offset='+offset+(search?'&search='+encodeURIComponent(search):'');
  fetch(url).then(function(r){return r.json();}).then(function(d){
    var w=d.works||[];
    works=reset?w:works.concat(w);
    offset+=w.length;
    render(reset?w:works);
    document.getElementById('load-more').style.display=w.length===24?'block':'none';
    if(reset&&w.length>0)startHero(w);
  }).catch(function(){document.getElementById('grid').innerHTML='<div class="empty"><p>Could not load artworks</p></div>';});
}
function render(w){
  var g=document.getElementById('grid');
  if(!w.length){g.innerHTML='<div class="empty"><div style="font-size:40px">🔍</div><p>No works found</p></div>';return;}
  g.innerHTML=w.map(function(x,i){return'<div class="card" onclick="openModal('+i+'"><div class="card-thumb">'+(x.thumb_url?'<img src="'+esc(x.thumb_url)+'" loading="lazy" onerror="this.parentNode.innerHTML=\'<div style=\\\"display:flex;align-items:center;justify-content:center;height:100%;font-size:40px;color:#B8942A\\\">&#128–/div>\'">':'<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:40px;color:#B8942A">🖼️</div>')+'</div><div class="card-source">'+esc(ss(x.source))+'</div><div class="card-title">'+esc(x.title)+'</div><div class="card-artist">'+esc(x.artist||'Artist unknown')+(x.date_text?' · '+esc(x.date_text):'')+'</div><div class="card-foot"><span style="font-size:12px;font-weight:500">Prints from $18</span><span class="badge">'+esc(x.rights_label||'CC0')+'</span></div></div>';}).join('');
}
function startHero(w){
  updateHero(w);
  if(heroTimer)clearInterval(heroTimer);
  heroTimer=setInterval(function(){heroIdx=(heroIdx+1)%Math.min(works.length,8);updateHero(works);},5000);
}
function updateHero(w){
  var x=w[heroIdx%w.length];
  document.getElementById('hero-frame').innerHTML=x.thumb_url?'<img src="'+esc(x.thumb_url)+'" onerror="this.style.display=\'none\'"><div class="frame-cap"><strong>'+esc(x.title)+'</strong>'+esc(x.artist||'')+'</div>':'<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:80px;color:#B8942A">🖼️</div>';
}
function openModal(i){
  var x=works[i];if(!x)return;
  document.getElementById('modal-img').innerHTML=x.thumb_url?'<img src="'+esc(x.full_url||x.thumb_url)+'" style="width:100%;height:100%;object-fit:cover" onerror="this.src=\''+esc(x.thumb_url)+'\'">':'<div style="display:flex;align-items:center;justify-content:center;height:100%;font-size:80px">🖼️</div>';
  document.getElementById('modal-source').textContent=ss(x.source);
  document.getElementById('modal-title').textContent=x.title;
  document.getElementById('modal-artist').textContent=[x.artist,x.date_text].filter(Boolean).join(' · ');
  document.getElementById('modal-meta').innerHTML='<div><div class="meta-label">Medium</div><div class="meta-value">'+esc(x.medium||'—')+'</div></div><div><div class="meta-label">Rights</div><div class="meta-value" style="color:#16a34a">'+esc(x.rights_label||'CC0')+'</div></div><div><div class="meta-label">Source</div><div class="meta-value">'+esc(ss(x.source))+'</div></div><div><div class="meta-label">Date</div><div class="meta-value">'+esc(x.date_text||'—')+'</div></div>';
  document.getElementById('modal-bio').textContent=x.bio?x.bio.slice(0,280):'';
  var lnk=document.getElementById('modal-link');
  lnk.style.display=x.detail_url?'block':'none';
  if(x.detail_url)lnk.href=x.detail_url;
  document.getElementById('modal').classList.add('open');
  document.body.style.overflow='hidden';
}
function closeModal(){document.getElementById('modal').classList.remove('open');document.body.style.overflow='';}
function doSearch(){search=document.getElementById('search-input').value.trim();document.getElementById('clear-btn').style.display=search?'inline-block':'none';load(true);}
function clearSearch(){search='';document.getElementById('search-input').value='';document.getElementById('clear-btn').style.display='none';load(true);}
function loadMore(){load(false);}
document.addEventListener('keydown',function(e){if(e.key==='Escape')closeModal();});
fetch('/api/artworks?count=true').then(function(r){return r.json();}).then(function(d){
  if(d.total){
    document.getElementById('total-count').textContent=Number(d.total).toLocaleString()+' works';
    document.getElementById('hero-eyebrow').textContent=Number(d.total).toLocaleString()+'+ works · 7 museum sources';
    document.getElementById('count-label').textContent='— '+Number(d.total).toLocaleString()+'+ works';
    document.getElementById('count-label').style.color='#B8942A';
  }
});
load(true);
</script>`;

  return (
    <div dangerouslySetInnerHTML={{ __html: html }} />
  );
}
