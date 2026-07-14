// data/detective.js — Word Detective (RUN9 C3) target lists. EXACTLY these words and only
// these, per the brief; do not add, remove or "improve". Two modes: 4-letter and 5-letter.
// Targets never repeat until the whole list cycles (the game keeps a shuffled cursor).

export const FOUR = [
  'ball', 'fish', 'star', 'milk', 'frog', 'cake', 'jump', 'blue', 'tree', 'moon',
  'book', 'rain', 'snow', 'duck', 'sock', 'king', 'ship', 'nest', 'ring', 'drum',
  'gold', 'hand', 'farm', 'bird', 'wolf', 'corn', 'leaf', 'door', 'bell', 'wind',
  'sand', 'rock', 'seed', 'twin', 'park', 'gift', 'mask', 'lamp', 'coin', 'hill',
  'pond', 'boat', 'kite', 'wing', 'crab'
];

export const FIVE = [
  'apple', 'tiger', 'sheep', 'house', 'mouse', 'plant', 'bread', 'chair', 'cloud', 'dance',
  'smile', 'grape', 'horse', 'lemon', 'magic', 'night', 'ocean', 'party', 'queen', 'river',
  'snake', 'stone', 'sugar', 'table', 'train', 'whale', 'zebra', 'beach', 'brick', 'candy',
  'dream', 'flame', 'giant', 'heart', 'jelly', 'koala', 'light', 'money', 'music', 'paint',
  'pizza', 'robot', 'shine', 'storm', 'tooth'
];

export const LISTS = { 4: FOUR, 5: FIVE };
