// data/wishes.js — the fixed Wish Well lexicon (RUN10 P20).
// Wishes are intentionally data, not user-entered names: a child can discover every
// one through letter play, while the save stores only the words they have unlocked.

export const WISHES = `sun star moon cloud rainbow snowman rocket robot crown cake balloon drum boat kite castle flower tree palm mushroom butterfly bee fish whale crab duck frog owl snake lion zebra apple pizza banana carrot cheese egg cookie teapot hat wand torch lamp bell book ball sock boot umbrella ladder bench swing slide tent campfire guitar trophy medal map key present`.split(' ');

export const wishId = (word) => `wish:${String(word || '').toLowerCase()}`;

const ICON = {
  fish: '🐟', butterfly: '🦋', frog: '🐸', rocket: '🚀', robot: '🤖', crown: '👑',
  cake: '🎂', balloon: '🎈', drum: '🥁', boat: '⛵', kite: '🪁', castle: '🏰',
  flower: '🌼', tree: '🌳', palm: '🌴', mushroom: '🍄', bee: '🐝', whale: '🐳',
  crab: '🦀', duck: '🦆', owl: '🦉', snake: '🐍', lion: '🦁', zebra: '🦓',
  apple: '🍎', pizza: '🍕', carrot: '🥕', cheese: '🧀', egg: '🥚', cookie: '🍪',
  teapot: '🫖', hat: '🎩', wand: '🪄', torch: '🔦', lamp: '💡', bell: '🔔',
  book: '📕', ball: '⚽', sock: '🧦', boot: '🥾', umbrella: '☂️', ladder: '🪜',
  bench: '🪑', swing: '🎠', slide: '🛝', tent: '⛺', campfire: '🔥', guitar: '🎸',
  trophy: '🏆', medal: '🏅', map: '🗺️', key: '🔑', present: '🎁', sun: '☀️',
  star: '⭐', moon: '🌙', cloud: '☁️', rainbow: '🌈', snowman: '⛄'
};

// Synthetic catalogue item for a wish. It never enters box/reward rolls: it is only
// resolvable once the matching word has been cast at the Well.
export function wishItem(idOrWord) {
  const word = String(idOrWord || '').replace(/^wish:/, '').toLowerCase();
  if (!WISHES.includes(word)) return null;
  return {
    id: wishId(word), kind: 'wish', name: word[0].toUpperCase() + word.slice(1),
    rarity: 'wish', deco: 'wish', icon: ICON[word] || '✨', word,
    blurb: `A little ${word} wish, pulled sparkling from the Wish Well.`
  };
}

export function unlockedWishItems(wishes = {}) {
  return WISHES.filter(word => wishes[word]).map(wishItem);
}
