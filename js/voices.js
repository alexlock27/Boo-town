// js/voices.js — Boo voices (RUN3 C7). Record up to 4s of your own voice for a Boo, choose
// a voice mode (normal / squeaky / deep, pitch-shifted playback), and from then on tapping
// that Boo in the town plays your recording. Everything stays on this device (IndexedDB).

import { el } from './ui.js';
import { getState } from './state.js';
import { sfx } from './sfx.js';
import { idbPut, idbGet, idbGetAll, idbDelete, idbClear, idbCount } from './idb.js';

export const MAX_SECONDS = 4;
export const VOICE_CAP = 15;
export const VOICE_MODES = { normal: 1.0, squeaky: 1.55, deep: 0.68 };
const KEY = (booId) => 'voice_' + booId;

let audioCtx = null;
function ctx() { if (!audioCtx) { try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch { audioCtx = null; } } return audioCtx; }

export function micEnabled() { const s = getState(); return !s || !s.settings || s.settings.mic !== false; }

// Which Boo ids currently have a saved voice (for the town to know what to play on tap).
export async function voiceBooIds() {
  const all = await idbGetAll('audio').catch(() => []);
  return new Set((all || []).map(r => r.booId));
}
export async function hasVoice(booId) { const r = await idbGet('audio', KEY(booId)).catch(() => null); return !!r; }
export async function voiceCount() { return idbCount('audio').catch(() => 0); }
export async function deleteAllVoices() { return idbClear('audio').catch(() => {}); }
export async function deleteVoice(booId) { return idbDelete('audio', KEY(booId)).catch(() => {}); }

// Save a recording (ArrayBuffer of encoded audio) + its chosen mode for a Boo.
export async function saveVoice(booId, arrayBuffer, mode) {
  await idbPut('audio', { id: KEY(booId), booId, mode, data: arrayBuffer, created: Date.now() });
}

// Play a Boo's saved voice with its stored pitch (decode + BufferSource.playbackRate).
export async function playVoice(booId) {
  const rec = await idbGet('audio', KEY(booId)).catch(() => null);
  if (!rec) return false;
  const ac = ctx(); if (!ac) return false;
  try {
    if (ac.state === 'suspended') await ac.resume();
    const buf = await ac.decodeAudioData(rec.data.slice(0));
    const src = ac.createBufferSource();
    src.buffer = buf; src.playbackRate.value = VOICE_MODES[rec.mode] || 1;
    const g = ac.createGain(); g.gain.value = 1; src.connect(g); g.connect(ac.destination);
    src.start();
    return true;
  } catch { return false; }
}

// The recording overlay for a Boo. onDone() fires after a save so callers can refresh.
export function openVoiceRecorder(booId, booName, { onDone } = {}) {
  const ov = el('div', { class: 'overlay voice-overlay', onclick: (e) => { if (e.target === ov) close(); } });
  let mode = 'normal', recorder = null, chunks = [], recorded = null, recording = false, timer = null, meterRaf = null, stream = null;

  const meter = el('div', { class: 'voice-meter' }, [el('div', { class: 'voice-meter-fill' })]);
  const recBtn = el('button', { class: 'btn big voice-rec', text: '● Record (tap)' });
  const status = el('div', { class: 'voice-status', text: `Tap to record up to ${MAX_SECONDS} seconds.` });
  const playBtn = el('button', { class: 'btn voice-play', text: '▶ Play back', disabled: true });
  const redoBtn = el('button', { class: 'btn soft voice-redo', text: '↺ Redo', disabled: true });
  const modeRow = el('div', { class: 'voice-modes' });
  Object.keys(VOICE_MODES).forEach(m => { const b = el('button', { class: 'voice-mode' + (m === mode ? ' sel' : ''), text: m, onclick: () => { mode = m; [...modeRow.children].forEach(x => x.classList.remove('sel')); b.classList.add('sel'); } }); modeRow.appendChild(b); });
  const saveBtn = el('button', { class: 'btn voice-save', text: '💾 Give them this voice', disabled: true });
  const saveMsg = el('div', { class: 'voice-msg' });

  recBtn.onclick = () => recording ? stopRec() : startRec();
  playBtn.onclick = () => playRecorded();
  redoBtn.onclick = () => { recorded = null; playBtn.disabled = true; redoBtn.disabled = true; saveBtn.disabled = true; status.textContent = `Tap to record up to ${MAX_SECONDS} seconds.`; };
  saveBtn.onclick = () => doSave();

  async function startRec() {
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) { status.textContent = 'No microphone found. You can still play with everything else!'; return; }
    chunks = []; recorder = new MediaRecorder(stream);
    recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    recorder.onstop = async () => { const blob = new Blob(chunks, { type: chunks[0] ? chunks[0].type : 'audio/webm' }); recorded = await blob.arrayBuffer(); playBtn.disabled = false; redoBtn.disabled = false; saveBtn.disabled = false; status.textContent = 'Sounds great! Play it back, pick a voice, then save.'; stopMeter(); };
    recorder.start(); recording = true; recBtn.textContent = '■ Stop'; recBtn.classList.add('on'); status.textContent = 'Recording… speak now!';
    startMeter(stream);
    timer = setTimeout(() => { if (recording) stopRec(); }, MAX_SECONDS * 1000);
  }
  function stopRec() { recording = false; recBtn.textContent = '● Record again'; recBtn.classList.remove('on'); if (timer) clearTimeout(timer); try { recorder && recorder.stop(); } catch {} if (stream) stream.getTracks().forEach(t => t.stop()); }

  function startMeter(str) {
    const ac = ctx(); if (!ac) return;
    const src = ac.createMediaStreamSource(str); const an = ac.createAnalyser(); an.fftSize = 256; src.connect(an);
    const data = new Uint8Array(an.frequencyBinCount);
    const fill = meter.querySelector('.voice-meter-fill');
    const tick = () => { an.getByteFrequencyData(data); let sum = 0; for (const v of data) sum += v; const level = Math.min(100, sum / data.length / 128 * 100 * 2.2); fill.style.width = level.toFixed(0) + '%'; meterRaf = requestAnimationFrame(tick); };
    tick();
  }
  function stopMeter() { if (meterRaf) cancelAnimationFrame(meterRaf); meterRaf = null; const fill = meter.querySelector('.voice-meter-fill'); if (fill) fill.style.width = '0%'; }

  async function playRecorded() {
    if (!recorded) return; const ac = ctx(); if (!ac) return;
    try { if (ac.state === 'suspended') await ac.resume(); const buf = await ac.decodeAudioData(recorded.slice(0)); const s2 = ac.createBufferSource(); s2.buffer = buf; s2.playbackRate.value = VOICE_MODES[mode]; s2.connect(ac.destination); s2.start(); } catch {}
  }

  async function doSave() {
    if (!recorded) return;
    const count = await voiceCount();
    const existing = await hasVoice(booId);
    if (count >= VOICE_CAP && !existing) {
      // oldest-first replacement prompt
      const all = (await idbGetAll('audio')).sort((a, b) => a.created - b.created);
      const oldest = all[0];
      saveMsg.innerHTML = '';
      saveMsg.append(
        el('span', { text: `That's ${VOICE_CAP} voices — the most. Replace the oldest one?` }),
        el('button', { class: 'btn danger', text: 'Replace oldest', onclick: async () => { if (oldest) await deleteVoice(oldest.booId); await store(); } }),
        el('button', { class: 'btn soft', text: 'Cancel', onclick: () => { saveMsg.textContent = ''; } })
      );
      return;
    }
    await store();
  }
  async function store() { await saveVoice(booId, recorded, mode); sfx.star(); saveMsg.textContent = ''; status.textContent = `${booName} has a voice now! Tap them in your town to hear it. 🎉`; saveBtn.disabled = true; onDone && onDone(); }

  function close() { stopRec(); stopMeter(); ov.remove(); }

  ov.appendChild(el('div', { class: 'card voice-card' }, [
    el('h3', { text: `🎤 Give ${booName} a voice` }),
    el('p', { class: 'voice-privacy', text: '🔒 Recordings stay on this device only. Nothing is ever uploaded.' }),
    meter, status, recBtn,
    el('div', { class: 'voice-row' }, [playBtn, redoBtn]),
    el('p', { class: 'voice-label', text: 'Voice:' }), modeRow,
    saveBtn, saveMsg,
    el('button', { class: 'btn soft voice-close', text: 'Done', onclick: close })
  ]));
  document.body.appendChild(ov);
  requestAnimationFrame(() => ov.classList.add('show'));

  // test hook: inject a recording without a real mic
  if (typeof window !== 'undefined') window.__voice = {
    injectRecording: (arrayBuffer) => { recorded = arrayBuffer; playBtn.disabled = false; redoBtn.disabled = false; saveBtn.disabled = false; },
    setMode: (m) => { mode = m; },
    save: doSave, close, hasRecorded: () => !!recorded
  };
  return { close };
}
