// js/picker.js — shared two-step start-card picker (EXPANSION_1 §5).
// Step 1: pick a category / word-set (with per-choice best-star badges).
// Step 2: pick a level (friendly names). Default selection = whatever was played last.

import { el, starsRow } from './ui.js';
import { getState, mutate } from './state.js';
import { sfx } from './sfx.js';

export function bestStars(game, choice) {
  const s = getState();
  return (s && s.catBest && s.catBest[`${game}:${choice}`]) || 0;
}
export function recordBest(game, choice, stars) {
  mutate(s => { const k = `${game}:${choice}`; s.catBest[k] = Math.max(s.catBest[k] || 0, stars); });
}
export function lastPick(game) {
  const s = getState();
  return (s && s.seen && s.seen.lastPick && s.seen.lastPick[game]) || null;
}
export function saveLastPick(game, choice, level) {
  mutate(s => { s.seen.lastPick = s.seen.lastPick || {}; s.seen.lastPick[game] = { choice, level }; });
}

// Smart Mix is the first card on every picker (RUN3 C2): the app quietly serves what
// she gets wrong, drawing from ALL installed content. Selecting it needs no level.
export const MIX_KEY = '__mix__';

// buildPicker({ game, choices:[{key,name}], levelsFor(key)->[...], levelName(l)->str, onStart(key,level), smartMix=true })
// Returns { node } — a two-step picker with best-star badges and a remembered default.
export function buildPicker({ game, choices, levelsFor, levelName = (l) => 'Level ' + l, onStart, smartMix = true }) {
  if (smartMix) choices = [{ key: MIX_KEY, name: '✨ Smart Mix' }, ...choices];
  const last = lastPick(game);
  // Smart Mix is the first card, but the default selection stays a real category unless she
  // last chose Mix — so a first-time tap on a level plays a normal round, not Mix by surprise.
  const firstReal = choices.find(c => c.key !== MIX_KEY) || choices[0];
  let choice = (last && choices.some(c => c.key === last.choice)) ? last.choice : firstReal.key;

  const wrap = el('div', { class: 'picker' });
  const choiceRow = el('div', { class: 'picker-choices' });
  const levelWrap = el('div', { class: 'picker-levels' });

  const choiceBtns = {};
  choices.forEach(c => {
    const badge = bestStars(game, c.key);
    const btn = el('button', { class: 'picker-choice' + (c.key === MIX_KEY ? ' mix' : '') + (choice === c.key ? ' sel' : ''), onclick: () => selectChoice(c.key) }, [
      el('span', { class: 'pc-name', text: c.name }),
      badge > 0 ? el('span', { class: 'pc-badge', html: starsRow(badge, { size: 15 }) }) : null
    ]);
    choiceBtns[c.key] = btn;
    choiceRow.appendChild(btn);
  });

  function selectChoice(key) {
    choice = key; sfx.tap();
    Object.entries(choiceBtns).forEach(([k, b]) => b.classList.toggle('sel', k === key));
    renderLevels();
  }
  const levelPrompt = el('p', { class: 'sc-q level-prompt', text: 'Pick a level' });
  function renderLevels() {
    levelWrap.innerHTML = '';
    if (choice === MIX_KEY) {
      levelPrompt.textContent = "I'll pick a mix just for you";
      const btn = el('button', { class: 'btn level-btn mix-start', onclick: () => { sfx.tap(); saveLastPick(game, choice, null); onStart(MIX_KEY, null); } }, [
        el('span', { class: 'lv-num', text: 'Start Smart Mix ✨' })
      ]);
      levelWrap.appendChild(btn);
      return;
    }
    levelPrompt.textContent = 'Pick a level';
    const levels = levelsFor(choice);
    const defLevel = (last && last.choice === choice) ? last.level : null;
    for (const lv of levels) {
      const btn = el('button', { class: 'btn level-btn' + (defLevel === lv ? ' recent' : ''), onclick: () => { sfx.tap(); saveLastPick(game, choice, lv); onStart(choice, lv); } }, [
        el('span', { class: 'lv-num', text: levelName(lv) })
      ]);
      levelWrap.appendChild(btn);
    }
  }
  renderLevels();

  wrap.append(el('p', { class: 'sc-q', text: 'What shall we practise?' }), choiceRow, levelPrompt, levelWrap);
  return { node: wrap, getChoice: () => choice };
}
