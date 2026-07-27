// data/rhymes.js — RUN16 W3: Rhyme Time content.
//
// AUTHORED IN RUN16.md AND COPIED EXACTLY (G13). The ten word families with their members,
// the kite TRAP inside -ight, and all six couplets with their answers are the brief's own
// words in the brief's own order. Never substitute, abbreviate or regenerate.
//
// Two authored things and one implementation thing live here:
//   families   — the brief's ten families and their members, verbatim.
//   nearMiss   — level 2's near-miss card: a word that does NOT rhyme with the family but
//                that a child could plausibly believe does. The brief authors the model
//                itself — "car"/"care" — and rules out anything as hard as though/cough by
//                name. Each one shares the family's letters where such a word exists
//                (gate/-at, yoga/-og, shelf/-ell, care/-ar, eight/-ight, rope/-op) and is
//                otherwise one sound away (back/-ake, sink/-ing, book/-oon, bus/-ug).
//
//   THE KITE PROBLEM (flagged in NEEDS_ALEX.md and RUN16_REPORT.md). The brief lists the
//   -ight family as "light, night, bright, kite(TRAP), right" AND asserts that "traps never
//   rhyme". Those two cannot both hold: kite (/kaɪt/) rhymes with light (/laɪt/) perfectly.
//   Marking it as a non-rhyme would have the guide tell a child that kite and light do not
//   rhyme, which is false and is exactly the kind of thing a child remembers.
//   So: kite stays in the family exactly as authored and counts as a RHYME, and its authored
//   trap role is honoured in the only way that is also true — it is the SPELLING odd one out
//   (`spellingOdd`), and when she taps it the guide says so. The -ight family's non-rhyming
//   near-miss is `eight`, which really does share 'igh' and really does not rhyme.
//
//   couplets   — the six couplets, verbatim, with the authored answer. The two decoys are
//                pool words that do NOT rhyme with the answer, so the couplet has exactly
//                one right ending. Option order is randomised at runtime.

export const RHYME_FAMILIES = [
  { key: 'at',   label: '-at',   members: ['cat', 'hat', 'mat', 'bat', 'rat', 'flat'],   nearMiss: 'gate' },
  { key: 'og',   label: '-og',   members: ['dog', 'log', 'frog', 'jog', 'fog'],          nearMiss: 'yoga' },
  { key: 'ake',  label: '-ake',  members: ['cake', 'lake', 'snake', 'rake', 'shake'],    nearMiss: 'back' },
  { key: 'ell',  label: '-ell',  members: ['bell', 'shell', 'well', 'smell', 'spell'],   nearMiss: 'shelf' },
  { key: 'ing',  label: '-ing',  members: ['king', 'ring', 'sing', 'wing', 'string'],    nearMiss: 'sink' },
  { key: 'ight', label: '-ight', members: ['light', 'night', 'bright', 'kite', 'right'], nearMiss: 'eight',
    spellingOdd: 'kite',
    spellingOddLine: "Yes — kite! It hasn't got i-g-h in it, but listen: kite, light. It rhymes!" },
  { key: 'ar',   label: '-ar',   members: ['star', 'car', 'jar', 'far', 'guitar'],       nearMiss: 'care' },
  { key: 'oon',  label: '-oon',  members: ['moon', 'spoon', 'balloon', 'cartoon'],       nearMiss: 'book' },
  { key: 'ug',   label: '-ug',   members: ['bug', 'mug', 'rug', 'hug', 'plug'],          nearMiss: 'bus' },
  { key: 'op',   label: '-op',   members: ['shop', 'stop', 'mop', 'drop', 'hop'],        nearMiss: 'rope' }
];

// Every member of a family rhymes with every other member — that is what a family IS, and
// nothing in the authored lists breaks it (see THE KITE PROBLEM above).
export function rhymersOf(fam) { return fam.members.slice(); }
// The one member whose SPELLING does not follow the family pattern, if the family has one.
export function spellingOddOf(fam) { return fam.spellingOdd || null; }
export const FAMILY_BY_KEY = Object.fromEntries(RHYME_FAMILIES.map(f => [f.key, f]));
export const RHYME_TRAPS = RHYME_FAMILIES.map(f => f.nearMiss);
// Every picture a Rhyme Time round can show.
export const ALL_RHYME_WORDS = [...new Set([...RHYME_FAMILIES.flatMap(f => f.members), ...RHYME_TRAPS])];

// Which family a word rhymes in (a word belongs to at most one; a near-miss belongs to none).
const RHYME_OF = (() => {
  const m = {};
  for (const f of RHYME_FAMILIES) for (const w of rhymersOf(f)) m[w] = f.key;
  return m;
})();
export function rhymeKeyOf(word) { return RHYME_OF[word] || null; }
export function rhymesTogether(a, b) { const k = rhymeKeyOf(a); return !!k && k === rhymeKeyOf(b); }

// ---- level 3: the six couplets, verbatim ---------------------------------------------
// `lines` are the two lines as authored; the gap is where the child drops her chosen word.
export const COUPLETS = [
  { lines: ['A little Boo sat on a log,', 'and made a friend who was a ___'], answer: 'frog', decoys: ['tree', 'moon'] },
  { lines: ['The moon came up, the sky went dark,', 'the Boos all danced around the ___'], answer: 'park', decoys: ['cake', 'fish'] },
  { lines: ['I found a shell beside the sea,', 'I put it in my pocket for ___'], answer: 'me', decoys: ['dog', 'star'] },
  { lines: ['The band played loud, the drums went bang,', 'and every single Boo just ___'], answer: 'sang', decoys: ['hop', 'bell'] },
  { lines: ['A sleepy Boo went up to bed,', 'and rested down her fluffy ___'], answer: 'head', decoys: ['log', 'rain'] },
  { lines: ['We baked a great enormous cake,', 'then took it swimming in the ___'], answer: 'lake', decoys: ['sock', 'king'] }
];
// Words the couplets need pictures for beyond the families (sang reuses the sing drawing).
export const COUPLET_ART = { sang: 'sing' };
export const artKeyFor = (word) => COUPLET_ART[word] || word;
export const ALL_COUPLET_WORDS = [...new Set(COUPLETS.flatMap(c => [c.answer, ...c.decoys]))];

export const RHYME_LEVELS = [1, 2, 3];
export const RHYME_LEVEL_NAME = { 1: 'Find the rhymes', 2: 'Watch for the trick', 3: 'Finish the rhyme' };
