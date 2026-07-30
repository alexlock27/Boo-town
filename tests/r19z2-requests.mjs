// tests/r19z2-requests.mjs — RUN19 Z2: turn up the pulse.
// The v21 save shape, the raised constants, and all five authored verbs: that each one can
// be created when (and only when) its target exists, that each is fulfilled by the real
// system the pack names, that an impossible request fades silently, and that the bubble is
// a tappable 56px object which opens a card with a 48px picture and glows its target.
// Expected runtime ~25s. Not @serial (no frame sampling).
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const errors = []; let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const HOUR = 3600 * 1000;

// The requester sits at x 0.12 so it stays inside the town's default scroll window (an area
// is 4 viewports wide and only the visible window is laid out — a Boo parked at 0.6 renders
// with a zero-size box and every geometry assertion below would measure nothing).
// The bench sits at 0.30, beyond ACT_RADIUS, so nobody claims it before the checks run.
const SAVE = {
  version: 20, name: 'Ada', created: 1750000000000,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'Twiggy' },
  inventory: { boo_inky: 1, boo_plum: 1, acc_bow: 1 },
  stars: { total: 300, byGame: {} }, meter: 0, boxes: 0, opened: 3, stardust: 0,
  nicknames: {}, equips: {},
  town: { areas: { meadow: { items: [
    { zone: 'meadow', x: 0.30, row: 1, item: 'deco_bench' },
    { zone: 'meadow', x: 0.12, row: 1, item: 'boo_inky' },
    { zone: 'meadow', x: 0.40, row: 1, item: 'boo_plum' }
  ], paths: [] } } },
  // A RUN3-shaped save, mid-request: the v21 migration must carry it forward, not drop it.
  // createdAt is stamped at write time — an ancient one would (correctly) hit the 48h silent
  // expiry the moment the app opened, and the fold would be invisible rather than untested.
  request: { active: { id: 'box', booId: 'boo_inky', text: 'Ooh, open a mystery box!', createdAt: 0 }, lastResolvedAt: 0 },
  // No hide-and-seek this session: renderHide() puts display:none on the hider's wrap, and
  // a Boo picked to hide is deliberately never given a request (see requestableBooIds).
  delights: { hideDay: '', hideFound: true },
  settings: { sound: false, music: false, voice: false, mic: false, requests: true, content: 'light' },
  seen: { ageAsked: true }
};
SAVE.request.active.createdAt = Date.now();
SAVE.delights.hideDay = new Date().toISOString().slice(0, 10);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
const page = await ctx.newPage();
page.on('pageerror', e => errors.push('PE ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(m.text()); });
await page.goto(BASE + '/index.html', { waitUntil: 'load' });
await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE);
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('.hub');

// ---- the v21 migration -------------------------------------------------------------
console.log('== v21: requests become a list ==');
const mig = await page.evaluate(() => {
  const s = window.BooTown.State.getState();
  return { version: s.version, actives: s.request.actives, hasOldActive: 'active' in s.request };
});
assert(mig.version === 21, 'the save migrates to v21 (got ' + mig.version + ')');
// The hub's app-open trigger may have added a SECOND request by now (that is the point of
// Z2), so assert the folded one is present rather than that it is alone.
assert(Array.isArray(mig.actives) && mig.actives.some(r => r.id === 'box'),
  'an in-flight RUN3 request folds into actives rather than being orphaned (' + JSON.stringify(mig.actives) + ')');
assert(mig.actives.length <= 2, 'never more than MAX_ACTIVE requests exist (' + mig.actives.length + ')');
assert(mig.hasOldActive === false, 'the orphaned `active` key is removed, not left for deepDefaults to preserve forever');
const twice = await page.evaluate(() => {
  const m = window.BooTown.State;
  const raw = JSON.parse(localStorage.getItem('bootown.save.v1'));
  const a = JSON.stringify(m.migrate(JSON.parse(JSON.stringify(raw))));
  const b = JSON.stringify(m.migrate(JSON.parse(a)));
  return a === b;
});
assert(twice, 'migrating twice is byte-identical (era law)');

// ---- the raised constants ----------------------------------------------------------
console.log('== Z2 constants ==');
const consts = await page.evaluate(async () => {
  const r = await import('./js/requests.js');
  const p = await import('./data/personalities.js');
  return { recharge: r.RECHARGE_MS, max: r.MAX_ACTIVE, near: r.VISIT_NEAR_X, catchphrase: p.CATCHPHRASE_RATE };
});
assert(consts.recharge === 3 * HOUR, 'RECHARGE_MS = 3h (got ' + consts.recharge / HOUR + 'h)');
assert(consts.max === 2, 'MAX_ACTIVE = 2');
assert(consts.near === 0.15, 'neighbours = within 15% x');
assert(consts.catchphrase === 0.45, 'CATCHPHRASE_RATE = 0.45 (got ' + consts.catchphrase + ')');

// ---- creation: a verb is offered only when it has a real target ---------------------
console.log('== creation eligibility ==');
const elig = await page.evaluate(async () => {
  const r = await import('./js/requests.js');
  const st = window.BooTown.State;
  const both = ['boo_inky', 'boo_plum'];
  const before = r.eligibleVerbs(r.buildContext(both, 'meadow'));
  st.mutate(s => { s.town.areas.meadow.items.find(t => t.item === 'deco_bench').at = Date.now(); });
  const withFresh = r.eligibleVerbs(r.buildContext(both, 'meadow'));
  // No area context at all (the hub, where app-open still triggers): the two verbs that
  // name a placed OBJECT have nothing to point at, while wear/visit/dance are answerable
  // from the save alone and stay available — the hub trigger is not dead weight.
  const hubSide = r.eligibleVerbs(r.buildContext(both, null));
  // an accessory already worn is no longer "in your collection"
  st.mutate(s => { s.equips.boo_inky = { hat: 'acc_bow' }; });
  const worn = r.eligibleVerbs(r.buildContext(both, 'meadow'));
  st.mutate(s => { delete s.equips.boo_inky; });
  return { before, withFresh, hubSide, worn };
});
assert(!elig.before.includes('try'), "'try' is not offered for an item with no placement stamp");
assert(elig.withFresh.includes('try'), "'try' is offered once an item has been placed today");
for (const v of ['sit', 'wear', 'visit', 'dance']) assert(elig.withFresh.includes(v), `'${v}' is offered when its target exists`);
assert(!elig.hubSide.includes('sit') && !elig.hubSide.includes('try'),
  'away from an area, the two object-naming verbs invent nothing (' + JSON.stringify(elig.hubSide) + ')');
assert(elig.hubSide.includes('wear') && elig.hubSide.includes('dance'),
  'the verbs answerable from the save alone still work at app open (' + JSON.stringify(elig.hubSide) + ')');
assert(!elig.worn.includes('wear'), "'wear' is not offered for an accessory already being worn");

// ---- fulfilment: each verb, by the system the pack names ----------------------------
console.log('== fulfilment per verb ==');
const ful = await page.evaluate(async () => {
  const r = await import('./js/requests.js');
  const st = window.BooTown.State;
  const out = {};
  const force = (req) => st.mutate(s => { s.request.actives = [req]; s.request.thanking = []; s.request.treatFor = null; });
  const meter = () => st.getState().meter;
  const now = () => Date.now();

  force({ id: 'sit', kind: 'sit', booId: 'boo_inky', area: 'meadow', itemId: 'deco_bench', itemX: 0.30, createdAt: now() });
  const m0 = meter();
  const sit = r.noteRequest('socketClaim', { booId: 'boo_inky', itemId: 'deco_bench', area: 'meadow', x: 0.30 });
  out.sit = sit.fulfilled;
  out.sitReward = meter() - m0 === 2;
  out.sitThanks = (st.getState().request.thanking || []).includes('boo_inky');

  force({ id: 'sit', kind: 'sit', booId: 'boo_inky', area: 'meadow', itemId: 'deco_bench', itemX: 0.30, createdAt: now() });
  out.sitWrongBoo = !r.noteRequest('socketClaim', { booId: 'boo_plum', itemId: 'deco_bench', area: 'meadow', x: 0.30 }).fulfilled;

  force({ id: 'wear', kind: 'wear', booId: 'boo_inky', accId: 'acc_bow', createdAt: now() });
  out.wearWrongBoo = !r.noteRequest('equip', { booId: 'boo_plum', accId: 'acc_bow' }).fulfilled;
  out.wear = r.noteRequest('equip', { booId: 'boo_inky', accId: 'acc_bow' }).fulfilled;

  force({ id: 'visit', kind: 'visit', booId: 'boo_inky', targetBooId: 'boo_plum', area: 'meadow', createdAt: now() });
  out.visitFarApart = !r.noteRequest('placement', { area: 'meadow' }).fulfilled;
  st.mutate(s => { s.town.areas.meadow.items.find(t => t.item === 'boo_plum').x = 0.20; });   // inky is at 0.12
  out.visitNear = r.noteRequest('placement', { area: 'meadow' }).fulfilled;

  force({ id: 'dance', kind: 'dance', booId: 'boo_inky', area: 'meadow', createdAt: now() });
  out.danceByDisco = r.noteRequest('disco', {}).fulfilled;
  force({ id: 'dance', kind: 'dance', booId: 'boo_inky', area: 'meadow', createdAt: now() });
  out.danceByRoutine = r.noteRequest('routine', { area: 'meadow' }).fulfilled;
  force({ id: 'dance', kind: 'dance', booId: 'boo_inky', area: 'meadow', createdAt: now() });
  out.danceOtherAreaRoutine = !r.noteRequest('routine', { area: 'beach' }).fulfilled;

  force({ id: 'try', kind: 'try', booId: 'boo_inky', area: 'meadow', itemId: 'deco_bench', itemX: 0.30, createdAt: now() });
  out.tryNeedsTheBooPresent = !r.noteRequest('itemTap', { itemId: 'deco_bench', area: 'meadow', booIds: ['boo_plum'] }).fulfilled;
  out.try = r.noteRequest('itemTap', { itemId: 'deco_bench', area: 'meadow', booIds: ['boo_inky'] }).fulfilled;

  // two at once, and never two for the same Boo
  st.mutate(s => {
    s.request.actives = [
      { id: 'dance', kind: 'dance', booId: 'boo_inky', area: 'meadow', createdAt: now() },
      { id: 'dance', kind: 'dance', booId: 'boo_plum', area: 'meadow', createdAt: now() }
    ];
    s.request.lastResolvedAt = 0;
  });
  r.checkRequestOpen(['boo_inky', 'boo_plum'], 'meadow');
  out.capHolds = r.activeRequests().length === 2;
  const bothPaid = st.getState().meter;
  const res = r.noteRequest('disco', {});
  out.bothFulfilled = res.fulfilled && res.booIds.length === 2 && st.getState().meter - bothPaid === 4;

  // impossible: the named thing is gone
  force({ id: 'sit', kind: 'sit', booId: 'boo_inky', area: 'meadow', itemId: 'deco_swings', itemX: 0.9, createdAt: now() });
  r.pruneImpossible();
  out.prunedMissingItem = r.activeRequests().length === 0;
  force({ id: 'visit', kind: 'visit', booId: 'boo_inky', targetBooId: 'boo_ghostly_nonexistent', area: 'meadow', createdAt: now() });
  r.pruneImpossible();
  out.prunedMissingFriend = r.activeRequests().length === 0;
  // ...and pruning is SILENT: it must not count as a resolve, or it would start the recharge
  st.mutate(s => { s.request.lastResolvedAt = 12345; });
  force({ id: 'sit', kind: 'sit', booId: 'boo_inky', area: 'meadow', itemId: 'deco_swings', itemX: 0.9, createdAt: now() });
  r.pruneImpossible();
  out.pruneIsSilent = st.getState().request.lastResolvedAt === 12345;

  // the off switch still clears everything
  force({ id: 'dance', kind: 'dance', booId: 'boo_inky', area: 'meadow', createdAt: now() });
  r.setRequestsEnabled(false);
  out.offSwitch = r.activeRequests().length === 0 && !r.requestsEnabled();
  r.setRequestsEnabled(true);
  return out;
});
for (const [k, v] of Object.entries(ful)) assert(v, 'fulfilment: ' + k);

// ---- the bubble, the card, the glow ------------------------------------------------
console.log('== the bubble is a real object ==');
await page.evaluate(() => {
  const st = window.BooTown.State;
  st.mutate(s => {
    s.equips = {};
    s.town.areas.meadow.items.find(t => t.item === 'boo_plum').x = 0.40;
    s.town.areas.meadow.items.find(t => t.item === 'deco_bench').at = Date.now();
    // 'try' is fulfilled ONLY by a tap, so the bubble survives long enough to inspect.
    s.request.actives = [{ id: 'try', kind: 'try', booId: 'boo_inky', area: 'meadow', itemId: 'deco_bench', itemX: 0.30, createdAt: Date.now() }];
    s.request.lastResolvedAt = Date.now();   // no second request appears mid-check
  });
  window.BooTown.go('town', { area: 'meadow' });
});
await page.waitForSelector('.town2');
await page.waitForSelector('.request-thought');
const bub = await page.evaluate(() => {
  const n = document.querySelector('.request-thought');
  const r = n.getBoundingClientRect();
  return { w: Math.round(r.width), h: Math.round(r.height), hasSvg: !!n.querySelector('svg'), label: n.getAttribute('aria-label'), tag: n.tagName };
});
assert(bub.w >= 56 && bub.h >= 56, 'the thought bubble meets the 56px tap-target law (' + bub.w + 'x' + bub.h + ')');
assert(bub.tag === 'BUTTON', 'the bubble is a real button, not decoration with pointer-events:none');
assert(bub.hasSvg, 'the bubble shows a picture of the wanted thing (no emoji-as-scene-art)');
assert(bub.label === 'Inky wants to try the new Cosy Bench!', 'the authored `try` line ships verbatim: ' + bub.label);

// it bobs, and the reduced-motion path kills only the animation
const bobs = await page.evaluate(() => {
  const n = document.querySelector('.request-thought');
  const cs = getComputedStyle(n);
  return { name: cs.animationName, dur: cs.animationDuration, iter: cs.animationIterationCount };
});
assert(bobs.name === 'rq-bob' && bobs.dur === '2s' && bobs.iter === 'infinite', 'the bubble bobs on a 2s loop (' + JSON.stringify(bobs) + ')');

await page.$eval('.request-thought', n => n.click());   // it bobs AND wanders; a finger copes, Playwright's stability check does not
await page.waitForSelector('.request-card');
const card = await page.evaluate(() => {
  const c = document.querySelector('.request-card');
  const pic = c.querySelector('.rq-card-pic svg');
  const glow = document.querySelector('.rq-glow');
  return {
    line: c.querySelector('.rq-card-line').textContent,
    picSize: pic ? Math.round(pic.getBoundingClientRect().width) : 0,
    glowItem: glow ? glow.dataset.item : null,
    buttons: [...c.querySelectorAll('button')].map(b => b.textContent)
  };
});
assert(card.line === 'Inky wants to try the new Cosy Bench!', 'the card speaks the same authored line as the bubble');
assert(card.picSize === 48, 'the card carries a 48px picture of the wanted thing (' + card.picSize + ')');
assert(card.glowItem === 'deco_bench', 'the named bench glows while the card is open (glowed: ' + card.glowItem + ')');
assert(card.buttons.length && !card.buttons.some(b => /wardrobe|Disco/i.test(b)), 'a same-area verb offers no cross-screen jump (' + JSON.stringify(card.buttons) + ')');

// the two cross-screen verbs DO offer their jump
console.log('== cross-screen verbs offer a jump ==');
const jumps = await page.evaluate(async () => {
  const st = window.BooTown.State;
  const out = {};
  for (const [kind, extra] of [['wear', { accId: 'acc_bow' }], ['dance', {}]]) {
    document.querySelectorAll('.request-card-ov').forEach(n => n.remove());
    st.mutate(s => { s.request.actives = [Object.assign({ id: kind, kind, booId: 'boo_inky', area: 'meadow', createdAt: Date.now() }, extra)]; });
    window.BooTown.go('town', { area: 'meadow' });
    await new Promise(r => setTimeout(r, 600));
    const b = document.querySelector('.request-thought');
    if (!b) { out[kind] = 'no bubble'; continue; }
    b.click();
    await new Promise(r => setTimeout(r, 250));
    const c = document.querySelector('.request-card');
    out[kind] = c ? [...c.querySelectorAll('button')].map(x => x.textContent) : 'no card';
  }
  // and `visit`, which has nowhere to jump, says what to do instead
  document.querySelectorAll('.request-card-ov').forEach(n => n.remove());
  st.mutate(s => { s.request.actives = [{ id: 'visit', kind: 'visit', booId: 'boo_inky', targetBooId: 'boo_plum', area: 'meadow', createdAt: Date.now() }]; });
  window.BooTown.go('town', { area: 'meadow' });
  await new Promise(r => setTimeout(r, 600));
  const vb = document.querySelector('.request-thought');
  if (vb) { vb.click(); await new Promise(r => setTimeout(r, 250)); }
  const vc = document.querySelector('.request-card');
  out.visitHint = vc && vc.querySelector('.rq-card-hint') ? vc.querySelector('.rq-card-hint').textContent : null;
  out.visitGlow = !!document.querySelector('.t-item.boo.rq-glow');
  return out;
});
assert(Array.isArray(jumps.wear) && jumps.wear.some(b => /wardrobe/i.test(b)), "'wear' offers [Open the wardrobe] (" + JSON.stringify(jumps.wear) + ')');
assert(Array.isArray(jumps.dance) && jumps.dance.some(b => /Disco/i.test(b)), "'dance' offers the Disco Hall door (" + JSON.stringify(jumps.dance) + ')');
assert(jumps.visitHint === 'pop them side by side!', "'visit' offers no jump and says what to do: " + jumps.visitHint);

// ---- bubbles never appear during build mode ----------------------------------------
console.log('== build mode ==');
const buildHides = await page.evaluate(async () => {
  document.querySelectorAll('.request-card-ov').forEach(n => n.remove());
  const btn = [...document.querySelectorAll('button')].find(b => /build/i.test(b.textContent));
  if (!btn) return 'no build button found';
  btn.click();
  await new Promise(r => setTimeout(r, 500));
  return document.querySelectorAll('.request-thought').length === 0;
});
assert(buildHides === true, 'no request bubble is shown in build mode (she is arranging, not being asked)');

// ---- the wild Boo also turns up in the daytime -------------------------------------
console.log('== the wild Boo gets a daytime hour ==');
const wild = await page.evaluate(async () => {
  const d = await import('./js/delights.js');
  const h1 = d.ensureDayVisitHour();
  const h2 = d.ensureDayVisitHour();
  const stored = window.BooTown.State.getState().delights;
  return { h1, h2, stable: h1 === h2, inDay: d.DAY_VISIT_HOURS.includes(h1), persisted: stored.visitHour === h1 && !!stored.visitDay };
});
assert(wild.inDay, 'the wild Boo\'s extra hour is a daytime hour (' + wild.h1 + ':00)');
assert(wild.stable, 'it is picked ONCE per day, not re-rolled on every mount');
assert(wild.persisted, 'it persists in delights, like the hide-and-seek pick it reuses');

console.log('\n== errors ==');
if (errors.length) console.log(errors.map(e => '  ! ' + e).join('\n'));
assert(errors.length === 0, 'no JS console errors');
await browser.close();
console.log('\n' + (failed ? 'RESULT: FAIL' : 'RESULT: PASS'));
process.exit(failed ? 1 : 0);
