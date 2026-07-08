// tests/r5p1-quickwins.mjs — RUN5 phase 1 (C0b): the six resilience quick wins.
// Acceptance (RUN5 part D #2): a thrown error shows the oops card and Restart
// recovers; a waiting service worker produces the hub-only toast and tapping updates;
// three dated snapshots rotate and a restore round-trips; a simulated storage failure
// keeps play alive with a one-time toast; Jump back in replays the last mode; the
// level-up button appears exactly on 3-star at-or-below-comfort results and launches
// the next level.
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const SAVE = (over = {}) => Object.assign({
  version: 5, name: 'Ada',
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1 }, boxes: 0, meter: 0, opened: 1, pity: { commons: 0 },
  nicknames: {}, equips: {}, catBest: {}, town: [],
  stars: { total: 30, byGame: {} },
  ledger: {}, spellingMastery: {}, trickyPile: [],
  seen: { trophyRetro: true }, trophies: {}, ageAsked: true, age: 8,
  settings: { sound: false, music: false, voice: false, content: 'full' }
}, over);

const browser = await chromium.launch();
// A page whose init sets __bootownDay from a test-controlled localStorage key, so a
// reload can advance the day and re-trigger the daily rolling backup.
async function fresh(save, ignore = []) {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  page.on('pageerror', e => { if (ignore.some(s => e.message.includes(s))) return; failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.addInitScript(() => { const d = localStorage.getItem('__testDay'); if (d) window.__bootownDay = d; });
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), save);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  return { ctx, page };
}
const getState = (page) => page.evaluate(() => window.BooTown.State.getState());

// ==================== 1. Oops net ====================
console.log('== oops net ==');
{
  const { ctx, page } = await fresh(SAVE(), ['boom-test']);
  await page.evaluate(() => setTimeout(() => { throw new Error('boom-test-xyz'); }, 0));
  await page.waitForSelector('.oops-net', { timeout: 4000 });
  const heading = await page.$eval('.oops-card h2', n => n.textContent);
  assert(/tripped over a wire/i.test(heading), 'oops card shows the friendly heading');
  const hiccup = await page.evaluate(() => localStorage.getItem('bootown.hiccup'));
  assert(hiccup && hiccup.includes('boom-test-xyz'), 'technical message stored as last hiccup');
  // Restart reloads cleanly back to the hub.
  await page.click('.oops-restart');
  await page.waitForSelector('.hub', { timeout: 6000 });
  const stillOops = await page.$('.oops-net');
  assert(!stillOops, 'Restart recovers to the hub, no oops card lingering');
  // grown-ups corner surfaces the hiccup line
  await page.evaluate(() => window.BooTown.go('grownups'));
  await page.waitForSelector('.gu-hiccup');
  const hline = await page.$eval('.gu-hiccup', n => n.textContent);
  assert(/boom-test-xyz/.test(hline || ''), 'grown-ups shows the last hiccup');
  await ctx.close();
}

// ==================== 2. Update toast (hub only) ====================
console.log('== update toast ==');
{
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.addInitScript(() => { window.__forceUpdateToast = true; });
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE());
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  await page.waitForSelector('.boo-toast.update', { timeout: 3000 });
  const toastText = await page.$eval('.boo-toast.update .bt-msg', n => n.textContent);
  assert(/something new arrived/i.test(toastText), 'hub shows the update toast');
  // leave the hub → toast is dismissed (hub-only guarantee)
  await page.evaluate(() => window.BooTown.go('grownups'));
  await page.waitForSelector('.grownups');
  await sleep(150);
  const onOther = await page.$('.boo-toast.update');
  assert(!onOther, 'the update toast never shows off the hub');
  // back to hub, tapping Update reloads into the fresh build
  await page.evaluate(() => window.BooTown.go('hub'));
  await page.waitForSelector('.boo-toast.update');
  await page.evaluate(() => { window.__beforeUpdate = true; });
  await page.click('.boo-toast.update .bt-action');
  await page.waitForFunction(() => window.__beforeUpdate === undefined, { timeout: 6000 }).catch(() => {});
  const reloaded = await page.evaluate(() => window.__beforeUpdate === undefined);
  assert(reloaded, 'tapping Update reloads the app (activates the waiting worker)');
  await ctx.close();
}

// ==================== 3. Rolling backups + restore round-trip ====================
console.log('== rolling backups ==');
{
  const { ctx, page } = await fresh(SAVE({ stars: { total: 10, byGame: {} } }));
  async function snapshotDay(day, starTotal) {
    await page.evaluate(({ d, t }) => {
      localStorage.setItem('__testDay', d);
      const s = JSON.parse(localStorage.getItem('bootown.save.v1'));
      s.stars.total = t;
      // clear the daily guard so the reload re-snapshots
      if (s.seen) delete s.seen.lastBackupDay;
      localStorage.setItem('bootown.save.v1', JSON.stringify(s));
    }, { d: day, t: starTotal });
    await page.reload({ waitUntil: 'load' });
    await page.waitForSelector('.hub');
    await sleep(400); // let maybeRollingBackup + IDB settle
  }
  await snapshotDay('2026-07-01', 10);
  await snapshotDay('2026-07-02', 20);
  await snapshotDay('2026-07-03', 30);
  await snapshotDay('2026-07-04', 40);
  await page.evaluate(() => window.BooTown.go('grownups'));
  await page.waitForSelector('.gu-snaps');
  await page.waitForSelector('.gu-snap-row', { timeout: 4000 });
  const rows = await page.$$('.gu-snap-row');
  assert(rows.length === 3, `exactly three snapshots kept (rotated), got ${rows.length}`);
  const dates = await page.$$eval('.gu-snap-row .gu-snap-when', ns => ns.map(n => n.textContent.trim()));
  assert(dates.every(d => d && d.length), 'each snapshot shows a date');
  // Restore the OLDEST kept snapshot (day 2, stars 20) — round-trip. Rows are
  // newest-first, so the last row is the oldest kept snapshot.
  await page.locator('.gu-snap-row').last().locator('.gu-snap-restore').click();
  await page.waitForSelector('.hub', { timeout: 6000 });
  const s = await getState(page);
  assert(s.stars.total === 20, `restoring the oldest kept snapshot round-trips stars to 20, got ${s.stars.total}`);
  await ctx.close();
}

// ==================== 4. Guarded saves ====================
console.log('== guarded saves ==');
{
  const { ctx, page } = await fresh(SAVE(), ['QuotaExceeded']);
  await page.evaluate(() => {
    const orig = localStorage.setItem.bind(localStorage);
    localStorage.setItem = (k, v) => { if (k === 'bootown.save.v1') throw new Error('QuotaExceeded'); return orig(k, v); };
  });
  // force a save write
  await page.evaluate(() => { window.BooTown.State.mutate(st => st.meter = 3); window.BooTown.State.commit(); });
  await page.waitForSelector('.boo-toast.save-warn', { timeout: 3000 });
  const warn = await page.$eval('.boo-toast.save-warn .bt-msg', n => n.textContent);
  assert(/can't save|storage/i.test(warn), 'a guarded-save toast warns a grown-up');
  // a second failure must not stack a second toast
  await page.evaluate(() => { window.BooTown.State.mutate(st => st.meter = 4); window.BooTown.State.commit(); });
  await sleep(200);
  const count = await page.$$eval('.boo-toast.save-warn', ns => ns.length);
  assert(count === 1, `the save warning appears only once, got ${count}`);
  // play continues from memory
  const s = await getState(page);
  assert(s.meter === 4, 'state still updates in memory despite the failed write');
  await ctx.close();
}

// ==================== 5. Jump back in ====================
console.log('== jump back in ==');
{
  // real mode: Bubble Pop, Times tables, Level 2
  const { ctx, page } = await fresh(SAVE({ seen: { trophyRetro: true, lastPlay: { game: 'bubblepop', gameName: 'Times tables', cat: 'tables', level: 2, mix: false } } }));
  await page.waitForSelector('.jumpback-card');
  const name = await page.$eval('.jumpback-card .jb-name', n => n.textContent);
  const mode = await page.$eval('.jumpback-card .jb-mode', n => n.textContent);
  assert(name === 'Bubble Pop', 'jump-back-in card names the last game');
  assert(/Level 2/.test(mode), 'jump-back-in card shows the last mode (Level 2)');
  await page.click('.jumpback-card');
  await page.waitForSelector('.bubble-field', { timeout: 5000 });
  const onStartCard = await page.$('.start-card');
  assert(!onStartCard, 'tapping jump-back-in launches straight into the round (no start card)');
  await ctx.close();
}
{
  // mix mode label
  const { ctx, page } = await fresh(SAVE({ seen: { trophyRetro: true, lastPlay: { game: 'bubblepop', gameName: 'Smart Mix', cat: null, level: null, mix: true } } }));
  await page.waitForSelector('.jumpback-card');
  const mode = await page.$eval('.jumpback-card .jb-mode', n => n.textContent);
  assert(/Smart Mix/.test(mode), 'a Smart Mix round shows the Smart Mix label');
  await page.click('.jumpback-card');
  await page.waitForSelector('.bubble-field', { timeout: 5000 });
  assert(!(await page.$('.start-card')), 'Smart Mix jump-back-in launches a round');
  await ctx.close();
}

// ==================== 6. Level-up button ====================
console.log('== level-up button ==');
{
  const { ctx, page } = await fresh(SAVE());
  // 3-star at Level 1 (rank 1 <= default comfort 1) → button appears
  await page.evaluate(() => window.BooTown.go('results', { game: 'bubblepop', gameName: 'Times tables', stars: 3, cat: 'addsub', level: 1 }));
  await page.waitForSelector('.result-card');
  await page.waitForSelector('.btn.levelup', { timeout: 4000 });
  const lvlText = await page.$eval('.btn.levelup', n => n.textContent);
  assert(/Try Level 2/.test(lvlText), 'level-up offers the next level on a 3★ at-or-below-comfort round');
  await page.click('.btn.levelup');
  await page.waitForSelector('.bubble-field', { timeout: 5000 });
  assert(!(await page.$('.start-card')), 'level-up launches straight into the next level');
  await ctx.close();
}
{
  // above comfort (Level 3, rank 3 > comfort 1) → NO button (it's already a stretch)
  const { ctx, page } = await fresh(SAVE());
  await page.evaluate(() => window.BooTown.go('results', { game: 'bubblepop', gameName: 'Times tables', stars: 3, cat: 'addsub', level: 3 }));
  await page.waitForSelector('.result-card');
  await sleep(600);
  assert(!(await page.$('.btn.levelup')), 'no level-up button above comfort level');
  await ctx.close();
}
{
  // Smart Mix 3★ → NO button (mix is exempt)
  const { ctx, page } = await fresh(SAVE());
  await page.evaluate(() => window.BooTown.go('results', { game: 'bubblepop', gameName: 'Smart Mix', stars: 3, cat: null, level: null, mix: true }));
  await page.waitForSelector('.result-card');
  await sleep(600);
  assert(!(await page.$('.btn.levelup')), 'no level-up button on a Smart Mix round');
  await ctx.close();
}

await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
