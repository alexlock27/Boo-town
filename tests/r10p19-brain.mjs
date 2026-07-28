// Focused RUN10 P19 check: pure generators, both play loops and non-judgemental Bloom.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { oddGrid, violatesOddPredicate, flashScene, flashQuestion, validateFlashQuestion, flashRelationHolds } from '../js/brainhelpers.js';
import { bloomStats, persistBloomMax } from '../data/bloom.js';

let failed = false;
const ok = (condition, message) => {
  console.log(condition ? `  ✓ ${message}` : `  ✗ FAIL: ${message}`);
  if (!condition) failed = true;
};

console.log('== pure generators ==');
// RUN12 S3 supersedes P19 here: 'shine' left the answer pool entirely (sparkle is
// decoration OR the answer, never ambiguously both), so the rotation is three features.
ok(['colour','hat','species'].every(feature => oddGrid('full', Math.random, {oddFeature:feature}).oddFeature === feature),
  'the live game can rotate all three visible answer features without repeats');
ok(oddGrid('full', Math.random, {oddFeature:'shine'}).oddFeature !== 'shine',
  'shine can no longer be requested as the odd feature');
// RUN12 S3 supersedes P19's "repeated visual families" design. P19 built 2-4 families so
// that incidental differences occurred in groups of 2+; in practice that meant every light
// grid carried an exact 2-2 split and every full grid carried three simultaneous 6-6 splits,
// so nothing was uniquely odd BY LOOKING. The spec of record is now: all non-odd items are
// identical on every feature, and exactly one differs on exactly one. This assertion is
// updated to the new contract rather than deleted; r12s3-oddboo proves it at 1000 grids.
for (const tier of ['light', 'medium', 'full']) {
  let valid = true, uniform = true;
  for (let i = 0; i < 500; i++) {
    const grid = oddGrid(tier);
    const count = grid.items.filter(item => violatesOddPredicate(item, grid)).length;
    if (count !== 1 || grid.items.length !== ({ light:4, medium:9, full:12 })[tier]) { valid = false; break; }
    const others = grid.items.filter((_, ix) => ix !== grid.oddIndex);
    const differing = ['colour','species','hat','shine'].filter(f => new Set(others.map(o => String(o[f]))).size > 1);
    const oddDiffs = ['colour','species','hat','shine'].filter(f => grid.items[grid.oddIndex][f] !== others[0][f]);
    if (differing.length !== 0 || oddDiffs.length !== 1 || oddDiffs[0] !== grid.oddFeature) { uniform = false; break; }
  }
  ok(valid && uniform, `${tier}: 500 grids are uniform except for exactly one item differing on exactly one feature`);
}
for (const tier of ['light', 'medium', 'full']) {
  let valid = true, genuineNear = true;
  for (let i = 0; i < 500; i++) {
    const scene = flashScene(tier), q = flashQuestion(scene);
    if (!validateFlashQuestion(scene, q)) { valid = false; break; }
    if (q.answerType === 'number' && q.answers.filter(x => x !== q.correct).some(x => Math.abs(x - q.correct) > 2)) genuineNear = false;
    // RUN18B Y4 rewrote these three: they matched the template STRING, which was only ever
    // a proxy for "is this prop in the picture" — and a proxy that reads 'balloon' as a
    // ball. The scene now states its own relations, so the check asks the scene itself.
    if (!flashRelationHolds(scene, q)) valid = false;
  }
  ok(valid && genuineNear, `${tier}: 500 Flash questions are answerable with genuine near-misses`);
}

console.log('== Bloom maths and no-shrink maximum ==');
{
  const now = Date.now();
  const state = {
    ledger: {
      'oddboo:colour': { rights: 4, misses: 1, lastSeen: now },
      'feedboos:sort': { rights: 3, misses: 0, lastSeen: now }
    },
    stars: { byGame: { oddboo: { plays: 10 }, feedboos: { plays: 5 } } },
    bloom: { max: {} }
  };
  const identify = bloomStats(state, now).find(x => x.id === 'identify');
  ok(identify.mastered === 2 && identify.plays === 15 && identify.growth === 7, 'growth = mastered×2 + plays×0.2 on a hand-calculated save');
  persistBloomMax(state);
  state.ledger = {}; state.stars.byGame = {};
  ok(bloomStats(state, now).find(x => x.id === 'identify').growth === 7, 'persisted petal maximum never shrinks when inputs fall');
}

console.log('== browser play and presentation ==');
mkdirSync('screenshots/r10p19', { recursive: true });
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const AREAS = Object.fromEntries(['meadow','riverside','hilltop','beach','funfair','playground','boohouse','gallery'].map(k => [k, { items: [], paths: [] }]));
const seed = {
  version: 9, name:'Ada', age:8, ageAsked:true,
  guide:{ species:'giraffe', body:'sunshine', pattern:'spots', patternColour:'cocoa', eyes:'round', acc:'none', name:'Twiggy' },
  stars:{ total:40, byGame:{ oddboo:{best:0,plays:4,earned:0}, flashboos:{best:0,plays:3,earned:0}, feedboos:{best:0,plays:2,earned:0} } },
  inventory:{}, town:{areas:AREAS}, meter:0, boxes:0, opened:0, pity:{commons:0}, nicknames:{}, equips:{}, catBest:{},
  ledger:{ 'oddboo:colour':{rights:4,misses:0,lastSeen:Date.now()} }, bloom:{max:{}}, care:{bonds:{},treats:0},
  settings:{sound:false,music:false,voice:false,content:'medium'}, seen:{introSeen:{oddboo:true,flashboos:true},trophyRetro:true},
  trophies:{},journal:{},delights:{}
};
const browser = await chromium.launch();
const context = await browser.newContext({ viewport:{width:390,height:844} });
const page = await context.newPage();
page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
await page.goto(`${BASE}/index.html`, { waitUntil:'load' });
await page.evaluate(value => localStorage.setItem('bootown.save.v1', JSON.stringify(value)), seed);
await page.reload({ waitUntil:'load' });

await page.evaluate(() => window.BooTown.go('oddboo'));
await page.waitForFunction(() => window.__oddboo);
ok(await page.locator('.odd-choice').count() === 9, 'medium Odd Boo Out presents a readable 9-Boo grid');
ok((await page.evaluate(() => window.__oddboo.violators())).length === 1, 'live grid exposes exactly one true violator');
// RUN12 S3 supersedes P19's live-grid shape too: "repeated distractor groups" is exactly
// the ambiguity that shipped. The live grid is now ONE repeated family plus one singleton.
ok(await page.evaluate(() => {
  const grid = window.__oddboo.grid();
  const others = grid.items.filter((_, ix) => ix !== grid.oddIndex);
  const singletonFeatures = ['colour','species','hat','shine'].filter(feature => {
    const counts = Object.values(grid.items.reduce((all, boo) => {
      const value = String(boo[feature]); all[value] = (all[value] || 0) + 1; return all;
    }, {}));
    return counts.includes(1);
  });
  const signatures = Object.values(grid.items.reduce((all, boo) => {
    const signature = ['colour','species','hat','shine'].map(feature => boo[feature]).join('|');
    all[signature] = (all[signature] || 0) + 1; return all;
  }, {}));
  const uniformOthers = ['colour','species','hat','shine'].every(f => new Set(others.map(o => String(o[f]))).size === 1);
  return singletonFeatures.length === 1 && singletonFeatures[0] === grid.oddFeature &&
    uniformOthers && signatures.filter(count => count > 1).length === 1;
}), 'the live puzzle is one uniform family plus exactly one singleton feature');
const oddIndex = await page.evaluate(() => window.__oddboo.grid().oddIndex);
const wrongIndex = oddIndex === 0 ? 1 : 0;
await page.locator('.odd-choice').nth(wrongIndex).click();
ok(await page.locator('.odd-found').count() === 0 && await page.evaluate(() => window.__oddboo.round()) === 0, 'wrong tap wobbles kindly without revealing or advancing');
await page.screenshot({ path:'screenshots/r10p19/oddboo-390x844.png' });
// A wrong tap deliberately locks the board for 1.5s and reshuffles (the anti-brute-force
// rule added to close audit finding F1-A: without it a child could tap all nine in
// seconds). P19 never promised a tap DURING that lockout registers, so wait it out — this
// is what a real player experiences — then tap the odd one.  (RUN11 Q8 / F-04.)
await page.waitForFunction(() => window.__oddboo.locked && window.__oddboo.locked() === false, null, { timeout: 5000 });
await page.locator('.odd-choice').nth(oddIndex).click();
await page.waitForFunction(() => window.__oddboo.round() === 1);

await page.evaluate(() => window.BooTown.go('flashboos'));
await page.waitForFunction(() => window.__flashboos);
ok((await page.evaluate(() => window.__flashboos.scene().boos.length)) === 5, 'medium Flash Boos shows five individual characters');
await page.evaluate(() => window.__flashboos.hide());
await page.waitForSelector('.flash-answer');
ok(await page.locator('.flash-answer').count() === 3, 'recall question offers three large picture answers');
const correct = await page.evaluate(() => window.__flashboos.question().correct);
await page.evaluate(answer => window.__flashboos.answer(answer), correct);
ok(await page.locator('.answer-ring').count() > 0 && !await page.locator('.flash-curtain').evaluate(n => n.classList.contains('down')), 'answer raises the curtain again and circles the evidence');
await page.waitForTimeout(650);
await page.screenshot({ path:'screenshots/r10p19/flashboos-390x844.png' });

await page.evaluate(() => window.BooTown.go('collection'));
await page.locator('.coll-tab').filter({ hasText:'Trophies' }).click();
await page.waitForSelector('.brain-bloom-card');
const childCopy = (await page.locator('.brain-bloom-card').innerText()).toLowerCase();
ok(await page.locator('.bloom-petal').count() === 5, 'Trophy Room flower has five independently grown petals');
ok(!/(struggling|weak|behind|poor|only)/.test(childCopy), 'child-facing Bloom copy contains no negative report-card language');
await page.screenshot({ path:'screenshots/r10p19/bloom-390x844.png' });

await page.evaluate(() => window.BooTown.go('grownups'));
await page.locator('.gu-tab[data-tab="bloom"]').click();
ok(await page.locator('.bloom-table .gl-row').count() === 5, 'Grown-ups Bloom tab gives one neutral row per petal');
ok(await page.locator('.bloom-report').getByText('Quiet lately').count() === 1, 'adult view states the quiet-lately list flatly');

await context.close();
await browser.close();
console.log(`\nRESULT: ${failed ? 'FAIL' : 'PASS'}`);
process.exit(failed ? 1 : 0);
