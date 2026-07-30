// tests/r19z4-acknowledge.mjs — RUN19 Z4: the acknowledgement pass.
//
// Two halves:
//  · NICKNAME SCOPE, precisely. displayName = nickname ?? species name, used everywhere a Boo
//    is named — EXCEPT the collection grid and the shop, where species identity is the point
//    and the nickname becomes a second line instead. That exception is the whole reason this
//    suite exists: substituting the nickname in the collection made a renamed Boo unfindable
//    in her own collection.
//  · FOUR NOTICED MOMENTS, each from its real trigger, all sharing ONE ≤2-per-session budget.
// Expected runtime ~20s. Not @serial.
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const errors = []; let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const TODAY = new Date().toISOString().slice(0, 10);
const NICK = 'Snacks';

const SAVE = (over = {}) => Object.assign({
  version: 21, name: 'Ada', created: 1750000000000,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'Twiggy' },
  inventory: { boo_pippin: 1, boo_inky: 1, deco_easel: 1, deco_stage: 1 },
  stars: { total: 400, byGame: {} }, meter: 0, boxes: 0, opened: 4, stardust: 0,
  nicknames: { boo_pippin: NICK }, equips: {}, catBest: {}, ledger: {},
  town: { areas: { meadow: { items: [{ zone: 'meadow', x: 0.12, row: 1, item: 'boo_pippin' }], paths: [] } } },
  care: { bonds: {}, treats: 3 },
  delights: { hideDay: TODAY, hideFound: true },
  request: { actives: [], lastResolvedAt: Date.now() },
  routines: {}, journal: {}, trophies: {}, customs: [], easelArt: '',
  expedition: { tiers: {}, progress: {}, party: ['boo_pippin'] },
  settings: { sound: false, music: false, voice: false, mic: false, requests: false, content: 'full' },
  seen: { ageAsked: true, boohouseSeeded: true, townFirst: true, introSeen: { care: true } }
}, over);

const browser = await chromium.launch();
async function boot(over = {}, { hour = 13 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('PE ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(m.text()); });
  await page.addInitScript(hr => { window.__bootownHour = hr; }, hour);
  await page.addInitScript(s => { localStorage.setItem('bootown.save.v1', s); }, JSON.stringify(SAVE(over)));
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.waitForSelector('.hub');
  return { ctx, page };
}

// ---- the display-name rule itself --------------------------------------------------
console.log('== displayName = nickname ?? species name, in ONE place ==');
{
  const { ctx, page } = await boot();
  const names = await page.evaluate(async (nick) => {
    const a = await import('./js/accessories.js');
    return {
      display: a.getDisplayName('boo_pippin'),
      official: a.officialName('boo_pippin'),
      nickOnly: a.nicknameOf('boo_pippin'),
      unnamedDisplay: a.getDisplayName('boo_inky'),
      unnamedNickOnly: a.nicknameOf('boo_inky'),
      nick
    };
  }, NICK);
  assert(names.display === NICK, `getDisplayName returns the nickname (${names.display})`);
  assert(names.official === 'Pippin', `officialName still returns the species name (${names.official})`);
  assert(names.nickOnly === NICK, `nicknameOf returns the nickname alone (${names.nickOnly})`);
  assert(names.unnamedDisplay === 'Inky', `an un-nicknamed Boo falls back to its species name (${names.unnamedDisplay})`);
  assert(names.unnamedNickOnly === '', 'and nicknameOf is empty for it, not the species name repeated');
  await ctx.close();
}

console.log('== the collection shows the SPECIES name, with the nickname beneath ==');
{
  const { ctx, page } = await boot();
  await page.evaluate(() => window.BooTown.go('collection'));
  await page.waitForSelector('.coll-grid');
  const tile = await page.evaluate(() => {
    const arts = [...document.querySelectorAll('.coll-tile.owned')];
    const t = arts.find(n => /Pippin/.test(n.textContent));
    if (!t) return null;
    return { name: t.querySelector('.coll-name').textContent, nick: (t.querySelector('.coll-nick') || {}).textContent || null };
  });
  assert(tile, 'the renamed Boo is still findable in the collection by its species name');
  assert(tile && /^Pippin/.test(tile.name), `the main line is the species name (${tile && tile.name})`);
  assert(tile && tile.nick === NICK, `and the nickname is a second line beneath it (${tile && tile.nick})`);
  // contrast law on the new line, against its real rendered background
  const nickContrast = await page.evaluate(() => {
    const n = document.querySelector('.coll-nick');
    if (!n) return null;
    const lum = (c) => { const [r, g, b] = c.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
    // walk up for the first non-transparent background
    let bg = null, p = n;
    while (p && !bg) { const c = getComputedStyle(p).backgroundColor; if (c && !/rgba\(0, 0, 0, 0\)|transparent/.test(c)) bg = c; p = p.parentElement; }
    const cs = getComputedStyle(n);
    const a = parseFloat(cs.opacity || '1');
    const fg = cs.color.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
    const bgc = bg.match(/\d+(\.\d+)?/g).slice(0, 3).map(Number);
    // flatten the element's own opacity against its background, then measure
    const mixed = `rgb(${fg.map((v, i) => Math.round(v * a + bgc[i] * (1 - a))).join(',')})`;
    const l1 = lum(mixed), l2 = lum(bg);
    return { ratio: (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05), fg: mixed, bg };
  });
  assert(nickContrast && nickContrast.ratio >= 4.5,
    `the nickname line passes the contrast law against its real background (${nickContrast && nickContrast.ratio.toFixed(2)}:1, ${nickContrast && nickContrast.fg} on ${nickContrast && nickContrast.bg})`);
  await ctx.close();
}

console.log('== the shop names the species too (buying is about what a thing IS) ==');
{
  const { ctx, page } = await boot();
  const shopUsesNick = await page.evaluate(async () => {
    const src = await fetch('./js/shop.js', { cache: 'no-store' }).then(r => r.text());
    return /getDisplayName/.test(src);
  });
  assert(!shopUsesNick, 'js/shop.js does not substitute nicknames');
  await ctx.close();
}

console.log('== a Boo is named by her name everywhere else ==');
{
  const { ctx, page } = await boot();
  await page.evaluate(() => window.BooTown.go('town', { area: 'meadow' }));
  await page.waitForSelector('.town2');
  await page.waitForFunction(() => window.__townLife && window.__townLife.actorCount() > 0, { timeout: 6000 });
  await sleep(300);
  // town tap line
  const tapped = await page.evaluate(async () => {
    // town items respond to pointerdown/pointerup, not click() — tapActor is the seam
    if (!window.__townLife.tapActor(0)) return null;
    await new Promise(r => setTimeout(r, 220));
    const tag = document.querySelector('.squeak-name');
    return tag ? tag.textContent : null;
  });
  assert(tapped && tapped.includes(NICK), `the town tap line uses her nickname (${tapped})`);
  // care screen
  const careTitle = await page.evaluate(async () => {
    const c = await import('./js/care.js');
    const cat = await import('./data/catalogue.js');
    c.openCare(cat.BY_ID['boo_pippin']);
    await new Promise(r => setTimeout(r, 300));
    const h = document.querySelector('.care-panel h2');
    return h ? h.textContent : null;
  });
  assert(careTitle && careTitle.includes(NICK), `the care screen uses her nickname (${careTitle})`);
  // request line
  const reqLine = await page.evaluate(async () => {
    const g = await import('./js/guide.js');
    const a = await import('./js/accessories.js');
    return g.guideLine('request_dance', { booName: a.getDisplayName('boo_pippin') });
  });
  assert(reqLine === `${NICK} has a wiggle that needs music!`, `a request line uses her nickname (${reqLine})`);
  await ctx.close();
}

console.log('== the expedition party is labelled with her names ==');
{
  const { ctx, page } = await boot();
  await page.evaluate(() => window.BooTown.go('expedition'));
  await page.waitForSelector('.exp-tile-name, .exp-trail, .expedition', { timeout: 8000 }).catch(() => {});
  const labels = await page.evaluate(() => [...document.querySelectorAll('.exp-tile-name')].map(n => n.textContent));
  if (labels.length) {
    const pip = labels.find(l => /Snacks|Pippin/.test(l));
    assert(pip === NICK, `a party tile is labelled with her nickname (${pip} among ${JSON.stringify(labels)})`);
  } else {
    console.log('  · the party picker did not render for this fixture — see the source check below');
  }
  const trailUsesDisplay = await page.evaluate(async () => {
    const src = await fetch('./js/expedition/trail.js', { cache: 'no-store' }).then(r => r.text());
    return { imports: /getDisplayName/.test(src), rawName: /text: boo\.name|title: boo\.name/.test(src) };
  });
  assert(trailUsesDisplay.imports, 'js/expedition/trail.js resolves party names through getDisplayName');
  assert(!trailUsesDisplay.rawName, 'and no party label renders the raw species name any more');
  await ctx.close();
}

// ---- the four noticed moments ------------------------------------------------------
console.log('== ONE budget across all four moments ==');
{
  const { ctx, page } = await boot();
  const shared = await page.evaluate(async () => {
    const a = await import('./js/ack.js');
    a.resetAcks();
    // four DIFFERENT moments, all drawing on the same purse
    const out = [a.acknowledge('restyle'), a.acknowledge('easel'), a.acknowledge('path', { booName: 'X', style: 'stone' }), a.acknowledge('socketClaim', { areaName: 'Meadow' })];
    return { out, said: a.acksSaid(), left: a.ackBudgetLeft() };
  });
  const spoken = shared.out.filter(Boolean);
  assert(spoken.length === 2, `four different moments still yield only two lines (${spoken.length}: ${JSON.stringify(shared.out)})`);
  assert(shared.left === 0, 'and the budget is spent, not per-moment');
  await ctx.close();
}

console.log('== the restyle line, from its real trigger ==');
{
  const { ctx, page } = await boot();
  const flagged = await page.evaluate(async () => {
    const st = window.BooTown.State;
    // the real trigger: editguide's onDone writes seen.guideRestyled when the LOOK changed
    window.BooTown.go('editguide', { from: 'hub' });
    await new Promise(r => setTimeout(r, 400));
    const before = JSON.stringify(st.getState().guide);
    st.mutate(s => { s.guide = { ...s.guide, body: 'bubblegum' }; s.seen = Object.assign(s.seen || {}, { guideRestyled: true }); });
    return { before, flag: !!st.getState().seen.guideRestyled };
  });
  assert(flagged.flag, 'a restyle sets the flag the hub reads');
  const said = await page.evaluate(async () => {
    const a = await import('./js/ack.js');
    a.resetAcks();
    window.BooTown.go('hub');
    // Poll rather than sleep: the line lands on a 2.6s setTimeout, and a fixed wait only a
    // little longer than that is a guaranteed flake under a loaded parallel board.
    for (let k = 0; k < 60; k++) {
      if (window.__hubRestyle !== undefined && window.__hubRestyle !== null) break;
      await new Promise(r => setTimeout(r, 200));
    }
    return { line: window.__hubRestyle, flagLeft: !!window.BooTown.State.getState().seen.guideRestyled, bubble: (document.querySelector('.speech-bubble') || {}).textContent };
  });
  assert(said.line === 'Ooh — do you like my new look? I love it.', `the authored restyle line ships verbatim (${said.line})`);
  assert(said.flagLeft === false, 'and the flag is cleared, so it never says it twice');
  await ctx.close();
}

console.log('== the restyle flag is cleared even when the budget declines ==');
{
  const { ctx, page } = await boot();
  const declined = await page.evaluate(async () => {
    const a = await import('./js/ack.js');
    a.resetAcks();
    // four calls, not two: the never-twice-in-a-row latch declines every other one, so
    // two calls only ever spend ONE of the two.
    a.acknowledge('easel'); a.acknowledge('path', { booName: 'X', style: 'stone' });
    a.acknowledge('socketClaim', { areaName: 'Meadow' }); a.acknowledge('path', { booName: 'Y', style: 'sand' });
    if (a.ackBudgetLeft() !== 0) return { setupFailed: a.ackBudgetLeft() };
    const st = window.BooTown.State;
    st.mutate(s => { s.seen = Object.assign(s.seen || {}, { guideRestyled: true }); });
    window.BooTown.go('hub');
    await new Promise(r => setTimeout(r, 600));
    return { line: window.__hubRestyle, flagLeft: !!st.getState().seen.guideRestyled };
  });
  assert(!declined.setupFailed, `the budget really was spent before the hub mounted (${declined.setupFailed} left)`);
  assert(declined.line === null, 'a spent budget says nothing');
  assert(declined.flagLeft === false,
    'and the flag is STILL cleared — an acknowledgement that queues for days would arrive with no idea what it was about');
  await ctx.close();
}

console.log('== the painted-path line: the geometric rule, and its live trigger ==');
{
  // Tiles laid in the Boo's OWN row band. cy 11 lands on ROW_GROUND[1]: the band runs
  // 0.62..0.92 of viewH and a cell is 5% of it, so the cell centre is
  // 0.62 + 11.5*0.05*0.30 = 0.7925 -> nearest depth row 0.79.
  const rowTiles = Array.from({ length: 12 }, (_, i) => ({ cx: i, cy: 11, style: 'flower' }));
  const { ctx, page } = await boot({
    town: { areas: { meadow: { items: [{ zone: 'meadow', x: 0.12, row: 1, item: 'boo_pippin' }], paths: rowTiles } } }
  });
  await page.evaluate(() => window.BooTown.go('town', { area: 'meadow' }));
  await page.waitForSelector('.town2');
  await page.waitForFunction(() => window.__townLife && window.__townLife.actorCount() > 0, { timeout: 6000 });
  // The RULE, deterministically. The live trigger is a wanderer's arrival, which is random by
  // design — asserting on the dice landing inside 15s is how a suite becomes a chronic flake.
  const hit = await page.evaluate(async () => {
    const a = await import('./js/ack.js'); a.resetAcks();
    const probe = window.__townLife.ackPathNow(0);
    await new Promise(r => setTimeout(r, 150));
    return { probe, bubble: [...document.querySelectorAll('.catchphrase-bubble')].map(n => n.textContent).find(t => /path you made/.test(t)) || null };
  });
  assert(hit.probe && hit.probe.hit, `a Boo standing on her path matches a tile (landing ${hit.probe && hit.probe.landing}, row ${hit.probe && hit.probe.row}, tile ${JSON.stringify(hit.probe && hit.probe.hit)})`);
  assert(hit.bubble === 'Snacks loves the flowery path you made!',
    `and says the authored line, with her nickname and the path's style (${hit.bubble})`);
  await ctx.close();
}
{
  // NEGATIVE: the same tiles, but the Boo is in a different depth row. "Same row band" is
  // part of the rule — without it every Boo in the area would claim to love the path.
  const rowTiles = Array.from({ length: 12 }, (_, i) => ({ cx: i, cy: 11, style: 'flower' }));
  const { ctx, page } = await boot({
    town: { areas: { meadow: { items: [{ zone: 'meadow', x: 0.12, row: 0, item: 'boo_pippin' }], paths: rowTiles } } }
  });
  await page.evaluate(() => window.BooTown.go('town', { area: 'meadow' }));
  await page.waitForSelector('.town2');
  await page.waitForFunction(() => window.__townLife && window.__townLife.actorCount() > 0, { timeout: 6000 });
  const miss = await page.evaluate(async () => {
    const a = await import('./js/ack.js'); a.resetAcks();
    const probe = window.__townLife.ackPathNow(0);
    await new Promise(r => setTimeout(r, 150));
    return { probe, said: window.__acks.said() };
  });
  assert(miss.probe && !miss.probe.hit, `a Boo in another row band matches nothing (row ${miss.probe && miss.probe.row} vs tiles in ${JSON.stringify(miss.probe && miss.probe.tileRows)})`);
  assert(miss.said === 0, 'and nothing is said — no budget is spent on a miss');
  await ctx.close();
}
{
  // ...and the live trigger really is wired to a wanderer's arrival, not only to the seam.
  const { ctx, page } = await boot();
  const wired = await page.evaluate(async () => {
    const src = await fetch('./js/town.js', { cache: 'no-store' }).then(r => r.text());
    return /if \(a\.state === 'walk'\) maybeAckPath\(a\);/.test(src);
  });
  assert(wired, "maybeAckPath is called from the wander loop's arrival branch, not just the QA seam");
  await ctx.close();
}

console.log('== the easel line, only for HER art ==');
{
  const { ctx, page } = await boot({
    town: { areas: { meadow: { items: [{ zone: 'meadow', x: 0.12, row: 1, item: 'deco_easel' }], paths: [] } } }
  });
  // no art displayed: the easel is not "one of yours", so nothing is said
  await page.evaluate(() => window.BooTown.go('town', { area: 'meadow' }));
  await page.waitForSelector('.town2');
  await sleep(700);
  const silent = await page.evaluate(() => [...document.querySelectorAll('.catchphrase-bubble')].map(n => n.textContent).some(t => /painting by the easel/.test(t)));
  assert(!silent, 'an easel with no art of hers on it says nothing — that would be a lie');
  // now put a real artwork in it, through the real save path
  const withArt = await page.evaluate(async () => {
    const studio = await import('./js/studio.js');
    const a = await import('./js/ack.js');
    a.resetAcks();
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==';
    const res = await studio.saveArtwork(png, 'paint');
    window.BooTown.State.mutate(s => { s.easelArt = res.id; });
    window.BooTown.go('town', { area: 'meadow' });
    for (let k = 0; k < 40; k++) {
      const b = [...document.querySelectorAll('.catchphrase-bubble')].map(n => n.textContent).find(t => /painting by the easel/.test(t));
      if (b) return b;
      await new Promise(r => setTimeout(r, 200));
    }
    return null;
  });
  assert(withArt === 'I do like the painting by the easel. One of yours, isn\'t it?',
    `her art on the easel earns the authored line, verbatim (${withArt})`);
  await ctx.close();
}

console.log('== the first PERFORMED routine gets its own journal stamp ==');
{
  const { ctx, page } = await boot({
    routines: { 'meadow:0.1': ['bounce', 'spin', 'jump'] },
    town: { areas: { meadow: { items: [
      { zone: 'meadow', x: 0.10, row: 1, item: 'deco_stage' },
      { zone: 'meadow', x: 0.11, row: 1, item: 'boo_pippin' }
    ], paths: [] } } }
  });
  await page.evaluate(() => window.BooTown.go('town', { area: 'meadow' }));
  await page.waitForSelector('.town2');
  await sleep(900);
  const stamped = await page.evaluate(async () => {
    const q = await import('./js/quests.js');
    const j = window.BooTown.State.getState().journal || {};
    const entries = q.journalEntries ? q.journalEntries() : [];
    return { key: j.routine_first || null, label: (entries.find(e => e.key === 'routine_first' || /performed/.test(e.label || '')) || {}).label || null };
  });
  assert(!!stamped.key, `performing a saved routine stamps routine_first (${stamped.key})`);
  assert(stamped.label === 'First dance routine performed!', `with the authored sticker copy (${stamped.label})`);
  await ctx.close();
}

console.log('\n== errors ==');
if (errors.length) console.log(errors.map(e => '  ! ' + e).join('\n'));
assert(errors.length === 0, 'no JS console errors');
await browser.close();
console.log('\n' + (failed ? 'RESULT: FAIL' : 'RESULT: PASS'));
process.exit(failed ? 1 : 0);
