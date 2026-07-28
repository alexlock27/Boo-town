// tests/r18a-expedition-truth.mjs — RUN18A H2: the Expedition tells the truth.
//
// Three defects, all three shipped to a child's screen, all three verified live before
// they were repaired:
//   1. `'One bridge sneezes at SOMETHING…'` — an authored PLACEHOLDER rendered as literal
//      text while the rule engine had been generating real rules the whole time.
//   2. `'Hmm… try THAT one!'` — a hint that named neither the Boo it pointed at nor the
//      rule it had spotted, on all four puzzles.
//   3. the literal string "null" under the campfire — a ternary's null passed into the
//      DOM's own append(), which coerces it to text (el() would have skipped it).
// Plus the door itself. RUN18A shut it (the hub's entry card said it was being polished
// and did not open, the Course-3 precedent) and this suite proved it stayed shut at every
// width and through every side entrance. RUN18C C5 built the presentation the containment
// existed for, so section 1 now proves the mirror image: the door is OPEN, every way in
// works, and nothing on the card is left over from the containment.
//
// The rule assertion is the load-bearing one. It does NOT compare the screen to itself:
// it PARSES the displayed sentence back into an attribute + value, builds its own
// predicate from that parse, and proves that predicate agrees with the engine's `pred`
// on every member of the party AND on a synthetic probe grid of every visible feature
// combination. A rule that reads one way and tests another fails here.
//
// Expected runtime: ~4s (measured 3.1s). The 50 rounds are cheap because a Sneezy round
// is a remount, not a played round. Not @serial — no frame evidence in this suite.

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const RAW = process.env.BASE || 'http://127.0.0.1:8000';
const BASE = RAW.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
const RESOLVE = ['--host-resolver-rules=MAP app.localhost 127.0.0.1'];
const SHOTS = 'screenshots/run18a/h2';
mkdirSync(SHOTS, { recursive: true });
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };

const AK = ['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground', 'boohouse', 'gallery'];
const BOOS = ['boo_inky', 'boo_plum', 'boo_pippin', 'boo_lolly', 'boo_chomp', 'boo_mallow', 'boo_curly',
  'boo_wisp', 'boo_beam', 'boo_dot', 'boo_fuzz', 'boo_splash', 'boo_bubbles', 'boo_minty', 'boo_skye', 'boo_candy'];
const save = () => JSON.stringify({
  version: 17, name: 'Ada', ageAsked: true,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: Object.fromEntries(BOOS.map(id => [id, 1])),
  stars: { total: 400, byGame: {}, byType: {}, spent: {}, legacy: 0 }, trophies: {}, boxes: 0,
  town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 3 },
  expedition: { party: BOOS.slice(0, 10), tiers: {}, progress: {} },
  seen: { trophyRetro: true, lastStarsShown: 400 },
  settings: { sound: false, music: false, voice: false, content: 'full' }
});

const browser = await chromium.launch({ args: RESOLVE });
const errors = [];
const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
const page = await ctx.newPage();
page.on('pageerror', e => errors.push(String(e).split('\n')[0]));
await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), save());
await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
await page.waitForFunction(() => window.BooTown && document.getElementById('screen').dataset.screen, null, { timeout: 20000 });

// Every visible text node on the current screen.
const texts = () => page.evaluate(() => {
  const out = [];
  const walk = document.createTreeWalker(document.getElementById('screen'), NodeFilter.SHOW_TEXT);
  let n; while ((n = walk.nextNode())) { const t = n.textContent.trim(); if (t) out.push(t); }
  return out;
});
const LEAKS = /^(null|undefined|NaN|\[object Object\])$/;
const PLACEHOLDERS = /SOMETHING|THAT one|\[object Object\]|\bundefined\b/;
const leaksIn = (list) => list.filter(t => LEAKS.test(t) || PLACEHOLDERS.test(t));

const go = async (route, params, sel) => {
  await page.evaluate(([r, p]) => window.BooTown.go(r, p || {}), [route, params]);
  await page.waitForSelector(sel, { timeout: 10000 });
};

// ---- 1. the entry card OPENS again, and carries the pack's blurb ----------------------
// RUN18A shut this door and this suite proved it stayed shut. RUN18C C5 built the
// presentation the containment existed for and reopened it, so the same section now
// proves the opposite — including the two side doors the playtest critic found when the
// door was closed, because "open" has to mean every door too.
console.log('== 1. the hub card is open again, and says what is behind it ==');
{
  await go('hub', {}, '.hub');
  const CONTAINED = await page.evaluate(async () => (await import('./data/expedition.js')).CONTAINED);
  assert(CONTAINED === '', `the containment switch is empty — the door is open ("${CONTAINED}")`);
  const card = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.game-card')].find(x => /Boo Expedition/.test(x.textContent));
    if (!b) return null;
    const r = b.getBoundingClientRect();
    return {
      disabled: b.disabled, cls: b.className,
      tag: (b.querySelector('.gc-tag') || {}).textContent,
      stars: !!b.querySelector('.gc-stars'),
      art: !!(b.querySelector('.gc-icon') || {}).querySelector?.('svg'),
      emoji: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test((b.querySelector('.gc-icon') || {}).textContent || ''),
      w: Math.round(r.width), h: Math.round(r.height)
    };
  });
  assert(!!card, 'the Boo Expedition card is on the hub');
  assert(card.disabled === false, 'the card is NOT disabled any more');
  assert(!/building/.test(card.cls), `and does not wear the "building" class ("${card.cls}")`);
  assert(card.tag === 'Pick 8 brave Boos and solve the trail!', `it wears the pack's blurb verbatim: "${card.tag}"`);
  assert(card.stars === true, 'the star row is back, because she can play it now');
  assert(card.art === true, 'the icon is real drawn art, not a glyph in a text node');
  assert(card.emoji === false, 'and there is no emoji left on it');
  assert(card.w >= 56 && card.h >= 56, `the card is a real target (${card.w}x${card.h})`);
  // tapping it must now OPEN the party select
  await page.evaluate(() => [...document.querySelectorAll('.game-card')].find(x => /Boo Expedition/.test(x.textContent)).click());
  await page.waitForSelector('.exp-picker', { timeout: 10000 }).catch(() => {});
  const after = await page.evaluate(() => document.getElementById('screen').dataset.screen);
  assert(after === 'expedition', `tapping it opens the Expedition (landed on "${after}")`);
  await page.screenshot({ path: SHOTS + '/hub-open.png' });
}

// ---- 1b. EVERY door is open, at EVERY width -------------------------------------------
// The mirror of RUN18A's 1b: both of those were found by the playtest critic and both were
// the same mistake — treating the front door as the only door.
console.log('== 1b. the side door, and the phone ==');
{
  // (a) What's New offers a real way in again, and it lands.
  await go('hub', {}, '.hub');
  const news = await page.evaluate(() => {
    if (!window.__whatsnew || !window.__whatsnew.shown()) return { noCard: true };
    window.__whatsnew.expand();
    const rows = [...document.querySelectorAll('.wn-item')];
    const i = rows.findIndex(r => /Expedition/.test(r.textContent));
    if (i < 0) return { noEntry: true };
    const row = rows[i];
    return { i, hasGo: !!row.querySelector('.wn-go'), shut: (row.querySelector('.wn-shut') || {}).textContent || null, clicked: window.__whatsnew.go(i) };
  });
  if (news.noCard || news.noEntry) {
    assert(false, 'could not reach a What\'s New entry for the Expedition — check the fixture, this assertion is load-bearing');
  } else {
    await page.waitForTimeout(700);
    const landed = await page.evaluate(() => document.getElementById('screen').dataset.screen);
    assert(news.hasGo === true, 'What\'s New offers a "Show me!" for the Expedition again');
    assert(!news.shut, `and wears no shut-reason ("${news.shut}")`);
    assert(news.clicked === true && landed === 'expedition', `and the door it offers actually opens (landed on "${landed}")`);
  }

  // (b) at every width the card carries its blurb — the generic phone rule hides .gc-tag
  //     on cards, and this one's tag is what tells her what the Expedition IS.
  for (const [w, h] of [[390, 844], [768, 1024], [1024, 768]]) {
    await page.setViewportSize({ width: w, height: h });
    await go('hub', {}, '.hub');
    const seen = await page.evaluate(() => {
      const b = [...document.querySelectorAll('.game-card')].find(x => /Boo Expedition/.test(x.textContent));
      if (!b) return { missing: true };
      const r = b.getBoundingClientRect();
      return { enabled: !b.disabled, w: Math.round(r.width), h: Math.round(r.height) };
    });
    assert(!seen.missing && seen.enabled && seen.w >= 56 && seen.h >= 56,
      `${w}px: the card is present, open and a real target (${seen.w}x${seen.h})`);
  }
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.screenshot({ path: SHOTS + '/hub-open-1024.png' });
}

// ---- 2. no expedition screen renders a leaked token --------------------------------
console.log('== 2. no rendered text node is a placeholder or a leaked null ==');
{
  await go('expedition', {}, '.exp-picker');
  const picker = await texts();
  assert(leaksIn(picker).length === 0, 'the party picker is clean' + (leaksIn(picker).length ? ': ' + leaksIn(picker).join('; ') : ''));

  await go('expedition', { trail: true }, '.exp-trail');
  const trail = await texts();
  assert(!trail.includes('null'), 'THE CAMPFIRE "null" IS GONE — no text node on the trail is the string "null"');
  assert(leaksIn(trail).length === 0, 'and the rest of the trail screen is clean' + (leaksIn(trail).length ? ': ' + leaksIn(trail).join('; ') : ''));
  await page.screenshot({ path: SHOTS + '/trail-clean.png' });

  for (const node of ['bridges', 'picnic', 'raft', 'hotel']) {
    await go('expeditionpuzzle', { node }, '.exp-puzzle');
    const opening = await texts();
    assert(leaksIn(opening).length === 0, `${node}: the opening screen is clean` + (leaksIn(opening).length ? ': ' + leaksIn(opening).join('; ') : ''));
    const line = await page.evaluate(() => { window.__expeditionPuzzle.hint(); return document.querySelector('.exp-puzzle-status').textContent; });
    assert(!PLACEHOLDERS.test(line) && line !== 'Hmm… try THAT one!', `${node}: the hint names something — "${line}"`);
    // the hint must name the rule it spotted, or (raft, which has no generated rule) the
    // seating law itself. Either way it teaches; "try THAT one" taught nothing.
    const rules = await page.evaluate(() => (window.__expeditionPuzzle.rules() || []).map(r => r && r.text));
    const teaches = rules.length ? rules.some(t => t && line.includes(t.replace(/ (species|colour)$/, ''))) : /share exactly ONE thing/i.test(line);
    assert(teaches, `${node}: and the hint quotes the active rule (rules: ${JSON.stringify(rules)})`);
    // the counter never shows a camelCase code identifier
    const counter = await page.evaluate(() => document.querySelector('.exp-budget').textContent);
    assert(!/[a-z][A-Z]/.test(counter), `${node}: the counter is words, not code — "${counter}"`);
  }
}

// ---- 3. fifty Sneezy rounds: the shown rule IS the rule the engine tests -------------
console.log('== 3. 50 Sneezy rounds: displayed rule text === the engine\'s own predicate ==');
{
  const r = await page.evaluate(async (bootBoos) => {
    const { featuresOf } = await import('./js/attrengine.js');
    const { BY_ID } = await import('./data/catalogue.js');
    // Parse the ENGINE'S sentence back into an attribute + value set, independently of
    // how the engine built it. "pip or twirl species" -> {path:'species',values:[pip,twirl]}
    function parse(text) {
      const negated = /^not /.test(text);
      const body = text.replace(/^not /, '');
      const parts = body.split(' or ');
      const BOOL = { 'wearing an accessory': ['accessory', true], 'not wearing an accessory': ['accessory', false], 'shiny': ['shiny', true], 'not shiny': ['shiny', false] };
      if (parts.every(p => BOOL[p])) {
        const path = BOOL[parts[0]][0];
        if (!parts.every(p => BOOL[p][0] === path)) return null;
        return { path, values: parts.map(p => BOOL[p][1]), negated };
      }
      const m = parts[parts.length - 1].match(/^(.*) (species|colour)$/);
      if (!m) return null;
      const path = m[2];
      const values = [...parts.slice(0, -1), m[1]];
      return { path, values, negated };
    }
    const predFromText = (p) => (item) => {
      const has = p.values.includes(featuresOf(item)[p.path]);
      return p.negated ? !has : has;
    };
    // a synthetic probe grid: every visible feature combination the engine can describe
    const SPECIES = ['bloop', 'pip', 'munch', 'twirl', 'sunny', 'nova'];
    const COLOURS = ['indigo', 'lilac', 'aqua', 'teal', 'bubblegum', 'gold'];
    const probes = [];
    for (const species of SPECIES) for (const colour of COLOURS) for (const acc of [0, 1]) for (const shiny of [0, 1]) {
      probes.push({ id: `probe_${species}_${colour}_${acc}_${shiny}`, name: 'Probe', species, colour, acc: acc ? 'hat' : '', shiny: !!shiny });
    }
    const rounds = [];
    for (let i = 0; i < 50; i++) {
      // a different party each round, so a different rule gets generated
      const party = bootBoos.slice().sort(() => Math.random() - 0.5).slice(0, 8 + (i % 5));
      window.BooTown.State.mutate(s => { s.expedition = s.expedition || {}; s.expedition.party = party; });
      window.BooTown.go('expeditionpuzzle', { node: 'bridges' });
      await new Promise(res => setTimeout(res, 30));
      const api = window.__expeditionPuzzle;
      const rules = api.rules() || [];
      const shown = document.querySelector('.exp-puzzle-status').textContent;
      const people = [...document.querySelectorAll('.exp-dock .exp-puzzle-boo')]
        .map(b => ({ ...BY_ID[b.dataset.id], id: b.dataset.id }));
      if (!rules.length) { rounds.push({ i, noRule: true, shown }); continue; }
      const parsed = parse(rules[0].text);
      const mine = parsed && predFromText(parsed);
      const disagree = parsed ? probes.filter(p => mine(p) !== rules[0].pred(p)).length : -1;
      rounds.push({
        i, shown, ruleText: rules[0].text, parsed, disagree,
        quotesRule: shown.includes(rules[0].text),
        placeholder: /SOMETHING|THAT one/.test(shown),
        // The rules partition THE PARTY on the dock — not the synthetic grid, which
        // contains Boos who were never on this trail and may match neither bridge. The
        // claim that matters is the one the sentence makes: for every Boo she can pick
        // up, exactly one bridge lets them cross and the other one sneezes.
        bothOrNeither: rules.length === 2 ? people.filter(p => rules[0].pred(p) === rules[1].pred(p)).length : null,
        people: people.length
      });
    }
    return rounds;
  }, BOOS);

  const built = r.filter(x => !x.noRule);
  assert(built.length >= 45, `${built.length} of 50 rounds generated a rule (a thin party legitimately generates none)`);
  assert(r.every(x => !x.placeholder), 'not one of the 50 opening lines contains "SOMETHING" or "THAT one"');
  assert(built.every(x => x.quotesRule), 'every opening line quotes the engine\'s own description of the active rule');
  const unparsed = built.filter(x => !x.parsed);
  assert(unparsed.length === 0, 'every displayed rule text is machine-readable back into an attribute + value' + (unparsed.length ? ': ' + unparsed.slice(0, 3).map(x => x.ruleText).join('; ') : ''));
  const wrong = built.filter(x => x.disagree !== 0);
  assert(wrong.length === 0, `THE SHOWN RULE IS THE TESTED RULE: on a 144-probe grid the sentence and the engine's predicate agree in every round${wrong.length ? ' — mismatch: ' + wrong.slice(0, 3).map(x => `${x.ruleText} (${x.disagree} probes)`).join('; ') : ''}`);
  const pairs = built.filter(x => x.bothOrNeither !== null);
  const overlap = pairs.filter(x => x.bothOrNeither > 0);
  assert(pairs.length === built.length, `every round built the two-bridge pair (${pairs.length}/${built.length})`);
  assert(overlap.length === 0, `the two bridges partition the party — exactly one lets each Boo cross, so "one bridge sneezes at X" is a TRUE statement about the other bridge${overlap.length ? ' — broken in ' + overlap.length + ' rounds' : ''}`);
  assert(built.every(x => x.people >= 8), `and every party on the dock was a real one (smallest ${Math.min(...built.map(x => x.people))} Boos)`);
  console.log(`  (sample rules seen: ${[...new Set(built.map(x => x.ruleText))].slice(0, 6).join(' | ')})`);
}

console.log(errors.length ? '\nPAGE ERRORS: ' + errors.slice(0, 5).join(' | ') : '\nno page errors');
if (errors.length) failed = true;
await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
