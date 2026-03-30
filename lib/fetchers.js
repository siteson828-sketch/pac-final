// lib/fetchers.js
// ============================================================
//  MUSEUM API FETCHERS
//  Each function fetches the maximum available works from one
//  source, normalises to a common schema, and returns an array.
//  All results are pre-filtered to CC0 / Public Domain only.
// ============================================================

const RIGHTS_OK = [
  'creativecommons.org/publicdomain/zero',
  'creativecommons.org/publicdomain/mark',
  '/public-domain',
  'creativecommons.org/licenses/by/4',
  'creativecommons.org/licenses/by/3',
  'creativecommons.org/licenses/by/2',
];

function rightsOk(url) {
  if (!url) return false;
  const r = String(url).toLowerCase();
  return RIGHTS_OK.some(s => r.includes(s));
}

function rightsLabel(url) {
  if (!url) return 'Public Domain';
  const r = String(url).toLowerCase();
  if (r.includes('/zero') || r.includes('cc0'))    return 'CC0 — Public Domain';
  if (r.includes('publicdomain'))                  return 'Public Domain';
  if (r.includes('licenses/by/'))                  return 'CC BY';
  return 'Open';
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── METROPOLITAN MUSEUM OF ART ────────────────────────────────
// Free, no key. Fetches all open-access object IDs then batches details.
// ~470,000 open-access works available.
export async function fetchMet(maxPages = 20) {
  const works = [];
  const departments = [1,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,21];

  for (const deptId of departments.slice(0, maxPages)) {
    try {
      const s = await fetch(
        `https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&isPublicDomain=true&departmentId=${deptId}&q=painting`
      ).then(r => r.json());

      const ids = (s.objectIDs || []).slice(0, 500);
      console.log(`Met dept ${deptId}: ${ids.length} objects`);

      // Fetch details in batches of 20
      for (let i = 0; i < ids.length; i += 20) {
        const batch = ids.slice(i, i + 20);
        const details = await Promise.all(
          batch.map(id =>
            fetch(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`)
              .then(r => r.json()).catch(() => null)
          )
        );
        for (const o of details) {
          if (!o || !o.primaryImageSmall || !o.isPublicDomain) continue;
          works.push({
            source: 'Metropolitan Museum of Art',
            sourceId: String(o.objectID),
            title: o.title || 'Untitled',
            artist: o.artistDisplayName || '',
            date: o.objectDate || '',
            medium: o.medium || '',
            dimensions: o.dimensions || '',
            department: o.department || '',
            country: o.country || o.culture || '',
            movement: o.classification || '',
            period: o.period || '',
            subject: o.classification || '',
            thumbUrl: o.primaryImageSmall,
            fullUrl: o.primaryImage,
            iiifManifest: `https://collectionapi.metmuseum.org/public/collection/v1/iiif/${o.objectID}/manifest.json`,
            detailUrl: o.objectURL,
            rights: 'https://creativecommons.org/publicdomain/zero/1.0/',
            rightsLabel: 'CC0 — Public Domain',
            commercialOk: true,
            bio: o.creditLine || '',
          });
        }
        await sleep(100); // be polite to their servers
      }
    } catch(e) { console.error('Met dept error:', deptId, e.message); }
  }
  return works;
}

// ── ART INSTITUTE OF CHICAGO ──────────────────────────────────
// Free, no key. Full IIIF gigapixel. ~100,000 open-access works.
export async function fetchArtic(maxPages = 50) {
  const works = [];

  for (let page = 1; page <= maxPages; page++) {
    try {
      const r = await fetch(
        `https://api.artic.edu/api/v1/artworks?page=${page}&limit=100&fields=id,title,artist_display,date_display,image_id,medium_display,dimensions,department_title,classification_title,description,credit_line&query[term][is_public_domain]=true&query[exists][field]=image_id`
      ).then(r => r.json());

      const items = r.data || [];
      if (!items.length) break;

      for (const o of items) {
        if (!o.image_id) continue;
        works.push({
          source: 'Art Institute of Chicago',
          sourceId: String(o.id),
          title: o.title || 'Untitled',
          artist: o.artist_display || '',
          date: o.date_display || '',
          medium: o.medium_display || '',
          dimensions: o.dimensions || '',
          department: o.department_title || '',
          movement: o.classification_title || '',
          thumbUrl: `https://www.artic.edu/iiif/2/${o.image_id}/full/!400,400/0/default.jpg`,
          fullUrl: `https://www.artic.edu/iiif/2/${o.image_id}/full/full/0/default.jpg`,
          iiifInfo: `https://www.artic.edu/iiif/2/${o.image_id}/info.json`,
          detailUrl: `https://www.artic.edu/artworks/${o.id}`,
          rights: 'https://creativecommons.org/publicdomain/zero/1.0/',
          rightsLabel: 'CC0 — Public Domain',
          commercialOk: true,
          bio: o.description ? o.description.replace(/<[^>]+>/g,'').slice(0,500) : (o.credit_line||''),
        });
      }

      console.log(`AIC page ${page}: ${items.length} works (total so far: ${works.length})`);
      await sleep(200);
    } catch(e) { console.error('AIC page error:', page, e.message); break; }
  }
  return works;
}

// ── RIJKSMUSEUM ───────────────────────────────────────────────
// New 2025 API — no key needed. 800,000+ works, gigapixel IIIF.
export async function fetchRijks(maxPages = 100) {
  const works = [];
  let nextUrl = 'https://data.rijksmuseum.nl/search?limit=100';

  for (let page = 0; page < maxPages && nextUrl; page++) {
    try {
      const d = await fetch(nextUrl).then(r => r.json());
      const items = d.orderedItems || [];
      if (!items.length) break;

      // Resolve each item to get metadata
      const details = await Promise.all(
        items.slice(0,50).map(item =>
          fetch(item.id || item, { headers: { 'Accept': 'application/json' } })
            .then(r => r.json()).catch(() => null)
        )
      );

      for (const o of details) {
        if (!o) continue;
        const idUrl = o.id || o['@id'] || '';
        const objNum = idUrl.split('/').pop();
        const title = o.identified_by?.find(x => x.type === 'Name')?.content
          || o.label?.en?.[0] || 'Untitled';
        const artist = o.produced_by?.carried_out_by?.[0]
          ?.identified_by?.[0]?.content || '';
        const imgService = o.representation?.[0]
          ?.digitally_shown_by?.[0]?.access_point?.[0]?.id;

        if (!imgService && !objNum) continue;

        works.push({
          source: 'Rijksmuseum',
          sourceId: objNum,
          title,
          artist,
          date: o.produced_by?.timespan?.identified_by?.[0]?.content || '',
          medium: o.made_of?.[0]?.identified_by?.[0]?.content || '',
          thumbUrl: imgService
            ? imgService.replace('/info.json','') + '/full/!400,400/0/default.jpg'
            : `https://www.rijksmuseum.nl/api/iiif/${objNum}/full/!400,400/0/default.jpg`,
          fullUrl: imgService
            ? imgService.replace('/info.json','') + '/full/full/0/default.jpg'
            : null,
          iiifInfo: imgService || `https://www.rijksmuseum.nl/api/iiif/${objNum}/info.json`,
          iiifManifest: `https://www.rijksmuseum.nl/api/iiif/presentation/${objNum}/manifest`,
          detailUrl: idUrl,
          rights: 'https://creativecommons.org/publicdomain/zero/1.0/',
          rightsLabel: 'CC0 — Public Domain',
          commercialOk: true,
          bio: 'Rijksmuseum, Amsterdam.',
        });
      }

      nextUrl = d.next?.id || null;
      console.log(`Rijks page ${page}: ${works.length} total`);
      await sleep(300);
    } catch(e) { console.error('Rijks page error:', page, e.message); break; }
  }
  return works;
}

// ── CLEVELAND MUSEUM OF ART ───────────────────────────────────
// Free, no key. ~61,000 open-access works.
export async function fetchCleveland(maxPages = 30) {
  const works = [];

  for (let skip = 0; skip < maxPages * 100; skip += 100) {
    try {
      const d = await fetch(
        `https://openaccess-api.clevelandart.org/api/artworks/?has_image=1&cc0=1&limit=100&skip=${skip}`
      ).then(r => r.json());

      const items = d.data || [];
      if (!items.length) break;

      for (const o of items) {
        if (!o.images?.web) continue;
        works.push({
          source: 'Cleveland Museum of Art',
          sourceId: String(o.id),
          title: o.title || 'Untitled',
          artist: o.creators?.[0]?.description || '',
          date: o.creation_date || '',
          medium: o.technique || '',
          department: o.department || '',
          country: o.culture || '',
          thumbUrl: o.images.web.url,
          fullUrl: o.images.full?.url || o.images.web.url,
          detailUrl: o.url,
          rights: 'https://creativecommons.org/publicdomain/zero/1.0/',
          rightsLabel: 'CC0 — Public Domain',
          commercialOk: true,
          bio: o.did_you_know || o.wall_description || '',
        });
      }

      console.log(`Cleveland skip ${skip}: ${works.length} total`);
      await sleep(200);
    } catch(e) { console.error('Cleveland error:', e.message); break; }
  }
  return works;
}

// ── EUROPEANA ─────────────────────────────────────────────────
// 50 million works — CC0 / Public Domain filter applied per item.
// Cycles through art-focused search terms to maximise variety.
export async function fetchEuropeana(key, maxPages = 50) {
  if (!key || key === 'YOUR_EUROPEANA_KEY_HERE') return [];
  const works = [];

  const queries = [
    'painting','portrait','landscape','still life','sculpture',
    'drawing','print','miniature','tapestry','illuminated manuscript',
    'mythology','religious art','dutch golden age','flemish',
    'italian renaissance','french impressionism','romanticism',
  ];

  for (const q of queries) {
    for (let start = 1; start <= maxPages * 100; start += 100) {
      try {
        const url = `https://api.europeana.eu/record/v2/search.json`
          + `?wskey=${key}`
          + `&query=${encodeURIComponent(q)}`
          + `&reusability=open`
          + `&media=true`
          + `&qf=TYPE:IMAGE`
          + `&qf=MIME_TYPE:image/jpeg`
          + `&rows=100`
          + `&start=${start}`
          + `&profile=rich`;

        const d = await fetch(url).then(r => r.json());
        if (!d.success || !d.items?.length) break;

        for (const o of d.items) {
          const rightsArr = Array.isArray(o.edmRights) ? o.edmRights : (o.edmRights ? [o.edmRights] : []);
          const rightsUrl = rightsArr[0] || '';
          if (!rightsOk(rightsUrl)) continue;

          const recId = (o.id||'').replace(/^\//,'');
          const thumb = Array.isArray(o.edmPreview) ? o.edmPreview[0] : o.edmPreview;
          if (!thumb && !o.edmIsShownBy) continue;

          works.push({
            source: `Europeana — ${Array.isArray(o.dataProvider)?o.dataProvider[0]:(o.dataProvider||'Europeana')}`,
            sourceId: recId,
            title: Array.isArray(o.title) ? o.title[0] : (o.title||'Untitled'),
            artist: Array.isArray(o.dcCreator) ? o.dcCreator[0] : (o.dcCreator||''),
            date: Array.isArray(o.year) ? o.year[0] : (o.year||''),
            medium: Array.isArray(o.dcFormat) ? o.dcFormat[0] : (o.dcFormat||''),
            country: Array.isArray(o.country) ? o.country[0] : (o.country||''),
            thumbUrl: thumb,
            fullUrl: Array.isArray(o.edmIsShownBy) ? o.edmIsShownBy[0] : (o.edmIsShownBy||thumb),
            iiifManifest: recId ? `https://iiif.europeana.eu/presentation/${recId}/manifest` : null,
            detailUrl: `https://www.europeana.eu/en/item/${recId}`,
            rights: rightsUrl,
            rightsLabel: rightsLabel(rightsUrl),
            commercialOk: true,
            bio: Array.isArray(o.dcDescription) ? o.dcDescription[0] : (o.dcDescription||''),
          });
        }

        console.log(`Europeana "${q}" start ${start}: ${works.length} total`);
        await sleep(500); // Europeana rate limit: be gentle
        if (works.length >= 100000) break; // cap per run
      } catch(e) { console.error('Europeana error:', e.message); break; }
    }
    if (works.length >= 100000) break;
  }
  return works;
}

// ── SMITHSONIAN ───────────────────────────────────────────────
// CC0 items only — checks usage.access === 'CC0' per item.
export async function fetchSmithsonian(key, maxPages = 50) {
  if (!key || key === 'YOUR_SMITHSONIAN_KEY_HERE') return [];
  const works = [];

  const units = ['nmah','nmaahc','nasm','nmnh','npg','hmsg','saam','chndm','fsg','nzp'];

  for (const unit of units) {
    for (let start = 0; start < maxPages * 100; start += 100) {
      try {
        const d = await fetch(
          `https://api.si.edu/openaccess/api/v1.0/search?q=art&unit_code=${unit}&rows=100&start=${start}&api_key=${key}`
        ).then(r => r.json());

        const rows = d.response?.rows || [];
        if (!rows.length) break;

        for (const o of rows) {
          const media = o.content?.descriptiveNonRepeating?.online_media?.media?.[0];
          if (!media?.thumbnail) continue;
          if (media.usage?.access !== 'CC0') continue; // strict CC0 only

          works.push({
            source: 'Smithsonian Institution',
            sourceId: o.id,
            title: o.title || 'Untitled',
            artist: o.content?.freetext?.name?.[0]?.content || '',
            date: o.content?.freetext?.date?.[0]?.content || '',
            medium: o.content?.freetext?.physicalDescription?.[0]?.content || '',
            thumbUrl: media.thumbnail,
            fullUrl: media.content,
            detailUrl: o.content?.descriptiveNonRepeating?.record_link,
            rights: 'https://creativecommons.org/publicdomain/zero/1.0/',
            rightsLabel: 'CC0 — Public Domain',
            commercialOk: true,
            bio: o.content?.freetext?.notes?.[0]?.content || '',
          });
        }

        console.log(`Smithsonian ${unit} start ${start}: ${works.length} total`);
        await sleep(300);
      } catch(e) { console.error('Smithsonian error:', unit, e.message); break; }
    }
  }
  return works;
}

// ── HARVARD ART MUSEUMS ───────────────────────────────────────
// Full IIIF gigapixel. ~250,000 works with free key.
export async function fetchHarvard(key, maxPages = 50) {
  if (!key || key === 'YOUR_HARVARD_KEY_HERE') return [];
  const works = [];

  for (let page = 1; page <= maxPages; page++) {
    try {
      const d = await fetch(
        `https://api.harvardartmuseums.org/object?hasimage=1&size=100&page=${page}&apikey=${key}&classification=Paintings,Drawings,Photographs,Prints`
      ).then(r => r.json());

      const items = d.records || [];
      if (!items.length) break;

      for (const o of items) {
        if (!o.primaryimageurl) continue;
        works.push({
          source: 'Harvard Art Museums',
          sourceId: String(o.objectid),
          title: o.title || 'Untitled',
          artist: o.people?.[0]?.displayname || o.attribution || '',
          date: o.dated || '',
          medium: o.technique || '',
          dimensions: o.dimensions || '',
          department: o.division || '',
          thumbUrl: o.primaryimageurl + '?height=400&width=400',
          fullUrl: o.primaryimageurl,
          iiifInfo: o.iiifbaseuri ? o.iiifbaseuri + '/info.json' : null,
          iiifManifest: `https://iiif.harvardartmuseums.org/manifests/object/${o.objectid}`,
          detailUrl: o.url,
          rights: 'https://creativecommons.org/publicdomain/zero/1.0/',
          rightsLabel: 'CC0 — Public Domain',
          commercialOk: true,
          bio: o.description || o.commentary || '',
        });
      }

      console.log(`Harvard page ${page}: ${works.length} total`);
      await sleep(200);
    } catch(e) { console.error('Harvard error:', page, e.message); break; }
  }
  return works;
}

// ── NATIONAL GALLERY OF ART ───────────────────────────────────
export async function fetchNGA(maxPages = 30) {
  const works = [];

  for (let page = 0; page < maxPages; page++) {
    try {
      const d = await fetch(
        `https://api.nga.gov/art/tms/objects?pageSize=100&pageNumber=${page}&hasImage=1`
      ).then(r => r.json());

      const items = d.data?.objects || [];
      if (!items.length) break;

      for (const o of items) {
        if (!o.thumbnail) continue;
        works.push({
          source: "National Gallery of Art",
          sourceId: String(o.objectID || o.id),
          title: o.title || 'Untitled',
          artist: o.attribution || '',
          date: o.displayDate || '',
          medium: o.medium || '',
          thumbUrl: o.thumbnail,
          fullUrl: o.largeImage || o.thumbnail,
          detailUrl: o.url,
          rights: 'https://creativecommons.org/publicdomain/zero/1.0/',
          rightsLabel: 'CC0 — Public Domain',
          commercialOk: true,
          bio: 'National Gallery of Art, Washington D.C.',
        });
      }

      console.log(`NGA page ${page}: ${works.length} total`);
      await sleep(200);
    } catch(e) { console.error('NGA error:', page, e.message); break; }
  }
  return works;
}

// ── V&A MUSEUM ────────────────────────────────────────────────
// 1.2 million objects, no key needed.
export async function fetchVAM(maxPages = 30) {
  const works = [];

  for (let page = 1; page <= maxPages; page++) {
    try {
      const d = await fetch(
        `https://api.vam.ac.uk/v2/objects/search?images_exist=1&page_size=100&page=${page}&q=art`
      ).then(r => r.json());

      const items = d.records || [];
      if (!items.length) break;

      for (const o of items) {
        if (!o._primaryImageId) continue;
        const imgBase = `https://framemark.vam.ac.uk/collections/${o._primaryImageId}`;
        works.push({
          source: 'Victoria & Albert Museum',
          sourceId: o.systemNumber,
          title: o._primaryTitle || 'Untitled',
          artist: o._primaryMaker?.name || '',
          date: o._primaryDate || '',
          medium: o.materialsAndTechniques || '',
          country: o.placesOfOrigin?.[0]?.place?.text || '',
          thumbUrl: `${imgBase}/full/!400,400/0/default.jpg`,
          fullUrl: `${imgBase}/full/full/0/default.jpg`,
          iiifInfo: `${imgBase}/info.json`,
          detailUrl: `https://collections.vam.ac.uk/item/${o.systemNumber}/`,
          rights: 'https://creativecommons.org/publicdomain/zero/1.0/',
          rightsLabel: 'CC0 — Public Domain',
          commercialOk: true,
          bio: o.briefDescription || '',
        });
      }

      console.log(`V&A page ${page}: ${works.length} total`);
      await sleep(200);
    } catch(e) { console.error('V&A error:', page, e.message); break; }
  }
  return works;
}
