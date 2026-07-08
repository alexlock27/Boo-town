// tests/m3-grownups.mjs — grown-ups corner: 3s cog hold, toggles, backup/restore, reset.
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
mkdirSync('screenshots', { recursive: true });
const errors = []; let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1024, height: 768 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/i.test(m.text())) errors.push(m.text()); });
page.on('pageerror', e => errors.push('PAGEERROR ' + e.message));

await page.goto(BASE + '/index.html', { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.setItem('bootown.save.v1', JSON.stringify({ version: 1, seen: { introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1, golden: 1 } }, name: 'Maya', guide: { body: 'sunshine', patch: 'cocoa', acc: 'bow', name: 'Twiggy' }, settings: { sound: true, music: true, voice: true } })));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForSelector('.hub');

console.log('== a stray tap on the cog does nothing ==');
await page.click('.cog-btn');
await page.waitForTimeout(300);
assert(!(await page.$('.grownups')), 'quick tap on cog does NOT open grown-ups');

console.log('== 3-second hold opens grown-ups ==');
const cog = await page.$('.cog-btn'); const cb = await cog.boundingBox();
await page.mouse.move(cb.x + cb.width / 2, cb.y + cb.height / 2);
await page.mouse.down();
await page.waitForTimeout(3300);
await page.mouse.up();
await page.waitForSelector('.grownups', { timeout: 3000 });
assert(true, 'held 3s -> grown-ups opened');
await page.waitForTimeout(300);
await page.screenshot({ path: 'screenshots/m3-grownups.png' });

console.log('== toggles change settings live ==');
const backupCode = await page.inputValue('.gu-code[readonly]');
assert(backupCode.startsWith('BOO1.'), 'backup code shown with BOO1. prefix');
// toggle Music off (2nd toggle)
const switches = await page.$$('.gu-switch');
await switches[1].click();
await page.waitForTimeout(100);
let music = await page.evaluate(() => window.BooTown.State.getState().settings.music);
assert(music === false, 'music toggled off in save');

console.log('== restore from a backup code ==');
await page.fill('.gu-code:not([readonly])', backupCode); // original code had music ON
await page.click('button:has-text("Restore from code")');
await page.waitForTimeout(1200); // it reloads
await page.waitForSelector('.hub', { timeout: 5000 });
const restored = await page.evaluate(() => window.BooTown.State.getState());
assert(restored.settings.music === true && restored.name === 'Maya', 'restore reapplied the saved code (music back on, name Maya)');

console.log('== reset needs typed RESET ==');
const cog2 = await page.$('.cog-btn'); const cb2 = await cog2.boundingBox();
await page.mouse.move(cb2.x + cb2.width / 2, cb2.y + cb2.height / 2);
await page.mouse.down(); await page.waitForTimeout(3300); await page.mouse.up();
await page.waitForSelector('.grownups');
const resetBtnDisabledBefore = await page.getAttribute('.gu-danger .btn.danger', 'disabled');
assert(resetBtnDisabledBefore !== null, 'reset button disabled until RESET typed');
await page.fill('.gu-danger .text-input', 'RESET');
await page.waitForTimeout(100);
const resetBtnDisabledAfter = await page.getAttribute('.gu-danger .btn.danger', 'disabled');
assert(resetBtnDisabledAfter === null, 'reset button enabled after typing RESET');
await page.click('.gu-danger .btn.danger');
await page.waitForSelector('.ob-splash', { timeout: 4000 });
const cleared = await page.evaluate(() => localStorage.getItem('bootown.save.v1'));
assert(cleared === null, 'reset cleared the save and returned to onboarding');

console.log('== errors ==');
if (errors.length) console.log(errors.map(e => '  ! ' + e).join('\n'));
assert(errors.length === 0, 'no JS console errors');

await browser.close();
console.log('\n' + (failed ? 'RESULT: FAIL' : 'RESULT: PASS'));
process.exit(failed ? 1 : 0);
