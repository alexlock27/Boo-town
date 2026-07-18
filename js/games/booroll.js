// RUN10 P7 — Boo Roll 2.0: side-view rolling physics and input.
// P8's three authored courses are deliberately not included yet. This packet ships one
// compact Crash Course so the physics, mechanisms, tilt and fallback can be reviewed first.

import { el, clear, backControl, REDUCED, confetti, sparkleAt } from '../ui.js';
import { getState, mutate } from '../state.js';
import { renderGuide } from '../art.js';
import { sfx, music } from '../sfx.js';

export const GRAV = 0.55;
export const SENS = 0.85;
export const FRICTION = 0.985;
export const BOUNCE = 0.45;
export const MAX_SPEED = 15;
export const LOWPASS = 0.18;
export const DEADZONE = 1.5;
export const BONK_IMPACT = 11;
export const FALL_LIMIT = 260;
export const BONK_MS = 700;
export const CHUTE_MS = 1400;
export const CLOCK_PENALTY = 2500;
export const CAM_LERP = 0.12;
export const GLOW_DIST = 180;
export const SENSOR_WAIT_MS = 1600;

const VIEW_W = 1000, VIEW_H = 600, BALL_R = 24;
const FLOOR_Y = 440;
const BODY_HEX = { sunshine: '#FFD166', lilac: '#C6A9F0', sky: '#8FC7FF' };

// P7 review blueprint. P8 will replace course data with data/courses.js and medals.
export const CRASH_COURSE = {
  id: 'crash', name: 'Crash Course', world: 3900, finish: 3750,
  segments: [
    { t: 'flat', x1: 0, x2: 650, y1: 440, y2: 440 },
    { t: 'slope', x1: 650, x2: 920, y1: 440, y2: 360 },
    { t: 'mechanism', mechanism: 'seesaw', x1: 920, x2: 1220, y1: 385, y2: 385 },
    { t: 'flat', x1: 1220, x2: 1450, y1: 410, y2: 410 },
    { t: 'gap', x1: 1450, x2: 1600 },
    { t: 'flat', x1: 1600, x2: 1920, y1: 440, y2: 440 },
    { t: 'mechanism', mechanism: 'girder', x1: 1920, x2: 2130, y1: 420, y2: 420 },
    { t: 'flat', x1: 2130, x2: 2320, y1: 440, y2: 440 },
    { t: 'mechanism', mechanism: 'lift', x1: 2320, x2: 2700, y1: 440, y2: 440 },
    { t: 'platform', x1: 2700, x2: 2950, y1: 260, y2: 260 },
    { t: 'slope', x1: 2950, x2: 3450, y1: 260, y2: 550 },
    { t: 'flat', x1: 3450, x2: 3900, y1: 550, y2: 550 }
  ],
  mechanisms: [
    { t: 'seesawPlank', x: 1070 },
    { t: 'quarterGirder', x: 2025 },
    { t: 'lift', x: 2510 },
    { t: 'gateFlap', x: 3190 }
  ],
  stars: [{ x: 760, y: 330 }, { x: 1740, y: 390 }, { x: 2820, y: 245 }],
  flags: [{ x: 1320 }, { x: 2760 }]
};

export function mount(container, params, ctx) {
  const root = el('div', { class: 'screen booroll2' });
  container.appendChild(root);
  let cleanup = () => {};
  showStart();

  function showStart() {
    cleanup();
    clear(root);
    music.play('game');
    const state = getState();
    const sensitivity = Number(state.settings.rollSensitivity) || 1;
    const card = el('div', { class: 'roll2-start card' }, [
      el('div', { class: 'roll2-guide', html: renderGuide(state.guide, { view: 'full', size: 120 }) }),
      el('div', { class: 'roll2-start-copy' }, [
        el('h2', { text: 'Boo Roll: Crash Course' }),
        el('p', { text: 'Roll across slopes, gaps and moving contraptions. No lives, no losing — a bonk just parachutes you back.' })
      ])
    ]);
    const sensitivityValue = el('strong', { text: `${sensitivity.toFixed(1)}×` });
    const slider = el('input', {
      type: 'range', min: '0.5', max: '1.5', step: '0.1', value: String(sensitivity),
      'aria-label': 'Tilt sensitivity',
      oninput: e => {
        sensitivityValue.textContent = `${Number(e.target.value).toFixed(1)}×`;
        mutate(s => { s.settings.rollSensitivity = Number(e.target.value); });
      }
    });
    const invert = el('input', {
      type: 'checkbox',
      checked: state.settings.rollInvert ? '' : undefined,
      onchange: e => mutate(s => { s.settings.rollInvert = !!e.target.checked; })
    });
    const settings = el('div', { class: 'roll2-settings' }, [
      el('label', {}, [el('span', { text: 'Tilt sensitivity ' }), sensitivityValue, slider]),
      el('label', { class: 'roll2-invert' }, [invert, el('span', { text: 'Invert tilt' })])
    ]);
    const go = el('button', {
      class: 'btn big roll2-go',
      text: '✋ Hold flat, then GO',
      onclick: () => startPermissionFlow(false)
    });
    const finger = el('button', {
      class: 'btn soft',
      text: '👆 Use finger tilt',
      onclick: () => beginPlay('virtual')
    });
    card.append(settings, el('div', { class: 'roll2-start-actions' }, [go, finger]));
    root.append(card, backControl(() => ctx.go('hub'), { floating: true }));
    window.__booroll = {
      onMap: () => false,
      calibrating: () => true,
      courses: () => [CRASH_COURSE.id],
      go: mode => beginPlay(mode || 'virtual'),
      useFinger: () => beginPlay('virtual'),
      constants: () => ({ GRAV, SENS, FRICTION, BOUNCE, MAX_SPEED, LOWPASS, DEADZONE, BONK_IMPACT, FALL_LIMIT, BONK_MS, CHUTE_MS, CLOCK_PENALTY, CAM_LERP, GLOW_DIST })
    };
  }

  async function startPermissionFlow() {
    const Orientation = globalThis.DeviceOrientationEvent;
    if (Orientation && typeof Orientation.requestPermission === 'function') {
      try {
        const answer = await Orientation.requestPermission();
        beginPlay(answer === 'granted' ? 'sensor' : 'virtual');
      } catch {
        beginPlay('virtual');
      }
    } else {
      beginPlay('sensor');
    }
  }

  function beginPlay(initialMode) {
    cleanup();
    clear(root);
    music.play('game');

    const course = CRASH_COURSE;
    const guide = getState().guide || {};
    const ballColour = BODY_HEX[guide.body] || '#FF7AC6';
    const canvas = el('canvas', { class: 'roll2-canvas', width: VIEW_W, height: VIEW_H });
    const cx = canvas.getContext('2d');
    const progress = el('div', { class: 'roll2-progress' }, [
      el('span', { class: 'roll2-progress-fill' }),
      ...course.flags.map(f => el('i', { class: 'roll2-flag-tick', style: { left: `${f.x / course.world * 100}%` } })),
      el('i', { class: 'roll2-finish-tick', text: '🏁' }),
      el('i', { class: 'roll2-ball-dot' })
    ]);
    const clock = el('span', { class: 'roll2-clock', text: '0.0s' });
    const starChip = el('span', { class: 'roll2-star-chip', text: '⭐ 0' });
    const recentre = el('button', { class: 'roll2-recentre', 'aria-label': 'Re-centre tilt', text: '🎯' });
    const debug = new URLSearchParams(location.search).has('tilt')
      ? el('pre', { class: 'roll2-debug' })
      : null;
    const toast = el('div', { class: 'roll2-toast' });
    const paddleLeft = el('button', { class: 'roll2-paddle left', text: '◀', 'aria-label': 'Left mechanism paddle' });
    const paddleRight = el('button', { class: 'roll2-paddle right', text: '▶', 'aria-label': 'Right mechanism paddle' });
    const stick = el('div', { class: `roll2-stick${initialMode === 'virtual' || REDUCED ? ' on' : ''}` }, [
      el('div', { class: 'roll2-stick-nub' })
    ]);
    const stage = el('div', { class: 'roll2-stage' }, [
      canvas, progress, clock, starChip, recentre, paddleLeft, paddleRight, stick,
      ...(debug ? [debug] : []), toast
    ]);
    root.append(stage, backControl(() => showStart(), { floating: true }));
    let viewSpan = VIEW_W;
    const fitCanvas = () => {
      const r = stage.getBoundingClientRect();
      if (!r.width || !r.height) return;
      viewSpan = clamp(VIEW_H * r.width / r.height, 240, VIEW_W);
      canvas.width = Math.round(viewSpan);
      canvas.height = VIEW_H;
    };
    const canvasObserver = new ResizeObserver(fitCanvas);
    canvasObserver.observe(stage);
    fitCanvas();

    let bx = 100, by = FLOOR_Y - BALL_R, vx = 0, vy = 0, spin = 0;
    let onGround = true, camera = 0;
    let state = 'normal', stateMs = 0, chuteStartY = 0;
    let lastFlag = { x: 100, y: FLOOR_Y - BALL_R }, flagIdx = -1;
    let elapsed = 0, penalty = 0, finished = false;
    let stars = course.stars.map(() => false);
    let rawTilt = 0, filteredTilt = 0, zeroTilt = null;
    let usingVirtual = initialMode === 'virtual' || REDUCED;
    let sawOrientation = false;
    let paddle = 0, girderTurns = 0, liftY = 0;
    let seesawAngle = 0;
    let gateOpen = false;
    let raf = 0, lastNow = performance.now();
    let sensorTimer = 0;
    let stickDown = false, stickCenter = 0;

    const orientation = e => {
      const angle = Number(screen.orientation && screen.orientation.angle != null
        ? screen.orientation.angle
        : globalThis.orientation || 0);
      const landscape = Math.abs(angle) === 90;
      const source = landscape ? Number(e.gamma || 0) : Number(e.beta || 0);
      const sign = angle === -90 || angle === 270 ? -1 : 1;
      sawOrientation = true;
      if (zeroTilt == null) zeroTilt = source;
      rawTilt = (source - zeroTilt) * sign;
      if (!usingVirtual) stick.classList.remove('on');
    };
    if (!usingVirtual) {
      window.addEventListener('deviceorientation', orientation);
      sensorTimer = setTimeout(() => {
        if (!sawOrientation) {
          usingVirtual = true;
          stick.classList.add('on');
          showToast('No tilt signal — finger tilt is ready!');
        }
      }, SENSOR_WAIT_MS);
    }

    recentre.onclick = () => { zeroTilt = null; rawTilt = 0; filteredTilt = 0; sfx.tap(); };
    bindPaddle(paddleLeft, -1);
    bindPaddle(paddleRight, 1);
    bindStick();

    function bindPaddle(button, dir) {
      button.addEventListener('pointerdown', e => {
        e.preventDefault();
        paddle = dir;
        gateOpen = true;
        girderTurns = (girderTurns + 1) % 4;
        button.classList.add('held');
        button.setPointerCapture(e.pointerId);
      });
      const up = () => { paddle = 0; gateOpen = false; button.classList.remove('held'); };
      button.addEventListener('pointerup', up);
      button.addEventListener('pointercancel', up);
    }

    function bindStick() {
      const nub = stick.querySelector('.roll2-stick-nub');
      stick.addEventListener('pointerdown', e => {
        usingVirtual = true; stick.classList.add('on'); stickDown = true;
        const r = stick.getBoundingClientRect();
        stickCenter = r.left + r.width / 2;
        stick.setPointerCapture(e.pointerId);
        setVirtual(e.clientX - stickCenter);
      });
      stick.addEventListener('pointermove', e => { if (stickDown) setVirtual(e.clientX - stickCenter); });
      const up = () => { stickDown = false; rawTilt = 0; nub.style.transform = 'translateX(0)'; };
      stick.addEventListener('pointerup', up);
      stick.addEventListener('pointercancel', up);
      function setVirtual(dx) {
        const clamped = clamp(dx, -46, 46);
        rawTilt = clamped / 46 * 18;
        nub.style.transform = `translateX(${clamped}px)`;
      }
    }

    function showToast(text) {
      toast.textContent = text;
      toast.classList.remove('show'); void toast.offsetWidth; toast.classList.add('show');
    }

    function terrainAt(x) {
      const seg = course.segments.find(s => x >= s.x1 && x <= s.x2);
      if (!seg || seg.t === 'gap') return null;
      if (seg.mechanism === 'seesaw') {
        const mid = (seg.x1 + seg.x2) / 2;
        return seg.y1 + (x - mid) * Math.tan(seesawAngle * Math.PI / 180);
      }
      if (seg.mechanism === 'lift') return seg.y1 - liftY;
      if (seg.mechanism === 'girder' && girderTurns % 2 === 1) return null;
      const t = (x - seg.x1) / Math.max(1, seg.x2 - seg.x1);
      return seg.y1 + (seg.y2 - seg.y1) * t;
    }

    function slopeAt(x) {
      const seg = course.segments.find(s => x >= s.x1 && x <= s.x2);
      if (!seg || seg.t === 'gap') return 0;
      if (seg.mechanism === 'seesaw') return seesawAngle;
      return Math.atan2(seg.y2 - seg.y1, seg.x2 - seg.x1) * 180 / Math.PI;
    }

    function step(ms) {
      if (finished) return;
      const dt = clamp(ms / 16.667, 0, 2.2);
      elapsed += ms;
      seesawAngle += ((paddle ? paddle * 22 : 0) - seesawAngle) * (paddle ? .12 : .07) * dt;
      liftY += ((paddle ? 140 : 0) - liftY) * (paddle ? .08 : .045) * dt;

      if (state === 'bonk') {
        stateMs += ms;
        if (stateMs >= BONK_MS) {
          state = 'chute'; stateMs = 0;
          bx = lastFlag.x; chuteStartY = lastFlag.y - 120; by = chuteStartY; vx = 0; vy = 0;
        }
        return;
      }
      if (state === 'chute') {
        stateMs += ms;
        const p = clamp(stateMs / CHUTE_MS, 0, 1);
        bx = lastFlag.x + Math.sin(p * Math.PI * 4) * 12;
        by = chuteStartY + (lastFlag.y - chuteStartY) * easeOut(p);
        if (p >= 1) { state = 'normal'; stateMs = 0; onGround = true; }
        return;
      }

      const setting = getState().settings || {};
      const sensitivity = Number(setting.rollSensitivity) || 1;
      const inverted = setting.rollInvert ? -1 : 1;
      const target = Math.abs(rawTilt) <= DEADZONE ? 0 : clamp(rawTilt / 18, -1, 1);
      filteredTilt += (target - filteredTilt) * LOWPASS * dt;
      const tiltAcc = filteredTilt * SENS * sensitivity * inverted;
      const groundBefore = terrainAt(bx);
      const slope = onGround ? slopeAt(bx) : 0;
      vx += (tiltAcc + GRAV * Math.sin(slope * Math.PI / 180)) * dt;
      // A slope should feel like it releases the ball; use the same named rolling
      // friction with a gentler per-frame application while gravity is doing work.
      const rollingFriction = onGround && Math.abs(slope) > 1 ? Math.pow(FRICTION, .4) : FRICTION;
      vx *= Math.pow(rollingFriction, dt);
      vx = clamp(vx, -MAX_SPEED, MAX_SPEED);
      if (!onGround) vy += GRAV * dt;
      bx += vx * dt;
      by += vy * dt;
      spin += vx * .035 * dt;

      if (bx < BALL_R) { bx = BALL_R; vx = Math.abs(vx) * BOUNCE; }
      const ground = terrainAt(bx);
      // While already rolling, follow a descending surface instead of treating each
      // sub-pixel drop as a jump. Genuine gaps still return null and launch the ball.
      const followsSurface = onGround && ground != null && by + BALL_R >= ground - 8;
      if (ground != null && (followsSurface || (by + BALL_R >= ground && vy >= -2))) {
        const wasAir = !onGround;
        by = ground - BALL_R; vy = 0; onGround = true;
        if (wasAir) stage.classList.add('landed'), setTimeout(() => stage.classList.remove('landed'), 180);
      } else if (ground == null || groundBefore == null || by + BALL_R < ground - 2) {
        onGround = false;
      }

      // Closed gate and vertical quarter-girder behave as bonkable walls.
      if ((!gateOpen && bx > 3160 && bx < 3215) || (girderTurns % 2 === 0 && bx > 1998 && bx < 2045 && by > 280)) {
        const impact = Math.abs(vx);
        bx = vx >= 0 ? (girderTurns % 2 === 0 && bx < 2200 ? 1970 : 3130) : bx + 35;
        vx = -vx * BOUNCE;
        if (impact > BONK_IMPACT) bonk();
        else sfx.tap();
      }
      if (by > VIEW_H + FALL_LIMIT || bx > course.world + 80) bonk();

      course.flags.forEach((flag, i) => {
        if (i > flagIdx && bx >= flag.x) {
          flagIdx = i;
          const gy = terrainAt(flag.x) || FLOOR_Y;
          lastFlag = { x: flag.x, y: gy - BALL_R };
          sfx.correct();
        }
      });
      course.stars.forEach((star, i) => {
        if (!stars[i] && Math.hypot(bx - star.x, by - star.y) < 52) {
          stars[i] = true; sfx.star();
          const r = canvas.getBoundingClientRect();
          sparkleAt(r.left + (star.x - camera) / viewSpan * r.width, r.top + star.y / VIEW_H * r.height);
        }
      });
      if (bx >= course.finish) finish();
      camera += (clamp(bx - viewSpan * .32, 0, course.world - viewSpan) - camera) * CAM_LERP * dt;
    }

    function bonk() {
      if (state !== 'normal') return;
      state = 'bonk'; stateMs = 0; penalty += CLOCK_PENALTY;
      vx = 0; vy = 0; sfx.oops();
      showToast('+2.5s — parachute rescue!');
    }

    function finish() {
      finished = true;
      sfx.fanfare();
      if (!REDUCED) confetti({ count: 80, power: 1 });
      const seconds = (elapsed + penalty) / 1000;
      const card = el('div', { class: 'roll2-finish-card card' }, [
        el('div', { class: 'roll2-ribbon', text: '🎀 🏁 🎀' }),
        el('h2', { text: 'Crash Course cleared!' }),
        el('strong', { class: 'roll2-finish-time', text: `${seconds.toFixed(1)}s` }),
        el('p', { text: `⭐ ${stars.filter(Boolean).length}/3` }),
        el('button', { class: 'btn big', text: 'See results', onclick: () => ctx.go('results', {
          game: 'booroll', gameName: 'Boo Roll', stars: Math.max(1, stars.filter(Boolean).length),
          replay: () => ctx.go('booroll')
        }) })
      ]);
      root.appendChild(el('div', { class: 'roll2-finish-overlay' }, [card]));
    }

    function draw() {
      cx.clearRect(0, 0, viewSpan, VIEW_H);
      const sky = cx.createLinearGradient(0, 0, 0, VIEW_H);
      sky.addColorStop(0, '#78C9F2'); sky.addColorStop(1, '#DDF6FF');
      cx.fillStyle = sky; cx.fillRect(0, 0, viewSpan, VIEW_H);
      drawClouds();
      cx.save();
      cx.translate(-camera, 0);
      drawTerrain();
      drawMechanisms();
      drawFlagsAndStars();
      drawFinish();
      drawBooBall();
      cx.restore();

      const total = (elapsed + penalty) / 1000;
      clock.textContent = `${total.toFixed(1)}s`;
      starChip.textContent = `⭐ ${stars.filter(Boolean).length}`;
      const pct = clamp(bx / course.finish * 100, 0, 100);
      progress.querySelector('.roll2-progress-fill').style.width = `${pct}%`;
      progress.querySelector('.roll2-ball-dot').style.left = `${pct}%`;
      if (debug) debug.textContent = `raw ${rawTilt.toFixed(2)}°\nfiltered ${filteredTilt.toFixed(3)}\n${usingVirtual ? 'finger' : 'sensor'}`;
    }

    function drawClouds() {
      cx.fillStyle = 'rgba(255,255,255,.65)';
      for (let i = 0; i < 5; i++) {
        const x = ((i * 260 - camera * .18) % 1300) - 120;
        cx.beginPath(); cx.ellipse(x, 95 + (i % 2) * 60, 70, 22, 0, 0, Math.PI * 2); cx.fill();
      }
    }

    function drawTerrain() {
      for (const seg of course.segments) {
        if (seg.t === 'gap' || seg.mechanism) continue;
        cx.beginPath();
        cx.moveTo(seg.x1, seg.y1);
        cx.lineTo(seg.x2, seg.y2);
        cx.lineTo(seg.x2, VIEW_H + 80);
        cx.lineTo(seg.x1, VIEW_H + 80);
        cx.closePath();
        cx.fillStyle = seg.t === 'platform' ? '#B990D7' : '#70C85B';
        cx.fill();
        cx.lineWidth = 7; cx.strokeStyle = '#2A1B4E';
        cx.beginPath(); cx.moveTo(seg.x1, seg.y1); cx.lineTo(seg.x2, seg.y2); cx.stroke();
      }
    }

    function near(x) { return Math.abs(bx - x) <= GLOW_DIST; }

    function drawMechanisms() {
      // Seesaw
      cx.save(); cx.translate(1070, 385); cx.rotate(seesawAngle * Math.PI / 180);
      if (near(1070)) { cx.shadowColor = '#FFC93C'; cx.shadowBlur = 22; }
      roundedRect(cx, -150, -12, 300, 24, 10, '#FF9F68');
      cx.restore();
      roundedRect(cx, 1052, 385, 36, 58, 8, '#6B4BA8');

      // Quarter girder
      cx.save(); cx.translate(2025, 420); cx.rotate((girderTurns % 4) * Math.PI / 2);
      if (near(2025)) { cx.shadowColor = '#FFC93C'; cx.shadowBlur = 22; }
      roundedRect(cx, -105, -12, 210, 24, 8, '#8FC7FF');
      cx.restore();

      // Lift
      const ly = 440 - liftY;
      cx.save();
      if (near(2510)) { cx.shadowColor = '#FFC93C'; cx.shadowBlur = 22; }
      roundedRect(cx, 2320, ly - 18, 380, 24, 8, '#35D0BA');
      cx.restore();
      cx.strokeStyle = '#6B4BA8'; cx.lineWidth = 7;
      cx.beginPath(); cx.moveTo(2350, 445); cx.lineTo(2350, ly); cx.moveTo(2670, 445); cx.lineTo(2670, ly); cx.stroke();

      // Gate
      cx.save(); cx.translate(3190, 440); cx.rotate(gateOpen ? -Math.PI / 2 : 0);
      if (near(3190)) { cx.shadowColor = '#FFC93C'; cx.shadowBlur = 22; }
      roundedRect(cx, -10, -145, 20, 145, 6, '#FF7AC6');
      cx.restore();
    }

    function drawFlagsAndStars() {
      course.flags.forEach((flag, i) => {
        const y = (terrainAt(flag.x) || FLOOR_Y);
        cx.strokeStyle = '#2A1B4E'; cx.lineWidth = 4;
        cx.beginPath(); cx.moveTo(flag.x, y); cx.lineTo(flag.x, y - 82); cx.stroke();
        cx.fillStyle = i <= flagIdx ? '#35D0BA' : '#FF7AC6';
        cx.beginPath(); cx.moveTo(flag.x, y - 82); cx.lineTo(flag.x + 42, y - 68); cx.lineTo(flag.x, y - 52); cx.fill();
      });
      course.stars.forEach((star, i) => {
        if (stars[i]) return;
        drawStar(cx, star.x, star.y, 18);
      });
    }

    function drawFinish() {
      const x = course.finish, y = terrainAt(x) || FLOOR_Y;
      cx.strokeStyle = '#2A1B4E'; cx.lineWidth = 7;
      cx.beginPath(); cx.moveTo(x, y); cx.lineTo(x, y - 150); cx.stroke();
      for (let row = 0; row < 5; row++) for (let col = 0; col < 4; col++) {
        cx.fillStyle = (row + col) % 2 ? '#fff' : '#2A1B4E';
        cx.fillRect(x + col * 18, y - 150 + row * 18, 18, 18);
      }
    }

    function drawBooBall() {
      cx.save();
      cx.translate(bx, by);
      if (state === 'bonk') cx.rotate(Math.sin(stateMs / 45) * .2);
      if (state === 'chute') {
        cx.fillStyle = '#FF7AC6'; cx.strokeStyle = '#2A1B4E'; cx.lineWidth = 3;
        cx.beginPath(); cx.arc(0, -48, 34, Math.PI, 0); cx.closePath(); cx.fill(); cx.stroke();
        cx.beginPath(); cx.moveTo(-32, -48); cx.lineTo(-10, -20); cx.moveTo(32, -48); cx.lineTo(10, -20); cx.stroke();
      }
      cx.rotate(spin);
      cx.beginPath(); cx.arc(0, 0, BALL_R, 0, Math.PI * 2);
      cx.fillStyle = ballColour; cx.fill(); cx.strokeStyle = '#2A1B4E'; cx.lineWidth = 4; cx.stroke();
      cx.fillStyle = '#2A1B4E';
      cx.beginPath(); cx.arc(-7, -4, 3, 0, Math.PI * 2); cx.arc(7, -4, 3, 0, Math.PI * 2); cx.fill();
      cx.beginPath(); cx.arc(0, 5, 7, .1 * Math.PI, .9 * Math.PI); cx.stroke();
      cx.restore();
      if (state === 'bonk') {
        cx.fillStyle = '#FFC93C'; cx.font = '25px sans-serif';
        cx.fillText('★', bx - 30, by - 38); cx.fillText('★', bx + 14, by - 45);
      }
    }

    function frame(now) {
      const ms = Math.min(38, now - lastNow);
      lastNow = now;
      step(ms);
      draw();
      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    window.__booroll = {
      playing: () => true,
      courseId: () => course.id,
      ball: () => ({ x: bx, y: by, vx, vy, onGround }),
      state: () => ({ phase: state, elapsed, penalty, stars: stars.filter(Boolean).length, flagIdx, finished, mode: usingVirtual ? 'virtual' : 'sensor', rawTilt, filteredTilt }),
      field: () => ({ VIEW_W: viewSpan, VIEW_H, course }),
      constants: () => ({ GRAV, SENS, FRICTION, BOUNCE, MAX_SPEED, LOWPASS, DEADZONE, BONK_IMPACT, FALL_LIMIT, BONK_MS, CHUTE_MS, CLOCK_PENALTY, CAM_LERP, GLOW_DIST }),
      setTilt: v => { usingVirtual = true; rawTilt = v * 18; },
      orient: (gamma, beta) => orientation({ gamma, beta }),
      recentre: () => { zeroTilt = null; rawTilt = 0; filteredTilt = 0; },
      step: ms => step(ms),
      teleport: (x, y = (terrainAt(x) || FLOOR_Y) - BALL_R) => { bx = x; by = y; vx = 0; vy = 0; onGround = terrainAt(x) != null; },
      velocity: v => { vx = v; },
      holdPaddle: dir => { paddle = dir; gateOpen = !!dir; if (dir) girderTurns = (girderTurns + 1) % 4; },
      releasePaddle: () => { paddle = 0; gateOpen = false; },
      mechanisms: () => ({ seesawAngle, liftY, girderTurns, gateOpen }),
      forceBonk: () => bonk(),
      forceFinish: () => { bx = course.finish; finish(); },
      terrainAt,
      progressBox: () => progress.getBoundingClientRect(),
      glowNear: x => Math.abs(bx - x) <= GLOW_DIST
    };

    cleanup = () => {
      cancelAnimationFrame(raf);
      clearTimeout(sensorTimer);
      canvasObserver.disconnect();
      window.removeEventListener('deviceorientation', orientation);
    };
  }

  return { unmount() { cleanup(); } };
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
function roundedRect(cx, x, y, w, h, r, fill) {
  cx.beginPath(); cx.roundRect(x, y, w, h, r); cx.fillStyle = fill; cx.fill(); cx.strokeStyle = '#2A1B4E'; cx.lineWidth = 4; cx.stroke();
}
function drawStar(cx, x, y, r) {
  cx.save(); cx.translate(x, y); cx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + i * Math.PI / 5;
    const rr = i % 2 ? r * .45 : r;
    cx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
  }
  cx.closePath(); cx.fillStyle = '#FFC93C'; cx.fill(); cx.strokeStyle = '#2A1B4E'; cx.lineWidth = 3; cx.stroke(); cx.restore();
}
