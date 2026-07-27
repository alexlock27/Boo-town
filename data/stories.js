// data/stories.js — RUN16 W4: Story Order content.
//
// AUTHORED IN CONTENT_STORIES.md AND COPIED EXACTLY (G13). Six stories: panel captions in
// the CORRECT order (the game shuffles them), one short sentence per panel, then one
// comprehension question with three options. In the pack the correct option is written
// FIRST; here `answer` names it and `options` keeps the pack's order — the game randomises
// the order at runtime, which is why `options` must never be pre-shuffled in this file.
// No story of my own is authored here, and none of these is paraphrased.
//
// ART RULE (from the pack, and it is the acceptance test): each panel is an inline SVG
// scene in the house sticker style, and the panels must be orderable by a PRE-READER from
// the pictures alone — so each panel carries one clear visual change from the last. The
// drawings live in js/storyart.js keyed by the `art` field below, and the two panels the
// pack writes an explicit ART NOTE for (Story 5's two waiting panels) carry that note here
// verbatim so the drawing and the requirement cannot drift apart.

export const STORIES = [
  {
    id: 'kite', title: 'The Lost Kite', level: 1,
    panels: [
      { art: 'kite1', caption: 'Pip flew a red kite up on the hill.' },
      { art: 'kite2', caption: 'The wind pulled hard and the string slipped away.' },
      { art: 'kite3', caption: 'The kite got stuck high in a tree.' },
      { art: 'kite4', caption: 'Nova climbed up and passed it down.' },
      { art: 'kite5', caption: 'Pip and Nova flew the kite together.' }
    ],
    question: 'Who got the kite down from the tree?',
    options: ['Nova', 'Pip', 'The wind'],
    answer: 'Nova',
    optionArt: { Nova: 'ansNova', Pip: 'ansPip', 'The wind': 'ansWind' }
  },
  {
    id: 'cake', title: 'The Wobbly Cake', level: 2,
    panels: [
      { art: 'cake1', caption: 'Tuft mixed flour, eggs and sugar in a big bowl.' },
      { art: 'cake2', caption: 'The cake came out of the oven flat and sad.' },
      { art: 'cake3', caption: 'Tuft read the recipe again and found a missed step.' },
      { art: 'cake4', caption: 'The second cake rose up tall and golden.' },
      { art: 'cake5', caption: 'Everyone in the Meadow had a slice.' }
    ],
    question: 'Why was the first cake flat?',
    options: ['A step was missed', 'The oven was broken', 'Someone sat on it'],
    answer: 'A step was missed',
    optionArt: { 'A step was missed': 'ansRecipe', 'The oven was broken': 'ansOven', 'Someone sat on it': 'ansSquash' }
  },
  {
    id: 'rainy', title: 'The Rainy Day', level: 1,
    panels: [
      { art: 'rain1', caption: 'Jinx wanted to play outside, but it rained and rained.' },
      { art: 'rain2', caption: 'Jinx sat by the window feeling glum.' },
      { art: 'rain3', caption: 'Then Jinx pulled on wellies and a raincoat.' },
      { art: 'rain4', caption: 'Jinx jumped in every single puddle.' }
    ],
    question: 'What did Jinx put on before going outside?',
    options: ['Wellies and a raincoat', 'A hat and scarf', 'Swimming things'],
    answer: 'Wellies and a raincoat',
    optionArt: { 'Wellies and a raincoat': 'ansWellies', 'A hat and scarf': 'ansScarf', 'Swimming things': 'ansSwim' }
  },
  {
    id: 'shy', title: 'The Shy Boo', level: 2,
    panels: [
      { art: 'shy1', caption: 'A quiet Boo watched the band from behind a tree.' },
      { art: 'shy2', caption: 'The drummer waved and held out a shaker.' },
      { art: 'shy3', caption: 'The quiet Boo shook it once, very softly.' },
      { art: 'shy4', caption: 'By the last song, the quiet Boo was the loudest of all.' }
    ],
    question: 'What did the drummer hold out to the quiet Boo?',
    options: ['A shaker', 'A drum', 'A hat'],
    answer: 'A shaker',
    optionArt: { 'A shaker': 'ansShaker', 'A drum': 'ansDrum', 'A hat': 'ansHat' }
  },
  {
    id: 'seed', title: 'The Seed', level: 2,
    panels: [
      { art: 'seed1', caption: 'Pip pushed a tiny seed down into the soil.' },
      { art: 'seed2', caption: 'Pip watered it and waited. Nothing happened.',
        artNote: 'P2 shows the watering can in daylight' },
      { art: 'seed3', caption: 'Pip waited through sunshine and rain. Still nothing.',
        artNote: 'P3 shows weather passing — sun then rain streaks — so a pre-reader can order the two waiting panels.' },
      { art: 'seed4', caption: 'One morning, a small green shoot had appeared.' },
      { art: 'seed5', caption: 'By summer it was a sunflower taller than Pip.' }
    ],
    question: 'What did the seed grow into?',
    options: ['A sunflower', 'An apple tree', 'A rose bush'],
    answer: 'A sunflower',
    optionArt: { 'A sunflower': 'ansSunflower', 'An apple tree': 'ansApple', 'A rose bush': 'ansRose' }
  },
  {
    id: 'star', title: 'The Shooting Star', level: 3,
    panels: [
      { art: 'star1', caption: 'Nova and Tuft stayed up long past bedtime.' },
      { art: 'star2', caption: 'They walked to the top of the hill with a torch.' },
      { art: 'star3', caption: 'They lay back on the grass and looked up.' },
      { art: 'star4', caption: 'A shooting star flashed right across the sky.' },
      { art: 'star5', caption: 'They both made a wish and walked home.' }
    ],
    question: 'Where did Nova and Tuft go to watch the sky?',
    options: ['The top of the hill', 'The beach', 'The back garden'],
    answer: 'The top of the hill',
    optionArt: { 'The top of the hill': 'ansHill', 'The beach': 'ansBeach', 'The back garden': 'ansGarden' }
  }
];

export const STORY_BY_ID = Object.fromEntries(STORIES.map(s => [s.id, s]));
export const STORY_LEVELS = [...new Set(STORIES.map(s => s.level))].sort();
export const storiesAtLevel = (l) => STORIES.filter(s => s.level === l);
export const ALL_PANEL_ART = STORIES.flatMap(s => s.panels.map(p => p.art));
export const ALL_OPTION_ART = STORIES.flatMap(s => Object.values(s.optionArt));
// The pack writes the correct option first; this is the check that it still is, so a
// reordering of `options` can never quietly change which answer the game marks right.
export const answerIsFirstOption = (s) => s.options[0] === s.answer;
