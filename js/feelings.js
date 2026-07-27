// js/feelings.js — the Feelings Corner (RUN17 X3).
//
// ============================ READ THIS BEFORE EDITING ============================
// G17. THIS IS NOT A MENTAL HEALTH TOOL AND MUST NEVER BEHAVE LIKE ONE.
// It names a feeling, offers ONE calm activity, and stops.
//   • It NEVER asks why.        • It NEVER gives advice.
//   • It NEVER interprets.      • It NEVER diagnoses.
//   • It NEVER scores.          • It NEVER stores what was chosen.
//
// PRIVACY IS THE FEATURE, AND IT IS ABSOLUTE.
// Nothing chosen in this corner is written anywhere. Not to the save, not to IndexedDB,
// not to a quest, a Journal stamp, a trophy, the Star Ledger, the Bloom report or a
// grown-ups screen. This module therefore imports NO writer: no `mutate`, no `stampJournal`,
// no `noteQuest`, no `idb`. The only memory that exists is `heavyCount` below — an
// in-memory integer, on the module, discarded when the tab closes — and it exists solely
// to fire the authored third-time line once.
//
// If you are adding something here and reach for a save field: don't. The promise made to
// the grown-up in the toggle's own copy is that nothing is saved or shown to anyone,
// INCLUDING THEM. tests/r17x3-feelings.mjs snapshots localStorage and IndexedDB across
// every path through this screen and FAILS if a single feelings value reaches either.
// =================================================================================
//
// The words are authored in CONTENT_WARMTH.md and live in data/feelingsLines.js. This
// file stages them; it never writes a line.

import { el, clear, backControl, REDUCED } from './ui.js';
import { getState } from './state.js';
import { renderBoo, renderFeelingFace } from './art.js';
import { speakMaybe } from './guide.js';
import { sfx } from './sfx.js';
import { contentTier } from './content.js';
import { BY_ID } from '../data/catalogue.js';
import {
  QUESTION, FEELINGS, FEELING_BY_KEY, OFFERS, HEAVY, BREATHING, DANCE_MS,
  THIRD_TIME_LINE, THIRD_TIME_AT, ALLOWED_TIERS
} from '../data/feelingsLines.js';

// ---- gating ---------------------------------------------------------------------------
// OFF by default: `settings.feelingsCorner` is absent on every existing save and on every
// new one, and absent means off. It is read with === true so that only an explicit switch
// from a grown-up can ever open this corner. There is deliberately no save-schema default
// and no migration: a feature that is off by default should not appear in a save at all
// until someone turns it on.
export function feelingsEnabled(state = getState()) {
  return !!(state && state.settings && state.settings.feelingsCorner === true);
}
export function feelingsTierOk(tier = contentTier()) { return ALLOWED_TIERS.includes(tier); }
export function feelingsAvailable(state = getState(), tier = contentTier()) {
  return feelingsEnabled(state) && feelingsTierOk(tier);
}

// ---- the ONLY memory in this module ---------------------------------------------------
// How many times worried or sad has been chosen THIS SESSION. Module-level, so it is gone
// the moment the app is closed. Never read by anything but the third-time rule; never
// written anywhere; never shown to anyone.
let heavyCount = 0;
let thirdTimeSaid = false;
export function resetFeelingsSession() { heavyCount = 0; thirdTimeSaid = false; }

// Whose Boo sits with her.
function companion() {
  const s = getState();
  const inv = (s && s.inventory) || {};
  const owned = Object.keys(inv).filter(id => inv[id] > 0 && BY_ID[id] && BY_ID[id].kind === 'boo');
  return BY_ID[owned[0]] || BY_ID.boo_inky;
}

export function mount(container, params, ctx) {
  // Locked corners simply are not here. A child who is not meant to find this never sees
  // a door, a greyed card or an explanation — she is quietly returned to the hub.
  if (!feelingsAvailable()) { ctx.go('hub'); return { unmount() {} }; }

  const boo = companion();
  const root = el('div', { class: 'screen feelings' });
  container.appendChild(root);

  // The leave control is on screen at ALL times, in every state of this corner. That is a
  // requirement of the pack, not a convenience: nothing here may ever feel like something
  // she has to finish.
  const leave = backControl(() => ctx.go('hub'), { label: 'Leave' });
  root.appendChild(el('header', { class: 'fe-top' }, [leave]));

  // The cosy corner: a window seat, soft light, a Boo curled beside her.
  const window_ = el('div', { class: 'fe-window', 'aria-hidden': 'true' }, [
    el('span', { class: 'fe-moon' }), el('span', { class: 'fe-glow' })
  ]);
  const booArt = el('div', { class: 'fe-boo-art', html: renderBoo(boo, { size: 150, cls: 'art-idle' }) });
  const faceLayer = el('div', { class: 'fe-face' });
  const booWrap = el('div', { class: 'fe-boo' }, [booArt, faceLayer]);
  const seat = el('div', { class: 'fe-seat' }, [window_, booWrap]);

  const say = el('p', { class: 'fe-say', 'aria-live': 'polite' });
  const choices = el('div', { class: 'fe-choices', role: 'group', 'aria-label': QUESTION });
  const offerRow = el('div', { class: 'fe-offers' });
  const activity = el('div', { class: 'fe-activity' });

  root.append(seat, say, choices, offerRow, activity);

  let timers = [];
  const after = (ms, fn) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };

  // ---- beat zero: the one question --------------------------------------------------
  function askOnce() {
    clearTimers();
    clear(offerRow); clear(activity);
    setPose('calm');
    say.textContent = QUESTION;
    speakMaybe(QUESTION);
    clear(choices);
    for (const f of FEELINGS) {
      choices.appendChild(el('button', {
        class: 'fe-choice fe-' + f.key, dataset: { feeling: f.key },
        'aria-label': f.word,
        onclick: () => choose(f.key)
      }, [
        el('span', { class: 'fe-choice-face', html: renderFeelingFace(f.key, { size: 66 }) }),
        el('span', { class: 'fe-choice-word', text: f.word })
      ]));
    }
  }

  function setPose(key) {
    booWrap.dataset.pose = key;
    faceLayer.innerHTML = renderFeelingFace(key, { size: 150 });
  }

  // ---- the three beats ----------------------------------------------------------------
  function choose(key) {
    const f = FEELING_BY_KEY[key];
    if (!f) return;
    sfx.tap();
    clearTimers();
    clear(choices);
    clear(activity);

    // BEAT 1 — the Boo mirrors the feeling, in face and posture.
    setPose(key);

    // The in-memory session count. Incremented here and NOWHERE persisted.
    if (HEAVY.includes(key)) heavyCount++;

    // BEAT 2 — one validating line. It names the feeling and normalises it. No advice.
    let line = f.line;
    // The third-time line, appended ONCE, and never again this session. Nothing follows
    // it: no question of ours, no escalation, no offer change, no logging.
    let third = false;
    if (HEAVY.includes(key) && heavyCount >= THIRD_TIME_AT && !thirdTimeSaid) {
      thirdTimeSaid = true;
      third = true;
      line = f.line + ' ' + THIRD_TIME_LINE;
    }
    say.textContent = line;
    speakMaybe(line);

    // BEAT 3 — one optional offer, as a button. Never insisted on, never the only way on.
    clear(offerRow);
    for (const key2 of f.offers) {
      const o = OFFERS[key2];
      offerRow.appendChild(el('button', {
        class: 'btn fe-offer fe-offer-' + key2, dataset: { offer: key2 }, text: o.label,
        onclick: () => runOffer(key2, key)
      }));
    }
    // And a way back to the six faces that is not an offer and not a demand.
    offerRow.appendChild(el('button', { class: 'btn soft fe-again', text: 'Back to the faces', onclick: () => askOnce() }));

    if (typeof window !== 'undefined') window.__feelingsLast = { feeling: key, line, third, offers: f.offers.slice() };
  }

  // ---- the offers -----------------------------------------------------------------------
  function runOffer(kind, feeling) {
    sfx.tap();
    clearTimers();
    clear(activity);
    if (kind === 'breathe') return breathe();
    if (kind === 'dance') return dance();
    return sit(feeling);
  }

  // "Breathe with me": in 4s, hold 2s, out 6s, four cycles, then a warm close. Unhurried,
  // and skippable at ANY moment — the stop control is present from the first frame.
  function breathe() {
    const ring = el('div', { class: 'fe-ring' });
    const copy = el('p', { class: 'fe-breath-copy', 'aria-live': 'polite' });
    const stop = el('button', { class: 'btn soft fe-stop', text: 'Stop', onclick: () => { clearTimers(); askOnce(); } });
    activity.append(el('div', { class: 'fe-breathe' }, [ring, copy, stop]));
    let cycle = 0;
    const phase = (name, ms, next) => {
      copy.textContent = BREATHING.copy[name] || '';
      if (BREATHING.copy[name]) speakMaybe(BREATHING.copy[name]);
      ring.dataset.phase = name;
      ring.style.setProperty('--ms', ms + 'ms');
      try { sfx.chime(name === 'in' ? 0 : name === 'hold' ? 2 : 4); } catch {}
      if (typeof window !== 'undefined') window.__breath = { cycle, phase: name, at: Date.now() };
      after(ms, next);
    };
    const run = () => {
      if (cycle >= BREATHING.cycles) {
        ring.dataset.phase = 'done';
        copy.textContent = BREATHING.close;
        speakMaybe(BREATHING.close);
        if (typeof window !== 'undefined') window.__breath = { cycle, phase: 'close', at: Date.now() };
        after(2600, () => askOnce());
        return;
      }
      phase('in', BREATHING.inMs, () =>
        phase('hold', BREATHING.holdMs, () =>
          phase('out', BREATHING.outMs, () => { cycle++; run(); })));
    };
    run();
  }

  // "Dance it out!": a 20-second Boo dance she can JOIN by tapping. Joining changes
  // nothing except that they are dancing together — there is no score and no target.
  function dance() {
    const floor = el('div', { class: 'fe-dance-floor' });
    const joinHint = el('span', { class: 'fe-join-hint', text: 'Tap to join in!' });
    const stop = el('button', { class: 'btn soft fe-stop', text: 'Stop', onclick: () => { clearTimers(); askOnce(); } });
    const stageBoo = el('button', {
      class: 'fe-dancer', 'aria-label': 'Dance with your Boo',
      html: renderBoo(boo, { size: 130 }),
      onclick: () => { floor.classList.add('joined'); joinHint.textContent = 'Dancing together!'; sfx.giggle(); }
    });
    floor.append(stageBoo, joinHint, stop);
    activity.appendChild(floor);
    booWrap.dataset.pose = 'dance';
    after(DANCE_MS, () => askOnce());
    if (typeof window !== 'undefined') window.__dance = { ms: DANCE_MS, started: Date.now() };
  }

  // "Sit a while": the Boo simply stays, breathing slowly, doing nothing. No timer, no
  // prompt, no reward, nothing asked. Leaving is always one tap.
  function sit(feeling) {
    booWrap.dataset.pose = feeling || 'calm';
    booWrap.classList.add('sitting');
    const back = el('button', { class: 'btn soft fe-stop', text: 'Back to the faces', onclick: () => { booWrap.classList.remove('sitting'); askOnce(); } });
    activity.appendChild(el('div', { class: 'fe-sit' }, [back]));
    if (typeof window !== 'undefined') window.__sit = { started: Date.now(), timers: 0 };
  }

  askOnce();

  // ---- test hook ------------------------------------------------------------------------
  if (typeof window !== 'undefined') window.__feelings = {
    question: () => say.textContent,
    faces: () => [...choices.querySelectorAll('.fe-choice')].map(c => c.dataset.feeling),
    words: () => [...choices.querySelectorAll('.fe-choice-word')].map(c => c.textContent),
    choose: (k) => { choose(k); return say.textContent; },
    said: () => say.textContent,
    pose: () => booWrap.dataset.pose,
    offers: () => [...offerRow.querySelectorAll('.fe-offer')].map(b => ({ key: b.dataset.offer, label: b.textContent })),
    tapOffer: (k) => { const b = offerRow.querySelector(`.fe-offer-${k}`); if (b) b.click(); return !!b; },
    breathPhase: () => (typeof window !== 'undefined' && window.__breath) || null,
    breathCopy: () => { const n = activity.querySelector('.fe-breath-copy'); return n ? n.textContent : null; },
    canStop: () => !!activity.querySelector('.fe-stop'),
    leaveVisible: () => { const n = root.querySelector('.fe-top button'); return !!n && n.offsetParent !== null; },
    heavyCount: () => heavyCount,
    thirdSaid: () => thirdTimeSaid,
    reset: () => resetFeelingsSession(),
    // everything this screen has ever put on screen, for the copy audit
    spec: () => ({ QUESTION, FEELINGS, OFFERS, BREATHING, THIRD_TIME_LINE })
  };

  return {
    unmount() {
      clearTimers();
      if (typeof window !== 'undefined') {
        delete window.__feelings; delete window.__breath;
        delete window.__dance; delete window.__sit; delete window.__feelingsLast;
      }
    }
  };
}
