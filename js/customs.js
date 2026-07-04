// js/customs.js — Build-a-Boo sealed customs (RUN3 C6).
// Sealed customs (cap 5) enter the mystery-box pool with a dedicated 10% slice while any
// remain unwon. Winning one plays the ceremony with a special banner, removes it from the
// pool, and it then lives in the collection + town like any Boo.

import { getState, mutate } from './state.js';
import { normalizeCustom } from './art.js';
import { BY_ID } from '../data/catalogue.js';

export const CUSTOM_CAP = 5;

export function getCustoms() { return (getState() && getState().customs) || []; }
export function sealedCustoms() { return getCustoms().filter(c => c.sealed); }
export function unwonCustoms() { return getCustoms().filter(c => c.sealed && !c.won); }
export function canSeal() { return sealedCustoms().length < CUSTOM_CAP; }
export function customById(id) { return getCustoms().find(c => c.id === (id && id.startsWith && id.startsWith('custom:') ? id.slice(7) : id)); }

let _seq = 0;
export function addSealedCustom(parts, name) {
  if (!canSeal()) return null;   // cap of 5 sealed customs (RUN3 C6)
  const id = 'c' + Date.now().toString(36) + (_seq++).toString(36) + Math.floor(Math.random() * 1e6).toString(36);
  mutate(s => { s.customs = s.customs || []; s.customs.push({ id, name: (name || 'My Boo').slice(0, 16), parts: normalizeCustom(parts), sealed: true, won: false }); });
  return id;
}
export function markWon(id) {
  const raw = id.startsWith('custom:') ? id.slice(7) : id;
  mutate(s => { const c = (s.customs || []).find(x => x.id === raw); if (c) { c.won = true; c.wonAt = Date.now(); } });
}

// A synthetic catalogue-like item for a custom Boo (id form 'custom:<id>').
export function resolveCustomItem(fullId) {
  const c = customById(fullId);
  if (!c) return null;
  return { id: 'custom:' + c.id, kind: 'boo', name: c.name, rarity: 'custom', custom: c.parts, blurb: 'A Boo you dreamed up and built yourself!' };
}
// Resolve any inventory/town id to a renderable item (catalogue OR custom).
export function resolveItem(id) {
  if (id && id.startsWith && id.startsWith('custom:')) return resolveCustomItem(id);
  return BY_ID[id] || null;
}
// Owned custom Boos (in inventory as 'custom:<id>').
export function ownedCustomItems() {
  const s = getState(); const inv = (s && s.inventory) || {};
  return Object.keys(inv).filter(id => id.startsWith('custom:') && inv[id] > 0).map(resolveCustomItem).filter(Boolean);
}
