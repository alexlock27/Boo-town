// data/phonemes.js — RUN16 W1: Sound Sorter content.
//
// AUTHORED IN RUN16.md AND COPIED EXACTLY. The twelve phonemes and their six picture
// words each are pedagogical choices, not placeholders (G13): never substitute, reorder
// away from the list, abbreviate or regenerate. UK English, UK phonics, letters-and-
// sounds style phoneme framing (G15).
//
// Two tables, deliberately separate:
//
//   PHONEMES      — the authored twelve. `words` is the authored six, verbatim and in
//                   the authored order. A round's CORRECT answers are only ever drawn
//                   from this list, so the game can never show a "correct" word the
//                   brief did not author for that sound.
//   WORD_SOUNDS   — which of the twelve taught SOUNDS each pool word actually contains,
//                   and where. Membership is by SOUND, not by spelling, because the
//                   game's instruction is "tap every picture whose word CONTAINS that
//                   sound" — so `beach` really does contain the /ee/ sound (spelled ea)
//                   and is therefore never offered as an /ee/ distractor. This table is
//                   what makes "distractors never share the target phoneme" provable
//                   rather than hopeful.
//
// Positions: 'initial' the word starts with it, 'final' the word ends with it, 'medial'
// anywhere else. Level 1 asks initial, level 2 final, level 3 medial, level 4 mixes all
// three and draws its distractors from the authored near-miss lists.

// ---- the authored twelve -------------------------------------------------------------
// `card` is the grapheme shown (so the game is playable with sound off, G14), `say` is
// how the guide sounds the phoneme out, `tip` is the one-line teaching hook.
export const PHONEMES = [
  { key: 'sh',  card: 'sh',  say: 'shhh',  tip: 'the quiet sound',
    words: ['ship', 'shell', 'fish', 'brush', 'shed', 'wish'],
    nearMiss: ['chip', 'chair', 'watch', 'torch', 'cheese'] },
  { key: 'ch',  card: 'ch',  say: 'ch ch', tip: 'the sneezy sound',
    words: ['chip', 'chair', 'beach', 'cheese', 'church', 'watch'],
    nearMiss: ['ship', 'shell', 'shed', 'fish', 'brush', 'wish'] },
  { key: 'th',  card: 'th',  say: 'thhh',  tip: 'the tongue-out sound',
    words: ['thumb', 'thorn', 'bath', 'moth', 'three', 'path'],
    nearMiss: ['ship', 'shell', 'fish', 'chip', 'watch'] },
  { key: 'ng',  card: 'ng',  say: 'ng',    tip: 'the humming ending',
    words: ['ring', 'song', 'king', 'wing', 'strong', 'thing'],
    nearMiss: ['crown', 'town', 'clown', 'queen', 'corn', 'moon', 'spoon'] },
  { key: 'ai',  card: 'ai',  say: 'ay',    tip: 'the rainy sound',
    words: ['rain', 'snail', 'train', 'tail', 'paint', 'chain'],
    nearMiss: ['night', 'light', 'high', 'tree', 'bee', 'boat', 'coat'] },
  { key: 'ee',  card: 'ee',  say: 'eee',   tip: 'the smiley sound',
    words: ['sheep', 'tree', 'queen', 'bee', 'green', 'feet'],
    nearMiss: ['rain', 'train', 'snail', 'light', 'night'] },
  { key: 'oa',  card: 'oa',  say: 'oh',    tip: 'the floaty sound',
    words: ['boat', 'goat', 'coat', 'road', 'toast', 'soap'],
    nearMiss: ['moon', 'spoon', 'boot', 'food', 'cow', 'town'] },
  { key: 'oo',  card: 'oo',  say: 'oooo',  tip: 'the moon sound',
    words: ['moon', 'spoon', 'boot', 'roof', 'food', 'zoo'],
    nearMiss: ['boat', 'goat', 'coat', 'road', 'soap', 'owl', 'cow'] },
  { key: 'ar',  card: 'ar',  say: 'ar',    tip: 'the pirate sound',
    words: ['star', 'car', 'farm', 'park', 'shark', 'jar'],
    nearMiss: ['fork', 'horse', 'corn', 'storm', 'sport'] },
  { key: 'or',  card: 'or',  say: 'or',    tip: 'the door sound',
    words: ['fork', 'horse', 'corn', 'storm', 'torch', 'sport'],
    nearMiss: ['star', 'car', 'jar', 'farm', 'park'] },
  { key: 'igh', card: 'igh', say: 'eye',   tip: 'the night-time sound',
    words: ['light', 'night', 'high', 'right', 'sight', 'bright'],
    nearMiss: ['rain', 'train', 'snail', 'tail', 'tree', 'bee'] },
  { key: 'ow',  card: 'ow',  say: 'ow',    tip: 'the ouch sound',
    words: ['cow', 'owl', 'crown', 'flower', 'town', 'clown'],
    nearMiss: ['boat', 'goat', 'coat', 'road', 'soap', 'toast'] }
];
export const PHONEME_BY_KEY = Object.fromEntries(PHONEMES.map(p => [p.key, p]));
export const PHONEME_KEYS = PHONEMES.map(p => p.key);

// ---- which taught sounds each pool word contains, and where --------------------------
// Every word in every authored list appears exactly once here. A word can hold two
// taught sounds (thorn = th + or; church holds ch twice), so positions are always arrays.
//
// `avoid` names sounds this word must never be offered as a distractor FOR, because its
// vowel is accent-dependent in England: southern English says bath/path with the /ar/
// vowel, northern English does not. Neither child should ever be told she is wrong, so
// these two words simply never appear on an /ar/ card.
export const WORD_SOUNDS = {
  // sh
  ship:   { sh: ['initial'] },
  shell:  { sh: ['initial'] },
  fish:   { sh: ['final'] },
  brush:  { sh: ['final'] },
  shed:   { sh: ['initial'] },
  wish:   { sh: ['final'] },
  // ch
  chip:   { ch: ['initial'] },
  chair:  { ch: ['initial'] },
  beach:  { ee: ['medial'], ch: ['final'] },
  cheese: { ch: ['initial'], ee: ['medial'] },
  church: { ch: ['initial', 'final'] },
  watch:  { ch: ['final'] },
  // th
  thumb:  { th: ['initial'] },
  thorn:  { th: ['initial'], or: ['medial'] },
  bath:   { th: ['final'], avoid: ['ar'] },
  moth:   { th: ['final'] },
  three:  { th: ['initial'], ee: ['final'] },
  path:   { th: ['final'], avoid: ['ar'] },
  // ng
  ring:   { ng: ['final'] },
  song:   { ng: ['final'] },
  king:   { ng: ['final'] },
  wing:   { ng: ['final'] },
  strong: { ng: ['final'] },
  thing:  { th: ['initial'], ng: ['final'] },
  // ai
  rain:   { ai: ['medial'] },
  snail:  { ai: ['medial'] },
  train:  { ai: ['medial'] },
  tail:   { ai: ['medial'] },
  paint:  { ai: ['medial'] },
  chain:  { ch: ['initial'], ai: ['medial'] },
  // ee
  sheep:  { sh: ['initial'], ee: ['medial'] },
  tree:   { ee: ['final'] },
  queen:  { ee: ['medial'] },
  bee:    { ee: ['final'] },
  green:  { ee: ['medial'] },
  feet:   { ee: ['medial'] },
  // oa
  boat:   { oa: ['medial'] },
  goat:   { oa: ['medial'] },
  coat:   { oa: ['medial'] },
  road:   { oa: ['medial'] },
  toast:  { oa: ['medial'] },
  soap:   { oa: ['medial'] },
  // oo
  moon:   { oo: ['medial'] },
  spoon:  { oo: ['medial'] },
  boot:   { oo: ['medial'] },
  roof:   { oo: ['medial'] },
  food:   { oo: ['medial'] },
  zoo:    { oo: ['final'] },
  // ar
  star:   { ar: ['final'] },
  car:    { ar: ['final'] },
  farm:   { ar: ['medial'] },
  park:   { ar: ['medial'] },
  shark:  { sh: ['initial'], ar: ['medial'] },
  jar:    { ar: ['final'] },
  // or
  fork:   { or: ['medial'] },
  horse:  { or: ['medial'] },
  corn:   { or: ['medial'] },
  storm:  { or: ['medial'] },
  torch:  { or: ['medial'], ch: ['final'] },
  sport:  { or: ['medial'] },
  // igh
  light:  { igh: ['medial'] },
  night:  { igh: ['medial'] },
  high:   { igh: ['final'] },
  right:  { igh: ['medial'] },
  sight:  { igh: ['medial'] },
  bright: { igh: ['medial'] },
  // ow
  cow:    { ow: ['final'] },
  owl:    { ow: ['initial'] },
  crown:  { ow: ['medial'] },
  flower: { ow: ['medial'] },
  town:   { ow: ['medial'] },
  clown:  { ow: ['medial'] }
};

// The whole card pool: every authored word, in authored order, no duplicates.
export const SOUND_POOL = (() => {
  const out = [];
  for (const p of PHONEMES) for (const w of p.words) if (!out.includes(w)) out.push(w);
  return out;
})();

// ---- pure helpers the game and the tests share ---------------------------------------
export function soundsIn(word) {
  const e = WORD_SOUNDS[word] || {};
  return Object.keys(e).filter(k => k !== 'avoid');
}
export function hasSound(word, sound) { return soundsIn(word).includes(sound); }
export function positionsOf(word, sound) {
  const e = WORD_SOUNDS[word];
  return (e && Array.isArray(e[sound])) ? e[sound].slice() : [];
}
export function hasSoundAt(word, sound, position) { return positionsOf(word, sound).includes(position); }
// A word never offered as a distractor for this sound (accent-dependent vowels).
export function avoidsAsDistractor(word, sound) {
  const e = WORD_SOUNDS[word];
  return !!(e && Array.isArray(e.avoid) && e.avoid.includes(sound));
}
// Legal distractor: does not contain the target sound at all, and is not accent-fragile.
export function isLegalDistractor(word, sound) {
  return !hasSound(word, sound) && !avoidsAsDistractor(word, sound);
}
// The authored words for this phoneme that carry it in the position a level asks for.
export function authoredAt(sound, position) {
  const p = PHONEME_BY_KEY[sound];
  if (!p) return [];
  return p.words.filter(w => hasSoundAt(w, sound, position));
}

// ---- the levels ----------------------------------------------------------------------
// Level 1 initial, 2 final, 3 medial, 4 mixed with near-miss distractors. A sound is
// only eligible for a positional level when the authored six give it at least MIN_CORRECT
// words in that position — otherwise the round could not be built honestly.
export const SOUND_LEVELS = [1, 2, 3, 4];
export const LEVEL_POSITION = { 1: 'initial', 2: 'final', 3: 'medial', 4: 'any' };
export const LEVEL_NAME = { 1: 'Sounds at the start', 2: 'Sounds at the end', 3: 'Sounds in the middle', 4: 'Sounds anywhere' };
export const MIN_CORRECT = 2;
export function targetsForLevel(level) {
  if (level === 4) return PHONEME_KEYS.slice();
  const pos = LEVEL_POSITION[level];
  return PHONEME_KEYS.filter(k => authoredAt(k, pos).length >= MIN_CORRECT);
}
