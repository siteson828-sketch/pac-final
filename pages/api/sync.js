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

async function syncRijks(sql, offset=0) {
  const works = [];
  const seen = new Set();
  // Rijksmuseum API requires a paid key; use Wikidata SPARQL instead (free, CC0 images via Wikimedia Commons)
  // Offset-chunked: one bounded window (2000 records) per call so it never times out.
  {
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
        LIMIT 2000 OFFSET ${offset}
      `;
      const d = await fetchJson(
        `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`
      );
      const bindings = d.results?.bindings||[];
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
    } catch(e) {}
  }
  return upsert(sql, works);
}

async function syncSMK(sql, offset=0) {
  // Offset-chunked: one bounded window (30 pages ≈ 3000 records) per call.
  const works = [];
  for (let o=offset; o<offset+3000; o+=100) {
    try {
      const d = await fetchJson(
        `https://api.smk.dk/api/v1/art/search?keys=*&has_image=true&offset=${o}&rows=100&filters=public_domain:true`
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

async function syncVAM(sql, offset=0) {
  // Offset-chunked: `offset` is a record offset; process 30 pages (≈3000 records) per call.
  const works = [];
  const startPage = Math.floor(offset/100) + 1;
  for (let page=startPage; page<startPage+30; page++) {
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

async function syncEuropeana(sql, key, offset=0) {
  // Offset-chunked: `offset` is a starting index into the query list; process 5 queries per call.
  if (!key) return 0;
  const works = [];
  const queries = [
    'painting','portrait','landscape','sculpture','drawing',
    'watercolor','engraving','etching','miniature','fresco',
    'tapestry','mosaic','icon','altarpiece','print'
  ];
  for (let qi = offset; qi < offset + 5 && qi < queries.length; qi++) {
    const q = queries[qi];
    for (let start = 1; start <= 1000; start += 100) {
      try {
        const url = 'https://api.europeana.eu/record/v2/search.json' +
          '?wskey=' + key +
          '&query=' + encodeURIComponent(q) +
          '&reusability=open' +
          '&media=true' +
          '&qf=TYPE:IMAGE' +
          '&rows=100' +
          '&start=' + start +
          '&profile=rich';
        const d = await fetch(url).then(r => r.json());
        if (!d.success || !d.items?.length) break;
        for (const o of d.items) {
          const previewArr = Array.isArray(o.edmPreview) ? o.edmPreview : (o.edmPreview ? [o.edmPreview] : []);
          const thumb = previewArr[0];
          if (!thumb) continue;
          const shownBy = Array.isArray(o.edmIsShownBy) ? o.edmIsShownBy[0] : o.edmIsShownBy;
          const recId = (o.id || '').replace(/^\//, '');
          const provider = Array.isArray(o.dataProvider) ? o.dataProvider[0] : (o.dataProvider || 'Europeana');
          const title = Array.isArray(o.title) ? o.title[0] : (o.title || 'Untitled');
          const cleanTitle = title.replace(/painting,\s*/gi, '').replace(/,\s*$/, '').trim() || 'Untitled';
          const artist = Array.isArray(o.dcCreator) ? o.dcCreator[0] : (o.dcCreator || '');
          const cleanArtist = artist.replace(/^#/, '').replace(/_/g, ' ').trim();
          works.push({
            source: 'Europeana — ' + provider,
            source_id: recId,
            title: cleanTitle,
            artist: cleanArtist,
            date_text: Array.isArray(o.year) ? o.year[0] : (o.year || ''),
            thumb_url: thumb,
            full_url: shownBy || thumb,
            detail_url: 'https://www.europeana.eu/en/item/' + recId,
            rights: 'https://creativecommons.org/publicdomain/zero/1.0/',
            rights_label: 'CC0 — Public Domain',
            commercial_ok: true,
            bio: Array.isArray(o.dcDescription) ? o.dcDescription[0] : (o.dcDescription || ''),
          });
        }
        await sleep(500);
        if (works.length >= 5000) break;
      } catch(e) {
        console.error('Europeana error:', e.message);
        break;
      }
    }
    if (works.length >= 5000) break;
  }
  return await upsert(sql, works);
}

async function syncSmithsonian(sql, key) {
  if (!key) return 0;
  const works = [];
  const seen = new Set();
  const units = ['nmah','nmaahc','nasm','nmnh','npg','hmsg','saam','chndm','fsg'];
  for (const unit of units) {
    try {
      const d = await fetchJson(
        `https://api.si.edu/openaccess/api/v1.0/search?unit_code=${unit}&rows=100&api_key=${key}`
      );
      const rows = d.response?.rows||[];
      for (const o of rows) {
        if (seen.has(o.id)) continue;
        const allMedia = o.content?.descriptiveNonRepeating?.online_media?.media||[];
        const media = allMedia.find(m => m?.thumbnail);
        if (!media) continue;
        seen.add(o.id);
        works.push({ source:'Smithsonian Institution', source_id:o.id,
          title:o.title||'Untitled', artist:o.content?.freetext?.name?.[0]?.content||'',
          date_text:o.content?.freetext?.date?.[0]?.content||'',
          medium:o.content?.freetext?.physicalDescription?.[0]?.content||'',
          thumb_url:media.thumbnail, full_url:media.content||'',
          detail_url:o.content?.descriptiveNonRepeating?.record_link||'', bio:'' });
      }
      await sleep(300);
    } catch(e) {}
  }
  return upsert(sql,works);
}

async function syncHarvard(sql) {
  // Fogg Art Museum (Q847508) — Harvard's primary collection, 271 items in Wikidata
  return syncWikidataMuseum(sql, 'Q847508', 'Harvard Art Museums');
}

async function syncInternetArchive(sql, offset=0) {
  // Offset-chunked: `offset` is a starting index into the query list; process 2 queries per call.
  const works = [];
  const seen = new Set();
  const queries = [
    'subject:(painting) AND mediatype:image',
    'subject:(drawing) AND mediatype:image',
    'subject:(portrait) AND mediatype:image',
    'subject:(landscape painting) AND mediatype:image',
    'subject:(watercolor) AND mediatype:image',
    'subject:(engraving) AND mediatype:image',
    'subject:(etching) AND mediatype:image',
    'subject:(illustration) AND mediatype:image',
  ];
  for (let qi = offset; qi < offset + 2 && qi < queries.length; qi++) {
    const q = queries[qi];
    for (let page = 0; page < 5; page++) {
      try {
        const url = 'https://archive.org/advancedsearch.php?q=' +
          encodeURIComponent(q) +
          '&fl[]=identifier,title,creator,date,description,licenseurl' +
          '&rows=200&page=' + (page + 1) + '&output=json&save=yes';
        const d = await fetchJson(url);
        const items = d.response?.docs || [];
        if (!items.length) break;
        for (const o of items) {
          const id = o.identifier;
          if (!id || seen.has(id)) continue;
          seen.add(id);
          const thumb = `https://archive.org/services/img/${id}`;
          const detail = `https://archive.org/details/${id}`;
          const license = Array.isArray(o.licenseurl) ? o.licenseurl[0] : (o.licenseurl || '');
          const title = Array.isArray(o.title) ? o.title[0] : (o.title || 'Untitled');
          const artist = Array.isArray(o.creator) ? o.creator[0] : (o.creator || '');
          const dateText = Array.isArray(o.date) ? o.date[0] : (o.date || '');
          const bio = Array.isArray(o.description) ? o.description[0] : (o.description || '');
          works.push({
            source: 'Internet Archive',
            source_id: id,
            title,
            artist,
            date_text: dateText,
            thumb_url: thumb,
            full_url: thumb,
            detail_url: detail,
            rights: license || 'https://creativecommons.org/publicdomain/mark/1.0/',
            rights_label: 'Public Domain',
            commercial_ok: true,
            bio,
          });
        }
        await sleep(500);
        if (works.length >= 5000) break;
      } catch(e) { break; }
    }
    if (works.length >= 5000) break;
  }
  return upsert(sql, works);
}

async function syncWikidataGlobal(sql, offset = 0) {
  const works = [];
  const sparql = `
    SELECT ?item ?itemLabel ?image ?creatorLabel ?inception WHERE {
      ?item wdt:P18 ?image .
      ?item wdt:P31 wd:Q3305213 .
      OPTIONAL { ?item wdt:P170 ?creator }
      OPTIONAL { ?item wdt:P571 ?inception }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "en" }
    }
    LIMIT 3000
    OFFSET ${offset}
  `;
  try {
    const url = 'https://query.wikidata.org/sparql?query=' + encodeURIComponent(sparql);
    const d = await fetch(url, {
      headers: {
        'Accept': 'application/sparql-results+json',
        'User-Agent': 'PublicArtCollections/1.0 (https://pac-final.vercel.app)'
      }
    }).then(r => r.json());
    const bindings = d.results?.bindings || [];
    for (const b of bindings) {
      const img = b.image?.value;
      if (!img) continue;
      works.push({
        source: 'Wikidata Global',
        source_id: b.item?.value?.split('/').pop(),
        title: b.itemLabel?.value || 'Untitled',
        artist: b.creatorLabel?.value || '',
        date_text: b.inception?.value?.slice(0,4) || '',
        thumb_url: img.replace('http://', 'https://'),
        full_url: img.replace('http://', 'https://'),
        detail_url: b.item?.value || '',
        rights: 'https://creativecommons.org/publicdomain/zero/1.0/',
        rights_label: 'CC0 — Public Domain',
        commercial_ok: true,
      });
    }
    await sleep(1000);
  } catch(e) { console.error('Wikidata global error:', e.message); }
  return await upsert(sql, works);
}

// Single bounded window per call (LIMIT 5000 OFFSET offset). Offset-chunked like
// syncWikidataGlobal: one call = one query, so it never approaches the 300s limit.
// Museum P195 collections are almost always < 5000 items, so offset=0 captures all;
// larger ones are covered by additional cron calls at offset 5000, 10000, ...
async function syncWikidataMuseum(sql, qid, sourceName, offset=0) {
  const works = [];
  const seen = new Set();
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
      LIMIT 5000 OFFSET ${offset}
    `;
    const d = await fetchJson(
      `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(query)}`
    );
    const bindings = d.results?.bindings||[];
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
  } catch(e) {}
  return upsert(sql, works);
}

async function syncMia(sql) {
  // Minneapolis Institute of Art — free keyless JSON search API
  const works = [];
  const seen = new Set();
  const terms = ['painting','drawing','watercolor','print','portrait','landscape'];
  for (const term of terms) {
    for (let page=1; page<=10; page++) {
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

async function syncLOC(sql, offset=0) {
  // Offset-chunked: `offset` is a starting index into the term list; process 2 terms per call.
  const works = [];
  const seen = new Set();
  const terms = ['painting','portrait','landscape','drawing','print'];
  for (let ti=offset; ti<offset+2 && ti<terms.length; ti++) {
    const q = terms[ti];
    for (let page=1; page<=20; page++) {
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

async function syncBnF(sql, offset=0) {
  // Offset-chunked: `offset` is a startRecord value (1-based); process 20 pages (≈1000 records) per call.
  const works = [];
  const seen = new Set();
  const start0 = offset || 1;
  for (let start=start0; start<start0+1000; start+=50) {
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
  const token = process.env.NYPL_TOKEN;
  if (!token) return 0;
  const works = [];
  const seen = new Set();
  const terms = ['painting','photograph','drawing','print','illustration'];
  for (const q of terms) {
    for (let page=1; page<=10; page++) {
      try {
        const res = await fetch(
          `https://api.repo.nypl.org/api/v2/items/search.json?q=${encodeURIComponent(q)}&per_page=100&page=${page}&publicDomainOnly=true`,
          { headers: { 'Authorization': `Token token="${token}"`, 'Accept': 'application/json', 'User-Agent': 'PublicArtCollections/1.0' } }
        );
        if (!res.ok) break;
        const d = await res.json();
        const items = d.nyplAPI?.response?.result || [];
        if (!items.length) break;
        for (const o of items) {
          const uuid = o.uuid || o.id;
          if (!uuid || seen.has(uuid)) continue;
          seen.add(uuid);
          const captures = o.captures || [];
          const capture = captures.find(c => c.imageLinks) || captures[0];
          const imgLinks = capture?.imageLinks?.imageLink || [];
          const links = Array.isArray(imgLinks) ? imgLinks : [imgLinks];
          const thumb = links.find(u => typeof u === 'string' && u.includes('t=w')) || links[0];
          const full  = links.find(u => typeof u === 'string' && u.includes('t=g')) || links[links.length-1] || thumb;
          if (!thumb) continue;
          works.push({
            source: 'NYPL', source_id: uuid,
            title: Array.isArray(o.title) ? o.title[0] : (o.title || 'Untitled'),
            artist: Array.isArray(o.name) ? o.name[0] : (o.name || ''),
            date_text: Array.isArray(o.date) ? o.date[0] : (o.date || ''),
            medium: Array.isArray(o.typeOfResource) ? o.typeOfResource[0] : (o.typeOfResource || ''),
            thumb_url: thumb, full_url: full || thumb,
            detail_url: o.itemLink || '',
            bio: Array.isArray(o.note) ? o.note[0] : (o.note || '')
          });
        }
        await sleep(300);
      } catch(e) { break; }
    }
  }
  return await upsert(sql, works);
}

async function syncWikimedia(sql) {
  // Uses MediaWiki category API (not Wikidata SPARQL) with batched imageinfo requests
  const works = [];
  const seen = new Set();
  const categories = ['Public_domain_paintings', 'CC0_artworks', 'Old_Masters'];
  for (const category of categories) {
    let cmcontinue = '';
    let pages = 0;
    while (pages < 8) {
      try {
        pages++;
        const contParam = cmcontinue ? `&cmcontinue=${encodeURIComponent(cmcontinue)}` : '';
        const d = await fetchJson(
          `https://commons.wikimedia.org/w/api.php?action=query&list=categorymembers&cmtitle=Category:${encodeURIComponent(category)}&cmtype=file&cmlimit=50&format=json${contParam}`
        );
        const members = d.query?.categorymembers || [];
        if (!members.length) break;
        // Batch all 50 files in one imageinfo request
        const titleStr = members.map(m => m.title).join('|');
        const metaRes = await fetchJson(
          `https://commons.wikimedia.org/w/api.php?action=query&titles=${encodeURIComponent(titleStr)}&prop=imageinfo&iiprop=url|extmetadata|thumburl&iiurlwidth=400&format=json`
        );
        for (const pageData of Object.values(metaRes.query?.pages || {})) {
          const title = pageData.title || '';
          if (seen.has(title)) continue;
          seen.add(title);
          const ii = pageData.imageinfo?.[0];
          if (!ii?.url) continue;
          const meta = ii.extmetadata || {};
          const licenseUrl = meta.LicenseUrl?.value || '';
          if (licenseUrl && !licenseUrl.includes('creativecommons') && !licenseUrl.includes('public-domain')) continue;
          const artist = meta.Artist?.value?.replace(/<[^>]+>/g, '') || '';
          const dateStr = meta.DateTimeOriginal?.value || meta.DateTime?.value || '';
          const year = dateStr.match(/\d{4}/)?.[0] || '';
          const fileName = title.replace(/^File:/, '');
          works.push({
            source: 'Wikimedia Commons',
            source_id: title,
            title: meta.ObjectName?.value || fileName.replace(/\.[^.]+$/, '').replace(/_/g, ' '),
            artist, date_text: year, medium: meta.Medium?.value || '',
            thumb_url: ii.thumburl || ii.url,
            full_url: ii.url,
            detail_url: `https://commons.wikimedia.org/wiki/${encodeURIComponent(title)}`,
            bio: meta.ImageDescription?.value?.replace(/<[^>]+>/g, '') || '',
          });
        }
        cmcontinue = d.continue?.cmcontinue || '';
        if (!cmcontinue) break;
        await sleep(400);
      } catch(e) { break; }
    }
  }
  return upsert(sql, works);
}

async function syncTePapa(sql) {
  const key = process.env.TEPAPA_KEY;
  if (!key) return 0;
  const works = [];
  const seen = new Set();
  for (let from = 0; from < 3000; from += 100) {
    try {
      const res = await fetch('https://data.tepapa.govt.nz/collection/search', {
        method: 'POST',
        headers: {
          'x-api-key': key,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'PublicArtCollections/1.0'
        },
        body: JSON.stringify({
          query: { term: { type: 'Object' } },
          filters: [{ field: 'hasRepresentation.rights.allowsDownload', keyword: 'true' }],
          size: 100,
          from
        })
      });
      if (!res.ok) break;
      const d = await res.json();
      const results = d.results || [];
      if (!results.length) break;
      for (const o of results) {
        const id = o.id;
        if (!id || seen.has(String(id))) continue;
        const repr = (o.hasRepresentation || [])[0];
        if (!repr) continue;
        const rightsTitle = (repr.rights?.title || '').toLowerCase();
        if (!rightsTitle.includes('cc0') && !rightsTitle.includes('no known')) continue;
        const media = (repr.media || [])[0] || {};
        const thumb = repr.thumbnail || media.thumbnailUrl || '';
        const full = media.sourceUrl || media.contentUrl || '';
        if (!thumb && !full) continue;
        seen.add(String(id));
        const artist = o.production?.[0]?.contributor?.title || '';
        const dateRaw = o.productionDates?.[0]?.date?.value || o.productionDates?.[0]?.dateTo || '';
        works.push({
          source: 'Museum of New Zealand Te Papa Tongarewa',
          source_id: String(id),
          title: o.title || 'Untitled',
          artist,
          date_text: String(dateRaw || ''),
          medium: o.medium?.[0]?.value || '',
          department: '',
          thumb_url: thumb,
          full_url: full || thumb,
          detail_url: `https://collections.tepapa.govt.nz/object/${id}`,
          bio: ''
        });
      }
      await sleep(300);
    } catch(e) { break; }
  }
  return upsert(sql, works);
}

async function syncDPLA(sql, key, offset=0) {
  // Offset-chunked: `offset` is a starting index into the term list; process 2 terms per call.
  if (!key) return 0;
  const works = [];
  const seen = new Set();
  const terms = ['painting','drawing','sculpture','photograph','print','textile','watercolor','portrait','landscape','still life'];
  for (let ti=offset; ti<offset+2 && ti<terms.length; ti++) {
    const q = terms[ti];
    for (let page=1; page<=10; page++) {
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
  const offset = parseInt(req.query.offset || '0', 10) || 0;
  if (src==='met'        ||src==='all') await run('Met Museum',         () => syncMet(sql));
  if (src==='artic'      ||src==='all') await run('Art Inst. Chicago',  () => syncArtic(sql));
  if (src==='cleveland'  ||src==='all') await run('Cleveland',          () => syncCleveland(sql));
  if (src==='rijks'      ||src==='all') await run('Rijksmuseum',        () => syncRijks(sql, offset));
  if (src==='smk'        ||src==='all') await run('SMK Denmark',        () => syncSMK(sql, offset));
  if (src==='vam'        ||src==='all') await run('V&A Museum',         () => syncVAM(sql, offset));
  if (src==='europeana'  ||src==='all') await run('Europeana',          () => syncEuropeana(sql, process.env.EUROPEANA_KEY, offset));
  if (src==='smithsonian'||src==='all') await run('Smithsonian',        () => syncSmithsonian(sql, process.env.SMITHSONIAN_KEY));
  if (src==='harvard'    ||src==='all') await run('Harvard',            () => syncHarvard(sql));
  if (src==='getty'      ||src==='all') await run('Getty Museum',       () => syncWikidataMuseum(sql, 'Q1700481', 'Getty Museum'));
  if (src==='walters'    ||src==='all') await run('Walters Art Museum', () => syncWikidataMuseum(sql, 'Q210081',  'Walters Art Museum'));
  if (src==='mia'        ||src==='all') await run('Minneapolis Inst. of Art', () => syncMia(sql));
  if (src==='yale'       ||src==='all') await run('Yale Art Gallery',   () => syncWikidataMuseum(sql, 'Q1568434', 'Yale University Art Gallery', offset));
  if (src==='loc'        ||src==='all') await run('Library of Congress',() => syncLOC(sql, offset));
  if (src==='bnf'        ||src==='all') await run('BnF Gallica',        () => syncBnF(sql, offset));
  if (src==='nypl'       ||src==='all') await run('NYPL',               () => syncNYPL(sql));
  if (src==='wikimedia'  ||src==='all') await run('Wikimedia Commons',  () => syncWikimedia(sql));
  if (src==='dpla'       ||src==='all') await run('DPLA',               () => syncDPLA(sql, process.env.DPLA_KEY, offset));
  if (src==='tepapa'     ||src==='all') await run('Te Papa',            () => syncTePapa(sql));
  if (src==='louvre'     ||src==='all') await run('Louvre',             () => syncWikidataMuseum(sql, 'Q19675',   'Louvre'));
  if (src==='british'    ||src==='all') await run('British Museum',     () => syncWikidataMuseum(sql, 'Q6373',    'British Museum'));
  if (src==='national'   ||src==='all') await run('National Gallery',   () => syncWikidataMuseum(sql, 'Q180788',  'National Gallery'));
  if (src==='tate'       ||src==='all') await run('Tate',               () => syncWikidataMuseum(sql, 'Q430682',  'Tate'));
  if (src==='orsay'      ||src==='all') await run('Musée d\'Orsay',     () => syncWikidataMuseum(sql, 'Q23402',   'Musée d\'Orsay'));
  if (src==='prado'      ||src==='all') await run('Prado',              () => syncWikidataMuseum(sql, 'Q160112',  'Prado'));
  if (src==='uffizi'     ||src==='all') await run('Uffizi',             () => syncWikidataMuseum(sql, 'Q51252',   'Uffizi'));
  if (src==='hermitage'  ||src==='all') await run('Hermitage',          () => syncWikidataMuseum(sql, 'Q132783',  'Hermitage'));
  if (src==='moma'       ||src==='all') await run('MoMA',               () => syncWikidataMuseum(sql, 'Q188740',  'MoMA'));
  if (src==='rijkswiki'  ||src==='all') await run('Rijksmuseum (Wiki)', () => syncWikidataMuseum(sql, 'Q190804',  'Rijksmuseum Amsterdam', offset));
  if (src==='khm'        ||src==='all') await run('KHM Vienna',         () => syncWikidataMuseum(sql, 'Q95569',   'Kunsthistorisches Museum'));
  if (src==='cluny'      ||src==='all') await run('Musée de Cluny',     () => syncWikidataMuseum(sql, 'Q1536',    'Musée de Cluny'));
  if (src==='vawiki'     ||src==='all') await run('V&A (Wiki)',          () => syncWikidataMuseum(sql, 'Q213322',  'Victoria and Albert Museum'));
  if (src==='npm'        ||src==='all') await run('National Palace Museum', () => syncWikidataMuseum(sql, 'Q718746', 'National Palace Museum'));
  if (src==='tokyo'      ||src==='all') await run('Tokyo National Museum',  () => syncWikidataMuseum(sql, 'Q907174', 'Tokyo National Museum'));
  if (src==='saam'       ||src==='all') await run('Smithsonian American Art', () => syncWikidataMuseum(sql, 'Q1192305', 'Smithsonian American Art Museum'));
  if (src==='phila'      ||src==='all') await run('Philadelphia Museum', () => syncWikidataMuseum(sql, 'Q510324',  'Philadelphia Museum of Art'));
  if (src==='mfa'        ||src==='all') await run('Boston MFA',          () => syncWikidataMuseum(sql, 'Q49133',   'Museum of Fine Arts Boston'));
  if (src==='detroit'    ||src==='all') await run('Detroit Institute',   () => syncWikidataMuseum(sql, 'Q1201549', 'Detroit Institute of Arts'));
  if (src==='ngvic'      ||src==='all') await run('National Gallery Victoria', () => syncWikidataMuseum(sql, 'Q1416077', 'National Gallery of Victoria'));
  if (src==='auckland'   ||src==='all') await run('Auckland Art Gallery', () => syncWikidataMuseum(sql, 'Q1364777', 'Auckland Art Gallery'));
  if (src==='picassobcn' ||src==='all') await run('Museu Picasso Barcelona', () => syncWikidataMuseum(sql, 'Q861252',  'Museu Picasso Barcelona'));
  if (src==='brera'      ||src==='all') await run('Pinacoteca Brera',    () => syncWikidataMuseum(sql, 'Q46995',   'Pinacoteca di Brera'));
  if (src==='vasariano'  ||src==='all') await run('Corridoio Vasariano', () => syncWikidataMuseum(sql, 'Q51252',   'Corridoio Vasariano'));
  if (src==='pitti'      ||src==='all') await run('Palazzo Pitti',       () => syncWikidataMuseum(sql, 'Q164703',  'Palazzo Pitti'));
  if (src==='doria'      ||src==='all') await run('Galleria Doria Pamphilj', () => syncWikidataMuseum(sql, 'Q1421633', 'Galleria Doria Pamphilj'));
  if (src==='spada'      ||src==='all') await run('Galleria Spada',      () => syncWikidataMuseum(sql, 'Q1421619', 'Galleria Spada'));
  if (src==='capodimonte'||src==='all') await run('Capodimonte Naples',  () => syncWikidataMuseum(sql, 'Q1320069', 'Museo di Capodimonte'));
  if (src==='romano'     ||src==='all') await run('Museo Nazionale Romano', () => syncWikidataMuseum(sql, 'Q1378635', 'Museo Nazionale Romano'));
  if (src==='vatican'    ||src==='all') await run('Vatican Museums',     () => syncWikidataMuseum(sql, 'Q182955',  'Vatican Museums'));
  // --- Additional Wikidata-backed museums (QIDs resolved & label-verified against Wikidata) ---
  if (src==='lacma'      ||src==='all') await run('LACMA',                () => syncWikidataMuseum(sql, 'Q1641836', 'Los Angeles County Museum of Art'));
  if (src==='sfmoma'     ||src==='all') await run('SFMOMA',               () => syncWikidataMuseum(sql, 'Q913672',  'San Francisco Museum of Modern Art'));
  if (src==='guggenheim' ||src==='all') await run('Guggenheim',           () => syncWikidataMuseum(sql, 'Q201469',  'Solomon R. Guggenheim Museum'));
  if (src==='whitney'    ||src==='all') await run('Whitney',              () => syncWikidataMuseum(sql, 'Q639791',  'Whitney Museum of American Art'));
  if (src==='walker'     ||src==='all') await run('Walker Art Center',    () => syncWikidataMuseum(sql, 'Q1851516', 'Walker Art Center'));
  if (src==='carnegie'   ||src==='all') await run('Carnegie',             () => syncWikidataMuseum(sql, 'Q1043967', 'Carnegie Museum of Art'));
  if (src==='cincinnati' ||src==='all') await run('Cincinnati',           () => syncWikidataMuseum(sql, 'Q2970522', 'Cincinnati Art Museum'));
  if (src==='noma'       ||src==='all') await run('New Orleans MoA',      () => syncWikidataMuseum(sql, 'Q2063082', 'New Orleans Museum of Art'));
  if (src==='denver'     ||src==='all') await run('Denver Art Museum',    () => syncWikidataMuseum(sql, 'Q1189960', 'Denver Art Museum'));
  if (src==='seattle'    ||src==='all') await run('Seattle Art Museum',   () => syncWikidataMuseum(sql, 'Q1816301', 'Seattle Art Museum'));
  if (src==='dallas'     ||src==='all') await run('Dallas Museum of Art', () => syncWikidataMuseum(sql, 'Q745866',  'Dallas Museum of Art'));
  if (src==='houston'    ||src==='all') await run('MFA Houston',          () => syncWikidataMuseum(sql, 'Q1565911', 'Museum of Fine Arts, Houston'));
  if (src==='columbus'   ||src==='all') await run('Columbus MoA',         () => syncWikidataMuseum(sql, 'Q5935366', 'Columbus Museum of Art'));
  if (src==='indianapolis'||src==='all') await run('Indianapolis MoA',    () => syncWikidataMuseum(sql, 'Q1117704', 'Indianapolis Museum of Art'));
  if (src==='wadsworth'  ||src==='all') await run('Wadsworth Atheneum',   () => syncWikidataMuseum(sql, 'Q403080',  'Wadsworth Atheneum Museum of Art'));
  if (src==='clark'      ||src==='all') await run('Clark Art Institute',  () => syncWikidataMuseum(sql, 'Q1465805', 'Clark Art Institute'));
  if (src==='frick'      ||src==='all') await run('Frick Collection',     () => syncWikidataMuseum(sql, 'Q682827',  'The Frick Collection'));
  if (src==='morgan'     ||src==='all') await run('Morgan Library',       () => syncWikidataMuseum(sql, 'Q1478423', 'The Morgan Library & Museum'));
  if (src==='gardner'    ||src==='all') await run('Gardner Museum',       () => syncWikidataMuseum(sql, 'Q49135',   'Isabella Stewart Gardner Museum'));
  if (src==='barnes'     ||src==='all') await run('Barnes Foundation',    () => syncWikidataMuseum(sql, 'Q808462',  'Barnes Foundation'));
  if (src==='chrysler'   ||src==='all') await run('Chrysler Museum',      () => syncWikidataMuseum(sql, 'Q5114675', 'Chrysler Museum of Art'));
  if (src==='albright'   ||src==='all') await run('Buffalo AKG',          () => syncWikidataMuseum(sql, 'Q1970945', 'Buffalo AKG Art Museum'));
  if (src==='joslyn'     ||src==='all') await run('Joslyn Art Museum',    () => syncWikidataMuseum(sql, 'Q1372546', 'Joslyn Art Museum'));
  if (src==='memphis'    ||src==='all') await run('Memphis Brooks',       () => syncWikidataMuseum(sql, 'Q6815803', 'Memphis Brooks Museum of Art'));
  if (src==='birmingham' ||src==='all') await run('Birmingham MoA',       () => syncWikidataMuseum(sql, 'Q865736',  'Birmingham Museum of Art'));
  if (src==='honolulu'   ||src==='all') await run('Honolulu MoA',         () => syncWikidataMuseum(sql, 'Q128316',  'Honolulu Museum of Art'));
  if (src==='phoenix'    ||src==='all') await run('Phoenix Art Museum',   () => syncWikidataMuseum(sql, 'Q977015',  'Phoenix Art Museum'));
  if (src==='sandiego'   ||src==='all') await run('San Diego MoA',        () => syncWikidataMuseum(sql, 'Q1368166', 'San Diego Museum of Art'));
  if (src==='norton'     ||src==='all') await run('Norton Simon',         () => syncWikidataMuseum(sql, 'Q1752085', 'Norton Simon Museum'));
  if (src==='hammer'     ||src==='all') await run('Hammer Museum',        () => syncWikidataMuseum(sql, 'Q677561',  'Hammer Museum'));
  if (src==='freer'      ||src==='all') await run('Freer Gallery',        () => syncWikidataMuseum(sql, 'Q1075126', 'Freer Gallery of Art'));
  if (src==='npgdc'      ||src==='all') await run('NPG Washington',       () => syncWikidataMuseum(sql, 'Q1967614', 'National Portrait Gallery (Washington)'));
  if (src==='hirshhorn'  ||src==='all') await run('Hirshhorn',            () => syncWikidataMuseum(sql, 'Q1620553', 'Hirshhorn Museum and Sculpture Garden'));
  if (src==='kimbell'    ||src==='all') await run('Kimbell Art Museum',   () => syncWikidataMuseum(sql, 'Q1741629', 'Kimbell Art Museum'));
  if (src==='menil'      ||src==='all') await run('Menil Collection',     () => syncWikidataMuseum(sql, 'Q1888308', 'Menil Collection'));
  if (src==='blanton'    ||src==='all') await run('Blanton MoA',          () => syncWikidataMuseum(sql, 'Q2906140', 'Blanton Museum of Art'));
  if (src==='nelsonatk'  ||src==='all') await run('Nelson-Atkins',        () => syncWikidataMuseum(sql, 'Q1976985', 'Nelson-Atkins Museum of Art'));
  if (src==='dayton'     ||src==='all') await run('Dayton Art Institute', () => syncWikidataMuseum(sql, 'Q597355',  'Dayton Art Institute'));
  if (src==='toledo'     ||src==='all') await run('Toledo MoA',           () => syncWikidataMuseum(sql, 'Q1743116', 'Toledo Museum of Art'));
  if (src==='grandrapids'||src==='all') await run('Grand Rapids AM',      () => syncWikidataMuseum(sql, 'Q3412050', 'Grand Rapids Art Museum'));
  if (src==='kemper'     ||src==='all') await run('Kemper Museum',        () => syncWikidataMuseum(sql, 'Q14704420','Kemper Museum of Contemporary Art'));
  if (src==='desmoines'  ||src==='all') await run('Des Moines Art Center',() => syncWikidataMuseum(sql, 'Q5263501', 'Des Moines Art Center'));
  if (src==='gemaldegal' ||src==='all') await run('Gemäldegalerie',       () => syncWikidataMuseum(sql, 'Q165631',  'Gemäldegalerie Berlin'));
  if (src==='altepina'   ||src==='all') await run('Alte Pinakothek',      () => syncWikidataMuseum(sql, 'Q154568',  'Alte Pinakothek'));
  if (src==='stadel'     ||src==='all') await run('Städel Museum',        () => syncWikidataMuseum(sql, 'Q163804',  'Städel Museum'));
  if (src==='albertina'  ||src==='all') await run('Albertina',            () => syncWikidataMuseum(sql, 'Q371908',  'Albertina'));
  if (src==='belvedere'  ||src==='all') await run('Belvedere',            () => syncWikidataMuseum(sql, 'Q303139',  'Belvedere'));
  if (src==='reinasofia' ||src==='all') await run('Reina Sofía',          () => syncWikidataMuseum(sql, 'Q460889',  'Museo Reina Sofía'));
  if (src==='mauritshuis'||src==='all') await run('Mauritshuis',          () => syncWikidataMuseum(sql, 'Q221092',  'Mauritshuis'));
  if (src==='stedelijk'  ||src==='all') await run('Stedelijk',            () => syncWikidataMuseum(sql, 'Q924335',  'Stedelijk Museum Amsterdam'));
  if (src==='vangogh'    ||src==='all') await run('Van Gogh Museum',      () => syncWikidataMuseum(sql, 'Q224124',  'Van Gogh Museum'));
  if (src==='rodin'      ||src==='all') await run('Musée Rodin',          () => syncWikidataMuseum(sql, 'Q650519',  'Musée Rodin'));
  if (src==='pompidou'   ||src==='all') await run('Centre Pompidou',      () => syncWikidataMuseum(sql, 'Q178065',  'Centre Pompidou'));
  if (src==='royalbelg'  ||src==='all') await run('Royal Museums Belgium',() => syncWikidataMuseum(sql, 'Q377500',  'Royal Museums of Fine Arts of Belgium'));
  if (src==='ngireland'  ||src==='all') await run('Nat. Gallery Ireland', () => syncWikidataMuseum(sql, 'Q2018379', 'National Gallery of Ireland'));
  if (src==='wales'      ||src==='all') await run('National Museum Wales',() => syncWikidataMuseum(sql, 'Q1321874', 'National Museum Cardiff'));
  if (src==='scotland'   ||src==='all') await run('Nat. Galleries Scot.', () => syncWikidataMuseum(sql, 'Q2051997', 'National Galleries of Scotland'));
  if (src==='ashmolean'  ||src==='all') await run('Ashmolean',            () => syncWikidataMuseum(sql, 'Q636400',  'Ashmolean Museum'));
  if (src==='fitzwilliam'||src==='all') await run('Fitzwilliam',          () => syncWikidataMuseum(sql, 'Q1421440', 'Fitzwilliam Museum'));
  if (src==='courtauld'  ||src==='all') await run('Courtauld Gallery',    () => syncWikidataMuseum(sql, 'Q12110695','Courtauld Gallery'));
  if (src==='wallace'    ||src==='all') await run('Wallace Collection',   () => syncWikidataMuseum(sql, 'Q1327919', 'Wallace Collection'));
  if (src==='dulwich'    ||src==='all') await run('Dulwich Picture Gal.', () => syncWikidataMuseum(sql, 'Q1241163', 'Dulwich Picture Gallery'));
  if (src==='gugbilbao'  ||src==='all') await run('Guggenheim Bilbao',    () => syncWikidataMuseum(sql, 'Q179199',  'Guggenheim Museum Bilbao'));
  if (src==='norway'     ||src==='all') await run('Nasjonalmuseet',       () => syncWikidataMuseum(sql, 'Q1132918', 'Nasjonalmuseet (Norway)'));
  if (src==='nasjonalg'  ||src==='all') await run('Nat. Gallery Norway',  () => syncWikidataMuseum(sql, 'Q3330707', 'National Gallery of Norway'));
  if (src==='finland'    ||src==='all') await run('Finnish Nat. Gallery', () => syncWikidataMuseum(sql, 'Q2983474', 'Finnish National Gallery'));
  if (src==='ateneum'    ||src==='all') await run('Ateneum',              () => syncWikidataMuseum(sql, 'Q754507',  'Ateneum'));
  if (src==='moderna'    ||src==='all') await run('Moderna Museet',       () => syncWikidataMuseum(sql, 'Q1274511', 'Moderna Museet'));
  if (src==='ngcanada'   ||src==='all') await run('Nat. Gallery Canada',  () => syncWikidataMuseum(sql, 'Q1068063', 'National Gallery of Canada'));
  if (src==='montreal'   ||src==='all') await run('Montreal MFA',         () => syncWikidataMuseum(sql, 'Q860812',  'Montreal Museum of Fine Arts'));
  if (src==='vancouver'  ||src==='all') await run('Vancouver Art Gallery',() => syncWikidataMuseum(sql, 'Q371960',  'Vancouver Art Gallery'));
  if (src==='ontario'    ||src==='all') await run('Art Gallery Ontario',  () => syncWikidataMuseum(sql, 'Q670250',  'Art Gallery of Ontario'));
  if (src==='mexnac'     ||src==='all') await run('MUNAL Mexico',         () => syncWikidataMuseum(sql, 'Q1138147', 'Museo Nacional de Arte (Mexico)'));
  if (src==='fridakahlo' ||src==='all') await run('Frida Kahlo Museum',   () => syncWikidataMuseum(sql, 'Q2663377', 'Frida Kahlo Museum'));
  if (src==='colombia'   ||src==='all') await run('Museo Nac. Colombia',  () => syncWikidataMuseum(sql, 'Q671264',  'Museo Nacional de Colombia'));
  if (src==='brasil'     ||src==='all') await run('MNBA Brazil',          () => syncWikidataMuseum(sql, 'Q1954370', 'Museu Nacional de Belas Artes'));
  if (src==='pinacoteca' ||src==='all') await run('Pinacoteca SP',        () => syncWikidataMuseum(sql, 'Q2095209', 'Pinacoteca de São Paulo'));
  if (src==='malba'      ||src==='all') await run('MALBA',                () => syncWikidataMuseum(sql, 'Q1808336', 'Museo de Arte Latinoamericano de Buenos Aires'));
  if (src==='miaqatar'   ||src==='all') await run('MIA Doha',             () => syncWikidataMuseum(sql, 'Q1148353', 'Museum of Islamic Art, Doha'));
  if (src==='louvreabu'  ||src==='all') await run('Louvre Abu Dhabi',     () => syncWikidataMuseum(sql, 'Q3176133', 'Louvre Abu Dhabi'));
  if (src==='israel'     ||src==='all') await run('Israel Museum',        () => syncWikidataMuseum(sql, 'Q46815',   'Israel Museum'));
  if (src==='egyptian'   ||src==='all') await run('Egyptian Museum',      () => syncWikidataMuseum(sql, 'Q201219',  'Egyptian Museum, Cairo'));
  if (src==='topkapi'    ||src==='all') await run('Topkapı Palace',       () => syncWikidataMuseum(sql, 'Q170495',  'Topkapı Palace Museum'));
  if (src==='tretyakov'  ||src==='all') await run('Tretyakov Gallery',    () => syncWikidataMuseum(sql, 'Q183334',  'Tretyakov Gallery'));
  if (src==='pushkin'    ||src==='all') await run('Pushkin Museum',       () => syncWikidataMuseum(sql, 'Q4872',    'Pushkin Museum of Fine Arts'));
  if (src==='russian'    ||src==='all') await run('Russian Museum',       () => syncWikidataMuseum(sql, 'Q211043',  'Russian Museum'));
  if (src==='warsaw'     ||src==='all') await run('Nat. Museum Warsaw',   () => syncWikidataMuseum(sql, 'Q153306',  'National Museum in Warsaw'));
  if (src==='prague'     ||src==='all') await run('Nat. Gallery Prague',  () => syncWikidataMuseum(sql, 'Q1419555', 'National Gallery Prague'));
  if (src==='budapest'   ||src==='all') await run('MFA Budapest',         () => syncWikidataMuseum(sql, 'Q840886',  'Museum of Fine Arts, Budapest'));
  if (src==='palace'     ||src==='all') await run('Palace Museum',        () => syncWikidataMuseum(sql, 'Q2047427', 'Palace Museum (Forbidden City)'));
  if (src==='shanghai'   ||src==='all') await run('Shanghai Museum',      () => syncWikidataMuseum(sql, 'Q1051293', 'Shanghai Museum'));
  if (src==='korea'      ||src==='all') await run('Nat. Museum Korea',    () => syncWikidataMuseum(sql, 'Q494407',  'National Museum of Korea'));
  if (src==='australia'  ||src==='all') await run('Nat. Gallery Aus.',    () => syncWikidataMuseum(sql, 'Q795228',  'National Gallery of Australia'));
  if (src==='agnsw'      ||src==='all') await run('AGNSW',                () => syncWikidataMuseum(sql, 'Q705551',  'Art Gallery of New South Wales'));
  if (src==='safrica'    ||src==='all') await run('South African Nat.Gal',() => syncWikidataMuseum(sql, 'Q1419469', 'South African National Gallery'));
  // NOTE: 'india' (National Museum, New Delhi) and 'nigeria' (National Museum, Lagos) intentionally
  // NOT added. Candidate QIDs failed label verification against Wikidata:
  //   india Q1341873 -> "Semion Braude" (astronomer, 0 artworks); nigeria Q1068388 -> "Zeta Ophiuchi" (star, 0 artworks).
  // Add real museum QIDs (verified P195 collections with P18 images) once confirmed.
  if (src==='internetarchive'||src==='all') await run('Internet Archive', () => syncInternetArchive(sql, offset));
  if (src==='wikidataglobal') await run(`Wikidata Global (offset ${offset})`, () => syncWikidataGlobal(sql, offset));
  const countRows = await sql`SELECT COUNT(*) as total FROM artworks`;
  return res.status(200).json({ success:true, newWorks:total, totalInDb:parseInt(countRows[0].total), log });
}

export const config = { maxDuration: 300 };
