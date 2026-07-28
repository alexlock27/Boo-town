// tests/r18b-speech.mjs — RUN18B Y1: the speech queue.
//
// The bug this closes: every speak() began with speechSynthesis.cancel(). Two lines issued
// close together therefore produced ONE line — the second killed the first mid-word. A
// guide interrupted by herself, on every screen that says two things in a row.
//
// speechSynthesis is STUBBED here rather than driven for real. Real voices are absent on
// CI machines, vary per OS, and speak in wall-clock seconds; a stub makes "played to its
// end, in order" an assertion about the QUEUE rather than about whatever voice pack the
// machine happens to have. The stub records every utterance it is given, in order, and
// only ends one when the test says so — so an utterance that is cut off mid-word is
// visible as an utterance that never reached its end.
//
// Expected runtime: ~4s (measured 4.0s). Not @serial.

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const RAW = process.env.BASE || 'http://127.0.0.1:8000';
const BASE = RAW.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
const RESOLVE = ['--host-resolver-rules=MAP app.localhost 127.0.0.1'];
const SHOTS = 'screenshots/run18b/y1';
mkdirSync(SHOTS, { recursive: true });
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };

const AK = ['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground', 'boohouse', 'gallery'];
const save = (voice = true) => JSON.stringify({
  version: 17, name: 'Ada', ageAsked: true,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1 }, stars: { total: 400, byGame: {}, byType: {}, spent: {}, legacy: 0 }, trophies: {}, boxes: 0,
  town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 3 },
  seen: { trophyRetro: true, lastStarsShown: 400, whatsnewVersion: 'x' },
  settings: { sound: false, music: false, voice, content: 'full' }
});

// The stub: installed BEFORE any module loads, so js/tts.js only ever sees this.
const STUB = () => {
  const log = [];
  let idc = 0;
  class FakeUtterance {
    constructor(text) { this.text = text; this.__id = ++idc; }
  }
  const synth = {
    __log: log,
    speaking: false,
    __live: null,
    getVoices: () => [{ name: 'Fake UK', lang: 'en-GB', localService: true }],
    speak(u) {
      log.push({ id: u.__id, text: u.text, started: false, ended: false, cancelled: false });
      synth.__live = u;
      synth.speaking = true;
      // start on the next tick, the way a real engine does
      setTimeout(() => {
        const rec = log.find(r => r.id === u.__id);
        if (rec && !rec.cancelled) { rec.started = true; try { u.onstart && u.onstart(); } catch {} }
      }, 0);
    },
    cancel() {
      const u = synth.__live;
      synth.speaking = false;
      synth.__live = null;
      if (u) {
        const rec = log.find(r => r.id === u.__id);
        if (rec && !rec.ended) rec.cancelled = true;
      }
    },
    // the test's hand on the clock: end whatever is speaking now
    __endCurrent() {
      const u = synth.__live;
      if (!u) return false;
      const rec = log.find(r => r.id === u.__id);
      if (rec) rec.ended = true;
      synth.__live = null;
      synth.speaking = false;
      try { u.onend && u.onend(); } catch {}
      return true;
    }
  };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  window.SpeechSynthesisUtterance = FakeUtterance;
  window.__speech = synth;
};

const browser = await chromium.launch({ args: RESOLVE });
const errors = [];
async function open(voiceOn = true) {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e).split('\n')[0]));
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), save(voiceOn));
  await page.addInitScript(STUB);
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => window.BooTown && document.getElementById('screen').dataset.screen, null, { timeout: 20000 });
  return { ctx, page };
}
const log = (page) => page.evaluate(() => window.__speech.__log.map(r => ({ ...r })));
// The app speaks on its own during boot (the hub greets her), so every scenario starts
// from a clean slate: cancel anything in flight and wipe the stub's log. Without this the
// assertions index into somebody else's utterances.
async function reset(page) {
  await page.evaluate(async () => {
    (await import('./js/tts.js')).cancel();
    window.__speech.__live = null;
    window.__speech.speaking = false;
    window.__speech.__log.length = 0;
  });
  await page.waitForTimeout(60);
}

// ---- 1. two rapid lines are TWO complete utterances, in order --------------------------
console.log('== 1. two rapid guide lines both play, in order ==');
{
  const { ctx, page } = await open();
  await reset(page);
  await page.evaluate(async () => {
    const { speakMaybe } = await import('./js/guide.js');
    speakMaybe('First line please');
    speakMaybe('Second line please');
  });
  await page.waitForTimeout(120);
  let l = await log(page);
  assert(l.length === 1, `only the FIRST is handed to the engine at once (${l.length} live)`);
  assert(l[0].text === 'First line please' && l[0].started && !l[0].cancelled,
    'the first line starts and is not cancelled by the second — the old code killed it here');
  const q = await page.evaluate(async () => (await import('./js/tts.js')).queueState());
  assert(q.length === 2, `and the second is QUEUED behind it (queue length ${q.length})`);

  await page.evaluate(() => window.__speech.__endCurrent());
  await page.waitForTimeout(120);
  l = await log(page);
  assert(l.length === 2 && l[1].text === 'Second line please' && l[1].started,
    'when the first ends, the second begins — in order');
  assert(l[0].ended && !l[0].cancelled, 'and the first reached its END, not a cancellation');
  await ctx.close();
}

// ---- 2. leaving a screen silences THAT screen, fast -------------------------------------
console.log('== 2. unmount mid-utterance goes silent within UNMOUNT_SILENCE_MS ==');
{
  const { ctx, page } = await open();
  await page.evaluate(() => window.BooTown.go('jokeboo'));
  await page.waitForFunction(() => document.getElementById('screen').dataset.screen === 'jokeboo', null, { timeout: 10000 });
  await reset(page);
  await page.evaluate(async () => {
    const { speakMaybe } = await import('./js/guide.js');
    speakMaybe('I am the jokes screen talking');
    speakMaybe('and I have more to say');
  });
  await page.waitForTimeout(100);
  const before = await page.evaluate(async () => ({
    q: (await import('./js/tts.js')).queueState(),
    owner: window.__speech.__live ? 'speaking' : 'silent'
  }));
  assert(before.q.length === 2 && before.q.owners.every(o => o === 'jokeboo'),
    `both utterances are tagged with the screen that asked (${JSON.stringify(before.q.owners)})`);

  // Wait for THIS SCREEN's speech to be gone — not for global silence, because the hub
  // she is arriving at legitimately greets her, and that is not a leak.
  const t0 = Date.now();
  await page.evaluate(() => window.BooTown.go('hub'));
  await page.waitForFunction(async () => {
    const q = (await import('./js/tts.js')).queueState();
    return !q.owners.includes('jokeboo');
  }, null, { timeout: 2000 });
  const silentAfter = Date.now() - t0;
  const after = await page.evaluate(async () => ({
    q: (await import('./js/tts.js')).queueState(),
    log: window.__speech.__log.map(r => ({ text: r.text, ended: r.ended, cancelled: r.cancelled }))
  }));
  assert(!after.q.owners.includes('jokeboo'), `the leaving screen's utterances are gone (owners now ${JSON.stringify(after.q.owners)})`);
  assert(silentAfter <= 150 + 60, `silent in ${silentAfter}ms (UNMOUNT_SILENCE_MS is 150)`);
  assert(after.log.some(r => /jokes screen talking/.test(r.text) && r.cancelled), 'the playing utterance was really cancelled, not left to finish');
  await ctx.close();
}

// ---- 3. speech does not leak across a navigation ----------------------------------------
console.log('== 3. navigation never leaks speech ==');
{
  const { ctx, page } = await open();
  await page.evaluate(() => window.BooTown.go('jokeboo'));
  await page.waitForFunction(() => document.getElementById('screen').dataset.screen === 'jokeboo', null, { timeout: 10000 });
  await reset(page);
  await page.evaluate(async () => {
    const { speakMaybe } = await import('./js/guide.js');
    for (let i = 0; i < 3; i++) speakMaybe('jokes line ' + i);
  });
  await page.waitForTimeout(80);
  await page.evaluate(() => window.BooTown.go('collection'));
  await page.waitForFunction(() => document.getElementById('screen').dataset.screen === 'collection', null, { timeout: 10000 });
  await page.waitForTimeout(300);
  const leaked = await page.evaluate(() => {
    const started = window.__speech.__log.filter(r => r.started).map(r => r.text);
    return { started, live: !!window.__speech.__live };
  });
  assert(!leaked.started.some(t => /jokes line [12]/.test(t)),
    `no queued line from the old screen ever started on the new one (started: ${JSON.stringify(leaked.started)})`);
  assert(!leaked.live, 'and nothing is still speaking after the navigation');
  await ctx.close();
}

// ---- 4. the Interrupting Boo still pre-empts ---------------------------------------------
console.log('== 4. interrupt:true pre-empts, and only it does ==');
{
  const { ctx, page } = await open();
  await reset(page);
  const r = await page.evaluate(async () => {
    const { speakMaybe } = await import('./js/guide.js');
    speakMaybe('Knock knock who is thereeee');
    await new Promise(res => setTimeout(res, 40));
    const beforeText = window.__speech.__live ? window.__speech.__live.text : null;
    speakMaybe('BOO!', true, { interrupt: true });
    await new Promise(res => setTimeout(res, 40));
    return {
      beforeText,
      log: window.__speech.__log.map(x => ({ text: x.text, started: x.started, cancelled: x.cancelled, ended: x.ended })),
      live: window.__speech.__live ? window.__speech.__live.text : null
    };
  });
  assert(r.beforeText === 'Knock knock who is thereeee', 'the first line was speaking');
  assert(r.log[0].cancelled === true, 'and the interrupting line CUT IT OFF (cancelled, not ended)');
  assert(r.live === 'BOO!', `the punchline is what is speaking now ("${r.live}")`);
  await ctx.close();
}

// ---- 4b. the interruption names its target, so drift cannot reverse the joke ------------
// The screen and the voice do not share a clock: the joke advances on a 520ms timer while
// a spoken line runs 2.4-2.9s, so the line to be cut is routinely still QUEUED when the
// punchline arrives. "Cancel whatever is playing" then cut the WRONG line and let the
// interrupted one speak in full AFTER the punchline — the joke told backwards. (Found by
// the playtest critic: BOO! at +36359ms, "Interrupting Boo wh—" at +36776ms.)
console.log('== 4b. the interrupted line never speaks, whether or not it had started ==');
{
  const { ctx, page } = await open();
  await reset(page);
  // (a) the drifted case: the target is still QUEUED behind something else
  const drifted = await page.evaluate(async () => {
    const { speakMaybe } = await import('./js/guide.js');
    speakMaybe('a long punchline still going on and on');   // occupies the engine
    const target = speakMaybe('Interrupting Boo wh—');       // queued, not started
    await new Promise(r => setTimeout(r, 30));
    const startedBefore = window.__speech.__log.map(x => x.text);
    speakMaybe('BOO!', true, { interrupt: target });
    await new Promise(r => setTimeout(r, 60));
    return {
      startedBefore,
      log: window.__speech.__log.map(x => ({ text: x.text, started: x.started, cancelled: x.cancelled, ended: x.ended })),
      live: window.__speech.__live ? window.__speech.__live.text : null
    };
  });
  assert(!drifted.startedBefore.includes('Interrupting Boo wh—'), 'the line to be cut had NOT started — it was still queued');
  assert(drifted.live === 'BOO!', `the punchline is speaking (${drifted.live})`);
  assert(!drifted.log.some(x => x.text === 'Interrupting Boo wh—' && x.started),
    'and the interrupted line NEVER speaks — not before the punchline, and not after it');

  // (b) the plain case: the target really is what is playing
  await reset(page);
  const playing = await page.evaluate(async () => {
    const { speakMaybe } = await import('./js/guide.js');
    const target = speakMaybe('Interrupting Boo wh—');
    await new Promise(r => setTimeout(r, 30));
    speakMaybe('BOO!', true, { interrupt: target });
    await new Promise(r => setTimeout(r, 40));
    return { log: window.__speech.__log.map(x => ({ text: x.text, cancelled: x.cancelled, ended: x.ended })), live: window.__speech.__live ? window.__speech.__live.text : null };
  });
  assert(playing.log[0].cancelled === true, 'when it HAD started, it is cut off mid-word');
  assert(playing.live === 'BOO!', 'and the punchline lands on top of it — the joke still works');
  await ctx.close();
}

// ---- 4c. an intro's speech leaves with the intro ----------------------------------------
// Three intro cards are 2.7-3.4s of speech EACH, so a first visit began a round with the
// better part of ten seconds already queued — and the game's opening line, printed the
// moment she closed the card, was pushed past QUEUE_MAX and never spoken.
console.log('== 4c. closing an intro does not leave a round talking to itself ==');
{
  const { ctx, page } = await open();
  await page.evaluate(() => window.BooTown.go('soundsorter'));
  await page.waitForFunction(() => document.getElementById('screen').dataset.screen === 'soundsorter', null, { timeout: 10000 });
  await reset(page);
  const r = await page.evaluate(async () => {
    const { runIntro } = await import('./js/intro.js');
    const { speakMaybe } = await import('./js/guide.js');
    const intro = runIntro('__probe__', { steps: [{ text: 'intro one' }, { text: 'intro two' }, { text: 'intro three' }] });
    speakMaybe('intro two');
    speakMaybe('intro three');
    const before = (await import('./js/tts.js')).queueState().length;
    intro.close();
    await new Promise(res => setTimeout(res, 40));
    const after = (await import('./js/tts.js')).queueState().length;
    // the game's own first line, spoken the instant the card closes
    const id = speakMaybe('Find the sh sound!');
    await new Promise(res => setTimeout(res, 40));
    return { before, after, spokeFirst: window.__speech.__live ? window.__speech.__live.text : null, id };
  });
  assert(r.before > 0, `the intro really had speech queued (${r.before})`);
  assert(r.after === 0, `closing it clears the queue (${r.after} left)`);
  assert(r.spokeFirst === 'Find the sh sound!', `so the round's FIRST line is spoken immediately, not dropped behind the intro ("${r.spokeFirst}")`);
  await ctx.close();
}

// ---- 5. voice off: text shows, nothing speaks --------------------------------------------
console.log('== 5. with voice off, the words are shown and nothing is spoken ==');
{
  const { ctx, page } = await open(false);
  await reset(page);
  const r = await page.evaluate(async () => {
    const { speakMaybe, createGuideBubble } = await import('./js/guide.js');
    const g = createGuideBubble({});
    document.body.appendChild(g.root);
    g.sayText('You can read me but not hear me');
    speakMaybe('and this should be silent too');
    return { bubble: g.bubble.textContent, spoken: window.__speech.__log.length };
  });
  assert(/You can read me but not hear me/.test(r.bubble), `the line is on screen: "${r.bubble}"`);
  assert(r.spoken === 0, `and nothing was handed to the speech engine (${r.spoken} utterances)`);
  await ctx.close();
}

// ---- 6. the queue never exceeds QUEUE_MAX ------------------------------------------------
console.log('== 6. the queue never grows past QUEUE_MAX ==');
{
  const { ctx, page } = await open();
  await reset(page);
  const r = await page.evaluate(async () => {
    const tts = await import('./js/tts.js');
    const { speakMaybe } = await import('./js/guide.js');
    const seen = [];
    for (let i = 0; i < 12; i++) { speakMaybe('line ' + i); seen.push(tts.queueState().length); }
    const q = tts.queueState();
    return { max: Math.max(...seen), QUEUE_MAX: tts.QUEUE_MAX, ids: q.ids, playing: q.playing, length: q.length };
  });
  assert(r.QUEUE_MAX === 4, `QUEUE_MAX is exported and is 4 (got ${r.QUEUE_MAX})`);
  assert(r.max <= r.QUEUE_MAX, `12 rapid lines never grew the queue past ${r.QUEUE_MAX} (peak ${r.max})`);
  assert(r.playing === r.ids[0], 'and the utterance actually speaking is never the one dropped');
  await ctx.close();
}

// ---- 7. the constants are the authored ones ---------------------------------------------
console.log('== 7. the authored constants ==');
{
  const { ctx, page } = await open();
  await reset(page);
  const c = await page.evaluate(async () => {
    const t = await import('./js/tts.js');
    return { QUEUE_MAX: t.QUEUE_MAX, UNMOUNT_SILENCE_MS: t.UNMOUNT_SILENCE_MS, hasCancelOwner: typeof t.cancelOwner === 'function', speakReturnsId: typeof t.speak('x', {}) };
  });
  assert(c.QUEUE_MAX === 4, 'QUEUE_MAX = 4');
  assert(c.UNMOUNT_SILENCE_MS === 150, 'UNMOUNT_SILENCE_MS = 150');
  assert(c.hasCancelOwner, 'cancelOwner(screen) is exposed');
  assert(c.speakReturnsId === 'number', `speak() returns an id (${c.speakReturnsId})`);
  await ctx.close();
}

console.log(errors.length ? '\nPAGE ERRORS: ' + errors.slice(0, 5).join(' | ') : '\nno page errors');
if (errors.length) failed = true;
await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
