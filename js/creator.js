// js/creator.js — shared character creator (5-species rig, spec RUN2 C1).
// Used by onboarding (first launch), the "My character" card in the Collection,
// and the hub long-press. One builder keeps all three in sync.

import { el } from './ui.js';
import {
  renderGuide, GUIDE_SPECIES, GUIDE_BODIES, GUIDE_PATTERNS,
  GUIDE_PATTERN_COLOURS, GUIDE_EYES, GUIDE_ACCS
} from './art.js';
import { sfx } from './sfx.js';
import { getState } from './state.js';
import { BY_ID } from '../data/catalogue.js';

const SPECIES_EMOJI = { giraffe: '🦒', puppy: '🐶', kitten: '🐱', penguin: '🐧', bunny: '🐰' };
const rand = (n) => (Math.random() * n) | 0;

// Owned accessory items become extra accessory choices (populated from phase 2).
export function ownedAccessoryOptions() {
  const s = getState();
  if (!s || !s.inventory) return [];
  return Object.keys(s.inventory)
    .filter(id => s.inventory[id] > 0 && BY_ID[id] && BY_ID[id].kind === 'accessory')
    .map(id => ({ key: id, label: BY_ID[id].name }));
}

// buildCreator(guide, { doneLabel, onDone(guide), onChange(guide), previewSize })
// Returns { nodes:[...], guide, refresh }.
export function buildCreator(guideObj, opts = {}) {
  const guide = { ...guideObj };
  const previewSize = opts.previewSize || 190;

  const preview = el('div', { class: 'creator-preview', html: renderGuide(guide, { view: 'full', size: previewSize, cls: 'art-idle' }) });
  const rows = [];

  function refresh() {
    preview.innerHTML = renderGuide(guide, { view: 'full', size: previewSize, cls: 'art-idle' });
    rows.forEach(r => r._sync && r._sync());
    opts.onChange && opts.onChange(guide);
  }
  function pick() { sfx.tap(); refresh(); }

  const accOptions = [...GUIDE_ACCS, ...ownedAccessoryOptions()];

  const speciesRow = pillRow(
    GUIDE_SPECIES.map(o => ({ key: o.key, label: (SPECIES_EMOJI[o.key] || '') + ' ' + o.label })),
    () => guide.species, k => { guide.species = k; pick(); }
  );
  const bodyRow    = swatchRow(GUIDE_BODIES,          () => guide.body,          k => { guide.body = k; pick(); });
  const patternRow = pillRow(GUIDE_PATTERNS.map(labelize), () => guide.pattern,  k => { guide.pattern = k; pick(); });
  const patColRow  = swatchRow(GUIDE_PATTERN_COLOURS, () => guide.patternColour, k => { guide.patternColour = k; pick(); });
  const eyesRow    = pillRow(GUIDE_EYES.map(labelize),    () => guide.eyes,      k => { guide.eyes = k; pick(); });
  const accRow     = pillRow(accOptions,                  () => guide.acc,       k => { guide.acc = k; pick(); });
  rows.push(speciesRow, bodyRow, patternRow, patColRow, eyesRow, accRow);

  const nameInput = el('input', {
    class: 'text-input small', type: 'text', maxlength: '14', autocomplete: 'off',
    autocapitalize: 'words', value: guide.name, 'aria-label': 'Character name'
  });
  nameInput.addEventListener('input', () => {
    guide.name = nameInput.value.trim() || guide.name;
    opts.onChange && opts.onChange(guide);
  });

  const shuffle = el('button', { class: 'btn soft', text: '🎲 Surprise me', onclick: () => {
    guide.species       = GUIDE_SPECIES[rand(GUIDE_SPECIES.length)].key;
    guide.body          = GUIDE_BODIES[rand(GUIDE_BODIES.length)].key;
    guide.pattern       = GUIDE_PATTERNS[rand(GUIDE_PATTERNS.length)].key;
    guide.patternColour = GUIDE_PATTERN_COLOURS[rand(GUIDE_PATTERN_COLOURS.length)].key;
    guide.eyes          = GUIDE_EYES[rand(GUIDE_EYES.length)].key;
    guide.acc           = accOptions[rand(accOptions.length)].key;
    pick();
  }});

  const done = el('button', { class: 'btn big', text: opts.doneLabel || 'Done ✨', onclick: () => {
    sfx.tap();
    guide.name = (nameInput.value.trim() || guide.name || 'Twiggy');
    opts.onDone && opts.onDone({ ...guide });
  }});

  const controls = el('div', { class: 'creator-controls' }, [
    group('Animal', speciesRow),
    group('Colour', bodyRow),
    group('Pattern', patternRow),
    group('Pattern colour', patColRow),
    group('Eyes', eyesRow),
    group('Accessory', accRow),
    group('Name', nameInput)
  ]);

  return { nodes: [preview, controls, el('div', { class: 'creator-btns' }, [shuffle, done])], guide, refresh };

  function group(label, node) { return el('div', { class: 'cc-group' }, [el('span', { class: 'cc-label', text: label }), node]); }
}

function labelize(o) { return { key: o.key, label: o.label || o.key }; }

function swatchRow(options, getSel, onPick) {
  const row = el('div', { class: 'swatch-row' });
  const btns = options.map(o => el('button', {
    class: 'swatch', 'aria-label': o.label || o.key, title: o.label || o.key,
    style: { background: o.hex }, onclick: () => onPick(o.key)
  }));
  btns.forEach(b => row.appendChild(b));
  row._sync = () => options.forEach((o, i) => btns[i].classList.toggle('sel', getSel() === o.key));
  row._sync();
  return row;
}

function pillRow(options, getSel, onPick) {
  const row = el('div', { class: 'chip-row' });
  const btns = options.map(o => el('button', { class: 'acc-chip', text: o.label, onclick: () => onPick(o.key) }));
  btns.forEach(b => row.appendChild(b));
  row._sync = () => options.forEach((o, i) => btns[i].classList.toggle('sel', getSel() === o.key));
  row._sync();
  return row;
}
