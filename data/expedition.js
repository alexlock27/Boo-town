// RUN18A H2 — HONEST CONTAINMENT, now LIFTED (RUN18C C5). The Expedition's logic was
// finished and its presentation was never built: the audit found it rendering "as a tiny
// card in a void", so its front door said so plainly and did not open, on the Course-3
// precedent (data/courses.js UNPLAYABLE). RUN18C built that presentation — the party
// select (C1), the trail map (C2), the four puzzles (C3) and the postcard ending (C4) —
// and this is the line that reopens every door at once. The constant STAYS at '' rather
// than being deleted: it is the switch, and a future run that has to shut a door again
// should find the mechanism here rather than reinvent it.
export const CONTAINED = '';

// Every route that is behind that notice, so a door cannot be missed. The hub card was
// shut first and What's New still walked her straight in through the side — "does not
// open" has to mean every door, so both read this one map. RUN18C empties CONTAINED and
// every door reopens at once.
export const CONTAINED_ROUTES = CONTAINED ? { expedition: CONTAINED, expeditionpuzzle: CONTAINED } : {};

export const BUDGETS = { bridges: { sneezes: [6, 6, 8, 8] }, picnic: { huffs: [5, 6, 7, 8] }, raft: { failedSails: [3, 4, 4, 5] }, hotel: { wrongRooms: [6, 8, 10, 10] } };
// `short` is how a locked node names the one BEFORE it — "Finish the bridge first!" is the
// pack's own wording, so every node carries the phrase that sentence needs (RUN18C C2).
// `icon` stays for What's New / chrome; the trail markers themselves are art.js drawings now.
export const NODES = [
  { key: 'bridges', name: 'Sneezy Bridges', icon: '🌉', short: 'the bridge' },
  { key: 'picnic', name: "Picky Grumps' Picnic", icon: '🧺', short: 'the picnic' },
  { key: 'raft', name: 'Ferry Raft', icon: '⛵', short: 'the raft' },
  { key: 'hotel', name: 'Boo Hotel', icon: '🏨', short: 'the hotel' }
];
export const GUESTS = [
  { id:'guest_pip_teal', name:'Fig', species:'pip', colors:{body:'teal'}, acc:'cap' }, { id:'guest_nova_lilac', name:'Biscuit', species:'nova', colors:{body:'lilac'} },
  { id:'guest_munch_gold', name:'Nutmeg', species:'munch', colors:{body:'gold'}, shiny:true }, { id:'guest_bloop_cream', name:'Pickle', species:'bloop', colors:{body:'cream'} },
  { id:'guest_twirl_pink', name:'Waffle', species:'twirl', colors:{body:'bubblegum'}, acc:'bow' }, { id:'guest_sunny_teal', name:'Pepper', species:'sunny', colors:{body:'teal'} },
  { id:'guest_nova_gold', name:'Marmalade', species:'nova', colors:{body:'gold'} }, { id:'guest_pip_lilac', name:'Crumpet', species:'pip', colors:{body:'lilac'}, shiny:true }
];

// The Grumps' tray is deliberately authored rather than random: every feature is
// visible in its name/icon and every colour/shape/kind combination has one friend.
export const TOPPINGS = [
  { id:'strawberry', name:'strawberry', icon:'🍓', colour:'red', shape:'round', kind:'sweet' },
  { id:'tomato', name:'tomato', icon:'🍅', colour:'red', shape:'round', kind:'savoury' },
  { id:'raspberry-lace', name:'raspberry lace', icon:'🍬', colour:'red', shape:'long', kind:'sweet' },
  { id:'pepper-stick', name:'pepper stick', icon:'🌶️', colour:'red', shape:'long', kind:'savoury' },
  { id:'grape', name:'grape', icon:'🍇', colour:'green', shape:'round', kind:'sweet' },
  { id:'sprout', name:'sprout', icon:'🥬', colour:'green', shape:'round', kind:'savoury' },
  { id:'apple-slice', name:'apple slice', icon:'🍏', colour:'green', shape:'long', kind:'sweet' },
  { id:'cucumber', name:'cucumber', icon:'🥒', colour:'green', shape:'long', kind:'savoury' }
];
