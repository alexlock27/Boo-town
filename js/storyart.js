// js/storyart.js — RUN16 W4: the story panels and answer pictures for Story Order.
//
// 28 panel scenes (the six authored stories) plus 18 answer pictures, inline SVG in the
// house sticker style, on a 160x110 landscape canvas.
//
// THE ONE RULE THAT MATTERS HERE. CONTENT_STORIES.md's art rule is also W4's acceptance
// test: a PRE-READER must be able to put the panels in order from the pictures alone. So
// every panel carries one unmistakable visual change from the one before it, and the
// change is the thing the caption is about — not decoration. Where the pack writes an
// explicit ART NOTE (Story 5's two waiting panels, which would otherwise be two pictures
// of nothing happening), the note is implemented literally: seed2 is the watering can in
// daylight, seed3 is weather passing, sun then rain streaks.

import { escapeHTML } from './ui.js';

const INK = '#2A1B4E';
const S = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
const T2 = `stroke="${INK}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;
const NO = 'stroke="none"';
const CL = {
  cream: '#FFF8F0', gold: '#FFC93C', pink: '#FF7AC6', teal: '#35D0BA', lilac: '#C6A9F0',
  sky: '#BFE6F5', cocoa: '#8A5A44', sand: '#F0D28C', orange: '#FF9A52', red: '#E8636F',
  seablue: '#3AA0D8', green: '#5FB86E', darkgreen: '#3E9A56', grey: '#B8B0C8',
  slate: '#8E86A0', white: '#fff', night: '#241A4A', deep: '#1A1240', brown: '#7A4A34'
};
const E = (cx, cy, rx, ry, f, e = S) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${f}" ${e}/>`;
const C = (cx, cy, r, f, e = S) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${f}" ${e}/>`;
const R = (x, y, w, h, r, f, e = S) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${f}" ${e}/>`;
const P = (d, f, e = S) => `<path d="${d}" fill="${f}" ${e}/>`;
const L = (d, col = INK, w = 3, extra = '') => `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" ${extra}/>`;
const STAR = (cx, cy, ro, ri = ro * 0.46) => {
  let d = '';
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? ri : ro;
    d += (i ? 'L' : 'M') + (cx + r * Math.cos(a)).toFixed(1) + ' ' + (cy + r * Math.sin(a)).toFixed(1) + ' ';
  }
  return d + 'Z';
};
const sky = (col = CL.sky) => R(0, 0, 160, 110, 0, col, NO);
const grass = (y = 88, col = CL.green) => R(0, y, 160, 110 - y, 0, col, NO) + L(`M0 ${y} H160`, INK, 2.5);
const hill = (col = CL.green) => P('M-10 110 Q40 52 90 68 Q130 78 170 62 L170 110 Z', col, T2);
// the cast: one small Boo, drawn the same way every time so a child can follow WHO
function boo(cx, cy, col, { r = 14, arms = 0, eyesShut = false, mouth = 'smile' } = {}) {
  const eyes = eyesShut
    ? L(`M${cx - r * 0.44} ${cy} q2 2 4 0`, INK, 2) + L(`M${cx + r * 0.2} ${cy} q2 2 4 0`, INK, 2)
    : C(cx - r * 0.34, cy, r * 0.16, INK, NO) + C(cx + r * 0.34, cy, r * 0.16, INK, NO);
  const m = mouth === 'sad' ? L(`M${cx - r * 0.28} ${cy + r * 0.55} q${r * 0.28} -${r * 0.24} ${r * 0.56} 0`, INK, 2)
    : mouth === 'open' ? E(cx, cy + r * 0.5, r * 0.2, r * 0.26, INK, NO)
      : L(`M${cx - r * 0.28} ${cy + r * 0.4} q${r * 0.28} ${r * 0.28} ${r * 0.56} 0`, INK, 2);
  const a = arms ? L(`M${cx - r} ${cy + r * 0.4} l-${r * 0.6} ${arms > 0 ? -r * 0.7 : r * 0.5}`, col, 4) +
    L(`M${cx + r} ${cy + r * 0.4} l${r * 0.6} ${arms > 0 ? -r * 0.7 : r * 0.5}`, col, 4) : '';
  return a + E(cx, cy + 3, r, r * 0.92, col, T2) +
    E(cx - r * 0.7, cy - r * 0.76, r * 0.3, r * 0.44, col, T2) +
    E(cx + r * 0.7, cy - r * 0.76, r * 0.3, r * 0.44, col, T2) + eyes + m;
}
const kiteShape = (x, y, s = 1, col = CL.red) =>
  P(`M${x} ${y - 12 * s} L${x + 10 * s} ${y} L${x} ${y + 12 * s} L${x - 10 * s} ${y} Z`, col, T2);
const tree = (x, y, s = 1) => R(x - 4 * s, y - 22 * s, 8 * s, 24 * s, 3, CL.cocoa, T2) +
  E(x, y - 32 * s, 20 * s, 17 * s, CL.darkgreen, T2);
const treeBig = (x, y) => R(x - 6, y - 34, 12, 36, 4, CL.cocoa, T2) + E(x, y - 48, 30, 25, CL.darkgreen, T2);
const cloudRain = (x, y, drops = 4, heavy = false) => E(x, y, 24, 12, CL.cream, T2) + E(x + 15, y + 2, 14, 9, CL.cream, T2) +
  Array.from({ length: drops }, (_, i) => L(`M${x - 16 + i * 11} ${y + 14} l-2 ${heavy ? 14 : 8}`, CL.seablue, heavy ? 3 : 2)).join('');
const sun = (x, y, r = 12) => C(x, y, r, CL.gold, T2) +
  [0, 45, 90, 135, 180, 225, 270, 315].map(a => {
    const rad = a * Math.PI / 180;
    return L(`M${(x + (r + 3) * Math.cos(rad)).toFixed(1)} ${(y + (r + 3) * Math.sin(rad)).toFixed(1)} L${(x + (r + 9) * Math.cos(rad)).toFixed(1)} ${(y + (r + 9) * Math.sin(rad)).toFixed(1)}`, CL.gold, 2.5);
  }).join('');
const oven = (x, y) => R(x, y, 46, 40, 5, CL.slate, T2) + R(x + 5, y + 6, 36, 20, 3, '#3A3050', T2) + C(x + 38, y + 33, 3, CL.gold, NO);
const notes = (x, y, big = false) => C(x, y, big ? 5 : 3.5, INK, NO) + L(`M${x + (big ? 4.5 : 3)} ${y} V${y - (big ? 16 : 11)}`, INK, big ? 3 : 2) +
  C(x + (big ? 15 : 11), y + 5, big ? 5 : 3.5, INK, NO) + L(`M${x + (big ? 19.5 : 14)} ${y + 5} V${y - (big ? 9 : 6)}`, INK, big ? 3 : 2);
const shaker = (x, y, s = 1) => E(x, y, 6 * s, 8 * s, CL.gold, T2) + R(x - 2.5 * s, y + 7 * s, 5 * s, 10 * s, 2, CL.cocoa, T2);

const PANELS = {
  // ================= STORY 1: The Lost Kite =================
  // held → loose → stuck → handed down → shared. One change per panel.
  kite1: () => sky() + hill() + kiteShape(112, 26, 1.1) + L('M112 38 Q96 56 62 68', CL.cream, 2) +
    boo(58, 70, CL.gold, { arms: 1 }) + sun(22, 20, 9),
  kite2: () => sky() + hill() + kiteShape(126, 18, 1.1) + L('M126 30 Q112 40 96 34', CL.cream, 2) +
    boo(56, 70, CL.gold, { arms: 1, mouth: 'open' }) +
    [[74, 30], [82, 40], [70, 46]].map(([x, y]) => L(`M${x} ${y} q10 -5 20 0`, CL.white, 2.5, 'opacity="0.85"')).join(''),
  kite3: () => sky() + grass(92) + treeBig(112, 92) + kiteShape(114, 50, 1.05) +
    L('M114 62 Q118 76 110 88', CL.cream, 2) + boo(44, 76, CL.gold, { arms: 1, mouth: 'sad' }),
  kite4: () => sky() + grass(92) + treeBig(112, 92) + boo(112, 50, CL.lilac, { r: 11 }) +
    kiteShape(90, 66, 0.9) + L('M100 60 L86 64', CL.lilac, 3.5) + boo(52, 78, CL.gold, { arms: 1 }),
  kite5: () => sky() + hill() + kiteShape(118, 22, 1.1) + L('M118 34 Q100 50 74 62', CL.cream, 2) +
    boo(62, 68, CL.gold, { arms: 1 }) + boo(92, 74, CL.lilac, { arms: 1 }) + sun(22, 20, 9),

  // ================= STORY 2: The Wobbly Cake =================
  // bowl → flat cake → recipe → tall cake → shared slices.
  cake1: () => sky(CL.cream) + R(0, 92, 160, 18, 0, CL.cocoa, NO) +
    P('M50 56 H118 L110 88 H58 Z', CL.white, S) + E(84, 56, 34, 8, CL.sand, T2) +
    L('M126 30 L104 62', CL.cocoa, 5) + E(102, 64, 8, 5, CL.grey, T2) +
    C(60, 48, 5, CL.gold, T2) + C(72, 44, 4, CL.gold, T2) + boo(24, 68, CL.teal, { r: 13, arms: 1 }),
  cake2: () => sky(CL.cream) + R(0, 92, 160, 18, 0, CL.cocoa, NO) + oven(96, 46) +
    R(40, 74, 48, 12, 3, '#C98A4E', S) + R(46, 70, 36, 5, 2, CL.sand, T2) +
    boo(20, 68, CL.teal, { r: 13, mouth: 'sad' }) + L('M110 30 q6 -8 0 -14', CL.grey, 2.5),
  cake3: () => sky(CL.cream) + R(0, 92, 160, 18, 0, CL.cocoa, NO) +
    R(52, 26, 60, 62, 4, CL.white, S) + [38, 48, 58, 68].map(y => L(`M60 ${y} H104`, CL.slate, 2)).join('') +
    E(82, 58, 24, 8, 'rgba(232,99,111,.25)', `stroke="${CL.red}" stroke-width="2.5"`) +
    C(124, 42, 13, 'rgba(255,255,255,.4)', S) + L('M133 51 L146 64', CL.slate, 4) +
    boo(24, 68, CL.teal, { r: 13, arms: 1 }),
  cake4: () => sky(CL.cream) + R(0, 92, 160, 18, 0, CL.cocoa, NO) + oven(96, 46) +
    R(38, 46, 52, 40, 4, CL.gold, S) + P('M38 46 Q64 34 90 46 Z', CL.cream, T2) +
    L('M40 62 H88', '#E8A93C', 2.5) + boo(18, 66, CL.teal, { r: 13, arms: 1, mouth: 'open' }),
  cake5: () => sky(CL.cream) + grass(92) +
    [[26, CL.teal], [58, CL.pink], [92, CL.lilac], [126, CL.gold]].map(([x, col], i) =>
      boo(x, 62 + (i % 2) * 6, col, { r: 12 }) + P(`M${x - 7} ${76 + (i % 2) * 6} L${x + 7} ${76 + (i % 2) * 6} L${x} ${88 + (i % 2) * 6} Z`, CL.gold, T2)).join(''),

  // ================= STORY 3: The Rainy Day =================
  // a few drops with a ball → heavy rain, slumped → coat and wellies on → SPLASH.
  rain1: () => sky() + R(0, 0, 160, 110, 0, CL.cream, NO) + R(92, 12, 58, 62, 4, CL.sky, S) +
    L('M121 12 V74 M92 43 H150', INK, 2) + cloudRain(120, 26, 3, false) +
    boo(44, 60, CL.pink, { arms: 1 }) + C(44, 88, 11, CL.gold, T2) + L('M36 84 q8 8 16 0', INK, 2),
  rain2: () => sky() + R(0, 0, 160, 110, 0, CL.cream, NO) + R(92, 12, 58, 62, 4, '#7E96AE', S) +
    L('M121 12 V74 M92 43 H150', INK, 2) + cloudRain(120, 24, 4, true) +
    boo(44, 66, CL.pink, { r: 15, mouth: 'sad', arms: -1 }) + C(20, 92, 9, CL.gold, T2) +
    E(44, 34, 15, 8, CL.grey, T2) + L('M40 42 l-2 8 M48 42 l2 8', CL.slate, 2),
  rain3: () => sky() + R(0, 0, 160, 110, 0, CL.cream, NO) + cloudRain(126, 22, 4, true) +
    boo(56, 54, CL.pink, { r: 15 }) +
    P('M38 62 H74 L80 92 H32 Z', CL.gold, S) + P('M38 62 Q56 54 74 62 L74 70 Q56 62 38 70 Z', '#E8B42C', T2) +
    R(36, 92, 14, 14, 4, CL.red, S) + R(60, 92, 14, 14, 4, CL.red, S),
  rain4: () => sky() + R(0, 0, 160, 110, 0, CL.cream, NO) + cloudRain(130, 20, 4, true) +
    E(60, 96, 44, 9, CL.seablue, T2) +
    boo(58, 50, CL.pink, { r: 15, arms: 1, mouth: 'open' }) + R(50, 74, 8, 12, 3, CL.red, S) + R(62, 74, 8, 12, 3, CL.red, S) +
    [[26, 88], [96, 86], [40, 76], [82, 74]].map(([x, y]) => L(`M${x} ${y} q4 -10 9 -3`, CL.seablue, 2.5)).join(''),

  // ================= STORY 4: The Shy Boo =================
  // hidden behind the tree → the shaker offered → one tiny shake → the loudest of all.
  shy1: () => sky(CL.cream) + grass(92) + treeBig(40, 92) +
    E(58, 70, 9, 11, CL.teal, T2) + C(56, 68, 2.5, INK, NO) +
    boo(110, 62, CL.pink, { r: 13 }) + R(126, 62, 22, 22, 4, CL.red, S) + L('M126 68 H148', CL.cream, 2) + notes(96, 34),
  shy2: () => sky(CL.cream) + grass(92) + treeBig(34, 92) +
    E(54, 70, 9, 11, CL.teal, T2) + C(52, 68, 2.5, INK, NO) +
    boo(104, 60, CL.pink, { r: 14, arms: 1 }) + R(120, 62, 22, 22, 4, CL.red, S) +
    shaker(80, 66, 1) + L('M92 62 L86 64', CL.pink, 3.5),
  shy3: () => sky(CL.cream) + grass(92) + tree(24, 92, 0.7) +
    boo(62, 64, CL.teal, { r: 14, arms: 1 }) + shaker(80, 60, 1) +
    L('M90 52 q6 -3 9 1', CL.slate, 2) + boo(120, 62, CL.pink, { r: 13 }) + notes(104, 34),
  shy4: () => sky(CL.cream) + grass(92) +
    boo(60, 60, CL.teal, { r: 17, arms: 1, mouth: 'open' }) + shaker(86, 52, 1.2) +
    [[98, 38], [104, 48], [96, 58]].map(([x, y]) => L(`M${x} ${y} q10 -6 18 -1`, CL.slate, 2.5)).join('') +
    notes(112, 26, true) + notes(28, 32, true) + boo(132, 70, CL.pink, { r: 12 }) + boo(20, 74, CL.lilac, { r: 12 }),

  // ================= STORY 5: The Seed =================
  // ART NOTE, implemented literally: seed2 is the watering can in DAYLIGHT; seed3 is
  // weather passing — sun THEN rain streaks — so the two waiting panels can be ordered.
  seed1: () => sky() + R(0, 74, 160, 36, 0, CL.brown, NO) + L('M0 74 H160', INK, 2.5) +
    boo(48, 56, CL.gold, { r: 14, arms: -1 }) +
    E(96, 84, 9, 6, '#5A3A28', T2) + C(96, 82, 3.5, CL.sand, T2) + L('M96 66 V78', CL.gold, 3),
  seed2: () => sky() + R(0, 74, 160, 36, 0, CL.brown, NO) + L('M0 74 H160', INK, 2.5) + sun(26, 20, 11) +
    R(84, 44, 30, 26, 5, CL.teal, S) + P('M84 52 L64 40 L68 36 L88 46 Z', CL.teal, T2) + L('M96 40 H104', CL.teal, 4) +
    [[68, 48], [72, 56], [66, 62]].map(([x, y]) => L(`M${x} ${y} l-2 8`, CL.seablue, 2.5)).join('') +
    boo(126, 58, CL.gold, { r: 13 }) + E(60, 78, 8, 4, '#5A3A28', T2),
  seed3: () => sky('#A8C4D8') + R(0, 74, 160, 36, 0, CL.brown, NO) + L('M0 74 H160', INK, 2.5) +
    sun(34, 22, 10) + L('M52 22 q10 -6 18 0', CL.white, 3, 'opacity="0.9"') +
    E(104, 26, 24, 11, CL.cream, T2) + E(122, 28, 14, 8, CL.cream, T2) +
    [0, 1, 2, 3, 4, 5].map(i => L(`M${88 + i * 11} 40 l-4 22`, CL.seablue, 2.5)).join('') +
    E(60, 78, 8, 4, '#5A3A28', T2) + boo(20, 62, CL.gold, { r: 11, eyesShut: true }),
  seed4: () => sky() + R(0, 74, 160, 36, 0, CL.brown, NO) + L('M0 74 H160', INK, 2.5) + sun(28, 20, 10) +
    L('M80 76 V56', CL.darkgreen, 4) + P('M80 60 q-14 -6 -10 6 q10 4 10 -6 Z', CL.green, T2) +
    P('M80 64 q14 -6 10 6 q-10 4 -10 -6 Z', CL.green, T2) + boo(126, 60, CL.gold, { r: 13, mouth: 'open' }),
  seed5: () => sky() + grass(90) + sun(24, 18, 10) +
    L('M92 90 V34', CL.darkgreen, 5) + P('M92 62 q-20 -8 -14 8 q14 6 14 -8 Z', CL.green, T2) +
    P('M92 70 q20 -8 14 8 q-14 6 -14 -8 Z', CL.green, T2) +
    [0, 45, 90, 135, 180, 225, 270, 315].map(a => { const r = a * Math.PI / 180;
      return E((92 + 17 * Math.cos(r)).toFixed(1), (30 + 17 * Math.sin(r)).toFixed(1), 8, 8, CL.gold, T2); }).join('') +
    C(92, 30, 10, '#C98A4E', T2) + boo(40, 66, CL.gold, { r: 14, arms: 1 }),

  // ================= STORY 6: The Shooting Star =================
  // awake indoors → walking up with the torch → lying back → the flash → the wish home.
  star1: () => R(0, 0, 160, 110, 0, '#3A2C66', NO) + R(96, 14, 48, 34, 4, CL.night, S) +
    C(120, 30, 10, CL.gold, T2) + R(10, 62, 62, 26, 5, CL.pink, S) + R(6, 52, 16, 36, 4, CL.cocoa, S) +
    boo(38, 54, CL.lilac, { r: 12 }) + boo(64, 56, CL.teal, { r: 12 }) +
    C(128, 68, 12, CL.cream, T2) + L('M128 68 V60 M128 68 l6 4', INK, 2),
  star2: () => R(0, 0, 160, 110, 0, CL.night, NO) + P(STAR(24, 20, 4), CL.gold, T2) + P(STAR(140, 26, 3.5), CL.gold, T2) +
    hill('#2E7A46') + boo(60, 68, CL.lilac, { r: 12, arms: 1 }) + boo(86, 72, CL.teal, { r: 12 }) +
    P('M74 62 L112 40 L118 52 L78 70 Z', 'rgba(255,201,60,.35)', NO) + R(70, 60, 10, 7, 2, CL.slate, T2),
  star3: () => R(0, 0, 160, 110, 0, CL.night, NO) +
    [[20, 16, 4], [50, 26, 3], [92, 14, 3.5], [130, 30, 4], [148, 18, 3]].map(([x, y, r]) => P(STAR(x, y, r), CL.gold, T2)).join('') +
    grass(80, '#2E7A46') + E(54, 90, 17, 11, CL.lilac, T2) + E(96, 90, 17, 11, CL.teal, T2) +
    C(46, 86, 2.5, INK, NO) + C(58, 86, 2.5, INK, NO) + C(88, 86, 2.5, INK, NO) + C(100, 86, 2.5, INK, NO),
  star4: () => R(0, 0, 160, 110, 0, CL.night, NO) +
    [[26, 20, 3], [140, 34, 3]].map(([x, y, r]) => P(STAR(x, y, r), CL.gold, T2)).join('') +
    L('M8 20 Q60 34 138 58', CL.gold, 6) + P(STAR(142, 60, 11), CL.gold, T2) +
    [[40, 30], [76, 40], [108, 50]].map(([x, y]) => P(STAR(x, y, 4), CL.gold, T2)).join('') +
    grass(84, '#2E7A46') + E(52, 94, 16, 10, CL.lilac, T2) + E(94, 94, 16, 10, CL.teal, T2),
  star5: () => R(0, 0, 160, 110, 0, CL.night, NO) + P(STAR(22, 18, 3.5), CL.gold, T2) + P(STAR(138, 22, 3), CL.gold, T2) +
    grass(86, '#2E7A46') + boo(44, 66, CL.lilac, { r: 13, eyesShut: true, arms: -1 }) +
    boo(72, 70, CL.teal, { r: 13, eyesShut: true, arms: -1 }) +
    R(112, 58, 34, 28, 3, CL.cream, S) + P('M106 58 L129 42 L152 58 Z', CL.red, S) + R(124, 70, 10, 16, 2, CL.cocoa, T2) +
    C(129, 50, 3, CL.gold, NO)
};

// ---- the answer pictures: one per comprehension option -------------------------------
const ANSWERS = {
  ansNova: () => boo(80, 56, CL.lilac, { r: 26 }),
  ansPip: () => boo(80, 56, CL.gold, { r: 26 }),
  ansWind: () => [[40, 34], [56, 52], [36, 70]].map(([x, y]) => L(`M${x} ${y} q22 -10 44 0 q-8 8 -16 4`, CL.slate, 4)).join('') +
    E(120, 52, 12, 14, CL.cream, T2),
  ansRecipe: () => R(48, 22, 64, 66, 4, CL.white, S) + [36, 48, 60, 72].map(y => L(`M56 ${y} H104`, CL.slate, 2.5)).join('') +
    E(80, 60, 26, 9, 'rgba(232,99,111,.25)', `stroke="${CL.red}" stroke-width="3"`),
  ansOven: () => oven(56, 34) + L('M40 22 l-8 -8 M120 22 l8 -8', CL.red, 3),
  ansSquash: () => boo(80, 40, CL.teal, { r: 20 }) + R(46, 66, 68, 12, 4, '#C98A4E', S),
  ansWellies: () => P('M46 26 H74 V56 Q74 62 84 64 L94 66 Q100 68 100 76 V82 H46 Z', CL.gold, S) + R(42, 80, 62, 10, 4, CL.cocoa, S) +
    P('M110 30 H140 L146 82 H104 Z', CL.red, S),
  ansScarf: () => E(80, 34, 26, 14, CL.seablue, S) + R(54, 30, 52, 8, 3, CL.gold, T2) +
    L('M60 60 q24 10 48 0 l6 26 q-30 8 -60 0 Z', CL.red, 3) + P('M60 60 q24 10 48 0 l6 26 q-30 8 -60 0 Z', CL.red, S),
  ansSwim: () => E(80, 54, 24, 20, CL.seablue, S) + L('M56 54 H104', CL.cream, 3) +
    E(40, 78, 14, 8, CL.gold, T2) + E(120, 78, 14, 8, CL.gold, T2),
  ansShaker: () => shaker(80, 46, 2.4),
  ansDrum: () => R(48, 40, 64, 44, 6, CL.red, S) + E(80, 40, 32, 10, CL.cream, S) + L('M48 56 H112', CL.gold, 3) +
    L('M116 30 L104 44', CL.cocoa, 4),
  ansHat: () => E(80, 76, 44, 12, CL.seablue, S) + P('M56 76 Q54 28 80 26 Q106 28 104 76 Z', CL.seablue, S) + R(54, 62, 52, 12, 3, CL.gold, T2),
  ansSunflower: () => L('M80 96 V44', CL.darkgreen, 5) + P('M80 70 q-20 -8 -14 8 q14 6 14 -8 Z', CL.green, T2) +
    [0, 45, 90, 135, 180, 225, 270, 315].map(a => { const r = a * Math.PI / 180;
      return E((80 + 18 * Math.cos(r)).toFixed(1), (40 + 18 * Math.sin(r)).toFixed(1), 9, 9, CL.gold, T2); }).join('') +
    C(80, 40, 11, '#C98A4E', T2),
  ansApple: () => R(74, 62, 12, 34, 4, CL.cocoa, S) + E(80, 44, 32, 26, CL.darkgreen, S) +
    C(66, 40, 5, CL.red, T2) + C(92, 48, 5, CL.red, T2) + C(80, 30, 4.5, CL.red, T2),
  ansRose: () => L('M80 96 V54', CL.darkgreen, 4) + P('M80 74 q-16 -6 -12 6 q12 4 12 -6 Z', CL.green, T2) +
    E(80, 42, 18, 16, CL.red, S) + C(80, 42, 8, CL.pink, T2) + C(80, 42, 3, CL.red, T2),
  ansHill: () => sky() + hill() + P(STAR(120, 26, 8), CL.gold, T2) + boo(58, 66, CL.lilac, { r: 11 }),
  ansBeach: () => sky() + R(0, 60, 160, 24, 0, CL.seablue, NO) + R(0, 84, 160, 26, 0, CL.sand, NO) +
    L('M0 84 H160', INK, 2.5) + L('M12 96 q12 -6 24 0 t24 0', CL.white, 2.5, 'opacity="0.6"') + sun(130, 26, 11),
  ansGarden: () => sky() + grass(80) + R(96, 40, 52, 40, 3, CL.cream, S) + P('M90 40 L122 18 L154 40 Z', CL.red, S) +
    E(30, 74, 10, 8, CL.pink, T2) + E(52, 76, 9, 7, CL.gold, T2) + tree(70, 80, 0.55)
};

const ALL = { ...PANELS, ...ANSWERS };
export const STORY_ART_KEYS = Object.keys(ALL);
export function hasStoryArt(key) { return !!ALL[key]; }

// One panel or answer picture. `label` is the caption or option text, so a screen reader
// gets the same information the drawing carries.
export function renderStoryArt(key, { w = 140, label = null } = {}) {
  const draw = ALL[key];
  const name = escapeHTML(label == null ? String(key) : label);
  const inner = draw ? draw() : missing();
  return `<svg viewBox="0 0 160 110" width="${w}" height="${(w * 110 / 160).toFixed(0)}" class="storyart sa-${escapeHTML(String(key))}" role="img" aria-label="${name}" xmlns="http://www.w3.org/2000/svg">` +
    `<rect x="0" y="0" width="160" height="110" rx="10" fill="${CL.cream}"/>${inner}` +
    `<rect x="1.5" y="1.5" width="157" height="107" rx="9" fill="none" stroke="${INK}" stroke-width="3"/></svg>`;
}
function missing() {
  return `<text x="80" y="66" text-anchor="middle" font-family="Fredoka, sans-serif" font-size="40" font-weight="700" fill="${INK}">?</text>`;
}
