// RUN10 P12 / RUN13 T1 — Boo Care. This is an upward-only affection ritual: actions add
// bond points, and returning after any length of time never changes the saved care state.
//
// RUN13 T1, DIRECT MANIPULATION LAW (G8): every care action is performed by touching the
// thing and moving it. There are no arrow buttons, no step controls and no +/- widgets in
// this module — the only "press" fallback that exists is a single whole-action completion
// offered to keyboard and switch users, which is an accessibility completion, not a step.
// The shared engine is `runTool()`: a tool that follows the finger, a zone it must stay
// inside to earn travel, a progress ring around the Boo, and a payoff that cannot be missed.

import { el, clear, confetti, REDUCED } from './ui.js';
import { getState, mutate } from './state.js';
import { renderItem, renderDeco } from './art.js';
import { equippedArt } from './accessories.js';
import { resolveItem } from './customs.js';
import { personalityOf } from '../data/personalities.js';
import {
  TREAT_PER_ROUND, POCKET_CAP, LEVELS, POINTS, levelForPoints, pointsToNext,
  TEETH_TARGET, TEETH_TRAVEL_PX, FOAM_STAGES, FUR_TARGET, FUR_TRAVEL_PX,
  BATH_TARGET, BATH_TRAVEL_PX, BALL_TARGET, PLAY_VARIANTS, stageFor
} from '../data/care.js';
import { sfx } from './sfx.js';
import { guideLine, speakMaybe } from './guide.js';
import { stampJournal } from './quests.js';
import { contentTier } from './content.js';
import { runIntro, introSeen, INTRO_SCRIPTS } from './intro.js';

const ACTIONS = [
  { id: 'feed', icon: '🍪', label: 'Treat' },
  { id: 'brush', icon: '🪮', label: 'Brush' },
  { id: 'teeth', icon: '🪥', label: 'Teeth' },
  { id: 'bath', icon: '🧽', label: 'Bath' },
  { id: 'play', icon: '🙈', label: 'Play' }
];
const TODDLER_LINES = {
  feed: 'Yummy treat!',
  brush: 'Brush brush brush!',
  teeth: 'Sparkly teeth!',
  bath: 'Splish splash!',
  play: 'Peekaboo!'
};
const TRICKS = { pip: 'spin', nova: 'backflip', jinx: 'moonwalk', tuft: 'star-jump' };
const RING_C = 2 * Math.PI * 54;   // the progress ring's circumference, r=54 in its viewBox
let noTreatsTaught = false;

function ensureCare(st) {
  st.care = st.care || { bonds: {}, treats: 0 };
  st.care.bonds = st.care.bonds || {};
  st.care.treats = Math.max(0, Math.min(POCKET_CAP, Number(st.care.treats) || 0));
  return st.care;
}

export function bondPoints(booId, st = getState()) {
  return Number(st && st.care && st.care.bonds && st.care.bonds[booId]) || 0;
}
export function bondLevel(booId, st = getState()) { return levelForPoints(bondPoints(booId, st)); }
export function isBestFriend(booId, st = getState()) { return bondLevel(booId, st) >= 5; }
export function heartBadge(booId, st = getState()) { return bondLevel(booId, st) >= 4 ? ' 💗' : ''; }
export function trickFor(booId) {
  const item = resolveItem(booId);
  return TRICKS[item && item.species] || 'spin';
}
export function careActions() { return ACTIONS.map(a => ({ ...a })); }

export function grantRoundTreat() {
  const before = Number(getState().care && getState().care.treats) || 0;
  const after = Math.min(POCKET_CAP, before + TREAT_PER_ROUND);
  if (after !== before) mutate(st => { ensureCare(st).treats = after; });
  return { before, after, added: after - before };
}

export function addBond(booId, action, amount = POINTS[action] || 0) {
  const beforePoints = bondPoints(booId);
  const beforeLevel = levelForPoints(beforePoints);
  const afterPoints = beforePoints + Math.max(0, Number(amount) || 0);
  const afterLevel = levelForPoints(afterPoints);
  const crossed = [];
  for (let level = beforeLevel + 1; level <= afterLevel; level++) crossed.push(level);
  mutate(st => {
    const care = ensureCare(st);
    care.bonds[booId] = afterPoints;
    st.seen = st.seen || {};
    st.seen.careRewards = st.seen.careRewards || {};
    crossed.forEach(level => { st.seen.careRewards[`${booId}:${level}`] = true; });
    if (crossed.includes(5)) placeBestFriendPortrait(st, booId);
  });
  if (crossed.includes(3)) stampJournal(`care_collage_${booId}`);
  if (crossed.includes(5)) stampJournal(`care_bff_${booId}`);
  return { beforePoints, afterPoints, beforeLevel, afterLevel, crossed };
}

function placeBestFriendPortrait(st, booId) {
  const areas = st.town && st.town.areas;
  if (!areas) return;
  const room = areas.boohouse || (areas.boohouse = { items: [], paths: [] });
  room.items = room.items || [];
  if (room.items.some(t => t.item === 'deco_bffportrait' && t.portraitBoo === booId)) return;
  const existing = room.items.filter(t => t.item === 'deco_bffportrait').length;
  room.items.push({
    zone: 'boohouse',
    x: Math.min(.88, .18 + existing * .16),
    row: 3,
    item: 'deco_bffportrait',
    portraitBoo: booId,
    scale: 1
  });
}

export function renderBffPortrait(booId, size = 110) {
  const item = resolveItem(booId);
  const art = item ? renderItem(item, { size: size * .58, equipArt: equippedArt(booId) }) : '';
  return `<div class="care-portrait-frame" style="width:${size}px;height:${size}px"><span>${art}</span><i>♥</i></div>`;
}

export function heartsMarkup(booId) {
  const level = bondLevel(booId);
  return `<span class="care-hearts" aria-label="${level} of 5 friendship hearts">${[1,2,3,4,5].map(i => `<i class="${i <= level ? 'filled' : ''}">♥</i>`).join('')}</span>`;
}

export function renderCareSummary(container, item, onAction) {
  clear(container);
  const points = bondPoints(item.id);
  container.append(
    el('div', { class: 'care-summary-top' }, [
      el('div', { html: heartsMarkup(item.id) }),
      el('span', { class: 'care-next', text: levelForPoints(points) >= 5 ? 'Best friends forever!' : `${pointsToNext(points)} points to the next heart` }),
      el('span', { class: 'care-pocket', text: `🍪 ${(getState().care && getState().care.treats) || 0}` })
    ]),
    el('div', { class: 'care-summary-actions' }, ACTIONS.map(action => el('button', {
      class: `care-summary-action action-${action.id}${action.id === 'feed' && !((getState().care && getState().care.treats) || 0) ? ' dim' : ''}`,
      'aria-label': `${action.label} ${item.name}`,
      onclick: () => onAction(action.id)
    }, [el('span', { text: action.icon }), el('small', { text: action.label })])))
  );
}

export function openCare(item, options = {}) {
  const booId = item.id;
  const personality = personalityOf(booId);
  const displayName = (getState().nicknames && getState().nicknames[booId]) || item.name;
  const overlay = el('div', { class: 'care-overlay' });
  const panel = el('section', { class: `care-panel personality-${personality}`, role: 'dialog', 'aria-label': `Care for ${displayName}` });
  const close = el('button', { class: 'care-close', 'aria-label': 'Close Boo Care', text: '×', onclick: () => finishClose() });
  // House law: every game teaches itself — a first-play intro plus a "?" replay in the shell.
  const help = el('button', {
    class: 'care-help', 'aria-label': 'How Boo Care works', text: '?',
    onclick: () => teachCare()
  });
  const title = el('h2', { text: `Care for ${displayName}` });
  const pocket = el('span', { class: 'care-pocket big', text: `🍪 ${(getState().care && getState().care.treats) || 0}` });
  const hearts = el('div', { class: 'care-modal-hearts', html: heartsMarkup(booId) });
  const boo = el('div', { class: 'care-boo', html: renderItem(item, { size: 170, equipArt: equippedArt(booId) }) });
  const ring = el('div', {
    class: 'care-ring',
    html: `<svg viewBox="0 0 120 120" aria-hidden="true"><circle class="ring-bg" cx="60" cy="60" r="54"/><circle class="ring-fill" cx="60" cy="60" r="54"/></svg>`
  });
  const ringFill = ring.querySelector('.ring-fill');
  ringFill.style.strokeDasharray = RING_C.toFixed(2);
  ringFill.style.strokeDashoffset = RING_C.toFixed(2);
  const status = el('p', { class: 'care-status', text: 'Choose something lovely to do together.' });
  const stage = el('div', { class: 'care-stage' }, [ring, boo, status]);
  const actionBar = el('div', { class: 'care-action-bar' });
  ACTIONS.forEach(action => actionBar.appendChild(el('button', {
    class: `care-action action-${action.id}`,
    'aria-label': action.label,
    onclick: () => beginAction(action.id)
  }, [el('span', { text: action.icon }), el('small', { text: action.label })])));
  panel.append(close, help, title, pocket, hearts, stage, actionBar);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));

  let timers = [];
  let active = null;
  let lastGuidance = null;
  let progress = 0;
  let units = 0;              // whole travel units earned by the active action
  let unitTarget = 1;
  let playVariant = null;
  let fetches = 0;
  let toolHandle = null;

  function later(fn, ms) {
    const id = setTimeout(fn, ms);
    timers.push(id);
    return id;
  }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }

  function setProgress(p) {
    progress = Math.max(0, Math.min(1, p));
    ringFill.style.strokeDashoffset = (RING_C * (1 - progress)).toFixed(2);
    ring.classList.toggle('active', progress > 0 || !!active);
    ring.classList.toggle('done', progress >= 1);
  }

  function resetStage() {
    clearTimers();
    if (toolHandle) { toolHandle.destroy(); toolHandle = null; }
    active = null; units = 0; unitTarget = 1; fetches = 0; playVariant = null;
    stage.querySelectorAll('.care-action-ui, .care-particle, .care-levelup').forEach(n => n.remove());
    boo.className = 'care-boo';
    boo.style.removeProperty('--pop-x');
    boo.style.removeProperty('--pop-y');
    setProgress(0);
    ring.classList.remove('active');
  }

  function beginAction(action) {
    resetStage();
    active = action;
    ring.classList.add('active');
    actionBar.querySelectorAll('.care-action').forEach(b => b.classList.toggle('sel', b.classList.contains(`action-${action}`)));
    if (contentTier() === 'toddler') {
      lastGuidance = TODDLER_LINES[action];
      speakMaybe(lastGuidance);
    }
    if (action === 'feed') feed();
    else if (action === 'brush') brush();
    else if (action === 'teeth') teeth();
    else if (action === 'bath') bath();
    else play();
  }

  // ---------------------------------------------------------------------------
  // The engine. A tool that follows the finger; travel INSIDE the zone earns units.
  // No arrow, step or +/- control exists anywhere below this line.
  // ---------------------------------------------------------------------------
  function zoneRect(kind) {
    const s = stage.getBoundingClientRect();
    const b = boo.getBoundingClientRect();
    const x = b.left - s.left, y = b.top - s.top;
    if (kind === 'mouth') {
      return { x: x + b.width * .17, y: y + b.height * .44, w: b.width * .66, h: b.height * .42 };
    }
    return { x: x - 10, y: y - 6, w: b.width + 20, h: b.height + 12 };   // whole body
  }

  function runTool({
    id, icon, zone = 'body', travelPx, target, label,
    onPickUp, onContact, onUnit, onRelease, onFinish, sparkles = true
  }) {
    unitTarget = target;
    const hint = el('div', { class: `care-action-ui care-zone-hint zone-${zone}` });
    // The glyph, not the button, carries the "pick me up" bob: the button's own box stays
    // rock-steady so hit-testing (and a keyboard press) is never chasing a moving target.
    const tool = el('button', {
      class: `care-action-ui care-tool tool-${id}`,
      type: 'button',
      'aria-label': label
    }, [el('span', { class: 'tool-glyph', text: icon })]);
    const pad = el('div', { class: 'care-action-ui care-pad' });
    stage.append(hint, pad, tool);
    placeHint();

    let dragging = false, inZone = false, last = null, travel = 0, contacted = false, moved = 0;

    function placeHint() {
      const z = zoneRect(zone);
      hint.style.left = `${z.x}px`;
      hint.style.top = `${z.y}px`;
      hint.style.width = `${z.w}px`;
      hint.style.height = `${z.h}px`;
    }
    function local(e) {
      const s = stage.getBoundingClientRect();
      return { x: e.clientX - s.left, y: e.clientY - s.top };
    }
    function inside(p) {
      const z = zoneRect(zone);
      return p.x >= z.x && p.x <= z.x + z.w && p.y >= z.y && p.y <= z.y + z.h;
    }
    function moveTool(p, dx = 0) {
      tool.style.left = `${p.x}px`;
      tool.style.top = `${p.y}px`;
      tool.style.setProperty('--tilt', `${Math.max(-38, Math.min(38, dx * .8))}deg`);
    }
    function goHome() {
      tool.style.removeProperty('left');
      tool.style.removeProperty('top');
      tool.style.removeProperty('--tilt');
      tool.classList.remove('held', 'hot');
    }

    function pickUp(e) {
      if (units >= target) return;
      dragging = true;
      last = local(e);
      travel = 0;
      moved = 0;
      tool.classList.remove('nudge');
      tool.classList.add('held');
      moveTool(last);
      // First feedback inside 200ms, always: the tool lifts and clicks the moment it is touched.
      sfx.tap();
      if (onPickUp) onPickUp(last);
      try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
      e.preventDefault();
    }
    function drag(e) {
      if (!dragging) return;
      const p = local(e);
      const dx = p.x - last.x, dy = p.y - last.y;
      moved += Math.hypot(dx, dy);
      moveTool(p, dx);
      const here = inside(p);
      if (here !== inZone) {
        inZone = here;
        tool.classList.toggle('hot', here);
        hint.classList.toggle('hot', here);
        if (here && !contacted) { contacted = true; if (onContact) onContact(p); }
      }
      if (here) {
        travel += Math.hypot(dx, dy);
        if (sparkles && !REDUCED && Math.random() < .35) spark(p.x, p.y, 'trail');
        while (travel >= travelPx && units < target) {
          travel -= travelPx;
          addUnit(p);
        }
      }
      last = p;
    }
    function addUnit(p) {
      units++;
      setProgress(units / target);
      if (onUnit) onUnit(units, p);
      if (units >= target) {
        dragging = false;
        goHome();
        if (onFinish) onFinish();
      }
    }
    function release() {
      if (!dragging) return;
      dragging = false;
      inZone = false;
      hint.classList.remove('hot');
      const wasStill = moved < 8;
      goHome();
      travel = 0;            // partial travel is discarded; every WHOLE unit is kept
      // A tap that never moved is never a silent no-op: the tool wiggles and says so.
      if (wasStill && units < target) {
        tool.classList.add('nudge');
        status.textContent = `Hold it and move it about — that's how it works!`;
      } else if (onRelease) onRelease(units);
    }
    function finishNow() {
      if (units >= target) return;
      const z = zoneRect(zone);
      const p = { x: z.x + z.w / 2, y: z.y + z.h / 2 };
      if (!contacted) { contacted = true; if (onContact) onContact(p); }
      while (units < target) addUnit(p);
    }

    // The finger drives BOTH the pad and the tool itself — a child presses the toothbrush,
    // not the space beside it. Pointer capture follows whichever element was touched.
    [pad, tool].forEach(node => {
      node.addEventListener('pointerdown', pickUp);
      node.addEventListener('pointermove', drag);
      node.addEventListener('pointerup', release);
      node.addEventListener('pointercancel', release);
    });
    // Accessibility completion (NOT a step control, and NOT reachable by tapping): one
    // keyboard press finishes the whole action with its full payoff, for keyboard and
    // switch users who cannot express a drag. `detail === 0` is the keyboard-activated
    // click; a real tap has detail >= 1 and is ignored here.
    tool.addEventListener('click', e => {
      e.preventDefault();
      if (e.detail !== 0 || dragging) return;
      finishNow();
    });

    const handle = {
      units: () => units,
      target,
      placeHint,
      // Synthetic travel for suites that assert the maths rather than the pointer stream.
      travel(px, outOfZone = false) {
        const z = zoneRect(zone);
        const p = { x: z.x + z.w / 2, y: z.y + z.h / 2 };
        if (outOfZone) return units;                       // wandering outside earns nothing
        if (!contacted) { contacted = true; if (onContact) onContact(p); }
        travel += px;
        while (travel >= travelPx && units < target) { travel -= travelPx; addUnit(p); }
        return units;
      },
      release,
      finishNow,
      destroy() { hint.remove(); pad.remove(); tool.remove(); }
    };
    toolHandle = handle;
    return handle;
  }

  function spark(x, y, kind = 'trail') {
    if (REDUCED) return;
    const s = el('i', { class: `care-particle care-spark ${kind}`, style: { left: `${x}px`, top: `${y}px`, '--i': Math.floor(Math.random() * 12) } });
    stage.appendChild(s);
    setTimeout(() => s.remove(), 800);
  }
  function bubble(x, y) {
    const b = el('i', { class: 'care-particle care-bubble', style: { left: `${x + Math.random() * 40 - 20}px`, top: `${y + Math.random() * 30 - 15}px`, '--i': Math.floor(Math.random() * 6) } });
    stage.appendChild(b);
    return b;
  }

  // ---------------------------------------------------------------------------
  // 1. Brush Teeth — the toothbrush is dragged onto the mouth and scrubbed.
  // ---------------------------------------------------------------------------
  function teeth() {
    status.textContent = personalityFlavour('teeth', personality);
    const foam = el('div', { class: 'care-action-ui care-foam stage-0', text: '◌' });
    stage.appendChild(foam);
    runTool({
      id: 'teeth', icon: '🪥', zone: 'mouth',
      travelPx: TEETH_TRAVEL_PX, target: TEETH_TARGET,
      label: `Brush ${displayName}'s teeth — drag the toothbrush over her mouth (or press to finish)`,
      onContact: () => { boo.classList.add('care-open-wide'); status.textContent = `Scrub, scrub! Move the brush about.`; },
      onUnit: (n, p) => {
        foam.className = `care-action-ui care-foam stage-${stageFor(n, TEETH_TARGET, FOAM_STAGES)}`;
        if (n % 2 === 0) sfx.tap();
        if (!REDUCED) { bubble(p.x, p.y); bubble(p.x, p.y); }
        status.textContent = `${n} of ${TEETH_TARGET} sparkly scrubs`;
      },
      onRelease: n => { if (n < TEETH_TARGET) status.textContent = `${n} of ${TEETH_TARGET} scrubs — pick the brush back up whenever you like.`; },
      onFinish: () => {
        foam.classList.add('puff');
        boo.classList.remove('care-open-wide');
        boo.classList.add('care-giant-grin');
        stage.appendChild(el('div', { class: 'care-action-ui care-tooth-glint', text: '✦' }));
        sfx.ping(10);
        later(() => sfx.ping(14), 160);
        status.textContent = 'What a GIANT sparkly grin!';
        later(() => complete('teeth'), 520);
      }
    });
    status.textContent += ' Drag the toothbrush to her mouth.';
  }

  // ---------------------------------------------------------------------------
  // 2. Feed — the treat is DRAGGED from the pocket to the mouth. Tap-to-feed remains
  //    as the accessibility fallback (the treat is a real button).
  // ---------------------------------------------------------------------------
  function feed() {
    const treats = Number(getState().care && getState().care.treats) || 0;
    if (!treats) {
      status.textContent = guideLine('L_CARE_NOTREATS') || 'Win a round to earn a treat!';
      if (!noTreatsTaught) { noTreatsTaught = true; speakMaybe(status.textContent); }
      actionBar.querySelector('.action-feed').classList.add('dim');
      ring.classList.remove('active');
      return;
    }
    status.textContent = personalityFlavour('feed', personality) + ' Drag it to her mouth!';
    let eaten = false;
    const handle = runTool({
      id: 'treat', icon: '🍪', zone: 'mouth',
      travelPx: 1, target: 1, sparkles: false,
      label: `Feed ${displayName} — drag the treat to her mouth (or press to feed)`,
      onPickUp: () => { boo.classList.add('care-eyes-follow'); },
      onContact: () => {
        // Cheeky Boos snatch it out of the air the instant it comes within reach.
        if (personality === 'cheeky') { panel.classList.add('care-snatch'); status.textContent = 'Quick paws — that treat vanished mid-flight!'; }
        if (personality === 'shy') boo.classList.add('care-shy-peek');
      },
      onFinish: () => {
        if (eaten) return;
        eaten = true;
        mutate(st => { const c = ensureCare(st); c.treats = Math.max(0, c.treats - 1); });
        pocket.textContent = `🍪 ${getState().care.treats}`;
        boo.classList.remove('care-eyes-follow');
        boo.classList.add('care-nom');
        if (!REDUCED) for (let i = 0; i < 8; i++) stage.appendChild(el('i', { class: 'care-particle crumb', style: { '--i': i } }));
        stage.appendChild(el('div', { class: 'care-particle care-float-heart', text: '♥' }));
        sfx.pop();
        later(() => complete('feed'), 620);
      }
    });
    handle.placeHint();
  }

  // ---------------------------------------------------------------------------
  // 3. Brush fur — the brush follows the finger, sparkles trail, fur shines.
  // ---------------------------------------------------------------------------
  function brush() {
    status.textContent = personalityFlavour('brush', personality) + ' Stroke the brush across her.';
    if (personality === 'sleepy') boo.classList.add('care-yawn');
    runTool({
      id: 'brush', icon: '🪮', zone: 'body',
      travelPx: FUR_TRAVEL_PX, target: FUR_TARGET,
      label: `Brush ${displayName}'s fur — stroke the brush across her (or press to finish)`,
      onContact: () => { boo.classList.add('care-happy-eyes'); },
      onUnit: (n, p) => {
        for (let i = 0; i < (REDUCED ? 0 : 12); i++) {
          stage.appendChild(el('i', { class: 'care-particle brush-spark', style: { left: `${p.x}px`, top: `${p.y}px`, '--i': i } }));
        }
        sfx.ping(n);
        // The fur visibly smooths: a shine sweeps the body after every stroke.
        const gleam = el('div', { class: 'care-action-ui care-gleam' });
        stage.appendChild(gleam);
        setTimeout(() => gleam.remove(), 800);
        boo.classList.add(`fur-smooth-${n}`);
        status.textContent = `${n} of ${FUR_TARGET} lovely brush strokes`;
      },
      onRelease: n => { if (n < FUR_TARGET) status.textContent = `${n} of ${FUR_TARGET} strokes — carry on whenever you like.`; },
      onFinish: () => {
        boo.classList.add('care-brush-finish');
        status.textContent = `${displayName} shivers with joy!`;
        later(() => complete('brush'), 460);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // 4. Bath — a sponge raises bubbles. She was never unclean to begin with (G9): the
  //    framing is "bath time is FUN", never "you need washing".
  // ---------------------------------------------------------------------------
  function bath() {
    status.textContent = personalityFlavour('bath', personality) + ' Drag the sponge over her.';
    const water = el('div', { class: 'care-action-ui care-tub' });
    stage.appendChild(water);
    const bubbles = [];
    let hummed = false;
    runTool({
      id: 'bath', icon: '🧽', zone: 'body',
      travelPx: BATH_TRAVEL_PX, target: BATH_TARGET, sparkles: false,
      label: `Give ${displayName} a bubbly bath — drag the sponge over her (or press to finish)`,
      onContact: () => { boo.classList.add('care-splash'); sfx.hum(); hummed = true; },
      onUnit: (n, p) => {
        for (let i = 0; i < (REDUCED ? 1 : 3); i++) bubbles.push(bubble(p.x, p.y));
        boo.classList.remove('care-splash');
        void boo.offsetWidth;
        boo.classList.add('care-splash');
        if (n === Math.ceil(BATH_TARGET / 2)) { sfx.hum(); hummed = true; }   // the two-note hum
        else if (n % 3 === 0) sfx.chime(n);
        water.className = `care-action-ui care-tub suds-${stageFor(n, BATH_TARGET, FOAM_STAGES)}`;
        status.textContent = `${n} of ${BATH_TARGET} bubbly rubs`;
      },
      onRelease: n => { if (n < BATH_TARGET) status.textContent = `${n} of ${BATH_TARGET} rubs — the water stays lovely and warm.`; },
      onFinish: () => {
        if (!hummed) sfx.hum();
        bubbles.forEach(b => b.classList.add('pop'));
        later(() => bubbles.forEach(b => b.remove()), 480);
        boo.classList.remove('care-splash');
        boo.classList.add('care-gleaming');
        stage.appendChild(el('div', { class: 'care-action-ui care-gleam' }));
        sfx.star();
        status.textContent = `Squeaky, sparkly, SPLENDID!`;
        later(() => complete('bath'), 560);
      }
    });
  }

  // ---------------------------------------------------------------------------
  // 5. Play — peekaboo, or the ball she throws for the Boo to chase and return.
  // ---------------------------------------------------------------------------
  function play() {
    playVariant = options.playVariant || PLAY_VARIANTS[Math.floor(Math.random() * PLAY_VARIANTS.length)];
    if (playVariant === 'ball') playBall();
    else playPeek();
  }

  function playBall() {
    status.textContent = personalityFlavour('ball', personality) + ' Throw the ball for her!';
    unitTarget = BALL_TARGET;
    const ball = el('button', { class: 'care-action-ui care-tool tool-ball', type: 'button', 'aria-label': `Throw the ball for ${displayName} (drag it, or press to throw)` }, [el('span', { class: 'tool-glyph', text: '⚽' })]);
    const pad = el('div', { class: 'care-action-ui care-pad' });
    stage.append(pad, ball);
    let dragging = false, chasing = false, last = null;

    function local(e) { const s = stage.getBoundingClientRect(); return { x: e.clientX - s.left, y: e.clientY - s.top }; }
    function place(p) { ball.style.left = `${p.x}px`; ball.style.top = `${p.y}px`; }
    function throwTo(p) {
      if (chasing) return;
      chasing = true;
      place(p);
      ball.classList.remove('held');
      ball.classList.add('thrown');
      sfx.pop();
      const s = stage.getBoundingClientRect();
      boo.style.setProperty('--chase-x', `${p.x - s.width / 2}px`);
      boo.classList.add('care-chasing');
      if (personality === 'sporty') boo.classList.add('care-bouncy-chase');
      status.textContent = `${displayName} is off after it!`;
      later(() => {
        ball.classList.add('carried');
        boo.classList.remove('care-chasing');
        boo.classList.add('care-returning');
        status.textContent = `Here she comes with it!`;
      }, REDUCED ? 60 : 620);
      later(() => {
        fetches++;
        setProgress(fetches / BALL_TARGET);
        boo.className = 'care-boo care-found-jump';
        ball.classList.remove('thrown', 'carried');
        ball.style.removeProperty('left');
        ball.style.removeProperty('top');
        boo.style.removeProperty('--chase-x');
        sfx.giggle();
        if (!REDUCED) confetti({ count: 10, power: .3, origin: { x: .5, y: .5 } });
        chasing = false;
        status.textContent = `Fetch ${fetches} of ${BALL_TARGET}! She dropped it right back.`;
        if (fetches >= BALL_TARGET) {
          boo.className = 'care-boo care-wave';
          status.textContent = `${displayName} flops down, delighted.`;
          later(() => complete('play'), 420);
        }
      }, REDUCED ? 120 : 1320);
    }

    [pad, ball].forEach(node => {
      node.addEventListener('pointerdown', e => {
        if (chasing) return;
        dragging = true; last = local(e); ball.classList.add('held'); place(last); sfx.tap();
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch {}
        e.preventDefault();
      });
      node.addEventListener('pointermove', e => { if (dragging) { last = local(e); place(last); } });
      node.addEventListener('pointerup', () => { if (dragging) { dragging = false; throwTo(last); } });
      node.addEventListener('pointercancel', () => { if (dragging) { dragging = false; throwTo(last); } });
    });
    // Keyboard-only throw (detail === 0), same accessibility contract as the other tools.
    ball.addEventListener('click', e => {
      e.preventDefault();
      if (e.detail !== 0 || dragging || chasing) return;
      const s = stage.getBoundingClientRect();
      throwTo({ x: s.width * (fetches % 2 ? .22 : .78), y: s.height * .62 });
    });
    toolHandle = {
      units: () => fetches, target: BALL_TARGET, placeHint() {},
      travel() { const s = stage.getBoundingClientRect(); throwTo({ x: s.width * .78, y: s.height * .62 }); return fetches; },
      release() {}, destroy() { pad.remove(); ball.remove(); }
    };
  }

  function playPeek() {
    status.textContent = personalityFlavour('play', personality);
    unitTarget = 3;
    const obstacleHtml = renderDeco('deco_sofa', { size: 160 }) || renderDeco('bush', { size: 150 });
    const obstacle = el('div', { class: 'care-action-ui care-hide-obstacle', html: obstacleHtml });
    const target = el('button', { class: 'care-action-ui care-peek-target', 'aria-label': `Tap to find ${displayName}` });
    const pop = el('div', { class: `care-action-ui care-peek-pop${personality === 'sporty' ? ' sporty' : ''}`, text: '👀' });
    stage.append(obstacle, pop, target);
    boo.classList.add('care-ducking');
    let playHits = 0;

    target.onclick = () => {
      if (!target.classList.contains('peeking')) return;
      playHits++;
      setProgress(playHits / 3);
      target.classList.remove('peeking');
      pop.classList.remove('show');
      boo.className = 'care-boo care-found-jump';
      sfx.giggle();
      if (!REDUCED) confetti({ count: 18, power: .45, origin: { x: .5, y: .45 } });
      status.textContent = `Peekaboo! Found ${displayName}! (${playHits} times)`;
    };

    const peekSides = ['peeking-left', 'peeking-right', 'peeking-top'];
    [900, 3000, 5100].forEach((at, i) => later(() => {
      const side = peekSides[i % peekSides.length];
      boo.className = `care-boo ${side}`;
      target.className = `care-action-ui care-peek-target peeking ${side}`;
      pop.className = `care-action-ui care-peek-pop show ${side}${personality === 'sporty' ? ' sporty' : ''}`;
      status.textContent = `Where is ${displayName}? Tap the eyes!`;
    }, at));

    later(() => {
      target.remove();
      obstacle.remove();
      pop.remove();
      boo.className = 'care-boo care-wave';
      setProgress(1);
      complete('play');
    }, 7200);
    toolHandle = {
      units: () => playHits, target: 3, placeHint() {},
      travel() { return playHits; },
      release() {},
      destroy() { obstacle.remove(); pop.remove(); target.remove(); }
    };
  }

  function complete(action) {
    if (active !== action) return null;
    setProgress(1);
    const result = addBond(booId, action);
    hearts.innerHTML = heartsMarkup(booId);
    status.textContent = `${displayName} loved that! +${POINTS[action]} friendship points`;
    stage.appendChild(el('div', { class: 'care-particle care-float-heart', text: '♥' }));
    if (result.crossed.length) showLevelUp(result.crossed.at(-1));
    sfx.star();
    if (options.onDone) options.onDone(result);
    return result;
  }

  function showLevelUp(level) {
    const reward = level === 2 ? `${displayName} learned a tap trick! 🎶`
      : level === 3 ? `${displayName}'s wearable accessory drop unlocked! 🎩`
        : level === 4 ? `${displayName} is now your Cheerleader companion! 📣`
          : `BEST FRIENDS FOREVER! 🖼️⭐ A Golden Framed Portrait was added to your Gallery Museum!`;
    const card = el('div', { class: 'care-levelup' }, [
      el('strong', { text: `Friendship Heart ${level}! ♥` }),
      el('span', { text: reward })
    ]);
    stage.appendChild(card);
    if (level === 5) {
      const line = `${displayName} and you... Best Friends FOREVER!`;
      status.textContent = line;
      speakMaybe(line);
      if (!REDUCED) confetti({ count: 55, power: .8 });
    }
  }

  function finishClose() {
    clearTimers();
    if (toolHandle) { toolHandle.destroy(); toolHandle = null; }
    overlay.classList.remove('open');
    later(() => overlay.remove(), REDUCED ? 0 : 180);
    if (options.onClose) options.onClose();
  }

  window.__care = {
    booId: () => booId,
    active: () => active,
    begin: beginAction,
    variant: () => playVariant,
    progress: () => progress,
    units: () => (toolHandle ? toolHandle.units() : 0),
    target: () => unitTarget,
    // Synthetic travel, in pixels, INSIDE the action's zone. `outOfZone` proves the
    // out-of-zone wander earns nothing. Real pointer streams are the primary assertion.
    travel: (px, outOfZone = false) => (toolHandle ? toolHandle.travel(px, outOfZone) : 0),
    release: () => { if (toolHandle) toolHandle.release(); },
    zone: kind => zoneRect(kind || 'body'),
    complete,
    strokes: () => (active === 'brush' && toolHandle ? toolHandle.units() : 0),
    scrubs: () => (active === 'teeth' && toolHandle ? toolHandle.units() : 0),
    suds: () => (active === 'bath' && toolHandle ? toolHandle.units() : 0),
    fetches: () => fetches,
    playHits: () => (playVariant === 'peek' && toolHandle ? toolHandle.units() : 0),
    finishPlay: () => {
      if (active !== 'play') return null;
      clearTimers();
      boo.className = 'care-boo care-wave';
      setProgress(1);
      return complete('play');
    },
    points: () => bondPoints(booId),
    level: () => bondLevel(booId),
    treats: () => (getState().care && getState().care.treats) || 0,
    lastGuidance: () => lastGuidance,
    close: finishClose
  };

  // RUN13 T2 — the first time a child ever opens care, for ANY Boo, the guide walks three
  // short steps. The chosen action waits behind it (RUN12 S6's law: an intro must never
  // run the thing it is explaining behind its own back). The "?" replays it any time.
  function teachCare(onDone) {
    document.body.classList.add('care-teaching');
    runIntro('care', {
      steps: INTRO_SCRIPTS.care,
      onDone: () => { document.body.classList.remove('care-teaching'); if (onDone) onDone(); }
    });
  }
  const startChosen = () => { if (options.startAction) later(() => beginAction(options.startAction), 80); };
  if (introSeen('care')) startChosen();
  else teachCare(startChosen);

  return { close: finishClose, overlay };
}

function personalityFlavour(action, personality) {
  if (action === 'feed' && personality === 'cheeky') return 'Quick paws — that treat vanished mid-flight!';
  if (action === 'feed' && personality === 'shy') return 'A tiny peek… then a brave little nibble.';
  if (action === 'brush' && personality === 'sleepy') return 'A yawn, a stretch, and the softest brushing.';
  if (action === 'teeth' && personality === 'musical') return 'Scrub-a-dub in perfect rhythm!';
  if (action === 'play' && personality === 'sporty') return 'Ready, set… PEEKABOO!';
  if (action === 'ball' && personality === 'sporty') return 'She is bouncing on the spot already!';
  if (action === 'bath' && personality === 'bouncy') return 'Splashes everywhere — mostly on you.';
  if (action === 'bath' && personality === 'musical') return 'A two-note bath-time hum, on repeat.';
  return action === 'feed' ? 'Here comes a lovely treat!'
    : action === 'brush' ? 'Long, gentle strokes across the fur.'
      : action === 'teeth' ? `${TEETH_TARGET} little scrubs for a giant grin.`
        : action === 'bath' ? 'Warm water, big bubbles, happy Boo.'
          : action === 'ball' ? 'A ball! Her favourite thing in the world.'
            : 'Where did your Boo go?';
}
