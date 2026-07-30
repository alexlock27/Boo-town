// data/dressings.js — room dressings (RUN19 Z6).
//
// Three wallpapers and three floors per Boo House room. NAMES AND PRICES ARE AUTHORED and
// ship exactly as written in _programme/RUN19.md Z6 — the standing veto says they ship as
// authored unless NEEDS_ALEX.md holds an overrule when Z6 begins, and it did not.
//
// The CURRENT palette is the free default in every room, so a child who buys nothing still
// has a complete room and can always go back to it. Applying an owned dressing is free and
// repeatable forever — the stars buy the OPTION, never the act of decorating.
//
// `pattern` names the fill drawn by js/art.js renderDressing(); `ink`/`base`/`accent` are the
// house-palette colours it uses. Wall patterns are drawn into the room's wall band, floor
// patterns into its floor band.

// The rooms, in the order the Boo House's own switcher shows them (js/areas.js HOUSE_ROOMS).
export const DRESSING_ROOMS = [
  { id: 'lounge', key: 'boohouse', name: 'Lounge' },
  { id: 'kitchen', key: 'boohouse_kitchen', name: 'Kitchen' },
  { id: 'bedroom', key: 'boohouse_bedroom', name: 'Bedroom' }
];

// The free default per room + slot: the palette the room has always had (js/areas.js).
export const DEFAULT_DRESSING = {
  lounge: { walls: 'lounge_walls_default', floors: 'lounge_floors_default' },
  kitchen: { walls: 'kitchen_walls_default', floors: 'kitchen_floors_default' },
  bedroom: { walls: 'bedroom_walls_default', floors: 'bedroom_floors_default' }
};

// id -> { room, slot:'walls'|'floors', name, cost, pattern, base, accent }
// cost is in CREATIVE stars (the shop's House shelf currency) — the pack writes them as ★.
export const DRESSINGS = [
  // ---- the free defaults: the palette each room already had -----------------------------
  { id: 'lounge_walls_default',  room: 'lounge',  slot: 'walls',  name: 'The usual walls',  cost: 0, pattern: 'plain',      base: '#F8ECD2', accent: '#C05630' },
  { id: 'lounge_floors_default', room: 'lounge',  slot: 'floors', name: 'The usual floor',  cost: 0, pattern: 'plain',      base: '#DCB980', accent: '#C05630' },
  { id: 'kitchen_walls_default', room: 'kitchen', slot: 'walls',  name: 'The usual walls',  cost: 0, pattern: 'plain',      base: '#D8EAE5', accent: '#4E9A8F' },
  { id: 'kitchen_floors_default',room: 'kitchen', slot: 'floors', name: 'The usual floor',  cost: 0, pattern: 'plain',      base: '#EFE3CC', accent: '#4E9A8F' },
  { id: 'bedroom_walls_default', room: 'bedroom', slot: 'walls',  name: 'The usual walls',  cost: 0, pattern: 'plain',      base: '#C9B7E0', accent: '#FFD98A' },
  { id: 'bedroom_floors_default',room: 'bedroom', slot: 'floors', name: 'The usual floor',  cost: 0, pattern: 'plain',      base: '#B4A0D4', accent: '#FFD98A' },

  // ---- Lounge walls: Sunny Stripes 6★ · Cosy Checks 6★ · Starry Night 10★ ---------------
  { id: 'lounge_walls_stripes',  room: 'lounge',  slot: 'walls',  name: 'Sunny Stripes',      cost: 6,  pattern: 'stripes',   base: '#FFF3D6', accent: '#FFC93C' },
  { id: 'lounge_walls_checks',   room: 'lounge',  slot: 'walls',  name: 'Cosy Checks',        cost: 6,  pattern: 'checks',    base: '#F8ECD2', accent: '#E0A96D' },
  { id: 'lounge_walls_starry',   room: 'lounge',  slot: 'walls',  name: 'Starry Night',       cost: 10, pattern: 'stars',     base: '#3B2E7E', accent: '#FFC93C' },
  // ---- Lounge floors: Rosy Rug Weave 6★ · Pebble Cosy 6★ · Honey Herringbone 10★ --------
  { id: 'lounge_floors_rosy',    room: 'lounge',  slot: 'floors', name: 'Rosy Rug Weave',     cost: 6,  pattern: 'weave',     base: '#E8AFC0', accent: '#C45D7C' },
  { id: 'lounge_floors_pebble',  room: 'lounge',  slot: 'floors', name: 'Pebble Cosy',        cost: 6,  pattern: 'pebbles',   base: '#D8D3C8', accent: '#A79E90' },
  { id: 'lounge_floors_honey',   room: 'lounge',  slot: 'floors', name: 'Honey Herringbone',  cost: 10, pattern: 'herring',   base: '#E7B776', accent: '#B5793A' },

  // ---- Kitchen walls: Lemon Check 6★ · Mint Spots 6★ · Blueberry Tiles 10★ --------------
  { id: 'kitchen_walls_lemon',   room: 'kitchen', slot: 'walls',  name: 'Lemon Check',        cost: 6,  pattern: 'checks',    base: '#FFF6C9', accent: '#F4D03F' },
  { id: 'kitchen_walls_mint',    room: 'kitchen', slot: 'walls',  name: 'Mint Spots',         cost: 6,  pattern: 'spots',     base: '#D6F2E5', accent: '#5FBF9B' },
  { id: 'kitchen_walls_blue',    room: 'kitchen', slot: 'walls',  name: 'Blueberry Tiles',    cost: 10, pattern: 'tiles',     base: '#BBD3F2', accent: '#4B6FAF' },
  // ---- Kitchen floors: Terracotta Warm 6★ · Seafoam Squares 6★ · Buttercup Boards 10★ ---
  { id: 'kitchen_floors_terra',  room: 'kitchen', slot: 'floors', name: 'Terracotta Warm',    cost: 6,  pattern: 'tiles',     base: '#E0906B', accent: '#B15E3C' },
  { id: 'kitchen_floors_seafoam',room: 'kitchen', slot: 'floors', name: 'Seafoam Squares',    cost: 6,  pattern: 'checks',    base: '#C7EDE2', accent: '#6FBFA8' },
  { id: 'kitchen_floors_butter', room: 'kitchen', slot: 'floors', name: 'Buttercup Boards',   cost: 10, pattern: 'boards',    base: '#FFE9A8', accent: '#D8A93C' },

  // ---- Bedroom walls: Pink Clouds 6★ · Petal Stripes 6★ · Midnight Stars 10★ ------------
  { id: 'bedroom_walls_clouds',  room: 'bedroom', slot: 'walls',  name: 'Pink Clouds',        cost: 6,  pattern: 'clouds',    base: '#FBD9E6', accent: '#FFFFFF' },
  { id: 'bedroom_walls_petal',   room: 'bedroom', slot: 'walls',  name: 'Petal Stripes',      cost: 6,  pattern: 'stripes',   base: '#FCE4EF', accent: '#F09CC0' },
  { id: 'bedroom_walls_midnight',room: 'bedroom', slot: 'walls',  name: 'Midnight Stars',     cost: 10, pattern: 'stars',     base: '#2A2360', accent: '#B9A6F5' },
  // ---- Bedroom floors: Moonbeam Boards 6★ · Cloud Carpet 6★ · Rainbow Rug 10★ -----------
  { id: 'bedroom_floors_moon',   room: 'bedroom', slot: 'floors', name: 'Moonbeam Boards',    cost: 6,  pattern: 'boards',    base: '#DCD6F0', accent: '#A79AD0' },
  { id: 'bedroom_floors_cloud',  room: 'bedroom', slot: 'floors', name: 'Cloud Carpet',       cost: 6,  pattern: 'pebbles',   base: '#EDEAF6', accent: '#C8C1E4' },
  { id: 'bedroom_floors_rainbow',room: 'bedroom', slot: 'floors', name: 'Rainbow Rug',        cost: 10, pattern: 'rainbow',   base: '#FFF3D6', accent: '#FF7AC6' }
];

export const DRESSING_BY_ID = Object.fromEntries(DRESSINGS.map(d => [d.id, d]));
// Purchasable = everything except the six free defaults. These are what the shop's House
// shelf lists, grouped under room-name chips.
export const DRESSINGS_FOR_SALE = DRESSINGS.filter(d => d.cost > 0);
export function dressingsFor(roomId, slot) { return DRESSINGS.filter(d => d.room === roomId && d.slot === slot); }
