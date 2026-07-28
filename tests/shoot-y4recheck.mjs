// tests/shoot-y4recheck.mjs — PLAYTEST CRITIC re-check part 6: what is actually ON TOP. Temporary.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'fs';
const RAW = process.env.BASE || 'http://127.0.0.1:8000';
const BASE = RAW.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
const RESOLVE = ['--host-resolver-rules=MAP app.localhost 127.0.0.1'];
const SHOTS = 'screenshots/y4recheck';
mkdirSync(SHOTS, { recursive: true });
const AK = ['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground', 'boohouse', 'gallery'];
const save = () => JSON.stringify({
  version: 17, name: 'Ada', age: 9, ageAsked: true,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1 }, stars: { total: 430, byType: { maths: 120, word: 96, puzzle: 70, creative: 64, lesson: 40 }, spent: {}, legacy: 40, byGame: {} },
  trophies: {}, boxes: 0, town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 3 }, shop: { welcomed: true },
  seen: { trophyRetro: true, lastStarsShown: 430, introSeen: { flashboos: true }, whatsnewVersion: 'x' },
  settings: { sound: false, music: false, voice: false, content: 'full' }
});
const browser = await chromium.launch({ args: RESOLVE });
const log = []; const say = (...a) => { const s = a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '); console.log(s); log.push(s); };
for (const [vw, vh] of [[1024, 768], [390, 844]]) {
  say(`\n===== @${vw}: is the prop in front, and is the right pupil visible? =====`);
  const ctx = await browser.newContext({ viewport: { width: vw, height: vh } });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(String(e).split('\n')[0]));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 140)); });
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), save());
  const rows = []; const shots = {};
  for (let n = 0; n < 40 && rows.length < 16; n++) {
    await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
    await page.waitForFunction(() => window.BooTown && document.getElementById('screen').dataset.screen, null, { timeout: 20000 });
    await page.evaluate(() => window.BooTown.go('flashboos'));
    await page.waitForFunction(() => document.getElementById('screen').dataset.screen === 'flashboos', null, { timeout: 15000 });
    await page.waitForTimeout(550);
    const hits = await page.evaluate(() => {
      const F = window.__flashboos, sc = F.scene();
      const cells = [...document.querySelectorAll('.flash-boo-row > *')];
      return sc.items.filter(i => i.pose === 'holding').map(it => {
        const b = sc.boos.find(x => x.id === it.booId), cell = cells[b.position];
        const boo = cell.querySelector('svg.boo-svg'), deco = cell.querySelector('svg.deco-svg');
        const br = boo.getBoundingClientRect(), dr = deco.getBoundingClientRect(), cr = cell.getBoundingClientRect();
        const own = el => el ? (deco.contains(el) || el === deco ? 'PROP' : (boo.contains(el) || el === boo ? 'BOO' : 'other:' + (el.className.baseVal || el.className || el.tagName))) : 'nothing';
        // the right pupil (fx .62, fy .63 of the Boo box) — what is on top of its centre?
        const pupilPt = { x: br.x + br.width * 0.62, y: br.y + br.height * 0.63 };
        const leftPupilPt = { x: br.x + br.width * 0.38, y: br.y + br.height * 0.63 };
        // the prop's own centre — is the prop the topmost thing there?
        const propPt = { x: dr.x + dr.width / 2, y: dr.y + dr.height / 2 };
        // how much of the prop's area is topmost (i.e. actually in front)?
        let front = 0, tot = 0;
        for (let i = 1; i < 10; i++) for (let j = 1; j < 10; j++) {
          const x = dr.x + dr.width * i / 10, y = dr.y + dr.height * j / 10; tot++;
          if (own(document.elementFromPoint(x, y)) === 'PROP') front++;
        }
        return { prop: it.prop, sp: b.species, c: b.colour,
          domOrder: [...cell.querySelectorAll('svg')].map(s => (s.getAttribute('class') || '').trim()).join(' > '),
          decoZ: getComputedStyle(deco).zIndex, booZ: getComputedStyle(boo).zIndex,
          topAtRightPupil: own(document.elementFromPoint(pupilPt.x, pupilPt.y)),
          topAtLeftPupil: own(document.elementFromPoint(leftPupilPt.x, leftPupilPt.y)),
          topAtPropCentre: own(document.elementFromPoint(propPt.x, propPt.y)),
          propAreaInFrontPct: Math.round(front / tot * 100),
          box: { x: Math.round(cr.x) - 8, y: Math.round(cr.y) - 8, width: Math.round(cr.width) + 16, height: Math.round(cr.height) + 16 } };
      });
    });
    for (const h of hits) {
      rows.push(h);
      const k = `${h.prop}-${h.sp}`;
      if (!shots[k]) { shots[k] = 1; await page.screenshot({ path: `${SHOTS}/TOP-${vw}-${k}-${h.c}.png`, clip: h.box }); }
    }
  }
  const seen = {};
  for (const r of rows) { const k = `${r.prop}/${r.sp}`; if (!seen[k]) { seen[k] = 1; say(`  ${k}: dom ${r.domOrder} · top at RIGHT pupil = ${r.topAtRightPupil} · at LEFT pupil = ${r.topAtLeftPupil} · at prop centre = ${r.topAtPropCentre} · prop area drawn in front = ${r.propAreaInFrontPct}%`); } }
  say(`  n=${rows.length} · right pupil covered by the prop in ${rows.filter(r => r.topAtRightPupil === 'PROP').length} · left pupil in ${rows.filter(r => r.topAtLeftPupil === 'PROP').length}`);
  say(`  prop-in-front area: min ${Math.min(...rows.map(r => r.propAreaInFrontPct))}% max ${Math.max(...rows.map(r => r.propAreaInFrontPct))}%`);
  say(`  errors: ${JSON.stringify(errors)}`);
  writeFileSync(`${SHOTS}/TOP-${vw}.json`, JSON.stringify(rows, null, 1));
  await ctx.close();
}
await browser.close();
writeFileSync(`${SHOTS}/log6.txt`, log.join('\n'));
say('\nDONE');
