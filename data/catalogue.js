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

  // --- Activity items (RUN4 C5): decorations with a Boo behaviour each ---
  { id: 'deco_slide',      kind: 'deco', name: 'Slide',          rarity: 'common', deco: 'slide',      act: 'slide',      blurb: 'Climb up, whoosh down, run round, repeat forever.' },
  { id: 'deco_swings',     kind: 'deco', name: 'Swings',         rarity: 'common', deco: 'swings',     act: 'swing',      blurb: 'Gentle swinging for Boos who like the wind in their ears.' },
  { id: 'deco_seesaw',     kind: 'deco', name: 'Seesaw',         rarity: 'rare',   deco: 'seesaw',     act: 'seesaw',     blurb: 'Needs two Boos and a total disregard for sitting still.' },
  { id: 'deco_paddlepool', kind: 'deco', name: 'Paddling Pool',  rarity: 'rare',   deco: 'paddlepool', act: 'paddle',     blurb: 'Shallow, splashy, and somehow always the perfect temperature.' },
  { id: 'deco_picnic',     kind: 'deco', name: 'Picnic Blanket', rarity: 'rare',   deco: 'picnic',     act: 'picnic',     blurb: 'Sandwiches, berries, and two very nibbly Boos.' },
  { id: 'deco_trampoline', kind: 'deco', name: 'Trampoline',     rarity: 'rare',   deco: 'trampoline', act: 'bounce',     blurb: 'Boing. Boing. BOING. The favourite word of every Boo.' },
  { id: 'deco_bumper',     kind: 'deco', name: 'Bumper Car',     rarity: 'rare',   deco: 'bumper',     act: 'drive',      blurb: 'One little car, one very serious Boo driver.' },
  { id: 'deco_campfire',   kind: 'deco', name: 'Campfire',       rarity: 'ultra',  deco: 'campfire',   act: 'campfire', fx: 'glow', blurb: 'At night the Boos gather round to warm their paws.' },

  // --- Landscape items (RUN10 P3): Build-mode scenery, never a box drop, always
  // available in the toybox (kind:'landscape' is excluded from BY_TYPE_RARITY in
  // rewards.js AND carries free:true for defence-in-depth — see the guard test).
  { id: 'deco_palm',       kind: 'landscape', name: 'Palm Tree',  rarity: 'common', deco: 'palm',       free: true, blurb: 'Leans just enough to look relaxed about it.' },
  { id: 'deco_oak',        kind: 'landscape', name: 'Oak Tree',   rarity: 'common', deco: 'oak',        free: true, blurb: 'Wide, round and made for leaning against.' },
  { id: 'deco_pine',       kind: 'landscape', name: 'Pine Tree',  rarity: 'common', deco: 'pine',       free: true, blurb: 'Tall, pointy, smells like every good campfire.' },
  { id: 'deco_bush',       kind: 'landscape', name: 'Bush',       rarity: 'common', deco: 'bush',       free: true, blurb: 'A friendly green puff, perfect for hide-and-seek.' },
  { id: 'deco_rock',       kind: 'landscape', name: 'Rock',       rarity: 'common', deco: 'rock',       free: true, blurb: 'Solid, mossy, an excellent place to sit and think.' },
  { id: 'deco_flowerbed',  kind: 'landscape', name: 'Flowerbed',  rarity: 'common', deco: 'flowerbed',  free: true, blurb: 'A tidy row of blooms, strictly not for eating.' },
  { id: 'deco_wishwell',   kind: 'landscape', name: 'Wish Well',  rarity: 'rare',   deco: 'wishwell',   free: true, blurb: 'Spell a wish and watch the well make it real.' },

  // --- Furniture (8, RUN10 P4): kind:'furniture', indoor-only, joins box pools at
  // decoration odds (bucketed under 'deco' in BY_TYPE_RARITY below, not a separate type
  // roll). `wall:true` hangs in the interior scene's wall band; everything else stands
  // on the floor. The Boo House starts with rug+lamp pre-placed.
  { id: 'deco_bed',       kind: 'furniture', name: 'Cosy Bed',      rarity: 'common', deco: 'bed',       blurb: 'Plump pillow, softest blanket, prime napping real estate.' },
  { id: 'deco_rug',       kind: 'furniture', name: 'Round Rug',     rarity: 'common', deco: 'rug',       blurb: 'Ties the whole room together, or so the Boos insist.' },
  { id: 'deco_table',     kind: 'furniture', name: 'Little Table',  rarity: 'common', deco: 'table',     blurb: 'Just the right height for tea and important meetings.' },
  { id: 'deco_sofa',      kind: 'furniture', name: 'Squashy Sofa',  rarity: 'rare',   deco: 'sofa',      blurb: 'Three cushions, infinite Boos somehow fit on it anyway.' },
  { id: 'deco_tablelamp', kind: 'furniture', name: 'Table Lamp',    rarity: 'rare',   deco: 'tablelamp', blurb: 'Glows a soft gold the moment the sun goes down.' },
  { id: 'deco_wardrobe',  kind: 'furniture', name: 'Tall Wardrobe', rarity: 'rare',   deco: 'wardrobe',  blurb: 'Every accessory lives in here, in theory.' },
  { id: 'deco_bathtub',   kind: 'furniture', name: 'Bubble Bath',   rarity: 'rare',   deco: 'bathtub',   blurb: 'Bubbles optional. A Boo will find them anyway.' },
  { id: 'deco_bookshelf', kind: 'furniture', name: 'Bookshelf',     rarity: 'ultra',  deco: 'bookshelf', wall: true, blurb: 'Every shelf a different colour, none of them alphabetised.' },
  { id: 'deco_bffportrait', kind: 'furniture', name: 'Best-Friend Portrait', rarity: 'ultra', deco: 'bffportrait', wall: true, free: true, blurb: 'A friendship milestone, framed forever.' },

  // --- Accessories (RUN10 P13): hat / face / feet slots plus atomic sets. ---
  { id: 'acc_bow',          kind: 'accessory', slot: 'hat',  name: 'Purple Bow',      rarity: 'common', art: 'bow',          blurb: 'A big satin bow in the most excellent shade of purple.' },
  { id: 'acc_sunhat',       kind: 'accessory', slot: 'hat',  name: 'Sun Hat',         rarity: 'common', art: 'sunhat',       blurb: 'Wide brim, tiny flower, maximum holiday energy.' },
  { id: 'acc_shades',       kind: 'accessory', slot: 'face', name: 'Star Sunglasses', rarity: 'common', art: 'shades',       blurb: 'Star-shaped shades for a Boo who is going places.' },
  { id: 'acc_scarf',        kind: 'accessory', slot: 'hat',  name: 'Cosy Scarf',      rarity: 'common', art: 'scarf',        blurb: 'Knitted with love and just a little bit of magic.' },
  { id: 'acc_flowercrown',  kind: 'accessory', slot: 'hat',  name: 'Flower Crown',    rarity: 'rare',   art: 'flowercrown',  blurb: 'A ring of little blooms for a woodland royal.' },
  { id: 'acc_heartglasses', kind: 'accessory', slot: 'face', name: 'Heart Glasses',   rarity: 'rare',   art: 'heartglasses', blurb: 'Everything looks lovelier through heart-shaped lenses.' },
  { id: 'acc_wizardhat',    kind: 'accessory', slot: 'hat',  name: 'Wizard Hat',      rarity: 'rare',   art: 'wizardhat',    blurb: 'Pointy, starry, and possibly a bit enchanted.' },
  { id: 'acc_goldcrown',    kind: 'accessory', slot: 'hat',  name: 'Golden Crown',    rarity: 'ultra',  art: 'goldcrown',    blurb: 'Solid gold, extremely shiny, absolutely deserved.' },
  { id: 'acc_cape',         kind: 'accessory', slot: 'hat',  name: 'Sparkle Cape',    rarity: 'ultra',  art: 'cape', fx: 'shimmer', blurb: 'Swishes dramatically even when there is no wind.' },
  { id: 'acc_djheadphones', kind: 'accessory', slot: 'hat',  name: 'DJ Headphones',   rarity: 'rare',   art: 'djheadphones', blurb: 'Drop the beat! (DJ Boo already has a pair, thanks.)' },
  { id: 'acc_starcheek',    kind: 'accessory', slot: 'face', name: 'Star Cheek',      rarity: 'rare',   art: 'starcheek',    blurb: 'One painted star, right where a smile begins.' },
  { id: 'acc_rainbowstripe',kind: 'accessory', slot: 'face', name: 'Rainbow Stripe',  rarity: 'rare',   art: 'rainbowstripe',blurb: 'A bright little rainbow swept across both cheeks.' },
  { id: 'acc_whiskers',     kind: 'accessory', slot: 'face', name: 'Whiskers',        rarity: 'rare',   art: 'whiskers',     blurb: 'Three neat whiskers each side for extra curiosity.' },
  { id: 'acc_heartcheek',   kind: 'accessory', slot: 'face', name: 'Heart Cheek',     rarity: 'rare',   art: 'heartcheek',   blurb: 'A tiny heart painted with a very steady paw.' },
  { id: 'acc_rollerskates', kind: 'accessory', slot: 'feet', name: 'Roller Skates',   rarity: 'ultra',  art: 'rollerskates', locomotion: 'glide', blurb: 'Four tiny wheels and one magnificent lean-glide.' },
  { id: 'acc_wellies',      kind: 'accessory', slot: 'feet', name: 'Yellow Wellies',  rarity: 'rare',   art: 'wellies', locomotion: 'stomp', blurb: 'Made for puddles. Especially the splashy ones.' },
  { id: 'acc_set_police',   kind: 'accessory', slot: 'set', name: 'Police Costume',   rarity: 'ultra', art: 'policecap', pieces: { hat: 'policecap', face: 'policebadge' }, blurb: 'Cap straight, badge shining, ready to help.' },
  { id: 'acc_set_builder',  kind: 'accessory', slot: 'set', name: 'Builder Costume',  rarity: 'ultra', art: 'builderhelmet', pieces: { hat: 'builderhelmet', face: 'builderhammer' }, idle: 'hammer', blurb: 'Helmet on. Hammer ready. Tap tap!' },
  { id: 'acc_set_chef',     kind: 'accessory', slot: 'set', name: 'Chef Costume',     rarity: 'ultra', art: 'cheftoque', pieces: { hat: 'cheftoque', face: 'chefspoon' }, idle: 'stir', blurb: 'A towering toque and a spoon for serious stirring.' },
  { id: 'acc_set_explorer', kind: 'accessory', slot: 'set', name: 'Explorer Costume', rarity: 'ultra', art: 'pithhat', pieces: { hat: 'pithhat', face: 'maptan' }, blurb: 'Hat, map and a little sunshine from the trail.' },

  // --- Free Easel (RUN3 C6): granted with the Studio, never drops from boxes ---
  { id: 'deco_easel', kind: 'deco', name: 'Art Easel', rarity: 'rare', deco: 'easel', free: true, blurb: 'Show off your own artwork in the town!' },

  // --- Boo Quest exclusives (RUN6 C6): earned only by finishing a land, never in boxes ---
  { id: 'boo_scout', kind: 'boo', name: 'Scout', rarity: 'ultra', species: 'pip', colors: { body: 'teal' }, acc: 'explorerhat', questOnly: true, blurb: 'Map in paw, hat on head, always first to the horizon.' },
  { id: 'deco_questflag', kind: 'deco', name: 'Quest Flag', rarity: 'rare', deco: 'questflag', questOnly: true, blurb: 'Planted at the end of the Sparkle Meadow. You were here!' },
  // --- Lexie & Tyler's 11th birthday keepsakes (local party feature) ---
  // Free + birthdayOnly keeps them out of mystery boxes and the standard collection count.
  { id: 'boo_birthday_lexie', kind: 'boo', name: 'Lexie Starshine', rarity: 'birthday', species: 'nova', colors: { body: 'bubblegum', belly: 'cream' }, acc: 'goldcrown', fx: 'twinkle', free: true, birthdayOnly: true, blurb: 'A crown-bright party Boo made specially for Lexie’s eleventh birthday.' },
  { id: 'boo_birthday_tyler', kind: 'boo', name: 'Tyler Turbo', rarity: 'birthday', species: 'zippy', colors: { body: 'teal', wing: 'gold' }, acc: 'djheadphones', fx: 'shimmer', free: true, birthdayOnly: true, blurb: 'A music-powered party Boo made specially for Tyler’s eleventh birthday.' }
];

// Convenience lookups.
export const BY_ID = Object.fromEntries(CATALOGUE.map(it => [it.id, it]));

// Collectibles (Boos + decorations) fill the collection grid + "found X of N" counter.
// Accessories are a separate wardrobe (equipped, not counted here).
export const COLLECTIBLES = CATALOGUE.filter(it => it.kind !== 'accessory' && !it.free);
export const ACCESSORIES  = CATALOGUE.filter(it => it.kind === 'accessory');
export const BIRTHDAY_BOOS = CATALOGUE.filter(it => it.birthdayOnly);

// Grouped by kind then rarity for the type-first drop roll (RUN2 C2). Free items never drop.
export const BY_TYPE_RARITY = CATALOGUE.reduce((m, it) => {
  if (it.free || it.questOnly) return m;   // quest-exclusives (RUN6 C6) never drop from boxes
  if (it.kind === 'landscape') return m;   // Build-mode toybox items (RUN10 P3) never drop either
  // Furniture (RUN10 P4) joins the box pools "at decoration odds" — bucketed under the
  // same 'deco' type-roll weight, not a separate furniture type/weight of its own.
  const bucketKind = it.kind === 'furniture' ? 'deco' : it.kind;
  ((m[bucketKind] ||= {})[it.rarity] ||= []).push(it);
  return m;
}, {});

// Legacy: all items by rarity (kept for compatibility; drops use BY_TYPE_RARITY).
export const BY_RARITY = CATALOGUE.reduce((m, it) => {
  (m[it.rarity] ||= []).push(it);
  return m;
}, {});

export const TOTAL_ITEMS = COLLECTIBLES.length; // 32 (boos + decorations)
