// RUN10 P6 — shared instrument-scene shell. The room, songs and jam library are
// separate routes; this module keeps the four instruments consistent without
// putting controls on top of their playfields.

import { el, clear, backControl, REDUCED, suppressContextMenu } from '../ui.js';
import { getState } from '../state.js';
import { resolveItem } from '../customs.js';
import { renderItem } from '../art.js';
import { sfx, music, band as voices, DRUM_PADS, KEY_SEMIS, GUITAR_CHORDS, XYLO_SEMIS } from '../sfx.js';
import { idbGet, idbPut } from '../idb.js';
import { LITTLE_BOO_SONGS, BOO_POP_HITS } from '../../data/songs.js';
import { bandTrio, jamEvents, startBandWatch, listJams, MAX_JAMS } from '../band.js';

export const INSTRUMENTS = {
  drums: { route: 'band-drums', label: 'Drums', icon: '🥁', event: 'drum', role: 'drummer' },
  keys: { route: 'band-keys', label: 'Keys', icon: '🎹', event: 'key', role: 'keys' },
  guitar: { route: 'band-guitar', label: 'Guitar', icon: '🎸', event: 'guitar', role: 'guitarist' },
  xylo: { route: 'band-xylophone', label: 'Xylophone', icon: '🌈', event: 'xylo', role: 'xylophonist' }
};

const SONGS = [...LITTLE_BOO_SONGS, ...BOO_POP_HITS];
const KEY_NAMES = ['C', 'D', 'E', 'F', 'G', 'A', 'B', "C'", "D'", "E'"];
const XYLO_COLOURS = ['#EF476F', '#FF9F68', '#FFC93C', '#9CCC65', '#35D0BA', '#8FC7FF', '#8A6BF0', '#C6A9F0'];
const DRUM_LABEL = { kick: 'Kick', snare: 'Snare', hihat: 'Hi-hat', cymbal: 'Cymbal', tom1: 'Tom', tom2: 'Tom' };
const MAX_LAYERS = 3;

function playEvent(ev) {
  if (ev.i === 'drum') voices.drum(ev.v);
  else if (ev.i === 'key') voices.key(ev.v);
  else if (ev.i === 'guitar') voices.guitar(ev.v);
  else if (ev.i === 'xylo') voices.xylo(ev.v);
}

function safeId() {
  return `jam_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function dominantInstrument(events, fallback) {
  const counts = {};
  for (const e of events) counts[e.i] = (counts[e.i] || 0) + 1;
  return Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || fallback;
}

function performerFor(instrument) {
  const meta = INSTRUMENTS[instrument];
  const trio = bandTrio();
  const id = trio[meta.role];
  const item = resolveItem(id);
  return el('div', { class: 'band-scene-performer', dataset: { role: meta.role } }, [
    el('div', { class: 'band-scene-boo', html: item ? renderItem(item, { size: 88 }) : '' }),
    el('span', { class: 'band-scene-instrument', text: meta.icon })
  ]);
}

function songKeys(song) {
  return (song && song.melody || [])
    .filter(n => n.semi != null)
    .map(n => KEY_SEMIS.indexOf(n.semi))
    .filter(i => i >= 0);
}

export function mountInstrument(container, params, ctx, instrument) {
  const meta = INSTRUMENTS[instrument];
  music.stop();

  const root = el('div', { class: `screen band-scene band-instrument-scene inst-${instrument}` });
  const performer = performerFor(instrument);
  const status = el('div', { class: 'band-scene-status', text: 'Tap Record, then play!' });
  const recBtn = el('button', {
    class: 'band-record-circle',
    'aria-label': 'Start recording',
    text: '●',
    onclick: () => toggleRecord()
  });
  const headerKids = [
    backControl(() => ctx.go('band')),
    el('h2', { text: meta.label })
  ];
  if (instrument === 'keys') {
    headerKids.push(el('button', {
      class: 'band-playalong-toggle',
      text: params && params.song ? '✨ Play-along on' : 'Choose a song',
      onclick: () => ctx.go('band-songs')
    }));
  } else {
    headerKids.push(el('span', { class: 'band-header-spacer' }));
  }
  headerKids.push(recBtn);
  const header = el('header', { class: 'band-scene-header' }, headerKids);

  const lane = el('div', { class: 'band-sparkle-lane', 'aria-label': 'Play-along sparkle lane' });
  const playfield = el('div', { class: 'band-playfield' });
  root.append(header, performer);
  if (instrument === 'keys') root.appendChild(lane);
  root.append(playfield, status);
  container.appendChild(root);

  let song = params && params.song ? SONGS.find(s => s.id === params.song) : null;
  let wantedKeys = songKeys(song);
  let songPos = 0;
  let recording = false;
  let recordStart = 0;
  let pass = [];
  let existingJam = null;
  let backing = null;
  let alive = true;
  let lastSavedId = null;

  loadExisting();
  renderPlayfield();
  renderLane();
  if (params && params.record) setTimeout(() => toggleRecord(), 250);

  async function loadExisting() {
    if (!(params && params.jamId)) return;
    existingJam = await idbGet('jams', params.jamId);
    if (!alive || !existingJam) return;
    if (Number.isInteger(params.replaceLayer) && existingJam.layers) {
      existingJam.layers = existingJam.layers.filter((_, i) => i !== params.replaceLayer);
    }
    status.textContent = existingJam.layers && existingJam.layers.length
      ? `Layer ${existingJam.layers.length + 1} ready — press Record`
      : 'Press Record for the first layer';
  }

  function mirror() {
    if (REDUCED) return;
    performer.classList.remove('played');
    void performer.offsetWidth;
    performer.classList.add('played');
  }

  function hit(i, v) {
    const ev = { i, v };
    playEvent(ev);
    mirror();
    if (recording) pass.push({ ...ev, t: Math.round(performance.now() - recordStart) });
  }

  async function toggleRecord() {
    if (recording) {
      await stopAndSave();
      return;
    }
    if (!existingJam && (await listJams()).length >= MAX_JAMS) {
      status.textContent = `Your ${MAX_JAMS} jam spaces are full — remove one in My Jams.`;
      return;
    }
    pass = [];
    recording = true;
    recordStart = performance.now();
    recBtn.classList.add('recording');
    recBtn.textContent = '■';
    recBtn.setAttribute('aria-label', 'Stop and save recording');
    status.textContent = existingJam ? `Recording layer ${(existingJam.layers || []).length + 1}…` : 'Recording your new jam…';
    if (existingJam && jamEvents(existingJam).length) backing = startBandWatch(existingJam);
  }

  async function stopAndSave() {
    recording = false;
    recBtn.classList.remove('recording');
    recBtn.textContent = '●';
    recBtn.setAttribute('aria-label', 'Start recording');
    if (backing) { backing.stop(); backing = null; }
    if (!pass.length) {
      status.textContent = 'No notes captured — try again.';
      return;
    }
    const layer = { instrument: dominantInstrument(pass, meta.event), events: pass.slice() };
    if (!existingJam) {
      const jams = await listJams();
      const id = safeId();
      existingJam = { id, name: `My ${meta.label} Jam ${jams.length + 1}`, layers: [layer], at: Date.now() };
    } else {
      existingJam.layers = [...(existingJam.layers || []), layer].slice(0, MAX_LAYERS);
    }
    const all = jamEvents(existingJam);
    existingJam.dur = all.reduce((m, e) => Math.max(m, e.t), 0) + 450;
    await idbPut('jams', existingJam);
    lastSavedId = existingJam.id;
    sfx.star();
    status.textContent = `Saved ${existingJam.layers.length} layer${existingJam.layers.length === 1 ? '' : 's'} — find it in My Jams!`;
  }

  function renderLane() {
    clear(lane);
    lane.classList.toggle('active', !!(song && wantedKeys.length));
    if (!song || !wantedKeys.length) {
      lane.appendChild(el('span', { class: 'band-lane-empty', text: 'Choose a song for press-paced sparkles' }));
      return;
    }
    const idx = wantedKeys[songPos];
    const marker = el('span', { class: 'band-lane-marker', text: '✨', style: { left: `${(idx + 0.5) * 10}%` } });
    lane.append(
      el('span', { class: 'band-lane-song', text: song.name }),
      marker
    );
  }

  function renderPlayfield() {
    clear(playfield);
    if (instrument === 'drums') renderDrums();
    else if (instrument === 'keys') renderKeys();
    else if (instrument === 'guitar') renderGuitar();
    else renderXylo();
  }

  function renderDrums() {
    const kit = el('div', { class: 'p6-drum-kit' });
    for (const pad of DRUM_PADS) {
      const b = el('button', { class: `p6-drum-pad pad-${pad}`, text: DRUM_LABEL[pad], dataset: { pad } });
      suppressContextMenu(b);
      b.addEventListener('pointerdown', e => {
        e.preventDefault();
        hit('drum', pad);
        b.classList.remove('hit'); void b.offsetWidth; b.classList.add('hit');
      });
      kit.appendChild(b);
    }
    playfield.appendChild(kit);
  }

  function renderKeys() {
    const row = el('div', { class: 'p6-keys-row' });
    KEY_SEMIS.forEach((semi, idx) => {
      const key = el('button', { class: 'p6-key', dataset: { idx: String(idx) } }, [
        el('span', { class: 'p6-key-note', text: KEY_NAMES[idx] })
      ]);
      suppressContextMenu(key);
      key.addEventListener('pointerdown', e => {
        e.preventDefault();
        hit('key', semi);
        key.classList.remove('down'); void key.offsetWidth; key.classList.add('down');
        setTimeout(() => key.classList.remove('down'), 150);
        if (song && wantedKeys[songPos] === idx) {
          songPos = (songPos + 1) % wantedKeys.length;
          renderLane();
        }
      });
      row.appendChild(key);
    });
    playfield.appendChild(row);
  }

  function renderGuitar() {
    let chord = 'C';
    const chords = el('div', { class: 'p6-chord-column' });
    const strum = el('div', { class: 'p6-strum-zone', role: 'button', tabindex: '0' }, [
      el('span', { class: 'p6-strum-arrow', text: '↕' }),
      el('strong', { text: 'STRUM' })
    ]);
    GUITAR_CHORDS.forEach(c => {
      const b = el('button', { class: `p6-chord${c === chord ? ' sel' : ''}`, text: c });
      b.onclick = () => {
        chord = c; sfx.tap();
        [...chords.children].forEach((x, i) => x.classList.toggle('sel', GUITAR_CHORDS[i] === chord));
      };
      chords.appendChild(b);
    });
    let down = false, lastY = 0, lastHit = 0;
    const strumNow = y => {
      const now = performance.now();
      if (now - lastHit < 180 || Math.abs(y - lastY) < 8) return;
      lastHit = now; lastY = y; hit('guitar', chord);
      strum.classList.remove('strummed'); void strum.offsetWidth; strum.classList.add('strummed');
    };
    strum.addEventListener('pointerdown', e => { down = true; lastY = e.clientY - 20; strum.setPointerCapture(e.pointerId); strumNow(e.clientY); });
    strum.addEventListener('pointermove', e => { if (down) strumNow(e.clientY); });
    strum.addEventListener('pointerup', () => { down = false; });
    strum.addEventListener('pointercancel', () => { down = false; });
    playfield.append(el('div', { class: 'p6-guitar' }, [chords, strum]));
  }

  function renderXylo() {
    const bars = el('div', { class: 'p6-xylo-bars' });
    XYLO_SEMIS.forEach((_, idx) => {
      const bar = el('button', {
        class: 'p6-xylo-bar',
        style: { background: XYLO_COLOURS[idx], height: `${100 - idx * 5}%` },
        'aria-label': KEY_NAMES[idx]
      }, [el('span', { text: KEY_NAMES[idx] })]);
      bar.addEventListener('pointerdown', e => {
        e.preventDefault(); hit('xylo', idx);
        bar.classList.remove('struck'); void bar.offsetWidth; bar.classList.add('struck');
      });
      bars.appendChild(bar);
    });
    playfield.appendChild(bars);
  }

  window.__bandScene = {
    instrument: () => instrument,
    recording: () => recording,
    events: () => pass.slice(),
    hit,
    toggleRecord,
    song: () => song && song.id,
    songPosition: () => songPos,
    wantedKey: () => wantedKeys[songPos] ?? -1,
    savedId: () => lastSavedId,
    laneBox: () => lane.getBoundingClientRect(),
    playfieldBox: () => playfield.getBoundingClientRect(),
    performerPlayed: () => performer.classList.contains('played')
  };

  return {
    unmount() {
      alive = false;
      if (backing) backing.stop();
      if (recording && pass.length) stopAndSave();
    }
  };
}
