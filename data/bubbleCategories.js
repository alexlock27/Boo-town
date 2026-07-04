// data/bubbleCategories.js — Bubble Pop question categories (EXPANSION_1 §2.1).
// Each category: { key, name, levels:[...], gen(level) -> question }.
// A question is { display, answer(number), key, distractors:[numbers], fmt?(n)->string }.
// Bubble Pop shows exactly one correct bubble; distractors supply the wrong values.

const rand = (n) => (Math.random() * n) | 0;
const uniq = (arr, answer) => [...new Set(arr.filter(v => Number.isInteger(v) && v > 0 && v !== answer))];
const comma = (n) => n.toLocaleString('en-GB');

function digitSwap(n) {
  const s = String(n);
  if (s.length >= 2) { const a = s.split(''); [a[a.length - 1], a[a.length - 2]] = [a[a.length - 2], a[a.length - 1]]; const r = +a.join(''); if (r !== n && r > 0) return r; }
  return null;
}
function scramble(n) {
  const s = String(n).split('');
  if (s.length < 2) return null;
  for (let i = s.length - 1; i > 0; i--) { const j = rand(i + 1); [s[i], s[j]] = [s[j], s[i]]; }
  const r = +s.join('');
  return (r !== n && r > 0) ? r : null;
}
function fill(ds, answer, spread) {
  const out = uniq(ds, answer);
  let g = 0;
  while (out.length < 6 && g++ < 60) { const v = answer + (rand(2) ? 1 : -1) * (1 + rand(spread)); if (v > 0 && v !== answer && !out.includes(v)) out.push(v); }
  // guarantee at least 5 distractors (small answers have few nearby options)
  for (let k = 1; out.length < 6 && k <= 12; k++) { const v = answer + k; if (v !== answer && !out.includes(v)) out.push(v); }
  return out;
}

// ---- Times tables (existing levels + a Starter) ----
const TABLES = {
  S: { tables: [2, 5, 10], ops: ['mul'], fmax: 10 },
  1: { tables: [2, 3, 4, 5, 8, 10], ops: ['mul'], fmax: 12 },
  2: { tables: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], ops: ['mul', 'div'], fmax: 12 },
  3: { tables: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], ops: ['mul', 'div', 'missing'], fmax: 12 }
};
function tablesGen(lvl) {
  const cfg = TABLES[lvl];
  const op = cfg.ops[rand(cfg.ops.length)];
  const t = cfg.tables[rand(cfg.tables.length)];
  const f = 1 + rand(cfg.fmax);
  const p = t * f;
  let display, answer, factor = false;
  if (op === 'mul') { answer = p; display = `${t} × ${f} = ?`; }
  else if (op === 'div') { answer = f; display = `${p} ÷ ${t} = ?`; factor = true; }
  else { answer = f; display = `? × ${t} = ${p}`; factor = true; }
  const ds = [];
  if (!factor) { ds.push(answer - t, answer + t, t * (f - 1), t * (f + 1), t * (f + 2), t * Math.max(1, f - 2)); const sw = digitSwap(answer); if (sw) ds.push(sw); }
  else { ds.push(answer - 1, answer + 1, answer - 2, answer + 2, answer + 3); }
  while (uniq(ds, answer).length < 6) { ds.push(factor ? 1 + rand(13) : t * (1 + rand(12))); ds.push(answer + (rand(13) - 6)); }
  return { display, answer, key: `t${op}${t}:${f}`, distractors: uniq(ds, answer) };
}

// ---- Number bonds ----
function bondsGen(lvl) {
  let a, total;
  if (lvl === 'S') { total = rand(2) ? 10 : 20; a = 1 + rand(total - 1); }
  else if (lvl === 1) { total = 100; a = (1 + rand(19)) * 5; }   // multiples of 5, 5..95
  else { total = 100; a = 1 + rand(99); }
  const answer = total - a;
  const display = `${a} + ? = ${total}`;
  const ds = [answer + 10, answer - 10, answer + 1, answer - 1]; const sw = digitSwap(answer); if (sw) ds.push(sw);
  return { display, answer, key: `b${a}:${total}`, distractors: fill(ds, answer, 12) };
}

// ---- Add and subtract ----
function addsubGen(lvl) {
  let a, b, op, answer, display, step = 10;
  if (lvl === 1) {                       // two-digit ± tens
    op = rand(2) ? '+' : '−';
    if (op === '+') { a = 11 + rand(79); b = (1 + rand(8)) * 10; answer = a + b; }
    else { a = 30 + rand(69); b = (1 + rand(Math.min(8, Math.floor((a - 1) / 10)))) * 10; answer = a - b; }
    display = `${a} ${op} ${b}`;
  } else if (lvl === 2) {                 // two-digit ± two-digit, no crossing hundreds
    op = rand(2) ? '+' : '−';
    if (op === '+') { a = 21 + rand(60); b = 11 + rand(Math.max(1, 98 - a)); answer = a + b; }
    else { a = 41 + rand(58); b = 11 + rand(a - 11); answer = a - b; }
    display = `${a} ${op} ${b}`;
  } else {                                // three-digit ± tens/hundreds
    step = rand(2) ? 10 : 100;
    a = 120 + rand(779);
    b = (1 + rand(step === 10 ? 8 : 7)) * step;
    op = rand(2) ? '+' : '−';
    if (op === '−' && b >= a) op = '+';
    answer = op === '+' ? a + b : a - b;
    display = `${a} ${op} ${b}`;
  }
  const ds = [answer + 10, answer - 10, answer + 1, answer - 1];
  if (lvl === 3) ds.push(answer + 100, answer - 100);
  const sc = scramble(answer); if (sc) ds.push(sc);
  return { display, answer, key: `as${a}${op}${b}`, distractors: fill(ds, answer, step) };
}

// ---- Doubles and halves ----
function dhGen(lvl) {
  const cap = lvl === 1 ? 20 : 50;
  const half = rand(2);
  let display, answer, ds;
  if (!half) { const n = 1 + rand(cap); answer = n * 2; display = `Double ${n}`; ds = [answer + 1, answer - 1, answer + 2, answer - 2, n]; return { display, answer, key: `d${n}`, distractors: fill(ds, answer, 3) }; }
  const halfCap = lvl === 1 ? 20 : 50;    // halves of evens up to 40 (L1) / to 100 (L2)
  const answer2 = 1 + rand(halfCap); const n = answer2 * 2;
  display = `Half of ${n}`; ds = [answer2 + 1, answer2 - 1, answer2 + 2, answer2 - 2, n];
  return { display, answer: answer2, key: `h${n}`, distractors: fill(ds, answer2, 3) };
}

// ---- More or less (place value) ----
function morelessGen(lvl) {
  if (lvl === 1) {
    const base = 100 + rand(899);
    const amt = rand(2) ? 10 : 100;
    const dir = rand(2) ? 'more' : 'less';
    const answer = dir === 'more' ? base + amt : base - amt;
    const other = amt === 10 ? 100 : 10;
    const ds = [dir === 'more' ? base + other : base - other, dir === 'more' ? base - amt : base + amt, answer + 1, answer - 1, base];
    return { display: `${amt} ${dir} than ${base}`, answer, key: `ml${base}:${amt}:${dir}`, distractors: fill(ds, answer, 10) };
  }
  // Level 2 (Year 4): 1000 more/less than a four-digit number, shown with a comma
  const base = 1000 + rand(8999);
  const dir = rand(2) ? 'more' : 'less';
  const answer = dir === 'more' ? base + 1000 : base - 1000;
  const ds = [dir === 'more' ? base - 1000 : base + 1000, dir === 'more' ? base + 100 : base - 100, base + 10, base, answer + 100, answer - 100];
  return { display: `1000 ${dir} than ${comma(base)}`, answer, key: `ml4${base}:${dir}`, distractors: fill(ds, answer, 100), fmt: comma };
}

// `sample` is display-only picker copy (RUN4 C2): one example question per card.
export const BUBBLE_CATEGORIES = [
  { key: 'tables',   name: 'Times tables',    levels: ['S', 1, 2, 3], gen: tablesGen,   sample: '7 × 8' },
  { key: 'bonds',    name: 'Number bonds',    levels: ['S', 1, 2],    gen: bondsGen,    sample: '35 + ? = 100' },
  { key: 'addsub',   name: 'Add & subtract',  levels: [1, 2, 3],      gen: addsubGen,   sample: '46 + 37' },
  { key: 'doubles',  name: 'Doubles & halves',levels: [1, 2],         gen: dhGen,       sample: 'Double 14' },
  { key: 'moreless', name: 'More or less',    levels: [1, 2],         gen: morelessGen, sample: '10 more than 62' }
];
export const BUBBLE_BY_KEY = Object.fromEntries(BUBBLE_CATEGORIES.map(c => [c.key, c]));

// Friendly level names (EXPANSION_1 §5). 'S' -> Starter.
export const LEVEL_NAME = (lvl) => lvl === 'S' ? 'Starter' : 'Level ' + lvl;

// Produce a question for a category+level, avoiding an immediate repeat.
export function genQuestion(categoryKey, level, prevKey) {
  const cat = BUBBLE_BY_KEY[categoryKey] || BUBBLE_BY_KEY.tables;
  let q, guard = 0;
  do { q = cat.gen(level); } while (q.key === prevKey && ++guard < 12);
  return q;
}
