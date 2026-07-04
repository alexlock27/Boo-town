// tests/r3p4-quests.mjs — RUN3 phase 4: daily quests + Boo Journal (D11, D12).
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const errors = []; let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SAVE = { version: 3, name: 'Ada', guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' }, inventory: {}, boxes: 0, meter: 0, opened: 0, pity: { commons: 0 }, nicknames: {}, equips: {}, catBest: {}, town: [], stars: { total: 60, byGame: {} }, spellingMastery: {}, ledger: {}, trickyPile: [], golden: { words: [{ w: 'test' }], choices: [] }, goldenLastDouble: '', quests: { day: '', list: [], done: [], progress: {}, boxDay: '' }, journal: {}, settings: { sound: false, music: false, voice: false }, seen: {} };

const EVENT_FOR = {
  spell2: ['roundEnd', { game: 'spellboo', stars: 2 }], playMaths: ['roundEnd', { game: 'bubblepop', stars: 1 }],
  visitTown: ['townVisit', {}], threeStar: ['roundEnd', { game: 'bubblepop', stars: 3 }], rescuePile: ['rescue', {}],
  dressUp: ['dressUp', {}], golden: ['roundEnd', { game: 'golden', stars: 1 }], blocks3: ['linesCleared', { count: 3 }],
  beat3: ['perfects', { count: 3 }], lesson: ['roundEnd', { game: 'teachme', stars: 1 }], hello5: ['sayHello', { count: 5 }], openBox: ['boxOpen', {}]
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 } });
const page = await ctx.newPage();
page.on('pageerror', e => errors.push('PE ' + e.message));
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(m.text()); });
await page.goto(BASE + '/index.html', { waitUntil: 'load' });
await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE);
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('.hub');
await page.evaluate(() => { window.__bootownDay = '2026-07-04'; });

// ---- D11: three quests today ----
console.log('== D11: daily quests ==');
const q0 = await page.evaluate(async () => { const m = await import('./js/quests.js'); return m.questState(); });
assert(q0.items.length === 3 && q0.day === '2026-07-04', 'exactly 3 quests for today');
assert(q0.doneCount === 0, 'start with 0 done');

// complete all three via their matching events; all-three awards a bonus box
const boxesBefore = await page.evaluate(() => window.BooTown.State.getState().boxes);
const res = await page.evaluate(async (EVENT_FOR) => {
  const m = await import('./js/quests.js');
  const ids = m.questState().items.map(i => i.id);
  let last;
  for (const id of ids) { const [e, d] = EVENT_FOR[id]; last = m.noteQuest(e, d); }
  return { ids, allDone: m.questState().allDone, boxes: window.BooTown.State.getState().boxes };
}, EVENT_FOR);
assert(res.allDone, 'completing the three quests marks all done (' + res.ids.join(',') + ')');
assert(res.boxes === boxesBefore + 1, 'all-three awards a bonus box (' + boxesBefore + ' -> ' + res.boxes + ')');

// box awarded ONCE per day: re-firing events does not award another
const boxesAfter2 = await page.evaluate(async (EVENT_FOR) => {
  const m = await import('./js/quests.js');
  const ids = m.questState().items.map(i => i.id);
  for (const id of ids) { const [e, d] = EVENT_FOR[id]; m.noteQuest(e, d); }
  return window.BooTown.State.getState().boxes;
}, EVENT_FOR);
assert(boxesAfter2 === res.boxes, 'the bonus box is awarded only once per day');

// ---- D11: reset at local midnight (new day -> fresh quests) ----
console.log('== D11: daily reset ==');
const nextDay = await page.evaluate(async () => {
  window.__bootownDay = '2026-07-05';
  const m = await import('./js/quests.js');
  const st = m.questState();
  return { day: st.day, done: st.doneCount, n: st.items.length };
});
assert(nextDay.day === '2026-07-05' && nextDay.n === 3 && nextDay.done === 0, 'a new local day offers three fresh quests, 0 done (no streak carried)');

// ---- D11: no streak / missed-day strings anywhere in the quests UI ----
console.log('== D11: no guilt strings ==');
await page.evaluate(() => { window.__bootownDay = '2026-07-05'; window.BooTown.go('hub'); });
await page.waitForSelector('.quest-card');
await page.click('.quest-card');
await page.waitForSelector('.quests-panel');
const uiText = await page.evaluate(() => document.body.innerText.toLowerCase());
assert(!/streak|missed|don'?t lose|day in a row|keep the streak/.test(uiText), 'no streak / missed-day guilt strings in the quests UI');
await page.evaluate(() => { const o = document.querySelector('.quests-overlay'); if (o) o.remove(); });

// ---- D12: Journal stamps fire once each with correct dates ----
console.log('== D12: Journal stamps ==');
const jr = await page.evaluate(async () => {
  window.__bootownDay = '2026-07-06';
  const m = await import('./js/quests.js');
  const first = m.stampJournal('firstRare');      // new
  const dup = m.stampJournal('firstRare');        // duplicate — must not re-date
  window.__bootownDay = '2026-07-07';
  const later = m.stampJournal('firstRare');       // still duplicate (already stamped)
  m.stampJournal('star3_bubblepop');
  const entries = m.journalEntries();
  return { first, dup, later, date: window.BooTown.State.getState().journal['firstRare'], entries };
});
assert(jr.first === true && jr.dup === false && jr.later === false, 'a stamp fires once; repeats are ignored');
assert(jr.date === '2026-07-06', 'the stamp keeps its original date (2026-07-06)');
assert(jr.entries.some(e => e.key === 'star3_bubblepop' && e.date), 'star3 stamp recorded with a date');
assert(jr.entries.every(e => e.label && e.icon && e.date), 'journal entries all have a label, icon and date');

// Journal tab renders the stickers
await page.evaluate(() => window.BooTown.go('collection'));
await page.waitForSelector('.coll-tab');
await page.click('.coll-tab:has-text("Journal")');
await page.waitForSelector('.journal-view');
const stickerCount = await page.$$eval('.journal-stamp', e => e.length);
assert(stickerCount >= 2, 'the Journal tab shows the earned stickers (' + stickerCount + ')');

console.log('\n== errors ==');
if (errors.length) console.log(errors.map(e => '  ! ' + e).join('\n'));
assert(errors.length === 0, 'no JS console errors');
await browser.close();
console.log('\n' + (failed ? 'RESULT: FAIL' : 'RESULT: PASS'));
process.exit(failed ? 1 : 0);
