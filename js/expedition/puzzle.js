// RUN10 P16 — four gentle discovery puzzles.  Wrong attempts are funny information,
// never a lockout: budgets shape stars only, so every party always gets home together.
import { el, clear, backControl, REDUCED, confetti, wobble } from '../ui.js';
import { getState, mutate } from '../state.js';
import { NODES, BUDGETS, GUESTS, TOPPINGS } from '../../data/expedition.js';
import { BY_ID } from '../../data/catalogue.js';
import { genRule, genExclusiveRules, informativeNext, featuresOf } from '../attrengine.js';
import { freshCaper } from '../caper/state.js';

const BUDGET_KEY = { bridges: 'sneezes', picnic: 'huffs', raft: 'failedSails', hotel: 'wrongRooms' };
const WONDER = {
  bridges: ['One bridge sneezes at SOMETHING…', 'What do the crossers share?', 'Try a very different Boo!'],
  picnic: ['Grumps are fussy about ONE thing.', 'Watch what bounces OFF!', 'Compare the happy plates.'],
  raft: ['Neighbours share exactly ONE thing.', 'Too alike is wobbly too!', 'Fix the reddest corner first.'],
  hotel: ['Each floor likes a certain KIND.', 'Who lit their window up?', 'House the sure ones first.']
};

function party() {
  const ids = (getState().expedition || {}).party || [];
  return ids.map(id => BY_ID[id] || GUESTS.find(guest => guest.id === id)).filter(Boolean);
}
function starCount(wrong, budget, hintUsed) { return !hintUsed && wrong <= budget ? 3 : wrong <= Math.ceil(budget * 1.6) ? 2 : 1; }
function plural(key, number) { return `${key}: ${number}`; }

export function sharedFeatureCount(a, b) {
  const aa = featuresOf(a), bb = featuresOf(b);
  return ['species', 'colour', 'accessory', 'shiny'].filter(path => aa[path] === bb[path]).length;
}
export function raftEdge(a, b) { return !a || !b ? 'empty' : sharedFeatureCount(a, b) === 1 ? 'green' : sharedFeatureCount(a, b) === 0 ? 'red' : 'amber'; }
export function raftValid(seats) {
  const width = 4;
  return seats.every((boo, index) => {
    if (!boo) return true;
    const right = index % width < width - 1 ? seats[index + 1] : null;
    const below = index + width < seats.length ? seats[index + width] : null;
    return raftEdge(boo, right) !== 'red' && raftEdge(boo, right) !== 'amber' && raftEdge(boo, below) !== 'red' && raftEdge(boo, below) !== 'amber';
  });
}

export function mount(container, params, ctx) {
  const root = el('div', { class: 'screen exp-puzzle' });
  container.appendChild(root);
  const node = params?.node || 'bridges';
  const spec = NODES.find(entry => entry.key === node) || NODES[0];
  const ex = getState().expedition || {};
  const tier = Math.max(1, Math.min(4, (ex.tiers || {})[node] || 1));
  const people = party();
  const budget = BUDGETS[node][BUDGET_KEY[node]][tier - 1];
  let wrong = 0, hintUsed = false, solved = [], finished = false, wonderIndex = 0;
  const status = el('p', { class: 'exp-puzzle-status', text: WONDER[node][0] });
  const counter = el('p', { class: 'exp-budget', text: `${plural(BUDGET_KEY[node], wrong)} / ${budget}` });
  const board = el('div', { class: `exp-puzzle-board exp-${node}` });
  const updateCounter = () => { counter.textContent = `${plural(BUDGET_KEY[node], wrong)} / ${budget}`; };
  const wonder = () => { wonderIndex = Math.min(WONDER[node].length - 1, wonderIndex + 1); status.textContent = WONDER[node][wonderIndex]; };
  const fail = (message, target) => { wrong++; updateCounter(); status.textContent = message; if (target) wobble(target); if (wrong % 2 === 0) setTimeout(wonder, 350); };
  const finish = () => {
    if (finished) return; finished = true;
    const stars = starCount(wrong, budget, hintUsed);
    mutate(save => {
      save.expedition = save.expedition || { party: [], tiers: {}, progress: {} };
      save.expedition.progress = save.expedition.progress || {}; save.expedition.tiers = save.expedition.tiers || {};
      save.expedition.progress[node] = Math.max(save.expedition.progress[node] || 0, stars);
      if (stars === 3) save.expedition.tiers[node] = Math.min(4, (save.expedition.tiers[node] || 1) + 1);
      const finishedTrail = NODES.every(entry => entry.key === node || (save.expedition.progress[entry.key] || 0) > 0);
      if (finishedTrail && !save.expedition.full) {
        save.expedition.full = true;
        save.inventory = save.inventory || {}; save.inventory.boo_wander = Math.max(1, save.inventory.boo_wander || 0);
        if (!save.caper || !save.caper.open) save.caper = freshCaper();
      }
    });
    status.textContent = `Everyone made it! ${'★'.repeat(stars)}`;
    if (!REDUCED) confetti({ count: 32, power: .55 });
    setTimeout(() => ctx.go('expedition', { trail: true }), 850);
  };
  const showHint = () => {
    hintUsed = true;
    const candidate = informativeNext(people, solved.map(id => ({ id })));
    const target = candidate && board.querySelector(`[data-id="${candidate.id}"]`);
    if (target) { target.classList.add('exp-hint'); setTimeout(() => target.classList.remove('exp-hint'), 4000); }
    status.textContent = 'Hmm… try THAT one!';
  };
  const hint = el('button', { class: 'btn soft', text: '? Hint', onclick: showHint });
  root.append(el('h2', { text: spec.name }), status, counter, board, hint, backControl(() => ctx.go('expedition', { trail: true }), { floating: true }));

  let api = { state: () => ({ node, tier, wrong, budget, solved: [...solved], hintUsed }), rules: () => [] };
  if (node === 'bridges') api = bridgePuzzle();
  else if (node === 'picnic') api = picnicPuzzle();
  else if (node === 'raft') api = raftPuzzle();
  else api = hotelPuzzle();
  if (typeof window !== 'undefined') window.__expeditionPuzzle = { ...api, state: () => ({ node, tier, wrong, budget, solved: [...solved], hintUsed }), hint: showHint };
  return { unmount() {} };

  function bridgePuzzle() {
    const rules = genExclusiveRules(people, 2, { tier }) || [];
    const dock = el('div', { class: 'exp-dock' });
    const bridges = el('div', { class: 'bridge-row' });
    let chosen = null;
    const cross = (side, target) => {
      if (!chosen || solved.includes(chosen.id)) return;
      const good = rules[side] ? rules[side].pred(chosen) : true;
      if (good) { solved.push(chosen.id); status.textContent = `${chosen.name} skips safely across!`; target.classList.add('bridge-pass'); }
      else fail(`${chosen.name} tumbles back giggling!`, target);
      dock.querySelector(`[data-id="${chosen.id}"]`)?.setAttribute('disabled', ''); chosen = null;
      if (solved.length === people.length) finish();
    };
    [0, 1].forEach(side => bridges.appendChild(el('button', { class: `bridge-guardian bridge-${side}`, text: side ? '🌉  😮‍💨' : '😮‍💨  🌉', onclick: event => cross(side, event.currentTarget) })));
    people.forEach((boo, index) => dock.appendChild(el('button', { class: 'exp-puzzle-boo', dataset: { id: boo.id }, text: boo.name, onclick: event => { chosen = boo; dock.querySelectorAll('.selected').forEach(item => item.classList.remove('selected')); event.currentTarget.classList.add('selected'); status.textContent = `${boo.name} is ready at the bridge.`; } })));
    board.append(bridges, dock);
    return { rules: () => rules, try: index => { chosen = people[index]; const side = rules.findIndex(rule => rule.pred(chosen)); cross(side < 0 ? 0 : side, bridges.children[side < 0 ? 0 : side]); } };
  }

  function picnicPuzzle() {
    const grumpCount = tier === 1 ? 1 : tier < 4 ? 2 : 3;
    const rules = (grumpCount === 1 ? [genRule(TOPPINGS, { tier })] : genExclusiveRules(TOPPINGS, grumpCount, { tier })) || [];
    const selected = Array.from({ length: grumpCount }, () => []);
    const plates = el('div', { class: 'picnic-plates' });
    const tray = el('div', { class: 'picnic-tray' });
    let active = 0;
    const draw = () => {
      plates.innerHTML = '';
      selected.forEach((plate, index) => {
        const ready = plate.length === 3;
        plates.appendChild(el('button', { class: `picnic-plate${active === index ? ' selected' : ''}`, text: `${index === 0 ? '😤' : index === 1 ? '😒' : '🙄'} ${plate.map(item => item.icon).join(' ') || '… … …'}`, onclick: () => { active = index; draw(); } }));
        if (ready) plates.lastElementChild.appendChild(el('small', { text: 'Serve!' }));
      });
    };
    const serve = () => {
      if (selected[active].length < 3) { status.textContent = 'The plate needs three little toppings.'; return; }
      const bad = selected[active].filter(item => !rules[active]?.pred(item));
      if (bad.length) { selected[active] = selected[active].filter(item => !bad.includes(item)); fail('HUFF! Those toppings bounced back.', plates.children[active]); draw(); return; }
      solved.push(String(active)); status.textContent = 'Rainbow burp! That Grump is delighted.'; plates.children[active].disabled = true;
      if (solved.length === grumpCount) finish();
    };
    TOPPINGS.forEach(item => tray.appendChild(el('button', { class: 'topping', text: `${item.icon} ${item.name}`, onclick: () => { if (selected[active].length >= 3) { status.textContent = 'That plate is full — serve it!'; return; } selected[active].push(item); draw(); } })));
    board.append(plates, tray, el('button', { class: 'btn big', text: 'Serve this plate', onclick: serve })); draw();
    return { rules: () => rules, try: () => { for (let i = 0; i < grumpCount; i++) { active = i; selected[i] = TOPPINGS.filter(item => rules[i].pred(item)).slice(0, 3); serve(); } } };
  }

  function raftPuzzle() {
    const count = [8, 10, 12, 12][tier - 1];
    const riders = people.slice(0, count);
    const seats = Array(12).fill(null); let chosen = null;
    const grid = el('div', { class: 'raft-seats' }); const dock = el('div', { class: 'exp-dock' });
    const draw = () => {
      grid.innerHTML = '';
      seats.forEach((boo, index) => {
        const neighbours = [index % 4 ? seats[index - 1] : null, index % 4 < 3 ? seats[index + 1] : null, index > 3 ? seats[index - 4] : null, index < 8 ? seats[index + 4] : null].filter(Boolean);
        const state = neighbours.reduce((worst, neighbour) => { const edge = raftEdge(boo, neighbour); return edge === 'red' ? 'red' : edge === 'amber' && worst !== 'red' ? 'amber' : worst; }, 'green');
        grid.appendChild(el('button', { class: `raft-seat ${boo ? state : 'empty'}`, text: boo ? boo.name : '⚓', onclick: () => { if (!chosen || boo) return; seats[index] = chosen; chosen = null; draw(); } }));
      });
      dock.querySelectorAll('button').forEach(button => button.disabled = seats.some(boo => boo?.id === button.dataset.id));
    };
    riders.forEach(boo => dock.appendChild(el('button', { class: 'exp-puzzle-boo', dataset: { id: boo.id }, text: boo.name, onclick: event => { chosen = boo; dock.querySelectorAll('.selected').forEach(item => item.classList.remove('selected')); event.currentTarget.classList.add('selected'); } })));
    const sail = () => { if (seats.filter(Boolean).length < riders.length || !raftValid(seats)) { fail('SPLASH! The raft gives a wobbly little bob.', grid); return; } solved = riders.map(boo => boo.id); status.textContent = 'The sail catches a friendly breeze!'; board.classList.add('raft-sails'); setTimeout(finish, REDUCED ? 150 : 700); };
    board.append(grid, dock, el('button', { class: 'btn big', text: '⛵ Pull the sail', onclick: sail })); draw();
    return { rules: () => [], try: () => sail(), seats: () => seats.slice(), valid: () => raftValid(seats) };
  }

  function hotelPuzzle() {
    let rules = genExclusiveRules(people, 3, { tier }) || [];
    const housed = [[], [], []]; let chosen = null, shifted = false;
    const floors = el('div', { class: 'hotel-floors' }); const dock = el('div', { class: 'exp-dock' });
    const draw = () => {
      floors.innerHTML = '';
      [2, 1, 0].forEach(floor => {
        const rooms = el('div', { class: `hotel-floor floor-${floor}` });
        rooms.append(el('strong', { text: `Floor ${floor + 1}` }));
        for (let room = 0; room < 4; room++) rooms.appendChild(el('button', { class: `hotel-room${housed[floor][room] ? ' warm' : ''}`, text: housed[floor][room]?.name || '□', onclick: event => house(floor, room, event.currentTarget) }));
        floors.appendChild(rooms);
      });
      dock.querySelectorAll('button').forEach(button => button.disabled = housed.flat().some(boo => boo?.id === button.dataset.id));
    };
    const house = (floor, room, target) => {
      if (!chosen || housed[floor][room]) return;
      if (rules[floor]?.pred(chosen)) { housed[floor][room] = chosen; solved.push(chosen.id); chosen = null; status.textContent = 'Ding! A window warms up.'; }
      else { fail('The doorman politely sends that Boo back.', target); }
      if (tier === 4 && !shifted && solved.length >= Math.ceil(people.length / 2)) {
        shifted = true; const changed = 1; rules[changed] = rules[changed]?.swap?.() || rules[changed]; housed[changed] = []; solved = housed.flat().filter(Boolean).map(boo => boo.id); status.textContent = 'NEW SHIFT! One floor changed its mind!';
      }
      draw(); if (solved.length === people.length) finish();
    };
    people.forEach(boo => dock.appendChild(el('button', { class: 'exp-puzzle-boo', dataset: { id: boo.id }, text: boo.name, onclick: event => { chosen = boo; dock.querySelectorAll('.selected').forEach(item => item.classList.remove('selected')); event.currentTarget.classList.add('selected'); } })));
    board.append(floors, dock); draw();
    return { rules: () => rules, try: index => { chosen = people[index]; const floor = rules.findIndex(rule => rule.pred(chosen)); const target = floors.querySelector(`.floor-${floor < 0 ? 0 : floor} .hotel-room:not(.warm)`); house(floor < 0 ? 0 : floor, target ? [...target.parentNode.querySelectorAll('.hotel-room')].indexOf(target) : 0, target); } };
  }
}
