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
import { sfx, music, animal, ANIMAL_KEYS, ANIMAL_WORDS } from './sfx.js';
import { runIntro, introSeen, INTRO_SCRIPTS } from './intro.js';

export const TODDLER_ROUNDS = 6;      // the default toddler round is 6 items
export const TODDLER_MISSES_3STAR = 2; // 3★ with two or fewer misses; otherwise 2 — never fewer
export const TODDLER_METER_MIN = 2;    // every round banks at least this many meter points
export const BIGSMALL_ITEMS = 12;      // Big and Small: twelve items a round (>=5 each side)
export const PAIRS_GROW_AFTER = 2;     // Animal Pairs: grow 6→8 cards after two cleared boards

const rand = (n) => (Math.random() * n) | 0;
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };

export const TODDLER_GAMES = [
  { key: 'count',    id: 'tcount',    word: 'Count',   icon: '🔢' },
  { key: 'colour',   id: 'tcolour',   word: 'Colours', icon: '🎈' },
  { key: 'shape',    id: 'tshape',    word: 'Shapes',  icon: '⭐' },
  { key: 'letter',   id: 'tletter',   word: 'Letters', icon: '🅱️' },
  { key: 'animals',  id: 'tanimal',   word: 'Animals', icon: '🐮' },   // Animal Sounds (RUN7 C4)
  { key: 'pairs',    id: 'tpairs',    word: 'Pairs',   icon: '🐾' },   // Animal Pairs (memory)
  { key: 'bigsmall', id: 'tbigsmall', word: 'Sizes',   icon: '🐘' }    // Big and Small
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

// ---- animal art (RUN7 C4): simple layered SVG in the house-sticker style ----
const INK = '#2A1B4E';
const ANIMAL_ART = {
  cow: `<ellipse cx="24" cy="34" rx="9" ry="12" fill="#FFF8F0" stroke="${INK}" stroke-width="3"/><ellipse cx="76" cy="34" rx="9" ry="12" fill="#FFF8F0" stroke="${INK}" stroke-width="3"/>
    <path d="M30 26 q-8 -8 -3 -18" fill="none" stroke="#E7CE9A" stroke-width="5" stroke-linecap="round"/><path d="M70 26 q8 -8 3 -18" fill="none" stroke="#E7CE9A" stroke-width="5" stroke-linecap="round"/>
    <ellipse cx="50" cy="56" rx="34" ry="31" fill="#FFF8F0" stroke="${INK}" stroke-width="3.5"/>
    <ellipse cx="32" cy="42" rx="11" ry="9" fill="#3A3A3A"/><ellipse cx="72" cy="64" rx="9" ry="7" fill="#3A3A3A"/>
    <circle cx="39" cy="50" r="4.5" fill="${INK}"/><circle cx="61" cy="50" r="4.5" fill="${INK}"/>
    <ellipse cx="50" cy="70" rx="19" ry="13" fill="#FFB6DE" stroke="${INK}" stroke-width="2.5"/><circle cx="43" cy="70" r="2.6" fill="${INK}"/><circle cx="57" cy="70" r="2.6" fill="${INK}"/>`,
  cat: `<path d="M22 40 L18 14 L40 30 Z" fill="#F6A24B" stroke="${INK}" stroke-width="3"/><path d="M78 40 L82 14 L60 30 Z" fill="#F6A24B" stroke="${INK}" stroke-width="3"/>
    <circle cx="50" cy="54" r="32" fill="#F6A24B" stroke="${INK}" stroke-width="3.5"/>
    <circle cx="39" cy="50" r="4.5" fill="${INK}"/><circle cx="61" cy="50" r="4.5" fill="${INK}"/>
    <path d="M50 60 l-5 5 h10 z" fill="#FF7AC6" stroke="${INK}" stroke-width="2"/>
    <path d="M50 65 v6 M50 71 q-6 4 -12 2 M50 71 q6 4 12 2" fill="none" stroke="${INK}" stroke-width="2"/>
    <path d="M20 56 h16 M20 64 h16 M64 56 h16 M64 64 h16" stroke="${INK}" stroke-width="1.6"/>`,
  dog: `<path d="M20 30 q-12 4 -8 34 q10 6 16 -4 Z" fill="#B07C4A" stroke="${INK}" stroke-width="3"/><path d="M80 30 q12 4 8 34 q-10 6 -16 -4 Z" fill="#B07C4A" stroke="${INK}" stroke-width="3"/>
    <circle cx="50" cy="52" r="32" fill="#D9A566" stroke="${INK}" stroke-width="3.5"/>
    <circle cx="39" cy="48" r="4.5" fill="${INK}"/><circle cx="61" cy="48" r="4.5" fill="${INK}"/>
    <ellipse cx="50" cy="66" rx="15" ry="11" fill="#F0D9B8"/><ellipse cx="50" cy="62" rx="7" ry="5" fill="${INK}"/>
    <path d="M50 67 v7 M44 74 q6 4 12 0" fill="none" stroke="${INK}" stroke-width="2"/><path d="M50 74 q3 8 10 6" fill="none" stroke="#FF7AC6" stroke-width="4" stroke-linecap="round"/>`,
  duck: `<ellipse cx="50" cy="58" rx="30" ry="28" fill="#FFD23F" stroke="${INK}" stroke-width="3.5"/>
    <circle cx="58" cy="34" r="18" fill="#FFD23F" stroke="${INK}" stroke-width="3.5"/>
    <circle cx="62" cy="30" r="3.4" fill="${INK}"/>
    <path d="M70 34 q22 -2 20 8 q-6 6 -20 2 Z" fill="#F6852B" stroke="${INK}" stroke-width="2.5"/>
    <path d="M34 58 q-14 2 -14 12 q10 6 18 -2" fill="#FFC107" stroke="${INK}" stroke-width="2.5"/>`,
  sheep: `<circle cx="26" cy="48" r="12" fill="#FFF8F0" stroke="${INK}" stroke-width="2.5"/><circle cx="74" cy="48" r="12" fill="#FFF8F0" stroke="${INK}" stroke-width="2.5"/>
    <circle cx="34" cy="30" r="12" fill="#FFF8F0" stroke="${INK}" stroke-width="2.5"/><circle cx="66" cy="30" r="12" fill="#FFF8F0" stroke="${INK}" stroke-width="2.5"/>
    <circle cx="50" cy="24" r="13" fill="#FFF8F0" stroke="${INK}" stroke-width="2.5"/>
    <circle cx="50" cy="58" r="26" fill="#FFF8F0" stroke="${INK}" stroke-width="3"/>
    <ellipse cx="50" cy="60" rx="19" ry="20" fill="#4A4458" stroke="${INK}" stroke-width="3"/>
    <ellipse cx="35" cy="60" rx="5" ry="9" fill="#4A4458" stroke="${INK}" stroke-width="2.5"/><ellipse cx="65" cy="60" rx="5" ry="9" fill="#4A4458" stroke="${INK}" stroke-width="2.5"/>
    <circle cx="43" cy="56" r="3.6" fill="#FFF8F0"/><circle cx="57" cy="56" r="3.6" fill="#FFF8F0"/>`,
  owl: `<path d="M22 30 L28 12 L40 26 Z" fill="#8A5A32" stroke="${INK}" stroke-width="2.5"/><path d="M78 30 L72 12 L60 26 Z" fill="#8A5A32" stroke="${INK}" stroke-width="2.5"/>
    <ellipse cx="50" cy="54" rx="32" ry="34" fill="#A9743F" stroke="${INK}" stroke-width="3.5"/>
    <ellipse cx="50" cy="70" rx="24" ry="16" fill="#C79A6A"/>
    <circle cx="38" cy="48" r="12" fill="#FFF8F0" stroke="${INK}" stroke-width="2.5"/><circle cx="62" cy="48" r="12" fill="#FFF8F0" stroke="${INK}" stroke-width="2.5"/>
    <circle cx="38" cy="48" r="5" fill="${INK}"/><circle cx="62" cy="48" r="5" fill="${INK}"/>
    <path d="M50 54 l-5 8 h10 z" fill="#FFC107" stroke="${INK}" stroke-width="2"/>`,
  bee: `<ellipse cx="34" cy="34" rx="15" ry="10" fill="#EAF6FF" stroke="${INK}" stroke-width="2.5" opacity="0.9" transform="rotate(-24 34 34)"/>
    <ellipse cx="66" cy="34" rx="15" ry="10" fill="#EAF6FF" stroke="${INK}" stroke-width="2.5" opacity="0.9" transform="rotate(24 66 34)"/>
    <ellipse cx="50" cy="58" rx="30" ry="28" fill="#FFD23F" stroke="${INK}" stroke-width="3.5"/>
    <path d="M32 44 q18 -6 36 0 M26 58 h48 M30 72 q20 8 40 0" fill="none" stroke="${INK}" stroke-width="6"/>
    <circle cx="41" cy="52" r="4" fill="${INK}"/><circle cx="59" cy="52" r="4" fill="${INK}"/>
    <path d="M40 20 q-4 -8 -10 -8 M60 20 q4 -8 10 -8" fill="none" stroke="${INK}" stroke-width="2.5"/><circle cx="30" cy="12" r="3" fill="${INK}"/><circle cx="70" cy="12" r="3" fill="${INK}"/>`,
  snake: `<path d="M78 22 q-40 -6 -34 22 q6 22 -22 20 q-20 -2 -18 18" fill="none" stroke="#5FB86E" stroke-width="16" stroke-linecap="round"/>
    <path d="M78 22 q-40 -6 -34 22 q6 22 -22 20 q-20 -2 -18 18" fill="none" stroke="#4A9E5A" stroke-width="16" stroke-linecap="round" stroke-dasharray="3 16"/>
    <circle cx="80" cy="22" r="12" fill="#5FB86E" stroke="${INK}" stroke-width="3"/>
    <circle cx="82" cy="18" r="2.6" fill="${INK}"/><circle cx="88" cy="24" r="2.6" fill="${INK}"/>
    <path d="M90 26 q10 4 10 0 M90 26 q10 -2 12 -6" fill="none" stroke="#E63946" stroke-width="2.4"/>`,
  frog: `<ellipse cx="50" cy="62" rx="34" ry="26" fill="#6FC96E" stroke="${INK}" stroke-width="3.5"/>
    <circle cx="30" cy="34" r="15" fill="#6FC96E" stroke="${INK}" stroke-width="3"/><circle cx="70" cy="34" r="15" fill="#6FC96E" stroke="${INK}" stroke-width="3"/>
    <circle cx="30" cy="32" r="7" fill="#FFF8F0" stroke="${INK}" stroke-width="2"/><circle cx="70" cy="32" r="7" fill="#FFF8F0" stroke="${INK}" stroke-width="2"/>
    <circle cx="30" cy="33" r="3.4" fill="${INK}"/><circle cx="70" cy="33" r="3.4" fill="${INK}"/>
    <path d="M28 66 q22 16 44 0" fill="none" stroke="${INK}" stroke-width="3.5" stroke-linecap="round"/>
    <circle cx="40" cy="58" r="2.4" fill="${INK}"/><circle cx="60" cy="58" r="2.4" fill="${INK}"/>`,
  lion: `${Array.from({ length: 12 }, (_, i) => { const a = i / 12 * Math.PI * 2; return `<path d="M${50 + Math.cos(a) * 30} ${52 + Math.sin(a) * 30} l${Math.cos(a) * 12} ${Math.sin(a) * 12}" stroke="#D98A2B" stroke-width="9" stroke-linecap="round"/>`; }).join('')}
    <circle cx="50" cy="52" r="30" fill="#E8A64B" stroke="${INK}" stroke-width="3.5"/>
    <circle cx="50" cy="52" r="30" fill="#F4C06A" opacity="0.5"/>
    <circle cx="39" cy="48" r="4.5" fill="${INK}"/><circle cx="61" cy="48" r="4.5" fill="${INK}"/>
    <path d="M50 56 l-5 5 h10 z" fill="${INK}"/><path d="M50 61 v6 M44 70 q6 4 12 0" fill="none" stroke="${INK}" stroke-width="2"/>
    <path d="M30 56 h12 M30 62 h12 M58 56 h12 M58 62 h12" stroke="${INK}" stroke-width="1.4"/>`
};
function animalSVG(key, size = 90) {
  return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">${ANIMAL_ART[key] || ANIMAL_ART.cow}</svg>`;
}

// ---- Big and Small data (RUN7 C4): items drawn clearly LARGE or clearly SMALL ----
// Size is a property of the ITEM, drawn at an unambiguous scale; colour is independent
// of the bucket by construction (each object carries its own natural colour).
const BIGSMALL_ITEMS_POOL = [
  { k: 'elephant', big: true, colour: 'grey' }, { k: 'lion', big: true, colour: 'gold' }, { k: 'cow', big: true, colour: 'white' }, { k: 'whale', big: true, colour: 'blue' }, { k: 'tree', big: true, colour: 'green' }, { k: 'house', big: true, colour: 'red' },
  { k: 'bee', big: false, colour: 'yellow' }, { k: 'ant', big: false, colour: 'brown' }, { k: 'ladybird', big: false, colour: 'red' }, { k: 'button', big: false, colour: 'blue' }, { k: 'cherry', big: false, colour: 'red' }, { k: 'pea', big: false, colour: 'green' }
];
function bigSmallSVG(k) {
  const art = {
    elephant: `<ellipse cx="46" cy="52" rx="34" ry="26" fill="#9AA6C2" stroke="${INK}" stroke-width="3"/><path d="M20 60 q-16 6 -14 26 q10 4 16 -8" fill="#9AA6C2" stroke="${INK}" stroke-width="3"/><circle cx="52" cy="46" r="3.2" fill="${INK}"/><path d="M74 42 q10 4 8 12" fill="none" stroke="${INK}" stroke-width="2.5"/>`,
    whale: `<path d="M14 56 q6 -26 40 -24 q34 2 30 24 q-4 14 -34 14 q-30 0 -36 -14z" fill="#5FA9D0" stroke="${INK}" stroke-width="3"/><path d="M78 40 q14 -10 18 2 q-6 8 -16 4" fill="#5FA9D0" stroke="${INK}" stroke-width="3"/><circle cx="34" cy="46" r="3" fill="${INK}"/>`,
    tree: `<rect x="42" y="56" width="14" height="30" rx="3" fill="#9A6B3A" stroke="${INK}" stroke-width="3"/><circle cx="49" cy="40" r="26" fill="#5FB86E" stroke="${INK}" stroke-width="3"/>`,
    house: `<rect x="24" y="46" width="50" height="40" fill="#F2DDA6" stroke="${INK}" stroke-width="3"/><path d="M18 48 L49 22 L80 48 Z" fill="#E4695E" stroke="${INK}" stroke-width="3"/><rect x="42" y="62" width="14" height="24" fill="#8FC7FF" stroke="${INK}" stroke-width="2.5"/>`,
    cow: `<ellipse cx="49" cy="50" rx="30" ry="27" fill="#FFF8F0" stroke="${INK}" stroke-width="3"/><ellipse cx="34" cy="40" rx="9" ry="7" fill="#3A3A3A"/><circle cx="40" cy="48" r="3.6" fill="${INK}"/><circle cx="60" cy="48" r="3.6" fill="${INK}"/><ellipse cx="49" cy="64" rx="15" ry="10" fill="#FFB6DE" stroke="${INK}" stroke-width="2"/>`,
    lion: `<circle cx="49" cy="50" r="28" fill="#D98A2B" stroke="${INK}" stroke-width="3"/><circle cx="49" cy="50" r="20" fill="#F4C06A"/><circle cx="41" cy="48" r="3.4" fill="${INK}"/><circle cx="57" cy="48" r="3.4" fill="${INK}"/><path d="M49 55 l-4 4 h8 z" fill="${INK}"/>`,
    bee: `<ellipse cx="49" cy="52" rx="20" ry="16" fill="#FFD23F" stroke="${INK}" stroke-width="2.5"/><path d="M40 42 q9 -4 18 0 M34 52 h30 M38 62 q11 4 22 0" stroke="${INK}" stroke-width="3.5" fill="none"/><ellipse cx="38" cy="40" rx="8" ry="5" fill="#EAF6FF" stroke="${INK}" stroke-width="1.5"/>`,
    ant: `<circle cx="34" cy="50" r="8" fill="#7A3A22" stroke="${INK}" stroke-width="2"/><circle cx="49" cy="50" r="9" fill="#7A3A22" stroke="${INK}" stroke-width="2"/><circle cx="66" cy="50" r="11" fill="#7A3A22" stroke="${INK}" stroke-width="2"/><path d="M28 44 q-6 -8 -10 -6 M28 56 q-6 8 -10 6" stroke="${INK}" stroke-width="1.6" fill="none"/>`,
    ladybird: `<circle cx="49" cy="52" r="20" fill="#E63946" stroke="${INK}" stroke-width="2.5"/><path d="M49 32 v40" stroke="${INK}" stroke-width="2.5"/><circle cx="40" cy="46" r="3" fill="${INK}"/><circle cx="58" cy="46" r="3" fill="${INK}"/><circle cx="42" cy="60" r="3" fill="${INK}"/><circle cx="56" cy="60" r="3" fill="${INK}"/>`,
    button: `<circle cx="49" cy="52" r="18" fill="#8FC7FF" stroke="${INK}" stroke-width="2.5"/><circle cx="44" cy="48" r="2.4" fill="${INK}"/><circle cx="54" cy="48" r="2.4" fill="${INK}"/><circle cx="44" cy="57" r="2.4" fill="${INK}"/><circle cx="54" cy="57" r="2.4" fill="${INK}"/>`,
    cherry: `<circle cx="42" cy="60" r="10" fill="#E63946" stroke="${INK}" stroke-width="2.5"/><circle cx="58" cy="60" r="10" fill="#E63946" stroke="${INK}" stroke-width="2.5"/><path d="M42 50 q6 -18 12 -22 M58 50 q0 -16 -4 -22" fill="none" stroke="#4A9E5A" stroke-width="2.5"/>`,
    pea: `<circle cx="49" cy="52" r="12" fill="#7FC96E" stroke="${INK}" stroke-width="2.5"/><path d="M44 50 q5 4 10 0" stroke="${INK}" stroke-width="1.6" fill="none"/>`
  }[k] || `<circle cx="49" cy="52" r="16" fill="#C6A9F0" stroke="${INK}" stroke-width="2.5"/>`;
  return `<svg viewBox="0 0 100 100" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">${art}</svg>`;
}
// a big / small paw-print sign (spoken "big!" / "small!") for the two size Boos
function pawSign(big) {
  const s = big ? 1 : 0.5;
  return `<svg viewBox="0 0 60 60" width="${(big ? 54 : 30)}" height="${(big ? 54 : 30)}"><g fill="${INK}" transform="translate(30 34) scale(${s}) translate(-30 -34)">
    <ellipse cx="30" cy="40" rx="15" ry="12"/><ellipse cx="16" cy="22" rx="5" ry="7"/><ellipse cx="26" cy="16" rx="5" ry="7.5"/><ellipse cx="34" cy="16" rx="5" ry="7.5"/><ellipse cx="44" cy="22" rx="5" ry="7"/></g></svg>`;
}

// Session-level Counting Pop progression: targets start 1–5 and grow toward 10
// while the session goes well (resets on app load — a fresh session starts gently).
let countMax = 5;
// Animal Pairs: boards cleared this session; the board grows 6→8 after PAIRS_GROW_AFTER.
let pairsCleared = 0;

export function mount(container, params, ctx) {
  const game = (params && params.game) || 'count';
  const meta = TODDLER_GAMES.find(g => g.key === game) || TODDLER_GAMES[0];
  const root = el('div', { class: 'screen toddler td-' + game });
  container.appendChild(root);
  music.play('game');

  // Per-game round count: the four originals + Animal Sounds are 6 items; Big and Small
  // is 12; Animal Pairs is one cleared board = its pair count (3, or 4 once it has grown).
  const pairCount = pairsCleared >= PAIRS_GROW_AFTER ? 4 : 3;
  const roundCount = game === 'bigsmall' ? BIGSMALL_ITEMS
    : game === 'pairs' ? pairCount
      : TODDLER_ROUNDS;

  let misses = 0, done = 0, ended = false;
  const shell = createGameShell({
    title: meta.word, rounds: roundCount, accent: 'var(--pop)',
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
  function progress() { done++; shell.setProgress(done); if (done >= roundCount) setTimeout(finish, REDUCED ? 300 : 900); }
  function finish() {
    if (ended) return; ended = true;
    if (game === 'pairs') pairsCleared++;   // a cleared board counts toward the 6→8 growth
    shell.cleanup();
    // generous stars (never fewer than 2) + a meter floor so boxes arrive quickly
    const stars = misses <= TODDLER_MISSES_3STAR ? 3 : 2;
    const meterOverride = Math.max(TODDLER_METER_MIN, stars >= 3 ? 4 : 2);
    ctx.go('results', { game: meta.id, gameName: meta.word, stars, meterOverride, replay: () => ctx.go('toddlergame', { game }) });
  }

  const api = { count: mountCount, colour: mountColour, shape: mountShape, letter: mountLetter,
    animals: mountAnimals, pairs: () => mountPairs(pairCount), bigsmall: mountBigSmall }[game](shell.area);

  // invisible QA hooks
  if (typeof window !== 'undefined') window.__toddler = Object.assign({
    game, state: () => ({ misses, done, ended, roundCount }),
    finish, genShapeRound, genColourRound, countMax: () => countMax, pairsCleared: () => pairsCleared,
    resetPairs: () => { pairsCleared = 0; }
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
      if (done < roundCount) newTarget();
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
          if (done < roundCount) next();
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
        if (matches(current, buckets[idx])) { curNode.remove(); progress(); if (done < roundCount) next(); return true; }
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
      if (done < roundCount) next();
    }
    next();
    return {
      letters, currentLetter: () => cur,
      tap: (correct) => { const tiles = [...tileRow.querySelectorAll('.td-letter-tile')]; const t = tiles.find(x => (x.textContent[0] === cur) === correct); if (t) t.click(); },
      lowerShown: () => !!targetCard.querySelector('.td-lower')
    };
  }

  // ================= Animal Sounds (RUN7 C4) =================
  function mountAnimals(area) {
    const targetCard = el('div', { class: 'td-target td-animal-target' });
    const cardRow = el('div', { class: 'td-animal-cards' });
    area.append(targetCard, cardRow);
    const roundAnimals = shuffle(ANIMAL_KEYS.slice()).slice(0, roundCount);   // 6 distinct, no repeat in a round
    let idx = -1, cur = null, locked = false;
    // portrait target shows when sound OR voice is off → the game becomes find-the-match
    const showPortrait = () => !getState().settings.sound || !getState().settings.voice;

    function next() {
      idx++;
      if (idx >= roundAnimals.length) return;
      cur = roundAnimals[idx];
      if (showPortrait()) { targetCard.style.display = ''; targetCard.innerHTML = `<div class="td-animal-portrait">${animalSVG(cur, 100)}</div>`; }
      else { targetCard.style.display = 'none'; targetCard.innerHTML = ''; }
      const others = shuffle(ANIMAL_KEYS.filter(k => k !== cur)).slice(0, 2);
      const opts = shuffle([cur, ...others]);
      clear(cardRow);
      for (const k of opts) {
        const card = el('button', { class: 'td-animal-card', 'aria-label': k });
        card.innerHTML = animalSVG(k, 118);
        card.addEventListener('click', () => onTap(k, card));
        cardRow.appendChild(card);
      }
      setTimeout(() => { animal.call(cur); speakMaybe(ANIMAL_WORDS[cur] + '!'); }, 240);
    }
    async function onTap(k, card) {
      if (locked || ended) return;
      if (k !== cur) { oops(card); return; }
      locked = true;
      card.classList.add('td-anim-win');
      animal.call(cur);
      const r = card.getBoundingClientRect();
      if (!REDUCED) sparkleAt(r.left + r.width / 2, r.top + r.height / 2);
      speakMaybe(`The ${cur} says ${ANIMAL_WORDS[cur].toLowerCase()}!`);
      await new Promise(res => setTimeout(res, REDUCED ? 250 : 1300));
      progress();
      locked = false;
      if (done < roundCount) next();
    }
    next();
    return {
      animals: roundAnimals, current: () => cur, portraitShown: () => showPortrait() && !!targetCard.querySelector('.td-animal-portrait'),
      tap: (correct) => { const cs = [...cardRow.querySelectorAll('.td-animal-card')]; const t = cs.find(c => (c.getAttribute('aria-label') === cur) === correct); if (t) t.click(); }
    };
  }

  // ================= Animal Pairs — the classic memory game (RUN7 C4) =================
  function mountPairs(pairs) {
    const area = shell.area;
    const N = pairs * 2;
    const board = el('div', { class: 'td-pairs-board cards-' + N });
    area.appendChild(board);
    const picks = shuffle(ANIMAL_KEYS.slice()).slice(0, pairs);
    const deck = shuffle([...picks, ...picks]);
    let first = null, lock = false, matched = 0;
    const cards = deck.map((k, i) => {
      const card = el('button', { class: 'td-pair-card', dataset: { animal: k, i: String(i) } });
      card.innerHTML = `<div class="tp-inner"><div class="tp-face tp-back">${pairBackSVG()}</div><div class="tp-face tp-front">${animalSVG(k, 88)}</div></div>`;
      card.addEventListener('click', () => flip(card));
      board.appendChild(card);
      return card;
    });
    function flip(card) {
      if (lock || ended) return;
      if (card.classList.contains('flipped') || card.classList.contains('done')) return;
      card.classList.add('flipped'); sfx.tap();
      if (!first) { first = card; return; }
      const a = first.dataset.animal, b = card.dataset.animal;
      const f = first; first = null; lock = true;
      if (a === b) {
        setTimeout(() => {
          [f, card].forEach(c => { c.classList.add('done'); const s = c.querySelector('.tp-front svg'); if (s && !REDUCED) { s.classList.remove('squeak'); void s.offsetWidth; s.classList.add('squeak'); } });
          animal.call(a); matched++; progress(); lock = false;
        }, REDUCED ? 120 : 440);
      } else {
        misses++;   // counts toward the (generous) star tally, but NO penalty feedback — it just flips back
        setTimeout(() => { [f, card].forEach(c => c.classList.remove('flipped')); lock = false; }, REDUCED ? 240 : 900);
      }
    }
    speakMaybe('Find the matching animals!');
    return {
      pairCount: pairs, cardCount: N,
      flipAt: (i) => flip(cards[i]),
      faceUp: () => cards.filter(c => c.classList.contains('flipped') || c.classList.contains('done')).length,
      matchedPairs: () => matched,
      animalAt: (i) => cards[i].dataset.animal,
      indicesOf: (k) => cards.map((c, i) => ({ k: c.dataset.animal, i })).filter(x => x.k === k).map(x => x.i),
      isLocked: () => lock
    };
  }

  // ================= Big and Small (Feed the Boos engine) (RUN7 C4) =================
  function mountBigSmall(area) {
    // 12 items, >=5 each side; house(big,red) + cherry(small,red) are ALWAYS present so a
    // colour lives on both sides → colour can never predict the bucket (uncorrelated by design).
    const bigs = [BIGSMALL_ITEMS_POOL.find(x => x.k === 'house'), ...shuffle(BIGSMALL_ITEMS_POOL.filter(x => x.big && x.k !== 'house'))];
    const smalls = [BIGSMALL_ITEMS_POOL.find(x => x.k === 'cherry'), ...shuffle(BIGSMALL_ITEMS_POOL.filter(x => !x.big && x.k !== 'cherry'))];
    const nBig = 5 + rand(3);                 // 5..7
    const nSmall = BIGSMALL_ITEMS - nBig;     // 5..7 → at least five each side
    const items = [];
    for (let i = 0; i < nBig; i++) items.push({ ...bigs[i % bigs.length] });
    for (let i = 0; i < nSmall; i++) items.push({ ...smalls[i % smalls.length] });
    shuffle(items);
    const buckets = [{ key: 'big' }, { key: 'small' }];
    const LOOKS = [{ species: 'munch', colors: { body: 'teal' } }, { species: 'pip', colors: { body: 'lilac' } }];
    const eng = makeDragGame(area, {
      buckets,
      bucketHTML: (b, i) => renderBoo({ ...LOOKS[i % LOOKS.length], name: '' }, { size: 120, cls: 'art-idle' }) +
        `<div class="td-paw-sign ${b.key}">${pawSign(b.key === 'big')}<span class="td-paw-word">${b.key === 'big' ? 'big' : 'small'}</span></div>`,
      itemHTML: (it) => `<div class="td-size-item ${it.big ? 'big' : 'small'}">${bigSmallSVG(it.k)}</div>`,
      matches: (it, bucket) => (it.big ? 'big' : 'small') === bucket.key,
      sayTask: (it) => speakMaybe(it.big ? 'Big!' : 'Small!')
    });
    speakMaybe('Big things to the big paw, small ones to the small paw!');
    eng.start(items);
    return {
      items, dropOn: eng.dropOn, current: eng.current,
      correctIndex: () => { const c = eng.current(); return c ? (c.big ? 0 : 1) : -1; },
      sizeSplit: () => ({ big: items.filter(x => x.big).length, small: items.filter(x => !x.big).length }),
      colourCheck: () => { const byC = {}; for (const it of items) { (byC[it.colour] = byC[it.colour] || new Set()).add(it.big ? 'big' : 'small'); } return Object.values(byC).some(s => s.size > 1); }
    };
  }
}

// a Boo-pattern card back for Animal Pairs (RUN7 C4)
function pairBackSVG() {
  return `<svg viewBox="0 0 90 90" width="88" height="88" xmlns="http://www.w3.org/2000/svg"><rect x="4" y="4" width="82" height="82" rx="14" fill="#6A4FD0" stroke="#2A1B4E" stroke-width="3"/>
    <ellipse cx="45" cy="50" rx="24" ry="22" fill="#8F7FF0" stroke="#2A1B4E" stroke-width="3"/>
    <path d="M26 34 Q45 14 64 34 L64 40 L26 40 Z" fill="#FFC93C" stroke="#2A1B4E" stroke-width="3"/>
    <circle cx="37" cy="48" r="3.4" fill="#2A1B4E"/><circle cx="53" cy="48" r="3.4" fill="#2A1B4E"/><path d="M39 58 q6 5 12 0" fill="none" stroke="#2A1B4E" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="16" cy="16" r="3" fill="#FFF8F0" opacity="0.6"/><circle cx="74" cy="74" r="3" fill="#FFF8F0" opacity="0.6"/></svg>`;
}
