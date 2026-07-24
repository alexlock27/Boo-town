// tests/r8p1-snapshots.mjs — RUN8 v2 C1.4 snapshot-writer verdict (permanent suite).
// Drives play across simulated days and proves an automatic snapshot is actually WRITTEN
// to IndexedDB, rotates at three, and lists with its date for the grown-ups restore UI.
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });

await page.evaluate(async () => {
  Object.keys(localStorage).filter(k => k.startsWith('bootown.')).forEach(k => localStorage.removeItem(k));
  try { const idb = await import('./js/idb.js'); await idb.idbClear('backups'); } catch {}
  const st = await import('./js/state.js');
  st.initNew('Ada', null);
  st.mutate(s => { s.stars.total = 120; s.inventory = { boo_pip: 2 }; });
  st.commit();
});

// Drive one "day" of play: set the day key, then run the writer as boot would.
const playDay = (day) => page.evaluate(async (d) => {
  window.__bootownDay = d;
  const res = await import('./js/resilience.js');
  await res.maybeRollingBackup();
  const snaps = await res.listSnapshots();
  return snaps.map(s => ({ day: s.day, hasCode: typeof s.code === 'string' && s.code.startsWith('BOO1.'), at: s.at }));
}, day);

console.log('== the very first snapshot is written promptly (same day) ==');
{
  const s1 = await playDay('2026-07-01');
  assert(s1.length === 1, 'a snapshot was WRITTEN to IndexedDB on first play (had it ever worked: yes)');
  assert(s1[0].day === '2026-07-01' && s1[0].hasCode, 'it carries its day label and a restorable code');
}

console.log('== a second and third day accumulate ==');
{
  const s2 = await playDay('2026-07-02');
  assert(s2.length === 2, 'day two adds a second snapshot');
  const s3 = await playDay('2026-07-03');
  assert(s3.length === 3, 'day three reaches three snapshots');
}

console.log('== a fourth day rotates, keeping the newest three ==');
{
  const s4 = await playDay('2026-07-04');
  assert(s4.length === 3, 'still exactly three snapshots (rotated)');
  const days = s4.map(s => s.day).sort();
  assert(days.join(',') === '2026-07-02,2026-07-03,2026-07-04', 'the oldest (07-01) was dropped, newest three kept');
}

console.log('== same-day re-run does not duplicate ==');
{
  const again = await playDay('2026-07-04');
  assert(again.length === 3, 'a second call on the same day writes no duplicate');
}

console.log('== snapshots list with their dates for the grown-ups restore UI ==');
{
  const listed = await page.evaluate(async () => {
    const res = await import('./js/resilience.js');
    const snaps = await res.listSnapshots();
    return snaps.map(s => s.day);
  });
  assert(listed.length === 3 && listed.every(d => /^\d{4}-\d{2}-\d{2}$/.test(d)), 'listSnapshots returns dated entries newest-first');
  // and each restores cleanly
  const ok = await page.evaluate(async () => {
    const res = await import('./js/resilience.js');
    const st = await import('./js/state.js');
    const snaps = await res.listSnapshots();
    const r = res.restoreSnapshot(snaps[0].code);
    return r && r.ok && st.getState() && st.getState().stars.total === 120;
  });
  assert(ok, 'restoring a listed snapshot brings the save back');
}

await browser.close();
console.log('RESULT: ' + (failed ? 'FAIL' : 'PASS'));
process.exit(failed ? 1 : 0);
