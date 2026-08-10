// tools/sfx-verify.mjs — RUN21H B2, second pass: is this file actually the SOUND?
//
// Local tooling, NOT shipped. The licence pass (tools/sfx-source.mjs) proves a file is
// CC0/PD. It does NOT prove the file is an animal — Commons is full of licence-clean
// recordings of a PERSON SAYING a word (Lingua Libre pronunciation projects), which is the
// exact opposite of what "the animals sound REAL now" promises. This pass reads each
// candidate's description and rejects the speech corpora by name.
//
//   node tools/sfx-verify.mjs               # describe every shortlisted candidate
//   node tools/sfx-verify.mjs hunt          # extra targeted searches for the core animals
//
// A candidate that survives BOTH passes is still only a proposal — see the RUN21H ledger
// for the honest limit: nothing here can hear the file, so a recording that is licence-clean
// and described as an animal can still be a poor recording.

const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'BooTownSfxSourcing/1.0 (offline educational PWA; licence-verification tooling)';

// Speech corpora and pronunciation projects: licence-clean, and never an animal noise.
// Lingua Libre files are "LL-Qnnn (lang)-Speaker-word", and the shortcodes below are the
// per-language pronunciation sets that came back in the survey.
const SPEECH = [
  /^File:LL-Q\d+/i,
  /^File:(Fa|Nl|Bcl|Guw|Kcg|Jer|De|Fr|En|Es|Pt|Pl|Ru|It|Sv|Da|Nb|Fi|Cs|Hu|Tr|Ar|Zh|Ja|Ko|Hi|Th|Vi|Id|Ms|Sw|Yo|Ha|Ig)-/i,
  /pronunciation/i, /wikipedia\s*-/i, /\(excerpt\)/i,
  /vocabulary|wyrazy|literą|palabras|mots\b/i
];
const isSpeech = (title, desc = '') => SPEECH.some(re => re.test(title)) || /pronunciation of|spoken by|voice of|lingua libre/i.test(desc);

let last = 0;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function api(params, tries = 5) {
  for (let i = 0; i < tries; i++) {
    const wait = Math.max(0, 1700 - (Date.now() - last));
    if (wait) await sleep(wait);
    last = Date.now();
    const url = API + '?' + new URLSearchParams({ format: 'json', formatversion: '2', ...params });
    let r;
    try { r = await fetch(url, { headers: { 'User-Agent': UA } }); } catch { await sleep(2500); continue; }
    if (r.status === 429) { await sleep(5000 * (i + 1)); continue; }
    if (!r.ok) { await sleep(2000); continue; }
    const t = await r.text();
    if (!t.startsWith('{')) { await sleep(5000 * (i + 1)); continue; }
    return JSON.parse(t);
  }
  return null;
}

const OK_LICENCE = /^(cc0|public domain|pd(-|$)|cc-zero)/i;
const OK_TERMS = /(creative commons zero|public domain|cc0)/i;

async function meta(titles) {
  const out = [];
  for (let i = 0; i < titles.length; i += 40) {
    const j = await api({ action: 'query', titles: titles.slice(i, i + 40).join('|'), prop: 'imageinfo', iiprop: 'url|size|mime|extmetadata|metadata' });
    if (!j || !j.query) continue;
    for (const p of j.query.pages || []) {
      const ii = (p.imageinfo || [])[0]; if (!ii) continue;
      const em = ii.extmetadata || {};
      const val = (k) => (em[k] && em[k].value != null ? String(em[k].value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '');
      const short = val('LicenseShortName'), lic = val('License'), terms = val('UsageTerms');
      const md = Object.fromEntries((ii.metadata || []).map(m => [m.name, m.value]));
      out.push({
        title: p.title, url: ii.url, mime: ii.mime, bytes: ii.size,
        licence: short || lic, usageTerms: terms, artist: val('Artist'),
        descUrl: ii.descriptionurl, desc: val('ImageDescription'),
        seconds: Number(md.length || md.playtime_seconds || 0) || null,
        clean: OK_LICENCE.test(short) || OK_LICENCE.test(lic) || OK_TERMS.test(terms)
      });
    }
  }
  return out;
}

async function search(q, limit = 40) {
  const j = await api({ action: 'query', list: 'search', srsearch: `${q} filetype:audio`, srnamespace: '6', srlimit: String(limit) });
  return j && j.query ? j.query.search.map(s => s.title) : [];
}

// Targeted hunts for the sounds the first survey missed — the core toddler animals.
const HUNTS = [
  { id: 'cow',     qs: ['cattle moo recording', 'cow lowing sound', 'Bos taurus vocalization'] },
  { id: 'dog',     qs: ['dog barking recording', 'Canis familiaris barking', 'dog bark sound effect'] },
  { id: 'duck',    qs: ['duck quacking recording', 'mallard quack', 'Anas quacking'] },
  { id: 'owl',     qs: ['owl hooting recording', 'Bubo bubo call', 'Athene noctua call'] },
  { id: 'rooster', qs: ['rooster crowing recording', 'cock crow sound', 'cockerel crow'] },
  { id: 'horse',   qs: ['horse whinny recording', 'horse neighing', 'Equus whinny'] },
  { id: 'pig',     qs: ['domestic pig grunting', 'pig oink recording', 'swine grunt'] },
  { id: 'goat',    qs: ['goat bleating recording', 'Capra bleat'] },
  { id: 'thunder', qs: ['thunderclap recording', 'thunder sound recording'] }
];

const cmd = process.argv[2] || 'describe';

if (cmd === 'hunt') {
  const found = {};
  for (const h of HUNTS) {
    const titles = new Set();
    for (const q of h.qs) (await search(q, 25)).forEach(t => titles.add(t));
    const rows = (await meta([...titles]))
      .filter(r => r.clean)
      .filter(r => /ogg|opus|mpeg/i.test(r.mime || ''))
      .filter(r => (r.bytes || 0) > 3000 && (r.bytes || 0) < 500000)
      .filter(r => !isSpeech(r.title, r.desc))
      .sort((a, b) => (a.bytes || 0) - (b.bytes || 0));
    found[h.id] = rows;
    console.log(`\n### ${h.id} — ${rows.length} licence-clean, non-speech`);
    for (const r of rows.slice(0, 8)) {
      console.log(`  ${String(Math.round(r.bytes / 1024)).padStart(5)}KB ${(r.licence || '').padEnd(15)} ${r.seconds ? (r.seconds + 's').padStart(6) : '     ?'} ${r.title}`);
      if (r.desc) console.log(`         "${r.desc.slice(0, 130)}"`);
    }
  }
  const { writeFileSync } = await import('node:fs');
  writeFileSync('.tmp-sfx-hunt.json', JSON.stringify(found, null, 2));
  console.log('\n-> .tmp-sfx-hunt.json');
} else {
  const { readFileSync, writeFileSync } = await import('node:fs');
  const cand = JSON.parse(readFileSync('.tmp-sfx-candidates.json', 'utf8'));
  const kept = {};
  for (const [id, rows] of Object.entries(cand)) {
    const titles = rows.map(r => r.title);
    if (!titles.length) { kept[id] = []; continue; }
    const full = await meta(titles);
    const good = full.filter(r => !isSpeech(r.title, r.desc));
    kept[id] = good;
    console.log(`\n### ${id} — ${rows.length} licence-clean, ${good.length} after dropping speech recordings`);
    for (const r of good) {
      console.log(`  ${String(Math.round(r.bytes / 1024)).padStart(5)}KB ${(r.licence || '').padEnd(15)} ${r.seconds ? (r.seconds + 's').padStart(6) : '     ?'} ${r.title}`);
      if (r.desc) console.log(`         "${r.desc.slice(0, 150)}"`);
    }
    for (const r of full.filter(r => isSpeech(r.title, r.desc))) console.log(`  -- dropped (speech): ${r.title}`);
  }
  writeFileSync('.tmp-sfx-verified.json', JSON.stringify(kept, null, 2));
  console.log('\n-> .tmp-sfx-verified.json');
}
