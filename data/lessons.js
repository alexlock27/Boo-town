// data/lessons.js — Teach Me lessons (EXPANSION_2 C1, six at launch).
// Card types: talk | visual | workedStep | check. Visual kinds: placeValue,
// numberLine, fractionCircle, array, clock. Options are shuffled at runtime;
// `correct` is the index into the options array as written here. `backTo` is the
// card index a wrong check routes back to; `variant` (optional) is re-asked after.

export const LESSONS = [
  {
    id: 'placeValue', name: 'Hundreds, tens and ones', icon: 'tower',
    cards: [
      { type: 'talk', text: "Big numbers are just small numbers standing in towers. Let me show you." },
      { type: 'visual', kind: 'placeValue', spec: { number: 347, cols: [{ label: 'hundreds', digit: 3, worth: 300 }, { label: 'tens', digit: 4, worth: 40 }, { label: 'ones', digit: 7, worth: 7 }] } },
      { type: 'workedStep', title: 'Build 347', steps: ["3 lives in the hundreds tower, so it's worth 300.", "4 lives in the tens tower, worth 40.", "7 ones are just 7.", "300 and 40 and 7. Three hundred and forty seven!"] },
      { type: 'talk', text: "Or think money: 3 pound coins, 4 ten-pences, 7 pennies. That's 347 pennies!" },
      { type: 'check', q: "In 582, what is the 8 worth?", options: ['80', '8', '800', '58'], correct: 0, backTo: 1, variant: { q: "In 274, what is the 7 worth?", options: ['70', '7', '700', '27'], correct: 0 } },
      { type: 'check', q: "Which number has 6 tens?", options: ['461', '306', '640', '616'], correct: 0, backTo: 1, variant: { q: "Which has 3 tens?", options: ['234', '342', '403', '313'], correct: 0 } },
      { type: 'check', q: "3 hundreds, 0 tens, 9 ones makes?", options: ['309', '39', '390', '903'], correct: 0, backTo: 1, variant: { q: "5 hundreds, 0 tens, 2 ones?", options: ['502', '52', '520', '205'], correct: 0 } }
    ]
  },
  {
    id: 'jumpTen', name: 'Jumping over ten', icon: 'spring',
    cards: [
      { type: 'talk', text: "Adding is easy near a ten. Tens are stepping stones, so we jump to one first." },
      { type: 'visual', kind: 'numberLine', spec: { from: 47, to: 55, hops: [{ from: 47, to: 50, label: '+3' }, { from: 50, to: 55, label: '+5' }] } },
      { type: 'workedStep', title: '47 + 8', steps: ["How far to the next ten? 47 needs 3 to reach 50.", "Split the 8 into 3 and 5.", "Jump: 47 and 3 is 50.", "Then the leftover 5. 55!"] },
      { type: 'talk', text: "Another way: 7 and 3 are 'make ten friends'. When you see a 7, it's looking for a 3." },
      { type: 'check', q: "38 + 7 = ?", options: ['45', '44', '46', '35'], correct: 0, backTo: 2, variant: { q: "48 + 6 = ?", options: ['54', '53', '55', '44'], correct: 0 } },
      { type: 'check', q: "56 + 9 = ?", options: ['65', '64', '66', '47'], correct: 0, backTo: 2 },
      { type: 'check', q: "What little jump takes 29 to the next ten?", options: ['1', '2', '3', '10'], correct: 0, backTo: 2 }
    ]
  },
  {
    id: 'countUp', name: 'Taking away by counting up', icon: 'footsteps',
    cards: [
      { type: 'talk', text: "When two numbers are close, don't take away. Count UP the gap, like a shopkeeper giving change." },
      { type: 'visual', kind: 'numberLine', spec: { from: 58, to: 62, hops: [{ from: 58, to: 60, label: '+2' }, { from: 60, to: 62, label: '+2' }], circleGap: 4 } },
      { type: 'workedStep', title: '62 − 58', steps: ["Start at 58.", "Hop to 60: that's 2.", "Hop to 62: 2 more.", "2 and 2. The gap is 4!"] },
      { type: 'talk', text: "Shop version: the sticker costs 58p, you pay 62p. The change is the counting-up gap: 4p." },
      { type: 'check', q: "41 − 38 = ?", options: ['3', '4', '2', '13'], correct: 0, backTo: 2, variant: { q: "52 − 49 = ?", options: ['3', '2', '4', '11'], correct: 0 } },
      { type: 'check', q: "70 − 66 = ?", options: ['4', '5', '6', '14'], correct: 0, backTo: 2 },
      { type: 'check', q: "How big is the gap from 47 to 52?", options: ['5', '4', '6', '15'], correct: 0, backTo: 2 }
    ]
  },
  {
    id: 'fractions', name: 'What a fraction really is', icon: 'cakeslice',
    cards: [
      { type: 'talk', text: "A fraction is just a fair share wearing a fancy name." },
      { type: 'visual', kind: 'fractionCircle', spec: { parts: 4, shaded: 1, caption: 'bottom = equal pieces, top = how many we mean' } },
      { type: 'workedStep', title: 'Show 3/4', steps: ["Cut into 4 equal pieces, so the bottom says 4.", "Shade 3.", "Three quarters!"] },
      { type: 'talk', text: "Sharing version: 12 biscuits shared fairly between 4 Boos. Each Boo's share is one quarter: 3 biscuits." },
      { type: 'check', q: "A shape is cut into 3 equal parts and 2 are shaded. What fraction?", options: ['2/3', '3/2', '1/3', '2/4'], correct: 0, backTo: 1, variant: { q: "5 equal parts, 1 shaded?", options: ['1/5', '5/1', '1/4', '4/5'], correct: 0 } },
      { type: 'check', q: "What is 1/2 of 10?", options: ['5', '2', '20', '8'], correct: 0, backTo: 1 },
      { type: 'check', q: "Same cake: which piece is bigger?", options: ['a half', 'a quarter', "they're the same", "can't tell"], correct: 0, backTo: 1 }
    ]
  },
  {
    id: 'timesTables', name: 'Times tables are quick adding', icon: 'dotsgrid',
    cards: [
      { type: 'talk', text: "A times table is a secret code for adding the same number again and again." },
      { type: 'visual', kind: 'array', spec: { rows: 3, cols: 4, countBy: 4, counts: [4, 8, 12] } },
      { type: 'workedStep', title: '3 × 4', steps: ["3 lots of 4: that's 4 + 4 + 4.", "Count in fours: 4, 8, 12.", "And 4 lots of 3 gives the same 12. Turn the box, same dots!"] },
      { type: 'talk', text: "Skip-count with claps: 4... 8... 12! Your times tables are just a beat." },
      { type: 'check', q: "5 × 3 means the same as?", options: ['5 + 5 + 5', '5 + 3', '3 + 3', '5 + 5'], correct: 0, backTo: 2, variant: { q: "2 × 6 means?", options: ['6 + 6', '2 + 6', '6 + 2 + 6', '2 + 2'], correct: 0 } },
      { type: 'check', q: "An array has 2 rows of 6 dots. How many dots?", options: ['12', '8', '26', '62'], correct: 0, backTo: 2 },
      { type: 'check', q: "10 × 4 = ?", options: ['40', '14', '44', '104'], correct: 0, backTo: 2 }
    ]
  },
  {
    id: 'time', name: 'Telling the time', icon: 'clock',
    cards: [
      { type: 'talk', text: "A clock has two hands. The short one is the boss: it says the hour. The long one just says how far through." },
      { type: 'visual', kind: 'clock', spec: { h: 3, m: 30, callouts: ['6 = half past', '3 = quarter past', '9 = quarter to'] } },
      { type: 'workedStep', title: 'Read 3:30', steps: ["Short hand: just past 3, so the hour is 3.", "Long hand: straight down at the 6.", "Long hand at 6 means half past. Half past 3!"] },
      { type: 'talk', text: "Pizza version: the clock face is a pizza in four slices. The long hand eating one slice is quarter past, two slices is half past, three is quarter to." },
      { type: 'check', q: "Long hand at 6, short hand between 4 and 5. What time?", options: ['half past 4', 'half past 5', "6 o'clock", 'quarter past 4'], correct: 0, backTo: 1, variant: { q: "Long hand at 6, short between 7 and 8?", options: ['half past 7', 'half past 8', "6 o'clock", 'quarter to 7'], correct: 0 } },
      { type: 'check', q: "At quarter past 7, where does the long hand point?", options: ['the 3', 'the 9', 'the 7', 'the 12'], correct: 0, backTo: 1 },
      { type: 'check', q: "15 minutes is the same as?", options: ['quarter of an hour', 'half an hour', '5 minutes', 'an hour and a quarter'], correct: 0, backTo: 1 }
    ]
  }
];
