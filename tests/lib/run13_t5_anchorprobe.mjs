// One-shot probe: where do eyeY/topY/R actually sit, per species, and what fraction of the
// Boo's own box does a given offset land on? Used to author the cape/bandana anchors.
import { chromium } from 'playwright';
const BASE = process.env.BASE || 'http://127.0.0.1:8123';
const b = await chromium.launch();
const page = await (await b.newContext()).newPage();
await page.goto(BASE + '/index.html', { waitUntil: 'load' });
const out = await page.evaluate(async () => {
  const { renderItem } = await import('./js/art.js');
  const { COLLECTIBLES } = await import('./data/catalogue.js');
  const seen = new Map();
  for (const it of COLLECTIBLES) if (it.kind === 'boo' && !seen.has(it.species)) seen.set(it.species, it);
  const host = document.createElement('div');
  host.style.cssText = 'position:fixed;left:-9999px;top:0';
  document.body.appendChild(host);
  const union = nodes => { let bb = null; for (const n of nodes) { const r = n.getBBox ? n.getBBox() : null; if (!r || !r.width) continue;
    bb = bb ? { x: Math.min(bb.x, r.x), y: Math.min(bb.y, r.y), w: Math.max(bb.x+bb.w, r.x+r.width)-Math.min(bb.x,r.x), h: Math.max(bb.y+bb.h, r.y+r.height)-Math.min(bb.y,r.y) } : { x:r.x,y:r.y,w:r.width,h:r.height }; } return bb; };
  const res = [];
  for (const [species, boo] of seen) {
    host.innerHTML = renderItem(boo, { size: 300 });
    const bare = [...host.querySelector('svg').children];
    const body = union(bare);
    const row = { species, bodyY: +body.y.toFixed(1), bodyH: +body.h.toFixed(1) };
    for (const art of ['cape', 'starcape', 'bandana', 'scarf', 'shades']) {
      host.innerHTML = renderItem(boo, { size: 300, equipArt: { hat: art } });
      const kids = [...host.querySelector('svg').children];
      const box = union(kids.slice(bare.length));
      row[art] = box ? `${(((box.y - body.y) / body.h) * 100).toFixed(0)}%..${(((box.y + box.h - body.y) / body.h) * 100).toFixed(0)}%` : 'none';
    }
    res.push(row);
  }
  host.remove();
  return res;
});
console.table(out);
await b.close();
