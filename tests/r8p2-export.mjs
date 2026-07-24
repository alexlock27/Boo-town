// tests/r8p2-export.mjs — RUN8 v2 C2 export (Keep a copy / Send a copy), permanent suite.
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });

// Seed a real save + creations + a voice recording in IndexedDB.
await page.evaluate(async () => {
  Object.keys(localStorage).filter(k => k.startsWith('bootown.')).forEach(k => localStorage.removeItem(k));
  const st = await import('./js/state.js');
  const idb = await import('./js/idb.js');
  for (const s of ['artworks', 'jams', 'audio', 'backups']) { try { await idb.idbClear(s); } catch {} }
  st.initNew('Ada Bee', null);
  st.mutate(s => { s.stars.total = 210; s.inventory = { boo_pip: 2, boo_nova: 1, deco_bench: 1 }; s.trophies = { first_medal: '2026-01-01', all_gold: '2026-02-02' }; });
  st.commit();
  await idb.idbPut('artworks', { id: 'art1', png: 'data:image/png;base64,AAAA' });
  await idb.idbPut('jams', { id: 'jam1', name: 'My Jam', layers: [] });
  await idb.idbPut('audio', { id: 'voice1', blob: 'x' });
});

console.log('== envelope shape + filename + summary ==');
{
  const r = await page.evaluate(async () => {
    const b = await import('./js/backup.js');
    const env = await b.buildEnvelope({ createdAtMs: Date.UTC(2026, 6, 24) });
    const file = await b.buildBackupFile({ createdAtMs: Date.UTC(2026, 6, 24) });
    return { env, filename: file.filename, size: file.size };
  });
  assert(r.env.format === 'boo-backup' && r.env.formatVersion === 1, 'envelope has format + formatVersion');
  assert(typeof r.env.createdAt === 'number' && 'buildStamp' in r.env, 'envelope has createdAt + buildStamp');
  assert(r.env.summary && r.env.summary.name === 'Ada Bee' && r.env.summary.stars === 210 && r.env.summary.uniqueBoos === 2 && r.env.summary.trophies === 2, 'summary block: name, stars, unique Boos (2), trophies (2)');
  assert(r.env.save && r.env.save.stars.total === 210, 'the full save is embedded');
  assert(!('artworks' in r.env) && !('voices' in r.env), 'creations + voices are OFF by default');
  assert(/^bootown-backup-Ada-Bee-2026-07-24\.boo$/.test(r.filename), 'filename is bootown-backup-{name}-{date}.boo: ' + r.filename);
}

console.log('== toggles change contents + size; voices only under their own toggle ==');
{
  const r = await page.evaluate(async () => {
    const b = await import('./js/backup.js');
    const base = await b.buildBackupFile({});
    const withC = await b.buildBackupFile({ includeCreations: true });
    const withCV = await b.buildBackupFile({ includeCreations: true, includeVoices: true });
    const withVonly = await b.buildEnvelope({ includeCreations: false, includeVoices: true });
    return {
      baseHasArt: 'artworks' in base.envelope, cHasArt: (withC.envelope.artworks || []).length, cHasJam: (withC.envelope.jams || []).length,
      cHasVoice: 'voices' in withC.envelope, cvHasVoice: (withCV.envelope.voices || []).length,
      vOnlyArt: 'artworks' in withVonly, vOnlyVoice: (withVonly.voices || []).length,
      sizeGrows: withC.size > base.size, sizeGrows2: withCV.size > withC.size
    };
  });
  assert(!r.baseHasArt, 'default file has no creations');
  assert(r.cHasArt === 1 && r.cHasJam === 1, 'include-creations embeds artworks + jams');
  assert(!r.cHasVoice, 'include-creations does NOT pull in voices');
  assert(r.cvHasVoice === 1, 'the voices toggle adds voice recordings');
  assert(!r.vOnlyArt && r.vOnlyVoice === 1, 'voices can be included without creations');
  assert(r.sizeGrows && r.sizeGrows2, 'file size grows as creations then voices are added');
}

console.log('== Keep a copy writes the file and stamps lastBackupAt ==');
{
  const r = await page.evaluate(async () => {
    const b = await import('./js/backup.js');
    const st = await import('./js/state.js');
    st.mutate(s => { s.lastBackupAt = 0; }); st.commit();
    // stub the download click so headless does not navigate
    const realCreate = document.createElement.bind(document);
    document.createElement = (t) => { const n = realCreate(t); if (t === 'a') n.click = () => {}; return n; };
    const res = await b.keepCopy({});
    document.createElement = realCreate;
    return { ok: res.ok, hasName: /\.boo$/.test(res.filename || ''), last: st.getState().lastBackupAt };
  });
  assert(r.ok && r.hasName, 'keepCopy reports ok with a .boo filename');
  assert(r.last > 0, 'lastBackupAt is set by Keep a copy');
}

console.log('== Send a copy hands an identical file to a stubbed share sheet + stamps lastBackupAt ==');
{
  const r = await page.evaluate(async () => {
    const b = await import('./js/backup.js');
    const st = await import('./js/state.js');
    st.mutate(s => { s.lastBackupAt = 0; }); st.commit();
    let shared = null;
    navigator.canShare = () => true;
    navigator.share = async (data) => { shared = data; };
    const supported = b.canShareFiles();
    const res = await b.sendCopy({});
    let parsed = null; try { parsed = JSON.parse(await shared.files[0].text()); } catch {}
    return { supported, ok: res.ok, name: shared && shared.files[0].name, sameSave: parsed && parsed.save && parsed.save.stars.total === 210, last: st.getState().lastBackupAt };
  });
  assert(r.supported, 'canShareFiles() is true when the API supports files');
  assert(r.ok && /\.boo$/.test(r.name || ''), 'sendCopy shared a .boo file');
  assert(r.sameSave, 'the shared file carries the same save as Keep a copy');
  assert(r.last > 0, 'lastBackupAt is set by Send a copy');
}

console.log('== code fallback carries a summary; envelope round-trips through importAny ==');
{
  const r = await page.evaluate(async () => {
    const b = await import('./js/backup.js');
    const st = await import('./js/state.js');
    const cs = b.backupCodeWithSummary();
    const file = await b.buildBackupFile({ includeCreations: true });
    // wipe then restore from the .boo envelope text
    st.mutate(s => { s.stars.total = 0; }); st.commit();
    const res = st.importAny(file.json);
    return { codeStarts: cs.code.startsWith('BOO1.'), sumStars: cs.summary && cs.summary.stars, restored: res.ok, total: st.getState().stars.total };
  });
  assert(r.codeStarts && r.sumStars === 210, 'the code fallback comes with a summary block');
  assert(r.restored && r.total === 210, 'a .boo envelope restores through importAny');
}

console.log('== the Backup tab shows Keep a copy (first) and, with share support, Send a copy ==');
{
  await page.evaluate(() => { navigator.canShare = () => true; navigator.share = async () => {}; });
  await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
  await page.evaluate(() => { navigator.canShare = () => true; navigator.share = async () => {}; });
  await page.waitForSelector('.hub', { timeout: 8000 }).catch(() => {});
  await page.evaluate(() => window.BooTown.go('grownups'));
  await page.waitForSelector('.gu-tabs', { timeout: 8000 });
  // open the Backup & data tab
  const tabs = await page.locator('.gu-tabs button').allInnerTexts();
  const idx = tabs.findIndex(t => /backup/i.test(t));
  if (idx >= 0) await page.locator('.gu-tabs button').nth(idx).click();
  const keep = await page.locator('.gu-keep').count();
  const keepText = keep ? await page.locator('.gu-keep').innerText() : '';
  assert(keep === 1 && /keep a copy/i.test(keepText), 'the Keep a copy button is present');
  const send = await page.locator('.gu-send').count();
  assert(send === 1, 'Send a copy is present when file sharing is supported');
}

await browser.close();
console.log('RESULT: ' + (failed ? 'FAIL' : 'PASS'));
process.exit(failed ? 1 : 0);
