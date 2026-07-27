// js/results.js — end-of-round results (spec §5.4).

import { el, clear, confetti, giftSVG, backControl } from './ui.js';
import { getState, mutate, takeRoundTally, todayKey, commit } from './state.js';
import { renderGuide } from './art.js';
import { guideLine, speakMaybe } from './guide.js';
import { sfx } from './sfx.js';
import { addMeterPoints, METER_CAP, meterState } from './rewards.js';
import { meterPointsFor, rankName, levelRank, spendableAward } from './comfort.js';
import { starTypeFor, typeByKey } from '../data/startypes.js';
import { mountRescue, persistUnrescued } from './trickypile.js';
import { noteQuest, stampJournal } from './quests.js';
import { noteRequest } from './requests.js';
import { checkAndCelebrate } from './trophies.js';
import { grantRoundTreat } from './care.js';
import { encouragementFor } from './encouragement.js';   // RUN17 X2

export function mount(container, params, ctx) {
  const { game, gameName = 'that round', stars = 1, replay, tricky = [], meterOverride = null,
          cat = null, level = null, mix = false, extraCosy = false, partial = null,
          starType = null } = params || {};
  const s = getState();
  // The Tricky Pile is already "collected"; persist immediately so an early exit keeps them.
  if (tricky.length) persistUnrescued(tricky.map(t => t.id));

  // record the round — total stars ALWAYS credit in full (RUN4 C3, permanent rule).
  // This mutate is the SINGLE crediting path (RUN5 C0 invariant): no game module
  // increments stars.total itself — every round routes here via ctx.go('results').
  const before = s.meter;
  const beforeTotal = s.stars.total;
  // RUN17 X2: read BEFORE the mutate below increments it — "a first-ever try of any game"
  // is only true of the round she has just this second finished.
  const playsBefore = ((s.stars.byGame[game] || {}).plays) || 0;
  mutate(st => {
    const g = st.stars.byGame[game];
    if (g) { g.plays += 1; g.best = Math.max(g.best, stars); g.earned = (g.earned || 0) + stars; }  // C0 Star Ledger tally
    st.stars.total += stars;
    // RUN12 S11: a round LEFT EARLY still pays for the work she did, but it is not a
    // finished round — it does not earn a medal tally or a personal best it never reached.
    if (stars >= 3 && !partial) { st.gameThrees = st.gameThrees || {}; st.gameThrees[game] = (st.gameThrees[game] || 0) + 1; }  // C4 medal tally
    // RUN10 P17: a completed learning round posts one clue card to an open notebook,
    // at most three a day, capped at the four clues that pin the culprit.
    if (st.caper && st.caper.open && !partial) {   // a clue is for a COMPLETED round
      const day = todayKey();
      if (st.caper.clueDay !== day) { st.caper.clueDay = day; st.caper.cluesToday = 0; }
      if ((st.caper.cluesToday || 0) < 3) {
        st.caper.clues = Math.min(4, (st.caper.clues || 0) + 1);
        st.caper.cluesToday = (st.caper.cluesToday || 0) + 1;
      }
    }
  });
  // Dev-only runtime assertion (RUN5 C0): a finished round increments the total by
  // exactly its stars. Silent no-op on the live build; fails loudly on localhost.
  assertCredit(beforeTotal, getState().stars.total, stars);
  // A finished round is a milestone: commit it straight away rather than leaving the
  // stars, ledger and clue in the 2s autosave window, where closing the tablet the moment
  // a round ends would lose them. (RUN11 Q9.)
  commit();
  const treatGrant = grantRoundTreat();

  // Jump back in (RUN5 C0b): remember her last game and mode so the hub can replay
  // it in one tap. The Golden Round is a special daily card, not a repeatable mode.
  if (game && game !== 'golden') {
    // lastPlayDay = the local day this mode was last played, so the Today rail's
    // "Jump back in" chip hides once she's played today (RUN7 C3 manners).
    mutate(st => { st.seen = st.seen || {}; st.seen.lastPlay = { game, gameName, cat, level, mix: !!mix }; st.seen.lastPlayDay = todayKey(); });
  }
  // Box meter (RUN4 C3): base = stars (+3-star bonus), Brave +1 above comfort
  // (first per category per day), cosy rounds cap at 2. The Golden Round banks a
  // caller-computed total instead (double stars etc.) and skips the cap by design.
  const roundKeys = takeRoundTally();
  const verdict = meterOverride != null
    ? { points: meterOverride, brave: false, cosy: false, above: false, comfort: 0 }
    : meterPointsFor({ game, cat, level, mix, stars, roundKeys, extraCosy });
  const banked = addMeterPoints(verdict.points);
  // RUN15 V1+V2: the typed, SPENDABLE award. It rides the same single crediting path as
  // the lifetime total — no game module ever writes these — and it is computed AFTER the
  // verdict because the above-comfort floor depends on it.
  //   • the round's displayed stars are UNCHANGED (1-3 still means "how well did I do");
  //   • byType is LIFETIME per type and, like total, is never reduced by anything;
  //   • a Level 2/3/4+ round pays a multiplier, and a round above her comfort level pays
  //     at least ABOVE_COMFORT_FLOOR — stretching is never worse than staying.
  const award = spendableAward({ stars, level, above: verdict.above });
  const roundType = starTypeFor(game, cat, starType);
  mutate(st => {
    st.stars.byType = st.stars.byType || { maths: 0, word: 0, puzzle: 0, creative: 0, lesson: 0 };
    st.stars.byType[roundType] = (st.stars.byType[roundType] || 0) + award.spendable;
  });
  const lineKey = partial ? 'leftEarly' : stars >= 3 ? 'threeStars' : stars === 2 ? 'twoStars' : 'oneStar';

  // daily quests + Journal (RUN3 C4) + occasional requests (RUN3 C8)
  noteQuest('roundEnd', { game, stars });
  if (verdict.above) noteQuest('braveRound', { game, stars });   // stretch quests (RUN4 C3)
  noteRequest('roundEnd', { game, stars });
  if (stars >= 3) stampJournal('star3_' + game);
  if (game === 'golden' && stars >= 3) stampJournal('golden3');

  if (typeof window !== 'undefined') window.__encourage = null;   // RUN17 X2: never read a previous round's

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
  const carePocket = el('div', { class: 'result-care-pocket', text: `🍪 ${getState().care.treats}` }, [
    treatGrant.added ? el('span', { class: 'result-care-plus', text: '+1' }) : null
  ]);
  meterBox.append(el('div', { class: 'rm-label', text: 'Star meter' }), meterTrack, carePocket);

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

    // RUN15 V1/V2: the award panel. It says WHICH stars this round paid, and celebrates
    // any bonus. Every line here is additive and upward — there is no "less than" state
    // to display, because there is never a smaller number than the round's own stars.
    const t = typeByKey(roundType);
    const awardBox = el('div', { class: 'result-award' }, [
      el('div', { class: 'ra-earned' }, [
        el('span', { class: 'ra-ic', text: t.icon }),
        el('span', { class: 'ra-amount', text: `+${award.spendable}` }),
        el('span', { class: 'ra-type', text: t.name })
      ]),
      award.bonusLine ? el('div', { class: 'ra-bonus', text: award.bonusLine }) : null,
      verdict.above ? el('div', { class: 'ra-brave' }, [
        el('span', { class: 'ra-brave-chip', text: '💪 Brave' }),
        el('span', { class: 'ra-brave-note', text: award.floored ? 'You tried something harder — extra stars for that!' : 'You tried something harder!' })
      ]) : null
    ]);
    card.insertBefore(awardBox, meterBox);
    if (typeof window !== 'undefined') window.__resultAward = { type: roundType, ...award, above: verdict.above, stars };

    // ---- RUN17 X2: a kind word, at one of the capped moments ------------------------
    // The moment is chosen here; whether anything is actually SAID is js/encouragement.js's
    // decision, and it says no far more often than yes. An aced round never qualifies —
    // the policy enforces that itself, so this call site cannot get it wrong.
    // It arrives as its own beat after the results line, so it reads as the guide adding
    // something rather than as more scoring.
    const moment = (verdict.above && stars === 1) ? 'hardRound'
      : (playsBefore === 0 && !partial) ? 'firstTry'
        : null;
    if (moment) sayKindly(encouragementFor(moment, { stars }));

    // fill meter: from `before` up to new meter (handle wrap visually)
    fillMeter(before, banked.meter, banked.boxesEarned);

    // Tricky Pile rescue step (untimed, hints free, does not change the round's stars).
    if (tricky.length) {
      const rescueWrap = el('div', { class: 'result-rescue' });
      card.insertBefore(rescueWrap, buttons);
      mountRescue(rescueWrap, tricky, {
        onGift: () => showGift(),
        onRescue: () => relightMeter(),
        // RUN17 X2: finishing a Tricky Pile rescue is one of the capped kind-word moments.
        // No stars are passed because a rescue is not a scored round — it is untimed,
        // hint-free work she chose to do, which is exactly what the pool praises.
        onDone: () => { relightMeter(); sayKindly(encouragementFor('rescue')); }
      });
    }

    // buttons
    buttons.appendChild(el('button', { class: 'btn secondary', text: 'Play again', onclick: () => { sfx.tap(); replay ? replay() : ctx.go(game); } }));

    // Level-up button (RUN5 C0b): on a 3-star result at or below the category's
    // comfort level, offer the next level in one tap — matching the guide's cosy
    // upward nudge. Only for games with a numeric Level 1→3 ladder.
    const LADDER = new Set(['bubblepop', 'feedboos', 'spellboo', 'blocks', 'bounce', 'beat', 'dash', 'clockshop']);
    const rank = levelRank(level);
    if (stars >= 3 && !mix && cat && level != null && LADDER.has(game) && rank >= 1 && rank < 3 && rank <= verdict.comfort) {
      buttons.appendChild(el('button', { class: 'btn levelup', text: `Try Level ${rank + 1}! ✨`, onclick: () => {
        sfx.tap(); ctx.go(game, { resume: { cat, level: rank + 1, mix: false } });
      } }));
    }

    buttons.appendChild(el('button', { class: 'btn soft', text: 'Back to Boo Town', onclick: () => { sfx.tap(); ctx.go('hub'); } }));

    if (banked.boxesEarned > 0) showGift();

    // Newly earned certificates / medals / trophies celebrate here (RUN4 C4).
    setTimeout(() => { try { checkAndCelebrate(); } catch (e) { console.warn(e); } }, 600);
  }

  // RUN17 X2: show and speak a kind word, once, as its own quiet beat. Empty string means
  // the policy declined — the overwhelmingly common case — and nothing appears at all.
  // Speech goes through the shared guide path, so the voice mute governs it like everything.
  let kindShown = false;
  function sayKindly(line) {
    if (!line || kindShown) return;
    kindShown = true;
    const node = el('div', { class: 'result-encourage', text: line });
    card.insertBefore(node, meterBox);
    setTimeout(() => { node.classList.add('in'); speakMaybe(line); }, 900);
    if (typeof window !== 'undefined') window.__encourage = { line, moment: true };
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
