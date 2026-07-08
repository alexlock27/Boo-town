// js/rarityfx.js — ONE shared rarity VFX system (RUN6 C2). Every place an item
// appears (ceremony, collection, town, dress-up, Boo of the Day) calls applyRarityFx
// on the item's wrapper so rarity reads identically everywhere:
//   Common  — clean sticker, no layer.
//   Rare    — a periodic diagonal glint sweep.
//   Ultra   — a continuous soft shimmer + two or three floating light motes.
//   Secret  — a gentle aura halo.
//   Shiny   — a golden sparkle loop + star glint + richer saturation, LAYERED on top.
// In the town, distant/numerous items degrade to a static sheen so the emitter cap
// holds; the collection grid shows calm versions, the focused card the full effect.
// All layers are transform/opacity-only; reduced-motion stills them (CSS).

export const RARITY_MOTES = 3;         // ultra floating light motes (named cap)
export const RARITY_TOWN_CAP = 6;      // max fully-animated rare+ items in the town at once

const RANK = { common: 0, rare: 1, ultra: 2, secret: 3 };
export function rarityRank(item) { return RANK[(item && item.rarity) || 'common'] || 0; }
export function isFancy(item, shiny) { return !!shiny || rarityRank(item) > 0; }

function layer(cls) { const d = document.createElement('div'); d.className = 'rfx-layer ' + cls; d.setAttribute('aria-hidden', 'true'); return d; }

export function clearRarityFx(wrap) {
  if (!wrap) return;
  wrap.querySelectorAll('.rfx-layer').forEach(n => n.remove());
  wrap.classList.remove('rfx-calm', 'rfx-saturate', 'rfx-host');
}

// opts: { context: 'full' | 'calm' | 'town', shiny: bool, degrade: bool }
export function applyRarityFx(wrap, item, opts = {}) {
  if (!wrap) return;
  const { context = 'full', shiny = false, degrade = false } = opts;
  clearRarityFx(wrap);
  if (!item) return;
  const rarity = (item.rarity || 'common');
  const calm = context === 'calm';
  // host must be a positioned ancestor for the absolute layers; only nudge static ones
  try { if (getComputedStyle(wrap).position === 'static') wrap.classList.add('rfx-host'); } catch {}

  // Town graceful degrade (beyond the emitter cap, or explicitly): a single static sheen.
  if (degrade) {
    if (rarity !== 'common' || shiny) wrap.appendChild(layer('rfx-sheen' + (shiny ? ' shiny' : '') + ' rar-' + rarity));
    return;
  }

  if (rarity === 'rare') wrap.appendChild(layer('rfx-glint'));
  else if (rarity === 'ultra') {
    wrap.appendChild(layer('rfx-shimmer'));
    if (!calm) {
      const motes = layer('rfx-motes');
      for (let i = 0; i < RARITY_MOTES; i++) { const m = document.createElement('i'); m.className = 'rfx-mote m' + i; motes.appendChild(m); }
      wrap.appendChild(motes);
    }
  } else if (rarity === 'secret') wrap.appendChild(layer('rfx-aura'));

  // Shiny layers on top of any rarity (a golden sparkle + a star glint + saturation).
  if (shiny) {
    wrap.appendChild(layer('rfx-shiny-sweep'));
    const g = document.createElement('span'); g.className = 'rfx-layer rfx-shiny-glint'; g.textContent = '✦'; wrap.appendChild(g);
    wrap.classList.add('rfx-saturate');
  }
  if (calm) wrap.classList.add('rfx-calm');
}
