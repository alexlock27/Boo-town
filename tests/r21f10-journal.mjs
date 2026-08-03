// tests/r21f10-journal.mjs — RUN21F F10B: the play journal.
// ACCEPT: the journal captures a scripted minute and downloads; with the flag OFF there is
// ZERO trace in the DOM or in storage. Also proved here: off by default, never persisted on
// (a reload always comes back off), and nothing leaves the device — every request made
// while the journal is recording is a same-origin GET for an app file, and the download is
// a Blob, not a network call.
// Expected runtime: ~95s (a real scripted minute is part of the ACCEPT).
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const today = (d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)(new Date());

const AREA_KEYS = ['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground', 'boohouse', 'boohouse_kitchen', 'boohouse_bedroom', 'gallery'];
const SAVE = {
  version: 23, name: 'Ada', age: 8, ageAsked: true,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1, deco_bench: 1 },
  stars: { total: 400, byType: {}, spent: {} },
  town: { areas: Object.fromEntries(AREA_KEYS.map(k => [k, { items: k === 'meadow' ? [{ item: 'boo_inky', x: 0.12, row: 2 }, { item: 'deco_bench', x: 0.2, row: 2 }] : [], paths: [] }])) },
  wishes: { unlocked: {} },
  funfair: { built: [], build: null, pending: [], seats: {} },
  delights: { hideDay: today, hideFound: true },
  seen: { trophyRetro: true, townFirst: true, lastStarsShown: 400, whatsnewVersion: 'x', introSeen: { shop: 1 } },
  settings: { sound: false, music: false, voice: false, content: 'full', requests: false }
};

const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
async function open({ qa }) {
  const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
  if (qa) await page.addInitScript(() => { window.__bootownQA = true; });
  await page.goto(BASE + '/index.html', { waitUntil: 'load' });
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE);
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.BooTown && document.getElementById('screen').dataset.screen, null, { timeout: 30000 });
  return { ctx, page };
}
const openGrownups = async (page) => {
  await page.evaluate(() => window.BooTown.go('grownups'));
  await page.waitForSelector('.grownups', { timeout: 10000 });
  await page.click('.gu-tab[data-tab="data"]');
  await sleep(300);
};
const trace = page => page.evaluate(async () => (await import('./js/playjournal.js')).journalTrace());
// Everything a grown-up's device could be holding, in one shape.
const storageDump = page => page.evaluate(() => ({
  local: Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)])),
  session: Object.fromEntries(Object.keys(sessionStorage).map(k => [k, sessionStorage.getItem(k)])),
  cookie: document.cookie
}));

// ==================== 1. flag OFF: zero trace anywhere ====================
console.log('== with the QA flag off, the journal does not exist ==');
{
  const { ctx, page } = await open({ qa: false });
  const before = await storageDump(page);
  await openGrownups(page);
  // walk a little so anything that WOULD record has something to record
  for (const s of ['hub', 'worldmap', 'collection']) { await page.evaluate(n => window.BooTown.go(n), s); await sleep(500); }
  await page.mouse.click(512, 400);
  await sleep(300);
  await openGrownups(page);
  const dom = await page.evaluate(() => {
    const html = document.body.innerHTML;
    return {
      journalCards: document.querySelectorAll('.gu-journal').length,
      byLabel: [...document.querySelectorAll('[aria-label]')].filter(n => /session notes/i.test(n.getAttribute('aria-label'))).length,
      textHits: (html.match(/Session notes|Download notes/gi) || []).length,
      buttons: [...document.querySelectorAll('button')].filter(b => /session notes|download notes/i.test(b.textContent || '')).length
    };
  });
  assert(dom.journalCards === 0, `no journal card in the panel (${dom.journalCards})`);
  assert(dom.byLabel === 0 && dom.buttons === 0, 'no toggle and no download button anywhere in the DOM');
  assert(dom.textHits === 0, `the words never appear in the rendered markup (${dom.textHits} hits)`);
  const t = await trace(page);
  assert(t.qa === false && t.on === false && t.entries === 0 && t.listening === false,
    `the module itself is inert: ${JSON.stringify(t)}`);
  // nothing may be switched on from outside the flag either
  const forced = await page.evaluate(async () => {
    const j = await import('./js/playjournal.js');
    j.setJournalOn(true);
    return j.journalTrace();
  });
  assert(forced.on === false && forced.listening === false,
    'and it refuses to switch on at all while the flag is unset');
  const after = await storageDump(page);
  const keysAdded = Object.keys(after.local).filter(k => !(k in before.local));
  // NB the save legitimately carries quests.journal (stampJournal's milestone day-keys) —
  // a different thing entirely. What must never appear is anything of the PLAY journal's.
  const anyJournal = JSON.stringify(after).match(/playjournal|playJournal|sessionNotes|session notes|Boo Town session notes/i);
  assert(keysAdded.length === 0, `no storage key is created (${JSON.stringify(keysAdded)})`);
  assert(!anyJournal, 'nothing of the play journal appears in localStorage, sessionStorage or cookies');
  assert(after.cookie === '', 'no cookies (the app sets none)');
  await ctx.close();
}

// ==================== 2. flag ON: the card exists, and starts OFF ====================
console.log('== with the QA flag on, the card appears and the switch starts off ==');
let scripted = null;
{
  const { ctx, page } = await open({ qa: true });
  await openGrownups(page);
  const card = await page.evaluate(() => {
    const c = document.querySelector('.gu-journal');
    if (!c) return null;
    const sw = c.querySelector('.gu-switch');
    return { h: c.querySelector('h3').textContent, label: sw && sw.getAttribute('aria-label'), on: sw && sw.classList.contains('on'),
      dl: [...c.querySelectorAll('button')].map(b => b.textContent).filter(t => /download/i.test(t))[0] || null };
  });
  assert(!!card, 'the journal card is in the Grown-ups panel');
  assert(card && card.label === 'Session notes for grown-ups', `the toggle is the pack's exact label ("${card && card.label}")`);
  assert(card && card.on === false, 'and it is OFF by default');
  assert(card && card.dl === 'Download notes', `the panel offers "${card && card.dl}"`);

  // ---- switch it on with a real click, then play for a scripted minute ----
  console.log('== a scripted minute ==');
  const requests = [];
  page.on('request', r => requests.push({ url: r.url(), method: r.method() }));
  const sw = await page.$('.gu-journal .gu-switch');
  await sw.click();
  await sleep(300);
  assert((await trace(page)).on === true, 'the switch turns it on');

  const t0 = Date.now();
  const PLAN = [
    ['hub', null, 7000], ['worldmap', null, 6000], ['town', { area: 'meadow' }, 10000],
    ['collection', null, 6000], ['town', { area: 'beach' }, 9000], ['hub', null, 6000],
    ['town', { area: 'boohouse', room: 'kitchen' }, 9000], ['worldmap', null, 6000], ['hub', null, 7000]
  ];
  let taps = 0;
  for (const [name, params, dwell] of PLAN) {
    await page.evaluate(([n, p]) => window.BooTown.go(n, p || undefined), [name, params]);
    await sleep(700);
    const reveal = await page.$('.overlay.growth-reveal .btn');
    if (reveal) { await reveal.click(); await sleep(300); }
    // One real tap somewhere real on this screen — but never on a back control, or the
    // walk navigates itself and the dwell it measures is the harness's, not the plan's.
    const spot = await page.evaluate(() => {
      const back = n => /back|‹/i.test((n.getAttribute('aria-label') || '') + ' ' + (n.className || '') + ' ' + (n.textContent || '').slice(0, 3));
      const cands = [...document.querySelectorAll('#screen .t-item, #screen button')].filter(n => !back(n));
      for (const n of cands) {
        const r = n.getBoundingClientRect();
        if (r.width > 8 && r.height > 8 && r.top > 0) return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
      }
      return null;
    });
    if (spot) { await page.mouse.click(spot.x, spot.y); taps++; await sleep(300); }
    await sleep(Math.max(0, dwell - 1300));
  }
  const elapsed = Date.now() - t0;
  scripted = await page.evaluate(async () => (await import('./js/playjournal.js')).journalSnapshot());
  console.log(`    scripted ${(elapsed / 1000).toFixed(1)}s · ${scripted.screensVisited} screens · ${scripted.taps} taps`);
  assert(elapsed >= 60000, `the scripted session ran a real minute (${(elapsed / 1000).toFixed(1)}s)`);
  assert(scripted.screensVisited >= PLAN.length, `it captured every screen change (${scripted.screensVisited} >= ${PLAN.length})`);
  assert(scripted.taps >= taps, `it captured the taps (${scripted.taps} for ${taps} real clicks)`);
  assert(scripted.durationMs >= 60000, `it knows how long the session was (${Math.round(scripted.durationMs / 1000)}s)`);
  const dwells = Object.entries(scripted.dwellByScreen);
  const totalDwell = dwells.reduce((a, [, v]) => a + v, 0);
  assert(dwells.length >= 4 && dwells.every(([, v]) => v > 0), `it measured dwell per screen (${dwells.map(([k, v]) => k + ':' + Math.round(v / 1000) + 's').join(' ')})`);
  assert(totalDwell > scripted.durationMs * 0.8, `the dwell accounts for the session (${Math.round(totalDwell / 1000)}s of ${Math.round(scripted.durationMs / 1000)}s)`);
  const tapEntries = scripted.entries.filter(e => e.kind === 'tap');
  assert(tapEntries.every(e => typeof e.target === 'string' && e.target.length <= 80), 'every tap is a short, safe descriptor');
  assert(tapEntries.some(e => e.screen), 'and each tap knows which screen it happened on');

  // ---- nothing left the device ----
  const foreign = requests.filter(r => !r.url.startsWith(BASE) || r.method !== 'GET');
  assert(foreign.length === 0, `zero requests off-device while recording (${foreign.length}; ${requests.length} same-origin GETs for app files)`);

  // ---- and it downloads ----
  console.log('== the download ==');
  await openGrownups(page);
  // by text, NOT by position — the first button in the card is the toggle switch
  const dlBtn = page.locator('.gu-journal button', { hasText: 'Download notes' });
  assert(await dlBtn.count() === 1, 'the Download notes button is there to press');
  const [download] = await Promise.all([page.waitForEvent('download', { timeout: 15000 }), dlBtn.click()]);
  const name = download.suggestedFilename();
  assert(/^boo-town-session-notes-.*\.json$/.test(name), `it downloads as ${name}`);
  const path = await download.path();
  const { readFileSync } = await import('fs');
  const parsed = JSON.parse(readFileSync(path, 'utf8'));
  assert(parsed.app === 'Boo Town session notes', 'the file is the session notes');
  assert(parsed.entries.length === scripted.entries.length || parsed.entries.length > scripted.entries.length,
    `the file carries the notes (${parsed.entries.length} entries)`);
  assert(parsed.entries.some(e => e.kind === 'screen') && parsed.entries.some(e => e.kind === 'tap'),
    'screens and taps are both in the file');
  assert(Object.keys(parsed.dwellByScreen).length >= 4, 'and the per-screen dwell is in the file');
  const afterDl = await page.evaluate(() => document.querySelectorAll('a[download]').length);
  assert(afterDl === 0, 'the anchor that carried it is gone from the DOM');

  // ---- while recording it still writes NOTHING to storage ----
  const dump = JSON.stringify(await storageDump(page));
  const leak = dump.match(/playjournal|playJournal|sessionNotes|session notes|Boo Town session notes/i);
  assert(!leak, `even while recording, nothing of the play journal is written to storage${leak ? ' (found "' + leak[0] + '")' : ''}`);

  // ---- never persisted on: a reload comes back OFF ----
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.BooTown && document.getElementById('screen').dataset.screen, null, { timeout: 30000 });
  const afterReload = await trace(page);
  assert(afterReload.on === false && afterReload.entries === 0 && afterReload.listening === false,
    `a reload always comes back off (${JSON.stringify(afterReload)})`);
  await openGrownups(page);
  const swAfter = await page.evaluate(() => { const s = document.querySelector('.gu-journal .gu-switch'); return s ? s.classList.contains('on') : null; });
  assert(swAfter === false, 'and the switch in the panel reads off again');
  await ctx.close();
}

await browser.close();
console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
