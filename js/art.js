// js/art.js
// The ONE rendering module for all characters and props (spec §3).
// Everything is inline SVG built from layered simple shapes with the sticker look:
// ~4px ink outline + a cream halo. Keep each critter well under ~30 shapes.
// Swapping in a CC0 asset pack later means only replacing this file.

import { BY_ID } from '../data/catalogue.js';

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
function path(d, fill, extra = '') {
  return `<path d="${d}" fill="${fill}" ${extra}/>`;
}
function rrect(x, y, w, h, r, fill, extra = '') {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" ry="${r}" fill="${fill}" ${extra}/>`;
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

function mouth(species) {
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
      path('M60 44 C60 26 74 26 74 16 C74 8 66 8 66 14', 'none', `stroke="${f === HALO ? HALO : bodyFill}" stroke-width="${f===HALO?10:6}" fill="none" ${f===HALO ? '' : `stroke="${INK}"`}`) });
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
// opts.equipArt = an accessory art key (from an equipped accessory item); when set it
// renders instead of the Boo's built-in accessory (spec RUN2 C2: one accessory slot).
export function renderBoo(item, { size = 120, cls = '', equipArt = null } = {}) {
  const bodyFill = c(item.colors.body);
  const bellyFill = item.colors.belly ? c(item.colors.belly) : null;
  const extra = { hood: item.colors.hood ? c(item.colors.hood) : null, wing: item.colors.wing ? c(item.colors.wing) : null };
  const g = speciesGeom(item.species, bodyFill, bellyFill, extra);

  const shapes = [...g.back, g.body];
  const { halo, color } = silhouette(shapes);

  const face = eyes(45, 75, 80, 14, g.eyeKind) +
               cheeks(40, 80, 90) +
               mouth(item.species);

  // a couple of item-specific trinkets
  let trinket = '';
  if (item.id === 'boo_jingle') trinket = `<g class="jingle-bell"><circle cx="60" cy="46" r="6" fill="${COLORS.gold}" stroke="${INK}" stroke-width="2.4"/><circle cx="60" cy="47" r="1.6" fill="${INK}"/></g>`;
  if (item.id === 'boo_pumpkin') trinket = `<path d="M60 34 Q58 22 66 18" fill="none" stroke="#4E8B3A" stroke-width="5" stroke-linecap="round"/><path d="M56 30 Q52 24 46 26" fill="none" stroke="#4E8B3A" stroke-width="3.5" stroke-linecap="round"/>`;

  const booAnchor = { cx: 60, topY: 30, eyeY: 80, earY: 70, R: 45 };
  let accSvg = '';
  if (equipArt) accSvg = accessoryArt(equipArt, booAnchor);
  else if (item.acc && item.acc !== 'none') accSvg = accessory(item.acc) || accessoryArt(item.acc, booAnchor);

  const fxCls = item.fx ? ` fx-${item.fx}` : '';
  return `<svg viewBox="0 0 120 130" width="${size}" height="${size * 130/120}" class="boo-svg${fxCls} ${cls}" role="img" aria-label="${item.name}" xmlns="http://www.w3.org/2000/svg">` +
    halo + color + g.extras + face + trinket + accSvg + fxSparkles(item.fx) +
  `</svg>`;
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
    `role="img" aria-label="${guide.name || 'guide'}" xmlns="http://www.w3.org/2000/svg" style="overflow:${overflow}">${inner}</svg>`;
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
    { fill: bodyFill, svg: (f, s) => `<line x1="49" y1="42" x2="47" y2="22" ${f===HALO?`stroke="${HALO}" stroke-width="10"`:ink(5)} stroke-linecap="round"/>` },
    { fill: bodyFill, svg: (f, s) => `<line x1="71" y1="42" x2="73" y2="22" ${f===HALO?`stroke="${HALO}" stroke-width="10"`:ink(5)} stroke-linecap="round"/>` },
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
export function renderDeco(item, { size = 120, cls = '' } = {}) {
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
    default:
      inner = ell(60, 80, 30, 26, COLORS.lilac, ink);
  }
  return `<svg viewBox="0 0 120 130" width="${size}" height="${size*130/120}" class="deco-svg${fxCls} ${cls}" role="img" aria-label="${item.name}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
}

// ---- public: render an accessory item standalone -------------------------
// Draws the wearable centred on its own, for reveal cards and the wardrobe.
export function renderAccessory(item, { size = 120, cls = '' } = {}) {
  const fxCls = item.fx ? ` fx-${item.fx}` : '';
  const art = accessoryArt(item.art, { cx: 60, topY: 58, eyeY: 66, earY: 64, R: 40 });
  return `<svg viewBox="0 0 120 120" width="${size}" height="${size}" class="acc-svg${fxCls} ${cls}" role="img" aria-label="${item.name}" xmlns="http://www.w3.org/2000/svg">` +
    `<circle cx="60" cy="60" r="52" fill="rgba(255,255,255,0.06)"/>` + art + `</svg>`;
}

// Generic render router used by collection/town.
// opts.equipArt (Boos only) overlays an equipped accessory's art.
export function renderItem(item, opts = {}) {
  if (item.kind === 'deco') return renderDeco(item, opts);
  if (item.kind === 'accessory') return renderAccessory(item, opts);
  return renderBoo(item, opts);
}
