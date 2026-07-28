// shoot-y56boot.mjs — shared boot helper for the RUN18B Y5/Y6 critic pass. Delete when done.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const RAW = process.env.BASE || 'http://127.0.0.1:8000';
export const BASE = RAW.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
export const RESOLVE = ['--host-resolver-rules=MAP app.localhost 127.0.0.1'];

const AK = ['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground', 'boohouse', 'gallery'];
export const save = (over = {}) => JSON.stringify({
  version: 17, name: 'Ada', age: 9, ageAsked: true,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1, boo_plum: 1, boo_pippin: 1, acc_sunhat: 1 },
  stars: { total: 2000, byType: { maths: 500, word: 500, puzzle: 500, creative: 500, lesson: 500 }, spent: {}, legacy: 500, byGame: {} },
  trophies: {}, boxes: 0,
  town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 3 },
  shop: { welcomed: true },
  seen: { trophyRetro: true, lastStarsShown: 2000, introSeen: { feedboos: true, echoboos: true }, whatsnewVersion: 'x' },
  settings: { sound: false, music: false, voice: false, content: 'full', haptics: true },
  ...over
});

export function makeShots(dir) { mkdirSync(dir, { recursive: true }); return dir; }

export async function launch() { return chromium.launch({ args: RESOLVE }); }

export async function open(browser, route, params = {}, opts = {}) {
  const ctx = await browser.newContext({
    viewport: { width: opts.w || 1024, height: opts.h || 768 },
    reducedMotion: opts.reduced ? 'reduce' : 'no-preference',
    deviceScaleFactor: 1
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e).split('\n')[0]));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 200)); });
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), save(opts.save || {}));
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => window.BooTown && document.getElementById('screen').dataset.screen, null, { timeout: 20000 });
  const t0 = Date.now();
  await page.evaluate(([r, p]) => window.BooTown.go(r, p), [route, params]);
  await page.waitForFunction(r => document.getElementById('screen').dataset.screen === r, route, { timeout: 15000 });
  return { ctx, page, errors, t0 };
}

// first moment there is something visible+enabled to tap inside #screen
export async function firstTappable(page, t0) {
  await page.waitForFunction(() => {
    const s = document.getElementById('screen');
    if (!s) return false;
    const els = s.querySelectorAll('button,[role="button"],[tabindex="0"],a[href]');
    for (const e of els) {
      if (e.disabled) continue;
      const r = e.getBoundingClientRect();
      if (r.width > 8 && r.height > 8 && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).opacity !== '0') return true;
    }
    return false;
  }, null, { timeout: 20000, polling: 16 });
  return Date.now() - t0;
}
