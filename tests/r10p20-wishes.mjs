// RUN10 P20 — fixed Wish Well lexicon and the town-build item bridge.
import { WISHES, wishId, wishItem, unlockedWishItems } from '../data/wishes.js';
import { nearest } from '../js/wishwell.js';
import { resolveItem } from '../js/customs.js';

let failed = false;
const assert = (v, m) => { console.log((v ? '✓' : 'FAIL:'), m); if (!v) failed = true; };

assert(WISHES.length === 60, 'the fixed Wish lexicon contains exactly 60 words');
assert(WISHES.every(word => word.length >= 3 && word.length <= 9) && WISHES.filter(word => word.length === 9).join(',') === 'butterfly', 'all fixed wishes fit the tray, including the packet’s explicit butterfly exception');
assert(nearest('moom') === 'moon', 'nearest-word helper finds a friendly copy prompt');
let fuzzSafe = true;
for (let i = 0; i < 200; i++) {
  const word = Array.from({ length: 6 }, () => String.fromCharCode(97 + Math.random() * 26 | 0)).join('');
  fuzzSafe = fuzzSafe && typeof nearest(word) === 'string';
}
assert(fuzzSafe, '200 arbitrary non-lexicon inputs receive safe nearest-word responses');
for (const word of WISHES) {
  const item = wishItem(word);
  assert(item && item.id === wishId(word) && item.kind === 'wish', `${word} has a synthetic placeable wish item`);
  assert(resolveItem(wishId(word))?.word === word, `${word} resolves through the town renderer`);
}
assert(unlockedWishItems({ fish: true, moon: true }).map(x => x.word).join(',') === 'moon,fish', 'only cast wishes are surfaced for the Build drawer');
assert(wishItem('wish:not-a-word') === null, 'unknown wish ids cannot become placeable items');
console.log('RESULT: ' + (failed ? 'FAIL' : 'PASS'));
process.exit(failed ? 1 : 0);
