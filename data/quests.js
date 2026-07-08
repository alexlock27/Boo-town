// data/quests.js — Boo Quest lands as DATA (RUN6 C6). Further lands are content,
// not code: add an entry here and the map + encounter engine (js/booquest.js) render it.
// Each node names an encounter type + a question SOURCE; difficulty is drawn from her
// Smart Mix ledger at play time (the engine calls autoQuestion / the spell pool).

export const QUEST_LANDS = [
  {
    id: 'sparkle_meadow',
    name: 'The Sparkle Meadow',
    intro: 'Welcome to the Sparkle Meadow! Follow the path with me.',
    nodes: [
      { id: 'bridge1', type: 'bridge', title: 'Bridge Builder', planks: 6, source: 'maths', stars: 2,
        narrate: 'A gap in the path! Answer right to lay each plank.' },
      { id: 'rune1', type: 'rune', title: 'Rune Door', source: 'spell', stars: 2,
        narrate: 'A glowing door. Spell the word to light the runes!' },
      { id: 'grump1', type: 'grump', title: 'Grump Cheer-Off', stages: 3, source: 'mixed', stars: 2,
        narrate: 'A little Grump is blocking the way. Cheer it up!' },
      { id: 'bridge2', type: 'bridge', title: 'Bridge Builder', planks: 6, source: 'maths', stars: 2,
        narrate: 'Another gap — you know what to do!' },
      { id: 'chest1', type: 'chest', title: 'Treasure Chest', stars: 1,
        narrate: 'A treasure chest, just sitting here for you!' },
      { id: 'boss1', type: 'boss', title: 'Boss Grump', stages: 5, source: 'mixed', stars: 3,
        narrate: 'The BIG Grump! Five good cheers and it will float away happy.' }
    ],
    reward: { boo: 'boo_scout', deco: 'deco_questflag', stamp: 'quest_sparkle_meadow', trophy: 'trophy_sparkle_meadow' }
  }
];

// The words the Rune Door can ask (kept short + friendly; drawn from the statutory list).
export const RUNE_WORDS = ['guide', 'quest', 'earth', 'eight', 'heart', 'group', 'build', 'light', 'brave', 'happy'];

// The four Grump moods, in the order the Sparkle Cheer meter lifts them through.
export const GRUMP_MOODS = ['grumpy', 'unsure', 'smile', 'beaming'];
