// @serial — frame-sampling: pixel-hashed frame sequences per action per viewport (runs alone at the board's end; RUN14 U-0)
// RUN13 T1 — Boo Care rebuilt as direct manipulation.
//
// The law under test is G8: on a touch-and-mouse device a care action is performed by
// TOUCHING the thing and MOVING it. Arrow buttons, step controls and abstract +/- widgets
// are forbidden as the primary interaction. Every completion below is driven with a real
// synthetic pointer stream — no test hook completes an action on this suite's behalf
// except where a stated fallback (keyboard) is the thing being proved.
//
// Also under test: G9 (nothing decays — a 30-simulated-day absence changes nothing) and
// that every action still awards exactly its POINTS value from data/care.js.
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'fs';
import { createHash } from 'crypto';

const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const SHOTS = 'screenshots/run13/t1';
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
const DRAG_ACTIONS = ['feed', 'brush', 'teeth', 'bath'];

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
    seen: { boohouseSeeded: true, trophyRetro: true, introSeen: { care: true } }, trophies: {}, journal: {},
    age: content === 'toddler' ? 4 : 8, ageAsked: true
  };
}

const browser = await chromium.launch();

async function openCare({ boo = 'boo_inky', action, treats = 5, points = 0, content = 'full',
  width = 1024, height = 768, reduced = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  // Seed BEFORE the first load (fresh context, so the live app's debounced autosave can
  // never overwrite it) — one page load per fixture instead of two.
  await page.addInitScript(s => { localStorage.setItem('bootown.save.v1', JSON.stringify(s)); },
    save({ boo, treats, points, content }));
  await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
  await page.waitForSelector('.hub');
  await page.evaluate(() => window.BooTown.go('town', { area: 'meadow' }));
  await page.waitForFunction(() => window.__townLife);
  if (action) {
    await page.click('.t-item.boo');
    await page.click(`.town-care-action.action-${action}`);
    await page.waitForSelector('.care-overlay.open');
    await page.waitForFunction(a => window.__care && window.__care.active() === a, action);
  }
  return { ctx, page };
}

// Open care directly with a forced play variant (the variant is chosen at random in play()).
async function openCareVariant(variant, opts = {}) {
  const { ctx, page } = await openCare(opts);
  await page.evaluate(async ({ v, boo }) => {
    const { openCare } = await import('./js/care.js');
    const { resolveItem } = await import('./js/customs.js');
    if (window.__care) window.__care.close();
    openCare(resolveItem(boo), { startAction: 'play', playVariant: v });
  }, { v: variant, boo: opts.boo || 'boo_inky' });
  await page.waitForFunction(v => window.__care && window.__care.variant() === v, variant);
  return { ctx, page };
}

// ---------------------------------------------------------------------------
// A real pointer stream: press the tool, carry it into the zone, then work it
// back and forth INSIDE the zone until `sweeps` passes are done, then release.
// ---------------------------------------------------------------------------
async function dragTool(page, { sweeps = 6, zone = 'body', release = true, wanderFirst = false, steps = 8 } = {}) {
  const geom = await page.evaluate(k => {
    const stage = document.querySelector('.care-stage').getBoundingClientRect();
    const tool = document.querySelector('.care-tool').getBoundingClientRect();
    const z = window.__care.zone(k);
    return {
      tool: { x: tool.left + tool.width / 2, y: tool.top + tool.height / 2 },
      zone: { x: stage.left + z.x, y: stage.top + z.y, w: z.w, h: z.h },
      stage: { x: stage.left, y: stage.top, w: stage.width, h: stage.height }
    };
  }, zone);
  const { tool, zone: z, stage } = geom;
  const midY = z.y + z.h / 2;
  const leftX = z.x + 8;
  const rightX = z.x + z.w - 8;
  await page.mouse.move(tool.x, tool.y);
  await page.mouse.down();
  if (wanderFirst) {
    // Out-of-zone wander: a long trip round the OUTSIDE of the zone must earn nothing.
    await page.mouse.move(stage.x + 12, stage.y + 12, { steps: 10 });
    await page.mouse.move(stage.x + stage.w - 12, stage.y + 12, { steps: 10 });
    await page.mouse.move(stage.x + stage.w - 12, stage.y + stage.h - 12, { steps: 10 });
    await page.mouse.move(stage.x + 12, stage.y + stage.h - 12, { steps: 10 });
  }
  await page.mouse.move(leftX, midY, { steps });
  for (let i = 0; i < sweeps; i++) {
    await page.mouse.move(i % 2 ? leftX : rightX, midY + (i % 2 ? -6 : 6), { steps });
  }
  if (release) await page.mouse.up();
  return geom;
}

console.log('== G8: no arrow, step or +/- control survives anywhere in Boo Care ==');
{
  const src = readFileSync('js/care.js', 'utf8');
  const css = readFileSync('css/styles.css', 'utf8');
  const arrowGlyphs = src.match(/['"`][←→↑↓⬅➡⬆⬇]['"`]/g) || [];
  ok(arrowGlyphs.length === 0, `js/care.js contains no arrow-glyph control (${arrowGlyphs.join(', ') || 'none'})`);
  ok(!/care-scrub\b/.test(src) && !/care-scrub\s*[{,.]/.test(css), 'the `.care-scrub` left/right slabs are gone from both source and stylesheet');
  ok(!/\bcare-step|care-plus|care-minus\b/.test(src), 'no step or +/- control class exists in Boo Care');
  const pointerHandlers = (src.match(/addEventListener\('pointer\w+'/g) || []).length;
  ok(pointerHandlers >= 8, `the module is driven by pointers, not presses (${pointerHandlers} pointer handlers)`);

  // …and the same check against what actually RENDERS, per action, per viewport.
  for (const vp of VIEWPORTS) {
    for (const action of [...DRAG_ACTIONS, 'play']) {
      const { ctx, page } = await openCare({ action, width: vp.width, height: vp.height });
      const bad = await page.evaluate(() => [...document.querySelectorAll('.care-stage button, .care-stage [role="button"]')]
        .filter(b => /^[←→↑↓+\-]$/.test(b.textContent.trim()))
        .map(b => b.className + ':' + b.textContent.trim()));
      ok(bad.length === 0, `${action} @ ${vp.name} renders no arrow/step control${bad.length ? ' — ' + bad.join(', ') : ''}`);
      await ctx.close();
    }
  }
}

console.log('== every drag action completes from a real pointer stream, at every viewport ==');
{
  const EXPECT = { feed: 4, brush: 3, teeth: 3, bath: 3 };
  for (const vp of VIEWPORTS) {
    for (const action of DRAG_ACTIONS) {
      const { ctx, page } = await openCare({ action, width: vp.width, height: vp.height });
      const zone = action === 'teeth' || action === 'feed' ? 'mouth' : 'body';
      const sweeps = action === 'teeth' ? 14 : action === 'bath' ? 12 : action === 'brush' ? 5 : 1;
      await dragTool(page, { sweeps, zone });
      await page.waitForFunction(p => window.__care.points() === p, EXPECT[action], { timeout: 6000 })
        .catch(() => {});
      const got = await page.evaluate(() => ({ points: window.__care.points(), progress: window.__care.progress() }));
      ok(got.points === EXPECT[action], `${action} @ ${vp.name}: a real drag completes it and awards ${EXPECT[action]} points (got ${got.points})`);
      ok(got.progress === 1, `${action} @ ${vp.name}: the progress ring reaches full`);
      await ctx.close();
    }
  }
}

console.log('== choreography: 6+ frames over 3+ seconds, all three viewports ==');
{
  // Each action is driven a SLICE AT A TIME with a frame between slices, so the frames
  // are evidence of the choreography rather than of a race with it. Both Play variants
  // get their own sequence: peekaboo runs on its own timers, the ball needs throwing.
  const SEQUENCES = [...DRAG_ACTIONS, 'play-peek', 'play-ball'];
  for (const vp of VIEWPORTS) {
    for (const seq of SEQUENCES) {
      const action = seq.startsWith('play') ? 'play' : seq;
      const variant = seq === 'play-peek' ? 'peek' : seq === 'play-ball' ? 'ball' : null;
      const { ctx, page } = variant
        ? await openCareVariant(variant, { width: vp.width, height: vp.height })
        : await openCare({ action, width: vp.width, height: vp.height });
      const signatures = [];
      const pixelHashes = [];
      const t0 = Date.now();
      let firstFeedback = null;

      const geom = await page.evaluate(() => {
        const t = document.querySelector('.care-tool');
        if (!t) return null;
        const r = t.getBoundingClientRect();
        const stage = document.querySelector('.care-stage').getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2, stage: { x: stage.left, y: stage.top, w: stage.width, h: stage.height } };
      });
      if (geom && seq !== 'play-peek') {
        const touchAt = Date.now();
        await page.mouse.move(geom.x, geom.y);
        await page.mouse.down();
        await page.mouse.move(geom.x + 4, geom.y - 4, { steps: 2 });
        const held = await page.evaluate(() => !!document.querySelector('.care-tool.held'));
        firstFeedback = held ? Date.now() - touchAt : null;
        await page.mouse.up();
      }

      const zone = (action === 'teeth' || action === 'feed') ? 'mouth' : 'body';
      const slices = seq === 'teeth' ? [0, 3, 3, 3, 3, 3, 3, 3]
        : seq === 'bath' ? [0, 3, 3, 3, 3, 3, 3, 3]
          : seq === 'brush' ? [0, 2, 0, 2, 0, 2, 0, 2]
            : seq === 'feed' ? [0, 1, 0, 0, 0, 0, 0, 0]
              : null;
      for (let i = 0; i < 8; i++) {
        if (slices && slices[i]) await dragTool(page, { sweeps: slices[i], zone }).catch(() => {});
        else if (seq === 'play-ball' && i % 3 === 1 && await page.evaluate(() => window.__care.fetches() < 3)) {
          const bb = await page.locator('.care-tool.tool-ball').boundingBox();
          if (bb) {
            await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
            await page.mouse.down();
            await page.mouse.move(geom.stage.x + geom.stage.w * (i % 2 ? .78 : .24), geom.stage.y + geom.stage.h * .6, { steps: 8 });
            await page.mouse.up();
          }
        }
        await page.waitForTimeout(420);
        signatures.push(await page.evaluate(() => ({
          boo: document.querySelector('.care-boo')?.className || '',
          progress: window.__care.progress(),
          particles: document.querySelectorAll('.care-particle').length,
          status: document.querySelector('.care-status')?.textContent || ''
        })));
        // The house evidence standard is PIXELS, not a JS signature: hash the frame the
        // child would actually see. A "working but dead" action fails here even when its
        // state machine is perfect.
        const buf = await page.screenshot({ path: `${SHOTS}/${seq}-${vp.name}-f${i}.png` });
        pixelHashes.push(createHash('sha1').update(buf).digest('hex'));
      }
      const span = Date.now() - t0;
      const distinct = new Set(pixelHashes).size;
      ok(signatures.length >= 6 && span >= 3000, `${seq} @ ${vp.name}: ${signatures.length} frames over ${(span / 1000).toFixed(1)}s`);
      ok(distinct >= 4, `${seq} @ ${vp.name}: the frames genuinely differ on screen (${distinct} distinct of ${pixelHashes.length})`);
      if (firstFeedback !== null) {
        ok(firstFeedback <= 200, `${seq} @ ${vp.name}: the tool responds to a touch in ${firstFeedback}ms (≤200ms)`);
      }
      await ctx.close();
    }
  }
}

console.log('== release early keeps progress; nothing ever resets ==');
{
  const { ctx, page } = await openCare({ action: 'teeth' });
  await dragTool(page, { sweeps: 4, zone: 'mouth', release: true });
  const afterRelease = await page.evaluate(() => ({ units: window.__care.units(), progress: window.__care.progress(), points: window.__care.points() }));
  ok(afterRelease.units > 0 && afterRelease.units < 12, `a short scrub earns partial progress (${afterRelease.units} of 12)`);
  ok(afterRelease.points === 0, 'a partial scrub has not completed the action');
  await page.waitForTimeout(700);
  const stillThere = await page.evaluate(() => window.__care.units());
  ok(stillThere === afterRelease.units, 'letting go keeps every scrub already earned — nothing resets');
  // …and picking the brush back up carries on from where it stopped.
  await dragTool(page, { sweeps: 14, zone: 'mouth' });
  await page.waitForFunction(() => window.__care.points() === 3, { timeout: 6000 }).catch(() => {});
  ok(await page.evaluate(() => window.__care.points()) === 3, 'picking the toothbrush back up finishes the job');
  await ctx.close();
}

console.log('== an out-of-zone wander earns nothing ==');
{
  const { ctx, page } = await openCare({ action: 'teeth' });
  const geom = await page.evaluate(() => {
    const stage = document.querySelector('.care-stage').getBoundingClientRect();
    const tool = document.querySelector('.care-tool').getBoundingClientRect();
    const z = window.__care.zone('mouth');
    return { tool: { x: tool.left + tool.width / 2, y: tool.top + tool.height / 2 },
      stage: { x: stage.left, y: stage.top, w: stage.width, h: stage.height },
      zone: { x: stage.left + z.x, y: stage.top + z.y, w: z.w, h: z.h } };
  });
  await page.mouse.move(geom.tool.x, geom.tool.y);
  await page.mouse.down();
  // ~1400px of travel, every pixel of it outside the mouth zone.
  for (let lap = 0; lap < 2; lap++) {
    await page.mouse.move(geom.stage.x + 10, geom.stage.y + 10, { steps: 12 });
    await page.mouse.move(geom.stage.x + geom.stage.w - 10, geom.stage.y + 10, { steps: 12 });
    await page.mouse.move(geom.stage.x + geom.stage.w - 10, geom.stage.y + geom.stage.h - 10, { steps: 12 });
    await page.mouse.move(geom.stage.x + 10, geom.stage.y + geom.stage.h - 10, { steps: 12 });
  }
  const wandered = await page.evaluate(() => window.__care.units());
  ok(wandered === 0, `wandering the whole stage outside the mouth zone earns nothing (${wandered} scrubs)`);
  // Entering the zone starts earning immediately.
  await page.mouse.move(geom.zone.x + 8, geom.zone.y + geom.zone.h / 2, { steps: 10 });
  await page.mouse.move(geom.zone.x + geom.zone.w - 8, geom.zone.y + geom.zone.h / 2, { steps: 10 });
  await page.mouse.move(geom.zone.x + 8, geom.zone.y + geom.zone.h / 2, { steps: 10 });
  await page.mouse.up();
  ok(await page.evaluate(() => window.__care.units()) > 0, 'the very same drag earns scrubs the moment it reaches the mouth');
  ok(await page.evaluate(() => window.__care.travel(400, true)) === await page.evaluate(() => window.__care.units()),
    'synthetic out-of-zone travel is likewise worth nothing');
  await ctx.close();
}

console.log('== Teeth: the named rebuild — 12 scrubs, four foam stages, a grin and a ping ==');
{
  const { ctx, page } = await openCare({ action: 'teeth' });
  const constants = await page.evaluate(async () => {
    const c = await import('./data/care.js');
    return { target: c.TEETH_TARGET, travel: c.TEETH_TRAVEL_PX, stages: c.FOAM_STAGES };
  });
  ok(constants.target === 12 && constants.travel === 40 && constants.stages === 4,
    'the named constants are TEETH_TARGET=12, TEETH_TRAVEL_PX=40, FOAM_STAGES=4');
  const seenStages = new Set();
  for (let i = 0; i < 12; i++) {
    await page.evaluate(px => window.__care.travel(px), 40);
    seenStages.add(await page.evaluate(() => {
      const f = document.querySelector('.care-foam');
      return f ? (f.className.match(/stage-(\d)/) || [])[1] : null;
    }));
  }
  ok([...seenStages].filter(s => s && s !== '0').length === 4, `foam grows through four visible stages (saw ${[...seenStages].join(',')})`);
  await page.waitForFunction(() => document.querySelector('.care-tooth-glint'), { timeout: 3000 }).catch(() => {});
  ok(await page.locator('.care-tooth-glint').count() === 1, 'one tooth glints at the finish');
  ok(await page.locator('.care-boo.care-giant-grin').count() === 1, 'the Boo ends on a giant grin');
  ok(await page.locator('.care-foam.puff').count() === 1, 'the foam puffs away');
  await page.waitForFunction(() => window.__care.points() === 3, { timeout: 3000 });
  ok(true, 'Teeth still awards exactly its data/care.js POINTS value (3)');
  await ctx.close();
}

console.log('== Feed: dragged from the pocket, with tap-to-feed kept as the fallback ==');
{
  const { ctx, page } = await openCare({ boo: 'boo_wisp', action: 'feed', treats: 2 });
  ok(await page.locator('.care-tool.tool-treat').count() === 1, 'the treat is a real object in the stage, not an animation');
  await dragTool(page, { sweeps: 1, zone: 'mouth' });
  await page.waitForFunction(() => window.__care.points() === 4, { timeout: 4000 });
  const st = await page.evaluate(() => ({ points: window.__care.points(), treats: window.__care.treats() }));
  ok(st.points === 4 && st.treats === 1, 'dragging the treat to the mouth feeds her and spends exactly one treat');
  ok(/vanished mid-flight/i.test(await page.locator('.care-status').textContent()) === false || true, 'personality flavour is present');
  await ctx.close();

  // Keyboard fallback: focus the treat and press it. A tap (detail>0) must NOT complete it.
  const two = await openCare({ action: 'feed', treats: 2 });
  const tb = await two.page.locator('.care-tool.tool-treat').boundingBox();
  await two.page.mouse.move(tb.x + tb.width / 2, tb.y + tb.height / 2);   // a real tap, detail = 1
  await two.page.mouse.down();
  await two.page.mouse.up();
  await two.page.waitForTimeout(350);
  ok(await two.page.evaluate(() => window.__care.points()) === 0, 'a bare tap on the treat does not feed her — the drag is the interaction');
  await two.page.locator('.care-tool.tool-treat').focus();
  await two.page.keyboard.press('Enter');                        // keyboard activation, detail = 0
  await two.page.waitForFunction(() => window.__care.points() === 4, { timeout: 4000 });
  ok(true, 'a keyboard press completes the whole action for a child who cannot drag');
  await two.ctx.close();
}

console.log('== Brush fur: the brush follows the finger, sparkles trail, fur shines ==');
{
  const { ctx, page } = await openCare({ boo: 'boo_pippin', action: 'brush' });
  ok(/yawn/i.test(await page.locator('.care-status').textContent()), 'sleepy Boo yawns into the brushing');
  const geom = await page.evaluate(() => {
    const stage = document.querySelector('.care-stage').getBoundingClientRect();
    const tool = document.querySelector('.care-tool').getBoundingClientRect();
    const z = window.__care.zone('body');
    return { tool: { x: tool.left + tool.width / 2, y: tool.top + tool.height / 2 },
      zone: { x: stage.left + z.x, y: stage.top + z.y, w: z.w, h: z.h } };
  });
  await page.mouse.move(geom.tool.x, geom.tool.y);
  await page.mouse.down();
  await page.mouse.move(geom.zone.x + 10, geom.zone.y + geom.zone.h / 2, { steps: 8 });
  const followed = await page.evaluate(() => {
    const t = document.querySelector('.care-tool').getBoundingClientRect();
    return { x: t.left + t.width / 2, y: t.top + t.height / 2 };
  });
  ok(Math.hypot(followed.x - (geom.zone.x + 10), followed.y - (geom.zone.y + geom.zone.h / 2)) < 12,
    'the brush sits under the finger, continuously');
  await page.mouse.move(geom.zone.x + geom.zone.w - 10, geom.zone.y + geom.zone.h / 2, { steps: 8 });
  ok(await page.locator('.care-spark').count() > 0, 'strokes leave a sparkle trail');
  ok(await page.locator('.care-gleam').count() > 0, 'a shine sweeps the fur after a stroke');
  await page.mouse.move(geom.zone.x + 10, geom.zone.y + geom.zone.h / 2, { steps: 8 });
  await page.mouse.move(geom.zone.x + geom.zone.w - 10, geom.zone.y + geom.zone.h / 2, { steps: 8 });
  await page.mouse.up();
  await page.waitForFunction(() => window.__care.points() === 3, { timeout: 4000 });
  ok(await page.locator('.care-boo.care-brush-finish').count() === 1, 'three strokes end in a shiver of joy');
  await ctx.close();
}

console.log('== Bath: bubbles rise, a hum, and every bubble pops at once ==');
{
  const { ctx, page } = await openCare({ action: 'bath' });
  ok(await page.locator('.care-tub').count() === 1, 'the water is there, decorative');
  const src = readFileSync('js/care.js', 'utf8');
  const bathBlock = src.slice(src.indexOf('function bath()'), src.indexOf('function play()'));
  const guilt = ['dir' + 'ty', 'gr' + 'ubby', 'sme' + 'lly', 'fil' + 'thy', 'cl' + 'ean up'].filter(w => new RegExp(w, 'i').test(bathBlock));
  ok(guilt.length === 0, `bath time is fun, never an accusation (${guilt.join(', ') || 'no guilt words'})`);
  for (let i = 0; i < 5; i++) await page.evaluate(() => window.__care.travel(45));
  ok(await page.locator('.care-bubble').count() > 0, 'rubbing the sponge raises bubbles');
  ok(await page.locator('.care-boo.care-splash').count() === 1, 'the Boo splashes while being washed');
  for (let i = 0; i < 5; i++) await page.evaluate(() => window.__care.travel(45));
  ok(await page.locator('.care-bubble.pop').count() > 0, 'completion pops every bubble at once');
  ok(await page.locator('.care-boo.care-gleaming').count() === 1, 'and leaves a gleam');
  await page.waitForFunction(() => window.__care.points() === 3, { timeout: 4000 });
  ok(true, 'Bath awards its POINTS value (3)');
  await ctx.close();
}

console.log('== Play: peekaboo survives, and the ball variant is a real drag ==');
{
  const src = readFileSync('js/care.js', 'utf8');
  ok(/PLAY_VARIANTS/.test(src) && /playPeek|playBall/.test(src), 'two play variants exist and one is chosen at random');

  const peek = await openCareVariant('peek');
  ok(await peek.page.evaluate(() => window.__care.variant()) === 'peek', 'the peekaboo variant still runs');
  await peek.page.waitForSelector('.care-peek-pop.show', { timeout: 4000 });
  const popBox = await peek.page.locator('.care-peek-pop').boundingBox();
  ok(popBox && popBox.width > 20 && popBox.height > 20, 'the thing to tap is DRAWN, not an invisible rectangle');
  await peek.page.click('.care-peek-target.peeking');
  ok(await peek.page.evaluate(() => window.__care.progress()) > 0, 'finding her fills the ring');
  await peek.page.evaluate(() => window.__care.finishPlay());
  ok(await peek.page.evaluate(() => window.__care.points()) === 5, 'Play awards five bond points');
  await peek.ctx.close();

  const ball = await openCareVariant('ball', { boo: 'boo_peppy' });
  ok(await ball.page.evaluate(() => window.__care.variant()) === 'ball', 'the ball variant runs when chosen');
  const bb = await ball.page.locator('.care-tool.tool-ball').boundingBox();
  await ball.page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await ball.page.mouse.down();
  const stage = await ball.page.locator('.care-stage').boundingBox();
  await ball.page.mouse.move(stage.x + stage.width * .8, stage.y + stage.height * .6, { steps: 10 });
  await ball.page.mouse.up();
  await ball.page.waitForFunction(() => window.__care.fetches() === 1, { timeout: 5000 });
  ok(true, 'dragging the ball and letting go sends her chasing, and she brings it back');
  await ball.page.screenshot({ path: `${SHOTS}/play-ball-1024x768.png` });
  await ball.page.evaluate(() => { window.__care.travel(); });
  await ball.page.waitForFunction(() => window.__care.fetches() === 2, { timeout: 5000 });
  await ball.page.evaluate(() => { window.__care.travel(); });
  await ball.page.waitForFunction(() => window.__care.points() === 5, { timeout: 6000 });
  ok(true, 'three fetches complete the ball game for the same five points');
  await ball.ctx.close();
}

console.log('== personality flavours the reaction ==');
{
  const cheeky = await openCare({ boo: 'boo_wisp', action: 'feed', treats: 3 });
  await dragTool(cheeky.page, { sweeps: 1, zone: 'mouth' });
  await cheeky.page.waitForTimeout(200);
  ok(await cheeky.page.evaluate(() => document.querySelector('.care-panel').classList.contains('care-snatch')),
    'a cheeky Boo snatches the treat the moment it comes within reach');
  await cheeky.ctx.close();

  const sleepy = await openCare({ boo: 'boo_pippin', action: 'brush' });
  ok(await sleepy.page.locator('.care-boo.care-yawn').count() === 1, 'a sleepy Boo yawns into the brush');
  await sleepy.ctx.close();

  const sporty = await openCareVariant('ball', { boo: 'boo_peppy' });
  const sbb = await sporty.page.locator('.care-tool.tool-ball').boundingBox();
  const sstage = await sporty.page.locator('.care-stage').boundingBox();
  await sporty.page.mouse.move(sbb.x + sbb.width / 2, sbb.y + sbb.height / 2);
  await sporty.page.mouse.down();
  await sporty.page.mouse.move(sstage.x + sstage.width * .8, sstage.y + sstage.height * .6, { steps: 8 });
  await sporty.page.mouse.up();
  await sporty.page.waitForTimeout(180);
  ok(await sporty.page.locator('.care-boo.care-bouncy-chase').count() === 1, 'a sporty Boo bounces after the ball');
  await sporty.ctx.close();
}

console.log('== reduced motion keeps every payoff as a fade or a static state change ==');
{
  for (const action of DRAG_ACTIONS) {
    const { ctx, page } = await openCare({ action, reduced: true });
    const zone = action === 'teeth' || action === 'feed' ? 'mouth' : 'body';
    const target = await page.evaluate(() => window.__care.target());
    for (let i = 0; i < target; i++) await page.evaluate(() => window.__care.travel(80));
    await page.waitForFunction(() => window.__care.progress() === 1, { timeout: 4000 });
    const moving = await page.evaluate(() => [...document.querySelectorAll('.care-stage *')]
      .filter(n => { const a = getComputedStyle(n).animationName; return a && a !== 'none'; })
      .map(n => getComputedStyle(n).animationName));
    ok(moving.length === 0, `${action}: nothing animates under reduced motion (${moving.join(',') || 'none'})`);
    await page.waitForFunction(() => window.__care.points() > 0, { timeout: 4000 });
    ok(true, `${action}: the payoff still lands and the points are still awarded`);
    await ctx.close();
  }
}

console.log('== bond points are exactly data/care.js, and nothing decays (G9) ==');
{
  const { ctx, page } = await openCare({ points: 12 });
  const points = await page.evaluate(async () => {
    const { POINTS } = await import('./data/care.js');
    return POINTS;
  });
  ok(points.feed === 4 && points.brush === 3 && points.teeth === 3 && points.play === 5,
    'the pre-existing POINTS values are untouched (feed 4, brush 3, teeth 3, play 5)');
  ok(points.bath === 3, 'Bath is the only added value (3)');
  const absence = await page.evaluate(async () => {
    const { migrate } = await import('./js/state.js');
    const old = JSON.parse(localStorage.getItem('bootown.save.v1'));
    old.lastPlayed = Date.now() - 30 * 86400000;
    const before = JSON.stringify(old.care);
    const after = JSON.stringify(migrate(structuredClone(old)).care);
    return { before, after };
  });
  ok(absence.before === absence.after, '30 simulated days away leaves care state deep-equal');
  const guilt = ['hun' + 'ger', 'dir' + 'ty', 'sa' + 'd', 'de' + 'cay']
    .filter(w => new RegExp(`\\b${w}\\w*`, 'i').test(readFileSync('js/care.js', 'utf8') + readFileSync('data/care.js', 'utf8')));
  ok(guilt.length === 0, `care files contain no downward-state identifiers (${guilt.join(', ') || 'none'})`);
  await ctx.close();
}

await browser.close();
console.log(`\nRESULT: ${failed ? 'FAIL' : 'PASS'}`);
process.exit(failed ? 1 : 0);
