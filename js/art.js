// js/art.js
// The ONE rendering module for all characters and props (spec §3).
// Everything is inline SVG built from layered simple shapes with the sticker look:
// ~4px ink outline + a cream halo. Keep each critter well under ~30 shapes.
// Swapping in a CC0 asset pack later means only replacing this file.

import { BY_ID } from '../data/catalogue.js';
import { escapeHTML } from './ui.js';

export const COLORS = {
  // Boo body colours
  indigo:    '#4B3AA0',   // lifted from --sky-mid so indigo Boos read on the dark sky
  lilac:     '#C6A9F0',
  bubblegum: '#FF7AC6',
  teal:      '#35D0BA',
  cream:     '#FFF8F0',
  gold:      '#FFC93C',
  midnight:  '#2B2170',
  prism:     '#C6A9F0',   // base; hue-shifted by CSS for Prism
  // Guide (giraffe) colours
  sunshine:  '#FFD166',
  sky:       '#8FC7FF',
  cocoa:     '#8A5A44',
  pink:      '#FF7AC6',
  // Wave-2 colours (EXPANSION_1 §4)
  aqua:      '#5FD9D0',
  coconut:   '#7A4A34',
  sand:      '#F0D28C',
  orange:    '#FF9A52',
  ghost:     '#EDEEF9',
  iceblue:   '#BFE6F5',
  brown:     '#8A5A44',
  seablue:   '#3AA0D8',
  red:       '#E8636F',
  // Fixed tones
  ink:       '#2A1B4E',
  blush:     '#FF9EC4',
  toothW:    '#FFFFFF'
};

const INK = COLORS.ink;
const HALO = COLORS.cream;

function c(name) { return COLORS[name] || name; }

// ---- tiny SVG primitives -------------------------------------------------
function ell(cx, cy, rx, ry, fill, extra = '') {
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" ${extra}/>`;
}
// RUN18C C4 — XML HAS NO TOLERANCE FOR A REPEATED ATTRIBUTE, and a data: URI is parsed as
// XML, not as HTML. Around thirty call sites below pass 'none' as `fill` AND repeat
// `fill="none"` inside `extra`; the DOM shrugs and paints it, but `new Image()` on the same
// markup fails to load ENTIRELY. That is why six of the eight Boos were missing from the
// Expedition postcard (js/expedition/postcard.js draws each Boo through an <img>) — every
// Boo whose mouth or brow used the doubled form silently never arrived. `extra` wins.
const DECLARES = (attr, extra) => new RegExp(`(^|\\s)${attr}\\s*=`).test(extra);
function path(d, fill, extra = '') {
  const own = DECLARES('fill', extra) ? '' : ` fill="${fill}"`;
  return `<path d="${d}"${own} ${extra}/>`;
}
function rrect(x, y, w, h, r, fill, extra = '') {
  const own = DECLARES('fill', extra) ? '' : ` fill="${fill}"`;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ry="${r}"${own} ${extra}/>`;
}
// 5-point star path centred at (cx,cy)
function starPath(cx, cy, rOuter, rInner = rOuter * 0.45, rot = -90) {
  let pts = '';
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? rOuter : rInner;
    const a = (rot + i * 36) * Math.PI / 180;
    pts += `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)} `;
  }
  return `M${pts.trim()}Z`;
}

// A silhouette shape carries geometry once; we stroke it fat-cream for the halo
// pass and ink for the colour pass.
function silhouette(shapes, { haloW = 10, inkW = 4 } = {}) {
  const halo = shapes.map(s =>
    s.svg(HALO, `stroke="${HALO}" stroke-width="${haloW}" stroke-linejoin="round" stroke-linecap="round"`)
  ).join('');
  const color = shapes.map(s =>
    s.svg(s.fill, `stroke="${INK}" stroke-width="${inkW}" stroke-linejoin="round" stroke-linecap="round"`)
  ).join('');
  return { halo, color };
}

// ---- eyes ----------------------------------------------------------------
// kinds: round (glossy), star/sparkle (star pupils), sleepy (half-lidded, peaceful)
function eyes(lx, rx, cy, r, kind = 'round') {
  if (kind === 'sleepy') {
    const lash = (x) =>
      `<path d="M${(x - r).toFixed(1)} ${(cy - 1).toFixed(1)} Q${x} ${(cy + r * 0.95).toFixed(1)} ${(x + r).toFixed(1)} ${(cy - 1).toFixed(1)}" ` +
      `fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>` +
      `<path d="M${(x - r * 0.7).toFixed(1)} ${(cy + r * 0.5).toFixed(1)} q${(-r * 0.25).toFixed(1)} ${(r * 0.35).toFixed(1)} ${(-r * 0.05).toFixed(1)} ${(r * 0.6).toFixed(1)}" ` +
      `fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`;
    return lash(lx) + lash(rx);
  }
  const pupil = (x) => {
    if (kind === 'star' || kind === 'sparkle') {
      return path(starPath(x, cy + 1, r * 0.8, r * 0.36, -90), COLORS.gold, `stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"`);
    }
    return `<circle cx="${x}" cy="${cy + 1.5}" r="${r * 0.62}" fill="${INK}"/>` +
           `<circle cx="${x - r * 0.22}" cy="${cy - r * 0.15}" r="${r * 0.24}" fill="#fff"/>` +
           `<circle cx="${x + r * 0.2}" cy="${cy + r * 0.3}" r="${r * 0.1}" fill="#fff" opacity="0.9"/>`;
  };
  const white = (x) =>
    `<circle cx="${x}" cy="${cy}" r="${r}" fill="#fff" stroke="${INK}" stroke-width="2.2"/>`;
  return white(lx) + white(rx) + pupil(lx) + pupil(rx);
}

function mouth(species, state) {
  // RUN18B Y5 — the open mouth Feed the Boos swaps in as the food arrives. One drawing,
  // in the art layer, so a Boo that opens its mouth looks the same wherever it does it.
  if (state === 'open') {
    return ell(60, 97, 14, 12, '#6E2440', `stroke="${INK}" stroke-width="2.8" stroke-linejoin="round"`) +
           ell(60, 104, 8, 5, COLORS.blush, `opacity="0.95"`) +
           `<path d="M50 91 L54 96 L58 91 Z" fill="${COLORS.toothW}" stroke="${INK}" stroke-width="1.2"/>` +
           `<path d="M62 91 L66 96 L70 91 Z" fill="${COLORS.toothW}" stroke="${INK}" stroke-width="1.2"/>`;
  }
  if (species === 'munch') {
    // wide happy grin + one big tooth
    return path('M42 93 Q60 114 78 93 Q60 101 42 93 Z', INK, `stroke="${INK}" stroke-width="2" stroke-linejoin="round"`) +
           rrect(54, 93, 12, 10, 3, COLORS.toothW, `stroke="${INK}" stroke-width="1.8"`);
  }
  if (species === 'bloop') {
    // small smile + two tiny fangs
    return path('M54 95 Q60 101 66 95', 'none', `stroke="${INK}" stroke-width="2.6" fill="none"`) +
           path('M55 97 L57 101 L59 97 Z', COLORS.toothW, `stroke="${INK}" stroke-width="1"`) +
           path('M61 97 L63 101 L65 97 Z', COLORS.toothW, `stroke="${INK}" stroke-width="1"`);
  }
  // friendly little grin
  return path('M53 95 Q60 102 67 95', 'none', `stroke="${INK}" stroke-width="2.6" fill="none"`);
}

function cheeks(lx, rx, cy) {
  return ell(lx, cy, 7, 4.5, COLORS.blush, 'opacity="0.55"') +
         ell(rx, cy, 7, 4.5, COLORS.blush, 'opacity="0.55"');
}

// ---- accessories ---------------------------------------------------------
function accessory(acc) {
  if (!acc) return '';
  switch (acc) {
    case 'bow': {
      const x = 84, y = 34, col = COLORS.pink;
      return path(`M${x} ${y} L${x-13} ${y-9} L${x-13} ${y+9} Z`, col, `stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"`) +
             path(`M${x} ${y} L${x+13} ${y-9} L${x+13} ${y+9} Z`, col, `stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"`) +
             `<circle cx="${x}" cy="${y}" r="5" fill="${col}" stroke="${INK}" stroke-width="2.4"/>`;
    }
    case 'flower': {
      const x = 34, y = 34;
      let petals = '';
      for (let i = 0; i < 5; i++) {
        const a = i * 72 * Math.PI / 180;
        petals += ell(x + 8 * Math.cos(a), y + 8 * Math.sin(a), 5.5, 5.5, COLORS.bubblegum, `stroke="${INK}" stroke-width="2"`);
      }
      return petals + `<circle cx="${x}" cy="${y}" r="5" fill="${COLORS.gold}" stroke="${INK}" stroke-width="2"/>`;
    }
    case 'scarf':
      return path('M30 100 Q60 116 90 100 L88 108 Q60 122 32 108 Z', COLORS.pink, `stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"`) +
             rrect(40, 104, 10, 16, 3, COLORS.pink, `stroke="${INK}" stroke-width="2.4"`);
    case 'cap':
      return path('M28 40 Q60 6 92 40 Z', COLORS.teal, `stroke="${INK}" stroke-width="3" stroke-linejoin="round"`) +
             path('M60 40 Q96 40 98 50 Q80 48 60 46 Z', COLORS.teal, `stroke="${INK}" stroke-width="3" stroke-linejoin="round"`) +
             `<circle cx="60" cy="16" r="4" fill="${COLORS.gold}" stroke="${INK}" stroke-width="2"/>`;
    case 'explorerhat': {   // a little safari/adventure hat (RUN6 C6 — Scout)
      const straw = '#C9A46A';
      return ell(60, 34, 40, 11, straw, `stroke="${INK}" stroke-width="3"`) +
             path('M40 34 Q60 4 80 34 Z', straw, `stroke="${INK}" stroke-width="3" stroke-linejoin="round"`) +
             `<rect x="42" y="25" width="36" height="7" rx="3" fill="#7A5A34" stroke="${INK}" stroke-width="2"/>`;
    }
    case 'glasses': {
      // heart-shaped glasses over the eyes
      const heart = (hx) => path(`M${hx} ${72} C${hx-9} ${60}, ${hx-18} ${72}, ${hx} ${84} C${hx+18} ${72}, ${hx+9} ${60}, ${hx} ${72} Z`, COLORS.pink, `stroke="${INK}" stroke-width="2.4" opacity="0.9"`);
      return heart(44) + heart(76) + path('M56 70 Q60 66 64 70', 'none', `stroke="${INK}" stroke-width="2.4" fill="none"`);
    }
    case 'headphones':
      return path('M22 66 Q60 12 98 66', 'none', `stroke="${COLORS.gold}" stroke-width="7" fill="none" stroke-linecap="round"`) +
             path('M22 66 Q60 14 98 66', 'none', `stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round"`) +
             rrect(12, 58, 18, 26, 8, COLORS.gold, `stroke="${INK}" stroke-width="3"`) +
             rrect(90, 58, 18, 26, 8, COLORS.gold, `stroke="${INK}" stroke-width="3"`);
    default:
      return '';
  }
}

// ---- ultra / secret fx layers -------------------------------------------
function fxSparkles(fx) {
  if (fx === 'twinkle') {
    const s = [[20,26],[100,30],[26,96],[96,92],[60,14]];
    return `<g class="fx-twinkle-stars">` + s.map((p, i) =>
      path(starPath(p[0], p[1], 6, 2.6), COLORS.gold, `class="twk twk${i%3}" stroke="#fff" stroke-width="1"`)
    ).join('') + `</g>`;
  }
  if (fx === 'shimmer') {
    return `<g class="fx-shine"><circle cx="42" cy="60" r="6" fill="#fff" opacity="0.85"/><circle cx="80" cy="52" r="4" fill="#fff" opacity="0.7"/></g>`;
  }
  return '';
}

// ---- species body builders ----------------------------------------------
// Returns { back: [silhouette shapes], body: shape, extras: string(front details) }
// extra = { hood, wing } are wave-2 accent fills for Snug / Zippy.
function speciesGeom(species, bodyFill, bellyFill, extra = {}) {
  const back = [];
  let extras = '';

  // ears — default rounded, tucked behind head
  const roundedEar = (x, sign) => ({
    fill: bodyFill,
    svg: (f, s) => ell(x, 42, 16, 21, f, `transform="rotate(${sign*14} ${x} 42)" ${s}`)
  });
  const innerEar = (x, sign) => ell(x, 44, 8, 12, COLORS.blush, `transform="rotate(${sign*14} ${x} 44)" opacity="0.8"`);

  let bodyRx = 45, bodyRy = 41, bodyCy = 74;

  if (species === 'pip') {
    // extra tall rabbity ears
    back.push({ fill: bodyFill, svg: (f, s) => ell(44, 26, 12, 30, f, `transform="rotate(-8 44 26)" ${s}`) });
    back.push({ fill: bodyFill, svg: (f, s) => ell(78, 26, 12, 30, f, `transform="rotate(8 78 26)" ${s}`) });
    extras += ell(44, 30, 5.5, 18, COLORS.blush, 'transform="rotate(-8 44 30)" opacity="0.8"');
    extras += ell(78, 30, 5.5, 18, COLORS.blush, 'transform="rotate(8 78 30)" opacity="0.8"');
  } else if (species === 'twirl') {
    // single curly antenna + small ears
    back.push({ fill: bodyFill, svg: (f, s) =>
      // ...and Twirl's antenna repeats `stroke` inside its own `extra`, which the helper
      // above cannot see. Pick it once — and pick the one the BROWSER has been drawing
      // since RUN2: HTML keeps the FIRST of two duplicate attributes, so the trailing
      // `stroke="INK"` the author wrote has never once been painted. The antenna is body-
      // coloured on every screen in the app and stays that way; this repairs the XML, it
      // does not restyle a Boo. (Same rule; same invisible-inside-an-<img> failure.)
      path('M60 44 C60 26 74 26 74 16 C74 8 66 8 66 14', 'none', `stroke="${f === HALO ? HALO : bodyFill}" stroke-width="${f === HALO ? 10 : 6}" fill="none"`) });
    // draw antenna explicitly (stroke-based) — override: use a dedicated builder
    back.length = 0;
    back.push({ fill: 'none', svg: (f, s) => {
      if (f === HALO) return path('M60 46 C58 24 80 24 78 12', 'none', `stroke="${HALO}" stroke-width="11" fill="none" stroke-linecap="round"`);
      return path('M60 46 C58 24 80 24 78 12', 'none', `stroke="${INK}" stroke-width="4.5" fill="none" stroke-linecap="round"`) +
             `<circle cx="78" cy="11" r="7" fill="${COLORS.gold}" stroke="${INK}" stroke-width="3"/>`;
    }});
    back.push(roundedEar(30, -1));
    back.push(roundedEar(90, 1));
    extras += innerEar(30, -1) + innerEar(90, 1);
  } else if (species === 'nova') {
    // fluffy chest patch + swirl tail
    back.push({ fill: bodyFill, svg: (f, s) =>
      path('M96 84 C118 80 116 104 98 104 C108 98 104 90 96 92 Z', f, s) }); // swirl tail
    back.push(roundedEar(30, -1));
    back.push(roundedEar(90, 1));
    extras += innerEar(30, -1) + innerEar(90, 1);
  } else if (species === 'bloop') {
    bodyRx = 43; bodyRy = 43; // perfectly round
    back.push(roundedEar(32, -1));
    back.push(roundedEar(88, 1));
    extras += innerEar(32, -1) + innerEar(88, 1);
  } else if (species === 'snug') {
    // cosy hood framing the face; ears hidden; sleepy eyes (a onesie look)
    bodyRx = 44; bodyRy = 42;
    const hood = extra.hood || bellyFill || COLORS.cream;
    // hood dome drawn over the head-top, face peeks out below
    extras += path('M12 74 A 48 46 0 0 1 108 74 L108 82 A 40 40 0 0 0 12 82 Z', hood, `stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"`);
    extras += ell(60, 88, 22, 15, lighten(bodyFill), `stroke="${INK}" stroke-width="1.8" opacity="0.6"`);
  } else if (species === 'zippy') {
    // tiny stubby wings, always mid-hop
    const wing = extra.wing || lighten(bodyFill);
    back.push({ fill: wing, svg: (f, s) => ell(18, 72, 11, 20, f === HALO ? HALO : wing, `transform="rotate(24 18 72)" ${s}`) });
    back.push({ fill: wing, svg: (f, s) => ell(102, 72, 11, 20, f === HALO ? HALO : wing, `transform="rotate(-24 102 72)" ${s}`) });
    back.push(roundedEar(32, -1));
    back.push(roundedEar(88, 1));
    extras += innerEar(32, -1) + innerEar(88, 1);
  } else if (species === 'giraffe') {
    // tiny giraffe friend (Twiglet): round body, ossicones, cocoa spots, a little leaf
    bodyRx = 43; bodyRy = 43;
    back.push({ fill: bodyFill, svg: (f) => `<line x1="48" y1="36" x2="45" y2="18" ${f === HALO ? `stroke="${HALO}" stroke-width="10"` : `stroke="${INK}" stroke-width="5"`} stroke-linecap="round"/>` });
    back.push({ fill: bodyFill, svg: (f) => `<line x1="72" y1="36" x2="75" y2="18" ${f === HALO ? `stroke="${HALO}" stroke-width="10"` : `stroke="${INK}" stroke-width="5"`} stroke-linecap="round"/>` });
    back.push(roundedEar(30, -1)); back.push(roundedEar(90, 1));
    extras += `<circle cx="45" cy="16" r="5" fill="${COLORS.cocoa}" stroke="${INK}" stroke-width="2.4"/><circle cx="75" cy="16" r="5" fill="${COLORS.cocoa}" stroke="${INK}" stroke-width="2.4"/>`;
    extras += innerEar(30, -1) + innerEar(90, 1);
    extras += [[40, 64], [80, 60], [50, 98], [84, 90], [32, 88]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="6" fill="${COLORS.cocoa}" opacity="0.85"/>`).join('');
    extras += `<g class="twiglet-leaf"><path d="M84 104 Q96 96 100 106 Q92 112 84 104 Z" fill="${COLORS.zing || '#35D0BA'}" stroke="${INK}" stroke-width="2"/></g>`;
  } else {
    // sunny, munch, default rounded ears
    back.push(roundedEar(30, -1));
    back.push(roundedEar(90, 1));
    extras += innerEar(30, -1) + innerEar(90, 1);
  }

  const body = { fill: bodyFill, svg: (f, s) => ell(60, bodyCy, bodyRx, bodyRy, f, s) };

  // belly / chest patch
  if (species === 'nova') {
    extras = ell(60, 86, 24, 20, bellyFill || COLORS.cream, `stroke="${INK}" stroke-width="2.4"`) + extras;
    // scalloped top of chest fluff
    extras = `<path d="M40 78 Q48 70 56 78 Q60 71 64 78 Q72 70 80 78" fill="none" stroke="${INK}" stroke-width="2.2"/>` + extras;
  } else if (bellyFill) {
    extras = ell(60, 88, 22, 16, bellyFill, `stroke="${INK}" stroke-width="2.2" opacity="0.95"`) + extras;
  }

  // feet
  extras += rrect(40, 108, 16, 10, 5, bodyFill, `stroke="${INK}" stroke-width="3"`);
  extras += rrect(64, 108, 16, 10, 5, bodyFill, `stroke="${INK}" stroke-width="3"`);

  const eyeKind = species === 'sunny' ? 'star' : species === 'snug' ? 'sleepy' : 'round';
  return { back, body, extras, eyeKind };
}

// ---- public: render a Boo -----------------------------------------------
// opts.equipArt accepts the legacy single art key or RUN10 P13's
// {hat,face,feet} art map.
export function renderBoo(item, { size = 120, cls = '', equipArt = null } = {}) {
  const bodyFill = c(item.colors.body);
  const bellyFill = item.colors.belly ? c(item.colors.belly) : null;
  const extra = { hood: item.colors.hood ? c(item.colors.hood) : null, wing: item.colors.wing ? c(item.colors.wing) : null };
  const g = speciesGeom(item.species, bodyFill, bellyFill, extra);

  const shapes = [...g.back, g.body];
  const { halo, color } = silhouette(shapes);

  // RUN18B Y4: two one-off variations a Flash Boos scene can pose a Boo with. They live
  // here rather than in the game because they are drawing, and because "a Boo with its
  // eyes shut" should look the same wherever it is ever drawn again.
  const eyeKind = item.eyes === 'closed' ? 'sleepy' : g.eyeKind;
  const wave = item.pose === 'wave'
    ? `<g class="boo-wave">` +
      `<path d="M90 82 Q104 70 105 52" fill="none" stroke="${INK}" stroke-width="21" stroke-linecap="round"/>` +
      `<path d="M90 82 Q104 70 105 52" fill="none" stroke="${bodyFill}" stroke-width="14" stroke-linecap="round"/>` +
      `<circle cx="105" cy="46" r="12" fill="${bodyFill}" stroke="${INK}" stroke-width="3.4"/>` +
      `<path d="M116 34 Q120 29 121 23 M104 28 Q105 22 103 16" fill="none" stroke="${INK}" ` +
      `stroke-width="3.4" stroke-linecap="round" opacity="0.8"/></g>`
    : '';

  const face = eyes(45, 75, 80, 14, eyeKind) +
               cheeks(40, 80, 90) +
               mouth(item.species, item.mouth) + wave;

  // a couple of item-specific trinkets
  let trinket = '';
  if (item.id === 'boo_jingle') trinket = `<g class="jingle-bell"><circle cx="60" cy="46" r="6" fill="${COLORS.gold}" stroke="${INK}" stroke-width="2.4"/><circle cx="60" cy="47" r="1.6" fill="${INK}"/></g>`;
  if (item.id === 'boo_pumpkin') trinket = `<path d="M60 34 Q58 22 66 18" fill="none" stroke="#4E8B3A" stroke-width="5" stroke-linecap="round"/><path d="M56 30 Q52 24 46 26" fill="none" stroke="#4E8B3A" stroke-width="3.5" stroke-linecap="round"/>`;

  const booAnchor = { cx: 60, topY: 30, eyeY: 80, earY: 70, R: 45 };
  const worn = typeof equipArt === 'string' ? { hat: equipArt } : (equipArt || {});
  let accSvg = '';
  if (worn.hat) accSvg += accessoryArt(worn.hat, booAnchor);
  else if (item.acc && item.acc !== 'none') accSvg += accessory(item.acc) || accessoryArt(item.acc, booAnchor);
  if (worn.face) accSvg += accessoryArt(worn.face, booAnchor);
  if (worn.feet) accSvg += accessoryArt(worn.feet, booAnchor);

  const fxCls = item.fx ? ` fx-${item.fx}` : '';
  return `<svg viewBox="0 0 120 130" width="${size}" height="${size * 130/120}" class="boo-svg${fxCls} ${cls}" role="img" aria-label="${escapeHTML(item.name)}" xmlns="http://www.w3.org/2000/svg">` +
    halo + color + g.extras + face + trinket + accSvg + fxSparkles(item.fx) +
  `</svg>`;
}

// ---- RUN17 X3: the Feelings Corner's mirroring face ----------------------
// The Boo MIRRORS the feeling — that mirroring IS beat one, so it belongs in the art
// layer beside every other face this app draws, not improvised inside a screen.
//
// Returned as a standalone overlay on renderBoo's own 120x130 viewBox and eye geometry
// (eyes at x 45/75, y 80; mouth around y 95), so it stacks exactly over a rendered Boo.
// Posture — the bounce, the sway, the fidget — is CSS on the wrapper; this is the face.
// Each expression is the pack's own description in CONTENT_WARMTH.md X3, nothing added.
const FEELING_FACES = {
  // bright eyes, wide smile
  happy: () =>
    eyes(45, 75, 80, 14, 'round') + cheeks(40, 80, 90) +
    path('M48 92 Q60 108 72 92', 'none', `stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"`),
  // wide eyes
  excited: () =>
    eyes(45, 75, 80, 16, 'round') + cheeks(40, 80, 90) +
    path('M48 91 Q60 110 72 91 Z', INK, `stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"`),
  // soft eyes half-closed
  calm: () =>
    eyes(45, 75, 80, 14, 'sleepy') + cheeks(40, 80, 90) +
    path('M53 95 Q60 101 67 95', 'none', `stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"`),
  // droopy eyes, small yawn
  tired: () =>
    eyes(45, 75, 80, 14, 'sleepy') +
    ell(60, 97, 6, 8, INK, `stroke="${INK}" stroke-width="2"`),
  // raised brows
  worried: () =>
    eyes(45, 75, 82, 12, 'round') +
    path('M36 66 Q45 60 54 64', 'none', `stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"`) +
    path('M66 64 Q75 60 84 66', 'none', `stroke="${INK}" stroke-width="3" fill="none" stroke-linecap="round"`) +
    path('M52 98 Q60 94 68 98', 'none', `stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"`),
  // downturned mouth
  sad: () =>
    eyes(45, 75, 81, 13, 'round') +
    path('M38 68 Q46 63 54 67', 'none', `stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"`) +
    path('M66 67 Q74 63 82 68', 'none', `stroke="${INK}" stroke-width="2.6" fill="none" stroke-linecap="round"`) +
    path('M51 99 Q60 92 69 99', 'none', `stroke="${INK}" stroke-width="2.8" fill="none" stroke-linecap="round"`)
};

export const FEELING_FACE_KEYS = Object.keys(FEELING_FACES);

export function renderFeelingFace(key, { size = 150, cls = '' } = {}) {
  const draw = FEELING_FACES[key] || FEELING_FACES.calm;
  return `<svg viewBox="0 0 120 130" width="${size}" height="${size * 130 / 120}" ` +
    `class="feeling-face ff-${key} ${cls}" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">${draw()}</svg>`;
}

// ==========================================================================
// The guide / player character — FIVE species on one shared layered SVG rig.
// guide = { species, body, pattern, patternColour, eyes, acc, name }
// All species share: body-colour fill, pattern overlay (none/spots/stripes),
// eye style (round/sparkle/sleepy), one accessory slot, and the halo+ink look.
// Distinct silhouettes: giraffe neck+ossicones, puppy floppy ears, kitten
// pointy ears, penguin flippers+belly, bunny tall ears.
// ==========================================================================

export const GUIDE_SPECIES = [
  { key: 'giraffe', label: 'Giraffe' },
  { key: 'puppy',   label: 'Puppy'   },
  { key: 'kitten',  label: 'Kitten'  },
  { key: 'penguin', label: 'Penguin' },
  { key: 'bunny',   label: 'Bunny'   }
];
export const GUIDE_BODIES = [
  { key: 'sunshine',  hex: '#FFD166' }, { key: 'lilac', hex: '#C6A9F0' },
  { key: 'sky',       hex: '#8FC7FF' }, { key: 'bubblegum', hex: '#FF7AC6' },
  { key: 'teal',      hex: '#35D0BA' }, { key: 'cream', hex: '#FFF8F0' }
];
export const GUIDE_PATTERNS = [
  { key: 'none', label: 'Plain' }, { key: 'spots', label: 'Spots' }, { key: 'stripes', label: 'Stripes' }
];
export const GUIDE_PATTERN_COLOURS = [
  { key: 'cocoa', hex: '#8A5A44' }, { key: 'indigo', hex: '#3B2E7E' },
  { key: 'pink',  hex: '#FF7AC6' }, { key: 'white',  hex: '#FFFFFF' }
];
export const GUIDE_EYES = [
  { key: 'round', label: 'Round' }, { key: 'sparkle', label: 'Sparkle' }, { key: 'sleepy', label: 'Sleepy' }
];
// Base built-in accessories (owned accessory items are appended by the creator UI).
export const GUIDE_ACCS = [
  { key: 'none',       label: 'None' },
  { key: 'bow',        label: 'Bow' },
  { key: 'sunglasses', label: 'Star shades' },
  { key: 'crown',      label: 'Crown' },
  { key: 'headphones', label: 'Headphones' }
];

let _uid = 0;

// Bring any older guide shape up to the new one (defensive; state.js also migrates).
export function normalizeGuide(g) {
  if (!g) return { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'bow', name: 'Twiggy' };
  if (g.species) return g;
  return {
    species: 'giraffe',
    body: g.body || 'sunshine',
    pattern: 'spots',
    patternColour: g.patch || 'cocoa',
    eyes: 'round',
    acc: g.acc || 'none',
    name: g.name || 'Twiggy'
  };
}

export function renderGuide(guideIn, { size = 200, view = 'full', cls = '' } = {}) {
  const guide = normalizeGuide(guideIn);
  const bodyFill = c(guide.body || 'sunshine');
  const patCol = c({ cocoa: 'cocoa', indigo: 'indigo', pink: 'pink', white: '#FFFFFF' }[guide.patternColour] || guide.patternColour || 'cocoa');
  const g = characterGeom(guide.species || 'giraffe', bodyFill);

  const outline = silhouette(g.outline, { haloW: 11, inkW: 4 });
  const cid = 'gpat' + (++_uid);
  const patternSvg = patternLayer(guide.pattern, patCol, cid);
  const defs = (guide.pattern && guide.pattern !== 'none')
    ? `<defs><clipPath id="${cid}">${g.clipEls}</clipPath></defs>` : '';

  // Eyes wrapped so the guide can blink (idle life); transform-origin at the eye line.
  const eyeCx = ((g.eye.lx + g.eye.rx) / 2).toFixed(1);
  const eyeSvg = `<g class="art-eyes" style="transform-origin:${eyeCx}px ${g.eye.cy}px">` +
    eyes(g.eye.lx, g.eye.rx, g.eye.cy, g.eye.r, guide.eyes || 'round') + `</g>`;
  const face = eyeSvg + g.face;
  const acc = guideAccessory(guide.acc, g.anchor);

  const inner = defs + outline.halo + outline.color + (g.belly || '') + patternSvg + (g.details || '') + face + acc;

  const box = view === 'head' ? g.headBox : '0 0 120 140';
  const vb = box.split(' ').map(Number);
  const ar = vb[3] / vb[2];
  const w = view === 'head' ? size * 0.86 : size;
  // Full view: overflow visible so tall accessories (wizard hat) aren't clipped.
  // Head view: overflow hidden so the body is cropped to a head-and-shoulders peek.
  const overflow = view === 'head' ? 'hidden' : 'visible';
  return `<svg viewBox="${box}" width="${w}" height="${(w * ar).toFixed(1)}" class="guide-svg ${cls}" ` +
    `role="img" aria-label="${escapeHTML(guide.name || 'guide')}" xmlns="http://www.w3.org/2000/svg" style="overflow:${overflow}">${inner}</svg>`;
}

// Pattern overlay clipped to the body/head silhouette. Generic scatter/bands,
// clipped so only the parts over the body show — works for every species.
function patternLayer(pattern, colourHex, cid) {
  if (!pattern || pattern === 'none') return '';
  let marks = '';
  if (pattern === 'spots') {
    const spots = [[42,54,7],[74,50,6],[38,78,7],[82,80,6],[54,96,8],[60,66,5],
                   [30,98,5],[90,66,5],[46,116,6],[74,116,6],[60,120,5]];
    marks = spots.map(([x,y,r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${colourHex}" opacity="0.9"/>`).join('');
  } else { // stripes
    marks = [34,52,70,88,106,124].map(y =>
      `<rect x="6" y="${y}" width="108" height="8" fill="${colourHex}" opacity="0.82" transform="rotate(-12 60 ${y})"/>`
    ).join('');
  }
  return `<g clip-path="url(#${cid})">${marks}</g>`;
}

// Per-species geometry in a shared 0 0 120 140 viewBox.
// Returns { outline:[shapes], clipEls, belly, details, face, eye:{lx,rx,cy,r}, anchor, headBox }
function characterGeom(species, bodyFill) {
  const ink = (w = 4) => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
  const lite = lighten(bodyFill);
  const S = (svg) => ({ fill: bodyFill, svg });        // body-coloured outline shape

  if (species === 'puppy') {
    const outline = [
      // floppy ears (behind)
      S((f, s) => ell(22, 70, 13, 30, f, `transform="rotate(12 22 70)" ${s}`)),
      S((f, s) => ell(98, 70, 13, 30, f, `transform="rotate(-12 98 70)" ${s}`)),
      S((f, s) => ell(60, 116, 31, 21, f, s)),          // body
      S((f, s) => ell(60, 52, 35, 31, f, s))            // head
    ];
    const clipEls = ell(60,116,31,21,bodyFill) + ell(60,52,35,31,bodyFill);
    const belly = ell(60, 118, 18, 13, lite, ink(2.4));
    const details =
      ell(24, 74, 6, 16, COLORS.blush, `transform="rotate(12 24 74)" opacity="0.75"`) +
      ell(96, 74, 6, 16, COLORS.blush, `transform="rotate(-12 96 74)" opacity="0.75"`) +
      ell(60, 64, 17, 13, lite, ink(3)) +                // snout
      rrect(44,132,15,9,5, bodyFill, ink(3)) + rrect(61,132,15,9,5, bodyFill, ink(3)) + // feet
      `<path d="M90 112 Q104 104 98 92" fill="none" ${ink(4)}/>`;   // tail
    const face =
      cheeks(40, 80, 60) +
      `<ellipse cx="60" cy="58" rx="5.5" ry="4.5" fill="${INK}"/>` +   // nose
      `<path d="M60 62 Q60 70 52 70 M60 62 Q60 70 68 70" fill="none" ${ink(2.4)}/>`; // mouth
    return { outline, clipEls, belly, details, face,
      eye: { lx: 46, rx: 74, cy: 51, r: 9 },
      anchor: { cx: 60, headTopY: 22, eyeY: 51, headR: 35, headCy: 52 },
      headBox: '4 12 112 96' };
  }

  if (species === 'kitten') {
    const outline = [
      S((f, s) => path('M30 36 L18 4 L50 30 Z', f, s)),   // left ear
      S((f, s) => path('M90 36 L102 4 L70 30 Z', f, s)),  // right ear
      S((f, s) => ell(60, 118, 28, 18, f, s)),            // body
      S((f, s) => ell(60, 56, 33, 30, f, s))              // head
    ];
    const clipEls = ell(60,118,28,18,bodyFill) + ell(60,56,33,30,bodyFill);
    const belly = ell(60, 120, 16, 11, lite, ink(2.2));
    const details =
      path('M32 30 L24 12 L44 28 Z', COLORS.blush, `opacity="0.8" ${ink(2)}`) +
      path('M88 30 L96 12 L76 28 Z', COLORS.blush, `opacity="0.8" ${ink(2)}`) +
      rrect(46,130,14,9,5, bodyFill, ink(3)) + rrect(60,130,14,9,5, bodyFill, ink(3)) +
      `<path d="M86 122 Q108 118 100 96" fill="none" ${ink(4)}/>` +          // tail
      // whiskers
      `<path d="M40 62 L18 58 M40 68 L18 68 M40 74 L20 80" stroke="${INK}" stroke-width="1.8" fill="none" stroke-linecap="round"/>` +
      `<path d="M80 62 L102 58 M80 68 L102 68 M80 74 L100 80" stroke="${INK}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
    const face =
      cheeks(42, 78, 66) +
      path('M55 62 L65 62 L60 68 Z', COLORS.blush, ink(2)) +                 // nose
      `<path d="M60 68 Q60 73 54 73 M60 68 Q60 73 66 73" fill="none" ${ink(2.2)}/>`;
    return { outline, clipEls, belly, details, face,
      eye: { lx: 47, rx: 73, cy: 55, r: 9 },
      anchor: { cx: 60, headTopY: 26, eyeY: 55, headR: 33, headCy: 56 },
      headBox: '6 0 108 100' };
  }

  if (species === 'penguin') {
    const outline = [
      S((f, s) => ell(20, 86, 8, 26, f, `transform="rotate(18 20 86)" ${s}`)),  // left flipper
      S((f, s) => ell(100, 86, 8, 26, f, `transform="rotate(-18 100 86)" ${s}`)), // right flipper
      S((f, s) => path('M60 20 C24 20 22 78 30 104 C38 128 82 128 90 104 C98 78 96 20 60 20 Z', f, s)) // egg body+head
    ];
    const clipEls = path('M60 20 C24 20 22 78 30 104 C38 128 82 128 90 104 C98 78 96 20 60 20 Z', bodyFill);
    const belly = `<path d="M60 40 C40 40 38 84 46 104 C52 120 68 120 74 104 C82 84 80 40 60 40 Z" fill="${COLORS.cream}" ${ink(2.6)}/>`;
    const details =
      // webbed feet
      path('M40 124 Q46 136 56 126 Z', COLORS.gold, ink(2.6)) +
      path('M64 126 Q74 136 80 124 Z', COLORS.gold, ink(2.6)) +
      // beak
      path('M52 63 L60 58 L68 63 L60 70 Z', COLORS.gold, ink(2.6));
    const face =
      cheeks(44, 76, 60) +
      `<path d="M60 70 Q60 74 56 74 M60 70 Q60 74 64 74" fill="none" ${ink(2)}/>`;
    return { outline, clipEls, belly, details, face,
      eye: { lx: 50, rx: 70, cy: 50, r: 8.5 },
      anchor: { cx: 60, headTopY: 22, eyeY: 50, headR: 30, headCy: 48 },
      headBox: '8 12 104 90' };
  }

  if (species === 'bunny') {
    const outline = [
      S((f, s) => ell(49, 26, 10, 30, f, `transform="rotate(-8 49 26)" ${s}`)),  // left ear
      S((f, s) => ell(71, 26, 10, 30, f, `transform="rotate(8 71 26)" ${s}`)),   // right ear
      S((f, s) => ell(60, 118, 29, 18, f, s)),           // body
      S((f, s) => ell(60, 62, 31, 29, f, s))             // head
    ];
    const clipEls = ell(60,118,29,18,bodyFill) + ell(60,62,31,29,bodyFill);
    const belly = ell(60, 120, 16, 11, lite, ink(2.2));
    const details =
      ell(49, 30, 4.5, 20, COLORS.blush, `transform="rotate(-8 49 30)" opacity="0.75"`) +
      ell(71, 30, 4.5, 20, COLORS.blush, `transform="rotate(8 71 30)" opacity="0.75"`) +
      rrect(46,130,14,9,5, bodyFill, ink(3)) + rrect(60,130,14,9,5, bodyFill, ink(3)) +
      `<circle cx="90" cy="120" r="8" fill="${HALO}" ${ink(3)}/>`;   // cotton tail
    const face =
      cheeks(43, 77, 70) +
      path('M56 66 L64 66 L60 71 Z', COLORS.blush, ink(2)) +          // nose
      `<path d="M60 71 L60 76 M60 76 Q56 78 55 74 M60 76 Q64 78 65 74" fill="none" ${ink(2.2)}/>` +
      rrect(56.5, 78, 3.2, 6, 1, COLORS.toothW, ink(1.2)) + rrect(60.3, 78, 3.2, 6, 1, COLORS.toothW, ink(1.2)); // teeth
    return { outline, clipEls, belly, details, face,
      eye: { lx: 48, rx: 72, cy: 60, r: 9 },
      anchor: { cx: 60, headTopY: 36, eyeY: 60, headR: 31, headCy: 62 },
      headBox: '10 0 100 100' };
  }

  // ---- giraffe (default) ----
  const outline = [
    // ossicones
    { fill: bodyFill, svg: (f, s) => `<line x1="49" y1="42" x2="47" y2="22" ${f===HALO?`stroke="${HALO}" stroke-width="10" stroke-linecap="round"`:ink(5)}/>` },
    { fill: bodyFill, svg: (f, s) => `<line x1="71" y1="42" x2="73" y2="22" ${f===HALO?`stroke="${HALO}" stroke-width="10" stroke-linecap="round"`:ink(5)}/>` },
    S((f, s) => path('M46 122 Q42 84 50 60 L70 60 Q78 84 74 122 Z', f, s)),  // neck
    S((f, s) => ell(60, 120, 34, 19, f, s)),                                 // body
    S((f, s) => ell(60, 44, 27, 24, f, s))                                   // head
  ];
  const clipEls = ell(60,120,34,19,bodyFill) + path('M46 122 Q42 84 50 60 L70 60 Q78 84 74 122 Z', bodyFill) + ell(60,44,27,24,bodyFill);
  const belly = ell(60, 52, 16, 12, lite, ink(2.6));                          // snout
  const details =
    ell(34, 48, 11, 7, bodyFill, `${ink(3.2)} transform="rotate(-24 34 48)"`) +
    ell(86, 48, 11, 7, bodyFill, `${ink(3.2)} transform="rotate(24 86 48)"`) +
    `<circle cx="47" cy="21" r="5.5" fill="${lite}" ${ink(3)}/>` +
    `<circle cx="73" cy="21" r="5.5" fill="${lite}" ${ink(3)}/>` +
    rrect(46,132,13,8,5, bodyFill, ink(3)) + rrect(61,132,13,8,5, bodyFill, ink(3)) +
    `<path d="M92 118 Q106 122 100 138" fill="none" ${ink(4)}/>`;              // tail
  const face =
    cheeks(46, 74, 52) +
    `<ellipse cx="55" cy="52" rx="2" ry="2.6" fill="${INK}"/><ellipse cx="65" cy="52" rx="2" ry="2.6" fill="${INK}"/>` +
    `<path d="M55 57 Q60 61 65 57" fill="none" ${ink(2.4)}/>`;
  return { outline, clipEls, belly, details, face,
    eye: { lx: 51, rx: 69, cy: 43, r: 8.5 },
    anchor: { cx: 60, headTopY: 20, eyeY: 43, headR: 27, headCy: 44 },
    headBox: '20 6 80 78' };
}

// Accessory rendered relative to a species head anchor {cx, headTopY, eyeY, headR, headCy}.
// Accepts a base key (bow/sunglasses/crown/headphones) or an owned accessory item id
// (resolved in phase 2 via accessoryArt); returns SVG string.
function guideAccessory(acc, a) {
  if (!acc || acc === 'none') return '';
  const cx = a.cx, top = a.headTopY, eyeY = a.eyeY, R = a.headR;
  switch (acc) {
    case 'bow': {
      const x = cx - R * 0.5, y = top + 6;
      return path(`M${x} ${y} L${x-13} ${y-9} L${x-13} ${y+9} Z`, COLORS.pink, `stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"`) +
             path(`M${x} ${y} L${x+13} ${y-9} L${x+13} ${y+9} Z`, COLORS.pink, `stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"`) +
             `<circle cx="${x}" cy="${y}" r="5" fill="${COLORS.pink}" stroke="${INK}" stroke-width="2.6"/>`;
    }
    case 'sunglasses':
      return path(starPath(cx - 12, eyeY, 12, 5.4), INK, `stroke="${INK}" stroke-width="1"`) +
             path(starPath(cx + 12, eyeY, 12, 5.4), INK, `stroke="${INK}" stroke-width="1"`) +
             `<line x1="${cx-2}" y1="${eyeY-2}" x2="${cx+2}" y2="${eyeY-2}" stroke="${INK}" stroke-width="3"/>`;
    case 'crown':
      return path(`M${cx-18} ${top+8} L${cx-13} ${top-6} L${cx-6} ${top+4} L${cx} ${top-8} L${cx+6} ${top+4} L${cx+13} ${top-6} L${cx+18} ${top+8} Z`, COLORS.gold, `stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"`) +
             `<circle cx="${cx-13}" cy="${top-6}" r="2.4" fill="${COLORS.pink}"/><circle cx="${cx}" cy="${top-8}" r="2.6" fill="${COLORS.bubblegum}"/><circle cx="${cx+13}" cy="${top-6}" r="2.4" fill="${COLORS.teal}"/>`;
    case 'headphones':
      return path(`M${cx-R} ${eyeY} Q${cx} ${top-8} ${cx+R} ${eyeY}`, 'none', `stroke="${COLORS.pink}" stroke-width="7" fill="none" stroke-linecap="round"`) +
             rrect(cx-R-7, eyeY-6, 14, 22, 6, COLORS.pink, `stroke="${INK}" stroke-width="3"`) +
             rrect(cx+R-7, eyeY-6, 14, 22, 6, COLORS.pink, `stroke="${INK}" stroke-width="3"`);
    default: {
      // An owned accessory item id (or bare art key) -> unified accessory art.
      const artKey = (BY_ID[acc] && BY_ID[acc].art) || acc;
      return accessoryArt(artKey, { cx: a.cx, topY: a.headTopY, eyeY: a.eyeY, earY: a.headCy, R: a.headR });
    }
  }
}

// ---- unified accessory art (RUN2 part D) --------------------------------
// Renders any of the 10 wearable accessories in any coordinate space via an anchor:
// a = { cx, topY (hat baseline), eyeY (glasses line), earY (headphone/scarf line), R (head half-width) }
// Used on both Boos (renderBoo) and the player's own character (renderGuide).
function smallFlower(x, y, r) {
  let p = '';
  for (let i = 0; i < 5; i++) { const a = i * 72 * Math.PI / 180; p += ell(x + r * Math.cos(a), y + r * Math.sin(a), r * 0.7, r * 0.7, COLORS.bubblegum, `stroke="${INK}" stroke-width="1.5"`); }
  return p + `<circle cx="${x}" cy="${y}" r="${r * 0.55}" fill="${COLORS.gold}" stroke="${INK}" stroke-width="1.3"/>`;
}
function heartShape(x, y, r, fill) {
  return path(`M${x} ${(y + r * 0.5).toFixed(1)} C${(x - r * 1.3).toFixed(1)} ${(y - r * 0.55).toFixed(1)}, ${(x - r * 0.5).toFixed(1)} ${(y - r * 1.15).toFixed(1)}, ${x} ${(y - r * 0.2).toFixed(1)} C${(x + r * 0.5).toFixed(1)} ${(y - r * 1.15).toFixed(1)}, ${(x + r * 1.3).toFixed(1)} ${(y - r * 0.55).toFixed(1)}, ${x} ${(y + r * 0.5).toFixed(1)} Z`, fill, `stroke="${INK}" stroke-width="2" opacity="0.92"`);
}

export function accessoryArt(key, a) {
  const { cx, topY, eyeY, earY, R } = a;
  const ink = (w = 2.6) => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
  const purple = '#9B6DE0', straw = '#F0D28C', cosy = '#EA6A73';
  switch (key) {
    case 'bow': {
      const x = cx - R * 0.42, y = topY + 6;
      return path(`M${x} ${y} L${x-13} ${y-9} L${x-13} ${y+9} Z`, purple, ink()) +
             path(`M${x} ${y} L${x+13} ${y-9} L${x+13} ${y+9} Z`, purple, ink()) +
             `<circle cx="${x}" cy="${y}" r="5" fill="${purple}" ${ink()}/>`;
    }
    case 'sunhat': {
      const y = topY + 7;
      return ell(cx, y, R * 0.98, R * 0.30, straw, ink()) +
             path(`M${cx-R*0.55} ${y} Q${cx} ${topY-R*0.55} ${cx+R*0.55} ${y} Z`, straw, ink()) +
             path(`M${cx-R*0.5} ${y-2} Q${cx} ${y-6} ${cx+R*0.5} ${y-2}`, 'none', `stroke="${cosy}" stroke-width="4" fill="none"`) +
             smallFlower(cx + R * 0.34, y - 4, R * 0.14);
    }
    case 'shades': {
      const r = R * 0.33, y = eyeY;
      return path(starPath(cx - R * 0.42, y, r, r * 0.42), INK, `stroke="${COLORS.gold}" stroke-width="2.4"`) +
             path(starPath(cx + R * 0.42, y, r, r * 0.42), INK, `stroke="${COLORS.gold}" stroke-width="2.4"`) +
             `<line x1="${cx-R*0.1}" y1="${y}" x2="${cx+R*0.1}" y2="${y}" stroke="${COLORS.gold}" stroke-width="3"/>`;
    }
    case 'scarf': {
      const y = eyeY + R * 0.58;
      return path(`M${cx-R*0.8} ${y} Q${cx} ${y+R*0.28} ${cx+R*0.8} ${y} L${cx+R*0.72} ${y+R*0.22} Q${cx} ${y+R*0.5} ${cx-R*0.72} ${y+R*0.22} Z`, cosy, ink()) +
             rrect(cx - R * 0.46, y + R * 0.12, R * 0.22, R * 0.5, 3, cosy, ink(2.4));
    }
    case 'flowercrown': {
      let s = ''; const n = 5;
      for (let i = 0; i < n; i++) { const t = i / (n - 1); const x = cx - R * 0.7 + t * R * 1.4; const y = topY + 8 - Math.sin(t * Math.PI) * R * 0.35; s += smallFlower(x, y, R * 0.17); }
      return s;
    }
    case 'heartglasses': {
      const y = eyeY;
      return heartShape(cx - R * 0.42, y, R * 0.34, COLORS.pink) + heartShape(cx + R * 0.42, y, R * 0.34, COLORS.pink) +
             `<line x1="${cx-R*0.1}" y1="${y}" x2="${cx+R*0.1}" y2="${y}" stroke="${INK}" stroke-width="3"/>`;
    }
    case 'wizardhat': {
      const baseY = topY + 6, tipY = topY - R * 1.1, tipX = cx + R * 0.14;
      return ell(cx, baseY, R * 0.85, R * 0.24, COLORS.midnight, ink()) +
             path(`M${cx-R*0.55} ${baseY} Q${cx-R*0.2} ${tipY+R*0.3} ${tipX} ${tipY} Q${cx+R*0.35} ${baseY-R*0.2} ${cx+R*0.55} ${baseY} Z`, COLORS.midnight, ink()) +
             path(starPath(tipX, tipY, 5, 2), COLORS.gold, `stroke="${INK}" stroke-width="1"`) +
             `<circle cx="${cx}" cy="${(baseY-R*0.4).toFixed(1)}" r="2.6" fill="${COLORS.gold}"/><circle cx="${(cx+R*0.2).toFixed(1)}" cy="${(baseY-R*0.72).toFixed(1)}" r="2.2" fill="${COLORS.star}"/>`;
    }
    case 'goldcrown': {
      const y = topY + 8;
      return path(`M${cx-R*0.5} ${y} L${cx-R*0.36} ${y-R*0.42} L${cx-R*0.17} ${y-R*0.12} L${cx} ${y-R*0.52} L${cx+R*0.17} ${y-R*0.12} L${cx+R*0.36} ${y-R*0.42} L${cx+R*0.5} ${y} Z`, COLORS.gold, ink()) +
             `<circle cx="${(cx-R*0.36).toFixed(1)}" cy="${(y-R*0.42).toFixed(1)}" r="2.4" fill="${COLORS.pink}"/><circle cx="${cx}" cy="${(y-R*0.52).toFixed(1)}" r="2.6" fill="${COLORS.bubblegum}"/><circle cx="${(cx+R*0.36).toFixed(1)}" cy="${(y-R*0.42).toFixed(1)}" r="2.4" fill="${COLORS.teal}"/>`;
    }
    case 'cape': {
      const y = eyeY + R * 0.42;
      return path(`M${cx-R*0.55} ${y} Q${cx} ${y+R*0.22} ${cx+R*0.55} ${y} L${cx+R*0.7} ${y+R*0.95} Q${cx} ${y+R*0.72} ${cx-R*0.7} ${y+R*0.95} Z`, '#8B5CF6', `${ink()} opacity="0.9"`) +
             `<circle cx="${cx}" cy="${(y+2).toFixed(1)}" r="4" fill="${COLORS.gold}" ${ink(2)}/>` +
             path(starPath(cx - R * 0.46, y + R * 0.55, 4, 1.6), '#fff', '') +
             path(starPath(cx + R * 0.4, y + R * 0.42, 3.4, 1.4), '#fff', '');
    }
    case 'djheadphones':
      return path(`M${cx-R} ${earY} Q${cx} ${topY-R*0.35} ${cx+R} ${earY}`, 'none', `stroke="${COLORS.gold}" stroke-width="7" fill="none" stroke-linecap="round"`) +
             path(`M${cx-R} ${earY} Q${cx} ${topY-R*0.35} ${cx+R} ${earY}`, 'none', `stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round"`) +
             rrect(cx - R - 8, earY - 8, 16, 24, 7, COLORS.gold, ink(3)) +
             rrect(cx + R - 8, earY - 8, 16, 24, 7, COLORS.gold, ink(3));
    case 'starcheek':
      return path(starPath(cx + R * .66, eyeY + R * .28, R * .14, R * .06), COLORS.gold, `stroke="${INK}" stroke-width="1.4"`);
    case 'heartcheek':
      return heartShape(cx + R * .66, eyeY + R * .3, R * .15, COLORS.pink);
    case 'rainbowstripe': {
      const y = eyeY + R * .25;
      return ['#FF6B8A','#FFC93C','#35D0BA','#8FC7FF'].map((colour, i) =>
        `<path d="M${cx-R*.82} ${y+i*3} Q${cx} ${y-6+i*3} ${cx+R*.82} ${y+i*3}" fill="none" stroke="${colour}" stroke-width="2.6" stroke-linecap="round"/>`
      ).join('');
    }
    case 'whiskers': {
      let marks = '';
      for (const side of [-1, 1]) for (let i = -1; i <= 1; i++) {
        const x1 = cx + side * R * .56, x2 = cx + side * R * .98;
        const y1 = eyeY + R * .27 + i * 5, y2 = y1 + i * 2;
        marks += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`;
      }
      return marks;
    }
    case 'rollerskates': {
      const y = eyeY + R * .72;
      return [-.28, .28].map(side => {
        const x = cx + R * side;
        return rrect(x - 10, y, 20, 12, 5, COLORS.pink, ink(2.2)) +
          `<circle cx="${x-6}" cy="${y+14}" r="3.5" fill="${COLORS.gold}" ${ink(1.5)}/><circle cx="${x+6}" cy="${y+14}" r="3.5" fill="${COLORS.gold}" ${ink(1.5)}/>`;
      }).join('');
    }
    case 'wellies': {
      const y = eyeY + R * .64;
      return [-.28, .28].map(side => {
        const x = cx + R * side;
        return path(`M${x-9} ${y} H${x+8} V${y+16} H${x+13} Q${x+14} ${y+24} ${x+5} ${y+24} H${x-9} Z`, COLORS.gold, ink(2.2));
      }).join('');
    }
    case 'policecap': {
      const y = topY + 5;
      return path(`M${cx-R*.62} ${y} Q${cx} ${topY-R*.62} ${cx+R*.62} ${y} L${cx+R*.54} ${y+10} H${cx-R*.54} Z`, '#4169A8', ink()) +
        path(starPath(cx, y-7, 6, 2.6), COLORS.gold, `stroke="${INK}" stroke-width="1.4"`) +
        ell(cx, y+10, R*.72, R*.14, '#2D4777', ink(2.2));
    }
    case 'policebadge':
      return path(starPath(cx-R*.55, eyeY+R*.55, 8, 3.8), COLORS.gold, `stroke="${INK}" stroke-width="1.8"`);
    case 'builderhelmet': {
      const y = topY + 7;
      return path(`M${cx-R*.62} ${y} Q${cx-R*.48} ${topY-R*.5} ${cx} ${topY-R*.56} Q${cx+R*.48} ${topY-R*.5} ${cx+R*.62} ${y} Z`, COLORS.gold, ink()) +
        rrect(cx-4, topY-R*.52, 8, R*.55, 3, '#F0A81E', ink(1.8)) +
        ell(cx, y+2, R*.78, R*.14, COLORS.gold, ink(2.2));
    }
    case 'builderhammer':
      return `<g class="costume-held hammer"><path d="M${cx+R*.66} ${eyeY+R*.3} l18 28" stroke="#8A5A44" stroke-width="6" stroke-linecap="round"/><rect x="${cx+R*.62}" y="${eyeY+R*.18}" width="30" height="12" rx="4" fill="#8B93A6" ${ink(2.2)} transform="rotate(12 ${cx+R*.62} ${eyeY+R*.18})"/></g>`;
    case 'cheftoque': {
      const y = topY - R*.25;
      return `<g fill="#fff" ${ink(2.2)}><circle cx="${cx-R*.3}" cy="${y}" r="${R*.28}"/><circle cx="${cx}" cy="${y-R*.12}" r="${R*.34}"/><circle cx="${cx+R*.3}" cy="${y}" r="${R*.28}"/><path d="M${cx-R*.55} ${y} H${cx+R*.55} L${cx+R*.48} ${topY+9} H${cx-R*.48} Z"/></g>`;
    }
    case 'chefspoon':
      return `<g class="costume-held spoon" transform="rotate(-18 ${cx+R*.68} ${eyeY+R*.5})"><line x1="${cx+R*.68}" y1="${eyeY+R*.32}" x2="${cx+R*.82}" y2="${eyeY+R*.94}" stroke="#AAB0BE" stroke-width="5" stroke-linecap="round"/><ellipse cx="${cx+R*.65}" cy="${eyeY+R*.22}" rx="8" ry="11" fill="#DDE2EA" ${ink(2)}/></g>`;
    case 'pithhat': {
      const y = topY + 7;
      return ell(cx, y, R*.92, R*.24, '#DDBE78', ink()) +
        path(`M${cx-R*.52} ${y} Q${cx} ${topY-R*.58} ${cx+R*.52} ${y} Z`, '#EAD39A', ink()) +
        `<path d="M${cx-R*.48} ${y-2} Q${cx} ${y-7} ${cx+R*.48} ${y-2}" fill="none" stroke="#7C9B53" stroke-width="4"/>`;
    }
    case 'maptan':
      return `<path d="M${cx-R*.78} ${eyeY+R*.28} q8 -5 15 0" fill="none" stroke="#C88745" stroke-width="3" stroke-linecap="round"/><g class="costume-held map"><path d="M${cx+R*.54} ${eyeY+R*.45} l14 -5 14 5 14 -5 v25 l-14 5 -14-5 -14 5 z" fill="#F6E7A8" ${ink(1.8)}/><path d="M${cx+R*.68} ${eyeY+R*.4} v25 M${cx+R*.99} ${eyeY+R*.45} v25" stroke="#B89553" stroke-width="1.5"/></g>`;
    // ---- RUN13 T5: twelve more accessories -------------------------------------------
    case 'beanie': {
      const y = topY + 8;
      return path(`M${cx-R*0.62} ${y} Q${cx} ${topY-R*0.62} ${cx+R*0.62} ${y} Z`, COLORS.teal, ink()) +
             rrect(cx - R * 0.66, y - 4, R * 1.32, 9, 4, COLORS.aqua, ink(2.2)) +
             `<circle cx="${cx}" cy="${(topY-R*0.62).toFixed(1)}" r="6" fill="${COLORS.bubblegum}" ${ink(2.2)}/>`;
    }
    case 'partyhat': {
      const y = topY + 6;
      return path(`M${cx-R*0.4} ${y} L${cx} ${topY-R*0.95} L${cx+R*0.4} ${y} Z`, COLORS.bubblegum, ink()) +
             `<circle cx="${cx}" cy="${(topY-R*0.95).toFixed(1)}" r="5" fill="${COLORS.gold}" ${ink(2)}/>` +
             [0.2, 0.5, 0.8].map((t, i) => `<circle cx="${(cx - R*0.4 + t*R*0.8).toFixed(1)}" cy="${(y - t*R*0.55).toFixed(1)}" r="2.6" fill="${['#fff', COLORS.teal, COLORS.gold][i]}"/>`).join('');
    }
    case 'earmuffs':
      return path(`M${cx-R*0.86} ${earY-2} Q${cx} ${topY-R*0.28} ${cx+R*0.86} ${earY-2}`, 'none', `fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"`) +
             ell(cx - R * 0.86, earY + 4, 11, 12, COLORS.pink, ink(2.4)) +
             ell(cx + R * 0.86, earY + 4, 11, 12, COLORS.pink, ink(2.4)) +
             ell(cx - R * 0.86, earY + 4, 6, 7, '#FFC3DE', '') +
             ell(cx + R * 0.86, earY + 4, 6, 7, '#FFC3DE', '');
    case 'starcape': {
      // The cape hangs still; `.acc-cape-flutter` (added by town.js while she is WALKING)
      // is what makes it fly. Transform-only, and it has a reduced-motion static pose.
      const y = eyeY + R * 0.42;
      return `<g class="acc-cape">` +
             path(`M${cx-R*0.58} ${y} Q${cx} ${y+R*0.24} ${cx+R*0.58} ${y} L${cx+R*0.76} ${y+R*1.0} Q${cx} ${y+R*0.76} ${cx-R*0.76} ${y+R*1.0} Z`, '#2E2A72', `${ink()} opacity="0.94"`) +
             path(starPath(cx - R * 0.42, y + R * 0.6, 4.4, 1.8), COLORS.star, '') +
             path(starPath(cx + R * 0.36, y + R * 0.46, 3.6, 1.5), '#fff', '') +
             path(starPath(cx + R * 0.02, y + R * 0.82, 3.2, 1.3), COLORS.star, '') +
             `</g><circle cx="${cx}" cy="${(y+2).toFixed(1)}" r="4.2" fill="${COLORS.star}" ${ink(2)}/>`;
    }
    case 'freckles': {
      let dots = '';
      for (const side of [-1, 1]) for (let i = 0; i < 3; i++) {
        dots += `<circle cx="${(cx + side * (R * 0.58 + i * 6)).toFixed(1)}" cy="${(eyeY + R * 0.26 + (i % 2) * 4).toFixed(1)}" r="2.1" fill="#B4715A"/>`;
      }
      return dots;
    }
    case 'monocle': {
      const x = cx + R * 0.42, y = eyeY;
      return `<circle cx="${x}" cy="${y}" r="${(R*0.34).toFixed(1)}" fill="#DFF3FF" opacity="0.5" stroke="${COLORS.gold}" stroke-width="3.2"/>` +
             `<line x1="${(x+R*0.3).toFixed(1)}" y1="${(y+R*0.2).toFixed(1)}" x2="${(x+R*0.5).toFixed(1)}" y2="${(y+R*0.8).toFixed(1)}" stroke="${COLORS.gold}" stroke-width="2.4"/>`;
    }
    case 'bandana': {
      // Worn over the muzzle, bandit-style — a FACE item that sits on the face, so it
      // anchors inside the head band on every species rather than dangling at the neck.
      const y = eyeY + R * 0.22;
      return path(`M${cx-R*0.78} ${y} Q${cx} ${y+R*0.10} ${cx+R*0.78} ${y} L${cx+R*0.62} ${y+R*0.42} Q${cx} ${y+R*0.56} ${cx-R*0.62} ${y+R*0.42} Z`, COLORS.red, ink()) +
             [[-0.38, 0.14], [0, 0.26], [0.38, 0.14]].map(([dx, dy]) => `<circle cx="${(cx+R*dx).toFixed(1)}" cy="${(y+R*dy).toFixed(1)}" r="2.6" fill="#fff"/>`).join('');
    }
    case 'snorkel': {
      const y = eyeY;
      return rrect(cx - R * 0.66, y - R * 0.3, R * 1.32, R * 0.62, 10, '#BFEAF7', `${ink()} opacity="0.9"`) +
             `<line x1="${cx}" y1="${(y-R*0.3).toFixed(1)}" x2="${cx}" y2="${(y+R*0.32).toFixed(1)}" stroke="${INK}" stroke-width="2.4"/>` +
             path(`M${cx+R*0.68} ${y-R*0.2} L${cx+R*0.86} ${topY+R*0.1}`, 'none', `fill="none" stroke="${COLORS.orange}" stroke-width="6" stroke-linecap="round"`);
    }
    case 'trainers': {
      const y = eyeY + R * .72;
      return [-.28, .28].map(side => {
        const x = cx + R * side;
        return path(`M${x-11} ${y+4} H${x+6} Q${x+13} ${y+4} ${x+13} ${y+13} H${x-11} Z`, '#fff', ink(2.2)) +
          `<line x1="${x-9}" y1="${y+8}" x2="${x+9}" y2="${y+8}" stroke="${COLORS.teal}" stroke-width="3"/>` +
          `<line x1="${x-11}" y1="${y+13}" x2="${x+13}" y2="${y+13}" stroke="${INK}" stroke-width="3"/>`;
      }).join('');
    }
    case 'bunnyslippers': {
      const y = eyeY + .72 * R;
      return [-.28, .28].map(side => {
        const x = cx + R * side;
        return ell(x, y + 10, 12, 8, '#FFC3DE', ink(2.2)) +
          ell(x - 4, y + 2, 3.2, 7, '#FFC3DE', ink(1.6)) + ell(x + 4, y + 2, 3.2, 7, '#FFC3DE', ink(1.6)) +
          `<circle cx="${x-4}" cy="${y+10}" r="1.6" fill="${INK}"/><circle cx="${x+4}" cy="${y+10}" r="1.6" fill="${INK}"/>`;
      }).join('');
    }
    case 'springboots': {
      const y = eyeY + R * .68;
      return [-.28, .28].map(side => {
        const x = cx + R * side;
        return rrect(x - 10, y, 20, 13, 5, COLORS.orange, ink(2.2)) +
          `<path d="M${x-7} ${y+15} q7 -4 14 0 q-7 4 -14 0 q7 -4 14 0" fill="none" stroke="${COLORS.gold}" stroke-width="3" stroke-linecap="round"/>` +
          `<line x1="${x-9}" y1="${y+24}" x2="${x+9}" y2="${y+24}" stroke="${INK}" stroke-width="3.4" stroke-linecap="round"/>`;
      }).join('');
    }
    case 'flippers': {
      const y = eyeY + R * .74;
      return [-.28, .28].map(side => {
        const x = cx + R * side;
        return path(`M${x-8} ${y} H${x+8} L${x+14} ${y+22} Q${x} ${y+27} ${x-14} ${y+22} Z`, COLORS.teal, ink(2.2)) +
          `<line x1="${x-4}" y1="${y+6}" x2="${x-7}" y2="${y+20}" stroke="${INK}" stroke-width="1.6"/>` +
          `<line x1="${x+4}" y1="${y+6}" x2="${x+7}" y2="${y+20}" stroke="${INK}" stroke-width="1.6"/>`;
      }).join('');
    }
    // ---- RUN13 T5: the Astronaut and the Pirate ---------------------------------------
    case 'astrohelmet': {
      const y = eyeY - R * 0.08;
      return `<circle cx="${cx}" cy="${y.toFixed(1)}" r="${(R*0.98).toFixed(1)}" fill="#CFEAF8" opacity="0.42" ${ink(3)}/>` +
             rrect(cx - R * 1.02, y + R * 0.62, R * 2.04, 12, 5, '#C9D2E0', ink(2.4)) +
             path(`M${cx-R*0.62} ${y-R*0.5} Q${cx-R*0.2} ${y-R*0.84} ${cx+R*0.16} ${y-R*0.7}`, 'none', `fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" opacity="0.85"`);
    }
    case 'astroboots': {
      const y = eyeY + R * .68;
      return [-.28, .28].map(side => {
        const x = cx + R * side;
        return rrect(x - 11, y, 22, 16, 6, '#E4E8F0', ink(2.4)) +
          rrect(x - 12, y + 15, 24, 8, 4, '#9AA4B8', ink(2.2)) +
          `<circle cx="${x}" cy="${y+7}" r="3.2" fill="${COLORS.seablue}"/>`;
      }).join('');
    }
    case 'piratehat': {
      const y = topY + 6;
      return path(`M${cx-R*0.86} ${y} Q${cx} ${topY-R*0.86} ${cx+R*0.86} ${y} Q${cx} ${y+R*0.18} ${cx-R*0.86} ${y} Z`, COLORS.ink, ink()) +
             `<circle cx="${cx}" cy="${(y-R*0.3).toFixed(1)}" r="5" fill="#fff"/>` +
             `<line x1="${(cx-5).toFixed(1)}" y1="${(y-R*0.3+7).toFixed(1)}" x2="${(cx+5).toFixed(1)}" y2="${(y-R*0.3+13).toFixed(1)}" stroke="#fff" stroke-width="2.4"/>` +
             `<line x1="${(cx+5).toFixed(1)}" y1="${(y-R*0.3+7).toFixed(1)}" x2="${(cx-5).toFixed(1)}" y2="${(y-R*0.3+13).toFixed(1)}" stroke="#fff" stroke-width="2.4"/>`;
    }
    case 'eyepatch':
      return path(`M${cx-R*0.9} ${eyeY-R*0.5} L${cx+R*0.72} ${eyeY-R*0.34}`, 'none', `fill="none" stroke="${INK}" stroke-width="3"`) +
             rrect(cx + R * 0.16, eyeY - R * 0.32, R * 0.56, R * 0.56, 7, COLORS.ink, ink(2.4));
    default:
      return '';
  }
}

// Lighten a hex colour toward cream for snouts/bellies.
function lighten(hex) {
  if (hex === HALO) return HALO;
  const h = hex.replace('#', '');
  if (h.length !== 6) return hex;
  const mix = (a) => Math.round(a + (255 - a) * 0.4);
  const r = mix(parseInt(h.slice(0, 2), 16));
  const g = mix(parseInt(h.slice(2, 4), 16));
  const b = mix(parseInt(h.slice(4, 6), 16));
  return `rgb(${r},${g},${b})`;
}

// ---- public: render a decoration ----------------------------------------

// RUN13 T4 — the wall clock's hands. Defaults to the DEVICE clock (no network, no state),
// and town.js passes an explicit hour/minute so its minute tick — and the test harness's
// __bootownHour — can drive it deterministically. A quiet nod to the Clock Shop: the same
// little-hand-hours, big-hand-minutes reading the child already learned there.
export function clockHands(hour, minute) {
  const now = (hour == null || minute == null) ? new Date() : null;
  const h = hour == null ? now.getHours() : hour;
  const m = minute == null ? now.getMinutes() : minute;
  const ha = ((h % 12) + m / 60) / 12 * Math.PI * 2 - Math.PI / 2;
  const ma = (m / 60) * Math.PI * 2 - Math.PI / 2;
  return `<line x1="60" y1="60" x2="${(60 + Math.cos(ha) * 13).toFixed(1)}" y2="${(60 + Math.sin(ha) * 13).toFixed(1)}" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>` +
         `<line x1="60" y1="60" x2="${(60 + Math.cos(ma) * 20).toFixed(1)}" y2="${(60 + Math.sin(ma) * 20).toFixed(1)}" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>`;
}

export function renderDeco(item, opts = {}) {
  const { size = 120, cls = '' } = opts;
  const ink = `stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"`;
  const halo = `stroke="${HALO}" stroke-width="10" stroke-linejoin="round"`;
  let inner = '';
  const fxCls = item.fx ? ` fx-${item.fx}` : '';
  switch (item.deco) {
    case 'boohouse':
      inner =
        `<path d="M24 112 L24 66 L60 36 L96 66 L96 112 Z" fill="${HALO}" ${halo}/>` +
        `<path d="M24 112 L24 66 L60 36 L96 66 L96 112 Z" fill="#F2D6B8" ${ink}/>` +
        `<path d="M18 68 L60 34 L102 68" fill="none" ${ink}/>` +
        `<path d="M46 112 L46 84 Q60 74 74 84 L74 112 Z" fill="${COLORS.bubblegum}" ${ink}/>` +
        `<circle cx="60" cy="62" r="9" fill="${COLORS.teal}" ${ink}/>`;
      break;
    case 'questflag':   // exclusive Boo Quest reward (RUN6 C6)
      inner =
        rrect(56, 26, 8, 88, 4, COLORS.cocoa, halo) +
        rrect(56, 26, 8, 88, 4, COLORS.cocoa, ink) +
        path('M64 30 L106 46 L64 62 Z', COLORS.pink, halo) +
        path('M64 30 L106 46 L64 62 Z', COLORS.pink, ink) +
        path(starPath(82, 46, 7, 3), COLORS.star, `stroke="${INK}" stroke-width="1.5"`);
      break;
    case 'tree':
      inner =
        rrect(54, 78, 12, 34, 5, COLORS.cocoa, halo) +
        rrect(54, 78, 12, 34, 5, COLORS.cocoa, ink) +
        ell(60, 56, 34, 30, COLORS.teal, halo) +
        ell(60, 56, 34, 30, COLORS.teal, ink) +
        `<circle cx="48" cy="50" r="6" fill="#fff" opacity="0.5"/><circle cx="70" cy="60" r="5" fill="#fff" opacity="0.45"/><circle cx="62" cy="44" r="4" fill="#fff" opacity="0.5"/>`;
      break;
    case 'toadstool':
      inner =
        rrect(52, 74, 16, 34, 7, COLORS.cream, halo) +
        rrect(52, 74, 16, 34, 7, COLORS.cream, ink) +
        path('M26 76 Q60 34 94 76 Z', COLORS.bubblegum, halo) +
        path('M26 76 Q60 34 94 76 Z', COLORS.bubblegum, ink) +
        `<circle cx="46" cy="62" r="5" fill="#fff"/><circle cx="66" cy="56" r="6" fill="#fff"/><circle cx="78" cy="66" r="4" fill="#fff"/>`;
      break;
    case 'pond':
      inner =
        ell(60, 88, 44, 22, COLORS.sky, halo) +
        ell(60, 88, 44, 22, COLORS.sky, ink) +
        `<path d="M40 84 Q50 80 60 84" fill="none" stroke="#fff" stroke-width="2.5" opacity="0.7"/>` +
        `<path d="M64 92 Q74 88 84 92" fill="none" stroke="#fff" stroke-width="2.5" opacity="0.7"/>` +
        ell(72, 86, 12, 6, COLORS.teal, ink);
      break;
    // ---- landscape items (RUN10 P3): Build-mode toybox scenery ----
    case 'palm':
      inner =
        path('M60 112 Q50 70 58 40', 'none', halo) +
        path('M60 112 Q50 70 58 40', COLORS.cocoa, `stroke="${COLORS.cocoa}" stroke-width="7" stroke-linecap="round" fill="none"`) +
        [[-1, -6], [-1, 20], [1, -6], [1, 20], [0, -32]].map(([dir, ang]) =>
          `<path d="M56 42 q ${dir * 30} ${ang < 0 ? -8 : 16} ${dir * 50} ${20 + Math.abs(ang)}" fill="none" stroke="${COLORS.teal}" stroke-width="8" stroke-linecap="round"/>`).join('') +
        `<circle cx="56" cy="42" r="6" fill="${COLORS.cocoa}" ${ink}/>`;
      break;
    case 'oak':
      inner =
        rrect(54, 82, 12, 30, 5, COLORS.cocoa, halo) +
        rrect(54, 82, 12, 30, 5, COLORS.cocoa, ink) +
        ell(60, 54, 40, 34, '#6FBF77', halo) +
        ell(60, 54, 40, 34, '#6FBF77', ink) +
        `<circle cx="44" cy="46" r="7" fill="#fff" opacity="0.45"/><circle cx="70" cy="58" r="6" fill="#fff" opacity="0.4"/><circle cx="60" cy="40" r="5" fill="#fff" opacity="0.45"/>`;
      break;
    case 'pine':
      inner =
        rrect(56, 96, 8, 16, 3, COLORS.cocoa, halo) +
        rrect(56, 96, 8, 16, 3, COLORS.cocoa, ink) +
        path('M60 24 L88 62 L74 62 L92 92 L28 92 L46 62 L32 62 Z', '#3E9A56', halo) +
        path('M60 24 L88 62 L74 62 L92 92 L28 92 L46 62 L32 62 Z', '#3E9A56', ink) +
        `<circle cx="50" cy="76" r="4" fill="#fff" opacity="0.4"/><circle cx="68" cy="54" r="3.5" fill="#fff" opacity="0.4"/>`;
      break;
    case 'bush':
      inner =
        ell(60, 92, 38, 20, '#5FB86E', halo) +
        ell(60, 92, 38, 20, '#5FB86E', ink) +
        ell(36, 78, 20, 18, '#6FC77E', ink) +
        ell(84, 78, 20, 18, '#6FC77E', ink) +
        ell(60, 68, 22, 20, '#6FC77E', ink) +
        `<circle cx="46" cy="86" r="4" fill="${COLORS.bubblegum}"/><circle cx="76" cy="90" r="4" fill="${COLORS.gold}"/>`;
      break;
    case 'rock':
      inner =
        path('M20 106 Q16 78 42 68 Q60 52 82 66 Q104 74 100 100 Q102 112 84 112 L30 112 Q18 112 20 106 Z', '#B8B0C8', halo) +
        path('M20 106 Q16 78 42 68 Q60 52 82 66 Q104 74 100 100 Q102 112 84 112 L30 112 Q18 112 20 106 Z', '#B8B0C8', ink) +
        `<path d="M40 76 Q56 68 66 76" fill="none" stroke="#8E86A0" stroke-width="3" opacity="0.6"/>` +
        `<path d="M50 92 Q68 86 84 94" fill="none" stroke="#8E86A0" stroke-width="3" opacity="0.6"/>` +
        `<ellipse cx="34" cy="100" rx="6" ry="3" fill="#7FC77E" opacity="0.8"/>`;
      break;
    case 'flowerbed':
      inner =
        rrect(18, 92, 84, 18, 6, COLORS.cocoa, halo) +
        rrect(18, 92, 84, 18, 6, COLORS.cocoa, ink) +
        [[30, 88, 'bubblegum'], [48, 84, 'gold'], [66, 88, 'lilac'], [84, 84, 'teal'], [96, 90, 'pink']]
          .map(([x, y, col]) => `<circle cx="${x}" cy="${y}" r="6" fill="${c(col)}" ${ink}/><circle cx="${x}" cy="${y}" r="2.5" fill="${COLORS.gold}"/>`).join('');
      break;
    case 'wishwell':
      inner =
        ell(60, 104, 47, 14, '#9AA3B6', halo) +
        ell(60, 104, 47, 14, '#9AA3B6', ink) +
        path('M18 72 L24 106 Q60 122 96 106 L102 72 Z', '#AEB7C8', halo) +
        path('M18 72 L24 106 Q60 122 96 106 L102 72 Z', '#AEB7C8', ink) +
        ell(60, 73, 43, 15, '#516A8B', ink) +
        `<path d="M25 70 V28 M95 70 V28" fill="none" ${ink}/>` +
        path('M14 34 Q60 4 106 34 L96 50 Q60 26 24 50 Z', COLORS.bubblegum, halo) +
        path('M14 34 Q60 4 106 34 L96 50 Q60 26 24 50 Z', COLORS.bubblegum, ink) +
        `<circle cx="60" cy="68" r="7" fill="${COLORS.gold}" opacity=".9"/><path d="M60 56v20" stroke="${COLORS.gold}" stroke-width="3"/>`;
      break;
    // RUN17 X1: the Joke Boo's little stage — a round plinth, a striped backdrop and a
    // microphone. Nobody is drawn on it; the Boo who tells the joke appears inside.
    case 'jokestage':
      inner =
        path('M22 40 Q60 16 98 40 L98 48 Q60 26 22 48 Z', COLORS.bubblegum, halo) +
        path('M22 40 Q60 16 98 40 L98 48 Q60 26 22 48 Z', COLORS.bubblegum, ink) +
        rrect(30, 46, 12, 44, 3, COLORS.cream, ink) +
        rrect(54, 46, 12, 44, 3, COLORS.cream, ink) +
        rrect(78, 46, 12, 44, 3, COLORS.cream, ink) +
        ell(60, 98, 44, 13, COLORS.lilac, halo) +
        ell(60, 98, 44, 13, COLORS.lilac, ink) +
        `<path d="M60 96 V64" fill="none" ${ink}/>` +
        ell(60, 58, 8, 10, COLORS.cocoa, halo) +
        ell(60, 58, 8, 10, COLORS.cocoa, ink) +
        `<circle cx="60" cy="56" r="3" fill="${COLORS.gold}"/>`;
      break;
    case 'lamp':
      inner =
        rrect(56, 60, 8, 52, 4, COLORS.cocoa, halo) +
        rrect(56, 60, 8, 52, 4, COLORS.cocoa, ink) +
        path('M44 60 Q60 30 76 60 Z', COLORS.gold, halo) +
        path('M44 60 Q60 30 76 60 Z', COLORS.gold, ink) +
        `<circle cx="60" cy="52" r="7" fill="#FFF3B0"/>`;
      break;
    case 'flowers':
      inner = [[38,90,'bubblegum'],[60,84,'gold'],[82,90,'lilac'],[50,98,'teal'],[72,98,'pink']]
        .map(([x,y,col]) => {
          let p = '';
          for (let i=0;i<5;i++){const a=i*72*Math.PI/180; p+=ell(x+7*Math.cos(a),y+7*Math.sin(a),4.5,4.5,c(col),ink);}
          return p + `<circle cx="${x}" cy="${y}" r="4" fill="${COLORS.gold}" ${ink}/>` +
                 `<rect x="${x-1.5}" y="${y}" width="3" height="18" fill="${COLORS.teal}"/>`;
        }).join('');
      break;
    case 'bench':
      inner =
        rrect(28, 84, 64, 12, 4, COLORS.cocoa, halo) +
        rrect(28, 84, 64, 12, 4, COLORS.cocoa, ink) +
        rrect(28, 62, 64, 12, 4, COLORS.cocoa, ink) +
        rrect(32, 96, 8, 18, 3, COLORS.cocoa, ink) +
        rrect(80, 96, 8, 18, 3, COLORS.cocoa, ink);
      break;
    case 'stage':
      inner =
        `<ellipse cx="60" cy="98" rx="50" ry="16" fill="${HALO}" ${halo}/>` +
        `<ellipse cx="60" cy="98" rx="50" ry="16" fill="${COLORS.midnight}" ${ink}/>` +
        `<ellipse cx="60" cy="94" rx="46" ry="13" fill="#6A5AD8" ${ink}/>` +
        `<path d="M60 94 L40 60 L52 60 Z" fill="${COLORS.gold}" opacity="0.5"/>` +
        `<path d="M60 94 L80 60 L68 60 Z" fill="${COLORS.pink}" opacity="0.5"/>` +
        `<circle cx="46" cy="90" r="4" fill="${COLORS.gold}"/><circle cx="74" cy="90" r="4" fill="${COLORS.teal}"/><circle cx="60" cy="96" r="4" fill="${COLORS.pink}"/>`;
      break;
    case 'sandcastle':
      inner =
        path('M30 112 L30 78 L38 78 L38 70 L46 70 L46 78 L74 78 L74 70 L82 70 L82 78 L90 78 L90 112 Z', COLORS.sand, halo) +
        path('M30 112 L30 78 L38 78 L38 70 L46 70 L46 78 L74 78 L74 70 L82 70 L82 78 L90 78 L90 112 Z', COLORS.sand, ink) +
        `<rect x="54" y="86" width="12" height="26" rx="3" fill="#E0B95E" ${ink}/>` +
        `<line x1="60" y1="70" x2="60" y2="54" stroke="${INK}" stroke-width="2.5"/><path d="M60 54 L74 60 L60 66 Z" fill="${COLORS.pop}" ${ink}/>` +
        `<circle cx="88" cy="106" r="5" fill="${COLORS.pink}" ${ink}/>`;
      break;
    case 'spookytree':
      inner =
        rrect(54, 74, 12, 40, 4, COLORS.coconut, halo) +
        rrect(54, 74, 12, 40, 4, COLORS.coconut, ink) +
        `<path d="M60 78 Q40 66 34 48 M60 74 Q80 64 88 46 M60 70 Q56 54 60 40 M60 84 Q44 80 36 70" fill="none" stroke="${COLORS.coconut}" stroke-width="5" stroke-linecap="round"/>` +
        `<path d="M60 78 Q40 66 34 48 M60 74 Q80 64 88 46 M60 70 Q56 54 60 40 M60 84 Q44 80 36 70" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>` +
        `<circle cx="56" cy="92" r="2.6" fill="#FFF3B0"/><circle cx="66" cy="96" r="2.6" fill="#FFF3B0"/>`;
      break;
    case 'snowboo':
      inner =
        ell(60, 96, 26, 20, HALO, halo) + ell(60, 96, 26, 20, '#EDEEF9', ink) +
        ell(60, 66, 20, 18, '#EDEEF9', halo) + ell(60, 66, 20, 18, '#EDEEF9', ink) +
        `<circle cx="53" cy="64" r="3" fill="${INK}"/><circle cx="67" cy="64" r="3" fill="${INK}"/>` +
        path('M60 70 L78 73 L60 76 Z', COLORS.orange, ink) +
        `<circle cx="54" cy="94" r="2.4" fill="${INK}"/><circle cx="60" cy="100" r="2.4" fill="${INK}"/><circle cx="66" cy="94" r="2.4" fill="${INK}"/>`;
      break;
    case 'fountain':
      inner =
        ell(60, 104, 40, 14, COLORS.sky, halo) + ell(60, 104, 40, 14, COLORS.sky, ink) +
        rrect(52, 74, 16, 30, 5, '#B8C6E8', ink) +
        ell(60, 74, 16, 6, COLORS.sky, ink) +
        path(starPath(60, 52, 8, 3.4), COLORS.star, `stroke="${INK}" stroke-width="1.5"`) +
        path(starPath(46, 64, 5, 2), COLORS.pink, '') + path(starPath(74, 62, 5, 2), COLORS.zing, '') +
        `<circle cx="60" cy="66" r="2.4" fill="#fff"/>`;
      break;
    case 'easel':
      // tripod easel with a blank canvas (the town overlays the chosen artwork on .easel-slot)
      inner =
        `<line x1="40" y1="118" x2="52" y2="60" ${ink}/>` +
        `<line x1="80" y1="118" x2="68" y2="60" ${ink}/>` +
        `<line x1="60" y1="120" x2="60" y2="70" ${ink}/>` +
        `<rect class="easel-slot" x="30" y="30" width="60" height="48" rx="4" fill="#FFF8F0" ${ink}/>` +
        `<rect x="34" y="34" width="52" height="40" rx="2" fill="#E9DEFF"/>` +
        `<rect x="34" y="72" width="52" height="8" rx="2" fill="${COLORS.cocoa}" ${ink}/>`;
      break;

    // ---- Activity items (RUN4 C5). Animated sub-parts carry classes the town
    // drives with transforms: .ss-plank, .bc-car, .cf-flame, .sw-seat. ----
    case 'slide':
      inner =
        `<path d="M34 44 L34 112" ${ink}/><path d="M46 44 L46 112" ${ink}/>` +   // ladder rails
        `<path d="M34 56 L46 56 M34 70 L46 70 M34 84 L46 84 M34 98 L46 98" ${ink}/>` +
        `<path d="M46 44 Q78 46 92 108 L78 112 Q68 62 42 56 Z" fill="${COLORS.pop}" ${halo}/>` +
        `<path d="M46 44 Q78 46 92 108 L78 112 Q68 62 42 56 Z" fill="${COLORS.pop}" ${ink}/>` +
        `<path d="M50 50 Q76 54 86 106" fill="none" stroke="#fff" stroke-width="3" opacity="0.55"/>` +
        rrect(28, 38, 24, 10, 5, COLORS.teal, ink);
      break;
    case 'swings':
      inner =
        `<path d="M22 116 L36 40 M98 116 L84 40" ${ink}/>` +                      // A-frame
        rrect(30, 34, 60, 10, 5, COLORS.teal, halo) + rrect(30, 34, 60, 10, 5, COLORS.teal, ink) +
        `<g class="sw-seat"><path d="M52 44 L52 88 M68 44 L68 88" stroke="${INK}" stroke-width="2.6"/>` +
        rrect(46, 88, 28, 8, 4, COLORS.star, ink) + `</g>`;
      break;
    // ---- Flash Boos props (RUN18B Y4) -------------------------------------------------
    // Hand props, not scenery: they are drawn at 0.55x a Boo and have to read as the thing
    // at arm's length on a tablet, so both are big simple silhouettes with one highlight.
    // These two are drawn with a HEAVIER outline than the scenery above: a hand prop is
    // rendered at ~56-70px against scenery's 120-160, and the house's 4-unit ink line
    // thins to under 2 real pixels there. Bold lines are what let a ball still read as a
    // ball at arm's length.
    case 'ball': {
      const bold = `stroke="${INK}" stroke-width="7" stroke-linejoin="round"`;
      inner =
        ell(60, 90, 28, 28, COLORS.cream, `stroke="${HALO}" stroke-width="12"`) +
        ell(60, 90, 28, 28, COLORS.cream, bold) +
        path('M60 62 Q44 90 60 118 Q76 90 60 62 Z', COLORS.bubblegum, '') +               // panels: endpoints on the rim
        path('M32 90 Q60 74 88 90 Q60 106 32 90 Z', COLORS.teal, '') +
        ell(60, 90, 28, 28, 'none', bold) +
        `<circle cx="48" cy="79" r="7" fill="#fff" opacity="0.65"/>`;
      break;
    }
    case 'balloon': {
      const bold = `stroke="${INK}" stroke-width="7" stroke-linejoin="round"`;
      inner =
        `<path d="M60 74 Q74 98 56 118" fill="none" stroke="${HALO}" stroke-width="11" stroke-linecap="round"/>` +
        `<path d="M60 74 Q74 98 56 118" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/>` +
        ell(60, 42, 30, 34, COLORS.bubblegum, `stroke="${HALO}" stroke-width="12"`) +     // string ends at hand height
        ell(60, 42, 30, 34, COLORS.bubblegum, bold) +
        path('M52 72 L68 72 L60 84 Z', COLORS.bubblegum, bold) +                          // knot
        `<ellipse cx="47" cy="30" rx="8" ry="12" fill="#fff" opacity="0.6" transform="rotate(-18 47 30)"/>`;
      break;
    }
    case 'seesaw':
      inner =
        path('M52 106 L60 88 L68 106 Z', COLORS.cocoa, halo) +
        path('M52 106 L60 88 L68 106 Z', COLORS.cocoa, ink) +
        `<g class="ss-plank" style="transform-origin:60px 90px">` +
        rrect(12, 84, 96, 10, 5, COLORS.zing, halo) + rrect(12, 84, 96, 10, 5, COLORS.zing, ink) +
        rrect(14, 76, 10, 8, 3, COLORS.pop, ink) + rrect(96, 76, 10, 8, 3, COLORS.pop, ink) + `</g>` +
        ell(60, 112, 34, 6, 'rgba(0,0,0,0.12)', '');
      break;
    case 'paddlepool':
      inner =
        ell(60, 96, 44, 20, '#7FC7E8', halo) + ell(60, 96, 44, 20, '#4FA3D8', ink) +
        `<g class="pp-water">` + ell(60, 94, 36, 14, '#8ED2F2', '') +
        `<path d="M34 92 Q44 88 54 92 T74 92 T92 90" fill="none" stroke="#fff" stroke-width="3" opacity="0.7" stroke-linecap="round"/>` + `</g>` +
        `<circle class="pp-drop d1" cx="40" cy="76" r="3" fill="#8ED2F2"/>` +
        `<circle class="pp-drop d2" cx="80" cy="72" r="2.6" fill="#8ED2F2"/>` +
        `<circle class="pp-drop d3" cx="62" cy="70" r="2.2" fill="#fff"/>`;
      break;
    case 'picnic':
      inner =
        `<path d="M14 96 L60 76 L106 96 L60 118 Z" fill="#F6C6D8" ${halo}/>` +
        `<path d="M14 96 L60 76 L106 96 L60 118 Z" fill="#F6C6D8" ${ink}/>` +
        `<path d="M32 89 L78 109 M46 83 L92 103 M88 88 L42 112 M74 82 L28 104" stroke="#fff" stroke-width="3" opacity="0.75"/>` +
        ell(60, 95, 12, 6, COLORS.cream, ink) +
        `<circle cx="54" cy="93" r="3" fill="${COLORS.pop}"/><circle cx="63" cy="95" r="3" fill="${COLORS.teal}"/><circle cx="58" cy="98" r="2.4" fill="${COLORS.star}"/>`;
      break;
    case 'trampoline':
      inner =
        `<path d="M28 96 L24 116 M92 96 L96 116 M46 100 L44 118 M74 100 L76 118" ${ink}/>` +
        ell(60, 94, 42, 13, HALO, halo) +
        ell(60, 94, 42, 13, '#6A5AD8', ink) +
        ell(60, 92, 34, 9, COLORS.midnight, ink) +
        `<path d="M30 92 Q60 84 90 92" fill="none" stroke="#8F7FF0" stroke-width="3" opacity="0.8"/>`;
      break;
    case 'bumper':
      inner =
        ell(60, 114, 40, 7, 'rgba(0,0,0,0.14)', '') +
        `<g class="bc-car">` +
        `<path d="M28 100 Q28 82 46 82 L74 82 Q92 82 92 100 L92 106 Q92 110 88 110 L32 110 Q28 110 28 106 Z" fill="${COLORS.pop}" ${halo}/>` +
        `<path d="M28 100 Q28 82 46 82 L74 82 Q92 82 92 100 L92 106 Q92 110 88 110 L32 110 Q28 110 28 106 Z" fill="${COLORS.pop}" ${ink}/>` +
        `<path d="M40 82 Q44 70 56 70 L64 70 Q76 70 80 82 Z" fill="#8ED2F2" ${ink}/>` +
        `<circle cx="42" cy="110" r="8" fill="${COLORS.midnight}" ${ink}/><circle cx="78" cy="110" r="8" fill="${COLORS.midnight}" ${ink}/>` +
        `<circle cx="42" cy="110" r="3" fill="#fff"/><circle cx="78" cy="110" r="3" fill="#fff"/>` +
        `<line x1="60" y1="64" x2="60" y2="52" stroke="${INK}" stroke-width="2.5"/><circle cx="60" cy="50" r="4" fill="${COLORS.star}" ${ink}/>` +
        `</g>`;
      break;
    case 'campfire':
      inner =
        `<path d="M36 106 L84 96 M36 96 L84 106" stroke="${COLORS.cocoa}" stroke-width="9" stroke-linecap="round"/>` +
        `<path d="M36 106 L84 96 M36 96 L84 106" stroke="${INK}" stroke-width="3" stroke-linecap="round" fill="none" opacity="0.4"/>` +
        `<g class="cf-flame" style="transform-origin:60px 96px">` +
        path('M60 52 Q74 70 70 84 Q68 94 60 96 Q52 94 50 84 Q46 70 60 52 Z', COLORS.orange, ink) +
        path('M60 66 Q68 76 65 86 Q63 92 60 93 Q57 92 55 86 Q52 76 60 66 Z', COLORS.star, '') +
        `</g>` +
        `<circle class="cf-spark s1" cx="52" cy="46" r="2.2" fill="${COLORS.star}"/>` +
        `<circle class="cf-spark s2" cx="70" cy="40" r="1.8" fill="${COLORS.orange}"/>`;
      break;
    // ---- furniture (RUN10 P4): the Boo House's indoor toybox ----
    case 'bed':
      inner =
        rrect(20, 78, 80, 30, 8, COLORS.cocoa, halo) +
        rrect(20, 78, 80, 30, 8, COLORS.cocoa, ink) +
        rrect(26, 66, 24, 20, 6, COLORS.cream, halo) +
        rrect(26, 66, 24, 20, 6, COLORS.cream, ink) +
        rrect(50, 82, 46, 20, 6, COLORS.bubblegum, halo) +
        rrect(50, 82, 46, 20, 6, COLORS.bubblegum, ink);
      break;
    case 'rug':
      inner =
        ell(60, 100, 46, 16, COLORS.teal, halo) +
        ell(60, 100, 46, 16, COLORS.teal, ink) +
        ell(60, 100, 30, 10, COLORS.cream, ink) +
        ell(60, 100, 14, 5, COLORS.bubblegum, ink);
      break;
    case 'table':
      inner =
        ell(60, 62, 34, 10, COLORS.cocoa, halo) +
        ell(60, 62, 34, 10, COLORS.cocoa, ink) +
        rrect(30, 66, 6, 36, 3, COLORS.cocoa, ink) +
        rrect(84, 66, 6, 36, 3, COLORS.cocoa, ink) +
        ell(60, 60, 30, 8, '#A9744F', ink);
      break;
    case 'sofa':
      inner =
        rrect(16, 60, 88, 24, 12, COLORS.bubblegum, halo) +
        rrect(16, 60, 88, 24, 12, COLORS.bubblegum, ink) +
        rrect(20, 80, 80, 26, 10, COLORS.pink, halo) +
        rrect(20, 80, 80, 26, 10, COLORS.pink, ink) +
        ell(38, 74, 12, 10, '#FF97D0', ink) + ell(60, 74, 12, 10, '#FF97D0', ink) + ell(82, 74, 12, 10, '#FF97D0', ink) +
        rrect(12, 78, 10, 26, 5, COLORS.bubblegum, ink) + rrect(98, 78, 10, 26, 5, COLORS.bubblegum, ink);
      break;
    // .lamp-glow: dim by day, boosted by CSS when the wrap carries .lit (town.js sets it
    // 21:00-07:00 via __bootownHour, same pattern as growth.js's fairy lights).
    case 'tablelamp':
      inner =
        rrect(52, 96, 16, 8, 3, COLORS.cocoa, ink) +
        rrect(58, 60, 4, 38, 2, COLORS.cocoa, ink) +
        `<g class="lamp-glow">` +
        path('M40 62 Q60 34 80 62 Z', COLORS.gold, halo) +
        path('M40 62 Q60 34 80 62 Z', COLORS.gold, ink) +
        `<circle cx="60" cy="54" r="8" fill="#FFF3B0"/>` +
        `</g>`;
      break;
    case 'wardrobe':
      inner =
        rrect(30, 30, 60, 82, 8, COLORS.cocoa, halo) +
        rrect(30, 30, 60, 82, 8, COLORS.cocoa, ink) +
        `<line x1="60" y1="34" x2="60" y2="108" stroke="${INK}" stroke-width="3"/>` +
        `<circle cx="54" cy="70" r="2.5" fill="${COLORS.gold}"/><circle cx="66" cy="70" r="2.5" fill="${COLORS.gold}"/>`;
      break;
    case 'bathtub':
      inner =
        path('M20 70 Q20 100 50 100 L84 100 Q100 100 100 82 L100 70 Z', COLORS.sky, halo) +
        path('M20 70 Q20 100 50 100 L84 100 Q100 100 100 82 L100 70 Z', COLORS.sky, ink) +
        ell(60, 68, 42, 10, '#fff', ink) +
        `<circle cx="46" cy="60" r="5" fill="#fff" opacity="0.85"/><circle cx="60" cy="54" r="4" fill="#fff" opacity="0.8"/><circle cx="72" cy="60" r="5" fill="#fff" opacity="0.85"/>`;
      break;
    case 'bookshelf':
      inner =
        rrect(18, 22, 84, 86, 6, COLORS.cocoa, halo) +
        rrect(18, 22, 84, 86, 6, COLORS.cocoa, ink) +
        `<line x1="18" y1="64" x2="102" y2="64" stroke="${INK}" stroke-width="3"/>` +
        [26, 40, 54, 68, 82].map((x, i) => rrect(x, 30, 10, 30, 2, c(['bubblegum', 'teal', 'gold', 'lilac', 'pink'][i % 5]), ink)).join('') +
        [26, 44, 62, 80].map((x, i) => rrect(x, 72, 14, 30, 2, c(['teal', 'bubblegum', 'pink', 'gold'][i % 4]), ink)).join('');
      break;
    case 'bffportrait':
      inner =
        rrect(22, 18, 76, 96, 8, COLORS.gold, halo) +
        rrect(22, 18, 76, 96, 8, COLORS.gold, ink) +
        rrect(30, 26, 60, 80, 5, COLORS.cream, ink) +
        path('M60 86 C42 72 35 59 35 48 C35 35 51 32 60 44 C69 32 85 35 85 48 C85 59 78 72 60 86 Z', COLORS.bubblegum, ink);
      break;
    // ---- furniture and decor expansion (RUN13 T4) ------------------------------------
    // Same construction as everything above: halo pass, then ink pass, then details.
    // `.lamp-glow` on a lamp gets boosted by CSS when town.js adds `.lit` at night;
    // `.clock-hands` is redrawn from the device clock by town.js's minute tick.
    case 'armchair':
      inner =
        rrect(26, 58, 68, 26, 12, COLORS.lilac, halo) +
        rrect(26, 58, 68, 26, 12, COLORS.lilac, ink) +
        rrect(28, 80, 64, 26, 10, COLORS.bubblegum, halo) +
        rrect(28, 80, 64, 26, 10, COLORS.bubblegum, ink) +
        ell(60, 74, 16, 11, '#FF97D0', ink) +
        rrect(20, 78, 11, 26, 5, COLORS.lilac, ink) + rrect(89, 78, 11, 26, 5, COLORS.lilac, ink);
      break;
    case 'rug2':
      inner =
        ell(60, 100, 48, 17, COLORS.sand, halo) +
        ell(60, 100, 48, 17, COLORS.sand, ink) +
        ell(60, 100, 34, 12, COLORS.orange, ink) +
        ell(60, 100, 20, 7, COLORS.cream, ink) +
        ell(60, 100, 8, 3, COLORS.orange, '');
      break;
    case 'rug3':
      inner =
        ell(60, 100, 48, 17, COLORS.midnight, halo) +
        ell(60, 100, 48, 17, COLORS.midnight, ink) +
        [[42, 96], [60, 92], [78, 97], [50, 105], [70, 104]]
          .map(([x, y], i) => path(starPath(x, y, i % 2 ? 4 : 5.5, 2.4), COLORS.star, '')).join('');
      break;
    case 'bookshelf2':
      inner =
        rrect(16, 54, 88, 54, 6, COLORS.cocoa, halo) +
        rrect(16, 54, 88, 54, 6, COLORS.cocoa, ink) +
        `<line x1="16" y1="82" x2="104" y2="82" stroke="${INK}" stroke-width="3"/>` +
        [24, 38, 52, 66, 80].map((x, i) => rrect(x, 60, 11, 20, 2, c(['teal', 'gold', 'bubblegum', 'lilac', 'pink'][i % 5]), ink)).join('') +
        [24, 42, 60, 78].map((x, i) => rrect(x, 88, 14, 18, 2, c(['pink', 'teal', 'gold', 'bubblegum'][i % 4]), ink)).join('');
      break;
    case 'bookshelf3':
      inner =
        path('M20 20 L20 110 L100 110', 'none', `${halo} fill="none"`) +
        rrect(20, 20, 14, 92, 4, COLORS.cocoa, halo) +
        rrect(20, 20, 14, 92, 4, COLORS.cocoa, ink) +
        [34, 60, 86].map((y, i) => rrect(34, y, 62, 8, 3, COLORS.cocoa, ink) +
          [40, 56, 72].map((x, j) => rrect(x, y - 18, 10, 18, 2, c(['gold', 'teal', 'bubblegum', 'lilac'][(i + j) % 4]), ink)).join('')).join('');
      break;
    case 'toybox':
      inner =
        rrect(24, 66, 72, 42, 8, COLORS.teal, halo) +
        rrect(24, 66, 72, 42, 8, COLORS.teal, ink) +
        rrect(20, 54, 80, 16, 6, COLORS.aqua, halo) +
        rrect(20, 54, 80, 16, 6, COLORS.aqua, ink) +
        ell(60, 62, 7, 4, COLORS.gold, ink) +
        path(starPath(38, 88, 8, 3.5), COLORS.gold, '') +
        ell(80, 88, 9, 9, COLORS.bubblegum, ink);
      break;
    case 'photoframe':
      // The picture itself is injected by town.js (renderPhotoFrame) — this is the frame.
      inner =
        rrect(24, 26, 72, 84, 8, COLORS.cocoa, halo) +
        rrect(24, 26, 72, 84, 8, COLORS.cocoa, ink) +
        rrect(32, 34, 56, 68, 5, COLORS.cream, ink);
      break;
    case 'kitchentable':
      inner =
        rrect(16, 56, 88, 12, 5, COLORS.sand, halo) +
        rrect(16, 56, 88, 12, 5, COLORS.sand, ink) +
        rrect(24, 68, 7, 38, 3, COLORS.cocoa, ink) +
        rrect(89, 68, 7, 38, 3, COLORS.cocoa, ink) +
        ell(48, 54, 9, 4, COLORS.cream, ink) + ell(74, 54, 7, 3, COLORS.teal, ink);
      break;
    case 'counter':
      inner =
        rrect(14, 62, 92, 46, 6, COLORS.cream, halo) +
        rrect(14, 62, 92, 46, 6, COLORS.cream, ink) +
        rrect(12, 54, 96, 12, 5, COLORS.sand, halo) +
        rrect(12, 54, 96, 12, 5, COLORS.sand, ink) +
        `<line x1="60" y1="66" x2="60" y2="108" stroke="${INK}" stroke-width="3"/>` +
        ell(48, 84, 3.5, 3.5, COLORS.gold, '') + ell(72, 84, 3.5, 3.5, COLORS.gold, '');
      break;
    case 'stool':
      inner =
        ell(60, 78, 26, 9, COLORS.bubblegum, halo) +
        ell(60, 78, 26, 9, COLORS.bubblegum, ink) +
        rrect(40, 82, 6, 26, 3, COLORS.cocoa, ink) +
        rrect(74, 82, 6, 26, 3, COLORS.cocoa, ink) +
        rrect(57, 82, 6, 26, 3, COLORS.cocoa, ink);
      break;
    case 'fridge':
      inner =
        rrect(32, 24, 56, 86, 8, COLORS.iceblue, halo) +
        rrect(32, 24, 56, 86, 8, COLORS.iceblue, ink) +
        `<line x1="32" y1="56" x2="88" y2="56" stroke="${INK}" stroke-width="3"/>` +
        rrect(78, 34, 5, 16, 2, COLORS.ink, '') + rrect(78, 64, 5, 20, 2, COLORS.ink, '') +
        path(starPath(52, 42, 6, 2.6), COLORS.gold, '') +
        ell(60, 84, 8, 8, COLORS.bubblegum, ink);
      break;
    case 'oven':
      inner =
        rrect(28, 44, 64, 66, 8, COLORS.ghost, halo) +
        rrect(28, 44, 64, 66, 8, COLORS.ghost, ink) +
        rrect(36, 68, 48, 32, 5, COLORS.midnight, ink) +
        rrect(40, 74, 40, 20, 3, COLORS.orange, '') +
        ell(42, 56, 4, 4, COLORS.red, ink) + ell(56, 56, 4, 4, COLORS.teal, ink) + ell(70, 56, 4, 4, COLORS.gold, ink);
      break;
    case 'bunkbed':
      inner =
        rrect(18, 26, 84, 12, 5, COLORS.cocoa, halo) +
        rrect(18, 26, 84, 12, 5, COLORS.cocoa, ink) +
        rrect(24, 38, 20, 10, 4, COLORS.cream, ink) +
        rrect(46, 30, 52, 8, 4, COLORS.teal, ink) +
        rrect(18, 74, 84, 12, 5, COLORS.cocoa, halo) +
        rrect(18, 74, 84, 12, 5, COLORS.cocoa, ink) +
        rrect(24, 86, 20, 10, 4, COLORS.cream, ink) +
        rrect(46, 78, 52, 8, 4, COLORS.bubblegum, ink) +
        rrect(16, 24, 7, 86, 3, COLORS.cocoa, ink) + rrect(97, 24, 7, 86, 3, COLORS.cocoa, ink) +
        [46, 58, 70].map(y => `<line x1="98" y1="${y}" x2="112" y2="${y}" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`).join('');
      break;
    case 'wardrobe2':
      inner =
        rrect(30, 28, 60, 82, 8, COLORS.lilac, halo) +
        rrect(30, 28, 60, 82, 8, COLORS.lilac, ink) +
        `<line x1="60" y1="32" x2="60" y2="106" stroke="${INK}" stroke-width="3"/>` +
        ell(45, 52, 6, 6, COLORS.bubblegum, ink) + ell(75, 52, 6, 6, COLORS.gold, ink) +
        ell(45, 82, 6, 6, COLORS.teal, ink) + ell(75, 82, 6, 6, COLORS.bubblegum, ink) +
        `<circle cx="55" cy="68" r="2.5" fill="${INK}"/><circle cx="65" cy="68" r="2.5" fill="${INK}"/>`;
      break;
    case 'lamp2':
      inner =
        rrect(54, 92, 12, 12, 3, COLORS.cocoa, ink) +
        rrect(58, 56, 4, 38, 2, COLORS.cocoa, ink) +
        `<g class="lamp-glow">` +
        ell(60, 44, 24, 22, COLORS.cream, halo) +
        ell(60, 44, 24, 22, COLORS.cream, ink) +
        `<line x1="36" y1="44" x2="84" y2="44" stroke="${INK}" stroke-width="2"/>` +
        `<circle cx="60" cy="44" r="9" fill="#FFF3B0"/>` +
        `</g>`;
      break;
    case 'floorlamp':
      inner =
        ell(60, 108, 20, 6, COLORS.cocoa, halo) +
        ell(60, 108, 20, 6, COLORS.cocoa, ink) +
        path('M60 106 L60 42 Q60 30 74 30', 'none', `fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"`) +
        `<g class="lamp-glow">` +
        path('M60 28 L90 28 L82 50 L68 50 Z', COLORS.gold, halo) +
        path('M60 28 L90 28 L82 50 L68 50 Z', COLORS.gold, ink) +
        `<circle cx="75" cy="44" r="7" fill="#FFF3B0"/>` +
        `</g>`;
      break;
    case 'plant1':
      inner =
        path('M44 96 L76 96 L72 114 L48 114 Z', COLORS.orange, halo) +
        path('M44 96 L76 96 L72 114 L48 114 Z', COLORS.orange, ink) +
        ell(60, 78, 15, 19, COLORS.teal, halo) +
        ell(60, 78, 15, 19, COLORS.teal, ink) +
        ell(46, 86, 10, 12, COLORS.aqua, ink) + ell(74, 86, 10, 12, COLORS.aqua, ink);
      break;
    case 'plant2':
      inner =
        path('M46 98 L74 98 L70 116 L50 116 Z', COLORS.cocoa, halo) +
        path('M46 98 L74 98 L70 116 L50 116 Z', COLORS.cocoa, ink) +
        `<line x1="60" y1="98" x2="60" y2="44" stroke="${INK}" stroke-width="4"/>` +
        [[60, 44, 0], [42, 58, -35], [78, 60, 35], [46, 76, -25], [76, 78, 25]]
          .map(([x, y, r]) => `<g transform="rotate(${r} ${x} ${y})">` +
               ell(x, y, 9, 17, COLORS.teal, halo) + ell(x, y, 9, 17, COLORS.teal, ink) + `</g>`).join('');
      break;
    case 'plant3':
      inner =
        rrect(46, 22, 28, 16, 5, COLORS.sand, halo) +
        rrect(46, 22, 28, 16, 5, COLORS.sand, ink) +
        [[54, 38], [60, 38], [66, 38]].map(([x, y], i) =>
          path(`M${x} ${y} Q${x - 10 + i * 8} ${y + 30} ${x - 4 + i * 5} ${y + 62}`, 'none',
               `fill="none" stroke="${INK}" stroke-width="3"`) +
          [0, 1, 2, 3].map(k => ell(x - 6 + i * 5 + (k % 2 ? 7 : -5), y + 16 + k * 14, 6, 4.5, COLORS.teal, ink)).join('')
        ).join('');
      break;
    case 'wallclock':
      inner =
        ell(60, 60, 34, 34, COLORS.cream, halo) +
        ell(60, 60, 34, 34, COLORS.cream, ink) +
        ell(60, 60, 27, 27, '#fff', `stroke="${INK}" stroke-width="2"`) +
        [0, 3, 6, 9].map(h => { const a = (h / 12) * Math.PI * 2 - Math.PI / 2;
          return `<circle cx="${(60 + Math.cos(a) * 20).toFixed(1)}" cy="${(60 + Math.sin(a) * 20).toFixed(1)}" r="2" fill="${INK}"/>`; }).join('') +
        `<g class="clock-hands">${clockHands(opts.clockHour, opts.clockMinute)}</g>` +
        `<circle cx="60" cy="60" r="3.5" fill="${INK}"/>`;
      break;
    // ---- RUN15 V4: the authored shop stock ------------------------------------------
    case 'lamppost':
      inner =
        rrect(54, 40, 12, 74, 5, COLORS.ink, halo) +
        rrect(54, 40, 12, 74, 5, COLORS.ink, ink) +
        ell(60, 112, 20, 6, COLORS.ink, ink) +
        path('M42 40 Q60 18 78 40 Z', COLORS.gold, halo) +
        path('M42 40 Q60 18 78 40 Z', COLORS.gold, ink) +
        ell(60, 36, 9, 9, COLORS.cream, '') +
        `<g class="lamp-glow">${ell(60, 36, 20, 20, COLORS.gold, '')}</g>`;
      break;
    case 'signpost':
      inner =
        rrect(56, 44, 8, 70, 4, COLORS.cocoa, halo) +
        rrect(56, 44, 8, 70, 4, COLORS.cocoa, ink) +
        path('M56 50 L92 50 L100 58 L92 66 L56 66 Z', COLORS.teal, ink) +
        path('M64 72 L28 72 L20 80 L28 88 L64 88 Z', COLORS.bubblegum, ink) +
        path('M56 94 L88 94 L96 102 L88 110 L56 110 Z', COLORS.gold, ink) +
        ell(60, 116, 18, 5, COLORS.ink, ink);
      break;
    case 'sandpit':
      inner =
        ell(60, 92, 46, 22, COLORS.sand || '#F2DDA6', halo) +
        ell(60, 92, 46, 22, COLORS.sand || '#F2DDA6', ink) +
        ell(60, 90, 36, 15, '#E4C583', '') +
        path('M38 84 L50 84 L47 96 L41 96 Z', COLORS.bubblegum, ink) +
        path('M70 96 L84 74 L88 78 L76 98 Z', COLORS.gold, ink) +
        ell(58, 80, 4, 3, '#D9BE7E', '') + ell(66, 86, 3, 2, '#D9BE7E', '');
      break;
    case 'climbframe':
      inner =
        path('M24 112 L38 44 M96 112 L82 44', 'none', `fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"`) +
        path('M38 44 L82 44', 'none', `fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"`) +
        [58, 72, 86, 100].map((y, i) => path(`M${30 - i * 0 + (i * 1.6)} ${y} L${90 - i * 1.6} ${y}`, 'none',
          `fill="none" stroke="${[COLORS.bubblegum, COLORS.teal, COLORS.gold, COLORS.lilac][i]}" stroke-width="6" stroke-linecap="round"`)).join('') +
        ell(38, 40, 6, 6, COLORS.gold, ink) + ell(82, 40, 6, 6, COLORS.bubblegum, ink);
      break;
    case 'roundabout':
      inner =
        ell(60, 96, 48, 16, COLORS.ink, halo) +
        ell(60, 92, 48, 16, COLORS.teal, ink) +
        ell(60, 88, 40, 12, COLORS.aqua, '') +
        [0, 60, 120, 180, 240, 300].map(a => {
          const r = a * Math.PI / 180;
          return path(`M60 88 L${(60 + Math.cos(r) * 38).toFixed(1)} ${(88 + Math.sin(r) * 11).toFixed(1)}`, 'none',
            `fill="none" stroke="${INK}" stroke-width="3"`);
        }).join('') +
        rrect(55, 52, 10, 38, 5, COLORS.ink, ink) +
        ell(60, 50, 10, 10, COLORS.gold, ink) +
        ell(26, 86, 8, 6, COLORS.bubblegum, ink) + ell(94, 86, 8, 6, COLORS.lilac, ink);
      break;
    case 'projectorlamp':
      inner =
        ell(60, 110, 24, 8, COLORS.ink, ink) +
        rrect(52, 66, 16, 44, 6, COLORS.lilac, halo) +
        rrect(52, 66, 16, 44, 6, COLORS.lilac, ink) +
        ell(60, 58, 22, 20, COLORS.ink, halo) +
        ell(60, 58, 22, 20, COLORS.ink, ink) +
        ell(60, 54, 13, 11, COLORS.gold, '') +
        `<g class="lamp-glow">` +
        [[24, 24], [92, 20], [40, 12], [78, 34], [60, 8]].map(([x, y]) =>
          path(`M${x} ${y - 5} L${x + 2} ${y - 1} L${x + 6} ${y} L${x + 2} ${y + 2} L${x} ${y + 6} L${x - 2} ${y + 2} L${x - 6} ${y} L${x - 2} ${y - 1} Z`, COLORS.gold, '')).join('') +
        `</g>`;
      break;
    case 'grandbookshelf':
      inner =
        rrect(14, 18, 92, 96, 6, COLORS.cocoa, halo) +
        rrect(14, 18, 92, 96, 6, COLORS.cocoa, ink) +
        [30, 54, 78].map(y => rrect(18, y, 84, 4, 2, '#7A5240', '')).join('') +
        [[22, 22], [46, 22], [70, 22], [22, 58], [46, 58], [70, 58], [22, 82], [46, 82], [70, 82]].map(([x, y], i) =>
          rrect(x, y, 7, i % 3 === 1 ? 26 : 22, 2, [COLORS.bubblegum, COLORS.teal, COLORS.gold, COLORS.lilac, COLORS.aqua][i % 5], '')).join('') +
        path('M92 26 L102 26 L102 106 L92 106', 'none', `fill="none" stroke="${INK}" stroke-width="4"`) +
        [40, 58, 76, 94].map(y => path(`M92 ${y} L102 ${y}`, 'none', `fill="none" stroke="${INK}" stroke-width="3"`)).join('');
      break;
    case 'telescope':
      inner =
        path('M40 112 L60 76 L80 112', 'none', `fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"`) +
        path('M60 112 L60 84', 'none', `fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"`) +
        `<g transform="rotate(-28 60 74)">` +
        rrect(28, 62, 66, 22, 11, COLORS.teal, halo) +
        rrect(28, 62, 66, 22, 11, COLORS.teal, ink) +
        rrect(86, 58, 18, 30, 8, COLORS.aqua, ink) +
        ell(30, 73, 6, 9, COLORS.gold, ink) +
        `</g>` +
        ell(96, 30, 3, 3, COLORS.gold, '') + ell(84, 18, 2.5, 2.5, COLORS.cream, '');
      break;
    case 'mirror':
      inner =
        ell(60, 62, 32, 40, COLORS.gold, halo) +
        ell(60, 62, 32, 40, COLORS.gold, ink) +
        ell(60, 62, 25, 33, COLORS.iceblue, ink) +
        path('M46 44 Q54 52 50 66', 'none', `fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"`);
      break;
    case 'wallart1':
      inner =
        rrect(24, 30, 72, 66, 6, COLORS.cocoa, halo) +
        rrect(24, 30, 72, 66, 6, COLORS.cocoa, ink) +
        rrect(31, 37, 58, 52, 4, COLORS.sky, '') +
        ell(72, 52, 10, 10, COLORS.gold, '') +
        path('M31 78 L48 60 L62 74 L74 64 L89 78 L89 89 L31 89 Z', COLORS.teal, '');
      break;
    case 'wallart2':
      inner =
        rrect(24, 30, 72, 66, 6, COLORS.ink, halo) +
        rrect(24, 30, 72, 66, 6, COLORS.ink, ink) +
        rrect(31, 37, 58, 52, 4, COLORS.iceblue, '') +
        path('M31 89 L52 46 L68 72 L78 58 L89 89 Z', COLORS.lilac, '') +
        path('M52 46 L60 60 L44 60 Z', '#fff', '');
      break;
    case 'wallart3':
      inner =
        rrect(24, 30, 72, 66, 6, COLORS.bubblegum, halo) +
        rrect(24, 30, 72, 66, 6, COLORS.bubblegum, ink) +
        rrect(31, 37, 58, 52, 4, COLORS.cream, '') +
        path('M36 78 Q48 40 60 64 Q72 88 84 46', 'none', `fill="none" stroke="${COLORS.teal}" stroke-width="6" stroke-linecap="round"`) +
        ell(50, 52, 6, 6, COLORS.gold, '') + ell(74, 74, 5, 5, COLORS.bubblegum, '');
      break;
    default:
      inner = ell(60, 80, 30, 26, COLORS.lilac, ink);
  }
  return `<svg viewBox="0 0 120 130" width="${size}" height="${size*130/120}" class="deco-svg${fxCls} ${cls}" role="img" aria-label="${escapeHTML(item.name)}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
}

// ---- public: render an accessory item standalone -------------------------
// Draws the wearable centred on its own, for reveal cards and the wardrobe.
export function renderAccessory(item, { size = 120, cls = '' } = {}) {
  const fxCls = item.fx ? ` fx-${item.fx}` : '';
  const art = accessoryArt(item.art, { cx: 60, topY: 58, eyeY: 66, earY: 64, R: 40 });
  return `<svg viewBox="0 0 120 120" width="${size}" height="${size}" class="acc-svg${fxCls} ${cls}" role="img" aria-label="${escapeHTML(item.name)}" xmlns="http://www.w3.org/2000/svg">` +
    `<circle cx="60" cy="60" r="52" fill="rgba(255,255,255,0.06)"/>` + art + `</svg>`;
}

// A granted wish, as a house-style medallion. RUN10 P20 drew a raw emoji glyph here as
// `<text font-size="48">` — the same one for all sixty words — which is emoji-as-art in a
// game scene, against CLAUDE.md's architecture contract, and it became permanent the moment
// RUN18B Y3 started leaving the thing in her town. Dispatch's decision (2026-07-28): the
// medallion is identical for every word, so ONE house-style asset clears the law, not sixty.
// The word itself is what tells her which wish this is, and it always did.
// (A separate future packet may give the sixty words their own art; that is not this.)
// ---- RUN21B item 1: sixty standalone wish artworks -------------------------------
// Every wish used to render the SAME captioned gold star medallion (RUN18B Y3 made it
// one house asset rather than sixty emoji, which cleared the emoji-as-art law but left
// a child unable to tell a cake from a duck in her own town). These are the real
// objects, drawn to the deco convention: shared 0 0 120 130 viewBox, ground line y=120,
// cream halo pass (stroke 10) under an ink pass (stroke 4), flat fills, palette only.
// The caption still sits beneath at its existing size, and the classes are unchanged
// (wish-svg wish-<word>) because every wishlife behaviour binds to them.
export const WISH_ART = {
  sun: `<circle cx="60" cy="64" r="25" fill="${HALO}" stroke="${HALO}" stroke-width="10"/><path d="M87 64H101 M79 83L89 93 M60 91V105 M41 83L31 93 M33 64H19 M41 45L31 35 M60 37V23 M79 45L89 35" fill="none" stroke="${HALO}" stroke-width="22" stroke-linecap="round"/><path d="M87 64H101 M79 83L89 93 M60 91V105 M41 83L31 93 M33 64H19 M41 45L31 35 M60 37V23 M79 45L89 35" fill="none" stroke="${INK}" stroke-width="16" stroke-linecap="round"/><path d="M87 64H101 M79 83L89 93 M60 91V105 M41 83L31 93 M33 64H19 M41 45L31 35 M60 37V23 M79 45L89 35" fill="none" stroke="${COLORS.gold}" stroke-width="10" stroke-linecap="round"/><circle cx="60" cy="64" r="25" fill="${COLORS.gold}" stroke="${INK}" stroke-width="4"/><circle cx="51" cy="55" r="7" fill="${HALO}" opacity="0.45"/>`,
  star: `<path d="M60 22L71 47L98 50L77 68L84 94L60 80L36 94L43 68L22 50L49 47Z" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/><path d="M60 22L71 47L98 50L77 68L84 94L60 80L36 94L43 68L22 50L49 47Z" fill="${COLORS.gold}" stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/><path d="M99 20Q102 27 109 30Q102 33 99 40Q96 33 89 30Q96 27 99 20Z" fill="${COLORS.sunshine}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`,
  moon: `<path d="M90 30A41 41 0 1 0 90 102Q54 66 90 30Z" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/><path d="M90 30A41 41 0 1 0 90 102Q54 66 90 30Z" fill="${COLORS.sunshine}" stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/><circle cx="40" cy="73" r="5" fill="${COLORS.pink}" opacity="0.45"/><circle cx="66" cy="73" r="5" fill="${COLORS.pink}" opacity="0.45"/><path d="M36 62Q42 70 48 62M54 62Q60 70 66 62" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><path d="M44 84Q52 91 60 84" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>`,
  cloud: `<path d="M24 100Q12 98 12 86Q12 66 30 64Q32 42 52 42Q72 42 64 70Q70 77 76 66Q82 46 96 52Q110 58 108 76Q108 96 94 100Q60 106 24 100Z" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/><path d="M24 100Q12 98 12 86Q12 66 30 64Q32 42 52 42Q72 42 64 70Q70 77 76 66Q82 46 96 52Q110 58 108 76Q108 96 94 100Q60 106 24 100Z" fill="${HALO}" stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/><ellipse cx="60" cy="95" rx="27" ry="4" fill="${COLORS.ghost}"/>`,
  rainbow: `<path d="M6 106A54 54 0 0 1 114 106L74 106A14 14 0 0 0 46 106Z" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/><path d="M13 106A47 47 0 0 1 107 106" fill="none" stroke="${COLORS.pink}" stroke-width="14"/><path d="M26 106A34 34 0 0 1 94 106" fill="none" stroke="${COLORS.gold}" stroke-width="12"/><path d="M39 106A21 21 0 0 1 81 106" fill="none" stroke="${COLORS.teal}" stroke-width="14"/><path d="M6 106A54 54 0 0 1 114 106L74 106A14 14 0 0 0 46 106Z" fill="none" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><path d="M14 116Q4 114 5 106Q6 98 16 99Q20 92 30 95Q44 94 46 106Q48 116 38 116Z" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/><path d="M106 116Q116 114 115 106Q114 98 104 99Q100 92 90 95Q76 94 74 106Q72 116 82 116Z" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/><path d="M14 116Q4 114 5 106Q6 98 16 99Q20 92 30 95Q44 94 46 106Q48 116 38 116Z" fill="${HALO}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><path d="M106 116Q116 114 115 106Q114 98 104 99Q100 92 90 95Q76 94 74 106Q72 116 82 116Z" fill="${HALO}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`,
  snowman: `<circle cx="60" cy="92" r="26" fill="${HALO}" stroke="${HALO}" stroke-width="10"/><circle cx="60" cy="52" r="19" fill="${HALO}" stroke="${HALO}" stroke-width="10"/><path d="M38 80L16 68M24 72L20 62M24 72L12 70M82 80L104 68M96 72L100 62M96 72L108 70" fill="none" stroke="${HALO}" stroke-width="12" stroke-linecap="round"/><path d="M38 80L16 68M24 72L20 62M24 72L12 70M82 80L104 68M96 72L100 62M96 72L108 70" fill="none" stroke="${COLORS.cocoa}" stroke-width="6" stroke-linecap="round"/><circle cx="60" cy="92" r="26" fill="${HALO}" stroke="${INK}" stroke-width="4"/><circle cx="60" cy="52" r="19" fill="${HALO}" stroke="${INK}" stroke-width="4"/><circle cx="52" cy="45" r="3.6" fill="${INK}"/><circle cx="67" cy="45" r="3.6" fill="${INK}"/><path d="M56 52L88 58L56 64Z" fill="${COLORS.orange}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><circle cx="60" cy="84" r="3.6" fill="${INK}"/><circle cx="60" cy="100" r="3.6" fill="${INK}"/>`,
  rocket: `<path d="M60 18 Q40 44 40 70 L40 100 L80 100 L80 70 Q80 44 60 18 Z M42 68 L20 108 L42 100 Z M78 68 L100 108 L78 100 Z M46 94 Q48 120 60 112 Q72 120 74 94 Z" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/><path d="M46 94 Q48 120 60 112 Q72 120 74 94 Z" fill="${COLORS.orange}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><path d="M42 68 L20 108 L42 100 Z M78 68 L100 108 L78 100 Z" fill="${COLORS.pink}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><path d="M60 18 Q40 44 40 70 L40 100 L80 100 L80 70 Q80 44 60 18 Z" fill="${COLORS.cream}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><path d="M60 18 Q47 33 43 50 L77 50 Q73 33 60 18 Z" fill="${COLORS.pink}" stroke="${INK}" stroke-width="3"/><rect x="40" y="86" width="40" height="9" fill="${COLORS.pink}" stroke="${INK}" stroke-width="3"/><circle cx="60" cy="68" r="13" fill="${COLORS.sky}" stroke="${INK}" stroke-width="4"/><circle cx="55" cy="64" r="4.5" fill="${HALO}"/><path d="M54 100 Q56 114 60 108 Q64 114 66 100 Z" fill="${COLORS.gold}"/>`,
  robot: `<path d="M34 30 H86 V76 H34 Z M40 74 H80 V110 H40 Z M20 82 H40 V94 H20 Z M80 82 H100 V94 H80 Z M44 104 H56 V118 H44 Z M64 104 H76 V118 H64 Z" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/><circle cx="60" cy="14" r="6" fill="${HALO}" stroke="${HALO}" stroke-width="10"/><path d="M60 32 V16" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><circle cx="60" cy="14" r="6" fill="${COLORS.gold}" stroke="${INK}" stroke-width="3"/><path d="M20 82 H40 V94 H20 Z M80 82 H100 V94 H80 Z M44 104 H56 V118 H44 Z M64 104 H76 V118 H64 Z" fill="${COLORS.teal}" stroke="${INK}" stroke-width="4"/><rect x="40" y="74" width="40" height="36" rx="7" fill="${COLORS.teal}" stroke="${INK}" stroke-width="4"/><rect x="34" y="30" width="52" height="46" rx="10" fill="${COLORS.cream}" stroke="${INK}" stroke-width="4"/><circle cx="48" cy="50" r="8" fill="${COLORS.sky}" stroke="${INK}" stroke-width="4"/><circle cx="72" cy="50" r="8" fill="${COLORS.sky}" stroke="${INK}" stroke-width="4"/><path d="M48 50 h0 M72 50 h0" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><rect x="46" y="63" width="28" height="8" rx="4" fill="${COLORS.midnight}"/>`,
  crown: `<path d="M22 104 L30 58 L45 86 L60 52 L75 86 L90 58 L98 104 Z M20 96 H100 V114 H20 Z" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/><path d="M22 104 L30 58 L45 86 L60 52 L75 86 L90 58 L98 104 Z" fill="${COLORS.gold}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><rect x="20" y="96" width="80" height="18" rx="6" fill="${COLORS.gold}" stroke="${INK}" stroke-width="4"/><circle cx="38" cy="105" r="6" fill="${COLORS.bubblegum}" stroke="${INK}" stroke-width="3"/><circle cx="60" cy="105" r="6" fill="${COLORS.teal}" stroke="${INK}" stroke-width="3"/><circle cx="82" cy="105" r="6" fill="${COLORS.lilac}" stroke="${INK}" stroke-width="3"/>`,
  cake: `<ellipse cx="60" cy="112" rx="48" ry="8" fill="${HALO}" stroke="${HALO}" stroke-width="10"/><path d="M22 80 H98 V110 H22 Z M38 50 H82 V80 H38 Z M55 28 H65 V52 H55 Z" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/><ellipse cx="60" cy="112" rx="48" ry="8" fill="${COLORS.ghost}" stroke="${INK}" stroke-width="4"/><rect x="22" y="80" width="76" height="30" rx="5" fill="${COLORS.bubblegum}" stroke="${INK}" stroke-width="4"/><path d="M22 80 q10 11 19 0 q9 11 19 0 q9 11 19 0 q9 11 19 0 V72 H22 Z" fill="${COLORS.cream}" stroke="${INK}" stroke-width="3.5"/><rect x="38" y="50" width="44" height="30" rx="5" fill="${COLORS.cream}" stroke="${INK}" stroke-width="4"/><path d="M38 50 q11 11 22 0 q11 11 22 0 V43 H38 Z" fill="${COLORS.bubblegum}" stroke="${INK}" stroke-width="3.5"/><rect x="55" y="30" width="10" height="22" rx="4" fill="${COLORS.teal}" stroke="${INK}" stroke-width="3.5"/><path d="M60 16 C67 24 66 30 60 30 C54 30 53 24 60 16 Z" fill="${COLORS.gold}" stroke="${INK}" stroke-width="3"/>`,
  balloon: `<path d="M60 88 Q78 100 58 106 Q46 111 60 117" fill="none" stroke="${HALO}" stroke-width="9" stroke-linecap="round"/><ellipse cx="60" cy="54" rx="28" ry="34" fill="${HALO}" stroke="${HALO}" stroke-width="10"/><path d="M52 82 L68 82 L60 95 Z" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/><path d="M60 88 Q78 100 58 106 Q46 111 60 117" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/><path d="M52 82 L68 82 L60 95 Z" fill="${COLORS.bubblegum}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><ellipse cx="60" cy="54" rx="28" ry="34" fill="${COLORS.bubblegum}" stroke="${INK}" stroke-width="4"/><ellipse cx="49" cy="42" rx="7" ry="10" fill="${HALO}" transform="rotate(-20 49 42)"/>`,
  drum: `<path d="M20 52 H100 V110 H20 Z" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/><path d="M30 22 L74 58 M90 22 L46 58" fill="none" stroke="${HALO}" stroke-width="13" stroke-linecap="round"/><rect x="24" y="58" width="72" height="46" rx="6" fill="${COLORS.orange}" stroke="${INK}" stroke-width="4"/><path d="M28 66 L44 96 L60 66 L76 96 L92 66" fill="none" stroke="${COLORS.gold}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/><rect x="20" y="52" width="80" height="14" rx="6" fill="${COLORS.cream}" stroke="${INK}" stroke-width="4"/><rect x="22" y="96" width="76" height="14" rx="6" fill="${COLORS.cream}" stroke="${INK}" stroke-width="4"/><path d="M30 22 L74 58 M90 22 L46 58" fill="none" stroke="${INK}" stroke-width="11" stroke-linecap="round"/><path d="M30 22 L74 58 M90 22 L46 58" fill="none" stroke="${COLORS.cocoa}" stroke-width="6" stroke-linecap="round"/><circle cx="74" cy="58" r="6" fill="${COLORS.cocoa}" stroke="${INK}" stroke-width="2.5"/><circle cx="46" cy="58" r="6" fill="${COLORS.cocoa}" stroke="${INK}" stroke-width="2.5"/>`,
  boat: `<path d="M43 24 h9 v70 h-9 z M52 28 L96 84 L52 84 Z M16 90 L104 90 L88 114 L32 114 Z" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/>
<rect x="43" y="24" width="9" height="70" rx="4" fill="${COLORS.cocoa}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
<path d="M52 28 L96 84 L52 84 Z" fill="${COLORS.cream}" stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>
<path d="M16 90 L104 90 L88 114 L32 114 Z" fill="${COLORS.orange}" stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>
<path d="M27 99 H93" stroke="${COLORS.gold}" stroke-width="7" stroke-linecap="round"/>
<path d="M14 117 Q26 111 38 117 M82 117 Q94 111 106 117" fill="none" stroke="${COLORS.sky}" stroke-width="4" stroke-linecap="round"/>`,
  kite: `<path d="M60 14 L94 46 L60 78 L26 46 Z" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/>
<path d="M60 14 L94 46 L26 46 Z" fill="${COLORS.gold}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
<path d="M26 46 L94 46 L60 78 Z" fill="${COLORS.pink}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
<path d="M60 18 V74" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
<path d="M60 78 Q80 96 68 114" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>
<path d="M70 91 L59 85 L59 97 Z M70 91 L81 85 L81 97 Z" fill="${COLORS.teal}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
<path d="M71 109 L60 103 L60 115 Z M71 109 L82 103 L82 115 Z" fill="${COLORS.teal}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>`,
  castle: `<path d="M14 116 V54 H25 V62 H31 V54 H40 V80 H48 V32 H56 V40 H64 V32 H72 V80 H80 V54 H89 V62 H95 V54 H106 V116 Z" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/>
<path d="M14 116 V54 H25 V62 H31 V54 H40 V80 H48 V32 H56 V40 H64 V32 H72 V80 H80 V54 H89 V62 H95 V54 H106 V116 Z" fill="${COLORS.sand}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
<path d="M52 116 V98 Q60 88 68 98 V116 Z" fill="${COLORS.cocoa}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
<rect x="20" y="70" width="10" height="14" rx="3" fill="${COLORS.midnight}" stroke="${INK}" stroke-width="3"/>
<rect x="90" y="70" width="10" height="14" rx="3" fill="${COLORS.midnight}" stroke="${INK}" stroke-width="3"/>
<path d="M62 17 L88 24 L62 31 Z" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/>
<path d="M60 40 V15" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>
<path d="M62 17 L88 24 L62 31 Z" fill="${COLORS.pink}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`,
  flower: `<circle cx="60" cy="54" r="40" fill="${HALO}"/>
<rect x="55" y="62" width="10" height="52" rx="5" fill="${HALO}" stroke="${HALO}" stroke-width="10"/>
<rect x="55" y="62" width="10" height="52" rx="5" fill="${COLORS.teal}" stroke="${INK}" stroke-width="4"/>
<path d="M60 102 Q40 90 36 108 Q52 114 60 102 Z" fill="${COLORS.teal}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
<path d="M60 96 Q80 84 84 102 Q68 108 60 96 Z" fill="${COLORS.teal}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/>
<circle cx="60" cy="32" r="15" fill="${COLORS.pink}" stroke="${INK}" stroke-width="4"/>
<circle cx="81" cy="47" r="15" fill="${COLORS.pink}" stroke="${INK}" stroke-width="4"/>
<circle cx="73" cy="72" r="15" fill="${COLORS.pink}" stroke="${INK}" stroke-width="4"/>
<circle cx="47" cy="72" r="15" fill="${COLORS.pink}" stroke="${INK}" stroke-width="4"/>
<circle cx="39" cy="47" r="15" fill="${COLORS.pink}" stroke="${INK}" stroke-width="4"/>
<circle cx="60" cy="54" r="13" fill="${COLORS.gold}" stroke="${INK}" stroke-width="4"/>`,
  tree: `<rect x="50" y="68" width="20" height="48" rx="8" fill="${HALO}" stroke="${HALO}" stroke-width="10"/>
<rect x="50" y="68" width="20" height="48" rx="8" fill="${COLORS.cocoa}" stroke="${INK}" stroke-width="4"/>
<circle cx="60" cy="54" r="35" fill="${HALO}" stroke="${HALO}" stroke-width="10"/>
<circle cx="60" cy="54" r="35" fill="${COLORS.teal}" stroke="${INK}" stroke-width="4"/>
<circle cx="45" cy="41" r="8" fill="${HALO}" opacity="0.45"/>
<circle cx="72" cy="63" r="6" fill="${HALO}" opacity="0.4"/>
<circle cx="62" cy="29" r="5" fill="${HALO}" opacity="0.45"/>`,
  palm: `<path d="M48 116 Q40 84 46 52 L62 52 Q60 84 70 116 Z" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/>
<path d="M48 116 Q40 84 46 52 L62 52 Q60 84 70 116 Z" fill="${COLORS.coconut}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
<path d="M56 54 Q32 24 8 48 Q32 52 56 66 Z M56 54 Q80 24 104 48 Q80 52 56 66 Z M50 54 Q40 20 58 12 Q72 34 63 58 Z" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/>
<path d="M56 54 Q32 24 8 48 Q32 52 56 66 Z M56 54 Q80 24 104 48 Q80 52 56 66 Z M50 54 Q40 20 58 12 Q72 34 63 58 Z" fill="${COLORS.teal}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>
<circle cx="52" cy="58" r="7" fill="${COLORS.coconut}" stroke="${INK}" stroke-width="3"/>
<circle cx="64" cy="60" r="7" fill="${COLORS.coconut}" stroke="${INK}" stroke-width="3"/>`,
  mushroom: `<rect x="48" y="68" width="24" height="46" rx="11" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/><rect x="48" y="68" width="24" height="46" rx="11" fill="${COLORS.cream}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><path d="M18 80 Q60 2 102 80 Z" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/><path d="M18 80 Q60 2 102 80 Z" fill="${COLORS.pink}" stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/><circle cx="40" cy="66" r="6.5" fill="${HALO}"/><circle cx="62" cy="56" r="8" fill="${HALO}"/><circle cx="82" cy="68" r="5.5" fill="${HALO}"/>`,
  butterfly: `<path d="M56 48 Q14 26 16 58 Q18 76 56 70 Q22 78 26 102 Q34 112 58 92 Z M64 48 Q106 26 104 58 Q102 76 64 70 Q98 78 94 102 Q86 112 62 92 Z" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/><path d="M56 48 Q14 26 16 58 Q18 76 56 70 Q22 78 26 102 Q34 112 58 92 Z M64 48 Q106 26 104 58 Q102 76 64 70 Q98 78 94 102 Q86 112 62 92 Z" fill="${COLORS.pink}" stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/><circle cx="34" cy="54" r="6.5" fill="${COLORS.gold}"/><circle cx="86" cy="54" r="6.5" fill="${COLORS.gold}"/><circle cx="36" cy="94" r="5" fill="${COLORS.cream}"/><circle cx="84" cy="94" r="5" fill="${COLORS.cream}"/><rect x="53" y="40" width="14" height="60" rx="7" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/><rect x="53" y="40" width="14" height="60" rx="7" fill="${COLORS.lilac}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><circle cx="60" cy="40" r="10" fill="${COLORS.lilac}" stroke="${INK}" stroke-width="4"/><path d="M55 32 Q48 24 42 24 M65 32 Q72 24 78 24" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>`,
  bee: `<ellipse cx="38" cy="50" rx="19" ry="12" fill="${HALO}" stroke="${HALO}" stroke-width="10"/><ellipse cx="70" cy="48" rx="15" ry="11" fill="${HALO}" stroke="${HALO}" stroke-width="10"/><ellipse cx="38" cy="50" rx="19" ry="12" fill="${COLORS.ghost}" stroke="${INK}" stroke-width="4"/><ellipse cx="70" cy="48" rx="15" ry="11" fill="${COLORS.ghost}" stroke="${INK}" stroke-width="4"/><circle cx="94" cy="68" r="15" fill="${HALO}" stroke="${HALO}" stroke-width="10"/><circle cx="94" cy="68" r="15" fill="${COLORS.midnight}" stroke="${INK}" stroke-width="4"/><ellipse cx="54" cy="78" rx="32" ry="24" fill="${HALO}" stroke="${HALO}" stroke-width="10"/><ellipse cx="54" cy="78" rx="32" ry="24" fill="${COLORS.gold}" stroke="${INK}" stroke-width="4"/><path d="M44 60 Q38 78 44 96 L56 96 Q50 78 56 60 Z M64 64 Q58 78 64 92 L76 92 Q70 78 76 64 Z" fill="${COLORS.midnight}"/><circle cx="99" cy="64" r="5" fill="${HALO}"/><path d="M90 54 Q88 42 80 38 M100 54 Q104 42 110 40" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>`,
  fish: `<path d="M40 48 Q52 10 68 46 Z" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/><path d="M74 74 L110 44 Q102 74 110 104 Z" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/><path d="M40 48 Q52 10 68 46 Z" fill="${COLORS.sunshine}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><path d="M74 74 L110 44 Q102 74 110 104 Z" fill="${COLORS.sunshine}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><ellipse cx="50" cy="74" rx="32" ry="30" fill="${HALO}" stroke="${HALO}" stroke-width="10"/><ellipse cx="50" cy="74" rx="32" ry="30" fill="${COLORS.orange}" stroke="${INK}" stroke-width="4"/><circle cx="36" cy="66" r="8" fill="${HALO}" stroke="${INK}" stroke-width="3"/><circle cx="34" cy="66" r="3.5" fill="${INK}"/><path d="M20 84 Q27 90 34 86" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>`,
  whale: `<path d="M82 88 L112 64 Q102 88 112 110 Z" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/><path d="M82 88 L112 64 Q102 88 112 110 Z" fill="${COLORS.sky}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><ellipse cx="54" cy="86" rx="40" ry="25" fill="${HALO}" stroke="${HALO}" stroke-width="10"/><ellipse cx="54" cy="86" rx="40" ry="25" fill="${COLORS.sky}" stroke="${INK}" stroke-width="4"/><path d="M22 96 Q54 118 88 94 Q54 104 22 96 Z" fill="${COLORS.cream}"/><path d="M16 84 Q30 100 54 94" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/><circle cx="32" cy="74" r="7" fill="${HALO}" stroke="${INK}" stroke-width="3"/><circle cx="30" cy="74" r="3.5" fill="${INK}"/><circle cx="48" cy="56" r="9" fill="${HALO}" stroke="${INK}" stroke-width="3"/><circle cx="32" cy="38" r="7" fill="${HALO}" stroke="${INK}" stroke-width="3"/><circle cx="62" cy="30" r="8" fill="${HALO}" stroke="${INK}" stroke-width="3"/>`,
  crab: `<path d="M24 80Q8 78 10 62Q12 50 24 50L26 60L36 54Q40 68 32 78Z M96 80Q112 78 110 62Q108 50 96 50L94 60L84 54Q80 68 88 78Z" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/><path d="M24 80Q8 78 10 62Q12 50 24 50L26 60L36 54Q40 68 32 78Z M96 80Q112 78 110 62Q108 50 96 50L94 60L84 54Q80 68 88 78Z" fill="${COLORS.orange}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><path d="M36 96 Q26 106 18 110 M48 102 Q42 112 34 116 M84 96 Q94 106 102 110 M72 102 Q78 112 86 116" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/><ellipse cx="60" cy="84" rx="32" ry="22" fill="${HALO}" stroke="${HALO}" stroke-width="10"/><ellipse cx="60" cy="84" rx="32" ry="22" fill="${COLORS.orange}" stroke="${INK}" stroke-width="4"/><path d="M50 64 L48 52 M70 64 L72 52" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/><circle cx="48" cy="46" r="7" fill="${HALO}" stroke="${INK}" stroke-width="3"/><circle cx="72" cy="46" r="7" fill="${HALO}" stroke="${INK}" stroke-width="3"/><circle cx="48" cy="46" r="3" fill="${INK}"/><circle cx="72" cy="46" r="3" fill="${INK}"/>`,
  duck: `<g fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"><path d="M32 82 L10 62 Q4 80 22 96 Z"/><ellipse cx="56" cy="88" rx="34" ry="23"/><circle cx="82" cy="52" r="22"/><path d="M97 46 L112 50 Q116 56 110 61 L96 62 Z"/></g><g stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"><path d="M32 82 L10 62 Q4 80 22 96 Z" fill="${COLORS.sunshine}"/><ellipse cx="56" cy="88" rx="34" ry="23" fill="${COLORS.gold}"/><path d="M40 88 Q56 74 74 86 Q58 100 40 88 Z" fill="${COLORS.sunshine}" stroke-width="3"/><circle cx="82" cy="52" r="22" fill="${COLORS.gold}"/><path d="M97 46 L112 50 Q116 56 110 61 L96 62 Z" fill="${COLORS.orange}"/></g><circle cx="84" cy="45" r="4.5" fill="${INK}"/><circle cx="85.6" cy="43.4" r="1.6" fill="${HALO}"/>`,
  frog: `<g fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"><path d="M16 106 Q12 60 60 60 Q108 60 104 106 Z"/><ellipse cx="22" cy="104" rx="15" ry="8"/><ellipse cx="98" cy="104" rx="15" ry="8"/><circle cx="40" cy="52" r="17"/><circle cx="80" cy="52" r="17"/></g><g stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"><ellipse cx="22" cy="104" rx="15" ry="8" fill="${COLORS.aqua}"/><ellipse cx="98" cy="104" rx="15" ry="8" fill="${COLORS.aqua}"/><path d="M16 106 Q12 60 60 60 Q108 60 104 106 Z" fill="${COLORS.teal}"/><circle cx="40" cy="52" r="17" fill="${COLORS.teal}"/><circle cx="80" cy="52" r="17" fill="${COLORS.teal}"/><circle cx="40" cy="52" r="9" fill="${HALO}" stroke-width="2.5"/><circle cx="80" cy="52" r="9" fill="${HALO}" stroke-width="2.5"/><path d="M26 82 Q60 108 94 82" fill="none"/></g><circle cx="41" cy="53" r="4.5" fill="${INK}"/><circle cx="81" cy="53" r="4.5" fill="${INK}"/><circle cx="52" cy="72" r="2.2" fill="${INK}"/><circle cx="68" cy="72" r="2.2" fill="${INK}"/>`,
  owl: `<g fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"><path d="M60 24 Q98 28 98 72 Q98 110 60 110 Q22 110 22 72 Q22 28 60 24 Z"/><path d="M30 44 L20 20 L50 30 Z M90 44 L100 20 L70 30 Z"/></g><rect x="36" y="102" width="17" height="12" rx="6" fill="${COLORS.gold}" stroke="${INK}" stroke-width="3"/><rect x="67" y="102" width="17" height="12" rx="6" fill="${COLORS.gold}" stroke="${INK}" stroke-width="3"/><g stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"><path d="M30 44 L20 20 L50 30 Z M90 44 L100 20 L70 30 Z" fill="${COLORS.lilac}"/><path d="M60 24 Q98 28 98 72 Q98 110 60 110 Q22 110 22 72 Q22 28 60 24 Z" fill="${COLORS.lilac}"/><path d="M30 72 Q24 94 36 104 M90 72 Q96 94 84 104" fill="none" stroke-width="3"/><circle cx="41" cy="56" r="18" fill="${HALO}"/><circle cx="79" cy="56" r="18" fill="${HALO}"/><path d="M60 64 L69 79 L51 79 Z" fill="${COLORS.gold}" stroke-width="3"/></g><circle cx="41" cy="56" r="8" fill="${INK}"/><circle cx="79" cy="56" r="8" fill="${INK}"/><circle cx="37.4" cy="52.4" r="3" fill="${HALO}"/><circle cx="75.4" cy="52.4" r="3" fill="${HALO}"/>`,
  snake: `<g fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"><ellipse cx="60" cy="94" rx="42" ry="17"/><ellipse cx="92" cy="48" rx="17" ry="13"/><path d="M40 90 Q22 62 46 46 Q64 34 86 44 L84 58 Q66 50 54 62 Q42 74 58 90 Z"/></g><g stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"><ellipse cx="60" cy="94" rx="42" ry="17" fill="${COLORS.teal}"/><ellipse cx="74" cy="96" rx="16" ry="6" fill="${COLORS.aqua}" stroke-width="3"/><path d="M40 90 Q22 62 46 46 Q64 34 86 44 L84 58 Q66 50 54 62 Q42 74 58 90 Z" fill="${COLORS.teal}"/><ellipse cx="92" cy="48" rx="17" ry="13" fill="${COLORS.teal}"/><path d="M107 54 Q116 57 113 61 M107 54 Q117 54 118 49" fill="none" stroke="${COLORS.pink}" stroke-width="3"/></g><circle cx="96" cy="43" r="4.5" fill="${INK}"/><circle cx="97.6" cy="41.4" r="1.6" fill="${HALO}"/><ellipse cx="30" cy="92" rx="6" ry="4" fill="${COLORS.gold}"/><ellipse cx="60" cy="105" rx="6" ry="4" fill="${COLORS.gold}"/><ellipse cx="52" cy="56" rx="5" ry="4" fill="${COLORS.gold}"/>`,
  lion: `<circle cx="60" cy="62" r="40" fill="${HALO}" stroke="${HALO}" stroke-width="10"/><circle cx="60" cy="62" r="40" fill="${COLORS.orange}" stroke="${INK}" stroke-width="4"/><circle cx="60" cy="62" r="34" fill="none" stroke="${COLORS.gold}" stroke-width="10" stroke-dasharray="10 13.7" stroke-linecap="round"/><g stroke="${INK}" stroke-width="3" stroke-linejoin="round"><circle cx="32" cy="34" r="10" fill="${COLORS.sand}"/><circle cx="88" cy="34" r="10" fill="${COLORS.sand}"/><circle cx="60" cy="66" r="27" fill="${COLORS.sand}" stroke-width="4"/><ellipse cx="52" cy="80" rx="11" ry="8" fill="${COLORS.cream}"/><ellipse cx="68" cy="80" rx="11" ry="8" fill="${COLORS.cream}"/><path d="M53 70 L67 70 L60 77 Z" fill="${COLORS.pink}" stroke-width="2.5"/></g><circle cx="49" cy="60" r="5" fill="${INK}"/><circle cx="71" cy="60" r="5" fill="${INK}"/><circle cx="50.6" cy="58.4" r="1.8" fill="${HALO}"/><circle cx="72.6" cy="58.4" r="1.8" fill="${HALO}"/><path d="M60 78 Q60 85 53 84 M60 78 Q60 85 67 84" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linecap="round"/>`,
  zebra: `<g fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"><path d="M36 42 Q16 26 20 12 Q36 12 46 36 Z M84 42 Q104 26 100 12 Q84 12 74 36 Z"/><path d="M52 28 Q54 12 60 10 Q66 12 68 28 Z"/><path d="M30 44 Q30 26 60 26 Q90 26 90 44 L78 92 Q76 108 60 108 Q44 108 42 92 Z"/></g><g stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"><path d="M36 42 Q16 26 20 12 Q36 12 46 36 Z M84 42 Q104 26 100 12 Q84 12 74 36 Z" fill="${COLORS.ghost}"/><path d="M52 28 Q54 12 60 10 Q66 12 68 28 Z" fill="${COLORS.midnight}"/><path d="M30 44 Q30 26 60 26 Q90 26 90 44 L78 92 Q76 108 60 108 Q44 108 42 92 Z" fill="${COLORS.ghost}"/><ellipse cx="60" cy="97" rx="15" ry="9" fill="${COLORS.midnight}" stroke-width="3"/></g><path d="M38 35 Q60 31 82 35 L81 44 Q60 40 39 44 Z M38 49 Q60 45 82 49 L81 58 Q60 54 39 58 Z M40 63 Q60 59 80 63 L79 72 Q60 68 41 72 Z" fill="${COLORS.midnight}"/><circle cx="49" cy="82" r="5" fill="${INK}"/><circle cx="71" cy="82" r="5" fill="${INK}"/><circle cx="53" cy="95" r="2.4" fill="${COLORS.ghost}"/><circle cx="67" cy="95" r="2.4" fill="${COLORS.ghost}"/>`,
  apple: `<path d="M60 46 C44 30 20 40 20 68 C20 98 42 116 60 106 C78 116 100 98 100 68 C100 40 76 30 60 46 Z" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/><path d="M62 36 Q84 20 96 28 Q84 48 62 36 Z" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/><path d="M58 46 L54 24" fill="none" stroke="${INK}" stroke-width="13" stroke-linecap="round"/><path d="M58 46 L54 24" fill="none" stroke="${COLORS.cocoa}" stroke-width="6" stroke-linecap="round"/><path d="M60 46 C44 30 20 40 20 68 C20 98 42 116 60 106 C78 116 100 98 100 68 C100 40 76 30 60 46 Z" fill="${COLORS.orange}" stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/><path d="M62 36 Q84 20 96 28 Q84 48 62 36 Z" fill="${COLORS.teal}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><ellipse cx="41" cy="62" rx="8" ry="13" fill="${HALO}" opacity="0.42" transform="rotate(-18 41 62)"/>`,
  pizza: `<path d="M22 40 Q60 12 98 40 L60 114 Z" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/><path d="M22 40 Q60 12 98 40 L60 114 Z" fill="${COLORS.gold}" stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/><path d="M22 40 Q60 12 98 40 Q60 28 22 40 Z" fill="${COLORS.sand}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><circle cx="46" cy="56" r="8" fill="${COLORS.pink}" stroke="${INK}" stroke-width="2.5"/><circle cx="74" cy="58" r="8" fill="${COLORS.pink}" stroke="${INK}" stroke-width="2.5"/><circle cx="60" cy="82" r="8" fill="${COLORS.pink}" stroke="${INK}" stroke-width="2.5"/>`,
  banana: `<path d="M46 22 C90 38 102 88 48 112 C38 116 32 108 38 100 C68 84 64 44 36 32 C30 28 38 18 46 22 Z" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/><path d="M42 24 L38 12" fill="none" stroke="${INK}" stroke-width="12" stroke-linecap="round"/><path d="M42 24 L38 12" fill="none" stroke="${COLORS.cocoa}" stroke-width="6" stroke-linecap="round"/><path d="M46 22 C90 38 102 88 48 112 C38 116 32 108 38 100 C68 84 64 44 36 32 C30 28 38 18 46 22 Z" fill="${COLORS.gold}" stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/><path d="M60 44 C74 58 74 74 58 92" fill="none" stroke="${COLORS.sand}" stroke-width="3" opacity="0.85" stroke-linecap="round"/>`,
  carrot: `<path d="M40 44 Q60 38 80 44 L64 110 Q60 118 56 110 Z" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/><path d="M54 48 Q26 38 32 12 Q58 16 62 44 Z" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/><path d="M66 48 Q94 38 88 12 Q62 16 58 44 Z" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/><path d="M54 48 Q26 38 32 12 Q58 16 62 44 Z" fill="${COLORS.teal}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><path d="M66 48 Q94 38 88 12 Q62 16 58 44 Z" fill="${COLORS.teal}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><path d="M40 44 Q60 38 80 44 L64 110 Q60 118 56 110 Z" fill="${COLORS.orange}" stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/><path d="M48 58 Q60 64 72 58" fill="none" stroke="${INK}" stroke-width="3" opacity="0.45" stroke-linecap="round"/><path d="M52 76 Q60 82 68 76" fill="none" stroke="${INK}" stroke-width="3" opacity="0.45" stroke-linecap="round"/><path d="M56 92 Q60 97 64 92" fill="none" stroke="${INK}" stroke-width="3" opacity="0.45" stroke-linecap="round"/>`,
  cheese: `<path d="M18 88 L100 44 L100 104 Z" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/><path d="M18 88 L100 44 L100 32 L18 76 Z" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/><path d="M18 88 L100 44 L100 104 Z" fill="${COLORS.gold}" stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/><path d="M18 88 L100 44 L100 32 L18 76 Z" fill="${COLORS.sunshine}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><circle cx="52" cy="84" r="6" fill="${COLORS.orange}" stroke="${INK}" stroke-width="2.5"/><circle cx="74" cy="80" r="8" fill="${COLORS.orange}" stroke="${INK}" stroke-width="2.5"/><circle cx="90" cy="64" r="6" fill="${COLORS.orange}" stroke="${INK}" stroke-width="2.5"/>`,
  egg: `<path d="M60 26 C82 26 96 54 96 76 C96 98 80 112 60 112 C40 112 24 98 24 76 C24 54 38 26 60 26 Z" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/><path d="M60 26 C82 26 96 54 96 76 C96 98 80 112 60 112 C40 112 24 98 24 76 C24 54 38 26 60 26 Z" fill="${COLORS.sand}" stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/><circle cx="46" cy="52" r="4" fill="${COLORS.cocoa}"/><circle cx="72" cy="46" r="3.5" fill="${COLORS.cocoa}"/><circle cx="78" cy="68" r="4.5" fill="${COLORS.cocoa}"/><circle cx="44" cy="80" r="4" fill="${COLORS.cocoa}"/><circle cx="62" cy="94" r="4" fill="${COLORS.cocoa}"/><circle cx="84" cy="92" r="3.5" fill="${COLORS.cocoa}"/>`,
  cookie: `<circle cx="60" cy="70" r="41" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/><circle cx="60" cy="70" r="41" fill="${COLORS.sand}" stroke="${INK}" stroke-width="4"/><circle cx="44" cy="54" r="7" fill="${COLORS.coconut}" stroke="${INK}" stroke-width="2"/><circle cx="79" cy="59" r="6.5" fill="${COLORS.coconut}" stroke="${INK}" stroke-width="2"/><circle cx="58" cy="78" r="7" fill="${COLORS.coconut}" stroke="${INK}" stroke-width="2"/><circle cx="81" cy="88" r="6" fill="${COLORS.coconut}" stroke="${INK}" stroke-width="2"/><circle cx="41" cy="87" r="6.5" fill="${COLORS.coconut}" stroke="${INK}" stroke-width="2"/>`,
  teapot: `<path d="M40 76C20 74 10 58 18 46C22 40 32 41 31 49M80 62C108 60 110 98 82 98" fill="none" stroke="${HALO}" stroke-width="19" stroke-linecap="round"/><path d="M40 76C20 74 10 58 18 46C22 40 32 41 31 49M80 62C108 60 110 98 82 98" fill="none" stroke="${INK}" stroke-width="13" stroke-linecap="round"/><path d="M40 76C20 74 10 58 18 46C22 40 32 41 31 49M80 62C108 60 110 98 82 98" fill="none" stroke="${COLORS.teal}" stroke-width="9" stroke-linecap="round"/><ellipse cx="60" cy="82" rx="30" ry="27" fill="${HALO}" stroke="${HALO}" stroke-width="10"/><ellipse cx="60" cy="82" rx="30" ry="27" fill="${COLORS.teal}" stroke="${INK}" stroke-width="4"/><rect x="44" y="100" width="32" height="11" rx="4" fill="${COLORS.teal}" stroke="${INK}" stroke-width="4"/><path d="M40 58Q60 40 80 58Z" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/><path d="M40 58Q60 40 80 58Z" fill="${COLORS.cream}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><circle cx="60" cy="43" r="6" fill="${COLORS.gold}" stroke="${INK}" stroke-width="3"/><path d="M37 90Q60 99 83 90" fill="none" stroke="${COLORS.cream}" stroke-width="5" stroke-linecap="round"/>`,
  hat: `<path d="M35 92L42 62Q42 52 52 52L68 52Q78 52 78 62L85 92Z" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/><path d="M35 92L42 62Q42 52 52 52L68 52Q78 52 78 62L85 92Z" fill="${COLORS.teal}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><path d="M41 66Q60 72 79 66L80 78Q60 84 40 78Z" fill="${COLORS.cream}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/><path d="M34 90Q60 85 86 90Q100 93 100 98Q100 107 60 108Q20 107 20 98Q20 93 34 90Z" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/><path d="M34 90Q60 85 86 90Q100 93 100 98Q100 107 60 108Q20 107 20 98Q20 93 34 90Z" fill="${COLORS.teal}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><path d="M32 99Q60 104 88 99" fill="none" stroke="${COLORS.cream}" stroke-width="4" stroke-linecap="round"/>`,
  wand: `<path d="M50 60 C 30 66 40 86 20 90" fill="none" stroke="${HALO}" stroke-width="17" stroke-linecap="round"/><path d="M50 60 C 30 66 40 86 20 90" fill="none" stroke="${INK}" stroke-width="11" stroke-linecap="round"/><path d="M50 60 C 30 66 40 86 20 90" fill="none" stroke="${COLORS.pink}" stroke-width="7" stroke-linecap="round"/><path d="M34 110 L62 62" fill="none" stroke="${HALO}" stroke-width="19" stroke-linecap="round"/><path d="M34 110 L62 62" fill="none" stroke="${INK}" stroke-width="13" stroke-linecap="round"/><path d="M34 110 L62 62" fill="none" stroke="${COLORS.indigo}" stroke-width="9" stroke-linecap="round"/><polygon points="68,20 74.2,35.5 90.8,36.6 78,47.2 82.1,63.4 68,54.5 53.9,63.4 58,47.2 45.2,36.6 61.8,35.5" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/><polygon points="68,20 74.2,35.5 90.8,36.6 78,47.2 82.1,63.4 68,54.5 53.9,63.4 58,47.2 45.2,36.6 61.8,35.5" fill="${COLORS.gold}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><circle cx="68" cy="44" r="6" fill="${COLORS.sunshine}"/>`,
  torch: `<rect x="50" y="88" width="20" height="28" rx="8" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/><rect x="50" y="88" width="20" height="28" rx="8" fill="${COLORS.coconut}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><path d="M60 14Q86 42 79 61Q72 76 60 76Q48 76 41 61Q34 42 60 14Z" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/><path d="M60 14Q86 42 79 61Q72 76 60 76Q48 76 41 61Q34 42 60 14Z" fill="${COLORS.orange}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><path d="M60 36Q73 52 69 64Q66 71 60 71Q54 71 51 64Q47 52 60 36Z" fill="${COLORS.gold}"/><path d="M40 72L47 94L73 94L80 72Z" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/><path d="M40 72L47 94L73 94L80 72Z" fill="${COLORS.cocoa}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`,
  lamp: `<path d="M78 70C104 68 106 98 80 98" fill="none" stroke="${HALO}" stroke-width="19"/><path d="M78 70C104 68 106 98 80 98" fill="none" stroke="${INK}" stroke-width="13" stroke-linecap="round"/><path d="M78 70C104 68 106 98 80 98" fill="none" stroke="${COLORS.gold}" stroke-width="9" stroke-linecap="round"/><ellipse cx="60" cy="86" rx="30" ry="21" fill="${HALO}" stroke="${HALO}" stroke-width="10"/><ellipse cx="60" cy="86" rx="30" ry="21" fill="${COLORS.gold}" stroke="${INK}" stroke-width="4"/><path d="M36 72C26 68 18 64 10 60L12 70C20 76 28 82 40 90Z" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/><path d="M36 72C26 68 18 64 10 60L12 70C20 76 28 82 40 90Z" fill="${COLORS.gold}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><rect x="44" y="100" width="32" height="11" rx="4" fill="${COLORS.gold}" stroke="${INK}" stroke-width="4"/><ellipse cx="60" cy="66" rx="13" ry="6" fill="${COLORS.gold}" stroke="${INK}" stroke-width="4"/><circle cx="60" cy="58" r="6" fill="${COLORS.gold}" stroke="${INK}" stroke-width="3"/><ellipse cx="62" cy="80" rx="9" ry="5" fill="${HALO}" opacity="0.75"/>`,
  bell: `<circle cx="60" cy="24" r="7" fill="none" stroke="${HALO}" stroke-width="10"/><path d="M28 92 Q36 84 38 62 Q40 40 60 38 Q80 40 82 62 Q84 84 92 92 Z" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/><rect x="24" y="88" width="72" height="15" rx="7" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/><circle cx="60" cy="111" r="8" fill="${HALO}" stroke="${HALO}" stroke-width="10"/><circle cx="60" cy="24" r="7" fill="none" stroke="${INK}" stroke-width="5"/><rect x="50" y="28" width="20" height="14" rx="5" fill="${COLORS.sunshine}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><path d="M28 92 Q36 84 38 62 Q40 40 60 38 Q80 40 82 62 Q84 84 92 92 Z" fill="${COLORS.gold}" stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/><circle cx="60" cy="111" r="8" fill="${COLORS.gold}" stroke="${INK}" stroke-width="4"/><rect x="24" y="88" width="72" height="15" rx="7" fill="${COLORS.sunshine}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><path d="M46 56 Q43 72 45 82" fill="none" stroke="${HALO}" stroke-width="4" stroke-linecap="round" opacity="0.7"/>`,
  book: `<path d="M60 46 Q34 30 12 38 L12 106 Q34 100 60 114 Q86 100 108 106 L108 38 Q86 30 60 46 Z" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/><path d="M60 46 Q34 30 12 38 L12 106 Q34 100 60 114 Q86 100 108 106 L108 38 Q86 30 60 46 Z" fill="${COLORS.teal}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><path d="M60 52 Q40 34 18 40 L18 100 Q40 94 60 108 Z" fill="${HALO}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><path d="M60 52 Q80 34 102 40 L102 100 Q80 94 60 108 Z" fill="${HALO}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><path d="M28 60 Q42 58 52 64 M28 74 Q42 72 52 78 M28 88 Q42 86 52 92" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round" opacity="0.5"/><path d="M68 64 Q78 58 92 60 M68 78 Q78 72 92 74 M68 92 Q78 86 92 88" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round" opacity="0.5"/>`,
  ball: `<circle cx="60" cy="72" r="42" fill="${HALO}" stroke="${HALO}" stroke-width="10"/><circle cx="60" cy="72" r="42" fill="${COLORS.cream}"/><path d="M60 30 A42 42 0 0 0 60 114 Q16 72 60 30 Z" fill="${COLORS.pink}"/><path d="M60 30 Q104 72 60 114 Z" fill="${COLORS.teal}"/><path d="M60 30 Q104 72 60 114 A42 42 0 0 0 60 30 Z" fill="${COLORS.gold}"/><path d="M60 30 Q16 72 60 114 M60 30 L60 114 M60 30 Q104 72 60 114" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><circle cx="60" cy="72" r="42" fill="none" stroke="${INK}" stroke-width="4"/>`,
  sock: `<path d="M56 26 L92 26 L92 88 Q92 110 70 110 L36 110 Q20 110 20 98 Q20 86 34 86 L56 86 Z" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/><path d="M56 26 L92 26 L92 88 Q92 110 70 110 L36 110 Q20 110 20 98 Q20 86 34 86 L56 86 Z" fill="${COLORS.cream}" stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/><rect x="57" y="27" width="34" height="14" fill="${COLORS.pink}"/><rect x="57" y="49" width="34" height="10" fill="${COLORS.teal}"/><rect x="57" y="67" width="34" height="10" fill="${COLORS.pink}"/><path d="M56 43 L92 43" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><path d="M30 88 Q23 98 30 107" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round" opacity="0.45"/>`,
  boot: `<path d="M26 24 L68 24 L68 78 Q90 82 94 94 Q97 104 84 104 L38 104 Q26 104 26 92 Z" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/><rect x="22" y="96" width="76" height="16" rx="8" fill="${HALO}" stroke="${HALO}" stroke-width="10"/><path d="M26 24 L68 24 L68 78 Q90 82 94 94 Q97 104 84 104 L38 104 Q26 104 26 92 Z" fill="${COLORS.gold}" stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/><rect x="24" y="26" width="46" height="14" rx="4" fill="${COLORS.sunshine}"/><path d="M26 42 L68 42" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><rect x="22" y="96" width="76" height="16" rx="8" fill="${COLORS.indigo}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><path d="M36 56 Q33 70 35 82" fill="none" stroke="${HALO}" stroke-width="4" stroke-linecap="round" opacity="0.65"/>`,
  umbrella: `<path d="M14 78 A46 46 0 0 1 106 78 Q94 58 82 78 Q70 58 60 78 Q50 58 38 78 Q26 58 14 78 Z" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/><path d="M60 76 L60 100 Q60 112 49 112 Q39 112 39 103" fill="none" stroke="${HALO}" stroke-width="13" stroke-linecap="round"/><path d="M60 76 L60 100 Q60 112 49 112 Q39 112 39 103" fill="none" stroke="${COLORS.cocoa}" stroke-width="7" stroke-linecap="round"/><path d="M14 78 A46 46 0 0 1 106 78 Q94 58 82 78 Q70 58 60 78 Q50 58 38 78 Q26 58 14 78 Z" fill="${COLORS.pink}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><path d="M60 32 Q18 36 14 78 Q26 58 38 78 Z" fill="${COLORS.cream}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M60 32 Q102 36 106 78 Q94 58 82 78 Z" fill="${COLORS.cream}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M60 24 L60 78" stroke="${INK}" stroke-width="3.4" stroke-linecap="round"/><circle cx="60" cy="20" r="5" fill="${COLORS.gold}" stroke="${INK}" stroke-width="3"/>`,
  ladder: `<rect x="26" y="22" width="10" height="96" rx="5" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/><rect x="84" y="22" width="10" height="96" rx="5" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/><rect x="30" y="32" width="60" height="9" rx="4" fill="${COLORS.sand}" stroke="${INK}" stroke-width="4"/><rect x="30" y="51" width="60" height="9" rx="4" fill="${COLORS.sand}" stroke="${INK}" stroke-width="4"/><rect x="30" y="70" width="60" height="9" rx="4" fill="${COLORS.sand}" stroke="${INK}" stroke-width="4"/><rect x="30" y="89" width="60" height="9" rx="4" fill="${COLORS.sand}" stroke="${INK}" stroke-width="4"/><rect x="30" y="108" width="60" height="9" rx="4" fill="${COLORS.sand}" stroke="${INK}" stroke-width="4"/><rect x="26" y="22" width="10" height="96" rx="5" fill="${COLORS.cocoa}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><rect x="84" y="22" width="10" height="96" rx="5" fill="${COLORS.cocoa}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`,
  bench: `<rect x="24" y="44" width="72" height="50" rx="8" fill="${HALO}" stroke="${HALO}" stroke-width="10"/><rect x="20" y="86" width="80" height="16" rx="6" fill="${HALO}" stroke="${HALO}" stroke-width="10"/><rect x="30" y="44" width="11" height="50" rx="4" fill="${COLORS.cocoa}" stroke="${INK}" stroke-width="4"/><rect x="79" y="44" width="11" height="50" rx="4" fill="${COLORS.cocoa}" stroke="${INK}" stroke-width="4"/><rect x="24" y="46" width="72" height="12" rx="5" fill="${COLORS.cocoa}" stroke="${INK}" stroke-width="4"/><rect x="24" y="64" width="72" height="12" rx="5" fill="${COLORS.cocoa}" stroke="${INK}" stroke-width="4"/><rect x="30" y="98" width="11" height="18" rx="4" fill="${COLORS.cocoa}" stroke="${INK}" stroke-width="4"/><rect x="79" y="98" width="11" height="18" rx="4" fill="${COLORS.cocoa}" stroke="${INK}" stroke-width="4"/><rect x="20" y="86" width="80" height="16" rx="6" fill="${COLORS.sand}" stroke="${INK}" stroke-width="4"/>`,
  swing: `<path d="M24 116 L38 40 M96 116 L82 40" fill="none" stroke="${HALO}" stroke-width="12" stroke-linecap="round"/><path d="M24 116 L38 40 M96 116 L82 40" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/><rect x="28" y="30" width="64" height="13" rx="6" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/><rect x="28" y="30" width="64" height="13" rx="6" fill="${COLORS.teal}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><rect x="42" y="90" width="36" height="13" rx="5" fill="${HALO}" stroke="${HALO}" stroke-width="10"/><rect x="42" y="90" width="36" height="13" rx="5" fill="${COLORS.gold}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><path d="M49 43 L49 95 M71 43 L71 95" fill="none" stroke="${INK}" stroke-width="4" stroke-linecap="round"/>`,
  slide: `<path d="M32 46 L32 116 M48 46 L48 116" fill="none" stroke="${HALO}" stroke-width="14" stroke-linecap="round"/><path d="M32 46 L32 116 M48 46 L48 116" fill="none" stroke="${INK}" stroke-width="6" stroke-linecap="round"/><path d="M32 62 L48 62 M32 78 L48 78 M32 94 L48 94 M32 110 L48 110" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M48 42 Q82 48 96 104 L78 112 Q68 66 42 58 Z" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/><path d="M48 42 Q82 48 96 104 L78 112 Q68 66 42 58 Z" fill="${COLORS.pink}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><path d="M54 53 Q80 62 88 102" fill="none" stroke="${HALO}" stroke-width="5" stroke-linecap="round"/><rect x="22" y="32" width="36" height="13" rx="6" fill="${COLORS.teal}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`,
  tent: `<path d="M60 30 L106 114 L14 114 Z" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/><path d="M60 30 L106 114 L14 114 Z" fill="${COLORS.teal}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><path d="M60 48 Q52 82 46 114 L72 114 Q64 82 60 48 Z" fill="${COLORS.midnight}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><path d="M60 48 Q66 78 74 106 L92 96 Q76 72 60 48 Z" fill="${COLORS.sand}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/>`,
  campfire: `<path d="M50 28 Q70 58 65 82 Q61 96 50 96 Q39 96 36 82 Q30 58 50 28 Z" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/><path d="M73 50 Q84 68 80 82 Q77 94 71 94 Q63 94 62 84 Q61 66 73 50 Z" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/><path d="M73 50 Q84 68 80 82 Q77 94 71 94 Q63 94 62 84 Q61 66 73 50 Z" fill="${COLORS.gold}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><path d="M50 28 Q70 58 65 82 Q61 96 50 96 Q39 96 36 82 Q30 58 50 28 Z" fill="${COLORS.orange}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><ellipse cx="60" cy="102" rx="42" ry="19" fill="${HALO}" stroke="${HALO}" stroke-width="10"/><rect x="24" y="86" width="72" height="12" rx="6" fill="${COLORS.cocoa}" stroke="${INK}" stroke-width="4" transform="rotate(-8 60 92)"/><rect x="20" y="95" width="80" height="12" rx="6" fill="${COLORS.sand}" stroke="${INK}" stroke-width="4" transform="rotate(6 60 101)"/><rect x="22" y="104" width="76" height="13" rx="6" fill="${COLORS.cocoa}" stroke="${INK}" stroke-width="4" transform="rotate(-6 60 110)"/>`,
  guitar: `<path d="M45 20 H75 V34 H68 V64 H52 V34 H45 Z" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/><path d="M60 58 Q32 58 32 78 Q32 87 41 91 Q26 97 26 106 Q26 118 60 118 Q94 118 94 106 Q94 97 79 91 Q88 87 88 78 Q88 58 60 58 Z" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/><path d="M45 20 H75 V34 H68 V64 H52 V34 H45 Z" fill="${COLORS.cocoa}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><path d="M60 58 Q32 58 32 78 Q32 87 41 91 Q26 97 26 106 Q26 118 60 118 Q94 118 94 106 Q94 97 79 91 Q88 87 88 78 Q88 58 60 58 Z" fill="${COLORS.sand}" stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/><circle cx="60" cy="84" r="12" fill="${COLORS.midnight}" stroke="${INK}" stroke-width="3"/><rect x="48" y="102" width="24" height="7" rx="3" fill="${COLORS.cocoa}" stroke="${INK}" stroke-width="3"/><path d="M54 104 V34 M60 104 V34 M66 104 V34" fill="none" stroke="${INK}" stroke-width="1.6"/><circle cx="50" cy="26" r="3.4" fill="${COLORS.gold}"/><circle cx="70" cy="26" r="3.4" fill="${COLORS.gold}"/>`,
  trophy: `<path d="M40 38 Q18 40 20 56 Q22 70 40 70 V60 Q30 58 30 52 Q32 48 40 48 Z M80 38 Q102 40 100 56 Q98 70 80 70 V60 Q90 58 90 52 Q88 48 80 48 Z" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/><path d="M53 70 H67 V88 H82 V98 H90 V114 H30 V98 H38 V88 H53 Z" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/><path d="M32 26 H88 V36 H82 L78 64 Q60 82 42 64 L38 36 H32 Z" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/><path d="M40 38 Q18 40 20 56 Q22 70 40 70 V60 Q30 58 30 52 Q32 48 40 48 Z M80 38 Q102 40 100 56 Q98 70 80 70 V60 Q90 58 90 52 Q88 48 80 48 Z" fill="${COLORS.gold}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><path d="M53 70 H67 V88 H82 V98 H90 V114 H30 V98 H38 V88 H53 Z" fill="${COLORS.gold}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><path d="M32 26 H88 V36 H82 L78 64 Q60 82 42 64 L38 36 H32 Z" fill="${COLORS.gold}" stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/><path d="M47 40 L54 40 L49 62 L43 60 Z" fill="${COLORS.sunshine}"/><rect x="34" y="101" width="52" height="11" rx="4" fill="${COLORS.cocoa}"/>`,
  medal: `<path d="M30 20 L48 20 L60 48 L72 20 L90 20 L66 72 L54 72 Z" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/><circle cx="60" cy="90" r="24" fill="${HALO}" stroke="${HALO}" stroke-width="10"/><path d="M30 20 L48 20 L60 48 L72 20 L90 20 L66 72 L54 72 Z" fill="${COLORS.pink}" stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/><circle cx="60" cy="90" r="24" fill="${COLORS.gold}" stroke="${INK}" stroke-width="4"/><circle cx="60" cy="90" r="16" fill="${COLORS.sunshine}"/><path d="M60 79 L62.7 86.3 L70.5 86.6 L64.4 91.4 L66.5 98.9 L60 94.6 L53.5 98.9 L55.6 91.4 L49.5 86.6 L57.3 86.3 Z" fill="${COLORS.cream}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>`,
  map: `<path d="M18 34 L46 26 L74 34 L102 26 L102 100 L74 108 L46 100 L18 108 Z" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/><path d="M18 34 L46 26 L74 34 L102 26 L102 100 L74 108 L46 100 L18 108 Z" fill="${COLORS.sand}" stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/><path d="M46 26 V100 M74 34 V108" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/><path d="M31 90 Q46 62 60 78 Q74 94 88 58" fill="none" stroke="${COLORS.orange}" stroke-width="6" stroke-linecap="round" stroke-dasharray="0.5 11"/><circle cx="31" cy="90" r="5.5" fill="${COLORS.orange}"/><path d="M82 49 L95 62 M95 49 L82 62" fill="none" stroke="${COLORS.pink}" stroke-width="6" stroke-linecap="round"/>`,
  key: `<path d="M52 58 H68 V82 H84 V92 H68 V100 H84 V110 H68 V114 H52 Z" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/><circle cx="60" cy="42" r="23" fill="${HALO}" stroke="${HALO}" stroke-width="10"/><path d="M52 58 H68 V82 H84 V92 H68 V100 H84 V110 H68 V114 H52 Z" fill="${COLORS.gold}" stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/><circle cx="60" cy="42" r="23" fill="${COLORS.gold}" stroke="${INK}" stroke-width="4"/><circle cx="60" cy="42" r="9" fill="${HALO}" stroke="${INK}" stroke-width="3.5"/><path d="M96 26 L98.5 33 L105 35.5 L98.5 38 L96 45 L93.5 38 L87 35.5 L93.5 33 Z" fill="${COLORS.sunshine}"/>`,
  present: `<rect x="24" y="56" width="72" height="56" rx="6" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/><rect x="18" y="40" width="84" height="18" rx="5" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/><path d="M60 42 Q38 36 42 24 Q46 14 58 26 Z M60 42 Q82 36 78 24 Q74 14 62 26 Z" fill="${HALO}" stroke="${HALO}" stroke-width="10" stroke-linejoin="round"/><rect x="24" y="56" width="72" height="56" rx="6" fill="${COLORS.pink}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><rect x="18" y="40" width="84" height="18" rx="5" fill="${COLORS.lilac}" stroke="${INK}" stroke-width="4" stroke-linejoin="round"/><rect x="24" y="76" width="72" height="13" fill="${COLORS.gold}" stroke="${INK}" stroke-width="3"/><rect x="52" y="40" width="16" height="72" fill="${COLORS.gold}" stroke="${INK}" stroke-width="3"/><path d="M60 42 Q38 36 42 24 Q46 14 58 26 Z M60 42 Q82 36 78 24 Q74 14 62 26 Z" fill="${COLORS.gold}" stroke="${INK}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/><circle cx="60" cy="42" r="7" fill="${COLORS.gold}" stroke="${INK}" stroke-width="3"/>`,
};

// Footprint class per wish (RUN21B item 1): S=44px, M=64px, L=84px on screen.
export const WISH_SIZE = {
  sun: 'L', star: 'M', moon: 'M', cloud: 'M', rainbow: 'L', snowman: 'M',
  rocket: 'L', robot: 'M', crown: 'S', cake: 'M', balloon: 'S', drum: 'M',
  boat: 'M', kite: 'M', castle: 'L', flower: 'S', tree: 'M', palm: 'M',
  mushroom: 'S', butterfly: 'M', bee: 'S', fish: 'S', whale: 'L', crab: 'S',
  duck: 'S', frog: 'S', owl: 'M', snake: 'M', lion: 'M', zebra: 'M',
  apple: 'S', pizza: 'S', banana: 'S', carrot: 'S', cheese: 'S', egg: 'S',
  cookie: 'S', teapot: 'M', hat: 'S', wand: 'S', torch: 'S', lamp: 'S',
  bell: 'S', book: 'S', ball: 'S', sock: 'S', boot: 'S', umbrella: 'M',
  ladder: 'M', bench: 'M', swing: 'M', slide: 'M', tent: 'M', campfire: 'M',
  guitar: 'M', trophy: 'S', medal: 'S', map: 'S', key: 'S', present: 'S',
};
export const WISH_PX = { S: 44, M: 64, L: 84 };

export function renderWish(item, { size = 120, cls = '' } = {}) {
  const art = WISH_ART[item.word];
  const body = art || (
    // A word with no artwork yet keeps the old house medallion rather than rendering
    // nothing — a wish she owns must always be SOMETHING she can see and pick up.
    `<ellipse cx="60" cy="110" rx="39" ry="9" fill="rgba(42,27,78,.18)"/>` +
    `<circle cx="60" cy="62" r="47" fill="#FFF8E4" stroke="${INK}" stroke-width="4"/>` +
    path(starPath(60, 60, 26, 11), COLORS.gold, `stroke="${INK}" stroke-width="3.2" stroke-linejoin="round"`)
  );
  // The caption gets the same cream halo every sticker shape gets. The medallion it
  // replaced was a narrow circle, so a bare word cleared it; real objects fill the full
  // width down to the ground line, and the word was landing ON them (measured on the
  // contact sheet: robot, cake, castle, bench, guitar). Same size, same place, now legible.
  const caption = escapeHTML(item.name);
  const capAttrs = `x="60" y="124" text-anchor="middle" font-size="11" font-weight="700" font-family="Fredoka, sans-serif"`;
  return `<svg viewBox="0 0 120 130" width="${size}" height="${size * 130 / 120}" class="wish-svg wish-${item.word} ${cls}" role="img" aria-label="${escapeHTML(item.name)}" xmlns="http://www.w3.org/2000/svg">` +
    body +
    `<text ${capAttrs} fill="none" stroke="${HALO}" stroke-width="4.5" stroke-linejoin="round" aria-hidden="true">${caption}</text>` +
    `<text ${capAttrs} fill="${INK}">${caption}</text></svg>`;
}

// Generic render router used by collection/town.
// opts.equipArt (Boos only) overlays an equipped accessory's art.
export function renderItem(item, opts = {}) {
  if (item.custom) return renderCustomBoo(item.custom, opts);
  if (item.kind === 'wish') return renderWish(item, opts);
  // landscape (RUN10 P3) and furniture (RUN10 P4) draw exactly like a deco — both are
  // game-logic tags (box exclusion/odds, indoor-vs-outdoor placement, their own drawer
  // tab), not a different art path.
  if (item.kind === 'deco' || item.kind === 'landscape' || item.kind === 'furniture') return renderDeco(item, opts);
  if (item.kind === 'accessory') return renderAccessory(item, opts);
  return renderBoo(item, opts);
}

// ---- the world map island (RUN10 P1) ---------------------------------------
// A full-bleed island in the house-sticker style: grass mass, a sand fringe at the
// bottom-right, a river ribbon reaching to riverside, a hill bump upper-left, fair
// tents at the right, and two little roofs for the interiors. Landmark badges are
// positioned separately (worldmap.js, from MAP_POS) — this is background only.
export function renderIslandMap({ w = 100, h = 100 } = {}) {
  const grass = '#7FC85F', grass2 = '#66B052', sand = '#F2DDA6', sand2 = '#E4C583',
    river = '#7FC7E8', riverDeep = '#5FA9D0', hill = '#6FBF77', hill2 = '#5AA664';
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
    <rect width="${w}" height="${h}" fill="#8FC6EF"/>
    <path d="M4 20 Q2 55 10 78 Q22 96 46 94 Q70 98 86 84 Q98 68 94 44 Q96 20 74 10 Q50 0 28 6 Q10 10 4 20 Z" fill="${grass}" stroke="${INK}" stroke-width="1.4"/>
    <path d="M8 24 Q6 54 14 74 Q26 90 46 90 Q40 78 44 62 Q34 50 34 34 Q30 20 8 24 Z" fill="${grass2}" opacity="0.55"/>
    <!-- hill bump, upper-left -->
    <path d="M6 30 Q16 12 34 16 Q46 20 42 32 Q34 40 22 36 Q10 38 6 30 Z" fill="${hill}" stroke="${INK}" stroke-width="1.2"/>
    <path d="M14 26 Q22 16 32 20" fill="none" stroke="${hill2}" stroke-width="1.4" opacity="0.7"/>
    <!-- river ribbon, running toward riverside -->
    <path d="M50 8 Q58 24 52 40 Q46 56 60 68 L64 70 Q52 58 56 40 Q60 24 54 8 Z" fill="${river}" stroke="${INK}" stroke-width="1.1"/>
    <path d="M52 12 Q58 26 53 40" fill="none" stroke="${riverDeep}" stroke-width="1" opacity="0.6"/>
    <!-- sand fringe, bottom-right, toward the beach -->
    <path d="M62 74 Q78 72 88 82 Q94 90 84 94 Q68 98 58 90 Q54 82 62 74 Z" fill="${sand}" stroke="${INK}" stroke-width="1.2"/>
    <path d="M66 80 Q76 78 82 86" fill="none" stroke="${sand2}" stroke-width="1" opacity="0.6"/>
    <!-- fair tents, right -->
    <g transform="translate(78,30) scale(0.55)">
      <path d="M0 10 L6 -6 L12 10 Z" fill="#FF5C8A" stroke="${INK}" stroke-width="1"/>
      <path d="M10 12 L15 0 L20 12 Z" fill="#FFC93C" stroke="${INK}" stroke-width="1"/>
    </g>
    <!-- the two interiors: real little buildings, not blank blocks -->
    <g transform="translate(37,73) scale(0.6)">
      <path d="M-7 6 L0 -5 L7 6 Z" fill="#C6A9F0" stroke="${INK}" stroke-width="1"/>
      <rect x="-5" y="6" width="10" height="6.5" fill="#FFF8F0" stroke="${INK}" stroke-width="1"/>
      <rect x="-1.6" y="8.6" width="3.2" height="3.9" fill="#8A5A2B" stroke="${INK}" stroke-width="0.7"/>
      <circle cx="-3.2" cy="8.9" r="1" fill="${COLORS.gold}" stroke="${INK}" stroke-width="0.5"/>
      <circle cx="3.2" cy="8.9" r="1" fill="${COLORS.gold}" stroke="${INK}" stroke-width="0.5"/>
    </g>
    <g transform="translate(53,33) scale(0.6)">
      <path d="M-7 6 L0 -5 L7 6 Z" fill="#35D0BA" stroke="${INK}" stroke-width="1"/>
      <rect x="-5" y="6" width="10" height="6.5" fill="#FFF8F0" stroke="${INK}" stroke-width="1"/>
      <rect x="-3.4" y="8.2" width="6.8" height="4.3" fill="#FFE9B8" stroke="${INK}" stroke-width="0.7"/>
      <path d="M-2.4 11.4 L-0.6 9.2 L0.8 11.4 Z" fill="#7FC85F" stroke="${INK}" stroke-width="0.5"/>
    </g>
    <!-- a little life: drifting clouds and a shimmer on the water -->
    <g class="map-clouds" opacity="0.9">
      <g class="map-cloud c1"><ellipse cx="24" cy="9" rx="7" ry="3.2" fill="#FFFFFF"/><ellipse cx="29" cy="8" rx="5" ry="2.6" fill="#FFFFFF"/></g>
      <g class="map-cloud c2"><ellipse cx="70" cy="16" rx="6" ry="2.8" fill="#FFFFFF" opacity="0.85"/><ellipse cx="65" cy="17" rx="4" ry="2.2" fill="#FFFFFF" opacity="0.85"/></g>
    </g>
    <g class="map-shimmer" stroke="#FFFFFF" stroke-width="0.6" stroke-linecap="round" opacity="0.55">
      <path d="M52 18 q2.4 -1.2 4.8 0"/><path d="M51 33 q2.4 -1.2 4.8 0"/><path d="M51.5 50 q2.4 -1.2 4.8 0"/>
    </g>
  </svg>`;
}

// RUN11: house-style sticker glyphs for the world-map badges. These replace the emoji the
// badges used to show — emoji-as-art is forbidden in game scenes (CLAUDE.md art contract),
// and it made the map read as a menu of chips rather than a place. Each glyph is drawn on
// the same 0..24 box so every badge sits identically inside its 88px circle.
// ---- RUN19 Z6: room dressings ----------------------------------------------
// Nine wallpapers and nine floors, drawn as SVG PATTERN FILLS so one small tile repeats over
// a whole wall or floor band at any viewport size with no image files (hard law: everything
// ships in the repo, nothing is fetched). Each dressing in data/dressings.js names a pattern
// plus a base and an accent from the house palette; the pattern itself is the drawing.
//
// Returned as a `<defs><pattern>` + a full-bleed `<rect>` inside one <svg> the scene can drop
// straight into a band, so callers never build SVG by hand.
const DRESSING_TILES = {
  // A flat wash — the free defaults, and the honest baseline the others are judged against.
  plain: () => '',
  // Broad soft stripes. Vertical on a wall reads as wallpaper; the caller does not rotate.
  stripes: (a) => `<rect x="0" y="0" width="16" height="32" fill="${a}" opacity="0.55"/>`,
  // A gingham check: two half-opacity bands crossing, so the overlap darkens by itself.
  checks: (a) => `<rect x="0" y="0" width="16" height="32" fill="${a}" opacity="0.3"/>` +
                 `<rect x="0" y="0" width="32" height="16" fill="${a}" opacity="0.3"/>`,
  // Polka spots, offset on the second row so it does not read as a grid.
  spots: (a) => `<circle cx="8" cy="8" r="4.5" fill="${a}" opacity="0.7"/>` +
                `<circle cx="24" cy="24" r="4.5" fill="${a}" opacity="0.7"/>`,
  // Little four-point stars, the house's own star shape, two per tile.
  stars: (a) => `<path d="M10 2 L12 8 L18 10 L12 12 L10 18 L8 12 L2 10 L8 8 Z" fill="${a}" opacity="0.9"/>` +
                `<path d="M24 18 L25.4 22.2 L29.6 23.6 L25.4 25 L24 29.2 L22.6 25 L18.4 23.6 L22.6 22.2 Z" fill="${a}" opacity="0.75"/>`,
  // Tiles: a grouted grid, the grout drawn as the accent at low opacity.
  tiles: (a) => `<rect x="0" y="0" width="32" height="32" fill="none" stroke="${a}" stroke-width="2.5" opacity="0.55"/>` +
                `<rect x="0" y="0" width="16" height="16" fill="${a}" opacity="0.12"/>`,
  // Floorboards: long planks with a seam and a hint of grain.
  boards: (a) => `<rect x="0" y="0" width="32" height="2.5" fill="${a}" opacity="0.5"/>` +
                 `<rect x="0" y="16" width="32" height="2.5" fill="${a}" opacity="0.5"/>` +
                 `<rect x="14" y="2.5" width="2" height="13.5" fill="${a}" opacity="0.3"/>` +
                 `<rect x="26" y="18.5" width="2" height="13.5" fill="${a}" opacity="0.3"/>`,
  // A woven rug: a basket weave of short dashes both ways.
  weave: (a) => `<rect x="0" y="2" width="14" height="5" rx="2" fill="${a}" opacity="0.5"/>` +
                `<rect x="18" y="2" width="14" height="5" rx="2" fill="${a}" opacity="0.5"/>` +
                `<rect x="2" y="9" width="5" height="14" rx="2" fill="${a}" opacity="0.5"/>` +
                `<rect x="25" y="9" width="5" height="14" rx="2" fill="${a}" opacity="0.5"/>` +
                `<rect x="0" y="25" width="14" height="5" rx="2" fill="${a}" opacity="0.5"/>` +
                `<rect x="18" y="25" width="14" height="5" rx="2" fill="${a}" opacity="0.5"/>`,
  // Rounded pebbles / a looped carpet pile, scattered at three sizes.
  pebbles: (a) => `<ellipse cx="9" cy="10" rx="7" ry="5.5" fill="${a}" opacity="0.45"/>` +
                  `<ellipse cx="24" cy="7" rx="5" ry="4" fill="${a}" opacity="0.35"/>` +
                  `<ellipse cx="20" cy="23" rx="8" ry="6" fill="${a}" opacity="0.45"/>` +
                  `<ellipse cx="5" cy="26" rx="4.5" ry="3.5" fill="${a}" opacity="0.3"/>`,
  // Herringbone: two mirrored diagonal blocks, the classic V.
  herring: (a) => `<path d="M0 12 L12 0 L16 4 L4 16 Z" fill="${a}" opacity="0.45"/>` +
                  `<path d="M16 4 L28 16 L24 20 L12 8 Z" fill="${a}" opacity="0.45"/>` +
                  `<path d="M0 28 L12 16 L16 20 L4 32 Z" fill="${a}" opacity="0.45"/>`,
  // Fat soft clouds, two per tile at different heights.
  clouds: (a) => `<ellipse cx="10" cy="11" rx="9" ry="5.5" fill="${a}" opacity="0.85"/>` +
                 `<ellipse cx="16" cy="12" rx="6" ry="4" fill="${a}" opacity="0.85"/>` +
                 `<ellipse cx="26" cy="25" rx="7" ry="4.5" fill="${a}" opacity="0.7"/>`,
  // A rainbow rug: five arcs of the house's own brights.
  rainbow: () => ['#FF7AC6', '#FFC93C', '#5FBF7A', '#8FC7FF', '#B9A6F5']
    .map((c, i) => `<rect x="0" y="${i * 6.4}" width="32" height="6.4" fill="${c}" opacity="0.55"/>`).join('')
};
export const DRESSING_PATTERNS = Object.keys(DRESSING_TILES);

// One dressing, as a self-contained <svg> that fills whatever box it is given.
export function renderDressing(dressing, { cls = '' } = {}) {
  if (!dressing) return '';
  const tile = DRESSING_TILES[dressing.pattern] || DRESSING_TILES.plain;
  const id = 'dp-' + dressing.id;
  const inner = tile(dressing.accent);
  return `<svg class="dressing-fill ${cls}" width="100%" height="100%" preserveAspectRatio="none" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">` +
    (inner ? `<defs><pattern id="${id}" width="32" height="32" patternUnits="userSpaceOnUse">${inner}</pattern></defs>` : '') +
    `<rect x="0" y="0" width="100%" height="100%" fill="${dressing.base}"/>` +
    (inner ? `<rect x="0" y="0" width="100%" height="100%" fill="url(#${id})"/>` : '') +
    `</svg>`;
}
// A small square swatch for the Decorate tab and the shop shelf — the same drawing, boxed.
export function renderDressingSwatch(dressing, { size = 56 } = {}) {
  if (!dressing) return '';
  const tile = DRESSING_TILES[dressing.pattern] || DRESSING_TILES.plain;
  const id = 'dps-' + dressing.id;
  const inner = tile(dressing.accent);
  return `<svg viewBox="0 0 64 64" width="${size}" height="${size}" class="dressing-swatch" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">` +
    (inner ? `<defs><pattern id="${id}" width="32" height="32" patternUnits="userSpaceOnUse">${inner}</pattern></defs>` : '') +
    `<rect x="2" y="2" width="60" height="60" rx="10" fill="${dressing.base}" stroke="${INK}" stroke-width="3"/>` +
    (inner ? `<rect x="4" y="4" width="56" height="56" rx="8" fill="url(#${id})"/>` : '') +
    `<rect x="2" y="2" width="60" height="60" rx="10" fill="none" stroke="${INK}" stroke-width="3"/>` +
    `</svg>`;
}

export function renderAreaGlyph(key, { size = 44 } = {}) {
  const ink = `stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"`;
  const G = {
    // a meadow flower
    meadow: `<g>${[[12,7],[7,11],[17,11],[9,16],[15,16]].map(([x,y]) => `<ellipse cx="${x}" cy="${y}" rx="3.4" ry="3.4" fill="${COLORS.bubblegum}" ${ink}/>`).join('')}
      <circle cx="12" cy="12" r="3.1" fill="${COLORS.gold}" ${ink}/></g>`,
    // a wooden bridge over water
    riverside: `<g><rect x="2" y="15" width="20" height="5" rx="1.5" fill="#7FC7E8" ${ink}/>
      <path d="M3 14 Q12 6 21 14" fill="none" ${ink}/>
      <path d="M3 14 L3 19 M8 11 L8 19 M12 9.6 L12 19 M16 11 L16 19 M21 14 L21 19" ${ink}/></g>`,
    // a green hill with a sun behind it
    hilltop: `<g><circle cx="16.5" cy="8" r="4" fill="${COLORS.gold}" ${ink}/>
      <path d="M2 19 Q8 8 13 13 Q17 17 22 19 Z" fill="#6FBF77" ${ink}/></g>`,
    // a beach parasol on sand
    beach: `<g><path d="M3 20 Q12 17 21 20" fill="#F2DDA6" ${ink}/>
      <path d="M12 6 Q4 8 3 13 L21 13 Q20 8 12 6 Z" fill="#FF7AC6" ${ink}/>
      <path d="M12 6 L12 19" ${ink}/></g>`,
    // a big top with a flag
    funfair: `<g><path d="M12 4 L12 7" ${ink}/><path d="M12 4 L16 5.5 L12 7 Z" fill="${COLORS.gold}" ${ink}/>
      <path d="M3 19 Q3 10 12 7 Q21 10 21 19 Z" fill="#FFF8F0" ${ink}/>
      <path d="M8 8.6 L8 19 M12 7 L12 19 M16 8.6 L16 19" stroke="${COLORS.bubblegum}" stroke-width="1.6"/></g>`,
    // a slide
    playground: `<g><path d="M6 19 L6 8 Q6 6 8 6 L11 6" ${ink} fill="none"/>
      <path d="M10 7 Q16 11 20 19 L13 19 Q11 12 8 9 Z" fill="${COLORS.teal}" ${ink}/>
      <path d="M4 19 L8 19" ${ink}/></g>`,
    // a cosy cottage
    boohouse: `<g><path d="M3 12 L12 5 L21 12 Z" fill="${COLORS.lilac}" ${ink}/>
      <rect x="5" y="12" width="14" height="8" fill="#FFF8F0" ${ink}/>
      <rect x="10.4" y="15" width="3.6" height="5" fill="#8A5A2B" ${ink}/>
      <circle cx="7.6" cy="15" r="1.4" fill="${COLORS.gold}" ${ink}/></g>`,
    // a framed picture
    gallery: `<g><rect x="3.5" y="5" width="17" height="14" rx="1.5" fill="${COLORS.gold}" ${ink}/>
      <rect x="6" y="7.5" width="12" height="9" fill="#FFF8F0" ${ink}/>
      <circle cx="9.5" cy="10.5" r="1.5" fill="${COLORS.gold}"/>
      <path d="M6 16.5 L10 11.5 L13 15 L15.5 12.5 L18 16.5 Z" fill="${COLORS.teal}"/></g>`
  };
  const inner = G[key] || `<circle cx="12" cy="12" r="6" fill="${COLORS.teal}" ${ink}/>`;
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inner}</svg>`;
}

// ---- Expedition glyphs (RUN18C C1/C2) --------------------------------------
// The Expedition had no art of its own at all: its chips, its counter and its four trail
// nodes were emoji glyphs in text nodes, which is the art contract's exact prohibition
// once they stop being tray chrome and start BEING the scene. Same 0..24 sticker box as
// renderAreaGlyph so a boot in a 20px chip and a bridge in a 72px marker are one family.
export function renderExpGlyph(key, { size = 24, cls = '' } = {}) {
  const ink = `stroke="${INK}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"`;
  const thin = `stroke="${INK}" stroke-width="1.1" stroke-linejoin="round" stroke-linecap="round"`;
  const G = {
    // a walking boot, laced, mid-stride — the counter chip's icon
    boots: `<g><path d="M8 4 L12.6 4 L13 12 L18.5 15 Q20.5 16 20.5 18 L20.5 19.6 L7.6 19.6 Q6.6 19.6 6.6 18.6 L7 5 Q7 4 8 4 Z" fill="${COLORS.cocoa}" ${ink}/>
      <path d="M6.7 17.2 L20.5 17.2" ${thin}/>
      <path d="M8.4 6.4 L12.7 6.4 M8.5 8.8 L12.8 8.8 M8.6 11.2 L13 11.2" ${thin}/></g>`,
    // the selection tick — drawn on its own disc so it can sit as a badge
    tick: `<g><circle cx="12" cy="12" r="10" fill="${COLORS.teal}" ${ink}/>
      <path d="M6.8 12.4 L10.4 16 L17.2 8.4" fill="none" stroke="${INK}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></g>`,
    // Sneezy Bridges — two little arches over water
    bridges: `<g><rect x="1.5" y="15" width="21" height="6" rx="1.5" fill="#7FC7E8" ${ink}/>
      <path d="M2.5 15.4 Q7 7.6 11.5 15.4" fill="none" ${ink}/>
      <path d="M12.5 15.4 Q17 7.6 21.5 15.4" fill="none" ${ink}/>
      <path d="M4.6 12.4 L4.6 15.4 M7 10.6 L7 15.4 M9.4 12.4 L9.4 15.4 M14.6 12.4 L14.6 15.4 M17 10.6 L17 15.4 M19.4 12.4 L19.4 15.4" ${thin}/>
      <path d="M3.4 18.6 q1.8 -1.1 3.6 0 M9 18.6 q1.8 -1.1 3.6 0 M14.6 18.6 q1.8 -1.1 3.6 0" fill="none" stroke="#FFFFFF" stroke-width="0.9" stroke-linecap="round" opacity="0.7"/></g>`,
    // the Picky Grumps' Picnic — a hamper on a checked rug
    picnic: `<g><path d="M1.6 20.4 L22.4 20.4 L20.4 17 L3.6 17 Z" fill="${COLORS.bubblegum}" ${ink}/>
      <path d="M7.4 17 L6 20.4 M12 17 L12 20.4 M16.6 17 L18 20.4" ${thin}/>
      <path d="M8 10 Q12 5.4 16 10" fill="none" ${ink}/>
      <rect x="5.4" y="9.6" width="13.2" height="7.6" rx="1.6" fill="${COLORS.sand}" ${ink}/>
      <path d="M5.4 13 L18.6 13" ${thin}/>
      <path d="M9 9.6 L9 17 M15 9.6 L15 17" ${thin}/></g>`,
    // the Ferry Raft — logs, a mast and a sail
    raft: `<g><path d="M1.4 17.6 Q12 21.4 22.6 17.6 L22.6 20 Q12 23.6 1.4 20 Z" fill="#7FC7E8" ${ink}/>
      <rect x="2.6" y="14.6" width="18.8" height="3.4" rx="1.4" fill="${COLORS.cocoa}" ${ink}/>
      <path d="M7 14.6 L7 18 M12 14.6 L12 18 M17 14.6 L17 18" ${thin}/>
      <path d="M12 14.6 L12 3.2" ${ink}/>
      <path d="M12.9 4 Q19 7.4 12.9 12.8 Z" fill="${COLORS.cream}" ${ink}/></g>`,
    // the Boo Hotel — three lit floors and a canopy
    hotel: `<g><rect x="4" y="6.6" width="16" height="13.8" rx="1.6" fill="${COLORS.lilac}" ${ink}/>
      <path d="M2.8 6.6 L12 2.4 L21.2 6.6 Z" fill="${COLORS.bubblegum}" ${ink}/>
      <rect x="6.4" y="9" width="3.4" height="3.2" rx="0.6" fill="${COLORS.gold}" ${ink}/>
      <rect x="14.2" y="9" width="3.4" height="3.2" rx="0.6" fill="${COLORS.cream}" ${ink}/>
      <rect x="6.4" y="13.8" width="3.4" height="3.2" rx="0.6" fill="${COLORS.cream}" ${ink}/>
      <rect x="14.2" y="13.8" width="3.4" height="3.2" rx="0.6" fill="${COLORS.gold}" ${ink}/>
      <rect x="10.2" y="16.2" width="3.6" height="4.2" rx="0.6" fill="${COLORS.cocoa}" ${ink}/></g>`,
    // the two bridge guardians: a little arch with a tickly nose over it
    guardian: `<g><rect x="1.5" y="16" width="21" height="5.4" rx="1.4" fill="#7FC7E8" ${ink}/>
      <path d="M2.6 16.4 Q12 6.4 21.4 16.4" fill="none" ${ink}/>
      <path d="M5.2 12.6 L5.2 16.4 M8.6 10 L8.6 16.4 M12 9 L12 16.4 M15.4 10 L15.4 16.4 M18.8 12.6 L18.8 16.4" ${thin}/>
      <ellipse cx="12" cy="4.4" rx="3.4" ry="2.8" fill="${COLORS.bubblegum}" ${ink}/>
      <path d="M16.4 3 q2 -1.2 3.4 .4 M16.8 6 q2.4 .2 3.6 2" fill="none" ${thin}/></g>`,
    // an empty raft seat — a coil of rope, where an anchor emoji used to sit
    seat: `<g><circle cx="12" cy="12" r="8.4" fill="none" ${ink}/>
      <circle cx="12" cy="12" r="4.6" fill="none" ${ink}/>
      <path d="M12 3.6 q4 1 4 4" fill="none" ${thin}/></g>`,
    // an empty hotel room — a shut door with a little handle
    door: `<g><rect x="5.6" y="3.6" width="12.8" height="16.8" rx="1.6" fill="${COLORS.cream}" ${ink}/>
      <rect x="8" y="6.2" width="8" height="6" rx="0.8" fill="#DCE9F5" ${ink}/>
      <circle cx="15.4" cy="16" r="1.2" fill="${COLORS.gold}" ${ink}/></g>`,
    // the three Picky Grumps, one mood each — drawn, not 😤😒🙄
    grump1: `<g><circle cx="12" cy="12" r="8.6" fill="${COLORS.orange}" ${ink}/>
      <path d="M7.4 9.4 L10.4 10.6 M16.6 9.4 L13.6 10.6" ${ink}/>
      <circle cx="9.4" cy="12.6" r="1.3" fill="${INK}"/><circle cx="14.6" cy="12.6" r="1.3" fill="${INK}"/>
      <path d="M9.2 17 Q12 14.8 14.8 17" fill="none" ${ink}/></g>`,
    grump2: `<g><circle cx="12" cy="12" r="8.6" fill="${COLORS.aqua}" ${ink}/>
      <path d="M7.4 10 L10.6 10 M13.4 10 L16.6 10" ${ink}/>
      <circle cx="9.4" cy="12.8" r="1.3" fill="${INK}"/><circle cx="14.6" cy="12.8" r="1.3" fill="${INK}"/>
      <path d="M9.4 16.6 L14.6 16.6" ${ink}/></g>`,
    // RUN18D (critic): grump3 was SMILING. The control point sat BELOW the endpoints, which
    // draws a U — on the face of a character whose whole job is to be hard to please, and
    // whose success state is a delighted one. It is a sceptical sideways mouth now; grump1
    // frowns and grump2 is flat, and the three moods stay distinct.
    grump3: `<g><circle cx="12" cy="12" r="8.6" fill="${COLORS.lilac}" ${ink}/>
      <path d="M7.2 9.2 Q9.2 7.6 11 9.2 M13 9.2 Q14.8 7.6 16.8 9.2" fill="none" ${ink}/>
      <circle cx="9.4" cy="11.6" r="1.3" fill="${INK}"/><circle cx="14.6" cy="11.6" r="1.3" fill="${INK}"/>
      <path d="M9.4 17.4 Q12 15.4 14.6 16.4" fill="none" ${ink}/></g>`,
    // the trail in miniature — the Expedition's hub card (RUN18C C5). A little map, not a
    // compass emoji: it is the same hillside, path and four markers the trail screen draws.
    trailmap: `<g><rect x="1.6" y="2.6" width="20.8" height="18.8" rx="3" fill="#BFE6F5" ${ink}/>
      <path d="M1.6 14 Q7 10.2 12 13 Q17 15.8 22.4 12.4 L22.4 21.4 L1.6 21.4 Z" fill="#7FC85F" ${ink}/>
      <path d="M4.6 19.4 Q7.4 15.4 10.6 15.6 Q14 15.8 15 11.6 Q16 7.6 19.6 6.2" fill="none" stroke="${COLORS.sand}" stroke-width="2.6" stroke-linecap="round"/>
      <circle cx="4.6" cy="19.4" r="1.9" fill="${COLORS.gold}" ${thin}/>
      <circle cx="10.6" cy="15.6" r="1.9" fill="${COLORS.cream}" ${thin}/>
      <circle cx="15" cy="11.6" r="1.9" fill="${COLORS.cream}" ${thin}/>
      <circle cx="19.6" cy="6.2" r="1.9" fill="${COLORS.cream}" ${thin}/></g>`,
    // the cocoa camp between the nodes — a fire, not the 🔥 glyph it used to be
    campfire: `<g><path d="M3.4 19.6 L20.6 19.6" ${ink}/>
      <path d="M5.6 19.6 L12.4 15.2 M18.4 19.6 L11.6 15.2" stroke="${COLORS.cocoa}" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M12 4.2 Q16.4 8.6 15.4 12.4 Q14.6 16 12 16.6 Q9.4 16 8.6 12.4 Q7.6 8.6 12 4.2 Z" fill="${COLORS.gold}" ${ink}/>
      <path d="M12 8.6 Q14 11 13.4 13 Q12.9 14.8 12 15.1 Q11.1 14.8 10.6 13 Q10 11 12 8.6 Z" fill="${COLORS.bubblegum}"/></g>`
  };
  const inner = G[key] || G.boots;
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" class="${cls}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inner}</svg>`;
}

// ---- the Expedition's hillside (RUN18C C2) ---------------------------------
// The trail was four buttons in a column. It is a PLACE now: one drawn scene in the house
// sticker style with a winding path across it, and the markers/portraits positioned along
// the real path at runtime via getPointAtLength — so the geometry below is the single
// source of truth for where a node sits and where a Boo walks.
// TWO scenes, not one. A 1000x560 hillside on a phone held upright is 209px tall — the
// markers were bigger than the country they stood in and three of the four escaped it. The
// portrait scene is the same hillside walked upwards, so a phone gets a map the size of its
// screen instead of a letterbox. Everything else (markers, walkers, camp) reads whichever
// geometry is live, so there is still exactly one source of truth per orientation.
export const TRAIL_VIEWS = {
  land: { w: 1000, h: 560 },
  port: { w: 620, h: 1000 }
};
// The path keeps clear of the top edge on purpose: every marker stands ABOVE its point,
// so a path that climbed to the very top would post the Boo Hotel's sign off the map.
export const TRAIL_PATHS = {
  land: 'M 88 442 C 180 478 246 430 286 382 C 326 334 314 292 380 268 C 448 244 520 288 584 268 C 646 249 660 214 736 202 C 800 192 858 214 918 196',
  port: 'M 96 926 C 206 956 288 896 302 812 C 316 728 214 692 236 604 C 258 516 386 520 408 446 C 428 378 330 320 356 244 C 378 178 452 168 520 146'
};
// where each node sits on that path, as a fraction of its length
export const TRAIL_NODE_ATS = {
  land: [0.055, 0.36, 0.655, 0.945],
  port: [0.05, 0.355, 0.65, 0.945]
};
// Back-compat names for the landscape geometry (nothing outside the trail reads these).
export const TRAIL_VIEW = TRAIL_VIEWS.land;
export const TRAIL_PATH_D = TRAIL_PATHS.land;
export const TRAIL_NODE_AT = TRAIL_NODE_ATS.land;

// ---- RUN18D D4: the last emoji out of the scenes ----------------------------------
// CLAUDE.md: no emoji-as-art in game scenes. Emoji stay ALLOWED in UI chrome — What's New
// icons, button glyphs, journal stamps — because there they are typography. Inside a scene
// they are somebody else's drawings sitting in the middle of ours, and they change shape
// depending on whose tablet it is.
//
// Two sets, both 24x24 on the house palette with the house ink line:
//   renderLessonGlyph — Teach Me's nine lesson badges AND the nine scene tags its HOOK
//     stage wears. One map, because `clock` and the cake slice were in both.
//   renderStudioGlyph — the four Boo Studio tiles.
// ---- RUN18D (playtest critic, D4 pass): the Picky Grumps' eight toppings ---------------
// Two faults in one. They were emoji — the puzzle's primary tappable objects, sitting 40px
// under a Grump that D4 had just drawn — and FOUR of the eight contradicted the very
// attribute the puzzle grades on: 🍇 is declared `colour:'green'` and renders PURPLE, 🍏 is
// declared `shape:'long'` and is a whole round apple, 🍬 is declared `'long'` and is a round
// sweet, 🥬 is declared `'round'` and is a leafy bundle. A child told "that Grump only wants
// green ones", who then avoids the purple grapes, is playing the picture and being marked
// wrong by the data.
// data/expedition.js is untouched — it is authored content. Every drawing here is built to
// match its OWN row: red or green, round or long, and its name says sweet or savoury.
// ---- RUN18D D9: the Gallery is a ROOM ----------------------------------------------
// It was the town's night-sky gradient with figures floating on invisible discs — the same
// backdrop as a field, for the one place in the app whose whole subject is "look at what
// you have collected". A museum interior instead: a cream wall band with a wainscot line,
// a skirting shadow, and a spotlight cone over every plinth position. Drawn once, sized to
// the room, and painted UNDER everything so nothing has to move.
export function renderMuseumRoom(w, h, spots = []) {
  const W = Math.max(320, Math.round(w)), H = Math.max(200, Math.round(h));
  const floorY = Math.round(H * 0.66);
  const wainscotY = Math.round(H * 0.52);
  const cones = spots.map((x, i) => {
    const cx = Math.round(x);
    const top = Math.round(H * 0.06);
    const halfTop = 14, halfBottom = Math.round(Math.min(78, W * 0.09));
    return `<g class="gm-cone" style="--i:${i}">
      <path d="M${cx - halfTop} ${top} L${cx + halfTop} ${top} L${cx + halfBottom} ${floorY + 14} L${cx - halfBottom} ${floorY + 14} Z" fill="url(#gmBeam)"/>
      <ellipse cx="${cx}" cy="${floorY + 14}" rx="${halfBottom}" ry="10" fill="#FFF6DE" opacity="0.16"/>
      <rect x="${cx - 13}" y="${top - 9}" width="26" height="9" rx="3" fill="#4A3F6B"/>
    </g>`;
  }).join('');
  return `<svg class="gm-room" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <linearGradient id="gmBeam" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#FFF6DE" stop-opacity="0.30"/>
        <stop offset="100%" stop-color="#FFF6DE" stop-opacity="0.02"/>
      </linearGradient>
      <linearGradient id="gmWall" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#F6EDDD"/><stop offset="100%" stop-color="#EADFC9"/>
      </linearGradient>
    </defs>
    <rect x="0" y="0" width="${W}" height="${floorY}" fill="url(#gmWall)"/>
    <rect x="0" y="${wainscotY}" width="${W}" height="${floorY - wainscotY}" fill="#DFCFB2"/>
    <rect x="0" y="${wainscotY - 5}" width="${W}" height="6" fill="#B9A483"/>
    <rect x="0" y="${floorY - 7}" width="${W}" height="8" fill="#8A7658"/>
    <rect x="0" y="${floorY}" width="${W}" height="${H - floorY}" fill="#A98C63"/>
    <rect x="0" y="${floorY}" width="${W}" height="14" fill="#000" opacity="0.14"/>
    ${cones}
  </svg>`;
}

export function renderTopping(id, { size = 40, cls = '' } = {}) {
  const ink = `stroke="${INK}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"`;
  const thin = `stroke="${INK}" stroke-width="1.1" stroke-linejoin="round" stroke-linecap="round"`;
  const RED = '#E8484A', GREEN = '#7FC85F', LEAF = '#3E8B50';
  const G = {
    // red · round · sweet
    strawberry: `<g><path d="M12 21.4 Q4.2 16.6 4.6 11.2 Q5 6.6 12 7 Q19 6.6 19.4 11.2 Q19.8 16.6 12 21.4 Z" fill="${RED}" ${ink}/>
      <circle cx="9" cy="11.4" r="0.9" fill="#FFF3E0"/><circle cx="14.6" cy="11" r="0.9" fill="#FFF3E0"/>
      <circle cx="11.8" cy="15" r="0.9" fill="#FFF3E0"/><circle cx="15.6" cy="15.4" r="0.9" fill="#FFF3E0"/>
      <circle cx="8" cy="15.6" r="0.9" fill="#FFF3E0"/>
      <path d="M7.6 6.6 L12 4 L16.4 6.6 Q12 8.4 7.6 6.6 Z" fill="${LEAF}" ${thin}/>
      <path d="M12 4 L12 1.8" ${thin}/></g>`,
    // red · round · savoury
    tomato: `<g><circle cx="12" cy="13.4" r="7.8" fill="${RED}" ${ink}/>
      <path d="M12 6 q-1 -2.6 -3.6 -3 M12 6 q1 -2.6 3.6 -3 M12 6 l0 -3.4" fill="none" stroke="${LEAF}" stroke-width="2" stroke-linecap="round"/>
      <ellipse cx="9.2" cy="11" rx="1.8" ry="1.2" fill="#FFF3E0" opacity="0.6"/></g>`,
    // red · LONG · sweet — a twisted lace, and it really is long
    'raspberry-lace': `<g><path d="M3.4 6.6 Q7 12 3.4 17.4" fill="none" stroke="${RED}" stroke-width="3.4" stroke-linecap="round"/>
      <path d="M9 6.6 Q12.6 12 9 17.4" fill="none" stroke="${RED}" stroke-width="3.4" stroke-linecap="round"/>
      <path d="M14.6 6.6 Q18.2 12 14.6 17.4" fill="none" stroke="${RED}" stroke-width="3.4" stroke-linecap="round"/>
      <path d="M20.2 6.6 Q22.6 12 20.2 17.4" fill="none" stroke="${RED}" stroke-width="3.4" stroke-linecap="round"/>
      <path d="M2.6 12 L21.4 12" ${thin} opacity="0.45"/></g>`,
    // red · LONG · savoury
    'pepper-stick': `<g><path d="M3.4 8.6 Q8 6.6 13.4 8.4 Q19.4 10.4 21.6 15 Q22.6 17.6 20.4 18.6 Q18 19.6 16.6 17.4 Q14.4 13.6 9.4 12.6 Q4.6 11.8 3.2 11.4 Q1.4 10.8 1.6 9.8 Q1.8 8.8 3.4 8.6 Z" fill="${RED}" ${ink}/>
      <path d="M3.2 9 q-1.6 -2.4 0.6 -3.8" fill="none" stroke="${LEAF}" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M6.4 10.2 Q12.6 11.6 17.4 15.6" fill="none" stroke="#FFF3E0" stroke-width="1.2" stroke-linecap="round" opacity="0.7"/></g>`,
    // GREEN · round · sweet — a green grape, because the row says green
    grape: `<g><circle cx="12" cy="13.6" r="7.6" fill="${GREEN}" ${ink}/>
      <circle cx="9.6" cy="11.4" r="2" fill="#B8E39A" opacity="0.85"/>
      <path d="M12 6 L12 2.6" stroke="${COLORS.cocoa}" stroke-width="2" stroke-linecap="round"/>
      <path d="M12.2 4 Q16 2.2 17.4 4.8 Q15 6.4 12.2 4 Z" fill="${LEAF}" ${thin}/></g>`,
    // green · round · savoury
    sprout: `<g><circle cx="12" cy="13.4" r="7.6" fill="${GREEN}" ${ink}/>
      <path d="M12 5.8 L12 21" ${thin}/>
      <path d="M4.6 13.4 Q12 10.6 19.4 13.4" fill="none" ${thin}/>
      <path d="M6 17.6 Q12 15.4 18 17.6" fill="none" ${thin}/>
      <path d="M12 5.8 q-2.4 -1.6 -1.2 -3.6 q2.4 0.4 2.4 3.6" fill="${LEAF}" ${thin}/></g>`,
    // GREEN · LONG · sweet — a SLICE, a crescent wedge, not a whole apple
    'apple-slice': `<g><path d="M2.2 9.6 Q12 4.4 21.8 9.6 Q12 12.6 2.2 9.6 Z" fill="#EAF7DC" ${ink}/>
      <path d="M2.2 9.6 Q12 4.4 21.8 9.6" fill="none" stroke="${GREEN}" stroke-width="3" stroke-linecap="round"/>
      <path d="M2.6 10.6 Q12 15.4 21.4 10.6" fill="none" ${thin} opacity="0.5"/>
      <ellipse cx="9.4" cy="9.2" rx="0.9" ry="1.5" fill="${COLORS.cocoa}"/>
      <ellipse cx="14.4" cy="9.2" rx="0.9" ry="1.5" fill="${COLORS.cocoa}"/></g>`,
    // green · LONG · savoury
    cucumber: `<g><rect x="3" y="8.6" width="18" height="7" rx="3.5" fill="${GREEN}" ${ink} transform="rotate(-18 12 12)"/>
      <path d="M6.4 12.6 L8.2 11.4 M10.4 11.2 L12.2 10 M14.4 9.8 L16.2 8.6" ${thin} transform="rotate(-18 12 12)"/>
      <path d="M4.6 10.4 Q12 8.4 19.4 10.4" fill="none" stroke="#B8E39A" stroke-width="1.2" stroke-linecap="round" transform="rotate(-18 12 12)" opacity="0.8"/></g>`
  };
  const inner = G[id] || G.strawberry;
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" class="${cls}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inner}</svg>`;
}

export function renderLessonGlyph(key, { size = 40, cls = '' } = {}) {
  const ink = `stroke="${INK}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"`;
  const thin = `stroke="${INK}" stroke-width="1.1" stroke-linejoin="round" stroke-linecap="round"`;
  const G = {
    // place value: three blocks stacked into a tower, biggest at the bottom
    tower: `<g><rect x="4.4" y="15.2" width="15.2" height="5.6" rx="1.2" fill="${COLORS.bubblegum}" ${ink}/>
      <rect x="6.6" y="9.6" width="10.8" height="5.6" rx="1.2" fill="${COLORS.teal}" ${ink}/>
      <rect x="8.8" y="4" width="6.4" height="5.6" rx="1.2" fill="${COLORS.gold}" ${ink}/></g>`,
    // bridging through ten: a coil under a ball. Drawn as four stacked loops rather than
    // one continuous squiggle, which at 44px read as a scribble and named nothing.
    spring: `<g><path d="M4.6 20.4 L19.4 20.4" ${ink}/>
      <ellipse cx="12" cy="18" rx="6" ry="1.9" fill="none" ${ink}/>
      <ellipse cx="12" cy="14.6" rx="6" ry="1.9" fill="none" ${ink}/>
      <ellipse cx="12" cy="11.2" rx="6" ry="1.9" fill="none" ${ink}/>
      <circle cx="12" cy="6" r="3.8" fill="${COLORS.bubblegum}" ${ink}/></g>`,
    // counting in steps: two footprints, sole and toes, walking away from the viewer
    footsteps: `<g><path d="M5.6 4.4 Q9.4 4.4 9.4 7.6 Q9.4 9.8 8.8 11 Q8.2 12.4 7 12.4 Q5 12.4 4.6 10.4 Q4.2 7.6 4.6 6.2 Q5 4.4 5.6 4.4 Z" fill="${COLORS.teal}" ${ink}/>
      <circle cx="4.6" cy="2.6" r="1.1" fill="${COLORS.teal}" ${thin}/><circle cx="7.4" cy="2.2" r="1" fill="${COLORS.teal}" ${thin}/>
      <path d="M14.6 11.6 Q18.4 11.6 18.4 14.8 Q18.4 17 17.8 18.2 Q17.2 19.6 16 19.6 Q14 19.6 13.6 17.6 Q13.2 14.8 13.6 13.4 Q14 11.6 14.6 11.6 Z" fill="${COLORS.bubblegum}" ${ink}/>
      <circle cx="13.6" cy="9.8" r="1.1" fill="${COLORS.bubblegum}" ${thin}/><circle cx="16.4" cy="9.4" r="1" fill="${COLORS.bubblegum}" ${thin}/></g>`,
    // fractions AND sharing: a round cake cut in quarters with ONE quarter lifted out.
    // The side-on slice it replaced read as a party hat at 44px, and a whole cut into
    // parts is what the lesson is actually about.
    cakeslice: `<g><path d="M11 12.4 L11 3.4 A9 9 0 0 0 2.4 12.4 Z" fill="${COLORS.cream}" ${ink}/>
      <path d="M11 13.4 L11 21.4 A9 9 0 0 1 2.4 13.4 Z" fill="${COLORS.cream}" ${ink}/>
      <path d="M12 13.4 L20.6 13.4 A9 9 0 0 1 12 21.4 Z" fill="${COLORS.cream}" ${ink}/>
      <path d="M14.6 9.4 L14.6 1.8 A9 9 0 0 1 22.8 9.4 Z" fill="${COLORS.bubblegum}" ${ink}/></g>`,
    // arrays: five dots, die-style
    dotsgrid: `<g><rect x="3.4" y="3.4" width="17.2" height="17.2" rx="3.4" fill="${COLORS.cream}" ${ink}/>
      <circle cx="8" cy="8" r="1.8" fill="${INK}"/><circle cx="16" cy="8" r="1.8" fill="${INK}"/>
      <circle cx="12" cy="12" r="1.8" fill="${INK}"/>
      <circle cx="8" cy="16" r="1.8" fill="${INK}"/><circle cx="16" cy="16" r="1.8" fill="${INK}"/></g>`,
    // telling the time: the Clock Shop's own clock
    clock: `<g><circle cx="12" cy="12" r="8.8" fill="${COLORS.cream}" ${ink}/>
      <path d="M12 4.6 L12 6 M19.4 12 L18 12 M12 19.4 L12 18 M4.6 12 L6 12" ${thin}/>
      <path d="M12 12 L12 7.2" ${ink}/>
      <path d="M12 12 L15.6 13.8" stroke="${COLORS.bubblegum}" stroke-width="1.6" stroke-linecap="round"/>
      <circle cx="12" cy="12" r="1.1" fill="${INK}"/></g>`,
    // sounds in words: an open mouth mid-sound — upper teeth, dark throat, tongue
    mouth: `<g><path d="M2.6 11.6 Q12 3.6 21.4 11.6 Q12 20.4 2.6 11.6 Z" fill="#5B2540" ${ink}/>
      <path d="M4.6 10.6 Q12 5.4 19.4 10.6 Z" fill="${COLORS.cream}" ${ink}/>
      <path d="M8.4 6.8 L8.4 9.6 M12 5.8 L12 9 M15.6 6.8 L15.6 9.6" ${thin}/>
      <path d="M8 15.6 Q12 12.6 16 15.6 Q12 18.6 8 15.6 Z" fill="${COLORS.bubblegum}" ${thin}/></g>`,
    // sound twins: two of the same little face
    twins: `<g><circle cx="8" cy="12" r="6" fill="${COLORS.gold}" ${ink}/>
      <circle cx="6.2" cy="11" r="1" fill="${INK}"/><circle cx="9.6" cy="11" r="1" fill="${INK}"/>
      <path d="M6.2 14.2 q1.8 1.4 3.6 0" fill="none" ${thin}/>
      <circle cx="16" cy="12" r="6" fill="${COLORS.teal}" ${ink}/>
      <circle cx="14.2" cy="11" r="1" fill="${INK}"/><circle cx="17.6" cy="11" r="1" fill="${INK}"/>
      <path d="M14.2 14.2 q1.8 1.4 3.6 0" fill="none" ${thin}/></g>`,
    // syllable hills: a hill with a little flag on top
    hill: `<g><path d="M1.8 19.6 Q7.6 8.6 12 8.6 Q16.4 8.6 22.2 19.6 Z" fill="#7FC85F" ${ink}/>
      <path d="M12 8.6 L12 3" ${ink}/>
      <path d="M12 3.4 L17.4 5.2 L12 7 Z" fill="${COLORS.bubblegum}" ${ink}/></g>`,
    // a little boat on the water
    boat: `<g><path d="M2.4 15.6 L21.6 15.6 L18.6 19.8 L5.4 19.8 Z" fill="${COLORS.cocoa}" ${ink}/>
      <path d="M12 14.8 L12 3.4" ${ink}/>
      <path d="M12.9 4.2 Q19.4 8 12.9 13.4 Z" fill="${COLORS.cream}" ${ink}/>
      <path d="M2 18 q2.4 -1.4 4.6 0 M17.4 18 q2.4 -1.4 4.6 0" fill="none" stroke="#7FC7E8" stroke-width="1.2" stroke-linecap="round"/></g>`,
    // a Boo who does not follow: a question on a disc
    confused: `<g><circle cx="12" cy="12" r="8.8" fill="${COLORS.lilac}" ${ink}/>
      <path d="M9.2 9.4 Q9.6 6.6 12.2 6.6 Q15 6.6 15 9.2 Q15 11.4 12.4 12.2 L12.4 14" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>
      <circle cx="12.4" cy="17" r="1.4" fill="${INK}"/></g>`,
    // the story told backwards: a loop that turns the other way
    backwards: `<g><path d="M19 12 A7 7 0 1 0 12 19" fill="none" stroke="${INK}" stroke-width="2.2" stroke-linecap="round"/>
      <path d="M15.4 19.6 L11.4 19 L13.4 15.6 Z" fill="${COLORS.gold}" ${ink}/></g>`,
    // numbers in a muddle: three tiles at three angles
    muddle: `<g><rect x="2.6" y="9" width="7.6" height="7.6" rx="1.4" fill="${COLORS.gold}" ${ink} transform="rotate(-14 6.4 12.8)"/>
      <rect x="8.6" y="4.6" width="7.6" height="7.6" rx="1.4" fill="${COLORS.teal}" ${ink} transform="rotate(11 12.4 8.4)"/>
      <rect x="13" y="11.4" width="7.6" height="7.6" rx="1.4" fill="${COLORS.bubblegum}" ${ink} transform="rotate(-8 16.8 15.2)"/></g>`,
    // hopping along: three arcs and a footprint
    hop: `<g><path d="M2.6 18 Q5.6 10.6 8.6 18 Q11.6 10.6 14.6 18 Q17.6 10.6 20.6 18" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round" stroke-dasharray="0.1 3.2"/>
      <ellipse cx="20" cy="19.4" rx="2.4" ry="1.6" fill="${COLORS.teal}" ${thin}/>
      <ellipse cx="4" cy="19.4" rx="2.4" ry="1.6" fill="${COLORS.bubblegum}" ${thin}/></g>`,
    // the shop: an awning over a door
    shop: `<g><rect x="4" y="9.4" width="16" height="11" rx="1.4" fill="${COLORS.cream}" ${ink}/>
      <path d="M2.6 9.4 L5.4 4.6 L18.6 4.6 L21.4 9.4 Z" fill="${COLORS.bubblegum}" ${ink}/>
      <path d="M7.8 4.6 L6.6 9.4 M12 4.6 L12 9.4 M16.2 4.6 L17.4 9.4" ${thin}/>
      <rect x="9.6" y="13" width="4.8" height="7.4" rx="0.8" fill="${COLORS.cocoa}" ${ink}/></g>`,
    // a very long word: an unrolled scroll
    long: `<g><path d="M4.6 5.6 h14.8 v12.8 h-14.8 z" fill="${COLORS.sand}" ${ink}/>
      <path d="M4.6 5.6 q-2 3 0 6 M19.4 12.8 q2 3 0 5.6" fill="none" ${ink}/>
      <path d="M7.6 9 L16.4 9 M7.6 12 L16.4 12 M7.6 15 L13.4 15" ${thin}/></g>`,
    // RUN18E L6: the Word Factory — three joined blocks (parts) under a stamp arm
    factory: `<g><rect x="3.4" y="12.4" width="17.2" height="8" rx="1.4" fill="${COLORS.sand}" ${ink}/>
      <rect x="5.6" y="7" width="4.6" height="5.6" fill="${COLORS.bubblegum}" ${ink}/>
      <rect x="10.6" y="7" width="4.6" height="5.6" fill="${COLORS.gold}" ${ink}/>
      <path d="M17.4 4 v4.4" ${ink}/><rect x="15.4" y="8" width="4" height="2.6" rx="0.6" fill="${COLORS.teal}" ${ink}/></g>`,
    // RUN18E L6: the Flying Comma — a comma mid-flight with a little motion arc
    apostrophe: `<g><path d="M12.4 4.4 q2.4 -1.4 2.4 1.6 q0 2.6 -2.4 4.6" fill="${COLORS.bubblegum}" ${ink}/>
      <path d="M4.6 17 q4 -2.6 8 0" fill="none" ${thin}/></g>`
  };
  G.share = G.cakeslice;   // the sharing hook and the fractions lesson are the same cake
  const inner = G[key] || G.dotsgrid;
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" class="${cls}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inner}</svg>`;
}

export function renderStudioGlyph(key, { size = 48, cls = '' } = {}) {
  const ink = `stroke="${INK}" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"`;
  const thin = `stroke="${INK}" stroke-width="1.1" stroke-linejoin="round" stroke-linecap="round"`;
  const G = {
    // Paint a Boo: the Studio's own easel, with a brush
    paint: `<g><path d="M6.4 20.6 L9.6 14 M17.6 20.6 L14.4 14 M12 15 L12 20.6" ${ink}/>
      <rect x="3.6" y="3" width="16.8" height="11.6" rx="1.4" fill="${COLORS.cream}" ${ink}/>
      <path d="M5.6 12.4 Q9 7 12.6 10.4 Q15.4 13 18.4 9.6" fill="none" stroke="${COLORS.teal}" stroke-width="1.8" stroke-linecap="round"/>
      <circle cx="8.4" cy="6.4" r="1.8" fill="${COLORS.gold}" ${thin}/></g>`,
    // Collage: torn paper shapes, overlapping
    collage: `<g><path d="M2.8 8.6 L10.4 5 L13.4 12.4 L5 15.6 Z" fill="${COLORS.gold}" ${ink}/>
      <circle cx="16.4" cy="8.6" r="5" fill="${COLORS.teal}" ${ink}/>
      <path d="M8 14 L18.6 12.6 L16.4 20.8 L6.6 19.6 Z" fill="${COLORS.bubblegum}" ${ink}/></g>`,
    // Build a Boo: a Boo face whose head is made of two puzzle parts
    buildaboo: `<g><path d="M4.4 11.6 Q4.4 3.6 12 3.6 Q19.6 3.6 19.6 11.6 L19.6 17.4 Q19.6 20.6 16.6 20.6 Q14.6 20.6 14 19 Q13.2 20.6 12 20.6 Q10.8 20.6 10 19 Q9.4 20.6 7.4 20.6 Q4.4 20.6 4.4 17.4 Z" fill="${COLORS.lilac}" ${ink}/>
      <path d="M12 3.8 L12 20.4" stroke="${INK}" stroke-width="1.2" stroke-dasharray="2 2"/>
      <path d="M12 10.4 q2.2 0 2.2 1.6 q0 1.6 -2.2 1.6" fill="none" ${thin}/>
      <circle cx="8.8" cy="10.8" r="1.7" fill="${COLORS.cream}" ${thin}/><circle cx="8.8" cy="11.1" r="0.9" fill="${INK}"/>
      <circle cx="15.6" cy="10.8" r="1.7" fill="${COLORS.cream}" ${thin}/><circle cx="15.6" cy="11.1" r="0.9" fill="${INK}"/></g>`,
    // My Gallery: a framed picture with a star on the frame
    gallery: `<g><rect x="3" y="4.6" width="18" height="14.4" rx="1.6" fill="${COLORS.sand}" ${ink}/>
      <rect x="5.6" y="7" width="12.8" height="9.6" rx="0.8" fill="${COLORS.cream}" ${ink}/>
      <path d="M6.4 15.4 Q9.4 10 12.4 13.2 Q14.6 15.4 17.6 12.2" fill="none" stroke="${COLORS.teal}" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M18.6 2 l1.1 2.3 2.5 .3 -1.8 1.8 .4 2.5 -2.2 -1.2 -2.2 1.2 .4 -2.5 -1.8 -1.8 2.5 -.3 z" fill="${COLORS.gold}" ${thin}/></g>`
  };
  const inner = G[key] || G.paint;
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" class="${cls}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inner}</svg>`;
}

export function renderTrailScene(mode = 'land') {
  const port = mode === 'port';
  const { w, h } = TRAIL_VIEWS[port ? 'port' : 'land'];
  const d = TRAIL_PATHS[port ? 'port' : 'land'];
  const ink = `stroke="${INK}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"`;
  const tree = (x, y, s, dark) => `<g transform="translate(${x},${y}) scale(${s})">
    <rect x="-5" y="14" width="10" height="18" rx="3" fill="${COLORS.cocoa}" ${ink}/>
    <path d="M0 -34 Q26 6 0 6 Q-26 6 0 -34 Z" fill="${dark ? '#4F9A55' : '#6FBF77'}" ${ink}/>
    <path d="M0 -14 Q22 20 0 20 Q-22 20 0 -14 Z" fill="${dark ? '#5AA664' : '#7FC85F'}" ${ink}/></g>`;
  const bush = (x, y, s) => `<g transform="translate(${x},${y}) scale(${s})"><path d="M-22 8 Q-24 -12 -8 -12 Q-2 -24 10 -16 Q26 -18 24 2 Q26 10 12 10 Z" fill="#66B052" ${ink}/></g>`;
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid meet" width="100%" height="100%" class="exp-scene" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <defs>
      <linearGradient id="expSky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#8FC7FF"/><stop offset="0.55" stop-color="#BFE6F5"/><stop offset="1" stop-color="#FFE7AD"/>
      </linearGradient>
      <clipPath id="expClip"><rect x="0" y="0" width="${w}" height="${h}" rx="26"/></clipPath>
    </defs>
    <g clip-path="url(#expClip)">
      <rect width="${w}" height="${h}" fill="url(#expSky)"/>
      ${port ? `
      <circle cx="122" cy="112" r="44" fill="${COLORS.gold}" ${ink}/>
      <g class="exp-clouds">
        <g class="exp-cloud c1"><ellipse cx="300" cy="96" rx="52" ry="23" fill="#FFFFFF"/><ellipse cx="344" cy="88" rx="36" ry="18" fill="#FFFFFF"/></g>
        <g class="exp-cloud c2" opacity="0.85"><ellipse cx="180" cy="250" rx="42" ry="18" fill="#FFFFFF"/><ellipse cx="146" cy="256" rx="28" ry="13" fill="#FFFFFF"/></g>
      </g>
      <path d="M-20 330 Q 140 250 320 316 Q 480 374 640 306 L640 ${h} L-20 ${h} Z" fill="#8FCB9B" ${ink}/>
      <path d="M-20 470 Q 160 392 330 470 Q 500 544 640 470 L640 ${h} L-20 ${h} Z" fill="#6FBF77" ${ink}/>
      <path d="M-20 664 Q 170 592 340 668 Q 500 738 640 672 L640 ${h} L-20 ${h} Z" fill="#7FC85F" ${ink}/>
      <path d="M470 480 Q 500 566 452 636 Q 410 700 448 ${h + 10}" fill="none" stroke="#7FC7E8" stroke-width="20" stroke-linecap="round"/>
      ${tree(96, 648, 1.0, true)}${bush(196, 736, 1.0)}${tree(534, 636, 0.86)}
      ${tree(150, 452, 0.82)}${bush(492, 508, 0.85)}${tree(560, 356, 0.9, true)}
      ${tree(90, 852, 0.9)}${bush(300, 900, 0.95)}${tree(556, 812, 0.78, true)}
      ` : `
      <circle cx="176" cy="88" r="44" fill="${COLORS.gold}" ${ink}/>
      <g class="exp-clouds">
        <g class="exp-cloud c1"><ellipse cx="380" cy="76" rx="54" ry="24" fill="#FFFFFF"/><ellipse cx="428" cy="68" rx="38" ry="19" fill="#FFFFFF"/></g>
        <g class="exp-cloud c2" opacity="0.85"><ellipse cx="600" cy="52" rx="44" ry="19" fill="#FFFFFF"/><ellipse cx="562" cy="58" rx="30" ry="14" fill="#FFFFFF"/></g>
      </g>
      <path d="M-20 250 Q 130 158 300 226 Q 470 292 640 206 Q 800 126 1020 214 L1020 ${h} L-20 ${h} Z" fill="#8FCB9B" ${ink}/>
      <path d="M-20 320 Q 180 232 360 306 Q 560 386 760 288 Q 900 222 1020 288 L1020 ${h} L-20 ${h} Z" fill="#6FBF77" ${ink}/>
      <path d="M-20 392 Q 200 336 420 400 Q 640 462 840 386 Q 940 348 1020 380 L1020 ${h} L-20 ${h} Z" fill="#7FC85F" ${ink}/>
      <path d="M636 300 Q 618 372 664 428 Q 700 476 686 ${h + 10}" fill="none" stroke="#7FC7E8" stroke-width="20" stroke-linecap="round"/>
      ${tree(118, 386, 1.05, true)}${tree(196, 414, 0.82)}${bush(300, 468, 1.1)}
      ${tree(486, 352, 0.9, true)}${bush(548, 402, 0.85)}
      ${tree(824, 300, 1.0)}${tree(892, 322, 0.76, true)}${bush(960, 366, 0.9)}
      `}
      <!-- THE PATH: a sand ribbon with an ink edge and a dashed centre stitch -->
      <path d="${d}" fill="none" stroke="${INK}" stroke-width="40" stroke-linecap="round" opacity="0.22"/>
      <path class="exp-path" d="${d}" fill="none" stroke="${COLORS.sand}" stroke-width="32" stroke-linecap="round"/>
      <path d="${d}" fill="none" stroke="#FFF6DE" stroke-width="4" stroke-linecap="round" stroke-dasharray="14 20" opacity="0.85"/>
    </g>
    <rect x="2" y="2" width="${w - 4}" height="${h - 4}" rx="26" fill="none" ${ink} stroke-width="6"/>
  </svg>`;
}

// ---- Build-a-Boo custom renderer (RUN3 C6) ----
// A parametric Boo from parts: body (4), ears (5), eyes (4), mouth (4), tail (3),
// pattern + a colour. Cute rules: big low eyes, wide body, oversized ears, thick outlines.
export const BUILD_PARTS = {
  body: ['round', 'tall', 'wide', 'blob'],
  ears: ['none', 'small', 'tall', 'floppy', 'round'],
  eyes: ['round', 'sleepy', 'star', 'wink'],
  mouth: ['smile', 'grin', 'oh', 'fang'],
  tail: ['none', 'curl', 'puff'],
  pattern: ['none', 'spots', 'stripes', 'heart'],
  colour: ['#FF7AC6', '#C6A9F0', '#8FC7FF', '#35D0BA', '#FFC93C', '#FF9F68', '#7FD8C3', '#B39DFF', '#FF8FB1', '#9AE6B4', '#FFD166', '#8A5A44']
};
export function normalizeCustom(p = {}) {
  return {
    body: BUILD_PARTS.body.includes(p.body) ? p.body : 'round',
    ears: BUILD_PARTS.ears.includes(p.ears) ? p.ears : 'round',
    eyes: BUILD_PARTS.eyes.includes(p.eyes) ? p.eyes : 'round',
    mouth: BUILD_PARTS.mouth.includes(p.mouth) ? p.mouth : 'smile',
    tail: BUILD_PARTS.tail.includes(p.tail) ? p.tail : 'none',
    pattern: BUILD_PARTS.pattern.includes(p.pattern) ? p.pattern : 'none',
    colour: /^#?[0-9A-Fa-f]{6}$/.test(String(p.colour || '')) ? (p.colour[0] === '#' ? p.colour : '#' + p.colour) : BUILD_PARTS.colour[0]
  };
}
export function renderCustomBoo(partsIn, { size = 120, cls = '' } = {}) {
  const p = normalizeCustom(partsIn);
  const ink = '#2A1B4E', fill = p.colour;
  const dark = shade(fill, -0.22), light = shade(fill, 0.28);
  const cid = 'cust' + (++_uid);
  // body silhouette per shape
  const bodies = {
    round: `<ellipse cx="60" cy="70" rx="42" ry="40"/>`,
    tall:  `<ellipse cx="60" cy="68" rx="34" ry="46"/>`,
    wide:  `<ellipse cx="60" cy="74" rx="48" ry="34"/>`,
    blob:  `<path d="M18 74 Q14 40 44 34 Q60 30 76 34 Q106 40 102 74 Q104 104 60 106 Q16 104 18 74 Z"/>`
  };
  const bodyShape = bodies[p.body];
  // ears (two, mirrored) behind the body
  const earShapes = {
    none: '',
    small: `<ellipse cx="34" cy="40" rx="10" ry="12"/><ellipse cx="86" cy="40" rx="10" ry="12"/>`,
    tall:  `<ellipse cx="34" cy="26" rx="9" ry="20"/><ellipse cx="86" cy="26" rx="9" ry="20"/>`,
    floppy:`<path d="M30 30 Q18 44 30 54 Q40 50 40 38 Z"/><path d="M90 30 Q102 44 90 54 Q80 50 80 38 Z"/>`,
    round: `<circle cx="32" cy="38" r="14"/><circle cx="88" cy="38" r="14"/>`
  };
  const ears = earShapes[p.ears];
  // eyes (low on the face)
  const ex = 46, ex2 = 74, ey = 66, er = 9;
  const eyeShapes = {
    round: `<circle cx="${ex}" cy="${ey}" r="${er}" fill="#fff" stroke="${ink}" stroke-width="2"/><circle cx="${ex2}" cy="${ey}" r="${er}" fill="#fff" stroke="${ink}" stroke-width="2"/><circle cx="${ex}" cy="${ey + 1}" r="4.5" fill="${ink}"/><circle cx="${ex2}" cy="${ey + 1}" r="4.5" fill="${ink}"/><circle cx="${ex + 2}" cy="${ey - 1}" r="1.6" fill="#fff"/><circle cx="${ex2 + 2}" cy="${ey - 1}" r="1.6" fill="#fff"/>`,
    sleepy: `<path d="M${ex - 8} ${ey} q8 6 16 0" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/><path d="M${ex2 - 8} ${ey} q8 6 16 0" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`,
    star: starEye(ex, ey) + starEye(ex2, ey),
    wink: `<circle cx="${ex}" cy="${ey}" r="${er}" fill="#fff" stroke="${ink}" stroke-width="2"/><circle cx="${ex}" cy="${ey + 1}" r="4.5" fill="${ink}"/><path d="M${ex2 - 8} ${ey} q8 6 16 0" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`
  };
  const eyes = eyeShapes[p.eyes];
  const mouths = {
    smile: `<path d="M52 84 q8 8 16 0" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/>`,
    grin:  `<path d="M50 82 q10 12 20 0 Z" fill="#fff" stroke="${ink}" stroke-width="2.5" stroke-linejoin="round"/>`,
    oh:    `<ellipse cx="60" cy="86" rx="6" ry="7" fill="${ink}"/>`,
    fang:  `<path d="M52 84 q8 8 16 0" fill="none" stroke="${ink}" stroke-width="3" stroke-linecap="round"/><path d="M56 85 l2 5 2-5 Z" fill="#fff" stroke="${ink}" stroke-width="1"/>`
  };
  const mouth = mouths[p.mouth];
  const tails = {
    none: '',
    curl: `<path d="M100 84 q18 2 14 18 q-2 10 -12 8" fill="none" stroke="${ink}" stroke-width="6" stroke-linecap="round"/>`,
    puff: `<circle cx="106" cy="88" r="12" fill="${light}" stroke="${ink}" stroke-width="3"/>`
  };
  const tail = tails[p.tail];
  // pattern clipped to the body
  let pat = '';
  if (p.pattern === 'spots') pat = `<g clip-path="url(#${cid})"><circle cx="44" cy="66" r="7" fill="${dark}"/><circle cx="76" cy="58" r="6" fill="${dark}"/><circle cx="66" cy="86" r="8" fill="${dark}"/><circle cx="40" cy="90" r="5" fill="${dark}"/></g>`;
  else if (p.pattern === 'stripes') pat = `<g clip-path="url(#${cid})"><path d="M20 60 h80 M16 74 h90 M22 88 h74" stroke="${dark}" stroke-width="6" opacity="0.7"/></g>`;
  else if (p.pattern === 'heart') pat = `<g clip-path="url(#${cid})"><path d="M60 92 l-10-10 q-6-7 1-12 q6-4 9 3 q3-7 9-3 q7 5 1 12 Z" fill="${dark}"/></g>`;

  const belly = `<ellipse cx="60" cy="84" rx="20" ry="18" fill="${light}" opacity="0.7"/>`;
  const ar = 1;
  const w = size;
  return `<svg viewBox="0 0 120 120" width="${w}" height="${(w * ar).toFixed(1)}" class="boo-svg custom-boo ${cls}" role="img" aria-label="your custom Boo" xmlns="http://www.w3.org/2000/svg" style="overflow:visible">` +
    `<defs><clipPath id="${cid}">${bodyShape}</clipPath></defs>` +
    `<g fill="${fill}" stroke="${ink}" stroke-width="3.5" stroke-linejoin="round">${ears}</g>` +
    `<g fill="${fill}" stroke="${ink}" stroke-width="4" stroke-linejoin="round">${bodyShape}</g>` +
    belly + pat + `<g>${tail}</g>` + eyes + mouth +
    `</svg>`;
}
function starEye(cx, cy) {
  return `<path d="M${cx} ${cy - 8} l2.4 5 5.4.6 -4 3.8 1.1 5.3 -4.9 -2.8 -4.9 2.8 1.1 -5.3 -4 -3.8 5.4 -.6 Z" fill="#FFC93C" stroke="#2A1B4E" stroke-width="1.2" stroke-linejoin="round"/>`;
}
function shade(hex, amt) {
  const h = hex.replace('#', ''); if (h.length !== 6) return hex;
  let r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  const f = amt < 0 ? (1 + amt) : 1; const add = amt > 0 ? amt * 255 : 0;
  r = Math.max(0, Math.min(255, Math.round(r * f + add))); g = Math.max(0, Math.min(255, Math.round(g * f + add))); b = Math.max(0, Math.min(255, Math.round(b * f + add)));
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
}
