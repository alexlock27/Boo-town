// tests/r8p1-rescue.mjs — RUN8 v2 C1.3 fail-safe loader, end to end (permanent suite).
// Proves: a corrupt save is never silently wiped — the raw bytes are preserved under a
// rescue key; an IndexedDB snapshot stands in when present (banner); a fresh save with a
// surviving rescue copy is resurrected; and with nothing recoverable a calm restore
// screen renders without autosaving over the key.
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });

// Helper: reset storage to a clean slate inside the page.
const resetStorage = () => page.evaluate(async () => {
  Object.keys(localStorage).filter(k => k.startsWith('bootown.')).forEach(k => localStorage.removeItem(k));
  try { const idb = await import('./js/idb.js'); await idb.idbClear('backups'); } catch {}
});

// Build a valid BOO1 backup code for a save with real progress (given a total).
const codeFor = (total) => page.evaluate(async (t) => {
  const st = await import('./js/state.js');
  st.initNew('Ada', null);
  st.mutate(s => { s.stars.total = t; s.inventory = { boo_pip: 3, boo_nova: 1 }; s.created = Date.now() - 5 * 24 * 3600 * 1000; });
  return st.exportCode();
}, total);

console.log('== 1) corrupt save, nothing to fall back to → rescue-needed, raw preserved ==');
await resetStorage();
{
  const r = await page.evaluate(async () => {
    const st = await import('./js/state.js');
    const CORRUPT = '{ this is not : json ';
    localStorage.setItem('bootown.save.v1', CORRUPT);
    const res = await st.loadOrRescue();
    const rescueKeys = Object.keys(localStorage).filter(k => k.startsWith('bootown.rescue.'));
    return { status: res.status, stillThere: localStorage.getItem('bootown.save.v1') === CORRUPT, rescued: rescueKeys.map(k => localStorage.getItem(k)), stateNull: st.getState() === null, corrupt: CORRUPT };
  });
  assert(r.status === 'rescue-needed', 'status is rescue-needed');
  assert(r.stillThere, 'the corrupt save key was NOT overwritten (no silent-fresh)');
  assert(r.rescued.length === 1 && r.rescued[0] === r.corrupt, 'the raw bytes were preserved under a rescue key');
  assert(r.stateNull, 'state stays null so nothing autosaves over the key');
}

console.log('== 2) corrupt save + an IndexedDB snapshot → restored-snapshot ==');
await resetStorage();
{
  const code = await codeFor(250);
  const r = await page.evaluate(async (snapCode) => {
    const st = await import('./js/state.js');
    const idb = await import('./js/idb.js');
    localStorage.setItem('bootown.save.v1', '{ broken ');
    await idb.idbPut('backups', { id: 'snap-1', day: '2026-07-01', at: Date.now(), code: snapCode });
    const res = await st.loadOrRescue();
    return { status: res.status, total: st.getState() && st.getState().stars.total, saved: localStorage.getItem('bootown.save.v1') };
  }, code);
  assert(r.status === 'restored-snapshot', 'status is restored-snapshot');
  assert(r.total === 250, 'the snapshot progress was restored (stars.total 250)');
  assert(r.saved && r.saved[0] === '{' && r.saved.includes('"stars"'), 'the restored save was committed over the corrupt key');
}

console.log('== 3) fresh save but a rescue copy with real progress → restored-rescue (resurrection) ==');
await resetStorage();
{
  const r = await page.evaluate(async () => {
    const st = await import('./js/state.js');
    // a rescue copy from a prior corruption, holding real progress
    const real = { version: 11, name: 'Ada', stars: { total: 180, byGame: {} }, inventory: { boo_pip: 2 }, created: Date.now() - 6e8 };
    localStorage.setItem('bootown.rescue.' + (Date.now() - 1000), JSON.stringify(real));
    // the live save looks brand-new (a fresh-start slipped through last session)
    const fresh = { version: 11, name: 'Ada', stars: { total: 0, byGame: {} }, inventory: {}, created: Date.now() };
    localStorage.setItem('bootown.save.v1', JSON.stringify(fresh));
    const res = await st.loadOrRescue();
    const rescueLeft = Object.keys(localStorage).filter(k => k.startsWith('bootown.rescue.')).length;
    return { status: res.status, total: st.getState() && st.getState().stars.total, rescueLeft };
  });
  assert(r.status === 'restored-rescue', 'status is restored-rescue');
  assert(r.total === 180, 'the real progress was resurrected (stars.total 180)');
  assert(r.rescueLeft === 0, 'rescue keys were cleared after resurrection');
}

console.log('== 4) a clean save boots normally and clears stale rescue keys ==');
await resetStorage();
{
  const r = await page.evaluate(async () => {
    const st = await import('./js/state.js');
    st.initNew('Ada', null);
    st.mutate(s => { s.stars.total = 90; });
    st.commit();
    localStorage.setItem('bootown.rescue.' + (Date.now() - 2000), '{ stale ');
    const res = await st.loadOrRescue();
    const rescueLeft = Object.keys(localStorage).filter(k => k.startsWith('bootown.rescue.')).length;
    return { status: res.status, total: st.getState().stars.total, rescueLeft };
  });
  assert(r.status === 'ok', 'status is ok for a healthy save');
  assert(r.total === 90, 'the healthy save loaded unchanged');
  assert(r.rescueLeft === 0, 'stale rescue keys were cleared on a healthy boot');
}

console.log('== 5) the calm restore screen renders on a corrupt boot (no crash, no onboarding) ==');
await resetStorage();
await page.evaluate(() => localStorage.setItem('bootown.save.v1', '{ corrupt at boot '));
await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
{
  const hasScreen = await page.waitForSelector('.rescue-card', { timeout: 8000 }).then(() => true).catch(() => false);
  assert(hasScreen, 'the calm rescue screen is shown');
  const stillCorrupt = await page.evaluate(() => localStorage.getItem('bootown.save.v1') === '{ corrupt at boot ');
  assert(stillCorrupt, 'the corrupt key is still intact on the rescue screen (no autosave)');
  const noOnboard = await page.locator('.onboarding, .ob-root').count();
  assert(noOnboard === 0, 'onboarding did NOT run over the corrupt save');
}

await browser.close();
console.log('RESULT: ' + (failed ? 'FAIL' : 'PASS'));
process.exit(failed ? 1 : 0);
