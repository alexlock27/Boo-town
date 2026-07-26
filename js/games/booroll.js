// js/games/booroll.js — RUN14 U1: Boo Roll 3.0, the single-screen course.
// The whole course fits the viewport with NO camera scroll: a side-view lattice you read
// at a glance and then execute. Physics, mechanisms and the authored courses live in
// boorollphysics.js + data/courses.js so the anti-lean proof runs headlessly against the
// SAME engine the child plays.
import { el, clear, backControl, REDUCED, confetti, sparkleAt } from '../ui.js';
import { getState, mutate } from '../state.js';
import { renderGuide } from '../art.js';
import { sfx, music } from '../sfx.js';
import { checkAndCelebrate } from '../trophies.js';
import { COURSES, UNPLAYABLE } from '../../data/courses.js';
import { createRoll, ROLL } from './boorollphysics.js';
import { haptic } from '../haptics.js';
import { maybeIntro, replayIntro } from '../intro.js';

export { COURSES, UNPLAYABLE };
export const COURSE_IDS = COURSES.map(c => c.key);
export const SENS_DEFAULT = 1, LOWPASS = 0.18, DEADZONE = 1.5;
const VB_W = 100, VB_H = 60;                    // the authored normalised viewBox
const MEDAL_ICON = { gold: '🥇', silver: '🥈', bronze: '🥉' };
const BODY_HEX = { sunshine: '#FFD166', lilac: '#C6A9F0', sky: '#8FC7FF' };

export const ROLL_INTRO = [
  { text: 'Tilt to roll! The whole course fits on one screen.' },
  { text: 'The big ⬆ button hops. Hops reach the stars!' },
  { text: 'The other button works see-saws, lifts, girders and gates.' }
];

export function medalFor(course, seconds) {
  if (seconds <= course.pars.gold) return 'gold';
  if (seconds <= course.pars.silver) return 'silver';
  if (seconds <= course.pars.bronze) return 'bronze';
  return null;
}

export function mount(container, params, ctx) {
  const root = el('div', { class: 'screen booroll roll14' });
  container.appendChild(root);
  let raf = 0, orientHandler = null, cleanups = [];
  const cleanup = () => {
    if (raf) cancelAnimationFrame(raf); raf = 0;
    if (orientHandler) window.removeEventListener('deviceorientation', orientHandler);
    orientHandler = null;
    cleanups.splice(0).forEach(fn => { try { fn(); } catch {} });
    try { if (document.fullscreenElement) document.exitFullscreen(); } catch {}
    try { if (screen.orientation && screen.orientation.unlock) screen.orientation.unlock(); } catch {}
  };
  const bodyColour = () => BODY_HEX[(getState().guide || {}).body] || '#FF7AC6';
  const hook = values => { if (typeof window !== 'undefined') window.__booroll = Object.assign(window.__booroll || {}, values); };

  // ---- course select --------------------------------------------------------------
  const goMap = () => {
    cleanup(); clear(root); music.play('game');
    const save = getState(); save.booRoll = save.booRoll || { best: {}, medals: {} };
    const map = el('div', { class: 'roll-map card' }, [
      el('div', { class: 'sc-guide', html: renderGuide(save.guide, { view: 'head', size: 88 }) }),
      el('h2', { text: '🎢 Boo Roll' }),
      el('p', { class: 'sc-intro', text: 'Six little courses. Each one fits on a single screen — read it, then roll it!' })
    ]);
    const grid = el('div', { class: 'roll-course-grid' });
    COURSES.forEach((course, i) => {
      const medal = (save.booRoll.medals || {})[course.key], best = (save.booRoll.best || {})[course.key];
      const blocked = UNPLAYABLE[course.key];
      const card = el('button', {
        class: 'roll-course-card' + (medal ? ' won' : '') + (blocked ? ' building' : ''),
        disabled: !!blocked,
        'aria-label': blocked ? `${course.name} — ${blocked}` : `Play ${course.name}`,
        onclick: () => { if (!blocked) calibrate(course); }
      }, [
        el('span', { class: 'rcc-num', text: String(i + 1) }),
        el('span', { class: 'rcc-name', text: course.name }),
        el('span', { class: 'rcc-medal', text: blocked ? '🚧' : (medal ? MEDAL_ICON[medal] : '⚪') }),
        el('span', { class: 'rcc-best', text: blocked ? blocked : (best ? (best / 1000).toFixed(1) + 's' : `${course.pars.gold}s gold`) })
      ]);
      grid.appendChild(card);
    });
    map.appendChild(grid);
    root.append(map, backControl(() => ctx.go('hub'), { floating: true }));
    maybeIntro('booroll', ROLL_INTRO);
    hook({
      courses: () => COURSE_IDS, playable: () => COURSE_IDS.filter(k => !UNPLAYABLE[k]),
      openCourse: id => { const c = COURSES.find(x => x.key === id); if (c && !UNPLAYABLE[id]) calibrate(c); },
      onMap: () => true, playing: () => false, calibrating: () => false,
      cardBlocked: id => !!UNPLAYABLE[id]
    });
  };

  // ---- calibration ----------------------------------------------------------------
  const calibrate = course => {
    cleanup(); clear(root);
    const needsPermission = typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function';
    let permission = !needsPermission;
    // Orientation, the real answer: ask for fullscreen + a landscape lock (works on the
    // Android Chrome the family uses). Where lock is unsupported (iOS Safari), we show a
    // friendly card and play unlocked, mapping the axis to whatever orientation we are in.
    let locked = false;
    const lockLandscape = async () => {
      try { if (root.requestFullscreen && !document.fullscreenElement) await root.requestFullscreen(); } catch {}
      try { if (screen.orientation && screen.orientation.lock) { await screen.orientation.lock('landscape'); locked = true; } } catch { locked = false; }
      return locked;
    };
    const panel = el('div', { class: 'roll-calibrate card' }, [
      el('h2', { text: course.name }),
      el('p', { class: 'roll-teaches', text: `Learns: ${course.teaches}` })
    ]);
    // AUTHORED COPY (RUN14 U1.4), exactly:
    const tip = el('p', { class: 'roll-tip', text: 'Hold it however you like — then tap GO!' });
    const turnCard = el('p', { class: 'roll-turn', text: 'Turn your tablet sideways!' });
    turnCard.style.display = 'none';
    const go = el('button', { class: 'btn big', text: 'GO!', onclick: async () => { await lockLandscape(); play(course, 'sensor'); } });
    const finger = el('button', { class: 'btn soft', text: '👆 Use finger tilt instead', onclick: () => play(course, 'virtual') });
    panel.append(tip, turnCard);
    if (needsPermission) panel.appendChild(el('button', { class: 'btn', text: '📲 Tap to enable tilt!', onclick: async e => {
      try { permission = await DeviceOrientationEvent.requestPermission() === 'granted'; } catch {}
      e.currentTarget.remove(); panel.append(permission ? go : finger);
    } })); else panel.append(go, finger);
    root.append(panel, backControl(goMap, { floating: true }));
    hook({
      onMap: () => false, calibrating: () => true, playing: () => false,
      go: mode => play(course, mode || 'sensor'), useFinger: () => play(course, 'virtual'),
      permNeeded: () => needsPermission && !permission,
      lockSupported: () => !!(screen.orientation && screen.orientation.lock),
      showTurnCard: () => { turnCard.style.display = ''; return turnCard.textContent; },
      calibrationCopy: () => [tip.textContent, go.textContent]
    });
  };

  // ---- play -----------------------------------------------------------------------
  const play = (course, requestedMode) => {
    cleanup(); clear(root); music.play('game');
    const sim = createRoll(course);
    const st = sim.state;
    const settings = getState().settings || {};
    const sens = typeof settings.rollSens === 'number' ? settings.rollSens : SENS_DEFAULT;
    const invert = !!settings.rollInvert;
    let mode = REDUCED ? 'virtual' : requestedMode;
    let rawTilt = 0, tilt = 0, zero = null, sawOrientation = false;
    let paddleHeld = false, hopQueued = false, finished = false;
    const trail = [];

    const svg = el('div', { class: 'roll-svg-wrap' });
    const clock = el('span', { class: 'roll-clock', text: '0.0s' });
    const starChip = el('span', { class: 'roll-stars-hud', text: '⭐ 0/3' });
    const parChip = el('span', { class: 'roll-par', text: `🥇 ${course.pars.gold}s` });
    const hud = el('div', { class: 'roll-hud' }, [clock, starChip, parChip]);
    const recentre = el('button', { class: 'roll-recentre', 'aria-label': 'Re-centre the tilt', text: '🎯', onclick: () => { zero = null; } });
    const helpBtn = el('button', { class: 'roll-help', 'aria-label': 'How to play', text: '?', onclick: () => replayIntro('booroll', ROLL_INTRO) });
    // Two thumb buttons, bottom corners: LEFT works the nearest mechanism, RIGHT hops.
    const paddle = el('button', { class: 'roll-paddle left', 'aria-label': 'Work the see-saw, lift, girder or gate' }, [el('span', { text: '⚙️' })]);
    const hopBtn = el('button', { class: 'roll-hop', 'aria-label': 'Hop' }, [el('span', { text: '⬆' })]);
    const stick = el('div', { class: 'roll-stick' + (mode === 'virtual' ? ' on' : ''), 'aria-label': 'Drag to lean' }, [el('div', { class: 'roll-stick-nub' })]);
    const stage = el('div', { class: 'roll-stage' }, [svg, hud, recentre, helpBtn, paddle, hopBtn, stick]);
    root.append(stage, backControl(() => { cleanup(); goMap(); }, { floating: true }));

    const press = (node, on, off) => {
      ['pointerdown'].forEach(t => node.addEventListener(t, e => { e.preventDefault(); on(); }));
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => node.addEventListener(t, () => off()));
    };
    press(paddle, () => { paddleHeld = true; paddle.classList.add('held'); }, () => { paddleHeld = false; paddle.classList.remove('held'); });
    press(hopBtn, () => { hopQueued = true; hopBtn.classList.add('held'); }, () => hopBtn.classList.remove('held'));

    let drag = false, sx = 0;
    const setStick = px => {
      rawTilt = Math.max(-1.25, Math.min(1.25, (px - sx) / 46)) * 22;
      stick.querySelector('.roll-stick-nub').style.transform = `translate(${Math.max(-46, Math.min(46, px - sx))}px,0)`;
    };
    stick.addEventListener('pointerdown', e => { drag = true; mode = 'virtual'; stick.classList.add('on'); const r = stick.getBoundingClientRect(); sx = r.left + r.width / 2; stick.setPointerCapture(e.pointerId); setStick(e.clientX); });
    stick.addEventListener('pointermove', e => { if (drag) setStick(e.clientX); });
    ['pointerup', 'pointercancel'].forEach(t => stick.addEventListener(t, () => { drag = false; rawTilt = 0; stick.querySelector('.roll-stick-nub').style.transform = 'translate(0,0)'; }));

    orientHandler = e => {
      // map the axis to the CURRENT orientation, locked or not (the iOS path)
      const angle = (screen.orientation && screen.orientation.angle) != null ? screen.orientation.angle : Number(window.orientation || 0);
      const source = Math.abs(angle) === 90 ? e.gamma : e.beta;
      if (source == null || mode === 'virtual') return;
      sawOrientation = true;
      if (zero == null) zero = source;              // calibrate on WHATEVER pose she holds
      rawTilt = (source - zero) * (angle === 90 ? -1 : 1);
    };
    if (mode !== 'virtual') window.addEventListener('deviceorientation', orientHandler);
    if (mode !== 'virtual') {
      const wait = setTimeout(() => { if (!sawOrientation) { mode = 'virtual'; stick.classList.add('on'); } }, 1600);
      cleanups.push(() => clearTimeout(wait));
    }

    // ---- render ----
    function draw() {
      const m = sim.mechs;
      const parts = [];
      // fixed geometry
      for (const s of course.segments) {
        if (s.t === 'platform') parts.push(`<rect class="rl-plat${s.catch ? ' catch' : ''}" x="${s.x}" y="${s.y}" width="${s.w}" height="2.2" rx="0.8"/>`);
        else if (s.t === 'ramp') {
          const x2 = s.x + s.w, y2 = s.y - s.w * Math.tan(s.deg * Math.PI / 180);
          parts.push(`<path class="rl-ramp" d="M${s.x} ${s.y} L${x2.toFixed(2)} ${y2.toFixed(2)} L${x2.toFixed(2)} ${(y2 + 2.2).toFixed(2)} L${s.x} ${(s.y + 2.2).toFixed(2)} Z"/>`);
        } else if (s.t === 'wall') parts.push(`<rect class="rl-wall" x="${s.x - 0.7}" y="${s.y - s.h}" width="1.4" height="${s.h}" rx="0.6"/>`);
      }
      // mechanisms
      for (const k of m) {
        const lit = sim.nearestMech() === k ? ' near' : '';
        if (k.t === 'seesaw') {
          const cx = k.x + k.w / 2;
          parts.push(`<g class="rl-seesaw${lit}" transform="rotate(${k.angle.toFixed(1)} ${cx} ${k.y})"><rect x="${k.x}" y="${k.y - 0.9}" width="${k.w}" height="1.8" rx="0.8"/></g>`);
          parts.push(`<path class="rl-pivot" d="M${cx - 1.4} ${k.y + 3} L${cx} ${k.y} L${cx + 1.4} ${k.y + 3} Z"/>`);
        } else if (k.t === 'lift') {
          parts.push(`<rect class="rl-lift${lit}" x="${k.x}" y="${(k.y - k.v).toFixed(2)}" width="${k.w}" height="1.8" rx="0.8"/>`);
          parts.push(`<path class="rl-liftpost" d="M${k.x + k.w / 2} ${k.y + 2} V${(k.y - k.rise).toFixed(2)}"/>`);
        } else if (k.t === 'girder') {
          const flat = k.open, cx = k.x + 0.7, cy = k.y;
          parts.push(`<g class="rl-girder${lit}" transform="rotate(${(90 * flat).toFixed(1)} ${cx} ${cy})"><rect x="${cx - 0.9}" y="${(cy - k.len).toFixed(2)}" width="1.8" height="${k.len}" rx="0.7"/></g>`);
        } else if (k.t === 'gate') {
          parts.push(`<rect class="rl-gate${lit}" x="${k.x - 0.8}" y="${(k.y - k.h * k.open).toFixed(2)}" width="1.6" height="${(k.h * k.open).toFixed(2)}" rx="0.6"/>`);
        }
      }
      // checkpoints, stars, finish
      course.checkpoints.forEach((c, i) => parts.push(`<path class="rl-flag${i <= st.checkpointIdx ? ' hit' : ''}" d="M${c.x} 0 v0"/>`));
      course.stars.forEach((s, i) => { if (!st.stars[i]) parts.push(`<path class="rl-star" d="${starPath(s.x, s.y, 2.1)}"/>`); });
      parts.push(`<g class="rl-finish"><path d="M${course.finish.x} ${course.finish.y} v-6"/><rect x="${course.finish.x}" y="${course.finish.y - 6}" width="4" height="3"/></g>`);
      // the trail at speed, then the ball
      if (!REDUCED) for (let i = 0; i < trail.length; i++) parts.push(`<circle class="rl-trail" cx="${trail[i].x.toFixed(2)}" cy="${trail[i].y.toFixed(2)}" r="${(ROLL.BALL_R * (0.35 + i / trail.length * 0.4)).toFixed(2)}" opacity="${(0.06 + i / trail.length * 0.16).toFixed(2)}"/>`);
      const squash = st.grounded && st._justLanded ? 1 : 0;
      parts.push(`<g class="rl-ball${st.t < st.bonkUntil ? ' dizzy' : ''}${st.t < st.chuteUntil ? ' chute' : ''}" transform="translate(${st.x.toFixed(2)} ${st.y.toFixed(2)}) scale(${(1 + squash * 0.18).toFixed(2)} ${(1 - squash * 0.16).toFixed(2)})">
        <circle r="${ROLL.BALL_R}" fill="${bodyColour()}" stroke="#2A1B4E" stroke-width="0.35"/>
        <circle cx="-0.45" cy="-0.3" r="0.22" fill="#2A1B4E"/><circle cx="0.45" cy="-0.3" r="0.22" fill="#2A1B4E"/>
        <path d="M-0.5 0.35 q0.5 0.5 1 0" fill="none" stroke="#2A1B4E" stroke-width="0.22" stroke-linecap="round"/></g>`);
      if (st.t < st.chuteUntil) parts.push(`<path class="rl-chute" d="M${(st.x - 3).toFixed(2)} ${(st.y - 3).toFixed(2)} a3 3 0 0 1 6 0 z"/>`);
      svg.innerHTML = `<svg viewBox="0 0 ${VB_W} ${VB_H}" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" class="rl-svg">${parts.join('')}</svg>`;
      clock.textContent = (sim.elapsedMs() / 1000).toFixed(1) + 's';
      starChip.textContent = '⭐ ' + st.stars.filter(Boolean).length + '/3';
    }
    function starPath(cx, cy, r) {
      let d = '';
      for (let i = 0; i < 5; i++) {
        const a = i * Math.PI * 0.4 - Math.PI / 2;
        d += (i ? 'L' : 'M') + (cx + Math.cos(a) * r).toFixed(2) + ' ' + (cy + Math.sin(a) * r).toFixed(2);
        d += 'L' + (cx + Math.cos(a + Math.PI / 5) * r * 0.45).toFixed(2) + ' ' + (cy + Math.sin(a + Math.PI / 5) * r * 0.45).toFixed(2);
      }
      return d + 'Z';
    }

    let lastEventCount = 0;
    function drainEvents() {
      for (let i = lastEventCount; i < st.events.length; i++) {
        const e = st.events[i];
        if (e.kind === 'star') { sfx.pop(); const r = stage.getBoundingClientRect(); if (!REDUCED) sparkleAt(r.left + r.width / 2, r.top + r.height / 3); }
        else if (e.kind === 'hop') sfx.tap();
        else if (e.kind === 'bonk') { sfx.oops(); try { haptic('bump'); } catch {} }
        else if (e.kind === 'scrape') { try { haptic('bump'); } catch {} }
        else if (e.kind === 'checkpoint') sfx.correct();
        else if (e.kind === 'finish') finish();
      }
      lastEventCount = st.events.length;
    }

    const frame = () => {
      // the tilt the engine sees: low-passed, dead-zoned, sensitivity + invert applied
      const raw = Math.abs(rawTilt) < DEADZONE ? 0 : rawTilt;
      tilt += (raw - tilt) * LOWPASS;
      const input = { tilt: (invert ? -tilt : tilt) / 22, sens, paddle: paddleHeld, hop: hopQueued };
      hopQueued = false;
      if (!document.hidden && !finished) {
        for (let k = 0; k < 2; k++) sim.step(input);   // 2 engine steps per rAF ≈ 60Hz sim
        if (!REDUCED) { trail.push({ x: st.x, y: st.y }); if (trail.length > 7) trail.shift(); }
        drainEvents();
        draw();
      }
      raf = requestAnimationFrame(frame);
    };
    draw();
    raf = requestAnimationFrame(frame);

    function finish() {
      if (finished) return; finished = true;
      const ms = sim.elapsedMs(), secs = ms / 1000;
      const medal = medalFor(course, secs), picked = st.stars.filter(Boolean).length;
      sfx.star(); if (!REDUCED) confetti({ count: 70, power: 1.1 });
      mutate(s => {
        s.booRoll = s.booRoll || { best: {}, medals: {}, legacy: {} };
        s.booRoll.best = s.booRoll.best || {}; s.booRoll.medals = s.booRoll.medals || {};
        const old = s.booRoll.best[course.key];
        if (!old || ms < old) s.booRoll.best[course.key] = Math.round(ms);
        const rank = { bronze: 1, silver: 2, gold: 3 };
        if (medal && (!s.booRoll.medals[course.key] || rank[medal] > rank[s.booRoll.medals[course.key]])) s.booRoll.medals[course.key] = medal;
      });
      checkAndCelebrate();
      root.appendChild(el('div', { class: 'roll-finish-overlay' }, [
        el('div', { class: 'roll-finish card' }, [
          el('div', { class: 'roll-finish-medal' + (medal ? ' stamp' : ''), text: medal ? MEDAL_ICON[medal] : '🎉' }),
          el('h2', { text: medal ? `${medal[0].toUpperCase() + medal.slice(1)} medal!` : 'Course complete!' }),
          el('p', { text: `${secs.toFixed(1)}s · ⭐ ${picked}/3` })
        ])
      ]));
      setTimeout(() => {
        cleanup();
        ctx.go('results', { game: 'booroll', gameName: 'Boo Roll', stars: medal === 'gold' ? 3 : medal ? 2 : 1, replay: () => ctx.go('booroll', { resume: { course: course.key } }) });
      }, 1800);
    }

    hook({
      onMap: () => false, calibrating: () => false, playing: () => true,
      courseId: () => course.key,
      ball: () => ({ x: st.x, y: st.y, vx: st.vx, vy: st.vy, grounded: st.grounded }),
      state: () => ({ course: course.key, ms: sim.elapsedMs(), stars: st.stars.filter(Boolean).length,
        checkpoint: st.checkpointIdx, finished: st.finished, mode, sawOrientation, bonking: st.t < st.bonkUntil, chuting: st.t < st.chuteUntil }),
      mechs: () => sim.mechs.map(m => ({ t: m.t, x: m.x, angle: m.angle, v: m.v, open: m.open })),
      course: () => course,
      setTilt: tx => { rawTilt = tx * 22; },
      orient: (gamma, beta) => orientHandler && orientHandler({ gamma, beta }),
      stick: dx => { mode = 'virtual'; stick.classList.add('on'); rawTilt = dx / 46 * 22; },
      paddle: on => { paddleHeld = !!on; },
      hop: () => { hopQueued = true; },
      // drive the engine directly for scripted-play evidence (same engine, no rendering race)
      stepWith: (input, frames = 1) => { for (let i = 0; i < frames; i++) sim.step(input); drainEvents(); draw(); return { x: st.x, y: st.y, finished: st.finished }; },
      medal: () => medalFor(course, sim.elapsedMs() / 1000),
      elapsed: () => sim.elapsedMs()
    });
  };

  const resume = params && params.resume && params.resume.course;
  const initial = COURSES.find(c => c.key === resume);
  if (initial && !UNPLAYABLE[initial.key]) calibrate(initial); else goMap();
  return { unmount: cleanup };
}
