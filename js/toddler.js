// js/toddler.js — Toddler mode's four games (RUN5 C7), for pre-readers.
// Counting Pop (rising dot-bubbles), Colour Feast + Shape Sort (drag to a Boo/hole),
// and Letter Pop (tap the matching letter). All rounds of 6; hearts hidden; wrong
// taps get a friendly wobble and a spoken "try again!"; rounds always complete;
// stars are generous (3 with two or fewer misses, otherwise 2, never fewer); every
// round banks at least 2 meter points. Every target is ALWAYS shown visually, so
// the whole mode is fully playable with sound off; voice (when available) reads
// every instruction aloud. Same shared universe: stars, meter, boxes, Boos, town.

import { el, clear, wobble, sparkleAt, REDUCED } from './ui.js';
import { getState, mutate } from './state.js';
import { createGameShell } from './gameshell.js';
import { renderBoo } from './art.js';
import { speakMaybe } from './guide.js';
import { sfx, music } from './sfx.js';
import { runIntro, introSeen, INTRO_SCRIPTS } from './intro.js';

export const TODDLER_ROUNDS = 6;      // every toddler round is 6 items
export const TODDLER_MISSES_3STAR = 2; // 3★ with two or fewer misses; otherwise 2 — never fewer
export const TODDLER_METER_MIN = 2;    // every round banks at least this many meter points

const rand = (n) => (Math.random() * n) | 0;
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };

export const TODDLER_GAMES = [
  { key: 'count',  id: 'tcount',  word: 'Count',   icon: '🔢' },
  { key: 'colour', id: 'tcolour', word: 'Colours', icon: '🎈' },
  { key: 'shape',  id: 'tshape',  word: 'Shapes',  icon: '⭐' },
  { key: 'letter', id: 'tletter', word: 'Letters', icon: '🅱️' }
];

// ---- Colour Feast data (C7): colour swatches only, never colour words ----
export const FEAST_COLOURS = [
  { key: 'red', hex: '#E63946' }, { key: 'blue', hex: '#2D7DD2' }, { key: 'yellow', hex: '#FFC93C' },
  { key: 'green', hex: '#4CAF50' }, { key: 'orange', hex: '#F77F00' }, { key: 'purple', hex: '#9C27B0' },
  { key: 'pink', hex: '#FF7AC6' }, { key: 'brown', hex: '#8A5A44' }, { key: 'black', hex: '#3A3A3A' },
  { key: 'white', hex: '#FFFFFF' }, { key: 'grey', hex: '#9E9E9E' }
];
const FEAST_OBJECTS = ['balloon', 'sock', 'cup', 'flower', 'car', 'fish', 'boot', 'kite'];

// ---- Shape Sort data (C7) ----
export const SORT_SHAPES = ['circle', 'square', 'triangle', 'rectangle', 'star', 'heart', 'oval', 'diamond'];
const SHAPE_COLOURS = ['#E63946', '#2D7DD2', '#FFC93C', '#4CAF50', '#F77F00', '#9C27B0', '#FF7AC6', '#35D0BA'];

// ---- Letter Pop anchors (C7, exactly as specced) ----
export const LETTER_ANCHORS = {
  A: ['apple', '🍎'], B: ['ball', '⚽'], C: ['cat', '🐱'], D: ['dog', '🐶'], E: ['egg', '🥚'],
  F: ['fish', '🐠'], G: ['giraffe', '🦒'], H: ['hat', '🎩'], I: ['ice cream', '🍦'], J: ['jelly', '🍮'],
  K: ['kite', '🪁'], L: ['lion', '🦁'], M: ['moon', '🌙'], N: ['nest', '🪺'], O: ['orange', '🍊'],
  P: ['pig', '🐷'], Q: ['queen', '👸'], R: ['rainbow', '🌈'], S: ['sun', '☀️'], T: ['tree', '🌳'],
  U: ['umbrella', '☂️'], V: ['van', '🚐'], W: ['whale', '🐳'], X: ['fox', '🦊'], Y: ['yo-yo', '🪀'], Z: ['zebra', '🦓']
};
const LOWER_AFTER = 3;   // lowercase joins once a letter has been matched this many times

// A Shape Sort round: 2–3 bucket shapes + 6 items of those shapes. Item colour is
// drawn INDEPENDENTLY of the shape, so colour can never be a shortcut to the bucket.
export function genShapeRound() {
  const nBuckets = 2 + rand(2);
  const buckets = shuffle(SORT_SHAPES.slice()).slice(0, nBuckets);
  const items = [];
  for (let i = 0; i < TODDLER_ROUNDS; i++) {
    const shape = buckets[i < nBuckets ? i : rand(nBuckets)];   // every bucket gets at least one
    items.push({ shape, colour: SHAPE_COLOURS[rand(SHAPE_COLOURS.length)], size: 0.7 + Math.random() * 0.5 });
  }
  return { buckets, items: shuffle(items) };
}

// A Colour Feast round: 2–3 colours + 6 tinted objects, each colour appearing.
export function genColourRound() {
  const nBoos = 2 + rand(2);
  const colours = shuffle(FEAST_COLOURS.slice()).slice(0, nBoos);
  const items = [];
  for (let i = 0; i < TODDLER_ROUNDS; i++) {
    const colour = colours[i < nBoos ? i : rand(nBoos)];
    items.push({ colour, object: FEAST_OBJECTS[rand(FEAST_OBJECTS.length)] });
  }
  return { colours, items: shuffle(items) };
}

// ---- tiny tinted object art (Colour Feast) ----
function objectSVG(object, hex) {
  const ink = '#2A1B4E';
  const body = {
    balloon: `<ellipse cx="45" cy="36" rx="24" ry="30" fill="${hex}" stroke="${ink}" stroke-width="3"/><path d="M45 66 q-5 8 0 16 q5 8 0 14" stroke="${ink}" stroke-width="2.5" fill="none"/>`,
    sock: `<path d="M32 12 h26 v34 q0 8 8 12 q12 6 8 18 q-4 12 -18 8 l-20 -8 q-8 -4 -8 -12 z" fill="${hex}" stroke="${ink}" stroke-width="3"/><rect x="30" y="10" width="30" height="10" rx="4" fill="#FFF8F0" stroke="${ink}" stroke-width="2.5"/>`,
    cup: `<path d="M24 26 h42 l-5 44 q-1 8 -9 8 h-14 q-8 0 -9 -8 z" fill="${hex}" stroke="${ink}" stroke-width="3"/><path d="M66 34 q14 2 12 14 q-2 10 -14 10" fill="none" stroke="${ink}" stroke-width="3"/>`,
    flower: `${[0,1,2,3,4,5].map(i => { const a = i / 6 * Math.PI * 2; return `<ellipse cx="${45 + Math.cos(a) * 18}" cy="${40 + Math.sin(a) * 18}" rx="12" ry="12" fill="${hex}" stroke="${ink}" stroke-width="2.4"/>`; }).join('')}<circle cx="45" cy="40" r="10" fill="#FFF8F0" stroke="${ink}" stroke-width="2.4"/><path d="M45 52 v28" stroke="#4CAF50" stroke-width="3.5"/>`,
    car: `<path d="M14 56 q2 -14 14 -16 l8 -12 h20 l8 12 q14 2 16 16 v8 h-66 z" fill="${hex}" stroke="${ink}" stroke-width="3"/><circle cx="30" cy="66" r="8" fill="#3A3A3A" stroke="${ink}" stroke-width="2.4"/><circle cx="62" cy="66" r="8" fill="#3A3A3A" stroke="${ink}" stroke-width="2.4"/>`,
    fish: `<ellipse cx="40" cy="45" rx="26" ry="17" fill="${hex}" stroke="${ink}" stroke-width="3"/><path d="M62 45 l18 -13 v26 z" fill="${hex}" stroke="${ink}" stroke-width="3"/><circle cx="30" cy="41" r="3.4" fill="${ink}"/>`,
    boot: `<path d="M32 12 h22 v38 h14 q12 0 12 12 v10 h-48 z" fill="${hex}" stroke="${ink}" stroke-width="3"/><rect x="30" y="10" width="26" height="9" rx="4" fill="#FFF8F0" stroke="${ink}" stroke-width="2.4"/>`,
    kite: `<path d="M45 10 L70 45 L45 80 L20 45 Z" fill="${hex}" stroke="${ink}" stroke-width="3"/><path d="M45 10 V80 M20 45 H70" stroke="${ink}" stroke-width="2"/><path d="M45 80 q8 6 4 12 q8 2 6 8" stroke="${ink}" stroke-width="2" fill="none"/>`
  }[object] || `<circle cx="45" cy="45" r="26" fill="${hex}" stroke="${ink}" stroke-width="3"/>`;
  return `<svg viewBox="0 0 90 96" width="76" height="80">${body}</svg>`;
}

// ---- shape art (Shape Sort): filled item or dashed bucket "hole" ----
function shapePath(shape) {
  if (shape === 'circle') return '<circle cx="45" cy="45" r="32"/>';
  if (shape === 'square') return '<rect x="15" y="15" width="60" height="60" rx="6"/>';
  if (shape === 'triangle') return '<path d="M45 12 L80 74 L10 74 Z"/>';
  if (shape === 'rectangle') return '<rect x="8" y="26" width="74" height="40" rx="5"/>';
  if (shape === 'star') return '<path d="M45 8 l9.5 22.5 24.5 2 -18.5 16 5.5 24 -21 -13 -21 13 5.5 -24 -18.5 -16 24.5 -2 z"/>';
  if (shape === 'heart') return '<path d="M45 78 C10 52 15 22 33 22 c7 0 12 5 12 10 0 -5 5 -10 12 -10 18 0 23 30 -12 56z"/>';
  if (shape === 'oval') return '<ellipse cx="45" cy="45" rx="36" ry="24"/>';
  return '<path d="M45 8 L80 45 L45 82 L10 45 Z"/>';   // diamond
}
function shapeSVG(shape, { fill = null, size = 84 } = {}) {
  const style = fill
    ? `fill="${fill}" stroke="#2A1B4E" stroke-width="3.5"`
    : `fill="rgba(255,255,255,0.14)" stroke="#FFF8F0" stroke-width="4" stroke-dasharray="10 7"`;
  return `<svg viewBox="0 0 90 90" width="${size}" height="${size}"><g ${style}>${shapePath(shape)}</g></svg>`;
}

// Session-level Counting Pop progression: targets start 1–5 and grow toward 10
// while the session goes well (resets on app load — a fresh session starts gently).
let countMax = 5;

export function mount(container, params, ctx) {
  const game = (params && params.game) || 'count';
  const meta = TODDLER_GAMES.find(g => g.key === game) || TODDLER_GAMES[0];
  const root = el('div', { class: 'screen toddler td-' + game });
  container.appendChild(root);
  music.play('game');

  let misses = 0, done = 0, ended = false;
  const shell = createGameShell({
    title: meta.word, rounds: TODDLER_ROUNDS, accent: 'var(--pop)',
    hideHearts: true, hintEnabled: false,
    onBack: () => ctx.go('hub'),
    onHelp: () => runIntro(meta.id, { steps: INTRO_SCRIPTS[meta.id] })
  });
  root.appendChild(shell.root);

  // single spoken intro step on the first-ever open (C5 pattern, C7 flavour)
  if (!introSeen(meta.id)) runIntro(meta.id, { steps: INTRO_SCRIPTS[meta.id] });

  function oops(node) {
    misses++;
    if (node) wobble(node);
    sfx.oops();
    shell.react('Try again!', { hold: 1400 });   // spoken when voice is on
  }
  function progress() { done++; shell.setProgress(done); if (done >= TODDLER_ROUNDS) setTimeout(finish, REDUCED ? 300 : 900); }
  function finish() {
    if (ended) return; ended = true;
    shell.cleanup();
    // generous stars (never fewer than 2) + a meter floor so boxes arrive quickly
    const stars = misses <= TODDLER_MISSES_3STAR ? 3 : 2;
    const meterOverride = Math.max(TODDLER_METER_MIN, stars >= 3 ? 4 : 2);
    ctx.go('results', { game: meta.id, gameName: meta.word, stars, meterOverride, replay: () => ctx.go('toddlergame', { game }) });
  }

  const api = { count: mountCount, colour: mountColour, shape: mountShape, letter: mountLetter }[game](shell.area);

  // invisible QA hooks
  if (typeof window !== 'undefined') window.__toddler = Object.assign({
    game, state: () => ({ misses, done, ended }),
    finish, genShapeRound, genColourRound, countMax: () => countMax
  }, api || {});

  return { unmount() { shell.cleanup(); if (api && api.cleanup) api.cleanup(); } };

  // ================= Counting Pop (Bubble Pop engine: rising bubbles) =================
  function mountCount(area) {
    let target = 0, locked = false, raf = null;
    const targetCard = el('div', { class: 'td-target' });
    const field = el('div', { class: 'bubble-field td-field' });
    area.append(targetCard, field);

    const N = 5;
    const bubbles = [];
    for (let i = 0; i < N; i++) {
      const node = el('button', { class: 'bubble td-bubble', 'aria-label': 'bubble' });
      const b = { n: 1, node, x: 0, y: 0, speed: 0.5, size: 100, phase: Math.random() * 6 };
      node.addEventListener('click', () => onPop(b));
      field.appendChild(node); bubbles.push(b);
    }

    function dotsHTML(n, size = 13, lit = -1) {
      let out = '<span class="td-dots">';
      for (let i = 0; i < n; i++) out += `<i class="td-dot${i <= lit ? ' lit' : ''}" style="width:${size}px;height:${size}px"></i>`;
      return out + '</span>';
    }
    function newTarget() {
      target = 1 + rand(Math.min(10, countMax));
      targetCard.innerHTML = `<span class="td-big-num">${target}</span>` + dotsHTML(target, 15);
      speakMaybe(`Pop ${target}!`);
      layoutValues();
    }
    function layoutValues() {
      // exactly one bubble carries the target count
      const others = [];
      for (let v = 1; v <= Math.min(10, countMax); v++) if (v !== target) others.push(v);
      shuffle(others);
      const values = shuffle([target, ...others.slice(0, N - 1)]);
      while (values.length < N) values.push(1 + rand(Math.min(10, countMax)));
      bubbles.forEach((b, i) => { b.n = values[i]; paint(b); });
    }
    function paint(b) {
      b.node.innerHTML = dotsHTML(b.n, b.n > 6 ? 10 : 14);
      b.node.style.setProperty('--bub', ['#FF7AC6', '#35D0BA', '#8FC7FF', '#C6A9F0', '#FFC93C'][bubbles.indexOf(b) % 5]);
    }
    function resetPositions() {
      const W = field.clientWidth || 600, H = field.clientHeight || 460;
      bubbles.forEach((b, i) => {
        b.size = 96 + rand(18);
        b.x = (i + 0.5) / N * W - b.size / 2;
        b.y = (i / N) * (H - 60) + Math.random() * 40;
        b.speed = 0.35 + Math.random() * 0.3;   // extra gentle for little hands
        place(b);
      });
    }
    function place(b) {
      const W = field.clientWidth || 600;
      const sway = Math.sin((b.y + b.phase * 80) / 90) * 10;
      b.node.style.width = b.node.style.height = b.size + 'px';
      b.node.style.left = Math.max(4, Math.min(W - b.size - 4, b.x + sway)) + 'px';
      b.node.style.bottom = b.y + 'px';
    }
    function loop() {
      if (!document.hidden && !REDUCED) {
        const H = field.clientHeight || 460;
        for (const b of bubbles) { b.y += b.speed; if (b.y > H + b.size) { b.y = -b.size - rand(50); b.x = rand(Math.max(60, (field.clientWidth || 600) - b.size)); } place(b); }
      }
      raf = requestAnimationFrame(loop);
    }
    async function onPop(b) {
      if (locked || ended) return;
      if (b.n !== target) { oops(b.node); return; }
      locked = true;
      sfx.pop();
      const r = b.node.getBoundingClientRect();
      if (!REDUCED) sparkleAt(r.left + r.width / 2, r.top + r.height / 2);
      // the count-aloud moment (C7): the dots light in turn — "1... 2... 3!"
      const overlay = el('div', { class: 'td-countaloud' }, [el('div', { class: 'td-ca-dots', html: '' }) ]);
      root.appendChild(overlay);
      const wrap = overlay.querySelector('.td-ca-dots');
      for (let i = 1; i <= target; i++) {
        wrap.innerHTML = dotsHTML(target, 26, i - 1);
        speakMaybe(String(i));
        sfx.tap();
        await new Promise(res => setTimeout(res, REDUCED ? 90 : 430));
      }
      speakMaybe(`${target}!`);
      await new Promise(res => setTimeout(res, REDUCED ? 120 : 500));
      overlay.remove();
      progress();
      // the session goes well → targets grow toward 10
      if (misses === 0 && countMax < 10) countMax++;
      locked = false;
      if (done < TODDLER_ROUNDS) newTarget();
    }

    requestAnimationFrame(() => { resetPositions(); newTarget(); });
    raf = requestAnimationFrame(loop);
    return {
      pop: (correct) => { const b = correct ? bubbles.find(x => x.n === target) : bubbles.find(x => x.n !== target); if (b) onPop(b); },
      target: () => target,
      values: () => bubbles.map(b => b.n),
      cleanup: () => { if (raf) cancelAnimationFrame(raf); }
    };
  }

  // ================= the drag engine shared by Colour Feast + Shape Sort =================
  function makeDragGame(area, { buckets, bucketHTML, itemHTML, matches, sayTask }) {
    const feedersWrap = el('div', { class: 'feeders td-feeders' });
    const feederEls = buckets.map((b, i) => {
      const zone = el('div', { class: 'feeder td-feeder', dataset: { bucket: String(i) } }, []);
      zone.innerHTML = bucketHTML(b, i);
      feedersWrap.appendChild(zone);
      return zone;
    });
    const itemArea = el('div', { class: 'td-item-area' });
    area.append(feedersWrap, itemArea);

    let queue = [], current = null, curNode = null;
    function next() {
      clear(itemArea);
      current = queue.shift();
      if (!current) return;
      curNode = el('div', { class: 'td-drag-item', html: itemHTML(current) });
      itemArea.appendChild(curNode);
      attachDrag(curNode);
      sayTask(current);
    }
    function attachDrag(node) {
      let dragging = false, sx = 0, sy = 0, ox = 0, oy = 0;
      node.addEventListener('pointerdown', e => {
        dragging = true; node.setPointerCapture(e.pointerId);
        const r = node.getBoundingClientRect(); sx = e.clientX; sy = e.clientY; ox = r.left; oy = r.top;
        node.classList.add('dragging');
      });
      node.addEventListener('pointermove', e => {
        if (!dragging) return;
        node.style.position = 'fixed'; node.style.zIndex = '50';
        node.style.left = (ox + e.clientX - sx) + 'px'; node.style.top = (oy + e.clientY - sy) + 'px';
        feederEls.forEach((f, i) => f.classList.toggle('glow', hit(f, e.clientX, e.clientY)));
      });
      const drop = (e) => {
        if (!dragging) return; dragging = false;
        node.classList.remove('dragging');
        feederEls.forEach(f => f.classList.remove('glow'));
        const idx = feederEls.findIndex(f => hit(f, e.clientX, e.clientY));
        if (idx < 0) { resetPos(node); return; }               // nowhere near — just float back
        if (matches(current, buckets[idx])) {
          sfx.correct();
          const r = feederEls[idx].getBoundingClientRect();
          if (!REDUCED) sparkleAt(r.left + r.width / 2, r.top + r.height / 2);
          const boo = feederEls[idx].querySelector('svg'); if (boo && !REDUCED) { boo.classList.remove('squeak'); void boo.offsetWidth; boo.classList.add('squeak'); }
          node.remove();
          progress();
          if (done < TODDLER_ROUNDS) next();
        } else {
          oops(node); resetPos(node);
        }
      };
      node.addEventListener('pointerup', drop);
      node.addEventListener('pointercancel', () => { dragging = false; node.classList.remove('dragging'); resetPos(node); feederEls.forEach(f => f.classList.remove('glow')); });
    }
    function resetPos(node) { node.style.position = ''; node.style.left = ''; node.style.top = ''; node.style.zIndex = ''; }
    function hit(f, x, y) { const r = f.getBoundingClientRect(); return x >= r.left - 24 && x <= r.right + 24 && y >= r.top - 24 && y <= r.bottom + 24; }

    return { start: (items) => { queue = items.slice(); next(); }, feederEls,
      dropOn: (idx) => {   // test hook: resolve the current item onto bucket idx
        if (!current) return false;
        if (matches(current, buckets[idx])) { curNode.remove(); progress(); if (done < TODDLER_ROUNDS) next(); return true; }
        oops(curNode); return false;
      },
      current: () => current };
  }

  // ================= Colour Feast (Feed the Boos engine) =================
  function mountColour(area) {
    const round = genColourRound();
    const LOOKS = [{ species: 'munch', colors: { body: 'teal' } }, { species: 'bloop', colors: { body: 'bubblegum' } }, { species: 'pip', colors: { body: 'lilac' } }];
    const eng = makeDragGame(area, {
      buckets: round.colours,
      bucketHTML: (c, i) => renderBoo({ ...LOOKS[i % LOOKS.length], name: '' }, { size: 116, cls: 'art-idle' }) +
        `<div class="td-swatch-sign"><span class="td-swatch" style="background:${c.hex};${c.key === 'white' ? 'border-color:#8a7db8;' : ''}"></span></div>`,
      itemHTML: (it) => objectSVG(it.object, it.colour.hex),
      matches: (it, bucket) => it.colour.key === bucket.key,
      sayTask: () => speakMaybe('Feed the matching colour!')
    });
    speakMaybe('Feed each Boo its matching colour!');
    eng.start(round.items);
    return { round, dropOn: eng.dropOn, current: eng.current, correctIndex: () => round.colours.findIndex(c => c.key === (eng.current() || {}).colour?.key) };
  }

  // ================= Shape Sort (Feed the Boos engine) =================
  function mountShape(area) {
    const round = genShapeRound();
    const eng = makeDragGame(area, {
      buckets: round.buckets,
      bucketHTML: (shape) => `<div class="td-hole">${shapeSVG(shape, { size: 108 })}</div>`,
      itemHTML: (it) => shapeSVG(it.shape, { fill: it.colour, size: Math.round(84 * it.size) }),
      matches: (it, bucket) => it.shape === bucket,
      sayTask: () => speakMaybe('Where does this shape fit?')
    });
    speakMaybe('Match each shape to its hole!');
    eng.start(round.items);
    return { round, dropOn: eng.dropOn, current: eng.current, correctIndex: () => round.buckets.indexOf((eng.current() || {}).shape) };
  }

  // ================= Letter Pop =================
  function mountLetter(area) {
    const letters = shuffle(Object.keys(LETTER_ANCHORS)).slice(0, TODDLER_ROUNDS);
    let idx = -1, cur = null, locked = false;
    const targetCard = el('div', { class: 'td-target td-letter-target' });
    const tileRow = el('div', { class: 'td-letter-tiles' });
    area.append(targetCard, tileRow);

    const lifetime = () => (getState().seen.toddlerLetters || {});
    const showLower = (ch) => (lifetime()[ch] || 0) >= LOWER_AFTER;
    const speakAnchor = (ch) => {
      const [word] = LETTER_ANCHORS[ch];
      speakMaybe(ch === 'X' ? `${ch}! x is in ${word}` : `${ch}! ${ch.toLowerCase()} for ${word}`);
    };

    function next() {
      idx++;
      if (idx >= letters.length) return;
      cur = letters[idx];
      const lower = showLower(cur);
      targetCard.innerHTML = `<span class="td-giant-letter">${cur}${lower ? ` <span class="td-lower">${cur.toLowerCase()}</span>` : ''}</span>` +
        `<span class="td-anchor-hint">${LETTER_ANCHORS[cur][1]}</span>`;
      speakAnchor(cur);
      // three big tiles, one correct
      const others = shuffle(Object.keys(LETTER_ANCHORS).filter(c => c !== cur)).slice(0, 2);
      const opts = shuffle([cur, ...others]);
      clear(tileRow);
      for (const ch of opts) {
        const lower2 = showLower(ch);
        const tile = el('button', { class: 'td-letter-tile', html: `${ch}${lower2 ? `<span class="td-lower">${ch.toLowerCase()}</span>` : ''}` });
        tile.addEventListener('click', () => onTap(ch, tile));
        tileRow.appendChild(tile);
      }
    }
    async function onTap(ch, tile) {
      if (locked || ended) return;
      if (ch !== cur) { oops(tile); return; }
      locked = true;
      sfx.correct();
      const r = tile.getBoundingClientRect();
      if (!REDUCED) sparkleAt(r.left + r.width / 2, r.top + r.height / 2);
      mutate(st => { st.seen.toddlerLetters = st.seen.toddlerLetters || {}; st.seen.toddlerLetters[ch] = (st.seen.toddlerLetters[ch] || 0) + 1; });
      // celebration: the anchor word with its picture (C7), spoken
      const [word, emoji] = LETTER_ANCHORS[ch];
      const ov = el('div', { class: 'td-celebrate' }, [
        el('span', { class: 'td-cel-emoji', text: emoji }),
        el('span', { class: 'td-cel-word', text: ch === 'X' ? `x is in ${word}` : `${ch.toLowerCase()} for ${word}` })
      ]);
      root.appendChild(ov);
      speakMaybe(word);
      await new Promise(res => setTimeout(res, REDUCED ? 250 : 1400));
      ov.remove();
      progress();
      locked = false;
      if (done < TODDLER_ROUNDS) next();
    }
    next();
    return {
      letters, currentLetter: () => cur,
      tap: (correct) => { const tiles = [...tileRow.querySelectorAll('.td-letter-tile')]; const t = tiles.find(x => (x.textContent[0] === cur) === correct); if (t) t.click(); },
      lowerShown: () => !!targetCard.querySelector('.td-lower')
    };
  }
}
