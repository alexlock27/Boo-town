// tests/r3p8-social.mjs — RUN3 phase 8: Boo requests (D17) + Dance Choreographer (D18).
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const errors = []; let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const HOUR = 3600 * 1000;
// RUN10 P1: town is area-scoped (save.town.areas), and an area is 4 viewports wide, so x
// is kept small to stay within the default-scroll visible/animated window (was 0.5/0.52/0.55).
const SAVE = { version: 6, name: 'Ada', guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' }, inventory: { boo_inky: 1, boo_plum: 1 }, boxes: 0, meter: 0, opened: 2, pity: { commons: 0 }, nicknames: {}, equips: {}, catBest: {}, town: { areas: { meadow: { items: [{ zone: 'meadow', x: 0.1, row: 1, item: 'deco_stage' }, { zone: 'meadow', x: 0.12, row: 1, item: 'boo_inky' }, { zone: 'meadow', x: 0.15, row: 1, item: 'boo_plum' }], paths: [] }, riverside: { items: [], paths: [] }, hilltop: { items: [], paths: [] }, beach: { items: [], paths: [] }, funfair: { items: [], paths: [] }, playground: { items: [], paths: [] }, boohouse: { items: [], paths: [] }, gallery: { items: [], paths: [] } } }, stars: { total: 200, byGame: {} }, spellingMastery: {}, ledger: {}, trickyPile: [], golden: null, goldenLastDouble: '', quests: { day: '', list: [], done: [], progress: {}, boxDay: '' }, journal: {}, customs: [], studioSeen: false, easelArt: '', request: { active: null, lastResolvedAt: 0 }, routines: {}, settings: { sound: false, music: false, voice: false, mic: true, requests: true }, seen: { introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 }, trophyRetro: true }, trophies: { medal_stars_100: '2026-07-01', trophy_zones: '2026-07-01' } };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
const page = await ctx.newPage();
page.on('pageerror', e => errors.push('PE ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(m.text()); });
await page.goto(BASE + '/index.html', { waitUntil: 'load' });
await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE);
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('.hub');

const R = async (fn, arg) => page.evaluate(async ({ fn, arg }) => { const m = await import('./js/requests.js'); return (new Function('m', 'arg', `return m.${fn}`))(m, arg); }, { fn, arg });
const setNow = (t) => page.evaluate((t) => { window.__bootownNow = t; }, t);
const booIds = ['boo_inky', 'boo_plum'];
const open = () => page.evaluate((ids) => import('./js/requests.js').then(m => { m.checkRequestOpen(ids); return !!m.activeRequest(); }), booIds);
const active = () => page.evaluate(() => import('./js/requests.js').then(m => m.activeRequest()));

// ---- D17: request timing rules across a 3-day clock ----
// AMENDED BY RUN19 Z2 ("turn up the pulse"): the recharge is 3h, not 20h, and MAX_ACTIVE is
// 2, not 1. The old assertions here asserted the OLD contract, so they are restated rather
// than deleted — the 48h silent expiry, the +2 reward and the off switch are unchanged.
console.log('== D17: request timing (Z2 contract: 3h recharge, 2 at once) ==');
const T0 = 1000 * HOUR;   // arbitrary base
await setNow(T0);
const a1 = await open();
assert(a1, 'a request appears at app open (first time)');
// up to MAX_ACTIVE, and never a third
await open(); await open(); await open();
const count = await page.evaluate(() => import('./js/requests.js').then(m => m.activeRequests().length));
const cap = await page.evaluate(() => import('./js/requests.js').then(m => m.MAX_ACTIVE));
assert(cap === 2, 'MAX_ACTIVE is 2 (Z2)');
assert(count === cap, `the cap holds however many times an open fires (${count} active, cap ${cap})`);
// never two for the same Boo
const perBoo = await page.evaluate(() => import('./js/requests.js').then(m => {
  const ids = m.activeRequests().map(r => r.booId);
  return ids.length === new Set(ids).size;
}));
assert(perBoo, 'at most one request per Boo');
// fulfil one (whatever it is) via the matching event
const fulfilled = await page.evaluate(async () => {
  const m = await import('./js/requests.js');
  const a = m.activeRequests()[0];
  // craft the matching event for this request id — Z2's five verbs need a specific target,
  // so this fixture forces a generic RUN3 template to keep testing the RUN3 contract.
  window.BooTown.State.mutate(s => { s.request.actives = [{ id: 'box', booId: a.booId, text: 'Ooh, open a mystery box!', createdAt: m.nowMs() }]; });
  const before = window.BooTown.State.getState().meter;
  const res = m.noteRequest('boxOpen', {});
  return { res, meterDelta: window.BooTown.State.getState().meter - before, left: m.activeRequests().length };
});
assert(fulfilled.res.fulfilled && fulfilled.meterDelta === 2, 'fulfilling a request gives +2 meter and clears it');
assert(fulfilled.left === 0, 'the fulfilled request is gone');

// 3-hour rule: not before 3h since resolved (Z2 — was 20h)
await setNow(T0 + 2 * HOUR);
assert(!(await open()), 'no new request before 3h since the last resolved');
await setNow(T0 + 4 * HOUR);
assert(await open(), 'a new request may appear after 3h');

// 48-hour silent expiry. With MAX_ACTIVE=2 a fresh request can appear alongside the ageing
// one, so this tracks THAT request by its createdAt rather than asserting the list empties.
const T1 = await page.evaluate(() => import('./js/requests.js').then(m => m.activeRequest().createdAt));
await setNow(T1 + 47 * HOUR);
await open();
const stillThere = await page.evaluate((t) => import('./js/requests.js').then(m => m.activeRequests().some(r => r.createdAt === t)), T1);
assert(stillThere, 'a request is still active before 48h');
await setNow(T1 + 49 * HOUR);
await open();
const gone = await page.evaluate((t) => import('./js/requests.js').then(m => !m.activeRequests().some(r => r.createdAt === t)), T1);
assert(gone, 'an unfulfilled request expires silently after 48h');

// ---- D17: off switch ----
console.log('== D17: off switch ==');
await setNow(T1 + 200 * HOUR); // long past recharge
await page.evaluate(() => import('./js/requests.js').then(m => m.setRequestsEnabled(false)));
assert(!(await open()), 'with requests off, no new request appears');
const noneWhenOff = await active();
assert(!noneWhenOff, 'the off switch also clears any active request');
await page.evaluate(() => import('./js/requests.js').then(m => m.setRequestsEnabled(true)));

// ---- D18: choreographer saves per stage + survives reload ----
console.log('== D18: choreographer save/reload ==');
await page.evaluate(() => import('./js/choreographer.js').then(m => { const r = m.openChoreographer({ zone: 'meadow', x: 0.1 }); }));
await page.waitForSelector('.choreo-overlay');
await page.evaluate(() => { window.__choreo.add('bounce'); window.__choreo.add('spin'); window.__choreo.add('jump'); window.__choreo.save(); window.__choreo.close(); });
const saved = await page.evaluate(() => window.BooTown.State.getState().routines['meadow:0.1']);
assert(Array.isArray(saved) && saved.length === 3 && saved[0] === 'bounce', 'a routine saves for that stage (' + JSON.stringify(saved) + ')');
// per-stage: a different stage keeps its own (empty here)
const otherStage = await page.evaluate(() => window.BooTown.State.getState().routines['meadow:0.9']);
assert(!otherStage, 'routines are per stage (another stage has none)');
// survives reload
await page.reload({ waitUntil: 'load' }); await page.waitForSelector('.hub');
const afterReload = await page.evaluate(() => window.BooTown.State.getState().routines['meadow:0.1']);
assert(Array.isArray(afterReload) && afterReload.length === 3, 'the routine survives a reload');

// ---- D18: the routine loops (frame evidence — the move class cycles over time) ----
console.log('== D18: routine loops (frame evidence) ==');
await page.evaluate(() => window.BooTown.go('town'));
await page.waitForSelector('.town2');
await page.waitForTimeout(400);
const moveClasses = [];
for (let i = 0; i < 6; i++) {
  const cls = await page.$$eval('.t-item.boo svg', ns => ns.map(n => [...n.classList].find(c => c.startsWith('move-')) || 'none'));
  moveClasses.push(cls.join(','));
  await page.waitForTimeout(760);
}
const distinct = new Set(moveClasses);
assert(distinct.size >= 3, 'dancing Boos cycle through moves over time (frames: ' + JSON.stringify(moveClasses) + ')');
const anyMove = moveClasses.some(f => /move-/.test(f));
assert(anyMove, 'Boos on the stage actually perform routine moves');

console.log('\n== errors ==');
if (errors.length) console.log(errors.map(e => '  ! ' + e).join('\n'));
assert(errors.length === 0, 'no JS console errors');
await browser.close();
console.log('\n' + (failed ? 'RESULT: FAIL' : 'RESULT: PASS'));
process.exit(failed ? 1 : 0);
