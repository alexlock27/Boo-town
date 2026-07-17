// js/care.js — RUN10 P12. Affection is permanent, optional and never a chore.
import { el, confetti, sparkleAt, REDUCED } from './ui.js';
import { getState, mutate } from './state.js';
import { sfx } from './sfx.js';
import { personalityOf } from '../data/personalities.js';
import { LEVELS, POINTS, POCKET_CAP, TREAT_PER_ROUND } from '../data/care.js';

export { LEVELS, POINTS, POCKET_CAP, TREAT_PER_ROUND };
let noTreatTaught = false;
export function careState() { const c = getState().care || {}; return { treats: c.treats || 0, bonds: c.bonds || {} }; }
export function heartsFor(points = 0) { return LEVELS.reduce((n, level) => n + (points >= level ? 1 : 0), 0); }
export function bondFor(booId) { return careState().bonds[booId] || 0; }
export function grantTreat() { let gained = false; mutate(s => { s.care = s.care || { bonds: {}, treats: 0, rewards: {} }; if ((s.care.treats || 0) < POCKET_CAP) { s.care.treats++; gained = true; } }); return gained; }
export function addBond(booId, action) {
  const before = bondFor(booId), amount = POINTS[action] || 0;
  let after = before;
  mutate(s => { s.care = s.care || { bonds: {}, treats: 0, rewards: {} }; s.care.bonds = s.care.bonds || {}; s.care.rewards = s.care.rewards || {}; after = (s.care.bonds[booId] || 0) + amount; s.care.bonds[booId] = after; for (let i = 1; i < LEVELS.length; i++) if (before < LEVELS[i] && after >= LEVELS[i]) s.care.rewards[`${booId}:${i + 1}`] = true; });
  return { before, after, hearts: heartsFor(after), levelUp: heartsFor(after) > heartsFor(before) };
}

export function openCare(booId, booName, { onDone } = {}) {
  const wrap = el('div', { class: 'care-overlay', onclick: e => { if (e.target === wrap) close(); } });
  const panel = el('div', { class: 'care-panel card' }), heartRow = el('div', { class: 'care-hearts' }), status = el('p', { class: 'care-status', text: 'A little kindness, just because. 💗' });
  const art = el('div', { class: 'care-boo', text: '👻' });
  const actions = el('div', { class: 'care-actions' });
  const refresh = () => { const c = careState(), points = c.bonds[booId] || 0; heartRow.textContent = '♥'.repeat(heartsFor(points)) + '♡'.repeat(5 - heartsFor(points)); actions.querySelector('[data-care="feed"]').disabled = c.treats < 1; actions.querySelector('[data-care="feed"]').textContent = `🍪 Feed (${c.treats})`; };
  const finish = action => {
    const result = addBond(booId, action); const flavour = { cheeky: 'snatches it with a grin!', shy: 'peeks out, delighted!', sleepy: 'gives a cosy yawn!', sporty: 'does a tiny victory bounce!' }[personalityOf(booId)] || 'looks very pleased!';
    status.textContent = `${booName} ${flavour} +${POINTS[action]} bond`;
    art.classList.remove('care-celebrate'); void art.offsetWidth; art.classList.add('care-celebrate'); sfx.star(); if (!REDUCED) confetti({ count: 18, power: .45 });
    if (result.levelUp) status.textContent += ` · Best-friend level ${result.hearts}!`;
    refresh(); onDone && onDone(result);
  };
  const choose = action => {
    if (action === 'feed') { let allowed = false; mutate(s => { s.care = s.care || { bonds: {}, treats: 0, rewards: {} }; if (s.care.treats > 0) { s.care.treats--; allowed = true; } }); if (!allowed) { status.textContent = noTreatTaught ? 'No treats right now.' : 'Win a round to earn a treat!'; noTreatTaught = true; refresh(); return; } art.textContent = '😋'; setTimeout(() => { art.textContent = '👻'; finish(action); }, 600); return; }
    if (action === 'brush') { status.textContent = 'Brush brush brush — three strokes!'; let strokes = 0; const stroke = () => { if (++strokes < 3) { status.textContent = `Brush brush… ${3 - strokes} more!`; return; } art.removeEventListener('click', stroke); finish(action); }; art.addEventListener('click', stroke); return; }
    if (action === 'teeth') { status.textContent = 'Tap six alternating sparkly scrubs!'; let taps = 0; const scrub = () => { if (++taps < 6) { status.textContent = `Sparkly teeth… ${6 - taps} more!`; return; } art.removeEventListener('click', scrub); finish(action); }; art.addEventListener('click', scrub); return; }
    status.textContent = 'Peekaboo! Tap the Boo three times as they pop out.'; let pops = 0; const pop = () => { if (++pops < 3) { art.classList.toggle('care-hide'); return; } art.removeEventListener('click', pop); finish(action); }; art.addEventListener('click', pop);
  };
  [['feed', '🍪 Feed'], ['brush', '🪥 Brush'], ['teeth', '✨ Teeth'], ['play', '🙈 Play']].forEach(([key, label]) => actions.appendChild(el('button', { class: 'btn care-action', dataset: { care: key }, text: label, onclick: () => choose(key) })));
  panel.append(el('h2', { text: `Care for ${booName}` }), art, heartRow, status, actions, el('button', { class: 'btn soft', text: 'Done', onclick: close })); wrap.appendChild(panel); document.body.appendChild(wrap); refresh();
  function close() { wrap.remove(); }
  return { close };
}
