// Focused RUN10 P6 check: room navigation, readable playfields, per-hit performer
// reaction, press-paced lane and no interactive overlap at desktop/phone sizes.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
mkdirSync('screenshots/r10p6', { recursive: true });
let failed = false;
const ok = (c, m) => { console.log(c ? `  ✓ ${m}` : `  ✗ FAIL: ${m}`); if (!c) failed = true; };
const SAVE = {
  version: 6, name: 'Ada',
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'Twiggy' },
  inventory: { boo_inky: 1, boo_plum: 1, boo_pippin: 1, boo_beam: 1 },
  stars: { total: 300, byGame: {} }, meter: 0, boxes: 0, opened: 1, pity: { commons: 0 },
  town: { areas: {} }, nicknames: {}, equips: {}, catBest: {}, ledger: {}, delights: {},
  settings: { sound: false, music: false, voice: false, content: 'full' },
  seen: {}, age: 8, ageAsked: true
};
const browser = await chromium.launch();

async function pageAt(width, height) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  return { ctx, page };
}

console.log('== Band Room: six clear scene cards ==');
{
  const { ctx, page } = await pageAt(1024, 768);
  await page.evaluate(() => window.BooTown.go('band'));
  await page.waitForSelector('.band-room-grid');
  const cards = await page.evaluate(() => window.__bandRoom.cards());
  ok(cards.length === 6, `six destinations render (${cards.join(', ')})`);
  await page.screenshot({ path: 'screenshots/r10p6/bandroom-1024x768.png' });
  await ctx.close();
}

console.log('== Instrument scenes: hit reaction and zero interactive overlap ==');
for (const [route, selector] of [
  ['band-drums', '.p6-drum-pad'],
  ['band-keys', '.p6-key'],
  ['band-guitar', '.p6-strum-zone'],
  ['band-xylophone', '.p6-xylo-bar']
]) {
  const { ctx, page } = await pageAt(1024, 768);
  await page.evaluate(r => window.BooTown.go(r), route);
  await page.waitForSelector(selector);
  await page.click(selector);
  const reacted = await page.evaluate(() => window.__bandScene.performerPlayed());
  ok(reacted, `${route} makes its Boo performer react`);
  const overlaps = await page.evaluate(() => {
    const els = [...document.querySelectorAll('button, [role="button"]')].filter(n => {
      const r = n.getBoundingClientRect(), s = getComputedStyle(n);
      return s.visibility !== 'hidden' && s.display !== 'none' && r.width > 0 && r.height > 0;
    });
    const bad = [];
    for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
      const a = els[i].getBoundingClientRect(), b = els[j].getBoundingClientRect();
      const area = Math.max(0, Math.min(a.right,b.right)-Math.max(a.left,b.left)) * Math.max(0, Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
      if (area > 8) bad.push([els[i].className, els[j].className, area]);
    }
    return bad;
  });
  ok(overlaps.length === 0, `${route} has no overlapping interactive controls`);
  await ctx.close();
}

console.log('== Keys play-along: lane stays above keys and waits for the correct press ==');
{
  const { ctx, page } = await pageAt(390, 844);
  await page.evaluate(() => window.BooTown.go('band-keys', { song: 'twinkle' }));
  await page.waitForSelector('.p6-key');
  const before = await page.evaluate(() => ({ wanted: window.__bandScene.wantedKey(), pos: window.__bandScene.songPosition() }));
  const wrong = (before.wanted + 1) % 10;
  await page.click(`.p6-key[data-idx="${wrong}"]`);
  const held = await page.evaluate(() => window.__bandScene.songPosition());
  await page.click(`.p6-key[data-idx="${before.wanted}"]`);
  const advanced = await page.evaluate(() => window.__bandScene.songPosition());
  const boxes = await page.evaluate(() => ({ lane: window.__bandScene.laneBox(), field: window.__bandScene.playfieldBox() }));
  ok(held === before.pos, 'a wrong key does not advance the sparkle');
  ok(advanced === before.pos + 1, 'the correct key advances exactly once');
  ok(boxes.lane.bottom <= boxes.field.top + 1, 'the sparkle lane never overlaps the keys');
  await page.screenshot({ path: 'screenshots/r10p6/keys-playalong-390x844.png' });
  await ctx.close();
}

console.log('== Songs: authored library is separate from the playfield ==');
{
  const { ctx, page } = await pageAt(390, 844);
  await page.evaluate(() => window.BooTown.go('band-songs'));
  await page.waitForSelector('.band-song-list');
  const n = await page.evaluate(() => window.__bandSongs.count());
  ok(n === 7, `three little songs + four pop hits render (${n})`);
  await page.screenshot({ path: 'screenshots/r10p6/songs-390x844.png' });
  await ctx.close();
}

await browser.close();
console.log(`\nRESULT: ${failed ? 'FAIL' : 'PASS'}`);
process.exit(failed ? 1 : 0);
