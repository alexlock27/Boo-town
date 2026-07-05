// js/quests.js — daily quests + the Boo Journal (RUN3 C4).
// Three fresh quests each local day (no streaks, no missed-day guilt — rule 1). Completing
// all three awards a bonus box. The Journal self-stamps milestones as dated stickers.

import { getState, mutate, todayKey } from './state.js';
import { addMeterPoints } from './rewards.js';
import { braveTargetRank, rankName } from './comfort.js';

// "Try Level {comfort+1} of any game" resolves against her current comfort (C3).
function braveTargetName() { return rankName(braveTargetRank()); }

const rand = (n) => (Math.random() * n) | 0;
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// Each quest: id, label, icon, need (progress target), available(state)->bool, match(event,data)->increment.
const MATHS_GAMES = ['bubblepop', 'feedboos', 'blocks', 'bounce', 'beat', 'dash'];
export const QUEST_TEMPLATES = [
  { id: 'spell2', label: 'Earn 2 stars in a spelling round', icon: '🔤', need: 1, match: (e, d) => e === 'roundEnd' && d.game === 'spellboo' && d.stars >= 2 ? 1 : 0 },
  { id: 'playMaths', label: 'Play a maths game', icon: '🔢', need: 1, match: (e, d) => e === 'roundEnd' && MATHS_GAMES.includes(d.game) ? 1 : 0 },
  { id: 'visitTown', label: 'Visit the town', icon: '🏡', need: 1, match: (e) => e === 'townVisit' ? 1 : 0 },
  { id: 'threeStar', label: '3-star any round', icon: '⭐', need: 1, match: (e, d) => e === 'roundEnd' && d.stars >= 3 ? 1 : 0 },
  { id: 'rescuePile', label: 'Rescue the Tricky Pile', icon: '🧩', need: 1, match: (e) => e === 'rescue' ? 1 : 0 },
  { id: 'dressUp', label: 'Dress up a Boo', icon: '🎀', need: 1, match: (e) => e === 'dressUp' ? 1 : 0 },
  { id: 'golden', label: 'Play the Golden Round', icon: '🌟', need: 1, available: (s) => !!(s.golden && ((s.golden.words || []).length || (s.golden.choices || []).length)), match: (e, d) => e === 'roundEnd' && d.game === 'golden' ? 1 : 0 },
  { id: 'blocks3', label: 'Clear 3 lines in Boo Blocks', icon: '🟪', need: 3, match: (e, d) => e === 'linesCleared' ? (d.count || 0) : 0 },
  { id: 'beat3', label: 'Get 3 Perfects in Boo Beat', icon: '🎵', need: 3, match: (e, d) => e === 'perfects' ? (d.count || 0) : 0 },
  { id: 'lesson', label: 'Finish a Teach Me lesson', icon: '🎓', need: 1, match: (e, d) => e === 'roundEnd' && d.game === 'teachme' ? 1 : 0 },
  { id: 'hello5', label: 'Say hello to 5 Boos', icon: '💜', need: 5, match: (e, d) => e === 'sayHello' ? (d.count || 1) : 0 },
  { id: 'openBox', label: 'Open a box', icon: '🎁', need: 1, match: (e) => e === 'boxOpen' ? 1 : 0 },
  // Stretch quests (RUN4 C3): gentle pulls upward, completed by any Brave round
  // (a round above that category's comfort level). Labels resolve at display time.
  { id: 'brave2', label: 'Earn 2 stars on a Brave round', icon: '🧗', need: 1, match: (e, d) => e === 'braveRound' && (d.stars || 0) >= 2 ? 1 : 0 },
  { id: 'braveTry', label: (s) => `Try ${braveTargetName(s)} of any game`, icon: '🚀', need: 1, match: (e) => e === 'braveRound' ? 1 : 0 }
];
const TEMPLATE_BY_ID = Object.fromEntries(QUEST_TEMPLATES.map(t => [t.id, t]));

// Ensure today's three quests exist (regenerate on a new local day). No streak state is kept.
export function ensureToday() {
  const s = getState();
  const day = todayKey();
  if (s.quests && s.quests.day === day && (s.quests.list || []).length) return;
  const pool = QUEST_TEMPLATES.filter(t => !t.available || t.available(s));
  const chosen = shuffle(pool.slice()).slice(0, 3).map(t => t.id);
  mutate(st => { st.quests = { day, list: chosen, done: [], progress: {}, boxDay: st.quests ? st.quests.boxDay : '' }; });
}

// Feed an event to the quests; award the bonus box + Journal stamp when all three are done.
export function noteQuest(event, data = {}) {
  ensureToday();
  const s = getState();
  const q = s.quests;
  let changed = false;
  for (const id of q.list) {
    if (q.done.includes(id)) continue;
    const tmpl = TEMPLATE_BY_ID[id]; if (!tmpl) continue;
    const inc = tmpl.match(event, data);
    if (inc > 0) {
      const cur = (q.progress[id] || 0) + inc;
      mutate(st => { st.quests.progress[id] = cur; });
      if (cur >= tmpl.need && !q.done.includes(id)) { mutate(st => { st.quests.done.push(id); }); changed = true; }
    }
  }
  if (changed) {
    const st2 = getState();
    if (st2.quests.done.length >= 3 && st2.quests.boxDay !== st2.quests.day) {
      mutate(st => { st.quests.boxDay = st.quests.day; st.boxes += 1; });   // bonus box for all three
      stampJournal('allQuests:' + todayKey());
      return { allDone: true };
    }
  }
  return { allDone: false };
}

export function questState() {
  ensureToday();
  const s = getState();
  const q = s.quests;
  const items = q.list.map(id => { const t = TEMPLATE_BY_ID[id]; const prog = q.progress[id] || 0; return { id, label: typeof t.label === 'function' ? t.label(s) : t.label, icon: t.icon, need: t.need, progress: Math.min(prog, t.need), done: q.done.includes(id) }; });
  return { day: q.day, items, doneCount: q.done.length, allDone: q.done.length >= 3 };
}

// ---- the Boo Journal ---------------------------------------------------------
// One-time stamps keyed by id; repeatable ones (all-quests days) keyed id:date.
export const JOURNAL_CATALOG = [
  { key: 'firstRare', label: 'First Rare Boo', icon: '💠' },
  { key: 'firstUltra', label: 'First Ultra Boo', icon: '✨' },
  { key: 'firstSecret', label: 'First Secret Boo', icon: '🎧' },
  { key: 'firstCustom', label: 'First Boo you built', icon: '🎨' },
  { key: 'firstCustomWin', label: 'Won your own Boo', icon: '🏆' },
  { key: 'golden3', label: 'Golden Round, 3 stars', icon: '🌟' },
  { key: 'firstRoutine', label: 'First dance routine', icon: '💃' },
  { prefix: 'star3_', label: '3 stars', icon: '⭐' },
  { prefix: 'zone_', label: 'Unlocked', icon: '🗺️' },
  { prefix: 'allQuests', label: 'All quests done', icon: '🎯' }
];

// Record a stamp with today's date if not already present. Returns true if newly stamped.
export function stampJournal(key) {
  const s = getState();
  if (s.journal && s.journal[key]) return false;
  mutate(st => { st.journal = st.journal || {}; st.journal[key] = todayKey(); });
  return true;
}
export function hasStamp(key) { const s = getState(); return !!(s.journal && s.journal[key]); }

// Pretty label + icon for a stamp key (resolves prefixes like star3_bubblepop, zone_riverside).
export function stampMeta(key) {
  for (const c of JOURNAL_CATALOG) {
    if (c.key && key === c.key) return { icon: c.icon, label: c.label };
    if (c.prefix && key.startsWith(c.prefix)) {
      const rest = key.slice(c.prefix.length).replace(/^_/, '').replace(/:.*/, '');
      const nice = rest ? rest.charAt(0).toUpperCase() + rest.slice(1) : '';
      return { icon: c.icon, label: c.prefix === 'star3_' ? `${nice}: 3 stars` : c.prefix === 'zone_' ? `Unlocked ${nice}` : c.label };
    }
  }
  return { icon: '🏅', label: key };
}
export function journalEntries() {
  const s = getState();
  const j = (s && s.journal) || {};
  return Object.keys(j).map(key => ({ key, date: j[key], ...stampMeta(key) })).sort((a, b) => (a.date < b.date ? -1 : 1));
}
