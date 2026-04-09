import { neon } from '@neondatabase/serverless';

async function fetchJson(url) {
  const res = await fetch(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'PublicArtCollections/1.0' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const RIGHTS_OK = [
  'creativecommons.org/publicdomain/zero','creativecommons.org/publicdomain/mark',
  '/public-domain','creativecommons.org/licenses/by/4','creativecommons.org/licenses/by/3',
];
function rightsOk(url) {
  if (!url) return false;
  const r = String(url).toLowerCase();
  return RIGHTS_OK.some(s => r.includes(s));
}

async function upsert(sql, works) {
  let saved = 0;
  for (const w of works) {
    try {
      await sql`
        INSERT INTO artworks (source,source_id,title,artist,date_text,medium,department,
          thumb_url,full_url,iiif_info,iiif_manifest,detail_url,rights,rights_label,commercial_ok,bio,synced_at)
        VALUES (${w.source},${w.source_id},${w.title},${w.artist||''},${w.date_text||''},
          ${w.medium||''},${w.department||''},${w.thumb_url||''},${w.full_url||''},
          ${w.iiif_info||''},${w.iiif_manifest||''},${w.detail_url||''},
          ${'CC0'},${'CC0 — Public Domain'},${true},${w.bio||''},NOW())
        ON CONFLICT (source,source_id) DO UPDATE SET thumb_url=EXCLUDED.thumb_url,synced_at=NOW()
      `;
      saved++;
    } catch(e) {}
  }
  return saved;
}

async function syncMet(sql) {
  const works = [];
  try {
    const s = await fetchJson('https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&isPublicDomain=true&q=painting');
    const ids = (s.objectIDs||[]).slice(0,1000);
    for (let i = 0; i < ids.length; i += 20) {
      const batch = ids.slice(i,i+20);
      const details = await Promise.all(batch.map(id =>
        fetchJson(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`).catch(()=>null)
      ));
      for (const o of details) {
        if (!o?.primaryImageSmall||!o.isPublicDomain) continue;
        works.push({ source:'Metropolitan Museum of Art', source_id:String(o.objectID),
          title:o.title||'Untitled', artist:o.artistDisplayName||'', date_text:o.objectDate||'',
          medium:o.medium||'', department:o.department||'', thumb_url:o.primaryImageSmall,
          full_url:o.primaryImage,
          iiif_manifest:`https://collectionapi.metmuseum.org/public/collection/v1/iiif/${o.objectID}/manifest.json`,
          detail_url:o.objectURL||'', bio:o.creditLine||'' });
      }
      await sleep(50);
    }
  } catch(e) {}
  return await upsert(sql,works);
}

async function syncArtic(sql) {
  const works = [];
  for (let page=1; page<=20; page++) {
    try {
      const d = await fetchJson(`https://api.artic.edu/api/v1/artworks?page=${page}&limit=100&fields=id,title,artist_display,date_display,image_id,medium_display,department_title&query[term][is_public_domain]=true&query[exists][field]=image_id`);
      if (!d.data?.length) break;
      for (const o of d.data) {
        if (!o.image_id) continue;
        works.push({ source:'Art Institute of Chicago', source_id:String(o.id),
          title:o.title||'Untitled', artist:o.artist_display||'', date_text:o.date_display||'',
          medium:o.medium_display||'', department:o.department_title||'',
          thumb_url:`https://www.artic.edu/iiif/2/${o.image_id}/full/!400,400/0/default.jpg`,
          full_url:`https://www.artic.edu/iiif/2/${o.image_id}/full/full/0/default.jpg`,
          iiif_info:`https://www.artic.edu/iiif/2/${o.image_id}/info.json`,
          detail_url:`https://www.artic.edu/artworks/${o.id}`, bio:'' });
      }
      await sleep(100);
    } catch(e) { break; }
  }
  return await upsert(sql,works);
}

async function syncCleveland(sql) {
  const works = [];
  for (let skip=0; skip<5000; skip+=100) {
    try {
      const d = await fetchJson(`https://openaccess-api.clevelandart.org/api/artworks/?has_image=1&cc0=1&limit=100&skip=${skip}`);
      if (!d.data?.length) break;
      for (const o of d.data) {
        if (!o.images?.web) continue;
        works.push({ source:'Cleveland Museum of Art', source_id:String(o.id),
          title:o.title||'Untitled', artist:o.creators?.[0]?.description||'',
          date_text:o.creation_date||'', medium:o.technique||'',
          thumb_url:o.images.web.url, full_url:o.images.full?.url||o.images.web.url,
          detail_url:o.url||'', bio:o.did_you_know||'' });
      }
      await sleep(100);
    } catch(e) { break; }
  }
  return await upsert(sql,works);
}

async function syncRijks(sql) {
  const works = [];
  let nextUrl = 'https://data.rijksmuseum.nl/search/collection?type=schilderij&limit=100';
  for (let page=0; page<20&&nextUrl; page++) {
    try {
      const d = await fetchJson(nextUrl);
      const items = d.orderedItems||[];
      if (!items.length) break;
      for (const item of items.slice(0,50)) {
        try {
          const itemId = typeof item === 'string' ? item : item.id;
          if (!itemId) continue;
          const o = await fetch(itemId, {headers:{Accept:'application/json'}}).then(r=>r.json());
          if (!o) continue;
          const idUrl = o.id||o['@id']||'';
          const objNum = idUrl.split('/').pop();
          if (!objNum) continue;
          const title = o.identified_by?.find(x=>x.type==='Name')?.content||o.label?.en?.[0]||'Untitled';
          const artist = o.produced_by?.carried_out_by?.[0]?.identified_by?.[0]?.content||'';
          const imgService = o.representation?.[0]?.digitally_shown_by?.[0]?.access_point?.[0]?.id;
          works.push({ source:'Rijksmuseum', source_id:objNum, title, artist,
            date_text:o.produced_by?.timespan?.identified_by?.[0]?.content||'',
            thumb_url:imgService?imgService.replace('/info.json','')+'/full/!400,400/0/default.jpg'
              :`https://www.rijksmuseum.nl/api/iiif/${objNum}/full/!400,400/0/default.jpg`,
            full_url:imgService?imgService.replace('/info.json','')+'/full/full/0/default.jpg':'',
            iiif_info:imgService||`https://www.rijksmuseum.nl/api/iiif/${objNum}/info.json`,
            iiif_manifest:`https://www.rijksmuseum.nl/api/iiif/presentation/${objNum}/manifest`,
            detail_url:idUrl, bio:'Rijksmuseum, Amsterdam.' });
          await sleep(50);
        } catch(e) {}
      }
      nextUrl = d.next?.id||null;
      await sleep(300);
    } catch(e) { break; }
  }
  return await upsert(sql,works);
}

async function syncNGA(sql) {
  // NGA publishes data as CSV on GitHub — no REST API exists
  // We use SMK (National Gallery of Denmark) which has a full open API
  const works = [];
  try {
    const d = await fetchJson('https://api.smk.dk/api/v1/art/search/?keys=*&has_image=true&public_domain=true&offset=0&rows=2000&lang=en');
    const items = d.items || [];
    for (const o of items) {
      if (!o.image_thumbnail) continue;
      works.push({
        source: 'SMK National Gallery of Denmark',
        source_id: String(o.object_number || o.id),
        title: o.titles?.[0]?.title || o.title || 'Untitled',
        artist: o.artist?.[0]?.name || '',
        date_text: o.production_date?.[0]?.period || o.dating?.period || '',
        medium: o.medium || o.techniques?.[0]?.technique || '',
        thumb_url: o.image_thumbnail,
        full_url: o.image_native || o.image_thumbnail,
        detail_url: `https://open.smk.dk/en/artwork/image/${o.object_number}`,
        bio: o.content_description || ''
      });
    }
  } catch(e) { console.error('SMK error:', e.message); }
  return await upsert(sql, works);
}

async function syncVAM(sql) {
  const works = [];
  for (let page=1; page<=20; page++) {
    try {
      const d = await fetchJson(`https://api.vam.ac.uk/v2/objects/search?images_exist=1&page_size=100&page=${page}&q=art`);
      const items = d.records||[];
      if (!items.length) break;
      for (const o of items) {
        if (!o._primaryImageId) continue;
        const imgBase = `https://framemark.vam.ac.uk/collections/${o._primaryImageId}`;
        works.push({ source:'Victoria & Albert Museum', source_id:o.systemNumber,
          title:o._primaryTitle||'Untitled', artist:o._primaryMaker?.name||'',
          date_text:o._primaryDate||'', medium:o.materialsAndTechniques||'',
          thumb_url:`${imgBase}/full/!400,400/0/default.jpg`,
          full_url:`${imgBase}/full/full/0/default.jpg`,
          iiif_info:`${imgBase}/info.json`,
          detail_url:`https://collections.vam.ac.uk/item/${o.systemNumber}/`,
          bio:o.briefDescription||'' });
      }
      await sleep(200);
    } catch(e) { break; }
  }
  return await upsert(sql,works);
}

async function syncEuropeana(sql, key) {
  if (!key||key==='YOUR_EUROPEANA_KEY_HERE') return 0;
  const works = [];
  for (const q of ['painting','portrait','landscape','still life','sculpture','drawing']) {
    try {
      const d = await fetchJson(`https://api.europeana.eu/record/v2/search.json?wskey=${key}&query=${encodeURIComponent(q)}&reusability=open&media=true&qf=TYPE:IMAGE&rows=100&profile=rich`);
      if (!d.success||!d.items) continue;
      for (const o of d.items) {
        const rightsArr = Array.isArray(o.edmRights)?o.edmRights:(o.edmRights?[o.edmRights]:[]);
        if (!rightsOk(rightsArr[0])) continue;
        const recId = (o.id||'').replace(/^\//,'');
        const thumb = Array.isArray(o.edmPreview)?o.edmPreview[0]:o.edmPreview;
        if (!thumb) continue;
        works.push({ source:`Europeana — ${Array.isArray(o.dataProvider)?o.dataProvider[0]:(o.dataProvider||'Europeana')}`,
          source_id:recId, title:Array.isArray(o.title)?o.title[0]:(o.title||'Untitled'),
          artist:Array.isArray(o.dcCreator)?o.dcCreator[0]:(o.dcCreator||''),
          date_text:Array.isArray(o.year)?o.year[0]:(o.year||''),
          thumb_url:thumb, full_url:Array.isArray(o.edmIsShownBy)?o.edmIsShownBy[0]:(o.edmIsShownBy||thumb),
          iiif_manifest:recId?`https://iiif.europeana.eu/presentation/${recId}/manifest`:'',
          detail_url:`https://www.europeana.eu/en/item/${recId}`,
          bio:Array.isArray(o.dcDescription)?o.dcDescription[0]:(o.dcDescription||'') });
      }
      await sleep(500);
    } catch(e) {}
  }
  return await upsert(sql,works);
}

async function syncSmithsonian(sql, key) {
  if (!key||key==='YOUR_SMITHSONIAN_KEY_HERE') return 0;
  const works = [];
  for (let start=0; start<1000; start+=100) {
    try {
      const d = await fetchJson(`https://api.si.edu/openaccess/api/v1.0/search?q=art&rows=100&start=${start}&api_key=${key}`);
      const rows = d.response?.rows||[];
      if (!rows.length) break;
      for (const o of rows) {
        const media = o.content?.descriptiveNonRepeating?.online_media?.media?.[0];
        if (!media?.thumbnail||media.usage?.access!=='CC0') continue;
        works.push({ source:'Smithsonian Institution', source_id:o.id,
          title:o.title||'Untitled', artist:o.content?.freetext?.name?.[0]?.content||'',
          date_text:o.content?.freetext?.date?.[0]?.content||'',
          medium:o.content?.freetext?.physicalDescription?.[0]?.content||'',
          thumb_url:media.thumbnail, full_url:media.content||'',
          detail_url:o.content?.descriptiveNonRepeating?.record_link||'', bio:'' });
      }
      await sleep(300);
    } catch(e) { break; }
  }
  return await upsert(sql,works);
}

async function syncHarvard(sql, key) {
  if (!key||key==='YOUR_HARVARD_KEY_HERE') return 0;
  const works = [];
  for (let page=1; page<=20; page++) {
    try {
      const d = await fetchJson(`https://api.harvardartmuseums.org/object?hasimage=1&size=100&page=${page}&apikey=${key}&classification=Paintings,Drawings,Photographs,Prints`);
      const items = d.records||[];
      if (!items.length) break;
      for (const o of items) {
        if (!o.primaryimageurl) continue;
        works.push({ source:'Harvard Art Museums', source_id:String(o.objectid),
          title:o.title||'Untitled', artist:o.people?.[0]?.displayname||o.attribution||'',
          date_text:o.dated||'', medium:o.technique||'',
          thumb_url:o.primaryimageurl+'?height=400&width=400', full_url:o.primaryimageurl,
          iiif_info:o.iiifbaseuri?o.iiifbaseuri+'/info.json':'',
          iiif_manifest:`https://iiif.harvardartmuseums.org/manifests/object/${o.objectid}`,
          detail_url:o.url||'', bio:o.description||'' });
      }
      await sleep(200);
    } catch(e) { break; }
  }
  return await upsert(sql,works);
}

export default async function handler(req, res) {
  if (req.query.secret !== process.env.SYNC_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const sql = neon(process.env.DATABASE_URL);

  await sql`
    CREATE TABLE IF NOT EXISTS artworks (
      id SERIAL PRIMARY KEY, source TEXT NOT NULL, source_id TEXT NOT NULL,
      title TEXT NOT NULL, artist TEXT, date_text TEXT, medium TEXT, department TEXT,
      thumb_url TEXT, full_url TEXT, iiif_info TEXT, iiif_manifest TEXT, detail_url TEXT,
      rights TEXT, rights_label TEXT, commercial_ok BOOLEAN DEFAULT true, bio TEXT,
      synced_at TIMESTAMP DEFAULT NOW(), UNIQUE(source, source_id)
    )
  `;

  // Use ?source=name to run one source at a time and avoid timeout
  // e.g. /api/sync?secret=xxx&source=rijks
  const source = req.query.source || 'all';
  const log = [];
  let total = 0;

  const run = async (name, fn) => {
    try { const n = await fn(); total += n; log.push(`${name}: ${n} saved`); }
    catch(e) { log.push(`${name} error: ${e.message}`); }
  };

  if (source==='met'         || source==='all') await run('Met Museum',        () => syncMet(sql));
  if (source==='artic'       || source==='all') await run('Art Inst. Chicago', () => syncArtic(sql));
  if (source==='cleveland'   || source==='all') await run('Cleveland',         () => syncCleveland(sql));
  if (source==='rijks'       || source==='all') await run('Rijksmuseum',       () => syncRijks(sql));
  if (source==='nga'         || source==='all') await run('SMK Denmark',       () => syncNGA(sql));
  if (source==='vam'         || source==='all') await run('V&A Museum',        () => syncVAM(sql));
  if (source==='europeana'   || source==='all') await run('Europeana',         () => syncEuropeana(sql, process.env.EUROPEANA_KEY));
  if (source==='smithsonian' || source==='all') await run('Smithsonian',       () => syncSmithsonian(sql, process.env.SMITHSONIAN_KEY));
  if (source==='harvard'     || source==='all') await run('Harvard',           () => syncHarvard(sql, process.env.HARVARD_KEY));

  const countRows = await sql`SELECT COUNT(*) as total FROM artworks`;
  return res.status(200).json({ success:true, newWorks:total, totalInDb:parseInt(countRows[0].total), log });
}

export const config = { maxDuration: 300 };
