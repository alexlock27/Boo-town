// data/puzzles.js — Puzzle Plates launch problems (EXPANSION_2.md §C2).
// Parked data: exact transcription of the twenty authored problems, ready to wire up.
// Per item: { id, level, text, numbers, decoys, op, answer, wrong }.

export const PUZZLES = [
  // Level 1 (one step)
  { id: 'pp1', level: 1, text: 'Pip has 7 shiny stickers. Milo gives her 5 more. How many stickers now?', numbers: [7, 5], decoys: [], op: 'add', answer: '12', wrong: ['2', '11', '13'] },
  { id: 'pp2', level: 1, text: 'There are 14 Boos at the dance stage. 6 trot home for tea. How many keep dancing?', numbers: [14, 6], decoys: [], op: 'subtract', answer: '8', wrong: ['20', '7', '9'] },
  { id: 'pp3', level: 1, text: 'A Boo bakes 9 biscuits in the morning and 8 after lunch. How many altogether?', numbers: [9, 8], decoys: [], op: 'add', answer: '17', wrong: ['1', '16', '18'] },
  { id: 'pp4', level: 1, text: 'Twiglet is 12 apples tall. A baby giraffe is 4 apples shorter. How tall is the baby?', numbers: [12, 4], decoys: [], op: 'subtract', answer: '8', wrong: ['16', '7', '9'] },
  { id: 'pp5', level: 1, text: 'The toy shop had 20 blind boxes and sold 7. How many are left?', numbers: [20, 7], decoys: [], op: 'subtract', answer: '13', wrong: ['27', '12', '14'] },
  { id: 'pp6', level: 1, text: 'Six Boos each hold one balloon. 3 balloons pop! How many balloons are left?', numbers: [6, 3], decoys: [], op: 'subtract', answer: '3', wrong: ['9', '4', '2'] },
  { id: 'pp7', level: 1, text: 'A dance routine has 8 spins and 6 jumps. How many moves altogether?', numbers: [8, 6], decoys: [], op: 'add', answer: '14', wrong: ['2', '13', '15'] },

  // Level 2 (two steps, money, time, decoys)
  { id: 'pp8', level: 2, text: 'Stickers cost 5p each. Ava buys 4 and pays with a 50p coin. How much change?', numbers: [5, 4, 50], decoys: [], op: 'multi', answer: '30p', wrong: ['20p', '45p', '25p'] },
  { id: 'pp9', level: 2, text: 'A Boo house needs 25 bricks. Jem has 18. How many more does she need?', numbers: [25, 18], decoys: [], op: 'subtract', answer: '7', wrong: ['43', '8', '6'] },
  { id: 'pp10', level: 2, text: 'There are 3 shelves with 10 blind boxes on each. 5 boxes have been opened. How many unopened?', numbers: [3, 10, 5], decoys: [], op: 'multi', answer: '25', wrong: ['30', '35', '15'] },
  { id: 'pp11', level: 2, text: 'Milo naps for 20 minutes, wakes up, then naps 15 more. How long did he nap altogether?', numbers: [20, 15], decoys: [], op: 'add', answer: '35 minutes', wrong: ['5', '30', '45'] },
  { id: 'pp12', level: 2, text: 'A ribbon is 60 cm long. Priya cuts off two 20 cm pieces for bows. How much ribbon is left?', numbers: [60, 20, 2], decoys: [], op: 'multi', answer: '20 cm', wrong: ['40', '30', '10'] },
  { id: 'pp13', level: 2, text: 'Show tickets cost £2 each. Mum has £10 and buys 4 tickets. How much money is left?', numbers: [2, 4, 10], decoys: [], op: 'multi', answer: '£2', wrong: ['£8', '£6', '£3'] },
  { id: 'pp14', level: 2, text: 'A packet holds 6 hair bows. Nan buys 3 packets, and 2 bows are used straight away. How many bows are left?', numbers: [6, 3, 2], decoys: [], op: 'multi', answer: '16', wrong: ['18', '11', '17'] },

  // Level 3 (sharing, fractions of amounts, times)
  { id: 'pp15', level: 3, text: '24 strawberries are shared fairly between 4 Boos. How many does each Boo get?', numbers: [24, 4], decoys: [], op: 'divide', answer: '6', wrong: ['20', '28', '8'] },
  { id: 'pp16', level: 3, text: 'A giraffe drinks 5 buckets of water every day. How many buckets in a week?', numbers: [5, 7], decoys: [], op: 'multiply', answer: '35', wrong: ['12', '30', '40'] },
  { id: 'pp17', level: 3, text: 'Half of the 18 Boos in the square are wearing hats. How many hats?', numbers: [18, 2], decoys: [], op: 'divide', answer: '9', wrong: ['36', '8', '10'] },
  { id: 'pp18', level: 3, text: "A quarter of Maya's 20 stickers are gold. How many gold stickers?", numbers: [20, 4], decoys: [], op: 'divide', answer: '5', wrong: ['4', '16', '10'] },
  { id: 'pp19', level: 3, text: 'Beads come in bags of 8. Leo needs 32 beads for a bracelet. How many bags?', numbers: [8, 32], decoys: [], op: 'divide', answer: '4', wrong: ['24', '40', '5'] },
  { id: 'pp20', level: 3, text: "The dance show lasts 45 minutes and starts at 3 o'clock. When does it finish?", numbers: [45, 3], decoys: [], op: 'multi', answer: 'quarter to 4', wrong: ['quarter past 3', '4 o\'clock', 'quarter past 4'] },
];
