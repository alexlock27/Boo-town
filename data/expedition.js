export const BUDGETS = { bridges: { sneezes: [6, 6, 8, 8] }, picnic: { huffs: [5, 6, 7, 8] }, raft: { failedSails: [3, 4, 4, 5] }, hotel: { wrongRooms: [6, 8, 10, 10] } };
export const NODES = [{ key: 'bridges', name: 'Sneezy Bridges', icon: '🌉' }, { key: 'picnic', name: "Picky Grumps' Picnic", icon: '🧺' }, { key: 'raft', name: 'Ferry Raft', icon: '⛵' }, { key: 'hotel', name: 'Boo Hotel', icon: '🏨' }];
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
