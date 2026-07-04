// js/grownups.js — the grown-ups corner (spec §5.7). Plain adult styling.

import { el } from './ui.js';
import { getState, mutate, exportCode, importCode, resetAll } from './state.js';
import { setSoundEnabled, setMusicEnabled, music } from './sfx.js';
import * as tts from './tts.js';

export function mount(container, params, ctx) {
  const s = getState();

  const root = el('div', { class: 'grownups' });
  const header = el('header', { class: 'gu-header' }, [
    el('button', { class: 'btn soft', text: '← Back', onclick: () => ctx.go('hub') }),
    el('h2', { text: "Grown-ups corner" })
  ]);

  // ---- audio toggles ----
  const toggles = el('div', { class: 'gu-card' }, [
    el('h3', { text: 'Sound & voice' }),
    toggle('Sound effects', s.settings.sound, v => { mutate(st => st.settings.sound = v); setSoundEnabled(v); }),
    toggle('Music', s.settings.music, v => { mutate(st => st.settings.music = v); setMusicEnabled(v); if (v) music.play('calm'); }),
    toggle('Voice (reads words aloud)', s.settings.voice, v => { mutate(st => st.settings.voice = v); tts.setEnabled(v); }),
    el('p', { class: 'gu-note', text: tts.available() ? 'A voice is available on this device.' : 'No speech voice found — the Peek button covers spelling.' })
  ]);

  // ---- backup ----
  const codeBox = el('textarea', { class: 'gu-code', readonly: true, rows: '3', 'aria-label': 'Your backup code' });
  codeBox.value = exportCode();
  const copyBtn = el('button', { class: 'btn', text: 'Copy code', onclick: () => copy() });
  const copyMsg = el('span', { class: 'gu-msg' });
  async function copy() {
    try { await navigator.clipboard.writeText(codeBox.value); copyMsg.textContent = 'Copied ✓'; }
    catch { codeBox.select(); try { document.execCommand('copy'); copyMsg.textContent = 'Copied ✓'; } catch { copyMsg.textContent = 'Select the text and copy it.'; } }
    setTimeout(() => copyMsg.textContent = '', 2500);
  }

  const restoreInput = el('textarea', { class: 'gu-code', rows: '3', placeholder: 'Paste a backup code here…', 'aria-label': 'Paste backup code to restore' });
  const restoreMsg = el('span', { class: 'gu-msg' });
  const restoreBtn = el('button', { class: 'btn secondary', text: 'Restore from code', onclick: () => {
    const res = importCode(restoreInput.value);
    if (res.ok) { restoreMsg.textContent = 'Restored! Reloading…'; ctx.refreshAudio && ctx.refreshAudio(); setTimeout(() => location.reload(), 700); }
    else { restoreMsg.textContent = res.error || 'Could not restore.'; restoreMsg.classList.add('err'); }
  }});

  const backup = el('div', { class: 'gu-card' }, [
    el('h3', { text: 'Backup & restore' }),
    el('p', { class: 'gu-note', text: 'This code is her whole save. Keep it somewhere safe. Paste it on another device (or after a reset) to bring everything back.' }),
    codeBox,
    el('div', { class: 'gu-row' }, [copyBtn, copyMsg]),
    el('hr', {}),
    restoreInput,
    el('div', { class: 'gu-row' }, [restoreBtn, restoreMsg])
  ]);

  // ---- reset ----
  const resetInput = el('input', { class: 'text-input small', type: 'text', placeholder: 'type RESET', 'aria-label': 'type RESET to confirm' });
  const resetBtn = el('button', { class: 'btn danger', text: 'Reset everything', disabled: true, onclick: () => {
    resetAll();
    ctx.go('onboarding');
  }});
  resetInput.addEventListener('input', () => { if (resetInput.value.trim() === 'RESET') resetBtn.removeAttribute('disabled'); else resetBtn.setAttribute('disabled', ''); });

  const reset = el('div', { class: 'gu-card gu-danger' }, [
    el('h3', { text: 'Start over' }),
    el('p', { class: 'gu-note', text: 'This erases her name, guide, stars, Boos and town on THIS device. There is no undo (use a backup code first).' }),
    el('div', { class: 'gu-row' }, [resetInput, resetBtn])
  ]);

  root.append(header, toggles, backup, reset);
  container.appendChild(root);

  function toggle(label, initial, onChange) {
    let on = initial;
    const sw = el('button', { class: 'gu-switch' + (on ? ' on' : ''), role: 'switch', 'aria-checked': String(on), 'aria-label': label });
    sw.appendChild(el('span', { class: 'gu-knob' }));
    sw.addEventListener('click', () => { on = !on; sw.classList.toggle('on', on); sw.setAttribute('aria-checked', String(on)); onChange(on); });
    return el('div', { class: 'gu-toggle' }, [ el('span', { class: 'gu-label', text: label }), sw ]);
  }

  return { unmount() {} };
}
