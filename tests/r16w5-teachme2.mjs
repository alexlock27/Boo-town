// tests/r16w5-teachme2.mjs — RUN16 W5: Teach Me 2.0.
// The brief's assertions: every lesson (old AND new) has all four stages with the TRY steps
// interactive and drag-based; no silent rewind exists anywhere; the three new lessons'
// content matches CONTENT_LESSONS.md exactly; lesson stars and Journal stamps fire once each.
// Expected runtime: ~55s. Not @serial — no frame sampling here.

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const RAW = process.env.BASE || 'http://127.0.0.1:8000';
const BASE = RAW.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
const RESOLVE = ['--host-resolver-rules=MAP app.localhost 127.0.0.1'];
const SHOTS = 'screenshots/run16/w5';
mkdirSync(SHOTS, { recursive: true });
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };

const AK = ['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground', 'boohouse', 'gallery'];
const save = (over = {}) => JSON.stringify(Object.assign({
  version: 17, name: 'Ada', ageAsked: true,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1 }, stars: { total: 400, byGame: {}, byType: { maths: 0, word: 0, puzzle: 0, creative: 0, lesson: 0 }, spent: {}, legacy: 0 },
  trophies: {}, boxes: 0, journal: {},
  town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 3 },
  seen: { trophyRetro: true, lastStarsShown: 400, introSeen: { teachme: true } },
  settings: { sound: false, music: false, voice: false, content: 'full' }
}, over));

const browser = await chromium.launch({ args: RESOLVE });
const errors = [];
async function open(route, params = {}, over = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), save(over));
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => window.BooTown && document.getElementById('screen').dataset.screen, null, { timeout: 20000 });
  await page.evaluate(([r, p]) => window.BooTown.go(r, p || {}), [route, params]);
  await page.waitForFunction(r => document.getElementById('screen').dataset.screen === r, route, { timeout: 20000 });
  return { ctx, page };
}
async function openLesson(page, name) {
  await page.waitForSelector('.lesson-grid', { timeout: 8000 });
  await page.evaluate(n => [...document.querySelectorAll('.lesson-card')].find(x => x.textContent.includes(n)).click(), name);
  await page.waitForFunction(() => window.__teachme, null, { timeout: 8000 });
}
// walk to the next TRY step, tapping through hook and show
async function toTry(page, which = 0) {
  for (let i = 0; i < 40; i++) {
    const st = await page.evaluate(() => ({ t: window.__teachme.card().type, done: window.__teachme.state().stageIdx }));
    if (st.t === 'try') {
      const seen = await page.evaluate(() => window.__teachme.stages().slice(0, window.__teachme.card().idx).filter(s => s === 'try').length);
      if (seen === which) return true;
      await page.evaluate(() => window.__teachme.solveStep());
      await page.waitForTimeout(1100);
      continue;
    }
    await page.evaluate(() => window.__teachme.tapNext());
    await page.waitForTimeout(200);
  }
  return false;
}

// ---- 1. every lesson, old and new, has all four stages ------------------------------
console.log('== 1. all nine lessons have hook -> show -> try x3 -> win ==');
{
  const { ctx, page } = await open('hub');
  const r = await page.evaluate(async () => {
    const { LESSONS } = await import('./data/lessons.js');
    const { stagesOf, showCardsOf } = await import('./js/games/teachme.js');
    return LESSONS.map(l => {
      const st = stagesOf(l).map(s => s.type);
      return {
        id: l.id, name: l.name,
        hook: st[0] === 'hook' && !!l.hook && !!l.hook.line,
        show: showCardsOf(l).length,
        tries: (l.try || []).length,
        tryKinds: (l.try || []).map(t => t.kind),
        win: !!(l.win && l.win.stamp),
        // the thing RUN12 and RUN16 both asked for: no card may carry a rewind target
        rewinds: JSON.stringify(l).includes('backTo'),
        multipleChoice: (l.cards || []).some(c => c.type === 'check')
      };
    });
  });
  assert(r.length === 9, `nine lessons: six maths + three literacy (got ${r.length})`);
  const noHook = r.filter(l => !l.hook);
  assert(noHook.length === 0, 'every lesson opens with a HOOK that has an authored line' + (noHook.length ? ': ' + noHook.map(l => l.id) : ''));
  const noShow = r.filter(l => l.show < 2);
  assert(noShow.length === 0, 'every lesson SHOWs it at least two ways' + (noShow.length ? ': ' + noShow.map(l => l.id) : ''));
  const notThree = r.filter(l => l.tries !== 3);
  assert(notThree.length === 0, 'every lesson has exactly three TRY steps' + (notThree.length ? ': ' + notThree.map(l => `${l.id}=${l.tries}`) : ''));
  const kinds = [...new Set(r.flatMap(l => l.tryKinds))].sort();
  assert(kinds.every(k => ['sort', 'place', 'order'].includes(k)), `every TRY step is one of the three drag primitives (${kinds.join(', ')})`);
  const noWin = r.filter(l => !l.win);
  assert(noWin.length === 0, 'every lesson WINs with an authored Journal stamp');
  assert(r.every(l => !l.rewinds), 'not one lesson still carries a `backTo` rewind target');
  assert(r.every(l => !l.multipleChoice), 'and not one multiple-choice `check` card survives anywhere');
  await ctx.close();
}

// ---- 2. the three literacy lessons, verbatim from CONTENT_LESSONS.md ----------------
console.log('== 2. the three new lessons match the pack exactly ==');
{
  const { ctx, page } = await open('hub');
  const r = await page.evaluate(async () => {
    const { LITERACY_LESSONS } = await import('./data/lessonsLiteracy.js');
    return LITERACY_LESSONS.map(l => ({
      id: l.id, name: l.name,
      hookLine: l.hook.line, hookBefore: l.hook.before,
      show: l.show.map(s => s.text || (s.baskets || []).map(b => b.label + ':' + b.example).join(',')),
      also: l.show.map(s => s.also || null).filter(Boolean),
      tries: l.try.map(t => ({
        kind: t.kind,
        items: (t.items || []).map(i => i.key),
        tiles: (t.tiles || []).map(i => i.key),
        frames: (t.frames || []).map(f => (f.pre || '') + '___' + (f.post || '') + '=' + f.answer),
        traps: (t.frames || []).flatMap(f => Object.entries(f.traps || {}).map(([k, v]) => k + ': ' + v)),
        why: Object.entries(t.why || {}).map(([k, v]) => k + ': ' + v),
        wrongExample: typeof t.wrong === 'function' ? t.wrong({ word: 'chips', bin: 'ch' }, 'sh') : null
      })),
      stamp: l.win.stamp
    }));
  });
  // LESSON A
  const a = r[0];
  assert(a.name === 'Sounds in words', 'Lesson A is "Sounds in words"');
  assert(a.hookLine === 'It needs an H! Some letters hold hands and make a brand new sound.', 'its HOOK line is the pack\'s');
  assert(a.hookBefore === 'SIP', 'and the Boo really does keep producing "SIP"');
  assert(a.show[0].includes('sh is the quiet sound: shhhh') && a.show[0].includes('Two letters, one sound.'), 'SHOW way 1 is the pack\'s sound description');
  assert(a.show[1] === 'sh:ship,ch:chips,th:thumb', 'SHOW way 2 is the three baskets holding ship / chips / thumb');
  assert(a.tries[0].items.join(',') === 'ship,shell,chips,cheese,thumb,thorn', 'TRY 1 sorts the pack\'s six pictures, in order');
  assert(a.tries[0].wrongExample === "That's chips — ch, not sh!", `TRY 1's wrong drop names what she dropped: "${a.tries[0].wrongExample}"`);
  assert(a.tries[1].frames.join(' | ') === '___ip=sh | ___in=ch | ___orn=th', 'TRY 2 builds ship, chin and thorn');
  assert(a.tries[1].traps[0] === 'ch: That spells CHIP! Tasty — but the picture shows a SHIP. Shhh!', 'and the deliberate chip/ship trap has its authored kind feedback, word for word');
  assert(a.tries[2].items.join(',') === 'shell,shop,sheep,chair', 'TRY 3 is the pack\'s four pictures, with chair the odd one');
  assert(a.stamp === 'I know sh, ch and th!', 'the Journal stamp is the pack\'s');
  // LESSON B
  const b = r[1];
  assert(b.name === 'Words that sound the same', 'Lesson B is "Words that sound the same"');
  assert(b.hookBefore === 'I CAN HERE YOU!', 'its HOOK sign reads "I CAN HERE YOU!"');
  assert(b.hookLine === "It sounds right... but it's the wrong word. Some words are twins!", 'with the pack\'s line');
  assert(b.show[0].includes('hear has EAR in it'), 'SHOW way 1 is the ear trick');
  assert(b.also.length === 1 && b.also[0].includes('two is the number, it has a w like twin'), 'and the two/too paragraph is kept, not dropped');
  assert(b.tries[0].frames.join(' | ') === 'Come over ___ and sit down.=here | I can ___ the band playing.=hear', 'TRY 1 is the two hear/here sentences');
  assert(b.tries[1].frames.length === 3 && b.tries[1].tiles.join(',') === "there,their,they're", 'TRY 2 is the three there/their/they\'re sentences');
  assert(b.tries[2].frames.length === 3 && b.tries[2].tiles.join(',') === 'to,two,too', 'TRY 3 is the three to/two/too sentences');
  assert(b.tries[0].why.some(w => w === 'hear: hear has EAR in it — you hear with your ear!'), 'and a wrong placement explains the trick for that word, in the pack\'s words');
  assert(b.stamp === 'I can spot word twins!', 'the Journal stamp is the pack\'s');
  // LESSON C
  const c = r[2];
  assert(c.name === 'How a story works', 'Lesson C is "How a story works"');
  assert(c.hookLine === "Stories have an order. Let's find it.", 'its HOOK line is the pack\'s');
  assert(c.show[0].includes('The beginning tells you WHO and WHERE'), 'SHOW way 1 is the three parts');
  assert(c.tries[0].kind === 'order', 'TRY 1 orders three panels');
  assert(c.tries[1].kind === 'sort' && c.tries[1].items[0] === 'flag', 'TRY 2 drags the middle flag onto a panel');
  assert(c.tries[2].tiles.join(',') === 'endFlower,endBoat,endSnow', 'TRY 3 offers the pack\'s three endings, flower first');
  assert(c.stamp === 'I know how stories work!', 'the Journal stamp is the pack\'s');
  await ctx.close();
}

// ---- 3. the TRY steps are really drag-based, and the tap path works too --------------
console.log('== 3. TRY steps are direct manipulation — dragged, or tapped ==');
{
  const { ctx, page } = await open('teachme');
  await openLesson(page, 'Sounds in words');
  await toTry(page, 0);
  const kind = await page.evaluate(() => window.__teachme.stepKind());
  assert(kind === 'sort', 'the first TRY step is a sort');
  const shape = await page.evaluate(() => ({
    drags: document.querySelectorAll('.tm-drag').length,
    bins: document.querySelectorAll('.tm-basket').length,
    buttons: document.querySelectorAll('.tm-opt').length,
    draggable: [...document.querySelectorAll('.tm-drag')].every(n => getComputedStyle(n).touchAction === 'none')
  }));
  assert(shape.drags === 6 && shape.bins === 3, `six draggable pictures and three baskets on screen`);
  assert(shape.buttons === 0, 'and not one multiple-choice option button anywhere');
  assert(shape.draggable, 'every piece is set up for dragging (touch-action: none)');
  await page.screenshot({ path: SHOTS + '/try-sort.png' });

  // a real pointer drag: ship into the sh basket
  const pos = await page.evaluate(() => {
    const item = document.querySelector('.tm-drag[data-item="ship"]').getBoundingClientRect();
    const bin = document.querySelector('.tm-basket[data-bin="sh"]').getBoundingClientRect();
    return { ix: item.left + item.width / 2, iy: item.top + item.height / 2, bx: bin.left + bin.width / 2, by: bin.top + bin.height / 2 };
  });
  await page.mouse.move(pos.ix, pos.iy);
  await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(pos.ix + (pos.bx - pos.ix) * i / 6, pos.iy + (pos.by - pos.iy) * i / 6);
  await page.mouse.up();
  await page.waitForTimeout(250);
  assert((await page.evaluate(() => window.__teachme.stepHooks().placed())).includes('ship'), 'dragging a picture into a basket really places it');
  // and the tap path: tap the picture, tap the basket
  await page.evaluate(() => window.__teachme.stepHooks().tapDrop('shell', 'sh'));
  await page.waitForTimeout(200);
  assert((await page.evaluate(() => window.__teachme.stepHooks().placed())).includes('shell'), 'and tapping a picture then a basket does the same — no drag needed');
  await ctx.close();
}

// ---- 4. NO SILENT REWIND, anywhere, in any lesson ------------------------------------
console.log('== 4. a wrong move explains and stays put — in all nine lessons ==');
{
  const { ctx, page } = await open('teachme');
  const names = await page.evaluate(async () => (await import('./data/lessons.js')).LESSONS.map(l => l.name));
  const results = [];
  for (const name of names) {
    await page.evaluate(() => window.BooTown.go('teachme', {}));
    await openLesson(page, name);
    await toTry(page, 0);
    const before = await page.evaluate(() => ({ idx: window.__teachme.card().idx, kind: window.__teachme.stepKind() }));
    if (before.kind === 'order') { results.push({ name, skipped: true }); continue; }   // order has no wrong move
    await page.evaluate(() => window.__teachme.wrongStep());
    await page.waitForTimeout(320);
    const after = await page.evaluate(() => ({ idx: window.__teachme.card().idx, type: window.__teachme.card().type, fb: window.__teachme.feedback() }));
    results.push({ name, stayed: after.idx === before.idx && after.type === 'try', explained: after.fb });
  }
  const moved = results.filter(r => !r.skipped && !r.stayed);
  assert(moved.length === 0, 'no wrong move rewinds the lesson' + (moved.length ? ': ' + moved.map(r => r.name).join(', ') : ''));
  const silent = results.filter(r => !r.skipped && !r.explained);
  assert(silent.length === 0, 'and no wrong move is silent — every one of them explains' + (silent.length ? ': ' + silent.map(r => r.name).join(', ') : ''));
  console.log('    e.g. ' + results.filter(r => r.explained).slice(0, 2).map(r => `${r.name}: "${r.explained.slice(0, 56)}…"`).join(' | '));
  await ctx.close();
}

// ---- 5. the chip/ship trap is treated as a real word, not a plain wrong --------------
console.log('== 5. the chip/ship trap: a real word gets a real answer ==');
{
  const { ctx, page } = await open('teachme');
  await openLesson(page, 'Sounds in words');
  await toTry(page, 1);
  assert(await page.evaluate(() => window.__teachme.stepKind()) === 'place', 'TRY 2 is a place step (drag the letters into the gap)');
  const slipsBefore = await page.evaluate(() => window.__teachme.state().slips);
  await page.evaluate(() => window.__teachme.stepHooks().drop('ch', 0));
  await page.waitForTimeout(250);
  const r = await page.evaluate(() => ({ fb: window.__teachme.feedback(), slips: window.__teachme.state().slips, gap: window.__teachme.stepHooks().gapText(0) }));
  assert(r.fb === 'That spells CHIP! Tasty — but the picture shows a SHIP. Shhh!', `the authored trap line, word for word: "${r.fb}"`);
  assert(r.slips === slipsBefore, 'and making a real word costs her nothing — it is not counted as a slip');
  assert(r.gap === '', 'the gap is still empty, so she can put the right tile in');
  await page.screenshot({ path: SHOTS + '/chip-ship-trap.png' });
  await page.evaluate(() => window.__teachme.stepHooks().drop('sh', 0));
  await page.waitForTimeout(200);
  assert(await page.evaluate(() => window.__teachme.stepHooks().gapText(0)) === 'sh', 'and then sh goes in and the word is ship');
  await ctx.close();
}

// ---- 6. stuck twice → the authored variant, announced, never a rewind ----------------
console.log('== 6. stuck on a maths step twice offers the authored variant ==');
{
  const { ctx, page } = await open('teachme');
  await openLesson(page, 'Hundreds, tens and ones');
  await toTry(page, 0);
  const before = await page.evaluate(() => ({ idx: window.__teachme.card().idx, q: document.querySelector('.tm-sentence').textContent }));
  await page.evaluate(() => window.__teachme.wrongStep());
  await page.waitForTimeout(200);
  await page.evaluate(() => window.__teachme.wrongStep());
  await page.waitForFunction(() => window.__teachme.usingVariant(), null, { timeout: 6000 });
  await page.waitForTimeout(1800);
  const after = await page.evaluate(() => ({ idx: window.__teachme.card().idx, q: document.querySelector('.tm-sentence').textContent, type: window.__teachme.card().type }));
  assert(after.idx === before.idx && after.type === 'try', 'she is still on the same TRY step — nothing rewound');
  assert(after.q !== before.q && after.q.includes('274'), `and the lesson's own authored variant is what she now sees: "${after.q.trim()}"`);
  await ctx.close();
}

// ---- 7. lesson stars and the Journal stamp fire once each ----------------------------
console.log('== 7. Lesson Stars and the Journal stamp, once each ==');
{
  const { ctx, page } = await open('teachme');
  await openLesson(page, 'How a story works');
  for (let i = 0; i < 40; i++) {
    const t = await page.evaluate(() => window.__teachme.card().type);
    if (await page.evaluate(() => window.__teachme.ended())) break;
    if (t === 'try') { await page.evaluate(() => window.__teachme.solveStep()); await page.waitForTimeout(1050); }
    else { await page.evaluate(() => window.__teachme.tapNext()); await page.waitForTimeout(180); }
  }
  const ceremony = await page.waitForSelector('.lesson-ceremony', { timeout: 8000 }).then(() => true).catch(() => false);
  assert(ceremony, 'the RUN15 ceremony runs at WIN — reused, not rebuilt');
  const stamp = await page.evaluate(() => (document.querySelector('.lc-journal') || {}).textContent);
  assert(stamp && stamp.includes('I know how stories work!'), `and it shows the lesson's authored stamp: "${stamp}"`);
  await page.screenshot({ path: SHOTS + '/win-ceremony.png' });
  await page.waitForSelector('.result-card', { timeout: 10000 });
  await page.waitForTimeout(400);
  const s = await page.evaluate(() => {
    const st = window.BooTown.State.getState();
    return { lesson: st.stars.byType.lesson, journal: Object.keys(st.journal || {}).filter(k => k.startsWith('lesson_')) };
  });
  assert(s.lesson > 0, `Lesson Stars credited (${s.lesson})`);
  assert(s.journal.length === 1 && s.journal[0] === 'lesson_howStoriesWork', `the Journal took exactly one badge (${s.journal.join(',')})`);
  await ctx.close();
}

// ---- 8. all nine lessons play end to end without a page error -----------------------
console.log('== 8. every lesson plays through, start to finish ==');
{
  const { ctx, page } = await open('teachme');
  const names = await page.evaluate(async () => (await import('./data/lessons.js')).LESSONS.map(l => l.name));
  const played = [];
  for (const name of names) {
    await page.evaluate(() => window.BooTown.go('teachme', {}));
    await openLesson(page, name);
    let guard = 0;
    while (guard++ < 45 && !(await page.evaluate(() => window.__teachme.ended()))) {
      const t = await page.evaluate(() => window.__teachme.card().type);
      if (t === 'try') { await page.evaluate(() => window.__teachme.solveStep()); await page.waitForTimeout(1050); }
      else { await page.evaluate(() => window.__teachme.tapNext()); await page.waitForTimeout(170); }
    }
    played.push({ name, ended: await page.evaluate(() => window.__teachme.ended()), slips: await page.evaluate(() => window.__teachme.state().slips) });
    // Closing the ceremony hands off to the results screen, and that navigation is async.
    // Starting the next lesson before it lands lets main.js's navToken supersede US — so
    // wait for results to own the screen first. A condition, not a sleep.
    await page.evaluate(() => { const c = window.__lessonCeremony; if (c) c.close(); });
    await page.waitForFunction(() => document.getElementById('screen').dataset.screen === 'results', null, { timeout: 15000 }).catch(() => {});
  }
  const stuck = played.filter(p => !p.ended);
  assert(stuck.length === 0, `all ${played.length} lessons play to the end` + (stuck.length ? ': stuck on ' + stuck.map(p => p.name).join(', ') : ''));
  assert(played.every(p => p.slips === 0), 'and a clean run through every one has no slips (three stars)');
  await ctx.close();
}

console.log(errors.length ? '\nPAGE ERRORS: ' + errors.slice(0, 5).join(' | ') : '\nno page errors');
if (errors.length) failed = true;
await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
