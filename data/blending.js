// data/blending.js — RUN16 W2: Blend It content.
//
// AUTHORED IN RUN16.md AND COPIED EXACTLY (G13). The four levels' word lists are the
// brief's, verbatim and in the brief's order: CVC first, then digraph words, then longer.
// Never substitute, abbreviate or regenerate.
//
// RUN21H A3 ADDED words under GOVERNANCE-TONIGHT §2 ("ADD content where a game is thin").
// Nothing authored was changed, removed or reordered — every addition sits AFTER the
// authored words, marked `+ RUN21H`, and tests/r16w2-blendit.mjs still asserts the authored
// list as an exact prefix so a future edit cannot quietly drop one. The reason: a round
// deals 8 words, and levels 2 and 3 held only 12, so a child met the same handful for ever.
// Every added word already has a picture in js/wordart.js (a blend word without one is a
// broken card) and every split is a UK letters-and-sounds unit, same as the authored ones.
//
// `g` is the word's GRAPHEME split — the tiles the child slides together and the units the
// guide sounds out one at a time before saying the whole word. UK phonics (G15): sh/ch/th/
// ng/ck/ai/oa/oo/ee/ar/or/igh/ow/air/ea/er are single graphemes, doubled letters (bb, nn, ll)
// are one grapheme, and 'st' is kept whole at the end of dentist so no word exceeds six tiles.

export const BLEND_LEVELS = [
  {
    level: 1, name: 'Three sounds',
    words: [
      { w: 'cat', g: ['c', 'a', 't'] },
      { w: 'dog', g: ['d', 'o', 'g'] },
      { w: 'pin', g: ['p', 'i', 'n'] },
      { w: 'sun', g: ['s', 'u', 'n'] },
      { w: 'bed', g: ['b', 'e', 'd'] },
      { w: 'top', g: ['t', 'o', 'p'] },
      { w: 'hat', g: ['h', 'a', 't'] },
      { w: 'cup', g: ['c', 'u', 'p'] },
      { w: 'fox', g: ['f', 'o', 'x'] },
      { w: 'jam', g: ['j', 'a', 'm'] },
      { w: 'leg', g: ['l', 'e', 'g'] },
      { w: 'mug', g: ['m', 'u', 'g'] },
      { w: 'net', g: ['n', 'e', 't'] },
      { w: 'rug', g: ['r', 'u', 'g'] },
      { w: 'tin', g: ['t', 'i', 'n'] },
      { w: 'van', g: ['v', 'a', 'n'] },
      // + RUN21H A3 (16 -> 26)
      { w: 'mat', g: ['m', 'a', 't'] },
      { w: 'bat', g: ['b', 'a', 't'] },
      { w: 'rat', g: ['r', 'a', 't'] },
      { w: 'log', g: ['l', 'o', 'g'] },
      { w: 'jog', g: ['j', 'o', 'g'] },
      { w: 'fog', g: ['f', 'o', 'g'] },
      { w: 'bug', g: ['b', 'u', 'g'] },
      { w: 'hug', g: ['h', 'u', 'g'] },
      { w: 'mop', g: ['m', 'o', 'p'] },
      { w: 'hop', g: ['h', 'o', 'p'] }
    ]
  },
  {
    level: 2, name: 'Two letters, one sound',
    words: [
      { w: 'ship', g: ['sh', 'i', 'p'] },
      { w: 'chin', g: ['ch', 'i', 'n'] },
      { w: 'moth', g: ['m', 'o', 'th'] },
      { w: 'bath', g: ['b', 'a', 'th'] },
      { w: 'ring', g: ['r', 'i', 'ng'] },
      { w: 'fish', g: ['f', 'i', 'sh'] },
      { w: 'shop', g: ['sh', 'o', 'p'] },
      { w: 'chop', g: ['ch', 'o', 'p'] },
      { w: 'sock', g: ['s', 'o', 'ck'] },
      { w: 'duck', g: ['d', 'u', 'ck'] },
      { w: 'back', g: ['b', 'a', 'ck'] },
      { w: 'lick', g: ['l', 'i', 'ck'] },
      // + RUN21H A3 (12 -> 24). Doubled ll counts as one grapheme, as the header already says.
      { w: 'shed', g: ['sh', 'e', 'd'] },
      { w: 'wish', g: ['w', 'i', 'sh'] },
      { w: 'chip', g: ['ch', 'i', 'p'] },
      { w: 'path', g: ['p', 'a', 'th'] },
      { w: 'king', g: ['k', 'i', 'ng'] },
      { w: 'wing', g: ['w', 'i', 'ng'] },
      { w: 'song', g: ['s', 'o', 'ng'] },
      { w: 'sing', g: ['s', 'i', 'ng'] },
      { w: 'thing', g: ['th', 'i', 'ng'] },
      { w: 'bell', g: ['b', 'e', 'll'] },
      { w: 'well', g: ['w', 'e', 'll'] },
      { w: 'brush', g: ['b', 'r', 'u', 'sh'] }
    ]
  },
  {
    level: 3, name: 'Long vowel teams',
    words: [
      { w: 'rain', g: ['r', 'ai', 'n'] },
      { w: 'boat', g: ['b', 'oa', 't'] },
      { w: 'moon', g: ['m', 'oo', 'n'] },
      { w: 'star', g: ['s', 't', 'ar'] },
      { w: 'tree', g: ['t', 'r', 'ee'] },
      { w: 'corn', g: ['c', 'or', 'n'] },
      { w: 'night', g: ['n', 'igh', 't'] },
      { w: 'cow', g: ['c', 'ow'] },
      { w: 'spoon', g: ['s', 'p', 'oo', 'n'] },
      { w: 'chair', g: ['ch', 'air'] },
      { w: 'beach', g: ['b', 'ea', 'ch'] },
      { w: 'green', g: ['g', 'r', 'ee', 'n'] },
      // + RUN21H A3 (12 -> 24)
      { w: 'snail', g: ['s', 'n', 'ai', 'l'] },
      { w: 'train', g: ['t', 'r', 'ai', 'n'] },
      { w: 'goat', g: ['g', 'oa', 't'] },
      { w: 'coat', g: ['c', 'oa', 't'] },
      { w: 'food', g: ['f', 'oo', 'd'] },
      { w: 'boot', g: ['b', 'oo', 't'] },
      { w: 'car', g: ['c', 'ar'] },
      { w: 'farm', g: ['f', 'ar', 'm'] },
      { w: 'fork', g: ['f', 'or', 'k'] },
      { w: 'light', g: ['l', 'igh', 't'] },
      { w: 'owl', g: ['ow', 'l'] },
      { w: 'feet', g: ['f', 'ee', 't'] }
    ]
  },
  {
    level: 4, name: 'Longer words',
    words: [
      { w: 'rabbit', g: ['r', 'a', 'bb', 'i', 't'] },
      { w: 'basket', g: ['b', 'a', 's', 'k', 'e', 't'] },
      { w: 'magnet', g: ['m', 'a', 'g', 'n', 'e', 't'] },
      { w: 'picnic', g: ['p', 'i', 'c', 'n', 'i', 'c'] },
      { w: 'sunset', g: ['s', 'u', 'n', 's', 'e', 't'] },
      { w: 'helmet', g: ['h', 'e', 'l', 'm', 'e', 't'] },
      { w: 'pocket', g: ['p', 'o', 'ck', 'e', 't'] },
      { w: 'carpet', g: ['c', 'ar', 'p', 'e', 't'] },
      { w: 'dentist', g: ['d', 'e', 'n', 't', 'i', 'st'] },
      { w: 'tunnel', g: ['t', 'u', 'nn', 'e', 'l'] },
      // + RUN21H A3 (10 -> 13). Level 4 is the ONE level that could not be brought to 24:
      // every longer word needs its own picture in js/wordart.js, and these three are the
      // only multi-syllable words the library already draws. See the RUN21H ledger — the
      // remaining gap is an ART job, not a content one, and padding it with words that have
      // no picture would ship broken cards.
      { w: 'balloon', g: ['b', 'a', 'll', 'oo', 'n'] },
      { w: 'cartoon', g: ['c', 'ar', 't', 'oo', 'n'] },
      { w: 'flower', g: ['f', 'l', 'ow', 'er'] }
    ]
  }
];

export const BLEND_LEVEL_NUMBERS = BLEND_LEVELS.map(l => l.level);
export const blendLevel = (n) => BLEND_LEVELS.find(l => l.level === n) || BLEND_LEVELS[0];
export const ALL_BLEND_WORDS = BLEND_LEVELS.flatMap(l => l.words.map(w => w.w));
export function blendEntry(word) {
  for (const l of BLEND_LEVELS) { const e = l.words.find(w => w.w === word); if (e) return { ...e, level: l.level }; }
  return null;
}
// The word's graphemes must spell the word back exactly — a split that drops or invents a
// letter would teach a child to read a word that is not on the card. Tested, not assumed.
export function splitSpellsWord(entry) { return entry.g.join('') === entry.w; }

// RUN19 explanation pass (Alex, 2026-07-30: "explanation even if you got it right").
// The explanation for a decoding game IS the sound walk — the graphemes, then the word.
// Authored here, filled in the game, never composed there.
export function blendRightLine(entry) { return `Well done! ${entry.g.join(', ')} — slide them together and they say ${entry.w}!`; }
export function blendWrongLine(entry, picked) { return `That's ${picked}. Listen again — ${entry.g.join(', ')} — ${entry.w}!`; }
