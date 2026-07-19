// Focused RUN10 P20 check: exact lexicon, magic loop, miss kindness and Build unlocks.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { WISH_WORDS, nearestWish, levenshtein } from '../data/wishes.js';

let failed = false;
const ok = (condition, message) => {
  console.log(condition ? `  ✓ ${message}` : `  ✗ FAIL: ${message}`);
  if (!condition) failed = true;
};
console.log('== lexicon and nearest-word unit ==');
ok(WISH_WORDS.length === 60 && new Set(WISH_WORDS).size === 60, 'lexicon contains exactly 60 unique authored words');
ok(nearestWish('stsr') === 'star' && levenshtein('stsr','star') === 1, 'Levenshtein picker finds a distance-one wish');
ok(nearestWish('buterfly') === 'butterfly', 'nearest picker supports the lexicon’s nine-letter butterfly');

mkdirSync('screenshots/r10p20', { recursive:true });
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const AREAS = Object.fromEntries(['meadow','riverside','hilltop','beach','funfair','playground','boohouse','gallery'].map(k => [k, { items:[], paths:[] }]));
AREAS.meadow.items.push({zone:'meadow',x:.58,row:1,item:'deco_pond'});
const seed = {
  version:10,name:'Ada',age:8,ageAsked:true,
  guide:{species:'giraffe',body:'sunshine',pattern:'spots',patternColour:'cocoa',eyes:'round',acc:'none',name:'Twiggy'},
  stars:{total:30,byGame:{}},inventory:{deco_pond:1},town:{areas:AREAS},meter:0,boxes:0,opened:0,pity:{commons:0},
  nicknames:{},equips:{},catBest:{},ledger:{keep:{rights:2,misses:1,lastSeen:123}},care:{bonds:{},treats:0},
  bloom:{max:{}},wishes:{unlocked:{}},settings:{sound:false,music:false,voice:false,content:'medium'},
  seen:{trophyRetro:true},trophies:{},journal:{},delights:{}
};
const browser = await chromium.launch();
const context = await browser.newContext({viewport:{width:390,height:844}});
const page = await context.newPage();
page.on('pageerror', e => { failed=true; console.log('  ✗ PAGE ERROR:',e.message); });
await page.goto(`${BASE}/index.html`, {waitUntil:'load'});
await page.evaluate(value => localStorage.setItem('bootown.save.v1',JSON.stringify(value)), seed);
await page.reload({waitUntil:'load'});
await page.waitForSelector('.hub');
await page.evaluate(() => window.BooTown.go('town',{area:'meadow'}));
await page.waitForFunction(() => window.__townLife);
await page.waitForSelector('.t-item[data-item="deco_wishwell"]');

console.log('== Meadow, spelling tray and miss flow ==');
ok(await page.locator('.t-item[data-item="deco_wishwell"]').count() === 1, 'one Wish Well is pre-placed in the Meadow');
await page.evaluate(() => window.__townLife.openWishWell());
await page.waitForFunction(() => window.__wishwell);
ok(await page.evaluate(() => window.__wishwell.usesDrawer()), 'letter tray uses the shared createDrawer component');
ok((await page.evaluate(() => window.__wishwell.suggestions())).length === 0, 'medium tier does not show short-word suggestion chips');
await page.evaluate(() => { for (const ch of 'moon') window.__wishwell.type(ch); });
await page.screenshot({path:'screenshots/r10p20/wishwell-390x844.png'});
await page.evaluate(() => window.__wishwell.spell('zzzz'));
await page.evaluate(() => window.__wishwell.spell('stsr'));
ok((await page.evaluate(() => window.__wishwell.hint())) === 'STAR', 'second miss ghosts the nearest word to copy');

const ledgerBefore = await page.evaluate(async () => JSON.stringify((await import('./js/state.js')).getState().ledger));
await page.evaluate(() => window.__wishwell.spellInstant('star'));
ok(await page.locator('.wish-town-spawn[data-word="star"]').count() === 1, 'a correct wish POOFs beside the well');
ok((await page.evaluate(() => window.__wishwell.unlocked())).star === true, 'first correct spelling permanently unlocks its Build item');
ok(await page.locator('.boo-toast.wish-toast').count() === 1, 'first unlock shows one drawer toast');
await page.evaluate(() => window.__wishwell.spellInstant('star'));
ok(await page.locator('.boo-toast.wish-toast').count() === 1, 'repeating the same wish never repeats its unlock toast');
await page.evaluate(() => window.__wishwell.close());
await page.waitForTimeout(250);
ok(await page.locator('#screen').getAttribute('data-screen') === 'town', 'closing the well returns to the same Meadow scene');
await page.screenshot({path:'screenshots/r10p20/meadow-wish-390x844.png'});
await page.evaluate(() => window.__townLife.openWishWell());
await page.waitForFunction(() => window.__wishwell);

console.log('== all words, living wishes and fuzz safety ==');
await page.evaluate(words => words.forEach(word => window.__wishwell.spellInstant(word)), WISH_WORDS);
ok(Object.keys(await page.evaluate(() => window.__wishwell.unlocked())).length === 60, 'all 60 words spell, poof and unlock exactly one Build entry each');
const living = await page.evaluate(() => window.__townLife.wishSpawns().filter(x => ['butterfly','fish','frog'].includes(x.word)));
ok(living.some(x => x.word === 'butterfly' && x.animation.includes('wishButterfly')), 'butterfly has its three-second flutter-away frames');
ok(living.some(x => x.word === 'fish' && x.cls.includes('fish-to-pond') && x.animation.includes('wishFishPond')), 'fish hops toward the nearest pond and splashes');
ok(living.some(x => x.word === 'frog' && x.animation.includes('wishFrog')), 'frog has its two-boing animation');
const fuzz = Array.from({length:200},(_,i) => `qz${i.toString(36)}x`.slice(0,8)).filter(x => !WISH_WORDS.includes(x));
const fuzzClean = await page.evaluate(values => {
  try { values.forEach(value => window.__wishwell.spell(value)); return true; } catch { return false; }
}, fuzz);
ok(fuzzClean, '200 non-lexicon strings hum without crashes or rejection walls');
const ledgerAfter = await page.evaluate(async () => JSON.stringify((await import('./js/state.js')).getState().ledger));
ok(ledgerAfter === ledgerBefore, 'Wish Well makes no learning-ledger writes');

await page.evaluate(() => window.__wishwell.close());
await page.waitForTimeout(250);
await page.evaluate(() => window.__townLife.toggleBuild());
ok((await page.evaluate(() => window.__townLife.drawerTabs())).some(text => text.startsWith('Wishes (60)')), 'Build mode reveals a Wishes tab with all unlocked items');

console.log('== Light-tier suggestions ==');
await page.evaluate(async () => { const {mutate}=await import('./js/state.js'); mutate(s => s.settings.content='light'); window.__townLife.openWishWell(); });
await page.waitForFunction(() => window.__wishwell);
const suggestions = await page.evaluate(() => window.__wishwell.suggestions());
ok(suggestions.length > 0 && suggestions.every(word => word.length <= 4), 'Light tier glows only short-word suggestion chips');
await page.evaluate(() => window.__wishwell.close());

await context.close();
await browser.close();
console.log(`\nRESULT: ${failed ? 'FAIL' : 'PASS'}`);
process.exit(failed ? 1 : 0);
