// tests/lib/run12s4debug.mjs — one-shot diagnostic for the contrast audit (NOT a suite).
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'fs';
const RAW = process.env.BASE || 'http://127.0.0.1:8000';
const BASE = RAW.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
mkdirSync('screenshots/run12/s4/debug', { recursive: true });
const AK = ['meadow','riverside','hilltop','beach','funfair','playground','boohouse','gallery'];
const SAVE = JSON.stringify({ version: 14, name: 'Ada', ageAsked: true,
  guide: { species:'giraffe', body:'sunshine', pattern:'spots', patternColour:'cocoa', eyes:'round', acc:'none', name:'T' },
  inventory: { boo_inky: 2 }, stars: { total: 400, byGame: {} }, trophies: {}, boxes: 1,
  town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 4 }, expedition: { party: [], tiers: {}, progress: {} },
  seen: { trophyRetro: true, lastStarsShown: 400, introSeen: {} },
  settings: { sound: false, music: false, voice: false, content: 'full' } });

const b = await chromium.launch({ args: ['--host-resolver-rules=MAP app.localhost 127.0.0.1'] });
const ctx = await b.newContext({ viewport: { width: 1024, height: 768 } });
const page = await ctx.newPage();
await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), SAVE);
await page.goto(BASE + '/index.html', { waitUntil: 'load' });
await page.waitForFunction(() => window.BooTown);
await page.evaluate(() => window.BooTown.go('bubblepop', {}));
await page.waitForTimeout(1600);

const info = await page.evaluate(() => {
  const el = document.querySelector('.sc-intro');
  if (!el) return null;
  const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
  const chain = [];
  let n = el;
  while (n && n.nodeType === 1 && chain.length < 8) {
    const c = getComputedStyle(n);
    chain.push({ tag: n.tagName + '.' + (typeof n.className === 'string' ? n.className : ''),
      bg: c.backgroundColor, bgImage: c.backgroundImage.slice(0, 60), opacity: c.opacity,
      filter: c.filter, backdrop: c.backdropFilter, mixBlend: c.mixBlendMode, animation: c.animationName });
    n = n.parentElement;
  }
  return { rect: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    color: cs.color, fontSize: cs.fontSize, chain };
});
console.log(JSON.stringify(info, null, 2));

const A = await page.screenshot();
await page.evaluate(() => { const s = document.createElement('style'); s.id = 'h';
  s.textContent = '*, *::before, *::after { color: transparent !important; -webkit-text-fill-color: transparent !important; }';
  document.head.appendChild(s); });
await page.waitForTimeout(150);
const B1 = await page.screenshot();

const rawOf = async (buf) => sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const ra = await rawOf(A), rb = await rawOf(B1);
const px = (o, x, y) => { const i = (y * o.info.width + x) * o.info.channels; return [o.data[i], o.data[i+1], o.data[i+2]]; };
const R = info.rect;
const counts = new Map();
for (let y = R.y; y < R.y + R.h; y++) for (let x = R.x; x < R.x + R.w; x++) {
  const a = px(ra, x, y), bb = px(rb, x, y);
  const changed = Math.abs(a[0]-bb[0]) > 10 || Math.abs(a[1]-bb[1]) > 10 || Math.abs(a[2]-bb[2]) > 10;
  if (!changed) continue;
  const k = bb.join(',');
  counts.set(k, (counts.get(k) || 0) + 1);
}
console.log('image size', ra.info.width, 'x', ra.info.height, 'scrollY', await page.evaluate(()=>window.scrollY), 'cardRect', await page.evaluate(()=>{const c=document.querySelector('.start-card');const r=c.getBoundingClientRect();return {x:Math.round(r.x),y:Math.round(r.y),w:Math.round(r.width),h:Math.round(r.height)};}));
const midY = R.y + Math.floor(R.h/2);
console.log('B row at mid-y, every 40px:', Array.from({length:10},(_,i)=>px(rb,R.x+i*40,midY).join(',')));
console.log('B column at mid-x, y from rect.y-30 to rect.y+h+10:', Array.from({length:15},(_,i)=>[R.y-30+i*6, px(rb,R.x+Math.floor(R.w/2),R.y-30+i*6).join(',')]));
console.log('distinct B-values under changed pixels (top 12):');
console.log([...counts].sort((p, q) => q[1] - p[1]).slice(0, 12));

await sharp(A).extract({ left: R.x, top: R.y, width: R.w, height: R.h }).toFile('screenshots/run12/s4/debug/A.png');
await sharp(B1).extract({ left: R.x, top: R.y, width: R.w, height: R.h }).toFile('screenshots/run12/s4/debug/B1.png');
await b.close();
