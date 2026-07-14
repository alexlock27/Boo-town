// js/games/booroll.js — Boo Roll (RUN9 C4): tilt the tablet to roll a Boo through a course,
// in the Crash-Course tradition, gentled. Six authored single-screen courses of rising
// trickiness (walls, gentle slopes, holes, a midway checkpoint flag, 3 pickup stars each).
// Input: deviceorientation tilt with a hold-flat calibration + a re-centre button, low-pass
// smoothing + a sensitivity constant; iOS shows a one-tap permission button first play; the
// always-available fallback is a virtual thumb-stick (drag to lean), offered automatically
// wherever sensors are absent/denied and doubling as the reduced-motion mode. Rolling into a
// hole respawns at the last flag with a boing + a small time cost — never a fail. Friendly
// clock; authored par times award bronze/silver/gold medals (Trophy Room + course-map).

import { el, clear, backControl, REDUCED, confetti, sparkleAt } from '../ui.js';
import { getState, mutate } from '../state.js';
import { renderGuide } from '../art.js';
import { guideLine, speakMaybe } from '../guide.js';
import { sfx, music } from '../sfx.js';
import { haptic } from '../haptics.js';
import { runIntro, introSeen } from '../intro.js';
import { checkAndCelebrate } from '../trophies.js';

const FW = 1000, FH = 640;           // virtual field (landscape-first, letterboxed to fit)
const BALL_R = 18;
const SENS = 0.85;                    // tilt → acceleration
const FRICTION = 0.945;              // per-frame velocity damping (rolling resistance)
const BOUNCE = 0.55;                 // wall restitution (damped)
const MAX_SPEED = 13;
const LOWPASS = 0.18;               // orientation smoothing
const HOLE_TIME_COST = 2000;        // ms added when you fall in a hole
const SENSOR_WAIT_MS = 1600;        // no orientation event by now → offer the finger fallback

// Guide body colour → the rolled ball colour (matches the creator options).
const BODY_HEX = { sunshine: '#FFD166', lilac: '#C6A9F0', sky: '#8FC7FF' };

// ---- the six authored courses (RUN9 C4), rising trickiness. Coordinates in the 1000×640
// field; the border is a wall. Par times in seconds (gold < silver < bronze). ----
export const COURSES = [
  { id: 'roll1', name: 'First Roll', tip: 'Lean gently — roll to the flag, then the ring!',
    start: { x: 90, y: 90 }, flag: { x: 500, y: 330 }, goal: { x: 910, y: 550 },
    walls: [{ x: 250, y: 0, w: 40, h: 400 }, { x: 620, y: 240, w: 40, h: 400 }],
    holes: [{ x: 500, y: 120, r: 44 }],
    stars: [{ x: 160, y: 500 }, { x: 780, y: 120 }, { x: 500, y: 560 }],
    par: { gold: 15, silver: 24, bronze: 38 } },
  { id: 'roll2', name: 'Zig Zag', tip: 'Weave through the zigzag walls.',
    start: { x: 90, y: 90 }, flag: { x: 500, y: 320 }, goal: { x: 910, y: 90 },
    walls: [{ x: 200, y: 0, w: 40, h: 460 }, { x: 420, y: 180, w: 40, h: 460 }, { x: 640, y: 0, w: 40, h: 460 }, { x: 0, y: 300, w: 200, h: 36 }],
    holes: [{ x: 320, y: 540, r: 42 }, { x: 560, y: 90, r: 42 }],
    stars: [{ x: 120, y: 560 }, { x: 540, y: 560 }, { x: 900, y: 540 }],
    par: { gold: 18, silver: 28, bronze: 44 } },
  { id: 'roll3', name: 'Hole in One', tip: 'Mind the holes — go around!',
    start: { x: 90, y: 550 }, flag: { x: 500, y: 320 }, goal: { x: 910, y: 90 },
    walls: [{ x: 300, y: 200, w: 400, h: 40 }, { x: 300, y: 400, w: 400, h: 40 }],
    holes: [{ x: 200, y: 320, r: 44 }, { x: 500, y: 120, r: 44 }, { x: 500, y: 520, r: 44 }, { x: 800, y: 320, r: 44 }],
    stars: [{ x: 120, y: 90 }, { x: 500, y: 320 }, { x: 900, y: 550 }],
    par: { gold: 20, silver: 32, bronze: 50 } },
  { id: 'roll4', name: 'The Narrows', tip: 'Steady now — thread the narrow gaps.',
    start: { x: 90, y: 90 }, flag: { x: 520, y: 320 }, goal: { x: 910, y: 550 },
    walls: [{ x: 0, y: 200, w: 380, h: 36 }, { x: 480, y: 200, w: 520, h: 36 }, { x: 0, y: 420, w: 620, h: 36 }, { x: 720, y: 420, w: 280, h: 36 }, { x: 300, y: 236, w: 36, h: 184 }],
    holes: [{ x: 430, y: 120, r: 40 }, { x: 660, y: 320, r: 40 }, { x: 180, y: 540, r: 40 }],
    stars: [{ x: 430, y: 320 }, { x: 900, y: 120 }, { x: 120, y: 320 }],
    par: { gold: 22, silver: 34, bronze: 54 } },
  { id: 'roll5', name: 'Round the Bend', tip: 'Curl around the spiral.',
    start: { x: 500, y: 320 }, flag: { x: 500, y: 90 }, goal: { x: 90, y: 90 },
    walls: [{ x: 200, y: 160, w: 600, h: 36 }, { x: 764, y: 160, w: 36, h: 340 }, { x: 200, y: 464, w: 600, h: 36 }, { x: 200, y: 300, w: 36, h: 200 }, { x: 340, y: 300, w: 320, h: 36 }],
    holes: [{ x: 620, y: 400, r: 40 }, { x: 300, y: 400, r: 40 }, { x: 880, y: 320, r: 44 }],
    stars: [{ x: 500, y: 400 }, { x: 620, y: 90 }, { x: 90, y: 550 }],
    par: { gold: 24, silver: 38, bronze: 58 } },
  { id: 'roll6', name: 'Grand Roll', tip: 'The big one — everything at once!',
    start: { x: 90, y: 90 }, flag: { x: 500, y: 320 }, goal: { x: 910, y: 550 },
    walls: [{ x: 220, y: 0, w: 36, h: 360 }, { x: 220, y: 460, w: 36, h: 180 }, { x: 420, y: 140, w: 36, h: 500 }, { x: 620, y: 0, w: 36, h: 360 }, { x: 620, y: 460, w: 36, h: 180 }, { x: 800, y: 140, w: 36, h: 500 }, { x: 256, y: 324, w: 164, h: 36 }],
    holes: [{ x: 330, y: 120, r: 40 }, { x: 330, y: 540, r: 40 }, { x: 530, y: 90, r: 40 }, { x: 720, y: 320, r: 40 }, { x: 720, y: 560, r: 40 }],
    stars: [{ x: 120, y: 560 }, { x: 530, y: 540 }, { x: 900, y: 90 }],
    par: { gold: 28, silver: 44, bronze: 66 } }
];
export const COURSE_IDS = COURSES.map(c => c.id);

const ROLL_INTRO = [
  { text: 'Tilt the tablet to roll your Boo around the course!' },
  { text: 'Touch the flag, grab the stars, reach the ring to finish.' },
  { text: 'No tilt? Drag the finger stick instead. Fall in a hole? Just a little boing!' }
];

export function medalFor(course, seconds) {
  const p = course.par;
  if (seconds <= p.gold) return 'gold';
  if (seconds <= p.silver) return 'silver';
  if (seconds <= p.bronze) return 'bronze';
  return null;   // finished but over bronze par → still a finish, no medal
}
const MEDAL_ICON = { gold: '🥇', silver: '🥈', bronze: '🥉' };

export function mount(container, params, ctx) {
  const root = el('div', { class: 'screen booroll' });
  container.appendChild(root);
  let raf = null, orientHandler = null, cleanupFns = [];
  const s0 = getState();
  s0.booRoll = s0.booRoll || { best: {}, medals: {} };

  const rz = params && params.resume;
  if (rz && rz.course) { const c = COURSES.find(x => x.id === rz.course); if (c) startCalibrate(c); else mapScreen(); }
  else mapScreen();
  if (!introSeen('booroll')) runIntro('booroll', { steps: ROLL_INTRO });

  function cleanup() {
    if (raf) cancelAnimationFrame(raf); raf = null;
    if (orientHandler) { window.removeEventListener('deviceorientation', orientHandler); orientHandler = null; }
    cleanupFns.forEach(f => { try { f(); } catch {} }); cleanupFns = [];
  }

  function bodyColour() { const g = getState().guide || {}; return BODY_HEX[g.body] || '#FF7AC6'; }

  // ---------------- course-select map ----------------
  function mapScreen() {
    cleanup(); clear(root);
    music.play('game');
    const s = getState();
    const wrap = el('div', { class: 'roll-map card' }, [
      el('div', { class: 'sc-guide', html: renderGuide(s.guide, { view: 'head', size: 88 }) }),
      el('h2', { text: '🎢 Boo Roll' }),
      el('p', { class: 'sc-intro', text: 'Pick a course — earn bronze, silver and gold!' })
    ]);
    const grid = el('div', { class: 'roll-course-grid' });
    COURSES.forEach((c, i) => {
      const medal = s.booRoll.medals[c.id];
      const best = s.booRoll.best[c.id];
      const card = el('button', { class: 'roll-course-card' + (medal ? ' won' : ''), onclick: () => { sfx.tap(); startCalibrate(c); } }, [
        el('span', { class: 'rcc-num', text: String(i + 1) }),
        el('span', { class: 'rcc-name', text: c.name }),
        el('span', { class: 'rcc-medal', text: medal ? MEDAL_ICON[medal] : '⚪' }),
        el('span', { class: 'rcc-best', text: best ? (best / 1000).toFixed(1) + 's' : '—' })
      ]);
      grid.appendChild(card);
    });
    wrap.appendChild(grid);
    root.appendChild(wrap);
    root.appendChild(backControl(() => ctx.go('hub'), { floating: true }));
    if (typeof window !== 'undefined') window.__booroll = Object.assign(window.__booroll || {}, {
      courses: () => COURSES.map(c => c.id), openCourse: (id) => { const c = COURSES.find(x => x.id === id); if (c) startCalibrate(c); },
      medals: () => ({ ...getState().booRoll.medals }), onMap: () => true
    });
  }

  // ---------------- calibration ----------------
  function startCalibrate(course) {
    cleanup(); clear(root);
    const s = getState();
    let mode = REDUCED ? 'virtual' : 'sensor';   // reduced-motion → finger stick by default
    const needsPerm = typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function';
    let permGranted = !needsPerm;

    const panel = el('div', { class: 'roll-calibrate card' }, [
      el('h2', { text: course.name }),
      el('p', { class: 'roll-tip', text: course.tip })
    ]);
    const btns = el('div', { class: 'roll-cal-btns' });
    // iOS permission button (first play): a friendly tap to enable tilt
    const permBtn = el('button', { class: 'btn', text: '📲 Tap to enable tilt!', onclick: async () => {
      try { const res = await DeviceOrientationEvent.requestPermission(); permGranted = (res === 'granted'); }
      catch { permGranted = false; }
      if (permGranted) { permBtn.style.display = 'none'; goBtn.style.display = ''; }
      else { mode = 'virtual'; permBtn.style.display = 'none'; goBtn.textContent = '▶ GO (finger tilt)'; goBtn.style.display = ''; }
    } });
    const goBtn = el('button', { class: 'btn big', text: '✋ Hold flat, then tap GO', onclick: () => beginPlay(course, mode) });
    const fingerBtn = el('button', { class: 'btn soft', text: '👆 Use finger tilt instead', onclick: () => beginPlay(course, 'virtual') });
    if (needsPerm && !permGranted) { goBtn.style.display = 'none'; btns.append(permBtn, fingerBtn); }
    else btns.append(goBtn, fingerBtn);
    panel.appendChild(btns);
    root.appendChild(panel);
    root.appendChild(backControl(() => mapScreen(), { floating: true }));

    if (typeof window !== 'undefined') window.__booroll = Object.assign(window.__booroll || {}, {
      onMap: () => false, calibrating: () => true,
      go: (m) => beginPlay(course, m || mode),
      tapPermission: async () => { await permBtn.onclick(); }, permNeeded: () => needsPerm && !permGranted,
      useFinger: () => beginPlay(course, 'virtual')
    });
  }

  // ---------------- play a course ----------------
  function beginPlay(course, mode) {
    cleanup(); clear(root);
    music.play('game');

    // physics state
    let bx = course.start.x, by = course.start.y, vx = 0, vy = 0, spin = 0;
    let tiltX = 0, tiltY = 0;          // smoothed, calibrated tilt (-1..1-ish)
    let zeroG = null, zeroB = null;    // orientation calibration (captured on first reading)
    let startMs = null, elapsed = 0, holeCost = 0, finished = false, respawns = 0;
    let lastFlag = { x: course.start.x, y: course.start.y }, flagHit = false;
    const starsGot = course.stars.map(() => false);
    let sawOrientation = false;
    let usingVirtual = (mode === 'virtual');

    const cvs = el('canvas', { class: 'roll-canvas', width: FW, height: FH });
    const cx = cvs.getContext('2d');
    const hud = el('div', { class: 'roll-hud' }, [
      el('span', { class: 'roll-clock', text: '0.0s' }),
      el('span', { class: 'roll-stars-hud', text: '⭐ 0/3' })
    ]);
    const recentreBtn = el('button', { class: 'roll-recentre', 'aria-label': 'Re-centre tilt', text: '🎯' });
    recentreBtn.addEventListener('click', () => { zeroG = null; zeroB = null; sfx.tap(); });
    // finger thumb-stick (virtual tilt), shown when needed
    const stick = el('div', { class: 'roll-stick' + (usingVirtual ? ' on' : '') }, [el('div', { class: 'roll-stick-nub' })]);
    const stage = el('div', { class: 'roll-stage' }, [cvs, hud, recentreBtn, stick]);
    root.appendChild(stage);
    root.appendChild(backControl(() => { cleanup(); mapScreen(); }, { floating: true }));

    // orientation input
    orientHandler = (e) => {
      if (e.gamma == null && e.beta == null) return;
      sawOrientation = true;
      if (zeroG == null) { zeroG = e.gamma || 0; zeroB = e.beta || 0; }
      const gx = ((e.gamma || 0) - zeroG) / 35;   // ~35° = full lean
      const gy = ((e.beta || 0) - zeroB) / 35;
      tiltX += (clamp(gx, -1.3, 1.3) - tiltX) * LOWPASS;
      tiltY += (clamp(gy, -1.3, 1.3) - tiltY) * LOWPASS;
      usingVirtual = false; stick.classList.remove('on');
    };
    if (!usingVirtual) window.addEventListener('deviceorientation', orientHandler);

    // virtual thumb-stick drag
    let stickDrag = false, scx = 0, scy = 0;
    function stickTilt(dx, dy) { const R = 46; tiltX = clamp(dx / R, -1.2, 1.2); tiltY = clamp(dy / R, -1.2, 1.2); const nub = stick.querySelector('.roll-stick-nub'); nub.style.transform = `translate(${clamp(dx, -R, R)}px, ${clamp(dy, -R, R)}px)`; }
    stick.addEventListener('pointerdown', e => { stickDrag = true; usingVirtual = true; stick.classList.add('on'); const r = stick.getBoundingClientRect(); scx = r.left + r.width / 2; scy = r.top + r.height / 2; stick.setPointerCapture(e.pointerId); stickTilt(e.clientX - scx, e.clientY - scy); });
    stick.addEventListener('pointermove', e => { if (stickDrag) stickTilt(e.clientX - scx, e.clientY - scy); });
    const stickUp = () => { stickDrag = false; tiltX = 0; tiltY = 0; const nub = stick.querySelector('.roll-stick-nub'); nub.style.transform = 'translate(0,0)'; };
    stick.addEventListener('pointerup', stickUp); stick.addEventListener('pointercancel', stickUp);

    // if no sensor reading soon, offer/auto-enable the finger stick
    if (!usingVirtual) { const t = setTimeout(() => { if (!sawOrientation) { usingVirtual = true; stick.classList.add('on'); } }, SENSOR_WAIT_MS); cleanupFns.push(() => clearTimeout(t)); }

    startMs = performance.now();
    let last = startMs;
    function frame(now) {
      if (document.hidden) { raf = requestAnimationFrame(frame); last = now; return; }
      const dt = Math.min(2.4, (now - last) / 16.67); last = now;
      if (!finished) elapsed = (now - startMs);
      step(dt);
      draw();
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    function step(dt) {
      if (finished) return;
      // acceleration from tilt
      vx += tiltX * SENS * dt;
      vy += tiltY * SENS * dt;
      vx *= Math.pow(FRICTION, dt); vy *= Math.pow(FRICTION, dt);
      const sp = Math.hypot(vx, vy); if (sp > MAX_SPEED) { vx = vx / sp * MAX_SPEED; vy = vy / sp * MAX_SPEED; }
      bx += vx * dt; by += vy * dt;
      // field borders (walls)
      if (bx < BALL_R) { bx = BALL_R; vx = -vx * BOUNCE; bump(); }
      if (bx > FW - BALL_R) { bx = FW - BALL_R; vx = -vx * BOUNCE; bump(); }
      if (by < BALL_R) { by = BALL_R; vy = -vy * BOUNCE; bump(); }
      if (by > FH - BALL_R) { by = FH - BALL_R; vy = -vy * BOUNCE; bump(); }
      // interior walls (AABB vs circle, resolve on the smaller overlap axis)
      for (const w of course.walls) resolveWall(w);
      spin += sp * 0.06 * dt;
      // holes
      for (const h of course.holes) { if (Math.hypot(bx - h.x, by - h.y) < h.r * 0.7) return fallInHole(); }
      // stars
      course.stars.forEach((st, i) => { if (!starsGot[i] && Math.hypot(bx - st.x, by - st.y) < BALL_R + 18) { starsGot[i] = true; sfx.pop(); const p = toScreen(st.x, st.y); if (!REDUCED) sparkleAt(p.x, p.y); } });
      // flag (checkpoint)
      if (!flagHit && Math.hypot(bx - course.flag.x, by - course.flag.y) < BALL_R + 26) { flagHit = true; lastFlag = { x: course.flag.x, y: course.flag.y }; sfx.correct(); }
      // goal
      if (flagHit && Math.hypot(bx - course.goal.x, by - course.goal.y) < BALL_R + 28) return win();
    }
    function bump() { sfx.tap(); try { haptic('bump'); } catch {} }   // a gentle bump on a wall hit (RUN9 C7)
    function resolveWall(w) {
      const nx = clamp(bx, w.x, w.x + w.w), ny = clamp(by, w.y, w.y + w.h);
      const dx = bx - nx, dy = by - ny, d2 = dx * dx + dy * dy;
      if (d2 > BALL_R * BALL_R) return;
      const d = Math.sqrt(d2) || 0.001;
      if (dx === 0 && dy === 0) {  // centre inside the wall — push out on the nearest edge
        const left = bx - w.x, right = w.x + w.w - bx, top = by - w.y, bot = w.y + w.h - by;
        const m = Math.min(left, right, top, bot);
        if (m === left) { bx = w.x - BALL_R; vx = -Math.abs(vx) * BOUNCE; }
        else if (m === right) { bx = w.x + w.w + BALL_R; vx = Math.abs(vx) * BOUNCE; }
        else if (m === top) { by = w.y - BALL_R; vy = -Math.abs(vy) * BOUNCE; }
        else { by = w.y + w.h + BALL_R; vy = Math.abs(vy) * BOUNCE; }
        bump(); return;
      }
      const ux = dx / d, uy = dy / d, push = BALL_R - d;
      bx += ux * push; by += uy * push;
      const vn = vx * ux + vy * uy;
      vx -= (1 + BOUNCE) * vn * ux; vy -= (1 + BOUNCE) * vn * uy;
      bump();
    }
    function fallInHole() {
      respawns++; holeCost += HOLE_TIME_COST; startMs += HOLE_TIME_COST;   // add the time cost
      bx = lastFlag.x; by = lastFlag.y; vx = 0; vy = 0;
      sfx.oops();
      // a little boing pop
      const p = toScreen(bx, by); if (!REDUCED) sparkleAt(p.x, p.y);
      stage.classList.remove('boing'); void stage.offsetWidth; if (!REDUCED) stage.classList.add('boing');
    }
    function win() {
      if (finished) return; finished = true;
      const seconds = elapsed / 1000;
      const medal = medalFor(course, seconds);
      const starCount = starsGot.filter(Boolean).length;
      sfx.star();
      if (!REDUCED) confetti({ count: 70, power: 1.1 });
      // persist best + medal (best time and best medal only improve)
      mutate(s => {
        s.booRoll = s.booRoll || { best: {}, medals: {} };
        const prevBest = s.booRoll.best[course.id];
        if (prevBest == null || elapsed < prevBest) s.booRoll.best[course.id] = Math.round(elapsed);
        const order = { bronze: 1, silver: 2, gold: 3 };
        if (medal && (!s.booRoll.medals[course.id] || order[medal] > order[s.booRoll.medals[course.id]])) s.booRoll.medals[course.id] = medal;
      });
      // stars for the meter: 3 = gold, 2 = silver/bronze, 1 = finished (medal drives it, plus pickups nudge)
      const stars = medal === 'gold' ? 3 : (medal ? 2 : 1);
      checkAndCelebrate();   // Trophy Room medal entries (first medal / all bronze / all gold)
      // a short results overlay then the shared results screen
      const card = el('div', { class: 'roll-finish card' }, [
        el('div', { class: 'roll-finish-medal', text: medal ? MEDAL_ICON[medal] : '🎉' }),
        el('h2', { text: medal ? `${medal[0].toUpperCase() + medal.slice(1)} medal!` : 'You finished!' }),
        el('p', { text: `${seconds.toFixed(1)}s · ⭐ ${starCount}/3` })
      ]);
      root.appendChild(el('div', { class: 'roll-finish-overlay' }, [card]));
      setTimeout(() => { cleanup(); ctx.go('results', { game: 'booroll', gameName: 'Boo Roll', stars, level: null, cat: null, mix: false, replay: () => ctx.go('booroll', { resume: { course: course.id } }) }); }, 2000);
    }

    // ---- render ----
    let scale = 1, offX = 0, offY = 0;
    function fit() {
      const r = stage.getBoundingClientRect();
      scale = Math.min(r.width / FW, r.height / FH);
      offX = (r.width - FW * scale) / 2; offY = (r.height - FH * scale) / 2;
      cvs.style.width = (FW * scale) + 'px'; cvs.style.height = (FH * scale) + 'px';
    }
    function toScreen(x, y) { const r = cvs.getBoundingClientRect(); return { x: r.left + x * (r.width / FW), y: r.top + y * (r.height / FH) }; }
    const ro = new ResizeObserver(fit); ro.observe(stage); cleanupFns.push(() => ro.disconnect());
    fit();

    const col = bodyColour();
    function draw() {
      cx.clearRect(0, 0, FW, FH);
      // floor
      cx.fillStyle = '#2E2660'; cx.fillRect(0, 0, FW, FH);
      // holes
      for (const h of course.holes) { cx.beginPath(); cx.arc(h.x, h.y, h.r, 0, Math.PI * 2); cx.fillStyle = '#120b2e'; cx.fill(); cx.lineWidth = 4; cx.strokeStyle = '#0a0620'; cx.stroke(); }
      // walls
      cx.fillStyle = '#6B4BA8'; cx.strokeStyle = '#2A1B4E'; cx.lineWidth = 4;
      for (const w of course.walls) { roundRect(cx, w.x, w.y, w.w, w.h, 8); cx.fill(); cx.stroke(); }
      // border
      cx.strokeStyle = '#2A1B4E'; cx.lineWidth = 10; cx.strokeRect(5, 5, FW - 10, FH - 10);
      // stars
      course.stars.forEach((st, i) => { if (starsGot[i]) return; drawStar(cx, st.x, st.y, 16); });
      // flag
      drawFlag(cx, course.flag.x, course.flag.y, flagHit);
      // goal ring
      cx.beginPath(); cx.arc(course.goal.x, course.goal.y, 30, 0, Math.PI * 2); cx.lineWidth = 7; cx.strokeStyle = flagHit ? '#35D0BA' : '#8d84b0'; cx.stroke();
      cx.beginPath(); cx.arc(course.goal.x, course.goal.y, 18, 0, Math.PI * 2); cx.strokeStyle = flagHit ? '#FFC93C' : '#8d84b0'; cx.lineWidth = 5; cx.stroke();
      // ball (a curled Boo)
      drawBall(cx, bx, by, spin, col);
      // HUD
      hud.querySelector('.roll-clock').textContent = (elapsed / 1000).toFixed(1) + 's';
      hud.querySelector('.roll-stars-hud').textContent = '⭐ ' + starsGot.filter(Boolean).length + '/3';
    }

    if (typeof window !== 'undefined') window.__booroll = Object.assign(window.__booroll || {}, {
      onMap: () => false, playing: () => true, courseId: () => course.id,
      ball: () => ({ x: bx, y: by, vx, vy }),
      state: () => ({ course: course.id, ms: Math.round(elapsed), seconds: elapsed / 1000, stars: starsGot.filter(Boolean).length, flagHit, finished, respawns, mode: usingVirtual ? 'virtual' : 'sensor', sawOrientation, calibrated: zeroG != null }),
      field: () => ({ FW, FH, course }),
      setTilt: (tx, ty) => { tiltX = clamp(tx, -1.3, 1.3); tiltY = clamp(ty, -1.3, 1.3); },
      orient: (gamma, beta) => { const e = { gamma, beta }; orientHandler && orientHandler(e); },
      stick: (dx, dy) => { usingVirtual = true; stick.classList.add('on'); stickTilt(dx, dy); },
      teleport: (x, y) => { bx = x; by = y; vx = 0; vy = 0; },
      recentre: () => { zeroG = null; zeroB = null; },
      fallHole: () => fallInHole(),
      grabFlag: () => { flagHit = true; lastFlag = { x: course.flag.x, y: course.flag.y }; },
      forceFinish: () => { flagHit = true; bx = course.goal.x; by = course.goal.y; },
      medal: () => medalFor(course, elapsed / 1000)
    });
  }

  return { unmount() { cleanup(); } };
}

// ---- canvas helpers ----
function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
function roundRect(cx, x, y, w, h, r) { r = Math.min(r, w / 2, h / 2); cx.beginPath(); cx.moveTo(x + r, y); cx.arcTo(x + w, y, x + w, y + h, r); cx.arcTo(x + w, y + h, x, y + h, r); cx.arcTo(x, y + h, x, y, r); cx.arcTo(x, y, x + w, y, r); cx.closePath(); }
function drawStar(cx, x, y, r) {
  cx.save(); cx.translate(x, y); cx.beginPath();
  for (let i = 0; i < 5; i++) { const a = (i * 72 - 90) * Math.PI / 180, a2 = a + Math.PI / 5; cx.lineTo(Math.cos(a) * r, Math.sin(a) * r); cx.lineTo(Math.cos(a2) * r * 0.45, Math.sin(a2) * r * 0.45); }
  cx.closePath(); cx.fillStyle = '#FFC93C'; cx.fill(); cx.lineWidth = 2; cx.strokeStyle = '#2A1B4E'; cx.stroke(); cx.restore();
}
function drawFlag(cx, x, y, hit) {
  cx.save(); cx.translate(x, y); cx.strokeStyle = '#2A1B4E'; cx.lineWidth = 4; cx.beginPath(); cx.moveTo(0, 22); cx.lineTo(0, -26); cx.stroke();
  cx.beginPath(); cx.moveTo(0, -26); cx.lineTo(28, -18); cx.lineTo(0, -10); cx.closePath(); cx.fillStyle = hit ? '#35D0BA' : '#FF7AC6'; cx.fill(); cx.stroke(); cx.restore();
}
function drawBall(cx, x, y, spin, col) {
  cx.save(); cx.translate(x, y);
  cx.beginPath(); cx.arc(0, 0, BALL_R, 0, Math.PI * 2); cx.fillStyle = col; cx.fill(); cx.lineWidth = 3.5; cx.strokeStyle = '#2A1B4E'; cx.stroke();
  // spinning shine arc
  cx.save(); cx.rotate(spin); cx.beginPath(); cx.arc(0, 0, BALL_R - 5, -0.4, 0.7); cx.lineWidth = 3; cx.strokeStyle = 'rgba(255,255,255,0.55)'; cx.stroke(); cx.restore();
  // happy face
  cx.fillStyle = '#2A1B4E';
  cx.beginPath(); cx.arc(-6, -3, 2.6, 0, Math.PI * 2); cx.fill();
  cx.beginPath(); cx.arc(6, -3, 2.6, 0, Math.PI * 2); cx.fill();
  cx.beginPath(); cx.arc(0, 3, 5, 0.15 * Math.PI, 0.85 * Math.PI); cx.lineWidth = 2; cx.strokeStyle = '#2A1B4E'; cx.stroke();
  cx.restore();
}
