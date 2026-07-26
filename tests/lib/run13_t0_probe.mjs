// RUN13 T0 — one-shot care audit probe. Lives under tests/lib/ so it is OUTSIDE the
// tests/*.mjs board glob: T0 is an audit packet and must move no counters.
// Drives every care action at all three viewports and dumps a machine-readable record
// that tests/run13_care_audit.md is written from. NO fixes here.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, readFileSync } from 'fs';

const BASE = process.env.BASE || 'http://127.0.0.1:8123';
const OUT = 'screenshots/run13/t0';
mkdirSync(OUT, { recursive: true });

const BOOS = ['boo_inky', 'boo_pippin', 'boo_wisp', 'boo_plum', 'boo_beam', 'boo_peppy'];
const TODAY = (d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)(new Date());
const AREAS = () => Object.fromEntries(['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground', 'boohouse', 'gallery']
  .map(k => [k, { items: [], paths: [] }]));

function save({ boo = 'boo_inky', treats = 5, points = 0, content = 'full' } = {}) {
  const areas = AREAS();
  areas.meadow.items.push({ zone: 'meadow', x: .12, row: 1, item: boo });
  return {
    version: 7, name: 'Ada',
    guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'Twiggy' },
    inventory: Object.fromEntries(BOOS.map(id => [id, 1])),
    stars: { total: 100, byGame: {} }, meter: 0, boxes: 0, opened: 2, pity: { commons: 0 },
    town: { areas }, nicknames: {}, equips: {}, catBest: {}, ledger: {},
    delights: { hideDay: TODAY, hideFound: true },
    care: { bonds: { [boo]: points }, treats },
    settings: { sound: false, music: false, voice: false, content },
    seen: { boohouseSeeded: true, trophyRetro: true }, trophies: {}, journal: {},
    age: content === 'toddler' ? 4 : 8, ageAsked: true
  };
}

const VIEWPORTS = [
  { name: '1024x768', width: 1024, height: 768 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '390x844', width: 390, height: 844 }
];
const ACTIONS = ['feed', 'brush', 'teeth', 'play'];

const browser = await chromium.launch();
const record = { viewports: {}, static: {} };

// ---- static source facts (grep-level, recorded not fixed) -------------------
{
  const care = readFileSync('js/care.js', 'utf8');
  const css = readFileSync('css/styles.css', 'utf8');
  record.static.arrowGlyphsInCare = (care.match(/text:\s*'[←→↑↓]'/g) || []);
  record.static.stepButtonClasses = (care.match(/class:\s*'care-scrub[^']*'/g) || []);
  record.static.pointerHandlersInCare = (care.match(/addEventListener\('pointer\w+'/g) || []).length;
  record.static.hasProgressRing = /care-ring|progress-ring/.test(care) || /care-ring/.test(css);
  record.static.constants = {
    strokesToComplete: (care.match(/strokes\s*>=\s*(\d+)/) || [])[1] || null,
    scrubsToComplete: (care.match(/scrubs\s*>=\s*(\d+)/) || [])[1] || null,
    strokeDistancePx: (care.match(/dragDistance\s*>=\s*(\d+)/) || [])[1] || null
  };
}

async function open(page, { boo, treats, points, content } = {}) {
  await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), save({ boo, treats, points, content }));
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  await page.evaluate(() => window.BooTown.go('town', { area: 'meadow' }));
  await page.waitForFunction(() => window.__townLife);
}

for (const vp of VIEWPORTS) {
  const vrec = { entry: {}, actions: {} };

  // --- entry point: the town care flourish ---
  {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    await open(page, {});
    await page.click('.t-item.boo');
    await page.waitForTimeout(1300);
    vrec.entry.arcActions = await page.locator('.town-care-action').count();
    vrec.entry.arcLabels = await page.evaluate(() =>
      [...document.querySelectorAll('.town-care-action')].map(b => ({
        aria: b.getAttribute('aria-label'), text: b.textContent.trim(),
        hasVisibleLabel: !!b.querySelector('small'),
        w: Math.round(b.getBoundingClientRect().width), h: Math.round(b.getBoundingClientRect().height)
      })));
    vrec.entry.showsHearts = await page.locator('.town-care-arc .care-hearts').count();
    vrec.entry.showsTreats = await page.evaluate(() => /🍪/.test(document.querySelector('.town-care-arc')?.textContent || ''));
    await page.screenshot({ path: `${OUT}/entry-arc-${vp.name}.png` });
    await ctx.close();
  }

  // --- collection card care row ---
  {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    await open(page, {});
    await page.evaluate(() => window.BooTown.go('collection'));
    await page.waitForSelector('.coll-tile.owned', { timeout: 5000 });
    await page.click('.coll-tile.owned');
    await page.waitForSelector('.collection-care-box', { timeout: 5000 });
    vrec.entry.cardCareButtons = await page.evaluate(() =>
      [...document.querySelectorAll('.care-summary-action')].map(b => ({
        aria: b.getAttribute('aria-label'), text: b.textContent.trim(),
        hasVisibleLabel: !!b.querySelector('small'),
        truncated: b.scrollWidth > b.clientWidth + 1,
        w: Math.round(b.getBoundingClientRect().width)
      })));
    vrec.entry.cardShowsHearts = await page.locator('.collection-care-box .care-hearts').count();
    vrec.entry.cardShowsTreats = await page.evaluate(() => /🍪/.test(document.querySelector('.collection-care-box')?.textContent || ''));
    await page.screenshot({ path: `${OUT}/entry-card-${vp.name}.png`, fullPage: false });
    await ctx.close();
  }

  // --- every action, driven for real ---
  for (const action of ACTIONS) {
    const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await open(page, { treats: 5 });
    await page.click('.t-item.boo');
    await page.click(`.town-care-action.action-${action}`);
    await page.waitForSelector('.care-overlay.open');
    await page.waitForFunction(a => window.__care && window.__care.active() === a, action);

    const a = { errors };
    a.statusOnOpen = (await page.locator('.care-status').textContent()).trim();
    a.controls = await page.evaluate(() => [...document.querySelectorAll('.care-panel .care-stage button, .care-panel .care-stage [role="button"]')]
      .map(b => ({ cls: b.className, text: b.textContent.trim(), aria: b.getAttribute('aria-label') })));
    a.stageNodes = await page.evaluate(() => [...document.querySelectorAll('.care-stage > *')].map(n => n.className));
    a.pointerZones = await page.evaluate(() => [...document.querySelectorAll('.care-stage *')]
      .filter(n => n.className && /pad|drag|target/.test(String(n.className)))
      .map(n => String(n.className)));
    a.hasProgressRing = await page.locator('.care-ring, .care-progress').count();
    a.hasDraggableTool = await page.evaluate(() => !!document.querySelector('.care-brush, .care-toothbrush, .care-sponge'));

    // 6-frame motion sample over 3s + a first-feedback latency probe
    const frames = [];
    const t0 = Date.now();
    let firstFeedbackMs = null;
    for (let i = 0; i < 6; i++) {
      await page.waitForTimeout(520);
      const sig = await page.evaluate(() => ({
        boo: document.querySelector('.care-boo')?.className || '',
        status: document.querySelector('.care-status')?.textContent || '',
        particles: document.querySelectorAll('.care-particle').length
      }));
      frames.push(sig);
      if (firstFeedbackMs === null && (sig.particles > 0 || sig.boo !== 'care-boo')) firstFeedbackMs = Date.now() - t0;
      await page.screenshot({ path: `${OUT}/${action}-${vp.name}-f${i}.png` });
    }
    a.frames = frames;
    a.firstFeedbackMs = firstFeedbackMs;
    a.distinctBooClasses = [...new Set(frames.map(f => f.boo))].length;

    // drive the action to completion the way a child would, per action
    if (action === 'brush') {
      const box = await page.locator('.care-brush-pad').boundingBox();
      if (box) {
        await page.mouse.move(box.x + 40, box.y + box.height / 2);
        await page.mouse.down();
        for (let i = 1; i <= 12; i++) await page.mouse.move(box.x + 40 + i * 20, box.y + box.height / 2 + (i % 2 ? 6 : -6));
        await page.mouse.up();
      }
      a.strokesFromRealDrag = await page.evaluate(() => window.__care.strokes());
    }
    if (action === 'teeth') {
      a.arrowButtons = await page.evaluate(() => [...document.querySelectorAll('.care-scrub')].map(b => ({
        cls: b.className, text: b.textContent.trim(), aria: b.getAttribute('aria-label'),
        w: Math.round(b.getBoundingClientRect().width), h: Math.round(b.getBoundingClientRect().height)
      })));
      // a child dragging the toothbrush instead of tapping the arrows:
      const brush = await page.locator('.care-toothbrush').boundingBox();
      if (brush) {
        await page.mouse.move(brush.x + brush.width / 2, brush.y + brush.height / 2);
        await page.mouse.down();
        for (let i = 1; i <= 10; i++) await page.mouse.move(brush.x + brush.width / 2 + i * 12, brush.y + brush.height / 2);
        await page.mouse.up();
      }
      a.scrubsFromRealDrag = await page.evaluate(() => window.__care.scrubs());
      // and the arrows, tapped out of order (the wrong-side rule)
      await page.click('.care-scrub.right').catch(() => {});
      a.scrubsAfterWrongSideTap = await page.evaluate(() => window.__care.scrubs());
    }
    if (action === 'play') {
      a.peekTargets = await page.locator('.care-peek-target').count();
    }
    if (action === 'feed') {
      a.treatDraggable = await page.evaluate(() => {
        const t = document.querySelector('.care-flying-treat');
        return t ? { animatedOnly: !t.onpointerdown, cls: t.className } : null;
      });
    }

    a.pointsAfter = await page.evaluate(() => window.__care.points());
    a.finalStatus = (await page.locator('.care-status').textContent()).trim();
    vrec.actions[action] = a;
    await ctx.close();
  }

  record.viewports[vp.name] = vrec;
}

// --- G9 probe: a 30-day absence ---
{
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await ctx.newPage();
  await open(page, { points: 30 });
  record.absence = await page.evaluate(async () => {
    const { migrate } = await import('./js/state.js');
    const old = JSON.parse(localStorage.getItem('bootown.save.v1'));
    old.lastPlayed = Date.now() - 30 * 86400000;
    const before = JSON.stringify(old.care);
    const after = JSON.stringify(migrate(structuredClone(old)).care);
    return { before, after, identical: before === after };
  });
  await ctx.close();
}

await browser.close();
writeFileSync('screenshots/run13/t0/probe.json', JSON.stringify(record, null, 2));
console.log(JSON.stringify(record, null, 2));
