// data/sortingExtra.js — Feed the Boos expansion round templates (EXPANSION_1.md §2.2, §3.2).
// Self-contained: reproduces the small helpers from sorting.js so it can be imported
// on its own. Each template exposes make() -> { id, buckets:[labels], items:[{...,bucket}], hintFor(item) }.
// Content pools are transcribed exactly from the spec; hints are warm helper one-liners.

const rnd = (n) => (Math.random() * n) | 0;
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
// RUN21H A4: session-scoped repeat avoidance — same seam as data/sorting.js (this file
// stays deliberately self-contained, so it carries its own copy). A round prefers items
// this session has not dealt yet; a genuinely exhausted pool resets and cycles fresh.
const SEEN = new Set();
function freshFirst(arr) {
  const unseen = arr.filter(it => !SEEN.has(it.key));
  if (!unseen.length && arr.length) { arr.forEach(it => SEEN.delete(it.key)); return arr.slice(); }
  return unseen;
}
function sampleN(arr, n) {
  const want = Math.min(n, arr.length);
  const picks = shuffle(freshFirst(arr)).slice(0, want);
  if (picks.length < want) {
    const have = new Set(picks.map(it => it.key));
    for (const it of shuffle(arr.slice())) {
      if (picks.length >= want) break;
      if (!have.has(it.key)) { picks.push(it); have.add(it.key); }
    }
  }
  picks.forEach(it => SEEN.add(it.key));
  return picks;
}
function range(lo, hi) { const a = []; for (let i = lo; i <= hi; i++) a.push(i); return a; }

// Build a balanced round from per-bucket candidate pools.
// pools = [ [items...], [items...], ... ]  (each item already tagged {bucket})
function assemble(buckets, pools, total = 12) {
  const B = pools.length;
  const base = Math.floor(total / B);
  const picks = [];
  // first pass: up to `base` from each bucket
  const taken = pools.map(p => sampleN(p, base));
  taken.forEach(t => picks.push(...t));
  // top up toward total from buckets that still have unused unique items
  let guard = 0;
  while (picks.length < total && guard++ < 100) {
    let added = false;
    for (let b = 0; b < B && picks.length < total; b++) {
      const used = new Set(picks.filter(x => x.bucket === b).map(x => x.key));
      const spare = pools[b].filter(x => !used.has(x.key));
      if (spare.length) {
        // RUN21H A4: top-ups prefer items this session has not seen either
        const fresh = spare.filter(x => !SEEN.has(x.key));
        const it = (fresh.length ? fresh : spare)[rnd((fresh.length ? fresh : spare).length)];
        SEEN.add(it.key);
        picks.push(it); added = true;
      }
    }
    if (!added) break;
  }
  return shuffle(picks);
}

function round(buckets, items, hintFor) {
  return { buckets, items, hintFor, length: items.length };
}

// Item constructors.
const numItem  = (v, bucket) => ({ key: 'n' + v, kind: 'num', value: v, bucket });
const fracItem = (n, d, bucket) => ({ key: `f${n}/${d}`, kind: 'frac', num: n, den: d, bucket });
const unitItem = (emoji, caption, bucket) => ({ key: 'u' + caption, kind: 'unit', emoji, caption, bucket });
const textItem = (text, bucket) => ({ key: 't' + text, kind: 'text', text, bucket });
const angleItem = (deg, bucket) => ({ key: 'a' + deg + '_' + bucket + Math.random().toString(36).slice(2, 5), kind: 'angle', deg, bucket });
const letterItem = (ch, bucket) => ({ key: 'L' + ch, kind: 'letter', ch, bucket });

export const TEMPLATES_EXTRA = [
  // 10. placeValueDigit (L1 three-digit, L2 four-digit)
  // Pick a digit d 2..9 and build numbers where d sits in exactly one place,
  // matching a place-value bucket. L1 has ones/tens/hundreds; L2 adds thousands.
  ...[
    ['placeValueDigit', 1, 3],
    ['placeValueDigit4', 2, 4]
  ].map(([id, lvl, digits]) => ({
    id, level: lvl, make() {
      const d = 2 + rnd(8); // 2..9
      // bucket labels by place: ones -> "worth d", tens -> "worth d0", etc.
      const placeLabel = (place) => place === 0 ? `worth ${d}` : `worth ${d}${'0'.repeat(place)}`;
      const buckets = range(0, digits - 1).map(placeLabel); // index = place (0=ones ... digits-1=highest)
      const otherDigit = () => { let x; do { x = rnd(10); } while (x === d); return x; };
      // Build one number that contains d exactly once, in `place`, with no other d anywhere.
      const buildNumber = (place) => {
        let n = 0;
        for (let p = digits - 1; p >= 0; p--) {
          let digitVal;
          if (p === place) {
            digitVal = d;
          } else {
            // leading place must not be 0 so the number keeps its digit count
            digitVal = (p === digits - 1) ? (() => { let x; do { x = 1 + rnd(9); } while (x === d); return x; })() : otherDigit();
          }
          n = n * 10 + digitVal;
        }
        return n;
      };
      // 12 numbers, balanced across the place-value buckets, no duplicates.
      const pools = buckets.map((_, place) => {
        const seen = new Set();
        const arr = [];
        let guard = 0;
        while (arr.length < 6 && guard++ < 200) {
          const n = buildNumber(place);
          if (!seen.has(n)) { seen.add(n); arr.push(numItem(n, place)); }
        }
        return arr;
      });
      return round(buckets, assemble(buckets, pools, 12),
        it => `Look at the digit ${d} in ${it.value}. What is it worth here?`);
    }
  })),

  // 11. monthsDays (L2)
  { id: 'monthsDays', level: 2, make() {
    const buckets = ['30 days', '31 days', '28 or 29'];
    const d30 = ['April', 'June', 'September', 'November'].map(m => textItem(m, 0));
    const d31 = ['January', 'March', 'May', 'July', 'August', 'October', 'December'].map(m => textItem(m, 1));
    const d28 = ['February'].map(m => textItem(m, 2));
    return round(buckets, assemble(buckets, [d30, d31, d28]),
      it => `How many days are in ${it.text}? Try the knuckle trick!`);
  }},

  // 12. timeUnits (L1)
  // RUN21H A3: 12 items for a 12-item round meant every round was the whole pool. Now 30,
  // so the first two rounds are entirely fresh. Every addition is an everyday British
  // child's activity whose duration is unarguable in its bucket.
  { id: 'timeUnits', level: 1, make() {
    const buckets = ['seconds', 'minutes', 'hours'];
    const secs = [
      ['👁️', 'one blink'],
      ['🤧', 'a sneeze'],
      ['👏', 'clapping three times'],
      ['🗣️', 'saying your name'],
      ['🫧', 'a hiccup'],
      ['🤞', 'clicking your fingers'],
      ['🔔', 'a doorbell ringing'],
      ['🕯️', 'blowing out a candle'],
      ['🐇', 'one hop'],
      ['🤐', 'closing your eyes and opening them'],
      ['🚪', 'a door slamming'],
      ['💡', 'switching on a light']
    ].map(([e, c]) => unitItem(e, c, 0));
    const mins = [
      ['🪥', 'brushing your teeth'],
      ['🥚', 'boiling an egg'],
      ['🎵', 'one song'],
      ['👕', 'getting dressed'],
      ['🥪', 'making a jam sandwich'],
      ['🫖', 'waiting for the kettle'],
      ['🍞', 'waiting for the toast'],
      ['📖', 'reading one page out loud'],
      ['🧦', 'finding a matching pair of socks'],
      ['🖍️', 'colouring in one picture'],
      ['🧼', 'washing up the breakfast things'],
      ['🐶', 'walking round the block with the dog']
    ].map(([e, c]) => unitItem(e, c, 1));
    const hours = [
      ['🏫', 'a whole school day'],
      ['🎬', 'a film'],
      ['😴', "tonight's sleep"],
      // RUN21H A2: was 'a drive to the seaside' — true in hours only if you live inland.
      // A child in Blackpool or Brighton drives to the seaside in minutes and would be
      // marked soft-wrong for the right answer. 'long' pins the bucket for every child.
      ['🚗', 'a long car journey'],
      ['⚽', 'a whole football match'],
      ['🎂', 'a birthday party'],
      ['🏖️', 'a whole day at the seaside'],
      ['✈️', 'a flight to Spain'],
      ['🎨', 'painting a whole bedroom'],
      ['🚂', 'a train ride to London'],
      ['🏕️', 'a whole camping trip day'],
      ['🎡', 'a day out at the funfair']
    ].map(([e, c]) => unitItem(e, c, 2));
    return round(buckets, assemble(buckets, [secs, mins, hours]),
      it => `Does ${it.caption} take seconds, minutes or hours?`);
  }},

  // 13. timeHour (L2)
  { id: 'timeHour', level: 2, make() {
    const buckets = ['less than 1 hour', 'exactly 1 hour', 'more than 1 hour'];
    // RUN21H A3: 12 -> 36 items.
    const less = ['45 minutes', '30 minutes', '59 minutes', 'quarter of an hour', 'half an hour',
      '20 minutes', '55 minutes', '10 minutes', 'three quarters of an hour', '40 minutes',
      '5 minutes', '25 minutes', '15 minutes', '50 minutes', '35 minutes'].map(t => textItem(t, 0));
    const exact = ['60 minutes', '3 lots of 20 minutes', '2 lots of 30 minutes', '4 lots of 15 minutes',
      '6 lots of 10 minutes', 'two half hours'].map(t => textItem(t, 1));
    const more = ['90 minutes', '61 minutes', '100 minutes', '2 hours', 'an hour and a half',
      '75 minutes', '120 minutes', 'an hour and a quarter', '3 hours', '65 minutes',
      '80 minutes', '110 minutes', '4 hours', '70 minutes', '95 minutes'].map(t => textItem(t, 2));
    return round(buckets, assemble(buckets, [less, exact, more]),
      it => `Is ${it.text} less than, exactly, or more than 1 hour? Remember, 1 hour is 60 minutes.`);
  }},

  // 14. moneyPound (L2)
  { id: 'moneyPound', level: 2, make() {
    const buckets = ['less than £1', 'exactly £1', 'more than £1'];
    // RUN21H A3: 14 -> 36 items. Coin combinations use real UK coins only.
    const less = ['85p', '99p', '50p', '£0.75', '£0.99', '95p',
      '20p', '£0.45', '70p', 'four 20p coins',
      '35p', '£0.60', '90p', '£0.25', 'nine 10p coins'].map(t => textItem(t, 0));
    const exact = ['100p', 'two 50p coins', 'ten 10p coins', 'five 20p coins',
      'twenty 5p coins', '£1.00'].map(t => textItem(t, 1));
    const more = ['£1.20', '120p', '£1.05', '£2',
      '150p', '£1.50', '£1.99', 'three 50p coins', '£5', '£1.10',
      '£1.75', '250p', '£3', '£1.01', 'twelve 10p coins'].map(t => textItem(t, 2));
    return round(buckets, assemble(buckets, [less, exact, more]),
      it => `Is ${it.text} less than, exactly, or more than £1? £1 is 100p.`);
  }},

  // 15. lengthMetre (L1)
  { id: 'lengthMetre', level: 1, make() {
    const buckets = ['shorter than 1 metre', 'longer than 1 metre'];
    // RUN21H A3: 12 -> 36 items, so all three of a sitting's rounds are entirely fresh.
    const shorter = ['45 cm', '99 cm', '30 cm', '75 cm', '25 cm', '90 cm',
      '10 cm', '60 cm', '5 cm', '80 cm', '15 cm', '50 cm',
      '20 cm', '35 cm', '70 cm', '95 cm', '40 cm', '85 cm'].map(t => textItem(t, 0));
    const longer = ['120 cm', '150 cm', '2 m', '101 cm', '180 cm', '3 m',
      '250 cm', '110 cm', '5 m', '130 cm', '10 m', '175 cm',
      '140 cm', '4 m', '200 cm', '160 cm', '6 m', '105 cm'].map(t => textItem(t, 1));
    return round(buckets, assemble(buckets, [shorter, longer]),
      it => `Is ${it.text} shorter or longer than 1 metre? 1 metre is 100 cm.`);
  }},

  // 16. massKilogram (L2)
  { id: 'massKilogram', level: 2, make() {
    const buckets = ['lighter than 1 kg', 'heavier than 1 kg'];
    // RUN21H A3: 12 -> 36 items.
    const lighter = ['500 g', '999 g', '750 g', '250 g', '100 g', '900 g',
      '50 g', '300 g', '10 g', '650 g', '800 g', '125 g',
      '200 g', '450 g', '75 g', '350 g', '600 g', '950 g'].map(t => textItem(t, 0));
    const heavier = ['1500 g', '2 kg', '1100 g', '1001 g', '3 kg', '1250 g',
      '5 kg', '1750 g', '2500 g', '10 kg', '1050 g', '4 kg',
      '1200 g', '6 kg', '1900 g', '8 kg', '1400 g', '3500 g'].map(t => textItem(t, 1));
    return round(buckets, assemble(buckets, [lighter, heavier]),
      it => `Is ${it.text} lighter or heavier than 1 kg? 1 kg is 1000 g.`);
  }},

  // 17. capacityLitre (L2)
  { id: 'capacityLitre', level: 2, make() {
    const buckets = ['less than 1 litre', 'more than 1 litre'];
    // RUN21H A2: '2 l' and '3 l' spelt out — in a rounded child sans a lowercase l is a
    // bare stroke, so '2 l' can be read as '21'. The hint already says "1 litre".
    // RUN21H A3: 12 -> 36 items.
    const less = ['500 ml', '250 ml', '999 ml', '100 ml', '750 ml', '900 ml',
      '50 ml', '330 ml', '200 ml', '600 ml', '850 ml', '125 ml',
      '150 ml', '400 ml', '700 ml', '80 ml', '550 ml', '950 ml'].map(t => textItem(t, 0));
    const more = ['1500 ml', '2 litres', '1250 ml', '1001 ml', '3 litres', '2500 ml',
      '5 litres', '1750 ml', '1100 ml', '10 litres', '4 litres', '2250 ml',
      '1300 ml', '6 litres', '1600 ml', '8 litres', '1050 ml', '3500 ml'].map(t => textItem(t, 1));
    return round(buckets, assemble(buckets, [less, more]),
      it => `Is ${it.text} less or more than 1 litre? 1 litre is 1000 ml.`);
  }},

  // 18. temperature (L2, Year 4). Minus sign is U+2212 (−).
  { id: 'temperature', level: 2, make() {
    const buckets = ['below zero (brrr)', 'above zero'];
    // RUN21H A3: 12 -> 36 items.
    const below = ['−5°C', '−1°C', '−8°C', '−3°C', '−10°C', '−2°C', '−6°C',
      '−4°C', '−7°C', '−12°C', '−15°C', '−9°C',
      '−11°C', '−13°C', '−14°C', '−16°C', '−18°C', '−20°C'].map(t => textItem(t, 0));
    const above = ['3°C', '7°C', '2°C', '1°C', '9°C',
      '5°C', '12°C', '18°C', '4°C', '20°C', '8°C', '25°C',
      '6°C', '10°C', '15°C', '22°C', '11°C', '30°C'].map(t => textItem(t, 1));
    return round(buckets, assemble(buckets, [below, above]),
      it => `Is ${it.text} below zero or above zero? A minus sign means below zero.`);
  }},

  // 19. romanNumerals (L3, Year 4)
  { id: 'romanNumerals', level: 3, make() {
    const buckets = ['less than 10', '10 to 49', '50 or more'];
    // RUN21H A3: 15 -> 36 items (Y4 statutory: read Roman numerals to 100).
    const low = ['IV', 'VII', 'VIII', 'IX', 'II', 'III', 'V', 'VI', 'I'].map(t => textItem(t, 0));
    const mid = ['XII', 'XIV', 'XXV', 'XXX', 'XXXIX', 'XL', 'XI', 'XX', 'XXIV',
      'XIII', 'XV', 'XVIII', 'XXI', 'XXVII', 'XXXII', 'XXXV', 'XLII', 'XLIX'].map(t => textItem(t, 1));
    const high = ['L', 'LX', 'LXXV', 'XC', 'C', 'LV', 'LXX', 'LXXXIX', 'LXV'].map(t => textItem(t, 2));
    return round(buckets, assemble(buckets, [low, mid, high]),
      it => `What number is ${it.text}? Remember I=1, V=5, X=10, L=50, C=100.`);
  }},

  // 20. symmetry (L2). Big capital letters.
  { id: 'symmetry', level: 2, make() {
    const buckets = ['has a line of symmetry', 'has none'];
    // RUN21H A3: 19 -> all 26 letters. The seven additions are the HORIZONTAL-symmetry
    // capitals (B, C, D, E, K fold across a line through their middle; I folds both ways) —
    // the bucket says "has a line of symmetry", and the hint asks whether it folds so both
    // halves match, which is true of a horizontal fold too. Q joins the none bucket.
    const sym = ['A', 'H', 'M', 'O', 'T', 'U', 'V', 'W', 'X', 'Y',
      'B', 'C', 'D', 'E', 'I', 'K'].map(ch => letterItem(ch, 0));
    const none = ['F', 'G', 'J', 'L', 'N', 'P', 'R', 'S', 'Z', 'Q'].map(ch => letterItem(ch, 1));
    return round(buckets, assemble(buckets, [sym, none]),
      it => `Could you fold the letter ${it.ch} so both halves match exactly?`);
  }},

  // 21. angles (L2). 90 appears three times (three rotations), each in the right-angle bucket.
  { id: 'angles', level: 2, make() {
    const buckets = ['right angle', 'smaller than a right angle', 'bigger than a right angle'];
    const right = [90, 90, 90].map(deg => angleItem(deg, 0));
    const smaller = [20, 30, 45, 60].map(deg => angleItem(deg, 1));
    const bigger = [120, 135, 150, 160].map(deg => angleItem(deg, 2));
    return round(buckets, assemble(buckets, [right, smaller, bigger]),
      it => `Is this angle a right angle, or smaller, or bigger? A right angle is a square corner.`);
  }},

  // 22. fractionFamilies (L3). Two buckets, members only.
  { id: 'fractionFamilies', level: 3, make() {
    const buckets = ['same as 1/4', 'same as 3/4'];
    // RUN21H A3: 8 -> 16 items. Every one still reduces exactly to a quarter or three
    // quarters by dividing top and bottom by the same number, as the hint now says.
    const q1 = [[2, 8], [3, 12], [25, 100], [5, 20], [4, 16], [6, 24], [10, 40], [7, 28]].map(([n, d]) => fracItem(n, d, 0));
    const q3 = [[6, 8], [9, 12], [75, 100], [15, 20], [12, 16], [18, 24], [30, 40], [21, 28]].map(([n, d]) => fracItem(n, d, 1));
    // RUN21H A2: the hint said "Try simplifying it" — 'simplify' is Year 6 vocabulary, so
    // the one word a stuck Y3/4 child was offered was two years above her tier. The method
    // is now spelt out, and it works on every item in both pools.
    return round(buckets, assemble(buckets, [q1, q3]),
      it => `Is ${it.num}/${it.den} the same as 1/4 or 3/4? Divide the top and the bottom by the same number.`);
  }},

  // 23. tenths (L3, Year 4 bridge). Mixed decimal / word / fraction rendering.
  { id: 'tenths', level: 3, make() {
    const buckets = ['less than 0.5', 'equal to 0.5', 'more than 0.5'];
    // RUN21H A3: 13 -> 21 items, keeping the deliberate decimal / fraction / words mix.
    const less = [textItem('0.1', 0), textItem('0.3', 0), fracItem(2, 10, 0), fracItem(4, 10, 0), textItem('0.2', 0),
      textItem('0.4', 0), fracItem(1, 10, 0), fracItem(3, 10, 0)];
    const equal = [textItem('0.5', 1), fracItem(5, 10, 1), textItem('one half', 1),
      textItem('five tenths', 1), textItem('a half', 1)];
    const more = [textItem('0.7', 2), textItem('0.9', 2), fracItem(8, 10, 2), textItem('0.6', 2), fracItem(6, 10, 2),
      textItem('0.8', 2), fracItem(7, 10, 2), fracItem(9, 10, 2)];
    return round(buckets, assemble(buckets, [less, equal, more]),
      it => `Is this less than, equal to, or more than 0.5? Half is 5 tenths.`);
  }},

  // tableMember Year 4 (config tweak): counting tables 25, 50, 100 at L3.
  { id: 'tableMemberY4', level: 3, make() {
    const tables = [25, 50, 100];
    const N = tables[rnd(tables.length)];
    const buckets = [`In the ${N} times table`, 'Not in it'];
    const isMul = (x) => x % N === 0;
    const inPool = range(1, 12).map(k => numItem(k * N, 0));
    const nearSet = new Set();
    range(1, 12).forEach(k => [1, 2, -1, -2].forEach(d => { const v = k * N + d; if (v > 0 && !isMul(v)) nearSet.add(v); }));
    const notPool = [...nearSet].map(v => numItem(v, 1));
    return round(buckets, assemble(buckets, [inPool, notPool]),
      it => `Is ${it.value} in the ${N} times table? Try counting up in ${N}s.`);
  }},

  // 24. nounVerbAdjective (L1)
  // RUN21H A2: six words were swapped because each had a DEFENSIBLE second reading a
  // Y3/4 child would be marked soft-wrong for — 'a whisper', 'the giggles', 'give me a
  // shout' and 'front crawl' are everyday nouns; 'he stormed off' is everyday reading-book
  // English; and a colour word ('purple') genuinely names a colour as well as describing.
  // Every replacement has one dominant part of speech in a child's world.
  { id: 'nounVerbAdjective', level: 1, make() {
    const buckets = ['naming word', 'doing word', 'describing word'];
    // RUN21H A3: 24 -> 36 items. Every addition was put through the same test as the A2
    // swaps — one dominant part of speech in a child's world, no defensible second reading.
    const nouns = ['giraffe', 'kitchen', 'teacher', 'bicycle', 'puddle', 'pocket', 'castle', 'biscuit',
      'lighthouse', 'dragon', 'penguin', 'library'].map(w => textItem(w, 0));
    const verbs = ['gallop', 'scamper', 'gobble', 'vanish', 'munch', 'stumble', 'explore', 'wriggle',
      'scribble', 'clamber', 'tiptoe', 'devour'].map(w => textItem(w, 1));
    const adjs = ['enormous', 'grumpy', 'sparkly', 'gentle', 'curious', 'slippery', 'brave', 'shiny',
      'wobbly', 'ancient', 'cheerful', 'prickly'].map(w => textItem(w, 2));
    return round(buckets, assemble(buckets, [nouns, verbs, adjs]),
      it => `Is "${it.text}" a naming word, a doing word, or a describing word?`);
  }},

  // 25. pluralRules (L2). Singular words.
  { id: 'pluralRules', level: 2, make() {
    const buckets = ['add s', 'add es', 'y becomes ies'];
    // RUN21H A3: 17 -> 30 items. Every -ies word ends in a CONSONANT + y (the rule's actual
    // condition), so none of them is a 'donkey/donkeys' counter-example in disguise.
    const addS = ['apple', 'tiger', 'boot', 'spoon', 'cloud',
      'table', 'garden', 'rocket', 'pencil', 'window',
      'balloon', 'ladder'].map(w => textItem(w, 0));
    const addEs = ['fox', 'bus', 'wish', 'church', 'box', 'glass',
      'brush', 'dish', 'match', 'bench',
      'branch', 'flash'].map(w => textItem(w, 1));
    const ies = ['baby', 'party', 'cherry', 'puppy', 'story', 'city',
      'lorry', 'penny', 'fairy', 'jelly',
      'berry', 'pony'].map(w => textItem(w, 2));
    return round(buckets, assemble(buckets, [addS, addEs, ies]),
      it => `How do you make "${it.text}" plural? Say more than one.`);
  }},

  // 26. theirThereTheyre (L2). Sentences with a blank.
  { id: 'theirThereTheyre', level: 2, make() {
    const buckets = ['their', 'there', "they're"];
    // RUN21H A3: 9 items for a 9-item round meant every round was the whole pool — the child
    // met the same nine sentences for ever. Now 24, and each new sentence was checked so that
    // exactly ONE of the three words fits it.
    const their = ['___ dog is called Max', 'The Boos love ___ little houses', '___ favourite colour is purple',
      'The children lost ___ coats', 'My neighbours painted ___ door blue', 'The birds built ___ nest',
      '___ garden is full of flowers', 'Snaffle borrowed ___ biscuits'].map(t => textItem(t, 0));
    const there = ['Put the box over ___', 'Is anybody ___?', 'We went ___ yesterday',
      '___ is a Boo on the roof!', 'Stay ___ until I call you', 'Look over ___ by the pond',
      '___ were six Boos at the party', 'I left my wellies ___'].map(t => textItem(t, 1));
    const theyre = ['___ late for school!', '___ my best friends', '___ going to love this',
      '___ all having a picnic', '___ hiding behind the tree', '___ not coming today',
      '___ the fastest Boos in town', '___ singing in the Band Room'].map(t => textItem(t, 2));
    return round(buckets, assemble(buckets, [their, there, theyre], 9),
      it => `Which word fills the blank: their, there, or they're?`);
  }},

  // 27. toTooTwo (L1). Sentences with a blank.
  { id: 'toTooTwo', level: 1, make() {
    const buckets = ['to', 'too', 'two'];
    // RUN21H A3: 9 -> 24 items, same one-word-only-fits check on every addition.
    const to = ['We walked ___ the shop', 'Give it ___ me', 'She wants ___ play',
      'Come ___ my party!', 'I go ___ school on the bus', 'Listen ___ the music',
      'We ran ___ the top of the hill', 'Pass the jam ___ Gran'].map(t => textItem(t, 0));
    const too = ['Can I come ___?', "That's ___ funny!", "It's ___ hot today",
      'The bag was ___ heavy to lift', 'I like biscuits ___', 'This song is ___ loud!',
      'Snaffle ate ___ many cakes', 'You can have a turn ___'].map(t => textItem(t, 1));
    const two = ['I have ___ sisters', '___ Boos sat on the wall', '___ plus one is three',
      'She has ___ red wellies', 'Cut the cake into ___ pieces', 'I saw ___ birds on the fence',
      'It takes ___ to play this game', '___ eyes and one nose'].map(t => textItem(t, 2));
    return round(buckets, assemble(buckets, [to, too, two], 9),
      it => `Which word fills the blank: to, too, or two? "two" means the number 2.`);
  }}
];
