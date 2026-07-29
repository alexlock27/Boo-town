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
