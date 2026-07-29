// data/lessonsLiteracy.js — RUN16 W5: the three literacy lessons.
//
// AUTHORED IN CONTENT_LESSONS.md AND COPIED EXACTLY (G13). Every HOOK, every SHOW line,
// every TRY step and every feedback line is the pack's own wording, including the
// deliberate chip/ship trap and its kind feedback. Nothing here is paraphrased, and no
// fourth lesson is invented.
//
// THE FOUR STAGES (RUN16 W5): hook → show → try (three steps) → win.
//   hook  — a ten-second animated scene posing the idea as a problem the Boos have
//   show  — the existing two-ways explanation, kept, because it is good pedagogy
//   try   — three DIRECT-MANIPULATION steps. Never multiple choice: she drags, places
//           and sorts. Three primitives cover all nine lessons (js/lessonstages.js):
//             sort  — drag items into bins (baskets, graphemes, panels, or the guide)
//             place — drag tiles into gaps (in a sentence, a word frame, or a story)
//             order — drag panels into sequence
//   win   — the RUN15 V3 ceremony, its Lesson Stars and a Journal stamp
//
// A wrong move NEVER rewinds. The piece springs back and the guide explains — and where
// the pack authors that explanation word for word (the chips/sh line, the CHIP/SHIP trap,
// the hear/ear trick), the authored line is what the child hears.

export const LITERACY_LESSONS = [
  // =====================================================================================
  // LESSON A: Sounds in words (sh, ch, th)
  // =====================================================================================
  {
    id: 'soundsInWords', name: 'Sounds in words', icon: 'mouth', starType: 'lesson',
    hook: {
      kind: 'sign',
      // "a Boo is writing a label for its boat and keeps producing 'SIP'"
      scene: 'boat',
      before: 'SIP', after: 'SHIP',
      line: 'It needs an H! Some letters hold hands and make a brand new sound.'
    },
    show: [
      { way: 1, title: 'The sound',
        text: 'sh is the quiet sound: shhhh. ch is the sneezy sound: ch-ch-ch. th is the tongue-out sound: thhh. Two letters, one sound.' },
      { way: 2, title: 'The picture', kind: 'baskets',
        // "three baskets, each with its grapheme card, each holding one example the guide names aloud"
        baskets: [
          { key: 'sh', label: 'sh', example: 'ship' },
          { key: 'ch', label: 'ch', example: 'chips' },
          { key: 'th', label: 'th', example: 'thumb' }
        ] }
    ],
    try: [
      {
        kind: 'sort', title: 'Sort the pictures',
        instruction: 'Drag each picture into the basket for its sound.',
        bins: [{ key: 'sh', label: 'sh' }, { key: 'ch', label: 'ch' }, { key: 'th', label: 'th' }],
        // the pack's six, in the pack's order
        items: [
          { key: 'ship', art: 'ship', word: 'ship', bin: 'sh' },
          { key: 'shell', art: 'shell', word: 'shell', bin: 'sh' },
          { key: 'chips', art: 'chips', word: 'chips', bin: 'ch' },
          { key: 'cheese', art: 'cheese', word: 'cheese', bin: 'ch' },
          { key: 'thumb', art: 'thumb', word: 'thumb', bin: 'th' },
          { key: 'thorn', art: 'thorn', word: 'thorn', bin: 'th' }
        ],
        // "the basket wobbles and the guide names what she dropped" — the pack's own example
        wrong: (item, binKey) => `That's ${item.word} — ${item.bin}, not ${binKey}!`
      },
      {
        kind: 'place', title: 'Build the word',
        instruction: 'Drag the right two letters into the gap.',
        tiles: [{ key: 'sh', label: 'sh' }, { key: 'ch', label: 'ch' }, { key: 'th', label: 'th' }],
        frames: [
          {
            pic: 'ship', pre: '', post: 'ip', answer: 'sh',
            // THE DELIBERATE TRAP, and its authored feedback. ch here spells CHIP: a real
            // word, just not the picture. It must never get a plain wrong-wobble.
            traps: { ch: 'That spells CHIP! Tasty — but the picture shows a SHIP. Shhh!' },
            why: 'The picture is a ship. Ship starts with sh.'
          },
          { pic: 'chin', pre: '', post: 'in', answer: 'ch', why: 'The picture is a chin. Chin starts with ch.' },
          { pic: 'thorn', pre: '', post: 'orn', answer: 'th', why: 'The picture is a thorn. Thorn starts with th.' }
        ]
      },
      {
        kind: 'sort', title: 'Odd one out', mode: 'odd',
        instruction: 'Three of these are sh words. Drag the odd one to me!',
        bins: [{ key: 'guide', label: 'Give it to me!', isGuide: true }],
        items: [
          { key: 'shell', art: 'shell', word: 'shell', bin: null },
          { key: 'shop', art: 'shop', word: 'shop', bin: null },
          { key: 'sheep', art: 'sheep', word: 'sheep', bin: null },
          { key: 'chair', art: 'chair', word: 'chair', bin: 'guide' }
        ],
        needs: 1,
        wrong: (item) => `${item.word} is a sh word — it belongs with the others. Which one sounds different?`
      }
    ],
    win: { stamp: 'I know sh, ch and th!' }
  },

  // =====================================================================================
  // LESSON B: Words that sound the same (homophones)
  // =====================================================================================
  {
    id: 'wordTwins', name: 'Words that sound the same', icon: 'twins', starType: 'lesson',
    hook: {
      kind: 'sign', scene: 'confused',
      // "a Boo holds up a sign reading 'I CAN HERE YOU!' and everyone looks confused"
      before: 'I CAN HERE YOU!', after: 'I CAN HEAR YOU!',
      line: "It sounds right... but it's the wrong word. Some words are twins!"
    },
    show: [
      { way: 1, title: 'The trick',
        text: 'hear has EAR in it, because you hear with your ear. here is a place, like here I am.' },
      { way: 2, title: 'The family',
        text: 'there is a place — look, it has here inside it. their means it belongs to them. they\'re is short for they are — the little mark shows a missing a.',
        also: 'two is the number, it has a w like twin. too means as well, or very — it has an extra o because it\'s a bit extra.' }
    ],
    try: [
      {
        kind: 'place', title: 'hear or here?',
        instruction: 'Drag the right word into each gap.',
        tiles: [{ key: 'hear', label: 'hear' }, { key: 'here', label: 'here' }],
        frames: [
          { pre: 'Come over ', post: ' and sit down.', answer: 'here' },
          { pre: 'I can ', post: ' the band playing.', answer: 'hear' }
        ],
        // "the tile springs back and the guide explains the trick for that word again"
        why: {
          hear: 'hear has EAR in it — you hear with your ear!',
          here: 'here is a place, like here I am.'
        }
      },
      {
        kind: 'place', title: 'there, their or they\'re?',
        instruction: 'Drag the right word into each gap.',
        tiles: [{ key: 'there', label: 'there' }, { key: 'their', label: 'their' }, { key: "they're", label: "they're" }],
        frames: [
          { pre: 'Put it over ', post: ' on the shelf.', answer: 'there' },
          { pre: 'The Boos lost ', post: ' kite.', answer: 'their' },
          { pre: 'Look, ', post: ' dancing!', answer: "they're" }
        ],
        why: {
          there: 'there is a place — look, it has here inside it.',
          their: 'their means it belongs to them.',
          "they're": "they're is short for they are — the little mark shows a missing a."
        }
      },
      {
        kind: 'place', title: 'to, two or too?',
        instruction: 'Drag the right word into each gap.',
        tiles: [{ key: 'to', label: 'to' }, { key: 'two', label: 'two' }, { key: 'too', label: 'too' }],
        frames: [
          { pre: "I've got ", post: ' biscuits.', answer: 'two' },
          { pre: "We're going ", post: ' the beach.', answer: 'to' },
          { pre: 'Can I come ', post: '?', answer: 'too' }
        ],
        why: {
          two: 'two is the number, it has a w like twin.',
          too: "too means as well, or very — it has an extra o because it's a bit extra.",
          to: 'to is the going-somewhere one: going to the beach.'
        }
      }
    ],
    win: { stamp: 'I can spot word twins!' }
  },

  // =====================================================================================
  // LESSON C: How a story works (beginning, middle, end)
  // =====================================================================================
  {
    id: 'howStoriesWork', name: 'How a story works', icon: 'hill', starType: 'lesson',
    hook: {
      kind: 'panels', scene: 'backwards',
      // "a Boo tells a story starting with '...and that's how we got the kite back!'"
      before: "...and that's how we got the kite back!", after: 'WHAT kite?',
      line: "Stories have an order. Let's find it."
    },
    show: [
      { way: 1, title: 'The three parts',
        text: 'The beginning tells you WHO and WHERE. The middle is where something goes wrong. The end is how it gets sorted out.' },
      { way: 2, title: 'The shape', kind: 'hill',
        text: 'The story climbs up to the problem at the top, and comes back down to the ending.' }
    ],
    try: [
      {
        kind: 'order', title: 'Put it in order',
        instruction: 'Drag these three pictures into order.',
        panels: [
          { art: 'kite1', caption: 'Pip flies a kite' },
          { art: 'kite3', caption: 'The kite sticks in a tree' },
          { art: 'kite4', caption: 'Nova passes it down' }
        ]
      },
      {
        kind: 'sort', title: 'Find the middle',
        instruction: 'Drag the MIDDLE flag onto the picture where the problem happens.',
        bins: [
          { key: 'p0', art: 'kite1' }, { key: 'p1', art: 'kite2' }, { key: 'p2', art: 'kite3' },
          { key: 'p3', art: 'kite4' }, { key: 'p4', art: 'kite5' }
        ],
        items: [{ key: 'flag', label: 'middle', isFlag: true, bin: 'p2' }],
        needs: 1,
        wrong: () => 'Not quite — the middle is where something GOES WRONG. Where does it all go wrong?'
      },
      {
        kind: 'place', title: 'What happens next?',
        instruction: 'Drag the ending that finishes the story.',
        // "Tuft plants a seed / waters it / waits / ???"
        tiles: [
          { key: 'endFlower', art: 'endFlower', label: 'a flower grows' },
          { key: 'endBoat', art: 'endBoat', label: 'a boat sails past' },
          { key: 'endSnow', art: 'endSnow', label: 'it starts snowing' }
        ],
        frames: [{ panels: ['seed1', 'seed2', 'seed3'], answer: 'endFlower' }],
        why: {
          endBoat: 'A boat has nothing to do with the seed! An ending finishes the story it started.',
          endSnow: 'Snow is a surprise, but it does not finish the seed story. What was Tuft waiting for?'
        }
      }
    ],
    win: { stamp: 'I know how stories work!' }
  },

  // =====================================================================================
  // LESSON D (RUN18E Part F): The Word Machine
  // =====================================================================================
  {
    id: 'wordMachine', name: 'The Word Machine', icon: 'factory', starType: 'lesson',
    hook: {
      kind: 'sign', scene: 'muddle',
      before: 'I AM UNHAPPYLY', after: 'I AM UNHAPPILY',
      line: "Close, but the join has a rule! Let's see how the parts fit together."
    },
    show: [
      { way: 1, title: 'Parts have jobs',
        text: 'un- means NOT: un + happy = unhappy. re- means AGAIN: re + build = rebuild. Every part changes the meaning on purpose.' },
      { way: 2, title: 'What happens at the join',
        text: 'Sometimes the join changes a letter. happy + ly: the y turns to i, so it becomes happily, not happyly!' }
    ],
    try: [
      {
        kind: 'place', title: 'Unlock it!',
        instruction: 'Drag the right part into the gap.',
        tiles: [{ key: 'un', label: 'un' }, { key: 'dis', label: 'dis' }, { key: 're', label: 're' }],
        frames: [{ pre: '', post: 'lock', answer: 'un', why: 'un means NOT. Not locked any more!' }],
        why: { dis: 'dis means NOT too — but "dislock" is not a word! un + lock = unlock.', re: 're means AGAIN — but "relock" means locking again, not opening it!' }
      },
      {
        kind: 'place', title: 'happily',
        instruction: 'Drag the right ending into the gap.',
        tiles: [{ key: 'ly', label: 'ly' }, { key: 'ily', label: 'ily' }],
        frames: [{ pre: 'happ', post: '', answer: 'ily', why: 'happy + ly → happily. The y turns to i before -ly.' }],
        why: { ly: 'Careful — the y turns to i first! happy becomes happi, then + ly.' }
      },
      {
        kind: 'place', title: 'hopping',
        instruction: 'Drag the right ending into the gap.',
        tiles: [{ key: 'ing', label: 'ing' }, { key: 'ping', label: 'ping' }],
        frames: [{ pre: 'hop', post: '', answer: 'ping', why: 'Short vowel, one consonant: double the last letter. One hop, two p’s!' }],
        why: { ing: 'Just "ing" makes "hoping" — a different word! Double the p for hopping.' }
      }
    ],
    win: { stamp: 'Word Engineer' }
  },

  // =====================================================================================
  // LESSON E (RUN18E Part F): The Flying Comma
  // =====================================================================================
  {
    id: 'flyingComma', name: 'The Flying Comma', icon: 'apostrophe', starType: 'lesson',
    hook: {
      kind: 'sign', scene: 'confused',
      before: "THE BOO'S PICNIC", after: "THE BOOS' PICNIC",
      line: "One Boo is VERY cross — that sign says the picnic belongs to just ONE of them, and everyone came!"
    },
    show: [
      { way: 1, title: 'The apostrophe points at the owner',
        text: "An apostrophe shows who something belongs to. One Boo's kite — the comma sits right before the s." },
      { way: 2, title: 'More than one owner',
        text: 'When there are LOTS of owners and the word already ends in s, the comma goes AFTER the s: the Boos’ picnic.' }
    ],
    try: [
      {
        kind: 'place', title: 'Squeeze it together',
        instruction: 'Drag the missing letters into the gap.',
        tiles: [{ key: "n't", label: "n't" }, { key: 'not', label: 'not' }],
        frames: [{ pre: 'do', post: '', answer: "n't", why: "do + not squeeze together — the o pops out and an apostrophe drops in: don't!" }],
        why: { not: "That's the long way — do not! Squeeze it: don't." }
      },
      {
        kind: 'place', title: 'One Boo’s hat',
        instruction: 'Drag the right ending onto Boo.',
        tiles: [{ key: "'s", label: "'s" }, { key: "s'", label: "s'" }],
        frames: [{ pre: 'Boo', post: ' hat blew away.', answer: "'s", why: 'One Boo — the comma flies BEFORE the s.' }],
        why: { "s'": 'That’s for MORE than one owner — there is only one Boo here!' }
      },
      {
        kind: 'place', title: 'The Boos’ picnic',
        instruction: 'Drag the right ending onto Boos.',
        tiles: [{ key: "'s", label: "'s" }, { key: "s'", label: "s'" }],
        frames: [{ pre: 'Boos', post: ' picnic', answer: "s'", why: 'Lots of Boos, and the word already ends in s — the comma flies AFTER it.' }],
        why: { "'s": 'That would mean just ONE Boo owns it — but they ALL came to the picnic!' }
      }
    ],
    win: { stamp: 'Apostrophe Patrol' }
  }
];
