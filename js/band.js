// js/band.js — the Boo Band (RUN6 C1c). A play-mode screen with three synthesised
// instruments (drums / keys / guitar), a record-a-jam feature (note events ONLY — no
// microphone anywhere), up to three saved jams in IndexedDB, and a watch-mode player
// the town uses to perform the band song on the bandstand. All audio is Web Audio
// synthesis, reusing sfx.js's unlock + mute plumbing.

import { el, clear, backControl, dialog, REDUCED, suppressContextMenu } from './ui.js';
import { getState, mutate, todayKey } from './state.js';
import { resolveItem } from './customs.js';
import { renderItem } from './art.js';
import { sfx, music, band as voices, DRUM_PADS, KEY_SEMIS, GUITAR_CHORDS } from './sfx.js';
import { idbPut, idbGetAll, idbDelete } from './idb.js';

export const BANDSTAND_X = 0.68;         // where the bandstand sits in the funfair zone
export const MAX_JAMS = 3;               // up to three saved jams (named constant)
export const JAM_MAX_MS = 30000;         // record up to 30 seconds
const DRUM_LABEL = { kick: 'Kick', snare: 'Snare', hihat: 'Hi-hat', cymbal: 'Cymbal', tom1: 'Tom', tom2: 'Tom' };
// Twinkle Twinkle Little Star (public domain), authored as white-key indices (0=C4…):
// C C G G A A G  F F E E D D C  G G F F E E D  G G F F E E D  C C G G A A G  F F E E D D C
export const TWINKLE = [0, 0, 4, 4, 5, 5, 4, 3, 3, 2, 2, 1, 1, 0, 4, 4, 3, 3, 2, 2, 1, 4, 4, 3, 3, 2, 2, 1, 0, 0, 4, 4, 5, 5, 4, 3, 3, 2, 2, 1, 1, 0];
// A gentle default jam for watch mode when she hasn't set one of her own.
export const DEFAULT_JAM = (() => {
  const ev = []; let t = 0;
  const beat = 460;
  const mel = [0, 4, 7, 4, 5, 4, 2, 0];
  for (let bar = 0; bar < 4; bar++) {
    for (let i = 0; i < 8; i++) {
      if (i % 2 === 0) ev.push({ t, i: 'drum', v: 'kick' });
      if (i % 4 === 2) ev.push({ t, i: 'drum', v: 'snare' });
      ev.push({ t, i: 'drum', v: 'hihat' });
      if (i % 2 === 0) ev.push({ t: t + 40, i: 'key', v: KEY_SEMIS[mel[(bar * 8 + i) % mel.length] % KEY_SEMIS.length] });
      t += beat / 2;
    }
    ev.push({ t: t - beat, i: 'guitar', v: GUITAR_CHORDS[bar % 4] });
  }
  return { events: ev, dur: t };
})();

function dayHash(str) { let h = 0; for (const c of str) h = ((h << 5) - h + c.charCodeAt(0)) | 0; return Math.abs(h); }
function ownedBooIds(s = getState()) {
  const ids = [];
  for (const id of Object.keys(s.inventory || {})) if ((s.inventory[id] || 0) > 0) { const it = resolveItem(id); if (it && it.kind === 'boo') ids.push(id); }
  return ids;
}
const DEFAULT_TRIO = ['boo_inky', 'boo_chomp', 'boo_curly'];
// Today's band: three of her own Boos, rotating daily like Boo of the Day; a default
// trio covers players with few Boos.
export function bandTrio() {
  const s = getState();
  const pool = [...new Set([...ownedBooIds(s), ...DEFAULT_TRIO])];
  const day = todayKey();
  const avail = pool.slice(); const pick = []; let h = dayHash(day);
  for (let k = 0; k < 3 && avail.length; k++) { const idx = h % avail.length; pick.push(avail.splice(idx, 1)[0]); h = dayHash(day + k + pick[k]); }
  return { drummer: pick[0], keys: pick[1], guitarist: pick[2] };
}

export async function listJams() { try { return (await idbGetAll('jams')) || []; } catch { return []; } }
export async function getBandSongEvents() {
  const s = getState();
  if (s && s.bandSong) { try { const all = await idbGetAll('jams'); const j = (all || []).find(x => x.id === s.bandSong); if (j && j.events && j.events.length) return j; } catch {} }
  return DEFAULT_JAM;
}

// ---- watch-mode player: loop a jam's note events through the synths ----
export function startBandWatch(jam, onNote) {
  const events = (jam && jam.events) || [];
  const dur = (jam && jam.dur) || 4000;
  let timers = [], alive = true, loopTimer = null;
  function runLoop() {
    if (!alive) return;
    timers = [];
    for (const ev of events) {
      timers.push(setTimeout(() => { if (!alive) return; playEvent(ev); if (onNote) onNote(ev); }, ev.t));
    }
    loopTimer = setTimeout(runLoop, dur + 900);
  }
  runLoop();
  return { stop() { alive = false; timers.forEach(clearTimeout); if (loopTimer) clearTimeout(loopTimer); } };
}
function playEvent(ev) {
  if (ev.i === 'drum') voices.drum(ev.v);
  else if (ev.i === 'key') voices.key(ev.v);
  else if (ev.i === 'guitar') voices.guitar(ev.v);
}

// ==================== the play-mode screen ====================
export function mount(container, params, ctx) {
  const s = getState();
  const trio = bandTrio();
  music.stop();   // her playing IS the music here — silence the background loop (C1c)
  const root = el('div', { class: 'screen band' });
  container.appendChild(root);

  let instrument = 'drums';
  let recording = false, recStart = 0, events = [];
  let heldChord = 'C';
  let playAlong = false, twinkleIdx = 0;
  let backing = false, backingCtl = null;
  let playCtl = null, recTimer = null;

  const trioRow = el('div', { class: 'band-trio' });
  const trioEls = {};
  for (const [roleKey, role] of [['drummer', '🥁'], ['keys', '🎹'], ['guitarist', '🎸']]) {
    const id = trio[roleKey]; const item = resolveItem(id);
    const a = el('div', { class: 'bt-boo', dataset: { role: roleKey } }, [
      el('div', { class: 'bt-art', html: item ? renderItem(item, { size: 60 }) : '' }),
      el('span', { class: 'bt-inst', text: role })
    ]);
    trioEls[roleKey] = a; trioRow.appendChild(a);
  }

  const header = el('header', { class: 'band-header' }, [backControl(() => leave()), el('h2', { text: 'Boo Band' })]);
  const area = el('div', { class: 'band-area' });
  const tabs = el('div', { class: 'band-tabs' });
  for (const [key, label] of [['drums', '🥁 Drums'], ['keys', '🎹 Keys'], ['guitar', '🎸 Guitar']]) {
    tabs.appendChild(el('button', { class: 'band-tab' + (instrument === key ? ' sel' : ''), dataset: { inst: key }, text: label, onclick: () => { instrument = key; sfx.tap(); renderTabs(); renderInstrument(); } }));
  }
  function renderTabs() { [...tabs.children].forEach(b => b.classList.toggle('sel', b.dataset.inst === instrument)); }

  // element handles used by the hoisted builders below (declare before the append)
  const recStatus = el('span', { class: 'rec-status' });
  const jamsList = el('div', { class: 'jams-list' });

  root.append(header, trioRow, tabs, area, backingRow(), recordBar(), jamsPanel());
  renderInstrument();
  refreshJams();

  // ---- the core hit: play + animate + (maybe) record ----
  function hit(i, v) {
    playEvent({ i, v });
    mirror(i);
    if (recording) events.push({ t: Math.min(JAM_MAX_MS, Math.round(performance.now() - recStart)), i, v });
  }
  function mirror(i) {
    const roleKey = i === 'drum' ? 'drummer' : i === 'key' ? 'keys' : 'guitarist';
    const a = trioEls[roleKey]; if (!a || REDUCED) return;
    a.classList.remove('play'); void a.offsetWidth; a.classList.add('play');
  }

  // ---- instruments ----
  function renderInstrument() {
    clear(area);
    if (instrument === 'drums') area.appendChild(drumsUI());
    else if (instrument === 'keys') area.appendChild(keysUI());
    else area.appendChild(guitarUI());
  }
  function drumsUI() {
    const grid = el('div', { class: 'drum-grid' });
    for (const pad of DRUM_PADS) {
      const b = el('button', { class: 'drum-pad pad-' + pad, dataset: { pad }, text: DRUM_LABEL[pad] });
      suppressContextMenu(b);
      // pointerdown per pad → independent, so several fingers hit several pads at once (multi-touch)
      b.addEventListener('pointerdown', e => { e.preventDefault(); hit('drum', pad); b.classList.remove('hit'); void b.offsetWidth; b.classList.add('hit'); setTimeout(() => b.classList.remove('hit'), 140); });
      grid.appendChild(b);
    }
    return grid;
  }
  function keysUI() {
    const wrap = el('div', { class: 'keys-wrap' });
    const toggle = el('label', { class: 'playalong-toggle' }, [
      el('input', { type: 'checkbox', checked: playAlong ? 'checked' : undefined, onchange: (e) => { playAlong = e.target.checked; twinkleIdx = 0; renderKeys(); } }),
      el('span', { text: '✨ Play-along: Twinkle Twinkle' })
    ]);
    const row = el('div', { class: 'keys-row' });
    wrap.append(toggle, row);
    function renderKeys() {
      clear(row);
      KEY_SEMIS.forEach((semi, idx) => {
        const wanted = playAlong && TWINKLE[twinkleIdx] === idx;
        const k = el('button', { class: 'key' + (wanted ? ' sparkle' : ''), dataset: { idx: String(idx) } });
        suppressContextMenu(k);
        k.addEventListener('pointerdown', e => { e.preventDefault(); hit('key', semi); k.classList.remove('down'); void k.offsetWidth; k.classList.add('down'); setTimeout(() => k.classList.remove('down'), 160);
          if (playAlong && TWINKLE[twinkleIdx] === idx) { twinkleIdx = (twinkleIdx + 1) % TWINKLE.length; renderKeys(); }
        });
        row.appendChild(k);
      });
    }
    renderKeys();
    wrap._renderKeys = renderKeys;
    return wrap;
  }
  function guitarUI() {
    const wrap = el('div', { class: 'guitar-wrap' });
    const chords = el('div', { class: 'chord-row' });
    for (const c of GUITAR_CHORDS) {
      const b = el('button', { class: 'chord-btn' + (heldChord === c ? ' sel' : ''), dataset: { chord: c }, text: c, onclick: () => { heldChord = c; sfx.tap(); [...chords.children].forEach(x => x.classList.toggle('sel', x.dataset.chord === heldChord)); } });
      chords.appendChild(b);
    }
    const strum = el('div', { class: 'strum-strip', text: 'strum here →' });
    suppressContextMenu(strum);
    let lastStrum = 0;
    const doStrum = () => { const now = performance.now(); if (now - lastStrum < 220) return; lastStrum = now; hit('guitar', heldChord); strum.classList.remove('strummed'); void strum.offsetWidth; strum.classList.add('strummed'); };
    strum.addEventListener('pointerdown', e => { e.preventDefault(); doStrum(); });
    strum.addEventListener('pointermove', e => { if (e.buttons) doStrum(); });
    wrap.append(el('p', { class: 'guitar-hint', text: 'Pick a chord, then strum!' }), chords, strum);
    return wrap;
  }

  // ---- backing loop toggle (off by default) ----
  function backingRow() {
    const t = el('label', { class: 'backing-toggle' }, [
      el('input', { type: 'checkbox', onchange: (e) => setBacking(e.target.checked) }),
      el('span', { text: '🎶 Backing beat' })
    ]);
    return el('div', { class: 'band-backing' }, [t]);
  }
  function setBacking(on) {
    backing = on;
    if (backingCtl) { backingCtl.stop(); backingCtl = null; }
    if (on) backingCtl = startBandWatch({ events: BACKING.events, dur: BACKING.dur });
  }

  // ---- record / stop / play / save ----
  function recordBar() {
    const recBtn = el('button', { class: 'btn rec-btn', text: '● Record', onclick: () => toggleRecord() });
    const playBtn = el('button', { class: 'btn soft rec-play', text: '▶ Play', onclick: () => playRecording() });
    const saveBtn = el('button', { class: 'btn rec-save', text: '💾 Save', onclick: () => saveRecording() });
    recordBar._recBtn = recBtn;
    return el('div', { class: 'band-record' }, [recBtn, playBtn, saveBtn, recStatus]);
  }
  function toggleRecord() {
    if (recording) { stopRecord(); return; }
    recording = true; events = []; recStart = performance.now();
    recordBar._recBtn.textContent = '■ Stop'; recordBar._recBtn.classList.add('recording');
    recStatus.textContent = 'Recording…';
    recTimer = setTimeout(stopRecord, JAM_MAX_MS);
  }
  function stopRecord() {
    if (!recording) return;
    recording = false; if (recTimer) { clearTimeout(recTimer); recTimer = null; }
    recordBar._recBtn.textContent = '● Record'; recordBar._recBtn.classList.remove('recording');
    recStatus.textContent = events.length ? `${events.length} notes captured` : 'Nothing recorded yet';
  }
  function playRecording(evs) {
    const list = evs || events;
    if (!list.length) { recStatus.textContent = 'Record something first!'; return; }
    if (playCtl) { playCtl.stop(); playCtl = null; }
    const dur = list.reduce((m, e) => Math.max(m, e.t), 0) + 400;
    let timers = [];
    list.forEach(ev => timers.push(setTimeout(() => { playEvent(ev); mirror(ev.i); }, ev.t)));
    playCtl = { stop() { timers.forEach(clearTimeout); } };
    recStatus.textContent = 'Playing…';
    setTimeout(() => { recStatus.textContent = ''; }, dur);
  }
  async function saveRecording() {
    if (!events.length) { recStatus.textContent = 'Record something first!'; return; }
    const jams = await listJams();
    if (jams.length >= MAX_JAMS) { recStatus.textContent = `You have ${MAX_JAMS} jams — hold one to delete it first.`; return; }
    const name = await promptName();
    if (name == null) return;
    const id = 'jam_' + dayHash(name + events.length + Math.round(performance.now())) + '_' + jams.length;
    const dur = events.reduce((m, e) => Math.max(m, e.t), 0) + 400;
    await idbPut('jams', { id, name: name || ('Jam ' + (jams.length + 1)), events: events.slice(), dur, at: Date.now() });
    recStatus.textContent = 'Saved! 🎉';
    refreshJams();
  }
  function promptName() {
    return new Promise(resolve => {
      const input = el('input', { class: 'text-input small', type: 'text', placeholder: 'Name your jam', maxlength: '18', value: 'My Jam' });
      dialog({ title: 'Save your jam', body: el('div', {}, [input]), buttons: [{ label: 'Save', value: 'save' }, { label: 'Cancel', value: null, kind: 'soft' }] })
        .then(v => resolve(v === 'save' ? (input.value || '').trim().slice(0, 18) : null));
      setTimeout(() => input.focus(), 60);
    });
  }

  // ---- saved jams list ----
  function jamsPanel() { return el('div', { class: 'band-jams' }, [el('h3', { text: 'Saved jams' }), jamsList]); }
  async function refreshJams() {
    const jams = await listJams();
    clear(jamsList);
    if (!jams.length) { jamsList.appendChild(el('p', { class: 'jams-empty', text: 'Record a jam and save it — up to three live here.' })); return; }
    const cur = getState().bandSong;
    for (const j of jams) {
      const setBtn = el('button', { class: 'btn soft jam-set' + (cur === j.id ? ' active' : ''), text: cur === j.id ? '★ Band song' : 'Set as band song', onclick: () => { mutate(st => { st.bandSong = j.id; }); sfx.star(); refreshJams(); } });
      const row = el('div', { class: 'jam-row', dataset: { id: j.id } }, [
        el('span', { class: 'jam-name', text: j.name }),
        el('button', { class: 'btn soft jam-play', text: '▶', 'aria-label': 'Play ' + j.name, onclick: () => playRecording(j.events) }),
        setBtn,
        el('span', { class: 'jam-hint', text: 'hold to delete' })
      ]);
      attachHoldDelete(row, j);
      jamsList.appendChild(row);
    }
  }
  function attachHoldDelete(row, jam) {
    let timer = null;
    const start = () => { timer = setTimeout(async () => {
      timer = null;
      const ok = await dialog({ title: 'Delete this jam?', body: `"${jam.name}" will be gone for good.`, buttons: [{ label: 'Delete', value: true, kind: 'danger' }, { label: 'Keep it', value: false, kind: 'soft' }] });
      if (ok) { await idbDelete('jams', jam.id); if (getState().bandSong === jam.id) mutate(st => { st.bandSong = null; }); refreshJams(); }
    }, 650); };
    const clearT = () => { if (timer) { clearTimeout(timer); timer = null; } };
    row.addEventListener('pointerdown', start);
    row.addEventListener('pointerup', clearT);
    row.addEventListener('pointerleave', clearT);
    row.addEventListener('pointercancel', clearT);
    suppressContextMenu(row);
  }

  function leave() {
    if (playCtl) playCtl.stop();
    if (backingCtl) backingCtl.stop();
    if (recTimer) clearTimeout(recTimer);
    ctx.go('town');
  }

  // ---- QA hooks (invisible in play) ----
  if (typeof window !== 'undefined') window.__band = {
    trio: () => trio,
    setInstrument: (i) => { instrument = i; renderTabs(); renderInstrument(); },
    hit: (i, v) => hit(i, v),
    record: () => toggleRecord(),
    stop: () => stopRecord(),
    events: () => events.slice(),
    recording: () => recording,
    play: () => playRecording(),
    save: (name) => { events._forceName = name; return doSave(name); },
    setPlayAlong: (on) => { instrument = 'keys'; playAlong = on; twinkleIdx = 0; renderTabs(); renderInstrument(); },
    twinkleIdx: () => twinkleIdx,
    nextWantedKey: () => (playAlong ? TWINKLE[twinkleIdx] : -1),
    pressKey: (idx) => { hit('key', KEY_SEMIS[idx]); if (playAlong && TWINKLE[twinkleIdx] === idx) { twinkleIdx = (twinkleIdx + 1) % TWINKLE.length; renderInstrument(); } },
    jams: () => listJams(),
    setBandSong: (id) => mutate(st => { st.bandSong = id; }),
    deleteJam: (id) => idbDelete('jams', id)
  };
  // a direct save path for tests (skips the name dialog)
  async function doSave(name) {
    if (!events.length) return { ok: false, reason: 'empty' };
    const jams = await listJams();
    if (jams.length >= MAX_JAMS) return { ok: false, reason: 'full' };
    const id = 'jam_' + dayHash((name || '') + events.length) + '_' + jams.length + '_' + Math.round(performance.now());
    const dur = events.reduce((m, e) => Math.max(m, e.t), 0) + 400;
    await idbPut('jams', { id, name: name || ('Jam ' + (jams.length + 1)), events: events.slice(), dur, at: Date.now() });
    refreshJams();
    return { ok: true, id };
  }

  return { unmount() { if (playCtl) playCtl.stop(); if (backingCtl) backingCtl.stop(); if (recTimer) clearTimeout(recTimer); } };
}

// a simple backing loop (soft drums + bass), off by default
const BACKING = (() => {
  const ev = []; let t = 0; const beat = 460;
  for (let i = 0; i < 16; i++) {
    if (i % 2 === 0) ev.push({ t, i: 'drum', v: 'kick' });
    if (i % 4 === 2) ev.push({ t, i: 'drum', v: 'snare' });
    ev.push({ t, i: 'drum', v: 'hihat' });
    t += beat / 2;
  }
  return { events: ev, dur: t };
})();
