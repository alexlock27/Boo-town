// tools/sfx-source.mjs — RUN21H B2: find licence-clean animal/world sounds.
//
// Local tooling, NOT shipped (never in sw.js ASSETS). Searches Wikimedia Commons for audio
// files by SCIENTIFIC NAME, reads each file's licence out of the API's own extmetadata, and
// keeps ONLY files licensed CC0 or public domain. Protected core §5 is not a judgement call:
// a file whose licence this tool cannot read is never a candidate.
//
//   node tools/sfx-source.mjs survey          # candidates per sound, cheapest first
//   node tools/sfx-source.mjs meta <File:…>   # full metadata for one file
//
// Three lessons already paid for, all encoded below:
//   * Plain-English search is useless — "duck quack" returns DuckDuckGo, "cow moo" returns
//     a Korean president. Scientific names ("Anas platyrhynchos") hit the real recordings,
//     because that is how Commons files their audio.
//   * The category names you would guess ("Cattle sounds", "Dog sounds") mostly do not
//     exist; the real tree is Audio files of animal sounds > by species.
//   * The API rate-limits hard (429, and a non-JSON scolding) at about one request a
//     second, so every call is throttled with backoff and metadata is fetched 40 titles at
//     a time rather than one per file.
//
// Why Commons rather than the pack's first-named Pixabay: Pixabay answers programmatic
// requests with 403 (bot protection) from this machine, and Commons exposes the licence as
// structured data, which is stronger evidence than a scraped page. Both are permitted by
// the pack — "Pixabay … or a verified-CC0 source ONLY".

const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'BooTownSfxSourcing/1.0 (offline educational PWA; licence-verification tooling)';

const OK_LICENCE = /^(cc0|public domain|pd(-|$)|cc-zero)/i;
const OK_TERMS = /(creative commons zero|public domain|cc0)/i;

export const WANTED = [
  { id: 'cow',      q: 'Bos taurus' },
  { id: 'cat',      q: 'Felis catus' },
  { id: 'dog',      q: 'Canis lupus familiaris bark' },
  { id: 'duck',     q: 'Anas platyrhynchos' },
  { id: 'sheep',    q: 'Ovis aries' },
  { id: 'owl',      q: 'Strix aluco' },
  { id: 'bee',      q: 'Bombus' },
  { id: 'frog',     q: 'Rana temporaria' },
  { id: 'lion',     q: 'Panthera leo' },
  { id: 'horse',    q: 'Equus caballus' },
  { id: 'pig',      q: 'Sus scrofa domesticus' },
  { id: 'rooster',  q: 'Gallus gallus domesticus' },
  { id: 'goat',     q: 'Capra hircus' },
  { id: 'blackbird', q: 'Turdus merula' },
  { id: 'robin',    q: 'Erithacus rubecula' },
  { id: 'cuckoo',   q: 'Cuculus canorus' },
  { id: 'seagull',  q: 'Larus argentatus' },
  { id: 'thunder',  q: 'thunder storm recording' },
  { id: 'rain',     q: 'Sounds of rain' },
  { id: 'bell',     q: 'church bell recording' }
];

let last = 0;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function api(params, tries = 5) {
  for (let i = 0; i < tries; i++) {
    const wait = Math.max(0, 1600 - (Date.now() - last));
    if (wait) await sleep(wait);
    last = Date.now();
    const url = API + '?' + new URLSearchParams({ format: 'json', formatversion: '2', ...params });
    let r;
    try { r = await fetch(url, { headers: { 'User-Agent': UA } }); } catch { await sleep(2000); continue; }
    if (r.status === 429) { await sleep(4000 * (i + 1)); continue; }
    if (!r.ok) { await sleep(1500); continue; }
    const text = await r.text();
    if (!text.startsWith('{')) { await sleep(4000 * (i + 1)); continue; }   // "too many requests" prose
    return JSON.parse(text);
  }
  return null;
}

// One search -> file titles. `filetype:audio` keeps it to recordings.
async function searchFiles(q, limit = 40) {
  const j = await api({ action: 'query', list: 'search', srsearch: `${q} filetype:audio`, srnamespace: '6', srlimit: String(limit) });
  return j && j.query ? j.query.search.map(s => s.title) : [];
}

// Licence + size for up to 40 titles in ONE request.
export async function metaFor(titles) {
  const out = [];
  for (let i = 0; i < titles.length; i += 40) {
    const j = await api({ action: 'query', titles: titles.slice(i, i + 40).join('|'), prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata' });
    if (!j || !j.query) continue;
    for (const p of j.query.pages || []) {
      const ii = (p.imageinfo || [])[0]; if (!ii) continue;
      const em = ii.extmetadata || {};
      const val = (k) => (em[k] && em[k].value != null ? String(em[k].value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '');
      const short = val('LicenseShortName'), lic = val('License'), terms = val('UsageTerms');
      out.push({
        title: p.title, url: ii.url, mime: ii.mime, bytes: ii.size,
        licence: short || lic, usageTerms: terms, artist: val('Artist'),
        credit: val('Credit'), descUrl: ii.descriptionurl, desc: val('ImageDescription').slice(0, 160),
        clean: OK_LICENCE.test(short) || OK_LICENCE.test(lic) || OK_TERMS.test(terms)
      });
    }
  }
  return out;
}

const cmd = process.argv[2] || 'survey';

if (cmd === 'meta') {
  console.log(JSON.stringify(await metaFor([process.argv[3]]), null, 2));
} else {
  const report = {};
  for (const w of WANTED) {
    const titles = await searchFiles(w.q);
    const rows = (await metaFor(titles))
      .filter(r => r.clean)
      // Already-compressed only: there is no encoder on this box, so an uncompressed WAV
      // could never fit the 1.5 MB budget.
      .filter(r => /ogg|opus|mpeg/i.test(r.mime || ''))
      .filter(r => (r.bytes || 0) > 3000 && (r.bytes || 0) < 500000)
      .sort((a, b) => (a.bytes || 0) - (b.bytes || 0));
    report[w.id] = rows;
    console.log(`\n### ${w.id}  (${w.q}) — ${titles.length} audio hits, ${rows.length} licence-clean`);
    for (const r of rows.slice(0, 8)) {
      console.log(`  ${String(Math.round((r.bytes || 0) / 1024)).padStart(5)}KB ${(r.licence || '').padEnd(16)} ${r.title}`);
    }
  }
  const { writeFileSync } = await import('node:fs');
  writeFileSync('.tmp-sfx-candidates.json', JSON.stringify(report, null, 2));
  console.log('\nfull candidate list -> .tmp-sfx-candidates.json');
}
