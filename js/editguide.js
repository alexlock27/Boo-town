// js/editguide.js — edit the guide later from the collection (spec §4.1).

import { el } from './ui.js';
import { getState, mutate } from './state.js';
import { renderGuide } from './art.js';
import { sfx } from './sfx.js';

const BODIES = [['sunshine','#FFD166'],['lilac','#C6A9F0'],['sky','#8FC7FF']];
const PATCHES = [['cocoa','#8A5A44'],['indigo','#3B2E7E'],['pink','#FF7AC6']];
const ACCS = [['none','None'],['bow','Bow'],['sunglasses','Star shades'],['crown','Crown'],['headphones','Headphones']];
const rand = (n) => (Math.random() * n) | 0;

export function mount(container, params, ctx) {
  const g = { ...getState().guide };
  const back = (params && params.from) || 'collection';

  const preview = el('div', { class: 'creator-preview', html: renderGuide(g, { view: 'full', size: 180, cls: 'art-idle' }) });
  const refresh = () => { preview.innerHTML = renderGuide(g, { view: 'full', size: 180, cls: 'art-idle' }); syncAll(); };

  const bodyRow = swatchRow(BODIES, () => g.body, k => { g.body = k; sfx.tap(); refresh(); });
  const patchRow = swatchRow(PATCHES, () => g.patch, k => { g.patch = k; sfx.tap(); refresh(); });
  const accRow = chipRow(ACCS, () => g.acc, k => { g.acc = k; sfx.tap(); refresh(); });
  const nameInput = el('input', { class: 'text-input small', type: 'text', maxlength: '14', value: g.name, 'aria-label': "Guide's name" });
  nameInput.addEventListener('input', () => { g.name = nameInput.value.trim() || 'Twiggy'; });

  function syncAll() { [bodyRow, patchRow, accRow].forEach(r => r._sync && r._sync()); }

  const shuffle = el('button', { class: 'btn soft', text: '🎲 Surprise me', onclick: () => {
    g.body = BODIES[rand(BODIES.length)][0]; g.patch = PATCHES[rand(PATCHES.length)][0]; g.acc = ACCS[rand(ACCS.length)][0];
    sfx.tap(); refresh();
  }});
  const save = el('button', { class: 'btn big', text: 'Save ✨', onclick: () => {
    sfx.tap();
    g.name = nameInput.value.trim() || 'Twiggy';
    mutate(s => { s.guide = { ...g }; });
    ctx.go(back);
  }});

  const root = el('div', { class: 'onboard creator' }, [
    el('h2', { text: 'Edit your guide' }),
    preview,
    el('div', { class: 'creator-controls' }, [
      group('Colour', bodyRow), group('Patches', patchRow), group('Accessory', accRow), group('Name', nameInput)
    ]),
    el('div', { class: 'creator-btns' }, [ shuffle, save ])
  ]);
  container.appendChild(root);

  function group(label, node) { return el('div', { class: 'cc-group' }, [ el('span', { class: 'cc-label', text: label }), node ]); }

  function swatchRow(opts, getSel, onPick) {
    const row = el('div', { class: 'swatch-row' });
    const btns = opts.map(([key, hex]) => el('button', { class: 'swatch', style: { background: hex }, 'aria-label': key, onclick: () => { onPick(key); } }));
    btns.forEach(b => row.appendChild(b));
    row._sync = () => opts.forEach(([key], i) => btns[i].classList.toggle('sel', getSel() === key));
    row._sync();
    return row;
  }
  function chipRow(opts, getSel, onPick) {
    const row = el('div', { class: 'chip-row' });
    const btns = opts.map(([key, label]) => el('button', { class: 'acc-chip', text: label, onclick: () => { onPick(key); } }));
    btns.forEach(b => row.appendChild(b));
    row._sync = () => opts.forEach(([key], i) => btns[i].classList.toggle('sel', getSel() === key));
    row._sync();
    return row;
  }

  return { unmount() {} };
}
