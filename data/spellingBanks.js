// data/spellingBanks.js — themed spelling word banks (EXPANSION_1.md §3.1).
// Content is parent-approved as written: do not add/remove/reword words. UK spellings.
// Shape: { id, name, words: [{ w, t, clue? }] }. Homophones carry a clue sentence.
// The Big List (statutory) lives in spelling.js; this file is the new themed banks.

export const BANKS = [
  // Tricky Sounds — the 'th' sound, a known weak spot (RUN3 C1). All tier 1.
  { id: 'trickyTh', name: 'Tricky Sounds', words: [
      { w: 'with', t: 1 }, { w: 'this', t: 1 }, { w: 'that', t: 1 }, { w: 'then', t: 1 },
      { w: 'them', t: 1 }, { w: 'than', t: 1 }, { w: 'they', t: 1 }, { w: 'both', t: 1 },
      { w: 'bath', t: 1 }, { w: 'path', t: 1 }, { w: 'teeth', t: 1 }, { w: 'three', t: 1 },
      { w: 'think', t: 1 }, { w: 'thank', t: 1 }, { w: 'thing', t: 1 }, { w: 'month', t: 1 },
      { w: 'mother', t: 1 }, { w: 'father', t: 1 }, { w: 'brother', t: 1 }, { w: 'other', t: 1 },
      { w: 'another', t: 1 }, { w: 'together', t: 1 }, { w: 'birthday', t: 1 }, { w: 'Thursday', t: 1 }
  ]},
  // RUN21H A3: the statutory Y3/4 appendix line is "Prefixes un-, dis-, mis-, re-, PRE-",
  // and pre- had no teaching words anywhere in the app. Six join here and the bank is
  // renamed to match the curriculum line it serves. 16 -> 30 words.
  { id: 'prefixesUnDisMisRe', name: 'Prefixes un, dis, mis, re, pre', words: [
      { w: 'unhappy', t: 1 }, { w: 'unfair', t: 1 }, { w: 'unlock', t: 1 }, { w: 'untie', t: 1 },
      { w: 'unkind', t: 1 }, { w: 'undo', t: 1 },
      { w: 'disagree', t: 1 }, { w: 'dislike', t: 1 }, { w: 'disobey', t: 1 }, { w: 'disappear', t: 1 },
      { w: 'dishonest', t: 2 }, { w: 'disallow', t: 2 },
      { w: 'misbehave', t: 1 }, { w: 'mislead', t: 1 }, { w: 'misspell', t: 1 },
      { w: 'misplace', t: 1 }, { w: 'mistrust', t: 2 },
      { w: 'redo', t: 1 }, { w: 'refresh', t: 1 }, { w: 'return', t: 1 }, { w: 'reappear', t: 1 }, { w: 'rebuild', t: 1 },
      { w: 'replay', t: 1 }, { w: 'reheat', t: 1 },
      { w: 'preheat', t: 2 }, { w: 'preview', t: 2 },
      { w: 'prepare', t: 2 }, { w: 'prehistoric', t: 3 }
  ]},
  // RUN21H A3: 8 -> 20 words, four per prefix so each of in/il/im/ir is drilled properly.
  { id: 'prefixesInIlImIr', name: 'Prefixes in, il, im, ir', words: [
      { w: 'inactive', t: 2 }, { w: 'incorrect', t: 2 }, { w: 'invisible', t: 2 },
      { w: 'incomplete', t: 2 }, { w: 'inedible', t: 3 }, { w: 'insecure', t: 3 },
      { w: 'illegal', t: 2 }, { w: 'illegible', t: 3 }, { w: 'illogical', t: 3 }, { w: 'illiterate', t: 3 },
      { w: 'impossible', t: 2 }, { w: 'impatient', t: 2 }, { w: 'imperfect', t: 2 },
      { w: 'impolite', t: 2 }, { w: 'immature', t: 3 }, { w: 'immortal', t: 3 },
      { w: 'irregular', t: 2 }, { w: 'irresponsible', t: 3 }, { w: 'irreplaceable', t: 3 }, { w: 'irrelevant', t: 3 }
  ]},
  // RUN21H A3: 12 -> 24 words, so three whole rounds are fresh.
  { id: 'prefixesSuperAntiAutoInterSub', name: 'Prefixes super, anti, auto, inter, sub', words: [
      { w: 'supermarket', t: 2 }, { w: 'superstar', t: 2 }, { w: 'superhero', t: 2 },
      { w: 'supersonic', t: 3 }, { w: 'superstore', t: 2 },
      { w: 'antiseptic', t: 2 }, { w: 'anticlockwise', t: 2 },
      { w: 'antifreeze', t: 2 }, { w: 'antisocial', t: 3 },
      { w: 'autograph', t: 2 }, { w: 'automatic', t: 2 },
      { w: 'autobiography', t: 3 }, { w: 'autocorrect', t: 3 }, { w: 'autopilot', t: 2 },
      { w: 'interact', t: 2 }, { w: 'international', t: 2 },
      { w: 'interfere', t: 3 }, { w: 'internet', t: 2 }, { w: 'interrupt', t: 2 },
      { w: 'submarine', t: 2 }, { w: 'subheading', t: 2 }, { w: 'subway', t: 2 },
      { w: 'subtitle', t: 2 }, { w: 'submerge', t: 3 }
  ]},
  // RUN21H A3: 14 -> 24. The additions keep the bank's own spread of join rules —
  // straight-on (-ly), y→i, le→ly and ic→ally — rather than piling up easy ones.
  { id: 'lyFamily', name: 'The ly family', words: [
      { w: 'sadly', t: 2 }, { w: 'completely', t: 2 }, { w: 'usually', t: 2 }, { w: 'finally', t: 2 },
      { w: 'comically', t: 2 }, { w: 'happily', t: 2 }, { w: 'angrily', t: 2 }, { w: 'gently', t: 2 },
      { w: 'simply', t: 2 }, { w: 'humbly', t: 2 }, { w: 'nobly', t: 2 }, { w: 'basically', t: 2 },
      { w: 'frantically', t: 2 }, { w: 'dramatically', t: 2 },
      { w: 'slowly', t: 1 }, { w: 'quietly', t: 1 }, { w: 'bravely', t: 1 }, { w: 'gladly', t: 1 },
      { w: 'easily', t: 2 }, { w: 'hungrily', t: 2 }, { w: 'terribly', t: 2 }, { w: 'sensibly', t: 2 },
      { w: 'politely', t: 2 }, { w: 'suddenly', t: 2 }
  ]},
  // RUN21H A3: 16 -> 24, keeping the spread of -ous joins (straight on, keep the e, y→i).
  { id: 'ousFamily', name: 'The ous family', words: [
      { w: 'poisonous', t: 2 }, { w: 'dangerous', t: 2 }, { w: 'mountainous', t: 2 }, { w: 'famous', t: 2 },
      { w: 'various', t: 2 }, { w: 'tremendous', t: 2 }, { w: 'enormous', t: 2 }, { w: 'jealous', t: 2 },
      { w: 'humorous', t: 2 }, { w: 'glamorous', t: 2 }, { w: 'vigorous', t: 2 }, { w: 'serious', t: 2 },
      { w: 'obvious', t: 2 }, { w: 'curious', t: 2 }, { w: 'courageous', t: 2 }, { w: 'outrageous', t: 2 },
      { w: 'nervous', t: 2 }, { w: 'generous', t: 2 }, { w: 'delicious', t: 2 }, { w: 'marvellous', t: 3 },
      { w: 'mysterious', t: 3 }, { w: 'adventurous', t: 3 }, { w: 'ridiculous', t: 3 }, { w: 'spacious', t: 3 }
  ]},
  { id: 'tionSionSsionCian', name: 'tion, sion, ssion, cian', words: [
      { w: 'action', t: 3 }, { w: 'invention', t: 3 }, { w: 'injection', t: 3 }, { w: 'hesitation', t: 3 },
      { w: 'completion', t: 3 }, { w: 'station', t: 3 }, { w: 'division', t: 3 }, { w: 'invasion', t: 3 },
      { w: 'confusion', t: 3 }, { w: 'decision', t: 3 }, { w: 'collision', t: 3 }, { w: 'television', t: 3 },
      { w: 'extension', t: 3 }, { w: 'expansion', t: 3 }, { w: 'tension', t: 3 }, { w: 'expression', t: 3 },
      { w: 'discussion', t: 3 }, { w: 'confession', t: 3 }, { w: 'permission', t: 3 }, { w: 'admission', t: 3 },
      { w: 'musician', t: 3 }, { w: 'electrician', t: 3 }, { w: 'magician', t: 3 }, { w: 'politician', t: 3 },
      { w: 'mathematician', t: 3 }, { w: 'optician', t: 3 }
  ]},
  // RUN21H A3: 8 -> 18. The Greek-origin /k/ words a Y3/4 child actually meets.
  { id: 'chSoundsLikeK', name: 'ch that sounds like k', words: [
      { w: 'scheme', t: 2 }, { w: 'chorus', t: 2 }, { w: 'chemist', t: 2 }, { w: 'echo', t: 2 },
      { w: 'character', t: 2 }, { w: 'school', t: 2 }, { w: 'stomach', t: 2 }, { w: 'anchor', t: 2 },
      { w: 'ache', t: 2 }, { w: 'chord', t: 2 }, { w: 'chaos', t: 3 }, { w: 'monarch', t: 3 },
      { w: 'mechanic', t: 3 }, { w: 'orchestra', t: 3 }, { w: 'architect', t: 3 }, { w: 'scholar', t: 3 },
      { w: 'technical', t: 3 }, { w: 'Christmas', t: 2 }
  ]},
  // RUN21H A3: 5 -> 12 (the audit flagged this theme THIN against the Y3/4 appendix line).
  // These are close to every /ʃ/-spelt-ch word in child-reachable English.
  { id: 'chSoundsLikeSh', name: 'ch that sounds like sh', words: [
      { w: 'chef', t: 3 }, { w: 'chalet', t: 3 }, { w: 'machine', t: 3 }, { w: 'brochure', t: 3 }, { w: 'parachute', t: 3 },
      { w: 'chute', t: 2 }, { w: 'moustache', t: 3 }, { w: 'quiche', t: 3 }, { w: 'crochet', t: 3 },
      { w: 'chandelier', t: 3 }, { w: 'sachet', t: 3 }, { w: 'ricochet', t: 3 }
  ]},
  // RUN21H A3: 6 -> 18.
  { id: 'gueAndQue', name: 'gue and que', words: [
      { w: 'league', t: 3 }, { w: 'tongue', t: 3 }, { w: 'antique', t: 3 }, { w: 'unique', t: 3 },
      { w: 'catalogue', t: 3 }, { w: 'cheque', t: 3 },
      { w: 'vague', t: 2 }, { w: 'plague', t: 3 }, { w: 'rogue', t: 3 }, { w: 'fatigue', t: 3 },
      { w: 'dialogue', t: 3 }, { w: 'colleague', t: 3 }, { w: 'technique', t: 3 }, { w: 'mosque', t: 2 },
      { w: 'boutique', t: 3 }, { w: 'plaque', t: 3 }, { w: 'opaque', t: 3 }, { w: 'grotesque', t: 3 }
  ]},
  // RUN21H A3: 7 -> 14.
  { id: 'silentIshSc', name: 'Silent-ish sc', words: [
      { w: 'science', t: 3 }, { w: 'scene', t: 3 }, { w: 'discipline', t: 3 }, { w: 'fascinate', t: 3 },
      { w: 'crescent', t: 3 }, { w: 'scissors', t: 3 }, { w: 'muscle', t: 3 },
      { w: 'scent', t: 2 }, { w: 'scenery', t: 3 }, { w: 'scientist', t: 3 }, { w: 'ascend', t: 3 },
      { w: 'descend', t: 3 }, { w: 'fascinating', t: 3 }, { w: 'adolescent', t: 3 }
  ]},
  // RUN21H A3: 9 -> 18.
  { id: 'eiEighEy', name: 'ei, eigh, ey', words: [
      { w: 'vein', t: 2 }, { w: 'weigh', t: 2 }, { w: 'eight', t: 2 }, { w: 'eighth', t: 2 },
      { w: 'neighbour', t: 2 }, { w: 'they', t: 2 }, { w: 'obey', t: 2 }, { w: 'grey', t: 2 }, { w: 'survey', t: 2 },
      { w: 'reign', t: 2 }, { w: 'veil', t: 2 }, { w: 'sleigh', t: 2 }, { w: 'weight', t: 2 },
      { w: 'eighteen', t: 2 }, { w: 'freight', t: 3 }, { w: 'prey', t: 2 }, { w: 'convey', t: 3 }, { w: 'disobey', t: 2 }
  ]},
  // RUN21H A3: 6 -> 15.
  { id: 'ouSoundsLikeU', name: 'ou that sounds like u', words: [
      { w: 'young', t: 1 }, { w: 'touch', t: 1 }, { w: 'double', t: 1 }, { w: 'trouble', t: 1 },
      { w: 'country', t: 1 }, { w: 'cousin', t: 1 },
      { w: 'enough', t: 1 }, { w: 'rough', t: 1 }, { w: 'tough', t: 1 }, { w: 'couple', t: 2 },
      { w: 'courage', t: 2 }, { w: 'southern', t: 2 }, { w: 'nourish', t: 3 }, { w: 'flourish', t: 3 },
      { w: 'encourage', t: 2 }
  ]},
  // RUN21H A3: 8 -> 18.
  { id: 'tureFamily', name: 'The ture family', words: [
      { w: 'picture', t: 1 }, { w: 'nature', t: 1 }, { w: 'creature', t: 1 }, { w: 'furniture', t: 1 },
      { w: 'adventure', t: 1 }, { w: 'capture', t: 1 }, { w: 'future', t: 1 }, { w: 'mixture', t: 1 },
      { w: 'feature', t: 2 }, { w: 'culture', t: 2 }, { w: 'texture', t: 2 }, { w: 'lecture', t: 2 },
      { w: 'puncture', t: 2 }, { w: 'moisture', t: 2 }, { w: 'departure', t: 3 }, { w: 'sculpture', t: 3 },
      { w: 'temperature', t: 3 }, { w: 'signature', t: 3 }
  ]},
  // RUN21H A3: 9 -> 20. Every addition is a multisyllable word whose STRESS decides the
  // doubling, which is the Y3/4 appendix line this bank serves.
  { id: 'doubleOrNotEndings', name: 'Double-or-not endings', words: [
      { w: 'forgetting', t: 3 }, { w: 'forgotten', t: 3 }, { w: 'beginning', t: 3 }, { w: 'beginner', t: 3 },
      { w: 'preferred', t: 3 }, { w: 'gardening', t: 3 }, { w: 'gardener', t: 3 }, { w: 'limiting', t: 3 }, { w: 'limited', t: 3 },
      { w: 'admitted', t: 3 }, { w: 'admitting', t: 3 }, { w: 'referred', t: 3 }, { w: 'occurred', t: 3 },
      { w: 'permitting', t: 3 }, { w: 'offering', t: 2 }, { w: 'offered', t: 2 },
      { w: 'entering', t: 2 }, { w: 'entered', t: 2 }, { w: 'targeted', t: 2 }, { w: 'benefited', t: 3 }
  ]},
  // RUN21H A3: a NEW bank. The audit found the Y3/4 appendix line "the /ɪ/ sound spelt y
  // elsewhere than at the end of words" completely ABSENT from the app — the only statutory
  // spelling theme with no home anywhere. These are the words that line is written about.
  { id: 'yThatSoundsLikeI', name: 'y that sounds like i', words: [
      { w: 'myth', t: 2 }, { w: 'gym', t: 1 }, { w: 'Egypt', t: 2 }, { w: 'pyramid', t: 2 },
      { w: 'mystery', t: 2 }, { w: 'crystal', t: 2 }, { w: 'symbol', t: 2 }, { w: 'system', t: 2 },
      { w: 'lyrics', t: 2 }, { w: 'typical', t: 3 }, { w: 'oxygen', t: 3 }, { w: 'hymn', t: 3 },
      { w: 'syrup', t: 2 }, { w: 'rhythm', t: 3 }, { w: 'cygnet', t: 3 }, { w: 'symptom', t: 3 }
  ]},
  { id: 'homophones', name: 'Homophones', words: [
      { w: 'piece', t: 2, clue: 'I ate the last ___ of cake' },
      { w: 'peace', t: 2, clue: 'We want world ___' },
      { w: 'plane', t: 2, clue: 'The ___ landed at the airport' },
      { w: 'plain', t: 2, clue: 'The bread was ___ and simple' },
      { w: 'brake', t: 2, clue: 'Use the ___ to slow down' },
      { w: 'break', t: 2, clue: 'Try not to ___ the window' },
      { w: 'great', t: 2, clue: 'That magic trick was ___' },
      { w: 'grate', t: 2, clue: '___ the cheese for the pizza' },
      { w: 'meet', t: 2, clue: 'We ___ at the park at noon' },
      { w: 'meat', t: 2, clue: 'Lions eat ___' },
      // RUN21H A2: 'The ___ arrives each morning' let "The male arrives each morning" stand
      // as a defensible answer, and the clue is the ONLY disambiguator here. Kept in
      // lockstep with data/soundTwins.js.
      { w: 'mail', t: 2, clue: 'The parcel came by ___' },
      { w: 'male', t: 2, clue: 'A ___ lion has a big mane' },
      { w: 'hear', t: 2, clue: 'I can ___ music playing' },
      { w: 'here', t: 2, clue: 'Come over ___ right now' },
      { w: 'whether', t: 2, clue: 'I wonder ___ it will rain' },
      { w: 'weather', t: 2, clue: 'The ___ is sunny today' },
      // RUN21H A2: these were the only capitalised non-proper-noun targets in any bank.
      // Spell Boo builds its tiles from the word's own letters and its decoys from
      // decoysFor(), which returns lowercase — so a capital W sat among lowercase decoys and
      // pointed at the answer's first letter. Lowercase, and the questions get their marks.
      { w: 'whose', t: 2, clue: '___ coat is this on the floor?' },
      { w: "who's", t: 2, clue: '___ coming to the party?' },
      { w: 'accept', t: 2, clue: 'Please ___ this little gift' },
      { w: 'except', t: 2, clue: 'Everyone came ___ my cousin' },
      { w: 'affect', t: 2, clue: "The rain didn't ___ our fun" },
      { w: 'effect', t: 2, clue: 'The medicine had a good ___' }
  ]}
];
