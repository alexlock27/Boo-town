// js/wordart.js — RUN16: the picture-word library for the four literacy games.
//
// Every word the authored packs use (W1 Sound Sorter, W2 Blend It, W3 Rhyme Time and the
// literacy lessons) gets one inline SVG in the house sticker style: flat fills, one ink
// outline, no gradients, no image files, no emoji-as-art. Drawn on a 120x120 canvas so a
// card at 80px still reads.
//
// WHY THIS EXISTS AS ART AND NOT AS TEXT (G14). These games are for a child who cannot yet
// read the words she is sorting — that is the whole point of phonics. The picture carries
// the meaning, the guide speaks the word, and the grapheme card carries the target with
// sound off. So a missing picture is a broken activity, not a cosmetic gap: the tests
// assert every authored word in every pack resolves to a drawing here.
//
// Where the house already draws a noun, this file delegates to js/art.js rather than
// drawing a second version of it (RUN16 W1: "reuse existing art where the noun already
// exists") — see REUSE_DECO below.

import { renderDeco } from './art.js';
import { escapeHTML } from './ui.js';

const INK = '#2A1B4E';
const S = `stroke="${INK}" stroke-width="3.5" stroke-linejoin="round" stroke-linecap="round"`;
const THIN = `stroke="${INK}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"`;
const NO = 'stroke="none"';

// palette (the house colours; kept local so a drawing never invents a new one)
const CL = {
  ink: INK, cream: '#FFF8F0', gold: '#FFC93C', pink: '#FF7AC6', teal: '#35D0BA',
  lilac: '#C6A9F0', sky: '#8FC7FF', cocoa: '#8A5A44', sand: '#F0D28C', orange: '#FF9A52',
  red: '#E8636F', seablue: '#3AA0D8', iceblue: '#BFE6F5', green: '#5FB86E',
  darkgreen: '#3E9A56', grey: '#B8B0C8', slate: '#8E86A0', white: '#FFFFFF',
  night: '#2B2170', brown: '#7A4A34', silver: '#D8DCE8', blush: '#FF9EC4'
};

// ---- tiny drawing helpers ------------------------------------------------------------
const E = (cx, cy, rx, ry, f, e = S) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${f}" ${e}/>`;
const C = (cx, cy, r, f, e = S) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${f}" ${e}/>`;
const R = (x, y, w, h, r, f, e = S) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${f}" ${e}/>`;
const P = (d, f, e = S) => `<path d="${d}" fill="${f}" ${e}/>`;
const L = (d, col = INK, w = 3.5, extra = '') => `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
const STAR = (cx, cy, ro, ri = ro * 0.46) => {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? ri : ro;
    d += (i ? 'L' : 'M') + (cx + r * Math.cos(a)).toFixed(1) + ' ' + (cy + r * Math.sin(a)).toFixed(1) + ' ';
  }
  return d + 'Z';
};
// a plain Boo blob: body, two ear bumps, eyes, smile. The shared cast of every scene.
function boo(cx, cy, col = CL.lilac, { r = 22, smile = true, eyesShut = false } = {}) {
  return E(cx, cy + 4, r, r * 0.92, col) +
    E(cx - r * 0.72, cy - r * 0.78, r * 0.32, r * 0.46, col) +
    E(cx + r * 0.72, cy - r * 0.78, r * 0.32, r * 0.46, col) +
    (eyesShut
      ? L(`M${cx - r * 0.42} ${cy} q3 3 6 0`, INK, 2.5) + L(`M${cx + r * 0.24} ${cy} q3 3 6 0`, INK, 2.5)
      : C(cx - r * 0.36, cy, r * 0.17, INK, NO) + C(cx + r * 0.36, cy, r * 0.17, INK, NO)) +
    (smile ? L(`M${cx - r * 0.3} ${cy + r * 0.42} q${r * 0.3} ${r * 0.3} ${r * 0.6} 0`, INK, 2.8) : '');
}
const grass = (y = 100) => R(0, y, 120, 120 - y, 0, CL.green, NO) + L(`M0 ${y} H120`, INK, 3);
const water = (y = 84) => R(0, y, 120, 120 - y, 0, CL.seablue, NO) +
  L(`M6 ${y + 10} q8 -5 16 0 t16 0 t16 0 t16 0 t16 0 t16 0`, '#fff', 2.5, 'opacity="0.55"');
const sky = (col = CL.iceblue) => R(0, 0, 120, 120, 0, col, NO);
const house = (x, y, w, h, wall, roof) =>
  R(x, y, w, h, 3, wall) + P(`M${x - 5} ${y} L${x + w / 2} ${y - h * 0.55} L${x + w + 5} ${y} Z`, roof) +
  R(x + w * 0.34, y + h * 0.42, w * 0.32, h * 0.58, 2, CL.cocoa);
const notes = (x, y, col = CL.ink) =>
  C(x, y, 4.5, col, NO) + L(`M${x + 4} ${y} V${y - 16}`, col, 3) + L(`M${x + 4} ${y - 16} q7 2 9 6`, col, 3) +
  C(x + 20, y + 8, 4.5, col, NO) + L(`M${x + 24} ${y + 8} V${y - 8}`, col, 3);
const arrowDown = (x, y, col = CL.red) => L(`M${x} ${y - 16} V${y}`, col, 4) + P(`M${x - 6} ${y - 2} L${x + 6} ${y - 2} L${x} ${y + 7} Z`, col, NO);
const arrowUp = (x, y, col = CL.red) => L(`M${x} ${y + 16} V${y}`, col, 4) + P(`M${x - 6} ${y + 2} L${x + 6} ${y + 2} L${x} ${y - 7} Z`, col, NO);
const sparkle = (x, y, r = 6, col = CL.gold) => P(STAR(x, y, r), col, THIN);

// Nouns the house already draws are delegated to js/art.js rather than drawn twice:
// bath -> bathtub, bed, boot -> wellies, flower, picnic, rug, tree, well -> wishwell.
// Each one calls renderDecoInner() at the bottom of this file.

// =====================================================================================
// The drawings. Keyed by the exact word as authored in the packs.
// =====================================================================================
const ART = {
  // ---- sh ----------------------------------------------------------------------------
  ship: () => sky() + water(84) + P('M16 84 L104 84 L92 104 L28 104 Z', '#C4433F') +
    R(34, 56, 52, 28, 4, CL.cream) + R(52, 34, 16, 24, 3, CL.red) + R(50, 30, 20, 8, 3, CL.ink) +
    [44, 60, 76].map(x => C(x, 70, 5, CL.iceblue, THIN)).join('') +
    [[26, 24], [40, 16]].map(([x, y]) => C(x, y, 8, CL.cream, THIN)).join(''),
  shell: () => E(60, 76, 40, 34, CL.blush) + L('M60 76 L24 62', CL.ink, 3) + L('M60 76 L34 44', CL.ink, 3) +
    L('M60 76 L60 40', CL.ink, 3) + L('M60 76 L86 44', CL.ink, 3) + L('M60 76 L96 62', CL.ink, 3) + C(60, 78, 5, CL.pink),
  fish: () => sky() + water(0) + E(56, 60, 30, 21, CL.gold) + P('M84 60 L106 44 L106 76 Z', CL.orange) +
    C(42, 54, 4, CL.ink, NO) + L('M62 52 q8 8 0 16', CL.ink, 2.5) + E(70, 60, 4, 7, CL.orange),
  brush: () => R(36, 22, 48, 46, 12, CL.pink) + R(50, 64, 20, 38, 8, CL.cocoa) + R(46, 96, 28, 10, 5, CL.cocoa) +
    [42, 51, 60, 69, 78].map(x => L(`M${x} 60 V30`, CL.slate, 4)).join('') +
    [42, 51, 60, 69, 78].map(x => C(x, 28, 3, CL.slate, NO)).join(''),
  shed: () => sky() + grass(96) + R(28, 52, 64, 46, 3, CL.sand) + P('M20 52 L60 26 L100 52 Z', CL.red) +
    R(52, 68, 18, 30, 2, CL.cocoa) + C(66, 82, 2.5, CL.gold, NO),
  wish: () => sky(CL.night) + [20, 96, 40].map((x, i) => sparkle(x, 22 + i * 18, 5)).join('') +
    P(STAR(66, 44, 20), CL.gold) + L('M50 58 Q28 76 14 98', CL.gold, 5) + L('M58 64 Q40 84 30 104', CL.gold, 3.5),
  // ---- ch ----------------------------------------------------------------------------
  chip: () => P('M32 44 L88 44 L78 108 L42 108 Z', CL.cream) +
    [[44, 34], [58, 28], [72, 34], [51, 40], [65, 40]].map(([x, y]) => R(x, y, 10, 34, 4, CL.gold)).join('') +
    P('M32 44 L88 44 L78 108 L42 108 Z', 'none', S),
  // the lesson pack writes "chips"; the drawing is the same cone of chips
  chips: () => ART.chip(),
  chair: () => R(34, 22, 52, 46, 6, CL.teal) + R(30, 64, 60, 12, 4, CL.teal) +
    L('M36 76 V104', CL.ink, 5) + L('M84 76 V104', CL.ink, 5) + L('M44 76 V98', CL.ink, 4),
  beach: () => sky() + C(96, 24, 14, CL.gold) + water(58) + R(0, 78, 120, 42, 0, CL.sand, NO) + L('M0 78 H120', CL.ink, 3) +
    L('M40 78 V40', CL.cocoa, 5) + P('M40 40 Q66 44 62 62 Q40 58 40 40 Z', CL.pink),
  cheese: () => P('M18 84 L18 52 L96 34 L96 84 Z', CL.gold) + P('M18 52 L96 34 L96 44 L18 62 Z', '#FFE08A', THIN) +
    C(40, 72, 6, CL.cream) + C(64, 66, 5, CL.cream) + C(82, 74, 4.5, CL.cream),
  church: () => sky() + grass(100) + R(30, 56, 60, 44, 3, CL.cream) + P('M24 56 L60 34 L96 56 Z', CL.slate) +
    R(56, 12, 8, 24, 3, CL.slate) + L('M60 8 V20', CL.gold, 4) + L('M54 13 H66', CL.gold, 4) +
    P('M50 74 q10 -14 20 0 V100 H50 Z', CL.cocoa),
  watch: () => C(60, 60, 30, CL.cream) + C(60, 60, 22, CL.iceblue) + R(50, 12, 20, 20, 4, CL.lilac) +
    R(50, 88, 20, 20, 4, CL.lilac) + L('M60 60 V44', CL.ink, 4) + L('M60 60 L74 66', CL.ink, 3.5) + C(60, 60, 3, CL.ink, NO),
  // ---- th ----------------------------------------------------------------------------
  thumb: () => R(44, 52, 46, 52, 12, CL.sand) +
    [66, 80, 94].map(y => L(`M52 ${y} H84`, CL.ink, 2.2)).join('') +
    P('M44 62 Q28 62 26 44 Q24 24 40 24 Q52 24 52 42 L52 62 Z', CL.sand) +
    L('M44 52 Q60 46 76 52', CL.ink, 2.2),
  thorn: () => grass(108) + L('M60 108 Q52 70 62 30', CL.darkgreen, 6) +
    [[62, 44, 1], [58, 62, -1], [63, 78, 1], [56, 92, -1]].map(([x, y, d]) => P(`M${x} ${y} l${d * 16} ${-8} l${-d * 14} ${12} Z`, CL.green)).join('') +
    E(62, 26, 13, 11, CL.red) + C(62, 26, 5, CL.pink),
  bath: () => P('M16 44 H104 V78 Q104 96 84 96 H36 Q16 96 16 78 Z', CL.cream) +
    P('M22 56 H98 V76 Q98 88 82 88 H38 Q22 88 22 76 Z', CL.iceblue, THIN) +
    L('M14 44 H106', CL.ink, 4) + L('M20 96 V108', CL.slate, 5) + L('M100 96 V108', CL.slate, 5) +
    L('M100 40 V22 q0 -8 -10 -8 H74', CL.slate, 5) +
    [[40, 40, 9], [62, 34, 7], [82, 42, 6]].map(([x, y, r]) => C(x, y, r, CL.white, THIN)).join(''),
  moth: () => P('M56 60 Q22 34 20 62 Q22 88 56 72 Z', CL.sand) + P('M64 60 Q98 34 100 62 Q98 88 64 72 Z', CL.sand) +
    E(60, 66, 8, 24, CL.cocoa) + C(60, 44, 7, CL.cocoa) + L('M56 38 Q48 26 40 24', CL.ink, 2.5) + L('M64 38 Q72 26 80 24', CL.ink, 2.5) +
    C(34, 60, 5, CL.ink, NO) + C(88, 60, 5, CL.ink, NO),
  three: () => [[32, CL.pink], [60, CL.teal], [88, CL.gold]].map(([x, col]) => C(x, 60, 15, col)).join('') +
    [32, 60, 88].map(x => C(x - 4, 54, 3.5, CL.cream, NO)).join(''),
  path: () => grass(24) + P('M24 120 Q40 84 50 62 Q56 46 52 24 L70 24 Q74 48 68 66 Q60 90 62 120 Z', CL.sand) +
    [[44, 106], [52, 84], [58, 62], [58, 42]].map(([x, y]) => E(x, y, 5, 3, CL.cream, THIN)).join('') +
    E(18, 52, 11, 9, CL.darkgreen, THIN) + E(100, 66, 12, 10, CL.darkgreen, THIN),
  // ---- ng ----------------------------------------------------------------------------
  ring: () => C(60, 74, 28, 'none', `stroke="${CL.gold}" stroke-width="12"`) + C(60, 74, 28, 'none', `stroke="${INK}" stroke-width="3"`) +
    C(60, 74, 20, 'none', `stroke="${INK}" stroke-width="2"`) + P(`M60 24 L74 42 L60 52 L46 42 Z`, CL.iceblue),
  song: () => notes(38, 70) + notes(74, 54) + L('M20 96 q10 -8 20 0 t20 0 t20 0 t20 0', CL.lilac, 4),
  king: () => boo(60, 70, CL.gold, { r: 26 }) + P('M34 42 L42 24 L52 36 L60 18 L68 36 L78 24 L86 42 Z', CL.gold) +
    L('M34 42 H86', CL.ink, 3) + C(60, 32, 4, CL.red, THIN),
  wing: () => sky() + E(44, 78, 26, 20, CL.gold) + C(24, 62, 13, CL.gold) + P('M12 60 L2 64 L12 68 Z', CL.orange) +
    C(20, 58, 3.5, CL.ink, NO) +
    P('M52 68 Q66 26 104 20 Q112 52 78 78 Q64 84 52 68 Z', CL.cream) +
    [[62, 68, 92, 34], [70, 74, 100, 44]].map(([a, b2, cx, cy]) => L(`M${a} ${b2} Q${(a + cx) / 2} ${(b2 + cy) / 2 - 8} ${cx} ${cy}`, CL.slate, 2.5)).join('') +
    arrowDown(96, 6, CL.red) + L('M96 6 V2', CL.red, 3),
  strong: () => boo(60, 66, CL.teal, { r: 24 }) + R(14, 54, 14, 20, 4, CL.slate) + R(92, 54, 14, 20, 4, CL.slate) +
    R(26, 61, 68, 6, 3, CL.ink) + L('M40 44 L34 34', CL.ink, 3) + L('M80 44 L86 34', CL.ink, 3),
  thing: () => R(26, 50, 68, 54, 6, CL.lilac) + R(26, 44, 68, 14, 4, CL.pink) + L('M60 44 V104', CL.pink, 5) +
    P('M52 44 Q44 22 60 26 Q76 22 68 44 Z', CL.pink) +
    `<text x="60" y="92" text-anchor="middle" font-family="Fredoka, sans-serif" font-size="34" font-weight="700" fill="${INK}">?</text>`,
  // ---- ai ----------------------------------------------------------------------------
  rain: () => sky() + E(56, 44, 34, 20, CL.cream) + E(80, 46, 20, 15, CL.cream) +
    [30, 48, 66, 84].map((x, i) => L(`M${x} ${68 + (i % 2) * 6} L${x - 5} ${92 + (i % 2) * 6}`, CL.seablue, 4)).join(''),
  snail: () => grass(104) + E(46, 84, 34, 14, CL.sand) + C(74, 68, 24, CL.orange) + C(74, 68, 15, 'none', `stroke="${INK}" stroke-width="3"`) +
    C(74, 68, 7, 'none', `stroke="${INK}" stroke-width="3"`) + L('M22 80 Q16 62 22 54', CL.ink, 3) + L('M32 78 Q30 58 36 52', CL.ink, 3) +
    C(22, 50, 4, CL.ink, NO) + C(37, 48, 4, CL.ink, NO),
  train: () => R(16, 62, 56, 34, 5, CL.red) + R(74, 46, 30, 50, 5, CL.red) + R(80, 54, 18, 16, 3, CL.iceblue) +
    R(84, 26, 12, 22, 3, CL.slate) + [30, 54, 84].map(x => C(x, 100, 9, CL.slate)).join('') + L('M6 110 H114', CL.cocoa, 4),
  tail: () => grass(104) + E(48, 82, 28, 24, CL.orange) + E(48, 60, 18, 14, CL.orange) +
    L('M74 74 Q100 70 98 40 Q96 18 78 18', CL.orange, 13) +
    L('M74 74 Q100 70 98 40 Q96 18 78 18', CL.ink, 3, 'fill="none"') +
    [[92, 58], [100, 40], [92, 22]].map(([x, y]) => L(`M${x - 7} ${y} h13`, CL.cocoa, 3.5)).join('') +
    arrowUp(96, 8, CL.red),
  paint: () => R(34, 54, 44, 48, 5, CL.cream) + R(30, 46, 52, 12, 3, CL.teal) + P('M34 66 q22 12 44 0 V102 H34 Z', CL.pink) +
    L('M88 44 L104 20', CL.cocoa, 6) + P('M82 50 L94 38 L88 58 Z', CL.pink) + C(24, 30, 8, CL.gold),
  chain: () => [[32, 60], [60, 60], [88, 60]].map(([x, y]) => E(x, y, 17, 12, 'none', `stroke="${CL.slate}" stroke-width="9"`) +
    E(x, y, 17, 12, 'none', `stroke="${INK}" stroke-width="2.5"`)).join(''),
  // ---- ee ----------------------------------------------------------------------------
  sheep: () => grass(102) + E(56, 66, 34, 26, CL.cream) + E(34, 52, 14, 12, CL.cream) + E(78, 50, 14, 12, CL.cream) +
    E(88, 68, 15, 17, CL.ink) + C(84, 64, 3, CL.cream, NO) + [42, 58, 72].map(x => L(`M${x} 90 V102`, CL.ink, 4)).join(''),
  tree: () => renderDecoInner('tree'),
  queen: () => boo(60, 72, CL.blush, { r: 26 }) + P('M40 44 Q60 20 80 44 Z', CL.gold) +
    [46, 60, 74].map((x, i) => C(x, 36 - (i === 1 ? 8 : 0), 4.5, CL.pink)).join('') + L('M40 44 H80', CL.ink, 3),
  bee: () => E(60, 66, 28, 22, CL.gold) + [50, 62, 74].map(x => L(`M${x} 48 V84`, CL.ink, 6)).join('') +
    E(60, 66, 28, 22, 'none', S) + E(44, 40, 16, 11, CL.iceblue) + E(78, 40, 16, 11, CL.iceblue) +
    C(34, 62, 4, CL.ink, NO) + L('M30 46 Q24 36 26 30', CL.ink, 2.5),
  green: () => P('M22 70 Q18 40 48 34 Q84 26 98 52 Q108 78 82 92 Q50 106 30 92 Q18 84 22 70 Z', CL.green) +
    L('M56 78 Q52 56 66 42', CL.darkgreen, 4) + P('M66 42 q16 -6 12 12 q-12 4 -12 -12 Z', CL.darkgreen),
  feet: () => [[38, 1], [80, -1]].map(([x, d]) => E(x, 76, 15, 22, CL.blush) +
    [0, 1, 2, 3].map(i => C(x - d * 12 + d * i * 8, 48, 4.5, CL.blush)).join('')).join(''),
  // ---- oa ----------------------------------------------------------------------------
  boat: () => sky() + water(76) + P('M18 76 L102 76 L88 98 L32 98 Z', CL.cocoa) + L('M60 76 V44', CL.cream, 4) +
    L('M40 92 L26 66', CL.cocoa, 4) + L('M80 92 L94 66', CL.cocoa, 4) + P('M62 46 L86 70 L62 70 Z', CL.pink),
  goat: () => E(60, 74, 26, 24, CL.cream) + E(60, 96, 14, 12, CL.cream) + P('M40 54 Q30 30 46 34 Q48 46 46 56 Z', CL.sand) +
    P('M80 54 Q90 30 74 34 Q72 46 74 56 Z', CL.sand) + C(50, 70, 4, CL.ink, NO) + C(70, 70, 4, CL.ink, NO) +
    L('M56 100 q4 10 8 0', CL.cocoa, 4) + C(54, 96, 2, CL.ink, NO) + C(66, 96, 2, CL.ink, NO),
  coat: () => P('M36 34 L60 44 L84 34 L100 52 L92 60 L92 104 L28 104 L28 60 L20 52 Z', CL.seablue) +
    L('M60 44 V104', CL.ink, 3) + [56, 74, 92].map(y => C(52, y, 3.5, CL.gold, THIN)).join('') +
    P('M36 34 L60 44 L52 56 Z', CL.iceblue) + P('M84 34 L60 44 L68 56 Z', CL.iceblue),
  road: () => grass(0) + P('M34 120 L48 30 L72 30 L86 120 Z', CL.slate) + L('M60 34 V44', CL.cream, 4) +
    L('M60 56 V70', CL.cream, 5) + L('M60 84 V104', CL.cream, 6),
  toast: () => P('M26 46 Q26 26 46 26 L74 26 Q94 26 94 46 L94 96 Q94 104 86 104 L34 104 Q26 104 26 96 Z', CL.sand) +
    P('M36 52 Q36 40 48 40 L72 40 Q84 40 84 52 L84 88 L36 88 Z', CL.gold) + E(58, 60, 12, 8, '#FFE9A8', THIN),
  soap: () => R(24, 62, 72, 40, 12, CL.blush) + R(30, 56, 60, 12, 6, CL.pink) +
    C(34, 34, 11, CL.iceblue, THIN) + C(58, 24, 8, CL.iceblue, THIN) + C(80, 38, 13, CL.iceblue, THIN) + C(30, 30, 3, CL.cream, NO),
  // ---- oo ----------------------------------------------------------------------------
  moon: () => sky(CL.night) + P('M74 16 A44 44 0 1 0 74 104 A34 34 0 1 1 74 16 Z', CL.gold) + sparkle(24, 30, 6) + sparkle(34, 88, 5),
  spoon: () => E(60, 38, 20, 26, CL.silver) + E(60, 36, 12, 17, CL.iceblue, THIN) + R(54, 60, 12, 48, 6, CL.silver),
  boot: () => P('M38 16 H76 V70 Q76 78 86 80 L100 84 Q108 86 108 96 V104 H38 Z', CL.gold) +
    R(34, 100, 78, 12, 5, CL.cocoa) + R(36, 16, 42, 12, 4, '#E8B42C', THIN) + L('M40 44 H74', '#E8B42C', 3),
  roof: () => sky() + P('M8 84 L60 32 L112 84 Z', CL.red) + [0, 1, 2].map(i =>
    L(`M${26 + i * 6} ${72 - i * 12} L${94 - i * 6} ${72 - i * 12}`, CL.ink, 2.5)).join('') + R(48, 84, 24, 24, 2, CL.cocoa),
  food: () => C(60, 70, 40, CL.cream) + C(60, 70, 30, CL.iceblue, THIN) + E(50, 66, 15, 11, CL.gold) +
    [[68, 60], [78, 68], [66, 76]].map(([x, y]) => C(x, y, 5, CL.green, THIN)).join('') + E(56, 82, 16, 6, CL.orange, THIN),
  zoo: () => sky() + P('M14 100 V54 Q60 18 106 54 V100 Z', CL.sand) +
    [26, 42, 58, 74, 90].map(x => L(`M${x} 100 V${52 + Math.abs(58 - x) * 0.28}`, CL.slate, 5)).join('') +
    E(60, 74, 18, 15, CL.orange) + C(50, 60, 7, CL.orange) + C(70, 60, 7, CL.orange) + C(54, 72, 3, CL.ink, NO) + C(66, 72, 3, CL.ink, NO),
  // ---- ar ----------------------------------------------------------------------------
  star: () => P(STAR(60, 62, 44), CL.gold),
  car: () => R(14, 62, 92, 30, 10, CL.red) + P('M32 62 L44 40 L78 40 L92 62 Z', CL.red) +
    R(48, 44, 26, 16, 3, CL.iceblue) + C(36, 94, 11, CL.ink) + C(86, 94, 11, CL.ink) + C(36, 94, 4, CL.silver, NO) + C(86, 94, 4, CL.silver, NO),
  farm: () => sky() + grass(98) + R(20, 54, 56, 44, 3, CL.red) + P('M14 54 L48 28 L82 54 Z', CL.cocoa) +
    R(38, 70, 20, 28, 2, CL.cream) + R(84, 44, 22, 54, 4, CL.silver) + P('M82 44 L95 32 L108 44 Z', CL.slate),
  park: () => sky() + grass(96) + L('M96 96 V44', CL.cocoa, 6) + E(96, 36, 20, 17, CL.darkgreen) +
    R(16, 74, 48, 8, 3, CL.cocoa) + L('M22 82 V96', CL.cocoa, 4) + L('M58 82 V96', CL.cocoa, 4) + R(16, 58, 48, 8, 3, CL.cocoa) +
    L('M22 66 V74', CL.cocoa, 3),
  shark: () => water(0) + E(52, 68, 36, 22, CL.slate) + P('M52 46 L64 22 L74 48 Z', CL.slate) +
    P('M88 68 L112 52 L112 84 Z', CL.slate) + C(34, 62, 4, CL.ink, NO) +
    L('M22 74 q10 4 20 0', CL.cream, 3) + [26, 34, 42].map(x => P(`M${x} 74 l4 6 l4 -6 Z`, CL.cream, THIN)).join(''),
  jar: () => R(28, 40, 64, 66, 8, CL.iceblue) + R(24, 28, 72, 16, 5, CL.slate) + P('M34 74 q26 -10 52 0 V98 Q60 106 34 98 Z', CL.red) +
    E(60, 56, 14, 6, CL.cream, THIN),
  // ---- or ----------------------------------------------------------------------------
  fork: () => R(54, 44, 12, 62, 5, CL.silver) + [40, 52, 68, 80].map(x => R(x - 4, 14, 8, 32, 4, CL.silver)).join('') +
    R(38, 40, 44, 10, 4, CL.silver),
  horse: () => E(64, 70, 24, 26, CL.cocoa) + E(64, 96, 15, 12, CL.cocoa) + P('M48 46 L44 26 L58 40 Z', CL.cocoa) +
    P('M80 46 L86 26 L72 40 Z', CL.cocoa) + P('M42 52 Q26 40 30 78 Q40 70 44 60 Z', CL.ink) +
    C(56, 68, 4, CL.ink, NO) + C(74, 68, 4, CL.ink, NO) + C(60, 96, 2.5, CL.ink, NO) + C(70, 96, 2.5, CL.ink, NO),
  corn: () => E(60, 62, 22, 40, CL.gold) + [-10, 0, 10].map(dx => L(`M${60 + dx} 28 V96`, '#E8A93C', 2.5)).join('') +
    [36, 50, 64, 78].map(y => L(`M40 ${y} H80`, '#E8A93C', 2.5)).join('') + E(60, 62, 22, 40, 'none', S) +
    P('M38 74 Q18 88 30 106 Q44 96 46 84 Z', CL.green) + P('M82 74 Q102 88 90 106 Q76 96 74 84 Z', CL.green),
  storm: () => sky('#7E8AA8') + E(56, 42, 36, 20, CL.slate) + E(82, 44, 20, 14, CL.slate) +
    P('M56 60 L44 86 L58 86 L48 110 L76 78 L60 78 L70 60 Z', CL.gold) +
    L('M28 66 L22 88', CL.iceblue, 3.5) + L('M92 66 L86 88', CL.iceblue, 3.5),
  torch: () => R(46, 40, 28, 66, 6, CL.slate) + R(40, 26, 40, 18, 5, CL.gold) +
    P('M40 26 L14 6 L14 34 Z', '#FFF0B0', THIN) + L('M52 60 H68', CL.ink, 3) + L('M52 74 H68', CL.ink, 3),
  sport: () => C(60, 62, 38, CL.cream) + P('M60 34 L78 48 L70 68 L50 68 L42 48 Z', CL.ink, NO) +
    [[60, 24, 0], [90, 56, 1], [30, 56, -1]].map(([x, y]) => L(`M${x} ${y} l0 0`, CL.ink, 3)).join('') +
    L('M60 34 V24', CL.ink, 3) + L('M78 48 L92 42', CL.ink, 3) + L('M42 48 L28 42', CL.ink, 3) +
    L('M70 68 L78 88', CL.ink, 3) + L('M50 68 L42 88', CL.ink, 3),
  // ---- igh ---------------------------------------------------------------------------
  light: () => C(60, 56, 28, '#FFF0B0') + R(48, 82, 24, 18, 4, CL.slate) + L('M52 90 H68', CL.ink, 2.5) +
    [[60, 14], [24, 34], [96, 34], [20, 74], [100, 74]].map(([x, y]) => L(`M${x} ${y} L${60 + (x - 60) * 0.62} ${56 + (y - 56) * 0.62}`, CL.gold, 4)).join(''),
  night: () => sky(CL.night) + P('M76 20 A34 34 0 1 0 76 88 A26 26 0 1 1 76 20 Z', CL.gold) +
    sparkle(22, 30, 5) + sparkle(40, 60, 4) + P('M0 120 L0 98 L20 84 L40 98 L40 120 Z', '#1A1240', THIN) +
    P('M62 120 L62 100 L84 86 L106 100 L106 120 Z', '#1A1240', THIN),
  high: () => sky() + grass(112) + E(60, 40, 22, 26, CL.pink) + L('M60 66 Q64 84 60 112', CL.ink, 2.5) +
    arrowUp(24, 30, CL.red) + L('M24 46 V96', CL.red, 3, 'stroke-dasharray="5 6"'),
  right: () => C(60, 62, 40, '#DFF7E4') + C(60, 62, 40, 'none', `stroke="${CL.darkgreen}" stroke-width="4"`) +
    L('M40 62 L55 78 L84 46', CL.darkgreen, 9),
  sight: () => E(60, 62, 44, 28, CL.cream) + C(60, 62, 20, CL.sky) + C(60, 62, 9, CL.ink, NO) + C(66, 56, 4, CL.cream, NO) +
    L('M20 46 Q60 22 100 46', CL.ink, 3.5),
  bright: () => C(60, 60, 26, CL.gold) + [0, 45, 90, 135, 180, 225, 270, 315].map(a => {
    const r = a * Math.PI / 180;
    return L(`M${(60 + 34 * Math.cos(r)).toFixed(1)} ${(60 + 34 * Math.sin(r)).toFixed(1)} L${(60 + 50 * Math.cos(r)).toFixed(1)} ${(60 + 50 * Math.sin(r)).toFixed(1)}`, CL.gold, 5);
  }).join('') + sparkle(100, 22, 7) + sparkle(20, 96, 6),
  // ---- ow ----------------------------------------------------------------------------
  cow: () => E(60, 72, 28, 26, CL.cream) + E(60, 96, 16, 12, CL.blush) + P('M36 50 Q26 32 42 38 Q44 48 42 56 Z', CL.cream) +
    P('M84 50 Q94 32 78 38 Q76 48 78 56 Z', CL.cream) + E(42, 62, 9, 7, CL.ink, NO) + C(52, 74, 4, CL.ink, NO) +
    C(70, 74, 4, CL.ink, NO) + C(55, 96, 3, CL.ink, NO) + C(67, 96, 3, CL.ink, NO),
  owl: () => E(60, 68, 32, 34, CL.cocoa) + E(46, 60, 14, 15, CL.cream) + E(74, 60, 14, 15, CL.cream) +
    C(46, 60, 6, CL.ink, NO) + C(74, 60, 6, CL.ink, NO) + P('M60 66 L54 76 L66 76 Z', CL.gold) +
    P('M34 40 L44 30 L48 44 Z', CL.cocoa) + P('M86 40 L76 30 L72 44 Z', CL.cocoa) + L('M50 100 H44', CL.gold, 4) + L('M70 100 H76', CL.gold, 4),
  crown: () => P('M20 88 L28 40 L46 60 L60 28 L74 60 L92 40 L100 88 Z', CL.gold) + L('M20 88 H100', CL.ink, 3.5) +
    C(46, 62, 5, CL.red, THIN) + C(74, 62, 5, CL.teal, THIN) + C(60, 40, 5.5, CL.pink, THIN),
  flower: () => grass(108) + L('M60 104 V56', CL.darkgreen, 5) +
    P('M60 78 q-22 -6 -26 8 q18 8 26 -8 Z', CL.darkgreen) + P('M60 88 q22 -6 26 8 q-18 8 -26 -8 Z', CL.darkgreen) +
    [0, 60, 120, 180, 240, 300].map(a => { const r = a * Math.PI / 180;
      return E((60 + 19 * Math.cos(r)).toFixed(1), (44 + 19 * Math.sin(r)).toFixed(1), 12, 12, CL.pink); }).join('') +
    C(60, 44, 12, CL.gold),
  town: () => sky() + grass(100) + house(8, 62, 30, 38, CL.cream, CL.red) + house(46, 52, 30, 48, CL.sand, CL.teal) +
    house(84, 66, 28, 34, CL.blush, CL.cocoa),
  clown: () => C(60, 68, 30, CL.cream) + C(60, 74, 8, CL.red) + C(48, 60, 5, CL.ink, NO) + C(72, 60, 5, CL.ink, NO) +
    L('M46 88 q14 12 28 0', CL.red, 4) + P('M34 44 L60 16 L86 44 Z', CL.teal) + C(60, 14, 7, CL.pink) +
    E(26, 62, 10, 8, CL.pink, THIN) + E(94, 62, 10, 8, CL.pink, THIN),

  // ===================================================================================
  // W2 Blend It — the words its four levels add
  // ===================================================================================
  cat: () => E(60, 72, 28, 26, CL.orange) + P('M36 52 L34 28 L54 42 Z', CL.orange) + P('M84 52 L86 28 L66 42 Z', CL.orange) +
    C(50, 68, 4.5, CL.ink, NO) + C(70, 68, 4.5, CL.ink, NO) + P('M60 78 l-5 6 h10 Z', CL.pink) +
    L('M28 78 H44', CL.ink, 2.5) + L('M92 78 H76', CL.ink, 2.5) + L('M30 88 H44', CL.ink, 2.5) + L('M90 88 H76', CL.ink, 2.5),
  dog: () => E(60, 74, 28, 24, CL.cocoa) + E(30, 66, 12, 20, CL.brown) + E(90, 66, 12, 20, CL.brown) +
    C(50, 68, 4.5, CL.ink, NO) + C(70, 68, 4.5, CL.ink, NO) + E(60, 84, 9, 7, CL.ink) + L('M60 90 V96', CL.ink, 2.5) +
    P('M56 96 q6 12 12 2 Z', CL.pink, THIN),
  pin: () => P('M60 20 L70 66 L60 100 L50 66 Z', CL.silver) + C(60, 30, 13, CL.red) + C(56, 26, 4, CL.cream, NO),
  sun: () => C(60, 60, 30, CL.gold) + [0, 45, 90, 135, 180, 225, 270, 315].map(a => {
    const r = a * Math.PI / 180;
    return L(`M${(60 + 38 * Math.cos(r)).toFixed(1)} ${(60 + 38 * Math.sin(r)).toFixed(1)} L${(60 + 52 * Math.cos(r)).toFixed(1)} ${(60 + 52 * Math.sin(r)).toFixed(1)}`, CL.gold, 6);
  }).join('') + C(52, 54, 4, CL.ink, NO) + C(68, 54, 4, CL.ink, NO) + L('M52 70 q8 8 16 0', CL.ink, 3),
  bed: () => R(12, 34, 16, 74, 4, CL.cocoa) + R(96, 58, 14, 50, 4, CL.cocoa) +
    R(20, 66, 84, 12, 4, CL.cream) + P('M28 66 H100 V92 Q60 98 28 92 Z', CL.pink) +
    E(44, 60, 20, 12, CL.cream) + L('M52 78 H96', '#E85F9E', 3) + L('M52 86 H92', '#E85F9E', 3),
  top: () => P('M32 44 L88 44 L60 96 Z', CL.pink) + R(28, 34, 64, 12, 5, CL.teal) + R(56, 16, 8, 20, 4, CL.gold) +
    L('M40 60 L80 60', CL.cream, 3) + L('M96 40 q10 10 4 22', CL.slate, 3, 'stroke-dasharray="4 5"'),
  hat: () => E(60, 88, 44, 12, CL.seablue) + P('M36 88 Q34 40 60 38 Q86 40 84 88 Z', CL.seablue) +
    R(34, 74, 52, 12, 3, CL.gold) + E(60, 38, 6, 4, CL.gold, THIN),
  cup: () => P('M32 44 L88 44 L82 90 Q80 100 60 100 Q40 100 38 90 Z', CL.cream) + E(60, 44, 28, 8, CL.iceblue, THIN) +
    P('M88 56 q20 4 16 20 q-4 14 -20 10', 'none', `stroke="${INK}" stroke-width="5" fill="none"`) + R(28, 96, 64, 8, 4, CL.blush),
  fox: () => P('M60 96 Q28 82 30 50 L46 58 L60 40 L74 58 L90 50 Q92 82 60 96 Z', CL.orange) +
    P('M60 96 Q46 90 44 78 Q60 82 76 78 Q74 90 60 96 Z', CL.cream) + C(50, 66, 4.5, CL.ink, NO) + C(70, 66, 4.5, CL.ink, NO) +
    C(60, 84, 4, CL.ink, NO) + P('M46 58 L40 34 L54 46 Z', CL.orange) + P('M74 58 L80 34 L66 46 Z', CL.orange),
  jam: () => P('M18 74 Q18 52 40 52 H80 Q102 52 102 74 Q102 92 80 92 H40 Q18 92 18 74 Z', CL.sand) +
    P('M26 70 Q26 58 42 58 H78 Q94 58 94 70 Q94 76 78 76 H42 Q26 76 26 70 Z', CL.red, THIN) +
    L('M22 84 H98', '#E8C98A', 3) + L('M66 36 L96 20', CL.silver, 6) + P('M60 40 L74 32 L68 44 Z', CL.red, THIN),
  leg: () => P('M46 16 L74 16 L78 70 L86 96 L54 96 L52 70 Z', CL.blush) +
    R(48, 56, 30, 20, 4, CL.teal) + P('M48 92 Q46 104 62 104 L94 104 Q100 104 96 94 L86 88 L54 88 Z', CL.red),
  mug: () => R(30, 42, 52, 58, 8, CL.teal) + P('M82 56 q20 4 16 20 q-4 14 -20 10', 'none', `stroke="${INK}" stroke-width="5" fill="none"`) +
    E(56, 42, 26, 7, CL.cream, THIN) + L('M46 32 q6 -12 0 -18', CL.slate, 3) + L('M66 30 q6 -12 0 -18', CL.slate, 3),
  net: () => L('M26 30 Q60 22 94 30', CL.cocoa, 5) + P('M26 30 Q30 96 60 104 Q90 96 94 30 Z', 'rgba(255,255,255,0.35)', S) +
    [40, 54, 68, 82].map(x => L(`M${x} 30 Q${x} 76 ${60 + (x - 60) * 0.3} 100`, CL.ink, 2)).join('') +
    [48, 68, 88].map(y => L(`M${28 + (y - 40) * 0.28} ${y} Q60 ${y + 8} ${92 - (y - 40) * 0.28} ${y}`, CL.ink, 2)).join(''),
  rug: () => R(16, 40, 88, 60, 4, CL.red) + R(26, 50, 68, 40, 3, CL.gold, THIN) +
    E(60, 70, 20, 14, CL.teal) + E(60, 70, 9, 6, CL.cream, THIN) +
    [0, 1, 2, 3, 4, 5, 6].map(i => L(`M${18 + i * 14} 100 V110`, CL.red, 3)).join('') +
    [0, 1, 2, 3, 4, 5, 6].map(i => L(`M${18 + i * 14} 40 V30`, CL.red, 3)).join(''),
  tin: () => R(34, 32, 52, 70, 6, CL.silver) + E(60, 32, 26, 7, CL.iceblue, THIN) + R(34, 52, 52, 30, 0, CL.red, THIN) +
    L('M42 62 H78', CL.cream, 3) + L('M42 72 H70', CL.cream, 3),
  van: () => R(10, 50, 62, 42, 6, CL.cream) + P('M72 58 L96 58 L108 74 L108 92 L72 92 Z', CL.cream) +
    R(78, 62, 22, 14, 3, CL.iceblue) + R(18, 58, 46, 22, 3, CL.sky) + C(34, 94, 11, CL.ink) + C(90, 94, 11, CL.ink) +
    C(34, 94, 4, CL.silver, NO) + C(90, 94, 4, CL.silver, NO),
  chin: () => P('M40 22 Q86 22 86 62 Q86 100 56 106 Q42 96 40 22 Z', CL.blush) + C(66, 54, 4.5, CL.ink, NO) +
    L('M84 66 q-8 6 -14 4', CL.ink, 2.5) + arrowUp(52, 96, CL.red) + L('M52 112 V102', CL.red, 3),
  shop: () => R(16, 48, 88, 54, 4, CL.cream) + P('M12 48 L108 48 L98 26 L22 26 Z', CL.pink) +
    [0, 1, 2, 3].map(i => P(`M${22 + i * 22} 48 L${33 + i * 22} 48 L${37 + i * 22} 26 L${26 + i * 22} 26 Z`, CL.cream, THIN)).join('') +
    R(26, 62, 32, 26, 2, CL.iceblue) + R(70, 62, 22, 40, 2, CL.cocoa),
  chop: () => R(14, 88, 92, 14, 5, CL.cocoa) + E(48, 80, 22, 9, CL.orange) + E(74, 80, 12, 8, CL.orange) +
    P('M62 24 L96 24 L96 40 L62 44 Z', CL.silver) + R(30, 26, 34, 12, 4, CL.cocoa) + L('M48 56 L54 70', CL.slate, 3, 'stroke-dasharray="4 4"'),
  sock: () => P('M42 18 L74 18 L74 66 Q74 78 88 82 Q102 88 96 100 Q90 110 74 106 L52 98 Q40 92 40 74 Z', CL.teal) +
    R(40, 18, 34, 14, 4, CL.cream) + L('M44 74 H70', CL.cream, 3),
  duck: () => water(96) + E(56, 72, 30, 24, CL.cream) + C(78, 50, 17, CL.cream) + P('M92 50 L112 56 L92 62 Z', CL.orange) +
    C(82, 46, 4, CL.ink, NO) + L('M28 66 q-12 6 -4 16', CL.cream, 4),
  back: () => E(60, 70, 30, 34, CL.lilac) + E(42, 34, 10, 14, CL.lilac) + E(78, 34, 10, 14, CL.lilac) +
    L('M60 50 V92', CL.ink, 2.5, 'opacity="0.5"') + arrowDown(24, 60, CL.red) + L('M24 60 H40', CL.red, 3),
  lick: () => boo(44, 74, CL.teal, { r: 22, smile: false }) + P('M52 76 q10 -4 12 -12', CL.pink, `stroke="${INK}" stroke-width="3" fill="${CL.pink}"`) +
    R(74, 30, 14, 40, 7, CL.pink) + R(78, 68, 6, 30, 3, CL.cocoa) + C(81, 38, 4, CL.cream, NO),
  rabbit: () => E(60, 78, 26, 24, CL.cream) + E(46, 38, 10, 26, CL.cream) + E(74, 38, 10, 26, CL.cream) +
    E(46, 38, 5, 18, CL.blush, THIN) + E(74, 38, 5, 18, CL.blush, THIN) + C(51, 74, 4, CL.ink, NO) + C(69, 74, 4, CL.ink, NO) +
    P('M60 84 l-5 5 h10 Z', CL.pink) + L('M40 90 H52', CL.ink, 2) + L('M80 90 H68', CL.ink, 2),
  basket: () => P('M22 56 L98 56 L88 100 Q60 106 32 100 Z', CL.sand) +
    [38, 52, 66, 80].map(x => L(`M${x} 58 L${x + (60 - x) * 0.12} 100`, CL.cocoa, 2.5)).join('') +
    L('M26 70 H94', CL.cocoa, 2.5) + L('M28 84 H92', CL.cocoa, 2.5) + L('M30 56 Q60 12 90 56', CL.cocoa, 5) + R(18, 48, 84, 12, 5, CL.cocoa),
  magnet: () => P('M30 96 V56 Q30 26 60 26 Q90 26 90 56 V96 H70 V56 Q70 46 60 46 Q50 46 50 56 V96 Z', CL.slate) +
    R(30, 88, 20, 16, 2, CL.red) + R(70, 88, 20, 16, 2, CL.iceblue) +
    L('M22 30 L12 22', CL.gold, 3) + L('M98 30 L108 22', CL.gold, 3),
  picnic: () => grass(104) + P('M8 96 L28 56 L92 56 L112 96 Z', CL.cream) +
    [[36, 1], [52, 1], [68, 1], [84, 1]].map(([x]) => L(`M${x} 56 L${x + (60 - x) * -0.34} 96`, CL.red, 2.5)).join('') +
    [66, 78, 90].map(y => L(`M${18 + (y - 56) * 0.5} ${y} H${102 - (y - 56) * 0.5}`, CL.red, 2.5)).join('') +
    P('M28 46 L60 46 L56 74 L32 74 Z', CL.sand) + L('M30 46 Q44 26 58 46', CL.cocoa, 4) +
    C(80, 68, 10, CL.red) + L('M80 58 V52', CL.darkgreen, 3),
  sunset: () => R(0, 0, 120, 76, 0, CL.orange, NO) + R(0, 76, 120, 44, 0, CL.seablue, NO) +
    C(60, 76, 26, CL.gold, THIN) + L('M0 76 H120', CL.ink, 3) +
    L('M14 92 q10 -5 20 0 t20 0 t20 0 t20 0 t20 0', '#fff', 2.5, 'opacity="0.6"') +
    [[20, 30], [96, 22]].map(([x, y]) => L(`M${x - 8} ${y} q8 -6 16 0`, '#fff', 3, 'opacity="0.7"')).join(''),
  helmet: () => P('M22 84 Q22 32 60 32 Q98 32 98 84 Z', CL.red) + R(18, 82, 84, 12, 5, CL.cream) +
    P('M22 60 Q60 50 98 60', 'none', `stroke="${CL.cream}" stroke-width="6" fill="none"`) + L('M30 94 Q42 108 58 104', CL.ink, 3),
  pocket: () => R(14, 20, 92, 88, 6, CL.seablue) + P('M36 40 L84 40 L80 82 Q60 90 40 82 Z', '#2E7FB8', S) +
    L('M36 48 H84', CL.gold, 2.5, 'stroke-dasharray="5 5"') + L('M40 84 Q60 92 80 84', CL.gold, 2.5, 'stroke-dasharray="5 5"'),
  carpet: () => P('M18 96 Q18 60 40 58 L100 58 Q104 78 100 96 Z', CL.red) + E(40, 77, 12, 19, CL.pink) +
    E(40, 77, 5, 9, CL.gold) + [56, 72, 88].map(x => L(`M${x} 62 V92`, CL.gold, 2.5, 'stroke-dasharray="4 5"')).join('') +
    L('M18 96 H104', CL.ink, 3),
  dentist: () => P('M34 40 Q34 22 52 24 Q60 30 68 24 Q86 22 86 40 Q86 70 74 90 Q66 102 60 88 Q54 102 46 90 Q34 70 34 40 Z', CL.cream) +
    L('M60 40 V78', CL.iceblue, 3) + C(96, 34, 12, CL.silver) + L('M96 46 L84 66', CL.slate, 4) + C(96, 34, 5, CL.iceblue, THIN),
  tunnel: () => sky() + P('M0 100 Q30 34 60 34 Q90 34 120 100 Z', CL.green, THIN) + L('M0 100 H120', CL.ink, 3) +
    P('M36 100 Q36 58 60 58 Q84 58 84 100 Z', CL.ink) + P('M44 100 Q44 68 60 68 Q76 68 76 100 Z', '#0E0A22', NO) +
    L('M30 108 H90', CL.cocoa, 4) + [40, 60, 80].map(x => L(`M${x} 104 V112`, CL.cocoa, 3)).join(''),

  // ===================================================================================
  // W3 Rhyme Time — the words its families, traps and couplets add
  // ===================================================================================
  mat: () => P('M12 88 L30 54 L90 54 L108 88 Z', CL.cocoa) + P('M26 82 L38 62 L82 62 L94 82 Z', CL.sand, THIN) +
    L('M40 70 H80', CL.cocoa, 3) + L('M36 76 H84', CL.cocoa, 3) +
    [0, 1, 2, 3, 4, 5, 6, 7].map(i => L(`M${16 + i * 12.5} 90 V102`, CL.cocoa, 3)).join(''),
  bat: () => P('M60 56 Q30 34 12 46 Q26 54 20 70 Q40 66 60 78 Q80 66 100 70 Q94 54 108 46 Q90 34 60 56 Z', CL.night) +
    E(60, 66, 15, 18, CL.ink) + P('M50 50 L48 36 L56 46 Z', CL.ink) + P('M70 50 L72 36 L64 46 Z', CL.ink) +
    C(55, 62, 3.5, CL.gold, NO) + C(65, 62, 3.5, CL.gold, NO),
  rat: () => E(52, 76, 26, 20, CL.grey) + C(30, 62, 14, CL.grey) + C(24, 50, 8, CL.blush) + C(38, 48, 8, CL.blush) +
    C(22, 62, 3.5, CL.ink, NO) + P('M16 66 l-6 3 l6 3 Z', CL.pink) + L('M78 82 Q104 84 100 56', CL.blush, 4),
  flat: () => sky() + grass(110) + R(26, 20, 68, 90, 4, CL.cream) +
    [0, 1, 2, 3].map(r => [0, 1, 2].map(cc => R(34 + cc * 20, 28 + r * 20, 14, 14, 2, CL.iceblue, THIN)).join('')).join('') +
    R(52, 92, 18, 18, 2, CL.cocoa),
  log: () => E(30, 68, 12, 24, CL.brown) + R(30, 44, 60, 48, 0, CL.cocoa, THIN) + E(90, 68, 12, 24, CL.brown) +
    L('M30 44 H90', CL.ink, 3) + L('M30 92 H90', CL.ink, 3) + E(30, 68, 7, 14, '#96674E', THIN) + E(30, 68, 3, 6, CL.brown, THIN),
  frog: () => E(60, 78, 32, 24, CL.green) + C(44, 56, 13, CL.green) + C(76, 56, 13, CL.green) +
    C(44, 54, 6, CL.cream) + C(76, 54, 6, CL.cream) + C(44, 54, 3, CL.ink, NO) + C(76, 54, 3, CL.ink, NO) +
    L('M44 84 q16 10 32 0', CL.ink, 3) + P('M28 96 q-12 6 -2 10 q10 2 10 -6 Z', CL.green) + P('M92 96 q12 6 2 10 q-10 2 -10 -6 Z', CL.green),
  jog: () => grass(106) + boo(56, 60, CL.orange, { r: 20 }) + L('M48 82 L36 104', CL.orange, 6) + L('M66 82 L82 96', CL.orange, 6) +
    L('M14 56 H30', CL.slate, 3) + L('M10 70 H26', CL.slate, 3) + L('M16 84 H30', CL.slate, 3),
  fog: () => sky('#C9CEDA') + P('M32 96 V64 L60 44 L88 64 V96 Z', '#9AA0B0', THIN) +
    [46, 62, 78, 94].map((y, i) => R(4 + (i % 2) * 10, y, 106, 11, 6, '#E6E9F0', THIN)).join(''),
  cake: () => R(26, 62, 68, 34, 4, CL.blush) + P('M26 62 Q60 48 94 62 Z', CL.cream) + R(26, 76, 68, 6, 0, CL.pink, THIN) +
    [40, 60, 80].map(x => C(x, 66, 4, CL.red, THIN)).join('') + R(57, 34, 6, 20, 3, CL.teal) + P('M60 34 q7 -10 0 -16 q-7 6 0 16 Z', CL.gold),
  lake: () => sky() + P('M0 60 L34 34 L62 60 Z', CL.slate, THIN) + P('M46 60 L82 30 L118 60 Z', CL.grey, THIN) +
    R(0, 60, 120, 60, 0, CL.seablue, NO) + L('M0 60 H120', CL.ink, 3) +
    [72, 88, 104].map(y => L(`M14 ${y} q12 -6 24 0 t24 0 t24 0`, '#fff', 2.5, 'opacity="0.5"')).join('') +
    L('M100 60 V38', CL.darkgreen, 4) + E(100, 32, 6, 8, CL.darkgreen, THIN),
  snake: () => L('M18 90 Q46 90 46 72 Q46 54 74 54 Q98 54 98 38', CL.green, 15) +
    L('M18 90 Q46 90 46 72 Q46 54 74 54 Q98 54 98 38', CL.ink, 2.5, 'fill="none"') +
    C(98, 32, 11, CL.green) + C(94, 28, 3, CL.ink, NO) + L('M104 34 l10 4 l-10 4', CL.red, 2.5) +
    [[36, 88], [60, 58], [86, 52]].map(([x, y]) => C(x, y, 3, CL.darkgreen, NO)).join(''),
  rake: () => L('M74 20 L44 84', CL.cocoa, 7) + R(14, 82, 66, 10, 4, CL.slate) +
    [20, 32, 44, 56, 68].map(x => L(`M${x} 92 V106`, CL.slate, 4)).join('') +
    [[92, 34], [104, 50]].map(([x, y]) => E(x, y, 9, 6, CL.orange, THIN)).join(''),
  shake: () => boo(52, 68, CL.pink, { r: 22 }) + E(88, 44, 12, 16, CL.gold) + R(84, 58, 8, 22, 4, CL.cocoa) +
    L('M74 34 q10 -6 18 -2', CL.slate, 3) + L('M78 24 q12 -6 22 0', CL.slate, 3) +
    [[100, 40], [104, 56]].map(([x, y]) => L(`M${x} ${y} l8 -4`, CL.slate, 3)).join(''),
  bell: () => P('M32 84 Q32 40 60 32 Q88 40 88 84 Z', CL.gold) + R(26, 82, 68, 12, 5, CL.gold) +
    C(60, 100, 8, CL.cocoa) + C(60, 26, 6, CL.slate) + L('M22 46 L10 38', CL.slate, 3) + L('M98 46 L110 38', CL.slate, 3),
  well: () => renderDecoInner('wishwell'),
  smell: () => P('M46 24 Q78 26 78 58 Q78 84 58 96 Q44 86 44 60 Q40 40 46 24 Z', CL.blush) +
    E(70, 70, 8, 6, CL.ink, NO) + [24, 34].map((x, i) => L(`M${x} ${84 - i * 4} q-10 -14 0 -26 q10 -12 0 -24`, CL.teal, 3, 'stroke-dasharray="6 5"')).join('') +
    E(96, 88, 11, 9, CL.pink, THIN) + L('M96 96 V108', CL.darkgreen, 3),
  spell: () => L('M28 96 L86 34', CL.cocoa, 8) + R(78, 22, 18, 18, 4, CL.gold) +
    sparkle(102, 20, 9) + sparkle(64, 30, 6, CL.pink) + sparkle(96, 52, 6, CL.teal) +
    P('M20 104 L34 90 L28 84 L14 98 Z', CL.slate, THIN),
  sing: () => boo(52, 68, CL.lilac, { r: 24, smile: false }) + E(52, 78, 9, 11, CL.ink) + notes(84, 44, CL.pink) +
    L('M74 60 q10 -4 14 -12', CL.pink, 3, 'stroke-dasharray="4 4"'),
  string: () => C(58, 68, 32, CL.cream) + [0, 1, 2, 3].map(i =>
    L(`M${30 + i * 6} ${52 + i * 8} Q60 ${40 + i * 10} ${86 - i * 4} ${58 + i * 8}`, CL.blush, 2.5)).join('') +
    C(58, 68, 32, 'none', S) + L('M88 58 Q108 44 104 24', CL.blush, 3.5),
  kite: () => sky() + P('M60 14 L96 54 L60 100 L24 54 Z', CL.pink) + L('M60 14 V100', CL.ink, 2.5) + L('M24 54 H96', CL.ink, 2.5) +
    P('M60 14 L96 54 L60 54 Z', CL.gold, THIN) + P('M24 54 L60 54 L60 100 Z', CL.teal, THIN) +
    L('M60 100 q-14 12 -4 22 q10 8 -2 16', CL.cocoa, 3),
  far: () => sky() + grass(74) + P('M46 120 L56 82 L66 82 L76 120 Z', CL.sand, THIN) +
    house(50, 62, 18, 14, CL.cream, CL.red) + L('M28 100 H92', CL.cream, 3, 'stroke-dasharray="6 7"') +
    arrowUp(20, 74, CL.red) + L('M20 96 V80', CL.red, 3),
  guitar: () => E(58, 78, 32, 28, CL.orange) + E(58, 50, 22, 20, CL.orange) + C(58, 76, 12, CL.cocoa) +
    R(52, 12, 12, 30, 3, CL.cocoa) + R(48, 6, 20, 10, 3, CL.slate) +
    [54, 58, 62].map(x => L(`M${x} 16 V92`, CL.cream, 1.6)).join(''),
  balloon: () => E(60, 48, 30, 34, CL.red) + P('M54 80 L66 80 L60 90 Z', CL.red) +
    L('M60 90 q12 12 0 24 q-12 10 2 22', CL.slate, 3) + E(48, 36, 8, 10, CL.cream, NO),
  cartoon: () => R(14, 26, 92, 66, 8, CL.slate) + R(24, 34, 72, 50, 4, CL.iceblue) +
    C(60, 58, 17, CL.gold, THIN) + C(53, 54, 3, CL.ink, NO) + C(67, 54, 3, CL.ink, NO) + L('M52 64 q8 8 16 0', CL.ink, 2.5) +
    L('M46 92 L38 106', CL.slate, 4) + L('M74 92 L82 106', CL.slate, 4),
  bug: () => E(60, 70, 30, 26, CL.red) + L('M60 46 V96', CL.ink, 3) + C(60, 44, 13, CL.ink) +
    [[46, 62], [74, 62], [50, 82], [70, 82]].map(([x, y]) => C(x, y, 5, CL.ink, NO)).join('') +
    L('M54 34 L46 22', CL.ink, 2.5) + L('M66 34 L74 22', CL.ink, 2.5),
  hug: () => boo(42, 70, CL.pink, { r: 22, eyesShut: true }) + boo(78, 70, CL.teal, { r: 22, eyesShut: true }) +
    L('M56 74 Q60 62 68 74', CL.ink, 3) + sparkle(60, 34, 7, CL.gold) + P('M22 44 q6 -10 12 0 q-6 8 -12 0 Z', CL.red, THIN),
  plug: () => R(34, 46, 52, 44, 6, CL.cream) + R(44, 26, 10, 22, 3, CL.slate) + R(66, 26, 10, 22, 3, CL.slate) +
    L('M60 90 q0 16 -14 20 q-16 4 -18 -12', CL.ink, 4) + L('M46 60 H74', CL.slate, 2.5),
  stop: () => P('M42 18 H78 L102 42 V78 L78 102 H42 L18 78 V42 Z', CL.red) +
    P('M50 84 V56 q0 -10 8 -10 q8 0 8 10 V44 q0 -8 8 -8 q8 0 8 10 V80 q0 8 -10 8 Z', CL.cream, THIN) +
    L('M50 62 q-10 -6 -12 4 q-2 8 10 14', CL.cream, 3),
  mop: () => L('M60 20 V62', CL.cocoa, 7) + P('M34 62 H86 L92 76 Q60 86 28 76 Z', CL.slate) +
    [36, 48, 60, 72, 84].map(x => L(`M${x} 78 Q${x - 4} 94 ${x + 2} 106`, CL.cream, 3.5)).join(''),
  drop: () => P('M60 16 Q90 58 90 74 A30 30 0 0 1 30 74 Q30 58 60 16 Z', CL.seablue) +
    E(50, 66, 7, 10, CL.iceblue, NO) + L('M26 104 q10 -6 20 0', CL.seablue, 3) + L('M74 104 q10 -6 20 0', CL.seablue, 3),
  hop: () => grass(104) + boo(66, 52, CL.teal, { r: 20 }) + L('M58 72 L50 92', CL.teal, 6) + L('M74 72 L84 90', CL.teal, 6) +
    L('M18 100 Q40 52 66 30', CL.slate, 3, 'stroke-dasharray="5 6"') + arrowUp(18, 86, CL.slate),
  // the -ight near-miss: 'igh' letters that do not say /igh/ (eight), drawn as eight things
  eight: () => [0, 1, 2, 3].map(i => C(26 + i * 23, 46, 11, [CL.pink, CL.teal, CL.gold, CL.lilac][i])).join('') +
    [0, 1, 2, 3].map(i => C(26 + i * 23, 82, 11, [CL.teal, CL.gold, CL.lilac, CL.pink][i])).join(''),
  gate: () => sky() + grass(104) + L('M20 40 V106', CL.cocoa, 7) + L('M100 40 V106', CL.cocoa, 7) +
    [48, 62, 76, 90].map(y => L(`M20 ${y} H100`, CL.cocoa, 5)).join('') + L('M22 96 L98 46', CL.cocoa, 5),
  // the -og near-miss: 'og' letters that do not say /og/ (yoga), drawn as a calm Boo sitting
  yoga: () => R(14, 92, 92, 12, 5, CL.teal) + boo(60, 56, CL.lilac, { r: 22, eyesShut: true }) +
    P('M38 84 Q60 74 82 84 Q60 94 38 84 Z', CL.lilac) + L('M52 68 L60 60 L68 68', CL.ink, 3.5) +
    sparkle(96, 34, 6, CL.gold) + sparkle(22, 40, 5, CL.gold),
  shelf: () => R(14, 58, 92, 10, 3, CL.cocoa) + R(14, 96, 92, 10, 3, CL.cocoa) +
    [[22, CL.red], [34, CL.teal], [46, CL.gold], [58, CL.lilac]].map(([x, col]) => R(x, 30, 10, 28, 2, col, THIN)).join('') +
    [[24, CL.pink], [40, CL.sky]].map(([x, col]) => R(x, 74, 12, 22, 2, col, THIN)).join('') + E(74, 86, 13, 10, CL.green, THIN),
  sink: () => R(18, 56, 84, 34, 5, CL.silver) + E(60, 58, 32, 8, CL.iceblue, THIN) +
    L('M60 22 V38 q0 8 -8 8 H40', CL.slate, 6) + C(60, 20, 6, CL.slate) +
    L('M38 48 q-2 12 0 16', CL.seablue, 3) + R(24, 90, 72, 12, 4, CL.slate),
  care: () => P('M60 40 q10 -16 24 -6 q14 10 -24 42 q-38 -32 -24 -42 q14 -10 24 6 Z', CL.red) +
    P('M8 96 Q26 60 44 82', 'none', `stroke="${CL.blush}" stroke-width="11" fill="none" stroke-linecap="round"`) +
    P('M112 96 Q94 60 76 82', 'none', `stroke="${CL.blush}" stroke-width="11" fill="none" stroke-linecap="round"`) +
    sparkle(96, 30, 7, CL.gold),
  book: () => P('M60 34 Q36 22 14 30 V96 Q36 88 60 100 Q84 88 106 96 V30 Q84 22 60 34 Z', CL.cream) +
    L('M60 34 V100', CL.ink, 3) + [46, 58, 70, 82].map(y => L(`M24 ${y} H52`, CL.slate, 2.2)).join('') +
    [46, 58, 70, 82].map(y => L(`M68 ${y} H96`, CL.slate, 2.2)).join(''),
  bus: () => R(12, 24, 96, 68, 8, CL.red) + [0, 1, 2].map(i => R(20 + i * 28, 32, 20, 18, 3, CL.iceblue, THIN)).join('') +
    [0, 1, 2].map(i => R(20 + i * 28, 58, 20, 18, 3, CL.iceblue, THIN)).join('') +
    C(32, 96, 11, CL.ink) + C(88, 96, 11, CL.ink) + C(32, 96, 4, CL.silver, NO) + C(88, 96, 4, CL.silver, NO),
  rope: () => E(60, 76, 36, 26, 'none', `stroke="${CL.sand}" stroke-width="12"`) +
    E(60, 76, 36, 26, 'none', `stroke="${INK}" stroke-width="2.5" fill="none"`) +
    E(60, 56, 24, 16, 'none', `stroke="${CL.sand}" stroke-width="12"`) +
    E(60, 56, 24, 16, 'none', `stroke="${INK}" stroke-width="2.5" fill="none"`) +
    L('M84 40 Q104 26 96 14', CL.sand, 10) + L('M84 40 Q104 26 96 14', CL.ink, 2.5, 'fill="none"'),
  me: () => boo(66, 66, CL.gold, { r: 26 }) + L('M40 78 Q28 72 30 60', CL.gold, 8) +
    arrowUp(30, 44, CL.red) + L('M30 58 V50', CL.red, 3),
  head: () => E(60, 68, 28, 26, CL.lilac) + E(42, 40, 10, 14, CL.lilac) + E(78, 40, 10, 14, CL.lilac) +
    C(50, 66, 4.5, CL.ink, NO) + C(70, 66, 4.5, CL.ink, NO) + L('M50 80 q10 8 20 0', CL.ink, 3) +
    arrowDown(18, 44, CL.red) + L('M18 44 H36', CL.red, 3)
};

// A word the packs use whose drawing is delegated wholesale to js/art.js.
function renderDecoInner(deco) {
  const svg = renderDeco({ deco, name: deco });
  // strip art.js's own <svg> wrapper and rescale its 120x130 canvas onto ours
  const inner = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  return `<g transform="translate(0,-5) scale(1,0.92)">${inner}</g>`;
}

export const WORD_ART_KEYS = Object.keys(ART);
export function hasWordArt(word) { return !!ART[word]; }

// Render one picture word. `label` defaults to the word itself, so every card carries an
// accessible name even though no text is drawn (the picture must do the work — a printed
// word would turn a phonics round into a spelling hunt).
export function renderWordArt(word, { size = 96, cls = '', label = null } = {}) {
  const draw = ART[word];
  const name = escapeHTML(label == null ? String(word) : label);
  const inner = draw ? draw() : fallback();
  return `<svg viewBox="0 0 120 120" width="${size}" height="${size}" class="wordart wa-${escapeHTML(String(word))} ${cls}" role="img" aria-label="${name}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
}
// Never silently blank: an unknown key draws a puzzled card so a gap is visible, loud and
// findable in a screenshot rather than an empty box a child cannot solve.
function fallback() {
  return C(60, 62, 42, CL.lilac) +
    `<text x="60" y="76" text-anchor="middle" font-family="Fredoka, sans-serif" font-size="42" font-weight="700" fill="${INK}">?</text>`;
}
