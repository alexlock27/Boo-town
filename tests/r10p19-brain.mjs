// Focused RUN10 P19 check: pure generators, both play loops and non-judgemental Bloom.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { oddGrid, violatesOddPredicate, flashScene, flashQuestion, validateFlashQuestion } from '../js/attrengine.js';
import { bloomStats, persistBloomMax } from '../data/bloom.js';

let failed = false;
const ok = (condition, message) => {
  console.log(condition ? `  ✓ ${message}` : `  ✗ FAIL: ${message}`);
  if (!condition) failed = true;
};

console.log('== pure generators ==');
for (const tier of ['light', 'medium', 'full']) {
  let valid = true;
  for (let i = 0; i < 500; i++) {
    const grid = oddGrid(tier);
    const count = grid.items.filter(item => violatesOddPredicate(item, grid)).length;
    if (count !== 1 || grid.items.length !== ({ light:4, medium:9, full:12 })[tier]) { valid = false; break; }
  }
  ok(valid, `${tier}: 500 grids each have exactly one predicate violator`);
}
for (const tier of ['light', 'medium', 'full']) {
  let valid = true, genuineNear = true;
  for (let i = 0; i < 500; i++) {
    const scene = flashScene(tier), q = flashQuestion(scene);
    if (!validateFlashQuestion(scene, q)) { valid = false; break; }
    if (q.answerType === 'number' && q.answers.filter(x => x !== q.correct).some(x => Math.abs(x - q.correct) > 2)) genuineNear = false;
    if (q.template.includes('swing') && !scene.props.includes('swing')) valid = false;
    if (q.template.includes('bench') && !scene.props.includes('bench')) valid = false;
    if (q.template.includes('ball') && !scene.props.includes('ball')) valid = false;
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
const oddIndex = await page.evaluate(() => window.__oddboo.grid().oddIndex);
const wrongIndex = oddIndex === 0 ? 1 : 0;
await page.locator('.odd-choice').nth(wrongIndex).click();
ok(await page.locator('.odd-found').count() === 0 && await page.evaluate(() => window.__oddboo.round()) === 0, 'wrong tap wobbles kindly without revealing or advancing');
await page.screenshot({ path:'screenshots/r10p19/oddboo-390x844.png' });
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
