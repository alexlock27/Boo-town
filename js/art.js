// js/art.js
// The ONE rendering module for all characters and props (spec §3).
// Everything is inline SVG built from layered simple shapes with the sticker look:
// ~4px ink outline + a cream halo. Keep each critter well under ~30 shapes.
// Swapping in a CC0 asset pack later means only replacing this file.

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
function eyes(lx, rx, cy, r, kind = 'round') {
  const pupil = (x) => {
    if (kind === 'star') {
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
function speciesGeom(species, bodyFill, bellyFill) {
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

  return { back, body, extras, eyeKind: species === 'sunny' ? 'star' : 'round' };
}

// ---- public: render a Boo -----------------------------------------------
export function renderBoo(item, { size = 120, cls = '' } = {}) {
  const bodyFill = c(item.colors.body);
  const bellyFill = item.colors.belly ? c(item.colors.belly) : null;
  const g = speciesGeom(item.species, bodyFill, bellyFill);

  const shapes = [...g.back, g.body];
  const { halo, color } = silhouette(shapes);

  const face = eyes(45, 75, 80, 14, g.eyeKind) +
               cheeks(40, 80, 90) +
               mouth(item.species);

  const fxCls = item.fx ? ` fx-${item.fx}` : '';
  return `<svg viewBox="0 0 120 130" width="${size}" height="${size * 130/120}" class="boo-svg${fxCls} ${cls}" role="img" aria-label="${item.name}" xmlns="http://www.w3.org/2000/svg">` +
    halo + color + g.extras + face + accessory(item.acc) + fxSparkles(item.fx) +
  `</svg>`;
}

// ---- public: render the guide giraffe -----------------------------------
// guide = { body, patch, acc, name }; view = 'full' | 'head'
export function renderGuide(guide, { size = 200, view = 'full', cls = '' } = {}) {
  const bodyFill = c(guide.body || 'sunshine');
  const patch = c(guide.patch || 'cocoa');
  const face = renderGiraffeFace(bodyFill, patch, guide.acc, view);
  if (view === 'head') {
    return `<svg viewBox="0 0 120 150" width="${size*0.8}" height="${size}" class="guide-svg ${cls}" role="img" aria-label="${guide.name || 'guide'}" xmlns="http://www.w3.org/2000/svg">${face.headOnly}</svg>`;
  }
  return `<svg viewBox="0 0 160 200" width="${size}" height="${size*200/160}" class="guide-svg ${cls}" role="img" aria-label="${guide.name || 'guide'}" xmlns="http://www.w3.org/2000/svg">${face.full}</svg>`;
}

function renderGiraffeFace(bodyFill, patch, acc, view) {
  // Head + neck used in both views; full adds body + legs.
  const ink = (s, w = 4) => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
  const halo = (w = 10) => `stroke="${HALO}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;

  // --- shapes drawn twice (halo then colour) ---
  // ossicones (horns)
  const ossicone = (x) =>
    `<line x1="${x}" y1="40" x2="${x}" y2="24" S/>` ;
  // We build head/neck geometry as reusable string with a placeholder for stroke.
  function headNeck(strokeAttr, fill, isHalo) {
    let s = '';
    // ossicones
    s += `<line x1="52" y1="36" x2="49" y2="18" ${isHalo ? halo(9) : ink(5)}/>`;
    s += `<line x1="70" y1="36" x2="73" y2="18" ${isHalo ? halo(9) : ink(5)}/>`;
    if (!isHalo) {
      s += `<circle cx="49" cy="17" r="5.5" fill="${patch}" ${ink(3)}/>`;
      s += `<circle cx="73" cy="17" r="5.5" fill="${patch}" ${ink(3)}/>`;
    }
    // neck
    s += `<path d="M50 150 Q46 96 58 60 L82 60 Q80 100 78 150 Z" fill="${fill}" ${strokeAttr}/>`;
    // head
    s += `<ellipse cx="62" cy="52" rx="30" ry="26" fill="${fill}" ${strokeAttr}/>`;
    // snout
    s += `<ellipse cx="62" cy="66" rx="18" ry="14" fill="${isHalo ? HALO : lighten(fill)}" ${strokeAttr}/>`;
    return s;
  }

  function headDetails() {
    let s = '';
    // ears
    s += `<ellipse cx="34" cy="50" rx="11" ry="7" fill="${bodyFill}" ${ink(3.5)} transform="rotate(-24 34 50)"/>`;
    s += `<ellipse cx="90" cy="50" rx="11" ry="7" fill="${bodyFill}" ${ink(3.5)} transform="rotate(24 90 50)"/>`;
    // patches on neck/head
    s += `<circle cx="66" cy="44" r="6" fill="${patch}" opacity="0.9"/>`;
    s += `<circle cx="52" cy="80" r="6" fill="${patch}" opacity="0.9"/>`;
    s += `<circle cx="72" cy="96" r="6.5" fill="${patch}" opacity="0.9"/>`;
    s += `<circle cx="60" cy="120" r="6.5" fill="${patch}" opacity="0.85"/>`;
    // big eyes set low
    s += eyes(52, 72, 54, 11, 'round');
    // cheeks + nostrils + smile
    s += cheeks(46, 78, 66);
    s += `<ellipse cx="56" cy="66" rx="2" ry="2.6" fill="${INK}"/><ellipse cx="68" cy="66" rx="2" ry="2.6" fill="${INK}"/>`;
    s += `<path d="M56 72 Q62 77 68 72" fill="none" ${ink(2.4)}/>`;
    // tuft of hair
    s += `<path d="M62 20 Q60 30 62 36 Q64 30 62 20" fill="${patch}" ${ink(2.5)}/>`;
    return s;
  }

  const headHalo = headNeck(halo(10), HALO, true);
  const headColor = headNeck(ink(4), bodyFill, false);
  const accSvg = guideAccessory(acc);

  const headOnly = headHalo + headColor + headDetails() + accSvg;

  // full body: add torso + legs behind neck
  function bodyHalo() {
    return `<ellipse cx="96" cy="150" rx="46" ry="34" fill="${HALO}" ${halo(11)}/>` +
           legStr(HALO, halo(10));
  }
  function bodyColor() {
    return `<ellipse cx="96" cy="150" rx="46" ry="34" fill="${bodyFill}" ${ink(4)}/>` +
           legStr(bodyFill, ink(4)) +
           // body patches
           `<circle cx="86" cy="140" r="8" fill="${patch}" opacity="0.9"/>` +
           `<circle cx="112" cy="150" r="8" fill="${patch}" opacity="0.9"/>` +
           `<circle cx="98" cy="164" r="7" fill="${patch}" opacity="0.85"/>` +
           // tail
           `<path d="M140 150 Q156 156 150 176" fill="none" ${ink(4)}/>` +
           `<circle cx="150" cy="178" r="5" fill="${patch}" ${ink(3)}/>`;
  }
  function legStr(fill, stroke) {
    return rrect(74, 168, 13, 30, 6, fill, stroke) +
           rrect(104, 168, 13, 30, 6, fill, stroke);
  }

  // In full view the neck/head sit to the left, body to the right.
  const full = `<g transform="translate(6,0)">` +
    bodyHalo() + headHalo +
    bodyColor() +
    headColor + headDetails() + accSvg +
  `</g>`;

  return { headOnly, full };
}

function guideAccessory(acc) {
  if (!acc || acc === 'none') return '';
  switch (acc) {
    case 'bow':
      return path('M62 30 L50 22 L50 40 Z', COLORS.pink, `stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"`) +
             path('M62 30 L74 22 L74 40 Z', COLORS.pink, `stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"`) +
             `<circle cx="62" cy="31" r="5" fill="${COLORS.pink}" stroke="${INK}" stroke-width="2.6"/>`;
    case 'sunglasses':
      return path(starPath(52, 54, 12, 5.4), INK, `stroke="${INK}" stroke-width="1"`) +
             path(starPath(72, 54, 12, 5.4), INK, `stroke="${INK}" stroke-width="1"`) +
             `<line x1="60" y1="52" x2="64" y2="52" stroke="${INK}" stroke-width="3"/>`;
    case 'crown':
      return path('M44 34 L50 20 L56 30 L62 18 L68 30 L74 20 L80 34 Z', COLORS.gold, `stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"`) +
             `<circle cx="50" cy="20" r="2.4" fill="${COLORS.pop||'#FF7AC6'}"/><circle cx="62" cy="18" r="2.6" fill="${COLORS.bubblegum}"/><circle cx="74" cy="20" r="2.4" fill="${COLORS.teal}"/>`;
    case 'headphones':
      return path('M30 54 Q62 8 94 54', 'none', `stroke="${COLORS.pink}" stroke-width="7" fill="none" stroke-linecap="round"`) +
             rrect(24, 48, 14, 22, 6, COLORS.pink, `stroke="${INK}" stroke-width="3"`) +
             rrect(86, 48, 14, 22, 6, COLORS.pink, `stroke="${INK}" stroke-width="3"`);
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
    default:
      inner = ell(60, 80, 30, 26, COLORS.lilac, ink);
  }
  return `<svg viewBox="0 0 120 130" width="${size}" height="${size*130/120}" class="deco-svg${fxCls} ${cls}" role="img" aria-label="${item.name}" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
}

// Generic render router used by collection/town.
export function renderItem(item, opts = {}) {
  if (item.kind === 'deco') return renderDeco(item, opts);
  return renderBoo(item, opts);
}
