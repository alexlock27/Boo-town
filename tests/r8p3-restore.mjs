// tests/r8p3-restore.mjs — RUN8 v2 C3 unified restore (preview + undo), permanent suite.
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });

// Build an "old backup" (.boo, with creations) for player Bee/120, then set the live save
// to Ada/300 with empty creation stores.
const envJson = await page.evaluate(async () => {
  const st = await import('./js/state.js');
  const b = await import('./js/backup.js');
  const idb = await import('./js/idb.js');
  Object.keys(localStorage).filter(k => k.startsWith('bootown.')).forEach(k => localStorage.removeItem(k));
  for (const s of ['artworks', 'jams', 'audio', 'backups']) { try { await idb.idbClear(s); } catch {} }
  st.initNew('Bee', null);
  st.mutate(s => { s.stars.total = 120; s.inventory = { boo_pip: 1, boo_nova: 1 }; s.trophies = { first_medal: '2026-01-01' }; s.lastPlayed = Date.UTC(2026, 5, 1, 12); });
  st.commit();
  await idb.idbPut('artworks', { id: 'artB', png: 'data:image/png;base64,AAA' });
  await idb.idbPut('jams', { id: 'jamB', name: 'Bee Jam', layers: [] });
  const file = await b.buildBackupFile({ includeCreations: true, createdAtMs: Date.UTC(2026, 5, 1, 12) });
  // now the live save = Ada/300, creation stores cleared
  Object.keys(localStorage).filter(k => k.startsWith('bootown.')).forEach(k => localStorage.removeItem(k));
  for (const s of ['artworks', 'jams', 'backups']) { try { await idb.idbClear(s); } catch {} }
  st.initNew('Ada', null);
  st.mutate(s => { s.stars.total = 300; s.inventory = { boo_lolly: 1 }; });
  st.commit();
  return file.json;
}, );

console.log('== a .boo file previews from its summary (no changes yet) ==');
{
  const r = await page.evaluate(async (json) => {
    const b = await import('./js/backup.js');
    const st = await import('./js/state.js');
    const insp = b.inspectText(json);
    return { ok: insp.ok, preview: insp.preview, liveUnchanged: st.getState().stars.total === 300 };
  }, envJson);
  assert(r.ok, 'the .boo file inspects ok');
  assert(r.preview.name === 'Bee' && r.preview.stars === 120 && r.preview.uniqueBoos === 2 && r.preview.trophies === 1, 'preview shows name/stars/Boos/trophies');
  assert(r.preview.savedDate === '2026-06-01', 'preview shows the saved date');
  assert(r.preview.creations === true, 'preview flags that creations are included');
  assert(r.liveUnchanged, 'inspecting changes nothing live');
}

console.log('== corrupt and wrong-format inputs fail kindly (no crash) ==');
{
  const r = await page.evaluate(async () => {
    const b = await import('./js/backup.js');
    return { garbage: b.inspectText('%%% not a backup %%%'), notSave: b.inspectText('{"hello":"world"}'), empty: b.inspectText('') };
  });
  assert(!r.garbage.ok && /damaged|not a Boo Town/i.test(r.garbage.error), 'garbage → kind error');
  assert(!r.notSave.ok && /not a Boo Town backup/i.test(r.notSave.error), 'valid JSON that is not a save → kind error');
  assert(!r.empty.ok, 'empty input → kind error');
}

console.log('== restore applies exactly, restores creations, and leaves an undo point ==');
{
  const r = await page.evaluate(async (json) => {
    const b = await import('./js/backup.js');
    const st = await import('./js/state.js');
    const idb = await import('./js/idb.js');
    const insp = b.inspectText(json);
    const res = await b.restoreInspected(insp);
    const arts = (await idb.idbGetAll('artworks')) || [];
    const jams = (await idb.idbGetAll('jams')) || [];
    const snaps = (await b_listSnapshots()) || [];
    async function b_listSnapshots() { const r = await import('./js/resilience.js'); return r.listSnapshots(); }
    const undo = snaps.find(s => /before restore/.test(s.label || ''));
    // inspect the undo point
    const undoPrev = undo ? b.inspectSnapshot(undo).preview : null;
    return {
      ok: res.ok, total: st.getState().stars.total, name: st.getState().name,
      artRestored: arts.some(a => a.id === 'artB'), jamRestored: jams.some(j => j.id === 'jamB'),
      hasUndo: !!undo, undoStars: undoPrev && undoPrev.stars, undoName: undoPrev && undoPrev.name
    };
  }, envJson);
  assert(r.ok && r.total === 120 && r.name === 'Bee', 'restore applied the backup exactly (Bee/120)');
  assert(r.artRestored && r.jamRestored, 'a full-variant restore returned artworks + jams to their stores');
  assert(r.hasUndo, 'a "before restore" undo snapshot was written');
  assert(r.undoStars === 300 && r.undoName === 'Ada', 'the undo point holds the pre-restore state (Ada/300)');
}

console.log('== the undo point round-trips (one tap back to the pre-restore state) ==');
{
  const r = await page.evaluate(async () => {
    const b = await import('./js/backup.js');
    const st = await import('./js/state.js');
    const res = await import('./js/resilience.js');
    const snaps = await res.listSnapshots();
    const undo = snaps.find(s => /before restore/.test(s.label || ''));
    const applied = await b.restoreInspected(b.inspectSnapshot(undo));
    return { ok: applied.ok, total: st.getState().stars.total, name: st.getState().name };
  });
  assert(r.ok && r.total === 300 && r.name === 'Ada', 'restoring the undo point brings back Ada/300');
}

console.log('== the Backup tab preview card renders from a pasted code ==');
{
  const code = await page.evaluate(async () => {
    const st = await import('./js/state.js');
    st.initNew('Cass', null); st.mutate(s => { s.stars.total = 77; }); st.commit();
    return st.exportCode();
  });
  await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
  await page.waitForSelector('.hub', { timeout: 8000 }).catch(() => {});
  await page.evaluate(() => window.BooTown.go('grownups'));
  await page.waitForSelector('.gu-tabs', { timeout: 8000 });
  const tabs = await page.locator('.gu-tabs button').allInnerTexts();
  const idx = tabs.findIndex(t => /backup/i.test(t));
  if (idx >= 0) await page.locator('.gu-tabs button').nth(idx).click();
  await page.locator('textarea.gu-code[placeholder*="Paste"]').fill(code);
  await page.locator('button:has-text("Preview this code")').click();
  const card = await page.waitForSelector('.gu-preview-card', { timeout: 5000 }).then(() => true).catch(() => false);
  assert(card, 'a preview card appears before restoring');
  const facts = card ? await page.locator('.gu-preview-facts').innerText() : '';
  assert(/77 stars/.test(facts), 'the preview card shows the pasted save’s stars');
}

await browser.close();
console.log('RESULT: ' + (failed ? 'FAIL' : 'PASS'));
process.exit(failed ? 1 : 0);
