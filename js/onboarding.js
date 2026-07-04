// js/onboarding.js — first-launch flow (spec §2, §4.1, §5.1).
// splash -> name -> guide creator (live preview + shuffle) -> 3 intro bubbles -> free box -> hub.

import { el, clear } from './ui.js';
import * as State from './state.js';
import { renderGuide } from './art.js';
import { initAudio, sfx, music } from './sfx.js';
import { guideLineAt, speakMaybe } from './guide.js';

const BODIES = [
  { key: 'sunshine', label: 'Sunshine', hex: '#FFD166' },
  { key: 'lilac',    label: 'Lilac',    hex: '#C6A9F0' },
  { key: 'sky',      label: 'Sky',      hex: '#8FC7FF' }
];
const PATCHES = [
  { key: 'cocoa',  label: 'Cocoa',  hex: '#8A5A44' },
  { key: 'indigo', label: 'Indigo', hex: '#3B2E7E' },
  { key: 'pink',   label: 'Pink',   hex: '#FF7AC6' }
];
const ACCS = [
  { key: 'none',       label: 'None' },
  { key: 'bow',        label: 'Bow' },
  { key: 'sunglasses', label: 'Star shades' },
  { key: 'crown',      label: 'Crown' },
  { key: 'headphones', label: 'Headphones' }
];

const rand = (n) => (Math.random() * n) | 0;

export function mount(container, params, ctx) {
  let step = 0;
  let name = '';
  const guide = { body: 'sunshine', patch: 'cocoa', acc: 'bow', name: 'Twiggy' };

  const root = el('div', { class: 'onboard' });
  container.appendChild(root);
  render();

  function render() {
    clear(root);
    if (step === 0) splash();
    else if (step === 1) nameStep();
    else if (step === 2) creatorStep();
    else introStep();
  }

  function splash() {
    root.appendChild(el('div', { class: 'ob-splash' }, [
      el('div', { class: 'ob-guide', html: renderGuide(guide, { view: 'full', size: 200, cls: 'art-idle' }) }),
      el('h1', { class: 'ob-title', text: 'Boo Town' }),
      el('p', { class: 'ob-sub', text: 'A little town full of Boos, waiting for you.' }),
      el('button', { class: 'btn big', text: 'Start ✨', onclick: () => { initAudio(); music.play('calm'); sfx.tap(); step = 1; render(); } })
    ]));
  }

  function nameStep() {
    const input = el('input', {
      class: 'text-input', type: 'text', maxlength: '16', autocomplete: 'off',
      autocapitalize: 'words', placeholder: 'Your name', 'aria-label': 'Your name', value: name
    });
    const done = el('button', { class: 'btn big', text: 'Next', disabled: true, onclick: next });
    input.addEventListener('input', () => {
      name = input.value.trim();
      if (name) done.removeAttribute('disabled'); else done.setAttribute('disabled', '');
    });
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && name) next(); });

    root.appendChild(el('div', { class: 'ob-name' }, [
      el('div', { class: 'ob-guide small', html: renderGuide(guide, { view: 'head', size: 130 }) }),
      el('h2', { text: "What's your name?" }),
      el('p', { class: 'ob-hint', text: 'Just your first name is perfect.' }),
      input, done
    ]));
    setTimeout(() => input.focus(), 120);

    function next() { sfx.tap(); step = 2; render(); }
  }

  function creatorStep() {
    const preview = el('div', { class: 'creator-preview', html: renderGuide(guide, { view: 'full', size: 180, cls: 'art-idle' }) });
    function refresh() { preview.innerHTML = renderGuide(guide, { view: 'full', size: 180, cls: 'art-idle' }); }

    const bodyRow = swatchRow(BODIES, () => guide.body, k => { guide.body = k; sfx.tap(); refresh(); });
    const patchRow = swatchRow(PATCHES, () => guide.patch, k => { guide.patch = k; sfx.tap(); refresh(); });
    const accRow = chipRow(ACCS, () => guide.acc, k => { guide.acc = k; sfx.tap(); refresh(); });

    const nameInput = el('input', {
      class: 'text-input small', type: 'text', maxlength: '14', autocomplete: 'off',
      autocapitalize: 'words', value: guide.name, 'aria-label': "Your guide's name"
    });
    nameInput.addEventListener('input', () => { guide.name = nameInput.value.trim() || 'Twiggy'; });

    const shuffle = el('button', { class: 'btn soft', text: '🎲 Surprise me', onclick: () => {
      sfx.tap();
      guide.body = BODIES[rand(BODIES.length)].key;
      guide.patch = PATCHES[rand(PATCHES.length)].key;
      guide.acc = ACCS[rand(ACCS.length)].key;
      refresh();
      // reflect selection state
      [bodyRow, patchRow, accRow].forEach(r => r._sync && r._sync());
    }});

    const done = el('button', { class: 'btn big', text: 'Done ✨', onclick: () => {
      sfx.tap();
      guide.name = nameInput.value.trim() || 'Twiggy';
      State.initNew(name, { ...guide });
      ctx.refreshAudio && ctx.refreshAudio();
      step = 3; render();
    }});

    root.appendChild(el('div', { class: 'creator' }, [
      el('h2', { text: 'Make your guide!' }),
      preview,
      el('div', { class: 'creator-controls' }, [
        el('div', { class: 'cc-group' }, [ el('span', { class: 'cc-label', text: 'Colour' }), bodyRow ]),
        el('div', { class: 'cc-group' }, [ el('span', { class: 'cc-label', text: 'Patches' }), patchRow ]),
        el('div', { class: 'cc-group' }, [ el('span', { class: 'cc-label', text: 'Accessory' }), accRow ]),
        el('div', { class: 'cc-group' }, [ el('span', { class: 'cc-label', text: 'Name' }), nameInput ])
      ]),
      el('div', { class: 'creator-btns' }, [ shuffle, done ])
    ]));
  }

  function swatchRow(options, getSel, onPick) {
    const row = el('div', { class: 'swatch-row' });
    const btns = options.map(o => {
      const b = el('button', {
        class: 'swatch', 'aria-label': o.label, title: o.label,
        style: { background: o.hex }, onclick: () => { onPick(o.key); sync(); }
      });
      return b;
    });
    btns.forEach(b => row.appendChild(b));
    function sync() { options.forEach((o, i) => btns[i].classList.toggle('sel', getSel() === o.key)); }
    row._sync = sync; sync();
    return row;
  }

  function chipRow(options, getSel, onPick) {
    const row = el('div', { class: 'chip-row' });
    const btns = options.map(o => el('button', {
      class: 'acc-chip', text: o.label, onclick: () => { onPick(o.key); sync(); }
    }));
    btns.forEach(b => row.appendChild(b));
    function sync() { options.forEach((o, i) => btns[i].classList.toggle('sel', getSel() === o.key)); }
    row._sync = sync; sync();
    return row;
  }

  function introStep() {
    let i = 0;
    const bubble = el('div', { class: 'speech-bubble intro-bubble' });
    const art = el('div', { class: 'ob-guide', html: renderGuide(guide, { view: 'full', size: 190, cls: 'art-idle' }) });
    const tapHint = el('p', { class: 'ob-hint', text: 'tap to continue' });
    const block = el('div', { class: 'intro-block', onclick: advance }, [ art, bubble, tapHint ]);
    root.appendChild(block);
    showLine();

    function showLine() {
      const text = guideLineAt('firstHello', i);
      bubble.textContent = text;
      bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop');
      speakMaybe(text);
    }
    function advance() {
      sfx.tap();
      i++;
      if (i < 3) showLine();
      else finish();
    }
  }

  function finish() {
    // free first box, straight into the ceremony so she owns a Boo within the first minute
    State.mutate(s => { s.boxes += 1; s.seen.onboarded = true; });
    ctx.go('ceremony');
  }

  return { unmount() {} };
}
