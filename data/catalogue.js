// data/catalogue.js
// The full 32-item catalogue: 24 Boos + 8 decorations.
// Each entry: { id, kind, name, rarity, blurb, ... }
// Boos add: species, colors {body, belly?}, acc? (accessory for rares)
// Decorations add: deco (type key used by art.js)
// Drop weights come from rarity tiers (see data-driven roll in rewards.js).
// Content is fixed by spec §10.5; blurbs written here, one playful sentence each.

export const RARITY = {
  common: { label: 'Common', glow: '#8FA3C8' },   // grey-blue
  rare:   { label: 'Rare',   glow: '#35D0BA' },    // teal
  ultra:  { label: 'Ultra',  glow: '#FFC93C' },    // gold
  secret: { label: 'Secret', glow: 'rainbow' }     // rainbow shimmer
};

// Rarity roll weights (percent). Picked first, then uniform within tier.
export const RARITY_WEIGHTS = { common: 60, rare: 30, ultra: 9, secret: 1 };

export const CATALOGUE = [
  // --- Common Boos (12): flat single colour, indigo or lilac ---
  { id: 'boo_inky',   kind: 'boo', name: 'Inky',   rarity: 'common', species: 'bloop', colors: { body: 'indigo' }, blurb: 'Rolls everywhere because round is the only shape it trusts.' },
  { id: 'boo_plum',   kind: 'boo', name: 'Plum',   rarity: 'common', species: 'bloop', colors: { body: 'lilac'  }, blurb: 'Squishy, purple, and absolutely certain it is your favourite.' },
  { id: 'boo_pippin', kind: 'boo', name: 'Pippin', rarity: 'common', species: 'pip',   colors: { body: 'indigo' }, blurb: 'Those ears hear the biscuit tin open from three rooms away.' },
  { id: 'boo_lolly',  kind: 'boo', name: 'Lolly',  rarity: 'common', species: 'pip',   colors: { body: 'lilac'  }, blurb: 'Hops when happy, which is more or less always.' },
  { id: 'boo_chomp',  kind: 'boo', name: 'Chomp',  rarity: 'common', species: 'munch', colors: { body: 'indigo' }, blurb: 'Would nibble the moon if you held it a bit closer.' },
  { id: 'boo_mallow', kind: 'boo', name: 'Mallow', rarity: 'common', species: 'munch', colors: { body: 'lilac'  }, blurb: 'Soft as a marshmallow and twice as cheeky about it.' },
  { id: 'boo_curly',  kind: 'boo', name: 'Curly',  rarity: 'common', species: 'twirl', colors: { body: 'indigo' }, blurb: 'The antenna picks up daydreams and the odd radio station.' },
  { id: 'boo_wisp',   kind: 'boo', name: 'Wisp',   rarity: 'common', species: 'twirl', colors: { body: 'lilac'  }, blurb: 'Floats about a centimetre off the ground when nobody checks.' },
  { id: 'boo_beam',   kind: 'boo', name: 'Beam',   rarity: 'common', species: 'sunny', colors: { body: 'indigo' }, blurb: 'Its eyes are literally little stars, and it knows it.' },
  { id: 'boo_dot',    kind: 'boo', name: 'Dot',    rarity: 'common', species: 'sunny', colors: { body: 'lilac'  }, blurb: 'Small, sparkly, and the boss of every game it plays.' },
  { id: 'boo_fuzz',   kind: 'boo', name: 'Fuzz',   rarity: 'common', species: 'nova',  colors: { body: 'indigo' }, blurb: 'The fluffiest chest in Boo Town, no contest, do not argue.' },
  { id: 'boo_puff',   kind: 'boo', name: 'Puff',   rarity: 'common', species: 'nova',  colors: { body: 'lilac'  }, blurb: 'Curls its swirly tail into a cushion for afternoon naps.' },

  // --- Rare Boos (8): two-tone body + belly, plus a little accessory ---
  { id: 'boo_bubbles', kind: 'boo', name: 'Bubbles', rarity: 'rare', species: 'bloop', colors: { body: 'bubblegum', belly: 'teal'  }, acc: 'bow',    blurb: 'Blows bubbles bigger than its own head, on purpose.' },
  { id: 'boo_minty',   kind: 'boo', name: 'Minty',   rarity: 'rare', species: 'bloop', colors: { body: 'teal',      belly: 'cream' }, acc: 'flower', blurb: 'Smells faintly of toothpaste and very good ideas.' },
  { id: 'boo_skye',    kind: 'boo', name: 'Skye',    rarity: 'rare', species: 'pip',   colors: { body: 'teal',      belly: 'cream' }, acc: 'scarf',  blurb: 'Wears the scarf even indoors, for the drama.' },
  { id: 'boo_candy',   kind: 'boo', name: 'Candy',   rarity: 'rare', species: 'pip',   colors: { body: 'bubblegum', belly: 'cream' }, acc: 'bow',    blurb: 'Sweet enough to give a Boo the giggles.' },
  { id: 'boo_gigi',    kind: 'boo', name: 'Gigi',    rarity: 'rare', species: 'munch', colors: { body: 'bubblegum', belly: 'cream' }, acc: 'glasses',blurb: 'Sees the world through heart-shaped glasses, literally.' },
  { id: 'boo_peppy',   kind: 'boo', name: 'Peppy',   rarity: 'rare', species: 'twirl', colors: { body: 'teal',      belly: 'cream' }, acc: 'cap',    blurb: 'Backwards cap, forwards attitude.' },
  { id: 'boo_sol',     kind: 'boo', name: 'Sol',     rarity: 'rare', species: 'sunny', colors: { body: 'bubblegum', belly: 'cream' }, acc: 'flower', blurb: 'Turns to face you like a tiny, very biased sunflower.' },
  { id: 'boo_comet',   kind: 'boo', name: 'Comet',   rarity: 'rare', species: 'nova',  colors: { body: 'teal',      belly: 'cream' }, acc: 'scarf',  blurb: 'Left a glittery streak the one time it ran. Legendary.' },

  // --- Ultra Boos (3): animated shimmer / twinkle / hue-shift ---
  { id: 'boo_disco',  kind: 'boo', name: 'Disco Sunny', rarity: 'ultra', species: 'sunny', colors: { body: 'gold' },     fx: 'shimmer', blurb: 'Every step is a dance step. The floor is optional.' },
  { id: 'boo_starnova',kind:'boo', name: 'Star Nova',   rarity: 'ultra', species: 'nova',  colors: { body: 'midnight' }, fx: 'twinkle', blurb: 'Carries its own tiny night sky wherever it goes.' },
  { id: 'boo_prism',  kind: 'boo', name: 'Prism',       rarity: 'ultra', species: 'twirl', colors: { body: 'prism' },    fx: 'hue',     blurb: 'Cannot pick a favourite colour, so it wears all of them.' },

  // --- Secret (1): DJ Boo ---
  { id: 'boo_dj', kind: 'boo', name: 'DJ Boo', rarity: 'secret', species: 'munch', colors: { body: 'indigo' }, acc: 'headphones', fx: 'bop', blurb: 'The one, the only, the beat that never stops.' },

  // ================= Wave 2 (EXPANSION_1 §4): two new species + seasonal drops =================
  // Core (all year)
  { id: 'boo_cosmo',   kind: 'boo', name: 'Cosmo',   rarity: 'common', species: 'snug',  colors: { body: 'lilac', hood: 'indigo' }, blurb: 'Dreams in its cosy indigo hood, all year round.' },
  { id: 'boo_flit',    kind: 'boo', name: 'Flit',    rarity: 'common', species: 'zippy', colors: { body: 'lilac', wing: 'sky' },     blurb: 'Never quite lands. Why walk when you can hop?' },
  { id: 'boo_breeze',  kind: 'boo', name: 'Breeze',  rarity: 'rare',   species: 'zippy', colors: { body: 'teal', wing: 'cream' }, acc: 'scarf', blurb: 'Zips about on a warm wind, scarf streaming behind.' },
  { id: 'boo_twiglet', kind: 'boo', name: 'Twiglet', rarity: 'secret', species: 'giraffe', colors: { body: 'sunshine' }, fx: 'leaf', blurb: 'A tiny giraffe friend, forever nibbling a little leaf.' },

  // Summer drop (June–August)
  { id: 'boo_splash',  kind: 'boo', name: 'Splash',  rarity: 'common', season: 'summer', species: 'pip',   colors: { body: 'aqua', belly: 'cream' },   blurb: 'Made entirely of the best bit of the paddling pool.' },
  { id: 'boo_coco',    kind: 'boo', name: 'Coco',    rarity: 'common', season: 'summer', species: 'munch', colors: { body: 'coconut' },                blurb: 'Smells of coconut and sun cream. Perpetually on holiday.' },
  { id: 'boo_sandy',   kind: 'boo', name: 'Sandy',   rarity: 'rare',   season: 'summer', species: 'bloop', colors: { body: 'sand' }, acc: 'shades',    blurb: 'Cool shades, warm sand, not a single care.' },
  { id: 'boo_surfnova',kind: 'boo', name: 'Surf Nova',rarity: 'ultra', season: 'summer', species: 'nova',  colors: { body: 'seablue', belly: 'cream' }, fx: 'shimmer', blurb: 'Rides an endless wave that only it can see.' },

  // Spooky drop (October)
  { id: 'boo_pumpkin', kind: 'boo', name: 'Pumpkin', rarity: 'common', season: 'spooky', species: 'munch', colors: { body: 'orange' },                blurb: 'Grins even wider than a jack-o-lantern. Little stem and all.' },
  { id: 'boo_batty',   kind: 'boo', name: 'Batty',   rarity: 'rare',   season: 'spooky', species: 'zippy', colors: { body: 'indigo', wing: 'midnight' }, blurb: 'Flaps about at dusk, squeaking cheerfully at nothing.' },
  { id: 'boo_boooo',   kind: 'boo', name: 'Boo-oo',  rarity: 'rare',   season: 'spooky', species: 'bloop', colors: { body: 'ghost' }, fx: 'ghost',     blurb: 'A friendly little ghost who has never scared anyone, ever.' },
  { id: 'boo_wanda',   kind: 'boo', name: 'Wanda',   rarity: 'ultra',  season: 'spooky', species: 'twirl', colors: { body: 'lilac' }, acc: 'wizardhat', fx: 'twinkle', blurb: 'Leaves a trail of sparkles wherever her broom goes.' },

  // Winter drop (December–January)
  { id: 'boo_frosty',  kind: 'boo', name: 'Frosty',  rarity: 'common', season: 'winter', species: 'pip',   colors: { body: 'iceblue', belly: 'cream' }, blurb: 'Cool to the touch and delighted about it. Cold nose, warm heart.' },
  { id: 'boo_cocoa',   kind: 'boo', name: 'Cocoa',   rarity: 'common', season: 'winter', species: 'snug',  colors: { body: 'brown', hood: 'cream' },    blurb: 'Basically a mug of hot chocolate that learned to hop.' },
  { id: 'boo_jingle',  kind: 'boo', name: 'Jingle',  rarity: 'rare',   season: 'winter', species: 'snug',  colors: { body: 'cream', hood: 'red' },      blurb: 'Wears a little bell that jingles when you say hello.' },
  { id: 'boo_aurora',  kind: 'boo', name: 'Aurora',  rarity: 'ultra',  season: 'winter', species: 'nova',  colors: { body: 'teal', belly: 'lilac' }, fx: 'hue', blurb: 'Shimmers green and violet like the northern lights themselves.' },

  // --- Decorations (8): 1 plot each ---
  { id: 'deco_boohouse', kind: 'deco', name: 'Boo House',   rarity: 'common', deco: 'boohouse', blurb: 'A cosy little home with a round door, just Boo-sized.' },
  { id: 'deco_tree',     kind: 'deco', name: 'Bubble Tree', rarity: 'common', deco: 'tree',     blurb: 'Grows bubbles instead of leaves. Nobody knows why.' },
  { id: 'deco_toadstool',kind: 'deco', name: 'Toadstool',   rarity: 'common', deco: 'toadstool',blurb: 'A spotty red umbrella for when it rains sparkles.' },
  { id: 'deco_pond',     kind: 'deco', name: 'Little Pond',  rarity: 'common', deco: 'pond',     blurb: 'Two ripples and a lily pad. Very relaxing to stare at.' },
  { id: 'deco_lamp',     kind: 'deco', name: 'Fairy Lamp',   rarity: 'rare',   deco: 'lamp',   fx: 'glow', blurb: 'Glows warm and gold so no Boo is ever scared of the dark.' },
  { id: 'deco_flowers',  kind: 'deco', name: 'Flower Patch', rarity: 'rare',   deco: 'flowers',  blurb: 'A splash of petals that the Boos are strictly not allowed to eat.' },
  { id: 'deco_bench',    kind: 'deco', name: 'Cosy Bench',   rarity: 'rare',   deco: 'bench',    blurb: 'Seats two Boos, or one very spread-out Boo.' },
  { id: 'deco_stage',    kind: 'deco', name: 'Dance Stage',  rarity: 'ultra',  deco: 'stage',  fx: 'stage', blurb: 'Any Boo nearby simply must bop. Those are the rules.' },

  // --- Wave 2 decorations (EXPANSION_1 §4) ---
  { id: 'deco_sandcastle', kind: 'deco', name: 'Sandcastle',     rarity: 'common', season: 'summer', deco: 'sandcastle', blurb: 'Three turrets and a shell. Built to last until teatime.' },
  { id: 'deco_spookytree', kind: 'deco', name: 'Spooky Tree',    rarity: 'rare',   season: 'spooky', deco: 'spookytree', blurb: 'Bare, twisty and secretly very friendly.' },
  { id: 'deco_snowboo',    kind: 'deco', name: 'Snow Boo statue',rarity: 'rare',   season: 'winter', deco: 'snowboo',    blurb: 'A Boo built of snow, with a carrot nose, naturally.' },
  { id: 'deco_fountain',   kind: 'deco', name: 'Star Fountain',  rarity: 'ultra',  deco: 'fountain', fx: 'glow', blurb: 'Bubbles up gentle sparkles instead of water.' },

  // --- Accessories (10, RUN2 part D): kind 'accessory', art key + rarity ---
  // Wearable on any Boo (one slot each) and on the player's own character.
  { id: 'acc_bow',          kind: 'accessory', name: 'Purple Bow',     rarity: 'common', art: 'bow',          blurb: 'A big satin bow in the most excellent shade of purple.' },
  { id: 'acc_sunhat',       kind: 'accessory', name: 'Sun Hat',        rarity: 'common', art: 'sunhat',       blurb: 'Wide brim, tiny flower, maximum holiday energy.' },
  { id: 'acc_shades',       kind: 'accessory', name: 'Star Sunglasses',rarity: 'common', art: 'shades',       blurb: 'Star-shaped shades for a Boo who is going places.' },
  { id: 'acc_scarf',        kind: 'accessory', name: 'Cosy Scarf',     rarity: 'common', art: 'scarf',        blurb: 'Knitted with love and just a little bit of magic.' },
  { id: 'acc_flowercrown',  kind: 'accessory', name: 'Flower Crown',   rarity: 'rare',   art: 'flowercrown',  blurb: 'A ring of little blooms for a woodland royal.' },
  { id: 'acc_heartglasses', kind: 'accessory', name: 'Heart Glasses',  rarity: 'rare',   art: 'heartglasses', blurb: 'Everything looks lovelier through heart-shaped lenses.' },
  { id: 'acc_wizardhat',    kind: 'accessory', name: 'Wizard Hat',     rarity: 'rare',   art: 'wizardhat',    blurb: 'Pointy, starry, and possibly a bit enchanted.' },
  { id: 'acc_goldcrown',    kind: 'accessory', name: 'Golden Crown',   rarity: 'ultra',  art: 'goldcrown',    blurb: 'Solid gold, extremely shiny, absolutely deserved.' },
  { id: 'acc_cape',         kind: 'accessory', name: 'Sparkle Cape',   rarity: 'ultra',  art: 'cape',    fx: 'shimmer', blurb: 'Swishes dramatically even when there is no wind.' },
  { id: 'acc_djheadphones', kind: 'accessory', name: 'DJ Headphones',  rarity: 'rare',   art: 'djheadphones', blurb: 'Drop the beat! (DJ Boo already has a pair, thanks.)' }
];

// Convenience lookups.
export const BY_ID = Object.fromEntries(CATALOGUE.map(it => [it.id, it]));

// Collectibles (Boos + decorations) fill the collection grid + "found X of N" counter.
// Accessories are a separate wardrobe (equipped, not counted here).
export const COLLECTIBLES = CATALOGUE.filter(it => it.kind !== 'accessory');
export const ACCESSORIES  = CATALOGUE.filter(it => it.kind === 'accessory');

// Grouped by kind then rarity for the type-first drop roll (RUN2 C2).
export const BY_TYPE_RARITY = CATALOGUE.reduce((m, it) => {
  ((m[it.kind] ||= {})[it.rarity] ||= []).push(it);
  return m;
}, {});

// Legacy: all items by rarity (kept for compatibility; drops use BY_TYPE_RARITY).
export const BY_RARITY = CATALOGUE.reduce((m, it) => {
  (m[it.rarity] ||= []).push(it);
  return m;
}, {});

export const TOTAL_ITEMS = COLLECTIBLES.length; // 32 (boos + decorations)
