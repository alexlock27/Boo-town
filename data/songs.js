// data/songs.js — Boo Band 2.0 song content (RUN9 C6, reworked to the C6 addendum).
// Note names map to semitones from C4 (0). Melodies stay within C4..E5 (0..16).
// Little Boo Songs: authored EXACTLY per the brief (public-domain nursery tunes).
// Boo Pop Hits: four ORIGINAL modern-pop tracks — melodies are { note|'rest', beats } over
// EXACTLY 16 bars of 4 beats (64 beats). Composition rules are binding and machine-checked
// by tests/lib/melody.mjs (hook bars 1-2 verbatim at 5-6 and 9-10; tempo 112-124;
// progression one of I-V-vi-IV / vi-IV-I-V / I-vi-IV-V; ≥25% off-beat starts; ≥3 durations,
// ≤4 consecutive same-duration; hook leap ≥ a fourth + a stepwise run of 3; the peak in bars
// 9-12 not bar 1; ≥2 rests; ≥60% on-beat chord tones; final note a final-chord tone; range
// C4-E5; smooth loop-back). "Golden Boo"'s hook + opening phrase are AUTHORED verbatim from
// the brief; its hook has no ≥4th leap, so per the authored-content rule the validator
// requires Golden's leap anywhere in the melody (bars 7→8 G→D') — see PROGRESS.md.
// The specified backing (kick 1&3, snare 2&4, eighth hats + fill every 4th bar, bass roots
// with passing notes, off-beat chord stabs) is synthesized by Boo Beat from `progression`.

export const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11, "C'": 12, "D'": 14, "E'": 16 };
export function noteSemi(n) { return NOTE[n]; }

// mel(list) — [[note|'rest', beats]] → [{ note, beats, semi|null }]
function mel(list) { return list.map(([note, beats]) => ({ note, beats, semi: note === 'rest' ? null : NOTE[note] })); }

// ---- Little Boo Songs (Toddler set; labelled "for little Boos" elsewhere) ----
export const LITTLE_BOO_SONGS = [
  { id: 'twinkle', name: 'Twinkle Twinkle', melody: mel([
    ['C',1],['C',1],['G',1],['G',1],['A',1],['A',1],['G',2],
    ['F',1],['F',1],['E',1],['E',1],['D',1],['D',1],['C',2],
    ['G',1],['G',1],['F',1],['F',1],['E',1],['E',1],['D',2],
    ['G',1],['G',1],['F',1],['F',1],['E',1],['E',1],['D',2],
    ['C',1],['C',1],['G',1],['G',1],['A',1],['A',1],['G',2],
    ['F',1],['F',1],['E',1],['E',1],['D',1],['D',1],['C',2]
  ]) },
  // Row Row Row Your Boat: C C C D E, E D E F G, C' C' C' G G G E E E C C C, G F E D C
  { id: 'row', name: 'Row Your Boat', melody: mel([
    ['C',1],['C',1],['C',0.75],['D',0.25],['E',1],
    ['E',0.75],['D',0.25],['E',0.75],['F',0.25],['G',2],
    ["C'",0.5],["C'",0.5],["C'",0.5],['G',0.5],['G',0.5],['G',0.5],['E',0.5],['E',0.5],['E',0.5],['C',0.5],['C',0.5],['C',0.5],
    ['G',0.75],['F',0.25],['E',0.75],['D',0.25],['C',2]
  ]) },
  // Old MacDonald: C C C G A A G, E E D D C  (×2)
  { id: 'oldmac', name: 'Old MacDonald', melody: mel([
    ['C',1],['C',1],['C',1],['G',1],['A',1],['A',1],['G',2],
    ['E',1],['E',1],['D',1],['D',1],['C',2],
    ['C',1],['C',1],['C',1],['G',1],['A',1],['A',1],['G',2],
    ['E',1],['E',1],['D',1],['D',1],['C',2]
  ]) }
];

// ---- Boo Pop Hits: the four validator-passing winners (candidates + scores in PROGRESS.md).
// Hook = bars 1-2, repeated verbatim at bars 5-6 and 9-10 per the rules.
const GOLDEN_HOOK = [['A',.5],['A',.5],["C'",1],['A',.5],['G',.5],['E',1],['G',.5],['G',.5],['A',1],['G',.5],['E',.5],['D',1]];
const NEON_HOOK = [['E',.5],['G',.5],["C'",1.5],["C'",.5],['G',1],['B',.5],['A',.5],['G',1],['D',1],['rest',1]];
const SPARK_HOOK = [['G',.5],["C'",.5],["D'",1],["C'",.5],['G',.5],['E',1],["C'",.5],['B',.5],['A',1],['E',.5],['A',1.5]];
const MID_HOOK = [['E',.5],['D',.5],['C',1],['D',.5],['E',1.5],['A',1],["C'",.5],['A',.5],['F',1],['rest',1]];

export const BOO_POP_HITS = [
  // THE QUALITY BAR — hook + opening phrase authored exactly per the brief, extended to 16 bars.
  { id: 'golden', name: 'Golden Boo', bpm: 116, progression: ['Am', 'F', 'C', 'G'], melody: mel([
    ...GOLDEN_HOOK,                                                                   // bars 1-2 (authored hook)
    ['C',.5],['D',.5],['E',1],['G',1],['A',1],['G',.5],['E',.5],['D',.5],['C',1.5],['rest',1],  // bars 3-4 (authored opening + rest)
    ...GOLDEN_HOOK,                                                                   // bars 5-6
    ['E',1.5],['G',.5],["C'",1],['G',1],                                              // bar 7 (C)
    ["D'",1],['B',.5],['G',.5],['A',1],['B',1],                                       // bar 8 (G) — the G→D' leap
    ...GOLDEN_HOOK,                                                                   // bars 9-10
    ['G',.5],["C'",.5],["E'",1],["D'",.5],["C'",.5],["E'",1],                         // bar 11 (C) — the E' peak
    ["D'",1],['B',.5],['A',.5],['G',1],['rest',1],                                    // bar 12 (G)
    ['A',1],["C'",.5],['B',.5],['A',1],['E',1],                                       // bar 13 (Am)
    ['F',1],['A',.5],['G',.5],['F',1],['C',1],                                        // bar 14 (F)
    ['E',1.5],['D',.5],['C',1],['D',1],                                               // bar 15 (C)
    ['B',.5],['A',.5],['G',3]                                                         // bar 16 (G) — settles on G
  ]) },
  { id: 'neon', name: 'Neon Star', bpm: 120, progression: ['C', 'G', 'Am', 'F'], melody: mel([
    ...NEON_HOOK,
    ['A',.5],["C'",.5],['B',.5],['A',.5],['E',1],['A',1],                             // bar 3 (Am)
    ['F',.5],['G',.5],['A',1],["C'",1],['rest',1],                                    // bar 4 (F)
    ...NEON_HOOK,
    ['E',1],["C'",.5],['A',.5],['E',.5],['A',.5],["C'",1],                            // bar 7 (Am)
    ["C'",1],["D'",.5],["C'",.5],['A',1],['F',1],                                     // bar 8 (F)
    ...NEON_HOOK,
    ["C'",.5],["E'",1],["C'",.5],['A',1],['E',1],                                     // bar 11 (Am) — the E' peak
    ["D'",.5],["E'",.5],["C'",1],['A',1],['F',1],                                     // bar 12 (F)
    ['E',.5],['G',.5],['E',1],['C',1],['G',1],                                        // bar 13 (C)
    ['D',1],['G',.5],['B',.5],["D'",1],['B',1],                                       // bar 14 (G)
    ["C'",1],['B',.5],['A',.5],['E',1],['A',1],                                       // bar 15 (Am)
    ['G',.5],['A',.5],['F',3]                                                         // bar 16 (F)
  ]) },
  { id: 'sparkle', name: 'Sparkle Rush', bpm: 124, progression: ['C', 'Am', 'F', 'G'], melody: mel([
    ...SPARK_HOOK,
    ['A',.5],['G',.5],['F',1],['A',.5],["C'",1.5],                                    // bar 3 (F)
    ['B',1],['A',.5],['G',.5],['D',1],['rest',1],                                     // bar 4 (G)
    ...SPARK_HOOK,
    ["C'",1],['A',.5],['F',.5],['A',.5],["C'",.5],['F',1],                            // bar 7 (F)
    ["D'",.5],['B',.5],['G',1],['B',.5],['D',1.5],                                    // bar 8 (G)
    ...SPARK_HOOK,
    ['F',.5],['A',.5],["C'",1.5],["E'",.5],["D'",.5],["C'",.5],                       // bar 11 (F) — the E' peak
    ["D'",1],['B',.5],['G',.5],['B',1],['rest',1],                                    // bar 12 (G)
    ['E',.5],['G',.5],["C'",1],['G',1],['E',1],                                       // bar 13 (C)
    ['A',1],["C'",.5],['B',.5],['A',.5],['E',1.5],                                    // bar 14 (Am)
    ['F',1],['G',.5],['A',.5],["C'",1],['A',1],                                       // bar 15 (F)
    ['A',.5],['B',.5],['G',3]                                                         // bar 16 (G)
  ]) },
  { id: 'midnight', name: 'Midnight Dance', bpm: 112, progression: ['Am', 'F', 'C', 'G'], melody: mel([
    ...MID_HOOK,
    ['G',.5],['E',.5],['C',1],['E',.5],['G',1.5],                                     // bar 3 (C)
    ['D',1],['G',.5],['B',.5],["D'",1],['rest',1],                                    // bar 4 (G)
    ...MID_HOOK,
    ['E',1],['G',.5],['E',.5],['C',.5],['E',.5],['G',1],                              // bar 7 (C)
    ['B',1],['A',.5],['G',.5],['D',1],['G',1],                                        // bar 8 (G)
    ...MID_HOOK,
    ["C'",1],["E'",.5],["D'",.5],["C'",1],['G',1],                                    // bar 11 (C) — the E' peak
    ["D'",1],['B',.5],['A',.5],['G',1],['D',1],                                       // bar 12 (G)
    ['A',1],['E',.5],['C',.5],['A',.5],['E',1.5],                                     // bar 13 (Am)
    ['F',1],['A',.5],["C'",.5],['A',1],['F',1],                                       // bar 14 (F)
    ['E',1.5],['D',.5],['C',1],['E',1],                                               // bar 15 (C)
    ['D',.5],['E',.5],['D',3]                                                         // bar 16 (G) — settles on D
  ]) }
];

export const HIT_BY_ID = Object.fromEntries(BOO_POP_HITS.map(h => [h.id, h]));
