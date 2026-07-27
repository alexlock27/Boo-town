// data/jokes.js — the Joke Boo's 120 jokes (RUN17 X1).
//
// EVERY joke here is AUTHORED in CONTENT_JOKES.md and transcribed EXACTLY — the literals
// below were generated mechanically from that pack, not retyped, so no apostrophe, dash or
// capital has drifted. Nothing in this file was written by the implementer: no
// substitutions, no "improvements", no extras. (CLAUDE.md: authored content ships as
// written.) To change a joke, change CONTENT_JOKES.md and re-transcribe.
// tests/r17x1-jokes.mjs re-parses the pack and diffs it against this file, so a drift
// between the two is a FAILING TEST rather than something a reader has to notice.
//
// Shape:
//   animal / silly / boo : { type, setup, punchline, simple? }
//   knock                : { type:'knock', name, response, simple?, interrupt? }
//
// The knock-knock four-line exchange (CONTENT_JOKES.md lines 19-23) is rendered by
// js/jokeboo.js as a tapped rhythm:
//   Boo "Knock knock!" -> tap -> child "Who's there?" -> tap
//   Boo "{name}."      -> tap -> child "{name} who?"  -> tap
//   Boo "{response}"   -> rimshot
// `interrupt:true` (#4, Interrupting Boo) fires its punchline EARLY, over the child's
// "{name} who?" line — that early beat IS the joke, so it lives in the data rather than as
// a special case buried in the view.
//
// TODDLER-FRIENDLY SUBSET (`simple: true`) — exactly the list at the top of the pack:
//   knock 3 · animal 1, 3, 24 · silly 3, 6, 12, 18, 19, 20 · boo 2, 4, 5
// The Toddler tier's Joke Boo draws ONLY from these, fully spoken.

export const JOKE_TYPES = [
  { key: 'knock',  name: 'Knock Knock',     icon: '🚪', blurb: 'Knock knock! Who’s there?' },
  { key: 'animal', name: 'Animal Jokes',    icon: '🐘', blurb: 'Creatures being silly.' },
  { key: 'silly',  name: 'Silly Questions', icon: '🤪', blurb: 'Daft questions, dafter answers.' },
  { key: 'boo',    name: 'Boo Jokes',       icon: '👻', blurb: 'Jokes from Boo Town itself.' }
];

// ---- TYPE: knock (30) ----------------------------------------------------------------
export const KNOCK = [
  { type: 'knock', name: 'Lettuce',          response: 'Lettuce in, it\'s freezing out here!' },
  { type: 'knock', name: 'Boo',              response: 'Don\'t cry! It\'s only me.' },
  { type: 'knock', name: 'Cows go',          response: 'No they don\'t — cows go MOO!', simple: true },
  { type: 'knock', name: 'Interrupting Boo', response: 'BOO!', interrupt: true },
  { type: 'knock', name: 'Doughnut',         response: 'Doughnut ask me, it\'s a secret!' },
  { type: 'knock', name: 'Wanda',            response: 'Wanda come outside and play?' },
  { type: 'knock', name: 'Olive',            response: 'Olive right next door to you!' },
  { type: 'knock', name: 'Alpaca',           response: 'Alpaca the picnic, you fetch the blanket!' },
  { type: 'knock', name: 'Ice cream',        response: 'Ice cream if you don\'t let me in!' },
  { type: 'knock', name: 'Norma Lee',        response: 'Norma Lee I\'d ring the bell, but it\'s broken.' },
  { type: 'knock', name: 'Adore',            response: 'Adore is between us. Open it!' },
  { type: 'knock', name: 'Beets',            response: 'Beets me! I\'ve forgotten why I knocked.' },
  { type: 'knock', name: 'Justin',           response: 'Justin time for tea!' },
  { type: 'knock', name: 'Tank',             response: 'You\'re welcome.' },
  { type: 'knock', name: 'Howl',             response: 'Howl you know it\'s me if you don\'t open up?' },
  { type: 'knock', name: 'Kanga',            response: 'Actually, it\'s kanga-ROO.' },
  { type: 'knock', name: 'Butter',           response: 'Butter let me in, it\'s tipping down!' },
  { type: 'knock', name: 'Egg',              response: 'Egg-cited to see you!' },
  { type: 'knock', name: 'Iva',              response: 'Iva sore hand from all this knocking!' },
  { type: 'knock', name: 'Owls',             response: 'Owls say "who". You\'re doing it right!' },
  { type: 'knock', name: 'Water',            response: 'Water you doing in there? I\'ve been ages!' },
  { type: 'knock', name: 'Cargo',            response: 'Cargo BEEP BEEP!' },
  { type: 'knock', name: 'Hatch',            response: 'Bless you!' },
  { type: 'knock', name: 'Yukon',            response: 'Yukon say that again!' },
  { type: 'knock', name: 'Pudding',          response: 'Pudding your wellies on? It\'s ever so muddy.' },
  { type: 'knock', name: 'Snow',             response: 'Snow use — I\'ve forgotten my name again.' },
  { type: 'knock', name: 'Figs',             response: 'Figs the doorbell, it\'s been broken for weeks!' },
  { type: 'knock', name: 'Wooden shoe',      response: 'Wooden shoe like to hear another one?' },
  { type: 'knock', name: 'Spell',            response: 'W-H-O. There you go.' },
  { type: 'knock', name: 'Boo again',        response: 'Aw, don\'t cry. It\'s still only me.' }
];

// ---- TYPE: animal (30) ---------------------------------------------------------------
export const ANIMAL = [
  { type: 'animal', setup: 'What do you call a sleeping dinosaur?', punchline: 'A dino-snore!', simple: true },
  { type: 'animal', setup: 'Why don\'t elephants use computers?', punchline: 'They\'re frightened of the mouse!' },
  { type: 'animal', setup: 'What do you call a bear with no teeth?', punchline: 'A gummy bear!', simple: true },
  { type: 'animal', setup: 'Why did the chicken join a band?', punchline: 'Because it had the drumsticks!' },
  { type: 'animal', setup: 'What do you call a fish with no eyes?', punchline: 'A fsh!' },
  { type: 'animal', setup: 'Why don\'t snakes need a ruler?', punchline: 'They\'ve got their own scales!' },
  { type: 'animal', setup: 'What do you get if you cross a sheep and a kangaroo?', punchline: 'A woolly jumper!' },
  { type: 'animal', setup: 'Why was the cat sitting on the laptop?', punchline: 'To keep an eye on the mouse!' },
  { type: 'animal', setup: 'Why do cows wear bells?', punchline: 'Because their horns don\'t work!' },
  { type: 'animal', setup: 'What do you call a pig that does karate?', punchline: 'A pork chop!' },
  { type: 'animal', setup: 'What\'s a cat\'s favourite pudding?', punchline: 'Mice cream!' },
  { type: 'animal', setup: 'Why don\'t leopards ever win at hide and seek?', punchline: 'Because they\'re always spotted!' },
  { type: 'animal', setup: 'What do you call an alligator in a waistcoat?', punchline: 'An investi-gator!' },
  { type: 'animal', setup: 'Why did the frog take the bus?', punchline: 'Because his car got toad away!' },
  { type: 'animal', setup: 'What do you call a dog that does magic?', punchline: 'A labracadabrador!' },
  { type: 'animal', setup: 'Why are fish so clever?', punchline: 'They spend all day in schools!' },
  { type: 'animal', setup: 'Why did the owl invite everyone round?', punchline: 'He didn\'t want to be owl on his own!' },
  { type: 'animal', setup: 'What do you get if you cross a snowman and a dog?', punchline: 'Frostbite!' },
  { type: 'animal', setup: 'Why did the bee get married?', punchline: 'Because he found his honey!' },
  { type: 'animal', setup: 'What do you call a snail on a ship?', punchline: 'A snailor!' },
  { type: 'animal', setup: 'Why don\'t crabs ever share?', punchline: 'Because they\'re shellfish!' },
  { type: 'animal', setup: 'What do you call a hen that counts her eggs?', punchline: 'A mathemachicken!' },
  { type: 'animal', setup: 'Why did the horse eat with its mouth open?', punchline: 'Terrible stable manners!' },
  { type: 'animal', setup: 'What do you call a cow on a trampoline?', punchline: 'A milkshake!', simple: true },
  { type: 'animal', setup: 'Why did the sheep get sent off?', punchline: 'For being a baaa-d sport!' },
  { type: 'animal', setup: 'What\'s a penguin\'s favourite auntie?', punchline: 'Aunt Arctica!' },
  { type: 'animal', setup: 'What do you call a dinosaur who knows loads of words?', punchline: 'A thesaurus!' },
  { type: 'animal', setup: 'Why did the badger bring a torch?', punchline: 'It fancied a night out!' },
  { type: 'animal', setup: 'How do hedgehogs hug?', punchline: 'Very, very carefully!' },
  { type: 'animal', setup: 'Why did the duck get told off?', punchline: 'For quacking too many jokes!' }
];

// ---- TYPE: silly (30) ----------------------------------------------------------------
export const SILLY = [
  { type: 'silly', setup: 'Why did the biscuit go to the doctor?', punchline: 'It was feeling a bit crumby!' },
  { type: 'silly', setup: 'Why did the maths book look so glum?', punchline: 'It had far too many problems.' },
  { type: 'silly', setup: 'What\'s orange and sounds like a parrot?', punchline: 'A carrot!', simple: true },
  { type: 'silly', setup: 'What do you call a boomerang that doesn\'t come back?', punchline: 'A stick.' },
  { type: 'silly', setup: 'Why did the scarecrow win a prize?', punchline: 'He was outstanding in his field!' },
  { type: 'silly', setup: 'What\'s brown and sticky?', punchline: 'A stick!', simple: true },
  { type: 'silly', setup: 'Why did the banana go to hospital?', punchline: 'It wasn\'t peeling well.' },
  { type: 'silly', setup: 'What do you call a bear caught in the drizzle?', punchline: 'A drizzly bear!' },
  { type: 'silly', setup: 'Why did the bicycle need a lie down?', punchline: 'It was two-tyred!' },
  { type: 'silly', setup: 'What did the big flower say to the little flower?', punchline: 'Hiya, bud!' },
  { type: 'silly', setup: 'Why was the broom late?', punchline: 'It over-swept.' },
  { type: 'silly', setup: 'What kind of tree fits in your hand?', punchline: 'A palm tree!', simple: true },
  { type: 'silly', setup: 'What did one wall say to the other?', punchline: 'I\'ll meet you at the corner!' },
  { type: 'silly', setup: 'Why did the tomato go red?', punchline: 'Because it saw the salad dressing!' },
  { type: 'silly', setup: 'What do you call a train full of bubblegum?', punchline: 'A chew-chew train!' },
  { type: 'silly', setup: 'Why did the pencil get a medal?', punchline: 'It was extremely sharp.' },
  { type: 'silly', setup: 'Why did the belt get arrested?', punchline: 'For holding up a pair of trousers!' },
  { type: 'silly', setup: 'What has hands but never claps?', punchline: 'A clock!', simple: true },
  { type: 'silly', setup: 'What do you call a snowman in July?', punchline: 'A puddle.', simple: true },
  { type: 'silly', setup: 'What\'s the best day to go to the beach?', punchline: 'SUN-day!', simple: true },
  { type: 'silly', setup: 'Why did the teddy say no to pudding?', punchline: 'Because it was already stuffed!' },
  { type: 'silly', setup: 'What did the traffic light say to the car?', punchline: 'Don\'t look — I\'m changing!' },
  { type: 'silly', setup: 'Why did the golfer take two pairs of trousers?', punchline: 'In case he got a hole in one!' },
  { type: 'silly', setup: 'What\'s a ghost\'s favourite pudding?', punchline: 'I scream!' },
  { type: 'silly', setup: 'Why did the book join the police?', punchline: 'It wanted to go undercover.' },
  { type: 'silly', setup: 'What do you call a dinosaur who crashes his car?', punchline: 'Tyrannosaurus wrecks!' },
  { type: 'silly', setup: 'What\'s the tallest building in town?', punchline: 'The library — it\'s got the most storeys!' },
  { type: 'silly', setup: 'Why did the jumper go to school?', punchline: 'To get a bit brighter!' },
  { type: 'silly', setup: 'What goes up when the rain comes down?', punchline: 'An umbrella!' },
  { type: 'silly', setup: 'Why did the sock go to the party on its own?', punchline: 'It had lost its sole mate!' }
];

// ---- TYPE: boo (30) ------------------------------------------------------------------
export const BOO = [
  { type: 'boo', setup: 'Why did the Boo bring a ladder to the Meadow?', punchline: 'To reach the high notes!' },
  { type: 'boo', setup: 'What\'s a Boo\'s favourite pudding?', punchline: 'A Boo-nana split!', simple: true },
  { type: 'boo', setup: 'Why did the Boo sit on the clock?', punchline: 'It wanted to be on time!' },
  { type: 'boo', setup: 'How do Boos say hello?', punchline: 'With a wave and a wobble!', simple: true },
  { type: 'boo', setup: 'What do you call a Boo who won\'t stop dancing?', punchline: 'A boogie!', simple: true },
  { type: 'boo', setup: 'Why did the Boo take a jumper to the funfair?', punchline: 'It gets chilly up on the big wheel!' },
  { type: 'boo', setup: 'What\'s a Boo\'s favourite spot at school?', punchline: 'The Boo-k corner!' },
  { type: 'boo', setup: 'Why did the Boo bring a torch to the Disco?', punchline: 'It heard there was a light show.' },
  { type: 'boo', setup: 'What do you call a Boo in a smart hat?', punchline: 'Very well dressed!' },
  { type: 'boo', setup: 'Why won\'t the Boo play hide and seek?', punchline: 'It always gets spotted!' },
  { type: 'boo', setup: 'What did the Boo say when it won a star?', punchline: 'That\'s stellar!' },
  { type: 'boo', setup: 'Why was the Boo sitting by the pond?', punchline: 'Fishing for compliments.' },
  { type: 'boo', setup: 'What\'s a Boo\'s favourite biscuit?', punchline: 'A Jammie Boo-dger!' },
  { type: 'boo', setup: 'Why did the Boo go to bed early?', punchline: 'It was feeling a bit wobbly.' },
  { type: 'boo', setup: 'What do you call a Boo who tells jokes?', punchline: 'A comedi-Boo!' },
  { type: 'boo', setup: 'Why did the Boo take a spoon to the Band Room?', punchline: 'To stir up a tune!' },
  { type: 'boo', setup: 'How does a Boo answer the phone?', punchline: 'Boo-llo?' },
  { type: 'boo', setup: 'Why did the Boo win the race?', punchline: 'Because it was on a roll!' },
  { type: 'boo', setup: 'What did the Boo say to the sleepy Boo?', punchline: 'Wake up and smell the flowers!' },
  { type: 'boo', setup: 'Why do Boos love the beach?', punchline: 'Because it\'s shore to be fun!' },
  { type: 'boo', setup: 'Why did the Boo go into the kitchen?', punchline: 'It fancied a Boo-scuit.' },
  { type: 'boo', setup: 'Why did the Boo take a map on the Expedition?', punchline: 'It didn\'t want to lose its way — or its friends!' },
  { type: 'boo', setup: 'What do you call an extremely tidy Boo?', punchline: 'Spick and span-tastic!' },
  { type: 'boo', setup: 'Why was the Boo laughing in the garden?', punchline: 'The flowers were having a bloom-ing good time.' },
  { type: 'boo', setup: 'What did one Boo say to the other on the seesaw?', punchline: 'Let\'s take turns going up in the world!' },
  { type: 'boo', setup: 'Why did the Boo join the band?', punchline: 'It had really good vibes.' },
  { type: 'boo', setup: 'What\'s a Boo\'s favourite weather?', punchline: 'Partly cloudy, with a chance of sparkles.' },
  { type: 'boo', setup: 'Why did the Boo stand very still in the town?', punchline: 'It was making a good impression.' },
  { type: 'boo', setup: 'Why did Snaffle swap all the signposts?', punchline: 'He wanted to point everyone in a NEW direction!' },
  { type: 'boo', setup: 'What did the Boo say at the end of the joke book?', punchline: 'That\'s all, folks — I\'m all jokes out!' }
];

export const JOKES_BY_TYPE = { knock: KNOCK, animal: ANIMAL, silly: SILLY, boo: BOO };
export const JOKES = [...KNOCK, ...ANIMAL, ...SILLY, ...BOO];

// A stable identity per joke, used by the Journal favourites and the no-repeat cycle.
// Indexed within its own type, so adding to one type never renumbers another.
export function jokeId(joke) {
  const list = JOKES_BY_TYPE[joke && joke.type] || [];
  const i = list.indexOf(joke);
  return i < 0 ? '' : joke.type + ':' + (i + 1);
}
export function jokeById(id) {
  const [type, n] = String(id || '').split(':');
  const list = JOKES_BY_TYPE[type];
  return (list && list[Number(n) - 1]) || null;
}

// The one-line label a favourited joke wears in the Journal.
export function jokeTitle(joke) {
  if (!joke) return '';
  return joke.type === 'knock' ? 'Knock knock — ' + joke.name : joke.setup;
}

// ---- the no-repeat draw ---------------------------------------------------------------
// A joke never repeats until its type's whole pool has been told (X1: "Jokes never repeat
// until the pool for that type cycles"). A shuffled bag per cycle, held in memory only — a
// joke book is for enjoying, not for tracking, so nothing about what she heard is saved.
export function createJokeBag(pool) {
  const source = pool || [];
  let bag = [];
  function refill() {
    bag = source.slice();
    for (let i = bag.length - 1; i > 0; i--) {
      const j = (Math.random() * (i + 1)) | 0;
      [bag[i], bag[j]] = [bag[j], bag[i]];
    }
  }
  return {
    draw() {
      if (!source.length) return null;
      if (!bag.length) refill();
      return bag.pop();
    },
    remaining: () => bag.length,
    size: source.length
  };
}

// The pool a given tier draws from. Toddler draws ONLY from the authored simple subset.
export function poolFor(type, tier) {
  const all = JOKES_BY_TYPE[type] || [];
  return tier === 'toddler' ? all.filter(j => j.simple) : all;
}
