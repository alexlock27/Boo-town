// data/personalities.js — RUN10 P5: six stable temperaments, assigned by a hash of the
// Boo's own id so the SAME Boo is always the same temperament (no state, no save field).
// Multipliers scale the town behaviour-engine's base act weights (js/town.js); catchphrases
// are spoken via the guide bubble on tap (20% of taps, authored exactly per spec).

export const PERSONALITIES = ['bouncy', 'sleepy', 'cheeky', 'shy', 'musical', 'sporty'];

function hashId(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return Math.abs(h);
}
export function personalityOf(booId) { return PERSONALITIES[hashId(booId || '') % PERSONALITIES.length]; }

// Multiplier keys line up with town.js's own act/goal-kind vocabulary: 'trampoline',
// 'bench', 'slide', 'swings', 'seesaw' key the generic 'approach' goal by WHICH activity
// item it found (town.js's ACT_MULT_KEY); 'chase'/'visit'/'watch'/'nap' key the top-level
// behaviour-choice candidates directly; 'danceStage'/'fairBand' key the 'musicwatch' goal
// (walk to a placed Dance Stage, or the funfair bandstand while standing in the funfair).
export const WEIGHTS = {
  bouncy:  { trampoline: 2.0, chase: 1.5, nap: 0.5 },
  sleepy:  { nap: 2.5, bench: 1.5, chase: 0.4 },
  cheeky:  { chase: 1.6, visit: 1.4, watch: 0.7 },
  shy:     { watch: 2.2, visit: 0.5 },
  musical: { danceStage: 2.2, fairBand: 1.6 },
  sporty:  { slide: 1.8, swings: 1.6, seesaw: 1.5 }
};
export const SHY_GREET_DIST_PX = 20;   // a shy Boo stands 20px further back on a friend visit

export function personalityMult(booId, actKey) {
  const w = WEIGHTS[personalityOf(booId)];
  return (w && w[actKey] != null) ? w[actKey] : 1;
}

export const CATCHPHRASES = {
  bouncy: 'Boing boing BOING!',
  sleepy: 'Five more minutes...',
  cheeky: 'Hee hee, you found me!',
  shy: '...oh! Hello.',
  musical: 'La la laaa!',
  sporty: 'Race you!'
};
export const CATCHPHRASE_RATE = 0.2;   // 20% of taps
