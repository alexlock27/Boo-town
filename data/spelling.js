// data/spelling.js — statutory Year 3/4 word list (spec §10.1). Do not add/remove words.
// Format: { w, t } with tier 1 (friendlier) .. 3 (trickiest). Exported as WORDS.

const T1 = ['answer','appear','arrive','build','busy','caught','centre','circle','early','earth','eight','enough','famous','forward','fruit','group','guard','guide','heard','heart','height','island','learn','length','library','minute','notice','often','popular','promise','purpose','quarter','question','recent','regular','remember','sentence','special','straight','strange','strength','thought','through','weight','woman','women'];

const T2 = ['accident','actual','actually','address','believe','bicycle','breath','breathe','business','calendar','century','certain','complete','consider','continue','decide','describe','different','difficult','disappear','eighth','exercise','experience','extreme','favourite','February','forwards','grammar','history','imagine','increase','important','interest','knowledge','material','medicine','mention','natural','naughty','opposite','perhaps','position','possible','potatoes','pressure','probably','reign','separate','suppose','surprise','therefore','though','various'];

const T3 = ['accidentally','although','experiment','occasion','occasionally','ordinary','particular','peculiar','possess','possession'];

export const WORDS = [
  ...T1.map(w => ({ w, t: 1 })),
  ...T2.map(w => ({ w, t: 2 })),
  ...T3.map(w => ({ w, t: 3 }))
];

export function wordsForTier(t) { return WORDS.filter(x => x.t === t).map(x => x.w); }

// Decoy letters: 3 letters not in the word, biased to confusable ones (vowels + s,l,c,t,r,n)
// then other consonants. Deterministic-ish but shuffled per call.
const BIASED = ['a', 'e', 'i', 'o', 'u', 's', 'l', 'c', 't', 'r', 'n'];
const OTHER = 'bdfghjkmpqvwxyz'.split('');

export function decoysFor(word) {
  const inWord = new Set(word.toLowerCase().split(''));
  const biased = shuffle(BIASED.filter(l => !inWord.has(l)));
  const other = shuffle(OTHER.filter(l => !inWord.has(l)));
  const pool = [...biased, ...other];
  return pool.slice(0, 3);
}

function shuffle(a) {
  a = a.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
