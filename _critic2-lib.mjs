// shared helpers for the RUN18C C3+C4 critic probes
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

export const BASE = process.env.BASE || 'http://127.0.0.1:8000';
export const SHOTS = 'screenshots/run18c/critic2';
mkdirSync(SHOTS, { recursive: true });

export const P = ['boo_inky','boo_plum','boo_pippin','boo_lolly','boo_chomp','boo_mallow','boo_curly','boo_wisp'];
export function mkSave(over = {}) {
  return {
    version: 7, name: 'Ada', guide: {}, ageAsked: true,
    inventory: Object.fromEntries(P.map(i => [i, 1])),
    expedition: { party: P, tiers: {}, progress: {}, ...(over.expedition || {}) },
    care: { bonds: {}, treats: 0 },
    stars: { total: 50, byGame: {} }, town: { areas: {} },
    seen: { trophyRetro: true, welcomeTour: true, expReveal: true },
    settings: { sound: true, music: false, voice: false }
  };
}

export async function openApp(viewport = { width: 1024, height: 768 }, save = mkSave()) {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto(BASE + '/index.html');
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), save);
  await page.reload();
  await page.waitForSelector('.hub');
  return { browser, ctx, page, errors };
}

// ---- contrast: sample REAL pixels under the text box, with glyphs made invisible -------
const lin = c => { c /= 255; return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); };
export const L = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
export const ratio = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
export const parseRGB = s => (s.match(/[\d.]+/g) || [0, 0, 0]).slice(0, 3).map(Number);

// returns [{text, sel, fg, worstBg, ratio, need, fontPx, bold}]
export async function contrastAudit(page, rootSel) {
  // 1. collect text nodes + their computed colour + box
  const items = await page.evaluate(sel => {
    const root = document.querySelector(sel) || document.body;
    const out = [];
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walk.nextNode())) {
      const t = (n.textContent || '').trim();
      if (!t) continue;
      const p = n.parentElement;
      if (!p) continue;
      const cs = getComputedStyle(p);
      if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity === 0) continue;
      const r = document.createRange(); r.selectNodeContents(n);
      const b = r.getBoundingClientRect();
      if (b.width < 2 || b.height < 2) continue;
      const path = (() => { let e = p, s = []; while (e && e !== document.body) { s.unshift(e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).join('.') : '')); e = e.parentElement; } return s.slice(-3).join(' > '); })();
      // only text a child can actually SEE: inside the viewport and not clipped away by an
      // ancestor scroller (otherwise we would sample the page behind it and call it contrast)
      if (b.bottom < 0 || b.top > innerHeight || b.right < 0 || b.left > innerWidth) continue;
      let clipped = false;
      for (let a = p.parentElement; a && a !== document.body; a = a.parentElement) {
        const acs = getComputedStyle(a);
        if (acs.overflow === 'visible' && acs.overflowY === 'visible' && acs.overflowX === 'visible') continue;
        const ab = a.getBoundingClientRect();
        if (b.bottom < ab.top + 1 || b.top > ab.bottom - 1 || b.right < ab.left + 1 || b.left > ab.right - 1) { clipped = true; break; }
      }
      if (clipped) continue;
      out.push({ text: t.slice(0, 48), fg: cs.color, fontPx: parseFloat(cs.fontSize), weight: +cs.fontWeight || 400, box: { x: b.x, y: b.y, w: b.width, h: b.height }, path });
    }
    return out;
  }, rootSel);
  // 2. hide glyphs, screenshot
  const tag = await page.addStyleTag({ content: '*, *::before, *::after { color: transparent !important; text-shadow: none !important; -webkit-text-fill-color: transparent !important; caret-color: transparent !important; }' });
  const buf = await page.screenshot();
  await tag.evaluate(n => n.remove());
  await page.waitForTimeout(30);
  const { default: sharp } = await import('sharp').catch(() => ({ default: null }));
  let px;
  if (sharp) {
    const img = sharp(buf).ensureAlpha().raw();
    const { data, info } = await img.toBuffer({ resolveWithObject: true });
    px = (x, y) => { x = Math.max(0, Math.min(info.width - 1, x | 0)); y = Math.max(0, Math.min(info.height - 1, y | 0)); const i = (y * info.width + x) * info.channels; return [data[i], data[i + 1], data[i + 2]]; };
  } else return items.map(i => ({ ...i, err: 'no sharp' }));
  const dpr = await page.evaluate(() => window.devicePixelRatio || 1);
  return items.map(it => {
    const fg = parseRGB(it.fg);
    let worst = null, worstR = 99;
    const b = it.box;
    for (let sx = 0; sx <= 6; sx++) for (let sy = 0; sy <= 4; sy++) {
      const x = (b.x + (b.w * sx) / 6) * dpr, y = (b.y + (b.h * sy) / 4) * dpr;
      const bg = px(x, y); const r = ratio(fg, bg);
      if (r < worstR) { worstR = r; worst = bg; }
    }
    const large = it.fontPx >= 24 || (it.fontPx >= 18.66 && it.weight >= 700);
    return { ...it, fgRGB: fg, bg: worst, ratio: +worstR.toFixed(2), need: large ? 3 : 4.5, pass: worstR >= (large ? 3 : 4.5) };
  });
}

export async function tapTargets(page, rootSel) {
  return page.evaluate(sel => {
    const root = document.querySelector(sel) || document.body;
    return [...root.querySelectorAll('button, a[href], [role="button"], input, select')]
      .filter(e => { const cs = getComputedStyle(e); return cs.display !== 'none' && cs.visibility !== 'hidden' && +cs.opacity > 0.05; })
      .map(e => { const b = e.getBoundingClientRect(); return { tag: e.tagName, cls: e.className, label: (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 36), w: +b.width.toFixed(1), h: +b.height.toFixed(1) }; })
      .filter(e => e.w > 0 && e.h > 0);
  }, rootSel);
}

export async function overflow(page) {
  return page.evaluate(() => {
    const de = document.documentElement;
    const esc = [...document.querySelectorAll('.screen *')].filter(e => {
      const b = e.getBoundingClientRect();
      return b.width > 0 && b.height > 0 && (b.right > innerWidth + 1 || b.left < -1);
    }).slice(0, 8).map(e => ({ cls: e.className, right: Math.round(e.getBoundingClientRect().right), left: Math.round(e.getBoundingClientRect().left) }));
    return { docScrollW: de.scrollWidth, innerW: innerWidth, horizOverflow: de.scrollWidth > innerWidth + 1, escaping: esc };
  });
}
