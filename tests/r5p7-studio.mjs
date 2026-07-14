// tests/r5p7-studio.mjs — RUN5 phase 7 (C6): the Studio expansion.
// Acceptance (RUN5 part D #8): all four prop drawers present with their contents;
// sticker letters place and colour; duplicate and resize work; the guide places as a
// sticker; paint shows 24 colours; stamps and pattern fill function; new pages present
// with seasonal gating; a draft survives leaving and reopening.
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const SAVE = (over = {}) => Object.assign({
  version: 5, name: 'Ada',
  guide: { species: 'giraffe', body: 'lilac', pattern: 'spots', patternColour: 'indigo', eyes: 'round', acc: 'bow', name: 'Twiggy' },
  inventory: { boo_inky: 1, boo_plum: 1 }, boxes: 0, meter: 0, opened: 2, pity: { commons: 0 },
  nicknames: {}, equips: {}, catBest: {}, town: [], stars: { total: 60, byGame: {} },
  ledger: {}, settings: { sound: false, music: false, voice: false, content: 'full' },
  seen: { trophyRetro: true, studioSeen: true }, trophies: {}, ageAsked: true, age: 8
}, over);

const browser = await chromium.launch();
async function fresh(save, month = null) {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  if (month != null) await page.addInitScript((m) => { window.__bootownMonth = m; }, month);
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), save);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  return { ctx, page };
}

// ==================== collage: drawers, letters, duplicate/resize, guide ====================
console.log('== collage drawers ==');
{
  const { ctx, page } = await fresh(SAVE());
  await page.evaluate(() => window.BooTown.go('collage'));
  await page.waitForSelector('.collage-svg');
  await page.evaluate(() => window.__collage.drawer.open());   // RUN9 C1: content lives in the shared drawer now
  const drawers = await page.evaluate(() => window.__collage.drawers());
  const names = drawers.map(d => d.name);
  for (const want of ['Party', 'Seaside', 'Nature', 'Sparkle']) assert(names.includes(want), `the ${want} drawer is present`);
  const total = drawers.reduce((a, d) => a + d.n, 0);
  assert(total >= 34 && total <= 38, `props still ~36 after folding in Favourites (${total})`);
  // RUN9 C1: the shared drawer shows exactly the 8 specced tabs
  const tabs = await page.evaluate(() => window.__collage.tabs());
  assert(tabs.join('|') === 'Boos|Party|Seaside|Nature|Sparkle|Letters|Backgrounds|Text', `the 8 specced drawer tabs (${tabs.join('|')})`);
  // switching tabs swaps the visible props (only the active panel is shown)
  await page.evaluate(() => window.__collage.setDrawer(1));   // Seaside
  await sleep(60);
  const seasideProps = await page.$$eval('.bd-panel:not([hidden]) .collage-pick', ns => ns.map(n => n.textContent).join(''));
  assert(/🦀|🐚|🪣/.test(seasideProps), 'the Seaside tab shows its contents');

  // backgrounds gained bedroom / space / under-the-sea / white
  const bgs = await page.evaluate(() => window.__collage.backgrounds());
  for (const b of ['bedroom', 'space', 'undersea', 'white']) assert(bgs.includes(b), `background "${b}" present`);

  console.log('== sticker letters ==');
  await page.evaluate(() => window.__collage.drawer.showTab('letters'));
  await sleep(60);
  // pick the 2nd letter colour, add the letter B (both in the visible Letters panel)
  await page.click('.bd-panel:not([hidden]) .collage-letter-colours .letter-colour:nth-child(2)');
  await page.click('.bd-panel:not([hidden]) .collage-pick.letter:nth-child(2)');
  await sleep(120);
  let sel = await page.evaluate(() => window.__collage.selected());
  assert(sel && />B</.test(sel.inner), 'letter B placed as a sticker');
  assert(sel.inner.includes('#35D0BA'), 'the letter wears the chosen colour');

  console.log('== duplicate + resize + guide sticker ==');
  await page.evaluate(() => window.__collage.drawer.close());   // the sticker handles live above the drawer; close it to adjust a placed sticker
  await sleep(60);
  const before = await page.evaluate(() => window.__collage.count());
  await page.click('.collage-handles .ch-btn:has-text("Copy")');
  await sleep(120);
  const afterCopy = await page.evaluate(() => window.__collage.count());
  assert(afterCopy === before + 1, `duplicate adds a copy (${before} → ${afterCopy})`);
  const s0 = await page.evaluate(() => window.__collage.selected());
  await page.click('.collage-handles .ch-btn:has-text("Bigger")');
  await page.click('.collage-handles .ch-btn:has-text("Bigger")');
  const s1 = await page.evaluate(() => window.__collage.selected());
  assert(s1.scale > s0.scale, `resize works (scale ${s0.scale} → ${s1.scale})`);
  await page.click('.collage-handles .ch-btn:has-text("Turn")');
  const s2 = await page.evaluate(() => window.__collage.selected());
  assert(s2.rot !== s1.rot, 'rotate works');
  // the guide is the FIRST sticker chip in the Boo row (Boos tab)
  await page.evaluate(() => { window.__collage.drawer.showTab('boos'); window.__collage.drawer.open(); });
  await sleep(60);
  const nBefore = await page.evaluate(() => window.__collage.count());
  await page.click('.bd-panel:not([hidden]) .collage-pick');   // first pick in the Boos panel = guide
  await sleep(60);
  const guideAdd = await page.evaluate(() => window.__collage.count());
  assert(guideAdd === nBefore + 1, 'her own character places as a sticker (first chip in the Boo row)');
  await ctx.close();
}

// ==================== paint: 24 colours, stamps, pattern fill ====================
console.log('== paint palette + stamps + pattern ==');
{
  const { ctx, page } = await fresh(SAVE());
  await page.evaluate(() => window.BooTown.go('paint'));
  await page.waitForSelector('.paint-canvas');
  const swatchN = await page.$$eval('.paint-swatches .paint-swatch:not(.rainbow)', ns => ns.length);
  assert(swatchN === 24, `the palette doubles to 24 colours (${swatchN})`);
  // two rows: the swatch container wraps into (at least) two visual rows
  const rows = await page.$$eval('.paint-swatches .paint-swatch:not(.rainbow)', ns => new Set(ns.map(n => Math.round(n.getBoundingClientRect().top))).size);
  assert(rows >= 2, `the swatches sit in two rows (${rows})`);

  // stamps: a star stamp in the current colour actually paints pixels
  await page.evaluate(() => { window.__paint.setColour('#E63946'); window.__paint.stamp(200, 420, 'star'); });
  let px = await page.evaluate(() => window.__paint.pixel(200, 420));
  assert(px[0] > 180 && px[1] < 110, `the star stamp paints the current colour (rgb ${px.join(',')})`);
  await page.evaluate(() => window.__paint.stamp(120, 420, 'heart'));
  px = await page.evaluate(() => window.__paint.pixel(120, 424));
  assert(px[0] > 180 && px[1] < 110, 'the heart stamp paints too');

  // pattern fill: stripes colour SOME pixels in the region and leave others
  await page.evaluate(() => { window.__paint.draw('egg'); window.__paint.setColour('#118AB2'); window.__paint.pattern(320, 320, 'stripes', '#118AB2'); });
  const onPix = await page.evaluate(() => window.__paint.pixel(320, 320));   // (320+320)/26|0 = 24 → even → striped
  const offPix = await page.evaluate(() => window.__paint.pixel(320, 346)); // 666/26|0 = 25 → odd → untouched cream
  assert(onPix[2] > 140 && onPix[0] < 90, `stripe pixels take the colour (rgb ${onPix.join(',')})`);
  assert(offPix[0] > 230 && offPix[1] > 230, `between the stripes stays untouched (rgb ${offPix.join(',')})`);
  // polka dots
  await page.evaluate(() => { window.__paint.draw('egg'); window.__paint.pattern(320, 320, 'dots', '#9C27B0'); });
  const dotOn = await page.evaluate(() => window.__paint.pixel(320, 320));   // grid centre → dot
  const dotOff = await page.evaluate(() => window.__paint.pixel(331, 331)); // between dots
  assert(dotOn[0] > 100 && dotOn[2] > 120 && dotOn[1] < 90, `polka-dot pixels take the colour (rgb ${dotOn.join(',')})`);
  assert(dotOff[0] > 230 && dotOff[1] > 230, `between the dots stays untouched (rgb ${dotOff.join(',')})`);
  await ctx.close();
}

// ==================== paint: new pages + seasonal gating ====================
console.log('== new pages + seasonal gating ==');
{
  // July (summer): all the new core pages + the two summer pages, no winter/spooky
  const { ctx, page } = await fresh(SAVE(), 7);
  await page.evaluate(() => window.BooTown.go('paint'));
  await page.waitForSelector('.paint-canvas');
  const ids = await page.evaluate(() => window.__paint.templates());
  for (const want of ['twirl', 'snug', 'zippy', 'giraffe', 'puppy', 'kitten', 'penguin', 'bunny', 'slide', 'swings', 'bumper', 'campfire', 'town'])
    assert(ids.includes(want), `page "${want}" present`);
  assert(ids.includes('sunshine') && ids.includes('icelolly'), 'July shows the two summer pages');
  assert(!ids.includes('snowman') && !ids.includes('pumpkin'), 'no winter/spooky pages in July');
  // every page draws (outline pixels land on canvas without error)
  const allDraw = await page.evaluate(() => {
    for (const id of window.__paint.templates()) { window.__paint.draw(id); }
    return true;
  });
  assert(allDraw, 'every page draws without error');
  await ctx.close();
}
{
  // December (winter) + March (no season)
  const w = await fresh(SAVE(), 12);
  await w.page.evaluate(() => window.BooTown.go('paint'));
  await w.page.waitForSelector('.paint-canvas');
  const winter = await w.page.evaluate(() => window.__paint.templates());
  assert(winter.includes('snowman') && winter.includes('snowflake') && !winter.includes('sunshine'), 'December shows the winter pages only');
  await w.ctx.close();
  const m = await fresh(SAVE(), 3);
  await m.page.evaluate(() => window.BooTown.go('paint'));
  await m.page.waitForSelector('.paint-canvas');
  const none = await m.page.evaluate(() => window.__paint.templates());
  assert(!none.includes('sunshine') && !none.includes('snowman') && !none.includes('pumpkin'), 'March (no season) hides all seasonal pages');
  await m.ctx.close();
}

// ==================== drafts: leave, reopen, continue, save clears ====================
console.log('== drafts survive leaving ==');
{
  const { ctx, page } = await fresh(SAVE());
  await page.evaluate(() => window.BooTown.go('paint'));
  await page.waitForSelector('.paint-canvas');
  // paint something distinctive, then LEAVE mid-way (unmount stashes the draft)
  await page.evaluate(() => { window.__paint.setColour('#E63946'); window.__paint.fill(320, 300, '#E63946'); });
  assert(await page.evaluate(() => window.__paint.isDirty()), 'painting marks the canvas dirty');
  await page.evaluate(() => window.BooTown.go('studio'));
  await page.waitForSelector('.studio-grid');
  await sleep(700);   // the stash write is fire-and-forget on unmount
  // reopen: the draft chip appears; continuing restores the pixels
  await page.evaluate(() => window.BooTown.go('paint'));
  await page.waitForSelector('.paint-canvas');
  await page.waitForSelector('.draft-tmpl', { timeout: 4000 });
  assert(true, 'reopening Paint offers "Continue draft"');
  await page.click('.draft-tmpl');
  await sleep(500);
  const px = await page.evaluate(() => window.__paint.pixel(320, 300));
  assert(px[0] > 180 && px[1] < 110, `the draft restored her work (rgb ${px.join(',')})`);
  // the draft appears in the gallery with a badge, within the cap
  await page.evaluate(() => window.BooTown.go('gallery'));
  await page.waitForSelector('.gallery-grid');
  await page.waitForSelector('.gallery-draft-badge', { timeout: 4000 });
  assert(true, 'the draft shows in the gallery with a Draft badge (counts in the cap)');
  // saving properly clears the draft
  await page.evaluate(() => window.BooTown.go('paint', { draft: true }));
  await page.waitForSelector('.paint-canvas');
  await sleep(600);
  await page.evaluate(() => window.__paint.save());
  await sleep(600);
  assert(!(await page.evaluate(() => window.__paint.hasDraft())), 'saving to the gallery clears the draft');
  await page.evaluate(() => window.BooTown.go('gallery'));
  await page.waitForSelector('.gallery-grid');
  await sleep(300);
  const badges = await page.$$eval('.gallery-draft-badge', ns => ns.length);
  const tiles = await page.$$eval('.gallery-tile', ns => ns.length);
  assert(badges === 0 && tiles === 1, `the saved painting replaced the draft (${tiles} artwork, ${badges} drafts)`);
  await ctx.close();
}

await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
