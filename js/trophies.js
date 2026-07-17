// js/trophies.js — the Trophy Room (RUN4 C4): certificates, medals and trophies
// in a warm wooden cabinet inside the Collection. Unearned items show as
// silhouettes with a hint line — deliberate motivation toward harder content.
// Earning anything plays a fanfare, an unmissable card, and stamps the Journal.

import { el, clear, confetti } from './ui.js';
import { getState, mutate, isMastered, todayKey } from './state.js';
import { COLLECTIBLES, ACCESSORIES } from '../data/catalogue.js';
import { BANKS } from '../data/spellingBanks.js';
import { WORDS } from '../data/spelling.js';
import { TWIN_SETS } from '../data/soundTwins.js';
import { LESSONS } from '../data/lessons.js';
import { stampJournal } from './quests.js';
import { AREA_UNLOCK_STARS } from './areas.js';
import { sfx } from './sfx.js';
import { renderBloomCard } from './bloom.js';

const ALL_ZONES_STARS = Math.max(...Object.values(AREA_UNLOCK_STARS));   // highest gate = Beach (180); the Funfair opens day-one (RUN7 C1)

// ---- named constants (C4) --------------------------------------------------
export const MEDAL_TIERS = [['bronze', 5, '🥉'], ['silver', 15, '🥈'], ['gold', 30, '🥇']];
const ROLL_COURSE_IDS = ['roll1', 'roll2', 'roll3', 'roll4', 'roll5', 'roll6'];   // Boo Roll (RUN9 C4)
export const STAR_MILESTONES = [100, 500, 1000];
export const BOO_MILESTONES = [10, 25, 40];
export const SHINY_MILESTONES = [1, 5, 10];
const TABLES = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const FACTORS = 12;   // facts 1..12 per table (spec §10.3)

const GAME_NAMES = {
  bubblepop: 'Bubble Pop', feedboos: 'Feed the Boos', spellboo: 'Spell Boo',
  blocks: 'Boo Blocks', bounce: 'Boo Bounce', beat: 'Boo Beat',
  teachme: 'Teach Me', dash: 'Boo Dash', clockshop: 'Clock Shop'
};
const GAME_GROUP = {
  bubblepop: 'maths', feedboos: 'maths', clockshop: 'maths', teachme: 'maths',
  spellboo: 'words', blocks: 'adventures', bounce: 'adventures', beat: 'adventures', dash: 'adventures'
};

// ---- criteria helpers -------------------------------------------------------
const cb = (s, k) => (s.catBest && s.catBest[k]) || 0;
const tableMastered = (t) => { for (let f = 1; f <= FACTORS; f++) if (!isMastered(`tmul${t}:${f}`)) return false; return true; };
const bondsMastered = (total, step) => { for (let a = step; a < total; a += step) if (!isMastered(`b${a}:${total}`)) return false; return true; };
const setWords = (id) => id === 'big' ? WORDS : ((BANKS.find(b => b.id === id) || { words: [] }).words);
const spellSetMastered = (id) => { const ws = setWords(id); return ws.length > 0 && ws.every(w => isMastered(w.w)); };
const uniqueBoos = (s) => COLLECTIBLES.filter(it => it.kind === 'boo' && (s.inventory[it.id] || 0) > 0).length
                        + ((s.customs || []).filter(c => c.won).length);
const shinyCount = (s) => Object.values(s.shinies || {}).reduce((a, b) => a + b, 0);
const DECOS = COLLECTIBLES.filter(it => it.kind === 'deco');
const threes = (s, g) => (s.gameThrees && s.gameThrees[g]) || 0;

// Friendly display names for spelling sets (matches the C2 picker mapping).
const SET_LABEL = {
  big: 'The Big List', trickyTh: 'Th Words', prefixesUnDisMisRe: 'Word Starters 1',
  prefixesInIlImIr: 'Word Starters 2', prefixesSuperAntiAutoInterSub: 'Super Starters',
  lyFamily: 'The ly Endings', ousFamily: 'The ous Endings', tionSionSsionCian: 'The shun Endings',
  chSoundsLikeK: 'Sneaky ch says k', chSoundsLikeSh: 'Sneaky ch says sh', gueAndQue: 'Silent Enders',
  silentIshSc: 'Silent c Words', eiEighEy: 'The eigh Gang', ouSoundsLikeU: 'Short ou Words',
  tureFamily: 'The ture Words', doubleOrNotEndings: 'Double Trouble', homophones: 'Homophones'
};
const twinLabel = (set) => set.options.join(' / ');

// ---- the full catalogue of earnables ---------------------------------------
// { key, type: certificate|medal|trophy, group: maths|words|collector|adventures,
//   label, hint, icon, earned(state)->bool }
export function buildCatalog() {
  const items = [];
  // Certificates — mastery, from the Smart Mix ledger (C4)
  for (const t of TABLES) items.push({
    key: `cert_table_${t}`, type: 'certificate', group: 'maths',
    label: `${t} times table`, hint: `Master your ${t} times table…`, icon: '📜',
    earned: () => tableMastered(t)
  });
  items.push(
    { key: 'cert_bonds10', type: 'certificate', group: 'maths', label: 'Number Bonds to 10', hint: 'Master every bond that makes 10…', icon: '📜', earned: () => bondsMastered(10, 1) },
    { key: 'cert_bonds20', type: 'certificate', group: 'maths', label: 'Number Bonds to 20', hint: 'Master every bond that makes 20…', icon: '📜', earned: () => bondsMastered(20, 1) },
    { key: 'cert_bonds100', type: 'certificate', group: 'maths', label: 'Number Bonds to 100', hint: 'Master the fives that make 100…', icon: '📜', earned: () => bondsMastered(100, 5) }
  );
  for (const lv of [1, 2, 3]) items.push({
    key: `cert_clock_${lv}`, type: 'certificate', group: 'maths',
    label: `Clock Shop Level ${lv}`, hint: `Three stars on Clock Shop Level ${lv}…`, icon: '📜',
    earned: (s) => cb(s, 'clockshop:l' + lv) >= 3
  });
  items.push({
    key: 'cert_teachme', type: 'certificate', group: 'maths',
    label: 'Teach Me graduate', hint: 'Finish every Teach Me lesson…', icon: '📜',
    earned: (s) => LESSONS.every(l => cb(s, 'teachme:' + l.id) >= 1)
  });
  for (const id of ['big', ...BANKS.map(b => b.id)]) items.push({
    key: `cert_spell_${id}`, type: 'certificate', group: 'words',
    label: SET_LABEL[id] || id, hint: `Master every word in ${SET_LABEL[id] || id}…`, icon: '📜',
    earned: () => spellSetMastered(id)
  });
  for (const set of TWIN_SETS) items.push({
    key: `cert_twin_${set.id}`, type: 'certificate', group: 'words',
    label: `Sound Twins: ${twinLabel(set)}`, hint: `Master ${twinLabel(set)}…`, icon: '📜',
    earned: () => isMastered('twin:' + set.id)
  });
  // Medals — per game by lifetime 3-star rounds (counters start at this update)
  for (const g of Object.keys(GAME_NAMES)) for (const [tier, need, icon] of MEDAL_TIERS) items.push({
    key: `medal_${g}_${tier}`, type: 'medal', group: GAME_GROUP[g], tier,
    label: `${GAME_NAMES[g]}: ${tier}`, hint: `${need} three-star ${GAME_NAMES[g]} rounds…`, icon,
    earned: (s) => threes(s, g) >= need
  });
  // Star milestones
  for (const n of STAR_MILESTONES) items.push({
    key: `medal_stars_${n}`, type: 'medal', group: 'adventures', tier: n >= 1000 ? 'gold' : n >= 500 ? 'silver' : 'bronze',
    label: `${n} total stars`, hint: `Earn ${n} stars all together…`, icon: '⭐',
    earned: (s) => (s.stars && s.stars.total || 0) >= n
  });
  // Collector medals
  for (const n of BOO_MILESTONES) items.push({
    key: `medal_boos_${n}`, type: 'medal', group: 'collector', tier: n >= 40 ? 'gold' : n >= 25 ? 'silver' : 'bronze',
    label: `${n} unique Boos`, hint: `Welcome ${n} different Boos home…`, icon: '🐾',
    earned: (s) => uniqueBoos(s) >= n
  });
  for (const n of SHINY_MILESTONES) items.push({
    key: `medal_shiny_${n}`, type: 'medal', group: 'collector', tier: n >= 10 ? 'gold' : n >= 5 ? 'silver' : 'bronze',
    label: n === 1 ? 'First shiny Boo' : `${n} shiny Boos`, hint: n === 1 ? 'Find a shiny Boo…' : `Collect ${n} shinies…`, icon: '✨',
    earned: (s) => shinyCount(s) >= n
  });
  items.push(
    { key: 'medal_decos', type: 'medal', group: 'collector', tier: 'gold', label: 'Every decoration', hint: 'Collect every decoration…', icon: '🏡', earned: (s) => DECOS.every(d => (s.inventory[d.id] || 0) > 0) },
    { key: 'medal_accs', type: 'medal', group: 'collector', tier: 'gold', label: 'Every accessory', hint: 'Collect every accessory…', icon: '🎀', earned: (s) => ACCESSORIES.every(a => (s.inventory[a.id] || 0) > 0) }
  );
  // Trophies — one-offs
  items.push(
    { key: 'trophy_zones', type: 'trophy', group: 'adventures', label: 'Every Zone Open', hint: 'Open every part of the town…', icon: '🏆', earned: (s) => (s.stars && s.stars.total || 0) >= ALL_ZONES_STARS },
    { key: 'trophy_lessons', type: 'trophy', group: 'maths', label: 'Lesson Legend', hint: 'Three stars on every Teach Me lesson…', icon: '🏆', earned: (s) => LESSONS.every(l => cb(s, 'teachme:' + l.id) >= 3) },
    { key: 'trophy_custom', type: 'trophy', group: 'collector', label: 'First Custom Boo Won', hint: 'Win a Boo you built yourself…', icon: '🏆', earned: (s) => (s.customs || []).some(c => c.won) },
    { key: 'trophy_golden', type: 'trophy', group: 'adventures', label: 'Golden Round Champion', hint: 'Three stars on a Golden Round…', icon: '🏆', earned: (s) => !!(s.journal && s.journal.golden3) },
    { key: 'trophy_sparkle_meadow', type: 'trophy', group: 'adventures', label: 'Sparkle Meadow Explorer', hint: 'Finish the first Boo Quest land…', icon: '🏆', earned: (s) => !!(s.quest && s.quest.lands && s.quest.lands.sparkle_meadow) },
    { key: 'trophy_expedition_first', type: 'trophy', group: 'adventures', label: 'First Expedition', hint: 'Finish every stop on the Expedition trail…', icon: '🧭', earned: (s) => !!(s.expedition && s.expedition.full) },
    { key: 'trophy_expedition_tier4', type: 'trophy', group: 'adventures', label: 'Tier 4 Master', hint: 'Reach Tier IV at every Expedition stop…', icon: '🏔️', earned: (s) => ['bridges', 'picnic', 'raft', 'hotel'].every(key => ((s.expedition && s.expedition.tiers && s.expedition.tiers[key]) || 1) >= 4) },
    // Boo Roll medals (RUN9 C4) — the six course ids are roll1..roll6
    { key: 'trophy_roll_first', type: 'trophy', group: 'adventures', label: 'First Medal!', hint: 'Win any medal in Boo Roll…', icon: '🏅', earned: (s) => Object.keys((s.booRoll && s.booRoll.medals) || {}).length > 0 },
    { key: 'trophy_roll_bronze', type: 'trophy', group: 'adventures', label: 'All Courses Rolled', hint: 'Earn a medal on every Boo Roll course…', icon: '🥉', earned: (s) => ROLL_COURSE_IDS.every(id => !!((s.booRoll && s.booRoll.medals) || {})[id]) },
    { key: 'trophy_roll_gold', type: 'trophy', group: 'adventures', label: 'Golden Roller', hint: 'Earn GOLD on every Boo Roll course…', icon: '🥇', earned: (s) => ROLL_COURSE_IDS.every(id => (((s.booRoll && s.booRoll.medals) || {})[id]) === 'gold') }
  );
  return items;
}
export const CATALOG = buildCatalog();
const BY_KEY = Object.fromEntries(CATALOG.map(c => [c.key, c]));

// ---- evaluation + awarding ---------------------------------------------------
// Checks every criterion against the save; newly earned keys are stamped with
// today's date and into the Journal. Returns the list of newly earned items.
export function evaluateTrophies() {
  const s = getState();
  if (!s) return [];
  const fresh = [];
  for (const c of CATALOG) {
    if (s.trophies && s.trophies[c.key]) continue;
    let ok = false;
    try { ok = !!c.earned(s); } catch {}
    if (!ok) continue;
    fresh.push(c);
  }
  if (fresh.length) {
    mutate(st => {
      st.trophies = st.trophies || {};
      for (const c of fresh) st.trophies[c.key] = todayKey();
    });
    for (const c of fresh) stampJournal('trophy_' + c.key);
  }
  return fresh;
}

// ---- the ceremony -------------------------------------------------------------
// An unmissable card (or a gentle cabinet-opening for the migration retro-award).
export function showTrophyCeremony(items, { retro = false } = {}) {
  if (!items.length) return;
  const ov = el('div', { class: 'overlay trophy-ceremony' });
  const cards = el('div', { class: 'tc-cards' });
  for (const c of items.slice(0, 12)) cards.appendChild(trophyCard(c, { earned: true }));
  if (items.length > 12) cards.appendChild(el('div', { class: 'tc-more', text: `…and ${items.length - 12} more!` }));
  const panel = el('div', { class: 'card tc-panel' }, [
    el('h2', { class: 'tc-title', text: retro ? 'The Trophy Room is open!' : (items.length > 1 ? 'New trophies!' : newLabel(items[0])) }),
    retro ? el('p', { class: 'tc-sub', text: 'Look what you had already earned:' }) : null,
    cards,
    el('button', { class: 'btn big', text: retro ? 'To my cabinet! 🏆' : 'Wonderful!', onclick: () => { sfx.tap(); ov.remove(); } })
  ]);
  ov.appendChild(panel);
  document.body.appendChild(ov);
  requestAnimationFrame(() => ov.classList.add('show'));
  try { sfx.fanfare(); } catch {}
  confetti({ count: retro ? 120 : 80, power: 1 });
}
function newLabel(c) {
  return c.type === 'certificate' ? 'A certificate!' : c.type === 'medal' ? 'A new medal!' : 'A TROPHY!';
}

// Evaluate + celebrate in one call (used by results / ceremony / hub).
export function checkAndCelebrate() {
  const fresh = evaluateTrophies();
  if (fresh.length) showTrophyCeremony(fresh);
  return fresh;
}

// The one-time retroactive award for existing saves (RUN4 C4): everything
// derivable from the old save lands at once in a single gentle ceremony.
export function retroAwardOnce() {
  const s = getState();
  if (!s || (s.seen && s.seen.trophyRetro)) return [];
  mutate(st => { st.seen.trophyRetro = true; });
  const fresh = evaluateTrophies();
  if (fresh.length) showTrophyCeremony(fresh, { retro: true });
  return fresh;
}

// ---- the Trophy Room tab -------------------------------------------------------
const CHIPS = [['maths', '🔢 Maths'], ['words', '🔤 Words'], ['collector', '🧸 Collector'], ['adventures', '🗺️ Adventures']];

export function renderTrophyRoom(container) {
  const s = getState();
  let filter = 'maths';
  const room = el('div', { class: 'trophy-room' });
  const chipRow = el('div', { class: 'chip-row center trophy-chips' });
  const shelfWrap = el('div', { class: 'trophy-cabinet' });
  const chips = {};
  for (const [key, label] of CHIPS) {
    const b = el('button', { class: 'acc-chip troph-chip' + (filter === key ? ' sel' : ''), text: label, onclick: () => { sfx.tap(); filter = key; Object.entries(chips).forEach(([k, c]) => c.classList.toggle('sel', k === key)); renderShelves(); } });
    chips[key] = b; chipRow.appendChild(b);
  }
  function renderShelves() {
    clear(shelfWrap);
    const items = CATALOG.filter(c => c.group === filter);
    const groups = [['certificate', 'Certificates'], ['medal', 'Medals'], ['trophy', 'Trophies']];
    for (const [type, label] of groups) {
      const here = items.filter(c => c.type === type);
      if (!here.length) continue;
      shelfWrap.appendChild(el('div', { class: 'shelf-label', text: label }));
      const shelf = el('div', { class: 'trophy-shelf' });
      for (const c of here) shelf.appendChild(trophyCard(c, { earned: !!(s.trophies && s.trophies[c.key]), date: s.trophies && s.trophies[c.key] }));
      shelfWrap.appendChild(shelf);
    }
    const earned = items.filter(c => s.trophies && s.trophies[c.key]).length;
    shelfWrap.appendChild(el('p', { class: 'trophy-count', text: `${earned} of ${items.length} earned here` }));
  }
  renderShelves();
  room.append(chipRow, shelfWrap);
  renderBloomCard(room);
  container.appendChild(room);
  return room;
}

// One trophy/certificate/medal card. Unearned = silhouette + hint (motivation!).
export function trophyCard(c, { earned = false, date = null } = {}) {
  return el('div', { class: `trophy-card t-${c.type} tier-${c.tier || 'none'}` + (earned ? ' earned' : ' silhouette') }, [
    el('div', { class: 'tc-ic', text: c.icon }),
    el('div', { class: 'tc-label', text: c.label }),
    el('div', { class: 'tc-hint', text: earned ? (date ? 'Earned ' + date : 'Earned!') : c.hint })
  ]);
}
