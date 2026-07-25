// tests/lib/run12probe2.mjs — RUN12 S0 triage, pass 2 (NOT a suite).
// Pass 1 landed several games on their start card rather than in a live round. This pass
// enters each round properly (params.resume) and re-collects the affected rows.
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

const CONTRAST_FN = `
  window.__lum = (rgb) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); };
    return 0.2126*f(rgb[0]) + 0.7152*f(rgb[1]) + 0.0722*f(rgb[2]); };
  window.__parse = (s) => (String(s).match(/[0-9.]+/g) || []).slice(0,4).map(Number);
  window.__ratio = (fg, bg) => { const a = window.__lum(fg), b = window.__lum(bg);
    return (Math.max(a,b) + 0.05) / (Math.min(a,b) + 0.05); };
  window.__bgOf = (node) => { let el = node;
    while (el && el.nodeType === 1) { const c = window.__parse(getComputedStyle(el).backgroundColor);
      if (c.length >= 3 && (c.length === 3 || c[3] >= 0.999)) return [c[0],c[1],c[2]]; el = el.parentElement; }
    return [255,255,255]; };
`;

const browser = await chromium.launch({ args: RESOLVE });
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

// ---------------------------------------------------------------- F12-05 (live Boo Beat round)
{
  const { ctx, page } = await fresh();
  await page.evaluate(() => window.BooTown.go('beat', { resume: { mix: true } }));
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.__intro && window.__intro.close());
  await page.waitForTimeout(4500);
  const r = await page.evaluate(() => {
    const lanes = [...document.querySelectorAll('.beat-lane')];
    return lanes.map((l, i) => {
      const n = l.querySelector('.beat-note');
      const cs = getComputedStyle(n || l);
      const fg = window.__parse(cs.color).slice(0, 3);
      const bg = n ? window.__parse(getComputedStyle(n).backgroundColor).slice(0, 3) : window.__bgOf(l);
      return { lane: i + 1, hasNote: !!n, noteText: n ? n.textContent.trim() : null,
        textColor: cs.color, laneVar: getComputedStyle(l).getPropertyValue('--lane').trim(),
        noteBackground: n ? getComputedStyle(n).backgroundColor : null,
        contrastRatio: (fg.length === 3 && bg.length === 3) ? +window.__ratio(fg, bg).toFixed(2) : null,
        passesAA_18pxBold_3to1: (fg.length === 3 && bg.length === 3) ? window.__ratio(fg, bg) >= 3 : null };
    });
  });
  await page.screenshot({ path: SHOTS + '/f12-05-beat-lanes.png' });
  note('F12-05', { lanes: r,
    cssSymbol: 'css/styles.css:1040 lanes take --lane from --pop/--zing/--star; :1044 .beat-note{background:var(--lane)} with ONE inherited text colour for all three' });
  await ctx.close();
}

// ---------------------------------------------------------------- F12-08 (intro over a live round)
{
  const { ctx, page } = await fresh({ save: save({ seen: { trophyRetro: true, lastStarsShown: 400, introSeen: {} } }) });
  await page.evaluate(() => window.BooTown.go('beat', { resume: { mix: true } }));
  await page.waitForTimeout(1200);
  const beat = await page.evaluate(async () => {
    const introUp = !!document.querySelector('.intro-overlay');
    const snap = () => ({ notes: document.querySelectorAll('.beat-note').length,
      hearts: document.querySelector('.hearts-wrap')?.innerHTML.length ?? null,
      dots: document.querySelectorAll('.progress-dots .idot.on, .progress-dots .dot.on').length,
      heartsOff: (document.querySelector('.hearts-wrap')?.innerHTML.match(/off|dim/g) || []).length });
    const a = snap();
    await new Promise(r => setTimeout(r, 8000));
    const b = snap();
    return { introOverlayUp: introUp, overlayStillUp: !!document.querySelector('.intro-overlay'),
      atOpen: a, after8s: b,
      roundAdvancedBehindOverlay: a.notes !== b.notes || a.heartsOff !== b.heartsOff };
  });
  await page.screenshot({ path: SHOTS + '/f12-08-beat-intro-over-live-round.png' });

  await page.evaluate(() => window.BooTown.go('flashboos'));
  await page.waitForTimeout(1000);
  const flash = await page.evaluate(async () => {
    const introUp = !!document.querySelector('.intro-overlay');
    const snap = () => ({ phase: window.__flashboos ? window.__flashboos.phase() : 'n/a',
      round: window.__flashboos ? window.__flashboos.round() : null,
      curtainClass: document.querySelector('.flash-curtain')?.className ?? null });
    const a = snap();
    await new Promise(r => setTimeout(r, 6000));
    const b = snap();
    return { introOverlayUp: introUp, overlayStillUp: !!document.querySelector('.intro-overlay'),
      atOpen: a, after6s: b, revealRanBehindOverlay: a.phase !== b.phase };
  });
  await page.screenshot({ path: SHOTS + '/f12-08-flash-intro-over-reveal.png' });
  note('F12-08', { beat, flashboos: flash,
    codeSymbol: 'js/intro.js:94 runIntro() exposes only { close }; maybeIntro() is fire-and-forget and no game suspends anything' });
  await ctx.close();
}

// ---------------------------------------------------------------- F12-10 (live Echo round)
{
  const { ctx, page } = await fresh();
  await page.evaluate(() => window.BooTown.go('echoboos', { resume: true }));
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.__intro && window.__intro.close());
  await page.waitForTimeout(900);
  const lit = await page.evaluate(() => {
    const boo = document.querySelector('.echo-boo');
    if (!boo) return { error: 'no podium mounted' };
    const read = () => { const c = getComputedStyle(boo); return { filter: c.filter, transform: c.transform, boxShadow: c.boxShadow, outlineWidth: c.outlineWidth }; };
    const unlit = read();
    boo.classList.add('lit');
    const on = read();
    boo.classList.remove('lit');
    return { booColourVar: getComputedStyle(boo).getPropertyValue('--boo').trim(),
      ariaLabel: boo.getAttribute('aria-label'), unlit, lit: on,
      filterActuallyChanged: unlit.filter !== on.filter,
      transformActuallyChanged: unlit.transform !== on.transform };
  });
  await page.screenshot({ path: SHOTS + '/f12-10-echo-live.png' });
  note('F12-10-lit', { ...lit,
    cssSymbol: 'css/styles.css:862 .echo-boo.lit — filter includes drop-shadow(... var(--boo)); measured against the live podium' });
  await ctx.close();
}

// ---------------------------------------------------------------- F12-13 / F12-18 (live Bubble Pop)
{
  const { ctx, page } = await fresh();
  await page.evaluate(() => window.BooTown.go('bubblepop', { resume: { mix: true } }));
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.__intro && window.__intro.close());
  await page.waitForTimeout(900);
  const hearts = await page.evaluate(() => ({
    heartsMarkup: document.querySelector('.hearts-wrap')?.innerHTML.slice(0, 200) ?? null,
    heartsAria: document.querySelector('.hearts-wrap')?.getAttribute('aria-label') ?? null,
    anyExplanatoryText: /heart/i.test(document.body.innerText)
  }));
  const starsBefore = await page.evaluate(() => window.BooTown.State.getState().stars.total);
  await page.evaluate(() => document.querySelector('.game-topbar .back-btn')?.click());
  await page.waitForTimeout(900);
  const dlg = await page.evaluate(() => {
    const nodes = [...document.querySelectorAll('div,section')].filter(n => /Leave this round/i.test(n.textContent) && n.children.length < 8);
    const d = nodes[nodes.length - 1];
    return { found: !!d, cls: d?.className ?? null, text: (d?.textContent || '').trim().slice(0, 200) };
  });
  await page.screenshot({ path: SHOTS + '/f12-13-leave-dialog.png' });
  const after = await page.evaluate(async () => {
    const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'Leave');
    b && b.click();
    await new Promise(r => setTimeout(r, 1200));
    return { stars: window.BooTown.State.getState().stars.total,
      screen: document.querySelector('#screen')?.firstElementChild?.className ?? null };
  });
  note('F12-13', { leaveDialog: dlg, starsBefore, afterLeaving: after, banked: after.stars - starsBefore,
    codeSymbol: 'js/gameshell.js:20-29 — the dialog body is "Your stars won\'t be saved." and onBack() runs with nothing awarded' });
  note('F12-18', { ...hearts,
    codeSymbol: 'js/gameshell.js:2 header "hearts (informational, round never ends early)"; :89 dimHeart() repaints only. BY-DESIGN; the defect is that nothing on screen says so.' });
  await ctx.close();
}

// ---------------------------------------------------------------- F12-15 (live Bubble Pop, phone)
{
  const { ctx, page } = await fresh({ viewport: { width: 390, height: 844 } });
  await page.evaluate(() => window.BooTown.go('bubblepop', { resume: { mix: true } }));
  await page.waitForTimeout(1200);
  await page.evaluate(() => window.__intro && window.__intro.close());
  await page.waitForTimeout(900);
  const samples = [];
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(1400);
    samples.push(await page.evaluate(() => {
      const hud = document.querySelector('.game-topbar')?.getBoundingClientRect();
      const field = document.querySelector('.bubble-field')?.getBoundingClientRect();
      const bubbles = [...document.querySelectorAll('.bubble')];
      let under = 0, above = 0, outside = 0; const worst = [];
      for (const b of bubbles) {
        const r = b.getBoundingClientRect();
        if (hud && r.top < hud.bottom) { under++; if (worst.length < 3) worst.push({ label: b.getAttribute('aria-label'), text: b.textContent.trim().slice(0, 8), top: Math.round(r.top), hudBottom: Math.round(hud.bottom), overlapPx: Math.round(hud.bottom - r.top) }); }
        if (r.bottom < 4) above++;
        if (field && (r.top < field.top || r.bottom > field.bottom)) outside++;
      }
      return { bubbles: bubbles.length, intersectingHUD: under, aboveViewport: above, outsideField: outside,
        fieldTop: field ? Math.round(field.top) : null, hudBottom: hud ? Math.round(hud.bottom) : null, worst };
    }));
  }
  await page.screenshot({ path: SHOTS + '/f12-15-bubblepop-390.png' });
  // hit-test: is the correct bubble actually reachable at the point it occupies?
  const hit = await page.evaluate(() => {
    const bubbles = [...document.querySelectorAll('.bubble')];
    const res = [];
    for (const b of bubbles.slice(0, 8)) {
      const r = b.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const top = document.elementFromPoint(cx, cy);
      res.push({ label: b.getAttribute('aria-label'), reachable: !!top && (top === b || b.contains(top)),
        blockedBy: top && !(top === b || b.contains(top)) ? (top.className || top.tagName) : null });
    }
    return res;
  });
  note('F12-15', { samples, hitTest: hit,
    codeSymbol: 'js/games/bubblepop.js:202 respawn only when y > H + size — nothing constrains the TOP edge against the HUD' });
  await ctx.close();
}

// ---------------------------------------------------------------- F12-16 (true first run through onboarding)
{
  const { ctx, page, errors } = await fresh({ save: null });
  await page.waitForTimeout(2500);
  const onboard = await page.evaluate(() => ({
    screen: document.querySelector('#screen')?.firstElementChild?.className ?? null,
    bodyStart: document.body.innerText.slice(0, 120)
  }));
  // finish onboarding the quick way, then look at the journal on the resulting save
  const r = await page.evaluate(async () => {
    const { getState } = await import('./js/state.js');
    const { journalEntries } = await import('./js/quests.js');
    const { todayKey } = await import('./js/state.js');
    return { today: todayKey(), save: !!getState(),
      journal: getState() ? journalEntries().map(e => ({ key: e.key, date: e.date, label: e.label })) : null,
      trophies: getState() ? Object.keys(getState().trophies || {}) : null };
  });
  await page.screenshot({ path: SHOTS + '/f12-16-first-run.png' });
  note('F12-16-firstrun', { onboard, ...r, consoleErrors: errors.slice(0, 3) });
  await ctx.close();
}

// ---------------------------------------------------------------- F12-16 (retro trophy award on a stars-rich save that never saw the room)
{
  const { ctx, page } = await fresh({ save: save({ seen: { lastStarsShown: 400 } }) });
  await page.evaluate(() => window.BooTown.go('hub'));
  await page.waitForTimeout(2600);
  const r = await page.evaluate(async () => {
    const { journalEntries } = await import('./js/quests.js');
    const { todayKey } = await import('./js/state.js');
    return { today: todayKey(),
      ceremonyShown: !!document.querySelector('.trophy-ceremony, .tc-title'),
      ceremonyTitle: document.querySelector('.tc-title')?.textContent ?? null,
      journal: journalEntries().map(e => ({ key: e.key, date: e.date, label: e.label })),
      trophies: Object.keys(window.BooTown.State.getState().trophies || {}) };
  });
  await page.screenshot({ path: SHOTS + '/f12-16-retro-award.png' });
  note('F12-16-retro', r);
  await ctx.close();
}

await browser.close();
writeFileSync('screenshots/run12/triage/evidence2.json', JSON.stringify(out, null, 2));
console.log('\n\n=== RUN12 S0 PROBE PASS 2 COMPLETE ===');
