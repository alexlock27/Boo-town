// data/storyReader.js — RUN18E L5/Part E: Story Order Medium (sentence sequencing).
// AUTHORED IN _programme/RUN18E.md APPENDIX A, PART E, COPIED EXACTLY. Sentences carry a
// `why` line for a misplacement — not itself pack text, but built from the pack's own
// connective-based teaching pattern ("'Afterwards' can't come before the match!").

export const STORY_READER_SETS = [
  {
    id: 'greatEscape', title: 'The Great Escape',
    sentences: [
      { text: 'Early one morning, Snaffle noticed the biscuit tin had been left open.', why: '"Early one morning" — this is how the story STARTS.' },
      { text: 'First, he checked that nobody was watching from the window.', why: '"First" comes right after the story begins.' },
      { text: 'Next, he crept across the kitchen with his tail held high.', why: '"Next" follows "First" — one step at a time.' },
      { text: 'Just as he reached the tin, the lid slammed shut in the wind.', why: '"Just as" — this happens the moment he arrives, not before.' },
      { text: 'In the end, he went back to bed without a single crumb.', why: '"In the end" — this is how the story FINISHES.' }
    ],
    question: 'Why did Snaffle leave without a biscuit?',
    options: ['the lid slammed shut', "he wasn't hungry", 'somebody caught him'],
    answer: 'the lid slammed shut'
  },
  {
    id: 'matchDay', title: 'Match Day',
    sentences: [
      { text: 'The night before the match, Pip could hardly sleep.', why: '"The night before" — this happens first, before anything else.' },
      { text: 'At breakfast, she ate two whole bowls of porridge for energy.', why: '"At breakfast" comes the next morning, after the night before.' },
      { text: 'During the first half, neither team managed to score.', why: '"During the first half" — the match has to start before this.' },
      { text: 'Ten minutes from the end, Pip finally kicked the winning goal.', why: '"Ten minutes from the end" is near the finish, not the start.' },
      { text: 'Afterwards, the whole team carried her home on their shoulders.', why: "'Afterwards' can't come before the match!" }
    ],
    question: 'When did Pip score?',
    options: ['near the end of the match', 'in the first half', 'at breakfast'],
    answer: 'near the end of the match'
  },
  // + RUN21H A3. Two authored sets meant a child met the same two stories every time.
  // Sentence sequencing needs no panel art, so this is where Story Order depth can honestly
  // grow tonight (see the ledger DECISION on picture stories). Each set follows the pack's
  // own pattern exactly: five sentences, each opening with the time connective that fixes
  // its place, a `why` line built from that connective, and one comprehension question whose
  // correct option is written FIRST.
  {
    id: 'lostGlove', title: 'The Lost Glove',
    sentences: [
      { text: 'One frosty morning, Nova pulled on her woolly gloves and set off for school.', why: '"One frosty morning" — this is how the story STARTS.' },
      { text: 'On the way, she stopped to throw a snowball at the postbox.', why: '"On the way" happens while she is still walking, before she arrives.' },
      { text: 'By the time she reached the gate, one glove had gone.', why: '"By the time she reached the gate" — she has to set off before she can arrive.' },
      { text: 'All through the morning, she wondered where it could be.', why: '"All through the morning" comes after she gets to school, not before.' },
      { text: 'At home time, she found it sitting on top of the postbox.', why: '"At home time" — this is how the story FINISHES.' }
    ],
    question: 'Where was the missing glove?',
    options: ['on top of the postbox', 'at the school gate', 'under her bed'],
    answer: 'on top of the postbox'
  },
  {
    id: 'birthdayCake', title: 'The Surprise Cake',
    sentences: [
      { text: 'A week before the party, Tuft decided to bake a cake in secret.', why: '"A week before" — this happens first, before everything else.' },
      { text: 'To begin with, he hid all the ingredients in the shed.', why: '"To begin with" comes right after he decides, not later.' },
      { text: 'While everyone was out, he mixed and baked as fast as he could.', why: '"While everyone was out" — he needs the house empty, which is after he hides the ingredients.' },
      { text: 'Moments before the guests arrived, he slid the cake onto the table.', why: '"Moments before the guests arrived" is near the end, not the beginning.' },
      { text: 'Finally, everybody shouted SURPRISE — and Tuft was the most surprised of all.', why: '"Finally" — this is how the story FINISHES.' }
    ],
    question: 'Why was Tuft the most surprised?',
    options: ['everyone shouted surprise at him', 'the cake burnt', 'nobody came to the party'],
    answer: 'everyone shouted surprise at him'
  },
  {
    id: 'rainyMatch', title: 'The Muddy Match',
    sentences: [
      { text: 'Long before kick-off, the rain had turned the pitch into a swamp.', why: '"Long before kick-off" — this is the earliest thing in the story.' },
      { text: 'As the whistle blew, both teams were already covered in mud.', why: '"As the whistle blew" is the moment the match starts, after the rain.' },
      { text: 'Halfway through, nobody could tell the two teams apart.', why: '"Halfway through" has to come after the match starts.' },
      { text: 'With seconds to spare, a muddy Boo poked the ball over the line.', why: '"With seconds to spare" is right at the end of the match.' },
      { text: 'Later that evening, every single Boo needed a very long bath.', why: '"Later that evening" — this is how the story FINISHES.' }
    ],
    question: 'Why could nobody tell the teams apart?',
    options: ['they were all covered in mud', 'they wore the same shirts', 'it was too dark'],
    answer: 'they were all covered in mud'
  }
];

export const REPORTER_THRESHOLDS = [
  { at: 0, name: 'Cub Reporter' },
  { at: 10, name: 'Reporter' },
  { at: 25, name: 'Editor' }
];
export function reporterRankFor(lifetimeCorrect) {
  let r = REPORTER_THRESHOLDS[0];
  for (const t of REPORTER_THRESHOLDS) if (lifetimeCorrect >= t.at) r = t;
  return r;
}
