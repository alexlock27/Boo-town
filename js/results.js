// js/results.js — end-of-round results (spec §5.4).

import { el, clear, confetti, giftSVG } from './ui.js';
import { getState, mutate } from './state.js';
import { renderGuide } from './art.js';
import { guideLine, speakMaybe } from './guide.js';
import { sfx } from './sfx.js';
import { bankStars, addMeterPoints, METER_CAP, meterState } from './rewards.js';
import { mountRescue, persistUnrescued } from './trickypile.js';

export function mount(container, params, ctx) {
  const { game, gameName = 'that round', stars = 1, replay, tricky = [], meterOverride = null } = params || {};
  const s = getState();
  // The Tricky Pile is already "collected"; persist immediately so an early exit keeps them.
  if (tricky.length) persistUnrescued(tricky.map(t => t.id));

  // record the round
  const before = s.meter;
  mutate(st => {
    const g = st.stars.byGame[game];
    if (g) { g.plays += 1; g.best = Math.max(g.best, stars); }
    st.stars.total += stars;
  });
  // Golden Round banks a caller-computed meter total (double stars etc.); others use bankStars.
  const banked = meterOverride != null ? addMeterPoints(meterOverride) : bankStars(stars);
  const lineKey = stars >= 3 ? 'threeStars' : stars === 2 ? 'twoStars' : 'oneStar';

  const root = el('div', { class: 'screen results' });
  container.appendChild(root);

  const guide = s.guide;
  const starSlots = el('div', { class: 'result-stars' });
  for (let i = 0; i < 3; i++) starSlots.appendChild(el('span', { class: 'rstar', html: bigStar(false) }));

  const bubble = el('div', { class: 'speech-bubble result-bubble', style: { visibility: 'hidden' } });

  const meterBox = el('div', { class: 'result-meter' });
  const meterTrack = el('div', { class: 'meter-track big' });
  for (let i = 0; i < METER_CAP; i++) meterTrack.appendChild(el('span', { class: 'meter-seg' }));
  meterBox.append(el('div', { class: 'rm-label', text: 'Star meter' }), meterTrack);

  const buttons = el('div', { class: 'result-btns' });

  const card = el('div', { class: 'card result-card' }, [
    el('div', { class: 'result-guide', html: renderGuide(guide, { view: 'head', size: 96 }) }),
    bubble,
    starSlots,
    meterBox,
    buttons
  ]);
  root.appendChild(card);

  // animate stars in one by one
  let shown = 0;
  const tick = () => {
    if (shown < stars) {
      const slot = starSlots.children[shown];
      slot.innerHTML = bigStar(true);
      slot.classList.add('pop');
      sfx.star();
      shown++;
      setTimeout(tick, 480);
    } else {
      afterStars();
    }
  };
  setTimeout(tick, 350);

  function afterStars() {
    bubble.style.visibility = 'visible';
    bubble.textContent = guideLine(lineKey);
    bubble.classList.add('pop');
    speakMaybe(bubble.textContent);
    if (stars >= 3) confetti({ count: 90, power: 1 });

    // fill meter: from `before` up to new meter (handle wrap visually)
    fillMeter(before, banked.meter, banked.boxesEarned);

    // Tricky Pile rescue step (untimed, hints free, does not change the round's stars).
    if (tricky.length) {
      const rescueWrap = el('div', { class: 'result-rescue' });
      card.insertBefore(rescueWrap, buttons);
      mountRescue(rescueWrap, tricky, {
        onGift: () => showGift(),
        onRescue: () => relightMeter(),
        onDone: () => { relightMeter(); }
      });
    }

    // buttons
    buttons.appendChild(el('button', { class: 'btn secondary', text: 'Play again', onclick: () => { sfx.tap(); replay ? replay() : ctx.go(game); } }));
    buttons.appendChild(el('button', { class: 'btn soft', text: 'Back to Boo Town', onclick: () => { sfx.tap(); ctx.go('hub'); } }));

    if (banked.boxesEarned > 0) showGift();
  }

  // Re-light meter segments from the current state (after rescue +1s).
  function relightMeter() {
    const segs = meterTrack.children;
    const m = getState().meter;
    for (let k = 0; k < segs.length; k++) segs[k].classList.toggle('on', k < m);
  }

  function fillMeter(from, to, wrapped) {
    const segs = meterTrack.children;
    // if it wrapped, first fill to cap, then reset and fill remainder
    let target = wrapped ? METER_CAP : to;
    let i = 0;
    const light = () => {
      for (let k = 0; k < segs.length; k++) segs[k].classList.toggle('on', k < Math.min(i, METER_CAP));
      if (i < target) { i++; setTimeout(light, 140); }
      else if (wrapped) {
        setTimeout(() => {
          for (const sg of segs) sg.classList.remove('on');
          i = 0; target = to; wrapped = 0;
          setTimeout(light, 200);
        }, 350);
      }
    };
    i = from; light();
  }

  function showGift() {
    sfx.fanfare();
    const giftWrap = el('div', { class: 'result-gift drop' }, [
      el('div', { class: 'gift-big', html: giftSVG(90) }),
      el('button', { class: 'btn big', text: 'Open your box! 🎁', onclick: () => { sfx.tap(); ctx.go('ceremony'); } })
    ]);
    confetti({ count: 60, power: 0.9 });
    card.insertBefore(giftWrap, buttons);
  }

  return { unmount() {} };
}

function bigStar(filled) {
  const fill = filled ? 'var(--star)' : 'none';
  const stroke = filled ? '#E0A81E' : 'rgba(255,255,255,0.4)';
  return `<svg viewBox="0 0 48 48" width="64" height="64"><path d="M24 4l6.2 12.6 13.8 2-10 9.8 2.4 13.7L24 47.5 11.6 44l2.4-13.7-10-9.8 13.8-2z"
    fill="${fill}" stroke="${stroke}" stroke-width="2.4" stroke-linejoin="round"/></svg>`;
}
