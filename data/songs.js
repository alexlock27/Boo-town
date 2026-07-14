// data/songs.js — Boo Band 2.0 song content (RUN9 C6).
// Note names map to semitones from C4 (0). Melodies stay within C4..E5 (0..16).
// Little Boo Songs: authored EXACTLY per the brief (public-domain nursery tunes).
// Boo Pop Hits: four ORIGINAL modern-pop tracks (no real-world melodies) — the first,
// "Golden Boo", is authored exactly as the quality bar; the other three are composed to
// the binding style spec (112–124 bpm; a four-chord loop I V vi IV or vi IV I V; a 2-bar
// hook that recurs; syncopation; melody within C4–E5; loops seamlessly).

export const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11, "C'": 12, "D'": 14, "E'": 16 };
export function noteSemi(n) { return NOTE[n]; }

// mel(list) — list of [noteName, beats] → [{ note, beats, semi }]
function mel(list) { return list.map(([note, beats]) => ({ note, beats, semi: NOTE[note] })); }

// ---- Little Boo Songs (Toddler set; labelled "for little Boos" elsewhere) ----
// Twinkle Twinkle (as shipped) — white-key indices live in band.js (TWINKLE); here as notes.
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

// ---- Boo Pop Hits (band play-along AND Boo Beat's backing tracks) ----
// { id, name, bpm, progression:[chord×4], melody:[{note,beats,semi}] }
export const BOO_POP_HITS = [
  // THE QUALITY BAR — authored exactly per the brief.
  { id: 'golden', name: 'Golden Boo', bpm: 116, progression: ['Am', 'F', 'C', 'G'], melody: mel([
    ['A',0.5],['A',0.5],["C'",1],['A',0.5],['G',0.5],['E',1],
    ['G',0.5],['G',0.5],['A',1],['G',0.5],['E',0.5],['D',1],
    ['C',0.5],['D',0.5],['E',1],['G',1],
    ['A',1],['G',0.5],['E',0.5],['D',0.5],['C',1.5]
  ]) },
  // Neon Star — I V vi IV (C G Am F), 120 bpm. Hook "E G C' C' A G" recurs (bars 1-2 & 3-4),
  // syncopated with off-beat halves; melody D4..C5, loops clean on the tonic.
  { id: 'neon', name: 'Neon Star', bpm: 120, progression: ['C', 'G', 'Am', 'F'], melody: mel([
    ['E',0.5],['G',0.5],["C'",1],["C'",0.5],['A',0.5],['G',1],['E',0.5],['D',0.5],['E',1],['D',1],['C',1],
    ['E',0.5],['G',0.5],["C'",1],["C'",0.5],['A',0.5],['G',1],['A',0.5],['G',0.5],['E',1],['D',1],['C',1]
  ]) },
  // Sparkle Rush — vi IV I V (Am F C G), 124 bpm. Bright rising hook "A C' E' C' A G" recurs,
  // heavy syncopation, reaches E5, resolves down to loop.
  { id: 'sparkle', name: 'Sparkle Rush', bpm: 124, progression: ['Am', 'F', 'C', 'G'], melody: mel([
    ['A',0.5],["C'",0.5],["E'",1],["C'",0.5],['A',0.5],['G',1],['E',0.5],['G',0.5],["C'",1],['A',2],
    ['A',0.5],["C'",0.5],["E'",1],["C'",0.5],['A',0.5],['G',1],['A',0.5],['G',0.5],['E',0.5],['D',0.5],['C',2]
  ]) },
  // Midnight Dance — vi IV I V (Am F C G), 112 bpm (the chilled Hit). Smooth hook
  // "E D C D E G" recurs, gentle syncopation, stays mid-range, loops smoothly.
  { id: 'midnight', name: 'Midnight Dance', bpm: 112, progression: ['Am', 'F', 'C', 'G'], melody: mel([
    ['E',0.5],['D',0.5],['C',1],['D',0.5],['E',0.5],['G',1],['A',0.5],['G',0.5],['E',1],['D',2],
    ['E',0.5],['D',0.5],['C',1],['D',0.5],['E',0.5],['G',1],['E',0.5],['D',0.5],['C',1],['C',2]
  ]) }
];

export const HIT_BY_ID = Object.fromEntries(BOO_POP_HITS.map(h => [h.id, h]));
