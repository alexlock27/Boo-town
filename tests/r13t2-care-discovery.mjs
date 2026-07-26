// RUN13 T2 — care presentation and discovery.
//
// Three things are proved here: the flourish now says how the friendship is going and what
// is in the pocket (hearts row + treats count + a label under every icon); the first time a
// child opens Boo Care for ANY Boo the guide teaches it in three skippable steps, once per
// save, with a "?" replay; and the first time any Boo reaches two hearts the collection
// screen says once — and only once — that the ritual is not reserved for that one Boo.
//
// The contrast check at the end is the same pixel technique as r12s4-contrast (render
// twice, once with every glyph transparent, and sample the REAL pixel under the text),
// scoped to the surfaces this packet added. Care is an overlay, not a route, so the
// route-walking contrast audit never sees it.
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdirSync } from 'fs';

const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const SHOTS = 'screenshots/run13/t2';
mkdirSync(SHOTS, { recursive: true });
let failed = false;
const ok = (c, m) => { console.log(c ? `  ✓ ${m}` : `  ✗ FAIL: ${m}`); if (!c) failed = true; };

const BOOS = ['boo_inky', 'boo_pippin', 'boo_wisp', 'boo_plum', 'boo_beam', 'boo_peppy'];
const TODAY = (d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)(new Date());
const AREAS = () => Object.fromEntries(['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground', 'boohouse', 'gallery']
  .map(k => [k, { items: [], paths: [] }]));
const VIEWPORTS = [
  { name: '1024x768', width: 1024, height: 768 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '390x844', width: 390, height: 844 }
];

function save({ boo = 'boo_inky', treats = 3, points = 0, introSeen = true, careAnyHint = false } = {}) {
  const areas = AREAS();
  areas.meadow.items.push({ zone: 'meadow', x: .12, row: 1, item: boo });
  const seen = { boohouseSeeded: true, trophyRetro: true, introSeen: introSeen ? { care: true } : {} };
  if (careAnyHint) seen.careAnyHint = true;
  return {
    version: 7, name: 'Ada',
    guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'Twiggy' },
    inventory: Object.fromEntries(BOOS.map(id => [id, 1])),
    stars: { total: 100, byGame: {} }, meter: 0, boxes: 0, opened: 2, pity: { commons: 0 },
    town: { areas }, nicknames: {}, equips: {}, catBest: {}, ledger: {},
    delights: { hideDay: TODAY, hideFound: true },
    care: { bonds: { [boo]: points }, treats },
    settings: { sound: false, music: false, voice: false, content: 'full' },
    seen, trophies: {}, journal: {}, age: 8, ageAsked: true
  };
}

const browser = await chromium.launch();
async function open(opts = {}, { width = 1024, height = 768 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.addInitScript(s => { localStorage.setItem('bootown.save.v1', JSON.stringify(s)); }, save(opts));
  await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
  await page.waitForSelector('.hub');
  return { ctx, page };
}
async function inTown(page) {
  await page.evaluate(() => window.BooTown.go('town', { area: 'meadow' }));
  await page.waitForFunction(() => window.__townLife);
}

console.log('== the flourish states the friendship, the pocket and every action by name ==');
{
  for (const vp of VIEWPORTS) {
    const { ctx, page } = await open({ points: 30, treats: 4 }, vp);
    await inTown(page);
    await page.click('.t-item.boo');
    await page.waitForSelector('.town-care-arc');
    await page.waitForTimeout(1500);          // the icons stagger in at 260ms each
    const arc = await page.evaluate(() => {
      const a = document.querySelector('.town-care-arc');
      const actions = [...a.querySelectorAll('.town-care-action')];
      const meta = a.querySelector('.town-care-meta');
      const overlaps = (p, q) => !(p.right <= q.left || q.right <= p.left || p.bottom <= q.top || q.bottom <= p.top);
      const boxes = [...actions, meta, a.querySelector('.town-care-manage')].filter(Boolean).map(n => n.getBoundingClientRect());
      let collisions = 0;
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) if (overlaps(boxes[i], boxes[j])) collisions++;
      return {
        count: actions.length,
        labels: actions.map(b => ({
          label: b.querySelector('small')?.textContent || '',
          truncated: (b.querySelector('small')?.scrollWidth || 0) > (b.querySelector('small')?.clientWidth || 0) + 1
        })),
        hearts: a.querySelectorAll('.town-care-meta .care-hearts i').length,
        filled: a.querySelectorAll('.town-care-meta .care-hearts i.filled').length,
        treatsText: a.querySelector('.town-care-treats')?.textContent || '',
        metaLabel: meta?.getAttribute('aria-label') || '',
        collisions,
        inViewport: [...actions, meta].filter(Boolean).every(n => {
          const r = n.getBoundingClientRect();
          return r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight;
        })
      };
    });
    ok(arc.count === 5, `${vp.name}: five care actions in the flourish`);
    ok(arc.labels.length === 5 && arc.labels.every(l => l.label.trim()), `${vp.name}: every icon carries a label (${arc.labels.map(l => l.label).join('/')})`);
    ok(arc.labels.every(l => !l.truncated), `${vp.name}: no label is truncated`);
    ok(arc.hearts === 5, `${vp.name}: the bond hearts row is inline in the flourish`);
    ok(arc.filled === 3, `${vp.name}: it shows the right number of hearts for 30 points (3)`);
    ok(/🍪\s*4/.test(arc.treatsText), `${vp.name}: the treats count is inline (${arc.treatsText.trim()})`);
    ok(/friendship hearts/.test(arc.metaLabel) && /treats/.test(arc.metaLabel), `${vp.name}: the pill has an accessible name`);
    ok(arc.collisions === 0, `${vp.name}: nothing in the flourish overlaps anything else`);
    ok(arc.inViewport, `${vp.name}: the whole flourish is on screen`);
    await page.screenshot({ path: `${SHOTS}/flourish-${vp.name}.png` });
    await ctx.close();
  }
}

console.log('== the collection card care row carries the same labels ==');
{
  for (const vp of VIEWPORTS) {
    const { ctx, page } = await open({ points: 30 }, vp);
    await page.evaluate(() => window.BooTown.go('collection'));
    await page.waitForSelector('.coll-tile.owned');
    await page.click('.coll-tile.owned');
    await page.waitForSelector('.collection-care-box');
    const row = await page.evaluate(() => {
      const box = document.querySelector('.collection-care-box');
      const btns = [...box.querySelectorAll('.care-summary-action')];
      return {
        count: btns.length,
        labels: btns.map(b => b.querySelector('small')?.textContent || ''),
        truncated: btns.filter(b => {
          const s = b.querySelector('small');
          return s && s.scrollWidth > s.clientWidth + 1;
        }).length,
        overflowing: btns.filter(b => b.getBoundingClientRect().right > innerWidth + 1).length,
        hearts: box.querySelectorAll('.care-hearts i').length,
        treats: /🍪/.test(box.textContent)
      };
    });
    ok(row.count === 5, `${vp.name}: the card offers all five actions`);
    ok(row.labels.every(l => l.trim()), `${vp.name}: every card action is labelled (${row.labels.join('/')})`);
    ok(row.truncated === 0, `${vp.name}: no card label is truncated`);
    ok(row.overflowing === 0, `${vp.name}: no card action runs off the screen`);
    ok(row.hearts === 5 && row.treats, `${vp.name}: the card still shows hearts and the pocket`);
    await page.screenshot({ path: `${SHOTS}/card-care-row-${vp.name}.png` });
    await ctx.close();
  }
}

console.log('== the three-step intro runs once per save, and "?" replays it ==');
{
  const { ctx, page } = await open({ introSeen: false });
  await inTown(page);
  await page.click('.t-item.boo');
  await page.click('.town-care-action.action-teeth');
  await page.waitForSelector('.care-overlay.open');
  await page.waitForSelector('.intro-overlay.show', { timeout: 5000 });
  const intro = await page.evaluate(() => ({ game: window.__intro.game, total: window.__intro.total, step: window.__intro.step() }));
  ok(intro.game === 'care' && intro.total === 3, `the care intro is three steps (${intro.total})`);
  const stack = await page.evaluate(() => {
    const io = document.querySelector('.intro-overlay'), co = document.querySelector('.care-overlay');
    return { intro: +getComputedStyle(io).zIndex, care: +getComputedStyle(co).zIndex };
  });
  ok(stack.intro > stack.care, `the teaching overlay sits above the care overlay (${stack.intro} > ${stack.care})`);
  ok(await page.locator('.intro-skip').count() === 1, 'a Skip control is always there');
  // RUN12 S6's law: the intro must not run the thing it is explaining behind its own back.
  ok(await page.evaluate(() => window.__care.active()) === null, 'the chosen action waits behind the intro');
  await page.screenshot({ path: `${SHOTS}/intro-step1-1024x768.png` });
  await page.click('.intro-next');
  await page.click('.intro-next');
  await page.click('.intro-next');
  await page.waitForFunction(() => !document.querySelector('.intro-overlay'), { timeout: 4000 });
  await page.waitForFunction(() => window.__care.active() === 'teeth', { timeout: 4000 });
  ok(true, 'when the teaching finishes, the action she chose starts');
  ok(await page.evaluate(() => JSON.parse(localStorage.getItem('bootown.save.v1')).seen.introSeen.care === true),
    'the save records that the intro has been seen');

  // Second open, same save: no intro.
  await page.evaluate(() => window.__care.close());
  await page.waitForTimeout(300);
  await page.click('.t-item.boo');
  await page.click('.town-care-action.action-brush');
  await page.waitForSelector('.care-overlay.open');
  await page.waitForTimeout(700);
  ok(await page.locator('.intro-overlay').count() === 0, 'it never fires a second time in the same save');
  ok(await page.evaluate(() => window.__care.active()) === 'brush', 'and the action starts straight away');

  // …but the "?" replays it on demand.
  ok(await page.locator('.care-help').count() === 1, 'the care panel carries a "?" replay control');
  await page.click('.care-help');
  await page.waitForSelector('.intro-overlay.show', { timeout: 4000 });
  ok(await page.evaluate(() => window.__intro.total) === 3, 'the "?" replays the same three steps');
  await page.click('.intro-skip');
  await page.waitForFunction(() => !document.querySelector('.intro-overlay'), { timeout: 4000 });
  ok(await page.evaluate(() => !document.body.classList.contains('care-teaching')), 'closing the replay tidies up after itself');
  await ctx.close();
}

console.log('== the "you can care for any Boo" hint, once, at two hearts ==');
{
  const early = await open({ points: 5 });     // one heart
  await early.page.evaluate(() => window.BooTown.go('collection'));
  await early.page.waitForSelector('.coll-tile.owned');
  ok(await early.page.locator('.coll-care-hint').count() === 0, 'nothing is said before a Boo reaches two hearts');
  await early.ctx.close();

  const { ctx, page } = await open({ points: 12 });   // two hearts (LEVELS[1] = 10)
  await page.evaluate(() => window.BooTown.go('collection'));
  await page.waitForSelector('.coll-care-hint', { timeout: 5000 });
  const text = await page.locator('.coll-care-hint').textContent();
  ok(/any/i.test(text), `the hint says the ritual is not reserved for one Boo ("${text.replace(/Got it!$/, '').trim()}")`);
  ok(!/must|should|need to|forgot|neglect/i.test(text), 'and it asks nothing of her — no guilt, no chore');
  await page.screenshot({ path: `${SHOTS}/care-any-hint-1024x768.png` });
  await page.click('.coll-care-hint-ok');
  ok(await page.locator('.coll-care-hint').count() === 0, 'it can be dismissed');
  await page.evaluate(() => window.BooTown.go('hub'));
  await page.evaluate(() => window.BooTown.go('collection'));
  await page.waitForSelector('.coll-tile.owned');
  await page.waitForTimeout(400);
  ok(await page.locator('.coll-care-hint').count() === 0, 'and it never comes back');
  await ctx.close();
}

console.log('== contrast law: every surface this packet added reaches AA ==');
{
  const lum = (r, g, b) => {
    const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const ratio = (a, b) => { const x = lum(...a), y = lum(...b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const HIDE = `(() => { const s = document.createElement('style'); s.id='__hide';
    s.textContent = '*, *::before, *::after { color: transparent !important; -webkit-text-fill-color: transparent !important; }';
    document.head.appendChild(s); })()`;
  const SELECTORS = ['.town-care-meta', '.town-care-action small', '.care-help', '.care-status',
    '.care-action small', '.care-summary-action small', '.coll-care-hint', '.coll-care-hint-ok'];
  const COLLECT = sel => `(() => {
    const out = [];
    for (const el of document.querySelectorAll(${JSON.stringify(sel.join(','))})) {
      const t = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
      if (!t || !/[A-Za-z0-9]/.test(t)) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || r.right <= 0 || r.bottom <= 0) continue;
      const p = (s) => (String(s).match(/[0-9.]+/g)||[]).slice(0,4).map(Number);
      const size = parseFloat(cs.fontSize) || 16, weight = parseInt(cs.fontWeight,10) || 400;
      out.push({ sel: el.className || el.tagName, text: t.slice(0,28), colour: p(cs.color).slice(0,3),
        x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), h: Math.round(r.height),
        large: size >= 24 || (size >= 18 && weight >= 700) });
    }
    return out; })()`;

  for (const vp of VIEWPORTS) {
    const { ctx, page } = await open({ points: 12, treats: 4, introSeen: true }, vp);
    await inTown(page);
    await page.click('.t-item.boo');
    await page.waitForSelector('.town-care-meta');
    await page.waitForTimeout(1600);
    await page.click('.town-care-action.action-teeth');
    await page.waitForSelector('.care-overlay.open');
    await page.waitForTimeout(900);
    const nodes = await page.evaluate(COLLECT(SELECTORS));
    const before = await page.screenshot();
    await page.evaluate(HIDE);
    await page.waitForTimeout(160);
    const after = await page.screenshot();
    const A = await sharp(before).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const B = await sharp(after).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width: W, height: H, channels: CH } = B.info;
    const at = (o, x, y) => { const i = (y * W + x) * CH; return [o.data[i], o.data[i + 1], o.data[i + 2]]; };
    const near = (p, q, tol) => Math.abs(p[0] - q[0]) <= tol && Math.abs(p[1] - q[1]) <= tol && Math.abs(p[2] - q[2]) <= tol;
    let judged = 0;
    const bad = [];
    for (const n of nodes) {
      let worst = Infinity, glyphPixels = 0;
      for (let y = Math.max(0, n.y + 1); y < Math.min(H, n.y + n.h - 1); y++) {
        for (let x = Math.max(0, n.x + 1); x < Math.min(W, n.x + n.w - 1); x++) {
          const b = at(B, x, y);
          if (near(at(A, x, y), b, 10)) continue;     // unchanged with glyphs off: not a glyph
          glyphPixels++;
          const c = ratio(n.colour, b);
          if (c < worst) worst = c;
        }
      }
      if (!glyphPixels) continue;                     // nothing measurable (an emoji-only node)
      judged++;
      const need = n.large ? 3 : 4.5;
      if (worst < need) bad.push(`${n.sel} "${n.text}" ${worst.toFixed(2)}:1 (needs ${need})`);
    }
    ok(judged > 0, `${vp.name}: ${judged} of this packet's labels were measurable against real pixels`);
    ok(bad.length === 0, `${vp.name}: every new label reaches AA${bad.length ? ' — ' + bad.join('; ') : ''}`);
    await ctx.close();
  }
}

await browser.close();
console.log(`\nRESULT: ${failed ? 'FAIL' : 'PASS'}`);
process.exit(failed ? 1 : 0);
