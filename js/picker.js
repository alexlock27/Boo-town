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

// buildPicker({ game, choices:[{key,name}], levelsFor(key)->[...], levelName(l)->str, onStart(key,level) })
// Returns { node } — a two-step picker with best-star badges and a remembered default.
export function buildPicker({ game, choices, levelsFor, levelName = (l) => 'Level ' + l, onStart }) {
  const last = lastPick(game);
  let choice = (last && choices.some(c => c.key === last.choice)) ? last.choice : choices[0].key;

  const wrap = el('div', { class: 'picker' });
  const choiceRow = el('div', { class: 'picker-choices' });
  const levelWrap = el('div', { class: 'picker-levels' });

  const choiceBtns = {};
  choices.forEach(c => {
    const badge = bestStars(game, c.key);
    const btn = el('button', { class: 'picker-choice' + (choice === c.key ? ' sel' : ''), onclick: () => selectChoice(c.key) }, [
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
  function renderLevels() {
    levelWrap.innerHTML = '';
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

  wrap.append(el('p', { class: 'sc-q', text: 'What shall we practise?' }), choiceRow, el('p', { class: 'sc-q', text: 'Pick a level' }), levelWrap);
  return { node: wrap, getChoice: () => choice };
}
