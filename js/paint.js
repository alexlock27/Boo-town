// js/paint.js — Paint-a-Boo (RUN3 C6, expanded RUN5 C6). Colour in outline templates
// with a brush, flood fill, sparkle pen, STAMPS, PATTERN FILL and eraser. 24 colours
// + rainbow, undo (10 steps). Save to the gallery; leaving mid-way keeps a draft.

import { el, clear, backControl } from './ui.js';
import { sfx, music } from './sfx.js';
import { saveArtwork } from './studio.js';
import { idbGet, idbPut, idbDelete, idbCount } from './idb.js';
import { seasonOf, currentMonth } from './rewards.js';
import { GALLERY_CAP } from './studio.js';

const SIZE = 640;                      // internal canvas resolution (spec cap 640px)
// RUN5 C6: the palette doubles to 24 colours, shown in two rows.
const COLOURS = [
  '#FF7AC6', '#C6A9F0', '#8FC7FF', '#35D0BA', '#FFC93C', '#FF9F68', '#EF476F', '#118AB2', '#06D6A0', '#8A5A44', '#2A1B4E', '#FFFFFF',
  '#E63946', '#F77F00', '#FFE066', '#9CCC65', '#2D6A4F', '#4DD0E1', '#5C6BC0', '#9C27B0', '#F8BBD0', '#FFE0B2', '#8D99AE', '#6D6875'
];
const BRUSH_SIZES = [10, 22, 40];
const DRAFT_ID = 'draft_paint';        // one live draft (RUN5 C6 save-and-resume)

// Outline templates (RUN5 C6: every Boo species, the guide species, the activity
// items, a whole-town scene, plus two pages for the current season).
const TEMPLATES = [
  { id: 'egg', name: 'Egg' },
  { id: 'bloop', name: 'Bloop' },
  { id: 'pip', name: 'Pip' },
  { id: 'munch', name: 'Munch' },
  { id: 'sunny', name: 'Sunny' },
  { id: 'nova', name: 'Nova' },
  { id: 'twirl', name: 'Twirl' },
  { id: 'snug', name: 'Snug' },
  { id: 'zippy', name: 'Zippy' },
  { id: 'giraffe', name: 'Giraffe' },
  { id: 'puppy', name: 'Puppy' },
  { id: 'kitten', name: 'Kitten' },
  { id: 'penguin', name: 'Penguin' },
  { id: 'bunny', name: 'Bunny' },
  { id: 'slide', name: 'Slide' },
  { id: 'swings', name: 'Swings' },
  { id: 'bumper', name: 'Bumper car' },
  { id: 'campfire', name: 'Campfire' },
  { id: 'town', name: 'Boo Town' }
];
// Seasonal pages, drop-gated by the same calendar as seasonal Boos.
const SEASONAL_PAGES = {
  summer: [{ id: 'sunshine', name: '☀️ Sunshine' }, { id: 'icelolly', name: '🍦 Ice lolly' }],
  spooky: [{ id: 'pumpkin', name: '🎃 Pumpkin' }, { id: 'ghost', name: '👻 Friendly ghost' }],
  winter: [{ id: 'snowman', name: '⛄ Snowman' }, { id: 'snowflake', name: '❄️ Snowflake' }]
};
function availableTemplates() {
  const season = seasonOf(currentMonth());
  return [...TEMPLATES, ...(season && SEASONAL_PAGES[season] ? SEASONAL_PAGES[season] : [])];
}

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
  let tool = 'brush';        // brush | fill | sparkle | stamp | pattern | eraser (RUN5 C6)
  let brush = BRUSH_SIZES[1];
  let rainbow = false, hue = 0;
  let stampShape = 'star';   // star | heart | flower | paw | sparkle
  let patternKind = 'stripes'; // stripes | dots
  let dirty = false;         // strokes since the template/draft loaded (drives drafts)
  const undoStack = [];

  drawTemplate('egg');
  // Save-and-resume (RUN5 C6): offer to continue a saved draft.
  let draftRec = null;
  idbGet('artworks', DRAFT_ID).then(d => {
    if (d) { draftRec = d; renderTemplates(); if (params && params.draft) loadDraft(); }   // gallery "Keep painting"
  }).catch(() => {});
  function loadDraft() {
    if (!draftRec) return;
    const img = new Image();
    img.onload = () => { cx.fillStyle = '#FFF8F0'; cx.fillRect(0, 0, SIZE, SIZE); cx.drawImage(img, 0, 0, SIZE, SIZE); undoStack.length = 0; snapshot(); dirty = false; };
    img.src = draftRec.png;
  }

  function drawTemplate(id) {
    cx.fillStyle = '#FFF8F0'; cx.fillRect(0, 0, SIZE, SIZE);
    cx.strokeStyle = '#2A1B4E'; cx.lineWidth = 8; cx.lineJoin = 'round'; cx.lineCap = 'round';
    const c = SIZE / 2;
    const E = (x, y, rx, ry) => { cx.beginPath(); cx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); cx.stroke(); };
    const P = (fn) => { cx.beginPath(); fn(); cx.stroke(); };
    const booEyesMouth = (mouth) => {
      E(c - 70, c + 20, 40, 45); E(c + 70, c + 20, 40, 45);
      P(() => {
        if (mouth === 'munch') { cx.moveTo(c - 60, c + 120); cx.quadraticCurveTo(c, c + 180, c + 60, c + 120); }
        else if (mouth === 'sunny') { cx.moveTo(c - 40, c + 130); cx.arc(c, c + 130, 40, Math.PI, 0); }
        else { cx.moveTo(c - 50, c + 120); cx.quadraticCurveTo(c, c + 150, c + 50, c + 120); }
      });
    };
    const booBody = () => E(c, c + 40, 210, 190);
    const roundEars = () => { E(c - 110, 170, 60, 60); E(c + 110, 170, 60, 60); };

    if (id === 'egg') { E(c, c + 20, 200, 250); }
    else if (id === 'pip') { booBody(); E(c - 90, 120, 45, 100); E(c + 90, 120, 45, 100); booEyesMouth(); }
    else if (id === 'munch') { booBody(); roundEars(); booEyesMouth('munch'); }
    else if (id === 'sunny') { booBody(); roundEars(); booEyesMouth('sunny'); }
    else if (id === 'bloop' || id === 'nova') { booBody(); roundEars(); booEyesMouth(); if (id === 'nova') { P(() => { cx.moveTo(c - 60, c + 150); cx.quadraticCurveTo(c, c + 120, c + 60, c + 150); }); } }
    // RUN5 C6: the missing Boo species
    else if (id === 'twirl') { booBody(); roundEars(); P(() => { cx.moveTo(c, 130); cx.quadraticCurveTo(c - 40, 80, c + 10, 50); cx.quadraticCurveTo(c + 50, 30, c + 30, 66); }); booEyesMouth(); }
    else if (id === 'snug') { booBody(); roundEars(); booEyesMouth(); P(() => { cx.moveTo(c - 190, c + 110); cx.quadraticCurveTo(c, c + 180, c + 190, c + 110); cx.lineTo(c + 170, c + 190); cx.quadraticCurveTo(c, c + 250, c - 170, c + 190); cx.closePath(); }); }
    else if (id === 'zippy') { booBody(); roundEars(); booEyesMouth(); P(() => { cx.moveTo(c + 190, c - 20); cx.lineTo(c + 250, c - 60); cx.lineTo(c + 220, c - 10); cx.lineTo(c + 270, c - 40); }); }
    // the guide species (RUN5 C6)
    else if (id === 'giraffe') { E(c, 420, 150, 130); P(() => { cx.moveTo(c - 45, 320); cx.lineTo(c - 40, 160); cx.moveTo(c + 45, 320); cx.lineTo(c + 40, 160); }); E(c, 130, 85, 75); P(() => { cx.moveTo(c - 45, 70); cx.lineTo(c - 45, 36); cx.moveTo(c + 45, 70); cx.lineTo(c + 45, 36); }); E(c - 45, 30, 12, 12); E(c + 45, 30, 12, 12); E(c - 32, 128, 14, 18); E(c + 32, 128, 14, 18); }
    else if (id === 'puppy') { E(c, c + 90, 170, 140); E(c, 210, 120, 105); P(() => { cx.moveTo(c - 105, 140); cx.quadraticCurveTo(c - 175, 200, c - 115, 275); }); P(() => { cx.moveTo(c + 105, 140); cx.quadraticCurveTo(c + 175, 200, c + 115, 275); }); E(c - 45, 195, 16, 20); E(c + 45, 195, 16, 20); E(c, 240, 20, 14); }
    else if (id === 'kitten') { E(c, c + 90, 170, 140); E(c, 215, 115, 100); P(() => { cx.moveTo(c - 100, 150); cx.lineTo(c - 130, 70); cx.lineTo(c - 45, 118); }); P(() => { cx.moveTo(c + 100, 150); cx.lineTo(c + 130, 70); cx.lineTo(c + 45, 118); }); E(c - 42, 200, 15, 18); E(c + 42, 200, 15, 18); P(() => { cx.moveTo(c - 120, 240); cx.lineTo(c - 185, 230); cx.moveTo(c - 120, 258); cx.lineTo(c - 185, 262); cx.moveTo(c + 120, 240); cx.lineTo(c + 185, 230); cx.moveTo(c + 120, 258); cx.lineTo(c + 185, 262); }); }
    else if (id === 'penguin') { E(c, c + 40, 175, 215); E(c, c + 70, 110, 140); P(() => { cx.moveTo(c - 170, c - 20); cx.quadraticCurveTo(c - 230, c + 60, c - 160, c + 130); }); P(() => { cx.moveTo(c + 170, c - 20); cx.quadraticCurveTo(c + 230, c + 60, c + 160, c + 130); }); E(c - 50, c - 90, 20, 24); E(c + 50, c - 90, 20, 24); P(() => { cx.moveTo(c - 24, c - 40); cx.lineTo(c, c - 14); cx.lineTo(c + 24, c - 40); cx.closePath(); }); }
    else if (id === 'bunny') { E(c, c + 100, 165, 135); E(c, 250, 110, 100); E(c - 55, 115, 34, 95); E(c + 55, 115, 34, 95); E(c - 40, 235, 15, 18); E(c + 40, 235, 15, 18); P(() => { cx.moveTo(c - 16, 285); cx.quadraticCurveTo(c, 300, c + 16, 285); }); }
    // the activity items (RUN5 C6)
    else if (id === 'slide') { P(() => { cx.moveTo(120, 140); cx.lineTo(220, 140); cx.lineTo(500, 460); cx.lineTo(400, 460); cx.closePath(); }); P(() => { cx.moveTo(120, 140); cx.lineTo(120, 460); cx.moveTo(170, 140); cx.lineTo(170, 460); cx.moveTo(120, 220); cx.lineTo(170, 220); cx.moveTo(120, 300); cx.lineTo(170, 300); cx.moveTo(120, 380); cx.lineTo(170, 380); }); P(() => { cx.moveTo(90, 460); cx.lineTo(540, 460); }); }
    else if (id === 'swings') { P(() => { cx.moveTo(90, 460); cx.lineTo(160, 120); cx.lineTo(480, 120); cx.lineTo(550, 460); }); P(() => { cx.moveTo(250, 120); cx.lineTo(250, 350); cx.moveTo(390, 120); cx.lineTo(390, 350); }); P(() => { cx.moveTo(220, 350); cx.lineTo(280, 350); cx.moveTo(360, 350); cx.lineTo(420, 350); }); P(() => { cx.moveTo(60, 460); cx.lineTo(580, 460); }); }
    else if (id === 'bumper') { E(c, 330, 210, 110); P(() => { cx.moveTo(c - 210, 330); cx.quadraticCurveTo(c - 240, 250, c - 160, 240) ; }); E(c - 60, 250, 60, 55); P(() => { cx.moveTo(c - 120, 440); cx.arc(c - 120, 440, 45, 0, Math.PI * 2); cx.moveTo(c + 120, 440); cx.arc(c + 120, 440, 45, 0, Math.PI * 2); }); P(() => { cx.moveTo(c + 40, 250); cx.lineTo(c + 40, 150); cx.arc(c + 40, 135, 15, Math.PI / 2, Math.PI * 2.5); }); }
    else if (id === 'campfire') { P(() => { cx.moveTo(180, 440); cx.lineTo(460, 400); cx.moveTo(180, 400); cx.lineTo(460, 440); }); P(() => { cx.moveTo(c, 180); cx.quadraticCurveTo(c + 90, 260, c + 60, 340); cx.quadraticCurveTo(c + 30, 390, c, 395); cx.quadraticCurveTo(c - 30, 390, c - 60, 340); cx.quadraticCurveTo(c - 90, 260, c, 180); }); P(() => { cx.moveTo(c, 260); cx.quadraticCurveTo(c + 40, 310, c, 370); cx.quadraticCurveTo(c - 40, 310, c, 260); }); }
    // one whole-town scene (RUN5 C6)
    else if (id === 'town') {
      cx.lineWidth = 6;
      P(() => { cx.moveTo(0, 380); cx.quadraticCurveTo(160, 300, 320, 370); cx.quadraticCurveTo(480, 430, 640, 360); });
      P(() => { cx.moveTo(80, 380); cx.lineTo(80, 280); cx.lineTo(150, 220); cx.lineTo(220, 280); cx.lineTo(220, 388); }); P(() => { cx.moveTo(120, 388); cx.lineTo(120, 330); cx.lineTo(170, 330); cx.lineTo(170, 388); });
      E(460, 250, 70, 70); P(() => { cx.moveTo(460, 320); cx.lineTo(460, 400); });
      E(320, 430, 55, 45); E(300, 415, 12, 14); E(340, 415, 12, 14);
      P(() => { cx.moveTo(555, 120); cx.arc(560, 120, 40, 0, Math.PI * 2); });
      P(() => { cx.moveTo(60, 120) ; cx.quadraticCurveTo(90, 90, 130, 110); cx.quadraticCurveTo(170, 90, 190, 120); cx.quadraticCurveTo(160, 145, 120, 135); cx.quadraticCurveTo(85, 145, 60, 120); });
    }
    // seasonal pages (RUN5 C6, gated by the seasonal calendar)
    else if (id === 'sunshine') { E(c, c, 130, 130); for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; P(() => { cx.moveTo(c + Math.cos(a) * 165, c + Math.sin(a) * 165); cx.lineTo(c + Math.cos(a) * 235, c + Math.sin(a) * 235); }); } E(c - 45, c - 20, 16, 22); E(c + 45, c - 20, 16, 22); P(() => { cx.moveTo(c - 45, c + 45); cx.quadraticCurveTo(c, c + 85, c + 45, c + 45); }); }
    else if (id === 'icelolly') { P(() => { cx.moveTo(c - 110, 120); cx.quadraticCurveTo(c, 40, c + 110, 120); cx.lineTo(c + 110, 330); cx.quadraticCurveTo(c, 390, c - 110, 330); cx.closePath(); }); P(() => { cx.moveTo(c - 70, 140); cx.lineTo(c - 70, 330); cx.moveTo(c, 130); cx.lineTo(c, 348); cx.moveTo(c + 70, 140); cx.lineTo(c + 70, 330); }); P(() => { cx.moveTo(c - 18, 370); cx.lineTo(c - 18, 470); cx.quadraticCurveTo(c, 490, c + 18, 470); cx.lineTo(c + 18, 370); }); }
    else if (id === 'pumpkin') { E(c, c + 40, 200, 160); E(c - 90, c + 40, 90, 150); E(c + 90, c + 40, 90, 150); P(() => { cx.moveTo(c - 10, 140); cx.quadraticCurveTo(c - 5, 90, c + 40, 80); cx.quadraticCurveTo(c + 15, 110, c + 18, 142); }); P(() => { cx.moveTo(c - 90, c); cx.lineTo(c - 55, c + 40); cx.lineTo(c - 125, c + 40); cx.closePath(); }); P(() => { cx.moveTo(c + 90, c); cx.lineTo(c + 125, c + 40); cx.lineTo(c + 55, c + 40); cx.closePath(); }); P(() => { cx.moveTo(c - 70, c + 105); cx.quadraticCurveTo(c, c + 150, c + 70, c + 105); }); }
    else if (id === 'ghost') { P(() => { cx.moveTo(c - 130, c + 160); cx.lineTo(c - 130, c - 60); cx.quadraticCurveTo(c - 130, c - 190, c, c - 190); cx.quadraticCurveTo(c + 130, c - 190, c + 130, c - 60); cx.lineTo(c + 130, c + 160); cx.quadraticCurveTo(c + 85, c + 115, c + 65, c + 160); cx.quadraticCurveTo(c + 30, c + 115, c, c + 160); cx.quadraticCurveTo(c - 30, c + 115, c - 65, c + 160); cx.quadraticCurveTo(c - 85, c + 115, c - 130, c + 160); }); E(c - 45, c - 70, 18, 26); E(c + 45, c - 70, 18, 26); E(c, c, 22, 16); }
    else if (id === 'snowman') { E(c, 420, 140, 105); E(c, 250, 100, 85); E(c, 120, 65, 60); E(c - 22, 108, 8, 10); E(c + 22, 108, 8, 10); P(() => { cx.moveTo(c, 125); cx.lineTo(c + 34, 132); cx.lineTo(c, 142); }); P(() => { cx.moveTo(c - 95, 230); cx.lineTo(c - 180, 180); cx.moveTo(c + 95, 230); cx.lineTo(c + 180, 180); }); E(c, 240, 6, 6); E(c, 275, 6, 6); }
    else if (id === 'snowflake') { for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const dx = Math.cos(a), dy = Math.sin(a); P(() => { cx.moveTo(c, c); cx.lineTo(c + dx * 210, c + dy * 210); }); P(() => { cx.moveTo(c + dx * 130 - dy * 40, c + dy * 130 + dx * 40); cx.lineTo(c + dx * 170, c + dy * 170); cx.lineTo(c + dx * 130 + dy * 40, c + dy * 130 - dx * 40); }); } E(c, c, 30, 30); }
    else { E(c, c + 20, 200, 250); }
    undoStack.length = 0; snapshot();
    dirty = false;
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
    if (tool === 'fill') { floodFill(x | 0, y | 0, curColour()); dirty = true; snapshot(); return; }
    if (tool === 'pattern') { patternFill(x | 0, y | 0, curColour(), patternKind); dirty = true; snapshot(); sfx.pop(); return; }
    if (tool === 'stamp') { drawStamp(x, y); dirty = true; snapshot(); sfx.tap(); return; }
    painting = true; lastX = x; lastY = y; sfx.tap();
    stroke(x, y, x, y);
  });
  canvas.addEventListener('pointermove', e => { if (!painting) return; const { x, y } = toCanvas(e); stroke(lastX, lastY, x, y); lastX = x; lastY = y; });
  const stop = () => { if (painting) { painting = false; snapshot(); } };
  canvas.addEventListener('pointerup', stop); canvas.addEventListener('pointercancel', stop);

  function stroke(x0, y0, x1, y1) {
    dirty = true;
    if (tool === 'sparkle') { drawSparkle(x1, y1); return; }
    cx.strokeStyle = tool === 'eraser' ? '#FFF8F0' : curColour();
    cx.lineWidth = tool === 'eraser' ? brush * 1.4 : brush;
    cx.lineCap = 'round'; cx.lineJoin = 'round';
    cx.beginPath(); cx.moveTo(x0, y0); cx.lineTo(x1, y1); cx.stroke();
  }

  // ---- stamps (RUN5 C6): star, heart, flower, paw, sparkle in the current colour ----
  function drawStamp(x, y) {
    const r = Math.max(18, brush * 1.6);
    cx.save(); cx.translate(x, y); cx.fillStyle = curColour(); cx.strokeStyle = '#2A1B4E'; cx.lineWidth = 3; cx.lineJoin = 'round';
    if (stampShape === 'star') {
      cx.beginPath();
      for (let i = 0; i < 5; i++) { const a = (i * 72 - 90) * Math.PI / 180, a2 = a + Math.PI / 5; cx.lineTo(Math.cos(a) * r, Math.sin(a) * r); cx.lineTo(Math.cos(a2) * r * 0.45, Math.sin(a2) * r * 0.45); }
      cx.closePath(); cx.fill(); cx.stroke();
    } else if (stampShape === 'heart') {
      cx.beginPath();
      cx.moveTo(0, r * 0.85);
      cx.bezierCurveTo(-r * 1.3, r * 0.05, -r * 0.65, -r * 0.9, 0, -r * 0.25);
      cx.bezierCurveTo(r * 0.65, -r * 0.9, r * 1.3, r * 0.05, 0, r * 0.85);
      cx.fill(); cx.stroke();
    } else if (stampShape === 'flower') {
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; cx.beginPath(); cx.ellipse(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * 0.38, r * 0.38, 0, 0, Math.PI * 2); cx.fill(); cx.stroke(); }
      cx.beginPath(); cx.arc(0, 0, r * 0.32, 0, Math.PI * 2); cx.fillStyle = '#FFC93C'; cx.fill(); cx.stroke();
    } else if (stampShape === 'paw') {
      cx.beginPath(); cx.ellipse(0, r * 0.25, r * 0.55, r * 0.45, 0, 0, Math.PI * 2); cx.fill(); cx.stroke();
      for (const [dx, dy] of [[-0.62, -0.35], [-0.22, -0.6], [0.22, -0.6], [0.62, -0.35]]) { cx.beginPath(); cx.ellipse(dx * r, dy * r, r * 0.2, r * 0.24, 0, 0, Math.PI * 2); cx.fill(); cx.stroke(); }
    } else {   // sparkle: a four-point twinkle
      cx.beginPath();
      cx.moveTo(0, -r); cx.quadraticCurveTo(r * 0.12, -r * 0.12, r, 0); cx.quadraticCurveTo(r * 0.12, r * 0.12, 0, r); cx.quadraticCurveTo(-r * 0.12, r * 0.12, -r, 0); cx.quadraticCurveTo(-r * 0.12, -r * 0.12, 0, -r);
      cx.fill(); cx.stroke();
    }
    cx.restore();
  }

  // ---- pattern fill (RUN5 C6): fill a region with stripes or polka dots ----
  // Same scanline flood as floodFill, but collecting a MASK; then only the pattern's
  // pixels inside the mask take the colour (stripes at 45°, or a dot grid).
  function patternFill(sx, sy, colourStr, kind) {
    const img = cx.getImageData(0, 0, SIZE, SIZE); const d = img.data;
    const idx = (x, y) => (y * SIZE + x) * 4;
    const s = idx(sx, sy);
    const tr = d[s], tg = d[s + 1], tb = d[s + 2];
    const fill = parseColour(colourStr);
    const mask = new Uint8Array(SIZE * SIZE);
    const match = (i) => near(d[i], d[i + 1], d[i + 2], tr, tg, tb, 40);
    const stack = [[sx, sy]];
    while (stack.length) {
      const [x, y] = stack.pop(); if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) continue;
      if (mask[y * SIZE + x]) continue;
      let i = idx(x, y); if (!match(i)) continue;
      let xl = x; while (xl > 0 && !mask[y * SIZE + xl - 1] && match(idx(xl - 1, y))) xl--;
      let xr = x; while (xr < SIZE - 1 && !mask[y * SIZE + xr + 1] && match(idx(xr + 1, y))) xr++;
      for (let xx = xl; xx <= xr; xx++) { mask[y * SIZE + xx] = 1; if (y > 0) stack.push([xx, y - 1]); if (y < SIZE - 1) stack.push([xx, y + 1]); }
    }
    const STRIPE = 26, DOT_GRID = 34, DOT_R = 9;
    for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
      if (!mask[y * SIZE + x]) continue;
      let on = false;
      if (kind === 'stripes') on = (((x + y) / STRIPE) | 0) % 2 === 0;
      else { const gx = x % DOT_GRID - DOT_GRID / 2, gy = y % DOT_GRID - DOT_GRID / 2; on = gx * gx + gy * gy <= DOT_R * DOT_R; }
      if (on) { const j = idx(x, y); d[j] = fill.r; d[j + 1] = fill.g; d[j + 2] = fill.b; d[j + 3] = 255; }
    }
    cx.putImageData(img, 0, 0);
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
  [['brush', '🖌️'], ['fill', '🪣'], ['sparkle', '✨'], ['stamp', '🐾'], ['pattern', '▦'], ['eraser', '🧽']].forEach(([t, ic]) => {
    const b = el('button', { class: 'paint-tool' + (t === tool ? ' sel' : ''), text: ic, 'aria-label': t, onclick: () => { tool = t; Object.values(toolBtns).forEach(x => x.classList.remove('sel')); b.classList.add('sel'); renderSubRow(); } });
    toolBtns[t] = b; tools.appendChild(b);
  });

  // sub-choices for the new tools (RUN5 C6): stamp shapes / pattern kinds
  const subRow = el('div', { class: 'paint-subrow' });
  function renderSubRow() {
    clear(subRow);
    if (tool === 'stamp') {
      [['star', '⭐'], ['heart', '💗'], ['flower', '🌸'], ['paw', '🐾'], ['sparkle', '✨']].forEach(([k, ic]) => {
        subRow.appendChild(el('button', { class: 'acc-chip stamp-chip' + (stampShape === k ? ' sel' : ''), text: ic, 'aria-label': k,
          onclick: () => { stampShape = k; sfx.tap(); renderSubRow(); } }));
      });
    } else if (tool === 'pattern') {
      [['stripes', 'Stripes 🦓'], ['dots', 'Polka dots 🔴']].forEach(([k, label]) => {
        subRow.appendChild(el('button', { class: 'acc-chip pattern-chip' + (patternKind === k ? ' sel' : ''), text: label,
          onclick: () => { patternKind = k; sfx.tap(); renderSubRow(); } }));
      });
    }
    subRow.style.display = (tool === 'stamp' || tool === 'pattern') ? '' : 'none';
  }
  renderSubRow();
  const sizes = el('div', { class: 'paint-sizes' });
  BRUSH_SIZES.forEach((sz, i) => { const b = el('button', { class: 'paint-size' + (sz === brush ? ' sel' : ''), onclick: () => { brush = sz; [...sizes.children].forEach(x => x.classList.remove('sel')); b.classList.add('sel'); } }, [el('span', { class: 'ps-dot', style: { width: (8 + i * 7) + 'px', height: (8 + i * 7) + 'px' } })]); sizes.appendChild(b); });

  const undoBtn = el('button', { class: 'btn soft', text: '↩ Undo', onclick: () => { sfx.tap(); undo(); } });
  const saveBtn = el('button', { class: 'btn', text: '💾 Save to gallery', onclick: () => doSave() });
  const saveMsg = el('span', { class: 'gu-msg' });

  const tmplRow = el('div', { class: 'paint-templates' });
  function renderTemplates() {
    clear(tmplRow);
    if (draftRec) tmplRow.appendChild(el('button', { class: 'paint-tmpl draft-tmpl', text: '▶ Continue draft', onclick: () => { sfx.tap(); loadDraft(); } }));
    availableTemplates().forEach(t => tmplRow.appendChild(el('button', { class: 'paint-tmpl', text: t.name, onclick: () => { sfx.tap(); drawTemplate(t.id); } })));
  }
  renderTemplates();

  async function doSave() {
    const png = canvas.toDataURL('image/png');
    const res = await saveArtwork(png, 'paint');
    if (res.full) { saveMsg.textContent = 'Gallery is full (20)! Delete one first.'; saveMsg.classList.add('err'); }
    else {
      saveMsg.classList.remove('err'); saveMsg.textContent = 'Saved! 🌟'; sfx.star();
      dirty = false;
      // a saved painting is no longer a draft (RUN5 C6)
      if (draftRec) { try { await idbDelete('artworks', DRAFT_ID); } catch {} draftRec = null; renderTemplates(); }
    }
    setTimeout(() => saveMsg.textContent = '', 2600);
  }

  // Leaving mid-way keeps the painting as a draft (RUN5 C6). Drafts share the
  // gallery cap: with a full gallery and no existing draft slot, nothing saves.
  async function stashDraft() {
    if (!dirty) return;
    try {
      const existing = await idbGet('artworks', DRAFT_ID);
      if (!existing) { const count = await idbCount('artworks'); if (count >= GALLERY_CAP) return; }
      await idbPut('artworks', { id: DRAFT_ID, png: canvas.toDataURL('image/png'), kind: 'paint', draft: true, created: Date.now() });
    } catch {}
  }

  root.append(header, tmplRow, el('div', { class: 'paint-stage' }, [canvas]), swatches,
    el('div', { class: 'paint-controls' }, [tools, sizes]), subRow,
    el('div', { class: 'paint-actions' }, [undoBtn, saveBtn, saveMsg]));
  container.appendChild(root);

  // test hook
  if (typeof window !== 'undefined') window.__paint = {
    fill: (x, y, c) => { floodFill(x, y, c); dirty = true; snapshot(); }, save: doSave, dataURL: () => canvas.toDataURL('image/png'),
    // RUN5 C6 QA hooks
    stamp: (x, y, shape) => { if (shape) stampShape = shape; drawStamp(x, y); dirty = true; snapshot(); },
    pattern: (x, y, kind, c) => { patternFill(x, y, c || colour, kind || patternKind); dirty = true; snapshot(); },
    setColour: (c) => { colour = c; rainbow = false; },
    templates: () => availableTemplates().map(t => t.id),
    draw: (id) => drawTemplate(id),
    isDirty: () => dirty,
    stashDraft, loadDraft, hasDraft: () => !!draftRec,
    pixel: (x, y) => { const d = cx.getImageData(x, y, 1, 1).data; return [d[0], d[1], d[2]]; }
  };
  return { unmount() { stashDraft(); } };
}

function parseColour(s) {
  if (s[0] === '#') { const h = s.slice(1); return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) }; }
  const m = s.match(/hsl\(([\d.]+)\s+([\d.]+)%\s+([\d.]+)%/); if (m) return hslToRgb(+m[1], +m[2] / 100, +m[3] / 100);
  return { r: 0, g: 0, b: 0 };
}
function hslToRgb(h, s, l) { h /= 360; const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q; const f = (t) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; }; return { r: Math.round(f(h + 1 / 3) * 255), g: Math.round(f(h) * 255), b: Math.round(f(h - 1 / 3) * 255) }; }
function near(r, g, b, r2, g2, b2, t) { return Math.abs(r - r2) <= t && Math.abs(g - g2) <= t && Math.abs(b - b2) <= t; }
