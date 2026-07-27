// data/lessons.js — Teach Me lessons (EXPANSION_2 C1, six at launch; rebuilt into the
// four-stage format by RUN16 W5).
//
// THE FORMAT (RUN16 W5). Every lesson, old and new, is now:
//   hook  — a ten-second animated scene posing the idea as a problem the Boos have
//   cards — SHOW: the two-ways explanation, KEPT EXACTLY as it was, because the brief says
//           so and because it is genuinely good pedagogy. Card types: talk | visual |
//           workedStep. Visual kinds: placeValue, numberLine, fractionCircle, array, clock.
//   try   — three DIRECT-MANIPULATION steps. Never multiple choice (RUN16 W5, explicit).
//   win   — the RUN15 V3 ceremony with its Lesson Stars and a Journal stamp.
//
// WHAT CHANGED FOR THE SIX MATHS LESSONS, AND WHAT DID NOT. Not one question, option or
// worked example is altered: every `check` card's question, its options and its correct
// answer moved verbatim into a TRY step, and its `variant` came with it. What changed is
// how she ANSWERS — she drags the answer tile into the gap instead of tapping one of four
// buttons. "No maths content changes" (RUN16, out of scope) is respected to the letter.
//
// AND THE SILENT REWIND IS GONE. The old `backTo` sent a wrong answer back to an earlier
// card with no message — the exact thing RUN12 asked to be fixed and RUN16 W5 names again.
// A wrong drop now springs the tile back and the guide explains with the step's `why`.
// After two goes she is offered the authored `variant` instead of being left stuck, and
// she is told that is what is happening. Nothing rewinds, and nothing is silent.

import { LITERACY_LESSONS } from './lessonsLiteracy.js';

export const MATHS_LESSONS = [
  {
    id: 'placeValue', name: 'Hundreds, tens and ones', icon: 'tower',
    hook: { kind: 'sign', scene: 'muddle', before: '300 40 7', after: '347',
      line: 'Three numbers standing in a row are not one number! Let me show you how they stack.' },
    cards: [
      { type: 'talk', text: "Big numbers are just small numbers standing in towers. Let me show you." },
      { type: 'visual', kind: 'placeValue', spec: { number: 347, cols: [{ label: 'hundreds', digit: 3, worth: 300 }, { label: 'tens', digit: 4, worth: 40 }, { label: 'ones', digit: 7, worth: 7 }] } },
      { type: 'workedStep', title: 'Build 347', steps: ["3 lives in the hundreds tower, so it's worth 300.", "4 lives in the tens tower, worth 40.", "7 ones are just 7.", "300 and 40 and 7. Three hundred and forty seven!"] },
      { type: 'talk', text: "Or think money: 3 pound coins, 4 ten-pences, 7 pennies. That's 347 pennies!" }
    ],
    try: [
      { kind: 'place', title: 'What is it worth?', instruction: 'Drag your answer into the gap.',
        frames: [{ pre: 'In 582, what is the 8 worth?', post: '', answer: '80' }],
        tiles: [{ key: '80', label: '80' }, { key: '8', label: '8' }, { key: '800', label: '800' }, { key: '58', label: '58' }],
        why: { '*': 'The 8 sits in the TENS tower, so it is worth 80.' },
        variant: { frames: [{ pre: 'In 274, what is the 7 worth?', post: '', answer: '70' }],
          tiles: [{ key: '70', label: '70' }, { key: '7', label: '7' }, { key: '700', label: '700' }, { key: '27', label: '27' }] } },
      { kind: 'place', title: 'Find the tens', instruction: 'Drag your answer into the gap.',
        frames: [{ pre: 'Which number has 6 tens?', post: '', answer: '461' }],
        tiles: [{ key: '461', label: '461' }, { key: '306', label: '306' }, { key: '640', label: '640' }, { key: '616', label: '616' }],
        why: { '*': 'The tens tower is the MIDDLE digit. In 461 the middle digit is 6.' },
        variant: { frames: [{ pre: 'Which has 3 tens?', post: '', answer: '234' }],
          tiles: [{ key: '234', label: '234' }, { key: '342', label: '342' }, { key: '403', label: '403' }, { key: '313', label: '313' }] } },
      { kind: 'place', title: 'Build it', instruction: 'Drag your answer into the gap.',
        frames: [{ pre: '3 hundreds, 0 tens, 9 ones makes?', post: '', answer: '309' }],
        tiles: [{ key: '309', label: '309' }, { key: '39', label: '39' }, { key: '390', label: '390' }, { key: '903', label: '903' }],
        why: { '*': 'Three hundreds, no tens, nine ones: 3, then 0, then 9.' },
        variant: { frames: [{ pre: '5 hundreds, 0 tens, 2 ones?', post: '', answer: '502' }],
          tiles: [{ key: '502', label: '502' }, { key: '52', label: '52' }, { key: '520', label: '520' }, { key: '205', label: '205' }] } }
    ],
    win: { stamp: 'I can build big numbers!' }
  },
  {
    id: 'jumpTen', name: 'Jumping over ten', icon: 'spring',
    hook: { kind: 'sign', scene: 'hop', before: '38 + 7 = ?', after: '38 + 2 + 5',
      line: '38 is so close to a ten. Tens are stepping stones — let me show you the jump.' },
    cards: [
      { type: 'talk', text: "Adding is easy near a ten. Tens are stepping stones, so we jump to one first." },
      { type: 'visual', kind: 'numberLine', spec: { from: 47, to: 55, hops: [{ from: 47, to: 50, label: '+3' }, { from: 50, to: 55, label: '+5' }] } },
      { type: 'workedStep', title: '47 + 8', steps: ["How far to the next ten? 47 needs 3 to reach 50.", "Split the 8 into 3 and 5.", "Jump: 47 and 3 is 50.", "Then the leftover 5. 55!"] },
      { type: 'talk', text: "Another way: 7 and 3 are 'make ten friends'. When you see a 7, it's looking for a 3." }
    ],
    try: [
      { kind: 'place', title: 'Jump it', instruction: 'Drag your answer into the gap.',
        frames: [{ pre: '38 + 7 = ', post: '', answer: '45' }],
        tiles: [{ key: '45', label: '45' }, { key: '44', label: '44' }, { key: '46', label: '46' }, { key: '35', label: '35' }],
        why: { '*': '38 needs 2 to reach 40. Then the 5 that is left over: 45.' },
        variant: { frames: [{ pre: '48 + 6 = ', post: '', answer: '54' }],
          tiles: [{ key: '54', label: '54' }, { key: '53', label: '53' }, { key: '55', label: '55' }, { key: '44', label: '44' }] } },
      { kind: 'place', title: 'Jump again', instruction: 'Drag your answer into the gap.',
        frames: [{ pre: '56 + 9 = ', post: '', answer: '65' }],
        tiles: [{ key: '65', label: '65' }, { key: '64', label: '64' }, { key: '66', label: '66' }, { key: '47', label: '47' }],
        why: { '*': '56 needs 4 to reach 60. Then the 5 that is left: 65.' } },
      { kind: 'place', title: 'The little jump', instruction: 'Drag your answer into the gap.',
        frames: [{ pre: 'What little jump takes 29 to the next ten?', post: '', answer: '1' }],
        tiles: [{ key: '1', label: '1' }, { key: '2', label: '2' }, { key: '3', label: '3' }, { key: '10', label: '10' }],
        why: { '*': '29 is only one step away from 30.' } }
    ],
    win: { stamp: 'I can jump over ten!' }
  },
  {
    id: 'countUp', name: 'Taking away by counting up', icon: 'footsteps',
    hook: { kind: 'sign', scene: 'shop', before: '62 − 58 = ?', after: '58 → 60 → 62',
      line: "Don't take it away — count UP the gap, like a shopkeeper giving change." },
    cards: [
      { type: 'talk', text: "When two numbers are close, don't take away. Count UP the gap, like a shopkeeper giving change." },
      { type: 'visual', kind: 'numberLine', spec: { from: 58, to: 62, hops: [{ from: 58, to: 60, label: '+2' }, { from: 60, to: 62, label: '+2' }], circleGap: 4 } },
      { type: 'workedStep', title: '62 − 58', steps: ["Start at 58.", "Hop to 60: that's 2.", "Hop to 62: 2 more.", "2 and 2. The gap is 4!"] },
      { type: 'talk', text: "Shop version: the sticker costs 58p, you pay 62p. The change is the counting-up gap: 4p." }
    ],
    try: [
      { kind: 'place', title: 'Count up the gap', instruction: 'Drag your answer into the gap.',
        frames: [{ pre: '41 − 38 = ', post: '', answer: '3' }],
        tiles: [{ key: '3', label: '3' }, { key: '4', label: '4' }, { key: '2', label: '2' }, { key: '13', label: '13' }],
        why: { '*': 'Start at 38. Hop to 40, that is 2. Then one more to 41. The gap is 3.' },
        variant: { frames: [{ pre: '52 − 49 = ', post: '', answer: '3' }],
          tiles: [{ key: '3', label: '3' }, { key: '2', label: '2' }, { key: '4', label: '4' }, { key: '11', label: '11' }] } },
      { kind: 'place', title: 'And again', instruction: 'Drag your answer into the gap.',
        frames: [{ pre: '70 − 66 = ', post: '', answer: '4' }],
        tiles: [{ key: '4', label: '4' }, { key: '5', label: '5' }, { key: '6', label: '6' }, { key: '14', label: '14' }],
        why: { '*': '66 to 70 is one hop of 4.' } },
      { kind: 'place', title: 'How big is the gap?', instruction: 'Drag your answer into the gap.',
        frames: [{ pre: 'How big is the gap from 47 to 52?', post: '', answer: '5' }],
        tiles: [{ key: '5', label: '5' }, { key: '4', label: '4' }, { key: '6', label: '6' }, { key: '15', label: '15' }],
        why: { '*': '47 to 50 is 3, then 50 to 52 is 2. Three and two is five.' } }
    ],
    win: { stamp: 'I can count up the gap!' }
  },
  {
    id: 'fractions', name: 'What a fraction really is', icon: 'cakeslice',
    hook: { kind: 'sign', scene: 'share', before: '1 cake, 4 Boos', after: '4 equal pieces',
      line: 'One cake, four Boos, and everyone wants it FAIR. That is all a fraction is.' },
    cards: [
      { type: 'talk', text: "A fraction is just a fair share wearing a fancy name." },
      { type: 'visual', kind: 'fractionCircle', spec: { parts: 4, shaded: 1, caption: 'bottom = equal pieces, top = how many we mean' } },
      { type: 'workedStep', title: 'Show 3/4', steps: ["Cut into 4 equal pieces, so the bottom says 4.", "Shade 3.", "Three quarters!"] },
      { type: 'talk', text: "Sharing version: 12 biscuits shared fairly between 4 Boos. Each Boo's share is one quarter: 3 biscuits." }
    ],
    try: [
      { kind: 'place', title: 'Name the fraction', instruction: 'Drag your answer into the gap.',
        frames: [{ pre: 'A shape is cut into 3 equal parts and 2 are shaded. What fraction?', post: '', answer: '2/3' }],
        tiles: [{ key: '2/3', label: '2/3' }, { key: '3/2', label: '3/2' }, { key: '1/3', label: '1/3' }, { key: '2/4', label: '2/4' }],
        why: { '*': 'The bottom is how many equal parts (3). The top is how many we mean (2).' },
        variant: { frames: [{ pre: '5 equal parts, 1 shaded?', post: '', answer: '1/5' }],
          tiles: [{ key: '1/5', label: '1/5' }, { key: '5/1', label: '5/1' }, { key: '1/4', label: '1/4' }, { key: '4/5', label: '4/5' }] } },
      { kind: 'place', title: 'Half of it', instruction: 'Drag your answer into the gap.',
        frames: [{ pre: 'What is 1/2 of 10?', post: '', answer: '5' }],
        tiles: [{ key: '5', label: '5' }, { key: '2', label: '2' }, { key: '20', label: '20' }, { key: '8', label: '8' }],
        why: { '*': 'A half means shared between two. Ten shared between two Boos is five each.' } },
      { kind: 'place', title: 'Which is bigger?', instruction: 'Drag your answer into the gap.',
        frames: [{ pre: 'Same cake: which piece is bigger?', post: '', answer: 'a half' }],
        tiles: [{ key: 'a half', label: 'a half' }, { key: 'a quarter', label: 'a quarter' }, { key: "they're the same", label: "they're the same" }, { key: "can't tell", label: "can't tell" }],
        why: { '*': 'Fewer pieces means BIGGER pieces. Two pieces beat four pieces.' } }
    ],
    win: { stamp: 'I know what a fraction is!' }
  },
  {
    id: 'timesTables', name: 'Times tables are quick adding', icon: 'dotsgrid',
    hook: { kind: 'sign', scene: 'long', before: '4+4+4+4+4+4+4', after: '7 × 4',
      line: 'My paper ran out! There has to be a quicker way to say the same thing.' },
    cards: [
      { type: 'talk', text: "A times table is a secret code for adding the same number again and again." },
      { type: 'visual', kind: 'array', spec: { rows: 3, cols: 4, countBy: 4, counts: [4, 8, 12] } },
      { type: 'workedStep', title: '3 × 4', steps: ["3 lots of 4: that's 4 + 4 + 4.", "Count in fours: 4, 8, 12.", "And 4 lots of 3 gives the same 12. Turn the box, same dots!"] },
      { type: 'talk', text: "Skip-count with claps: 4... 8... 12! Your times tables are just a beat." }
    ],
    try: [
      { kind: 'place', title: 'Say it the long way', instruction: 'Drag your answer into the gap.',
        frames: [{ pre: '5 × 3 means the same as?', post: '', answer: '5 + 5 + 5' }],
        tiles: [{ key: '5 + 5 + 5', label: '5 + 5 + 5' }, { key: '5 + 3', label: '5 + 3' }, { key: '3 + 3', label: '3 + 3' }, { key: '5 + 5', label: '5 + 5' }],
        why: { '*': '5 × 3 is THREE LOTS of 5: 5 + 5 + 5.' },
        variant: { frames: [{ pre: '2 × 6 means?', post: '', answer: '6 + 6' }],
          tiles: [{ key: '6 + 6', label: '6 + 6' }, { key: '2 + 6', label: '2 + 6' }, { key: '6 + 2 + 6', label: '6 + 2 + 6' }, { key: '2 + 2', label: '2 + 2' }] } },
      { kind: 'place', title: 'Count the dots', instruction: 'Drag your answer into the gap.',
        frames: [{ pre: 'An array has 2 rows of 6 dots. How many dots?', post: '', answer: '12' }],
        tiles: [{ key: '12', label: '12' }, { key: '8', label: '8' }, { key: '26', label: '26' }, { key: '62', label: '62' }],
        why: { '*': 'Two rows of six is 6 + 6. Twelve dots.' } },
      { kind: 'place', title: 'Ten lots', instruction: 'Drag your answer into the gap.',
        frames: [{ pre: '10 × 4 = ', post: '', answer: '40' }],
        tiles: [{ key: '40', label: '40' }, { key: '14', label: '14' }, { key: '44', label: '44' }, { key: '104', label: '104' }],
        why: { '*': 'Ten lots of four: count in fours ten times, or in tens four times. Forty.' } }
    ],
    win: { stamp: 'I know what times means!' }
  },
  {
    id: 'time', name: 'Telling the time', icon: 'clock',
    hook: { kind: 'sign', scene: 'clock', before: "half past 3? 6 o'clock?", after: 'half past 3',
      line: "Two hands, two Boos, two different answers. Let's sort out which hand is the boss." },
    cards: [
      { type: 'talk', text: "A clock has two hands. The short one is the boss: it says the hour. The long one just says how far through." },
      { type: 'visual', kind: 'clock', spec: { h: 3, m: 30, callouts: ['6 = half past', '3 = quarter past', '9 = quarter to'] } },
      { type: 'workedStep', title: 'Read 3:30', steps: ["Short hand: just past 3, so the hour is 3.", "Long hand: straight down at the 6.", "Long hand at 6 means half past. Half past 3!"] },
      { type: 'talk', text: "Pizza version: the clock face is a pizza in four slices. The long hand eating one slice is quarter past, two slices is half past, three is quarter to." }
    ],
    try: [
      { kind: 'place', title: 'Read the clock', instruction: 'Drag your answer into the gap.',
        frames: [{ pre: 'Long hand at 6, short hand between 4 and 5. What time?', post: '', answer: 'half past 4' }],
        tiles: [{ key: 'half past 4', label: 'half past 4' }, { key: 'half past 5', label: 'half past 5' }, { key: "6 o'clock", label: "6 o'clock" }, { key: 'quarter past 4', label: 'quarter past 4' }],
        why: { '*': 'The long hand at 6 always means half past, and the short hand has only just passed 4.' },
        variant: { frames: [{ pre: 'Long hand at 6, short between 7 and 8?', post: '', answer: 'half past 7' }],
          tiles: [{ key: 'half past 7', label: 'half past 7' }, { key: 'half past 8', label: 'half past 8' }, { key: "6 o'clock", label: "6 o'clock" }, { key: 'quarter to 7', label: 'quarter to 7' }] } },
      { kind: 'place', title: 'Where does it point?', instruction: 'Drag your answer into the gap.',
        frames: [{ pre: 'At quarter past 7, where does the long hand point?', post: '', answer: 'the 3' }],
        tiles: [{ key: 'the 3', label: 'the 3' }, { key: 'the 9', label: 'the 9' }, { key: 'the 7', label: 'the 7' }, { key: 'the 12', label: 'the 12' }],
        why: { '*': 'Quarter past is one quarter of the way round the pizza: the 3.' } },
      { kind: 'place', title: 'How long is that?', instruction: 'Drag your answer into the gap.',
        frames: [{ pre: '15 minutes is the same as?', post: '', answer: 'quarter of an hour' }],
        tiles: [{ key: 'quarter of an hour', label: 'quarter of an hour' }, { key: 'half an hour', label: 'half an hour' }, { key: '5 minutes', label: '5 minutes' }, { key: 'an hour and a quarter', label: 'an hour and a quarter' }],
        why: { '*': 'An hour is 60 minutes. Cut it into four and each piece is 15.' } }
    ],
    win: { stamp: 'I can tell the time!' }
  }
];

// The nine lessons the Teach Me list shows: the six maths, then the three literacy ones.
export const LESSONS = [...MATHS_LESSONS, ...LITERACY_LESSONS];
export const LESSON_BY_ID = Object.fromEntries(LESSONS.map(l => [l.id, l]));
export { LITERACY_LESSONS };
