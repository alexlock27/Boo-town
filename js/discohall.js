// RUN10 P18 — The Disco Hall. RUN19 Z1 rewrite: a full-arrangement band performance
// (melody + generated backing) through the Boo Band engine, per-BEAT dance chaining, a
// projected-cell floor with an overflow rail, and a Routine Night mode.

import { el, clear, backControl, REDUCED } from './ui.js';
import { getState } from './state.js';
import { renderItem } from './art.js';
import { resolveItem } from './customs.js';
import { equippedArt, getDisplayName } from './accessories.js';
import { personalityOf } from '../data/personalities.js';
import { BOO_POP_HITS, NOTE } from '../data/songs.js';
import { audioClockMs, music, sfx } from './sfx.js';
import { applyMove, MOVES } from './choreographer.js';
import { VENUE_SOCKETS } from '../data/sockets.js';
import { startBandWatch, listJams, jamEvents } from './band.js';

// RUN13 T5 — ten named moves on the floor, not six. Every personality still has a signature
// (DISCO_MOVES, kept so nothing that reads it breaks), but now PREFERS three, picked fresh
// on each bar, so two Boos of the same temperament stop dancing in lockstep.
export const DISCO_MOVE_SET = [
  'bounce', 'sway', 'spin', 'sway-small', 'shimmy',
  'star-jump', 'wiggle', 'robot', 'clap', 'twirl'
];
export const DISCO_PREFERENCES = {
  bouncy:  ['bounce', 'star-jump', 'wiggle'],
  sleepy:  ['sway', 'sway-small', 'twirl'],
  cheeky:  ['spin', 'wiggle', 'robot'],
  shy:     ['sway-small', 'sway', 'clap'],
  musical: ['shimmy', 'clap', 'twirl'],
  sporty:  ['star-jump', 'bounce', 'robot']
};
// The signature move of each temperament — the first of its three preferences.
export const DISCO_MOVES = Object.fromEntries(
  Object.entries(DISCO_PREFERENCES).map(([personality, moves]) => [personality, moves[0]]));
// Boo of the moment: one dancer is promoted to the centre of the floor for eight bars,
// then the spotlight moves on. Eight bars is one musical phrase — it lands on the music.
export const SPOTLIGHT_BARS = 8;

// RUN19 Z1 — the projected-cell table. Three depth rows on the tilted floor; row 0 is
// nearest (biggest, bottom-most), row 2 is furthest (smallest, highest up the perspective).
export const FLOOR_ROWS = [
  { offset: 0.08, scale: 1.15 },
  { offset: 0.18, scale: 1.00 },
  { offset: 0.30, scale: 0.85 }
];
export const FLOOR_ROW_CAPACITY = [4, 4, 2];   // sums to MAX_ON_FLOOR
export const MAX_ON_FLOOR = 10;
export const COL_MIN = 0.14, COL_MAX = 0.86;
export const COL_JITTER = 0.03;
export const SPOTLIGHT_GLIDE_MS = 500;

// A chord name's root, in the melody's own semitone space (C4 = 0) — 'Am' -> A, 'F' -> F.
function chordRootSemi(chordName) {
  const letter = String(chordName || 'C').replace('m', '').charAt(0).toUpperCase();
  return NOTE[letter] != null ? NOTE[letter] : 0;
}

// RUN19 Z1 — deletes the one-note-per-bar model. Converts an authored Boo Pop Hit into a
// full-arrangement jam {events,dur} the SAME shape startBandWatch()/jamEvents() already
// understand: the melody on its own authored beat positions, plus a generated backing —
// kick on beats 1&3, snare on 2&4, closed hat every beat, bass = the bar's chord root an
// octave down on beat 1 of each bar. Pure and exported so it can be unit-tested directly.
export function buildTrackJam(hit) {
  const beatMs = 60000 / hit.bpm;
  const events = [];
  let beatPos = 0;
  for (const note of hit.melody) {
    if (note.semi != null) events.push({ t: Math.round(beatPos * beatMs), i: 'key', v: note.semi });
    beatPos += note.beats;
  }
  const totalBeats = beatPos;
  const totalBars = Math.max(1, Math.round(totalBeats / 4));
  const chordCount = (hit.progression || []).length || 1;
  const barsPerChord = Math.max(1, Math.ceil(totalBars / chordCount));
  for (let bar = 0; bar < totalBars; bar++) {
    const chord = hit.progression[Math.floor(bar / barsPerChord) % chordCount];
    const rootSemi = chordRootSemi(chord);
    for (let beat = 0; beat < 4; beat++) {
      const t = Math.round((bar * 4 + beat) * beatMs);
      events.push({ t, i: 'drum', v: 'hihat' });
      if (beat === 0 || beat === 2) events.push({ t, i: 'drum', v: 'kick' });
      if (beat === 1 || beat === 3) events.push({ t, i: 'drum', v: 'snare' });
    }
    events.push({ t: Math.round(bar * 4 * beatMs), i: 'key', v: rootSemi - 12 });
  }
  events.sort((a, b) => a.t - b.t);
  return { events, dur: Math.round(totalBeats * beatMs), bars: totalBars, beatMs };
}

// The projected-cell layout: rows filled front-first, up to MAX_ON_FLOOR; the remainder
// go to the rail (behind the floor). Column spread is even across COL_MIN..COL_MAX with a
// small per-dancer jitter, deterministic (not Math.random) so a reload lays out the same.
export function layoutFloor(count) {
  const onFloor = Math.min(count, MAX_ON_FLOOR);
  const cells = [];
  let placed = 0, dancerIdx = 0;
  for (let row = 0; row < FLOOR_ROWS.length && placed < onFloor; row++) {
    const cap = Math.min(FLOOR_ROW_CAPACITY[row], onFloor - placed);
    for (let c = 0; c < cap; c++) {
      const frac = (c + 1) / (cap + 1);   // evenly spaced, never flush with the edges
      const base = COL_MIN + frac * (COL_MAX - COL_MIN);
      const jitter = (((dancerIdx * 53) % 7) / 6 - 0.5) * 2 * COL_JITTER;   // deterministic ±3%
      cells.push({ row, col: Math.max(COL_MIN, Math.min(COL_MAX, base + jitter)), index: dancerIdx });
      dancerIdx++; placed++;
    }
  }
  const rail = [];
  for (let i = onFloor; i < count; i++) rail.push({ index: dancerIdx++ });
  return { cells, rail };
}

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
  const rail = el('div', { class: 'disco-rail' });
  const floor = el('div', { class: 'disco-floor' });
  const tiles = Array.from({ length: 24 }, (_, i) => el('i', { class: 'disco-tile', style: { '--i': i } }));
  tiles.forEach(tile => floor.appendChild(tile));
  const trackButton = el('button', { class: 'disco-track', onclick: cycleTrack });
  const modeButton = el('button', { class: 'disco-mode', onclick: cycleMode });
  const nowPlaying = el('div', { class: 'disco-now' });
  stage.append(dancers, rail, floor);
  room.append(beams, ball, posterWall, stage, nowPlaying, trackButton, modeButton);
  root.append(header, room);
  container.appendChild(root);

  const ownedIds = Object.keys(state.inventory || {}).filter(id => {
    const item = resolveItem(id);
    return (state.inventory[id] || 0) > 0 && item && item.kind === 'boo';
  }).slice(0, 16);
  const dancerNodes = ownedIds.map((id, index) => {
    const item = resolveItem(id);
    const personality = personalityOf(id);
    const node = el('div', {
      class: 'disco-dancer',
      dataset: { id, personality, move: DISCO_MOVES[personality], index },
      title: getDisplayName(id)
    }, [el('div', { html: renderItem(item, { size: 104, equipArt: equippedArt(id) }) })]);
    return node;
  });

  // ---- RUN19 Z1: place onto the floor's projected-cell table, overflow to the rail ----
  const layout = layoutFloor(dancerNodes.length);
  const floorNodes = [];
  layout.cells.forEach(cell => {
    const node = dancerNodes[cell.index];
    node.dataset.row = String(cell.row);
    node.style.left = (cell.col * 100).toFixed(1) + '%';
    node.style.setProperty('--row-scale', FLOOR_ROWS[cell.row].scale);
    dancers.appendChild(node);
    floorNodes.push(node);
  });
  const railNodes = [];
  layout.rail.forEach(r => {
    const node = dancerNodes[r.index];
    node.classList.add('disco-rail-dancer');
    rail.appendChild(node);
    railNodes.push(node);
  });

  // ---- RUN19 Z1: the track list — the four Boo Pop Hits PLUS her saved jams ----
  let tracks = BOO_POP_HITS.map(hit => ({ kind: 'hit', id: hit.id, name: hit.name, bpm: hit.bpm, hit }));
  let trackIndex = Math.max(0, tracks.findIndex(t => t.id === (params && params.track)));
  let player = null, beatTimer = null, nextBeatAt = 0, beatIndex = 0, gen = 0, pendingTrackIndex = null;
  let mode = 'free', routineKeyIdx = -1;
  const noteLog = [], beatLog = [], barLog = [], routineLog = [], spotlightLog = [];
  let spotlightIndex = -1;

  function curTrack() { return tracks[trackIndex] || tracks[0]; }
  function beatMs() { return 60000 / curTrack().bpm; }
  function barMs() { return 4 * beatMs(); }
  function trackLabel(t) { return t.kind === 'jam' ? `Your jam: ${t.name}` : t.name; }
  function updateTrackCopy() {
    trackButton.textContent = `🎵 ${trackLabel(curTrack())}  ›`;
    updateNowPlaying();
    modeButton.textContent = routines().length ? (mode === 'routine' ? `💃 Routine Night! (${routineKeyIdx + 1}/${routines().length})` : '💃 Free Dance') : '';
    modeButton.style.display = routines().length ? '' : 'none';
  }
  function updateNowPlaying() {
    if (mode === 'routine') { nowPlaying.textContent = 'Routine night! Your moves are on the floor.'; return; }
    const node = spotlightIndex >= 0 ? dancerNodes[spotlightIndex] : null;
    nowPlaying.textContent = node ? `${getDisplayName(node.dataset.id)} is the Boo of the moment!` : `${curTrack().bpm} bpm · free dance`;
  }

  async function loadJams() {
    const saved = await listJams().catch(() => []);
    const jamTracks = (saved || []).filter(j => jamEvents(j).length).map(j => ({
      kind: 'jam', id: j.id, name: j.name || 'Untitled', bpm: j.bpm || 100, jam: j
    }));
    tracks = [...tracks, ...jamTracks];
    if (trackIndex < 0) trackIndex = 0;
    updateTrackCopy();
  }

  // RUN19 Z1: "crossfade over one bar" — the OLD track keeps playing out its current bar
  // (nobody wants a song to cut off mid-phrase) and the NEW one takes over cleanly at the
  // next bar line, rather than an abrupt mid-bar cut. First switch (nothing playing yet)
  // is immediate.
  function cycleTrack() {
    sfx.tap();
    const nextIdx = (trackIndex + 1) % tracks.length;
    if (!player) { trackIndex = nextIdx; restartTrack(); }
    else pendingTrackIndex = nextIdx;
  }
  // `gen` invalidates any beat callback already queued under the old track, so a switch
  // can never leave two competing setTimeout loops ticking against each other.
  function restartTrack() {
    if (player) { player.stop(); player = null; }
    gen++;
    beatIndex = 0;
    if (beatTimer) clearTimeout(beatTimer);
    nextBeatAt = audioClockMs() + 120;
    const t = curTrack();
    const jam = t.kind === 'jam' ? t.jam : buildTrackJam(t.hit);
    player = startBandWatch(jam, onNote);
    updateTrackCopy();
    scheduleBeat(gen);
  }

  function onNote(ev) {
    noteLog.push({ t: audioClockMs(), i: ev.i, v: ev.v });
    if (noteLog.length > 300) noteLog.shift();
  }

  function scheduleBeat(myGen) {
    const delay = Math.max(0, nextBeatAt - audioClockMs());
    beatTimer = setTimeout(() => {
      if (myGen !== gen) return;   // a track switch already replaced this loop
      const actual = audioClockMs();
      onBeat(nextBeatAt, actual);
      if (myGen !== gen) return;   // onBeat itself may have switched tracks (bar boundary)
      nextBeatAt += beatMs();
      scheduleBeat(myGen);
    }, delay);
  }

  // RUN19 Z1: dance moves chain PER BEAT, not per bar — each move's animation duration is
  // one beat, and the next is applied on the very next beat with no idle gap.
  function onBeat(target, actual) {
    const bar = Math.floor(beatIndex / 4), beatInBar = beatIndex % 4;
    if (beatInBar === 0) onBar(bar);
    if (mode === 'free') applyBeatDance(beatInBar);
    else if (mode === 'routine') applyRoutineBeat();
    if (beatInBar === 0) railNodes.forEach(n => { n.classList.remove('rail-bounce'); void n.offsetWidth; n.classList.add('rail-bounce'); });
    beatLog.push({ t: actual, error: actual - target, beat: beatIndex });
    if (beatLog.length > 400) beatLog.shift();
    beatIndex++;
  }
  function onBar(bar) {
    if (pendingTrackIndex != null) {
      trackIndex = pendingTrackIndex; pendingTrackIndex = null;
      restartTrack();
      return;
    }
    const t = curTrack();
    const hue = (trackIndex * 82 + bar * 37) % 360;
    room.style.setProperty('--disco-hue', hue);
    floor.dataset.bar = String(bar);
    floor.querySelectorAll('.disco-tile').forEach((tile, i) => {
      tile.style.setProperty('--tile-hue', (hue + i * 7) % 360);
      tile.classList.remove('bar-hit'); void tile.offsetWidth; tile.classList.add('bar-hit');
    });
    updateSpotlight(bar);
    barLog.push({ bar, track: t.id });
    if (barLog.length > 40) barLog.shift();
  }
  function clearDanceClasses(svg) {
    if (!svg) return;
    for (const name of DISCO_MOVE_SET) svg.classList.remove(`disco-${name}`);
  }
  // Personality preference lists are kept; a Boo re-picks from its three preferred moves
  // EACH BAR (not each beat — a dancer holds one move for the whole bar, chaining beat to
  // beat with no idle gap, per the pack), so two Boos of the same temperament don't lock.
  let barMoves = new Map();
  function applyBeatDance(beatInBar) {
    if (beatInBar === 0) {
      dancerNodes.forEach(node => {
        const prefs = DISCO_PREFERENCES[node.dataset.personality] || DISCO_PREFERENCES.bouncy;
        const move = REDUCED ? 'sway' : prefs[Math.floor(Math.random() * prefs.length)];
        node.dataset.move = move;
        barMoves.set(node, move);
      });
    }
    dancerNodes.forEach(node => {
      const svg = node.querySelector('svg');
      const move = barMoves.get(node) || node.dataset.move;
      clearDanceClasses(svg);
      void svg.offsetWidth;
      svg.classList.add(`disco-${move}`);
      svg.style.setProperty('--beat-ms', beatMs() + 'ms');
    });
  }
  // Boo of the moment (RUN13 T5): every SPOTLIGHT_BARS the next dancer in the roster takes
  // the centre-front cell with a 500ms glide (RUN19 Z1), then returns to its floor slot.
  function updateSpotlight(bar) {
    if (!dancerNodes.length) return;
    if (bar % SPOTLIGHT_BARS !== 0) return;
    if (spotlightIndex >= 0) restoreFloorSlot(dancerNodes[spotlightIndex]);
    spotlightIndex = (spotlightIndex + 1) % dancerNodes.length;
    dancerNodes.forEach((node, i) => node.classList.toggle('spotlit', i === spotlightIndex));
    const node = dancerNodes[spotlightIndex];
    if (floorNodes.includes(node)) {
      // RUN19 Z1: the centre-front CELL, 500ms glide (CSS transition on left/bottom/
      // transform already covers the glide) — dataset.row drives seatDancers()'s pixel
      // math, so the promoted dancer's feet stay exactly on row 0's true surface line.
      node.dataset.row = '0';
      node.style.left = '50%';
      node.style.setProperty('--row-scale', FLOOR_ROWS[0].scale);
      seatDancers();
    }
    spotlightLog.push({ bar, index: spotlightIndex, id: node.dataset.id });
    if (spotlightLog.length > 20) spotlightLog.shift();
    updateNowPlaying();
  }
  function restoreFloorSlot(node) {
    if (!floorNodes.includes(node)) return;
    const cell = layout.cells.find(c => dancerNodes[c.index] === node);
    if (!cell) return;
    node.dataset.row = String(cell.row);
    node.style.left = (cell.col * 100).toFixed(1) + '%';
    node.style.setProperty('--row-scale', FLOOR_ROWS[cell.row].scale);
    seatDancers();
  }

  function routines() {
    return Object.entries(state.routines || {}).filter(([, seq]) => Array.isArray(seq) && seq.length);
  }
  // RUN19 Z1: the single entry point into routine mode — the posters, the mode button and
  // the QA hook all funnel through here so none of them can drift out of sync.
  function startRoutine(idx) {
    routineKeyIdx = idx; mode = 'routine'; routineStep = 0;
    dancers.classList.add('routine');
    updateTrackCopy();
  }
  function renderPosters() {
    clear(posterWall);
    posterWall.appendChild(el('strong', { text: 'YOUR ROUTINES' }));
    const saved = routines();
    if (!saved.length) {
      // Alex, 2026-07-30: this used to just say "save a routine", with no hint that a
      // Dance Stage is a rare prize she has to find first — it read as a missing feature
      // rather than something not unlocked yet.
      posterWall.appendChild(el('p', { text: 'Find a Dance Stage (a special box prize!), place it in your town, and choreograph a routine — its poster hangs here!' }));
      return;
    }
    saved.forEach(([key, seq], index) => {
      const emojis = seq.slice(0, 5).map(id => (MOVES.find(m => m.id === id) || {}).emoji || '•').join(' ');
      posterWall.appendChild(el('button', {
        class: 'disco-poster',
        dataset: { key, index },
        onclick: () => { sfx.tap(); startRoutine(index); }
      }, [
        el('span', { text: emojis }),
        el('small', { text: `Routine ${index + 1} · ${seq.length} moves` })
      ]));
    });
  }
  // RUN19 Z1: routine mode performs the sequence FLOOR-WIDE, one move per BEAT, looping —
  // synced to the current track's own beat clock (onBeat drives applyRoutineBeat), not a
  // fixed STEP_MS. It keeps looping until the mode cycles away.
  let routineStep = 0;
  function applyRoutineBeat() {
    const found = routines()[routineKeyIdx];
    if (!found) return;
    const [key, seq] = found;
    const moveId = seq[routineStep % seq.length];
    dancerNodes.forEach(node => applyMove(node.querySelector('svg'), moveId));
    routineLog.push({ key, move: moveId, index: routineStep });
    if (routineLog.length > 100) routineLog.shift();
    sfx.tap();
    routineStep++;
  }
  // Free Dance -> Routine Night! (routine 1) -> Routine Night! (routine 2) -> ... -> Free.
  function cycleMode() {
    const rs = routines();
    if (!rs.length) return;
    sfx.tap();
    if (mode === 'free') { startRoutine(0); }
    else if (routineKeyIdx + 1 < rs.length) { startRoutine(routineKeyIdx + 1); }
    else { mode = 'free'; routineKeyIdx = -1; dancerNodes.forEach(n => clearDanceClasses(n.querySelector('svg'))); dancers.classList.remove('routine'); updateTrackCopy(); }
  }

  renderPosters();
  loadJams().then(restartTrack);

  // ---- pixel contact (RUN12 S7), extended for RUN19 Z1's three depth rows -------------
  // RUN12 S7's law: a Boo on a dance floor stands ON the dance floor, measured in real
  // pixels against the floor's own rotated geometry — never a guessed CSS percentage.
  // Row 0 (nearest) stands exactly on the measured surface, same as before this run; rows
  // 1/2 stand further UP the tilted floor by their own authored fraction of the floor's
  // measured on-screen height (the perspective plane the CSS already draws), so a further-
  // back row reads as further back rather than merely smaller.
  const SOCKET = VENUE_SOCKETS.discohall;
  function rowSurfaceY(row) {
    const floorRect = floor.getBoundingClientRect();
    const base = floorRect.top + floorRect.height * SOCKET.surfaceFrac;
    return base - (FLOOR_ROWS[row].offset - FLOOR_ROWS[0].offset) * floorRect.height;
  }
  function seatDancers() {
    const stageRect = stage.getBoundingClientRect();
    const floorRect = floor.getBoundingClientRect();
    if (!stageRect.height || !floorRect.height) return;
    for (let row = 0; row < FLOOR_ROWS.length; row++) {
      const surfaceY = rowSurfaceY(row);
      const bottomPx = Math.max(0, Math.round(stageRect.bottom - surfaceY));
      dancers.querySelectorAll(`.disco-dancer[data-row="${row}"]`).forEach(n => { n.style.bottom = bottomPx + 'px'; });
    }
  }
  requestAnimationFrame(seatDancers);
  const onResize = () => seatDancers();
  window.addEventListener('resize', onResize);

  window.__disco = {
    seatDancers,
    floorSurfaceY: () => { const f = floor.getBoundingClientRect(); return f.top + f.height * SOCKET.surfaceFrac; },
    track: () => curTrack().id,
    trackLabel: () => trackLabel(curTrack()),
    trackCount: () => tracks.length,
    cycleTrack,
    barMs, beatMs,
    barLog: () => barLog.slice(),
    beatLog: () => beatLog.slice(),
    noteLog: () => noteLog.slice(),
    forceBar: () => { for (let i = 0; i < 4; i++) onBeat(audioClockMs(), audioClockMs()); },
    forceBeat: () => onBeat(audioClockMs(), audioClockMs()),
    beatIndex: () => beatIndex,
    dancerMoves: () => dancerNodes.map(n => ({ id: n.dataset.id, personality: n.dataset.personality, move: n.dataset.move })),
    moveSet: () => DISCO_MOVE_SET.slice(),
    preferences: () => JSON.parse(JSON.stringify(DISCO_PREFERENCES)),
    spotlightBars: () => SPOTLIGHT_BARS,
    spotlightIndex: () => spotlightIndex,
    spotlightLog: () => spotlightLog.slice(),
    spotlitId: () => { const n = dancers.querySelector('.disco-dancer.spotlit'); return n ? n.dataset.id : null; },
    spotlitCount: () => dancers.querySelectorAll('.disco-dancer.spotlit').length,
    danceClasses: () => dancerNodes.map(n => [...n.querySelector('svg').classList].filter(c => c.startsWith('disco-')).join(',')),
    routineKeys: () => routines().map(([key]) => key),
    playRoutine: key => { const i = routines().findIndex(([k]) => k === key); if (i >= 0) startRoutine(i); },
    routineLog: () => routineLog.slice(),
    mode: () => mode,
    cycleMode,
    tileHues: () => tiles.map(tile => tile.style.getPropertyValue('--tile-hue')),
    reduced: () => REDUCED,
    floorLayout: () => layout,
    floorCount: () => floorNodes.length,
    railCount: () => railNodes.length
  };

  return {
    unmount() {
      window.removeEventListener('resize', onResize);
      if (beatTimer) clearTimeout(beatTimer);
      if (player) player.stop();
      delete window.__disco;
    }
  };
}
