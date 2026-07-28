// tests/r18b-shop-handoff.mjs — RUN18B Y2: the shop handoff.
//
// "Find it in Build." was a set of DIRECTIONS, not a door: it told a child where the thing
// had gone and left her to get there. The confirmation card now offers the verb the thing
// wants and takes her there with the item already selected in the right drawer tab.
//
// The load-bearing assertion is the mapping one: EVERY purchasable id on EVERY shelf gets
// the verb and destination its kind deserves, checked against the shop's own stock rather
// than a list kept in step by hand. A wearable can never render a Build line.
//
// Expected runtime: ~14s (measured). Not @serial.

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { SHELVES } from '../data/shop.js';
import { BY_ID } from '../data/catalogue.js';

const RAW = process.env.BASE || 'http://127.0.0.1:8000';
const BASE = RAW.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
const RESOLVE = ['--host-resolver-rules=MAP app.localhost 127.0.0.1'];
const SHOTS = 'screenshots/run18b/y2';
mkdirSync(SHOTS, { recursive: true });
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };

const AK = ['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground', 'boohouse', 'gallery'];
const save = () => JSON.stringify({
  version: 17, name: 'Ada', ageAsked: true,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1, boo_plum: 1 },
  stars: { total: 2000, byType: { maths: 500, word: 500, puzzle: 500, creative: 500, lesson: 500 }, spent: {}, legacy: 500, byGame: {} },
  trophies: {}, boxes: 0,
  town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 3 },
  shop: { welcomed: true },
  seen: { trophyRetro: true, lastStarsShown: 2000, introSeen: { shop: true }, whatsnewVersion: 'x' },
  settings: { sound: false, music: false, voice: false, content: 'full' }
});

const browser = await chromium.launch({ args: RESOLVE });
const errors = [];
async function open(route = 'shop', params = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e).split('\n')[0]));
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), save());
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => window.BooTown && document.getElementById('screen').dataset.screen, null, { timeout: 20000 });
  await page.evaluate(([r, p]) => window.BooTown.go(r, p), [route, params]);
  await page.waitForFunction(r => document.getElementById('screen').dataset.screen === r, route, { timeout: 15000 });
  await page.waitForTimeout(500);
  return { ctx, page };
}

// ---- 1. every purchasable id maps kind -> verb + destination ----------------------------
console.log('== 1. every id on every shelf gets the right verb ==');
{
  const { ctx, page } = await open();
  const stock = SHELVES.flatMap(sh => sh.items.map(([id]) => ({ id, shelf: sh.id, kind: (BY_ID[id] || {}).kind })));
  const mapped = await page.evaluate(async (list) => {
    const { useVerbFor } = await import('./js/shop.js');
    return list.map(x => { const v = useVerbFor(x.id, x.shelf); return { ...x, label: v.label, to: v.to, line: v.line('NAME') }; });
  }, stock);
  assert(mapped.length >= 45, `walked every purchasable id on every shelf (${mapped.length})`);
  assert(mapped.every(m => m.kind), 'every shelf id resolves to a catalogue item with a kind');

  const wrong = mapped.filter(m => {
    if (m.shelf === 'special') return m.to !== 'town-meadow' || !/something truly special/.test(m.line);
    if (m.kind === 'furniture') return m.to !== 'house-lounge' || !/Pop it in a room\?$/.test(m.line);
    if (m.kind === 'accessory') return m.to !== 'dress' || m.label !== 'Dress a Boo';
    return m.to !== 'town-here' || !/Where shall it go\?$/.test(m.line);
  });
  assert(wrong.length === 0, 'every id maps to the verb and destination its kind deserves'
    + (wrong.length ? ': ' + JSON.stringify(wrong.slice(0, 3)) : ''));

  // the authored copy, character for character
  const lines = await page.evaluate(async () => {
    const { USE_VERBS } = await import('./js/shop.js');
    return Object.fromEntries(Object.entries(USE_VERBS).map(([k, v]) => [k, { line: v.line('Round Rug'), label: v.label }]));
  });
  assert(lines.furniture.line === 'Round Rug is yours! Pop it in a room?', `furniture: "${lines.furniture.line}"`);
  assert(lines.place.line === 'Round Rug is yours! Where shall it go?', `deco/landscape/playground: "${lines.place.line}"`);
  assert(lines.accessory.line === "Round Rug is yours! Who's wearing it?", `accessory: "${lines.accessory.line}"`);
  assert(lines.special.line === 'Round Rug is yours — something truly special! Where will it live?', `special: "${lines.special.line}"`);
  assert(lines.furniture.label === 'Take me there' && lines.place.label === 'Take me there'
    && lines.special.label === 'Take me there' && lines.accessory.label === 'Dress a Boo', 'the button labels are the authored ones');

  // A WEARABLE CAN NEVER RENDER A BUILD LINE.
  const wearables = mapped.filter(m => m.kind === 'accessory');
  assert(wearables.length > 0, `${wearables.length} wearables on the shelves`);
  assert(wearables.every(m => !/Build|room|go\?|live\?/.test(m.line)), 'and not one of them is ever offered a Build destination');
  await ctx.close();
}

// ---- 2. the card carries both buttons, [Not now] second ---------------------------------
console.log('== 2. the card offers the verb, and the way out is second ==');
{
  const { ctx, page } = await open();
  const r = await page.evaluate(async () => {
    const t = [...document.querySelectorAll('.bd-tabs .bd-tab')].find(x => /House/.test(x.textContent));
    if (t) t.click();
    await new Promise(res => setTimeout(res, 250));
    const buy = [...document.querySelectorAll('.shop-shelf[data-shelf="house"] .sc-buy')].find(b => b.textContent === 'Buy');
    const name = buy.closest('.shop-card').querySelector('.sc-name').textContent;
    buy.click();
    await new Promise(res => setTimeout(res, 300));
    const card = document.querySelector('.shop-bought .sb-card');
    const btns = [...card.querySelectorAll('.sb-actions .btn')];
    return { name, line: card.querySelector('.sb-line').textContent, labels: btns.map(b => b.textContent), n: btns.length };
  });
  assert(r.n === 2, `two buttons (${r.n})`);
  assert(r.labels[1] === 'Not now', `and "Not now" is ALWAYS second (got ${JSON.stringify(r.labels)})`);
  assert(!/Find it in Build/.test(r.line), `the old directions are gone — the card asks a question: "${r.line}"`);
  await page.screenshot({ path: SHOTS + '/bought-card.png' });
  await ctx.close();
}

// ---- 3. the jump lands in build mode, right tab, item selected --------------------------
console.log('== 3. both jump routes land ready to place ==');
for (const [label, params, wantTab] of [
  ['outdoors (deco)', { area: 'meadow', build: true, place: 'deco_bench' }, 'Decorations'],
  ['indoors (furniture)', { area: 'boohouse', room: 'lounge', build: true, place: 'deco_armchair' }, 'Furniture']
]) {
  const { ctx, page } = await open('town', params);
  await page.waitForTimeout(900);
  const r = await page.evaluate(() => {
    const root = document.querySelector('.town2');
    const tabs = [...document.querySelectorAll('.bd-tabs .bd-tab')];
    const sel = tabs.find(t => t.classList.contains('sel') || t.getAttribute('aria-selected') === 'true');
    const held = document.querySelector('.drawer-item.holding');
    return {
      building: !!(root && root.classList.contains('building')),
      tab: sel ? sel.textContent.replace(/\s*\(\d+\)\s*$/, '') : null,
      selected: held ? held.dataset.item : null,
      drawerOpen: !!document.querySelector('.build-drawer.open, .bd-open, [class*="drawer"].open')
    };
  });
  assert(r.building, `${label}: she arrives IN build mode`);
  assert(r.tab === wantTab, `${label}: the drawer is on the item's own tab ("${r.tab}")`);
  assert(r.selected === params.place, `${label}: and the thing she just bought is selected ("${r.selected}")`);
  await page.screenshot({ path: `${SHOTS}/jump-${params.area}.png` });
  await ctx.close();
}

// ---- 4. "where shall it go?" means where she came in from -------------------------------
console.log('== 4. the outdoor jump goes back to the area she came from ==');
{
  const { ctx, page } = await open('shop', { fromArea: 'hilltop' });
  const dest = await page.evaluate(async () => {
    const t = [...document.querySelectorAll('.bd-tabs .bd-tab')].find(x => /Town/.test(x.textContent));
    if (t) t.click();
    await new Promise(res => setTimeout(res, 250));
    // Scope to the TOWN shelf: every shelf's cards live in the DOM at once, so an
    // unscoped query buys whatever the first shelf happens to be selling.
    const buy = [...document.querySelectorAll('.shop-shelf[data-shelf="town"] .sc-buy')].find(b => b.textContent === 'Buy');
    buy.click();
    await new Promise(res => setTimeout(res, 300));
    document.querySelector('.shop-bought .sb-actions .sb-go').click();
    await new Promise(res => setTimeout(res, 900));
    const s = window.BooTown.State.getState();
    return { screen: document.getElementById('screen').dataset.screen, title: (document.querySelector('.town2 h2') || {}).textContent };
  });
  assert(dest.screen === 'town', `it lands in the town (${dest.screen})`);
  assert(/hill/i.test(dest.title || ''), `and in the area she came in FROM, not a default ("${dest.title}")`);
  await ctx.close();
}

console.log(errors.length ? '\nPAGE ERRORS: ' + errors.slice(0, 5).join(' | ') : '\nno page errors');
if (errors.length) failed = true;
await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
