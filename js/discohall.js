import { el, REDUCED } from './ui.js';
import { getState } from './state.js';
import { BY_ID } from '../data/catalogue.js';
import { personalityOf } from '../data/personalities.js';
import { BOO_POP_HITS } from '../data/songs.js';

const MOVE = { bouncy: 'bounce', sleepy: 'sway', cheeky: 'spin', shy: 'sway-small', musical: 'shimmy', sporty: 'star-jump' };
const ROUTINE_MOVE = { bounce: 'bounce', spin: 'spin', wiggle: 'shimmy', jump: 'star-jump', clap: 'bounce', slide: 'sway', starpose: 'star-jump', freeze: 'sway-small' };
export function beatAt(now, bpm) { return Math.floor(now / (60000 / bpm)); }

export function mount(container, params, ctx) {
  const root = el('div', { class: 'screen discohall' }), floor = el('div', { class: 'disco-floor' }), dancers = el('div', { class: 'disco-dancers' });
  container.appendChild(root); for (let index = 0; index < 24; index++) floor.appendChild(el('i'));
  const boos = Object.keys(getState().inventory || {}).filter(id => getState().inventory[id] > 0 && BY_ID[id]?.kind === 'boo').slice(0, 12);
  const dancerNodes = boos.map(id => { const node = el('span', { class: `disco-boo move-${MOVE[personalityOf(id)]}`, text: '👻', title: BY_ID[id].name }); dancers.appendChild(node); return node; });
  let trackIndex = 0, lastBeat = -1, frame = 0, routine = null, routineStart = 0;
  const selector = el('button', { class: 'btn soft disco-track', text: `♫ ${BOO_POP_HITS[0].name}`, onclick: () => { trackIndex = (trackIndex + 1) % BOO_POP_HITS.length; selector.textContent = `♫ ${BOO_POP_HITS[trackIndex].name}`; lastBeat = -1; } });
  const posters = el('div', { class: 'disco-posters' });
  Object.values(getState().routines || {}).filter(sequence => Array.isArray(sequence) && sequence.length).slice(0, 4).forEach((sequence, index) => posters.appendChild(el('button', { class: 'disco-poster', text: `Dance poster ${index + 1}`, onclick: () => { routine = sequence; routineStart = performance.now(); } })));
  if (!posters.children.length) posters.appendChild(el('small', { text: 'Save a Dance Stage routine to hang a poster here.' }));
  root.append(el('h2', { text: '✨ Disco Hall' }), selector, el('div', { class: 'disco-ball', text: '🪩' }), floor, dancers, posters, el('button', { class: 'btn soft', text: 'Back', onclick: () => ctx.go('town', { area: 'funfair' }) }));
  const tick = now => {
    const track = BOO_POP_HITS[trackIndex], beat = beatAt(now, REDUCED ? Math.max(60, track.bpm / 2) : track.bpm);
    if (beat !== lastBeat) {
      floor.children[lastBeat >= 0 ? lastBeat % 24 : 0]?.classList.remove('on'); floor.children[beat % 24]?.classList.add('on'); lastBeat = beat;
      if (routine) {
        const step = Math.floor((now - routineStart) / 700), move = ROUTINE_MOVE[routine[step % routine.length]] || 'sway';
        dancerNodes.forEach(node => { node.className = `disco-boo move-${move}`; }); if (step >= routine.length * 2) routine = null;
      } else dancerNodes.forEach((node, index) => { node.className = `disco-boo move-${REDUCED ? 'sway' : MOVE[personalityOf(boos[index])]}`; });
    }
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
  if (typeof window !== 'undefined') window.__disco = { beat: () => lastBeat, track: () => BOO_POP_HITS[trackIndex].id, moves: () => dancerNodes.map(node => node.className) };
  return { unmount() { cancelAnimationFrame(frame); } };
}
