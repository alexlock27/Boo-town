// js/buildaboo.js — Build-a-Boo (RUN3 C6). A parts workshop: pick a body, ears, eyes,
// mouth, tail, pattern and colour; name it and SEAL it. Sealed customs (cap 5) enter the
// mystery-box pool with a 10% slice while unwon; winning one plays the ceremony banner.

import { el, clear, backControl } from './ui.js';
import { sfx, music } from './sfx.js';
import { renderCustomBoo, BUILD_PARTS } from './art.js';
import { addSealedCustom, canSeal, sealedCustoms, CUSTOM_CAP } from './customs.js';
import { stampJournal } from './quests.js';

const PART_LABELS = { body: 'Body', ears: 'Ears', eyes: 'Eyes', mouth: 'Mouth', tail: 'Tail', pattern: 'Pattern' };
const PART_ORDER = ['body', 'ears', 'eyes', 'mouth', 'tail', 'pattern'];

export function mount(container, params, ctx) {
  music.play('calm');
  const root = el('div', { class: 'build-screen' });
  const header = el('header', { class: 'studio-header' }, [
    backControl(() => ctx.go('studio')),
    el('h2', { text: '🧩 Build a Boo' })
  ]);

  const parts = { body: 'round', ears: 'round', eyes: 'round', mouth: 'smile', tail: 'curl', pattern: 'spots', colour: BUILD_PARTS.colour[0] };
  const preview = el('div', { class: 'build-preview' });
  function refresh() { preview.innerHTML = renderCustomBoo(parts, { size: 200, cls: 'art-idle' }); }
  refresh();

  // part option rows
  const rows = el('div', { class: 'build-rows' });
  for (const part of PART_ORDER) {
    const row = el('div', { class: 'build-row' }, [el('span', { class: 'build-label', text: PART_LABELS[part] })]);
    const opts = el('div', { class: 'build-opts' });
    BUILD_PARTS[part].forEach(val => {
      const b = el('button', { class: 'build-opt' + (parts[part] === val ? ' sel' : ''), text: prettyPart(part, val), onclick: () => { parts[part] = val; sfx.tap(); [...opts.children].forEach(x => x.classList.remove('sel')); b.classList.add('sel'); refresh(); } });
      opts.appendChild(b);
    });
    row.appendChild(opts); rows.appendChild(row);
  }
  // colour row
  const colourRow = el('div', { class: 'build-row' }, [el('span', { class: 'build-label', text: 'Colour' })]);
  const colourOpts = el('div', { class: 'build-opts colours' });
  BUILD_PARTS.colour.forEach(hex => { const b = el('button', { class: 'build-colour' + (parts.colour === hex ? ' sel' : ''), style: { background: hex }, 'aria-label': 'colour', onclick: () => { parts.colour = hex; [...colourOpts.children].forEach(x => x.classList.remove('sel')); b.classList.add('sel'); refresh(); } }); colourOpts.appendChild(b); });
  colourRow.appendChild(colourOpts); rows.appendChild(colourRow);

  const nameInput = el('input', { class: 'text-input build-name', type: 'text', maxlength: '16', placeholder: 'Name your Boo', value: '' });
  const shuffleBtn = el('button', { class: 'btn soft', text: '🎲 Surprise me', onclick: () => { for (const p of PART_ORDER) parts[p] = pick(BUILD_PARTS[p]); parts.colour = pick(BUILD_PARTS.colour); sfx.tap(); rebuild(); } });
  const sealBtn = el('button', { class: 'btn build-seal', text: '🔒 Seal it!', onclick: () => seal() });
  const msg = el('div', { class: 'build-msg' });

  function updateCap() {
    const n = sealedCustoms().length;
    msg.textContent = canSeal() ? `You can seal ${CUSTOM_CAP - n} more. Sealed Boos appear in your mystery boxes!` : `You've sealed ${CUSTOM_CAP}! Win some from boxes to make room.`;
    sealBtn.disabled = !canSeal();
  }
  updateCap();

  function seal() {
    if (!canSeal()) return;
    const first = sealedCustoms().length === 0;
    addSealedCustom(parts, nameInput.value.trim() || 'My Boo');
    if (first) stampJournal('firstCustom');
    sfx.star();
    msg.textContent = '🎉 Sealed! It\'s hidden in your mystery boxes now — open boxes to win it!';
    msg.classList.add('ok');
    updateCap();
  }

  function rebuild() {
    refresh();
    // re-mark selected options
    rows.querySelectorAll('.build-row').forEach((row, i) => {
      const part = i < PART_ORDER.length ? PART_ORDER[i] : 'colour';
      if (part === 'colour') { [...row.querySelectorAll('.build-colour')].forEach(b => b.classList.toggle('sel', b.style.background === toRgb(parts.colour))); return; }
      const vals = BUILD_PARTS[part];
      row.querySelectorAll('.build-opt').forEach((b, j) => b.classList.toggle('sel', vals[j] === parts[part]));
    });
  }

  root.append(header, el('div', { class: 'build-top' }, [preview, el('div', { class: 'build-name-wrap' }, [nameInput, shuffleBtn])]), rows, el('div', { class: 'build-actions' }, [sealBtn]), msg);
  container.appendChild(root);

  // test hook
  if (typeof window !== 'undefined') window.__build = { set: (p) => { Object.assign(parts, p); rebuild(); }, seal: (name) => { if (name != null) nameInput.value = name; seal(); }, canSeal: () => canSeal(), sealedCount: () => sealedCustoms().length };
  return { unmount() {} };
}

function prettyPart(part, val) { return val === 'none' ? 'None' : val.charAt(0).toUpperCase() + val.slice(1); }
function pick(a) { return a[(Math.random() * a.length) | 0]; }
function toRgb(hex) { const h = hex.replace('#', ''); return `rgb(${parseInt(h.slice(0, 2), 16)}, ${parseInt(h.slice(2, 4), 16)}, ${parseInt(h.slice(4, 6), 16)})`; }
