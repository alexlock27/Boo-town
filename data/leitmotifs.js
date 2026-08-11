// data/leitmotifs.js — RUN21F F8: one 8-bar leitmotif per outdoor area.
//
// ORIGINAL COMPOSITIONS. No real-world melody, not a fragment of one — the house law, and
// a legal one. Each lead line was checked note by note, as an interval-plus-rhythm
// contour, against the nursery rhymes, folk standards and ubiquitous themes a parent
// would recognise; the working is in RUN21F-PROGRESS.md's F8 entry.
//
// Shape (the band engine's event shape, so these arrays stay engine-portable data):
//   { t: ms from the loop's start · i: 'lead'|'pad'|'bass' · v: semitones from C4 (261.63Hz)
//     · d: duration in ms }
// Played by js/sfx.js's leitmotif scheduler as the area's calm-music VARIANT: the music
// bus, the music volume, the music mute, the same duck under speech. sfx.js loops them by
// audio clock, so bar 8 hands back to bar 1 with no seam.
//
// Every loop is exactly 8 bars of 4/4, strictly pentatonic major on its own root, at most
// three voices, 76-92 bpm (pack F8). A distinct root AND a distinct tempo per area is what
// makes five tunes in one scale-family identifiable blind. The Funfair is deliberately
// absent (its jingle and bandstand already own that air) and so are the interiors, which
// keep the plain calm loop — a room is not a landscape.
//
// Constraints machine-checked by tests/r21f8-leitmotifs.mjs §0: grid, seam, scale,
// registers, monophony, pad dyad cap, unbroken sound, >=3 lead durations, and the peak
// landing in bars 4-7.

export const LEITMOTIFS = {
  // ---- The Meadow — "Pottering Among the Flowers" ----------------------------------------------
  // C major pentatonic · 84 bpm · bass + lead + pad · lead C4-D5
  // RUN21v3 A-3: the lead BREATHES. As first composed it sounded for 100% of its 22.9s loop
  // and never rested once — measured by the composing lane itself, in the area a child spends
  // the most time in, where every other area's lead rests between 3% and 38% of its own loop.
  // A melody that never stops is how ambient music turns into a nuisance in the room next door.
  // The fix is the one that lane prescribed and no more: four phrase-ENDING notes shortened, at
  // the tie-overs into bars 3, 5, 7 and the loop seam. Not one onset, pitch or note was removed,
  // so the "pottering turn" restated in bars 1/3/7 and the bar-6 peak are exactly as authored —
  // 92.2% sounding, 7.8% resting, longest rest one beat. The bass runs unbroken underneath, so
  // the whole texture still never falls silent (the continuity law is about the TEXTURE, not
  // the lead). Guarded by tests/r21f8-leitmotifs.mjs §0's rest-fraction band.
  meadow: {
    title: "Pottering Among the Flowers", root: 'C', bpm: 84, bars: 8, durMs: 22857.14,
    events: [
      // bar 1
      { t:        0, i: 'bass',   v: -12, d: 2142.86 },
      { t:        0, i: 'lead',   v:   7, d:  535.71 },
      { t:        0, i: 'pad',    v:   0, d: 2857.14 },
      { t:        0, i: 'pad',    v:   7, d: 2857.14 },
      { t:   535.71, i: 'lead',   v:   4, d:  178.57 },
      { t:   714.29, i: 'lead',   v:   2, d:  357.14 },
      { t:  1071.43, i: 'lead',   v:   4, d:  357.14 },
      { t:  1428.57, i: 'lead',   v:   0, d: 1071.43 },
      { t:  2142.86, i: 'bass',   v:  -5, d:  714.29 },
      { t:     2500, i: 'lead',   v:   2, d:  357.14 },
      // bar 2
      { t:  2857.14, i: 'bass',   v:  -3, d: 1428.57 },
      { t:  2857.14, i: 'lead',   v:   4, d:  357.14 },
      { t:  3214.29, i: 'lead',   v:   2, d:  357.14 },
      { t:  3571.43, i: 'lead',   v:   4, d:  357.14 },
      { t:  3928.57, i: 'lead',   v:   7, d:  357.14 },
      { t:  4285.71, i: 'bass',   v:  -5, d: 1428.57 },
      { t:  4285.71, i: 'lead',   v:   9, d:  714.29 },
      { t:     5000, i: 'lead',   v:   7, d:  357.14 },
      // bar 3
      { t:  5714.29, i: 'bass',   v: -12, d: 2142.86 },
      { t:  5714.29, i: 'lead',   v:   7, d:  535.71 },
      { t:  5714.29, i: 'pad',    v:   4, d: 2857.14 },
      { t:  5714.29, i: 'pad',    v:   7, d: 2857.14 },
      { t:     6250, i: 'lead',   v:   4, d:  178.57 },
      { t:  6428.57, i: 'lead',   v:   2, d:  357.14 },
      { t:  6785.71, i: 'lead',   v:   4, d:  357.14 },
      { t:  7142.86, i: 'lead',   v:   7, d: 1071.43 },
      { t:  7857.14, i: 'bass',   v:  -8, d:  714.29 },
      { t:  8214.29, i: 'lead',   v:   9, d:  357.14 },
      // bar 4
      { t:  8571.43, i: 'bass',   v: -10, d: 1428.57 },
      { t:  8571.43, i: 'lead',   v:   9, d:  535.71 },
      { t:  9107.14, i: 'lead',   v:   7, d:  178.57 },
      { t:  9285.71, i: 'lead',   v:   4, d:  357.14 },
      { t:  9642.86, i: 'lead',   v:   2, d: 1071.43 },
      { t:    10000, i: 'bass',   v:  -5, d: 1428.57 },
      // bar 5
      { t: 11428.57, i: 'bass',   v:  -3, d: 1428.57 },
      { t: 11428.57, i: 'lead',   v:   4, d:  357.14 },
      { t: 11428.57, i: 'pad',    v:   0, d: 2857.14 },
      { t: 11428.57, i: 'pad',    v:   4, d: 2857.14 },
      { t: 11785.71, i: 'lead',   v:   7, d:  357.14 },
      { t: 12142.86, i: 'lead',   v:   9, d:  714.29 },
      { t: 12857.14, i: 'bass',   v:  -8, d: 1428.57 },
      { t: 12857.14, i: 'lead',   v:  12, d: 1071.43 },
      { t: 13928.57, i: 'lead',   v:   9, d:  357.14 },
      // bar 6
      { t: 14285.71, i: 'bass',   v: -10, d: 1428.57 },
      { t: 14285.71, i: 'lead',   v:  14, d: 1071.43 },
      { t: 14285.71, i: 'pad',    v:   2, d: 2857.14 },
      { t: 14285.71, i: 'pad',    v:   9, d: 2857.14 },
      { t: 15357.14, i: 'lead',   v:  12, d:  357.14 },
      { t: 15714.29, i: 'bass',   v:  -5, d: 1428.57 },
      { t: 15714.29, i: 'lead',   v:   9, d:  357.14 },
      { t: 16071.43, i: 'lead',   v:   7, d:  357.14 },
      { t: 16428.57, i: 'lead',   v:   9, d:  357.14 },
      // bar 7
      { t: 17142.86, i: 'bass',   v: -12, d: 2142.86 },
      { t: 17142.86, i: 'lead',   v:   7, d:  535.71 },
      { t: 17142.86, i: 'pad',    v:   0, d: 2857.14 },
      { t: 17142.86, i: 'pad',    v:   7, d: 2857.14 },
      { t: 17678.57, i: 'lead',   v:   4, d:  178.57 },
      { t: 17857.14, i: 'lead',   v:   2, d:  357.14 },
      { t: 18214.29, i: 'lead',   v:   4, d:  357.14 },
      { t: 18571.43, i: 'lead',   v:   7, d:  714.29 },
      { t: 19285.71, i: 'bass',   v:  -5, d:  714.29 },
      { t: 19285.71, i: 'lead',   v:   4, d:  714.29 },
      // bar 8
      { t:    20000, i: 'bass',   v: -10, d: 1428.57 },
      { t:    20000, i: 'lead',   v:   2, d: 1071.43 },
      { t:    20000, i: 'pad',    v:   2, d: 2857.14 },
      { t:    20000, i: 'pad',    v:   7, d: 2857.14 },
      { t: 21071.43, i: 'lead',   v:   0, d: 1428.57 },
      { t: 21428.57, i: 'bass',   v:  -5, d: 1428.57 },
    ]
  },
  // ---- Riverside — "Leaf on the Current" ----------------------------------------------
  // F major pentatonic · 88 bpm · bass + lead + pad · lead F4-D5
  riverside: {
    title: "Leaf on the Current", root: 'F', bpm: 88, bars: 8, durMs: 21818.18,
    events: [
      // bar 1
      { t:        0, i: 'bass',   v:  -7, d: 2727.27 },
      { t:        0, i: 'lead',   v:   9, d: 1022.73 },
      { t:        0, i: 'pad',    v:  -7, d:  340.91 },
      { t:   340.91, i: 'pad',    v:   0, d:  340.91 },
      { t:   681.82, i: 'pad',    v:   2, d:  340.91 },
      { t:  1022.73, i: 'lead',   v:  12, d:  340.91 },
      { t:  1022.73, i: 'pad',    v:   0, d:  340.91 },
      { t:  1363.64, i: 'lead',   v:   9, d:  681.82 },
      { t:  1363.64, i: 'pad',    v:  -7, d:  340.91 },
      { t:  1704.55, i: 'pad',    v:   0, d:  340.91 },
      { t:  2045.45, i: 'lead',   v:   7, d:  681.82 },
      { t:  2045.45, i: 'pad',    v:   2, d:  340.91 },
      { t:  2386.36, i: 'pad',    v:   0, d:  340.91 },
      // bar 2
      { t:  2727.27, i: 'bass',   v:  -7, d: 2727.27 },
      { t:  2727.27, i: 'lead',   v:   5, d: 1704.55 },
      { t:  2727.27, i: 'pad',    v:  -7, d:  340.91 },
      { t:  3068.18, i: 'pad',    v:   0, d:  340.91 },
      { t:  3409.09, i: 'pad',    v:   2, d:  340.91 },
      { t:     3750, i: 'pad',    v:   0, d:  340.91 },
      { t:  4090.91, i: 'pad',    v:  -7, d:  340.91 },
      { t:  4431.82, i: 'pad',    v:   0, d:  340.91 },
      { t:  4772.73, i: 'pad',    v:   2, d:  340.91 },
      { t:  5113.64, i: 'pad',    v:   0, d:  340.91 },
      // bar 3
      { t:  5454.55, i: 'bass',   v: -10, d: 2727.27 },
      { t:  5454.55, i: 'lead',   v:   9, d: 1022.73 },
      { t:  5454.55, i: 'pad',    v: -10, d:  340.91 },
      { t:  5795.45, i: 'pad',    v:  -3, d:  340.91 },
      { t:  6136.36, i: 'pad',    v:   0, d:  340.91 },
      { t:  6477.27, i: 'lead',   v:   7, d:  340.91 },
      { t:  6477.27, i: 'pad',    v:  -3, d:  340.91 },
      { t:  6818.18, i: 'lead',   v:   9, d:  681.82 },
      { t:  6818.18, i: 'pad',    v: -10, d:  340.91 },
      { t:  7159.09, i: 'pad',    v:  -3, d:  340.91 },
      { t:     7500, i: 'lead',   v:  12, d:  681.82 },
      { t:     7500, i: 'pad',    v:   0, d:  340.91 },
      { t:  7840.91, i: 'pad',    v:  -3, d:  340.91 },
      // bar 4
      { t:  8181.82, i: 'bass',   v: -12, d: 2727.27 },
      { t:  8181.82, i: 'lead',   v:   9, d:  681.82 },
      { t:  8181.82, i: 'pad',    v: -12, d:  340.91 },
      { t:  8522.73, i: 'pad',    v:  -5, d:  340.91 },
      { t:  8863.64, i: 'lead',   v:   7, d: 1363.64 },
      { t:  8863.64, i: 'pad',    v:   0, d:  340.91 },
      { t:  9204.55, i: 'pad',    v:  -5, d:  340.91 },
      { t:  9545.45, i: 'pad',    v: -12, d:  340.91 },
      { t:  9886.36, i: 'pad',    v:  -5, d:  340.91 },
      { t: 10227.27, i: 'pad',    v:   0, d:  340.91 },
      { t: 10568.18, i: 'pad',    v:  -5, d:  340.91 },
      // bar 5
      { t: 10909.09, i: 'bass',   v: -10, d: 2727.27 },
      { t: 10909.09, i: 'lead',   v:  12, d: 1022.73 },
      { t: 10909.09, i: 'pad',    v: -10, d:  340.91 },
      { t:    11250, i: 'pad',    v:  -3, d:  340.91 },
      { t: 11590.91, i: 'pad',    v:   0, d:  340.91 },
      { t: 11931.82, i: 'lead',   v:  14, d:  340.91 },
      { t: 11931.82, i: 'pad',    v:  -3, d:  340.91 },
      { t: 12272.73, i: 'lead',   v:  12, d:  681.82 },
      { t: 12272.73, i: 'pad',    v: -10, d:  340.91 },
      { t: 12613.64, i: 'pad',    v:  -3, d:  340.91 },
      { t: 12954.55, i: 'lead',   v:  14, d: 1022.73 },
      { t: 12954.55, i: 'pad',    v:   0, d:  340.91 },
      { t: 13295.45, i: 'pad',    v:  -3, d:  340.91 },
      // bar 6
      { t: 13636.36, i: 'bass',   v:  -7, d: 2727.27 },
      { t: 13636.36, i: 'pad',    v:  -7, d:  340.91 },
      { t: 13977.27, i: 'lead',   v:  12, d:  681.82 },
      { t: 13977.27, i: 'pad',    v:   0, d:  340.91 },
      { t: 14318.18, i: 'pad',    v:   2, d:  340.91 },
      { t: 14659.09, i: 'lead',   v:   9, d:  340.91 },
      { t: 14659.09, i: 'pad',    v:   0, d:  340.91 },
      { t:    15000, i: 'lead',   v:   7, d:  681.82 },
      { t:    15000, i: 'pad',    v:  -7, d:  340.91 },
      { t: 15340.91, i: 'pad',    v:   0, d:  340.91 },
      { t: 15681.82, i: 'lead',   v:   9, d:  681.82 },
      { t: 15681.82, i: 'pad',    v:   2, d:  340.91 },
      { t: 16022.73, i: 'pad',    v:   0, d:  340.91 },
      // bar 7
      { t: 16363.64, i: 'bass',   v:  -5, d: 1363.64 },
      { t: 16363.64, i: 'lead',   v:  12, d:  340.91 },
      { t: 16363.64, i: 'pad',    v:  -5, d:  340.91 },
      { t: 16704.55, i: 'lead',   v:   9, d: 1022.73 },
      { t: 16704.55, i: 'pad',    v:   0, d:  340.91 },
      { t: 17045.45, i: 'pad',    v:   2, d:  340.91 },
      { t: 17386.36, i: 'pad',    v:   0, d:  340.91 },
      { t: 17727.27, i: 'bass',   v: -12, d: 1363.64 },
      { t: 17727.27, i: 'lead',   v:   5, d:  681.82 },
      { t: 17727.27, i: 'pad',    v: -12, d:  340.91 },
      { t: 18068.18, i: 'pad',    v:  -5, d:  340.91 },
      { t: 18409.09, i: 'lead',   v:   9, d:  681.82 },
      { t: 18409.09, i: 'pad',    v:   0, d:  340.91 },
      { t:    18750, i: 'pad',    v:  -5, d:  340.91 },
      // bar 8
      { t: 19090.91, i: 'bass',   v: -12, d: 2727.27 },
      { t: 19090.91, i: 'lead',   v:   7, d: 2045.45 },
      { t: 19090.91, i: 'pad',    v: -12, d:  340.91 },
      { t: 19431.82, i: 'pad',    v:  -5, d:  340.91 },
      { t: 19772.73, i: 'pad',    v:   0, d:  340.91 },
      { t: 20113.64, i: 'pad',    v:  -5, d:  340.91 },
      { t: 20454.55, i: 'pad',    v: -12, d:  340.91 },
      { t: 20795.45, i: 'pad',    v:  -5, d:  340.91 },
      { t: 21136.36, i: 'pad',    v:   0, d:  340.91 },
      { t: 21477.27, i: 'pad',    v:   2, d:  340.91 },
    ]
  },
  // ---- Hilltop — "A Call Across the Valley" ----------------------------------------------
  // G major pentatonic · 76 bpm · lead + pad · lead D4-E5
  hilltop: {
    title: "A Call Across the Valley", root: 'G', bpm: 76, bars: 8, durMs: 25263.16,
    events: [
      // bar 1
      { t:        0, i: 'lead',   v:   7, d: 1184.21 },
      { t:        0, i: 'pad',    v:  -5, d: 6315.79 },
      { t:        0, i: 'pad',    v:   2, d: 6315.79 },
      { t:  1184.21, i: 'lead',   v:  14, d: 1973.68 },
      // bar 2
      { t:  3157.89, i: 'lead',   v:  11, d:  789.47 },
      { t:  3947.37, i: 'lead',   v:   9, d: 1973.68 },
      // bar 3
      { t:  6315.79, i: 'lead',   v:   4, d: 1578.95 },
      { t:  6315.79, i: 'pad',    v:  -5, d: 6315.79 },
      { t:  6315.79, i: 'pad',    v:   2, d: 6315.79 },
      { t:  7894.74, i: 'lead',   v:   7, d: 1578.95 },
      // bar 4
      { t:  9473.68, i: 'lead',   v:   9, d:  789.47 },
      { t: 10263.16, i: 'lead',   v:  14, d: 1973.68 },
      // bar 5
      { t: 12631.58, i: 'lead',   v:  16, d: 2368.42 },
      { t: 12631.58, i: 'pad',    v:  -8, d: 6315.79 },
      { t: 12631.58, i: 'pad',    v:  -1, d: 6315.79 },
      { t:    15000, i: 'lead',   v:  14, d:  789.47 },
      // bar 6
      { t: 15789.47, i: 'lead',   v:  11, d: 1578.95 },
      { t: 17368.42, i: 'lead',   v:   9, d: 1578.95 },
      // bar 7
      { t: 18947.37, i: 'lead',   v:   7, d: 1578.95 },
      { t: 18947.37, i: 'pad',    v:  -5, d: 6315.79 },
      { t: 18947.37, i: 'pad',    v:   2, d: 6315.79 },
      { t: 20526.32, i: 'lead',   v:   9, d:  789.47 },
      { t: 21315.79, i: 'lead',   v:   4, d:  789.47 },
      // bar 8
      { t: 22105.26, i: 'lead',   v:   2, d: 3157.89 },
    ]
  },
  // ---- Sunny Beach — "Ice Cream Tide" ----------------------------------------------
  // D major pentatonic · 80 bpm · bass + pad + lead · lead D4-E5
  beach: {
    title: "Ice Cream Tide", root: 'D', bpm: 80, bars: 8, durMs: 24000,
    events: [
      // bar 1
      { t:        0, i: 'bass',   v: -10, d:    1125 },
      { t:        0, i: 'pad',    v:  -3, d:    6000 },
      { t:        0, i: 'pad',    v:   6, d:    1500 },
      { t:     1125, i: 'bass',   v:  -3, d:     375 },
      { t:     1125, i: 'lead',   v:   2, d:     375 },
      { t:     1500, i: 'bass',   v: -10, d:    1125 },
      { t:     1500, i: 'lead',   v:   4, d:     375 },
      { t:     1500, i: 'pad',    v:   2, d:    4500 },
      { t:     1875, i: 'lead',   v:   6, d:  1312.5 },
      // bar 2
      { t:     3000, i: 'bass',   v:  -1, d:    1125 },
      { t:     4125, i: 'lead',   v:   4, d:     375 },
      { t:     4500, i: 'lead',   v:   6, d:     375 },
      { t:     4875, i: 'bass',   v:  -6, d:    1125 },
      { t:     4875, i: 'lead',   v:   9, d:    1125 },
      // bar 3
      { t:     6000, i: 'bass',   v:  -8, d:    1125 },
      { t:     6000, i: 'pad',    v:  -8, d:    3000 },
      { t:   6562.5, i: 'lead',   v:  11, d:   562.5 },
      { t:     6750, i: 'pad',    v:  -1, d:    2250 },
      { t:     7125, i: 'bass',   v:  -1, d:     375 },
      { t:     7125, i: 'lead',   v:   9, d:   562.5 },
      { t:     7500, i: 'bass',   v:  -8, d:    1125 },
      { t:   7687.5, i: 'lead',   v:   6, d:     375 },
      { t:   8062.5, i: 'lead',   v:   4, d:   937.5 },
      // bar 4
      { t:     9000, i: 'bass',   v:  -3, d:    1125 },
      { t:     9000, i: 'pad',    v:  -3, d:    3000 },
      { t:     9750, i: 'pad',    v:   4, d:    2250 },
      { t:    10125, i: 'lead',   v:   4, d:     375 },
      { t:    10500, i: 'lead',   v:   6, d:     375 },
      { t:    10875, i: 'bass',   v:  -8, d:    1125 },
      { t:    10875, i: 'lead',   v:   9, d:     375 },
      { t:    11250, i: 'lead',   v:  11, d:     750 },
      // bar 5
      { t:    12000, i: 'bass',   v: -10, d:    1125 },
      { t:    12000, i: 'pad',    v:  -6, d:    3000 },
      { t:    12375, i: 'lead',   v:  14, d:     750 },
      { t:    12750, i: 'pad',    v:   2, d:    2250 },
      { t:    13125, i: 'bass',   v:  -3, d:     375 },
      { t:    13125, i: 'lead',   v:  11, d:     375 },
      { t:    13500, i: 'bass',   v: -10, d:    1125 },
      { t:    13500, i: 'lead',   v:  14, d:    1500 },
      // bar 6
      { t:    15000, i: 'bass',   v:  -1, d:    1125 },
      { t:    15000, i: 'pad',    v:  -1, d:    3000 },
      { t:    15375, i: 'lead',   v:  16, d:    1125 },
      { t:    15750, i: 'pad',    v:   6, d:    2250 },
      { t:    16500, i: 'lead',   v:  14, d:     375 },
      { t:    16875, i: 'bass',   v:  -6, d:    1125 },
      { t:    16875, i: 'lead',   v:  11, d:    1125 },
      // bar 7
      { t:    18000, i: 'bass',   v:  -8, d:    1125 },
      { t:    18000, i: 'pad',    v:  -8, d:    1500 },
      { t:    18000, i: 'pad',    v:   4, d:    1500 },
      { t:  18562.5, i: 'lead',   v:  11, d:     375 },
      { t:  18937.5, i: 'lead',   v:   9, d:     375 },
      { t:  19312.5, i: 'lead',   v:   6, d:  1312.5 },
      { t:    19500, i: 'bass',   v:  -3, d:    1500 },
      { t:    19500, i: 'pad',    v:  -3, d:    1500 },
      { t:    19500, i: 'pad',    v:   4, d:    1500 },
      // bar 8
      { t:    21000, i: 'bass',   v: -10, d:    3000 },
      { t:    21000, i: 'pad',    v:   2, d:    3000 },
      { t:    21000, i: 'pad',    v:   6, d:    3000 },
      { t:    21375, i: 'lead',   v:   4, d:    1125 },
      { t:    22500, i: 'lead',   v:   2, d:  1312.5 },
    ]
  },
  // ---- The Playground — "Yoo-Hoo from the Slide" ----------------------------------------------
  // A major pentatonic · 92 bpm · bass + lead + pad · lead C#4-E5
  playground: {
    title: "Yoo-Hoo from the Slide", root: 'A', bpm: 92, bars: 8, durMs: 20869.57,
    events: [
      // bar 1
      { t:        0, i: 'bass',   v:  -3, d:  326.09 },
      { t:        0, i: 'lead',   v:   4, d:  326.09 },
      { t:        0, i: 'pad',    v:   4, d:  2608.7 },
      { t:   652.17, i: 'lead',   v:   1, d:  489.13 },
      { t:   978.26, i: 'bass',   v:  -8, d:  163.04 },
      { t:  1304.35, i: 'bass',   v:  -3, d:  326.09 },
      { t:  1304.35, i: 'pad',    v:   1, d:  2608.7 },
      { t:  1630.43, i: 'lead',   v:   4, d:  163.04 },
      { t:  1956.52, i: 'lead',   v:   6, d:  163.04 },
      { t:  2282.61, i: 'bass',   v:  -8, d:  163.04 },
      { t:  2282.61, i: 'lead',   v:   9, d:  326.09 },
      // bar 2
      { t:   2608.7, i: 'bass',   v:  -3, d:  326.09 },
      { t:   2608.7, i: 'lead',   v:   9, d:  163.04 },
      { t:   2608.7, i: 'pad',    v:   9, d:  2608.7 },
      { t:  2771.74, i: 'lead',   v:   9, d:  163.04 },
      { t:  2934.78, i: 'lead',   v:  11, d:  163.04 },
      { t:  3097.83, i: 'lead',   v:   9, d:  163.04 },
      { t:  3260.87, i: 'lead',   v:   6, d:  326.09 },
      { t:  3586.96, i: 'bass',   v:  -8, d:  163.04 },
      { t:  3913.04, i: 'bass',   v:  -3, d:  326.09 },
      { t:  3913.04, i: 'lead',   v:   9, d:  163.04 },
      { t:  3913.04, i: 'pad',    v:   6, d:  2608.7 },
      { t:  4239.13, i: 'lead',   v:  11, d:  163.04 },
      { t:  4565.22, i: 'lead',   v:  13, d:  489.13 },
      { t:   4891.3, i: 'bass',   v:  -8, d:  163.04 },
      // bar 3
      { t:  5217.39, i: 'bass',   v:  -6, d:  326.09 },
      { t:  5217.39, i: 'lead',   v:  13, d:  326.09 },
      { t:  5217.39, i: 'pad',    v:   1, d:  2608.7 },
      { t:  5869.57, i: 'lead',   v:   9, d:  489.13 },
      { t:  6195.65, i: 'bass',   v: -11, d:  163.04 },
      { t:  6521.74, i: 'bass',   v:  -6, d:  326.09 },
      { t:  6521.74, i: 'pad',    v:   9, d:  2608.7 },
      { t:  6847.83, i: 'lead',   v:  13, d:  163.04 },
      { t:  7173.91, i: 'lead',   v:  11, d:  163.04 },
      { t:     7500, i: 'bass',   v: -11, d:  163.04 },
      { t:     7500, i: 'lead',   v:   9, d:  326.09 },
      // bar 4
      { t:  7826.09, i: 'bass',   v:  -3, d:  326.09 },
      { t:  7826.09, i: 'lead',   v:   6, d:  163.04 },
      { t:  7826.09, i: 'pad',    v:   4, d:  2608.7 },
      { t:  7989.13, i: 'lead',   v:   6, d:  163.04 },
      { t:  8152.17, i: 'lead',   v:   9, d:  163.04 },
      { t:  8315.22, i: 'lead',   v:   6, d:  163.04 },
      { t:  8478.26, i: 'lead',   v:   4, d:  326.09 },
      { t:  8804.35, i: 'bass',   v:  -8, d:  163.04 },
      { t:  9130.43, i: 'bass',   v:  -3, d:  326.09 },
      { t:  9130.43, i: 'lead',   v:   9, d:  978.26 },
      { t:  9130.43, i: 'pad',    v:   9, d:  2608.7 },
      { t:  10108.7, i: 'bass',   v:  -8, d:  163.04 },
      // bar 5
      { t: 10434.78, i: 'bass',   v:  -3, d:  326.09 },
      { t: 10434.78, i: 'lead',   v:   9, d:  163.04 },
      { t: 10434.78, i: 'pad',    v:  11, d:  2608.7 },
      { t: 10597.83, i: 'lead',   v:  11, d:  163.04 },
      { t: 10760.87, i: 'lead',   v:  13, d:  163.04 },
      { t: 10923.91, i: 'lead',   v:  11, d:  163.04 },
      { t: 11086.96, i: 'lead',   v:  13, d:  326.09 },
      { t: 11413.04, i: 'bass',   v:  -8, d:  163.04 },
      { t: 11739.13, i: 'bass',   v:  -3, d:  326.09 },
      { t: 11739.13, i: 'lead',   v:  16, d:  489.13 },
      { t: 11739.13, i: 'pad',    v:   4, d:  2608.7 },
      { t:  12391.3, i: 'lead',   v:  13, d:  326.09 },
      { t: 12717.39, i: 'bass',   v:  -8, d:  163.04 },
      // bar 6
      { t: 13043.48, i: 'bass',   v:  -8, d:  326.09 },
      { t: 13043.48, i: 'lead',   v:  16, d:  163.04 },
      { t: 13043.48, i: 'pad',    v:  11, d:  2608.7 },
      { t: 13369.57, i: 'lead',   v:  16, d:  163.04 },
      { t: 13695.65, i: 'lead',   v:  13, d:  326.09 },
      { t: 14021.74, i: 'bass',   v:  -1, d:  163.04 },
      { t: 14347.83, i: 'bass',   v:  -8, d:  326.09 },
      { t: 14347.83, i: 'lead',   v:  11, d:  163.04 },
      { t: 14347.83, i: 'pad',    v:   6, d:  2608.7 },
      { t: 14673.91, i: 'lead',   v:  13, d:  163.04 },
      { t:    15000, i: 'lead',   v:  11, d:  326.09 },
      { t: 15326.09, i: 'bass',   v:  -1, d:  163.04 },
      // bar 7
      { t: 15652.17, i: 'bass',   v:  -6, d:  326.09 },
      { t: 15652.17, i: 'lead',   v:   9, d:  163.04 },
      { t: 15652.17, i: 'pad',    v:   1, d:  2608.7 },
      { t: 15815.22, i: 'lead',   v:   9, d:  163.04 },
      { t: 15978.26, i: 'lead',   v:  11, d:  163.04 },
      { t:  16141.3, i: 'lead',   v:   9, d:  163.04 },
      { t: 16304.35, i: 'lead',   v:   6, d:  326.09 },
      { t: 16630.43, i: 'bass',   v: -11, d:  163.04 },
      { t: 16956.52, i: 'bass',   v:  -8, d:  326.09 },
      { t: 16956.52, i: 'lead',   v:   4, d:  326.09 },
      { t: 16956.52, i: 'pad',    v:   4, d:  2608.7 },
      { t:  17608.7, i: 'lead',   v:   6, d:  326.09 },
      { t: 17934.78, i: 'bass',   v:  -1, d:  163.04 },
      // bar 8
      { t: 18260.87, i: 'bass',   v:  -3, d:  652.17 },
      { t: 18260.87, i: 'lead',   v:   1, d:  326.09 },
      { t: 18260.87, i: 'pad',    v:   9, d:  2608.7 },
      { t: 18913.04, i: 'lead',   v:   4, d:  326.09 },
      { t: 19565.22, i: 'bass',   v:  -8, d:  326.09 },
      { t: 19565.22, i: 'lead',   v:   9, d:  978.26 },
      { t: 20217.39, i: 'bass',   v:  -3, d:  652.17 },
    ]
  },
};

export const LEITMOTIF_AREAS = Object.keys(LEITMOTIFS);
