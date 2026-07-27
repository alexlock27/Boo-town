// tests/r17x1-jokes.mjs — RUN17 X1: the Joke Boo.
//
// The assertions X1 names: 120 jokes present and typed; no repeats within a cycle over 200
// draws per type; knock-knock advances line by line with taps; spoken and shown both work;
// favourite adds to the Journal.
//
// Plus the one that matters most for an AUTHORED pack: data/jokes.js is diffed
// CHARACTER-FOR-CHARACTER against CONTENT_JOKES.md, so a well-meaning later edit that
// "tidies" a punchline fails here instead of shipping. CONTENT_JOKES.md is a private
// planning doc and gitignored, so on a clone without it that one section SKIPS loudly
// rather than passing silently — the structural checks below still run either way.
import { chromium } from 'playwright';
import { existsSync, readFileSync, mkdirSync } from 'fs';
import { JOKES, JOKES_BY_TYPE, KNOCK, ANIMAL, SILLY, BOO, poolFor, createJokeBag, jokeId } from '../data/jokes.js';

const RAW = process.env.BASE || 'http://127.0.0.1:8000';
const BASE = RAW.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
const RESOLVE = ['--host-resolver-rules=MAP app.localhost 127.0.0.1'];
const SHOTS = 'screenshots/run17/x1';
mkdirSync(SHOTS, { recursive: true });

let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const skip = (m) => console.log('  ~ SKIP:', m);

// ---- 1. the pack, transcribed exactly -------------------------------------------------
console.log('== data/jokes.js is CONTENT_JOKES.md, character for character ==');
const SIMPLE = { knock: [3], animal: [1, 3, 24], silly: [3, 6, 12, 18, 19, 20], boo: [2, 4, 5] };
const PACK = 'CONTENT_JOKES.md';
if (!existsSync(PACK)) {
  skip(`${PACK} is not in this checkout (it is a gitignored planning doc) — the exact-transcription diff did not run`);
} else {
  const lines = readFileSync(PACK, 'utf8').split(/\r?\n/);
  const parsed = { knock: [], animal: [], silly: [], boo: [] };
  let type = null;
  for (const raw of lines) {
    const th = raw.match(/^## TYPE:\s+(\w+)/);
    if (th) { type = th[1]; continue; }
    if (/^## /.test(raw)) { type = null; continue; }
    if (!type) continue;
    const m = raw.match(/^(\d+)\.\s+(.*)$/);
    if (!m) continue;
    let body = m[2];
    const note = body.match(/\s*\[[^\]]*\]\s*$/);
    if (note) body = body.slice(0, note.index);
    if (type === 'knock') {
      const k = body.match(/^name:\s*(.*?)\s+response:\s*(.*?)\s*$/);
      if (k) parsed.knock.push({ name: k[1], response: k[2] });
    } else {
      const k = body.match(/^setup:\s*(.*?)\s+punchline:\s*(.*?)\s*$/);
      if (k) parsed[type].push({ setup: k[1], punchline: k[2] });
    }
  }
  let drift = 0;
  for (const t of Object.keys(parsed)) {
    const impl = JOKES_BY_TYPE[t];
    if (parsed[t].length !== impl.length) { drift++; console.log(`   ${t}: pack has ${parsed[t].length}, data/jokes.js has ${impl.length}`); continue; }
    parsed[t].forEach((p, i) => {
      const j = impl[i];
      const fields = t === 'knock' ? ['name', 'response'] : ['setup', 'punchline'];
      for (const f of fields) {
        if (p[f] !== j[f]) { drift++; console.log(`   ${t} #${i + 1} ${f}:\n     pack: ${JSON.stringify(p[f])}\n     impl: ${JSON.stringify(j[f])}`); }
      }
    });
  }
  assert(drift === 0, `every joke matches the authored pack exactly (${drift} drifted)`);

  // the toddler subset is the pack's own list, not a re-judged one
  let subsetOk = true;
  for (const t of Object.keys(SIMPLE)) {
    const got = JOKES_BY_TYPE[t].map((j, i) => (j.simple ? i + 1 : 0)).filter(Boolean);
    if (String(got) !== String(SIMPLE[t])) { subsetOk = false; console.log(`   ${t} simple:true = [${got}], pack says [${SIMPLE[t]}]`); }
  }
  assert(subsetOk, 'the simple:true subset is exactly the pack\'s authored toddler list');
}

// ---- 2. structure ---------------------------------------------------------------------
console.log('== 120 jokes, present and typed ==');
assert(JOKES.length === 120, `120 jokes present (${JOKES.length})`);
for (const [t, list] of Object.entries(JOKES_BY_TYPE)) assert(list.length === 30, `${t}: 30 jokes (${list.length})`);
assert(JOKES.every(j => ['knock', 'animal', 'silly', 'boo'].includes(j.type)), 'every joke carries one of the four types');
assert(KNOCK.every(j => j.name && j.response), 'every knock knock carries a name and a response');
assert([...ANIMAL, ...SILLY, ...BOO].every(j => j.setup && j.punchline), 'every setup joke carries a setup and a punchline');
assert(KNOCK.filter(j => j.interrupt).length === 1 && KNOCK[3].interrupt, 'exactly one interrupting knock knock, and it is #4');
assert(new Set(JOKES.map(jokeId)).size === 120, 'every joke has a distinct stable id');

// ---- 3. no repeats within a cycle, over 200 draws per type ---------------------------
console.log('== a joke never repeats until its type\'s pool has cycled (200 draws per type) ==');
for (const t of Object.keys(JOKES_BY_TYPE)) {
  const pool = poolFor(t, 'medium');
  const bag = createJokeBag(pool);
  const draws = [];
  for (let i = 0; i < 200; i++) draws.push(jokeId(bag.draw()));
  let clean = true, badAt = -1;
  for (let start = 0; start + pool.length <= draws.length; start += pool.length) {
    const cycle = draws.slice(start, start + pool.length);
    if (new Set(cycle).size !== pool.length) { clean = false; badAt = start; break; }
  }
  assert(clean, `${t}: every full cycle of ${pool.length} draws is repeat-free over 200 draws${clean ? '' : ` (cycle at ${badAt} repeated)`}`);
}

// ---- 4. the toddler pool is the authored subset and nothing else ---------------------
console.log('== the Toddler tier draws ONLY from the authored simple subset ==');
for (const t of Object.keys(JOKES_BY_TYPE)) {
  const pool = poolFor(t, 'toddler');
  assert(pool.length > 0 && pool.every(j => j.simple), `${t}: toddler pool is ${pool.length} joke(s), all simple:true`);
}
assert(poolFor('animal', 'toddler').length === 3 && poolFor('silly', 'toddler').length === 6,
  'the toddler pools are the pack\'s sizes (animal 3, silly 6)');

// ---- 5. in the browser ----------------------------------------------------------------
const AK = ['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground', 'boohouse', 'gallery'];
const save = (extra = {}) => JSON.stringify({
  version: 17, name: 'Ada', ageAsked: true, age: 9,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'Twiggy' },
  inventory: { boo_inky: 1 }, stars: { total: 40, byGame: {} }, trophies: {}, boxes: 0, journal: {},
  town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 0 }, expedition: { party: [], tiers: {}, progress: {} },
  seen: { trophyRetro: true, lastStarsShown: 40, introSeen: { jokeboo: true } },
  settings: { sound: true, music: false, voice: true, content: 'medium' },
  ...extra
});

const browser = await chromium.launch({ args: RESOLVE });
async function open(saveJson = save(), viewport = { width: 1024, height: 768 }) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), saveJson);
  // Record what is actually SPOKEN, so "spoken and shown both work" is evidence rather
  // than hope. Stubbed at the speechSynthesis seam (the house pattern, as in
  // r12s13-a11y): a module namespace is read-only, so patching tts.speak silently
  // does nothing and the probe would pass on an app that never spoke at all.
  await page.addInitScript(() => {
    window.__spoken = [];
    const install = () => {
      if (!window.speechSynthesis) return false;
      window.speechSynthesis.speak = (u) => { window.__spoken.push(u && u.text); };
      return true;
    };
    if (!install()) document.addEventListener('DOMContentLoaded', install, { once: true });
  });
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => window.BooTown, null, { timeout: 20000 });
  await page.evaluate(() => window.BooTown.go('jokeboo'));
  await page.waitForFunction(() => window.__jokeboo, null, { timeout: 10000 });
  await page.evaluate(() => { if (window.__intro) window.__intro.close(); });
  return { ctx, page };
}

console.log('== the stage: four type cards ==');
{
  const { ctx, page } = await open();
  const types = await page.evaluate(() => window.__jokeboo.types());
  assert(String(types) === 'knock,animal,silly,boo', `four type cards, in the authored order (${types})`);
  await page.screenshot({ path: `${SHOTS}/picker-1024.png` });
  await ctx.close();
}

console.log('== knock knock advances line by line with taps ==');
{
  const { ctx, page } = await open();
  const walk = await page.evaluate(() => {
    window.__jokeboo.pick('knock');
    // draw until we get a non-interrupting one, so the tap rhythm is the plain case
    let guard = 0;
    while (window.__jokeboo.current().interrupt && guard++ < 20) window.__jokeboo.another();
    const seen = [{ who: window.__jokeboo.who(), said: window.__jokeboo.said() }];
    for (let i = 0; i < 4; i++) { window.__jokeboo.tap(); seen.push({ who: window.__jokeboo.who(), said: window.__jokeboo.said() }); }
    return { seen, beats: window.__jokeboo.beats(), ended: window.__jokeboo.ended(), spoken: window.__spoken.slice() };
  });
  assert(walk.beats.length === 5, `the knock knock exchange is five beats (${walk.beats.length})`);
  assert(walk.seen[0].said === 'Knock knock!' && walk.seen[0].who === 'Boo', 'beat 1: the Boo says "Knock knock!"');
  assert(walk.seen[1].said === 'Who’s there?' && walk.seen[1].who === 'You', 'beat 2: the child says "Who\'s there?"');
  assert(walk.seen[2].who === 'Boo' && /\.$/.test(walk.seen[2].said), 'beat 3: the Boo gives the name');
  assert(walk.seen[3].who === 'You' && / who\?$/.test(walk.seen[3].said), 'beat 4: the child says "{name} who?"');
  assert(walk.seen[4].who === 'Boo' && walk.beats[4].punch, 'beat 5: the Boo lands the punchline');
  assert(walk.ended, 'the joke is finished after the punchline, not left mid-air');
  // shown AND spoken
  assert(walk.spoken.includes(walk.seen[0].said) && walk.spoken.includes(walk.seen[4].said),
    'every line is both shown and spoken');
  await ctx.close();
}

console.log('== the Interrupting Boo fires its punchline EARLY ==');
{
  const { ctx, page } = await open();
  const r = await page.evaluate(async () => {
    window.__jokeboo.pick('knock');
    let guard = 0;
    while (!window.__jokeboo.current().interrupt && guard++ < 400) window.__jokeboo.another();
    if (!window.__jokeboo.current().interrupt) return { found: false };
    const beats = window.__jokeboo.beats();
    // tap to the child's fourth line, then WAIT — no further tap is given
    window.__jokeboo.tap(); window.__jokeboo.tap(); window.__jokeboo.tap();
    const atFour = { who: window.__jokeboo.who(), said: window.__jokeboo.said(), ended: window.__jokeboo.ended() };
    await new Promise(r2 => setTimeout(r2, 1200));
    return { found: true, beats, atFour, after: { said: window.__jokeboo.said(), ended: window.__jokeboo.ended() } };
  });
  assert(r.found, 'the Interrupting Boo is reachable from the knock knock pool');
  if (r.found) {
    assert(/wh—$/.test(r.atFour.said), `the child is cut off mid-word ("${r.atFour.said}")`);
    assert(!r.atFour.ended, 'the punchline has NOT landed yet at that instant');
    assert(r.after.said === 'BOO!' && r.after.ended, 'the punchline fires on its own, with no tap from her');
  }
  await ctx.close();
}

console.log('== a setup joke runs setup -> eyebrow beat -> punchline ==');
{
  const { ctx, page } = await open();
  const r = await page.evaluate(() => {
    window.__jokeboo.pick('animal');
    const first = { said: window.__jokeboo.said(), pose: window.__jokeboo.pose() };
    window.__jokeboo.tap();
    const beat = { said: window.__jokeboo.said(), pose: window.__jokeboo.pose() };
    window.__jokeboo.tap();
    const punch = { said: window.__jokeboo.said(), pose: window.__jokeboo.pose(), ended: window.__jokeboo.ended() };
    return { first, beat, punch, spoken: window.__spoken.slice() };
  });
  assert(r.first.pose === 'tell', 'the setup is told plainly');
  assert(r.beat.pose === 'beat' && r.beat.said === r.first.said, 'a beat of anticipation holds the setup and raises the eyebrow');
  assert(r.punch.pose === 'punch' && r.punch.ended && r.punch.said !== r.first.said, 'then the punchline lands');
  assert(r.spoken.includes(r.first.said) && r.spoken.includes(r.punch.said), 'setup and punchline are both spoken');
  await ctx.close();
}

console.log('== "Tell me another!" gives a different joke ==');
{
  const { ctx, page } = await open();
  const ids = await page.evaluate(() => {
    window.__jokeboo.pick('silly');
    const out = [window.__jokeboo.current().id];
    for (let i = 0; i < 5; i++) out.push(window.__jokeboo.another());
    return out;
  });
  assert(new Set(ids).size === ids.length, `six draws, six different jokes (${ids.join(' ')})`);
  await ctx.close();
}

console.log('== the heart adds a joke to the Journal, and only once ==');
{
  const { ctx, page } = await open();
  const r = await page.evaluate(async () => {
    window.__jokeboo.pick('boo');
    const id = window.__jokeboo.current().id;
    const before = window.__jokeboo.favourited();
    window.__jokeboo.favourite();
    window.__jokeboo.favourite();   // a second tap must not double-stamp
    const { journalEntries } = await import('./js/quests.js');
    const entries = journalEntries().filter(e => e.key.startsWith('joke_'));
    return { id, before, on: window.__jokeboo.favourited(), entries };
  });
  assert(r.before === false, 'a fresh joke starts unfavourited');
  assert(r.on === true, 'the heart fills when she keeps a joke');
  assert(r.entries.length === 1, `exactly one Journal stamp for it (${r.entries.length})`);
  assert(r.entries[0].key === 'joke_' + r.id, 'the stamp is keyed to that joke');
  assert(r.entries[0].icon === '😄' && r.entries[0].label && r.entries[0].label.length > 3,
    `the Journal sticker shows the joke itself ("${r.entries[0].label}")`);
  await ctx.close();
}

console.log('== the Toddler tier tells only the simple jokes ==');
{
  const { ctx, page } = await open(save({ age: 3, settings: { sound: true, music: false, voice: true, content: 'toddler' } }), { width: 390, height: 844 });
  const r = await page.evaluate(() => {
    const out = {};
    for (const t of window.__jokeboo.types()) out[t] = window.__jokeboo.drawIds(t, 12);
    return { out, tier: window.__jokeboo.tier() };
  });
  assert(r.tier === 'toddler', 'the screen is running at the Toddler tier');
  const allowed = new Set();
  for (const [t, ns] of Object.entries(SIMPLE)) for (const n of ns) allowed.add(`${t}:${n}`);
  const drawn = Object.values(r.out).flat();
  const strays = drawn.filter(id => !allowed.has(id));
  assert(strays.length === 0, `36 toddler draws stay inside the authored simple subset (${strays.length} stray)`);
  await page.evaluate(() => window.__jokeboo.pick('silly'));
  await page.screenshot({ path: `${SHOTS}/toddler-390.png` });
  await ctx.close();
}

console.log('== the Joke Boo stands in the Meadow, and tapping it opens the stage ==');
{
  const ctx0 = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await ctx0.newPage();
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), save());
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => window.BooTown, null, { timeout: 20000 });
  await page.evaluate(() => window.BooTown.go('town', { area: 'meadow' }));
  await page.waitForTimeout(900);
  const stage = page.locator('.t-item[data-item="deco_jokestage"]').first();
  assert(await stage.count() > 0, 'a Joke Boo stage is seeded into the Meadow');
  await page.screenshot({ path: `${SHOTS}/meadow-1024.png` });
  if (await stage.count() > 0) {
    await stage.click();
    await page.waitForTimeout(700);
    const screen = await page.evaluate(() => document.getElementById('screen').dataset.screen);
    assert(screen === 'jokeboo', `tapping it opens the Joke Boo stage (landed on "${screen}")`);
  }
  await ctx0.close();
}

console.log('== the intro teaches itself, and "?" replays it ==');
{
  const ctx1 = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx1.newPage();
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s),
    save({ seen: { trophyRetro: true, lastStarsShown: 40, introSeen: {} } }));
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => window.BooTown, null, { timeout: 20000 });
  await page.evaluate(() => window.BooTown.go('jokeboo'));
  await page.waitForTimeout(600);
  const intro = await page.evaluate(() => (window.__intro ? { game: window.__intro.game, total: window.__intro.total } : null));
  assert(intro && intro.game === 'jokeboo', 'the first-ever open runs its own intro');
  assert(intro && intro.total === 3, `three short steps (${intro && intro.total})`);
  await page.evaluate(() => window.__intro.close());
  await page.waitForTimeout(250);
  await page.locator('.jb-help').click();
  await page.waitForTimeout(300);
  const again = await page.evaluate(() => !!document.querySelector('.intro-overlay'));
  assert(again, 'the "?" button replays it');
  await page.evaluate(() => { if (window.__intro) window.__intro.close(); });
  await ctx1.close();
}

await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
