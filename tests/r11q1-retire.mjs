// tests/r11q1-retire.mjs — RUN11 Q1: the party feature is retired, its two earned Boos
// live on as neutral gift Boos, and the v12→v13 migration is lossless. (Replaces the old
// birthday-twins suite, which tested a feature the maintainer has since retired — G5.)
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();
page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });

console.log('== the retired route 404s to the hub gracefully ==');
{
  await page.addInitScript(() => localStorage.setItem('bootown.save.v1', JSON.stringify({ version: 13, name: 'Ada', ageAsked: true, guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' }, inventory: {}, stars: { total: 10, byGame: {} }, town: { areas: {} }, care: { bonds: {}, treats: 0 }, settings: { sound: false, music: false, voice: false, content: 'full' } })));
  await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
  await page.waitForSelector('.hub', { timeout: 8000 });
  await page.evaluate(() => window.BooTown.go('birthdayparty'));
  await page.waitForTimeout(400);
  const screen = await page.evaluate(() => document.getElementById('screen').dataset.screen);
  const hasHub = await page.locator('.hub').count();
  assert(screen === 'hub' && hasHub === 1, 'navigating to the retired route lands on the hub, no broken screen');
}

console.log('== the two earned Boos are renamed to neutral gift ids with art intact ==');
{
  const r = await page.evaluate(async () => {
    const cat = await import('./data/catalogue.js');
    const a = cat.BY_ID['boo_party_gift_a'], b = cat.BY_ID['boo_party_gift_b'];
    return {
      a, b,
      oldGone: !Object.keys(cat.BY_ID).some(id => id.startsWith('boo_birthday_')),
      inGiftList: cat.BIRTHDAY_BOOS.map(x => x.id).sort().join(',')
    };
  });
  assert(r.a && r.a.name === 'Confetti' && r.b && r.b.name === 'Ribbon', 'neutral names: Confetti + Ribbon');
  assert(r.oldGone, 'the old name-bearing ids are gone from the catalogue');
  assert(r.a.species === 'nova' && r.a.acc === 'goldcrown' && r.a.fx === 'twinkle', 'gift A keeps its original art');
  assert(r.b.species === 'zippy' && r.b.acc === 'djheadphones' && r.b.fx === 'shimmer', 'gift B keeps its original art');
  assert(r.inGiftList === 'boo_party_gift_a,boo_party_gift_b', 'both stay in the free gift list (out of boxes / count)');
}

console.log('== v12→v13 migration is lossless: a two-Boo save keeps ownership, shiny, bond ==');
{
  const r = await page.evaluate(async () => {
    const st = await import('./js/state.js');
    // Legacy ids share the prefix boo_birthday_*; the migration remaps by sorted suffix,
    // so name-free suffixes (one < two → gift_a, gift_b) exercise the same path (G9: no
    // retired name may appear even in a test fixture).
    const v12 = {
      version: 12, name: 'Ada',
      inventory: { boo_birthday_one: 1, boo_birthday_two: 1, boo_pip: 3 },
      shinies: { boo_birthday_one: 1 },
      nicknames: { boo_birthday_two: 'Speedy' },
      equips: { boo_birthday_one: { hat: 'acc_sunhat' } },
      care: { bonds: { boo_birthday_two: 45 }, treats: 2 },
      birthdayParty: { opened: { first: true, second: false }, visits: 3 },
      stars: { total: 90, byGame: {} }
    };
    const m = st.migrate(structuredClone(v12));
    return {
      version: m.version, current: st.VERSION,
      ownsBoth: m.inventory['boo_party_gift_a'] === 1 && m.inventory['boo_party_gift_b'] === 1,
      oldGone: !Object.keys(m.inventory).some(k => k.startsWith('boo_birthday_')),
      shinyKept: m.shinies['boo_party_gift_a'] === 1,
      nickKept: m.nicknames['boo_party_gift_b'] === 'Speedy',
      equipKept: m.equips['boo_party_gift_a'] && m.equips['boo_party_gift_a'].hat === 'acc_sunhat',
      bondKept: m.care.bonds['boo_party_gift_b'] === 45,
      otherKept: m.inventory['boo_pip'] === 3 && m.stars.total === 90,
      archivedFlag: m.partyGiftArchived === true,
      partyGone: !('birthdayParty' in m)
    };
  });
  assert(r.version === r.current, `migrates to the current VERSION (${r.version})`);
  assert(r.ownsBoth && r.oldGone, 'both Boos are owned under the new ids; old ids are gone');
  assert(r.shinyKept, 'shiny state carried to the new id');
  assert(r.nickKept, 'nickname carried to the new id');
  assert(r.equipKept, 'worn accessory carried to the new id');
  assert(r.bondKept, 'bond level carried to the new id');
  assert(r.otherKept, 'unrelated inventory + stars untouched');
  assert(r.archivedFlag, 'old party-opened state folded into the neutral archived flag');
  assert(r.partyGone, 'the retired birthdayParty sub-object is dropped');
}

await browser.close();
console.log('RESULT: ' + (failed ? 'FAIL' : 'PASS'));
process.exit(failed ? 1 : 0);
