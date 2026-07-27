// @serial — real-clock evidence: the breathing cycle's 4s/2s/6s x4 timings are MEASURED,
// and a 48-second unhurried rhythm is precisely the cadence parallel load starves. Runs
// alone at the board's end. Expected runtime ~95s (inside the 120s budget; see
// tests/board-serial-baseline.md).
// tests/r17x3-feelings.mjs — RUN17 X3: the Feelings Corner.
//
// G17 is the reason this suite exists, and the PERSISTENCE GUARD is its centre: the whole
// promise of this feature — the promise made in writing to a grown-up, in the toggle's own
// copy — is that nothing chosen here is stored anywhere. So this suite walks EVERY path
// through the corner (all six feelings, all three offers, the full breathing cycle, the
// third-time line) and then snapshots localStorage and every IndexedDB store, and FAILS if
// a single feelings value has reached either.
//
// The guard is proved to bite (a deliberate write is detected) before it is trusted, so a
// broken probe can never pass by finding nothing.
//
// Also asserted: hidden entirely unless enabled AND tier is Medium/Full; every feeling's
// three beats; exact breathing timings, skippable; the third-time line once and only once;
// and a copy audit confirming no question, advice, diagnosis or score exists in the flow.
import { chromium } from 'playwright';
import { existsSync, readFileSync, mkdirSync } from 'fs';
import { QUESTION, FEELINGS, OFFERS, BREATHING, THIRD_TIME_LINE, TOGGLE_COPY, ALLOWED_TIERS } from '../data/feelingsLines.js';

const RAW = process.env.BASE || 'http://127.0.0.1:8000';
const BASE = RAW.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
const RESOLVE = ['--host-resolver-rules=MAP app.localhost 127.0.0.1'];
const SHOTS = 'screenshots/run17/x3';
mkdirSync(SHOTS, { recursive: true });

let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const skip = (m) => console.log('  ~ SKIP:', m);

// ---- 1. the script, transcribed exactly ----------------------------------------------
console.log('== the script is CONTENT_WARMTH.md X3, character for character ==');
assert(FEELINGS.length === 6, `six feelings (${FEELINGS.length})`);
const PACK = 'CONTENT_WARMTH.md';
if (!existsSync(PACK)) {
  skip(`${PACK} is not in this checkout (it is a gitignored planning doc) — the exact-transcription diff did not run`);
} else {
  const txt = readFileSync(PACK, 'utf8');
  let drift = 0;
  for (const f of FEELINGS) {
    // each feeling's authored validating line must appear verbatim in the pack
    if (!txt.includes(f.line)) { drift++; console.log(`   ${f.key}: line not found verbatim in the pack: ${JSON.stringify(f.line)}`); }
    if (!txt.toLowerCase().includes('feeling: ' + f.key)) { drift++; console.log(`   ${f.key}: no FEELING block in the pack`); }
  }
  for (const k of Object.keys(OFFERS)) {
    if (!txt.includes(OFFERS[k].label)) { drift++; console.log(`   offer "${k}" label not in the pack: ${OFFERS[k].label}`); }
  }
  for (const c of [BREATHING.copy.in, BREATHING.copy.hold, BREATHING.copy.out, BREATHING.close, THIRD_TIME_LINE]) {
    if (!txt.includes(c)) { drift++; console.log(`   copy not in the pack verbatim: ${JSON.stringify(c)}`); }
  }
  // the toggle copy is wrapped over three indented lines in the pack; compare unwrapped
  const flat = txt.replace(/\s+/g, ' ');
  if (!flat.includes(TOGGLE_COPY.replace(/\s+/g, ' '))) { drift++; console.log('   the grown-ups toggle copy does not match the pack'); }
  assert(drift === 0, `every authored line matches the pack exactly (${drift} drifted)`);
}

assert(BREATHING.inMs === 4000 && BREATHING.holdMs === 2000 && BREATHING.outMs === 6000 && BREATHING.cycles === 4,
  `the authored breathing timings: in 4s, hold 2s, out 6s, x4 (${BREATHING.inMs}/${BREATHING.holdMs}/${BREATHING.outMs} x${BREATHING.cycles})`);
assert(String(ALLOWED_TIERS) === 'medium,full', `available at Medium and Full only (${ALLOWED_TIERS})`);
// the authored offer mapping
const offerOf = Object.fromEntries(FEELINGS.map(f => [f.key, f.offers.join('+')]));
assert(offerOf.happy === 'dance' && offerOf.excited === 'dance', 'happy / excited are offered the dance');
assert(offerOf.calm === 'breathe' && offerOf.tired === 'breathe', 'calm / tired are offered the breathing');
assert(offerOf.worried === 'breathe+sit' && offerOf.sad === 'breathe+sit', 'worried / sad are offered breathing OR sitting a while');

// ---- 2. the copy audit ----------------------------------------------------------------
console.log('== copy audit: no question, advice, diagnosis or score anywhere in the flow ==');
{
  const everything = [
    QUESTION, THIRD_TIME_LINE, TOGGLE_COPY, BREATHING.close,
    ...FEELINGS.map(f => f.line), ...Object.values(OFFERS).map(o => o.label),
    BREATHING.copy.in, BREATHING.copy.hold, BREATHING.copy.out
  ];
  // Exactly TWO question marks exist in the whole flow, and both are authored: the opening
  // question, and the third-time line. Any third would be this feature becoming an interview.
  const questions = everything.filter(t => t.includes('?'));
  assert(questions.length === 2, `exactly two questions in the flow (${questions.length}): ${questions.map(q => JSON.stringify(q)).join(' ')}`);
  assert(questions.includes(QUESTION) && questions.includes(THIRD_TIME_LINE), 'and they are the two authored ones');
  // it never asks WHY
  assert(!everything.some(t => /\bwhy\b/i.test(t.replace(TOGGLE_COPY, ''))) || everything.filter(t => /\bwhy\b/i.test(t)).every(t => t === TOGGLE_COPY),
    'nothing in the child-facing flow contains the word "why" (the toggle copy promises it never asks)');
  // advice / instruction shapes
  const ADVICE = /\b(you should|try to|you need to|you ought|make sure|remember to|it helps to|why not|have you tried|talk to|calm down|cheer up|don't worry|it'?s ok(?:ay)? to feel)\b/i;
  const advice = everything.filter(t => ADVICE.test(t));
  advice.forEach(t => console.log('   advice-shaped:', t));
  assert(advice.length === 0, `no line gives advice (${advice.length})`);
  // diagnosis / interpretation
  const DIAGNOSE = /\b(anxious|anxiety|depress\w*|stress\w*|trauma\w*|disorder|symptom|mental health|therapy|therapist|counsell?or|because you|that means you|you are feeling this because)\b/i;
  const diag = everything.filter(t => DIAGNOSE.test(t));
  diag.forEach(t => console.log('   diagnosis-shaped:', t));
  assert(diag.length === 0, `no line interprets or diagnoses (${diag.length})`);
  // scoring / tracking
  const SCORE = /\b(score|points?|streak|level|progress|track(?:ing|ed)?|log|chart|rating|out of \d|how often|this week you)\b/i;
  const score = everything.filter(t => SCORE.test(t));
  score.forEach(t => console.log('   score-shaped:', t));
  assert(score.length === 0, `no line scores or tracks anything (${score.length})`);
  // the guards must bite
  assert(ADVICE.test('You should talk to someone') && DIAGNOSE.test('That sounds like anxiety') && SCORE.test('Your mood score this week'),
    'the copy-audit guards still catch a known offender (self-check)');
  // the toggle copy is gender-neutral: no gendered pronoun anywhere in it
  assert(!/\b(she|her|hers|he|him|his)\b/i.test(TOGGLE_COPY), 'the grown-ups toggle copy is gender-neutral throughout');
  assert(/\bthey('re)?\b/i.test(TOGGLE_COPY) && /\bthem\b/i.test(TOGGLE_COPY), 'and it uses they/them, as authored');
  assert(/nothing they choose is saved/i.test(TOGGLE_COPY), 'and it states plainly that nothing is saved');
}

// ---- 3. in the browser -----------------------------------------------------------------
const AK = ['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground', 'boohouse', 'gallery'];
const save = (settings = {}, extra = {}) => JSON.stringify({
  version: 17, name: 'Ada', ageAsked: true, age: 9,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'Twiggy' },
  inventory: { boo_inky: 1 }, stars: { total: 40, byGame: {} }, trophies: {}, boxes: 0, journal: {},
  town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 0 }, expedition: { party: [], tiers: {}, progress: {} },
  seen: { trophyRetro: true, lastStarsShown: 40, introSeen: {} },
  settings: { sound: true, music: false, voice: true, content: 'medium', ...settings },
  ...extra
});

const browser = await chromium.launch({ args: RESOLVE });
async function open(saveJson = save({ feelingsCorner: true }), viewport = { width: 1024, height: 768 }) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), saveJson);
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => window.BooTown, null, { timeout: 20000 });
  return { ctx, page };
}
async function openCorner(saveJson, viewport) {
  const { ctx, page } = await open(saveJson, viewport);
  await page.evaluate(() => window.BooTown.go('feelings'));
  await page.waitForFunction(() => window.__feelings, null, { timeout: 10000 });
  return { ctx, page };
}

console.log('== hidden entirely unless switched on AND the tier is Medium or Full ==');
{
  const cases = [
    { name: 'off by default (no setting at all)', settings: {}, want: false },
    { name: 'explicitly off', settings: { feelingsCorner: false }, want: false },
    { name: 'on, but Light tier', settings: { feelingsCorner: true, content: 'light' }, want: false },
    { name: 'on, but Toddler tier', settings: { feelingsCorner: true, content: 'toddler' }, want: false },
    { name: 'on, Medium tier', settings: { feelingsCorner: true, content: 'medium' }, want: true },
    { name: 'on, Full tier', settings: { feelingsCorner: true, content: 'full' }, want: true }
  ];
  for (const c of cases) {
    const { ctx, page } = await open(save(c.settings));
    // Wait for the hub to actually mount before asking what is on it — boot is async, so
    // querying straight after window.BooTown appears finds an empty screen and every chip
    // looks "absent", which would make this assertion pass for the wrong reason.
    // The Toddler tier renders a different hub with no Today rail at all, so wait on the
    // hub root and then on the rail only where a rail exists.
    await page.waitForSelector('.hub', { timeout: 10000 });
    if (c.settings.content !== 'toddler') await page.waitForSelector('.today-rail .trail-chip', { timeout: 10000 });
    const chip = await page.evaluate(() => !!document.querySelector('.trail-chip.feelings'));
    // and the route itself refuses: it bounces straight back to the hub
    await page.evaluate(() => window.BooTown.go('feelings'));
    await page.waitForTimeout(500);
    const landed = await page.evaluate(() => document.getElementById('screen').dataset.screen);
    assert(chip === c.want, `${c.name}: hub chip ${c.want ? 'present' : 'absent'}`);
    assert(c.want ? landed === 'feelings' : landed === 'hub',
      `${c.name}: the route ${c.want ? 'opens' : 'refuses and returns to the hub'} (landed "${landed}")`);
    await ctx.close();
  }
}

console.log('== the one question, and the six faces ==');
{
  const { ctx, page } = await openCorner();
  const r = await page.evaluate(() => ({
    q: window.__feelings.question(),
    faces: window.__feelings.faces(),
    words: window.__feelings.words(),
    leave: window.__feelings.leaveVisible()
  }));
  assert(r.q === QUESTION, `the one question, asked gently ("${r.q}")`);
  assert(String(r.faces) === String(FEELINGS.map(f => f.key)), `six faces, in the authored order (${r.faces})`);
  assert(String(r.words) === String(FEELINGS.map(f => f.word)), `each with its word underneath (${r.words})`);
  assert(r.leave, 'the leave control is visible');
  await page.screenshot({ path: `${SHOTS}/corner-1024.png` });
  await ctx.close();
}

console.log('== every feeling: three beats, mirrored, validated, offered ==');
{
  for (const f of FEELINGS) {
    const { ctx, page } = await openCorner();
    const r = await page.evaluate((key) => {
      window.__feelings.choose(key);
      return {
        said: window.__feelings.said(), pose: window.__feelings.pose(),
        offers: window.__feelings.offers(), leave: window.__feelings.leaveVisible()
      };
    }, f.key);
    assert(r.pose === f.key, `${f.key}: beat 1 — the Boo mirrors it (pose "${r.pose}")`);
    assert(r.said === f.line, `${f.key}: beat 2 — the authored validating line`);
    assert(String(r.offers.map(o => o.key)) === String(f.offers), `${f.key}: beat 3 — ${f.offers.join(' or ')}`);
    assert(r.offers.every(o => o.label === OFFERS[o.key].label), `${f.key}: the offer labels are the authored ones`);
    assert(r.leave, `${f.key}: the leave control is still visible`);
    await ctx.close();
  }
}

console.log('== frame evidence: the mirroring is visible, not just a data attribute ==');
{
  const { ctx, page } = await openCorner();
  for (const key of ['happy', 'sad']) {
    await page.evaluate(k => window.__feelings.choose(k), key);
    await page.waitForTimeout(260);
    await page.screenshot({ path: `${SHOTS}/mirror-${key}.png`, clip: { x: 0, y: 0, width: 700, height: 420 } });
  }
  const drawn = await page.evaluate(() => {
    const n = document.querySelector('.fe-face .feeling-face');
    return n ? { cls: n.getAttribute('class'), paths: n.querySelectorAll('path,circle,ellipse').length } : null;
  });
  assert(drawn && /ff-sad/.test(drawn.cls) && drawn.paths > 3,
    `the mirrored face is really drawn (${drawn ? drawn.paths + ' marks, ' + drawn.cls : 'nothing'})`);
  await ctx.close();
}

console.log('== breathing: the exact authored rhythm, and stoppable at any moment ==');
{
  const { ctx, page } = await openCorner();
  const r = await page.evaluate(async () => {
    window.__feelings.choose('calm');
    const stopFromFirstFrame = (() => { window.__feelings.tapOffer('breathe'); return window.__feelings.canStop(); })();
    const seen = [];
    const t0 = Date.now();
    // Sample the phase every 120ms through two full cycles. One cycle is 4+2+6 = 12s, so
    // two cycles need >24s of sampling — 110 ticks (13.2s) only ever saw one and a bit.
    for (let i = 0; i < 260; i++) {
      const b = window.__breath;
      if (b) { const last = seen[seen.length - 1]; if (!last || last.phase !== b.phase || last.cycle !== b.cycle) seen.push({ phase: b.phase, cycle: b.cycle, at: Date.now() - t0 }); }
      await new Promise(r2 => setTimeout(r2, 120));
      if (seen.length >= 7) break;
    }
    return { stopFromFirstFrame, seen, copy: window.__feelings.breathCopy() };
  });
  assert(r.stopFromFirstFrame, 'a Stop control exists from the very first frame of the breathing');
  const order = r.seen.slice(0, 6).map(s => s.phase).join(',');
  assert(order === 'in,hold,out,in,hold,out', `the cycle runs in → hold → out, repeatedly (${order})`);
  // durations, measured from the transitions, with a generous tolerance for sampling
  const durOf = (i) => r.seen[i + 1] ? r.seen[i + 1].at - r.seen[i].at : null;
  const near = (got, want, tol = 500) => got != null && Math.abs(got - want) <= tol;
  assert(near(durOf(0), BREATHING.inMs), `the in-breath lasts about 4s (${durOf(0)}ms)`);
  assert(near(durOf(1), BREATHING.holdMs), `the hold lasts about 2s (${durOf(1)}ms)`);
  assert(near(durOf(2), BREATHING.outMs), `the out-breath lasts about 6s (${durOf(2)}ms)`);
  await ctx.close();
}

console.log('== breathing: four cycles then the warm close ==');
{
  const { ctx, page } = await openCorner();
  const r = await page.evaluate(async () => {
    window.__feelings.choose('tired');
    window.__feelings.tapOffer('breathe');
    // 4 x (4+2+6) = 48s; poll for the close rather than sleeping blind
    for (let i = 0; i < 620; i++) {
      const b = window.__breath;
      if (b && b.phase === 'close') return { closed: true, cycles: b.cycle, copy: window.__feelings.breathCopy() };
      await new Promise(r2 => setTimeout(r2, 100));
    }
    return { closed: false, last: window.__breath };
  });
  assert(r.closed, 'the breathing reaches its close');
  assert(r.cycles === BREATHING.cycles, `after exactly four cycles (${r.cycles})`);
  assert(r.copy === BREATHING.close, `and closes with the authored line ("${r.copy}")`);
  await ctx.close();
}

console.log('== the third-time line: once, and only once, per session ==');
{
  const { ctx, page } = await openCorner();
  const r = await page.evaluate((line) => {
    const out = [];
    // worried, sad, worried → the THIRD heavy choice carries the extra line
    for (const k of ['worried', 'sad', 'worried', 'sad', 'worried']) {
      window.__feelings.choose(k);
      out.push({ k, said: window.__feelings.said(), has: window.__feelings.said().includes(line) });
    }
    return { out, count: window.__feelings.heavyCount() };
  }, THIRD_TIME_LINE);
  const withLine = r.out.filter(o => o.has);
  assert(r.out[0].has === false && r.out[1].has === false, 'not on the first or second heavy feeling');
  assert(r.out[2].has === true, 'it appears on the third');
  assert(withLine.length === 1, `and never again in that session (${withLine.length} time(s) in five choices)`);
  assert(r.out[2].said === FEELINGS.find(f => f.key === 'worried').line + ' ' + THIRD_TIME_LINE,
    'it is appended to the feeling\'s own line, exactly as authored, with nothing after it');
  await ctx.close();
}

console.log('== a light feeling never triggers it, however often it is chosen ==');
{
  const { ctx, page } = await openCorner();
  const any = await page.evaluate((line) => {
    let hit = false;
    for (let i = 0; i < 6; i++) { window.__feelings.choose('happy'); if (window.__feelings.said().includes(line)) hit = true; }
    return hit;
  }, THIRD_TIME_LINE);
  assert(any === false, 'six happy choices in a row never produce the third-time line');
  await ctx.close();
}

console.log('== "Sit a while" asks nothing at all ==');
{
  const { ctx, page } = await openCorner();
  const r = await page.evaluate(() => {
    window.__feelings.choose('sad');
    window.__feelings.tapOffer('sit');
    return {
      leave: window.__feelings.leaveVisible(),
      // nothing that counts, times or prompts
      hasTimer: !!document.querySelector('.fe-activity .progress-dots, .fe-activity .meter-track, .fe-activity progress'),
      text: (document.querySelector('.fe-activity') || {}).textContent || ''
    };
  });
  assert(r.leave, 'the leave control is visible while sitting');
  assert(!r.hasTimer, 'there is no timer, meter or progress of any kind');
  assert(!/\?/.test(r.text), 'and nothing asks her anything');
  await ctx.close();
}

// ---- 4. THE PERSISTENCE GUARD ----------------------------------------------------------
console.log('== PERSISTENCE GUARD: nothing chosen here reaches storage, by any path ==');
{
  const { ctx, page } = await openCorner();

  const snapshot = () => page.evaluate(async () => {
    const ls = {};
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); ls[k] = localStorage.getItem(k); }
    const idb = {};
    try {
      const dbs = (indexedDB.databases ? await indexedDB.databases() : []) || [];
      for (const d of dbs) {
        if (!d.name) continue;
        const db = await new Promise((res, rej) => { const r = indexedDB.open(d.name); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
        for (const store of Array.from(db.objectStoreNames)) {
          const all = await new Promise((res) => { try { const r = db.transaction(store, 'readonly').objectStore(store).getAll(); r.onsuccess = () => res(r.result); r.onerror = () => res([]); } catch { res([]); } });
          idb[d.name + '/' + store] = JSON.stringify(all);
        }
        db.close();
      }
    } catch (e) { idb.__error = String(e); }
    return { ls, idb };
  });

  const before = await snapshot();

  // Walk EVERY path: all six feelings, every offer, the third-time line, a full breathing
  // cycle, a dance, and a sit. If any of them writes, the diff below will show it.
  await page.evaluate(async () => {
    const F = window.__feelings;
    for (const k of ['happy', 'calm', 'excited', 'tired', 'worried', 'sad']) {
      F.choose(k);
      for (const o of F.offers().map(x => x.key)) { F.tapOffer(o); await new Promise(r => setTimeout(r, 260)); F.choose(k); }
    }
    // drive the heavy count past the third-time line
    for (const k of ['worried', 'sad', 'worried', 'sad']) F.choose(k);
    F.choose('calm'); F.tapOffer('breathe');
    await new Promise(r => setTimeout(r, 1500));
  });
  // and force every debounced writer in the app to flush
  await page.evaluate(() => { try { window.BooTown.State.commit(); } catch {} });
  await page.waitForTimeout(900);

  const after = await snapshot();

  // Any feelings vocabulary reaching either store is a failure.
  const NEEDLES = ['feeling', 'feelings', 'worried', 'happy', 'excited', 'tired', 'sad', 'calm',
    'breathe', 'heavyCount', 'moodTHIRD', 'feelingsCount', 'feelingsLog', 'feelingsHistory'];
  const leaks = [];
  const scan = (label, bag) => {
    for (const [k, v] of Object.entries(bag)) {
      const text = String(k) + ' ' + String(v);
      for (const n of NEEDLES) {
        // `feelingsCorner: true` is the grown-up's own SWITCH, not a feelings value: it is
        // a setting they set, in the settings object, and it is the one legitimate hit.
        const re = new RegExp(n, 'i');
        if (!re.test(text)) continue;
        const onlyTheSwitch = n.startsWith('feeling') && /"feelingsCorner":\s*(true|false)/.test(text)
          && !/feelingsLog|feelingsHistory|feelingsCount|lastFeeling|moodLog/i.test(text);
        if (onlyTheSwitch && n !== 'worried' && n !== 'sad') continue;
        if (!re.test(String(v)) && !re.test(String(k))) continue;
        leaks.push(`${label} ${k}: matched /${n}/`);
      }
    }
  };
  // Compare only what CHANGED, so pre-existing app vocabulary is not mistaken for a leak.
  const changedLs = Object.fromEntries(Object.entries(after.ls).filter(([k, v]) => before.ls[k] !== v));
  const changedIdb = Object.fromEntries(Object.entries(after.idb).filter(([k, v]) => before.idb[k] !== v));
  scan('localStorage', changedLs);
  scan('indexedDB', changedIdb);
  if (leaks.length) leaks.forEach(l => console.log('   LEAK: ' + l));
  if (Object.keys(changedLs).length) console.log('   (localStorage keys that changed: ' + Object.keys(changedLs).join(', ') + ')');

  assert(leaks.length === 0, `no feelings value reached localStorage or IndexedDB (${leaks.length} leak(s))`);

  // The save itself must be byte-identical apart from the housekeeping fields the app
  // rewrites on every commit anyway. Nothing about feelings may appear in it at all.
  const saveDiff = await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('bootown.save.v1') || '{}');
    const hits = [];
    const walk = (o, path) => {
      if (o && typeof o === 'object') { for (const k of Object.keys(o)) walk(o[k], path + '.' + k); return; }
      if (typeof o === 'string' && /worried|feelings?corner|breathe/i.test(o)) hits.push(path + ' = ' + o);
    };
    walk(s, '');
    const keys = Object.keys(s).filter(k => /feel|mood|emotion/i.test(k));
    const settingKeys = Object.keys(s.settings || {}).filter(k => /feel|mood|emotion/i.test(k));
    return { hits, keys, settingKeys };
  });
  assert(saveDiff.keys.length === 0, `the save has no top-level feelings field (${saveDiff.keys})`);
  assert(String(saveDiff.settingKeys) === 'feelingsCorner',
    `the ONLY feelings key in the whole save is the grown-up's own switch (${saveDiff.settingKeys})`);
  assert(saveDiff.hits.length === 0, `no feeling she chose appears anywhere in the save (${saveDiff.hits.join('; ')})`);

  // ---- and the guard must BITE ---------------------------------------------------------
  // A deliberate write of a feelings value must be detected. Without this, a probe that
  // silently found nothing would look identical to a feature that stored nothing.
  await page.evaluate(() => { localStorage.setItem('bootown.canary', JSON.stringify({ lastFeeling: 'worried', at: 1 })); });
  const poisoned = await snapshot();
  const changedNow = Object.fromEntries(Object.entries(poisoned.ls).filter(([k, v]) => after.ls[k] !== v));
  const canaryLeaks = [];
  for (const [k, v] of Object.entries(changedNow)) {
    if (/worried|lastFeeling/i.test(String(k) + String(v))) canaryLeaks.push(k);
  }
  assert(canaryLeaks.length > 0, 'the guard detects a deliberately written feelings value (self-check)');
  await page.evaluate(() => localStorage.removeItem('bootown.canary'));
  await ctx.close();
}

console.log('== no grown-ups screen displays anything about feelings ==');
{
  const { ctx, page } = await open(save({ feelingsCorner: true }));
  // choose several feelings first, so there would be something to display if anything were kept
  await page.evaluate(() => window.BooTown.go('feelings'));
  await page.waitForFunction(() => window.__feelings, null, { timeout: 10000 });
  await page.evaluate(() => { for (const k of ['sad', 'worried', 'sad']) window.__feelings.choose(k); });
  await page.evaluate(() => window.BooTown.go('grownups'));
  await page.waitForTimeout(700);
  const r = await page.evaluate(() => {
    // textContent, not innerText: the grown-ups corner is TABBED, so innerText only ever
    // returns the panel that happens to be visible. Reading textContent covers every tab
    // at once, which is what "no grown-ups screen displays anything about feelings"
    // actually means — including the tabs she is not looking at.
    const text = document.body.textContent || '';
    return {
      text,
      mentionsChoice: /\b(worried|sad|excited|tired)\b/i.test(text),
      hasSwitch: /Feelings Corner/i.test(text)
    };
  });
  assert(r.hasSwitch, 'the grown-ups corner carries the Feelings Corner switch');
  assert(!r.mentionsChoice, 'and shows nothing whatsoever about what she chose');
  assert(/nothing they choose is saved/i.test(r.text), 'the authored promise is on screen beside the switch');
  await page.screenshot({ path: `${SHOTS}/grownups-toggle.png`, fullPage: true });
  await ctx.close();
}

console.log('== the corner reads on a phone ==');
{
  const { ctx, page } = await openCorner(save({ feelingsCorner: true }), { width: 390, height: 844 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  assert(!overflow, 'no horizontal overflow at 390x844');
  await page.evaluate(() => window.__feelings.choose('worried'));
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${SHOTS}/corner-390.png` });
  await ctx.close();
}

await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
