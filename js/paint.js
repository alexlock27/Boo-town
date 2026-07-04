// js/paint.js — Paint-a-Boo (RUN3 C6). Colour in outline templates with a brush, flood
// fill, sparkle pen and eraser. 12 colours + rainbow, undo (10 steps). Save to the gallery.

import { el, clear, backControl } from './ui.js';
import { sfx, music } from './sfx.js';
import { saveArtwork } from './studio.js';

const SIZE = 640;                      // internal canvas resolution (spec cap 640px)
const COLOURS = ['#FF7AC6', '#C6A9F0', '#8FC7FF', '#35D0BA', '#FFC93C', '#FF9F68', '#EF476F', '#118AB2', '#06D6A0', '#8A5A44', '#2A1B4E', '#FFFFFF'];
const BRUSH_SIZES = [10, 22, 40];

// Outline templates: a blank egg plus a simple outline for each species. Drawn dark on cream.
const TEMPLATES = [
  { id: 'egg', name: 'Egg' },
  { id: 'bloop', name: 'Bloop' },
  { id: 'pip', name: 'Pip' },
  { id: 'munch', name: 'Munch' },
  { id: 'sunny', name: 'Sunny' },
  { id: 'nova', name: 'Nova' }
];

export function mount(container, params, ctx) {
  music.play('calm');
  const root = el('div', { class: 'paint-screen' });
  const header = el('header', { class: 'studio-header' }, [
    backControl(() => ctx.go('studio')),
    el('h2', { text: '🖌️ Paint a Boo' })
  ]);

  const canvas = el('canvas', { class: 'paint-canvas', width: SIZE, height: SIZE });
  const cx = canvas.getContext('2d', { willReadFrequently: true });

  let colour = COLOURS[0];
  let tool = 'brush';        // brush | fill | sparkle | eraser
  let brush = BRUSH_SIZES[1];
  let rainbow = false, hue = 0;
  const undoStack = [];

  drawTemplate('egg');

  function drawTemplate(id) {
    cx.fillStyle = '#FFF8F0'; cx.fillRect(0, 0, SIZE, SIZE);
    cx.strokeStyle = '#2A1B4E'; cx.lineWidth = 8; cx.lineJoin = 'round'; cx.lineCap = 'round';
    const c = SIZE / 2;
    cx.beginPath();
    if (id === 'egg') { cx.ellipse(c, c + 20, 200, 250, 0, 0, Math.PI * 2); }
    else {
      // a friendly Boo body with species ears
      cx.ellipse(c, c + 40, 210, 190, 0, 0, Math.PI * 2);
      cx.stroke(); cx.beginPath();
      if (id === 'pip') { cx.ellipse(c - 90, 120, 45, 100, 0, 0, Math.PI * 2); cx.moveTo(c + 135, 120); cx.ellipse(c + 90, 120, 45, 100, 0, 0, Math.PI * 2); }
      else { cx.ellipse(c - 110, 170, 60, 60, 0, 0, Math.PI * 2); cx.moveTo(c + 170, 170); cx.ellipse(c + 110, 170, 60, 60, 0, 0, Math.PI * 2); }
      cx.stroke(); cx.beginPath();
      // eyes outline
      cx.ellipse(c - 70, c + 20, 40, 45, 0, 0, Math.PI * 2); cx.moveTo(c + 110, c + 20); cx.ellipse(c + 70, c + 20, 40, 45, 0, 0, Math.PI * 2);
      cx.stroke(); cx.beginPath();
      if (id === 'munch') { cx.moveTo(c - 60, c + 120); cx.quadraticCurveTo(c, c + 180, c + 60, c + 120); }
      else if (id === 'sunny') { cx.moveTo(c - 40, c + 130); cx.arc(c, c + 130, 40, Math.PI, 0); }
      else { cx.moveTo(c - 50, c + 120); cx.quadraticCurveTo(c, c + 150, c + 50, c + 120); }
    }
    cx.stroke();
    undoStack.length = 0; snapshot();
  }

  function snapshot() { try { undoStack.push(cx.getImageData(0, 0, SIZE, SIZE)); if (undoStack.length > 11) undoStack.shift(); } catch {} }
  function undo() { if (undoStack.length > 1) { undoStack.pop(); cx.putImageData(undoStack[undoStack.length - 1], 0, 0); } }

  // ---- painting ----
  let painting = false, lastX = 0, lastY = 0;
  function toCanvas(e) { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * SIZE, y: (e.clientY - r.top) / r.height * SIZE }; }
  function curColour() { if (rainbow) { hue = (hue + 8) % 360; return `hsl(${hue} 85% 60%)`; } return colour; }

  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    const { x, y } = toCanvas(e);
    if (tool === 'fill') { floodFill(x | 0, y | 0, curColour()); snapshot(); return; }
    painting = true; lastX = x; lastY = y; sfx.tap();
    stroke(x, y, x, y);
  });
  canvas.addEventListener('pointermove', e => { if (!painting) return; const { x, y } = toCanvas(e); stroke(lastX, lastY, x, y); lastX = x; lastY = y; });
  const stop = () => { if (painting) { painting = false; snapshot(); } };
  canvas.addEventListener('pointerup', stop); canvas.addEventListener('pointercancel', stop);

  function stroke(x0, y0, x1, y1) {
    if (tool === 'sparkle') { drawSparkle(x1, y1); return; }
    cx.strokeStyle = tool === 'eraser' ? '#FFF8F0' : curColour();
    cx.lineWidth = tool === 'eraser' ? brush * 1.4 : brush;
    cx.lineCap = 'round'; cx.lineJoin = 'round';
    cx.beginPath(); cx.moveTo(x0, y0); cx.lineTo(x1, y1); cx.stroke();
  }
  function drawSparkle(x, y) {
    cx.fillStyle = curColour();
    const r = brush * 0.6;
    cx.save(); cx.translate(x, y);
    cx.beginPath();
    for (let i = 0; i < 5; i++) { const a = (i * 72 - 90) * Math.PI / 180, a2 = a + Math.PI / 5; cx.lineTo(Math.cos(a) * r, Math.sin(a) * r); cx.lineTo(Math.cos(a2) * r * 0.45, Math.sin(a2) * r * 0.45); }
    cx.closePath(); cx.fill(); cx.restore();
  }

  // scanline flood fill up to the outline (spec: flood fill tool)
  function floodFill(sx, sy, hexOrHsl) {
    const img = cx.getImageData(0, 0, SIZE, SIZE); const d = img.data;
    const idx = (x, y) => (y * SIZE + x) * 4;
    const s = idx(sx, sy);
    const tr = d[s], tg = d[s + 1], tb = d[s + 2];
    const fill = parseColour(hexOrHsl);
    if (near(tr, tg, tb, fill.r, fill.g, fill.b, 8)) return;   // already that colour
    const stack = [[sx, sy]];
    const match = (i) => near(d[i], d[i + 1], d[i + 2], tr, tg, tb, 40);
    while (stack.length) {
      const [x, y] = stack.pop(); if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) continue;
      let i = idx(x, y); if (!match(i)) continue;
      let xl = x; while (xl > 0 && match(idx(xl - 1, y))) xl--;
      let xr = x; while (xr < SIZE - 1 && match(idx(xr + 1, y))) xr++;
      for (let xx = xl; xx <= xr; xx++) { const j = idx(xx, y); d[j] = fill.r; d[j + 1] = fill.g; d[j + 2] = fill.b; d[j + 3] = 255; if (y > 0 && match(idx(xx, y - 1))) stack.push([xx, y - 1]); if (y < SIZE - 1 && match(idx(xx, y + 1))) stack.push([xx, y + 1]); }
    }
    cx.putImageData(img, 0, 0);
  }

  // ---- tool bar ----
  const swatches = el('div', { class: 'paint-swatches' });
  COLOURS.forEach(cc => { const b = el('button', { class: 'paint-swatch' + (cc === colour && !rainbow ? ' sel' : ''), style: { background: cc }, 'aria-label': 'colour', onclick: () => { colour = cc; rainbow = false; refreshSwatches(); } }); swatches.appendChild(b); });
  const rainbowBtn = el('button', { class: 'paint-swatch rainbow', 'aria-label': 'rainbow', onclick: () => { rainbow = true; refreshSwatches(); } });
  swatches.appendChild(rainbowBtn);
  function refreshSwatches() { [...swatches.querySelectorAll('.paint-swatch')].forEach(b => b.classList.remove('sel')); if (rainbow) rainbowBtn.classList.add('sel'); else { const i = COLOURS.indexOf(colour); if (i >= 0) swatches.children[i].classList.add('sel'); } }

  const toolBtns = {};
  const tools = el('div', { class: 'paint-tools' });
  [['brush', '🖌️'], ['fill', '🪣'], ['sparkle', '✨'], ['eraser', '🧽']].forEach(([t, ic]) => {
    const b = el('button', { class: 'paint-tool' + (t === tool ? ' sel' : ''), text: ic, 'aria-label': t, onclick: () => { tool = t; Object.values(toolBtns).forEach(x => x.classList.remove('sel')); b.classList.add('sel'); } });
    toolBtns[t] = b; tools.appendChild(b);
  });
  const sizes = el('div', { class: 'paint-sizes' });
  BRUSH_SIZES.forEach((sz, i) => { const b = el('button', { class: 'paint-size' + (sz === brush ? ' sel' : ''), onclick: () => { brush = sz; [...sizes.children].forEach(x => x.classList.remove('sel')); b.classList.add('sel'); } }, [el('span', { class: 'ps-dot', style: { width: (8 + i * 7) + 'px', height: (8 + i * 7) + 'px' } })]); sizes.appendChild(b); });

  const undoBtn = el('button', { class: 'btn soft', text: '↩ Undo', onclick: () => { sfx.tap(); undo(); } });
  const saveBtn = el('button', { class: 'btn', text: '💾 Save to gallery', onclick: () => doSave() });
  const saveMsg = el('span', { class: 'gu-msg' });

  const tmplRow = el('div', { class: 'paint-templates' });
  TEMPLATES.forEach(t => tmplRow.appendChild(el('button', { class: 'paint-tmpl', text: t.name, onclick: () => { sfx.tap(); drawTemplate(t.id); } })));

  async function doSave() {
    const png = canvas.toDataURL('image/png');
    const res = await saveArtwork(png, 'paint');
    if (res.full) { saveMsg.textContent = 'Gallery is full (20)! Delete one first.'; saveMsg.classList.add('err'); }
    else { saveMsg.classList.remove('err'); saveMsg.textContent = 'Saved! 🌟'; sfx.star(); }
    setTimeout(() => saveMsg.textContent = '', 2600);
  }

  root.append(header, tmplRow, el('div', { class: 'paint-stage' }, [canvas]), swatches,
    el('div', { class: 'paint-controls' }, [tools, sizes]),
    el('div', { class: 'paint-actions' }, [undoBtn, saveBtn, saveMsg]));
  container.appendChild(root);

  // test hook
  if (typeof window !== 'undefined') window.__paint = { fill: (x, y, c) => { floodFill(x, y, c); snapshot(); }, save: doSave, dataURL: () => canvas.toDataURL('image/png') };
  return { unmount() {} };
}

function parseColour(s) {
  if (s[0] === '#') { const h = s.slice(1); return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) }; }
  const m = s.match(/hsl\(([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/); if (m) return hslToRgb(+m[1], +m[2] / 100, +m[3] / 100);
  return { r: 0, g: 0, b: 0 };
}
function hslToRgb(h, s, l) { h /= 360; const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q; const f = (t) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; }; return { r: Math.round(f(h + 1 / 3) * 255), g: Math.round(f(h) * 255), b: Math.round(f(h - 1 / 3) * 255) }; }
function near(r, g, b, r2, g2, b2, t) { return Math.abs(r - r2) <= t && Math.abs(g - g2) <= t && Math.abs(b - b2) <= t; }
