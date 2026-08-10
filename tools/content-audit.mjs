// tools/content-audit.mjs — RUN21H A1: the literacy/content machine pass.
//
// Walks every content file and reports, per the RUN21H pack:
//   1. exact + near duplicates (Levenshtein ≤ 2 on strings ≥ 6 chars) within/across files
//   2. sorting ambiguity (same item key reachable in two buckets of one template)
//   3. grapheme/phoneme truth (Blend It + Sound Sorter targets vs data/phonemes.js tables)
//   4. Britishness (American spellings + vocabulary)
//   5. curriculum coverage vs the Y3/4 statutory list + appendix themes
//      (fixture: tests/lib/y34-words.mjs)
//   6. volume per game: 3 simulated sessions, repeat rate at session 3 (> 40% flags)
//
// Run from the repo root:  node tools/content-audit.mjs
// Exits 0 when clean (no unaccepted flags), 1 otherwise. A flag judged acceptable in the
// A2 pass is recorded in ACCEPTED with its reason, so the report stays honest about what
// was seen and why it stands. Local tooling: NOT in sw.js ASSETS, never shipped.

import { PHONEMES, WORD_SOUNDS, SOUND_POOL, PHONEME_BY_KEY, PHONEME_KEYS,
         soundsIn, hasSoundAt, authoredAt, isLegalDistractor, avoidsAsDistractor,
         LEVEL_POSITION, targetsForLevel } from '../data/phonemes.js';
import { BLEND_LEVELS, splitSpellsWord } from '../data/blending.js';
import { RHYME_FAMILIES, COUPLETS, RHYME_TRAPS, rhymersOf, rhymeKeyOf } from '../data/rhymes.js';
import { TEMPLATES } from '../data/sorting.js';
import { TEMPLATES_EXTRA } from '../data/sortingExtra.js';
import { TWIN_SETS, TWIN_EXPLAIN } from '../data/soundTwins.js';
import { WORDS } from '../data/spelling.js';
import { BANKS } from '../data/spellingBanks.js';
import { SQUEEZE, POSSESSION, NO_COMMA_DECOYS } from '../data/apostrophe.js';
import { STORIES } from '../data/stories.js';
import { STORY_READER_SETS } from '../data/storyReader.js';
import { BUBBLE_CATEGORIES } from '../data/bubbleCategories.js';
import { FOUR, FIVE } from '../data/detective.js';
import { B1, B2, B3, B3PLUS, B4, FACTORY_LEVELS, ALL_FACTORY_ITEMS } from '../data/wordfactory.js';
import { LINES } from '../data/guideLines.js';
import { KNOCK, ANIMAL, SILLY, BOO } from '../data/jokes.js';
import { MATHS_LESSONS } from '../data/lessons.js';
import { LITERACY_LESSONS } from '../data/lessonsLiteracy.js';
import { Y34_STATUTORY, Y34_THEMES } from '../tests/lib/y34-words.mjs';

// ---- determinism: the whole audit runs on a seeded RNG so "re-run clean" is a fact ----
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
Math.random = mulberry32(0xB007041);

// ---- flags -----------------------------------------------------------------------------
// ACCEPTED: flag ids judged in the A2 pass and allowed to stand, with the reason. An id
// listed here still prints (as "accepted") so nothing is silently swallowed.
const ACCEPTED = new Map([
  ['dup-word:spellingBanks:they',
   'DESIGN. "they" earns a place in two banks for two different reasons — the th sound (trickyTh) and the ey spelling of /eɪ/ (eiEighEy). Both banks teach it honestly; neither is a copy of the other.'],
  ['dup:guideLines:a new boo just dropped',
   'DESIGN (RUN12 S5). dropBoo is the single authored per-kind ceremony line, deliberately fixed so the exact words land every time; boxCommon is the variety pool a box reveal draws from. The shared first line is the point, not a copy-paste.'],
  ['near:ice cream~mice cream',
   'Two different jokes ("Ice cream if you don\'t let me in!" vs "Mice cream!"), similar only because both are puns on the same phrase. Jokes are pack-locked (CONTENT_JOKES.md) and neither is unclear.'],
  ['sort-same:halfEquivalent~fractionSize',
   'JUDGED NOT A DEFECT. The shared fractions are the point: L2 asks the binary "is it a half?", L3 asks the same child to place those same fractions on the correct SIDE of a half. Reusing anchor items across a difficulty step is scaffolding, and every fraction sits in exactly one correct bucket in both.'],
]);

const flags = [];   // { id, area, msg }
const infos = [];   // { area, msg }
function flag(id, area, msg) { flags.push({ id, area, msg }); }
function info(area, msg) { infos.push({ area, msg }); }

// ---- 0. collect every child-facing string with a source label --------------------------
const strings = [];  // { file, path, s }
function collect(file, path, s) {
  if (typeof s !== 'string') return;
  const t = s.trim();
  if (t) strings.push({ file, path, s: t });
}
function collectDeep(file, path, v, keyFilter) {
  if (typeof v === 'string') { collect(file, path, v); return; }
  if (Array.isArray(v)) { v.forEach((x, i) => collectDeep(file, `${path}[${i}]`, x, keyFilter)); return; }
  if (v && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) {
      if (keyFilter && !keyFilter(k)) continue;
      collectDeep(file, `${path}.${k}`, x, keyFilter);
    }
  }
}
// structural keys that are ids/art refs/answer-echoes, not child-facing prose
const NON_PROSE_KEYS = new Set(['id', 'icon', 'kind', 'art', 'key', 'starType', 'type', 'scene', 'pic', 'panels', 'answer', 'bin', 'optionArt']);

// phonemes: words + say/tip
PHONEMES.forEach(p => { collect('phonemes', `${p.key}.tip`, p.tip); p.words.forEach(w => collect('phonemes', `${p.key}.words`, w)); p.nearMiss.forEach(w => collect('phonemes', `${p.key}.nearMiss`, w)); });
BLEND_LEVELS.forEach(l => l.words.forEach(w => collect('blending', `L${l.level}`, w.w)));
RHYME_FAMILIES.forEach(f => { f.members.forEach(w => collect('rhymes', f.key, w)); collect('rhymes', `${f.key}.nearMiss`, f.nearMiss); if (f.spellingOddLine) collect('rhymes', `${f.key}.spellingOddLine`, f.spellingOddLine); });
COUPLETS.forEach((c, i) => { c.lines.forEach(l => collect('rhymes', `couplet${i}`, l)); collect('rhymes', `couplet${i}.answer`, c.answer); c.decoys.forEach(d => collect('rhymes', `couplet${i}.decoys`, d)); });
TWIN_SETS.forEach(s => s.items.forEach((it, i) => collect('soundTwins', `${s.id}[${i}]`, it.s)));
Object.entries(TWIN_EXPLAIN).forEach(([k, v]) => collect('soundTwins', `explain.${k}`, v));
WORDS.forEach(w => collect('spelling', `t${w.t}`, w.w));
BANKS.forEach(b => b.words.forEach(w => { collect('spellingBanks', b.id, w.w); if (w.clue) collect('spellingBanks', `${b.id}.clue`, w.clue); }));
SQUEEZE.forEach(s => { collect('apostrophe', `squeeze.${s.id}`, s.build); if (s.note) collect('apostrophe', `squeeze.${s.id}.note`, s.note); });
POSSESSION.forEach(p => { collect('apostrophe', `possession.${p.id}`, p.sentence); if (p.note) collect('apostrophe', `possession.${p.id}.note`, p.note); });
NO_COMMA_DECOYS.forEach(d => collect('apostrophe', `decoy.${d.id}`, d.sentence));
STORIES.forEach(s => { s.panels.forEach((p, i) => collect('stories', `${s.id}.p${i}`, p.caption)); collect('stories', `${s.id}.q`, s.question); s.options.forEach(o => collect('stories', `${s.id}.opt`, o)); });
STORY_READER_SETS.forEach(s => { s.sentences.forEach((x, i) => { collect('storyReader', `${s.id}.s${i}`, x.text); collect('storyReader', `${s.id}.s${i}.why`, x.why); }); collect('storyReader', `${s.id}.q`, s.question); s.options.forEach(o => collect('storyReader', `${s.id}.opt`, o)); });
FOUR.forEach(w => collect('detective', 'four', w));
FIVE.forEach(w => collect('detective', 'five', w));
ALL_FACTORY_ITEMS.forEach(it => { collect('wordfactory', it.id, it.build); collect('wordfactory', `${it.id}.rule`, it.rule); collect('wordfactory', `${it.id}.order`, it.order); });
Object.entries(LINES).forEach(([k, arr]) => arr.forEach((l, i) => collect('guideLines', `${k}[${i}]`, l)));
[...KNOCK].forEach((j, i) => { collect('jokes', `knock[${i}].name`, j.name); collect('jokes', `knock[${i}]`, j.response); });
[...ANIMAL, ...SILLY, ...BOO].forEach((j, i) => { collect('jokes', `${j.type}.setup`, j.setup); collect('jokes', `${j.type}.punch`, j.punchline); });
MATHS_LESSONS.forEach(l => collectDeep('lessons', l.id, l, k => !NON_PROSE_KEYS.has(k)));
// the pack names lessonsLiteracy.js in A1; it gets its own label so the inventory count is honest
LITERACY_LESSONS.forEach(l => collectDeep('lessonsLiteracy', l.id, l, k => !NON_PROSE_KEYS.has(k)));
// sorting hints/labels are generated per-round; sample one make() per template for strings
for (const t of [...TEMPLATES, ...TEMPLATES_EXTRA]) {
  const r = t.make();
  const seen = new Set();
  const once = (path, s) => { const k = path + '\u0000' + s; if (seen.has(k)) return; seen.add(k); collect('sorting', path, s); };
  r.buckets.forEach(b => once(`${t.id}.bucket`, String(b)));
  r.items.slice(0, 3).forEach(it => once(`${t.id}.hint`, r.hintFor(it)));
  r.items.forEach(it => { if (it.kind === 'text') once(`${t.id}.item`, it.text); if (it.kind === 'unit') once(`${t.id}.item`, it.caption); });
}
info('inventory', `collected ${strings.length} strings across ${new Set(strings.map(x => x.file)).size} content files`);

// ---- 1. exact + near duplicates --------------------------------------------------------
const norm = (s) => s.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
function lev2(a, b) {  // true if levenshtein(a,b) <= 2 (banded)
  if (a === b) return true;
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > 2) return false;
  let prev = Array.from({ length: lb + 1 }, (_, j) => j);
  for (let i = 1; i <= la; i++) {
    const cur = [i];
    let rowMin = i;
    for (let j = 1; j <= lb; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (cur[j] < rowMin) rowMin = cur[j];
    }
    if (rowMin > 2) return false;
    prev = cur;
  }
  return prev[lb] <= 2;
}
// Reuse that is DESIGN, documented in the file headers — reported as info, not flagged.
const DESIGN_REUSE = [
  ['sorting', 'soundTwins'],       // §26/§27 sentences reused verbatim by spec
  ['soundTwins', 'spellingBanks'], // homophone clue sentences reused by spec
  ['sorting', 'spellingBanks'],
  ['sorting', 'lessons'], ['sorting', 'lessonsLiteracy'],  // lessons teach what the games drill; shared vocabulary is coherence
  ['lessons', 'lessonsLiteracy'],
  ['phonemes', 'lessonsLiteracy'], ['blending', 'lessonsLiteracy'], ['rhymes', 'lessonsLiteracy'],
  ['detective', 'lessonsLiteracy'], ['spellingBanks', 'lessonsLiteracy'], ['wordfactory', 'lessonsLiteracy'],
  ['apostrophe', 'lessonsLiteracy'], ['soundTwins', 'lessonsLiteracy'], ['stories', 'lessonsLiteracy'],
  ['spelling', 'lessonsLiteracy'],
  ['phonemes', 'blending'], ['phonemes', 'rhymes'], ['phonemes', 'detective'],
  ['phonemes', 'spellingBanks'], ['phonemes', 'lessons'], ['phonemes', 'stories'],
  ['blending', 'rhymes'], ['blending', 'detective'], ['blending', 'lessons'], ['blending', 'spellingBanks'],
  ['rhymes', 'detective'], ['rhymes', 'lessons'], ['rhymes', 'stories'], ['rhymes', 'spellingBanks'],
  ['detective', 'spelling'], ['detective', 'spellingBanks'], ['detective', 'lessons'], ['detective', 'stories'],
  ['spelling', 'spellingBanks'], ['spelling', 'wordfactory'], ['spellingBanks', 'wordfactory'],
  ['soundTwins', 'lessons'], ['spellingBanks', 'lessons'], ['wordfactory', 'lessons'],
  ['apostrophe', 'lessons'], ['apostrophe', 'soundTwins'], ['stories', 'lessons']
];
const designPair = (a, b) => a === b ? false : DESIGN_REUSE.some(([x, y]) => (x === a && y === b) || (x === b && y === a));

// role of a path: its last dotted segment with indices stripped ("try[2].instruction" -> instruction)
const roleOf = (p) => p.replace(/\[\d+\]/g, '').split('.').pop();
const topOf = (p) => p.split(/[.[]/)[0];
// parallel authored structure: same file, same role — tips, hints, buckets, orders, rules,
// instructions are WRITTEN as families on purpose; repetition there is consistency
const parallel = (a, b) => a.file === b.file && roleOf(a.path) === roleOf(b.path);
// A lesson's hook poses a before/after and its try steps restate it; a show card names an
// example word and a try step then asks her to sort that same word. Those internal echoes
// are the lesson teaching, not repetition — both lesson files, same rule.
const LESSON_FILES = new Set(['lessons', 'lessonsLiteracy']);
const sameLesson = (a, b) => LESSON_FILES.has(a.file) && LESSON_FILES.has(b.file) && topOf(a.path) === topOf(b.path);
const digitShape = (n) => n.replace(/\d+/g, '#');
{
  const byNorm = new Map();
  for (const e of strings) {
    const n = norm(e.s);
    if (n.length < 4) continue;
    if (!byNorm.has(n)) byNorm.set(n, []);
    byNorm.get(n).push(e);
  }
  let designGroups = 0;
  for (const [n, list] of byNorm) {
    if (list.length < 2) continue;
    const files = [...new Set(list.map(e => e.file))];
    const paths = list.map(e => `${e.file}:${e.path}`).join(' · ');
    // single-word pool overlaps across word-list files are cross-game reuse, not defects
    const isWordPool = !n.includes(' ');
    if (files.length > 1 && files.every(f => files.every(g => f === g || designPair(f, g)))) { designGroups++; continue; }
    if (isWordPool && files.length > 1) { designGroups++; continue; }
    // every pair parallel or same-lesson -> authored family, not lazy repetition
    const pairsFine = list.every(a => list.every(b => a === b || parallel(a, b) || sameLesson(a, b)));
    if (pairsFine) { designGroups++; continue; }
    if (files.length === 1 && isWordPool) {
      const sameList = new Set(list.map(e => e.path)).size < list.length;
      if (!sameList && list[0].file === 'phonemes') { designGroups++; continue; } // words + nearMiss share by design
      if (list[0].file === 'rhymes' && list.some(e => e.path.startsWith('couplet'))) { designGroups++; continue; } // couplet answers rhyme, so they live in families
      flag(`dup-word:${list[0].file}:${n}`, 'duplicates', `"${n}" appears ${list.length}x within ${list[0].file} (${paths})`);
      continue;
    }
    if (!n.includes(' ')) continue;
    flag(`dup:${list[0].file}:${n.slice(0, 40)}`, 'duplicates', `exact duplicate x${list.length}: "${list[0].s}" (${paths})`);
  }
  info('duplicates', `${designGroups} duplicate groups match documented design reuse / parallel authored structure (not flagged)`);

  // near duplicates: sentences only (≥ 6 chars, contains a space), banded Levenshtein ≤ 2
  const sentences = [...byNorm.entries()].filter(([n]) => n.length >= 6 && n.includes(' ')).map(([n, l]) => ({ n, l }));
  const seenPair = new Set();
  for (let i = 0; i < sentences.length; i++) {
    for (let j = i + 1; j < sentences.length; j++) {
      const A = sentences[i], B = sentences[j];
      if (Math.abs(A.n.length - B.n.length) > 2) continue;
      // same shape once digits collapse -> a numeric template family, not a duplicate
      if (digitShape(A.n) === digitShape(B.n)) continue;
      if (!lev2(A.n, B.n)) continue;
      const a = A.l[0], b = B.l[0];
      if (designPair(a.file, b.file)) continue;
      if (parallel(a, b) || sameLesson(a, b)) continue;
      // a hook's before/after pair IS the lesson's contrast
      if (a.file === b.file && a.path.includes('.hook.') && b.path.includes('.hook.') && topOf(a.path) === topOf(b.path)) continue;
      const key = `near:${A.n.slice(0, 30)}~${B.n.slice(0, 30)}`;
      if (seenPair.has(key)) continue;
      seenPair.add(key);
      flag(key, 'duplicates', `near-duplicate: "${a.s}" (${a.file}:${a.path}) ~ "${b.s}" (${b.file}:${b.path})`);
    }
  }
}

// ---- 2. sorting ambiguity --------------------------------------------------------------
{
  const RUNS = 400;
  for (const t of [...TEMPLATES, ...TEMPLATES_EXTRA]) {
    const byRule = new Map(); // ruleKey -> Map(itemContent -> Set(bucketLabel))
    for (let r = 0; r < RUNS; r++) {
      const round = t.make();
      const ruleKey = round.buckets.join('|');
      if (!byRule.has(ruleKey)) byRule.set(ruleKey, new Map());
      const m = byRule.get(ruleKey);
      const seenThisRound = new Map(); // content -> bucket index (within-round duplicate check)
      for (const it of round.items) {
        const content = it.kind === 'num' ? `n${it.value}` : it.kind === 'frac' ? `f${it.num}/${it.den}`
          : it.kind === 'unit' ? `u${it.caption}` : it.kind === 'shape' ? `s${it.name}`
          : it.kind === 'angle' ? `a${it.deg}` : it.kind === 'letter' ? `L${it.ch}` : `t${it.text}`;
        if (seenThisRound.has(content) && seenThisRound.get(content) !== it.bucket && it.kind !== 'angle')
          flag(`sort-dup-round:${t.id}:${content}`, 'sorting', `${t.id}: "${content}" dealt into two buckets in ONE round`);
        seenThisRound.set(content, it.bucket);
        if (!m.has(content)) m.set(content, new Set());
        m.get(content).add(round.buckets[it.bucket]);
      }
    }
    for (const [ruleKey, m] of byRule) {
      for (const [content, buckets] of m) {
        if (buckets.size > 1)
          flag(`sort-ambig:${t.id}:${content}`, 'sorting', `${t.id} [${ruleKey}]: "${content}" can land in ${[...buckets].join(' OR ')}`);
      }
    }
  }
  info('sorting', `ambiguity pass: ${TEMPLATES.length + TEMPLATES_EXTRA.length} templates x ${RUNS} rounds each`);

  // template near-identity: two templates whose item pools mostly coincide give the child
  // "two" levels that are the same game (found first as units1/units2, byte-identical)
  // numbers are the medium, not the content — a shared "47" under two different rules is
  // two different questions. Only content-bearing kinds compare.
  const poolOf = new Map();
  for (const t of [...TEMPLATES, ...TEMPLATES_EXTRA]) {
    const s = new Set();
    for (let r = 0; r < 80; r++) t.make().items.forEach(it => {
      if (it.kind === 'num' || it.kind === 'angle') return;
      s.add(it.kind + ':' + (it.kind === 'unit' ? it.caption : it.kind === 'text' ? it.text : it.key));
    });
    if (s.size) poolOf.set(t.id, s);
  }
  const ids = [...poolOf.keys()];
  for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) {
    const A = poolOf.get(ids[i]), B = poolOf.get(ids[j]);
    const inter = [...A].filter(x => B.has(x)).length;
    const jac = inter / (A.size + B.size - inter);
    if (jac > 0.5)
      flag(`sort-same:${ids[i]}~${ids[j]}`, 'sorting', `templates ${ids[i]} and ${ids[j]} share ${Math.round(jac * 100)}% of their item pools — two levels, one game`);
  }
}

// ---- 3. grapheme/phoneme truth ---------------------------------------------------------
{
  // every authored phoneme word is in WORD_SOUNDS with that sound
  for (const p of PHONEMES) for (const w of p.words) {
    if (!soundsIn(w).includes(p.key))
      flag(`ph-missing:${p.key}:${w}`, 'phoneme-truth', `"${w}" is authored under /${p.key}/ but WORD_SOUNDS does not list ${p.key} for it`);
  }
  // every WORD_SOUNDS word belongs to some authored list (words or nearMiss)
  const authored = new Set(PHONEMES.flatMap(p => [...p.words, ...p.nearMiss]));
  for (const w of Object.keys(WORD_SOUNDS)) if (!authored.has(w))
    flag(`ph-orphan:${w}`, 'phoneme-truth', `WORD_SOUNDS has "${w}" but no authored list contains it`);
  // spelling-based contradiction scan: word's spelling contains a taught grapheme but the
  // sound is not listed (or vice versa). Membership is by SOUND, so each hit is a
  // hand-judgement candidate, not automatically wrong. Graphemes checked as substrings
  // with the known trumping order (igh before igh's inner 'gh'... etc.)
  const SPELL = { sh: ['sh'], ch: ['ch', 'tch'], th: ['th'], ng: ['ng'], ai: ['ai'], ee: ['ee', 'ea'], oa: ['oa'], oo: ['oo'], ar: ['ar'], or: ['or'], igh: ['igh'], ow: ['ow'] };
  for (const w of Object.keys(WORD_SOUNDS)) {
    const claimed = soundsIn(w);
    for (const [sound, spellings] of Object.entries(SPELL)) {
      const inSpelling = spellings.some(g => w.includes(g));
      // An `avoid` entry IS the resolution for this class: the word carries the target's
      // letters without its sound, and is therefore barred from ever being offered as a
      // distractor for it (RUN21H A2 — see the note above WORD_SOUNDS).
      if (inSpelling && !claimed.includes(sound) && !avoidsAsDistractor(w, sound)) {
        flag(`ph-spell:${w}:${sound}`, 'phoneme-truth', `"${w}" spelling contains "${spellings.find(g => w.includes(g))}" but is not listed as containing /${sound}/, and carries no avoid guard — judge by ear`);
      }
    }
  }
  // every sound-sorter level/sound combination can build an honest round
  for (const level of [1, 2, 3]) {
    const pos = LEVEL_POSITION[level];
    for (const k of targetsForLevel(level)) {
      if (authoredAt(k, pos).length < 2)
        flag(`ph-thin-level:${k}:L${level}`, 'phoneme-truth', `/${k}/ offered at level ${level} with under 2 authored ${pos} words`);
    }
  }
  // Blend It: split spells the word; digraph tiles are known graphemes
  const KNOWN_G = new Set(['sh', 'ch', 'th', 'ng', 'ck', 'ai', 'oa', 'oo', 'ee', 'ar', 'or', 'igh', 'ow', 'air', 'ea', 'er', 'bb', 'nn', 'st', 'll', 'ss', 'ff', 'zz', 'pp', 'tt', 'dd', 'mm']);
  for (const l of BLEND_LEVELS) for (const e of l.words) {
    if (!splitSpellsWord(e)) flag(`blend-split:${e.w}`, 'phoneme-truth', `Blend It "${e.w}": graphemes [${e.g.join(',')}] do not spell the word`);
    for (const g of e.g) if (g.length > 1 && !KNOWN_G.has(g))
      flag(`blend-g:${e.w}:${g}`, 'phoneme-truth', `Blend It "${e.w}": tile "${g}" is not a known grapheme`);
  }
  // rhyme families: no member of one family rhymes into another (by key) — and traps never
  // appear as members anywhere
  for (const f of RHYME_FAMILIES) {
    for (const w of f.members) {
      const k = rhymeKeyOf(w);
      if (k !== f.key) flag(`rhyme-cross:${w}`, 'phoneme-truth', `"${w}" resolves to family ${k}, listed under ${f.key}`);
    }
    if (f.members.includes(f.nearMiss))
      flag(`rhyme-trap-member:${f.key}`, 'phoneme-truth', `${f.key}: near-miss "${f.nearMiss}" is also a member`);
  }
  info('phoneme-truth', `checked ${Object.keys(WORD_SOUNDS).length} pool words, ${BLEND_LEVELS.reduce((n, l) => n + l.words.length, 0)} blend words, ${RHYME_FAMILIES.length} rhyme families`);
}

// ---- 4. Britishness --------------------------------------------------------------------
{
  const AMERICAN = [
    [/\bcolor(s|ful|ed)?\b/i, 'color → colour'],
    [/\bfavorite\b/i, 'favorite → favourite'],
    [/\bcandy\b/i, 'candy → sweets (or a UK word of the same length)'],
    [/\bsoccer\b/i, 'soccer → football'],
    [/\bdiaper\b/i, 'diaper → nappy'],
    [/\bgotten\b/i, 'gotten → got'],
    [/\bmath\b/i, 'math → maths'],
    [/\bmom(my)?\b/i, 'mom → mum'],
    [/\bgray\b/i, 'gray → grey'],
    [/\bcenter\b/i, 'center → centre'],
    [/\bliter\b/i, 'liter → litre'],
    [/\btrash\b/i, 'trash → rubbish'],
    [/\bgarbage\b/i, 'garbage → rubbish'],
    [/\bsidewalk\b/i, 'sidewalk → pavement'],
    [/\bvacation\b/i, 'vacation → holiday'],
    [/\bcookies?\b/i, 'cookie → biscuit'],
    [/\bflashlight\b/i, 'flashlight → torch'],
    [/\bmail(box|man)\b/i, 'mailbox/mailman → postbox/postman'],
    [/\bairplane\b/i, 'airplane → aeroplane'],
    [/\btires?\b/i, 'tire → tyre'],
    [/\bcurb\b/i, 'curb → kerb'],
    [/\bpajamas\b/i, 'pajamas → pyjamas'],
    [/\bcozy\b/i, 'cozy → cosy'],
    [/\bdonut\b/i, 'donut → doughnut'],
    [/\btheater\b/i, 'theater → theatre'],
    [/\bneighbor(s|hood)?\b/i, 'neighbor → neighbour'],
    [/\bbehavior\b/i, 'behavior → behaviour'],
    [/\bhumor\b/i, 'humor → humour'],
    [/\barmor\b/i, 'armor → armour'],
    [/\bjewelry\b/i, 'jewelry → jewellery'],
    [/\bplow\b/i, 'plow → plough'],
    [/\bmustache\b/i, 'mustache → moustache'],
    [/\b(realize|recognize|organize|apologize|memorize)\b/i, '-ize → -ise (house style)'],
    [/\bstore\b(?!y)/i, 'store (shop?) — judge in context'],
    [/\bfaucet\b/i, 'faucet → tap'],
    [/\bcloset\b/i, 'closet → cupboard/wardrobe'],
    [/\belevator\b/i, 'elevator → lift'],
    [/\bapartment\b/i, 'apartment → flat']
  ];
  let hits = 0;
  for (const e of strings) {
    for (const [re, why] of AMERICAN) {
      const m = e.s.match(re);
      if (m) { hits++; flag(`us:${e.file}:${e.path}:${m[0].toLowerCase()}`, 'britishness', `${e.file}:${e.path} — "${e.s}" (${why})`); }
    }
  }
  info('britishness', `${hits} American-usage hits across ${strings.length} strings`);
}

// ---- 5. curriculum coverage ------------------------------------------------------------
{
  const appWords = new Set([
    ...WORDS.map(w => w.w.toLowerCase()),
    ...BANKS.flatMap(b => b.words.map(w => w.w.toLowerCase())),
    ...ALL_FACTORY_ITEMS.map(i => i.build.toLowerCase())
  ]);
  const missing = Y34_STATUTORY.filter(w => !appWords.has(w.toLowerCase()));
  const extraStat = WORDS.map(w => w.w.toLowerCase()).filter(w => !Y34_STATUTORY.map(x => x.toLowerCase()).includes(w));
  if (missing.length)
    flag('curr:statutory-missing', 'curriculum', `statutory Y3/4 words absent from the app: ${missing.join(', ')}`);
  if (extraStat.length)
    info('curriculum', `spelling.js words NOT on the statutory list (fine if deliberate): ${extraStat.join(', ')}`);
  info('curriculum', `statutory coverage: ${Y34_STATUTORY.length - missing.length}/${Y34_STATUTORY.length}`);

  // theme -> where it is served, with a thin threshold (fewer than 6 items = thin)
  const bankById = Object.fromEntries(BANKS.map(b => [b.id, b]));
  const themeSources = {
    'prefixes-un-dis-mis-re': [
      ['spellingBanks.prefixesUnDisMisRe', bankById.prefixesUnDisMisRe.words.length],
      ['wordfactory.B1 un/dis/mis/re', B1.filter(i => /^(un|dis|mis|re)/.test(i.build)).length],
      ['pre- anywhere', [...appWords].filter(w => w.startsWith('pre') && !['pressure', 'present'].includes(w)).length]
    ],
    'prefixes-in-il-im-ir': [
      ['spellingBanks.prefixesInIlImIr', bankById.prefixesInIlImIr.words.length],
      ['wordfactory.B1 in/il/im/ir', B1.filter(i => /^(in|il|im|ir)/.test(i.build)).length]
    ],
    'prefixes-super-anti-auto-inter-sub': [
      ['spellingBanks.prefixesSuperAntiAutoInterSub', bankById.prefixesSuperAntiAutoInterSub.words.length],
      ['wordfactory.B1 super/auto/sub', B1.filter(i => /^(super|auto|sub)/.test(i.build)).length]
    ],
    'suffix-ation': [
      ['wordfactory.B4 -ation', B4.filter(i => i.build.endsWith('ation')).length],
      ['spellingBanks -ation words', BANKS.flatMap(b => b.words).filter(w => w.w.endsWith('ation')).length]
    ],
    'suffix-ly': [
      ['spellingBanks.lyFamily', bankById.lyFamily.words.length],
      ['wordfactory.B2', B2.length]
    ],
    'suffix-ous': [
      ['spellingBanks.ousFamily', bankById.ousFamily.words.length],
      ['wordfactory.B4 -ous', B4.filter(i => i.build.endsWith('ous')).length]
    ],
    'endings-tion-sion-ssion-cian': [['spellingBanks.tionSionSsionCian', bankById.tionSionSsionCian.words.length]],
    'ch-as-k': [['spellingBanks.chSoundsLikeK', bankById.chSoundsLikeK.words.length]],
    'ch-as-sh': [['spellingBanks.chSoundsLikeSh', bankById.chSoundsLikeSh.words.length]],
    'gue-que': [['spellingBanks.gueAndQue', bankById.gueAndQue.words.length]],
    'sc-as-s': [['spellingBanks.silentIshSc', bankById.silentIshSc.words.length]],
    'ei-eigh-ey': [['spellingBanks.eiEighEy', bankById.eiEighEy.words.length]],
    'ou-as-u': [['spellingBanks.ouSoundsLikeU', bankById.ouSoundsLikeU.words.length]],
    'y-as-i': [['(searching all banks)', BANKS.flatMap(b => b.words).filter(w => /^(myth|gym|egypt|pyramid|mystery|crystal|symbol|system|lyric|typical|oxygen|hymn|syrup)/i.test(w.w)).length]],
    'doubling-multisyllable': [
      ['spellingBanks.doubleOrNotEndings', bankById.doubleOrNotEndings.words.length],
      ['wordfactory.B3+B3PLUS', B3.length + B3PLUS.length]
    ],
    'homophones': [
      ['spellingBanks.homophones', bankById.homophones.words.length],
      ['soundTwins sets', TWIN_SETS.length]
    ],
    'possessive-apostrophe-plurals': [['apostrophe.POSSESSION plural items', POSSESSION.filter(p => p.many).length]],
    'statutory-list': [['spelling.js WORDS', WORDS.length]],
    'suffix-ture': [['spellingBanks.tureFamily', bankById.tureFamily.words.length]]
  };
  for (const th of Y34_THEMES) {
    const srcs = themeSources[th.key] || [];
    const total = srcs.reduce((n, [, c]) => n + c, 0);
    const detail = srcs.map(([s, c]) => `${s}=${c}`).join(', ');
    const status = total === 0 ? 'ABSENT' : total < 6 ? 'THIN' : 'covered';
    info('curriculum', `${status.padEnd(7)} ${th.key} (${th.line}) — ${detail || 'no source'}`);
    if (status === 'ABSENT') flag(`curr:absent:${th.key}`, 'curriculum', `theme ABSENT: ${th.line}`);
    else if (status === 'THIN') flag(`curr:thin:${th.key}`, 'curriculum', `theme THIN (${total} items): ${th.line} — ${detail}`);
  }
  // the named sub-prefix: pre- (its own check because the bank name hides it)
  const preWords = [...appWords].filter(w => /^pre(?!ss|sent|tt)/.test(w));
  if (!preWords.some(w => ['preheat', 'preview', 'prehistoric', 'precook', 'preschool', 'prepay', 'predict'].includes(w)))
    flag('curr:thin:prefix-pre', 'curriculum', `prefix pre- has no dedicated teaching words (found only: ${preWords.join(', ') || 'none'})`);
}

// ---- 6. volume per game: 3 sessions, repeat rate ---------------------------------------
{
  const rnd = (n) => (Math.random() * n) | 0;
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const TRIALS = 120;
  // RUN21H A4 changed what a session IS: every engine now deals items it has not dealt
  // this session first, and only recycles once its pool genuinely exhausts. Measuring with
  // an independent shuffle per session would report the OLD behaviour and understate the
  // fix, so the simulator models the fresh-first dealer — the same rule tests/r21h-norepeat
  // .mjs proves the real engines obey, in a fresh browser context.
  //
  // `deal(items, n, seen)` mirrors the engines: unseen first, reset the cycle when the pool
  // is spent, never repeat within one round.
  function deal(items, n, seen) {
    const want = Math.min(n, items.length);
    let fresh = items.filter(x => !seen.has(x));
    if (!fresh.length) { items.forEach(x => seen.delete(x)); fresh = items.slice(); }
    const picks = shuffle(fresh.slice()).slice(0, want);
    if (picks.length < want) {
      const have = new Set(picks);
      for (const x of shuffle(items.slice())) {
        if (picks.length >= want) break;
        if (!have.has(x)) { picks.push(x); have.add(x); }
      }
    }
    picks.forEach(x => seen.add(x));
    return picks;
  }
  // A pool that is bounded by the real world cannot be padded without inventing something
  // false. These are reported, never flagged, with the reason the ceiling is real.
  const BOUNDED = {
    'sorting.monthsDays': 'there are twelve months; a round IS the year',
    'sorting.tenths': 'a tenth has nine values between 0 and 1; the pool is every one of them in decimal, fraction and word form',
    'sorting.fractionFamilies': 'bounded by the fractions that reduce cleanly to a quarter or three quarters with a Y3/4-sized divisor',
    'blendit.L4': 'every longer word needs its own picture in js/wordart.js; these three are the only multi-syllable words the library already draws. Closing this is an ART job — see the ledger DECISION',
    'storyreader.sets': 'five authored sets; a session works through them all',
    // Themed spelling banks: each is bounded by the English words that genuinely fit its
    // pattern at Y3/4 reading age, and revisiting a pattern's words IS how spelling is
    // learnt. Spell Boo also weights mastered words down to 1/3, so a bank the child has
    // beaten stops dominating her rounds. Padding these with words no nine-year-old meets
    // would make the content worse, not better.
    'bank.chSoundsLikeSh': 'close to every /ʃ/-spelt-ch word in child-reachable English (12)',
    'bank.silentIshSc': 'bounded by the sc words a Y3/4 child meets (14)',
    'bank.ouSoundsLikeU': 'bounded by the /ʌ/-spelt-ou words a Y3/4 child meets (15)',
    'bank.chSoundsLikeK': 'bounded by the Greek-origin ch words at Y3/4 reading age (18)',
    'bank.gueAndQue': 'bounded by the -gue/-que words at Y3/4 reading age (18)',
    'bank.eiEighEy': 'bounded by the ei/eigh/ey words at Y3/4 reading age (18)',
    'bank.tureFamily': 'bounded by the -ture words at Y3/4 reading age (18)',
    'bank.yThatSoundsLikeI': 'bounded by the y-as-/ɪ/ words at Y3/4 reading age (16) — the whole appendix line is a short list',
    'bank.prefixesInIlImIr': 'four prefixes x five clear examples each (20); more would repeat the same joins',
    'bank.doubleOrNotEndings': 'bounded by the multisyllable roots whose stress a Y3/4 child can hear (20)',
    'spellboo.tier3': 'the statutory Y3/4 list is fixed at 109 words and no word may be added; tier 3 now holds the 20 hardest of them (was 10)',
    'sorting.shapeSides': 'bounded by the shape names a Y3/4 child meets that a REGULAR polygon can honestly wear (see the template note); round shortened to 9 instead of padded',
    'sorting.symmetry': 'bounded by the 26 capital letters — all of them are now in play',
    'rhymetime.couplets': 'six authored couplets; a session deals every one of them',
    'soundsorter.L4': 'twelve authored phonemes; the words inside a sound are its fixed authored six',
    'storyorder.L1': 'a level deals every story it has — depth here needs bespoke panel art (see the ledger DECISION)',
    'storyorder.L2': 'a level deals every story it has — depth here needs bespoke panel art (see the ledger DECISION)',
    'storyorder.L3': 'a level deals every story it has — depth here needs bespoke panel art (see the ledger DECISION)'
  };
  const report = (game, pool, sessionFn, note = '') => {
    let rep = 0;
    for (let t = 0; t < TRIALS; t++) {
      const s1 = sessionFn(), s2 = sessionFn(), s3 = sessionFn();
      const seen = new Set([...s1, ...s2]);
      rep += s3.filter(x => seen.has(x)).length / (s3.length || 1);
    }
    const pct = Math.round(100 * rep / TRIALS);
    const bounded = BOUNDED[game];
    const msg = `${game}: pool=${pool} session3 repeat=${pct}%${note ? ' — ' + note : ''}`;
    info('volume', bounded ? `${msg} [bounded: ${bounded}]` : msg);
    if (pct > 40 && !bounded) flag(`vol:${game}`, 'volume', msg);
    return pct;
  };
  // the fresh-first form: one session state per three-session trial, as a child experiences it
  const reportFresh = (game, items, n, note = '') => {
    let rep = 0;
    for (let t = 0; t < TRIALS; t++) {
      const seen = new Set();
      deal(items, n, seen); deal(items, n, seen);
      const before = new Set(seen);
      const s3 = deal(items, n, seen);
      rep += s3.filter(x => before.has(x)).length / (s3.length || 1);
    }
    const pct = Math.round(100 * rep / TRIALS);
    const bounded = BOUNDED[game];
    const msg = `${game}: pool=${items.length} round=${n} session3 repeat=${pct}%${note ? ' — ' + note : ''}`;
    info('volume', bounded ? `${msg} [bounded: ${bounded}]` : msg);
    if (pct > 40 && !bounded) flag(`vol:${game}`, 'volume', msg);
    return pct;
  };

  // sorting templates. The engines' A4 state is module-global and lives for the whole
  // process, so calling make() 360 times in a row would measure a pool that has been seen
  // to death — not what a child meets when she opens the app. The pool and the round length
  // are read from the real template, then dealt through the same fresh-first rule the
  // engine uses, one clean state per three-session trial. tests/r21h-norepeat.mjs asserts
  // the live engine really does deal this way.
  for (const t of [...TEMPLATES, ...TEMPLATES_EXTRA]) {
    const s = new Set();
    let roundLen = 0;
    for (let i = 0; i < 60; i++) { const r = t.make(); roundLen = Math.max(roundLen, r.items.length); r.items.forEach(it => s.add(it.key)); }
    reportFresh(`sorting.${t.id}`, [...s], roundLen);
  }
  // blend it: 8 words per round from the level pool
  for (const l of BLEND_LEVELS)
    reportFresh(`blendit.L${l.level}`, l.words.map(w => w.w), 8);
  // word factory: 8 items per round per level
  for (const [n, lvl] of Object.entries(FACTORY_LEVELS))
    reportFresh(`wordfactory.L${n}`, lvl.items.map(i => i.id), 8);
  // rhyme time L1/2: 8 targets across the hostable families; unit = target word
  const HOSTABLE = RHYME_FAMILIES.filter(f => rhymersOf(f).length >= 3);
  reportFresh('rhymetime.L1-2', HOSTABLE.flatMap(f => f.members), 8);
  // rhyme time L3: all six couplets every session
  reportFresh('rhymetime.couplets', COUPLETS.map((_, i) => 'c' + i), Math.min(8, COUPLETS.length));
  // sound sorter: 8 targets; unit = the target sound
  reportFresh('soundsorter.L4', PHONEME_KEYS.slice(), 8);
  // spellboo tiers: 8 words per round
  for (const t of [1, 2, 3])
    reportFresh(`spellboo.tier${t}`, WORDS.filter(w => w.t === t).map(w => w.w), 8);
  // spelling banks: 8 words per round
  for (const b of BANKS)
    reportFresh(`bank.${b.id}`, b.words.map(w => w.w), 8);
  // sound twins / twin trouble L2-3: pool of all 2-option sentences
  const pairItems = TWIN_SETS.filter(s => s.options.length === 2).flatMap(s => s.items.map(i => i.s));
  reportFresh('twintrouble.L2', pairItems, 8);
  // apostrophe: squeeze 8/16, comma 8/18
  reportFresh('apostrophe.squeeze', SQUEEZE.map(s => s.id), 8);
  reportFresh('apostrophe.comma', POSSESSION.map(s => s.id), 8);
  // stories: a session walks every story at the level
  for (const lvl of [1, 2, 3]) {
    const set = STORIES.filter(s => s.level === lvl);
    report(`storyorder.L${lvl}`, set.length, () => set.map(s => s.id), `level has ${set.length} stor${set.length === 1 ? 'y' : 'ies'}; every session shows all of them`);
  }
  report('storyreader.sets', STORY_READER_SETS.length, () => STORY_READER_SETS.map(s => s.id), `${STORY_READER_SETS.length} medium-tier sentence-sequencing sets`);
  // detective: shuffled cursor never repeats until the list cycles — report only
  info('volume', `detective: pools 4-letter=${FOUR.length} 5-letter=${FIVE.length}, cursor no-repeat (fine)`);
  info('volume', `bubblepop: ${BUBBLE_CATEGORIES.length} generative categories (infinite, fine)`);
}

// ---- report ----------------------------------------------------------------------------
const accepted = flags.filter(f => ACCEPTED.has(f.id));
const open = flags.filter(f => !ACCEPTED.has(f.id));
console.log('==============================================================');
console.log('RUN21H content audit — tools/content-audit.mjs');
console.log('==============================================================');
for (const area of ['inventory', 'duplicates', 'sorting', 'phoneme-truth', 'britishness', 'curriculum', 'volume']) {
  console.log(`\n--- ${area} ---`);
  for (const i of infos.filter(x => x.area === area)) console.log('  i  ' + i.msg);
  for (const f of open.filter(x => x.area === area)) console.log('  FLAG ' + f.id + ' — ' + f.msg);
  for (const f of accepted.filter(x => x.area === area)) console.log('  ok(accepted) ' + f.id + ' — ' + ACCEPTED.get(f.id));
}
console.log('\n==============================================================');
console.log(`${open.length} open flag(s), ${accepted.length} accepted, ${infos.length} info line(s)`);
console.log('==============================================================');
process.exit(open.length ? 1 : 0);
