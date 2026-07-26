// tests/r12s13-a11y.mjs — RUN12 S13: a five-year-old, a child using a keyboard and a child
// using a screen reader all get in. Five items, deliberately scoped.
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'fs';

const RAW = process.env.BASE || 'http://127.0.0.1:8000';
const BASE = RAW.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
const RESOLVE = ['--host-resolver-rules=MAP app.localhost 127.0.0.1'];
const SHOTS = 'screenshots/run12/s13';
mkdirSync(SHOTS, { recursive: true });
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };

const AK = ['meadow','riverside','hilltop','beach','funfair','playground','boohouse','gallery'];
const save = (over = {}, settings = {}) => JSON.stringify(Object.assign({
  version: 14, name: 'Ada', ageAsked: true,
  guide: { species:'giraffe', body:'sunshine', pattern:'spots', patternColour:'cocoa', eyes:'round', acc:'none', name:'T' },
  inventory: { boo_inky: 1, boo_plum: 1, deco_wishwell: 1 }, stars: { total: 400, byGame: {} }, trophies: {}, boxes: 0,
  town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 3 }, expedition: { party: [], tiers: {}, progress: {} },
  seen: { trophyRetro: true, lastStarsShown: 400, introSeen: { bubblepop: true, dash: true, beat: true, detective: true, spellboo: true, feedboos: true } },
  settings: Object.assign({ sound: false, music: false, voice: true, content: 'full' }, settings)
}, over));

const browser = await chromium.launch({ args: RESOLVE });
async function open(route, params, opts = {}) {
  const ctx = await browser.newContext({ viewport: opts.viewport || { width: 1024, height: 768 } });
  const page = await ctx.newPage();
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), save({}, opts.settings || {}));
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => window.BooTown, null, { timeout: 20000 });
  await page.evaluate(([r, p]) => window.BooTown.go(r, p || {}), [route, params]);
  await page.waitForTimeout(1300);
  await page.evaluate(() => { if (window.__intro) window.__intro.close(); });
  await page.waitForTimeout(500);
  return { ctx, page };
}

// ---- 1. the A-Z keyboard --------------------------------------------------------------
console.log('== 1. an A-Z letter layout, defaulted ON below age 8 ==');
{
  const { ctx, page } = await open('hub', {});
  const r = await page.evaluate(async () => {
    const { ALPHA_ROWS, QWERTY_ROWS, alphaKeysDefault, alphaKeysOn, setAlphaKeys } = await import('./js/a11y.js');
    const { setContentTier } = await import('./js/content.js');
    const out = {};
    for (const tier of ['toddler', 'light', 'medium', 'full']) {
      setContentTier(tier);
      out[tier] = { def: alphaKeysDefault(), on: alphaKeysOn() };
    }
    setContentTier('full');
    setAlphaKeys(true);  out.forcedOn = alphaKeysOn();
    setAlphaKeys(false); out.forcedOff = alphaKeysOn();
    return Object.assign(out, { alpha: ALPHA_ROWS, qwerty: QWERTY_ROWS });
  });
  assert(r.toddler.def === true && r.light.def === true, 'defaults ON for Toddler and Light (under 8)');
  assert(r.medium.def === false && r.full.def === false, 'and OFF for Medium and Full');
  assert(r.toddler.on === true && r.full.on === false, 'with no saved setting, the default is what applies');
  assert(r.forcedOn === true && r.forcedOff === false, 'and the grown-ups setting overrides the default in both directions');
  assert(r.alpha.join('') === 'abcdefghijklmnopqrstuvwxyz', 'the A-Z rows really are the alphabet in order');
  assert(r.qwerty.join('') === 'qwertyuiopasdfghjklzxcvbnm', 'and QWERTY is still there for older players');
  await ctx.close();
}

console.log('== the A-Z layout renders and types correctly ==');
for (const [route, params] of [['detective', {}], ['town', { area: 'meadow', openWishWell: true }]]) {
  const { ctx, page } = await open(route, params, { settings: { content: 'light' } });
  // Word Detective opens on a word-length picker; the keyboard is inside the round
  if (route === 'detective') {
    await page.evaluate(() => (document.querySelector('.btn.big') || document.querySelector('.level-btn'))?.click());
    await page.waitForTimeout(900);
    await page.evaluate(() => { if (window.__intro) window.__intro.close(); });
  }
  await page.waitForTimeout(900);
  const r = await page.evaluate(() => {
    const rows = [...document.querySelectorAll('.det-kb-row')];
    const letters = rows.map(row => [...row.querySelectorAll('.det-key')].map(k => k.dataset.key).filter(Boolean).join(''));
    return { rows: rows.length, letters, all: letters.join('') };
  });
  assert(r.rows >= 3, `${route}: the keyboard rendered (${r.rows} rows)`);
  assert(r.all === 'abcdefghijklmnopqrstuvwxyz', `${route}: in A-Z order (${r.letters.join(' / ')})`);
  // and it actually types
  const typed = await page.evaluate(() => {
    const k = [...document.querySelectorAll('.det-key')].find(x => x.dataset.key === 'c');
    k && k.click();
    const k2 = [...document.querySelectorAll('.det-key')].find(x => x.dataset.key === 'a');
    k2 && k2.click();
    return ([...document.querySelectorAll('.det-row, .wish-slots')].map(n => n.textContent).join('') || '').toLowerCase();
  });
  assert(/c/.test(typed) && /a/.test(typed), `${route}: pressing A-Z keys types those letters ("${typed.trim().slice(0, 12)}")`);
  await page.screenshot({ path: `${SHOTS}/az-${route}.png` });
  await ctx.close();
}

console.log('== an older player still gets QWERTY ==');
{
  const { ctx, page } = await open('detective', {}, { settings: { content: 'full' } });
  await page.evaluate(() => (document.querySelector('.btn.big') || document.querySelector('.level-btn'))?.click());
  await page.waitForTimeout(900);
  await page.evaluate(() => { if (window.__intro) window.__intro.close(); });
  await page.waitForTimeout(500);
  const all = await page.evaluate(() =>
    [...document.querySelectorAll('.det-kb-row')].map(r => [...r.querySelectorAll('.det-key')].map(k => k.dataset.key).filter(Boolean).join('')).join(''));
  assert(all === 'qwertyuiopasdfghjklzxcvbnm', `Full tier keeps QWERTY (${all.slice(0, 10)}…)`);
  await ctx.close();
}

// ---- 2. read-aloud ---------------------------------------------------------------------
console.log('== 2. read-aloud is a control, not autoplay, and it is remembered ==');
{
  const { ctx, page } = await open('bubblepop', { resume: { mix: true } }, { settings: { readAloud: true } });
  const r = await page.evaluate(async () => {
    const tts = await import('./js/tts.js');
    window.__spoke = [];
    const real = tts.speak;
    // count what the guide path actually says
    const guide = await import('./js/guide.js');
    const realSpeak = guide.speakMaybe;
    return { control: !!document.querySelector('.target-card .read-aloud-btn'),
      label: document.querySelector('.read-aloud-btn')?.getAttribute('aria-label') || null };
  });
  assert(r.control, 'the speaker control sits beside the question');
  assert(/read the question aloud/i.test(r.label || ''), `named for a screen reader ("${r.label}")`);
  const spoke = await page.evaluate(async () => {
    const g = await import('./js/guide.js');
    let count = 0;
    const orig = window.speechSynthesis && window.speechSynthesis.speak;
    window.__utterances = [];
    if (window.speechSynthesis) window.speechSynthesis.speak = (u) => { window.__utterances.push(u.text); };
    // nothing should be spoken until she presses it
    await new Promise(r => setTimeout(r, 1500));
    const before = window.__utterances.length;
    document.querySelector('.read-aloud-btn').click();
    await new Promise(r => setTimeout(r, 400));
    return { before, after: window.__utterances.length, said: window.__utterances.slice(-1)[0] || null };
  });
  assert(spoke.before === 0, 'it says nothing on its own — never autoplay');
  assert(spoke.after > spoke.before, 'and speaks when pressed');
  await page.screenshot({ path: `${SHOTS}/read-aloud.png` });
  await ctx.close();
}

console.log('== read-aloud obeys the mutes, and is remembered per device ==');
{
  const { ctx, page } = await open('bubblepop', { resume: { mix: true } }, { settings: { readAloud: true, voice: false } });
  const r = await page.evaluate(async () => {
    window.__utterances = [];
    if (window.speechSynthesis) window.speechSynthesis.speak = (u) => { window.__utterances.push(u.text); };
    document.querySelector('.read-aloud-btn')?.click();
    await new Promise(r => setTimeout(r, 400));
    return { spoke: window.__utterances.length, saved: window.BooTown.State.getState().settings.readAloud };
  });
  assert(r.spoke === 0, 'with the voice muted it stays silent, like every other spoken line');
  assert(r.saved === true, 'and the setting itself persists in the save');
  await ctx.close();
}

console.log('== read-aloud is off unless asked for ==');
{
  const { ctx, page } = await open('bubblepop', { resume: { mix: true } });
  const present = await page.evaluate(() => !!document.querySelector('.read-aloud-btn'));
  assert(!present, 'no speaker control appears for a player who has not turned it on');
  await ctx.close();
}

// ---- 3. the grown-ups keyboard route ----------------------------------------------------
console.log('== 3. the grown-ups corner has a keyboard and screen-reader route ==');
{
  const { ctx, page } = await open('hub', {});
  const r = await page.evaluate(() => {
    const cog = document.querySelector('.cog-btn');
    return { present: !!cog, label: cog?.getAttribute('aria-label') || null, tag: cog?.tagName,
      focusable: cog ? cog.tabIndex >= 0 || cog.tagName === 'BUTTON' : false };
  });
  assert(r.present && r.tag === 'BUTTON', 'the cog is a real focusable control');
  assert(/enter/i.test(r.label || ''), `whose name tells you the keyboard way in ("${r.label}")`);
  // focus it and press Enter
  await page.evaluate(() => document.querySelector('.cog-btn').focus());
  const focused = await page.evaluate(() => document.activeElement?.className || '');
  assert(/cog-btn/.test(focused), 'it takes focus');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(600);
  const dlg = await page.evaluate(() => {
    const d = [...document.querySelectorAll('.dialog')].pop();
    return { up: !!d, text: (d?.textContent || '').slice(0, 80) };
  });
  assert(dlg.up, 'Enter opens the confirmation the long-press protects it with');
  assert(/grown-up/i.test(dlg.text), `holding the same deliberate second step ("${dlg.text.trim()}")`);
  await page.screenshot({ path: `${SHOTS}/grownups-keyboard.png` });
  await page.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'Open')?.click());
  await page.waitForTimeout(900);
  const arrived = await page.evaluate(() => document.querySelector('#screen')?.firstElementChild?.className || '');
  assert(/grownups/.test(arrived), `and confirming actually opens the corner (${arrived})`);
  // long-press must still work for touch
  const src = readFileSync('js/hub.js', 'utf8');
  assert(/btn\.addEventListener\('pointerdown', begin\)/.test(src), 'and the long-press is untouched for touch');
  await ctx.close();
}

// ---- 4. accessible names carry values ---------------------------------------------------
console.log('== 4. interactive things say WHAT they are, not just that they exist ==');
{
  const { ctx, page } = await open('bubblepop', { resume: { mix: true } });
  await page.waitForTimeout(800);
  const r = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.bubble')];
    return b.map(x => ({ label: x.getAttribute('aria-label'), text: x.textContent.trim() }));
  });
  assert(r.length > 0, `${r.length} bubbles on screen`);
  assert(r.every(x => /,/.test(x.label || '')), "every bubble's name carries its value");
  assert(r.every(x => (x.label || '').endsWith(x.text)), `and the value MATCHES what is drawn on it (${r[0].label})`);
  assert(!r.some(x => x.label === 'bubble'), 'none is still the bare "bubble" the reviewer met');
  await ctx.close();
}
{
  const { ctx, page } = await open('dash', { resume: { cat: 'add', level: 1, mix: false } });
  await page.waitForTimeout(900);
  const gates = await page.evaluate(() => [...document.querySelectorAll('.d2-gate')].map(g => ({
    label: g.getAttribute('aria-label'), text: g.querySelector('.g-label')?.textContent.trim() })));
  assert(gates.length > 0 && gates.every(g => /,/.test(g.label || '')), `every gate names its answer (${gates[0]?.label})`);
  await ctx.close();
}
{
  const { ctx, page } = await open('beat', { resume: { mix: true } });
  // wait for the question trio itself rather than a fixed sleep: RUN14 U2 puts it on the
  // musical phrase, so when it appears depends on the tempo
  await page.waitForSelector('.beat-note:not(.tapalong)', { timeout: 8000 });
  // RUN14 U2 added TAP-ALONG notes: pure groove, carrying no answer. They are deliberately
  // aria-hidden — announcing dozens of rhythm dots would bury the thing that matters — so
  // the "names its answer" rule applies to the QUESTION trio, and the groove is asserted
  // silent rather than labelled.
  const notes = await page.evaluate(() => [...document.querySelectorAll('.beat-note:not(.tapalong)')].map(n => ({
    label: n.getAttribute('aria-label'), text: n.textContent.trim() })));
  assert(notes.length > 0, `${notes.length} answer notes on screen`);
  assert(notes.every(n => /,/.test(n.label || '')), `every answer note names its answer (${notes[0]?.label})`);
  const groove = await page.evaluate(() => [...document.querySelectorAll('.beat-note.tapalong')].map(n => n.getAttribute('aria-hidden')));
  assert(groove.every(a => a === 'true'), `and the ${groove.length} groove notes stay out of the screen reader's way`);
  await ctx.close();
}

console.log('== the whole app: no unlabelled interactive control on any route ==');
{
  const mainSrc = readFileSync('js/main.js', 'utf8');
  const rb = mainSrc.slice(mainSrc.indexOf('const registry = {'), mainSrc.indexOf('};', mainSrc.indexOf('const registry = {')));
  const ROUTES = [...rb.matchAll(/^\s*'?([a-zA-Z][\w-]*)'?\s*:\s*\(\)\s*=>/gm)].map(m => m[1]).filter(r => r !== 'onboarding');
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await ctx.newPage();
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), save());
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => window.BooTown, null, { timeout: 20000 });
  const nameless = [];
  for (const route of ROUTES) {
    await page.evaluate(async (r) => { try { await window.BooTown.go(r, {}); } catch {} }, route);
    await page.waitForTimeout(700);
    await page.evaluate(() => { if (window.__intro) window.__intro.close(); });
    await page.waitForTimeout(300);
    const bad = await page.evaluate(() => {
      const out = [];
      for (const b of document.querySelectorAll('button, [role=button], [role=switch]')) {
        const r = b.getBoundingClientRect();
        const st = getComputedStyle(b);
        if (st.visibility === 'hidden' || st.display === 'none' || r.width === 0 || r.height === 0) continue;
        const name = (b.getAttribute('aria-label') || '').trim() || b.textContent.trim() || (b.getAttribute('title') || '').trim();
        if (!name) out.push(b.className || b.tagName);
      }
      return out;
    });
    for (const b of bad) nameless.push(`${route}: ${b}`);
  }
  assert(nameless.length === 0, `every interactive control on all ${ROUTES.length} routes has an accessible name${nameless.length ? ' → ' + nameless.slice(0, 4).join(', ') : ''}`);
  await ctx.close();
}

// ---- 5. free repeats ---------------------------------------------------------------------
console.log('== 5. hearing something again is free; revealing an answer still costs ==');
{
  const src = readFileSync('js/games/spellboo.js', 'utf8');
  assert(/function sayWordAgain\(\)/.test(src), 'Spell Boo separates hearing the word from seeing it');
  assert(!/sayWordAgain[\s\S]{0,120}spendHint\(\)/.test(src), 'and the free repeat never spends a hint');
  assert(/function peekHint\(\)[\s\S]{0,60}spendHint\(\)/.test(src), 'while the peek that REVEALS the spelling still does');
  const echo = readFileSync('js/games/echoboos.js', 'utf8');
  assert(!/spendHint|hintsUsed/.test(echo), 'Echo Boos never charged for a replay and still does not');
}
{
  const { ctx, page } = await open('spellboo', { resume: { cat: null, level: 1, mix: true } });
  await page.waitForTimeout(1200);
  const r = await page.evaluate(async () => {
    const hear = document.querySelector('.hear-btn');
    if (!hear) return { present: false };
    const before = window.__spellboo ? window.__spellboo.stats?.() : null;
    const starsBefore = window.BooTown.State.getState().stars.total;
    for (let i = 0; i < 5; i++) { hear.click(); await new Promise(r => setTimeout(r, 150)); }
    return { present: true, disabled: hear.disabled, label: hear.getAttribute('aria-label'),
      starsAfter: window.BooTown.State.getState().stars.total, starsBefore };
  });
  assert(r.present, 'the free "hear it again" control is on the spelling screen');
  if (r.present) {
    assert(r.disabled === false, 'it is never disabled — repeats are unlimited');
    assert(/free/i.test(r.label || ''), `and says so ("${r.label}")`);
    assert(r.starsAfter === r.starsBefore, 'five presses cost nothing');
  }
  await page.screenshot({ path: `${SHOTS}/free-repeat.png` });
  await ctx.close();
}

console.log('== the new module joined the precache in the same commit (OFFLINE LAW) ==');
{
  const sw = readFileSync('sw.js', 'utf8');
  assert(/'js\/a11y\.js'/.test(sw), 'js/a11y.js is in sw.js ASSETS[]');
}

await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
