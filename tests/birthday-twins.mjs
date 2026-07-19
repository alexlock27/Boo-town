// Focused check for Twin1 & Twin2's saved Twin Party Garden.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { PARTY_CONFIG } from '../js/birthdayparty.js';

let failed = false;
const ok = (condition, message) => {
  console.log(condition ? `  ✓ ${message}` : `  ✗ FAIL: ${message}`);
  if (!condition) failed = true;
};
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
mkdirSync('screenshots/birthday-twins', {recursive:true});
const AREAS = Object.fromEntries(['meadow','riverside','hilltop','beach','funfair','playground','boohouse','gallery'].map(k => [k,{items:[],paths:[]}]));
const guests = ['boo_inky','boo_pippin','boo_plum','boo_wisp','boo_beam','boo_peppy','boo_bubbles','boo_minty'];
const seed = {
  version:11,name:'Ada',age:11,ageAsked:true,
  guide:{species:'giraffe',body:'sunshine',pattern:'spots',patternColour:'cocoa',eyes:'round',acc:'none',name:'Twiggy'},
  stars:{total:220,byGame:{}},inventory:Object.fromEntries(guests.map(id => [id,1])),
  town:{areas:AREAS},meter:0,boxes:0,opened:0,pity:{commons:0},nicknames:{},equips:{},catBest:{},ledger:{},
  care:{bonds:{},treats:0},bloom:{max:{}},wishes:{unlocked:{}},
  birthdayParty:{opened:{twin1:false,twin2:false},visits:0},
  settings:{sound:false,music:false,voice:false,content:'full'},seen:{trophyRetro:true},trophies:{},journal:{},delights:{}
};
const browser = await chromium.launch();
const context = await browser.newContext({viewport:{width:390,height:844}});
const page = await context.newPage();
page.on('pageerror', e => { failed=true; console.log('  ✗ PAGE ERROR:',e.message); });
await page.goto(`${BASE}/index.html`,{waitUntil:'load'});
await page.evaluate(value => localStorage.setItem('bootown.save.v1',JSON.stringify(value)),seed);
await page.reload({waitUntil:'load'});
await page.waitForSelector('.hub');

console.log('== Town-map entrance and two authored parties ==');
await page.evaluate(() => window.BooTown.go('worldmap'));
await page.waitForSelector('.map-birthday');
ok((await page.locator('.map-birthday').innerText()).includes('TWIN1') && (await page.locator('.map-birthday').innerText()).includes('TWIN2'), 'Town map has a prominent personalised Twin Party entrance');
await page.locator('.map-birthday').click();
await page.waitForFunction(() => window.__birthdayParty);
ok((await page.evaluate(() => window.__birthdayParty.names())).join('|') === 'TWIN1|TWIN2', 'two separate party areas carry the exact name marquees');
const candles = await page.evaluate(() => window.__birthdayParty.candleCounts());
ok(candles.twin1 === 11 && candles.twin2 === 11, 'each cake has exactly eleven lit candles');
const guestCounts = await page.evaluate(() => window.__birthdayParty.guestCounts());
ok(guestCounts.twin1 === 4 && guestCounts.twin2 === 4, 'each party has four individual Boo guests');
ok(await page.locator('.party-activity').count() === 6, 'each party has three clear replayable activities');
ok(PARTY_CONFIG.twin1.booId !== PARTY_CONFIG.twin2.booId && PARTY_CONFIG.twin1.colour !== PARTY_CONFIG.twin2.colour, 'the presents and visual themes are genuinely different');
await page.screenshot({path:'screenshots/birthday-twins/twin1-party-390x844.png'});

console.log('== celebration and Twin1 present ==');
await page.evaluate(() => window.__birthdayParty.celebrate('twin1'));
ok(await page.locator('.party-twin1.celebrating').count() === 1, 'Twin1 celebration starts lights, dancing and balloon release');
ok((await page.locator('.party-twin1 .party-balloon').first().evaluate(n => getComputedStyle(n).animationName)).includes('partyBalloon'), 'balloons use a visible release animation');
await page.locator('.party-twin1 .party-present').click();
await page.waitForSelector('.party-gift-overlay .gift-boo');
await page.waitForTimeout(250);
ok((await page.locator('.party-gift-overlay h2').innerText()) === 'Twin1 Starshine', 'Twin1 opens her unique Starshine Birthday Boo');
let saved = await page.evaluate(async () => (await import('./js/state.js')).getState());
ok(saved.inventory.boo_birthday_twin1 === 1 && saved.birthdayParty.opened.twin1, 'Twin1’s Boo is permanently saved into inventory');
await page.screenshot({path:'screenshots/birthday-twins/twin1-present-390x844.png'});
await page.locator('.party-gift-done').click();
for (const moment of ['dance','wish','balloons']) {
  await page.locator(`.party-twin1 .party-activity[data-moment="${moment}"]`).click();
}
ok(await page.locator('.party-twin1.party-complete').count() === 1 &&
   (await page.evaluate(() => window.__birthdayParty.moments().twin1)).length === 3,
   'Twin1 can complete a dance-off, cake wish and balloon burst after opening the present');

console.log('== Twin2 present and twin finale ==');
await page.evaluate(() => window.__birthdayParty.jump('twin2'));
await page.waitForTimeout(450);
await page.locator('.party-twin2 .party-present').click();
await page.waitForSelector('.party-gift-overlay .gift-boo');
await page.waitForTimeout(250);
ok((await page.locator('.party-gift-overlay h2').innerText()) === 'Twin2 Turbo', 'Twin2 opens his different Turbo Birthday Boo');
saved = await page.evaluate(async () => (await import('./js/state.js')).getState());
ok(saved.inventory.boo_birthday_twin2 === 1 && saved.birthdayParty.opened.twin2, 'Twin2’s Boo is permanently saved into inventory');
await page.screenshot({path:'screenshots/birthday-twins/twin2-present-390x844.png'});
await page.locator('.party-gift-done').click();
ok(await page.locator('.twin-finale.ready').count() === 1, 'opening both gifts unlocks the shared Twin Finale');
await page.locator('.twin-finale').click();
await page.waitForSelector('.twin-finale-card');
await page.waitForTimeout(250);
ok(await page.locator('.finale-boos svg').count() === 2, 'finale brings both distinct Birthday Boos together');
ok((await page.locator('.twin-finale-card h1').innerText()) === 'TWIN1 + TWIN2', 'finale keeps both twins equally central');
await page.screenshot({path:'screenshots/birthday-twins/twin-finale-390x844.png'});
await page.locator('.twin-finale-card .btn.soft').click();

console.log('== keepsakes appear outside the party ==');
await page.evaluate(() => window.BooTown.go('collection'));
await page.waitForSelector('.birthday-boos-section');
ok(await page.locator('.birthday-boos-grid .coll-tile').count() === 2, 'both keepsake Boos appear in a dedicated Collection section');
await page.evaluate(() => window.BooTown.go('town',{area:'meadow'}));
await page.waitForFunction(() => window.__townLife);
await page.waitForSelector('.town2');
await page.evaluate(() => window.__townLife.toggleBuild());
ok((await page.locator('.town-drawer .drawer-item[data-item^="boo_birthday_"]').count()) === 2, 'both Birthday Boos are placeable from the Town drawer');

await context.close();
await browser.close();
console.log(`\nRESULT: ${failed?'FAIL':'PASS'}`);
process.exit(failed?1:0);
