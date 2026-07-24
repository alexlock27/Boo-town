// js/games/booroll.js — RUN10 P7/P8 Boo Roll: a side-on, segment-authored course.
import { el, clear, backControl, REDUCED, confetti, sparkleAt } from '../ui.js';
import { getState, mutate } from '../state.js';
import { renderGuide } from '../art.js';
import { sfx, music } from '../sfx.js';
import { checkAndCelebrate } from '../trophies.js';
import { COURSES } from '../../data/courses.js';
import { GRAV, FRICTION, MAX_SPEED, BOUNCE, slopeStep, shouldBonk, buildGround } from './boorollphysics.js';

export { COURSES };
export const COURSE_IDS = COURSES.map(c => c.key);
export const SENS = .85, LOWPASS = .18, DEADZONE = 1.5, BONK_IMPACT = 11, FALL_LIMIT = 260;
export const BONK_MS = 700, CHUTE_MS = 1400, CLOCK_PENALTY = 2500, CAM_LERP = .12, GLOW_DIST = 180;
const W = 1000, H = 580, BASE_Y = 420, BALL_R = 18, SENSOR_WAIT_MS = 1600;
const BODY_HEX = { sunshine: '#FFD166', lilac: '#C6A9F0', sky: '#8FC7FF' };
const MEDAL_ICON = { gold: '🥇', silver: '🥈', bronze: '🥉' };

export function medalFor(course, seconds) {
  if (seconds <= course.parGold) return 'gold';
  if (seconds <= course.parSilver) return 'silver';
  if (seconds <= course.parBronze) return 'bronze';
  return null;
}

export function mount(container, params, ctx) {
  const root = el('div', { class: 'screen booroll roll10' });
  container.appendChild(root);
  let raf = 0, orientHandler = null, cleanups = [];
  const cleanup = () => {
    if (raf) cancelAnimationFrame(raf); raf = 0;
    if (orientHandler) window.removeEventListener('deviceorientation', orientHandler);
    orientHandler = null; cleanups.splice(0).forEach(fn => { try { fn(); } catch {} });
  };
  const bodyColour = () => BODY_HEX[(getState().guide || {}).body] || '#FF7AC6';
  const goMap = () => {
    cleanup(); clear(root); music.play('game');
    const save = getState(); save.booRoll = save.booRoll || { best: {}, medals: {} };
    const map = el('div', { class: 'roll-map card' }, [
      el('div', { class: 'sc-guide', html: renderGuide(save.guide, { view: 'head', size: 88 }) }),
      el('h2', { text: '🎢 Boo Roll' }), el('p', { class: 'sc-intro', text: 'Three big side-roll courses — find the flags and the finish!' })
    ]), grid = el('div', { class: 'roll-course-grid' });
    COURSES.forEach((course, i) => {
      const medal = save.booRoll.medals[course.key], best = save.booRoll.best[course.key];
      grid.appendChild(el('button', { class: 'roll-course-card' + (medal ? ' won' : ''), onclick: () => calibrate(course) }, [
        el('span', { class: 'rcc-num', text: String(i + 1) }), el('span', { class: 'rcc-name', text: course.name }),
        el('span', { class: 'rcc-medal', text: medal ? MEDAL_ICON[medal] : '⚪' }),
        el('span', { class: 'rcc-best', text: best ? (best / 1000).toFixed(1) + 's' : `${course.parGold}s gold` })
      ]));
    });
    map.appendChild(grid); root.append(map, backControl(() => ctx.go('hub'), { floating: true }));
    hook({ courses: () => COURSE_IDS, openCourse: id => { const c = COURSES.find(x => x.key === id); if (c) calibrate(c); }, onMap: () => true });
  };
  const calibrate = course => {
    cleanup(); clear(root);
    const needsPermission = typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function';
    let permission = !needsPermission;
    const panel = el('div', { class: 'roll-calibrate card' }, [el('h2', { text: course.name }), el('p', { class: 'roll-tip', text: 'Hold flat, then lean to roll. The finger puck is always ready too.' })]);
    const go = el('button', { class: 'btn big', text: '✋ Hold flat, then tap GO', onclick: () => play(course, 'sensor') });
    const finger = el('button', { class: 'btn soft', text: '👆 Use finger tilt instead', onclick: () => play(course, 'virtual') });
    if (needsPermission) panel.appendChild(el('button', { class: 'btn', text: '📲 Tap to enable tilt!', onclick: async e => {
      try { permission = await DeviceOrientationEvent.requestPermission() === 'granted'; } catch {}
      e.currentTarget.remove(); panel.append(permission ? go : finger);
    } })); else panel.append(go, finger);
    root.append(panel, backControl(goMap, { floating: true }));
    hook({ onMap: () => false, calibrating: () => true, go: mode => play(course, mode || 'sensor'), useFinger: () => play(course, 'virtual'), permNeeded: () => needsPermission && !permission });
  };
  const play = (course, requestedMode) => {
    cleanup(); clear(root); music.play('game');
    const ground = buildGround(course.segments, BASE_Y);
    let x = 76, y = BASE_Y - BALL_R, vx = 0, vy = 0, spin = 0, camera = 0, rawTilt = 0, tilt = 0;
    let startAt = performance.now(), elapsed = 0, lastAt = startAt, mode = REDUCED ? 'virtual' : requestedMode;
    let zero = null, sawOrientation = false, grounded = true, finished = false, bonking = false, chuteUntil = 0, lastFlag = 76, flagIndex = 0;
    let squash = 0, held = 0, fallStart = y, stars = course.stars.map(() => false), mechanisms = course.mechanisms.map(m => ({ ...m, value: 0 }));
    const canvas = el('canvas', { class: 'roll-canvas', width: W, height: H }), cx = canvas.getContext('2d');
    const strip = el('div', { class: 'roll-progress', 'aria-label': 'Course progress' });
    const clock = el('span', { class: 'roll-clock', text: '0.0s' }), starChip = el('span', { class: 'roll-stars-hud', text: '⭐ 0/3' });
    const hud = el('div', { class: 'roll-hud' }, [clock, starChip]);
    const recenter = el('button', { class: 'roll-recentre', text: '🎯', onclick: () => { zero = null; } });
    const paddleL = el('button', { class: 'roll-paddle left', text: '◀' }), paddleR = el('button', { class: 'roll-paddle right', text: '▶' });
    const stick = el('div', { class: 'roll-stick' + (mode === 'virtual' ? ' on' : '') }, [el('div', { class: 'roll-stick-nub' })]);
    const stage = el('div', { class: 'roll-stage' }, [canvas, strip, hud, recenter, paddleL, paddleR, stick]);
    root.append(stage, backControl(() => { cleanup(); goMap(); }, { floating: true }));
    course.flags.forEach(f => strip.appendChild(el('i', { class: 'roll-progress-flag', style: { left: (f.x / course.world * 100) + '%' } })));
    strip.appendChild(el('i', { class: 'roll-progress-finish', style: { left: (course.finish.x / course.world * 100) + '%' }, text: '🏁' }));
    const dot = el('i', { class: 'roll-progress-dot' }); strip.appendChild(dot);
    const hold = value => e => { held = value; e.preventDefault(); };
    ['pointerdown', 'pointermove'].forEach(type => { paddleL.addEventListener(type, hold(-1)); paddleR.addEventListener(type, hold(1)); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(type => { paddleL.addEventListener(type, () => { if (held < 0) held = 0; }); paddleR.addEventListener(type, () => { if (held > 0) held = 0; }); });
    let drag = false, sx = 0;
    const setStick = px => { rawTilt = clamp((px - sx) / 46, -1.25, 1.25) * 22; stick.querySelector('.roll-stick-nub').style.transform = `translate(${clamp((px - sx), -46, 46)}px,0)`; };
    stick.addEventListener('pointerdown', e => { drag = true; mode = 'virtual'; stick.classList.add('on'); const r = stick.getBoundingClientRect(); sx = r.left + r.width / 2; stick.setPointerCapture(e.pointerId); setStick(e.clientX); });
    stick.addEventListener('pointermove', e => { if (drag) setStick(e.clientX); });
    ['pointerup', 'pointercancel'].forEach(type => stick.addEventListener(type, () => { drag = false; rawTilt = 0; stick.querySelector('.roll-stick-nub').style.transform = 'translate(0,0)'; }));
    orientHandler = e => {
      const orientation = Number(window.orientation || 0); const source = Math.abs(orientation) === 90 ? e.gamma : e.beta;
      if (source == null || mode === 'virtual') return;
      sawOrientation = true; if (zero == null) zero = source;
      rawTilt = (source - zero) * (orientation === 90 ? -1 : 1);
    };
    if (mode !== 'virtual') window.addEventListener('deviceorientation', orientHandler);
    if (mode !== 'virtual') { const wait = setTimeout(() => { if (!sawOrientation) { mode = 'virtual'; stick.classList.add('on'); } }, SENSOR_WAIT_MS); cleanups.push(() => clearTimeout(wait)); }
    const nearbyMechanism = () => mechanisms.find(m => Math.abs(m.x - x) < GLOW_DIST);
    const startBonk = () => {
      if (bonking || finished) return; bonking = true; vx = vy = 0; sfx.oops();
      stage.classList.add('roll-bonk');
      setTimeout(() => { x = lastFlag; y = BASE_Y - 120; fallStart = y; grounded = false; chuteUntil = performance.now() + CHUTE_MS; startAt += CLOCK_PENALTY; stage.classList.remove('roll-bonk'); stage.classList.add('roll-chute'); }, BONK_MS);
      setTimeout(() => { bonking = false; stage.classList.remove('roll-chute'); }, BONK_MS + CHUTE_MS);
    };
    const surfaceAt = px => ground.find(s => s.solid && px >= s.x && px <= s.endX);
    const groundY = seg => seg.y + (seg.endY - seg.y) * ((x - seg.x) / Math.max(1, seg.endX - seg.x));
    const step = dt => {
      elapsed = performance.now() - startAt;
      tilt += ((Math.abs(rawTilt) < DEADZONE ? 0 : rawTilt) - tilt) * LOWPASS;
      const nearby = nearbyMechanism();
      mechanisms.forEach(m => { const active = m === nearby && held; if (m.t === 'seesawPlank') m.value += ((active ? held * 22 : 0) - m.value) * .14; else if (m.t === 'lift') m.value += ((active ? (m.params?.rise || 140) : 0) - m.value) * .08; else if (m.t === 'quarterGirder' && active) m.value = Math.round((m.value + held * 90) / 90) * 90; else if (m.t === 'gateFlap') m.value += ((active ? 1 : 0) - m.value) * .15; });
      if (!bonking) {
        const seg = surfaceAt(x);
        if (grounded && seg) {
          const deg = seg.t === 'slope' ? seg.deg || 0 : 0;
          vx = slopeStep({ vx, tilt: tilt / 22 * SENS, deg, dt });
          x += vx * dt; y = groundY(seg) - BALL_R; vy = 0;
        } else {
          grounded = false; vy += GRAV * dt; x += vx * dt; y += vy * dt;
          const landing = surfaceAt(x);
          if (landing && vy >= 0 && y >= groundY(landing) - BALL_R) { const impact = vy; y = groundY(landing) - BALL_R; grounded = true; squash = 1; vy = 0; if (shouldBonk(impact, y - fallStart)) startBonk(); }
          if (y > BASE_Y + FALL_LIMIT) startBonk();
        }
        if (x < BALL_R || x > course.world - BALL_R) { x = clamp(x, BALL_R, course.world - BALL_R); vx *= -BOUNCE; if (Math.abs(vx) > BONK_IMPACT) startBonk(); }
        const current = surfaceAt(x); if (grounded && !current) { grounded = false; fallStart = y; }
        course.flags.forEach((f, i) => { if (i === flagIndex && x >= f.x) { lastFlag = f.x; flagIndex++; sfx.correct(); } });
        course.stars.forEach((st, i) => { if (!stars[i] && Math.hypot(x - st.x, y - (BASE_Y + st.y)) < 42) { stars[i] = true; sfx.pop(); if (!REDUCED) sparkleAt(canvas.getBoundingClientRect().left + W / 2, canvas.getBoundingClientRect().top + H / 2); } });
        if (x >= course.finish.x) finish();
      }
      spin += Math.abs(vx) * .07 * dt; squash *= .82; camera += (clamp(x - W * .38, 0, course.world - W) - camera) * CAM_LERP;
    };
    const finish = () => {
      if (finished) return; finished = true; sfx.star(); if (!REDUCED) confetti({ count: 70, power: 1.1 });
      const medal = medalFor(course, elapsed / 1000), pickupCount = stars.filter(Boolean).length;
      mutate(s => { s.booRoll = s.booRoll || { best: {}, medals: {}, legacy: {} }; s.booRoll.best = s.booRoll.best || {}; s.booRoll.medals = s.booRoll.medals || {}; const old = s.booRoll.best[course.key]; if (!old || elapsed < old) s.booRoll.best[course.key] = Math.round(elapsed); const rank = { bronze: 1, silver: 2, gold: 3 }; if (medal && (!s.booRoll.medals[course.key] || rank[medal] > rank[s.booRoll.medals[course.key]])) s.booRoll.medals[course.key] = medal; });
      checkAndCelebrate();
      root.appendChild(el('div', { class: 'roll-finish-overlay' }, [el('div', { class: 'roll-finish card' }, [el('div', { class: 'roll-finish-medal', text: medal ? MEDAL_ICON[medal] : '🎉' }), el('h2', { text: medal ? `${medal[0].toUpperCase() + medal.slice(1)} medal!` : 'Course complete!' }), el('p', { text: `${(elapsed / 1000).toFixed(1)}s · ⭐ ${pickupCount}/3` })]) ]));
      setTimeout(() => { cleanup(); ctx.go('results', { game: 'booroll', gameName: 'Boo Roll', stars: medal === 'gold' ? 3 : medal ? 2 : 1, replay: () => ctx.go('booroll', { resume: { course: course.key } }) }); }, 1800);
    };
    function draw() {
      cx.fillStyle = '#7fd8f3'; cx.fillRect(0, 0, W, H); cx.fillStyle = '#b8edff'; cx.fillRect(0, 315, W, 120);
      cx.save(); cx.translate(-camera, 0);
      ground.forEach(seg => { if (!seg.solid) return; cx.beginPath(); cx.moveTo(seg.x, seg.y); cx.lineTo(seg.endX, seg.endY); cx.lineTo(seg.endX, H); cx.lineTo(seg.x, H); cx.closePath(); cx.fillStyle = seg.t === 'platform' ? '#8b61b5' : '#69b64a'; cx.fill(); cx.strokeStyle = '#355d36'; cx.lineWidth = 5; cx.stroke(); });
      mechanisms.forEach(m => drawMechanism(cx, m, x, nearbyMechanism() === m));
      course.flags.forEach((f, i) => drawFlag(cx, f.x, BASE_Y - 20, i < flagIndex));
      course.stars.forEach((st, i) => { if (!stars[i]) drawStar(cx, st.x, BASE_Y + st.y, 15); });
      drawFlag(cx, course.finish.x, BASE_Y - 22, true, true); drawBall(cx, x, y, spin, bodyColour(), squash); cx.restore();
      dot.style.left = (x / course.world * 100) + '%'; clock.textContent = (elapsed / 1000).toFixed(1) + 's'; starChip.textContent = '⭐ ' + stars.filter(Boolean).length + '/3';
    }
    const frame = now => { const dt = Math.min(2, (now - lastAt) / 16.67); lastAt = now; step(dt); draw(); raf = requestAnimationFrame(frame); }; raf = requestAnimationFrame(frame);
    const ro = new ResizeObserver(() => { const r = stage.getBoundingClientRect(), scale = Math.min(r.width / W, r.height / H); canvas.style.width = W * scale + 'px'; canvas.style.height = H * scale + 'px'; }); ro.observe(stage); cleanups.push(() => ro.disconnect());
    hook({ onMap: () => false, playing: () => true, courseId: () => course.key, ball: () => ({ x, y, vx, vy }), state: () => ({ course: course.key, ms: Math.round(elapsed), stars: stars.filter(Boolean).length, flagHit: flagIndex > 0, finished, mode, sawOrientation, grounded, bonking }), field: () => ({ FW: course.world, FH: H, course }), setTilt: tx => { rawTilt = tx * 22; }, orient: (gamma, beta) => orientHandler && orientHandler({ gamma, beta }), stick: dx => { mode = 'virtual'; stick.classList.add('on'); rawTilt = dx / 46 * 22; }, teleport: (px, py = BASE_Y - BALL_R) => { x = px; y = py; vx = vy = 0; }, grabFlag: () => { lastFlag = course.flags[Math.min(flagIndex, course.flags.length - 1)].x; flagIndex = course.flags.length; }, forceFinish: () => { x = course.finish.x; }, paddle: side => { held = side; }, medal: () => medalFor(course, elapsed / 1000) });
  };
  const hook = values => { if (typeof window !== 'undefined') window.__booroll = Object.assign(window.__booroll || {}, values); };
  const resume = params?.resume?.course, initial = COURSES.find(c => c.key === resume); if (initial) calibrate(initial); else goMap();
  return { unmount: cleanup };
}
function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
function drawStar(cx, x, y, r) { cx.save(); cx.translate(x, y); cx.beginPath(); for (let i = 0; i < 5; i++) { const a = i * Math.PI * .4 - Math.PI / 2; cx.lineTo(Math.cos(a) * r, Math.sin(a) * r); cx.lineTo(Math.cos(a + Math.PI / 5) * r * .45, Math.sin(a + Math.PI / 5) * r * .45); } cx.closePath(); cx.fillStyle = '#ffc93c'; cx.fill(); cx.strokeStyle = '#5a3e20'; cx.stroke(); cx.restore(); }
function drawFlag(cx, x, y, hit, finish = false) { cx.save(); cx.translate(x, y); cx.strokeStyle = '#34254d'; cx.lineWidth = 4; cx.beginPath(); cx.moveTo(0, 25); cx.lineTo(0, -28); cx.stroke(); cx.fillStyle = finish ? '#fff' : hit ? '#35d0ba' : '#ff7ac6'; cx.fillRect(0, -28, 28, 17); if (finish) { cx.fillStyle = '#34254d'; cx.fillRect(0, -28, 14, 8); cx.fillRect(14, -20, 14, 8); } cx.restore(); }
function drawBall(cx, x, y, spin, col, squash) { cx.save(); cx.translate(x, y); cx.scale(1 + squash * .16, 1 - squash * .14); cx.beginPath(); cx.arc(0, 0, BALL_R, 0, Math.PI * 2); cx.fillStyle = col; cx.fill(); cx.lineWidth = 3; cx.strokeStyle = '#34254d'; cx.stroke(); cx.save(); cx.rotate(spin); cx.beginPath(); cx.arc(0, 0, 11, -.5, .8); cx.strokeStyle = 'rgba(255,255,255,.7)'; cx.lineWidth = 3; cx.stroke(); cx.restore(); cx.fillStyle = '#34254d'; cx.beginPath(); cx.arc(-6, -3, 2.5, 0, Math.PI * 2); cx.arc(6, -3, 2.5, 0, Math.PI * 2); cx.fill(); cx.beginPath(); cx.arc(0, 3, 5, .15 * Math.PI, .85 * Math.PI); cx.stroke(); cx.restore(); }
function drawMechanism(cx, m, ballX, nearby) { const y = BASE_Y; cx.save(); cx.translate(m.x, y); if (nearby) { cx.beginPath(); cx.arc(0, -26, 56, 0, Math.PI * 2); cx.fillStyle = 'rgba(255,209,102,.3)'; cx.fill(); } cx.strokeStyle = '#34254d'; cx.lineWidth = 6; cx.fillStyle = '#ffab63'; if (m.t === 'seesawPlank') { cx.rotate(m.value * Math.PI / 180); cx.fillRect(-65, -8, 130, 16); cx.beginPath(); cx.moveTo(0, 0); cx.lineTo(-15, 28); cx.lineTo(15, 28); cx.closePath(); cx.fill(); } else if (m.t === 'lift') { cx.fillRect(-45, -m.value - 10, 90, 18); cx.strokeRect(-45, -m.value - 10, 90, 18); } else if (m.t === 'quarterGirder') { cx.rotate(m.value * Math.PI / 180); cx.fillRect(-10, -70, 20, 70); } else { cx.fillStyle = m.value > .5 ? '#78d35f' : '#ef6d6d'; cx.fillRect(-14, -54, 28, 54); } cx.restore(); }
