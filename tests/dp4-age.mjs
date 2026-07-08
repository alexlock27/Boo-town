// tests/dp4-age.mjs — DASH_PATCH follow-on job 4: the age-based content tier.
// Onboarding gains an age step (maps to Light/Medium/Full); existing saves get a one-time
// friendly ask (answer or skip, never again); grown-ups override always wins; the age step
// can never block onboarding (Light fallback on error).
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
mkdirSync('screenshots/dashpatch', { recursive: true });
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const errors = []; let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const OLD_SAVE = { version: 4, name: 'Ada', guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' }, inventory: { boo_inky: 1 }, boxes: 0, meter: 0, opened: 1, pity: { commons: 0 }, nicknames: {}, equips: {}, catBest: {}, town: [], stars: { total: 60, byGame: {} }, ledger: {}, settings: { sound: false, music: false, voice: false, content: 'medium' }, seen: { introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 } } };
// (no ageAsked key -> an "existing save" from before this update)

const browser = await chromium.launch();

async function fresh(vp) {
  const ctx = await browser.newContext({ viewport: vp || { width: 1024, height: 768 } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('PE ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(m.text()); });
  return { ctx, page };
}
async function onboardTo(page, ageLabel, shotTag) {
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await page.click('.ob-splash .btn');
  await page.fill('.text-input', 'Ivy');
  await page.click('.ob-name .btn');
  await page.waitForSelector('.ob-age-grid');
  if (shotTag) await page.screenshot({ path: `screenshots/dashpatch/age-step-${shotTag}.png` });
  await page.click(`.ob-age-btn:has-text("${ageLabel}")`);
  await page.waitForSelector('.creator');
  await page.click('.creator-btns .btn.big');            // Done with defaults
  await page.waitForSelector('.intro-block');
  for (let i = 0; i < 3; i++) { await page.click('.intro-block'); await sleep(140); }
  await page.waitForSelector('.firstpick-row');
  await page.click('.firstpick-card');
  await page.waitForSelector('.town2', { timeout: 5000 });   // first pick lands in the town
}

// ---- full onboarding with the age step at three sizes ----
console.log('== onboarding with age step (3 sizes) ==');
for (const [tag, vp] of [['tab-land', { width: 1000, height: 625 }], ['tab-port', { width: 625, height: 1000 }], ['phone', { width: 390, height: 844 }]]) {
  const { ctx, page } = await fresh(vp);
  await onboardTo(page, tag === 'tab-land' ? '8' : tag === 'tab-port' ? '5 or younger' : '12 and up', tag);
  const st = await page.evaluate(() => { const s = window.BooTown.State.getState(); return { age: s.age, asked: s.ageAsked, tier: s.settings.content }; });
  const expect = tag === 'tab-land' ? { age: 8, tier: 'medium' } : tag === 'tab-port' ? { age: 5, tier: 'light' } : { age: 12, tier: 'full' };
  assert(st.asked && st.age === expect.age && st.tier === expect.tier, `${tag}: onboarding completes; age ${st.age} -> ${st.tier} (expected ${expect.tier})`);
  await ctx.close();
}

// ---- every age maps to the right tier (mapping is the single shared function) ----
console.log('== age -> tier mapping ==');
{
  const { ctx, page } = await fresh();
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  const map = await page.evaluate(async () => { const m = await import('./js/content.js'); return m.AGE_CHOICES.map(c => [c.label, m.tierForAge(c.age)]); });
  const expect = { '5 or younger': 'light', 6: 'light', 7: 'light', 8: 'medium', 9: 'medium', 10: 'full', 11: 'full', '12 and up': 'full' };
  const allOk = map.every(([label, tier]) => expect[label] === tier);
  assert(allOk, 'all eight buttons map correctly: ' + map.map(m => m.join('→')).join(', '));
  await ctx.close();
}

// ---- safety: an age-step error falls back to Light and NEVER blocks onboarding ----
console.log('== safety fallback ==');
{
  const { ctx, page } = await fresh();
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await page.click('.ob-splash .btn');
  await page.fill('.text-input', 'Ivy');
  // poison createElement for exactly one call so the age step throws while rendering
  await page.evaluate(() => {
    const orig = document.createElement.bind(document);
    let armed = true;
    document.createElement = (t) => { if (armed) { armed = false; document.createElement = orig; throw new Error('test-poison'); } return orig(t); };
  });
  await page.click('.ob-name .btn');
  await page.waitForSelector('.creator', { timeout: 4000 });   // skipped straight to the creator
  await page.click('.creator-btns .btn.big');
  await page.waitForSelector('.intro-block');
  for (let i = 0; i < 3; i++) { await page.click('.intro-block'); await sleep(140); }
  await page.waitForSelector('.firstpick-row');
  await page.click('.firstpick-card');
  await page.waitForSelector('.town2', { timeout: 5000 });
  const st = await page.evaluate(() => { const s = window.BooTown.State.getState(); return { asked: s.ageAsked, tier: s.settings.content, age: s.age }; });
  assert(st.asked && st.tier === 'light' && st.age === 0, `a failed age step defaults to Light and onboarding continues (tier=${st.tier})`);
  await ctx.close();
}

// ---- existing save: one-time ask, ANSWERED path ----
console.log('== one-time ask (answered) ==');
{
  const { ctx, page } = await fresh();
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), OLD_SAVE);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');
  await page.waitForSelector('.age-card', { timeout: 3000 });
  await page.screenshot({ path: 'screenshots/dashpatch/age-onetime-card.png' });
  await page.click('.age-chip:has-text("10")');
  await sleep(250);
  const st = await page.evaluate(() => { const s = window.BooTown.State.getState(); return { age: s.age, asked: s.ageAsked, tier: s.settings.content, cardGone: !document.querySelector('.age-card') }; });
  assert(st.asked && st.age === 10 && st.tier === 'full' && st.cardGone, `answering sets the tier by mapping (10 -> ${st.tier}) and removes the card`);
  await page.reload({ waitUntil: 'load' }); await page.waitForSelector('.hub'); await sleep(300);
  assert(!(await page.$('.age-card')), 'it never asks again after answering');
  await ctx.close();
}

// ---- existing save: one-time ask, SKIPPED path (keeps the current tier) ----
console.log('== one-time ask (skipped) ==');
{
  const { ctx, page } = await fresh();
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), OLD_SAVE);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.age-card');
  await page.click('.age-skip');
  await sleep(250);
  const st = await page.evaluate(() => { const s = window.BooTown.State.getState(); return { asked: s.ageAsked, tier: s.settings.content, age: s.age }; });
  assert(st.asked && st.tier === 'medium' && st.age === 0, `skip keeps the current tier (${st.tier}) and sets the flag`);
  await page.reload({ waitUntil: 'load' }); await page.waitForSelector('.hub'); await sleep(300);
  assert(!(await page.$('.age-card')), 'it never asks again after skipping');

  // ---- the grown-ups override still wins after an age answer ----
  console.log('== grown-ups override wins ==');
  await page.evaluate(async () => { const m = await import('./js/content.js'); m.setContentTier('full'); });
  const tier2 = await page.evaluate(() => window.BooTown.State.getState().settings.content);
  assert(tier2 === 'full', 'the grown-ups setting overrides the age mapping');
  const hint = await page.evaluate(() => window.BooTown.go('grownups'));
  await page.waitForSelector('.gu-age-hint');
  const hintText = await page.$eval('.gu-age-hint', n => n.textContent);
  assert(/7 and under/.test(hintText) && /8–9|8-9/.test(hintText) && /10 and up/.test(hintText), 'the grown-ups corner shows the age-mapping hint');
  await ctx.close();
}

console.log('\n== errors ==');
if (errors.length) console.log(errors.map(e => '  ! ' + e).join('\n'));
assert(errors.length === 0, 'no unexpected JS console errors');
await browser.close();
console.log('\n' + (failed ? 'RESULT: FAIL' : 'RESULT: PASS'));
process.exit(failed ? 1 : 0);
