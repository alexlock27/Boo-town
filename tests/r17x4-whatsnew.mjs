// tests/r17x4-whatsnew.mjs — RUN17 X4: "Something new arrived!"
//
// The assertions X4 names: the card appears once per new version and never mid-round;
// every entry's route resolves; dismissal persists; CLAUDE.md carries the new standing
// requirement.
//
// The route check is the one that matters most in the long run. This file is appended to
// by EVERY future run as part of its deploy gate, and a "Show me!" that goes nowhere is
// worse than no list at all — so every route is resolved against js/main.js's real
// registry, not against a copy of it kept in step by hand.
import { chromium } from 'playwright';
import { readFileSync, mkdirSync } from 'fs';
import { WHATSNEW, LATEST_VERSION, entriesSince } from '../data/whatsnew.js';

const RAW = process.env.BASE || 'http://127.0.0.1:8000';
const BASE = RAW.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
const RESOLVE = ['--host-resolver-rules=MAP app.localhost 127.0.0.1'];
const SHOTS = 'screenshots/run17/x4';
mkdirSync(SHOTS, { recursive: true });

let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };

// ---- 1. the data ----------------------------------------------------------------------
console.log('== the What\'s New list is well formed ==');
const allEntries = WHATSNEW.flatMap(b => b.entries);
assert(WHATSNEW.length > 0, `${WHATSNEW.length} version blocks`);
assert(allEntries.length >= 14, `${allEntries.length} entries authored (X4 asks for everything shipped since they last looked)`);
assert(new Set(WHATSNEW.map(b => b.version)).size === WHATSNEW.length, 'every version block has a distinct version');
assert(WHATSNEW[0].version === LATEST_VERSION, `LATEST_VERSION is the newest block (${LATEST_VERSION})`);
assert(allEntries.every(e => e.title && e.blurb), 'every entry has a title and a blurb');
assert(allEntries.every(e => e.blurb.length <= 170), 'every blurb stays short enough for a child to read');
assert(new Set(allEntries.map(e => e.title)).size === allEntries.length, 'no entry is listed twice');

// X4 names the features that must be covered. Check them by name, so a future edit that
// quietly drops one is caught.
console.log('== every feature X4 names is present ==');
{
  const blob = allEntries.map(e => e.title + ' ' + e.blurb).join(' | ').toLowerCase();
  const MUST = ['world map', 'boo house', 'gallery', 'boo care', 'funfair', 'band', 'disco',
    'expedition', 'snaffle', 'wish well', 'odd boo out', 'flash boos', 'brain bloom', 'safety copies', 'joke boo'];
  const missing = MUST.filter(m => !blob.includes(m));
  missing.forEach(m => console.log('   missing:', m));
  assert(missing.length === 0, `all ${MUST.length} named features have an entry (${missing.length} missing)`);
}

// The Feelings Corner must NOT be advertised: it is grown-up-gated (G17), and a child
// tapping "Show me!" on a corner that is switched off would simply bounce to the hub.
console.log('== nothing grown-up-gated is advertised to a child ==');
{
  const blob = allEntries.map(e => e.title + ' ' + e.blurb + ' ' + (e.route || '')).join(' ').toLowerCase();
  assert(!blob.includes('feelings'), 'the Feelings Corner is deliberately absent from What\'s New');
  assert(!allEntries.some(e => e.route === 'feelings'), 'and nothing routes to it');
}

// ---- 2. every route resolves against the REAL registry ---------------------------------
console.log('== every "Show me!" goes somewhere real ==');
{
  const main = readFileSync('js/main.js', 'utf8');
  const body = main.slice(main.indexOf('const registry'), main.indexOf('};', main.indexOf('const registry')));
  const routes = new Set([...body.matchAll(/^\s*'?([\w-]+)'?\s*:\s*\(\)\s*=>/gm)].map(m => m[1]));
  assert(routes.size > 20, `read ${routes.size} routes out of js/main.js's registry`);
  const bad = allEntries.filter(e => e.route && !routes.has(e.route));
  bad.forEach(e => console.log(`   "${e.title}" routes to "${e.route}", which is not in the registry`));
  assert(bad.length === 0, `every entry's route exists (${bad.length} broken)`);
  assert(allEntries.every(e => e.route), 'every entry has somewhere to send her');
}

// ---- 3. entriesSince ------------------------------------------------------------------
console.log('== entriesSince returns exactly what she has not seen ==');
{
  assert(entriesSince('').length === allEntries.length, 'a save that has never seen it gets the whole catch-up');
  assert(entriesSince(LATEST_VERSION).length === 0, 'a save on the latest version gets nothing');
  if (WHATSNEW.length > 1) {
    const second = WHATSNEW[1].version;
    assert(entriesSince(second).length === WHATSNEW[0].entries.length,
      `a save one version behind gets only the newest block (${entriesSince(second).length})`);
  }
}

// ---- 4. CLAUDE.md carries the standing requirement --------------------------------------
console.log('== CLAUDE.md carries the new standing requirement ==');
{
  const law = readFileSync('CLAUDE.md', 'utf8');
  assert(/what'?s new/i.test(law), 'CLAUDE.md mentions What\'s New');
  assert(/data\/whatsnew\.js/.test(law), 'and names data/whatsnew.js');
  assert(/deploy gate/i.test(law) && /whatsnew/i.test(law.slice(law.search(/deploy gate/i) - 200, law.search(/deploy gate/i) + 900)),
    'and ties it to the deploy gate');
  assert(/BUILD_STAMP/.test(law.slice(law.search(/WHAT'?S NEW IS PART OF THE DEPLOY GATE/i))),
    'and says the version must equal the BUILD_STAMP it ships under');
}

// ---- 5. in the browser -------------------------------------------------------------------
const AK = ['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground', 'boohouse', 'gallery'];
const save = (seen = {}) => JSON.stringify({
  version: 17, name: 'Ada', ageAsked: true, age: 9,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'Twiggy' },
  inventory: { boo_inky: 1 }, stars: { total: 40, byGame: {} }, trophies: {}, boxes: 0, journal: {},
  town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 0 }, expedition: { party: [], tiers: {}, progress: {} },
  seen: { trophyRetro: true, lastStarsShown: 40, introSeen: {}, ...seen },
  settings: { sound: true, music: false, voice: false, content: 'medium' }
});

const browser = await chromium.launch({ args: RESOLVE });
async function openHub(saveJson = save(), viewport = { width: 1024, height: 768 }) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  // Seed ONLY if there is nothing there yet. addInitScript runs on EVERY navigation in this
  // context, including the reloads this suite uses to prove the dismissal persists — an
  // unconditional seed would re-write the original save over the app's own flag on reload,
  // and the persistence assertions would fail against a perfectly correct app.
  await page.addInitScript(s => { if (!localStorage.getItem('bootown.save.v1')) localStorage.setItem('bootown.save.v1', s); }, saveJson);
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => window.BooTown, null, { timeout: 20000 });
  await page.waitForSelector('.hub', { timeout: 10000 });
  await page.waitForTimeout(300);
  return { ctx, page };
}

console.log('== the card appears on the first open after a new version ==');
{
  const { ctx, page } = await openHub();
  const r = await page.evaluate(() => ({
    card: !!document.querySelector('.wn-card'),
    modal: window.__whatsnew ? window.__whatsnew.isModal() : null,
    count: window.__whatsnew ? window.__whatsnew.count : 0,
    // it must be page content in the hub's own flow, not a layer over it
    inHub: !!document.querySelector('.hub-specials .wn-card'),
    overlays: document.querySelectorAll('.overlay, .intro-overlay').length
  }));
  assert(r.card, 'the card is on the hub');
  assert(r.inHub, 'inside the hub\'s own specials flow');
  assert(r.modal === false, 'and it is NOT a modal');
  assert(r.overlays === 0, 'no overlay is blocking play');
  assert(r.count >= 14, `it offers everything she has not seen (${r.count})`);
  await page.screenshot({ path: `${SHOTS}/card-1024.png` });
  await ctx.close();
}

console.log('== a save already on this version never sees it ==');
{
  const { ctx, page } = await openHub(save({ whatsnewVersion: LATEST_VERSION }));
  const card = await page.evaluate(() => !!document.querySelector('.wn-card'));
  assert(!card, 'no card for a save that has already been told');
  await ctx.close();
}

console.log('== opening it shows the list, and it never returns for that version ==');
{
  const { ctx, page } = await openHub();
  const r = await page.evaluate(() => {
    const n = window.__whatsnew.expand();
    return { rows: n, goButtons: document.querySelectorAll('.wn-go').length, seen: window.__whatsnew.seen(), latest: window.__whatsnew.latest };
  });
  assert(r.rows >= 14, `the list shows every entry (${r.rows})`);
  assert(r.goButtons === r.rows, `each one has a "Show me!" (${r.goButtons})`);
  assert(r.seen === r.latest, 'opening it records the version as seen');
  await page.screenshot({ path: `${SHOTS}/list-1024.png` });
  // and it is gone on the next open — persisted, not just hidden
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.BooTown, null, { timeout: 20000 });
  await page.waitForSelector('.hub', { timeout: 10000 });
  await page.waitForTimeout(300);
  const again = await page.evaluate(() => !!document.querySelector('.wn-card'));
  assert(!again, 'and it does not come back after a reload');
  await ctx.close();
}

console.log('== dismissing it persists too ==');
{
  const { ctx, page } = await openHub();
  await page.evaluate(() => window.__whatsnew.dismiss());
  const gone = await page.evaluate(() => !!document.querySelector('.wn-card'));
  assert(!gone, 'the × removes it');
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.BooTown, null, { timeout: 20000 });
  await page.waitForSelector('.hub', { timeout: 10000 });
  await page.waitForTimeout(300);
  const back = await page.evaluate(() => ({ card: !!document.querySelector('.wn-card'), seen: JSON.parse(localStorage.getItem('bootown.save.v1')).seen.whatsnewVersion }));
  assert(!back.card, 'and it stays gone after a reload');
  assert(back.seen === LATEST_VERSION, `the dismissal is recorded in the save (${back.seen})`);
  await ctx.close();
}

console.log('== "Show me!" really goes there ==');
{
  // walk every entry's route for real, from a fresh hub each time
  for (let i = 0; i < allEntries.length; i++) {
    const e = allEntries[i];
    const { ctx, page } = await openHub();
    await page.evaluate(() => window.__whatsnew.expand());
    await page.evaluate((idx) => window.__whatsnew.go(idx), i);
    await page.waitForTimeout(700);
    const landed = await page.evaluate(() => document.getElementById('screen').dataset.screen);
    assert(landed === e.route, `"${e.title}" → ${e.route} (landed "${landed}")`);
    await ctx.close();
  }
}

console.log('== it never appears mid-round ==');
{
  const { ctx, page } = await openHub();
  // straight into a game, without visiting the hub first
  await page.evaluate(() => window.BooTown.go('bubblepop'));
  await page.waitForTimeout(1200);
  const inGame = await page.evaluate(() => !!document.querySelector('.wn-card'));
  assert(!inGame, 'no card inside a game');
  // and not on the results screen either
  await page.evaluate(() => window.BooTown.go('results', { game: 'bubblepop', gameName: 'Bubble Pop', stars: 2, cat: 'tables', level: 1 }));
  await page.waitForTimeout(900);
  const inResults = await page.evaluate(() => !!document.querySelector('.wn-card'));
  assert(!inResults, 'no card on the results screen');
  await ctx.close();
}

console.log('== it reads on a phone ==');
{
  const { ctx, page } = await openHub(save(), { width: 390, height: 844 });
  await page.evaluate(() => window.__whatsnew.expand());
  await page.waitForTimeout(250);
  const r = await page.evaluate(() => ({
    overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
    smallest: Math.min(...[...document.querySelectorAll('.wn-go, .wn-x')].map(b => b.getBoundingClientRect().height))
  }));
  assert(!r.overflow, 'no horizontal overflow at 390x844');
  assert(r.smallest >= 44, `every control is at least 44px tall (smallest ${Math.round(r.smallest)}px)`);
  await page.screenshot({ path: `${SHOTS}/list-390.png` });
  await ctx.close();
}

await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
