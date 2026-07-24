// tests/r8p4-visibility.mjs — RUN8 v2 C4 status panel + gentle reminder, permanent suite.
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const REMINDER_SAVE = (over = {}) => JSON.stringify(Object.assign({
  version: 12, name: 'Ada', ageAsked: true,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_pip: 1, boo_nova: 1 }, stars: { total: 60, byGame: {} }, trophies: {},
  town: { areas: {} }, care: { bonds: {}, treats: 0 }, lastBackupAt: 0,
  settings: { sound: false, music: false, voice: false, content: 'full' }
}, over));

const browser = await chromium.launch();

async function openBackupTab(page) {
  await page.evaluate(() => window.BooTown.go('grownups'));
  await page.waitForSelector('.gu-tabs', { timeout: 8000 });
  const tabs = await page.locator('.gu-tabs button').allInnerTexts();
  const idx = tabs.findIndex(t => /backup/i.test(t));
  if (idx >= 0) await page.locator('.gu-tabs button').nth(idx).click();
  await sleep(300);
}

console.log('== needsBackupReminder gating (unit) ==');
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
  const r = await page.evaluate(async () => {
    const b = await import('./js/backup.js');
    const mk = (stars, at) => ({ stars: { total: stars }, lastBackupAt: at });
    return {
      few: b.needsBackupReminder(mk(40, 0)),
      neverMany: b.needsBackupReminder(mk(60, 0)),
      recent: b.needsBackupReminder(mk(60, Date.now())),
      stale: b.needsBackupReminder(mk(60, Date.now() - 40 * 864e5))
    };
  });
  assert(r.few === false, 'no reminder at/under 50 stars');
  assert(r.neverMany === true, 'reminder when >50 stars and never backed up');
  assert(r.recent === false, 'no reminder when recently backed up');
  assert(r.stale === true, 'reminder when >30 days since last backup');
  await ctx.close();
}

console.log('== persisted() true and false both render (with the tip on false) ==');
{
  for (const val of [true, false]) {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.addInitScript((persistVal) => {
      localStorage.setItem('bootown.save.v1', JSON.stringify({ version: 12, name: 'Ada', ageAsked: true, guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' }, inventory: {}, stars: { total: 10, byGame: {} }, town: { areas: {} }, care: { bonds: {}, treats: 0 }, lastBackupAt: Date.now(), settings: { sound: false, music: false, voice: false, content: 'full' } }));
      try { navigator.storage.persisted = async () => persistVal; navigator.storage.estimate = async () => ({ usage: 123456, quota: 1e9 }); } catch {}
    }, val);
    await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
    await page.waitForSelector('.hub', { timeout: 8000 }).catch(() => {});
    await openBackupTab(page);
    const txt = await page.locator('.gu-backup-status').innerText();
    assert(new RegExp('automatic clearing: ' + (val ? 'yes' : 'no')).test(txt), `persisted ${val} → shows "${val ? 'yes' : 'no'}"`);
    if (!val) assert(/keep a backup so nothing is lost/i.test(txt), 'the "no" state shows the protective tip');
    assert(/Space used on this tablet: /.test(txt), 'storage estimate is shown in friendly units');
    assert(/Clearing browser data erases progress/.test(txt), 'the clear-browser-data note always shows');
    await ctx.close();
  }
}

console.log('== the iOS-standalone note shows only under an iOS standalone signature ==');
{
  // non-iOS desktop: no iOS note
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.addInitScript(() => localStorage.setItem('bootown.save.v1', JSON.stringify({ version: 12, name: 'Ada', ageAsked: true, guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' }, inventory: {}, stars: { total: 10, byGame: {} }, town: { areas: {} }, care: { bonds: {}, treats: 0 }, lastBackupAt: Date.now(), settings: { sound: false, music: false, voice: false, content: 'full' } })));
  await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
  await page.waitForSelector('.hub', { timeout: 8000 }).catch(() => {});
  await openBackupTab(page);
  const desktopTxt = await page.locator('.gu-backup-status').innerText();
  assert(!/deleting the app icon/i.test(desktopTxt), 'no iOS icon note on a non-iOS browser');
  await ctx.close();

  // iOS standalone: stub UA + navigator.standalone + display-mode
  const ictx = await browser.newContext({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1' });
  const ipage = await ictx.newPage();
  await ipage.addInitScript(() => {
    localStorage.setItem('bootown.save.v1', JSON.stringify({ version: 12, name: 'Ada', ageAsked: true, guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' }, inventory: {}, stars: { total: 10, byGame: {} }, town: { areas: {} }, care: { bonds: {}, treats: 0 }, lastBackupAt: Date.now(), settings: { sound: false, music: false, voice: false, content: 'full' } }));
    try { Object.defineProperty(navigator, 'standalone', { configurable: true, value: true }); } catch {}
    const mm = window.matchMedia.bind(window);
    window.matchMedia = (q) => /standalone/.test(q) ? { matches: true, media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} } : mm(q);
  });
  await ipage.goto(`${BASE}/index.html`, { waitUntil: 'load' });
  await ipage.waitForSelector('.hub', { timeout: 8000 }).catch(() => {});
  await openBackupTab(ipage);
  const iosTxt = await ipage.locator('.gu-backup-status').innerText();
  assert(/deleting the app icon deletes its progress/i.test(iosTxt), 'iOS standalone shows the app-icon warning');
  await ictx.close();
}

console.log('== reminder appears only when due, inside grown-ups, and clears after an export ==');
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.addInitScript((save) => localStorage.setItem('bootown.save.v1', save), REMINDER_SAVE());
  await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
  await page.evaluate(() => { const r = document.createElement('a'); });
  await page.waitForSelector('.hub', { timeout: 8000 }).catch(() => {});
  // child-facing hub must NOT contain the reminder text
  const hubTxt = await page.locator('body').innerText();
  assert(!/No recent backup/i.test(hubTxt), 'no reminder string on the child-facing hub');
  await openBackupTab(page);
  const bannerOn = await page.locator('.gu-backup-reminder.on').count();
  assert(bannerOn === 1, 'the reminder banner shows in grown-ups when a backup is overdue');
  const dot = await page.locator('.gu-tab-dot').count();
  assert(dot === 1, 'a dot marks the Backup tab label');
  // export clears it
  await page.evaluate(() => { const a = document.createElement('a'); a.click = () => {}; const real = document.createElement.bind(document); document.createElement = (t) => { const n = real(t); if (t === 'a') n.click = () => {}; return n; }; });
  await page.locator('.gu-reminder-btn').click();
  await sleep(500);
  const bannerAfter = await page.locator('.gu-backup-reminder.on').count();
  assert(bannerAfter === 0, 'the reminder clears after keeping a copy');
  const dotAfter = await page.locator('.gu-tab-dot').count();
  assert(dotAfter === 0, 'the tab dot clears after keeping a copy');
  await ctx.close();

  // a save that is not due shows no banner (fresh context, no in-memory carryover)
  const ctx2 = await browser.newContext();
  const page2 = await ctx2.newPage();
  await page2.addInitScript((save) => localStorage.setItem('bootown.save.v1', save), REMINDER_SAVE({ lastBackupAt: Date.now() }));
  await page2.goto(`${BASE}/index.html`, { waitUntil: 'load' });
  await page2.waitForSelector('.hub', { timeout: 8000 }).catch(() => {});
  await openBackupTab(page2);
  const bannerNotDue = await page2.locator('.gu-backup-reminder.on').count();
  assert(bannerNotDue === 0, 'no reminder when a recent backup exists');
  await ctx2.close();
}

await browser.close();
console.log('RESULT: ' + (failed ? 'FAIL' : 'PASS'));
process.exit(failed ? 1 : 0);
