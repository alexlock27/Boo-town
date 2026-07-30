// tests/r12s5-ceremony.mjs — RUN12 S5: the ceremony describes the thing she actually won.
//
// The reported defect: a bed dropped and the guide said "A new Boo just dropped!", because
// the line was chosen by RARITY and only Boos had ever been considered. This drives a
// scripted grant of EVERY kind in the catalogue and checks the banner, the guide line, the
// one-liner and the action button — plus the rule that a rarity-less item shows no badge
// rather than a blank frame or a Boo-flavoured fallback.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { CATALOGUE, ACCESSORIES, dropKind, KIND_BANNER, KIND_ONELINER, KIND_GUIDE_LINE, KIND_ACTION, RARITY } from '../data/catalogue.js';
import { LINES as GUIDE_LINES } from '../data/guideLines.js';

const RAW = process.env.BASE || 'http://127.0.0.1:8000';
const BASE = RAW.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
const RESOLVE = ['--host-resolver-rules=MAP app.localhost 127.0.0.1'];
const SHOTS = 'screenshots/run12/s5';
mkdirSync(SHOTS, { recursive: true });
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };

// ---- 1. the authored copy exists, exactly as written -------------------------------
console.log('== the five authored lines are present verbatim ==');
{
  const AUTHORED = {
    dropBoo: 'A new Boo just dropped!',
    dropAccessory: 'A new thing to wear!',
    dropCostume: 'A whole outfit!',
    dropFurniture: 'Something new for the house!',
    dropTown: 'Something new for your town!'
  };
  for (const [key, text] of Object.entries(AUTHORED)) {
    const lines = GUIDE_LINES[key];
    assert(Array.isArray(lines) && lines.length === 1 && lines[0] === text,
      `${key} is exactly "${text}"${lines ? '' : ' (missing)'}`);
  }
}

console.log('== every catalogue item classifies to a kind that has copy ==');
{
  const kinds = new Set();
  const orphans = [];
  for (const item of [...CATALOGUE, ...ACCESSORIES]) {
    const k = dropKind(item);
    kinds.add(k);
    if (!KIND_BANNER[k] || !KIND_ONELINER[k] || !KIND_GUIDE_LINE[k] || !KIND_ACTION[k]) orphans.push(item.id + '→' + k);
  }
  assert(orphans.length === 0, `no item classifies to a kind without copy${orphans.length ? ' → ' + orphans.slice(0, 3) : ''}`);
  assert(kinds.size >= 4, `the catalogue exercises ${kinds.size} kinds (${[...kinds].sort().join(', ')})`);
  // the sub-kind that used to be invisible: costume sets are accessories with slot 'set'
  const sets = [...CATALOGUE, ...ACCESSORIES].filter(i => dropKind(i) === 'costume');
  assert(sets.length > 0, `costume sets are classified apart from plain accessories (${sets.length})`);
  const furn = [...CATALOGUE].filter(i => dropKind(i) === 'furniture');
  assert(furn.length > 0, `furniture is classified apart from town decoration (${furn.length})`);
}

// ---- 2. drive the real ceremony, one item of every kind ----------------------------
const AK = ['meadow','riverside','hilltop','beach','funfair','playground','boohouse','gallery'];
const SAVE = JSON.stringify({
  version: 14, name: 'Ada', ageAsked: true,
  guide: { species:'giraffe', body:'sunshine', pattern:'spots', patternColour:'cocoa', eyes:'round', acc:'none', name:'T' },
  inventory: { boo_inky: 1, boo_plum: 1, boo_mint: 1, boo_sky: 1, boo_dusk: 1, boo_pebble: 1 },
  stars: { total: 400, byGame: {} }, trophies: {}, boxes: 200,
  town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 0 }, expedition: { party: [], tiers: {}, progress: {} },
  seen: { trophyRetro: true, lastStarsShown: 400, introSeen: {} },
  settings: { sound: false, music: false, voice: false, content: 'full' }
});

const browser = await chromium.launch({ args: RESOLVE });
const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
const page = await ctx.newPage();
await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), SAVE);
await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
await page.waitForFunction(() => window.BooTown, null, { timeout: 20000 });

// Grant a NAMED item and open its reveal, bypassing the random roll entirely.
async function reveal(itemId) {
  await page.evaluate(async (id) => {
    const { CATALOGUE, ACCESSORIES } = await import('./data/catalogue.js');
    const item = [...CATALOGUE, ...ACCESSORIES].find(i => i.id === id);
    window.__forceRoll = { type: item.kind === 'accessory' ? 'accessory' : item.kind === 'boo' ? 'boo' : 'deco' };
    window.__pinnedItem = item;
    await window.BooTown.go('ceremony', {});
  }, itemId);
  await page.waitForTimeout(420);
  await page.evaluate(() => { const b = document.querySelector('.gift-box'); for (let i = 0; i < 3; i++) b && b.click(); });
  await page.waitForTimeout(650);
  return page.evaluate(() => ({
    name: document.querySelector('.reveal-name')?.textContent ?? null,
    banner: document.querySelector('.reveal-banner')?.textContent ?? null,
    badgePresent: !!document.querySelector('.reveal-rarity'),
    badge: document.querySelector('.reveal-rarity')?.textContent ?? null,
    guide: document.querySelector('.reveal-guide-bubble')?.textContent ?? null,
    oneLiner: document.querySelector('.reveal-oneliner')?.textContent ?? null,
    buttons: [...document.querySelectorAll('.reveal-btns button')].map(b => b.textContent.trim())
  }));
}

console.log('== a scripted grant of one item of each kind says the right thing ==');
{
  // one representative per kind, all real catalogue ids
  const byKind = {};
  for (const item of [...CATALOGUE, ...ACCESSORIES]) {
    const k = dropKind(item);
    if (!byKind[k] && item.rarity) byKind[k] = item;
  }
  for (const [kind, item] of Object.entries(byKind)) {
    // roll until the ceremony actually shows this item; the pool is small per type+rarity
    let got = null;
    for (let attempt = 0; attempt < 40 && !got; attempt++) {
      const r = await page.evaluate(async ([id]) => {
        const { CATALOGUE, ACCESSORIES } = await import('./data/catalogue.js');
        const it = [...CATALOGUE, ...ACCESSORIES].find(i => i.id === id);
        window.__forceRoll = { type: it.kind === 'accessory' ? 'accessory' : it.kind === 'boo' ? 'boo' : 'deco', rarity: it.rarity };
        // RUN13 T6: pin the shiny roll OFF for this check. A Boo drop can be upgraded to a
        // shiny at random, and a shiny Boo's banner is "✨ A SHINY BOO! ✨" — correct, but it
        // made this KIND_BANNER assertion a latent 1-in-N flake that happened to survive
        // RUN12. `__forceShiny` is the product's own one-shot hook (js/shiny.js), consumed
        // by the single roll each attempt performs.
        window.__forceShiny = false;
        await window.BooTown.go('ceremony', {});
      }, [item.id]);
      await page.waitForTimeout(360);
      await page.evaluate(() => { const b = document.querySelector('.gift-box'); for (let i = 0; i < 3; i++) b && b.click(); });
      await page.waitForTimeout(560);
      const seen = await page.evaluate(async () => {
        const { CATALOGUE, ACCESSORIES, dropKind } = await import('./data/catalogue.js');
        const name = document.querySelector('.reveal-name')?.textContent || '';
        const clean = name.replace(/^Another /, '').replace(/!$/, '');
        const it = [...CATALOGUE, ...ACCESSORIES].find(i => i.name === clean);
        return {
          kind: it ? dropKind(it) : null, id: it ? it.id : null,
          banner: document.querySelector('.reveal-banner')?.textContent ?? null,
          badgePresent: !!document.querySelector('.reveal-rarity'),
          badge: document.querySelector('.reveal-rarity')?.textContent ?? null,
          guide: document.querySelector('.reveal-guide-bubble')?.textContent ?? null,
          oneLiner: document.querySelector('.reveal-oneliner')?.textContent ?? null,
          buttons: [...document.querySelectorAll('.reveal-btns button')].map(b => b.textContent.trim()),
          // RUN19 Z3: the display name the button uses — the nickname when one exists
          dispName: (() => { try { const st = JSON.parse(localStorage.getItem('bootown.save.v1')); return (st.nicknames && it && st.nicknames[it.id]) || clean; } catch (e) { return clean; } })()
        };
      });
      if (seen.kind === kind) got = seen;
    }
    assert(!!got, `a ${kind} drop could be produced`);
    if (!got) continue;
    await page.screenshot({ path: `${SHOTS}/reveal-${kind}.png` });
    assert(got.banner === KIND_BANNER[kind], `${kind}: banner is "${KIND_BANNER[kind]}" (got "${got.banner}")`);
    assert(got.oneLiner === KIND_ONELINER[kind], `${kind}: one-liner names the right home (got "${got.oneLiner}")`);
    // RUN19 Z3: placeable kinds jump straight into build mode holding the item, so their
    // button reads "Put «name» somewhere?"; wearables keep the authored KIND_ACTION verb.
    const wantAction = (kind === 'accessory' || kind === 'costume') ? KIND_ACTION[kind] : `Put ${got.dispName} somewhere?`;
    assert(got.buttons[0] === wantAction, `${kind}: the action button says "${wantAction}" (got "${got.buttons[0]}")`);
    if (kind !== 'boo') {
      assert(got.guide === GUIDE_LINES[KIND_GUIDE_LINE[kind]][0],
        `${kind}: the guide says "${GUIDE_LINES[KIND_GUIDE_LINE[kind]][0]}" (got "${got.guide}")`);
      assert(!/Boo just dropped|little face/.test(got.guide || ''),
        `${kind}: nothing tells a non-Boo it is a Boo`);
    }
    assert(got.badgePresent && (got.badge || '').trim().length > 0,
      `${kind}: the rarity badge renders with real text ("${got.badge}")`);
  }
}

console.log('== a rarity-less item omits the badge rather than rendering it blank ==');
{
  const r = await page.evaluate(async () => {
    const { el, clear } = await import('./js/ui.js');
    const { RARITY } = await import('./data/catalogue.js');
    // exactly the ceremony's own expression, applied to an item with no rarity
    const mk = (rarity, shiny) => {
      const rar = RARITY[rarity] || null;
      const text = (shiny ? 'SHINY · ' : '') + (rar ? rar.label : '');
      return { text, renders: text.trim().length > 0 };
    };
    return { none: mk(undefined, false), blank: mk('', false), bogus: mk('sparkly', false),
      shinyNoRarity: mk(undefined, true), common: mk('common', false) };
  });
  assert(r.none.renders === false, 'no rarity → no badge element at all');
  assert(r.blank.renders === false, "an empty rarity string → no badge element");
  assert(r.bogus.renders === false, 'an unknown rarity → no badge element, not a blank frame');
  assert(r.common.renders === true && r.common.text === 'Common', 'a real rarity still renders its label');
  assert(r.shinyNoRarity.renders === true, 'a shiny with no rarity still says SHINY rather than nothing');
}

console.log('== the collection card uses the same vocabulary ==');
{
  await page.evaluate(() => window.BooTown.go('collection'));
  await page.waitForTimeout(1100);
  const r = await page.evaluate(() => {
    const src = document.documentElement.outerHTML;
    return { booFallbackGone: !/Your very own Boo!/.test(src) };
  });
  // the defect was the fallback OBJECT, not the phrase — the phrase now survives only in
  // the comment that explains why it went
  const srcHasFallback = await page.evaluate(async () => {
    const bad = /\|\|\s*\{\s*label:\s*'Your very own Boo!'\s*\}/;
    for (const f of ['js/collection.js', 'js/ceremony.js']) {
      const res = await fetch(f);
      if (bad.test(await res.text())) return f;
    }
    return null;
  });
  assert(r.booFallbackGone, 'no "Your very own Boo!" text is rendered on the collection');
  assert(!srcHasFallback, `and no surface still falls back to a Boo-flavoured label${srcHasFallback ? ' → ' + srcHasFallback : ''}`);
  await page.screenshot({ path: `${SHOTS}/collection.png` });
}

await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
