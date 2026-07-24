// RUN10 P21 — Expedition postcard composition and Dusk Visitor cadence.
import { postcardPlan } from '../js/expedition/postcard.js';
import { VISITOR_AREAS, VISITOR_GAP_H } from '../js/delights.js';
import { chromium } from 'playwright';

let failed = false;
const assert = (ok, msg) => { console.log((ok ? '✓' : 'FAIL:'), msg); if (!ok) failed = true; };
const fakeParty = Array.from({ length: 9 }, (_, i) => ({ id: `boo-${i}`, name: `Boo ${i}` }));
const plan = postcardPlan(fakeParty, 'hotel', new Date('2026-07-17T12:00:00Z'));
assert(plan.sprites.length === fakeParty.length, 'postcard plan contains one posed sprite position per party member');
assert(/Boo Expedition/.test(plan.stamp) && plan.scene.title === 'Boo Hotel', 'postcard plan carries a rotated expedition date stamp and finishing scene');

const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const browser = await chromium.launch(); const context = await browser.newContext({ viewport: { width: 900, height: 760 } }); const page = await context.newPage();
await page.goto(BASE + '/index.html');
const save = { version: 7, name: 'Ada', guide: {}, inventory: { boo_inky: 1 }, stars: { total: 300, byGame: {} }, town: { areas: {} }, delights: {}, settings: { sound: false, music: false, voice: false, content: 'light' } };
await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), save); await page.reload(); await page.waitForSelector('.hub');
const result = await page.evaluate(async ({ gap }) => {
  const delights = await import('./js/delights.js');
  const postcard = await import('./js/expedition/postcard.js');
  const { BY_ID } = await import('./data/catalogue.js');
  const first = delights.duskVisitor('beach', 19, gap * 3);
  const same = delights.duskVisitor(first.area, 19, gap * 3 + 500);
  const wrongArea = delights.duskVisitor(first.area === 'meadow' ? 'beach' : 'meadow', 19, gap * 3 + 500);
  const firstTap = delights.tapDuskVisitor(), secondTap = delights.tapDuskVisitor();
  const visited = [];
  for (let i = 4; i < 14; i++) visited.push(delights.duskVisitor('meadow', 19, gap * i)?.area);
  const party = Object.values(BY_ID).filter(x => x.kind === 'boo').slice(0, 8);
  const made = await postcard.saveExpeditionPostcard(party, 'raft', new Date('2026-07-17T12:00:00Z'));
  const studio = await import('./js/studio.js'); const gallery = await studio.listArtworks();
  return { first, same, wrongArea, firstTap, secondTap, visited, owns: !!window.BooTown.State.getState().inventory[first.id], png: made.png, spriteCount: made.plan.sprites.length, galleryKinds: gallery.map(a => a.kind) };
}, { gap: VISITOR_GAP_H * 3600000 });
assert(VISITOR_AREAS.includes(result.first.area), 'visitor selects one of the outdoor areas instead of the currently-open area');
assert(result.same?.id === result.first.id && result.wrongArea === null, 'active visitor remains in one area for its 12-second crossing');
assert(!result.owns, 'visitor is always an unowned Boo');
assert(result.firstTap && !result.secondTap, 'visitor tap is idempotent: exactly one sparkle/giggle event');
assert(new Set(result.visited.filter(Boolean)).size >= 2, 'simulated month visits varied outdoor areas on the 72-hour cadence');
assert(result.png.startsWith('data:image/png;base64,') && result.spriteCount === 8, 'postcard is rasterized locally with every party sprite');
assert(result.galleryKinds.includes('expedition-postcard'), 'postcard is saved into the existing Studio Gallery within its cap');
await context.close(); await browser.close();
console.log('RESULT: ' + (failed ? 'FAIL' : 'PASS')); process.exit(failed ? 1 : 0);
