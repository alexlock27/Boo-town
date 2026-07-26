// RUN13 T4 — furniture and decor expansion.
//
// Twenty-four new kind:'furniture' items. Every one of them must: exist in the catalogue
// with a real rarity, draw its own artwork (not the renderDeco fallback blob), place in a
// Boo House room, persist under that room's storage key, and land in the correct lane —
// the wall band for `wall:true`, a floor row for everything else.
//
// Two carry live behaviour and are checked as such: the photo frame shows a REAL owned Boo
// and follows the best friend when that changes; the wall clock shows the device time and
// re-reads it on its tick. Both lamps light at night alongside the original.
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'fs';

const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const SHOTS = 'screenshots/run13/t4';
mkdirSync(SHOTS, { recursive: true });
let failed = false;
const ok = (c, m) => { console.log(c ? `  ✓ ${m}` : `  ✗ FAIL: ${m}`); if (!c) failed = true; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// The twenty-four, authored exactly as the brief lists them.
const NEW_ITEMS = [
  'deco_photoframe',
  'deco_rug2', 'deco_rug3',
  'deco_armchair',
  'deco_bookshelf2', 'deco_bookshelf3',
  'deco_counter', 'deco_fridge', 'deco_oven', 'deco_kitchentable', 'deco_stool',
  'deco_bunkbed', 'deco_wardrobe2',
  'deco_lamp2', 'deco_floorlamp',
  'deco_plant1', 'deco_plant2', 'deco_plant3',
  'deco_wallclock', 'deco_mirror', 'deco_toybox',
  'deco_wallart1', 'deco_wallart2', 'deco_wallart3'
];
const ROOM_FOR = {
  deco_counter: 'kitchen', deco_fridge: 'kitchen', deco_oven: 'kitchen',
  deco_kitchentable: 'kitchen', deco_stool: 'kitchen',
  deco_bunkbed: 'bedroom', deco_wardrobe2: 'bedroom'
};
const BOOS = ['inky', 'plum', 'pippin', 'lolly'].map(n => 'boo_' + n);
const TODAY = (d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)(new Date());
const AREA_KEYS = ['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground', 'boohouse', 'gallery',
  'boohouse_kitchen', 'boohouse_bedroom'];

function SAVE(over = {}) {
  return Object.assign({
    version: 15, name: 'Ada', ageAsked: true, age: 8,
    guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
    inventory: Object.assign(Object.fromEntries(BOOS.map(b => [b, 1])),
      Object.fromEntries(NEW_ITEMS.map(id => [id, 2]))),
    boxes: 0, meter: 0, opened: 6, pity: { commons: 0 },
    nicknames: {}, equips: {}, catBest: {}, stars: { total: 300, byGame: {} }, ledger: {},
    town: { areas: Object.fromEntries(AREA_KEYS.map(k => [k, { items: [], paths: [] }])) },
    care: { bonds: {}, treats: 3 },
    settings: { sound: false, music: false, voice: false, content: 'full', requests: false },
    seen: { boohouseSeeded: true, funfairOpened: 'x', introSeen: { care: true }, trophyRetro: true, townFirst: true },
    delights: { hideDay: TODAY, hideFound: true }, trophies: {}, journal: {}
  }, over);
}

const browser = await chromium.launch();
async function openRoom(room, { save, hour = 13, minute = 20, w = 1024, h = 768 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.addInitScript(([hr, mn]) => { window.__bootownHour = hr; window.__bootownMinute = mn; }, [hour, minute]);
  await page.addInitScript(s => { localStorage.setItem('bootown.save.v1', s); }, JSON.stringify(save || SAVE()));
  await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
  await page.waitForSelector('.hub');
  await page.evaluate(r => window.BooTown.go('town', { area: 'boohouse', room: r }), room);
  await page.waitForSelector('.town2');
  await page.waitForFunction(() => window.__townLife, { timeout: 6000 });
  await sleep(420);
  return { ctx, page };
}

console.log('== the catalogue really gained all twenty-four ==');
{
  const src = readFileSync('data/catalogue.js', 'utf8');
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.addInitScript(s => { localStorage.setItem('bootown.save.v1', s); }, JSON.stringify(SAVE()));
  await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
  await page.waitForSelector('.hub');
  const cat = await page.evaluate(async ids => {
    const { BY_ID, COLLECTIBLES } = await import('./data/catalogue.js');
    return ids.map(id => {
      const it = BY_ID[id];
      return it ? { id, kind: it.kind, rarity: it.rarity, wall: !!it.wall, name: it.name, blurb: it.blurb, deco: it.deco, inPool: COLLECTIBLES.some(c => c.id === id) } : null;
    });
  }, NEW_ITEMS);
  ok(cat.every(Boolean), `every one of the ${NEW_ITEMS.length} ids exists in the catalogue`);
  ok(cat.every(i => i && i.kind === 'furniture'), 'every new item is kind:"furniture" (so it is indoor-only)');
  ok(cat.every(i => i && ['common', 'rare', 'ultra'].includes(i.rarity)), 'every new item carries an established rarity');
  ok(cat.every(i => i && i.name && i.blurb && i.blurb.length > 10), 'every new item is named and has a blurb');
  ok(cat.every(i => i && i.inPool), 'every new item joins the collectible pool (box drops at decoration odds)');
  const walls = cat.filter(i => i.wall).map(i => i.id);
  // Nine hang: the photo frame, two bookshelves, the hanging ivy, the clock, the mirror
  // and the three pictures. Everything else stands on a floor row.
  ok(walls.length === 9, `nine of them hang on the wall (${walls.length}: ${walls.map(w => w.replace('deco_', '')).join(', ')})`);
  // The pool bucket: furniture rolls under 'deco' odds, never as its own type.
  const bucket = await page.evaluate(async () => {
    const { BY_TYPE_RARITY } = await import('./data/catalogue.js');
    return Object.keys(BY_TYPE_RARITY || {});
  });
  ok(!bucket.includes('furniture'), `furniture is not its own roll type (${bucket.join(', ')})`);
  // Each item draws its OWN art: no two share markup, and none falls through to the blob.
  const art = await page.evaluate(async ids => {
    const { renderDeco } = await import('./js/art.js');
    const { BY_ID } = await import('./data/catalogue.js');
    const fallback = renderDeco({ deco: '__nope__', name: 'x' }, { size: 120 });
    return ids.map(id => ({ id, svg: renderDeco(BY_ID[id], { size: 120 }), isFallback: renderDeco(BY_ID[id], { size: 120 }) === fallback }));
  }, NEW_ITEMS);
  ok(art.every(a => !a.isFallback), `no item falls through to renderDeco's default blob (${art.filter(a => a.isFallback).map(a => a.id).join(', ') || 'none'})`);
  ok(new Set(art.map(a => a.svg)).size === NEW_ITEMS.length, 'all twenty-four drawings are distinct');
  ok(art.every(a => /viewBox="0 0 120 130"/.test(a.svg)), 'all of them share the house 120x130 deco viewBox');
  ok(art.every(a => /aria-label=/.test(a.svg)), 'all of them carry an accessible name');
  ok(!/<image|xlink:href|url\(http/i.test(src), 'the catalogue references no image files (inline SVG only)');
  await ctx.close();
}

console.log('== every new item places, persists, and lands in the right lane ==');
{
  for (const room of ['lounge', 'kitchen', 'bedroom']) {
    const ids = NEW_ITEMS.filter(id => (ROOM_FOR[id] || 'lounge') === room);
    const { ctx, page } = await openRoom(room);
    let placed = 0;
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];
      const wall = await page.evaluate(async d => (await import('./data/catalogue.js')).BY_ID[d].wall === true, id);
      // Wall items go to the wall band, floor items to the floor band; spread along x so
      // the minimum-spacing rule never refuses one for being on top of the last.
      const fx = 0.08 + (i % 8) * 0.11;
      await page.evaluate(([d, x, y]) => { window.__townLife.forceHold(d); window.__townLife.placeAt(x, y); },
        [id, fx, wall ? 0.22 : 0.78]);
      await sleep(90);
      const there = await page.evaluate(d => document.querySelectorAll(`.t-item[data-item="${d}"]`).length, id);
      if (there) placed++;
      else ok(false, `${room}: ${id} refused to place`);
    }
    ok(placed === ids.length, `${room}: all ${ids.length} of its items placed (${placed})`);
    // Persisted under THIS room's storage key, in the right lane.
    const key = room === 'lounge' ? 'boohouse' : `boohouse_${room}`;
    await page.waitForFunction(([k, n]) => {
      const s = JSON.parse(localStorage.getItem('bootown.save.v1') || '{}');
      return (((s.town.areas[k] || {}).items) || []).length >= n;
    }, [key, ids.length], { timeout: 6000 }).catch(() => {});
    const lanes = await page.evaluate(async ([k, list]) => {
      const { BY_ID } = await import('./data/catalogue.js');
      const s = JSON.parse(localStorage.getItem('bootown.save.v1'));
      const items = ((s.town.areas[k] || {}).items) || [];
      return list.map(id => {
        const t = items.find(x => x.item === id);
        return { id, stored: !!t, row: t ? t.row : null, wall: !!BY_ID[id].wall };
      });
    }, [key, ids]);
    ok(lanes.every(l => l.stored), `${room}: all of them persisted under ${key}`);
    ok(lanes.filter(l => l.wall).every(l => l.row === 3), `${room}: every wall item is in the wall row (row 3)`);
    ok(lanes.filter(l => !l.wall).every(l => l.row >= 0 && l.row <= 2), `${room}: every floor item is in a floor row (0-2)`);
    await page.screenshot({ path: `${SHOTS}/placed-${room}-1024x768.png` });
    await ctx.close();
  }
}

console.log('== the photo frame shows a real Boo, and follows the best friend ==');
{
  const save = SAVE({
    town: { areas: Object.assign(Object.fromEntries(AREA_KEYS.map(k => [k, { items: [], paths: [] }])),
      { boohouse: { items: [{ zone: 'boohouse', x: .4, row: 3, item: 'deco_photoframe' }], paths: [] } }) }
  });
  const { ctx, page } = await openRoom('lounge', { save });
  const first = await page.evaluate(() => window.__townLife.photoBoo());
  ok(!!first && /^boo_/.test(first), `the frame shows a real owned Boo (${first})`);
  ok(await page.locator('.t-photo-frame .t-photo-inner svg').count() === 1, 'and actually draws it, inside the frame');
  // Stable: a re-render must not shuffle the face.
  await page.evaluate(() => window.__townLife.assignRoles());
  await sleep(200);
  ok(await page.evaluate(() => window.__townLife.photoBoo()) === first, 'the same frame keeps showing the same friend');
  await page.screenshot({ path: `${SHOTS}/photoframe-random-1024x768.png` });
  // Now make someone the best friend: the frame must switch to her.
  const target = BOOS.find(b => b !== first) || BOOS[1];
  await page.evaluate(async id => {
    const { addBond } = await import('./js/care.js');
    addBond(id, 'feed', 100);
    window.BooTown.go('hub');
  }, target);
  await page.evaluate(() => window.BooTown.go('town', { area: 'boohouse', room: 'lounge' }));
  await page.waitForFunction(() => window.__townLife, { timeout: 6000 });
  await sleep(420);
  const after = await page.evaluate(() => window.__townLife.photoBoo());
  ok(after === target, `the frame switches to the best friend when there is one (${after})`);
  await page.screenshot({ path: `${SHOTS}/photoframe-bestfriend-1024x768.png` });
  await ctx.close();
}

console.log('== the wall clock shows the device time, and keeps showing it ==');
{
  const save = SAVE({
    town: { areas: Object.assign(Object.fromEntries(AREA_KEYS.map(k => [k, { items: [], paths: [] }])),
      { boohouse: { items: [{ zone: 'boohouse', x: .5, row: 3, item: 'deco_wallclock' }], paths: [] } }) }
  });
  const { ctx, page } = await openRoom('lounge', { save, hour: 3, minute: 0 });
  const at3 = await page.evaluate(() => window.__townLife.clockHandsMarkup());
  ok(!!at3 && at3.includes('<line'), 'the clock draws two hands');
  // 3:00 — the minute hand points straight up, the hour hand to the right.
  const nums = at3.match(/x2="([\d.]+)" y2="([\d.]+)"/g) || [];
  ok(nums.length === 2, `two hand endpoints (${nums.length})`);
  await page.evaluate(() => { window.__bootownHour = 9; window.__bootownMinute = 30; });
  const at930 = await page.evaluate(() => window.__townLife.tickClocks());
  ok(at930 !== at3, 'the hands move when the device time moves on');
  const geom = await page.evaluate(() => {
    const g = document.querySelector('.clock-hands');
    const lines = [...g.querySelectorAll('line')].map(l => ({ x: +l.getAttribute('x2'), y: +l.getAttribute('y2') }));
    return lines;
  });
  // 9:30 — the minute hand points straight DOWN (y2 well below the 60 centre).
  ok(geom.some(l => l.y > 75 && Math.abs(l.x - 60) < 3), `at half past, the big hand points down (${JSON.stringify(geom)})`);
  await page.screenshot({ path: `${SHOTS}/wallclock-0930-1024x768.png` });
  await ctx.close();
}

console.log('== both new lamps light at night, beside the original ==');
{
  const items = ['deco_tablelamp', 'deco_lamp2', 'deco_floorlamp']
    .map((id, i) => ({ zone: 'boohouse', x: .2 + i * .22, row: 1, item: id }));
  const save = SAVE({
    inventory: Object.assign(SAVE().inventory, { deco_tablelamp: 1 }),
    town: { areas: Object.assign(Object.fromEntries(AREA_KEYS.map(k => [k, { items: [], paths: [] }])),
      { boohouse: { items, paths: [] } }) }
  });
  const day = await openRoom('lounge', { save, hour: 13 });
  ok((await day.page.evaluate(() => window.__townLife.litLamps())).length === 0, 'no lamp is lit in the daytime');
  await day.page.screenshot({ path: `${SHOTS}/lamps-day-1024x768.png` });
  await day.ctx.close();
  const night = await openRoom('lounge', { save, hour: 22 });
  const lit = await night.page.evaluate(() => window.__townLife.litLamps());
  ok(lit.length === 3, `all three lamps light at night (${lit.join(', ')})`);
  const glow = await night.page.evaluate(() =>
    [...document.querySelectorAll('.t-item.lit .lamp-glow')].map(n => getComputedStyle(n).opacity));
  ok(glow.length === 3 && glow.every(o => +o === 1), `and each one's glow really comes up (${glow.join(', ')})`);
  await night.page.screenshot({ path: `${SHOTS}/lamps-night-1024x768.png` });
  await night.ctx.close();
}

console.log('== art review sheet: every new item at two zooms ==');
{
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.addInitScript(s => { localStorage.setItem('bootown.save.v1', s); }, JSON.stringify(SAVE()));
  await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
  await page.waitForSelector('.hub');
  for (const zoom of [96, 180]) {
    // Size the sheet to the zoom so nothing is clipped: this is a REVIEW artefact and a
    // half-cropped item is not reviewed.
    await page.setViewportSize({ width: Math.min(2000, 6 * (zoom + 46) + 40), height: 900 });
    const built = await page.evaluate(async ([ids, size]) => {
      const { renderDeco } = await import('./js/art.js');
      const { BY_ID } = await import('./data/catalogue.js');
      document.body.innerHTML = `<div id="sheet" style="display:grid;grid-template-columns:repeat(6,1fr);gap:14px;padding:18px;background:#F2D6B8;font:700 12px system-ui;color:#2A1B4E">` +
        ids.map(id => `<div style="text-align:center;background:#FFF8F0;border:3px solid #2A1B4E;border-radius:14px;padding:8px">
          ${renderDeco(BY_ID[id], { size })}<div>${BY_ID[id].name}</div></div>`).join('') + `</div>`;
      return document.querySelectorAll('#sheet svg').length;
    }, [NEW_ITEMS, zoom]);
    ok(built === NEW_ITEMS.length, `the ${zoom}px sheet drew all ${NEW_ITEMS.length} items (${built})`);
    await page.screenshot({ path: `${SHOTS}/art-sheet-${zoom}px.png`, fullPage: true });
  }
  await ctx.close();
}

await browser.close();
console.log(`\nRESULT: ${failed ? 'FAIL' : 'PASS'}`);
process.exit(failed ? 1 : 0);
