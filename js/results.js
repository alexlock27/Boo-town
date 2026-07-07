// js/results.js — end-of-round results (spec §5.4).

import { el, clear, confetti, giftSVG, backControl } from './ui.js';
import { getState, mutate, takeRoundTally } from './state.js';
import { renderGuide } from './art.js';
import { guideLine, speakMaybe } from './guide.js';
import { sfx } from './sfx.js';
import { addMeterPoints, METER_CAP, meterState } from './rewards.js';
import { meterPointsFor, rankName } from './comfort.js';
import { mountRescue, persistUnrescued } from './trickypile.js';
import { noteQuest, stampJournal } from './quests.js';
import { noteRequest } from './requests.js';
import { checkAndCelebrate } from './trophies.js';

export function mount(container, params, ctx) {
  const { game, gameName = 'that round', stars = 1, replay, tricky = [], meterOverride = null,
          cat = null, level = null, mix = false, extraCosy = false } = params || {};
  const s = getState();
  // The Tricky Pile is already "collected"; persist immediately so an early exit keeps them.
  if (tricky.length) persistUnrescued(tricky.map(t => t.id));

  // record the round — total stars ALWAYS credit in full (RUN4 C3, permanent rule).
  // This mutate is the SINGLE crediting path (RUN5 C0 invariant): no game module
  // increments stars.total itself — every round routes here via ctx.go('results').
  const before = s.meter;
  const beforeTotal = s.stars.total;
  mutate(st => {
    const g = st.stars.byGame[game];
    if (g) { g.plays += 1; g.best = Math.max(g.best, stars); g.earned = (g.earned || 0) + stars; }  // C0 Star Ledger tally
    st.stars.total += stars;
    if (stars >= 3) { st.gameThrees = st.gameThrees || {}; st.gameThrees[game] = (st.gameThrees[game] || 0) + 1; }  // C4 medal tally
  });
  // Dev-only runtime assertion (RUN5 C0): a finished round increments the total by
  // exactly its stars. Silent no-op on the live build; fails loudly on localhost.
  assertCredit(beforeTotal, getState().stars.total, stars);
  // Box meter (RUN4 C3): base = stars (+3-star bonus), Brave +1 above comfort
  // (first per category per day), cosy rounds cap at 2. The Golden Round banks a
  // caller-computed total instead (double stars etc.) and skips the cap by design.
  const roundKeys = takeRoundTally();
  const verdict = meterOverride != null
    ? { points: meterOverride, brave: false, cosy: false, above: false, comfort: 0 }
    : meterPointsFor({ game, cat, level, mix, stars, roundKeys, extraCosy });
  const banked = addMeterPoints(verdict.points);
  const lineKey = stars >= 3 ? 'threeStars' : stars === 2 ? 'twoStars' : 'oneStar';

  // daily quests + Journal (RUN3 C4) + occasional requests (RUN3 C8)
  noteQuest('roundEnd', { game, stars });
  if (verdict.above) noteQuest('braveRound', { game, stars });   // stretch quests (RUN4 C3)
  noteRequest('roundEnd', { game, stars });
  if (stars >= 3) stampJournal('star3_' + game);
  if (game === 'golden' && stars >= 3) stampJournal('golden3');

  const root = el('div', { class: 'screen results' });
  root.appendChild(backControl(() => ctx.go('hub'), { floating: true }));
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
    // Tone (RUN4 C3): upward-only framing. Brave rounds celebrate the bonus; cosy
    // rounds get a warm nudge toward the next level. Nothing ever reads as "less".
    let line = guideLine(lineKey);
    if (verdict.brave) line = line + ' ' + guideLine('braveRound');
    else if (verdict.cosy) line = line + ' ' + guideLine('cosyRound').replace(/\{level\}/g, rankName(verdict.comfort + 1));
    bubble.textContent = line;
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

    // Newly earned certificates / medals / trophies celebrate here (RUN4 C4).
    setTimeout(() => { try { checkAndCelebrate(); } catch (e) { console.warn(e); } }, 600);
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

// Dev-only crediting invariant (RUN5 C0). On localhost (a dev build — the SW is not
// even registered there, spec §11.6) a mis-crediting round throws so it is caught in
// development; the live build stays silent so a child never sees an error. Exposes
// window.__lastCredit for the guard test to inspect.
function assertCredit(beforeTotal, afterTotal, stars) {
  const delta = afterTotal - beforeTotal;
  if (typeof window !== 'undefined') window.__lastCredit = { before: beforeTotal, after: afterTotal, stars, delta, ok: delta === stars };
  const isDev = typeof location !== 'undefined' && /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  if (isDev && delta !== stars) {
    throw new Error(`[credit invariant] round credited ${delta} to stars.total but earned ${stars} stars`);
  }
}

function bigStar(filled) {
  const fill = filled ? 'var(--star)' : 'none';
  const stroke = filled ? '#E0A81E' : 'rgba(255,255,255,0.4)';
  return `<svg viewBox="0 0 48 48" width="64" height="64"><path d="M24 4l6.2 12.6 13.8 2-10 9.8 2.4 13.7L24 47.5 11.6 44l2.4-13.7-10-9.8 13.8-2z"
    fill="${fill}" stroke="${stroke}" stroke-width="2.4" stroke-linejoin="round"/></svg>`;
}
