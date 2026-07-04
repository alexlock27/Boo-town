// data/guideLines.js — guide speech (spec §10.4).
// Keyed arrays; pick randomly within a key. {name} = child, {guide} = guide's name.
// Written exactly as specified; more may be added later.

export const LINES = {
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
  gameIntroSpell: ["I'll say a word, you build it. Tap Peek if you want a look first."],
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
  twoStars: [
    "Two stars! So close to three I can taste it.",
    "Nice work, {name}! One less slip next time and that's three."
  ],
  threeStars: [
    "THREE STARS?! {name}, you legend!",
    "Perfect round! The Boos are going wild!"
  ],
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
  duplicate: [
    "Twins! I'll turn the spare into stars for you.",
    "Another one! More stars for the meter, then."
  ],
  townNudge: ["Your new friend needs a home. To the town!"],
  townFirst: ["This is YOUR town, {name}. Put your Boos anywhere you like!"],
  idle: [
    "Giraffes have purple tongues, you know. True fact.",
    "I heard the Dance Stage makes Boos do a little bop...",
    "Three stars fills the meter faster. Just saying!",
    "Which Boo is your favourite? I won't tell the others."
  ],

  // ---- Run 2 additions (RUN2.md part D) ----
  firstPick: ["Three little Boos want to be your very first friend. Who's it going to be?"],
  revealAccessory: ["Ooh, dress-up! Tap Wear it and pick who gets it."],
  dressUp: ["Looking GOOD. Ten out of ten."],
  zoneUnlock: ["{name}! Your stars opened a whole new place! Come see!"],
  nightTown: ["Shhh... the fireflies are out."],
  djRefuse: ["DJ Boo says one pair of headphones is plenty, thanks."],
  speciesChange: ["A new look! Love it. Same me, same you, new us!"]
};
