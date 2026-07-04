// js/questions.js — shared multiple-choice question engine for the arcade games
// (Boo Blocks, Boo Bounce, Boo Beat) and Teach Me. Reuses the Bubble Pop maths
// generators and the statutory spelling list.

import { genTarget, distractors } from './games/bubblepop.js';
import { genQuestion, BUBBLE_BY_KEY } from '../data/bubbleCategories.js';
import { WORDS } from '../data/spelling.js';
import { ledgerClass } from './state.js';

const rand = (n) => (Math.random() * n) | 0;
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// Categories available in the arcade games. Content tier (C9) filters which are shown.
export const BLOCK_CATEGORIES = [
  { key: 'tables', name: 'Times tables', levels: [1, 2, 3] },
  { key: 'bonds',  name: 'Number bonds', levels: [1, 2] },
  { key: 'words',  name: 'Spelling',     levels: [1, 2, 3] },
  { key: 'addsub', name: 'Add & subtract', levels: [1, 2, 3] },
  { key: 'doubles', name: 'Doubles & halves', levels: [1, 2] }
];
const BUBBLE_MATH = new Set(['bonds', 'addsub', 'doubles']);   // routed through the Bubble Pop generators
const AUTO_CATS = ['tables', 'bonds', 'words', 'addsub', 'doubles'];

// makeQuestion(category, level, prev, optionCount=3)
// -> { prompt, options:[string], correct:int, speak?:string, key:string }
export function makeQuestion(category, level, prev, optionCount = 3) {
  if (category === 'words') return wordQuestion(level, prev, optionCount);
  if (BUBBLE_MATH.has(category)) return bubbleMathQuestion(category, level, prev, optionCount);
  return mathQuestion(level, prev, optionCount);
}

// Boo Beat variant: a fact, or a spelling gap ("be_ieve" -> tap the missing letter).
export function makeBeatQuestion(category, level, prev) {
  if (category === 'words') return gapQuestion(level, prev);
  if (BUBBLE_MATH.has(category)) return bubbleMathQuestion(category, level, prev, 3);
  return mathQuestion(level, prev, 3);
}

// Smart-Mix-driven auto question (C9 Light tier arcade: no picker). Weak-biased across
// all arcade categories, drawing from all installed content.
export function autoQuestion(prev, optionCount = 3, beat = false) {
  let best = null;
  for (let t = 0; t < 10; t++) {
    const cat = AUTO_CATS[rand(AUTO_CATS.length)];
    const lv = cat === 'words' ? 1 + rand(3) : pickLevel(cat);
    const q = beat ? makeBeatQuestion(cat, lv, prev) : makeQuestion(cat, lv, prev, optionCount);
    if (!best) best = q;
    if (ledgerClass(q.key) === 'weak') return q;
  }
  return best;
}
function pickLevel(cat) { const lv = (BUBBLE_BY_KEY[cat] && BUBBLE_BY_KEY[cat].levels) || [1, 2, 3]; const n = lv.filter(x => typeof x === 'number'); return n[rand(n.length)] || 1; }

// A Bubble-Pop-generated maths fact in the arcade multiple-choice shape. Key matches the
// Bubble Pop / Boo Dash key so weakness transfers across games ("full brain").
function bubbleMathQuestion(category, level, prev, optionCount) {
  const q = genQuestion(category, level, prev);
  const fmt = q.fmt || String;
  const ds = shuffle(q.distractors.filter(v => v !== q.answer)).slice(0, optionCount - 1);
  const opts = shuffle([q.answer, ...ds]).map(fmt);
  return { prompt: q.display, options: opts, correct: opts.indexOf(fmt(q.answer)), speak: null, key: q.key };
}

const GAP_LETTERS = 'aeioulcsmnrtpbdgh'.split('');
function gapQuestion(level, prev) {
  const tier = Math.max(1, Math.min(3, level));
  const pool = WORDS.filter(w => w.t === tier);
  let word, guard = 0;
  do { word = pool[rand(pool.length)].w; } while (('g:' + word) === prev && ++guard < 8);
  // Blank a letter that is worth practising (a vowel or a commonly-missed consonant).
  const cands = [...word].map((ch, i) => ({ ch, i })).filter(x => x.i > 0 && 'aeioulcsmnrtpbdgh'.includes(x.ch));
  const pick = (cands.length ? cands : [...word].map((ch, i) => ({ ch, i })))[rand((cands.length ? cands : word).length)];
  const prompt = word.slice(0, pick.i) + '_' + word.slice(pick.i + 1);
  const correct = pick.ch;
  const wrongs = shuffle(GAP_LETTERS.filter(l => l !== correct)).slice(0, 2);
  const opts = shuffle([correct, ...wrongs]);
  return { prompt, options: opts, correct: opts.indexOf(correct), speak: word, key: 'g:' + word };
}

function mathQuestion(level, prev, optionCount) {
  const t = genTarget(level, prev && prev.startsWith('m:') ? prev.slice(2) : null);
  const ds = shuffle(distractors(t)).slice(0, optionCount - 1);
  const opts = shuffle([t.answer, ...ds]).map(String);
  return { prompt: t.display, options: opts, correct: opts.indexOf(String(t.answer)), speak: null, key: 'm:' + t.key };
}

function wordQuestion(level, prev, optionCount) {
  const tier = Math.max(1, Math.min(3, level));
  const pool = WORDS.filter(w => w.t === tier);
  let word;
  let guard = 0;
  do { word = pool[rand(pool.length)].w; } while (('w:' + word) === prev && ++guard < 8);
  const wrong = shuffle(misspellings(word)).slice(0, optionCount - 1);
  // top up if not enough plausible misspellings
  while (wrong.length < optionCount - 1) { const m = anyMisspell(word); if (m && !wrong.includes(m) && m !== word) wrong.push(m); else break; }
  const opts = shuffle([word, ...wrong]);
  return { prompt: 'Which is spelled correctly?', options: opts, correct: opts.indexOf(word), speak: word, key: 'w:' + word };
}

// Plausible misspellings of a word (adjacent swaps, vowel confusions, double/undouble, drops).
function misspellings(word) {
  const w = word, out = new Set();
  for (let i = 0; i < w.length - 1; i++) if (w[i] !== w[i + 1]) out.add(w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2));
  if (w.includes('ie')) out.add(w.replace('ie', 'ei'));
  if (w.includes('ei')) out.add(w.replace('ei', 'ie'));
  const dbl = w.match(/([bcdfglmnprstz])\1/);
  if (dbl) out.add(w.replace(dbl[0], dbl[1]));
  for (let i = 1; i < w.length; i++) if (/[bcdfglmnprstz]/.test(w[i]) && w[i] !== w[i - 1]) { out.add(w.slice(0, i) + w[i] + w.slice(i)); break; }
  for (let i = 1; i < w.length; i++) out.add(w.slice(0, i) + w.slice(i + 1));
  out.delete(w);
  return [...out].filter(x => x.length > 1);
}
function anyMisspell(word) {
  const all = misspellings(word);
  return all.length ? all[rand(all.length)] : null;
}
