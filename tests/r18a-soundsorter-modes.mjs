// tests/r18a-soundsorter-modes.mjs — RUN18A H1: the level enumeration.
//
// `r16w1-soundsorter` was green while the game softlocked on question one, because it
// drove ONE mode. RECOVERY_PLAN records the lesson as a standing rule for pack authors:
// an acceptance suite for a level-structured game enumerates every selectable level/mode
// at least to first-question completion. This suite is that rule, made permanent for
// Sound Sorter: every group x every level it offers, PLUS Smart Mix, each played to the
// end, each asserted to reach "8 of 8" — the readout that pinned in the audit.
//
// It lives apart from r16w1 for one reason only: ten played rounds cost ~8s each in
// celebration time the product owns, and folding them in would push that suite past the
// 120s single-suite budget in CLAUDE.md. Expected runtime: ~80s. Not @serial — it waits
// on game state, never on frames.

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const RAW = process.env.BASE || 'http://127.0.0.1:8000';
const BASE = RAW.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
const RESOLVE = ['--host-resolver-rules=MAP app.localhost 127.0.0.1'];
const SHOTS = 'screenshots/run18a/h1';
mkdirSync(SHOTS, { recursive: true });
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };

const AK = ['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground', 'boohouse', 'gallery'];
const save = () => JSON.stringify({
  version: 17, name: 'Ada', ageAsked: true,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1 }, stars: { total: 400, byGame: {}, byType: {}, spent: {}, legacy: 0 }, trophies: {}, boxes: 0,
  town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 3 },
  seen: { trophyRetro: true, lastStarsShown: 400, introSeen: { soundsorter: true } },
  settings: { sound: false, music: false, voice: false, content: 'full' }
});

const browser = await chromium.launch({ args: RESOLVE });
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
const page = await ctx.newPage();
page.on('pageerror', e => errors.push(String(e)));
await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), save());
await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
await page.waitForFunction(() => window.BooTown && document.getElementById('screen').dataset.screen, null, { timeout: 20000 });

// The modes the PICKER offers — asked of the game itself, so a level added later is
// enumerated automatically rather than needing this list edited.
const MODES = await page.evaluate(async () => {
  const { SOUND_GROUPS, levelsForGroup } = await import('./js/games/soundsorter.js');
  const { filterLevels } = await import('./js/content.js');
  const { LEVEL_NAME } = await import('./data/phonemes.js');
  const out = [];
  for (const g of SOUND_GROUPS) for (const l of filterLevels(levelsForGroup(g.key))) {
    out.push({ group: g.key, name: g.name, level: l, levelName: LEVEL_NAME[l] });
  }
  return out;
});
console.log(`== every selectable mode: ${MODES.length} group/level combinations + Smart Mix ==`);

async function toStartCard() {
  await page.evaluate(() => window.BooTown.go('soundsorter', {}));
  await page.waitForFunction(() => document.getElementById('screen').dataset.screen === 'soundsorter', null, { timeout: 15000 });
  await page.waitForSelector('.start-card', { timeout: 8000 });
}

// Plays one mode to the end. Returns the progress readouts seen and how it ended.
async function playToEnd(label, pick) {
  await toStartCard();
  await pick();
  await page.waitForFunction(() => window.__sounds, null, { timeout: 10000 });
  const total = await page.evaluate(() => window.__sounds.state().total);
  const labels = [];
  for (let i = 0; i < total; i++) {
    // condition-wait on the game's own state: target i is rendered and taking taps
    await page.waitForFunction(n => window.__sounds && window.__sounds.state().renders === n
      && window.__sounds.state().solved === n - 1 && window.__sounds.state().live, i + 1, { timeout: 15000 });
    const t = await page.evaluate(() => window.__sounds.target());
    const missing = t.correct.filter(w => !t.cards.includes(w));
    if (missing.length) return { total, labels, end: `UNWINNABLE at target ${i + 1}: ${missing.join(',')} never dealt` };
    await page.evaluate(() => window.__sounds.solveTarget());
    labels.push(await page.evaluate(() => document.querySelector('.progress-label').textContent));
  }
  await page.waitForSelector('.screen.results', { timeout: 20000 });
  return { total, labels, end: 'results' };
}

for (const m of MODES) {
  const r = await playToEnd(`${m.group}/${m.level}`, async () => {
    await page.evaluate((name) => {
      const b = [...document.querySelectorAll('.picker-choice')].find(x => x.textContent.includes(name));
      if (!b) throw new Error('no choice button for ' + name);
      b.click();
    }, m.name);
    await page.waitForFunction(() => document.querySelectorAll('.level-btn').length > 0, null, { timeout: 5000 });
    await page.evaluate((levelName) => {
      const b = [...document.querySelectorAll('.level-btn')].find(x => x.textContent.includes(levelName));
      if (!b) throw new Error('no level button "' + levelName + '"');
      b.click();
    }, m.levelName);
  });
  const tag = `${m.name} — ${m.levelName}`;
  assert(r.end === 'results' && r.total === 8 && r.labels[7] === '8 of 8',
    `${tag}: eight targets, counter reaches 8 of 8, round ends (saw ${r.total} targets, last readout "${r.labels[r.labels.length - 1]}", ended at ${r.end})`);
}

// Smart Mix is a selectable mode too, and it builds its round by a different route.
{
  const r = await playToEnd('mix', async () => {
    await page.evaluate(() => document.querySelector('.picker-choice.mix, .pickforme').click());
  });
  assert(r.end === 'results' && r.total === 8 && r.labels[7] === '8 of 8',
    `Smart Mix: eight targets, counter reaches 8 of 8, round ends (saw ${r.total}, last readout "${r.labels[r.labels.length - 1]}", ended at ${r.end})`);
}

await page.screenshot({ path: SHOTS + '/modes-complete.png' });
console.log(errors.length ? '\nPAGE ERRORS: ' + errors.slice(0, 5).join(' | ') : '\nno page errors');
if (errors.length) failed = true;
await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
