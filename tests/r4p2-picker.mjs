// tests/r4p2-picker.mjs — RUN4 phase 2 (C2): Pick for me + kid-readable set names.
// Acceptance (RUN4 part D #4): Pick for me is first and visually primary on every
// picker and starts a round in ONE tap; every spelling set card shows its friendly
// name and two samples exactly per the C2 mapping; maths cards show sample
// questions; Full-tier set cards group under three collapsible headers.
// (The age-question items of D#4 are covered by tests/dp4-age.mjs.)
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SAVE = (over = {}) => Object.assign({
  version: 4, name: 'Ada',
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1 }, boxes: 0, meter: 0, opened: 1, pity: { commons: 0 },
  nicknames: {}, equips: {}, catBest: {}, town: [], stars: { total: 60, byGame: {} },
  ledger: {}, settings: { sound: false, music: false, voice: false, content: 'full' },
  seen: {}, ageAsked: true, age: 8
}, over);

const browser = await chromium.launch();
async function fresh(save) {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), save);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  return { ctx, page };
}

// ---- Pick for me: first, primary, one tap on the four picker games ----
console.log('== Pick for me: one tap, every buildPicker game ==');
{
  const { ctx, page } = await fresh(SAVE());
  for (const game of ['bubblepop', 'dash', 'feedboos', 'spellboo']) {
    await page.evaluate(g => window.BooTown.go(g), game);
    await page.waitForSelector('.picker');
    const first = await page.$eval('.picker-choices > :first-child', n => ({ cls: n.className, txt: n.textContent }));
    assert(/mix/.test(first.cls) && /Pick for me/.test(first.txt), `${game}: Pick for me is the first card`);
    assert(/pickforme/.test(first.cls), `${game}: Pick for me carries the primary styling`);
    await page.click('.picker-choices > :first-child');
    const started = await page.waitForSelector('.game-topbar', { timeout: 5000 }).then(() => true).catch(() => false);
    assert(started, `${game}: one tap starts a round with no further choices`);
    await page.evaluate(() => window.BooTown.go('hub'));
    await page.waitForSelector('.hub');
  }
  await ctx.close();
}

// ---- Pick for me on the arcade pickers (Medium/Full tiers have pickers) ----
console.log('== Pick for me: arcade start cards ==');
{
  const { ctx, page } = await fresh(SAVE());
  const ROUND = { blocks: '.blk-board', bounce: '.bounce-canvas', beat: '.game-topbar' };
  for (const game of ['blocks', 'bounce', 'beat']) {
    await page.evaluate(g => window.BooTown.go(g), game);
    await page.waitForSelector('.start-card');
    const pfm = await page.$('.start-card .pickforme');
    assert(!!pfm, `${game}: arcade start card offers Pick for me`);
    const before = await page.$$eval('.start-card', els => els.length);
    await page.click('.start-card .pickforme');
    const started = await page.waitForSelector(ROUND[game], { timeout: 5000 }).then(() => true).catch(() => false);
    assert(started && before === 1, `${game}: one tap starts the Smart-Mix round`);
    await page.evaluate(() => window.BooTown.go('hub'));
    await page.waitForSelector('.hub');
  }
  await ctx.close();
}

// ---- Spell Boo friendly names + samples, exactly per the C2 mapping ----
console.log('== Spell Boo set cards: names + samples (Full tier) ==');
const MAPPING = [
  ['The Big List', 'believe · February'],
  ['Th Words', 'with · three'],
  ['Sound Twins', 'there / their'],
  ['Word Starters 1', 'unhappy · redo'],
  ['Word Starters 2', 'impossible · incorrect'],
  ['Super Starters', 'superstar · submarine'],
  ['The ly Endings', 'happily · gently'],
  ['The ous Endings', 'famous · enormous'],
  ['The shun Endings', 'station · musician'],
  ['Sneaky ch says k', 'school · echo'],
  ['Sneaky ch says sh', 'chef · machine'],
  ['Silent Enders', 'tongue · unique'],
  ['Silent c Words', 'science · scissors'],
  ['The eigh Gang', 'eight · they'],
  ['Short ou Words', 'young · touch'],
  ['The ture Words', 'picture · adventure'],
  ['Double Trouble', 'beginning · gardener']
];
{
  const { ctx, page } = await fresh(SAVE());
  await page.evaluate(() => window.BooTown.go('spellboo'));
  await page.waitForSelector('.picker');
  // expand every group so all cards are queryable
  await page.$$eval('.pg-head', hs => hs.forEach(h => h.dataset.open === 'true' || h.click()));
  await sleep(200);
  const cards = await page.$$eval('.picker-choice', els => els.map(n => ({
    name: (n.querySelector('.pc-name') || {}).textContent || '',
    sub: (n.querySelector('.pc-sub') || {}).textContent || ''
  })));
  for (const [name, sub] of MAPPING) {
    const hit = cards.find(c => c.name === name);
    assert(!!hit, `set card "${name}" present`);
    if (hit) assert(hit.sub === sub, `"${name}" shows samples "${sub}" (got "${hit.sub}")`);
  }
  const homo = cards.find(c => c.name === 'Homophones');
  assert(!!homo && homo.sub.length > 0, 'Homophones keeps its name and shows samples');
  assert(!cards.some(c => /Tricky Sounds|Prefixes|family|gue and que/.test(c.name)), 'no old jargon names remain');

  // three collapsible headers at the Full tier
  const heads = await page.$$eval('.pg-head', hs => hs.map(h => h.textContent.trim()));
  assert(heads.length === 3, `three group headers (got ${heads.length}: ${heads.join(' | ')})`);
  for (const h of ['Starters', 'Endings', 'Sneaky sounds and silent letters']) {
    assert(heads.some(x => x.includes(h)), `header "${h}" present`);
  }
  // collapsible: clicking a header hides its cards again
  const firstHead = await page.$('.pg-head');
  const bodySel = '.picker-group:first-of-type .pg-body .picker-choice';
  const visibleBefore = await page.$$eval(bodySel, els => els.filter(e => e.offsetParent !== null).length);
  await firstHead.click(); await sleep(250);
  const visibleAfter = await page.$$eval(bodySel, els => els.filter(e => e.offsetParent !== null).length);
  assert(visibleBefore > 0 && visibleAfter === 0, `group headers collapse (before ${visibleBefore}, after ${visibleAfter})`);
  await ctx.close();
}

// ---- Light tier: friendly names, no group headers ----
console.log('== Spell Boo Light tier ==');
{
  const { ctx, page } = await fresh(SAVE({ settings: { sound: false, music: false, voice: false, content: 'light' } }));
  await page.evaluate(() => window.BooTown.go('spellboo'));
  await page.waitForSelector('.picker');
  const names = await page.$$eval('.pc-name', els => els.map(n => n.textContent));
  assert(names.includes('The Big List') && names.includes('Th Words') && names.includes('Sound Twins'), 'Light shows the three friendly sets');
  const heads = await page.$$eval('.pg-head', hs => hs.length);
  assert(heads === 0, 'no group headers below the Full tier');
  await ctx.close();
}

// ---- maths cards show sample questions ----
console.log('== maths sample questions ==');
{
  const { ctx, page } = await fresh(SAVE());
  await page.evaluate(() => window.BooTown.go('bubblepop'));
  await page.waitForSelector('.picker');
  const cards = await page.$$eval('.picker-choice', els => els.map(n => ({
    name: (n.querySelector('.pc-name') || {}).textContent || '',
    sub: (n.querySelector('.pc-sub') || {}).textContent || ''
  })));
  const expect = { 'Times tables': '7 × 8', 'Number bonds': '35 + ? = 100', 'Add & subtract': '46 + 37', 'Doubles & halves': 'Double 14', 'More or less': '10 more than 62' };
  for (const [name, sub] of Object.entries(expect)) {
    const hit = cards.find(c => c.name === name);
    assert(!!hit && hit.sub === sub, `Bubble Pop "${name}" shows sample "${sub}" (got "${hit ? hit.sub : 'missing'}")`);
  }
  await page.evaluate(() => window.BooTown.go('dash'));
  await page.waitForSelector('.picker');
  const dashTables = await page.$$eval('.picker-choice', els => els.map(n => ({
    name: (n.querySelector('.pc-name') || {}).textContent || '',
    sub: (n.querySelector('.pc-sub') || {}).textContent || ''
  })));
  assert(dashTables.some(c => c.name === 'Times tables' && c.sub === '7 × 8'), 'Boo Dash maths cards carry samples too');
  // Feed the Boos: grouped topics carry samples at Medium
  await page.evaluate(() => window.BooTown.State.mutate(s => { s.settings.content = 'medium'; }));
  await page.evaluate(() => window.BooTown.go('feedboos'));
  await page.waitForSelector('.picker');
  const feed = await page.$$eval('.picker-choice', els => els.map(n => ({
    name: (n.querySelector('.pc-name') || {}).textContent || '',
    sub: (n.querySelector('.pc-sub') || {}).textContent || ''
  })));
  const groups = feed.filter(c => !/Pick for me/.test(c.name));
  assert(groups.length > 0 && groups.every(c => c.sub.length > 0), 'every Feed topic card shows a sample');
  await ctx.close();
}

await browser.close();
console.log(failed ? '\nr4p2-picker: FAIL' : '\nr4p2-picker: ALL PASS');
process.exit(failed ? 1 : 0);
