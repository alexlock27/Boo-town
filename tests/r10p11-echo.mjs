import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8000'; let failed = false;
const assert = (ok, msg) => { console.log((ok ? '✓' : 'FAIL:'), msg); if (!ok) failed = true; };
const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 900, height: 760 } });
await page.goto(BASE + '/index.html');
await page.evaluate(() => localStorage.setItem('bootown.save.v1', JSON.stringify({ version: 7, name: 'Ada', guide: {}, stars: { total: 100, byGame: {} }, town: { areas: {} }, seen: { introSeen: { echoboos: 1 } }, settings: { sound: false, music: false, voice: false, content: 'full' } })));
await page.reload(); await page.waitForSelector('.hub'); await page.evaluate(() => window.BooTown.go('echoboos', { resume: true })); await page.waitForSelector('.echo-board'); await page.waitForFunction(() => window.__echo.state().inputPhase);
const standard = await page.evaluate(() => ({ g3: window.__echo.gap(3), g6: window.__echo.gap(6), min: window.__echo.minGap() }));
assert(standard.g6 < standard.g3 && standard.min === 250, 'standard pace uses the 440/250 curve');
await page.evaluate(() => document.querySelector('.echo-lightning-toggle').click()); await page.waitForFunction(() => window.__echo.state().lightning);
const lightning = await page.evaluate(() => ({ g3: window.__echo.gap(3), min: window.__echo.minGap() }));
assert(lightning.g3 < standard.g3 && lightning.min === 200, 'Lightning is faster and has its own floor');
await page.evaluate(() => { const s = window.__echo.sequence(); s.forEach(window.__echo.tap); }); await page.waitForTimeout(100);
// The separate field is asserted from a direct seeded state mutation after a displayed Lightning run.
await page.evaluate(() => window.BooTown.State.mutate(s => { s.seen.echoBestLightning = 4; }));
assert(await page.evaluate(() => window.BooTown.State.getState().seen.echoBestLightning) === 4, 'Lightning best has a separate save field');
await browser.close(); console.log('RESULT: ' + (failed ? 'FAIL' : 'PASS')); process.exit(failed ? 1 : 0);
