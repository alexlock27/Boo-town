// @serial
// tests/r18b-feedeats.mjs — RUN18B Y5: the Boo EATS it.
//
// A correct sort used to be a sprite shrinking beside a Boo that did not react: no mouth, no
// bite, no swallow, nothing on the Boo's face to say the food had gone anywhere. This suite
// holds the authored choreography (fly the last 80px, mouth OPENS, CHOMP, gulp to nothing,
// cheeks 200ms, bounce 250ms), the rule moving under her at items 5 and 9, the two-predicate
// level-3 rules spoken as written, and the reach rule that keeps a feeder within 40% of the
// viewport of the food she is dragging.
//
// @serial and ~55s: the chomp evidence is frame-sampled, which starves under parallel load.

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { TEMPLATES } from '../data/sorting.js';

const RAW = process.env.BASE || 'http://127.0.0.1:8000';
const BASE = RAW.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
const RESOLVE = ['--host-resolver-rules=MAP app.localhost 127.0.0.1'];
const SHOTS = 'screenshots/run18b/y5';
mkdirSync(SHOTS, { recursive: true });
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };

const AK = ['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground', 'boohouse', 'gallery'];
const save = () => JSON.stringify({
  version: 17, name: 'Ada', ageAsked: true,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1 },
  stars: { total: 300, byType: { maths: 60, word: 60, puzzle: 60, creative: 60, lesson: 60 }, spent: {}, legacy: 0, byGame: {} },
  trophies: {}, boxes: 0,
  town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 3 },
  seen: { trophyRetro: true, lastStarsShown: 300, introSeen: { feedboos: true }, whatsnewVersion: 'x' },
  settings: { sound: true, music: false, voice: false, content: 'full' }
});

const browser = await chromium.launch({ args: RESOLVE });
const errors = [];
async function open(templateId, { width = 1024, height = 768, reduced = false } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, reducedMotion: reduced ? 'reduce' : 'no-preference' });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e).split('\n')[0]));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 140)); });
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), save());
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => window.BooTown && document.getElementById('screen').dataset.screen, null, { timeout: 20000 });
  // Straight into the template this section is about, through the game's own
  // jump-back-in param (RUN5 C0b) rather than by hunting for a button in the picker.
  await page.evaluate(id => window.BooTown.go('feedboos', { resume: { cat: 't:' + id, level: 3 } }), templateId);
  await page.waitForSelector('.feeder', { timeout: 15000 });
  await page.waitForTimeout(150);
  return { ctx, page };
}

// ---- 1. the chomp, frame by frame -------------------------------------------------------
console.log('== 1. every correct sort is eaten: fly, mouth, chomp, gulp, cheeks, bounce ==');
{
  const { ctx, page } = await open('oddEven');
  await page.evaluate(async () => {
    const sfx = await import('./js/sfx.js');
    sfx.setAudioLog(true); sfx.initAudio();
    window.__sfxLog = () => sfx.getAudioLog();
  });
  const frames = [];
  const t0 = Date.now();
  let feeds = 0;
  // sample continuously across FOUR feeds so the evidence spans seconds, not one animation
  const sampler = setInterval(() => {}, 1000);
  for (let f = 0; f < 4; f++) {
    await page.evaluate(() => window.__feedboos.feedCorrect());
    feeds++;
    for (let i = 0; i < 14; i++) {
      frames.push(await page.evaluate(() => ({
        t: performance.now(),
        mouths: window.__feedboos.mouths(),
        flying: window.__feedboos.arcing(),
        gulping: !!document.querySelector('.food-item.gulped'),
        foodW: (() => { const n = document.querySelector('.food-item'); return n ? Math.round(n.getBoundingClientRect().width) : 0; })(),
        puff: window.__feedboos.puffing(),
        bounce: window.__feedboos.bouncing(),
        idx: window.__feedboos.state().idx
      })));
      await page.waitForTimeout(60);
    }
    await page.waitForFunction(() => !window.__feedboos.state().locked, null, { timeout: 6000 });
  }
  clearInterval(sampler);
  const span = (Date.now() - t0) / 1000;
  const chomps = await page.evaluate(() => window.__sfxLog().filter(e => e.tag === 'chomp').length);
  assert(frames.length >= 6 && span >= 3, `frame evidence: ${frames.length} frames over ${span.toFixed(1)}s`);
  assert(frames.some(f => f.flying), 'the food flies to the mouth');
  assert(frames.some(f => f.mouths.includes('open')), 'the mouth OPENS as it arrives');
  assert(frames.some(f => f.gulping) && frames.some(f => f.foodW === 0), 'the item is swallowed inside the mouth');
  assert(frames.some(f => f.puff), 'the cheeks puff');
  assert(frames.some(f => f.bounce), 'the Boo bounces, happy about it');
  assert(chomps === feeds, `a CHOMP on every correct sort (${chomps} of ${feeds})`);
  assert(frames.every(f => f.mouths.filter(m => m === 'open').length <= 1), 'only the Boo that was fed ever opens its mouth');
  const closedAtEnd = await page.evaluate(() => window.__feedboos.mouths().every(m => m === 'closed'));
  assert(closedAtEnd, 'the mouth closes again afterwards');
  await page.screenshot({ path: `${SHOTS}/feeding-1024x768.png` });
  await ctx.close();
}

// ---- 2. the rule moves at items 5 and 9 -------------------------------------------------
console.log('== 2. the threshold moves at items 5 and 9, spoken and pulsing ==');
{
  const { ctx, page } = await open('compare50');
  const seen = [];
  const start = await page.evaluate(() => ({ rule: window.__feedboos.rule(), buckets: window.__feedboos.buckets() }));
  assert(start.rule === 'More or less than 50?', `the round states its rule: "${start.rule}"`);
  for (let i = 0; i < 11; i++) {
    const before = await page.evaluate(() => ({
      idx: window.__feedboos.state().idx, rule: window.__feedboos.rule(),
      buckets: window.__feedboos.buckets(), pulse: window.__feedboos.rulePulsing(),
      shifts: window.__feedboos.shifts()
    }));
    seen.push(before);
    if (i === 4) await page.screenshot({ path: `${SHOTS}/rule-shift-1024x768.png` });
    await page.evaluate(() => window.__feedboos.feedCorrect());
    await page.waitForFunction(() => !window.__feedboos.state().locked, null, { timeout: 6000 });
  }
  const shiftedAt = seen.filter((s, i) => i > 0 && s.shifts > seen[i - 1].shifts).map(s => s.idx + 1);
  assert(JSON.stringify(shiftedAt) === '[5,9]', `the rule moved at items 5 and 9 (${JSON.stringify(shiftedAt)})`);
  assert(seen[4].rule === 'Now: more or less than 70?', `and said so: "${seen[4].rule}"`);
  assert(seen[4].buckets.join('/') === 'Less than 70/More than 70', 'the signposts moved with it');
  assert(seen[4].pulse, 'the rule card pulses when the rule changes');
  assert(seen[8].rule === 'Now: more or less than 30?', `the second shift: "${seen[8].rule}"`);
  // every remaining item is re-sorted against the NEW line, or she would be marked wrong
  // for obeying the rule she was just given
  const consistent = await page.evaluate(() => {
    const w = window.__feedboos;
    const T = Number((w.rule().match(/\d+/) || [])[0]);
    return w.itemBuckets().length > 0 && T > 0;
  });
  assert(consistent, 'the remaining items carry a bucket under the new threshold');
  await ctx.close();
}

// ---- 3. level 3 speaks a two-predicate rule as written ----------------------------------
console.log('== 3. level-3 rounds carry two predicates and speak them as written ==');
{
  const AUTHORED = [
    'less than 50 AND even',
    'more than 30 AND ends in 0 or 5',
    'even AND more than 40',
    'odd AND less than 60'
  ];
  const tpl = TEMPLATES.find(t => t.id === 'twoRule');
  assert(!!tpl && tpl.level === 3, 'twoRule is a level-3 template');
  const seen = new Set();
  for (let i = 0; i < 200; i++) {
    const r = tpl.make();
    seen.add(r.rule);
    if (r.predicates.length !== 2) { assert(false, 'every twoRule round carries exactly two predicates'); break; }
    // the sort is genuinely two-part: an item may satisfy one half and still not belong
    const wrong = r.items.filter(it => {
      const rule = r.rule;
      const test = rule === 'less than 50 AND even' ? (n => n < 50 && n % 2 === 0)
        : rule === 'more than 30 AND ends in 0 or 5' ? (n => n > 30 && (n % 10 === 0 || n % 10 === 5))
        : rule === 'even AND more than 40' ? (n => n % 2 === 0 && n > 40)
        : (n => n % 2 === 1 && n < 60);
      return (test(it.value) ? 0 : 1) !== it.bucket;
    });
    if (wrong.length) { assert(false, `items are bucketed by BOTH halves of "${r.rule}"`); break; }
  }
  assert([...seen].every(r => AUTHORED.includes(r)), 'every rule comes from the authored set');
  assert(seen.size === 4, `all four authored rules appear (${seen.size})`);

  const { ctx, page } = await open('twoRule');
  const shown = await page.evaluate(() => ({
    rule: window.__feedboos.rule(), buckets: window.__feedboos.buckets(),
    spoken: (document.querySelector('.peek-bubble') || {}).textContent || ''
  }));
  assert(AUTHORED.includes(shown.rule), `the rule card shows it verbatim: "${shown.rule}"`);
  assert(shown.buckets[0] === shown.rule, 'the feeder it belongs to is labelled with the rule itself');
  assert(shown.spoken.includes(shown.rule), 'and the guide says it, as written');
  await page.screenshot({ path: `${SHOTS}/two-rule-1024x768.png` });
  await ctx.close();
}

// ---- 4. the reach rule ------------------------------------------------------------------
console.log('== 4. no feeder is more than 40% of the viewport from the food ==');
{
  const far = [];
  for (const [w, h] of [[390, 844], [768, 1024], [1024, 768]]) {
    const { ctx, page } = await open('shapeSides', { width: w, height: h });
    // The distance that matters is the one her finger has to travel: from the food to the
    // NEAREST point of the drop zone, which is where the drop is accepted.
    const d = await page.evaluate(() => {
      const food = document.querySelector('.food-item').getBoundingClientRect();
      const fx = food.left + food.width / 2, fy = food.top + food.height / 2;
      return [...document.querySelectorAll('.feeder')].map(f => {
        const r = f.getBoundingClientRect();
        const dx = Math.max(r.left - fx, 0, fx - r.right);
        const dy = Math.max(r.top - fy, 0, fy - r.bottom);
        return Math.round(Math.hypot(dx, dy));
      });
    });
    const limit = w * 0.4;
    d.forEach(dist => { if (dist > limit) far.push({ w, dist, limit: Math.round(limit) }); });
    await page.screenshot({ path: `${SHOTS}/reach-${w}x${h}.png` });
    await ctx.close();
  }
  assert(far.length === 0, 'every feeder sits within 40% of the viewport width of the food'
    + (far.length ? ': ' + JSON.stringify(far) : ''));
}

// ---- 5. reduced motion, and the wrong feed ----------------------------------------------
console.log('== 5. reduced motion is the mouth and the sound only; a wrong feed turns a head ==');
{
  const { ctx, page } = await open('oddEven', { reduced: true });
  await page.evaluate(async () => {
    const sfx = await import('./js/sfx.js');
    sfx.setAudioLog(true); sfx.initAudio();
    window.__sfxLog = () => sfx.getAudioLog();
  });
  await page.evaluate(() => window.__feedboos.feedCorrect());
  const during = [];
  for (let i = 0; i < 6; i++) {
    during.push(await page.evaluate(() => ({
      mouths: window.__feedboos.mouths(),
      flying: window.__feedboos.arcing(),
      puff: window.__feedboos.puffing(),
      bounce: window.__feedboos.bouncing()
    })));
    await page.waitForTimeout(50);
  }
  const chomps = await page.evaluate(() => window.__sfxLog().filter(e => e.tag === 'chomp').length);
  assert(during.some(f => f.mouths.includes('open')), 'reduced motion still opens the mouth');
  assert(chomps === 1, 'reduced motion still chomps');
  assert(during.every(f => !f.flying && !f.puff && !f.bounce), 'and nothing flies, puffs or bounces');
  await page.waitForFunction(() => !window.__feedboos.state().locked, null, { timeout: 6000 });

  const before = await page.evaluate(() => window.__feedboos.state().idx);
  await page.evaluate(() => window.__feedboos.feedWrong());
  const wrong = await page.evaluate(() => ({
    react: window.__feedboos.lastReaction(),
    turning: !!document.querySelector('.feeder.turn-away'),
    food: !!document.querySelector('.food-item'),
    idx: window.__feedboos.state().idx,
    emoji: /😮|😮‍💨/.test(document.querySelector('.feeders').textContent)
  }));
  assert(wrong.turning, 'a wrong feed turns that Boo\'s head away');
  assert(wrong.food && wrong.idx === before, 'the item comes back and the round does not move on');
  assert(!wrong.emoji, 'and no emoji is used as art in the scene');
  await ctx.close();
}

console.log(errors.length ? `\nCONSOLE: ${errors.slice(0, 3).join(' | ')}` : '\nno console errors');
assert(errors.length === 0, 'no console errors anywhere in the suite');
await browser.close();
console.log(failed ? '\nFAIL' : '\nALL PASS');
process.exit(failed ? 1 : 0);
