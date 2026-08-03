// data/shop.js — RUN15 V4: the Boo Shop's shelves, stock and prices.
// Transcribed EXACTLY from CONTENT_PRICES.md (the authored draft). V5's balance
// simulation tunes ONLY the numbers; the structure and the stock are law.
// Currency keys: maths · word · puzzle · creative · lesson (legacy spends as any).
import { BY_ID } from './catalogue.js';

export const WELCOME_PURSE = 20;          // legacy stars, first visit, small ceremony
export const SPECIAL_SHELF_SIZE = 3;      // three at a time, rotating monthly

// price = [itemId, cost, currency]
export const SHELVES = [
  {
    id: 'house', label: 'House', currency: 'creative',
    blurb: 'The studio and looking after your Boos pay for the home.',
    items: [
      ['deco_rug', 8], ['deco_lamp2', 10], ['deco_plant1', 8], ['deco_stool', 8],
      ['deco_wallart1', 12], ['deco_mirror', 14],
      ['deco_table', 16], ['deco_armchair', 18], ['deco_bookshelf2', 20], ['deco_toybox', 16],
      ['deco_photoframe', 22],
      ['deco_counter', 20], ['deco_oven', 24], ['deco_fridge', 24], ['deco_kitchentable', 18],
      ['deco_bed', 26], ['deco_bunkbed', 34], ['deco_wardrobe', 28], ['deco_bathtub', 30],
      ['deco_wallclock', 26]
    ]
  },
  {
    id: 'town', label: 'Town', currency: 'maths',
    blurb: 'The biggest earner buys the biggest canvas.',
    items: [
      // The four landscape items CONTENT_PRICES.md lists (flowerbed, bush, rock, and the
      // path pack) are already FREE in Build → Landscape. Nothing is ever taken away, so
      // they are not repriced here; the shelf stocks what the shop can genuinely sell.
      ['deco_lamppost', 20], ['deco_signpost', 12],
      ['deco_bench', 16], ['deco_picnic', 14], ['deco_pond', 40], ['deco_fountain', 55],
      ['deco_flowers', 10], ['deco_toadstool', 8], ['deco_tree', 18], ['deco_campfire', 22],
      // RUN21C-4: the Paths group. Maths stars, because the shelf-currency contract is what
      // decides this and the Town shelf is maths — noted as an intended deviation from the
      // ledger's "creative-star" line, in the pack itself. stone/sand/flower stay free.
      ['path_brick', 6], ['path_stepping', 6], ['path_rainbow', 10]
    ],
    // Cards whose item kind is 'path' are shown under their own "Paths" heading (js/shop.js).
    groups: [{ id: 'paths', label: 'Paths', kind: 'path' }]
  },
  {
    id: 'playground', label: 'Playground', currency: 'puzzle',
    blurb: 'The thinking games buy the fun.',
    items: [
      ['deco_swings', 45], ['deco_seesaw', 40], ['deco_slide', 50], ['deco_trampoline', 55],
      ['deco_paddlepool', 48], ['deco_sandpit', 35], ['deco_climbframe', 65], ['deco_roundabout', 60]
    ]
  },
  {
    id: 'wearables', label: 'Wearables', currency: 'word',
    blurb: 'Hats and faces. Costume sets and shoes only ever come from boxes.',
    items: [
      ['acc_sunhat', 12], ['acc_beanie', 12], ['acc_partyhat', 14], ['acc_goldcrown', 25],
      ['acc_bandana', 18],
      ['acc_starcheek', 15], ['acc_rainbowstripe', 15], ['acc_whiskers', 15], ['acc_heartcheek', 15]
    ]
  },
  {
    id: 'special', label: 'Special', currency: 'lesson',
    blurb: 'Three special things at a time. They change with the month.',
    // V5 TUNED (prices only, per the brief). The authored draft was 20/24/28, but the
    // Welcome purse is 20 LEGACY stars and legacy spends as any type — so the draft let a
    // player who had never opened a lesson buy a Special item on her first visit, and the
    // authored target says a maths-only farmer must not reach this shelf at all. Lifting
    // the entry price to 24 restores that, and the simulation still shows a lesson-keen
    // player affording one inside a fortnight (25L by day 14), which is the shelf's point.
    items: [
      ['deco_projectorlamp', 24], ['deco_grandbookshelf', 28], ['deco_telescope', 32]
    ],
    // the authored rotation pool for later months (not yet built as items — when they are,
    // they join here and the monthly pick takes three from the whole pool)
    rotationPool: ['globe', 'aquarium', 'piano', 'treehouse']
  }
];

// UNLOCK-ONLY, never purchasable by any code path. The shop states it with a friendly
// ribbon; `isUnlockOnly` is the single gate every purchase route asks.
export const UNLOCK_ONLY_RIBBON = 'Only from boxes!';
export const SHELF_ITEM_IDS = new Set(SHELVES.flatMap(s => s.items.map(([id]) => id)));
export function isUnlockOnly(itemId) {
  const it = BY_ID[itemId];
  if (!it) return true;                                   // unknown = not for sale
  if (it.kind === 'boo') return true;                     // every Boo
  if (it.kind === 'accessory') {
    if (it.slot === 'set' || it.slot === 'feet') return true;   // costume sets, feet
    // …and only the authored hats/faces are stocked; anything else stays unlock-only
    return !SHELF_ITEM_IDS.has(itemId);
  }
  if (it.questOnly || it.expeditionOnly || it.birthdayOnly) return true;   // quest/expedition/medal rewards
  return !SHELF_ITEM_IDS.has(itemId);
}

export const PRICE_OF = Object.fromEntries(
  SHELVES.flatMap(s => s.items.map(([id, cost]) => [id, { cost, currency: s.currency, shelf: s.id }]))
);
export function priceOf(itemId) { return PRICE_OF[itemId] || null; }
export const ALL_STOCK = SHELVES.flatMap(s => s.items.map(([id, cost]) => ({ id, cost, currency: s.currency, shelf: s.id })));
