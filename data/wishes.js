// RUN10 P20 — the complete, deliberately bounded Wish Well lexicon.
export const WISH_WORDS = [
  'sun','star','moon','cloud','rainbow','snowman','rocket','robot','crown','cake',
  'balloon','drum','boat','kite','castle','flower','tree','palm','mushroom','butterfly',
  'bee','fish','whale','crab','duck','frog','owl','snake','lion','zebra',
  'apple','pizza','banana','carrot','cheese','egg','cookie','teapot','hat','wand',
  'torch','lamp','bell','book','ball','sock','boot','umbrella','ladder','bench',
  'swing','slide','tent','campfire','guitar','trophy','medal','map','key','present'
];

export const WISH_ICONS = {
  sun:'☀️',star:'⭐',moon:'🌙',cloud:'☁️',rainbow:'🌈',snowman:'⛄',rocket:'🚀',robot:'🤖',crown:'👑',cake:'🎂',
  balloon:'🎈',drum:'🥁',boat:'⛵',kite:'🪁',castle:'🏰',flower:'🌸',tree:'🌳',palm:'🌴',mushroom:'🍄',butterfly:'🦋',
  bee:'🐝',fish:'🐟',whale:'🐳',crab:'🦀',duck:'🦆',frog:'🐸',owl:'🦉',snake:'🐍',lion:'🦁',zebra:'🦓',
  apple:'🍎',pizza:'🍕',banana:'🍌',carrot:'🥕',cheese:'🧀',egg:'🥚',cookie:'🍪',teapot:'🫖',hat:'🎩',wand:'🪄',
  torch:'🔦',lamp:'🪔',bell:'🔔',book:'📕',ball:'⚽',sock:'🧦',boot:'🥾',umbrella:'☂️',ladder:'🪜',bench:'🪵',
  swing:'🪢',slide:'🛝',tent:'⛺',campfire:'🔥',guitar:'🎸',trophy:'🏆',medal:'🏅',map:'🗺️',key:'🔑',present:'🎁'
};

export const SHORT_WISHES = WISH_WORDS.filter(word => word.length <= 4);
export const LIVING_WISHES = ['butterfly', 'fish', 'frog'];
export const wishId = word => `wish_${word}`;
export function wordFromWishId(id) { return String(id || '').startsWith('wish_') ? String(id).slice(5) : ''; }
export function wishItem(wordOrId) {
  const word = String(wordOrId || '').startsWith('wish_') ? wordFromWishId(wordOrId) : String(wordOrId || '').toLowerCase();
  if (!WISH_WORDS.includes(word)) return null;
  return { id: wishId(word), kind:'wish', name: word[0].toUpperCase() + word.slice(1), word, icon:WISH_ICONS[word], rarity:'wish', blurb:`A ${word} wished into Boo Town.` };
}

export function levenshtein(a, b) {
  a = String(a || '').toLowerCase(); b = String(b || '').toLowerCase();
  const row = Array.from({ length:b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0]; row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const old = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = old;
    }
  }
  return row[b.length];
}

export function nearestWish(input) {
  const value = String(input || '').toLowerCase();
  const ranked = WISH_WORDS.map(word => ({ word, distance:levenshtein(value, word), prefix:commonPrefix(value, word) }))
    .sort((a, b) => a.distance - b.distance || b.prefix - a.prefix || a.word.localeCompare(b.word));
  const within = ranked.find(row => row.distance <= 2);
  return (within || ranked.sort((a, b) => b.prefix - a.prefix || a.distance - b.distance)[0]).word;
}
function commonPrefix(a, b) {
  let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++;
  return i;
}
