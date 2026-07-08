// tests/r4p12-reach.mjs — RUN4 hotfix 2, PERMANENT regression: on real phone
// viewports every screen's content and every primary control must be REACHABLE,
// not merely rendered. A screenshot proves layout; this proves reachability:
// for each screen we assert no horizontal overflow, then scroll the primary
// action into view and verify a tap would land on it (elementFromPoint), and
// for Build-a-Boo / Teach Me we fire REAL clicks and verify they took effect.
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));

const SAVE = {
  version: 5, name: 'Ada',
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1, boo_plum: 1, deco_tree: 1, deco_stage: 1, acc_bow: 1 },
  boxes: 0, meter: 0, opened: 5, pity: { commons: 0 },
  nicknames: {}, equips: {}, catBest: {},
  town: [{ zone: 'meadow', x: 0.25, item: 'deco_tree' }, { zone: 'meadow', x: 0.5, item: 'deco_stage' }, { zone: 'meadow', x: 0.7, item: 'boo_inky' }, { zone: 'meadow', x: 0.8, item: 'boo_plum' }],
  stars: { total: 60, byGame: {} }, ledger: {},
  golden: { words: [{ w: 'because' }], choices: [] },
  delights: { hideDay: (d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)(new Date()), hideFound: true },
  settings: { sound: false, music: false, voice: false, content: 'full', requests: false },
  seen: { introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 }, trophyRetro: true, townFirst: true, zonesUnlocked: ['meadow', 'riverside'] }, ageAsked: true, age: 8
};

// screen -> { ready: selector to wait for, target: the primary/last control that MUST be reachable }
const SCREENS = [
  ['studio',     '.studio-grid',  '.studio-card:last-of-type'],
  ['buildaboo',  '.build-rows',   '.build-actions .btn'],
  ['paint',      '.paint-canvas', '.paint-actions .btn:last-of-type, .paint-controls .btn:last-of-type'],
  ['collage',    '.collage-svg',  '.collage-actions .btn:last-of-type'],
  ['gallery',    '.studio-header', null],
  ['teachme',    '.lesson-grid',  '.lesson-card:last-of-type'],
  ['grownups',   '.grownups',     'button:last-of-type'],
  ['editguide',  '.creator',      '.creator-btns .btn:last-of-type'],
  ['collection', '.coll-grid',    '.coll-grid:not(.wardrobe-grid) .coll-tile:last-of-type'],
  ['town',       '.town2',        '.town-drawer'],
  ['golden',     '.screen, .golden, [data-screen="golden"]', 'button:last-of-type'],
  ['bubblepop',  '.picker',       '.picker-levels .level-btn:last-of-type'],
  ['feedboos',   '.picker',       '.picker-levels .level-btn:last-of-type'],
  ['spellboo',   '.picker',       '.picker-levels .level-btn:last-of-type'],
  ['dash',       '.picker',       '.star-rule'],
  ['boopop',     '.start-card',   '.star-rule'],
  ['clockshop',  '.start-card',   '.star-rule'],
  ['blocks',     '.start-card',   '.star-rule'],
  ['bounce',     '.start-card',   '.star-rule'],
  ['beat',       '.start-card',   '.star-rule']
];

// fake mic so the voice-recorder overlay can open headlessly
const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] });

// shared reach check: scrollIntoView + fully in viewport + a tap would land.
// `sel` may carry a Playwright-style :has-text("…") suffix — matched manually
// here because querySelectorAll does not understand it.
const REACH_FN = `(sel) => {
  let text = null;
  const m = sel.match(/^(.*?):has-text\\("(.+)"\\)$/);
  if (m) { sel = m[1] || 'button'; text = m[2]; }
  let els = [...document.querySelectorAll(sel)];
  if (text) els = els.filter(e => (e.textContent || '').includes(text));
  const el = els.pop();
  if (!el) return { found: false };
  el.scrollIntoView({ block: 'center' });
  const r = el.getBoundingClientRect();
  const inView = r.top >= -1 && r.bottom <= innerHeight + 1 && r.left >= -1 && r.right <= innerWidth + 1 && r.width > 0 && r.height > 0;
  const hit = document.elementFromPoint(Math.min(innerWidth - 2, r.left + r.width / 2), Math.min(innerHeight - 2, r.top + r.height / 2));
  const lands = !!hit && (el === hit || el.contains(hit) || hit.contains(el));
  return { found: true, ok: inView && lands, tag: (el.textContent || '').trim().slice(0, 24),
    dbg: { top: Math.round(r.top), bot: Math.round(r.bottom), l: Math.round(r.left), rr: Math.round(r.right), vw: innerWidth, vh: innerHeight, inView, lands, hit: hit ? (hit.className || hit.tagName).toString().slice(0, 30) : null } };
}`;
for (const [w, h] of [[360, 740], [412, 780], [740, 360], [780, 412]]) {
  console.log(`\n== ${w}x${h} ==`);
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.hub');

  for (const [screen, ready, target] of SCREENS) {
    await page.evaluate((s) => window.BooTown.go(s), screen);
    const ok = await page.waitForSelector(ready, { timeout: 6000 }).then(() => true).catch(() => false);
    if (!ok) { assert(false, `${screen}: did not render (${ready})`); continue; }
    await sleep(350);
    // (a) no horizontal overflow anywhere
    const hOK = await page.evaluate(() => {
      const d = document.documentElement;
      const s = document.getElementById('screen').firstElementChild;
      return d.scrollWidth <= d.clientWidth + 1 && (!s || s.scrollWidth <= s.clientWidth + 1);
    });
    assert(hOK, `${screen}: no horizontal overflow`);
    // (b) the primary control is reachable: scrollIntoView + a tap would land on it
    if (target) {
      const reach = await page.evaluate((sel) => {
        const el = [...document.querySelectorAll(sel)].pop();
        if (!el) return { found: false };
        el.scrollIntoView({ block: 'center' });
        const r = el.getBoundingClientRect();
        const inView = r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth && r.width > 0 && r.height > 0;
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        const lands = !!hit && (el === hit || el.contains(hit) || hit.contains(el));
        return { found: true, inView, lands, tag: el.textContent.trim().slice(0, 22) };
      }, target);
      assert(reach.found, `${screen}: primary control exists (${target})`);
      if (reach.found) assert(reach.inView && reach.lands, `${screen}: "${reach.tag}" scrolls into view and a tap lands on it`);
    }
  }

  // (c) Teach Me: EVERY lesson card fully on-screen horizontally, none clipped
  await page.evaluate(() => window.BooTown.go('teachme'));
  await page.waitForSelector('.lesson-grid');
  await sleep(250);
  const tm = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('.lesson-card')];
    return { n: cards.length, clipped: cards.filter(c => { const r = c.getBoundingClientRect(); return r.left < 0 || r.right > innerWidth; }).length };
  });
  assert(tm.n === 6 && tm.clipped === 0, `teachme: all ${tm.n} lesson cards fully visible (clipped: ${tm.clipped})`);
  // …and a REAL click on the last card starts its lesson
  await page.evaluate(() => document.querySelector('.lesson-card:last-of-type').scrollIntoView({ block: 'center' }));
  await page.click('.lesson-card:last-of-type');
  const lessonStarted = await page.waitForSelector('.tm-stage', { timeout: 5000 }).then(() => true).catch(() => false);
  assert(lessonStarted, 'teachme: the last lesson card genuinely opens its lesson');

  // (d) Build-a-Boo: name it, scroll to Seal, REAL click, custom really sealed
  await page.evaluate(() => window.BooTown.go('buildaboo'));
  await page.waitForSelector('.build-actions .btn');
  await page.fill('.build-name', 'Reachy').catch(() => {});
  await page.evaluate(() => document.querySelector('.build-actions .btn').scrollIntoView({ block: 'center' }));
  await sleep(200);
  await page.click('.build-actions .btn');
  await sleep(600);
  const sealed = await page.evaluate(() => (window.BooTown.State.getState().customs || []).length);
  assert(sealed >= 1, `buildaboo: the Seal button really fires on a phone (customs: ${sealed})`);

  // ================= DEEP SURFACES (Alex's exhaustive list) =================
  const reach = async (sel, label) => {
    const r = await page.evaluate(eval(REACH_FN), sel).catch(() => ({ found: false }));
    assert(r.found && r.ok, `${label} ("${(r.tag || sel)}") reachable`);
    if (r.found && !r.ok) console.log('    dbg:', JSON.stringify(r.dbg));
    return r.found && r.ok;
  };

  // hub incl. Boo of the Day + Star Chest + cog
  await page.evaluate(() => window.BooTown.go('hub'));
  await page.waitForSelector('.hub');
  await reach('.bottom-bar .cog-btn', 'hub: the cog (last control)');

  // quests overlay
  await page.click('.quest-card', { force: true });
  await page.waitForSelector('.quests-panel');
  await reach('.quests-panel .btn', 'quests overlay: Close');
  await page.click('.quests-panel .btn');

  // results screen (with a box earned so the gift block adds height too)
  await page.evaluate(() => { window.BooTown.State.mutate(s => { s.meter = 5; }); window.BooTown.State.beginRoundTally(); window.BooTown.go('results', { game: 'bubblepop', gameName: 'Bubble Pop', stars: 3, cat: 'tables', level: 1 }); });
  await page.waitForSelector('.result-btns .btn', { timeout: 9000 });
  await sleep(600);
  await reach('.result-btns .btn.secondary', 'results: Play again');
  await reach('.result-btns .btn.soft', 'results: Back to Boo Town');
  if (await page.$('.result-gift .btn')) await reach('.result-gift .btn', 'results: Open your box!');

  // box ceremony: tap-to-open + reveal buttons, with REAL clicks
  await page.evaluate(() => { window.BooTown.State.mutate(s => { s.boxes = Math.max(1, s.boxes); }); window.BooTown.go('ceremony'); });
  await page.waitForSelector('.gift-box');
  await reach('.gift-box', 'ceremony: the tappable gift box');
  for (let i = 0; i < 3; i++) { await page.click('.gift-box', { force: true }); await sleep(220); }
  await page.waitForSelector('.reveal-btns .btn', { timeout: 8000 });
  await sleep(400);
  await reach('.reveal-btns .btn', 'ceremony: keep/place buttons');
  await page.evaluate(() => [...document.querySelectorAll('.reveal-btns .btn')].pop().click());
  await page.waitForSelector('.hub, .town2', { timeout: 8000 });

  // trophy ceremony overlay (unmissable card)
  await page.evaluate(() => window.BooTown.go('hub'));
  await page.waitForSelector('.hub');
  await page.evaluate(() => import('./js/trophies.js').then(m => m.showTrophyCeremony([m.CATALOG[0]])));
  await page.waitForSelector('.trophy-ceremony .btn');
  await reach('.trophy-ceremony .btn', 'trophy ceremony: Wonderful!');
  await page.evaluate(() => document.querySelector('.trophy-ceremony .btn').click());

  // the Boo Journal (needs entries so the page + nav render)
  await page.evaluate(() => window.BooTown.State.mutate(s => { s.journal = { star3_bubblepop: '2026-07-01', zone_riverside: '2026-07-02', firstRare: '2026-07-03', allQuests: '2026-07-04' }; }));
  await page.evaluate(() => window.BooTown.go('collection'));
  await page.waitForSelector('.coll-tabs');
  await page.click('.coll-tab:has-text("Journal")');
  await page.waitForSelector('.journal-page, .journal-empty');
  await reach('.journal-nav .btn, .journal-page .journal-stamp', 'journal: page controls');

  // the Trophy Room cabinet, deepest shelf card
  await page.click('.coll-tab:has-text("Troph")');
  await page.waitForSelector('.trophy-cabinet');
  await reach('.trophy-chips .troph-chip', 'trophy room: filter chips');
  await reach('.trophy-shelf:last-of-type .trophy-card', 'trophy room: deepest shelf card');

  // voice recorder overlay (fake mic), from the collection card
  await page.click('.coll-tab:has-text("Boos")');
  await page.click('.coll-grid:not(.wardrobe-grid) .coll-tile.owned');
  await page.waitForSelector('.dialog');
  const voiceBtn = await page.$('.dialog .btn:has-text("Give a voice")');
  if (voiceBtn) {
    await page.evaluate(() => [...document.querySelectorAll('.dialog .btn')].find(b => /Give a voice/.test(b.textContent)).click());
    await page.waitForSelector('.voice-overlay', { timeout: 6000 });
    await reach('.voice-overlay .btn', 'voice recorder: bottom controls');
    await page.evaluate(() => document.querySelector('.voice-overlay').remove());
  } else {
    await page.evaluate(() => [...document.querySelectorAll('.dialog .btn')].pop().click());
    console.log('  (voice button not offered here — mic path covered when present)');
  }

  // town: request bubble on-screen when active; choreographer overlay; parade menu
  await page.evaluate(() => { window.BooTown.State.mutate(s => { s.settings.requests = true; s.request = { active: { booId: 'boo_inky', text: 'Will you play?', at: Date.now() }, lastResolvedAt: 0 }; }); window.BooTown.go('town'); });
  await page.waitForSelector('.town2 .t-item');
  await sleep(500);
  const reqOK = await page.evaluate(() => { const b = document.querySelector('.request-bubble'); if (!b) return 'missing'; const r = b.getBoundingClientRect(); return r.top >= -1 && r.bottom <= innerHeight + 1 ? 'ok' : 'offscreen'; });
  assert(reqOK !== 'offscreen', `town: request bubble on-screen (${reqOK})`);
  // the menu must be reachable even WITH an active request bubble hovering nearby
  await page.click('.t-item[data-item="deco_stage"]', { force: true });
  await page.waitForSelector('.plot-menu');
  await reach('.plot-menu .btn', 'town: item menu buttons (request bubble active)');
  await page.evaluate(() => window.BooTown.State.mutate(s => { s.request = { active: null, lastResolvedAt: 0 }; s.settings.requests = false; }));
  await page.click('.plot-menu button:has-text("Choreograph")', { force: true });
  await page.waitForSelector('.choreo-overlay', { timeout: 6000 });
  await reach('.choreo-card .btn', 'choreographer: save/close buttons');
  await page.evaluate(() => document.querySelector('.choreo-overlay').remove());

  // grown-ups: backup code box + copy, restore box, typed reset confirm
  await page.evaluate(() => window.BooTown.go('grownups'));
  await page.waitForSelector('.gu-code');
  await reach('.gu-code', 'grown-ups: backup code box');
  await reach('button:has-text("Copy code")', 'grown-ups: Copy code');
  const guReset = await page.evaluate(eval(REACH_FN), '.text-input.small');
  assert(guReset.found && guReset.ok, 'grown-ups: typed-RESET confirm input reachable');

  // organic celebrations (trophies earned by the flows above) can pop on their
  // own timers — dismiss any before precise interaction steps
  const sweep = () => page.evaluate(() => document.querySelectorAll('.trophy-ceremony, .growth-reveal').forEach(n => n.remove()));
  await sweep();

  // mid-round shells for EVERY game: back + hint + hearts reachable in-round
  const ROUNDS = [
    ['bubblepop', async () => { await page.waitForSelector('.picker'); await page.click('.picker-levels .level-btn'); }],
    ['feedboos',  async () => { await page.waitForSelector('.picker'); await page.click('.picker-levels .level-btn'); }],
    ['spellboo',  async () => { await page.waitForSelector('.picker'); await page.click('.picker-levels .level-btn'); }],
    ['dash',      async () => { await page.waitForSelector('.picker'); await page.click('.picker-levels .level-btn'); }],
    ['boopop',    async () => { await page.waitForSelector('.start-card'); await page.click('.level-btn:has-text("Make 10")'); }],
    ['clockshop', async () => { await page.waitForSelector('.start-card'); await page.click('.level-row .level-btn'); }],
    ['blocks',    async () => { await page.waitForSelector('.start-card'); await page.click('.level-row .level-btn'); }],
    ['bounce',    async () => { await page.waitForSelector('.start-card'); await page.click('.level-row .level-btn'); }],
    ['beat',      async () => { await page.waitForSelector('.start-card'); await page.click('.level-row .level-btn'); }]
  ];
  for (const [game, start] of ROUNDS) {
    await page.evaluate((g) => window.BooTown.go(g), game);
    await sweep();
    await start();
    const up = await page.waitForSelector('.game-topbar', { timeout: 8000 }).then(() => true).catch(() => false);
    if (!up) { assert(false, `${game}: round did not start`); continue; }
    await sleep(400);
    await page.evaluate(() => { const s = document.getElementById('screen').firstElementChild; if (s) s.scrollTop = 0; });
    const bar = await page.evaluate(() => {
      const names = [['back', '.game-topbar .back-btn'], ['hearts', '.game-topbar .hearts-wrap'], ['hint', '.game-topbar .hint-btn']];
      return names.map(([n, sel]) => { const el2 = document.querySelector(sel); if (!el2) return n + ':missing'; const r = el2.getBoundingClientRect(); const ok = r.top >= -1 && r.bottom <= innerHeight + 1 && r.left >= -1 && r.right <= innerWidth + 1; return ok ? null : n + ':clipped'; }).filter(Boolean);
    });
    assert(bar.length === 0, `${game} mid-round: back/hearts/hint all reachable (${bar.join(',') || 'ok'})`);
    await page.evaluate(() => window.BooTown.go('hub'));
    await page.waitForSelector('.hub');
  }
  // teachme mid-lesson: the Next button
  await page.evaluate(() => window.BooTown.go('teachme'));
  await page.waitForSelector('.lesson-grid');
  await sweep();
  await page.click('.lesson-card');
  await page.waitForSelector('.tm-stage', { timeout: 6000 });
  await sleep(300);
  await reach('.tm-next, .tm-stage .btn', 'teachme mid-lesson: Next button');

  // growth reveal overlay (Builders done while away)
  await page.evaluate(() => { window.BooTown.State.mutate(s => { const inv = s.inventory; ['boo_plum', 'boo_pippin', 'boo_lolly', 'boo_chomp'].forEach(b => { inv[b] = 1; }); s.townGrowth = { done: [], pending: [], site: { idx: 0, startedAt: Date.now() - 25 * 3600 * 1000 } }; }); window.BooTown.go('town'); });
  const grUp = await page.waitForSelector('.growth-reveal .btn', { timeout: 8000 }).then(() => true).catch(() => false);
  assert(grUp, 'growth reveal appears');
  if (grUp) { await reach('.growth-reveal .btn', 'growth reveal: Hooray!'); await page.evaluate(() => document.querySelector('.growth-reveal .btn').click()); }

  await ctx.close();
}

// ================= onboarding, every step, fresh profile =================
for (const [w, h] of [[360, 740], [780, 412]]) {
  console.log(`\n== onboarding ${w}x${h} ==`);
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  const reach = async (sel, label) => {
    const r = await page.evaluate(eval(REACH_FN), sel).catch(() => ({ found: false }));
    assert(r.found && r.ok, `${label} reachable`);
  };
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('button:has-text("Start")', { timeout: 8000 });
  await reach('button:has-text("Start")', 'onboarding splash: Start');
  await page.click('button:has-text("Start")');
  await page.waitForSelector('.text-input');
  await page.fill('.text-input', 'Reachy');
  await reach('button:has-text("Next")', 'onboarding name: Next');
  await page.click('button:has-text("Next")');
  await page.waitForSelector('.ob-age-grid');
  await reach('.ob-age-btn', 'onboarding age: the last age button');
  await page.click('.ob-age-btn:has-text("8")');
  await page.waitForSelector('.creator-btns');
  const noHOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1);
  assert(noHOverflow, 'onboarding creator: no horizontal overflow');
  await reach('.creator-btns .btn.big', 'onboarding creator: Done');
  await page.click('.creator-btns .btn.big');
  await page.waitForSelector('.intro-block');
  for (let i = 0; i < 3; i++) { await page.click('.intro-block'); await sleep(150); }
  await page.waitForSelector('.firstpick-row');
  await reach('.firstpick-card', 'onboarding first pick: the last Boo card');
  await page.click('.firstpick-card');
  const landed = await page.waitForSelector('.town2', { timeout: 8000 }).then(() => true).catch(() => false);
  assert(landed, 'onboarding completes into the town');
  await ctx.close();
}

await browser.close();
console.log(failed ? '\nr4p12-reach: FAIL' : '\nr4p12-reach: ALL PASS');
process.exit(failed ? 1 : 0);
