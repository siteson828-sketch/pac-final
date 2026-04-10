import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json', 'User-Agent': 'PublicArtCollections/1.0' } });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return res.json();
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function upsert(sql, works) {
  let saved = 0;
  for (const w of works) {
    try {
      await sql`INSERT INTO artworks (source,source_id,title,artist,date_text,medium,department,thumb_url,full_url,iiif_info,iiif_manifest,detail_url,rights,rights_label,commercial_ok,bio,synced_at) VALUES (${w.source},${w.source_id},${w.title},${w.artist||''},${w.date_text||''},${w.medium||''},${w.department||''},${w.thumb_url||''},${w.full_url||''},${w.iiif_info||''},${w.iiif_manifest||''},${w.detail_url||''},${'CC0'},${'CC0 — Public Domain'},${true},${w.bio||''},NOW()) ON CONFLICT (source,source_id) DO UPDATE SET thumb_url=EXCLUDED.thumb_url,synced_at=NOW()`;
      saved++;
    } catch(e) {}
  }
  return saved;
}

async function syncMet(sql) {
  const works = [];
  try {
    const s = await fetchJson('https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&isPublicDomain=true&q=painting');
    const ids = (s.objectIDs||[]).slice(0,500);
    for (let i=0; i<ids.length; i+=20) {
      const batch = ids.slice(i,i+20);
      const details = await Promise.all(batch.map(id => fetchJson('https://collectionapi.metmuseum.org/public/collection/v1/objects/'+id).catch(()=>null)));
      for (const o of details) {
        if (!o?.primaryImageSmall||!o.isPublicDomain) continue;
        works.push({source:'Metropolitan Museum of Art',source_id:String(o.objectID),title:o.title||'Untitled',artist:o.artistDisplayName||'',date_text:o.objectDate||'',medium:o.medium||'',department:o.department||'',thumb_url:o.primaryImageSmall,full_url:o.primaryImage,iiif_manifest:'https://collectionapi.metmuseum.org/public/collection/v1/iiif/'+o.objectID+'/manifest.json',detail_url:o.objectURL||'',bio:o.creditLine||''});
      }
      await sleep(50);
    }
  } catch(e) {}
  return upsert(sql,works);
}

async function syncArtic(sql) {
  const works = [];
  for (let page=1; page<=20; page++) {
    try {
      const d = await fetchJson('https://api.artic.edu/api/v1/artworks?page='+page+'&limit=100&fields=id,title,artist_display,date_display,image_id,medium_display,department_title&query[term][is_public_domain]=true&query[exists][field]=image_id');
      if (!d.data?.length) break;
      for (const o of d.data) {
        if (!o.image_id) continue;
        works.push({source:'Art Institute of Chicago',source_id:String(o.id),title:o.title||'Untitled',artist:o.artist_display||'',date_text:o.date_display||'',medium:o.medium_display||'',department:o.department_title||'',thumb_url:'https://www.artic.edu/iiif/2/'+o.image_id+'/full/!400,400/0/default.jpg',full_url:'https://www.artic.edu/iiif/2/'+o.image_id+'/full/full/0/default.jpg',iiif_info:'https://www.artic.edu/iiif/2/'+o.image_id+'/info.json',detail_url:'https://www.artic.edu/artworks/'+o.id,bio:''});
      }
      await sleep(100);
    } catch(e) { break; }
  }
  return upsert(sql,works);
}

async function syncCleveland(sql) {
  const works = [];
  for (let skip=0; skip<5000; skip+=100) {
    try {
      const d = await fetchJson('https://openaccess-api.clevelandart.org/api/artworks/?has_image=1&cc0=1&limit=100&skip='+skip);
      if (!d.data?.length) break;
      for (const o of d.data) {
        if (!o.images?.web) continue;
        works.push({source:'Cleveland Museum of Art',source_id:String(o.id),title:o.title||'Untitled',artist:o.creators?.[0]?.description||'',date_text:o.creation_date||'',medium:o.technique||'',thumb_url:o.images.web.url,full_url:o.images.full?.url||o.images.web.url,detail_url:o.url||'',bio:o.did_you_know||''});
      }
      await sleep(100);
    } catch(e) { break; }
  }
  return upsert(sql,works);
}

async function syncNGA(sql) {
  const works = [];
  try {
    const d = await fetchJson('https://api.smk.dk/api/v1/art/search/?keys=*&has_image=true&public_domain=true&offset=0&rows=2000&lang=en');
    for (const o of (d.items||[])) {
      if (!o.image_thumbnail) continue;
      works.push({source:'SMK National Gallery of Denmark',source_id:String(o.object_number||o.id),title:o.titles?.[0]?.title||'Untitled',artist:o.artist?.[0]?.name||'',date_text:o.production_date?.[0]?.period||'',medium:o.techniques?.[0]?.technique||'',thumb_url:o.image_thumbnail,full_url:o.image_native||o.image_thumbnail,detail_url:'https://open.smk.dk/en/artwork/image/'+(o.object_number||''),bio:o.content_description||''});
    }
  } catch(e) {}
  return upsert(sql,works);
}

async function syncVAM(sql) {
  const works = [];
  for (let page=1; page<=20; page++) {
    try {
      const d = await fetchJson('https://api.vam.ac.uk/v2/objects/search?images_exist=1&page_size=100&page='+page+'&q=art');
      if (!d.records?.length) break;
      for (const o of d.records) {
        if (!o._primaryImageId) continue;
        const b = 'https://framemark.vam.ac.uk/collections/'+o._primaryImageId;
        works.push({source:'Victoria & Albert Museum',source_id:o.systemNumber,title:o._primaryTitle||'Untitled',artist:o._primaryMaker?.name||'',date_text:o._primaryDate||'',medium:o.materialsAndTechniques||'',thumb_url:b+'/full/!400,400/0/default.jpg',full_url:b+'/full/full/0/default.jpg',iiif_info:b+'/info.json',detail_url:'https://collections.vam.ac.uk/item/'+o.systemNumber+'/',bio:o.briefDescription||''});
      }
      await sleep(200);
    } catch(e) { break; }
  }
  return upsert(sql,works);
}

async function syncSmithsonian(sql, key) {
  if (!key) return 0;
  const works = [];
  for (let start=0; start<1000; start+=100) {
    try {
      const d = await fetchJson('https://api.si.edu/openaccess/api/v1.0/search?q=art&rows=100&start='+start+'&api_key='+key);
      if (!d.response?.rows?.length) break;
      for (const o of d.response.rows) {
        const media = o.content?.descriptiveNonRepeating?.online_media?.media?.[0];
        if (!media?.thumbnail||media.usage?.access!=='CC0') continue;
        works.push({source:'Smithsonian Institution',source_id:o.id,title:o.title||'Untitled',artist:o.content?.freetext?.name?.[0]?.content||'',date_text:o.content?.freetext?.date?.[0]?.content||'',medium:'',thumb_url:media.thumbnail,full_url:media.content||'',detail_url:o.content?.descriptiveNonRepeating?.record_link||'',bio:''});
      }
      await sleep(300);
    } catch(e) { break; }
  }
  return upsert(sql,works);
}

async function syncHarvard(sql, key) {
  if (!key) return 0;
  const works = [];
  for (let page=1; page<=20; page++) {
    try {
      const d = await fetchJson('https://api.harvardartmuseums.org/object?hasimage=1&size=100&page='+page+'&apikey='+key+'&classification=Paintings,Drawings,Photographs,Prints');
      if (!d.records?.length) break;
      for (const o of d.records) {
        if (!o.primaryimageurl) continue;
        works.push({source:'Harvard Art Museums',source_id:String(o.objectid),title:o.title||'Untitled',artist:o.people?.[0]?.displayname||'',date_text:o.dated||'',medium:o.technique||'',thumb_url:o.primaryimageurl+'?height=400&width=400',full_url:o.primaryimageurl,iiif_manifest:'https://iiif.harvardartmuseums.org/manifests/object/'+o.objectid,detail_url:o.url||'',bio:o.description||''});
      }
      await sleep(200);
    } catch(e) { break; }
  }
  return upsert(sql,works);
}

export default async function handler(req, res) {
  try {
    const secret = req.query && req.query.secret;
    if (secret !== process.env.SYNC_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const sql = neon(process.env.DATABASE_URL);

    await sql`CREATE TABLE IF NOT EXISTS artworks (id SERIAL PRIMARY KEY,source TEXT NOT NULL,source_id TEXT NOT NULL,title TEXT NOT NULL,artist TEXT,date_text TEXT,medium TEXT,department TEXT,thumb_url TEXT,full_url TEXT,iiif_info TEXT,iiif_manifest TEXT,detail_url TEXT,rights TEXT,rights_label TEXT,commercial_ok BOOLEAN DEFAULT true,bio TEXT,synced_at TIMESTAMP DEFAULT NOW(),UNIQUE(source,source_id))`;

    const source = (req.query && req.query.source) || 'all';
    const log = [];
    let total = 0;

    const run = async (name, fn) => {
      try { const n = await fn(); total += n; log.push(name+': '+n+' saved'); }
      catch(e) { log.push(name+' error: '+e.message); }
    };

    if (source==='met'||source==='all')         await run('Met Museum',    ()=>syncMet(sql));
    if (source==='artic'||source==='all')        await run('AIC',           ()=>syncArtic(sql));
    if (source==='cleveland'||source==='all')    await run('Cleveland',     ()=>syncCleveland(sql));
    if (source==='nga'||source==='all')          await run('SMK Denmark',   ()=>syncNGA(sql));
    if (source==='vam'||source==='all')          await run('V&A',           ()=>syncVAM(sql));
    if (source==='smithsonian'||source==='all')  await run('Smithsonian',   ()=>syncSmithsonian(sql,process.env.SMITHSONIAN_KEY));
    if (source==='harvard'||source==='all')      await run('Harvard',       ()=>syncHarvard(sql,process.env.HARVARD_KEY));

    const rows = await sql`SELECT COUNT(*) as total FROM artworks`;
    return res.status(200).json({success:true,newWorks:total,totalInDb:parseInt(rows[0].total),log});
  } catch(e) {
    return res.status(500).json({error:e.message});
  }
}
