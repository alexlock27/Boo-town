// RUN10 P6 — shared instrument-scene shell. The room, songs and jam library are
// separate routes; this module keeps the four instruments consistent without
// putting controls on top of their playfields.

import { el, clear, backControl, REDUCED, suppressContextMenu } from '../ui.js';
import { getState } from '../state.js';
import { resolveItem } from '../customs.js';
import { renderItem } from '../art.js';
import { sfx, music, band as voices, DRUM_PADS, KEY_SEMIS, GUITAR_CHORDS, GUITAR_CHORD_NOTES, XYLO_SEMIS } from '../sfx.js';
import { idbGet, idbPut } from '../idb.js';
import { LITTLE_BOO_SONGS, BOO_POP_HITS } from '../../data/songs.js';
import { bandTrio, jamEvents, startBandWatch, listJams, MAX_JAMS } from '../band.js';
import { beatTick, celebrate } from '../celebrate.js';
import { guideLine } from '../guide.js';

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

function playEvent(ev, opts) {
  if (ev.i === 'drum') voices.drum(ev.v);
  else if (ev.i === 'key') voices.key(ev.v);
  else if (ev.i === 'guitar') voices.guitar(ev.v);
  else if (ev.i === 'pluck') voices.pluck(ev.v, opts);   // RUN21G: one guitar string (opts carries live velocity)
  else if (ev.i === 'xylo') voices.xylo(ev.v);
}

function safeId() {
  return `jam_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function dominantInstrument(events, fallback) {
  const counts = {};
  // RUN21G: plucks ARE guitar — map before counting so a strummed jam saves as
  // instrument:'guitar' and old {i:'guitar'} chord jams stay one family with it.
  for (const e of events) { const k = e.i === 'pluck' ? 'guitar' : e.i; counts[k] = (counts[k] || 0) + 1; }
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
  const status = el('div', { class: 'band-scene-status' });
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
  let done = false;        // RUN21G item 2: true once every note of the song has been played
  let countEl = null;      // the lane's progress readout (beat 3 pulses it on every advance)
  let keysRow = null;      // set by renderKeys; updateWanted() moves the ✨ between its children
  let guitarSeam = null;   // set by renderGuitar (RUN21G item 3): chord/strings/pluck evidence
  let recording = false;
  let recordStart = 0;
  let pass = [];
  let existingJam = null;
  let backing = null;
  let alive = true;
  let lastSavedId = null;

  status.textContent = defaultStatus();
  loadExisting();
  renderPlayfield();
  renderLane();
  if (params && params.record) setTimeout(() => toggleRecord(), 250);

  // RUN21G item 2: the keys scene tells her what this screen is for; the other
  // instruments keep their original line.
  function defaultStatus() {
    if (instrument !== 'keys') return 'Tap Record, then play!';
    if (song && wantedKeys.length) return `${song.name} — follow the ✨`;
    return 'Play anything you like! Tap ● to keep a jam.';
  }

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

  function hit(i, v, opts) {
    const ev = { i, v };
    playEvent(ev, opts);   // opts is live-only colour (pluck velocity); the recorded event stays {i,v,t}
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

  // RUN21G item 1: the lane no longer pretends to know the keys' geometry — the ✨ target
  // lives on the wanted key itself (renderKeys). The lane is the song's readout instead:
  // name · the next three note letters · progress count.
  function renderLane() {
    clear(lane);
    countEl = null;
    lane.classList.toggle('active', !!(song && wantedKeys.length));
    if (!song || !wantedKeys.length) {
      lane.appendChild(el('span', { class: 'band-lane-empty', text: 'Choose a song for press-paced sparkles' }));
      return;
    }
    const peek = wantedKeys.slice(songPos, songPos + 3).map(i => KEY_NAMES[i]).join(' · ');
    countEl = el('span', { class: 'band-lane-count', text: `✨ ${Math.min(songPos + 1, wantedKeys.length)} of ${wantedKeys.length}` });
    lane.append(
      el('span', { class: 'band-lane-song', text: song.name }),
      el('span', { class: 'band-lane-next', text: peek }),
      countEl
    );
  }

  // The wanted key carries the target: class `wanted` puts the ✨ badge and halo on the
  // key button itself, so the sparkle's centre IS the key's centre at every viewport.
  function updateWanted() {
    if (!keysRow) return;
    [...keysRow.children].forEach(k => k.classList.remove('wanted'));
    if (song && !done && wantedKeys.length && songPos < wantedKeys.length) {
      const k = keysRow.children[wantedKeys[songPos]];
      if (k) k.classList.add('wanted');
    }
  }

  // RUN21G item 2: the last note is a moment, not a wrap-around. Fires exactly once;
  // the keys stay fully playable afterwards (free play).
  function finishSong() {
    done = true;
    songPos = wantedKeys.length;
    renderLane();
    updateWanted();
    celebrate(status, { counter: countEl, sound: 'fanfare', line: guideLine('L_BAND_SONGDONE') });
    clear(status);
    status.append(
      el('span', { class: 'band-done-line', text: `You played the whole of ${song.name}! 🎵` }),
      el('button', { class: 'btn soft', text: 'Play it again', onclick: () => restartSong() }),
      el('button', { class: 'btn soft', text: 'More songs ✨', onclick: () => ctx.go('band-songs') })
    );
  }

  function restartSong() {
    done = false;
    songPos = 0;
    status.textContent = defaultStatus();
    renderLane();
    updateWanted();
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
    keysRow = row;
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
        // Free play is never wrong: a non-wanted key plays exactly as above and the
        // sparkle simply waits (no-guilt law). Only the wanted key advances the song.
        if (song && !done && wantedKeys[songPos] === idx) {
          if (songPos + 1 === wantedKeys.length) {
            finishSong();   // item 2: no modulo — the whole song is a witnessed ending
          } else {
            songPos += 1;
            renderLane();
            updateWanted();
            beatTick(countEl);   // legible even when the same note repeats and the ✨ stays put
          }
        }
      });
      row.appendChild(key);
    });
    playfield.appendChild(row);
    updateWanted();
  }

  // RUN21G item 3: four real strings instead of one STRUM gesture. The chord pads stay
  // and RETUNE the strings (top row = lowest); dragging across the strings plucks each
  // one it crosses, in crossing order, with drag speed as velocity. Free play is never
  // wrong in any direction, at any speed.
  function renderGuitar() {
    let chord = 'C';
    let stringSemis = (GUITAR_CHORD_NOTES[chord] || GUITAR_CHORD_NOTES.C).slice();   // low→high
    const STRING_WIDTHS = [4, 3.5, 3, 2.5];   // authored stroke px, top→bottom (thick = low)
    const chords = el('div', { class: 'p6-chord-column' });
    const strings = el('div', { class: 'p6-strings', 'aria-label': 'Guitar strings — drag across them to strum' });
    const rows = [];
    for (let i = 0; i < 4; i++) {
      const row = el('div', { class: 'p6-string', dataset: { row: String(i) } });
      // house sticker style: one rounded ink stroke with a subtle lighter core line
      row.innerHTML = `<svg viewBox="0 0 100 12" preserveAspectRatio="none" aria-hidden="true">
        <line class="p6-string-line" x1="3" y1="6" x2="97" y2="6" stroke="var(--ink)" stroke-width="${STRING_WIDTHS[i]}" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
        <line class="p6-string-core" x1="3" y1="6" x2="97" y2="6" stroke="#fff" stroke-width="${Math.max(1, STRING_WIDTHS[i] * 0.4)}" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
      </svg>`;
      rows.push(row);
      strings.appendChild(row);
    }
    const lastHitAt = [0, 0, 0, 0];   // per-string retrigger guard (90ms each)
    const pluckLog = [];              // seam evidence: { row, semi, vel, at, retune? }
    const wiggleRow = (row) => {
      row.classList.remove('plucked'); void row.offsetWidth; row.classList.add('plucked');
      // the class comes back off so the reduced-motion opacity flash (a transition,
      // not an animation) has an edge to fall from
      clearTimeout(row._pluckT); row._pluckT = setTimeout(() => row.classList.remove('plucked'), 160);
    };
    function pluckRow(rowIdx, vel) {
      const now = performance.now();
      if (now - lastHitAt[rowIdx] < 90) return;
      lastHitAt[rowIdx] = now;
      hit('pluck', stringSemis[rowIdx], vel !== undefined ? { vel } : undefined);
      pluckLog.push({ row: rowIdx, semi: stringSemis[rowIdx], vel: vel === undefined ? 1 : vel, at: now });
      wiggleRow(rows[rowIdx]);
    }
    GUITAR_CHORDS.forEach(c => {
      const b = el('button', { class: `p6-chord${c === chord ? ' sel' : ''}`, text: c });
      b.onclick = () => {
        chord = c;
        stringSemis = (GUITAR_CHORD_NOTES[chord] || GUITAR_CHORD_NOTES.C).slice();
        [...chords.children].forEach((x, i) => x.classList.toggle('sel', GUITAR_CHORDS[i] === chord));
        // retuning is HEARD: each string flashes once, low→high, gently (not recorded —
        // it is the instrument answering the pad, not the child playing)
        rows.forEach((row, i) => setTimeout(() => {
          voices.pluck(stringSemis[i], { vel: 0.5 });
          pluckLog.push({ row: i, semi: stringSemis[i], vel: 0.5, at: performance.now(), retune: true });
          wiggleRow(row);
        }, i * 40));
      };
      chords.appendChild(b);
    });
    // gesture: pointer-captured on the string panel. rowAt clamps to 0-3; a move that
    // jumps rows fires EVERY row strictly between in crossing order, then the new row,
    // so a fast swipe never skips a string.
    let down = false, last = -1, prevY = 0, prevT = 0;
    const rowAt = (y) => {
      const r = strings.getBoundingClientRect();
      return Math.max(0, Math.min(3, Math.floor(((y - r.top) / r.height) * 4)));
    };
    strings.addEventListener('pointerdown', e => {
      e.preventDefault();
      down = true;
      try { strings.setPointerCapture(e.pointerId); } catch {}
      last = rowAt(e.clientY);
      prevY = e.clientY; prevT = performance.now();
      pluckRow(last);   // the single-string tap — melody picking is just a short strum
    });
    strings.addEventListener('pointermove', e => {
      if (!down) return;
      const now = performance.now();
      // authored velocity: clamp(0.55 + min(0.65, (|Δy|px / Δt ms) * 0.9), 0.55, 1.2)
      const vel = Math.max(0.55, Math.min(1.2, 0.55 + Math.min(0.65, (Math.abs(e.clientY - prevY) / Math.max(1, now - prevT)) * 0.9)));
      const cur = rowAt(e.clientY);
      if (cur !== last) {
        const step = cur > last ? 1 : -1;
        for (let r = last + step; r !== cur; r += step) pluckRow(r, vel);
        pluckRow(cur, vel);
        last = cur;
      }
      prevY = e.clientY; prevT = now;
    });
    const lift = () => { down = false; last = -1; };
    strings.addEventListener('pointerup', lift);
    strings.addEventListener('pointercancel', lift);
    suppressContextMenu(strings);
    guitarSeam = {
      chord: () => chord,
      stringSemis: () => stringSemis.slice(),
      plucks: () => pluckLog.slice(),
      stringRects: () => rows.map(r => { const b = r.getBoundingClientRect(); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right }; })
    };
    playfield.append(el('div', { class: 'p6-guitar' }, [chords, strings]));
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
    songDone: () => done,
    // QA only: jump the song to a position (suites afford one honest full run, then
    // fast-forward for the moment-under-test instead of 42 clicks per assertion)
    qaSetSongPos: (n) => { if (!song) return; done = false; songPos = Math.max(0, Math.min(wantedKeys.length - 1, n)); renderLane(); updateWanted(); },
    wantedKey: () => wantedKeys[songPos] ?? -1,
    savedId: () => lastSavedId,
    laneBox: () => lane.getBoundingClientRect(),
    playfieldBox: () => playfield.getBoundingClientRect(),
    performerPlayed: () => performer.classList.contains('played'),
    // RUN21G item 3: the guitar's evidence seam (null on other instruments)
    guitar: () => guitarSeam
  };

  return {
    unmount() {
      alive = false;
      if (backing) backing.stop();
      if (recording && pass.length) stopAndSave();
    }
  };
}
