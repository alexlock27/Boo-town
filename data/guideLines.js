// data/guideLines.js — guide speech (spec §10.4).
// Keyed arrays; pick randomly within a key. {name} = child, {guide} = guide's name.
// Written exactly as specified; more may be added later.

export const LINES = {
  L_CARE_NOTREATS: ["Win a round to earn a treat!"],
  L_CARE_BFF: ["{name} and {booName}... best friends FOREVER!"],
  L_BLOCKS_SQUEEZE: ["Squeezy! Want a quick question for a Line Blaster?"],
  L_WD_GO: ["Tap GO when you're ready!", "Ready? Hit the big GO!"],
  L_EXP_GUESTS: ["The trail needs more variety — friends are joining!"],
  L_EXP_HINT: ["Hmm... try THAT one!"],
  L_EXP_SNAFFLE: ["SNAFFLE! So THAT'S who peppered the bridges!"],
  L_CAPER_END: ["Everyone fits at OUR picnic."],
  firstHello: [
    "Hi {name}! I'm {guide}, your guide to Boo Town.",
    "The Boos are shy little things. Win stars and they'll come and live here!",
    "Here's a present to start you off. Go on, open it!"
  ],
  welcome: [
    "Hey hey {name}!",
    "You're back! The Boos missed you.",
    "Ready to earn some stars, {name}?",
    "Ooh, good timing. I was getting bored."
  ],
  boxReady: [
    "A box is ready! Tap the gift!",
    "Ooooh what's inside? Open it open it!"
  ],
  gameIntroBubble: ["Pop the bubble with the right answer. Easy... probably!"],
  gameIntroFeed: ["These Boos are HUNGRY. Feed each one exactly what its sign says."],
  gameIntroSpell: ["I'll show you each word, then hide it — you build it from memory. Tap my face if you're stuck!"],
  hintOffer: [
    "Stuck? Tap my face for a hint!",
    "Want a nudge? That's what I'm here for."
  ],
  hintBubble: ["Poof! I hid some wrong ones for you."],
  hintFeed: [
    "Read the sign again... look at the last digit!",
    "Try saying the rule out loud. It helps, promise."
  ],
  hintSpell: ["Here's the next letter. You've got the rest!"],
  oops: [
    "Nearly! Have another go.",
    "Hmm, not that one. You've got this.",
    "Even I get those wrong. Try again!"
  ],
  oneStar: [
    "Round done! Every star counts.",
    "One star closer to a Boo!"
  ],
  // RUN12 S11 — she stopped part way and kept what she had earned. Warm, never a telling-off.
  leftEarly: [
    "Stopping there? You keep every star you earned. 🌟",
    "Off you go — those stars are yours to keep."
  ],
  twoStars: [
    "Two stars! So close to three I can taste it.",
    "Nice work, {name}! One less slip next time and that's three."
  ],
  threeStars: [
    "THREE STARS?! {name}, you legend!",
    "Perfect round! The Boos are going wild!"
  ],
  // RUN12 S5 — the ceremony describes the thing she actually won. One authored line per
  // kind; no Boo flavour ever lands on a hat, a bed or a palm tree. Single-entry arrays so
  // the exact authored words are what she hears, every time.
  dropBoo: ["A new Boo just dropped!"],
  dropAccessory: ["A new thing to wear!"],
  dropCostume: ["A whole outfit!"],
  dropFurniture: ["Something new for the house!"],
  dropTown: ["Something new for your town!"],
  boxCommon: [
    "A new Boo just dropped!",
    "Aww, look at its little face!"
  ],
  boxRare: [
    "Ooh, a RARE one! Fancy!",
    "Look at this one, it's got accessories and everything!"
  ],
  boxUltra: ["NO WAY. An ULTRA?! It sparkles!!"],
  boxSecret: ["I don't believe it. THE secret Boo. DJ Boo is real!!"],
  boxCustom: ["It's the Boo YOU built! It came to live in your town!", "You dreamed this one up yourself, {name}! Amazing!"],
  duplicate: [
    "Twins! I'll turn the spare into stars for you.",
    "Another one! More stars for the meter, then."
  ],
  townNudge: ["Your new friend needs a home. To the town!"],
  // RUN4 C1: the one-per-session near-unlock nudge ({zone}/{n} filled in by the hub).
  nearUnlock: [
    "Ooh {name} — only {n} more ⭐ and the {zone} opens!",
    "So close! Just {n} more ⭐ and the {zone} is yours!"
  ],
  // RUN4 C3: reward tone, upward only. The brave line celebrates the bonus; the
  // cosy line is a warm nudge toward the next level ({level} filled by results).
  braveRound: ["BRAVE round! Bonus sparkle!", "That was BRAVE! Extra sparkle for you!"],
  // RUN4 C6: the Boo Builders' reveal, and C7's Boo Pop intro.
  builders: ["The Builders finished something for you!", "The Builders finished something for you! Come and see!"],
  // RUN4 C8: shiny reveals + the Star Chest.
  boxShiny: ["It SPARKLES!! A shiny Boo — look at it glitter!", "A SHINY one!! Ooh it shimmers when it moves!"],
  chestOpen: ["Your stars filled a whole golden chest! Fancy treasure inside!", "A Star Chest! Only the best things live in gold boxes."],
  gameIntroPop: ["Swap two gems so a matching pair touches — POP! Watch them tumble!"],
  cosyRound: [
    "Lovely warm-up! Bigger sparkles are waiting up on {level}!",
    "Cosy and smooth! {level} has bigger sparkles with your name on them!"
  ],
  townFirst: ["This is YOUR town, {name}. Put your Boos anywhere you like!"],
  idle: [
    "Giraffes have purple tongues, you know. True fact.",
    "I heard the Dance Stage makes Boos do a little bop...",
    "Three stars fills the meter faster. Just saying!",
    "Which Boo is your favourite? I won't tell the others.",
    "Some Boos only visit in certain seasons. Keep an eye out!",
    "I heard somewhere out there is a tiny giraffe Boo. Probably just a legend..."
  ],

  // ---- EXPANSION_2 Teach Me encourage lines ----
  encourage: [
    "Nearly! Let's take another little look.",
    "So close. Here's another way to see it.",
    "Good try! Let me show you once more.",
    "Almost! We've got this together."
  ],

  // ---- EXPANSION_1 §4 seasonal + Twiglet lines ----
  summerReveal: ["A summer Boo! It smells like sun cream!"],
  spookyReveal: ["Ooooh, a spooky one! I'm not scared. You're scared."],
  winterReveal: ["A winter Boo! Its little nose is cold!"],
  twigletReveal: ["WAIT. Is that... a tiny giraffe?! {name}, we have to keep them!"],

  // ---- Run 2 additions (RUN2.md part D) ----
  firstPick: ["Three little Boos want to be your very first friend. Who's it going to be?"],
  revealAccessory: ["Ooh, dress-up! Tap Wear it and pick who gets it."],
  dressUp: ["Looking GOOD. Ten out of ten."],
  zoneUnlock: ["{name}! Your stars opened a whole new place! Come see!"],
  nightTown: ["Shhh... the fireflies are out."],
  djRefuse: ["DJ Boo says one pair of headphones is plenty, thanks."],
  speciesChange: ["A new look! Love it. Same me, same you, new us!"],

  // ---- Run 10 P1 additions (Town 4.0: the world map) ----
  L_MAP_LOCKED: ["Not far now — {n} more stars!"],
  L_PLAYGROUND_NEW: ["A new place to play!"],

  // ---- Run 10 P2 additions (Town 4.0: sockets, capacity, the drawer) ----
  L_AREA_FULL: ["This spot's bursting! Try another area?"],

  // ---- Run 10 P3 additions (Town 4.0: build mode, paths, landscape, fishing) ----
  L_PATH_FULL: ["That's a LOT of path! Erase some to lay more."],

  // ---- Run 10 P4 additions (Interiors: the Boo House and the Gallery) ----
  // Superseded L_LANDSCAPE_OUTDOORS — the packet's own general-purpose line now covers
  // BOTH landscape and rides refusing to go indoors.
  L_NOT_INDOORS: ["That belongs outside!"],
  L_NOT_OUTDOORS: ["Cosy things like a roof!"],
  L_GALLERY_SEED: ["Every Boo you meet earns a spot in here!"],

  // ---- Run 10 P20 additions (Wish Well) ----
  L_WISH_OPEN: ["Spell what you wish for!"],
  L_WISH_NEARLY: ["Ooh, nearly! The well is listening..."],

  // ---- RUN17 X2: kind words woven through --------------------------------------------
  // AUTHORED in CONTENT_WARMTH.md sections X2a and X2b, transcribed exactly. Nothing here
  // was written by the implementer, and nothing here may be paraphrased.
  //
  // THE RULE BEHIND EVERY LINE (CONTENT_WARMTH.md): praise the effort, the choice or the
  // persistence — never the ability. "You kept going" builds a child who keeps going;
  // "you're so clever" builds a child who avoids anything that might prove otherwise. No
  // line compares her to anyone, mentions a streak, a number or a score, or implies she
  // should have found something easy. tests/r17x2-encouragement.mjs machine-checks that.
  //
  // WHEN these fire, and how hard they are capped, is js/encouragement.js — not here.

  // X2a. General encouragement (40 lines).
  encourageEffort: [
    "You kept going. That's the good bit.",
    "That was a tricky one and you stayed with it.",
    "I like how you had a think about that.",
    "Nice — you tried it a different way.",
    "Look at you, having a go.",
    "You didn't give up. Brilliant.",
    "That took some working out, didn't it?",
    "Good thinking, that.",
    "You're getting the hang of this.",
    "Sticking with it — that's the whole trick.",
    "Ooh, you spotted it!",
    "That's the way. Slow and sure.",
    "You had a wobble and carried on. Ace.",
    "I saw you thinking hard there.",
    "Lovely bit of concentrating.",
    "You chose a tricky one. Good for you.",
    "That's it — try, look, try again.",
    "Nice one for having another go.",
    "Careful work, that.",
    "You worked that out all by yourself.",
    "Good spot!",
    "That was a proper puzzle and you cracked on.",
    "Brave, picking that one.",
    "Steady as you go. It's working.",
    "I like your style.",
    "You keep having a go, and it keeps working.",
    "That's the sort of thinking I like.",
    "Well noticed.",
    "You took your time. That's allowed, you know.",
    "Look how you stuck at that.",
    "Trying is the whole game, really.",
    "You gave that a proper go.",
    "Nice — you didn't rush it.",
    "That's a good way to think about it.",
    "You had a plan. I could tell.",
    "Coming back to it — that's a good move, that.",
    "You're doing the hard bit: keeping on.",
    "Good effort, that one.",
    "You found your own way through.",
    "That's it. You're getting there."
  ],

  // X2b. After a hard round (8 lines). Fired ONLY after an above-comfort round that
  // scored one star. These name the difficulty honestly, because pretending it was easy
  // is worse than useless to a child who has just found it hard.
  encourageHardRound: [
    "That one was HARD. And you still finished it.",
    "Tricky, that. You stayed all the way through.",
    "That was a stretch. Well done for reaching.",
    "Hard ones are hard. You did it anyway.",
    "Not an easy round, that. You kept going.",
    "You picked a tough one and saw it out.",
    "That was a proper challenge. Good on you.",
    "Difficult, that one. And here you still are."
  ]
};
