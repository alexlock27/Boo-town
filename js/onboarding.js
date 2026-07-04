// js/onboarding.js — first-launch flow (spec §2, §4.1, §5.1).
// splash -> name -> guide creator (live preview + shuffle) -> 3 intro bubbles -> free box -> hub.

import { el, clear } from './ui.js';
import * as State from './state.js';
import { renderGuide, renderItem } from './art.js';
import { buildCreator } from './creator.js';
import { initAudio, sfx, music } from './sfx.js';
import { guideLineAt, guideLine, speakMaybe } from './guide.js';
import { grantItem } from './rewards.js';
import { BY_ID } from '../data/catalogue.js';

const FIRST_PICKS = ['boo_inky', 'boo_lolly', 'boo_chomp']; // three friendly commons (RUN2 C2)

export function mount(container, params, ctx) {
  let step = 0;
  let name = '';
  const guide = { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'bow', name: 'Twiggy' };

  const root = el('div', { class: 'onboard' });
  container.appendChild(root);
  render();

  function render() {
    clear(root);
    if (step === 0) splash();
    else if (step === 1) nameStep();
    else if (step === 2) creatorStep();
    else if (step === 3) introStep();
    else firstPickStep();
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
    const creator = buildCreator(guide, {
      doneLabel: 'Done ✨',
      onChange(g) { Object.assign(guide, g); },
      onDone(g) {
        Object.assign(guide, g);
        State.initNew(name, { ...guide });
        ctx.refreshAudio && ctx.refreshAudio();
        step = 3; render();
      }
    });
    root.appendChild(el('div', { class: 'creator' }, [
      el('h2', { text: 'Make your character!' }),
      ...creator.nodes
    ]));
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
      else { step = 4; render(); }
    }
  }

  // "Pick your first Boo!" — the first reward is always a character she chooses (RUN2 C2).
  function firstPickStep() {
    const bubble = el('div', { class: 'speech-bubble intro-bubble' });
    bubble.textContent = guideLine('firstPick');
    speakMaybe(bubble.textContent);

    const row = el('div', { class: 'firstpick-row' });
    for (const id of FIRST_PICKS) {
      const item = BY_ID[id];
      row.appendChild(el('button', { class: 'firstpick-card', 'aria-label': item.name, onclick: () => choose(item) }, [
        el('div', { class: 'firstpick-art', html: renderItem(item, { size: 118, cls: 'art-idle' }) }),
        el('div', { class: 'firstpick-name', text: item.name })
      ]));
    }

    root.appendChild(el('div', { class: 'firstpick' }, [
      el('div', { class: 'ob-guide small', html: renderGuide(guide, { view: 'head', size: 108 }) }),
      el('h2', { text: 'Pick your first Boo!' }),
      bubble,
      row
    ]));

    function choose(item) {
      sfx.star ? sfx.star() : sfx.tap();
      grantItem(item.id);
      State.mutate(s => { s.seen.onboarded = true; s.seen.firstPick = item.id; });
      // Guide walks her straight into placing her new friend in the town.
      ctx.go('town', { place: item.id, from: 'firstpick' });
    }
  }

  return { unmount() {} };
}
