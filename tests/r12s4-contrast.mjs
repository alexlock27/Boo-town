// tests/r12s4-contrast.mjs — RUN12 G7: the permanent contrast law.
//
// Every text element must reach WCAG AA against its ACTUAL RENDERED background — including
// overlays, gradients and images — at all three viewports, on every route. No exceptions,
// decorative labels included.
//
// It does not composite CSS backgrounds by walking ancestors, because that lies about
// gradients and background images. It renders the page twice: once normally, and once with
// every glyph made transparent, then samples the REAL PIXELS under each text node's box in
// the glyph-free capture and takes the worst one. That is what "worst-case pixel under the
// text bounds" means.
import { chromium } from 'playwright';
import sharp from 'sharp';
import { readFileSync, mkdirSync, writeFileSync } from 'fs';

const RAW = process.env.BASE || 'http://127.0.0.1:8000';
const BASE = RAW.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
const RESOLVE = ['--host-resolver-rules=MAP app.localhost 127.0.0.1'];
const SHOTS = 'screenshots/run12/s4';
mkdirSync(SHOTS, { recursive: true });
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };

const VIEWPORTS = [
  { name: '1024x768', width: 1024, height: 768 },
  { name: '768x1024', width: 768, height: 1024 },
  { name: '390x844', width: 390, height: 844 }
];

// routes, read from the product source so new ones join the audit automatically
const mainSrc = readFileSync('js/main.js', 'utf8');
const rb = mainSrc.slice(mainSrc.indexOf('const registry = {'), mainSrc.indexOf('};', mainSrc.indexOf('const registry = {')));
const ROUTES = [...rb.matchAll(/^\s*'?([a-zA-Z][\w-]*)'?\s*:\s*\(\)\s*=>/gm)].map(m => m[1]).filter(r => r !== 'onboarding');

const AK = ['meadow','riverside','hilltop','beach','funfair','playground','boohouse','gallery'];
const SAVE = JSON.stringify({
  version: 14, name: 'Ada', ageAsked: true,
  guide: { species:'giraffe', body:'sunshine', pattern:'spots', patternColour:'cocoa', eyes:'round', acc:'none', name:'T' },
  inventory: { boo_inky: 2, boo_plum: 1, boo_mint: 1, boo_sky: 1, deco_palm: 2, deco_bench: 1, acc_bow: 1 },
  stars: { total: 400, byGame: { bubblepop: 30 } }, trophies: {}, boxes: 1,
  town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 4 }, expedition: { party: [], tiers: {}, progress: {} },
  seen: { trophyRetro: true, lastStarsShown: 400, introSeen: {} },
  settings: { sound: false, music: false, voice: false, content: 'full' }
});

const lum = (r, g, b) => {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => { const x = lum(...a), y = lum(...b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

// Collect every visible text node's box, its rendered colour and its size class.
const COLLECT = `(() => {
  const parse = (s) => (String(s).match(/[0-9.]+/g) || []).slice(0,4).map(Number);
  const solidBehind = (el) => {
    let n = el;
    while (n && n.nodeType === 1) {
      const c = parse(getComputedStyle(n).backgroundColor);
      if (c.length >= 3 && (c.length === 3 || c[3] >= 0.999)) return [c[0], c[1], c[2]];
      n = n.parentElement;
    }
    return [255, 255, 255];
  };
  // only emoji / symbols / whitespace: those are pictures, not text
  const pictorial = (t) => !/[A-Za-z0-9]/.test(t);
  const out = [];
  for (const el of document.querySelectorAll('body *')) {
    const direct = [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('').trim();
    if (!direct || pictorial(direct)) continue;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    if (r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) continue;
    // effective opacity through ancestors
    let op = 1, p = el;
    while (p && p.nodeType === 1) { op *= +getComputedStyle(p).opacity; p = p.parentElement; }
    if (op < 0.05) continue;
    // Occlusion. A first-play intro puts a full-screen scrim over the whole screen; the
    // picker text underneath it is not text anyone is reading, and judging it would report
    // the scrim as its background. A point is fine if the topmost element there is the node,
    // one of its descendants, or one of its ancestors (that is just its own backdrop showing).
    const pts = [[0.5,0.5],[0.2,0.35],[0.8,0.35],[0.2,0.7],[0.8,0.7]]
      .map(([fx,fy]) => [r.left + r.width*fx, r.top + r.height*fy])
      .filter(([px2,py2]) => px2 >= 0 && py2 >= 0 && px2 < innerWidth && py2 < innerHeight);
    if (!pts.length) continue;
    const clear = pts.filter(([px2,py2]) => {
      const top = document.elementFromPoint(px2, py2);
      return top && (el.contains(top) || top.contains(el));
    }).length;
    if (clear * 2 <= pts.length) continue;   // mostly covered by something else
    const fg = parse(cs.color);
    const a = (fg.length === 4 ? fg[3] : 1) * op;
    const bg = solidBehind(el);
    // the colour as it actually lands on the page, alpha and ancestor opacity included
    const rendered = [0,1,2].map(i => Math.round(fg[i] * a + bg[i] * (1 - a)));
    const size = parseFloat(cs.fontSize) || 16;
    const weight = parseInt(cs.fontWeight, 10) || 400;
    const radius = Math.min(parseFloat(cs.borderTopLeftRadius) || 0, r.width / 2, r.height / 2);
    // RUN14 U-0: judge the text's own LINE BOXES (Range client rects), not the whole
    // element box. An element box includes padding, corners and — when layouts overlap —
    // pixels that belong to a DIFFERENT element's text; a drawer label behind a button's
    // corner used to be judged as the button's own glyphs against the button's colour.
    const range = document.createRange();
    const boxes = [];
    for (const child of el.childNodes) {
      if (child.nodeType !== 3 || !child.textContent.trim()) continue;
      range.selectNodeContents(child);
      for (const rr of range.getClientRects()) {
        if (rr.width < 2 || rr.height < 2) continue;
        if (rr.bottom <= 0 || rr.top >= innerHeight || rr.right <= 0 || rr.left >= innerWidth) continue;
        boxes.push([Math.max(0, Math.round(rr.left)), Math.max(0, Math.round(rr.top)),
          Math.round(Math.min(rr.width, innerWidth - rr.left)), Math.round(Math.min(rr.height, innerHeight - rr.top))]);
      }
    }
    if (!boxes.length) continue;
    out.push({
      radius, boxes,
      text: direct.slice(0, 40),
      sel: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\\s+/).slice(0,2).join('.') : ''),
      x: Math.max(0, Math.round(r.left)), y: Math.max(0, Math.round(r.top)),
      w: Math.round(Math.min(r.width, innerWidth - r.left)), h: Math.round(Math.min(r.height, innerHeight - r.top)),
      rendered, size, weight,
      large: size >= 24 || (size >= 18 && weight >= 700)
    });
  }
  return out;
})()`;

const HIDE_GLYPHS = `(() => {
  const s = document.createElement('style');
  s.id = '__contrast_hide';
  // text-shadow stays ON. A shadow is a legitimate legibility device and it is part of
  // what sits under the glyph; removing it made every shadowed label read as invisible.
  //
  // ONLY -webkit-text-fill-color — never color:transparent. Setting color switches
  // colour-emoji to a different font with different advance widths, which REFLOWS any
  // node containing an emoji ("Save ✨") between the A and B captures; every shifted
  // edge pixel then reads as a glyph over the dark backdrop — a false violation.
  // text-fill alone hides ordinary glyphs, leaves emoji visible (they are pictures,
  // never judged), and keeps the layout byte-identical.
  s.textContent = '*, *::before, *::after { -webkit-text-fill-color: transparent !important; }';
  document.head.appendChild(s);
})()`;
// RUN14 U-0: freeze EVERY animation at its current phase for the whole capture block.
// A slow infinite bob used to shift an element a few pixels between the A and B captures
// — slower than the 180ms static checks could see — so its EDGE pixels read as "glyph"
// with the dark backdrop as their background: a false violation with a real-looking
// ratio. Frozen, A and B differ by glyph visibility alone. This also judges MORE nodes
// (nothing is excluded as "moving" any more), which is the audit getting stricter.
const FREEZE = `(() => {
  const s = document.createElement('style');
  s.id = '__contrast_freeze';
  s.textContent = '*, *::before, *::after { animation-play-state: paused !important; transition: none !important; }';
  document.head.appendChild(s);
})()`;
const RESTORE = `(() => { for (const id of ['__contrast_hide', '__contrast_freeze']) { const s = document.getElementById(id); if (s) s.remove(); } })()`;

const browser = await chromium.launch({ args: RESOLVE });
const violations = [];
let checked = 0;

// The three viewports run CONCURRENTLY, one browser context each. Serially this suite
// took over ten minutes of almost pure screenshot latency, which is too slow to sit on
// the board; in parallel it is a third of that and covers exactly the same ground.
await Promise.all(VIEWPORTS.map(async (vp) => {
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), SAVE);
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => window.BooTown, null, { timeout: 20000 });

  // Two phases per route. Phase 'intro' judges the first-play overlay itself; phase 'screen'
  // dismisses it and judges the screen underneath, which the overlay would otherwise hide
  // from the audit entirely (occluded nodes are skipped, and rightly so).
  // RUN14 U-0 board diet: the fixed 1100ms + 900ms sleeps per route-phase became
  // condition-waits — the screen must have mounted AND every FINITE animation/transition
  // must have finished (a screen caught mid-fade reports a background nobody ever sees;
  // infinite idle loops are exempt because they never finish and the four-capture
  // static-pixel method already excludes their pixels). Same audit, same assertions.
  // "Quiet" must hold TWICE in a row 160ms apart: a single check races entrances that
  // start on a timer (and the intro scrim's 220ms removal fade). A screen is judged only
  // in the state it actually settles into — which is also what makes this audit STRICTER
  // than the old fixed sleeps: late-staggered screens used to be silently excluded as
  // "still moving" and never judged at all.
  const settle = async () => {
    await page.waitForFunction(() => {
      const s = document.getElementById('screen');
      return s && s.firstElementChild;
    }, null, { timeout: 5000 }).catch(() => {});
    let quiet = 0;
    const t0 = Date.now();
    while (quiet < 2 && Date.now() - t0 < 3600) {
      const q = await page.evaluate(() =>
        !document.querySelector('.intro-overlay:not(.show)') &&   // a scrim mid-removal is not quiet
        document.getAnimations().every(a => {
          if (a.playState !== 'running') return true;
          const t = (a.effect && a.effect.getTiming) ? a.effect.getTiming() : {};
          return t.iterations === Infinity;
        })).catch(() => false);
      quiet = q ? quiet + 1 : 0;
      await page.waitForTimeout(160);
    }
  };
  for (const route of ROUTES) for (const phase of ['intro', 'screen']) {
    await page.evaluate(async (r) => { try { await window.BooTown.go('hub', {}); await window.BooTown.go(r, {}); } catch {} }, route);
    await settle();
    if (phase === 'screen') {
      await page.evaluate(() => {
        if (window.__intro) window.__intro.close();
        document.querySelectorAll('.intro-overlay').forEach(o => o.remove());
      });
      await settle();
    } else if (!(await page.evaluate(() => !!document.querySelector('.intro-overlay')))) {
      continue;                        // no intro on this route; the screen phase covers it
    }
    await page.evaluate(FREEZE);   // measure rects at the SAME frozen phase as the captures
    await page.waitForTimeout(80);
    const nodes = await page.evaluate(COLLECT);
    if (!nodes.length) { await page.evaluate(RESTORE); continue; }

    // Four captures. A1/A2 = the screen as the child sees it. B1/B2 = the same screen with
    // every glyph made transparent. A pixel counts as "under the text" only if it is STATIC
    // in both states (A1==A2 and B1==B2 — so a Boo wandering past, a star counting up or a
    // meter still filling cannot masquerade as a glyph) and DIFFERENT between them (so it is
    // glyph, not chrome — which is what stops rounded corners and padding reading as
    // violations). Its background is then the B value: the real pixel under the text.
    //
    // NO clip: screenshot({clip}) is PAGE-relative while getBoundingClientRect() is
    // VIEWPORT-relative, so on any scrolled screen the two disagree and every sample lands
    // in the wrong place. The default capture is the viewport the rects were measured in.
    const bufA1 = await page.screenshot();
    await page.waitForTimeout(120);
    const bufA2 = await page.screenshot();
    await page.evaluate(HIDE_GLYPHS);
    await page.waitForTimeout(100);
    const bufB1 = await page.screenshot();
    await page.waitForTimeout(120);
    const bufB2 = await page.screenshot();
    await page.evaluate(RESTORE);

    const raw = async (b) => sharp(b).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const A1 = await raw(bufA1), A2 = await raw(bufA2), B1 = await raw(bufB1), B2 = await raw(bufB2);
    const A = A2;
    const { width: W, height: H, channels: CH } = B1.info;
    const at = (o, x, y) => { const i = (y * W + x) * CH; return [o.data[i], o.data[i + 1], o.data[i + 2]]; };
    const near = (p, q, tol) => Math.abs(p[0] - q[0]) <= tol && Math.abs(p[1] - q[1]) <= tol && Math.abs(p[2] - q[2]) <= tol;

    for (const n of nodes) {
      if (n.w < 2 || n.h < 2) continue;
      // Pixels OUTSIDE the element's own border-radius arc are not its box — they show
      // whatever sits behind (a glow, the dark backdrop), never this element's glyphs.
      const rad = (n.radius || 0) + 1.5;
      const inCornerVoid = (x, y) => {
        if (rad <= 2) return false;
        const rx = x - n.x, ry = y - n.y;
        const cx = rx < rad ? rad : (rx > n.w - rad ? n.w - rad : null);
        const cy = ry < rad ? rad : (ry > n.h - rad ? n.h - rad : null);
        if (cx === null || cy === null) return false;
        const dx = rx - cx, dy = ry - cy;
        return dx * dx + dy * dy > rad * rad;
      };
      let worst = Infinity, worstPx = null, glyphPixels = 0, worstAt = null;
      for (const [bx, by, bw, bh] of n.boxes) {
        const x0 = Math.max(0, bx), y0 = Math.max(0, by);
        const x1 = Math.min(W, bx + bw), y1 = Math.min(H, by + bh);
        for (let y = y0; y < y1; y++) {
          for (let x = x0; x < x1; x++) {
            if (inCornerVoid(x, y)) continue;
            const b1 = at(B1, x, y);
            if (!near(b1, at(B2, x, y), 1)) continue;          // still moving with glyphs off
            const a2 = at(A, x, y);
            if (!near(a2, at(A1, x, y), 1)) continue;          // still moving with glyphs on
            if (near(a2, b1, 10)) continue;                    // unchanged — not a glyph pixel
            // An antialiased glyph pixel of THIS node lies between its own text colour
            // and the background it sits on. A pixel that does not (another element's
            // glyph crossing this line box — a back-arrow under a wide title) is not
            // ours to judge here; that element is judged with its own colours.
            {
              const F = n.rendered;
              const num = (a2[0] - b1[0]) * (F[0] - b1[0]) + (a2[1] - b1[1]) * (F[1] - b1[1]) + (a2[2] - b1[2]) * (F[2] - b1[2]);
              const den = (F[0] - b1[0]) ** 2 + (F[1] - b1[1]) ** 2 + (F[2] - b1[2]) ** 2;
              const t = den > 0 ? Math.max(0, Math.min(1, num / den)) : 0;
              const pred = [b1[0] + t * (F[0] - b1[0]), b1[1] + t * (F[1] - b1[1]), b1[2] + t * (F[2] - b1[2])];
              if (Math.abs(a2[0] - pred[0]) > 60 || Math.abs(a2[1] - pred[1]) > 60 || Math.abs(a2[2] - pred[2]) > 60) continue;
            }
            glyphPixels++;
            const c = ratio(n.rendered, b1);
            if (c < worst) { worst = c; worstPx = b1; worstAt = [x, y]; }
          }
        }
      }
      // fewer than a handful of glyph pixels means the text never actually painted here
      // (clipped, covered, or zero-opacity) — there is nothing to judge.
      if (glyphPixels < 8 || worst === Infinity) continue;
      checked++;
      const need = n.large ? 3 : 4.5;
      if (worst + 0.005 < need) {
        violations.push({ route, phase, viewport: vp.name, sel: n.sel, text: n.text,
          ratio: +worst.toFixed(2), need, size: n.size, weight: n.weight,
          fg: n.rendered, worstBg: worstPx, worstAt, rect: [n.x, n.y, n.w, n.h], glyphPixels });
      }
    }
  }
  await ctx.close();
}));

await browser.close();

// ---- report ---------------------------------------------------------------------------
console.log(`== contrast audit: ${checked} text nodes across ${ROUTES.length} routes x 2 phases x ${VIEWPORTS.length} viewports ==`);
writeFileSync(`${SHOTS}/violations.json`, JSON.stringify(violations, null, 2));
// group so one bad rule does not read as fifty findings
const byRule = new Map();
for (const v of violations) {
  const k = v.sel + ' @' + v.need;
  if (!byRule.has(k)) byRule.set(k, []);
  byRule.get(k).push(v);
}
for (const [k, list] of [...byRule].sort((a, b) => a[1][0].ratio - b[1][0].ratio)) {
  const w = list[0];
  console.log(`  ✗ ${k} — worst ${w.ratio}:1 (needs ${w.need}) fg rgb(${w.fg}) on rgb(${w.worstBg}) — "${w.text}" @ ${w.route}/${w.phase}/${w.viewport} (${list.length} node${list.length === 1 ? '' : 's'})`);
}
assert(checked > 1200, `the audit actually walked the app (${checked} text nodes)`);
assert(violations.length === 0, `zero contrast violations across all routes and viewports (${violations.length}; detail in ${SHOTS}/violations.json)`);

console.log(failed ? '\nRESULT: FAIL' : '\nRESULT: PASS');
process.exit(failed ? 1 : 0);
