// RUN10 P12 — Boo Care. This is an upward-only affection ritual: actions add bond
// points, and returning after any length of time never changes the saved care state.

import { el, clear, confetti, REDUCED } from './ui.js';
import { getState, mutate } from './state.js';
import { renderItem } from './art.js';
import { equippedArt } from './accessories.js';
import { resolveItem } from './customs.js';
import { personalityOf } from '../data/personalities.js';
import { TREAT_PER_ROUND, POCKET_CAP, LEVELS, POINTS, levelForPoints, pointsToNext } from '../data/care.js';
import { sfx } from './sfx.js';
import { guideLine, speakMaybe } from './guide.js';
import { stampJournal } from './quests.js';
import { contentTier } from './content.js';

const ACTIONS = [
  { id: 'feed', icon: '🍪', label: 'Treat' },
  { id: 'brush', icon: '🪮', label: 'Brush' },
  { id: 'teeth', icon: '🪥', label: 'Teeth' },
  { id: 'play', icon: '🙈', label: 'Play' }
];
const TODDLER_LINES = {
  feed: 'Yummy treat!',
  brush: 'Brush brush brush!',
  teeth: 'Sparkly teeth!',
  play: 'Peekaboo!'
};
const TRICKS = { pip: 'spin', nova: 'backflip', jinx: 'moonwalk', tuft: 'star-jump' };
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
  const displayName = (getState().nicknames && getState().nicknames[booId]) || item.name;
  const overlay = el('div', { class: 'care-overlay' });
  const panel = el('section', { class: `care-panel personality-${personalityOf(booId)}`, role: 'dialog', 'aria-label': `Care for ${displayName}` });
  const close = el('button', { class: 'care-close', 'aria-label': 'Close Boo Care', text: '×', onclick: () => finishClose() });
  const title = el('h2', { text: `Care for ${displayName}` });
  const pocket = el('span', { class: 'care-pocket big', text: `🍪 ${(getState().care && getState().care.treats) || 0}` });
  const hearts = el('div', { class: 'care-modal-hearts', html: heartsMarkup(booId) });
  const boo = el('div', { class: 'care-boo', html: renderItem(item, { size: 170, equipArt: equippedArt(booId) }) });
  const status = el('p', { class: 'care-status', text: 'Choose something lovely to do together.' });
  const stage = el('div', { class: 'care-stage' }, [boo, status]);
  const actionBar = el('div', { class: 'care-action-bar' });
  ACTIONS.forEach(action => actionBar.appendChild(el('button', {
    class: `care-action action-${action.id}`,
    'aria-label': action.label,
    onclick: () => beginAction(action.id)
  }, [el('span', { text: action.icon }), el('small', { text: action.label })])));
  panel.append(close, title, pocket, hearts, stage, actionBar);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('open'));

  let timers = [];
  let active = null;
  let lastGuidance = null;
  let strokes = 0, scrubs = 0, expectedSide = 'left', playHits = 0;
  let lastPointer = null, dragDistance = 0;

  function later(fn, ms) {
    const id = setTimeout(fn, ms);
    timers.push(id);
    return id;
  }
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  function resetStage() {
    clearTimers();
    active = null; strokes = 0; scrubs = 0; expectedSide = 'left'; playHits = 0;
    lastPointer = null; dragDistance = 0;
    stage.querySelectorAll('.care-action-ui, .care-particle, .care-levelup').forEach(n => n.remove());
    boo.className = 'care-boo';
    boo.style.removeProperty('--pop-x');
    boo.style.removeProperty('--pop-y');
  }

  function beginAction(action) {
    resetStage();
    active = action;
    actionBar.querySelectorAll('.care-action').forEach(b => b.classList.toggle('sel', b.classList.contains(`action-${action}`)));
    if (contentTier() === 'toddler') {
      lastGuidance = TODDLER_LINES[action];
      speakMaybe(lastGuidance);
    }
    if (action === 'feed') feed();
    else if (action === 'brush') brush();
    else if (action === 'teeth') teeth();
    else play();
  }

  function feed() {
    const treats = Number(getState().care && getState().care.treats) || 0;
    if (!treats) {
      status.textContent = guideLine('L_CARE_NOTREATS') || 'Win a round to earn a treat!';
      if (!noTreatsTaught) { noTreatsTaught = true; speakMaybe(status.textContent); }
      actionBar.querySelector('.action-feed').classList.add('dim');
      return;
    }
    mutate(st => { ensureCare(st).treats = Math.max(0, ensureCare(st).treats - 1); });
    pocket.textContent = `🍪 ${getState().care.treats}`;
    status.textContent = personalityFlavour('feed', personalityOf(booId));
    const treat = el('div', { class: 'care-action-ui care-flying-treat', text: '🍪' });
    stage.appendChild(treat);
    if (personalityOf(booId) === 'cheeky') panel.classList.add('care-snatch');
    if (personalityOf(booId) === 'shy') boo.classList.add('care-shy-peek');
    later(() => {
      boo.classList.add('care-nom');
      for (let i = 0; i < 8; i++) stage.appendChild(el('i', { class: 'care-particle crumb', style: { '--i': i } }));
      stage.appendChild(el('div', { class: 'care-particle care-float-heart', text: '♥' }));
      sfx.pop();
    }, 600);
    later(() => complete('feed'), 1450);
  }

  function brush() {
    status.textContent = personalityFlavour('brush', personalityOf(booId));
    if (personalityOf(booId) === 'sleepy') boo.classList.add('care-yawn');
    const brushEl = el('div', { class: 'care-action-ui care-brush', text: '🪮' });
    const pad = el('div', { class: 'care-action-ui care-brush-pad', 'aria-label': 'Drag the brush across the Boo' });
    stage.append(pad, brushEl);
    const moveBrush = e => {
      const r = stage.getBoundingClientRect();
      brushEl.style.left = `${e.clientX - r.left}px`;
      brushEl.style.top = `${e.clientY - r.top}px`;
      if (lastPointer) {
        dragDistance += Math.hypot(e.clientX - lastPointer.x, e.clientY - lastPointer.y);
        if (dragDistance >= 60) { dragDistance = 0; registerStroke(e.clientX - r.left, e.clientY - r.top); }
      }
      lastPointer = { x: e.clientX, y: e.clientY };
    };
    pad.addEventListener('pointerdown', e => { lastPointer = { x: e.clientX, y: e.clientY }; pad.setPointerCapture(e.pointerId); moveBrush(e); });
    pad.addEventListener('pointermove', e => { if (e.buttons) moveBrush(e); });
    pad.addEventListener('pointerup', () => { lastPointer = null; dragDistance = 0; });
  }

  function registerStroke(x = 140, y = 130) {
    if (active !== 'brush' || strokes >= 3) return;
    strokes++;
    boo.classList.add('care-happy-eyes');
    for (let i = 0; i < 12; i++) stage.appendChild(el('i', { class: 'care-particle brush-spark', style: { left: `${x}px`, top: `${y}px`, '--i': i } }));
    sfx.ping(strokes);
    status.textContent = `${strokes} of 3 lovely brush strokes`;
    if (strokes === 3) {
      boo.classList.add('care-brush-finish');
      stage.appendChild(el('div', { class: 'care-action-ui care-gleam' }));
      later(() => complete('brush'), 450);
    }
  }

  function teeth() {
    status.textContent = personalityFlavour('teeth', personalityOf(booId));
    const foam = el('div', { class: 'care-action-ui care-foam stage-0', text: '◌' });
    const controls = el('div', { class: 'care-action-ui care-scrub-controls' }, [
      el('button', { class: 'care-scrub left', text: '←', onclick: () => scrub('left') }),
      el('div', { class: 'care-toothbrush', text: '🪥' }),
      el('button', { class: 'care-scrub right', text: '→', onclick: () => scrub('right') })
    ]);
    stage.append(foam, controls);
    status.textContent += ' Tap left, right, left, right…';
  }

  function scrub(side) {
    if (active !== 'teeth' || side !== expectedSide || scrubs >= 6) return;
    scrubs++;
    expectedSide = side === 'left' ? 'right' : 'left';
    panel.querySelector('.care-toothbrush')?.classList.toggle('right', side === 'right');
    const foam = panel.querySelector('.care-foam');
    if (foam) foam.className = `care-action-ui care-foam stage-${Math.ceil(scrubs / 2)}`;
    status.textContent = `${scrubs} of 6 sparkly scrubs`;
    sfx.tap();
    if (scrubs === 6) {
      boo.classList.add('care-giant-grin');
      stage.appendChild(el('div', { class: 'care-action-ui care-tooth-glint', text: '✦' }));
      sfx.ping(8);
      later(() => complete('teeth'), 500);
    }
  }

  function play() {
    status.textContent = personalityFlavour('play', personalityOf(booId));
    const pop = el('button', { class: 'care-action-ui care-peek-pop', text: '🙈', 'aria-label': `Found ${displayName}` });
    stage.appendChild(pop);
    pop.onclick = () => {
      if (!pop.classList.contains('show')) return;
      playHits++;
      pop.classList.remove('show');
      sfx.giggle();
      if (!REDUCED) confetti({ count: 12, power: .35, origin: { x: .5, y: .45 } });
      status.textContent = `Peekaboo! ${playHits} found`;
    };
    boo.classList.add(options.hasHideSpot ? 'care-behind-item' : 'care-cover-eyes');
    const offsets = [[20,45],[72,28],[48,68]];
    [1500, 4300, 7200].forEach((at, i) => later(() => {
      pop.style.left = `${offsets[i][0]}%`;
      pop.style.top = `${offsets[i][1]}%`;
      pop.classList.add('show');
      if (personalityOf(booId) === 'sporty') pop.classList.add('sporty');
    }, at));
    later(() => {
      pop.classList.remove('show');
      boo.classList.remove('care-behind-item', 'care-cover-eyes');
      boo.classList.add('care-wave');
      complete('play');
    }, 10000);
  }

  function complete(action) {
    if (active !== action) return null;
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
    const reward = level === 2 ? `${displayName} learned a tap trick!`
      : level === 3 ? `${displayName}'s collage sticker unlocked!`
        : level === 4 ? `${displayName} earned a heart badge!`
          : `${displayName} is your BEST FRIEND! A portrait is waiting at home.`;
    const card = el('div', { class: 'care-levelup' }, [
      el('strong', { text: `Friendship heart ${level}!` }),
      el('span', { text: reward })
    ]);
    stage.appendChild(card);
    if (level === 5) {
      const line = (guideLine('L_CARE_BFF') || '{name} and {booName}... best friends FOREVER!').replace(/\{booName\}/g, displayName);
      status.textContent = line;
      speakMaybe(line);
      if (!REDUCED) confetti({ count: 55, power: .8 });
    }
  }

  function finishClose() {
    clearTimers();
    overlay.classList.remove('open');
    later(() => overlay.remove(), REDUCED ? 0 : 180);
    if (options.onClose) options.onClose();
  }

  window.__care = {
    booId: () => booId,
    active: () => active,
    begin: beginAction,
    stroke: distance => { if (active === 'brush' && distance >= 60) registerStroke(); },
    scrub,
    finishPlay: () => { if (active === 'play') { clearTimers(); boo.classList.add('care-wave'); return complete('play'); } return null; },
    complete,
    strokes: () => strokes,
    scrubs: () => scrubs,
    playHits: () => playHits,
    points: () => bondPoints(booId),
    level: () => bondLevel(booId),
    treats: () => (getState().care && getState().care.treats) || 0,
    lastGuidance: () => lastGuidance,
    close: finishClose
  };

  if (options.startAction) later(() => beginAction(options.startAction), 80);
  return { close: finishClose, overlay };
}

function personalityFlavour(action, personality) {
  if (action === 'feed' && personality === 'cheeky') return 'Quick paws — that treat vanished mid-flight!';
  if (action === 'feed' && personality === 'shy') return 'A tiny peek… then a brave little nibble.';
  if (action === 'brush' && personality === 'sleepy') return 'A yawn, a stretch, and the softest brushing.';
  if (action === 'teeth' && personality === 'musical') return 'Scrub-a-dub in perfect rhythm!';
  if (action === 'play' && personality === 'sporty') return 'Ready, set… PEEKABOO!';
  return action === 'feed' ? 'Here comes a lovely treat!'
    : action === 'brush' ? 'Long, gentle strokes across the fur.'
      : action === 'teeth' ? 'Six little scrubs for a giant grin.'
        : 'Where did your Boo go?';
}
