// tests/lib/run12probe.mjs — RUN12 S0 triage evidence collector (NOT a suite).
// Lives under tests/lib/ deliberately: `_runall.sh` globs tests/*.mjs, so this one-shot
// probe never joins the board. It drives the reported defects and prints machine-readable
// evidence that tests/run12_triage.md quotes. It asserts nothing and fixes nothing.
//   BASE=http://127.0.0.1:8123 node tests/lib/run12probe.mjs
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';

const RAW = process.env.BASE || 'http://127.0.0.1:8000';
const BASE = RAW.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
const RESOLVE = ['--host-resolver-rules=MAP app.localhost 127.0.0.1'];
const SHOTS = 'screenshots/run12/triage';
mkdirSync(SHOTS, { recursive: true });

const AK = ['meadow','riverside','hilltop','beach','funfair','playground','boohouse','gallery'];
const save = (over = {}) => JSON.stringify(Object.assign({
  version: 14, name: 'Ada', ageAsked: true,
  guide: { species:'giraffe', body:'sunshine', pattern:'spots', patternColour:'cocoa', eyes:'round', acc:'none', name:'T' },
  inventory: { boo_inky: 1, boo_plum: 1, boo_mint: 1, boo_sky: 1, deco_wishwell: 1 },
  stars: { total: 400, byGame: {} }, trophies: {}, boxes: 0,
  town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 4 }, expedition: { party: [], tiers: {}, progress: {} },
  seen: { trophyRetro: true, lastStarsShown: 400, introSeen: {} },
  settings: { sound: false, music: false, voice: false, content: 'full' }
}, over));

const out = {};
const note = (id, data) => { out[id] = data; console.log('\n### ' + id + '\n' + JSON.stringify(data, null, 2)); };

const browser = await chromium.launch({ args: RESOLVE });

// WCAG helpers injected into every page.
const CONTRAST_FN = `
  window.__lum = (rgb) => {
    const f = (v) => { v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); };
    return 0.2126*f(rgb[0]) + 0.7152*f(rgb[1]) + 0.0722*f(rgb[2]);
  };
  window.__parse = (s) => (String(s).match(/[0-9.]+/g) || []).slice(0,4).map(Number);
  window.__ratio = (fg, bg) => { const a = window.__lum(fg), b = window.__lum(bg);
    return (Math.max(a,b) + 0.05) / (Math.min(a,b) + 0.05); };
  window.__bgOf = (node) => {
    let el = node;
    while (el && el.nodeType === 1) {
      const c = window.__parse(getComputedStyle(el).backgroundColor);
      if (c.length >= 3 && (c.length === 3 || c[3] >= 0.999)) return [c[0],c[1],c[2]];
      el = el.parentElement;
    }
    return [255,255,255];
  };
`;

async function fresh(opts = {}) {
  const ctx = await browser.newContext(opts.viewport ? { viewport: opts.viewport } : {});
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  if (opts.save !== null) await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), opts.save || save());
  await page.addInitScript(CONTRAST_FN);
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => window.BooTown, null, { timeout: 20000 });
  return { ctx, page, errors };
}

// ---------------------------------------------------------------- F12-01
{
  const { ctx, page, errors } = await fresh();
  await page.evaluate(() => window.BooTown.go('town', { area: 'meadow', openWishWell: true }));
  await page.waitForTimeout(1800);
  const overlay = await page.evaluate(() => ({
    wishwellHook: !!window.__wishwell,
    overlayNode: !!document.querySelector('.ww-overlay, .wishwell-overlay, [class*="wishwell"]')
  }));
  await page.screenshot({ path: SHOTS + '/f12-01-wishwell-card.png' });
  note('F12-01', { consoleErrors: errors.slice(0, 4), ...overlay,
    codeSymbol: 'js/town.js:347 calls openWishWellOverlay(); js/wishwell.js:17 exports openWishWell({onSpawn,onClose}). Entry point js/hub.js:136.' });
  await ctx.close();
}

// ---------------------------------------------------------------- F12-02
{
  const { ctx, page } = await fresh();
  const r = await page.evaluate(() => ({
    note: 'beat.js is the only game that records a ledger miss + a Tricky item for a question the child never attempted.',
    path: 'stepNotes(): a note passing the hit line unresolved -> missPhrase() -> missOrReask(); the SECOND expiry calls recordResult(key,false) AND collector.add(choiceMiss(...))',
    contrast: 'bubblepop respawns escaped bubbles (js/games/bubblepop.js:202) and dash/bounce/feedboos/spellboo only record on a real tap/drop/aim, so they are already fair'
  }));
  note('F12-02', { ...r, codeSymbol: 'js/games/beat.js:261-267 missPhrase() on expiry -> :320 recordResult(question.key,false) + collector.add(...)' });
  await ctx.close();
}

// ---------------------------------------------------------------- F12-03
{
  const { ctx, page } = await fresh();
  const r = await page.evaluate(async () => {
    const { oddGrid } = await import('./js/brainhelpers.js');
    const FEATURES = ['colour','species','hat','shine'];
    const res = {};
    for (const tier of ['light','medium','full']) {
      let even = 0, shinyOdd = 0, nonUniform = 0;
      const sample = [];
      for (let i = 0; i < 400; i++) {
        const g = oddGrid(tier, Math.random, {});
        if (g.oddFeature === 'shine') shinyOdd++;
        const others = g.items.filter((_, ix) => ix !== g.oddIndex);
        const bad = FEATURES.filter(f => new Set(others.map(o => String(o[f]))).size > 1);
        if (bad.length) { nonUniform++; if (sample.length < 2) sample.push({ oddFeature: g.oddFeature, nonUniformOn: bad, size: g.items.length }); }
        for (const f of FEATURES) {
          const counts = {};
          g.items.forEach(o => { counts[String(o[f])] = (counts[String(o[f])] || 0) + 1; });
          const vals = Object.values(counts);
          if (vals.length === 2 && vals[0] === vals[1]) { even++; break; }
        }
      }
      res[tier] = { of: 400, gridsWithAnEvenSplit: even, gridsWhereNonOddItemsDiffer: nonUniform, shinyChosenAsOddFeature: shinyOdd, sample };
    }
    return res;
  });
  note('F12-03', { ...r, codeSymbol: 'js/brainhelpers.js:40-55 distractorFeatures build 2..4 visual "families", so non-odd items are NOT uniform' });
  await ctx.close();
}

// ---------------------------------------------------------------- F12-04
{
  const { ctx, page } = await fresh();
  const r = await page.evaluate(async () => {
    const { renderBoo } = await import('./js/art.js');
    const svgFor = (sp) => renderBoo({ species: sp, colors: { body: 'indigo' } }, { size: 128 });
    const parts = {};
    for (const sp of ['bloop','pip','munch','twirl','sunny','nova']) {
      const s = svgFor(sp);
      parts[sp] = {
        tallEars: /rotate\(-8 44 26\)/.test(s),
        antenna: /M60 46 C58 24 80 24 78 12/.test(s),
        tail: /M96 84 C118 80 116 104 98 104/.test(s),
        starEyes: /polygon|star/i.test(s),
        toothyMouth: /M42 93 Q60 114 78 93/.test(s),
        fangMouth: /M54 95 Q60 101 66 95/.test(s),
        bodyRadii: (s.match(/rx="(4[0-9](?:\.[0-9])?)" ry="(4[0-9](?:\.[0-9])?)"/) || []).slice(1, 3)
      };
    }
    return parts;
  });
  note('F12-04', { renderedSpeciesSignatures: r,
    codeSymbol: "js/games/oddboo.js:20 FEATURE_LABEL.species = 'shape'; :73 and :88 speak it. Species differences render as ears / antenna / tail / eyes / mouth, never as a body shape." });
  await ctx.close();
}

// ---------------------------------------------------------------- F12-05
{
  const { ctx, page } = await fresh();
  await page.evaluate(() => window.BooTown.go('beat'));
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.__intro && window.__intro.close());
  await page.waitForTimeout(4500);
  const r = await page.evaluate(() => {
    const lanes = [...document.querySelectorAll('.beat-lane')];
    return lanes.map((l, i) => {
      const n = l.querySelector('.beat-note');
      const cs = getComputedStyle(n || l);
      const fg = window.__parse(cs.color).slice(0, 3);
      const bg = n ? window.__parse(getComputedStyle(n).backgroundColor).slice(0, 3) : window.__bgOf(l);
      return { lane: i + 1, hasNote: !!n, text: n ? n.textContent.trim() : null,
        textColor: cs.color, laneVar: getComputedStyle(l).getPropertyValue('--lane').trim(),
        noteBg: n ? getComputedStyle(n).backgroundColor : null,
        ratio: (fg.length === 3 && bg.length === 3) ? +window.__ratio(fg, bg).toFixed(2) : null };
    });
  });
  await page.screenshot({ path: SHOTS + '/f12-05-beat-lanes.png' });
  note('F12-05', { lanes: r,
    cssSymbol: 'css/styles.css:1040 lanes take --lane from --pop/--zing/--star; :1044 .beat-note{background:var(--lane)} with ONE inherited text colour for all three' });
  await ctx.close();
}

// ---------------------------------------------------------------- F12-06
{
  const { ctx, page } = await fresh({ save: save({ inventory: { boo_inky: 1 } }) });
  await page.evaluate(() => window.BooTown.go('town', { area: 'meadow' }));
  await page.waitForTimeout(1800);
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => /build|hammer/i.test(x.className + ' ' + (x.getAttribute('aria-label') || '')));
    b && b.click();
  });
  await page.waitForTimeout(1000);
  const r = await page.evaluate(() => {
    const live = document.querySelector('.drawer-empty');
    const host = live ? live.parentElement
      : (document.querySelector('.drawer-body, .drawer-panel, .drawer-tabpanel, .drawer') || document.body);
    const probe = live || Object.assign(document.createElement('div'), { className: 'drawer-empty', textContent: 'Nothing here yet!' });
    if (!live) host.appendChild(probe);
    const cs = getComputedStyle(probe);
    const fg = window.__parse(cs.color);
    const bg = window.__bgOf(probe.parentElement);
    const a = fg.length === 4 ? fg[3] : 1;
    const composited = [0, 1, 2].map(i => fg[i] * a + bg[i] * (1 - a));
    const res = { liveNodeFound: !!live, hostClass: host.className, declaredColor: cs.color,
      resolvedBackground: bg, ratioIgnoringAlpha: +window.__ratio(fg.slice(0, 3), bg).toFixed(2),
      ratioAsRendered: +window.__ratio(composited, bg).toFixed(2) };
    if (!live) probe.remove();
    return res;
  });
  await page.screenshot({ path: SHOTS + '/f12-06-drawer-empty.png' });
  note('F12-06', { ...r, cssSymbol: 'css/styles.css:3314 .drawer-empty { color: rgba(255,255,255,0.75) }' });
  await ctx.close();
}

// ---------------------------------------------------------------- F12-07
{
  const { ctx, page } = await fresh({ save: save({ boxes: 60,
    inventory: { boo_inky: 1, boo_plum: 1, boo_mint: 1, boo_sky: 1, boo_dusk: 1, boo_pebble: 1 } }) });
  const seen = {};
  for (const type of ['boo', 'deco', 'accessory']) {
    for (let attempt = 0; attempt < 8; attempt++) {
      await page.evaluate(t => { window.__forceRoll = { type: t }; window.BooTown.go('ceremony', {}); }, type);
      await page.waitForTimeout(450);
      await page.evaluate(() => { const b = document.querySelector('.gift-box'); for (let i = 0; i < 3; i++) b && b.click(); });
      await page.waitForTimeout(650);
      const got = await page.evaluate(() => ({
        name: document.querySelector('.reveal-name')?.textContent ?? null,
        banner: document.querySelector('.reveal-banner')?.textContent ?? null,
        bannerClass: document.querySelector('.reveal-banner')?.className ?? null,
        rarityBadge: document.querySelector('.reveal-rarity')?.textContent ?? null,
        rarityBadgeBlank: (document.querySelector('.reveal-rarity')?.textContent || '').trim() === '',
        guideLine: document.querySelector('.reveal-guide-bubble')?.textContent ?? null,
        oneLiner: document.querySelector('.reveal-oneliner')?.textContent ?? null,
        actionButton: [...document.querySelectorAll('.reveal-btns button')].map(b => b.textContent.trim())
      }));
      const kind = (got.bannerClass || '').split(/\s+/).find(c => c.startsWith('type-')) || 'type-unknown';
      if (!seen[kind]) {
        seen[kind] = got;
        await page.screenshot({ path: SHOTS + '/f12-07-ceremony-' + kind.replace('type-', '') + '.png' });
      }
    }
  }
  note('F12-07', { perKindObserved: seen,
    codeSymbol: "js/ceremony.js:21 TYPE_BANNER = {boo,deco,furniture,accessory}; :142 every non-accessory common item falls through to guideLine('boxCommon') = 'A new Boo just dropped!'" });
  await ctx.close();
}

// ---------------------------------------------------------------- F12-08
{
  const { ctx, page } = await fresh({ save: save({ seen: { trophyRetro: true, lastStarsShown: 400, introSeen: {} } }) });
  await page.evaluate(() => window.BooTown.go('beat'));
  await page.waitForTimeout(1400);
  const beat = await page.evaluate(async () => {
    const introUp = !!document.querySelector('.intro-overlay');
    const hearts = () => document.querySelectorAll('.hearts-wrap .heart').length
      ? document.querySelector('.hearts-wrap').innerHTML : null;
    const notes = () => document.querySelectorAll('.beat-note').length;
    const a = { notes: notes(), heartsHTML: hearts() };
    await new Promise(r => setTimeout(r, 7000));
    const b = { notes: notes(), heartsHTML: hearts() };
    return { introOverlayUp: introUp, atOpen: a, after7s: b,
      overlayStillUp: !!document.querySelector('.intro-overlay'),
      heartsChangedBehindOverlay: a.heartsHTML !== b.heartsHTML,
      notesSpawnedBehindOverlay: b.notes > 0 || a.notes > 0 };
  });
  await page.screenshot({ path: SHOTS + '/f12-08-beat-intro-over-live-round.png' });

  await page.evaluate(() => window.BooTown.go('flashboos'));
  await page.waitForTimeout(1400);
  const flash = await page.evaluate(async () => {
    const introUp = !!document.querySelector('.intro-overlay');
    const stage = () => document.querySelector('.flash-stage, .flash-scene, .screen.flashboos')?.className || 'n/a';
    const boos = () => document.querySelectorAll('.flash-boo, .fb-boo').length;
    const a = { stage: stage(), boos: boos() };
    await new Promise(r => setTimeout(r, 6000));
    return { introOverlayUp: introUp, atOpen: a, after6s: { stage: stage(), boos: boos() },
      overlayStillUp: !!document.querySelector('.intro-overlay') };
  });
  await page.screenshot({ path: SHOTS + '/f12-08-flash-intro-over-reveal.png' });
  note('F12-08', { beat, flashboos: flash,
    codeSymbol: 'js/intro.js:94 runIntro() exposes only { close }; no game is given a suspend/resume hook, and maybeIntro() is fire-and-forget' });
  await ctx.close();
}

// ---------------------------------------------------------------- F12-09
{
  const { ctx, page } = await fresh();
  await page.evaluate(() => window.BooTown.go('discohall'));
  await page.waitForTimeout(2200);
  const r = await page.evaluate(() => {
    const floor = document.querySelector('.disco-floor');
    const dancers = [...document.querySelectorAll('.disco-dancer')];
    if (!floor || !dancers.length) return { error: 'no disco nodes' };
    const f = floor.getBoundingClientRect();
    return {
      floorTop: Math.round(f.top), floorBottom: Math.round(f.bottom), floorHeight: Math.round(f.height),
      dancers: dancers.map(d => {
        const r = d.getBoundingClientRect();
        return { bottom: Math.round(r.bottom), pxAboveFloorSurface: Math.round(f.top - r.bottom) };
      })
    };
  });
  await page.screenshot({ path: SHOTS + '/f12-09-disco-floating.png' });
  note('F12-09', { ...r,
    cssSymbol: 'css/styles.css:2792 .disco-dancers{inset:0 3% 38%} vs :2796 .disco-floor{bottom:0;height:48%;rotateX(55deg)} — no socket contract, unlike data/sockets.js in the town' });
  await ctx.close();
}

// ---------------------------------------------------------------- F12-10
{
  const { ctx, page } = await fresh();
  await page.evaluate(() => window.BooTown.go('echoboos'));
  await page.waitForTimeout(1400);
  const setup = await page.evaluate(() => ({
    modeRow: [...document.querySelectorAll('.echo-mode')].map(b => b.textContent.trim()),
    bestsRow: [...document.querySelectorAll('.echo-best')].map(b => b.textContent.trim()),
    twoNearIdenticalRows: !!document.querySelector('.echo-mode-row') && !!document.querySelector('.echo-bests')
  }));
  await page.screenshot({ path: SHOTS + '/f12-10-echo-setup.png' });
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find(x => /start|play|go/i.test(x.textContent));
    b && b.click();
  });
  await page.waitForTimeout(1400);
  await page.evaluate(() => window.__intro && window.__intro.close());
  await page.waitForTimeout(800);
  const lit = await page.evaluate(() => {
    const boo = document.querySelector('.echo-boo');
    if (!boo) return { error: 'no podium mounted' };
    const read = () => { const c = getComputedStyle(boo); return { filter: c.filter, transform: c.transform, boxShadow: c.boxShadow, outline: c.outlineWidth }; };
    const unlit = read();
    boo.classList.add('lit');
    const on = read();
    boo.classList.remove('lit');
    return { booColourVar: getComputedStyle(boo).getPropertyValue('--boo').trim(), unlit, lit: on };
  });
  note('F12-10', { setup, litStateDelta: lit,
    cssSymbol: 'css/styles.css:862 .echo-boo.lit — brightness(1.35) + scale(1.06) + a drop-shadow in the Boo own colour; no white rim, no hold, no dimming of the other three' });
  await ctx.close();
}

// ---------------------------------------------------------------- F12-11
{
  const { ctx, page } = await fresh({ save: save({ settings: { sound: true, music: false, voice: true, content: 'toddler' } }) });
  await page.evaluate(() => window.BooTown.go('toddlergame', { game: 'animals' }));
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.__intro && window.__intro.close());
  await page.waitForTimeout(1200);
  const r = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')].map(b => {
      const r = b.getBoundingClientRect();
      return { cls: b.className, label: (b.getAttribute('aria-label') || b.textContent || '').trim().slice(0, 30),
        w: Math.round(r.width), h: Math.round(r.height) };
    });
    return { buttons: btns, replayControl: btns.find(b => /replay|again|listen|speaker|sound/i.test(b.label + ' ' + b.cls)) || null };
  });
  await page.screenshot({ path: SHOTS + '/f12-11-toddler-animals.png' });
  note('F12-11', { ...r,
    codeSymbol: 'js/toddler.js:567 setTimeout(() => { animal.call(cur); speakMaybe(...) }, 240) — one call, no replay control, no auto-repeat; :241 onHelp replays the INTRO, not the call' });
  await ctx.close();
}

// ---------------------------------------------------------------- F12-12
{
  const { ctx, page } = await fresh();
  await page.evaluate(() => window.BooTown.go('clockshop'));
  await page.waitForTimeout(1200);
  await page.evaluate(() => document.querySelector('.level-btn')?.click());
  await page.waitForTimeout(1100);
  await page.evaluate(() => window.__intro && window.__intro.close());
  await page.waitForTimeout(600);
  const r = await page.evaluate(async () => {
    const c = window.__clock;
    if (!c) return { error: 'no __clock hook' };
    const o1 = c.order();
    c.set(o1.h12, o1.m);
    const served = c.state();
    c.serve();
    await new Promise(r => setTimeout(r, 1500));
    const after = c.state(), o2 = c.order();
    return { servedOrder: o1, handsWhenServed: served, nextOrder: o2, handsAtNextOrder: after,
      resetTo1200: after.sh12 === 12 && after.sm === 0,
      carriedOverFromLastOrder: after.sh12 === served.sh12 && after.sm === served.sm };
  });
  const overlap = await page.evaluate(() => {
    const c = window.__clock;
    if (!c) return { error: 'no hook' };
    c.set(12, 0);
    const before = c.state();
    c.dragMinuteTo(30);
    const after = c.state();
    return { atExactOverlap: before, afterDraggingMinuteTo30: after,
      hourHandMovedToo: after.hourAngle !== before.hourAngle };
  });
  await page.screenshot({ path: SHOTS + '/f12-12-clockshop.png' });
  note('F12-12', { ...r, overlapDrag: overlap,
    codeSymbol: 'js/games/clockshop.js:173 onCorrect() makes a new order but never resets sh12/sm; :145 dragHand = dm <= dh ? min : hour, chosen once at pointerdown, and moveTo() fires on pointerdown so a bare tap yanks a hand' });
  await ctx.close();
}

// ---------------------------------------------------------------- F12-13
{
  const { ctx, page } = await fresh();
  await page.evaluate(() => window.BooTown.go('bubblepop'));
  await page.waitForTimeout(1300);
  await page.evaluate(() => window.__intro && window.__intro.close());
  await page.waitForTimeout(700);
  const starsBefore = await page.evaluate(() => window.BooTown.State.getState().stars.total);
  await page.evaluate(() => document.querySelector('.game-topbar .back-btn')?.click());
  await page.waitForTimeout(800);
  const dlg = await page.evaluate(() => {
    const d = document.querySelector('.dialog, .dlg, [role=dialog], .modal, .confirm');
    return { found: !!d, cls: d?.className ?? null, text: (d?.textContent || '').trim().slice(0, 200) };
  });
  await page.screenshot({ path: SHOTS + '/f12-13-leave-dialog.png' });
  const after = await page.evaluate(async () => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Leave');
    b && b.click();
    await new Promise(r => setTimeout(r, 1000));
    return window.BooTown.State.getState().stars.total;
  });
  note('F12-13', { leaveDialog: dlg, starsBefore, starsAfterLeaving: after, banked: after - starsBefore,
    codeSymbol: 'js/gameshell.js:20-29 the leave dialog says "Your stars won\'t be saved." and onBack() runs with nothing awarded' });
  await ctx.close();
}

// ---------------------------------------------------------------- F12-14
{
  const { ctx, page } = await fresh();
  await page.evaluate(() => window.BooTown.go('hub'));
  await page.waitForTimeout(1600);
  const r = await page.evaluate(() => ({
    hubTopChildren: [...(document.querySelector('.hub-top')?.children || [])].map(c => c.className),
    treatsChipOnHub: !!document.querySelector('.care-pocket'),
    cookieGlyphsOnHub: (document.body.innerText.match(/\u{1F36A}/gu) || []).length,
    treatsInSave: window.BooTown.State.getState().care?.treats ?? null
  }));
  await page.screenshot({ path: SHOTS + '/f12-14-hub-top.png' });
  note('F12-14', { ...r, codeSymbol: 'js/hub.js:103 hub-top = [speaker, totalChip, meterWrap]; .care-pocket is built only inside js/care.js:111 and :128' });
  await ctx.close();
}

// ---------------------------------------------------------------- F12-15
{
  const { ctx, page } = await fresh({ viewport: { width: 390, height: 844 } });
  await page.evaluate(() => window.BooTown.go('bubblepop'));
  await page.waitForTimeout(1300);
  await page.evaluate(() => window.__intro && window.__intro.close());
  await page.waitForTimeout(900);
  const classes = await page.evaluate(() => {
    const cls = new Set();
    document.querySelectorAll('.game-area *').forEach(n => { if (typeof n.className === 'string' && n.className) cls.add(n.className.split(/\s+/)[0]); });
    return [...cls].slice(0, 30);
  });
  const samples = [];
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(1500);
    samples.push(await page.evaluate(() => {
      const hud = document.querySelector('.game-topbar')?.getBoundingClientRect();
      const bubbles = [...document.querySelectorAll('[class*="bubble"]')].filter(b => b.getBoundingClientRect().width > 12);
      let under = 0, above = 0; const worst = [];
      for (const b of bubbles) {
        const r = b.getBoundingClientRect();
        if (hud && r.top < hud.bottom) { under++; if (worst.length < 3) worst.push({ cls: b.className, top: Math.round(r.top), hudBottom: Math.round(hud.bottom), overlapPx: Math.round(hud.bottom - r.top) }); }
        if (r.bottom < 4) above++;
      }
      return { bubbles: bubbles.length, intersectingHUD: under, fullyAboveViewport: above, worst };
    }));
  }
  await page.screenshot({ path: SHOTS + '/f12-15-bubblepop-390.png' });
  note('F12-15', { classesSeen: classes, samples,
    codeSymbol: 'js/games/bubblepop.js:202 respawn only when y > H + size — nothing constrains the TOP edge, so a bubble drifts up behind the HUD and stays there until it wraps' });
  await ctx.close();
}

// ---------------------------------------------------------------- F12-16
{
  const brandNew = JSON.stringify({
    version: 14, name: 'Ada', ageAsked: true,
    guide: { species:'giraffe', body:'sunshine', pattern:'spots', patternColour:'cocoa', eyes:'round', acc:'none', name:'T' },
    inventory: {}, stars: { total: 0, byGame: {} }, trophies: {}, boxes: 0,
    town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
    care: { bonds: {}, treats: 0 }, expedition: { party: [], tiers: {}, progress: {} },
    seen: {}, settings: { sound: false, music: false, voice: false, content: 'full' }
  });
  const { ctx, page } = await fresh({ save: brandNew });
  await page.evaluate(() => window.BooTown.go('hub'));
  await page.waitForTimeout(2800);
  const r = await page.evaluate(async () => {
    const { journalEntries } = await import('./js/quests.js');
    const { todayKey } = await import('./js/state.js');
    return { today: todayKey(), entries: journalEntries().map(e => ({ key: e.key, date: e.date, label: e.label })),
      trophyKeys: Object.keys(window.BooTown.State.getState().trophies || {}) };
  });
  await page.evaluate(() => window.BooTown.go('collection'));
  await page.waitForTimeout(1100);
  await page.evaluate(() => [...document.querySelectorAll('.coll-tab')].find(t => /Journal/.test(t.textContent))?.click());
  await page.waitForTimeout(900);
  const shown = await page.evaluate(() => [...document.querySelectorAll('.journal-stamp')].map(s => ({
    label: s.querySelector('.js-label')?.textContent ?? null, date: s.querySelector('.js-date')?.textContent ?? null })));
  await page.screenshot({ path: SHOTS + '/f12-16-journal-fresh-save.png' });
  note('F12-16', { ...r, renderedStamps: shown });
  await ctx.close();
}

// ---------------------------------------------------------------- F12-17
{
  const { ctx, page, errors } = await fresh({ save: save({ stars: { total: 12, byGame: {} }, chest: { anchor: 0, opened: 0, welcome: false } }) });
  await page.evaluate(() => window.BooTown.go('hub'));
  await page.waitForTimeout(1800);
  const r = await page.evaluate(async () => {
    const { chestState } = await import('./js/shiny.js');
    const chip = document.querySelector('.trail-chip.chest');
    const top = document.querySelector('.star-chest');
    const before = document.querySelector('#screen')?.firstElementChild?.className || '';
    chip && chip.click();
    await new Promise(r => setTimeout(r, 700));
    const afterChip = document.querySelector('#screen')?.firstElementChild?.className || '';
    top && top.click();
    await new Promise(r => setTimeout(r, 700));
    const afterTop = document.querySelector('#screen')?.firstElementChild?.className || '';
    return { chestState: chestState(), railChipPresent: !!chip, topChestPresent: !!top,
      chipAria: chip?.getAttribute('aria-label') ?? null, topAria: top?.getAttribute('aria-label') ?? null,
      screenBefore: before, afterRailChipTap: afterChip, afterTopChestTap: afterTop,
      anythingOpened: before !== afterChip || before !== afterTop };
  });
  await page.screenshot({ path: SHOTS + '/f12-17-star-chest.png' });
  note('F12-17', { ...r, consoleErrors: errors.slice(0, 3),
    codeSymbol: 'js/hub.js:313 and :457 — onclick is a no-op unless chestState().ready; nothing tells the child what it is or when it opens' });
  await ctx.close();
}

// ---------------------------------------------------------------- F12-18
{
  const { ctx, page } = await fresh();
  await page.evaluate(() => window.BooTown.go('bubblepop'));
  await page.waitForTimeout(1300);
  await page.evaluate(() => window.__intro && window.__intro.close());
  await page.waitForTimeout(600);
  const r = await page.evaluate(async () => {
    const markup = () => document.querySelector('.hearts-wrap')?.innerHTML.slice(0, 240) ?? null;
    const before = markup();
    return { heartsMarkup: before, heartsWrapAria: document.querySelector('.hearts-wrap')?.getAttribute('aria-label') ?? null,
      docComment: 'js/gameshell.js:2 — "hearts (informational, round never ends early)"' };
  });
  note('F12-18', { ...r,
    codeSymbol: 'js/gameshell.js:89 dimHeart() decrements and repaints only; no caller ends a round on 0. BY-DESIGN per the file header — the defect is that nothing on screen SAYS so.' });
  await ctx.close();
}

await browser.close();
writeFileSync('screenshots/run12/triage/evidence.json', JSON.stringify(out, null, 2));
console.log('\n\n=== RUN12 S0 PROBE COMPLETE ===');
console.log('screenshots + evidence.json →', SHOTS);
