// tests/shoot-mechanics.mjs — live frames of Boo Pop + Boo Blocks mid-round
// (question → puzzle action → reward visible in each).
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
mkdirSync('screenshots/mechanics', { recursive: true });
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SAVE = { version: 5, name: 'Ada', guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' }, inventory: { boo_inky: 1 }, boxes: 0, meter: 0, opened: 1, pity: { commons: 0 }, nicknames: {}, equips: {}, catBest: {}, town: [], stars: { total: 20, byGame: {} }, ledger: {}, settings: { sound: false, music: false, voice: false, content: 'full' }, seen: { trophyRetro: true, introSeen: { bubblepop: 1, feedboos: 1, spellboo: 1, blocks: 1, bounce: 1, beat: 1, dash: 1, clockshop: 1, boopop: 1, teachme: 1 } }, ageAsked: true, age: 8 };

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 1000, height: 625 } })).newPage();
await page.goto(BASE + '/index.html', { waitUntil: 'load' });
await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), SAVE);
await page.reload({ waitUntil: 'load' });
await page.waitForSelector('.hub');

// Boo Pop: board, then a swap mid-pop, then the refill
await page.evaluate(() => window.BooTown.go('boopop'));
await page.waitForSelector('.start-card');
await page.click('.level-btn:has-text("Make 10")');
await page.waitForSelector('.bp-board .bp-gem');
await sleep(500);
await page.screenshot({ path: 'screenshots/mechanics/boopop-1-board.png' });
const mv = await page.evaluate(() => window.__boopop.findMove());
await page.evaluate((m) => { window.__boopop.swap(m.from[0], m.from[1], m.to[0], m.to[1]); return true; }, mv);
await sleep(300);
await page.screenshot({ path: 'screenshots/mechanics/boopop-2-pop.png' });
await sleep(800);
await page.screenshot({ path: 'screenshots/mechanics/boopop-3-refilled.png' });

// Boo Blocks: question card + tray, answer correctly, place a piece
await page.evaluate(() => window.BooTown.go('blocks'));
await page.waitForSelector('.start-card');
await page.click('.level-row .level-btn');
await page.waitForSelector('.blk-board');
await sleep(500);
await page.screenshot({ path: 'screenshots/mechanics/blocks-1-question.png' });
await page.evaluate(() => window.__blocks.answer(window.__blocks.question().correct));
await sleep(600);
await page.screenshot({ path: 'screenshots/mechanics/blocks-2-piece-earned.png' });
console.log('done');
await browser.close();
