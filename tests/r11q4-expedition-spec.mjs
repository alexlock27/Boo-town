// tests/r11q4-expedition-spec.mjs — RUN11 Q4 spec points for the Boo Expedition (P15).
// Budgets exact; Boo Wander never drops from boxes (5000-roll guard) and is granted for a
// full trail at tier ≥2 with the First Expedition trophy. Puzzle solve/star mechanics are
// covered by r10p15 + r10p16.
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };

// ---- pure data + box-guard (Node) ----
const { BUDGETS } = await import('../data/expedition.js');
const cat = await import('../data/catalogue.js');

console.log('== budgets match the P15 spec exactly ==');
{
  const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  assert(eq(BUDGETS.bridges.sneezes, [6, 6, 8, 8]), 'bridges sneezes [6,6,8,8]');
  assert(eq(BUDGETS.picnic.huffs, [5, 6, 7, 8]), 'picnic huffs [5,6,7,8]');
  assert(eq(BUDGETS.raft.failedSails, [3, 4, 4, 5]), 'raft failedSails [3,4,4,5]');
  assert(eq(BUDGETS.hotel.wrongRooms, [6, 8, 10, 10]), 'hotel wrongRooms [6,8,10,10]');
}

console.log('== Boo Wander exists, is expedition-exclusive, and never drops from boxes ==');
{
  const w = cat.BY_ID['boo_wander'];
  assert(w && w.species === 'nova' && w.acc === 'explorerhat', 'Wander is a Nova in an explorer hat');
  assert(w.free === true && w.expeditionOnly === true, 'Wander is free + expeditionOnly');
  // it must not appear in ANY drop bucket
  const inPool = Object.values(cat.BY_TYPE_RARITY).some(byRar => Object.values(byRar).some(list => list.some(it => it.id === 'boo_wander')));
  assert(!inPool, 'Wander is absent from every box-drop bucket');
  // 5000-roll guard on the ultra boo bucket (where it would otherwise sit)
  const ultra = (cat.BY_TYPE_RARITY.boo && cat.BY_TYPE_RARITY.boo.ultra) || [];
  let seen = false;
  for (let i = 0; i < 5000; i++) { const pick = ultra[(Math.random() * ultra.length) | 0]; if (pick && pick.id === 'boo_wander') { seen = true; break; } }
  assert(!seen, 'Wander never dropped across 5000 ultra-boo rolls');
}

// ---- grant on a full trail (browser) ----
const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });

console.log('== a full trail at tier ≥2 grants Wander + the First Expedition trophy, once ==');
{
  const owned = ['boo_pip', 'boo_nova', 'boo_inky', 'boo_plum', 'boo_lolly', 'boo_chomp', 'boo_mallow', 'boo_pippin'];
  const SAVE = { version: 14, name: 'Ada', ageAsked: true, guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' }, inventory: Object.fromEntries(owned.map(id => [id, 1])), stars: { total: 200, byGame: {} }, trophies: {}, town: { areas: {} }, care: { bonds: {}, treats: 0 }, expedition: { party: owned, tiers: { bridges: 2, picnic: 2, raft: 2, hotel: 2 }, progress: { bridges: 3, picnic: 3, raft: 3, hotel: 3 } }, settings: { sound: false, music: false, voice: false, content: 'full' } };
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), JSON.stringify(SAVE));
  await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.BooTown, null, { timeout: 8000 });
  await page.evaluate(() => window.BooTown.go('expedition', { trail: true }));
  await page.waitForSelector('.exp-trail', { timeout: 8000 });
  await page.waitForTimeout(500);
  const r = await page.evaluate(() => { const s = window.BooTown.State.getState(); return { wander: (s.inventory || {}).boo_wander || 0, first: !!(s.trophies && s.trophies.exp_first), revealShown: document.querySelectorAll('.exp-reveal-overlay').length }; });
  assert(r.wander === 1, 'Boo Wander is granted (owned once)');
  assert(r.first, 'the First Expedition trophy is granted');
  assert(r.revealShown === 1, 'the Snaffle/Wander reveal shows');
  // idempotence: re-entering does not double-grant
  await page.evaluate(() => window.BooTown.go('hub'));
  await page.evaluate(() => window.BooTown.go('expedition', { trail: true }));
  await page.waitForSelector('.exp-trail', { timeout: 8000 });
  await page.waitForTimeout(300);
  const r2 = await page.evaluate(() => { const s = window.BooTown.State.getState(); return { wander: (s.inventory || {}).boo_wander || 0, reveal: document.querySelectorAll('.exp-reveal-overlay').length }; });
  assert(r2.wander === 1, 'Wander is not granted a second time');
  assert(r2.reveal === 0, 'the reveal does not replay');
}

await browser.close();
console.log('RESULT: ' + (failed ? 'FAIL' : 'PASS'));
process.exit(failed ? 1 : 0);
