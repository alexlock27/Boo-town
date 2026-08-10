// tests/lib/y34-words.mjs — RUN21H A1: the statutory Year 3/4 spelling word list.
//
// Source: "English Appendix 1: Spelling" of the National Curriculum in England
// (Department for Education, 2013) — the "Word list – years 3 and 4". UK government
// content, public domain (Open Government Licence). The bracketed forms the appendix
// prints inline — accident(ally), forward(s), busy/business — are expanded so every
// spellable form is its own entry. This file is a FIXTURE: tools/content-audit.mjs and
// any curriculum-coverage test compare app content against it; nothing at runtime
// imports it.

export const Y34_STATUTORY = [
  'accident', 'accidentally', 'actual', 'actually', 'address', 'answer', 'appear',
  'arrive', 'believe', 'bicycle', 'breath', 'breathe', 'build', 'busy', 'business',
  'calendar', 'caught', 'centre', 'century', 'certain', 'circle', 'complete',
  'consider', 'continue', 'decide', 'describe', 'different', 'difficult', 'disappear',
  'early', 'earth', 'eight', 'eighth', 'enough', 'exercise', 'experience',
  'experiment', 'extreme', 'famous', 'favourite', 'February', 'forward', 'forwards',
  'fruit', 'grammar', 'group', 'guard', 'guide', 'heard', 'heart', 'height',
  'history', 'imagine', 'increase', 'important', 'interest', 'island', 'knowledge',
  'learn', 'length', 'library', 'material', 'medicine', 'mention', 'minute',
  'natural', 'naughty', 'notice', 'occasion', 'occasionally', 'often', 'opposite',
  'ordinary', 'particular', 'peculiar', 'perhaps', 'popular', 'position', 'possess',
  'possession', 'possible', 'potatoes', 'pressure', 'probably', 'promise', 'purpose',
  'quarter', 'question', 'recent', 'regular', 'reign', 'remember', 'sentence',
  'separate', 'special', 'straight', 'strange', 'strength', 'suppose', 'surprise',
  'therefore', 'though', 'although', 'thought', 'through', 'various', 'weight',
  'woman', 'women'
];

// The Year 3/4 spelling appendix THEMES (same document, the rules section preceding
// the word list). Each carries the appendix line it names so a coverage report can
// print the mapping. These are the lines RUN21H's curriculum coverage map audits
// against; -ture is listed for completeness but marked year2 (it is a Y2 appendix
// line that Boo Town also teaches).
export const Y34_THEMES = [
  { key: 'prefixes-un-dis-mis-re-pre', line: 'Prefixes un-, dis-, mis-, re-, pre-' },
  { key: 'prefixes-in-il-im-ir', line: 'The prefix in- (and il-, im-, ir-)' },
  { key: 'prefixes-super-anti-auto-inter-sub', line: 'Prefixes super-, anti-, auto-, inter-, sub-' },
  { key: 'suffix-ation', line: 'The suffix -ation' },
  { key: 'suffix-ly', line: 'The suffix -ly (incl. happily, gently, simply, basically)' },
  { key: 'suffix-ous', line: 'The suffix -ous' },
  { key: 'endings-tion-sion-ssion-cian', line: 'Endings which sound like /ʃən/: -tion, -sion, -ssion, -cian' },
  { key: 'ch-as-k', line: 'The /k/ sound spelt ch (Greek in origin)' },
  { key: 'ch-as-sh', line: 'The /ʃ/ sound spelt ch (mostly French in origin)' },
  { key: 'gue-que', line: 'Words ending with -gue and -que' },
  { key: 'sc-as-s', line: 'The /s/ sound spelt sc (Latin in origin)' },
  { key: 'ei-eigh-ey', line: 'The /eɪ/ sound spelt ei, eigh or ey' },
  { key: 'ou-as-u', line: 'The /ʌ/ sound spelt ou' },
  { key: 'y-as-i', line: 'The /ɪ/ sound spelt y elsewhere than at the end of words' },
  { key: 'doubling-multisyllable', line: 'Adding suffixes beginning with vowel letters to words of more than one syllable' },
  { key: 'homophones', line: 'Homophones and near-homophones' },
  { key: 'possessive-apostrophe-plurals', line: "Possessive apostrophe with plural words" },
  { key: 'statutory-list', line: 'Word list — years 3 and 4' },
  { key: 'suffix-ture', line: '(Year 2) The -ture ending', year2: true }
];
