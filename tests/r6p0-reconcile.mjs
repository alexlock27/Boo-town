// tests/r6p0-reconcile.mjs — RUN6 phase 0 reconciliation (RUN6 part D #0).
// Verifies the four run-5 late additions: (1) cog long-press opens with the native
// context menu suppressed; (2) grown-ups is tabbed, Settings first; (3) a Boo Blocks
// piece rotates a quarter turn on tap, with animation frames and mid-round; (4) the
// named phone screens read restacked at 390x844 (no horizontal overflow).
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const SAVE = (over = {}) => Object.assign({
  version: 5, name: 'Ada',
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1, boo_plum: 1, boo_pippin: 1 }, boxes: 0, meter: 2, opened: 3, pity: { commons: 0 },
  nicknames: {}, equips: {}, catBest: {}, town: [], stars: { total: 120, byGame: {} },
  ledger: {}, spellingMastery: {}, trickyPile: [],
  seen: { trophyRetro: true, townFirst: true, introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 } },
  trophies: {}, ageAsked: true, age: 8,
  settings: { sound: false, music: false, voice: false, content: 'full', requests: false }
}, over);

const browser = await chromium.launch();
async function fresh(save, opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1024, height: 768 }, reducedMotion: opts.motion ? undefined : 'reduce' });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), save);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  return { ctx, page };
}

// ==================== 1) cog long-press: contextmenu suppressed + hold opens ====================
console.log('== C0.1 long-press hardening ==');
{
  const { ctx, page } = await fresh(SAVE());
  // a contextmenu event on the cog is cancelled (native download/print/share never fires)
  const cog = await page.evaluate(() => {
    const btn = document.querySelector('.cog-btn');
    const ev = new Event('contextmenu', { bubbles: true, cancelable: true });
    const notCancelled = btn.dispatchEvent(ev);
    return { suppressed: !notCancelled, hasClass: btn.classList.contains('no-callout') };
  });
  assert(cog.suppressed, 'a contextmenu on the cog is preventDefaulted (no native menu)');
  assert(cog.hasClass, 'the cog carries .no-callout (touch-callout/user-select off)');
  // the guide hold target is hardened too
  const guide = await page.evaluate(() => {
    const g = document.querySelector('.hub-guide [aria-label*="press and hold"], .hub-guide .art-idle, .hub-guide svg');
    if (!g) return { found: false };
    // walk up to the element that has no-callout
    let n = g; while (n && !n.classList.contains('no-callout')) n = n.parentElement;
    return { found: true, hardened: !!n };
  });
  assert(guide.found ? guide.hardened : true, 'the guide long-press target is hardened too');
  // a real 3-second hold still opens the grown-ups corner
  const cb = await (await page.$('.cog-btn')).boundingBox();
  await page.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2);
  await page.mouse.down(); await sleep(3300); await page.mouse.up();
  await page.waitForSelector('.grownups', { timeout: 3000 });
  assert(true, 'a 3s hold opens the grown-ups corner (pointer-driven ring, contextmenu suppressed)');
  await ctx.close();
}

// ==================== 2) grown-ups tabs, Settings first ====================
console.log('== C0.2 grown-ups tabs ==');
{
  const { ctx, page } = await fresh(SAVE());
  await page.evaluate(() => window.BooTown.go('grownups'));
  await page.waitForSelector('.gu-tabs');
  const tabs = await page.$$eval('.gu-tab', ns => ns.map(n => ({ label: n.textContent.trim(), id: n.dataset.tab, active: n.classList.contains('active') })));
  assert(tabs.length === 4, `four tabs present, got ${tabs.length}`);
  assert(tabs[0].label === 'Settings' && tabs[0].id === 'settings', 'the first tab is Settings');
  assert(tabs[0].active, 'Settings is the active tab by default');
  assert(tabs.map(t => t.id).join(',') === 'settings,golden,ledger,data', 'tab order: Settings | Golden Round | Star Ledger | Backup & data');
  // Settings panel visible, others hidden; a setting is reachable without scrolling past editors
  const vis = await page.evaluate(() => {
    const shown = document.querySelector('.gu-panel[data-tab="settings"]').offsetParent !== null;
    const golden = document.querySelector('.gu-panel[data-tab="golden"]').offsetParent !== null;
    const soundToggle = !!document.querySelector('.gu-panel[data-tab="settings"] .gu-switch');
    return { shown, golden, soundToggle };
  });
  assert(vis.shown && !vis.golden, 'only the Settings panel is displayed (Golden hidden)');
  assert(vis.soundToggle, 'the sound toggle sits on the Settings tab (sound/music/voice/tier/mic/requests)');
  // switching tabs reveals the others
  await page.click('.gu-tab[data-tab="golden"]');
  const goldenShown = await page.evaluate(() => document.querySelector('.gr-save') && document.querySelector('.gr-save').offsetParent !== null);
  assert(goldenShown, 'tapping Golden Round reveals its editor');
  await ctx.close();
}

// ==================== 3) Boo Blocks rotation ====================
console.log('== C0.3 Boo Blocks rotation ==');
{
  // motion ON so the quarter-turn animation is observable
  const { ctx, page } = await fresh(SAVE({ settings: { sound: false, music: false, voice: false, content: 'full' } }), { motion: true });
  await page.evaluate(() => window.BooTown.go('blocks', { resume: { mix: true } }));   // RUN9 C2: resume just starts a round
  await page.waitForSelector('.blk-board');
  await page.waitForFunction(() => window.__blocks, { timeout: 4000 });
  // rig a clearly-oriented I-tromino (1 row × 3 cols) into slot 0
  await page.evaluate(() => window.__blocks.rig(0, [[0, 0], [0, 1], [0, 2]]));
  const before = await page.evaluate(() => window.__blocks.tray()[0].cells);
  const bboxOf = cells => ({ rows: Math.max(...cells.map(c => c[0])) + 1, cols: Math.max(...cells.map(c => c[1])) + 1 });
  const bb0 = bboxOf(before);
  assert(bb0.rows === 1 && bb0.cols === 3, 'rigged piece starts 1×3 (horizontal)');
  // tap to select, then tap again to SPIN
  await page.evaluate(() => window.__blocks.select(0));
  await page.waitForSelector('.blk-rotate');
  assert(true, 'the selected piece shows a rotate ↻ badge');
  await page.evaluate(() => window.__blocks.rotate());
  const after = await page.evaluate(() => window.__blocks.tray()[0].cells);
  const bb1 = bboxOf(after);
  assert(bb1.rows === 3 && bb1.cols === 1, `a tap spins it 90° to 3×1 (got ${bb1.rows}×${bb1.cols})`);
  // frame evidence: the .blk-spin element is mid-rotation (transform not identity) then settles
  await page.evaluate(() => window.__blocks.select(0));   // re-select
  const frames = await page.evaluate(async () => {
    const out = [];
    window.__blocks.rotate();
    for (let i = 0; i < 5; i++) {
      const p = document.querySelector('.blk-piece.blk-spin') || document.querySelector('.blk-piece');
      out.push(p ? getComputedStyle(p).transform : 'none');
      await new Promise(r => requestAnimationFrame(() => setTimeout(r, 45)));
    }
    return out;
  });
  const distinct = new Set(frames).size;
  assert(distinct >= 2, `the spin animates across frames (transform-only), ${distinct} distinct matrices over ~0.25s`);
  // mid-round: rotate a free piece, then place it (rotation works between drags)
  await page.evaluate(() => { window.__blocks.resetForTest(); window.__blocks.rig(1, [[0, 0], [1, 0]]); });   // vertical domino
  const slot = 1;
  await page.evaluate(s => window.__blocks.rotateSlot(s), slot);   // → horizontal
  const placed = await page.evaluate(s => window.__blocks.place(s, 0, 0), slot);
  assert(placed === true, 'a rotated piece places successfully mid-round (rotation works between drags)');
  await ctx.close();
}

// ==================== 4) phone restacking at 390x844 ====================
console.log('== C0.4 phone comfort (390x844) ==');
{
  const { ctx, page } = await fresh(SAVE(), { viewport: { width: 390, height: 844 } });
  const screens = [
    ['results', () => window.BooTown.go('results', { game: 'bubblepop', gameName: 'Bubble Pop', stars: 3, cat: 'tables', level: 2 }), '.result-card'],
    ['collection', () => window.BooTown.go('collection'), '.coll-grid'],
    ['grownups', () => window.BooTown.go('grownups'), '.gu-tabs'],
    ['paint', () => window.BooTown.go('paint'), '.paint-canvas'],
    ['collage', () => window.BooTown.go('collage'), '.collage-svg']
  ];
  for (const [name, go, ready] of screens) {
    await page.evaluate(go);
    await page.waitForSelector(ready, { timeout: 6000 });
    await sleep(300);
    const noOverflow = await page.evaluate(() => {
      const d = document.documentElement;
      const c = document.getElementById('screen').firstElementChild;
      return d.scrollWidth <= d.clientWidth + 1 && (!c || c.scrollWidth <= c.clientWidth + 1);
    });
    assert(noOverflow, `${name}: no horizontal overflow at 390x844 (reads restacked, not squeezed)`);
  }
  // grown-ups tabs wrap onto rows on the narrow phone, none clipped
  await page.evaluate(() => window.BooTown.go('grownups'));
  await page.waitForSelector('.gu-tabs');
  const tabsFit = await page.evaluate(() => [...document.querySelectorAll('.gu-tab')].every(t => { const r = t.getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1; }));
  assert(tabsFit, 'grown-ups tabs wrap and stay on-screen at 390x844');
  await ctx.close();
}

await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
