// RUN10 P18 — The Disco Hall. A bar-quantised party behind the Funfair's neon door.

import { el, clear, backControl, REDUCED } from './ui.js';
import { getState } from './state.js';
import { renderItem } from './art.js';
import { resolveItem } from './customs.js';
import { equippedArt, getDisplayName } from './accessories.js';
import { personalityOf } from '../data/personalities.js';
import { BOO_POP_HITS } from '../data/songs.js';
import { audioClockMs, band, music, sfx } from './sfx.js';
import { applyMove, MOVES, STEP_MS } from './choreographer.js';

export const DISCO_MOVES = {
  bouncy: 'bounce',
  sleepy: 'sway',
  cheeky: 'spin',
  shy: 'sway-small',
  musical: 'shimmy',
  sporty: 'star-jump'
};
const NOTE_SEMIS = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16];

export function mount(container, params, ctx) {
  music.stop();
  const state = getState();
  const root = el('div', { class: `screen disco-hall${REDUCED ? ' reduced' : ''}` });
  const header = el('header', { class: 'disco-header' }, [
    backControl(() => ctx.go('town', { area: 'funfair' })),
    el('h2', { text: 'The Disco Hall' }),
    el('span', { class: 'disco-live', text: '● LIVE' })
  ]);
  const room = el('main', { class: 'disco-room' });
  const ball = el('div', { class: 'disco-ball', 'aria-label': 'Mirrored disco ball' }, [
    ...Array.from({ length: 25 }, (_, i) => el('i', { style: { '--i': i } }))
  ]);
  const beams = el('div', { class: 'disco-beams' });
  const posterWall = el('aside', { class: 'disco-posters' });
  const stage = el('section', { class: 'disco-stage' });
  const dancers = el('div', { class: 'disco-dancers' });
  const floor = el('div', { class: 'disco-floor' });
  const tiles = Array.from({ length: 24 }, (_, i) => el('i', { class: 'disco-tile', style: { '--i': i } }));
  tiles.forEach(tile => floor.appendChild(tile));
  const trackButton = el('button', { class: 'disco-track', onclick: cycleTrack });
  const nowPlaying = el('div', { class: 'disco-now' });
  stage.append(dancers, floor);
  room.append(beams, ball, posterWall, stage, nowPlaying, trackButton);
  root.append(header, room);
  container.appendChild(root);

  const ownedIds = Object.keys(state.inventory || {}).filter(id => {
    const item = resolveItem(id);
    return (state.inventory[id] || 0) > 0 && item && item.kind === 'boo';
  }).slice(0, 12);
  const dancerNodes = ownedIds.map((id, index) => {
    const item = resolveItem(id);
    const personality = personalityOf(id);
    const node = el('div', {
      class: 'disco-dancer',
      dataset: { id, personality, move: DISCO_MOVES[personality], index },
      title: getDisplayName(id)
    }, [el('div', { html: renderItem(item, { size: 104, equipArt: equippedArt(id) }) })]);
    dancers.appendChild(node);
    return node;
  });

  let trackIndex = Math.max(0, BOO_POP_HITS.findIndex(hit => hit.id === (params && params.track)));
  let barIndex = 0, barTimer = null, nextBarAt = 0, routineTimers = [], mode = 'free';
  const barLog = [], routineLog = [];

  function barMs() { return 4 * 60000 / BOO_POP_HITS[trackIndex].bpm; }
  function updateTrackCopy() {
    const hit = BOO_POP_HITS[trackIndex];
    trackButton.textContent = `🎵 ${hit.name}  ›`;
    nowPlaying.textContent = mode === 'routine' ? 'Your routine is on the floor!' : `${hit.bpm} bpm · free dance`;
  }
  function cycleTrack() {
    sfx.tap();
    trackIndex = (trackIndex + 1) % BOO_POP_HITS.length;
    restartBars();
  }
  function restartBars() {
    if (barTimer) clearTimeout(barTimer);
    barIndex = 0;
    nextBarAt = audioClockMs() + 120;
    updateTrackCopy();
    scheduleBar();
  }
  function scheduleBar() {
    const delay = Math.max(0, nextBarAt - audioClockMs());
    barTimer = setTimeout(() => {
      const actual = audioClockMs();
      onBar(nextBarAt, actual);
      nextBarAt += barMs();
      scheduleBar();
    }, delay);
  }
  function onBar(target, actual) {
    const hit = BOO_POP_HITS[trackIndex];
    const hue = (trackIndex * 82 + barIndex * 37) % 360;
    room.style.setProperty('--disco-hue', hue);
    floor.dataset.bar = String(barIndex);
    floor.querySelectorAll('.disco-tile').forEach((tile, i) => {
      tile.style.setProperty('--tile-hue', (hue + i * 7) % 360);
      tile.classList.remove('bar-hit');
      void tile.offsetWidth;
      tile.classList.add('bar-hit');
    });
    if (mode === 'free') applyFreeDance();
    const note = hit.melody[(barIndex * 4) % hit.melody.length];
    if (note && note.semi != null) band.key(NOTE_SEMIS.includes(note.semi) ? note.semi : 0);
    barLog.push({ target, actual, error: actual - target, bar: barIndex, hue, track: hit.id });
    if (barLog.length > 40) barLog.shift();
    barIndex++;
  }
  function clearDanceClasses(svg) {
    if (!svg) return;
    for (const name of Object.values(DISCO_MOVES)) svg.classList.remove(`disco-${name}`);
  }
  function applyFreeDance() {
    dancerNodes.forEach(node => {
      const svg = node.querySelector('svg');
      clearDanceClasses(svg);
      const move = REDUCED ? 'sway' : DISCO_MOVES[node.dataset.personality];
      node.dataset.move = move;
      void svg.offsetWidth;
      svg.classList.add(`disco-${move}`);
    });
  }

  function routines() {
    return Object.entries(state.routines || {}).filter(([, seq]) => Array.isArray(seq) && seq.length);
  }
  function renderPosters() {
    clear(posterWall);
    posterWall.appendChild(el('strong', { text: 'YOUR ROUTINES' }));
    const saved = routines();
    if (!saved.length) {
      posterWall.appendChild(el('p', { text: 'Save a Dance Stage routine and its poster hangs here!' }));
      return;
    }
    saved.forEach(([key, seq], index) => {
      const emojis = seq.slice(0, 5).map(id => (MOVES.find(m => m.id === id) || {}).emoji || '•').join(' ');
      posterWall.appendChild(el('button', {
        class: 'disco-poster',
        dataset: { key, index },
        onclick: () => playRoutine(key, seq)
      }, [
        el('span', { text: emojis }),
        el('small', { text: `Routine ${index + 1} · ${seq.length} moves` })
      ]));
    });
  }
  function stopRoutine() {
    routineTimers.forEach(clearTimeout);
    routineTimers = [];
    mode = 'free';
    dancers.classList.remove('routine');
    dancerNodes.forEach(node => clearDanceClasses(node.querySelector('svg')));
    updateTrackCopy();
  }
  function playRoutine(key, seq) {
    stopRoutine();
    mode = 'routine';
    dancers.classList.add('routine');
    updateTrackCopy();
    seq.forEach((move, index) => {
      routineTimers.push(setTimeout(() => {
        dancerNodes.forEach(node => applyMove(node.querySelector('svg'), move));
        routineLog.push({ key, move, index });
        sfx.tap();
      }, index * STEP_MS));
    });
    routineTimers.push(setTimeout(() => {
      stopRoutine();
      applyFreeDance();
    }, seq.length * STEP_MS + 120));
  }

  renderPosters();
  updateTrackCopy();
  restartBars();

  window.__disco = {
    track: () => BOO_POP_HITS[trackIndex].id,
    cycleTrack,
    barMs,
    barLog: () => barLog.slice(),
    forceBar: () => onBar(audioClockMs(), audioClockMs()),
    dancerMoves: () => dancerNodes.map(n => ({ id: n.dataset.id, personality: n.dataset.personality, move: n.dataset.move })),
    routineKeys: () => routines().map(([key]) => key),
    playRoutine: key => { const found = routines().find(([k]) => k === key); if (found) playRoutine(...found); },
    routineLog: () => routineLog.slice(),
    mode: () => mode,
    tileHues: () => tiles.map(tile => tile.style.getPropertyValue('--tile-hue')),
    reduced: () => REDUCED
  };

  return {
    unmount() {
      if (barTimer) clearTimeout(barTimer);
      routineTimers.forEach(clearTimeout);
      delete window.__disco;
    }
  };
}
