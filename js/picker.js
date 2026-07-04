// js/picker.js — shared two-step start-card picker (EXPANSION_1 §5, RUN4 C2).
// Step 1: pick a category / word-set (with per-choice best-star badges).
// Step 2: pick a level (friendly names). Default selection = whatever was played last.
// "Pick for me!" (RUN4 C2) sits first on every picker: one tap starts a Smart Mix
// round with no further choices. Choices may carry `sub` (two small sample words /
// a sample question) and, at the Full tier, `group` labels that collapse under
// calm little headers.

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

// Smart Mix under the hood: the app quietly serves what she gets wrong, drawing
// from ALL installed content. Child-facing it is "Pick for me!" (RUN4 C2).
export const MIX_KEY = '__mix__';

function diceSVG(size = 26) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true">
    <rect x="2.5" y="2.5" width="19" height="19" rx="5" fill="var(--card)" stroke="var(--ink)" stroke-width="2"/>
    <circle cx="8" cy="8" r="1.9" fill="var(--ink)"/><circle cx="16" cy="8" r="1.9" fill="var(--ink)"/>
    <circle cx="12" cy="12" r="1.9" fill="var(--ink)"/>
    <circle cx="8" cy="16" r="1.9" fill="var(--ink)"/><circle cx="16" cy="16" r="1.9" fill="var(--ink)"/>
  </svg>`;
}

// The one-tap "Pick for me!" control (RUN4 C2) — shared by buildPicker and the
// arcade start cards so it looks and behaves identically everywhere.
export function pickForMeButton(onTap) {
  return el('button', { class: 'picker-choice mix pickforme', onclick: () => { sfx.tap(); onTap(); } }, [
    el('span', { class: 'pfm-dice', html: diceSVG() }),
    el('span', { class: 'pc-name', text: 'Pick for me!' })
  ]);
}

// buildPicker({ game, choices:[{key,name,sub?,group?}], levelsFor(key)->[...],
//   levelName(l)->str, onStart(key,level), smartMix=true, groupOrder:[label,...] })
// Returns { node } — a two-step picker with best-star badges and a remembered default.
export function buildPicker({ game, choices, levelsFor, levelName = (l) => 'Level ' + l, onStart, smartMix = true, groupOrder = [] }) {
  const last = lastPick(game);
  // The default selection is always a real category (Pick for me is a one-tap
  // door, never a selection), so a first-time tap on a level plays a normal round.
  const firstReal = choices.find(c => c.key !== MIX_KEY) || choices[0];
  let choice = (last && last.choice !== MIX_KEY && choices.some(c => c.key === last.choice)) ? last.choice : firstReal.key;

  const wrap = el('div', { class: 'picker' });
  const choiceRow = el('div', { class: 'picker-choices' });
  const levelWrap = el('div', { class: 'picker-levels' });

  if (smartMix) {
    choiceRow.appendChild(pickForMeButton(() => { saveLastPick(game, MIX_KEY, null); onStart(MIX_KEY, null); }));
  }

  const choiceBtns = {};
  const makeChoiceBtn = (c) => {
    const badge = bestStars(game, c.key);
    const btn = el('button', { class: 'picker-choice' + (choice === c.key ? ' sel' : ''), onclick: () => selectChoice(c.key) }, [
      el('span', { class: 'pc-name', text: c.name }),
      c.sub ? el('span', { class: 'pc-sub', text: c.sub }) : null,
      badge > 0 ? el('span', { class: 'pc-badge', html: starsRow(badge, { size: 15 }) }) : null
    ]);
    choiceBtns[c.key] = btn;
    return btn;
  };

  // Grouped choices collapse under calm headers (RUN4 C2, Full tier); the group
  // holding the remembered pick starts open, everything else starts closed.
  const real = choices.filter(c => c.key !== MIX_KEY);
  real.filter(c => !c.group).forEach(c => choiceRow.appendChild(makeChoiceBtn(c)));
  const labels = [...new Set(real.filter(c => c.group).map(c => c.group))]
    .sort((a, b) => {
      const ia = groupOrder.indexOf(a), ib = groupOrder.indexOf(b);
      return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
    });
  for (const label of labels) {
    const members = real.filter(c => c.group === label);
    const body = el('div', { class: 'pg-body' });
    members.forEach(c => body.appendChild(makeChoiceBtn(c)));
    const open = members.some(c => c.key === choice);
    const head = el('button', { class: 'pg-head', dataset: { open: String(open) } }, [
      el('span', { text: label }),
      el('span', { class: 'pg-count', text: String(members.length) }),
      el('span', { class: 'pg-arrow', text: '▸' })
    ]);
    head.addEventListener('click', () => {
      sfx.tap();
      head.dataset.open = head.dataset.open === 'true' ? 'false' : 'true';
    });
    choiceRow.appendChild(el('div', { class: 'picker-group' }, [head, body]));
  }

  function selectChoice(key) {
    choice = key; sfx.tap();
    Object.entries(choiceBtns).forEach(([k, b]) => b.classList.toggle('sel', k === key));
    renderLevels();
  }
  const levelPrompt = el('p', { class: 'sc-q level-prompt', text: 'Pick a level' });
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

  wrap.append(el('p', { class: 'sc-q', text: 'What shall we practise?' }), choiceRow, levelPrompt, levelWrap);
  return { node: wrap, getChoice: () => choice };
}
