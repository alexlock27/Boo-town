// js/content.js — the Light / Medium / Full content setting (RUN3 C9).
// A PRESENTATION FILTER ONLY: all content stays installed, saves + mastery are untouched,
// and Smart Mix keeps drawing from everything. Smart Mix and the Golden Round are visible at
// every tier. Default after this update: Light. Tags are exactly as specced in C9.

import { getState, mutate } from './state.js';
import { MIX_KEY } from './picker.js';

export const TIERS = ['toddler', 'light', 'medium', 'full'];   // toddler added RUN5 C7
const ORDER = { toddler: -1, light: 0, medium: 1, full: 2 };

export function contentTier() { const s = getState(); return (s && s.settings && s.settings.content) || 'light'; }
export function setContentTier(t) { if (TIERS.includes(t)) mutate(s => { s.settings.content = t; }); }

// Age → tier mapping (RUN5 C7): 4 and under = Toddler, 5–7 = Light, 8–9 = Medium,
// 10 and up = Full. Age lives in the local save only and is used for nothing else.
// The grown-ups setting always overrides (it writes the same settings.content).
export function tierForAge(age) { return age <= 4 ? 'toddler' : age <= 7 ? 'light' : age <= 9 ? 'medium' : 'full'; }
export const AGE_CHOICES = [
  { label: '3 or younger', age: 3 }, { label: '4', age: 4 },
  { label: '5', age: 5 }, { label: '6', age: 6 }, { label: '7', age: 7 },
  { label: '8', age: 8 }, { label: '9', age: 9 }, { label: '10', age: 10 },
  { label: '11', age: 11 }, { label: '12 and up', age: 12 }
];
export function tierAllows(tag) { return ORDER[contentTier()] >= ORDER[tag || 'light']; }

// ---- Bubble Pop / Boo Dash categories ----
// RUN18B Y9: the gates were set too high for what the games actually ask. Number bonds and
// doubles/halves are Year 1–2 work — a Light child meets them at school long before she meets
// them here — and "more or less" is a comparison, not a table. Bonds and doubles drop to
// Light, more-or-less to Medium; add & subtract stays Medium.
export const BUBBLE_CAT_TIER = { tables: 'light', bonds: 'light', addsub: 'medium', doubles: 'light', moreless: 'medium' };
export function filterCategories(cats) { return cats.filter(c => tierAllows(BUBBLE_CAT_TIER[c.key] || 'full')); }

// ---- Levels everywhere: Light (and below) shows Starter to Level 2; Medium/Full all ----
export function filterLevels(levels) {
  const t = contentTier();
  if (t === 'medium' || t === 'full') return levels;
  return levels.filter(l => l === 'S' || l === 'starter' || (typeof l === 'number' && l <= 2));
}

// ---- Spell Boo sets ----
// Light: Big List, Tricky Sounds, Sound Twins. Medium adds the listed families. Full: all.
export const SPELL_SET_TIER = {
  big: 'light', trickyTh: 'light', twins: 'light',
  prefixesUnDisMisRe: 'medium', lyFamily: 'medium', ousFamily: 'medium', homophones: 'medium', tureFamily: 'medium', ouSoundsLikeU: 'medium'
  // everything else => 'full'
};
export function spellSetTier(id) { return SPELL_SET_TIER[id] || 'full'; }
export function filterSpellSets(sets) { return sets.filter(s => s.key === MIX_KEY || s.key === 'twins' || tierAllows(spellSetTier(s.key))); }

// ---- Arcade (Blocks / Bounce / Beat) ----
// Light: no picker (Smart-Mix auto). Medium: Times tables, Number bonds, Words. Full: everything.
export const ARCADE_CAT_TIER = { tables: 'medium', bonds: 'medium', words: 'medium', addsub: 'full', doubles: 'full' };
export function arcadeHasPicker() { const t = contentTier(); return t !== 'light' && t !== 'toddler'; }
export function filterArcadeCategories(cats) { return cats.filter(c => tierAllows(ARCADE_CAT_TIER[c.key] || 'full')); }

// ---- RUN18E L1: the four RUN16 reading games move to Light, hidden at Medium ----
// (Full still shows everything, Toddler is a separate door.) A grown-up can always
// override (settings.showAgedOutGames), e.g. for a Medium child who still enjoys them.
//
// CONFIRMED BUG (Alex, live-tested 2026-07-30): Blend It and Story Order do NOT belong in
// this list. Their cards don't disappear at Medium — Part B/E give them a NEW mode at
// Medium (the Word Factory, the reporter's insertion game; see blendit.js/storyorder.js's
// own tier branch), so hiding the card here made that new content completely unreachable
// through the hub. Only Sound Sorter and Rhyme Time have no Medium replacement and are
// genuinely hidden there.
export const HUB_HIDE_AT_MEDIUM = ['soundsorter', 'rhymetime'];
// RUN18E L3/L4: the two brand-new Medium/Full literacy games (Twin Trouble, Apostrophe
// Patrol) are Y3/4 content — they hide below Medium the same way the older games hide
// AT Medium, and the same override switch reveals them for a curious younger reader.
export const HUB_MEDIUM_PLUS_ONLY = ['soundtwins', 'apostrophepatrol'];
// RUN18E L6/Part A#3: the two new literacy lessons (Word Machine, Flying Comma) are
// Medium's — the three RUN16 literacy lessons stay Light-and-up as they always were.
export const LESSON_MEDIUM_PLUS_ONLY = ['wordMachine', 'flyingComma'];
export function lessonVisible(id) {
  if (!LESSON_MEDIUM_PLUS_ONLY.includes(id)) return true;
  const s = getState();
  if (s && s.settings && s.settings.showAgedOutGames) return true;
  return contentTier() === 'medium' || contentTier() === 'full';
}
export function gameVisibleAtHub(id) {
  const s = getState();
  const override = !!(s && s.settings && s.settings.showAgedOutGames);
  if (override) return true;
  if (HUB_HIDE_AT_MEDIUM.includes(id)) return contentTier() !== 'medium';
  if (HUB_MEDIUM_PLUS_ONLY.includes(id)) return contentTier() === 'medium' || contentTier() === 'full';
  return true;
}

// ---- Feed the Boos ----
// Light: Subject (Maths / Words) + level, auto-rotating a template. Medium: grouped topics.
// Full: every template. Groups map each template id to a friendly topic.
// `sample` is display-only picker copy (RUN4 C2): one example per topic card.
export const FEED_GROUPS = [
  { key: 'numbers', name: 'Numbers', sample: '47 — odd or even?', ids: ['oddEven', 'tableMember1', 'tableMember2', 'tableMember3', 'tableMemberY4', 'romanNumerals', 'twoRule'] },
  { key: 'rounding', name: 'Rounding & comparing', sample: '86 rounds to…?', ids: ['compare50', 'compare500', 'compare5000', 'round10', 'round100'] },
  { key: 'fractions', name: 'Fractions', sample: 'Is 2/4 a half?', ids: ['halfEquivalent', 'fractionSize', 'fractionFamilies', 'tenths'] },
  { key: 'timemoney', name: 'Time & money', sample: '60 minutes = ?', ids: ['timeUnits', 'timeHour', 'monthsDays', 'moneyPound'] },
  { key: 'measures', name: 'Measures', sample: 'cm, kg or ml?', ids: ['units1', 'units2', 'lengthMetre', 'massKilogram', 'capacityLitre', 'temperature'] },
  { key: 'shapes', name: 'Shapes', sample: 'How many sides?', ids: ['shapeSides', 'symmetry', 'angles'] },
  { key: 'wordsorts', name: 'Word sorts', sample: 'their / there', ids: ['nounVerbAdjective', 'pluralRules', 'theirThereTheyre', 'toTooTwo'] }
];
const FEED_GROUP_BY_ID = {};
for (const g of FEED_GROUPS) for (const id of g.ids) FEED_GROUP_BY_ID[id] = g.key;
export function feedGroupOf(id) { return FEED_GROUP_BY_ID[id] || 'numbers'; }
