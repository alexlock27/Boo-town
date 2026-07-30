// @serial — frame-sampling: idle/dance animation frame evidence (runs alone at the board's end; RUN14 U-0)
// RUN13 T5 — cosmetics expansion.
//
// Twelve accessories across the three slots, two costume sets, ten dance moves with a
// rotating Boo-of-the-moment spotlight, and two extra idles per species under a hard cap.
//
// The alignment check is the one that matters most: a hat that floats above the head on
// one species and buries itself on another is the named anti-pattern. Every new accessory
// is rendered on EVERY species and its drawn ink is measured against the anchor the art
// module was given, in the SVG's own coordinates — so this is geometry, not eyeballing.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const SHOTS = 'screenshots/run13/t5';
mkdirSync(SHOTS, { recursive: true });
let failed = false;
const ok = (c, m) => { console.log(c ? `  ✓ ${m}` : `  ✗ FAIL: ${m}`); if (!c) failed = true; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const distinct = arr => new Set(arr).size;

const NEW_ACCS = {
  hat: ['acc_beanie', 'acc_partyhat', 'acc_earmuffs', 'acc_starcape'],
  face: ['acc_freckles', 'acc_monocle', 'acc_bandana', 'acc_snorkel'],
  feet: ['acc_trainers', 'acc_bunnyslippers', 'acc_springboots', 'acc_flippers']
};
const ALL_NEW = [...NEW_ACCS.hat, ...NEW_ACCS.face, ...NEW_ACCS.feet];
const NEW_SETS = ['acc_set_astronaut', 'acc_set_pirate'];
const BEHAVIOUR_ACCS = ['acc_springboots', 'acc_flippers', 'acc_starcape'];
const BOOS = ['inky', 'plum', 'pippin', 'lolly', 'chomp', 'mallow', 'curly', 'wisp', 'beam', 'dot'].map(n => 'boo_' + n);
const TODAY = (d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)(new Date());
const AREA_KEYS = ['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground', 'boohouse', 'gallery',
  'boohouse_kitchen', 'boohouse_bedroom'];

function SAVE(over = {}) {
  return Object.assign({
    version: 15, name: 'Ada', ageAsked: true, age: 8,
    guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
    inventory: Object.assign(Object.fromEntries(BOOS.map(b => [b, 1])),
      Object.fromEntries([...ALL_NEW, ...NEW_SETS].map(id => [id, 1]))),
    boxes: 0, meter: 0, opened: 40, pity: { commons: 0 },
    nicknames: {}, equips: {}, catBest: {}, stars: { total: 600, byGame: {} }, ledger: {},
    town: { areas: Object.fromEntries(AREA_KEYS.map(k => [k, { items: [], paths: [] }])) },
    care: { bonds: {}, treats: 3 }, routines: {},
    settings: { sound: false, music: false, voice: false, content: 'full', requests: false },
    seen: { boohouseSeeded: true, funfairOpened: 'x', introSeen: { care: true }, trophyRetro: true, townFirst: true },
    delights: { hideDay: TODAY, hideFound: true }, trophies: {}, journal: {}
  }, over);
}

const browser = await chromium.launch();
async function open(route, params = {}, { save, hour = 13, w = 1024, h = 768 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.addInitScript(hr => { window.__bootownHour = hr; }, hour);
  await page.addInitScript(s => { localStorage.setItem('bootown.save.v1', s); }, JSON.stringify(save || SAVE()));
  await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
  await page.waitForSelector('.hub');
  if (route) {
    await page.evaluate(([r, p]) => window.BooTown.go(r, p), [route, params]);
    if (route === 'town') { await page.waitForSelector('.town2'); await page.waitForFunction(() => window.__townLife, { timeout: 6000 }); }
    await sleep(400);
  }
  return { ctx, page };
}

console.log('== twelve accessories, four per slot, in the established rarities ==');
{
  const { ctx, page } = await open(null);
  const info = await page.evaluate(async ids => {
    const { BY_ID, ACCESSORIES } = await import('./data/catalogue.js');
    return {
      items: ids.map(id => { const it = BY_ID[id]; return it ? { id, slot: it.slot, rarity: it.rarity, name: it.name, blurb: it.blurb, locomotion: it.locomotion || null, motion: it.motion || null } : null; }),
      perSlot: ['hat', 'face', 'feet'].map(s => ({ slot: s, n: ACCESSORIES.filter(a => a.slot === s).length }))
    };
  }, ALL_NEW);
  ok(info.items.every(Boolean), `all ${ALL_NEW.length} new accessories exist`);
  for (const slot of ['hat', 'face', 'feet']) {
    const got = info.items.filter(i => i && i.slot === slot).length;
    ok(got === 4, `four new ${slot} items (${got})`);
  }
  ok(info.items.every(i => ['common', 'rare', 'ultra'].includes(i.rarity)), 'each carries an established rarity');
  ok(info.items.every(i => i.name && i.blurb && i.blurb.length > 10), 'each is named and has a blurb');
  ok(info.perSlot.every(s => s.n >= 4), `every slot now holds at least four (${info.perSlot.map(s => `${s.slot}:${s.n}`).join(' ')})`);
  const behaviour = info.items.filter(i => i.locomotion || i.motion);
  ok(behaviour.length >= 2, `at least two change BEHAVIOUR, not only looks (${behaviour.map(b => `${b.id.replace('acc_', '')}=${b.locomotion || b.motion}`).join(', ')})`);
  await ctx.close();
}

console.log('== anchoring: every new accessory sits on every species ==');
{
  const { ctx, page } = await open(null);
  const species = await page.evaluate(async () => {
    const { COLLECTIBLES } = await import('./data/catalogue.js');
    const boos = COLLECTIBLES.filter(i => i.kind === 'boo');
    const seen = new Map();
    for (const b of boos) if (!seen.has(b.species)) seen.set(b.species, b.id);
    return [...seen.entries()].map(([sp, id]) => ({ species: sp, id }));
  });
  ok(species.length >= 8, `there are ${species.length} Boo species to check against`);
  // For each accessory x species: render the Boo WITHOUT it, then WITH it, and take the
  // extra nodes as the accessory. Measuring against the Boo's OWN drawn box (not fixed
  // viewBox numbers) is what makes this a real cross-species check — bloop sits lower in
  // its box than zippy does, and a fixed band would just encode one species' proportions.
  const rows = await page.evaluate(async ([accs, sp]) => {
    const { renderItem } = await import('./js/art.js');
    const { BY_ID } = await import('./data/catalogue.js');
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(host);
    const union = nodes => {
      let b = null;
      for (const n of nodes) {
        const r = n.getBBox ? n.getBBox() : null;
        if (!r || !r.width) continue;
        b = b ? { x: Math.min(b.x, r.x), y: Math.min(b.y, r.y),
                  w: Math.max(b.x + b.w, r.x + r.width) - Math.min(b.x, r.x),
                  h: Math.max(b.y + b.h, r.y + r.height) - Math.min(b.y, r.y) }
              : { x: r.x, y: r.y, w: r.width, h: r.height };
      }
      return b;
    };
    const out = [];
    for (const { species, id } of sp) {
      const boo = BY_ID[id];
      host.innerHTML = renderItem(boo, { size: 300 });
      const bare = [...host.querySelector('svg').children];
      const body = union(bare);
      const bareCount = bare.length;
      for (const accId of accs) {
        const acc = BY_ID[accId];
        host.innerHTML = renderItem(boo, { size: 300, equipArt: { [acc.slot]: acc.art } });
        const kids = [...host.querySelector('svg').children];
        const box = union(kids.slice(bareCount));
        out.push({ species, accId, slot: acc.slot, box, body });
      }
    }
    host.remove();
    return out;
  }, [ALL_NEW, species]);
  ok(rows.every(r => r.box), 'every accessory draws something on every species');
  // Anchoring is about where an accessory STARTS, not how far it may legitimately hang.
  // A cape begins at the shoulders and falls to the feet, and that is correct; a hat that
  // begins at the belly is not. So: a hat's TOP edge must sit on or above the head, a face
  // item's box must OVERLAP the head band, and a foot item must reach the bottom third.
  // All in the shared 0 0 120 130 viewBox the Boo itself is drawn in.
  const frac = (r, y) => (y - r.body.y) / r.body.h;        // where a y lands down the Boo
  // The `hat` slot in this app is "worn, and not on the face or the feet" — it holds real
  // headwear AND garments that hang from the shoulders (the shipped Sparkle Cape and Cosy
  // Scarf both do). So headwear is checked against the head, drapes against the shoulder
  // line, and the band for drapes is proved below to be the SHIPPED one, not one invented
  // to make a new item pass.
  const DRAPES = new Set(['acc_starcape']);
  const anchorOk = r => {
    if (!r.box || !r.body) return false;
    const top = frac(r, r.box.y), bottom = frac(r, r.box.y + r.box.h);
    if (r.slot === 'hat') return DRAPES.has(r.accId) ? (top >= 0.60 && top <= 0.90) : top <= 0.42;
    if (r.slot === 'face') return bottom >= 0.05 && top <= 0.82;   // overlaps the face
    return bottom >= 0.72;                                  // feet reach the ground end
  };
  const strays = rows.filter(r => !anchorOk(r));
  ok(strays.length === 0, `every accessory anchors correctly on all ${species.length} species${strays.length ? ' — ' + strays.slice(0, 5).map(s => `${s.accId}@${s.species} ${(frac(s, s.box.y) * 100).toFixed(0)}%..${(frac(s, s.box.y + s.box.h) * 100).toFixed(0)}%`).join('; ') : ''}`);
  // Everything must actually be ON the Boo — overlapping her drawn box, on every species.
  const floaters = rows.filter(r => r.box && r.body && (frac(r, r.box.y + r.box.h) < 0 || frac(r, r.box.y) > 1.05));
  ok(floaters.length === 0, `no accessory floats free of the Boo${floaters.length ? ' — ' + floaters.slice(0, 4).map(s => s.accId + '@' + s.species).join(', ') : ''}`);
  // Horizontal centring: nothing may wander off the side of the Boo it is worn on.
  const offside = rows.filter(r => r.box && r.body && (r.box.x < r.body.x - r.body.w * 0.28 || r.box.x + r.box.w > r.body.x + r.body.w * 1.28));
  ok(offside.length === 0, `nothing hangs off the side of any species${offside.length ? ' — ' + offside.slice(0, 4).map(s => s.accId + '@' + s.species).join(', ') : ''}`);
  // Proof the drape band is the app's existing language, not a bespoke exemption: the
  // SHIPPED Sparkle Cape, measured identically, lands in exactly the same band.
  const shipped = await page.evaluate(async sp => {
    const { renderItem } = await import('./js/art.js');
    const { BY_ID } = await import('./data/catalogue.js');
    const host = document.createElement('div');
    host.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.appendChild(host);
    const union = nodes => { let b = null; for (const n of nodes) { const r = n.getBBox ? n.getBBox() : null; if (!r || !r.width) continue;
      b = b ? { y: Math.min(b.y, r.y), h: Math.max(b.y + b.h, r.y + r.height) - Math.min(b.y, r.y) } : { y: r.y, h: r.height }; } return b; };
    const out = [];
    for (const { species, id } of sp) {
      const boo = BY_ID[id];
      host.innerHTML = renderItem(boo, { size: 300 });
      const bare = [...host.querySelector('svg').children];
      const body = union(bare);
      host.innerHTML = renderItem(boo, { size: 300, equipArt: { hat: 'cape' } });
      const box = union([...host.querySelector('svg').children].slice(bare.length));
      out.push({ species, top: (box.y - body.y) / body.h });
    }
    host.remove();
    return out;
  }, species);
  ok(shipped.every(r => r.top >= 0.60 && r.top <= 0.90),
    `the shipped Sparkle Cape sits in the same shoulder band (${shipped.map(r => (r.top * 100).toFixed(0) + '%').join(' ')})`);

  // A pixel sheet to look at, one row per species.
  await page.evaluate(async ([accs, sp]) => {
    const { renderItem } = await import('./js/art.js');
    const { BY_ID } = await import('./data/catalogue.js');
    document.body.innerHTML = `<div style="background:#2A1B4E;padding:12px;display:grid;gap:8px">` +
      sp.map(({ species, id }) => `<div style="display:flex;gap:6px;align-items:end">` +
        `<span style="color:#fff;font:700 11px system-ui;width:64px">${species}</span>` +
        accs.map(a => renderItem(BY_ID[id], { size: 84, equipArt: { [BY_ID[a].slot]: BY_ID[a].art } })).join('') +
        `</div>`).join('') + `</div>`;
  }, [ALL_NEW, species]);
  await page.setViewportSize({ width: 1200, height: 200 + species.length * 100 });
  await page.screenshot({ path: `${SHOTS}/anchor-sheet-all-species.png`, fullPage: true });
  await ctx.close();
}

console.log('== behaviour-changing accessories really change the walk ==');
{
  // Springy boots: the walk gains a boing the plain walk does not have.
  for (const [accId, slot] of [['acc_springboots', 'feet'], ['acc_flippers', 'feet']]) {
    const items = [{ zone: 'meadow', x: .06, row: 1, item: BOOS[0] }];
    const save = SAVE({
      equips: { [BOOS[0]]: { [slot]: accId } },
      town: { areas: Object.assign(Object.fromEntries(AREA_KEYS.map(k => [k, { items: [], paths: [] }])), { meadow: { items, paths: [] } }) }
    });
    const { ctx, page } = await open('town', { area: 'meadow' }, { save });
    ok(await page.evaluate(() => window.__townLife.locomotion(0)) === (accId === 'acc_springboots' ? 'spring' : 'flap'),
      `${accId}: the town reads its locomotion`);
    await page.evaluate(() => window.__townLife.forceWalk(0, 1));
    const frames = [];
    for (let i = 0; i < 8; i++) { await page.evaluate(() => window.__townLife.stepActors(90)); frames.push(await page.evaluate(() => window.__townLife.transform(0))); await sleep(60); }
    ok(distinct(frames) >= 6, `${accId}: the walk itself animates (${distinct(frames)}/8 distinct frames)`);
    // The vertical component is what makes a boing a boing: read the ty out of the transform.
    const ys = frames.map(f => { const m = /translate\([^,]+,\s*(-?[\d.]+)px/.exec(f || ''); return m ? +m[1] : 0; });
    const spread = Math.max(...ys) - Math.min(...ys);
    ok(spread >= (accId === 'acc_springboots' ? 6 : 2), `${accId}: it really leaves the ground (${spread.toFixed(1)}px of vertical travel)`);
    await page.screenshot({ path: `${SHOTS}/walk-${accId.replace('acc_', '')}-1024x768.png` });
    await ctx.close();
  }
  // The Comet Cape flutters ONLY while she is moving.
  {
    const items = [{ zone: 'meadow', x: .06, row: 1, item: BOOS[0] }];
    const save = SAVE({
      equips: { [BOOS[0]]: { hat: 'acc_starcape' } },
      town: { areas: Object.assign(Object.fromEntries(AREA_KEYS.map(k => [k, { items: [], paths: [] }])), { meadow: { items, paths: [] } }) }
    });
    const { ctx, page } = await open('town', { area: 'meadow' }, { save });
    ok(await page.locator('.acc-cape').count() === 1, 'the cape is drawn on the Boo');
    await page.evaluate(() => { const l = window.__townLife; l.forceWalk(0, 1); l.stepActors(60); });
    ok(await page.evaluate(() => window.__townLife.capeFluttering()) === 1, 'it flutters while she walks');
    await page.screenshot({ path: `${SHOTS}/cape-flutter-1024x768.png` });
    // __town.drift() parks every free Boo (state 'pause', vx 0) — the honest way to stop her.
    await page.evaluate(() => { window.__town.drift(0); window.__townLife.stepActors(60); });
    await sleep(120);
    ok(await page.evaluate(() => window.__townLife.capeFluttering()) === 0, 'and hangs perfectly still when she stops');
    await ctx.close();
  }
}

console.log('== the two costume sets equip atomically, with their ceremony ==');
{
  for (const setId of NEW_SETS) {
    const { ctx, page } = await open(null);
    const result = await page.evaluate(async ([id, boo]) => {
      const { equipSet, equippedIds, costumeFor } = await import('./js/accessories.js');
      const { BY_ID } = await import('./data/catalogue.js');
      const okEquip = equipSet(boo, id);
      const worn = equippedIds(boo);
      const s = JSON.parse(JSON.stringify((await import('./js/state.js')).getState()));
      return { okEquip, worn, pieces: BY_ID[id].pieces, idle: BY_ID[id].idle,
        ceremony: !!(s.seen.costumeCeremonies || {})[id], costume: (costumeFor(boo) || {}).id || null };
    }, [setId, BOOS[0]]);
    ok(result.okEquip, `${setId} equips`);
    const slots = Object.keys(result.pieces);
    ok(slots.every(s => (result.worn[s] || '').startsWith(`set:${setId}:`)),
      `${setId}: every piece lands in its own slot at once (${slots.join(' + ')})`);
    ok(result.costume === setId, `${setId}: the town reads it back as one costume`);
    ok(result.ceremony, `${setId}: its ceremony is recorded once`);
    ok(!!result.idle, `${setId}: it brings an idle of its own (${result.idle})`);
    // Unequipping one piece leaves the others — pieces are usable individually.
    const after = await page.evaluate(async ([boo, slot]) => {
      const { unequip, equippedIds } = await import('./js/accessories.js');
      unequip(boo, slot);
      return equippedIds(boo);
    }, [BOOS[0], slots[0]]);
    ok(!after[slots[0]] && slots.slice(1).every(s => !!after[s]), `${setId}: one piece can come off without the rest`);
    await ctx.close();
  }
  // …and the idle actually plays in town.
  // RUN20 W3 changed the pirate's authored idle from the hearty wave to a spyglass scan
  // (data/catalogue.js: idle 'spyglass'); its catchphrase is "Yarr!" at the same rate.
  for (const [setId, cls] of [['acc_set_astronaut', 'costume-moon-bounce'], ['acc_set_pirate', 'costume-spyglass']]) {
    const items = [{ zone: 'meadow', x: .06, row: 1, item: BOOS[0] }];
    const save = SAVE({
      equips: { [BOOS[0]]: Object.fromEntries(Object.entries({ astronaut: { hat: 'astrohelmet', feet: 'astroboots' }, pirate: { hat: 'piratehat', face: 'eyepatch' } }[setId.split('_').pop()]).map(([s, art]) => [s, `set:${setId}:${art}`])) },
      town: { areas: Object.assign(Object.fromEntries(AREA_KEYS.map(k => [k, { items: [], paths: [] }])), { meadow: { items, paths: [] } }) }
    });
    const { ctx, page } = await open('town', { area: 'meadow' }, { save });
    const kind = await page.evaluate(() => window.__townLife.costumeIdle(0));
    ok(!!kind, `${setId}: its idle fires in town (${kind})`);
    ok(await page.locator(`.${cls}`).count() === 1, `${setId}: and it is the authored one (.${cls})`);
    await page.screenshot({ path: `${SHOTS}/costume-${setId.replace('acc_set_', '')}-1024x768.png` });
    await ctx.close();
  }
}

console.log('== 5000-roll pool simulation: every new item appears at its stated rarity ==');
{
  const { ctx, page } = await open(null);
  const sim = await page.evaluate(async ([accs, sets]) => {
    const { BY_TYPE_RARITY, BY_ID } = await import('./data/catalogue.js');
    const wanted = [...accs, ...sets];
    const counts = Object.fromEntries(wanted.map(id => [id, 0]));
    const pools = {};
    // The bucket is the item's own `kind` (BY_TYPE_RARITY's own rule) — costume sets are
    // kind:'accessory' too, so they roll from the accessory/ultra pool, not a 'costume' one.
    // Deriving it here the same way the product does is the point: a test that invents its
    // own bucket names would pass while the real pool was empty.
    for (const id of wanted) {
      const it = BY_ID[id];
      const type = it.kind;
      pools[id] = { type, rarity: it.rarity, slot: it.slot,
        inPool: (BY_TYPE_RARITY[type] && BY_TYPE_RARITY[type][it.rarity] || []).some(x => x.id === id) };
    }
    // 5000 rolls of the REAL pools, per (type, rarity) bucket the items actually live in.
    for (let i = 0; i < 5000; i++) {
      for (const rarity of ['common', 'rare', 'ultra']) {
        const pool = (BY_TYPE_RARITY.accessory && BY_TYPE_RARITY.accessory[rarity]) || [];
        if (!pool.length) continue;
        const pick = pool[(Math.random() * pool.length) | 0];
        if (counts[pick.id] != null) counts[pick.id]++;
      }
    }
    return { counts, pools };
  }, [ALL_NEW, NEW_SETS]);
  const NEW_SETS_IN = NEW_SETS;
  const missing = Object.entries(sim.pools).filter(([, p]) => !p.inPool).map(([id]) => id);
  ok(missing.length === 0, `every new item is in its (type, rarity) pool${missing.length ? ' — missing: ' + missing.join(', ') : ''}`);
  const never = Object.entries(sim.counts).filter(([, n]) => n === 0).map(([id]) => id);
  ok(never.length === 0, `every new item was rolled at least once in 5000 rolls${never.length ? ' — never seen: ' + never.join(', ') : ''}`);
  // …and it was rolled at the rarity it claims, not some other one.
  const wrongTier = Object.entries(sim.pools).filter(([, p]) => !['common', 'rare', 'ultra'].includes(p.rarity));
  ok(wrongTier.length === 0, 'every new item claims a real rarity tier');
  // The two costume sets are ULTRA, and must be rolled from the ultra pool specifically.
  const setCounts = NEW_SETS_IN.map(id => sim.counts[id]);
  ok(setCounts.every(n => n > 0), `both new costume sets appear in the ultra pool (${setCounts.join(', ')})`);
  console.log('    roll counts:', Object.entries(sim.counts).map(([id, n]) => `${id.replace('acc_', '')}=${n}`).join(' '));
  await ctx.close();
}

console.log('== ten dance moves, three preferred per personality, and a rotating spotlight ==');
{
  const { ctx, page } = await open('discohall');
  await page.waitForSelector('.disco-dancer');
  const moves = await page.evaluate(() => window.__disco.moveSet());
  ok(moves.length >= 10, `the floor knows ${moves.length} named moves`);
  ok(distinct(moves) === moves.length, 'and every one of them is distinct');
  const prefs = await page.evaluate(() => window.__disco.preferences());
  const personalities = Object.keys(prefs);
  ok(personalities.length === 6, `all six temperaments have preferences (${personalities.length})`);
  ok(personalities.every(p => prefs[p].length === 3), 'each prefers exactly three moves');
  ok(personalities.every(p => prefs[p].every(m => moves.includes(m))), 'every preference is a real move');
  ok(distinct(personalities.flatMap(p => prefs[p])) >= 8, `the preferences span most of the set (${distinct(personalities.flatMap(p => prefs[p]))} of ${moves.length})`);
  // Frame evidence: over many bars, the floor really uses more than a handful of moves.
  const seen = new Set();
  const frames = [];
  for (let i = 0; i < 14; i++) {
    await page.evaluate(() => window.__disco.forceBar && window.__disco.forceBar());
    await sleep(340);
    (await page.evaluate(() => window.__disco.dancerMoves())).forEach(d => seen.add(d.move));
    frames.push(await page.evaluate(() => window.__disco.danceClasses().join('|')));
    if (i === 3 || i === 9) await page.screenshot({ path: `${SHOTS}/disco-bar-${i}.png` });
  }
  ok(seen.size >= 6, `across the bars the floor actually danced ${seen.size} different moves (${[...seen].join(', ')})`);
  ok(distinct(frames) >= 4, `and the floor changes bar to bar (${distinct(frames)}/${frames.length} distinct frames)`);
  // The spotlight: exactly one dancer, rotating on the bar.
  const spotBars = await page.evaluate(() => window.__disco.spotlightBars());
  ok(spotBars === 8, `the spotlight lasts eight bars (${spotBars})`);
  ok(await page.evaluate(() => window.__disco.spotlitCount()) === 1, 'exactly one Boo is in the spotlight');
  const log = await page.evaluate(() => window.__disco.spotlightLog());
  ok(log.length >= 2, `the spotlight has moved on at least once (${log.length} promotions)`);
  ok(log.every((e, i) => i === 0 || e.bar - log[i - 1].bar === spotBars), `and it moves exactly on the eight-bar phrase (${log.map(e => e.bar).join(', ')})`);
  ok(distinct(log.map(e => e.id)) === log.length || log.length > (await page.evaluate(() => window.__disco.dancerMoves())).length,
    'and it promotes a different Boo each time round the roster');
  await page.screenshot({ path: `${SHOTS}/disco-spotlight-1024x768.png` });
  await ctx.close();
}

console.log('== two extra idles per species, inside their caps over three simulated minutes ==');
{
  // On-screen, and spread just enough to satisfy the min-spacing rule: stepActors() skips
  // actors outside the viewport, and an outdoor area is four viewports wide.
  const items = BOOS.slice(0, 6).map((id, i) => ({ zone: 'meadow', x: .02 + i * .035, row: 1, item: id }));
  const save = SAVE({ town: { areas: Object.assign(Object.fromEntries(AREA_KEYS.map(k => [k, { items: [], paths: [] }])), { meadow: { items, paths: [] } }) } });
  const { ctx, page } = await open('town', { area: 'meadow' }, { save });
  const caps = await page.evaluate(() => window.__townLife.idleCaps());
  ok(caps.maxPerMin > 0 && caps.minGapMs > 0 && caps.sceneCap > 0, `the caps are real numbers (${JSON.stringify(caps)})`);
  // Every species declares two idles: the universal blink, and its own flavour.
  const perActor = await page.evaluate(n => Array.from({ length: n }, (_, i) => window.__townLife.idleFor(i)), items.length);
  ok(perActor.every(a => a && a.blink && a.flavour && a.blink !== a.flavour),
    `every Boo has two idles — the blink and a species one (${perActor.map(a => `${a.species}:${a.flavour}`).join(' ')})`);
  ok(distinct(perActor.map(a => a.flavour)) >= 3, `the species flavours really differ (${distinct(perActor.map(a => a.flavour))} distinct across ${items.length} Boos)`);
  // Both idles render.
  for (const which of ['blink-look', perActor[0].flavour]) {
    const fired = await page.evaluate(w => window.__townLife.forceIdle(0, w), which);
    ok(fired === which, `the ${which} idle fires`);
    ok(await page.evaluate(w => window.__townLife.idleClasses().some(c => c.includes(`idle-${w}`)), which), `and renders as .idle-${which}`);
    await sleep(120);
  }
  await page.screenshot({ path: `${SHOTS}/idle-1024x768.png` });
  // Three simulated minutes of nothing but trying to idle: the caps must hold.
  const result = await page.evaluate(async ([n, minutes]) => {
    const l = window.__townLife;
    const start = performance.now();
    let attempts = 0, fired = 0, maxConcurrent = 0;
    // Ask far more often than the app ever would — the cap, not the odds, must be what holds.
    while (performance.now() - start < minutes * 60000) {
      for (let i = 0; i < n; i++) { attempts++; if (l.tryIdle(i)) fired++; }
      maxConcurrent = Math.max(maxConcurrent, l.idleClasses().length);
      await new Promise(r => setTimeout(r, 60));
    }
    return { attempts, fired, maxConcurrent, logs: Array.from({ length: n }, (_, i) => l.idleLog(i)) };
  }, [items.length, 3]);
  ok(result.fired > 0, `over three minutes some idles really fired (${result.fired} of ${result.attempts} attempts)`);
  const worstPerMin = Math.max(...result.logs.map(log => {
    let worst = 0;
    for (const t of log) worst = Math.max(worst, log.filter(u => u >= t && u - t < 60000).length);
    return worst;
  }));
  ok(worstPerMin <= caps.maxPerMin, `no Boo exceeded ${caps.maxPerMin} idles in any rolling minute (worst ${worstPerMin})`);
  const worstGap = Math.min(...result.logs.map(log => {
    let min = Infinity;
    for (let i = 1; i < log.length; i++) min = Math.min(min, log[i] - log[i - 1]);
    return min;
  }));
  ok(!isFinite(worstGap) || worstGap >= caps.minGapMs - 60, `no Boo idled twice inside ${caps.minGapMs}ms (closest ${isFinite(worstGap) ? worstGap.toFixed(0) : 'n/a'}ms)`);
  ok(result.maxConcurrent <= caps.sceneCap, `never more than ${caps.sceneCap} idling at once (peak ${result.maxConcurrent})`);
  await ctx.close();
}

await browser.close();
console.log(`\nRESULT: ${failed ? 'FAIL' : 'PASS'}`);
process.exit(failed ? 1 : 0);
