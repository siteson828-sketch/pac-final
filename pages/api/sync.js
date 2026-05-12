import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';

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
  const seen = new Set();
  const terms = ['painting', 'portrait', 'landscape', 'still life', 'drawing'];
  for (const term of terms) {
    try {
      const s = await fetchJson(`https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&isPublicDomain=true&q=${encodeURIComponent(term)}`);
      const ids = (s.objectIDs||[]).slice(0,500);
      for (let i=0; i<ids.length; i+=20) {
        const batch = ids.slice(i,i+20);
        const details = await Promise.all(batch.map(id =>
          fetchJson(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`).catch(()=>null)
        ));
        for (const o of details) {
          if (!o?.primaryImageSmall||!o.isPublicDomain||seen.has(o.objectID)) continue;
          seen.add(o.objectID);
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
  }
  return upsert(sql,works);
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
  const seen = new Set();
  // Rijksmuseum API requires a paid key; use Wikidata SPARQL instead (free, CC0 images via Wikimedia Commons)
  for (let offset=0; offset<8000; offset+=1000) {
    try {
      const query = `
        SELECT ?item ?itemLabel ?image ?creator ?creatorLabel ?inv ?date WHERE {
          ?item wdt:P195 wd:Q190804;
                wdt:P18 ?image.
          OPTIONAL { ?item wdt:P217 ?inv. }
          OPTIONAL { ?item wdt:P170 ?creator. }
          OPTIONAL { ?item wdt:P571 ?date. }
          SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
        }
        LIMIT 1000 OFFSET ${offset}
      `;
      const d = await fetchJson(
        `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`
      );
      const bindings = d.results?.bindings||[];
      if (!bindings.length) break;
      for (const r of bindings) {
        const qid = r.item?.value.split('/').pop();
        if (seen.has(qid)) continue;
        seen.add(qid);
        const imgRaw = r.image?.value||'';
        if (!imgRaw) continue;
        const imgHttps = imgRaw.replace('http://', 'https://');
        const thumb = `${imgHttps}?width=400`;
        const full  = `${imgHttps}?width=1200`;
        const inv   = r.inv?.value||qid;
        const year  = r.date?.value ? r.date.value.replace(/^\+/,'').substring(0,4) : '';
        const creator = r.creatorLabel?.value||'';
        works.push({
          source:'Rijksmuseum', source_id:inv,
          title:r.itemLabel?.value||'Untitled',
          artist: creator.match(/^Q\d+$/) ? '' : creator,
          date_text:year, medium:'', department:'',
          thumb_url:thumb, full_url:full,
          iiif_manifest:inv.startsWith('SK')||inv.startsWith('RP')||inv.startsWith('BK')
            ? `https://www.rijksmuseum.nl/api/iiif/${inv}/manifest/json` : '',
          detail_url:inv ? `https://www.rijksmuseum.nl/en/collection/${inv}`
            : `https://www.wikidata.org/wiki/${qid}`,
          bio:'Rijksmuseum, Amsterdam.'
        });
      }
      await sleep(1000);
    } catch(e) { break; }
  }
  return upsert(sql, works);
}

async function syncSMK(sql) {
  const works = [];
  for (let offset=0; offset<5000; offset+=100) {
    try {
      const d = await fetchJson(
        `https://api.smk.dk/api/v1/art/search?keys=*&has_image=true&offset=${offset}&rows=100&filters=public_domain:true`
      );
      const items = d.items||[];
      if (!items.length) break;
      for (const o of items) {
        if (!o.has_image||!o.image_thumbnail||!o.public_domain) continue;
        const thumb = o.image_thumbnail.replace(/\/full\/![0-9]+,/, '/full/!400,');
        const full = o.image_iiif_id
          ? `${o.image_iiif_id}/full/!1200,/0/default.jpg`
          : o.image_thumbnail;
        const titleObj = Array.isArray(o.titles)&&o.titles.length
          ? (o.titles.find(t=>t.language==='en')||o.titles[0]) : null;
        const artist = Array.isArray(o.production)&&o.production.length
          ? o.production[0].creator||'' : '';
        const dateText = Array.isArray(o.production_date)&&o.production_date.length
          ? o.production_date[0].period||'' : '';
        works.push({
          source:'SMK National Gallery of Denmark',
          source_id:o.object_number,
          title:titleObj?.title||'Untitled', artist, date_text:dateText,
          medium:Array.isArray(o.techniques)&&o.techniques.length?o.techniques[0]:'',
          department:o.responsible_department||'',
          thumb_url:thumb, full_url:full,
          iiif_info:o.image_iiif_info||'',
          iiif_manifest:o.iiif_manifest||'',
          detail_url:o.frontend_url||'',
          bio:''
        });
      }
      await sleep(200);
    } catch(e) { break; }
  }
  return upsert(sql,works);
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
  if (!key) return 0;
  const works = [];
  const seen = new Set();
  const terms = ['painting', 'portrait', 'landscape', 'watercolor', 'drawing', 'print'];
  for (const term of terms) {
    for (let start=0; start<500; start+=100) {
      try {
        const d = await fetchJson(`https://api.si.edu/openaccess/api/v1.0/search?q=${encodeURIComponent(term)}&rows=100&start=${start}&api_key=${key}`);
        const rows = d.response?.rows||[];
        if (!rows.length) break;
        for (const o of rows) {
          if (seen.has(o.id)) continue;
          // Check all media items for CC0, not just the first
          const allMedia = o.content?.descriptiveNonRepeating?.online_media?.media||[];
          const cc0 = allMedia.find(m => m?.thumbnail && m?.usage?.access==='CC0');
          if (!cc0) continue;
          seen.add(o.id);
          works.push({ source:'Smithsonian Institution', source_id:o.id,
            title:o.title||'Untitled', artist:o.content?.freetext?.name?.[0]?.content||'',
            date_text:o.content?.freetext?.date?.[0]?.content||'',
            medium:o.content?.freetext?.physicalDescription?.[0]?.content||'',
            thumb_url:cc0.thumbnail, full_url:cc0.content||'',
            detail_url:o.content?.descriptiveNonRepeating?.record_link||'', bio:'' });
        }
        await sleep(300);
      } catch(e) { break; }
    }
  }
  return upsert(sql,works);
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

async function syncWikidataMuseum(sql, qid, sourceName) {
  const works = [];
  const seen = new Set();
  for (let offset=0; offset<5000; offset+=1000) {
    try {
      const query = `
        SELECT ?item ?itemLabel ?image ?creator ?creatorLabel ?inv ?date WHERE {
          ?item wdt:P195 wd:${qid};
                wdt:P18 ?image.
          OPTIONAL { ?item wdt:P217 ?inv. }
          OPTIONAL { ?item wdt:P170 ?creator. }
          OPTIONAL { ?item wdt:P571 ?date. }
          SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
        }
        LIMIT 1000 OFFSET ${offset}
      `;
      const d = await fetchJson(
        `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`
      );
      const bindings = d.results?.bindings||[];
      if (!bindings.length) break;
      for (const r of bindings) {
        const qidItem = r.item?.value.split('/').pop();
        if (seen.has(qidItem)) continue;
        seen.add(qidItem);
        const imgRaw = r.image?.value||'';
        if (!imgRaw) continue;
        const imgHttps = imgRaw.replace('http://', 'https://');
        const thumb = `${imgHttps}?width=400`;
        const full  = `${imgHttps}?width=1200`;
        const inv   = r.inv?.value||qidItem;
        const year  = r.date?.value ? r.date.value.replace(/^\+/,'').substring(0,4) : '';
        const creator = r.creatorLabel?.value||'';
        works.push({
          source: sourceName, source_id: inv,
          title: r.itemLabel?.value||'Untitled',
          artist: creator.match(/^Q\d+$/) ? '' : creator,
          date_text: year, medium: '', department: '',
          thumb_url: thumb, full_url: full,
          iiif_manifest: '',
          detail_url: `https://www.wikidata.org/wiki/${qidItem}`,
          bio: `${sourceName}.`
        });
      }
      await sleep(1000);
    } catch(e) { break; }
  }
  return upsert(sql, works);
}

async function syncMia(sql) {
  // Minneapolis Institute of Art — free keyless JSON search API
  const works = [];
  const seen = new Set();
  const terms = ['painting','drawing','watercolor','print','portrait','landscape'];
  for (const term of terms) {
    for (let page=1; page<=8; page++) {
      try {
        const d = await fetchJson(
          `https://search.artsmia.org/${encodeURIComponent(term)}?size=100&p=${page}`
        );
        const hits = d.hits?.hits||[];
        if (!hits.length) break;
        for (const h of hits) {
          const o = h._source;
          if (!o?.id||seen.has(String(o.id))) continue;
          if (o.rights_type !== 'Public Domain') continue;
          if (o.image !== 'valid') continue;
          seen.add(String(o.id));
          const id = o.id;
          works.push({
            source:'Minneapolis Institute of Art', source_id:String(id),
            title:o.title||'Untitled',
            artist:o.artist||o.attribution||'',
            date_text:o.dated||'', medium:o.medium||'',
            department:o.department||'',
            thumb_url:`https://iiif.artsmia.org/${id}/full/!400,400/0/default.jpg`,
            full_url:`https://iiif.artsmia.org/${id}/full/full/0/default.jpg`,
            iiif_info:`https://iiif.artsmia.org/${id}/info.json`,
            detail_url:`https://collections.artsmia.org/art/${id}`,
            bio:o.text||''
          });
        }
        if (hits.length < 100) break;
        await sleep(300);
      } catch(e) { break; }
    }
  }
  return upsert(sql, works);
}

async function syncLOC(sql) {
  const works = [];
  const seen = new Set();
  const terms = ['painting','portrait','landscape','drawing','print'];
  for (const q of terms) {
    for (let page=1; page<=5; page++) {
      try {
        const d = await fetchJson(
          `https://www.loc.gov/search/?fo=json&q=${encodeURIComponent(q)}&fa=online-format:image|rights-status:no-known-restrictions&c=50&sp=${page}&at=results,pagination`
        );
        const items = d.results||[];
        if (!items.length) break;
        for (const o of items) {
          const id = String(o.id||o.url||'');
          if (!id||seen.has(id)) continue;
          const imgUrls = o.image_url||[];
          if (!imgUrls.length) continue;
          seen.add(id);
          const iiifBase = imgUrls[0].replace(/\/full\/[^/]+\/0\/default\.jpg$/, '');
          const thumb = `${iiifBase}/full/!400,400/0/default.jpg`;
          const full  = `${iiifBase}/full/!1200,1200/0/default.jpg`;
          const contributor = Array.isArray(o.contributor) ? o.contributor[0] : (o.contributor||'');
          works.push({
            source:'Library of Congress',
            source_id: id.replace(/^https?:\/\/www\.loc\.gov\/item\//, '').replace(/\/$/, ''),
            title: Array.isArray(o.title) ? o.title[0] : (o.title||'Untitled'),
            artist: contributor.replace(/\s*\(.+\)$/, '').trim(),
            date_text: o.date||'',
            medium: Array.isArray(o.original_format) ? o.original_format[0] : '',
            thumb_url: thumb, full_url: full,
            detail_url: o.url||'', bio:''
          });
        }
        const pg = d.pagination||{};
        if (!pg.next) break;
        await sleep(500);
      } catch(e) { break; }
    }
  }
  return upsert(sql, works);
}

async function syncBnF(sql) {
  const works = [];
  const seen = new Set();
  for (let start=1; start<=5000; start+=50) {
    try {
      const res = await fetch(
        `https://gallica.bnf.fr/SRU?operation=searchRetrieve&version=1.2&query=dc.type+all+%22image%22+and+dc.rights+all+%22domaine+public%22&maximumRecords=50&startRecord=${start}&collapsing=disabled`,
        { headers: { 'Accept':'application/xml,text/xml,*/*', 'User-Agent':'PublicArtCollections/1.0' } }
      );
      if (!res.ok) break;
      const xml = await res.text();
      const records = xml.match(/<srw:record>[\s\S]*?<\/srw:record>/g)||[];
      if (!records.length) break;
      for (const rec of records) {
        const get = tag => { const m = rec.match(new RegExp(`<dc:${tag}[^>]*>([^<]*)<\/dc:${tag}>`)); return m?m[1].trim():''; };
        const getAll = tag => [...rec.matchAll(new RegExp(`<dc:${tag}[^>]*>([^<]*)<\/dc:${tag}>`, 'g'))].map(m=>m[1].trim());
        const ark = getAll('identifier').find(id=>id.includes('ark:'));
        if (!ark||seen.has(ark)) continue;
        seen.add(ark);
        const arkPath = ark.replace(/^https?:\/\/gallica\.bnf\.fr\//, '');
        works.push({
          source:'BnF Gallica', source_id: arkPath,
          title: get('title')||'Untitled', artist: get('creator')||'',
          date_text: get('date')||'', medium: get('format')||'',
          thumb_url: `https://gallica.bnf.fr/${arkPath}/f1.thumbnail`,
          full_url:  `https://gallica.bnf.fr/${arkPath}/f1.highres`,
          detail_url: ark, bio: get('description')||''
        });
      }
      if (!xml.includes('<srw:record>')) break;
      await sleep(300);
    } catch(e) { break; }
  }
  return upsert(sql, works);
}

async function syncNYPL(sql) {
  const works = [];
  const seen = new Set();
  const terms = ['painting','photograph','drawing','print','illustration'];
  for (const q of terms) {
    for (let page=1; page<=20; page++) {
      try {
        const d = await fetchJson(
          `https://api.nypl.org/v2/items?publicDomainOnly=true&hasDigitalContent=true&q=${encodeURIComponent(q)}&per_page=100&page=${page}`
        );
        const items = d.nyplAPI?.response?.result||d.data||[];
        if (!items.length) break;
        for (const o of items) {
          const uuid = o.uuid||o.id;
          if (!uuid||seen.has(uuid)) continue;
          seen.add(uuid);
          const imgLinks = o.imageLinks?.[0]?.imageLink||[];
          const thumb = imgLinks.find(u=>typeof u==='string'&&u.includes('t=w'))||imgLinks[0];
          const full  = imgLinks.find(u=>typeof u==='string'&&u.includes('t=g'))||imgLinks[imgLinks.length-1]||thumb;
          if (!thumb) continue;
          works.push({
            source:'NYPL', source_id: uuid,
            title: Array.isArray(o.title)?o.title[0]:(o.title||'Untitled'),
            artist: Array.isArray(o.name)?o.name[0]:(o.name||''),
            date_text: Array.isArray(o.date)?o.date[0]:(o.date||''),
            medium: Array.isArray(o.typeOfResource)?o.typeOfResource[0]:(o.typeOfResource||''),
            thumb_url: thumb, full_url: full||thumb,
            detail_url: o.collectionsURL||'',
            bio: Array.isArray(o.note)?o.note[0]:(o.note||'')
          });
        }
        await sleep(200);
      } catch(e) { break; }
    }
  }
  return await upsert(sql, works);
}

async function syncWikimedia(sql) {
  const works = [];
  const seen = new Set();
  const categories = ['Public_domain_paintings', 'CC0_artworks'];
  for (const category of categories) {
    let cmcontinue = '';
    let pages = 0;
    while (pages < 10) {
      try {
        pages++;
        const contParam = cmcontinue ? `&cmcontinue=${encodeURIComponent(cmcontinue)}` : '';
        const d = await fetchJson(
          `https://commons.wikimedia.org/w/api.php?action=query&list=categorymembers&cmtitle=Category:${encodeURIComponent(category)}&cmtype=file&cmlimit=50&format=json${contParam}`
        );
        const members = d.query?.categorymembers || [];
        for (const member of members) {
          try {
            const title = member.title;
            if (seen.has(title)) continue;
            seen.add(title);
            const metaRes = await fetchJson(
              `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(title)}&prop=imageinfo&iiprop=url|extmetadata|thumburl&iiurlwidth=400&format=json`
            );
            const pageData = Object.values(metaRes.query?.pages || {})[0];
            const ii = pageData?.imageinfo?.[0];
            if (!ii?.url) continue;
            const meta = ii.extmetadata || {};
            const artist = meta.Artist?.value?.replace(/<[^>]+>/g, '') || '';
            const dateStr = meta.DateTimeOriginal?.value || meta.DateTime?.value || '';
            const year = dateStr.match(/\d{4}/)?.[0] || '';
            const rightsLabel = meta.LicenseShortName?.value || 'CC0';
            const fileName = title.replace(/^File:/, '');
            works.push({
              source: 'Wikimedia Commons',
              source_id: title,
              title: meta.ObjectName?.value || fileName.replace(/\.[^.]+$/, '').replace(/_/g, ' '),
              artist,
              date_text: year,
              medium: meta.Medium?.value || '',
              thumb_url: ii.thumburl || ii.url,
              full_url: ii.url,
              detail_url: `https://commons.wikimedia.org/wiki/${encodeURIComponent(title)}`,
              rights: 'https://creativecommons.org/publicdomain/zero/1.0/',
              rights_label: rightsLabel,
              bio: meta.ImageDescription?.value?.replace(/<[^>]+>/g, '') || '',
            });
            await sleep(150);
          } catch(e) {}
        }
        cmcontinue = d.continue?.cmcontinue || '';
        if (!cmcontinue) break;
        await sleep(400);
      } catch(e) { break; }
    }
  }
  return await upsert(sql, works);
}

async function syncDPLA(sql, key) {
  if (!key) return 0;
  const works = [];
  const seen = new Set();
  const terms = ['painting','photograph','drawing','print','watercolor'];
  for (const q of terms) {
    for (let page=1; page<=2; page++) {
      try {
        const d = await fetchJson(
          `https://api.dp.la/v2/items?q=${encodeURIComponent(q)}&sourceResource.type=image&page=${page}&page_size=100&api_key=${key}`
        );
        const items = d.docs||[];
        if (!items.length) break;
        for (const o of items) {
          if (!o.object||seen.has(o.id)) continue;
          seen.add(o.id);
          const sr = o.sourceResource||{};
          works.push({
            source:'DPLA', source_id: o.id,
            title: Array.isArray(sr.title)?sr.title[0]:(sr.title||'Untitled'),
            artist: Array.isArray(sr.creator)?sr.creator[0]:(sr.creator||''),
            date_text: sr.date?.displayDate||sr.date?.begin||'',
            medium: Array.isArray(sr.format)?sr.format[0]:(sr.format||''),
            thumb_url: o.object, full_url: o.object,
            detail_url: o.isShownAt||'',
            bio: o.dataProvider||''
          });
        }
        await sleep(200);
      } catch(e) { break; }
    }
  }
  return upsert(sql, works);
}

export default async function handler(req, res) {
  const cronAuth = req.headers['authorization'];
  const validCron   = process.env.CRON_SECRET && cronAuth === `Bearer ${process.env.CRON_SECRET}`;
  const validSecret = req?.query?.secret && req.query.secret === process.env.SYNC_SECRET;
  if (!validCron && !validSecret) {
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
  const log = [];
  let total = 0;
  const run = async (name, fn) => {
    try { const n = await fn(); total += n; log.push(`${name}: ${n} saved`); }
    catch(e) { log.push(`${name} error: ${e.message}`); }
  };
  const src = req.query.source || 'all';
  if (src==='met'        ||src==='all') await run('Met Museum',         () => syncMet(sql));
  if (src==='artic'      ||src==='all') await run('Art Inst. Chicago',  () => syncArtic(sql));
  if (src==='cleveland'  ||src==='all') await run('Cleveland',          () => syncCleveland(sql));
  if (src==='rijks'      ||src==='all') await run('Rijksmuseum',        () => syncRijks(sql));
  if (src==='smk'        ||src==='all') await run('SMK Denmark',        () => syncSMK(sql));
  if (src==='vam'        ||src==='all') await run('V&A Museum',         () => syncVAM(sql));
  if (src==='europeana'  ||src==='all') await run('Europeana',          () => syncEuropeana(sql, process.env.EUROPEANA_KEY));
  if (src==='smithsonian'||src==='all') await run('Smithsonian',        () => syncSmithsonian(sql, process.env.SMITHSONIAN_KEY));
  if (src==='harvard'    ||src==='all') await run('Harvard',            () => syncHarvard(sql, process.env.HARVARD_KEY));
  if (src==='getty'      ||src==='all') await run('Getty Museum',       () => syncWikidataMuseum(sql, 'Q1700481', 'Getty Museum'));
  if (src==='walters'    ||src==='all') await run('Walters Art Museum', () => syncWikidataMuseum(sql, 'Q210081',  'Walters Art Museum'));
  if (src==='mia'        ||src==='all') await run('Minneapolis Inst. of Art', () => syncMia(sql));
  if (src==='yale'       ||src==='all') await run('Yale Art Gallery',   () => syncWikidataMuseum(sql, 'Q1568434', 'Yale University Art Gallery'));
  if (src==='loc'        ||src==='all') await run('Library of Congress',() => syncLOC(sql));
  if (src==='bnf'        ||src==='all') await run('BnF Gallica',        () => syncBnF(sql));
  if (src==='nypl'       ||src==='all') await run('NYPL',               () => syncNYPL(sql));
  if (src==='wikimedia'  ||src==='all') await run('Wikimedia Commons',  () => syncWikimedia(sql));
  if (src==='dpla'       ||src==='all') await run('DPLA',               () => syncDPLA(sql, process.env.DPLA_KEY));
  const countRows = await sql`SELECT COUNT(*) as total FROM artworks`;
  return res.status(200).json({ success:true, newWorks:total, totalInDb:parseInt(countRows[0].total), log });
}

export const config = { maxDuration: 300 };
