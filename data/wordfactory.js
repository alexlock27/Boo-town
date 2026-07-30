// data/wordfactory.js — RUN18E L2/Part B: The Word Factory (Blend It's Medium-tier mode).
//
// AUTHORED IN _programme/RUN18E.md APPENDIX A, PARTS B and B3+, COPIED EXACTLY. Every
// `build` (parts -> word) and every `rule` line is transcribed verbatim from the pack: the
// per-item quoted line where the pack gives one, and the pack's own "Rule cards" sentence
// where it does not. `order` is a DERIVED ticket line (the pack: "per-build order lines
// derive from the Appendix meaning lines; where absent use the pattern 'I need «meaning»!'")
// — not itself a verbatim requirement, just phrased in the pack's own voice.
//
// Level 3 folds B3 and B3+ together, exactly as the pack's own Levels line specifies:
// "3 = B3 double-or-drop INCLUDING the multisyllabic stress items (Appendix B3+)".

const RULE_DESC = {
  JUST_ADD_LY: 'Most words take -ly straight on.',
  Y_TO_I_LY: 'The y turns to i before -ly.',
  LE_TO_LY: 'The le swaps for ly.',
  IC_ALLY: 'Words ending ic take -ally.',
  DOUBLE: 'Short vowel, one consonant: double the last letter.',
  DROP_E: 'Drop the silent e before -ing or -ed.',
  JUST_ADD: 'Most words just add the ending.',
  STRESS_END: 'The stress is at the end, so the last letter doubles.',
  STRESS_START: 'The stress is at the start, so just add.'
};

// ---- B1: prefixes — "The NOT machine" (no join change; meaning focus) ----
export const B1 = [
  { id: 'unhappy', parts: [{ k: 'un', l: 'un' }, { k: 'happy', l: 'happy' }], build: 'unhappy', rule: 'un means NOT. Not happy!', order: 'I need something that means NOT HAPPY!', ruleType: 'MEANING' },
  { id: 'unlock', parts: [{ k: 'un', l: 'un' }, { k: 'lock', l: 'lock' }], build: 'unlock', rule: 'Not locked any more!', order: 'I need something that means NOT LOCKED!', ruleType: 'MEANING' },
  { id: 'untidy', parts: [{ k: 'un', l: 'un' }, { k: 'tidy', l: 'tidy' }], build: 'untidy', rule: 'NOT tidy. Look at this room!', order: 'I need something that means NOT TIDY!', ruleType: 'MEANING' },
  { id: 'disagree', parts: [{ k: 'dis', l: 'dis' }, { k: 'agree', l: 'agree' }], build: 'disagree', rule: 'dis means NOT too. They do NOT agree!', order: 'I need something that means NOT AGREEING!', ruleType: 'MEANING' },
  { id: 'disappear', parts: [{ k: 'dis', l: 'dis' }, { k: 'appear', l: 'appear' }], build: 'disappear', rule: 'Now you see it… now you don’t!', order: 'I need something that means NOT APPEARING ANY MORE!', ruleType: 'MEANING' },
  { id: 'misspell', parts: [{ k: 'mis', l: 'mis' }, { k: 'spell', l: 'spell' }], build: 'misspell', rule: 'mis means WRONGLY. Spelt wrong — two s’s, see!', order: 'I need something that means SPELLING IT WRONGLY!', ruleType: 'MEANING' },
  { id: 'misbehave', parts: [{ k: 'mis', l: 'mis' }, { k: 'behave', l: 'behave' }], build: 'misbehave', rule: 'Behaving badly. Tut tut.', order: 'I need something that means BEHAVING WRONGLY!', ruleType: 'MEANING' },
  { id: 'rebuild', parts: [{ k: 're', l: 're' }, { k: 'build', l: 'build' }], build: 'rebuild', rule: 're means AGAIN. Build it again!', order: 'I need something that means BUILDING IT AGAIN!', ruleType: 'MEANING' },
  { id: 'reappear', parts: [{ k: 're', l: 're' }, { k: 'appear', l: 'appear' }], build: 'reappear', rule: 'It came back again!', order: 'I need something that means APPEARING AGAIN!', ruleType: 'MEANING' },
  { id: 'invisible', parts: [{ k: 'in', l: 'in' }, { k: 'visible', l: 'visible' }], build: 'invisible', rule: 'NOT visible. Where did it go?', order: 'I need something that means NOT VISIBLE!', ruleType: 'MEANING' },
  { id: 'impossible', parts: [{ k: 'im', l: 'im' }, { k: 'possible', l: 'possible' }], build: 'impossible', rule: 'im is ‘in’ being polite before a p. NOT possible!', order: 'I need something that means NOT POSSIBLE!', ruleType: 'MEANING' },
  { id: 'irregular', parts: [{ k: 'ir', l: 'ir' }, { k: 'regular', l: 'regular' }], build: 'irregular', rule: 'ir before r. Not regular at all.', order: 'I need something that means NOT REGULAR!', ruleType: 'MEANING' },
  { id: 'illegal', parts: [{ k: 'il', l: 'il' }, { k: 'legal', l: 'legal' }], build: 'illegal', rule: 'il before l. Two l’s meet in the middle!', order: 'I need something that means NOT LEGAL!', ruleType: 'MEANING' },
  { id: 'submarine', parts: [{ k: 'sub', l: 'sub' }, { k: 'marine', l: 'marine' }], build: 'submarine', rule: 'sub means UNDER. Under the sea!', order: 'I need something that means UNDER THE SEA!', ruleType: 'MEANING' },
  { id: 'superstar', parts: [{ k: 'super', l: 'super' }, { k: 'star', l: 'star' }], build: 'superstar', rule: 'super means MORE than. A more-than-star!', order: 'I need something that means MORE THAN A STAR!', ruleType: 'MEANING' },
  { id: 'autograph', parts: [{ k: 'auto', l: 'auto' }, { k: 'graph', l: 'graph' }], build: 'autograph', rule: 'auto means SELF. Written by yourself!', order: 'I need something that means WRITTEN BY YOURSELF!', ruleType: 'MEANING' }
];
export const B1_PREFIXES = [...new Set(B1.map(i => i.parts[0].k))];

// ---- B2: suffixes — "-ly, and what happens at the join" ----
export const B2 = [
  { id: 'sadly', parts: [{ k: 'sad', l: 'sad' }, { k: 'ly', l: 'ly' }], build: 'sadly', rule: RULE_DESC.JUST_ADD_LY, order: 'I need something that means IN A SAD WAY!', ruleType: 'JUST ADD' },
  { id: 'slowly', parts: [{ k: 'slow', l: 'slow' }, { k: 'ly', l: 'ly' }], build: 'slowly', rule: RULE_DESC.JUST_ADD_LY, order: 'I need something that means IN A SLOW WAY!', ruleType: 'JUST ADD' },
  { id: 'quietly', parts: [{ k: 'quiet', l: 'quiet' }, { k: 'ly', l: 'ly' }], build: 'quietly', rule: RULE_DESC.JUST_ADD_LY, order: 'I need something that means IN A QUIET WAY!', ruleType: 'JUST ADD' },
  { id: 'completely', parts: [{ k: 'complete', l: 'complete' }, { k: 'ly', l: 'ly' }], build: 'completely', rule: RULE_DESC.JUST_ADD_LY + ' Keep the e!', order: 'I need something that means ALL THE WAY, NOTHING LEFT!', ruleType: 'JUST ADD' },
  { id: 'usually', parts: [{ k: 'usual', l: 'usual' }, { k: 'ly', l: 'ly' }], build: 'usually', rule: RULE_DESC.JUST_ADD_LY + ' Two l’s meet!', order: 'I need something that means MOST OF THE TIME!', ruleType: 'JUST ADD' },
  { id: 'finally', parts: [{ k: 'final', l: 'final' }, { k: 'ly', l: 'ly' }], build: 'finally', rule: RULE_DESC.JUST_ADD_LY + ' Two l’s again!', order: 'I need something that means AT LAST!', ruleType: 'JUST ADD' },
  { id: 'happily', parts: [{ k: 'happy', l: 'happy' }, { k: 'ly', l: 'ily' }], build: 'happily', rule: 'happy + ly → happily. ' + RULE_DESC.Y_TO_I_LY, order: 'I need something that means IN A HAPPY WAY!', ruleType: 'Y TURNS TO I' },
  { id: 'angrily', parts: [{ k: 'angry', l: 'angry' }, { k: 'ly', l: 'ily' }], build: 'angrily', rule: 'angry + ly → angrily. ' + RULE_DESC.Y_TO_I_LY, order: 'I need something that means IN AN ANGRY WAY!', ruleType: 'Y TURNS TO I' },
  { id: 'easily', parts: [{ k: 'easy', l: 'easy' }, { k: 'ly', l: 'ily' }], build: 'easily', rule: 'easy + ly → easily. ' + RULE_DESC.Y_TO_I_LY, order: 'I need something that means WITHOUT ANY TROUBLE!', ruleType: 'Y TURNS TO I' },
  { id: 'gently', parts: [{ k: 'gentle', l: 'gentle' }, { k: 'ly', l: 'ly' }], build: 'gently', rule: 'gentle + ly → gently. ' + RULE_DESC.LE_TO_LY, order: 'I need something that means IN A GENTLE WAY!', ruleType: 'LE TURNS TO LY' },
  { id: 'simply', parts: [{ k: 'simple', l: 'simple' }, { k: 'ly', l: 'ly' }], build: 'simply', rule: 'simple + ly → simply. ' + RULE_DESC.LE_TO_LY, order: 'I need something that means IN A SIMPLE WAY!', ruleType: 'LE TURNS TO LY' },
  { id: 'humbly', parts: [{ k: 'humble', l: 'humble' }, { k: 'ly', l: 'ly' }], build: 'humbly', rule: 'humble + ly → humbly. ' + RULE_DESC.LE_TO_LY, order: 'I need something that means IN A HUMBLE WAY, NOT SHOWING OFF!', ruleType: 'LE TURNS TO LY' },
  { id: 'basically', parts: [{ k: 'basic', l: 'basic' }, { k: 'ally', l: 'ally' }], build: 'basically', rule: 'basic + ally → basically. ' + RULE_DESC.IC_ALLY, order: 'I need something that means AT ITS MOST BASIC, REALLY!', ruleType: 'IC TAKES ALLY' },
  { id: 'comically', parts: [{ k: 'comic', l: 'comic' }, { k: 'ally', l: 'ally' }], build: 'comically', rule: 'comic + ally → comically. ' + RULE_DESC.IC_ALLY, order: 'I need something that means IN A FUNNY WAY!', ruleType: 'IC TAKES ALLY' },
  { id: 'dramatically', parts: [{ k: 'dramatic', l: 'dramatic' }, { k: 'ally', l: 'ally' }], build: 'dramatically', rule: 'dramatic + ally → dramatically. ' + RULE_DESC.IC_ALLY, order: 'I need something that means IN A BIG, DRAMATIC WAY!', ruleType: 'IC TAKES ALLY' },
  { id: 'frantically', parts: [{ k: 'frantic', l: 'frantic' }, { k: 'ally', l: 'ally' }], build: 'frantically', rule: 'frantic + ally → frantically. ' + RULE_DESC.IC_ALLY, order: 'I need something that means IN A PANICKED RUSH!', ruleType: 'IC TAKES ALLY' }
];

// ---- B3: -ing/-ed double or drop ----
export const B3 = [
  { id: 'hopping', parts: [{ k: 'hop', l: 'hop' }, { k: 'ing', l: 'ing' }], build: 'hopping', rule: RULE_DESC.DOUBLE + ' One hop, two p’s!', order: 'Make ‘hop’ happening now!', ruleType: 'DOUBLE THE LAST LETTER' },
  { id: 'running', parts: [{ k: 'run', l: 'run' }, { k: 'ing', l: 'ing' }], build: 'running', rule: RULE_DESC.DOUBLE, order: 'Make ‘run’ happening now!', ruleType: 'DOUBLE THE LAST LETTER' },
  { id: 'swimming', parts: [{ k: 'swim', l: 'swim' }, { k: 'ing', l: 'ing' }], build: 'swimming', rule: RULE_DESC.DOUBLE, order: 'Make ‘swim’ happening now!', ruleType: 'DOUBLE THE LAST LETTER' },
  { id: 'clapped', parts: [{ k: 'clap', l: 'clap' }, { k: 'ed', l: 'ed' }], build: 'clapped', rule: RULE_DESC.DOUBLE, order: 'Make ‘clap’ already done!', ruleType: 'DOUBLE THE LAST LETTER' },
  { id: 'hoping', parts: [{ k: 'hope', l: 'hope' }, { k: 'ing', l: 'ing' }], build: 'hoping', rule: RULE_DESC.DROP_E, order: 'Make ‘hope’ happening now!', ruleType: 'DROP THE E' },
  { id: 'smiling', parts: [{ k: 'smile', l: 'smile' }, { k: 'ing', l: 'ing' }], build: 'smiling', rule: RULE_DESC.DROP_E, order: 'Make ‘smile’ happening now!', ruleType: 'DROP THE E' },
  { id: 'making', parts: [{ k: 'make', l: 'make' }, { k: 'ing', l: 'ing' }], build: 'making', rule: RULE_DESC.DROP_E, order: 'Make ‘make’ happening now!', ruleType: 'DROP THE E' },
  { id: 'waved', parts: [{ k: 'wave', l: 'wave' }, { k: 'ed', l: 'ed' }], build: 'waved', rule: RULE_DESC.DROP_E, order: 'Make ‘wave’ already done!', ruleType: 'DROP THE E' },
  { id: 'jumping', parts: [{ k: 'jump', l: 'jump' }, { k: 'ing', l: 'ing' }], build: 'jumping', rule: RULE_DESC.JUST_ADD, order: 'Make ‘jump’ happening now!', ruleType: 'JUST ADD' },
  { id: 'played', parts: [{ k: 'play', l: 'play' }, { k: 'ed', l: 'ed' }], build: 'played', rule: RULE_DESC.JUST_ADD, order: 'Make ‘play’ already done!', ruleType: 'JUST ADD' },
  { id: 'painting', parts: [{ k: 'paint', l: 'paint' }, { k: 'ing', l: 'ing' }], build: 'painting', rule: RULE_DESC.JUST_ADD, order: 'Make ‘paint’ happening now!', ruleType: 'JUST ADD' },
  { id: 'helped', parts: [{ k: 'help', l: 'help' }, { k: 'ed', l: 'ed' }], build: 'helped', rule: RULE_DESC.JUST_ADD, order: 'Make ‘help’ already done!', ruleType: 'JUST ADD' }
];

// ---- B3+: multisyllabic stress doubling (folds into level 3 with B3) ----
export const B3PLUS = [
  { id: 'forgetting', parts: [{ k: 'forget', l: 'forget' }, { k: 'ing', l: 'ing' }], build: 'forgetting', rule: 'Say it: for-GET — the stress is at the end, so the t doubles!', order: 'Make ‘forget’ happening now!', ruleType: 'STRESS ON THE END? DOUBLE!' },
  { id: 'beginner', parts: [{ k: 'begin', l: 'begin' }, { k: 'er', l: 'er' }], build: 'beginner', rule: 'be-GIN — double the n!', order: 'I need someone who has just started!', ruleType: 'STRESS ON THE END? DOUBLE!' },
  { id: 'preferred', parts: [{ k: 'prefer', l: 'prefer' }, { k: 'ed', l: 'ed' }], build: 'preferred', rule: 'pre-FER — double r!', order: 'Make ‘prefer’ already done!', ruleType: 'STRESS ON THE END? DOUBLE!' },
  { id: 'gardening', parts: [{ k: 'garden', l: 'garden' }, { k: 'ing', l: 'ing' }], build: 'gardening', rule: 'GAR-den — stress at the start, no double!', order: 'Make ‘garden’, doing it now!', ruleType: 'STRESS AT THE START? JUST ADD' },
  { id: 'limited', parts: [{ k: 'limit', l: 'limit' }, { k: 'ed', l: 'ed' }], build: 'limited', rule: 'LIM-it — just add!', order: 'Make ‘limit’ already done!', ruleType: 'STRESS AT THE START? JUST ADD' },
  { id: 'opening', parts: [{ k: 'open', l: 'open' }, { k: 'ing', l: 'ing' }], build: 'opening', rule: RULE_DESC.STRESS_START, order: 'Make ‘open’, doing it now!', ruleType: 'STRESS AT THE START? JUST ADD' }
];

// ---- B4: -ation and -ous (harder shelf) ----
export const B4 = [
  { id: 'information', parts: [{ k: 'inform', l: 'inform' }, { k: 'ation', l: 'ation' }], build: 'information', rule: RULE_DESC.JUST_ADD, order: 'I need something that means WHAT YOU ARE TOLD!', ruleType: 'JUST ADD' },
  { id: 'preparation', parts: [{ k: 'prepare', l: 'prepare' }, { k: 'ation', l: 'ation' }], build: 'preparation', rule: RULE_DESC.DROP_E, order: 'I need something that means GETTING READY!', ruleType: 'DROP THE E' },
  { id: 'admiration', parts: [{ k: 'admire', l: 'admire' }, { k: 'ation', l: 'ation' }], build: 'admiration', rule: RULE_DESC.DROP_E, order: 'I need something that means LOOKING UP TO SOMEONE!', ruleType: 'DROP THE E' },
  { id: 'sensation', parts: [{ k: 'sense', l: 'sense' }, { k: 'ation', l: 'ation' }], build: 'sensation', rule: RULE_DESC.DROP_E, order: 'I need something that means A BIG FEELING!', ruleType: 'DROP THE E' },
  { id: 'dangerous', parts: [{ k: 'danger', l: 'danger' }, { k: 'ous', l: 'ous' }], build: 'dangerous', rule: RULE_DESC.JUST_ADD, order: 'I need something that means FULL OF DANGER!', ruleType: 'JUST ADD' },
  { id: 'poisonous', parts: [{ k: 'poison', l: 'poison' }, { k: 'ous', l: 'ous' }], build: 'poisonous', rule: RULE_DESC.JUST_ADD, order: 'I need something that means FULL OF POISON!', ruleType: 'JUST ADD' },
  { id: 'famous', parts: [{ k: 'fame', l: 'fame' }, { k: 'ous', l: 'ous' }], build: 'famous', rule: RULE_DESC.DROP_E, order: 'I need something that means FULL OF FAME!', ruleType: 'DROP THE E' },
  { id: 'various', parts: [{ k: 'vary', l: 'vary' }, { k: 'ous', l: 'ious' }], build: 'various', rule: 'vary + ous → various. ' + RULE_DESC.Y_TO_I_LY.replace('-ly', '-ous'), order: 'I need something that means MANY DIFFERENT KINDS!', ruleType: 'Y TURNS TO I' },
  { id: 'courageous', parts: [{ k: 'courage', l: 'courage' }, { k: 'ous', l: 'eous' }], build: 'courageous', rule: 'KEEP the e — it keeps the g soft!', order: 'I need something that means FULL OF COURAGE!', ruleType: 'KEEP THE E' },
  { id: 'outrageous', parts: [{ k: 'outrage', l: 'outrage' }, { k: 'ous', l: 'eous' }], build: 'outrageous', rule: 'Keep the e again. Outrageous!', order: 'I need something that means SHOCKINGLY BAD!', ruleType: 'KEEP THE E' }
];

export const FACTORY_LEVELS = {
  1: { name: 'Word Starters', items: B1 },
  2: { name: 'The -ly Endings', items: B2 },
  3: { name: 'Double or Drop', items: [...B3, ...B3PLUS] },
  4: { name: '-ation and -ous', items: B4 }
};
export const FACTORY_LEVEL_NUMBERS = [1, 2, 3, 4];
export function factoryLevel(n) { return FACTORY_LEVELS[n] || FACTORY_LEVELS[1]; }
export const ALL_FACTORY_ITEMS = [...B1, ...B2, ...B3, ...B3PLUS, ...B4];
export function factoryItem(id) { return ALL_FACTORY_ITEMS.find(i => i.id === id); }
