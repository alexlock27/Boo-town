// js/games/clockshop.js — Clock Shop (RUN3 C5).
// Boos queue at a shop counter with time orders ("Half past 3, please!"). She sets a big
// analogue clock by dragging the hands. The hour hand moves PROPORTIONALLY as the minute
// hand travels (never jumps), with gentle snapping. 8 orders a round; wrong settings wiggle;
// the hint ghosts the correct hands for a second then fades. Standard stars; feeds the meter.

import { el, clear, starsRow, sparkleAt, REDUCED, backControl } from '../ui.js';
import { getState } from '../state.js';
import { createGameShell } from '../gameshell.js';
import { renderGuide, renderBoo } from '../art.js';
import { guideLine, speakMaybe } from '../guide.js';
import { sfx, music } from '../sfx.js';
import { recordBest } from '../picker.js';

const ORDERS = 8;
const MAX_HINTS = 2;
const rand = (n) => (Math.random() * n) | 0;
const starsFor = (wrong, hints) => (hints === 0 && wrong <= 1) ? 3 : (wrong <= 3 ? 2 : 1);

// valid minute sets per level; level 3 also shows a digital display to match
const LEVELS = {
  1: { minutes: [0, 30], digital: false, name: "O'clock & half past" },
  2: { minutes: [0, 15, 30, 45], digital: false, name: 'Quarters' },
  3: { minutes: [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55], digital: true, name: 'Five-minute times' }
};

const FEEDERS = [{ species: 'munch', colors: { body: 'teal' } }, { species: 'bloop', colors: { body: 'bubblegum' } }, { species: 'pip', colors: { body: 'lilac' } }, { species: 'sunny', colors: { body: 'gold' } }];

function timeLabel(h12, m) {
  if (m === 0) return `${h12} o'clock`;
  if (m === 15) return `quarter past ${h12}`;
  if (m === 30) return `half past ${h12}`;
  if (m === 45) return `quarter to ${h12 === 12 ? 1 : h12 + 1}`;
  if (m < 30) return `${m} minutes past ${h12}`;
  return `${60 - m} minutes to ${h12 === 12 ? 1 : h12 + 1}`;
}
function digital(h12, m) { return `${h12}:${String(m).padStart(2, '0')}`; }

export function mount(container, params, ctx) {
  const root = el('div', { class: 'screen clockshop' });
  container.appendChild(root);
  let shell = null;

  startCard();

  function startCard() {
    clear(root); music.play('game');
    const card = el('div', { class: 'start-card card' }, [
      el('div', { class: 'sc-guide', html: renderGuide(getState().guide, { view: 'head', size: 100 }) }),
      el('h2', { text: 'Clock Shop' }),
      el('p', { class: 'sc-intro', text: 'The Boos want to know the time! Set the clock for each order.' })
    ]);
    const levels = el('div', { class: 'level-row' });
    for (const lv of [1, 2, 3]) levels.appendChild(el('button', { class: 'btn level-btn', style: { '--accent': 'var(--zing)' }, onclick: () => { sfx.tap(); play(lv); } }, [el('span', { class: 'lv-num', text: 'Level ' + lv }), el('span', { class: 'lv-sub', text: LEVELS[lv].name })]));
    card.append(el('p', { class: 'sc-q', text: 'Pick a level' }), levels);
    card.appendChild(el('div', { class: 'star-rule' }, [el('div', { html: starsRow(3, { size: 24 }) }), el('p', { text: 'Three stars: at most one wrong setting, and no hints.' })]));
    root.appendChild(card);
    root.appendChild(backControl(() => ctx.go('hub'), { floating: true }));   // shared back (job 3)
  }

  function makeOrder(level) {
    const mins = LEVELS[level].minutes;
    const h12 = 1 + rand(12);
    const m = mins[rand(mins.length)];
    return { h12, m };
  }

  function play(level) {
    clear(root);
    const cfg = LEVELS[level];
    let order = makeOrder(level);
    let idx = 0, wrong = 0, hintsUsed = 0, ended = false, locked = false;
    // set time state
    let sh12 = 12, sm = 0;          // hour 1..12, minutes 0..59

    shell = createGameShell({ title: 'Clock Shop', rounds: ORDERS, accent: 'var(--zing)', onBack: () => { ctx.go('hub'); }, onHint: doHint });
    root.appendChild(shell.root);

    // ---- counter with the ordering Boo ----
    const booWrap = el('div', { class: 'shop-boo' });
    const bubble = el('div', { class: 'shop-bubble' });
    const digitalEl = el('div', { class: 'shop-digital', style: { display: cfg.digital ? '' : 'none' } });
    const counter = el('div', { class: 'shop-counter' }, [booWrap, el('div', { class: 'shop-say' }, [bubble, digitalEl])]);

    // ---- the clock ----
    const clockWrap = el('div', { class: 'clock-wrap', html: clockSVG() });
    const serveBtn = el('button', { class: 'btn shop-serve', text: 'Ring the bell 🔔', onclick: () => serve() });
    shell.area.append(counter, clockWrap, serveBtn);

    const svg = clockWrap.querySelector('svg');
    const hourHand = svg.querySelector('.hour-hand');
    const minHand = svg.querySelector('.minute-hand');
    const ghostG = svg.querySelector('.ghost-hands');
    const ghostHour = svg.querySelector('.ghost-hour');
    const ghostMin = svg.querySelector('.ghost-minute');

    showOrder();
    applyHands();
    attachDrag();

    function showOrder() {
      clear(booWrap);
      const look = FEEDERS[idx % FEEDERS.length];
      booWrap.innerHTML = renderBoo({ ...look, name: 'Customer' }, { size: 110, cls: 'art-idle' });
      bubble.textContent = timeLabel(order.h12, order.m) + ', please!';
      digitalEl.textContent = cfg.digital ? digital(order.h12, order.m) : '';
      speakMaybe(timeLabel(order.h12, order.m) + ', please');
    }

    // hour hand shows the hour PLUS a proportional offset for the minutes (never jumps)
    function hourAngle() { return ((sh12 % 12) + sm / 60) * 30; }
    function minAngle() { return sm * 6; }
    function applyHands() {
      hourHand.setAttribute('transform', `rotate(${hourAngle().toFixed(2)} 100 100)`);
      minHand.setAttribute('transform', `rotate(${minAngle().toFixed(2)} 100 100)`);
    }

    function snapMinutes(raw) {
      const set = cfg.minutes;
      let best = set[0], bd = 999;
      for (const m of set) { const d = Math.min(Math.abs(m - raw), 60 - Math.abs(m - raw)); if (d < bd) { bd = d; best = m; } }
      return best;
    }

    // ---- dragging: grab the hand nearer the pointer; minute drag nudges the hour hand ----
    function angleAt(clientX, clientY) {
      const r = svg.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let a = Math.atan2(clientX - cx, cy - clientY) * 180 / Math.PI;   // 0 = 12 o'clock, clockwise
      return (a + 360) % 360;
    }
    let dragHand = null;
    function attachDrag() {
      svg.style.touchAction = 'none';
      svg.addEventListener('pointerdown', e => {
        if (locked || ended) return;
        svg.setPointerCapture(e.pointerId);
        // choose the nearer hand by angular distance to its current position
        const a = angleAt(e.clientX, e.clientY);
        const dm = angDist(a, minAngle()), dh = angDist(a, hourAngle());
        dragHand = dm <= dh ? 'min' : 'hour';
        moveTo(a);
      });
      svg.addEventListener('pointermove', e => { if (dragHand && (e.buttons || e.pressure > 0)) moveTo(angleAt(e.clientX, e.clientY)); });
      const end = () => { dragHand = null; };
      svg.addEventListener('pointerup', end); svg.addEventListener('pointercancel', end);
    }
    function moveTo(a) {
      if (dragHand === 'min') { sm = snapMinutes(Math.round(a / 6) % 60); }
      else { let h = Math.floor(a / 30); if (h === 0) h = 12; sh12 = h; }   // hour hand picks the hour
      applyHands();
      if (typeof window !== 'undefined') window.__clock && (window.__clock._state = { sh12, sm });
    }

    function serve() {
      if (locked || ended) return;
      if (sh12 === order.h12 && sm === order.m) return onCorrect();
      // wrong: gentle wiggle
      wrong++; sfx.oops();
      clockWrap.classList.remove('wiggle'); void clockWrap.offsetWidth; clockWrap.classList.add('wiggle');
      shell.dimHeart();
      shell.react('Not quite — try again!', { voice: false, hold: 1600 });
    }
    function onCorrect() {
      locked = true; sfx.correct();
      const r = svg.getBoundingClientRect(); if (!REDUCED) sparkleAt(r.left + r.width / 2, r.top + r.height / 2);
      clockWrap.classList.add('served');
      shell.react('Perfect! ⏰', { voice: false, hold: 1400 });
      idx++; shell.setProgress(idx);
      setTimeout(() => {
        clockWrap.classList.remove('served');
        if (ended) return;
        if (idx >= ORDERS) return finish();
        order = makeOrder(level); locked = false; showOrder();
      }, 900);
    }

    // hint: ghost the correct hands for ~1s, then fade
    function doHint() {
      if (hintsUsed >= MAX_HINTS || locked) return;
      hintsUsed++;
      const gh = ((order.h12 % 12) + order.m / 60) * 30, gm = order.m * 6;
      ghostHour.setAttribute('transform', `rotate(${gh.toFixed(2)} 100 100)`);
      ghostMin.setAttribute('transform', `rotate(${gm.toFixed(2)} 100 100)`);
      ghostG.classList.remove('show'); void ghostG.offsetWidth; ghostG.classList.add('show');
      shell.react('Here\'s where the hands go…', { voice: false, hold: 1400 });
      clearTimeout(doHint._t);
      doHint._t = setTimeout(() => ghostG.classList.remove('show'), 1100);
      if (hintsUsed >= MAX_HINTS) shell.enableHint(false);
    }

    function finish() {
      if (ended) return; ended = true; shell.cleanup();
      const stars = starsFor(wrong, hintsUsed);
      recordBest('clockshop', 'l' + level, stars);
      ctx.go('results', { game: 'clockshop', gameName: 'Clock Shop', stars, replay: () => ctx.go('clockshop') });
    }

    // test hook (invisible)
    if (typeof window !== 'undefined') window.__clock = {
      order: () => ({ ...order }),
      set: (h12, m) => { sh12 = h12; sm = m; applyHands(); },
      state: () => ({ sh12, sm, hourAngle: +hourAngle().toFixed(2), minAngle: +minAngle().toFixed(2) }),
      serve, hint: doHint,
      ghostShown: () => ghostG.classList.contains('show'),
      dragMinuteTo: (mins) => { dragHand = 'min'; moveTo(mins * 6); dragHand = null; },
      ended: () => ended, stats: () => ({ idx, wrong, hintsUsed }),
      _state: { sh12, sm }
    };
  }

  return { unmount() { if (shell) shell.cleanup(); } };
}

// A friendly clock face: numbers, ticks, ghost hands (hidden), hour + minute hands, a pin.
function clockSVG() {
  let ticks = '', nums = '';
  for (let i = 0; i < 60; i++) {
    const a = i * 6 * Math.PI / 180, big = i % 5 === 0;
    const r1 = big ? 80 : 84, r2 = 90;
    ticks += `<line x1="${(100 + r1 * Math.sin(a)).toFixed(1)}" y1="${(100 - r1 * Math.cos(a)).toFixed(1)}" x2="${(100 + r2 * Math.sin(a)).toFixed(1)}" y2="${(100 - r2 * Math.cos(a)).toFixed(1)}" stroke="#2A1B4E" stroke-width="${big ? 2.4 : 1}" />`;
  }
  for (let n = 1; n <= 12; n++) {
    const a = n * 30 * Math.PI / 180, r = 68;
    nums += `<text x="${(100 + r * Math.sin(a)).toFixed(1)}" y="${(100 - r * Math.cos(a) + 6).toFixed(1)}" text-anchor="middle" font-family="Fredoka, sans-serif" font-weight="700" font-size="15" fill="#2A1B4E">${n}</text>`;
  }
  return `<svg viewBox="0 0 200 200" class="clock-face" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="clock">
    <circle cx="100" cy="100" r="95" fill="#FFF8F0" stroke="#2A1B4E" stroke-width="4"/>
    <circle cx="100" cy="100" r="95" fill="none" stroke="#FFC93C" stroke-width="6" opacity="0.35"/>
    ${ticks}${nums}
    <g class="ghost-hands">
      <line class="ghost-hour" x1="100" y1="100" x2="100" y2="46" stroke="#35D0BA" stroke-width="7" stroke-linecap="round" opacity="0.6"/>
      <line class="ghost-minute" x1="100" y1="100" x2="100" y2="24" stroke="#35D0BA" stroke-width="5" stroke-linecap="round" opacity="0.6"/>
    </g>
    <line class="hour-hand" x1="100" y1="108" x2="100" y2="50" stroke="#2A1B4E" stroke-width="8" stroke-linecap="round"/>
    <line class="minute-hand" x1="100" y1="112" x2="100" y2="22" stroke="#FF7AC6" stroke-width="6" stroke-linecap="round"/>
    <circle cx="100" cy="100" r="6" fill="#2A1B4E"/>
  </svg>`;
}
function angDist(a, b) { const d = Math.abs(a - b) % 360; return Math.min(d, 360 - d); }
