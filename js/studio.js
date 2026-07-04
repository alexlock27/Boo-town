// js/studio.js — Boo Studio menu + Gallery + Easel artwork chooser (RUN3 C6).
// The creative suite: Paint-a-Boo, Collage, Build-a-Boo, and the Gallery of saved artworks.
// Artworks live in IndexedDB (never in the backup code). A free Easel deco is granted here.

import { el, clear, dialog } from './ui.js';
import { getState, mutate } from './state.js';
import { sfx, music } from './sfx.js';
import { idbGetAll, idbPut, idbDelete, idbCount } from './idb.js';
import { stampJournal } from './quests.js';

export const GALLERY_CAP = 20;
export const ART_MAX_PX = 640;

// Grant the free Easel deco with the Studio (once).
export function ensureStudioGrant() {
  const s = getState();
  if (s && !s.studioSeen) {
    mutate(st => { st.studioSeen = true; st.inventory['deco_easel'] = (st.inventory['deco_easel'] || 0) + 1; });
  }
}

// Save a PNG dataURL to the gallery; returns { ok } or { full } if at the cap.
export async function saveArtwork(png, kind) {
  const count = await idbCount('artworks');
  if (count >= GALLERY_CAP) return { full: true };
  const id = 'art_' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);
  await idbPut('artworks', { id, png, kind, created: Date.now() });
  return { ok: true, id };
}
export async function listArtworks() {
  const all = await idbGetAll('artworks').catch(() => []);
  return (all || []).sort((a, b) => b.created - a.created);
}

export function mount(container, params, ctx) {
  ensureStudioGrant();
  music.play('calm');
  const root = el('div', { class: 'studio' });
  const header = el('header', { class: 'studio-header' }, [
    el('button', { class: 'icon-btn back-btn', html: backArrow(), 'aria-label': 'Back', onclick: () => { sfx.tap(); ctx.go('hub'); } }),
    el('h2', { text: '🎨 Boo Studio' })
  ]);
  const acts = [
    { id: 'paint', name: 'Paint a Boo', tag: 'Colour it in!', emoji: '🖌️' },
    { id: 'collage', name: 'Collage', tag: 'Make a scene', emoji: '🖼️' },
    { id: 'buildaboo', name: 'Build a Boo', tag: 'Invent your own!', emoji: '🧩' },
    { id: 'gallery', name: 'My Gallery', tag: 'See your art', emoji: '🌟' }
  ];
  const grid = el('div', { class: 'studio-grid' });
  acts.forEach(a => grid.appendChild(el('button', { class: 'studio-card', onclick: () => { sfx.tap(); ctx.go(a.id); } }, [
    el('div', { class: 'sc-emoji', text: a.emoji }),
    el('div', { class: 'sc-title', text: a.name }),
    el('div', { class: 'sc-tag', text: a.tag })
  ])));
  root.append(header, grid);
  container.appendChild(root);
  return { unmount() {} };
}

function backArrow() { return `<svg viewBox="0 0 24 24" width="26" height="26"><path d="M15 5l-7 7 7 7" fill="none" stroke="var(--card)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`; }
