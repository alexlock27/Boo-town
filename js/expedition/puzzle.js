// RUN10 P16 — four gentle discovery puzzles.  Wrong attempts are funny information,
// never a lockout: budgets shape stars only, so every party always gets home together.
import { el, clear, backControl, REDUCED, confetti, wobble } from '../ui.js';
import { getState, mutate } from '../state.js';
import { NODES, BUDGETS, GUESTS, TOPPINGS } from '../../data/expedition.js';
import { BY_ID } from '../../data/catalogue.js';
import { genRule, genExclusiveRules, informativeNext, featuresOf } from '../attrengine.js';
import { freshCaper } from '../caper/state.js';
import { saveExpeditionPostcard, composePostcard } from './postcard.js';
import { renderItem, renderExpGlyph, renderGuide, renderTopping } from '../art.js';   // RUN18D: drawn toppings
import { speakMaybe, createGuideBubble } from '../guide.js';
import { addBond } from '../care.js';
import { POINTS } from '../../data/care.js';
import { stampJournal, hasStamp } from '../quests.js';
import { sfx } from '../sfx.js';

// RUN18C C3 — the puzzles in house style. The RULES ARE NOT TOUCHED: the engine, the
// budgets, the tier ladder and every predicate are exactly as RUN10 P16 and RUN18A H2 left
// them. What changes is that a child can now SEE who she is picking up — the dock rendered
// her Boos as their names in a row of grey buttons, which is the one thing a puzzle about
// what Boos LOOK LIKE cannot afford to do.
const CROSS_MS = 900;
const WOBBLE_MS = 360;
// The shared ui.js wobble runs 450ms (css .wobble -> @keyframes wob). The pack authors 360
// for a wrong guess here, so the Expedition drives its own at the authored number rather
// than leaving a constant in the source asserting something the screen does not do.
function shake(node) {
  if (!node || REDUCED) return;
  node.classList.remove('exp-wobble');
  void node.offsetWidth;
  node.style.setProperty('--exp-wobble-ms', `${WOBBLE_MS}ms`);
  node.classList.add('exp-wobble');
  setTimeout(() => node.classList.remove('exp-wobble'), WOBBLE_MS + 40);
}

const BUDGET_KEY = { bridges: 'sneezes', picnic: 'huffs', raft: 'failedSails', hotel: 'wrongRooms' };
// What the counter CALLS itself to her. The keys above index BUDGETS and must stay as they
// are; `failedSails: 0 / 3` and `wrongRooms: 0 / 6` were camelCase code on a child's screen.
const BUDGET_LABEL = { sneezes: 'sneezes', huffs: 'huffs', failedSails: 'wobbles', wrongRooms: 'wrong rooms' };
// The escalating wonder ladder. Rung 0 for `bridges` is REPLACED at build time by the rule
// the engine actually generated (RUN18A H2) — the string below is only the honest fallback
// for a party too thin to generate a rule from, and it no longer names a placeholder.
const WONDER = {
  bridges: ['One bridge is ticklish about something…', 'What do the crossers share?', 'Try a very different Boo!'],
  picnic: ['Grumps are fussy about ONE thing.', 'Watch what bounces OFF!', 'Compare the happy plates.'],
  raft: ['Neighbours share exactly ONE thing.', 'Too alike is wobbly too!', 'Fix the reddest corner first.'],
  hotel: ['Each floor likes a certain KIND.', 'Who lit their window up?', 'House the sure ones first.']
};

function party() {
  const ids = (getState().expedition || {}).party || [];
  return ids.map(id => BY_ID[id] || GUESTS.find(guest => guest.id === id)).filter(Boolean);
}
function starCount(wrong, budget, hintUsed) { return !hintUsed && wrong <= budget ? 3 : wrong <= Math.ceil(budget * 1.6) ? 2 : 1; }
function plural(key, number) { return `${BUDGET_LABEL[key] || key}: ${number}`; }
// The engine describes a group as "<value> <attribute-noun>", which is right for Boos
// ("pip species") and wrong for a plate of food — featuresOf() reads a topping's `kind` as
// its species. Strip the noun so a Grump asks for "sweet ones", never "sweet species".
function wanted(rule) { return String((rule && rule.text) || '').replace(/ (species|colour)$/, ''); }
// "a, b and c" — a list a nine-year-old reads as a list.
function listOf(items) { return items.length < 2 ? (items[0] || '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`; }

// RUN18C C3/C4 — NOT HAVING SOMETHING IS NOT SHARING IT.
//
// The Ferry Raft's whole rule, printed on its own banner, is "Neighbours share exactly ONE
// thing". This function counted four features as shared whenever they were EQUAL, and two
// of the four are booleans that are false for almost every Boo in the game: 44 catalogue
// Boos, 16 with an accessory, and none shiny by default. So two ordinary Boos "shared"
// not-wearing-a-hat and not-being-shiny before anyone looked at what they are or what
// colour they are — a floor of 2 on every pair, when the rule needs exactly 1.
//
// Measured on the eight starter Boos: ZERO of the 28 pairs shared exactly one thing (every
// pair shared 2 or 3), so no seating satisfied the law and THE RAFT COULD NOT BE COMPLETED
// AT ALL. A child with eight plain Boos could pull the sail forever. It has been that way
// since RUN10 P16 and nothing caught it, because no test had ever finished the node —
// the raft's own `try` hook pulled the sail on an empty deck and called that a solve.
//
// The repair is to the PREDICATE, not to the rule: a shared feature is now one they both
// HAVE. Same species, same colour, both wearing an accessory, both shiny. The sentence on
// the banner is unchanged and is finally true — which is the point, because a nine-year-old
// reading "share exactly one thing" is looking at what the two Boos have, not at what
// neither of them has. Logged for Alex in NEEDS_ALEX.md with the repro in BLOCKED.md.
export function sharedFeatureCount(a, b) {
  const aa = featuresOf(a), bb = featuresOf(b);
  const same = path => aa[path] === bb[path];
  const bothHave = path => !!aa[path] && !!bb[path];
  return ['species', 'colour'].filter(same).length + ['accessory', 'shiny'].filter(bothHave).length;
}
export function raftEdge(a, b) { return !a || !b ? 'empty' : sharedFeatureCount(a, b) === 1 ? 'green' : sharedFeatureCount(a, b) === 0 ? 'red' : 'amber'; }
export function raftValid(seats) {
  const width = 4;                       // the raft is always four across; only its LENGTH grows
  return seats.every((boo, index) => {
    if (!boo) return true;
    const right = index % width < width - 1 ? seats[index + 1] : null;
    const below = index + width < seats.length ? seats[index + width] : null;
    return raftEdge(boo, right) !== 'red' && raftEdge(boo, right) !== 'amber' && raftEdge(boo, below) !== 'red' && raftEdge(boo, below) !== 'amber';
  });
}

// Can these riders be seated on a deck of `size` seats (four across) so that every pair of
// neighbours shares exactly one thing? Backtracks down the seats: at each one, either sit a
// rider whose already-placed neighbours all agree, or leave it empty. Returns the seating,
// or null. Exported because it is the thing the raft's guarantee rests on.
//
// A solution ALWAYS exists for a big enough deck — a checkerboard leaves every rider with
// nothing but empty seats around them — which is what makes the loop in raftPuzzle finite.
export function packRaft(riders, size) {
  const placed = Array(size).fill(null), used = new Set();
  const around = idx => [idx % 4 ? idx - 1 : -1, idx % 4 < 3 ? idx + 1 : -1, idx - 4, idx + 4].filter(i => i >= 0 && i < size);
  const fits = (idx, boo) => around(idx).every(i => !placed[i] || raftEdge(boo, placed[i]) === 'green');
  const rec = (idx, left) => {
    if (!left) return true;
    if (idx >= size || size - idx < left) return false;
    for (const boo of riders) {
      if (used.has(boo.id) || !fits(idx, boo)) continue;
      placed[idx] = boo; used.add(boo.id);
      if (rec(idx + 1, left - 1)) return true;
      placed[idx] = null; used.delete(boo.id);
    }
    return rec(idx + 1, left);
  };
  return rec(0, riders.length) ? placed : null;
}

// The smallest deck (in rows of four, never fewer than the authored 4x3) that these riders
// can actually be seated on. THE RAFT IS NEVER BUILT UNWINNABLE — this is the guarantee,
// and it is made before a single seat is drawn rather than discovered by a child who has
// pulled the sail twenty times.
export function raftRowsFor(riders) {
  const start = Math.max(3, Math.ceil((riders.length + 4) / 4));
  for (let rows = start; rows <= riders.length + 3; rows++) if (packRaft(riders, rows * 4)) return rows;
  return riders.length + 3;
}

export function mount(container, params, ctx) {
  const root = el('div', { class: 'screen exp-puzzle' });
  container.appendChild(root);
  // Same trap as js/toddler.js: `spec` fell back for an unknown key but every BUDGETS /
  // WONDER / BUDGET_KEY lookup below still used the RAW param, so a stale node key threw
  // rather than degrading. Normalise once (RUN12 S1).
  const spec = NODES.find(entry => entry.key === params?.node) || NODES[0];
  const node = spec.key;
  const ex = getState().expedition || {};
  const tier = Math.max(1, Math.min(4, (ex.tiers || {})[node] || 1));
  const people = party();
  const budget = BUDGETS[node][BUDGET_KEY[node]][tier - 1];
  let wrong = 0, hintUsed = false, solved = [], finished = false, wonderIndex = 0;
  // A per-round copy, so a puzzle can replace a rung with the rule it actually generated
  // without mutating the shared authored table.
  const lines = WONDER[node].slice();
  // The rule banner. It holds the sentence the whole puzzle turns on, and it STAYS: the
  // status line below is the running commentary and is gone the moment she does anything,
  // so before this the rule was a thing she had four seconds to read and then lost.
  // THE BANNER IS THE RULE AND ONLY THE RULE. It carries `exp-puzzle-status` because the
  // rule IS this screen's status — the sentence everything else is measured against — and
  // the only thing allowed to rewrite it is the hint, which is a sharper statement of the
  // same rule. Play feedback goes to the live line under the board, so a wrong guess can
  // never take the rule off the screen. (Before RUN18C both were one <p>: the rule was
  // gone the instant she touched anything.)
  const ruleLine = el('p', { class: 'exp-rule-line exp-puzzle-status', text: lines[0] });
  const ruleBanner = el('div', { class: 'exp-rule card' }, [
    el('span', { class: 'exp-rule-guide', html: renderGuide(getState().guide, { view: 'head', size: 44 }) }),
    ruleLine
  ]);
  const status = el('p', { class: 'exp-live' });
  const counter = el('p', { class: 'exp-budget', text: `${plural(BUDGET_KEY[node], wrong)} / ${budget}` });
  const progress = el('p', { class: 'exp-progress' });
  const board = el('div', { class: `exp-puzzle-board exp-${node}` });
  const updateCounter = () => { counter.textContent = `${plural(BUDGET_KEY[node], wrong)} / ${budget}`; };
  // What she has DONE, beside what she has got wrong — the screen only ever counted her
  // mistakes. Set by each puzzle, because "across" and "served" are not the same thing.
  let progressLabel = () => '';
  const tickProgress = () => { progress.textContent = progressLabel(); progress.classList.remove('tick'); void progress.offsetWidth; progress.classList.add('tick'); };
  const setRule = text => { ruleLine.textContent = text; };
  // A Boo crosses, glides or hops to the thing she sent them to — 900ms, transform-only,
  // and skipped entirely under reduced motion so nothing is left half-moved.
  const crossTo = (boo, fromNode, toNode, kind) => new Promise(resolve => {
    if (REDUCED || !fromNode || !toNode || typeof document === 'undefined') { resolve(); return; }
    const a = fromNode.getBoundingClientRect(), b = toNode.getBoundingClientRect();
    if (!a.width || !b.width) { resolve(); return; }
    const ghost = el('div', { class: `exp-cross exp-cross-${kind}`, html: renderItem(boo, { size: 56 }) });
    ghost.style.left = `${Math.round(a.left + a.width / 2 - 28)}px`;
    ghost.style.top = `${Math.round(a.top + a.height / 2 - 28)}px`;
    ghost.style.setProperty('--dx', `${Math.round(b.left + b.width / 2 - (a.left + a.width / 2))}px`);
    ghost.style.setProperty('--dy', `${Math.round(b.top + b.height / 2 - (a.top + a.height / 2))}px`);
    document.body.appendChild(ghost);
    setTimeout(() => { ghost.remove(); resolve(); }, CROSS_MS);
  });
  // The dock tile for a Boo — REAL art at 64px with the name under it, which is the whole
  // point: the rule is about what they look like.
  const dockTile = (boo, onPick) => el('button', {
    class: 'exp-puzzle-boo', dataset: { id: boo.id }, 'aria-label': boo.name,
    onclick: event => onPick(boo, event.currentTarget)
  }, [
    el('span', { class: 'epb-art', html: renderItem(boo, { size: 64 }) }),
    el('b', { class: 'epb-name', text: boo.name })
  ]);
  const selectIn = (dock, target) => { dock.querySelectorAll('.selected').forEach(item => item.classList.remove('selected')); target.classList.add('selected'); };
  const wrongAt = (boo, tile, target, fallback) => {
    // The pack: the GUESSED BOO wobbles, and the line names the Boo and the rule it broke.
    // It used to wobble the thing she aimed at and say something funny about nobody.
    const named = api.wrongLine && api.wrongLine(boo);
    fail(named || fallback, tile || target);
    if (tile && target && tile !== target) shake(target);
    sfx.oops();
  };
  const wonder = () => { wonderIndex = Math.min(lines.length - 1, wonderIndex + 1); status.textContent = lines[wonderIndex]; };
  const fail = (message, target) => { wrong++; updateCounter(); status.textContent = message; if (target) shake(target); if (wrong % 2 === 0) setTimeout(wonder, 350); };
  const right = (message) => { status.textContent = message; sfx.chime(); tickProgress(); };
  const finish = () => {
    if (finished) return; finished = true;
    const stars = starCount(wrong, budget, hintUsed);
    let firstFullTrail = false;
    mutate(save => {
      save.expedition = save.expedition || { party: [], tiers: {}, progress: {} };
      save.expedition.progress = save.expedition.progress || {}; save.expedition.tiers = save.expedition.tiers || {};
      save.expedition.progress[node] = Math.max(save.expedition.progress[node] || 0, stars);
      if (stars === 3) save.expedition.tiers[node] = Math.min(4, (save.expedition.tiers[node] || 1) + 1);
      const finishedTrail = NODES.every(entry => entry.key === node || (save.expedition.progress[entry.key] || 0) > 0);
      if (finishedTrail && !save.expedition.full) {
        save.expedition.full = true;
        firstFullTrail = true;
        save.inventory = save.inventory || {}; save.inventory.boo_wander = Math.max(1, save.inventory.boo_wander || 0);
        if (!save.caper || !save.caper.open) save.caper = freshCaper();
      }
    });
    // A full trail is remembered as a Gallery postcard. It is deliberately best-effort:
    // reaching the gallery cap never interrupts the celebration or any earned progress.
    if (firstFullTrail) saveExpeditionPostcard(people, node).catch(() => {});
    status.textContent = `Everyone made it! ${'★'.repeat(stars)}`;
    if (!REDUCED) confetti({ count: 32, power: .55 });
    // RUN18C C4 — THE ENDING SHE NEVER SAW. The postcard has been composed since RUN10 P21
    // and went straight into the Gallery: the child finished a four-node trail and was
    // returned to a list of buttons. It is a ceremony now, and the friendship the party
    // earned on the way is announced instead of banked silently.
    if (firstFullTrail) { endingCeremony(); return; }
    // `from` is what tells the trail which segment the party has just earned the right to
    // walk (RUN18C C2) — without it the trail can only ever show them standing still.
    setTimeout(() => ctx.go('expedition', { trail: true, from: node }), 850);
  };
  // ---- RUN18C C4: the postcard, full screen, as a ceremony ---------------------------
  const BOND_LINE = 'Everyone\'s friendship grew!';
  const TWIGGY_LINE = 'What an adventure! The Boos sent you a postcard.';
  function endingCeremony() {
    // The bond the party earned. +6 each (data/care.js POINTS.expedition, untouched),
    // announced ONCE as a line about all of them rather than eight toasts. Guests are not
    // hers to befriend, so only the Boos she actually owns bank it.
    const mine = people.filter(boo => BY_ID[boo.id]);
    mine.forEach(boo => addBond(boo.id, 'expedition'));

    const card = el('div', { class: 'exp-postcard-card' });
    const overlay = el('div', { class: 'overlay exp-postcard-overlay', role: 'dialog', 'aria-label': 'The Boos sent you a postcard' }, [card]);
    const guide = createGuideBubble({ view: 'head', size: 64, side: 'left' });
    guide.root.classList.add('exp-postcard-guide');
    const shot = el('div', { class: 'exp-postcard-shot' }, [el('div', { class: 'exp-postcard-sparkle' })]);
    const bond = el('p', { class: 'exp-postcard-bond', text: `${BOND_LINE} +${POINTS.expedition} each` });
    const kept = hasStamp('expedition_postcard');
    const keep = el('button', { class: 'btn exp-postcard-keep', text: kept ? 'Kept in your Journal' : 'Keep it in the Journal', disabled: kept ? '' : undefined, onclick: () => {
      stampJournal('expedition_postcard');
      keep.textContent = 'Kept in your Journal'; keep.disabled = true;
      sfx.star(); if (!REDUCED) confetti({ count: 22, power: .5 });
    } });
    const done = el('button', { class: 'btn soft exp-postcard-done', text: 'Done', onclick: () => {
      overlay.remove();
      ctx.go('expedition', { trail: true, from: node });
    } });
    card.append(
      el('h2', { class: 'exp-postcard-title', text: 'A postcard from the trail!' }),
      shot, guide.root, bond,
      el('div', { class: 'exp-postcard-btns' }, [keep, done])
    );
    document.body.appendChild(overlay);
    // `.show` is what the shared .overlay base fades in (it ships at opacity 0); `.up` is
    // this card's own slide. Without the first, the whole ceremony is invisible.
    requestAnimationFrame(() => overlay.classList.add('show', 'up'));
    guide.sayText(TWIGGY_LINE);
    sfx.fanfare();
    setTimeout(() => { if (!REDUCED) confetti({ count: 36, power: .6 }); }, REDUCED ? 0 : 380);
    // The picture itself is composed on a canvas, so it arrives a beat after the card. The
    // card is complete without it — a failed compose must never hold the ending hostage.
    composePostcard(people, node)
      .then(({ png }) => { shot.prepend(el('img', { class: 'exp-postcard-img', src: png, alt: 'A postcard of your Boos on the trail' })); })
      .catch(() => { shot.prepend(el('p', { class: 'exp-postcard-fallback', text: 'The Boos waved from every corner of the trail!' })); });
    if (typeof window !== 'undefined') window.__expeditionEnding = {
      shown: () => document.body.contains(overlay),
      keep: () => keep.click(), done: () => done.click(),
      bondLine: () => bond.textContent, guideLine: () => guide.bubble.textContent,
      bonds: () => mine.map(boo => boo.id)
    };
  }

  // RUN18A H2: the hint used to say 'Hmm… try THAT one!' — it named neither the Boo it was
  // pointing at nor the rule it had spotted, so the highlight was the entire message and a
  // child who missed the four-second glow got nothing at all. Each puzzle now supplies the
  // sentence, and every sentence names the thing AND the rule, Odd-Boo-Out style. The
  // fallback is the next rung of the wonder ladder — never a placeholder.
  const showHint = () => {
    hintUsed = true;
    const candidate = (api.hintPick && api.hintPick()) || informativeNext(people, solved.map(id => ({ id })));
    const target = candidate && board.querySelector(`[data-id="${candidate.id}"]`);
    if (target) { target.classList.add('exp-hint'); setTimeout(() => target.classList.remove('exp-hint'), 4000); }
    // The hint sharpens the RULE, so it lands in the banner. Its fallback is the next rung
    // of the wonder ladder, which is a nudge rather than a rule — that goes to the live
    // line, and the banner keeps the rule it already has.
    const sharper = api.hintLine && api.hintLine(candidate);
    if (sharper) setRule(sharper); else status.textContent = lines[Math.min(1, lines.length - 1)];
  };
  const hint = el('button', { class: 'btn soft exp-hint-btn', text: '? Hint', onclick: showHint });
  root.append(
    el('div', { class: 'exp-puzzle-wrap' }, [
      el('h2', { text: spec.name }),
      ruleBanner,
      el('div', { class: 'exp-meters' }, [progress, counter]),
      board, status,
      el('div', { class: 'exp-puzzle-foot' }, [hint])
    ]),
    backControl(() => ctx.go('expedition', { trail: true }), { floating: true })
  );

  let api = { state: () => ({ node, tier, wrong, budget, solved: [...solved], hintUsed }), rules: () => [] };
  if (node === 'bridges') api = bridgePuzzle();
  else if (node === 'picnic') api = picnicPuzzle();
  else if (node === 'raft') api = raftPuzzle();
  else api = hotelPuzzle();
  // The banner is spoken on entry (the pack). It is said once, after the puzzle has had a
  // chance to replace rung 0 with the rule the engine actually generated.
  // Each puzzle may have replaced rung 0 with the rule the engine actually generated, so
  // the banner is set from `lines[0]` AFTER the puzzle has been built, and spoken once.
  setRule(lines[0]);
  tickProgress();
  speakMaybe(ruleLine.textContent);
  if (typeof window !== 'undefined') window.__expeditionPuzzle = { ...api, state: () => ({ node, tier, wrong, budget, solved: [...solved], hintUsed }), hint: showHint, ruleText: () => ruleLine.textContent, liveText: () => status.textContent };
  return { unmount() {} };

  function bridgePuzzle() {
    const rules = genExclusiveRules(people, 2, { tier }) || [];
    const dock = el('div', { class: 'exp-dock' });
    const bridges = el('div', { class: 'bridge-row' });
    let chosen = null, chosenTile = null;
    progressLabel = () => `Across: ${solved.length} of ${people.length}`;
    const cross = (side, target) => {
      if (!chosen || solved.includes(chosen.id)) return;
      const boo = chosen, tile = chosenTile;
      const good = rules[side] ? rules[side].pred(boo) : true;
      if (good) {
        // The line, the chime and the counter land AT ONCE — the Celebration Standard is
        // 300ms, and an earlier cut of this held every one of them behind the 900ms walk
        // AND locked the board for its duration, which is 7 seconds of waiting across a
        // party of eight. The walk is the visible travel, not the gate on her next move.
        solved.push(boo.id);
        target.classList.add('bridge-pass');
        tile?.classList.add('gone');
        right(`${boo.name} skips safely across!`);
        crossTo(boo, tile, target, 'walk').then(() => target.classList.remove('bridge-pass'));
        // ...and ONLY a Boo who is across leaves the dock. This line used to sit outside the
        // branch, so a wrong guess disabled the Boo for good: guess wrong twice and the
        // party could never all get across, guess wrong eight times and the screen had no
        // tappable control left at all. The file's own opening line is "never a lockout …
        // every party always gets home together" (RUN10 P16), and it has never been true.
        dock.querySelector(`[data-id="${boo.id}"]`)?.setAttribute('disabled', '');
      } else wrongAt(boo, tile, target, `${boo.name} tumbles back giggling!`);
      chosen = null; chosenTile = null;
      // let the last Boo actually arrive before the screen changes under them
      if (solved.length === people.length) setTimeout(finish, REDUCED ? 0 : CROSS_MS);
    };
    [0, 1].forEach(side => bridges.appendChild(el('button', { class: `bridge-guardian bridge-${side}`, 'aria-label': `Bridge ${side + 1}`, onclick: event => cross(side, event.currentTarget) }, [
      el('span', { class: 'bg-art', html: renderExpGlyph('guardian', { size: 66 }) }),
      el('b', { class: 'bg-name', text: `Bridge ${side + 1}` })
    ])));
    people.forEach(boo => dock.appendChild(dockTile(boo, (picked, tile) => {
      chosen = picked; chosenTile = tile; selectIn(dock, tile);
      status.textContent = `${picked.name} is ready — which bridge?`;
    })));
    board.append(bridges, dock);
    // RUN18A H2 — THE RULE IS SHOWN. `'One bridge sneezes at SOMETHING…'` was an authored
    // placeholder that shipped as literal screen text while the engine was generating real
    // rules the whole time. It says rules[0] because the two rules are an exclusive
    // partition of the party: bridge 1 admits rules[1] and therefore sneezes at exactly
    // rules[0]'s group. Deliberately "one bridge" and not "the left bridge" — which bridge
    // is which is the thing she is here to discover.
    if (rules[0]) lines[0] = `One bridge sneezes at ${rules[0].text}!`;
    status.textContent = 'Tap a Boo, then tap a bridge.';
    return {
      rules: () => rules,
      hintLine: (boo) => {
        const rule = boo && rules.find(r => r.pred(boo));
        return rule ? `${boo.name} will make one bridge sneeze — it sneezes at ${rule.text}!` : null;
      },
      // The pack's wrong-guess sentence: it names the Boo AND the rule the bridge holds.
      wrongLine: (boo) => {
        const rule = boo && rules.find(r => r.pred(boo));
        return rule ? `${boo.name} made it sneeze — it sneezes at ${rule.text}!` : null;
      },
      try: index => { chosen = people[index]; chosenTile = dock.querySelector(`[data-id="${people[index].id}"]`); const side = rules.findIndex(rule => rule.pred(chosen)); cross(side < 0 ? 0 : side, bridges.children[side < 0 ? 0 : side]); } };
  }

  function picnicPuzzle() {
    const grumpCount = tier === 1 ? 1 : tier < 4 ? 2 : 3;
    const rules = (grumpCount === 1 ? [genRule(TOPPINGS, { tier })] : genExclusiveRules(TOPPINGS, grumpCount, { tier })) || [];
    const selected = Array.from({ length: grumpCount }, () => []);
    const plates = el('div', { class: 'picnic-plates' });
    const tray = el('div', { class: 'picnic-tray' });
    let active = 0;
    progressLabel = () => `Plates served: ${solved.length} of ${grumpCount}`;
    const draw = () => {
      plates.innerHTML = '';
      selected.forEach((plate, index) => {
        const ready = plate.length === 3;
        const slots = el('span', { class: 'pp-slots' });
        for (let i = 0; i < 3; i++) slots.appendChild(el('span', { class: 'pp-slot' + (plate[i] ? ' full' : ''), html: plate[i] ? renderTopping(plate[i].id, { size: 30 }) : '' }));
        plates.appendChild(el('button', {
          class: `picnic-plate${active === index ? ' selected' : ''}${ready ? ' ready' : ''}`,
          'aria-label': `Grump ${index + 1}'s plate, ${plate.length} of 3 toppings`,
          onclick: () => { active = index; draw(); }
        }, [
          el('span', { class: 'pp-grump', html: renderExpGlyph(`grump${index + 1}`, { size: 54 }) }),
          slots,
          el('small', { class: 'pp-state', text: ready ? 'Serve!' : `${plate.length} of 3` })
        ]));
      });
    };
    const serve = () => {
      if (selected[active].length < 3) { status.textContent = 'The plate needs three little toppings.'; return; }
      const bad = selected[active].filter(item => !rules[active]?.pred(item));
      if (bad.length) {
        selected[active] = selected[active].filter(item => !bad.includes(item));
        const named = rules[active] ? `HUFF! That Grump only wants ${wanted(rules[active])} ones — ${bad.map(item => item.name).join(' and ')} bounced back!` : 'HUFF! Those toppings bounced back.';
        fail(named, plates.children[active]); sfx.oops(); draw(); return;
      }
      solved.push(String(active)); plates.children[active].disabled = true;
      right('Rainbow burp! That Grump is delighted.');
      draw();
      if (solved.length === grumpCount) finish();
    };
    // dataset id so the hint's highlight can find a topping — it only ever found Boos.
    TOPPINGS.forEach(item => tray.appendChild(el('button', { class: 'topping', dataset: { id: item.id }, onclick: () => {
      if (selected[active].length >= 3) { status.textContent = 'That plate is full — serve it!'; shake(plates.children[active]); return; }
      selected[active].push(item); sfx.tap(); draw();
    } }, [el('span', { class: 'tp-ic', html: renderTopping(item.id, { size: 40 }) }), el('b', { class: 'tp-name', text: item.name })])));
    board.append(plates, tray, el('button', { class: 'btn big exp-serve', text: 'Serve this plate', onclick: serve })); draw();
    // Same rule, same restraint. With ONE Grump there is no "which" to discover, so naming
    // the value would BE the answer — that plate keeps the authored ladder rung.
    const asked = rules.filter(Boolean).map(rule => wanted(rule));
    if (asked.length >= 2) lines[0] = `The Grumps want ${listOf(asked)} ones — but which Grump wants which?`;
    status.textContent = 'Put three toppings on the plate, then serve it.';
    return {
      rules: () => rules,
      // the hint belongs to the plate she is filling, and points at a topping, not a Boo
      hintPick: () => TOPPINGS.find(item => rules[active] && rules[active].pred(item)) || null,
      hintLine: () => rules[active] ? `This Grump only wants ${wanted(rules[active])} ones — try one of those!` : null,
      wrongLine: () => null,
      try: () => { for (let i = 0; i < grumpCount; i++) { active = i; selected[i] = TOPPINGS.filter(item => rules[i].pred(item)).slice(0, 3); serve(); } } };
  }

  function raftPuzzle() {
    const count = [8, 10, 12, 12][tier - 1];
    const riders = people.slice(0, count);
    // THE RAFT GROWS UNTIL IT CAN BE FINISHED. It was twelve seats whatever the tier asked
    // for, so a tier-3 party of twelve had to pack a 4x3 grid perfectly — every adjacency
    // green, and no empty seat anywhere to separate two Boos who did not suit each other.
    // Measured after the sharedFeatureCount repair: eight riders in twelve seats solved
    // 12/12 of the time, twelve riders in twelve seats 0/12. The empty seats ARE the slack
    // the law needs, so the deck is sized to the party it is carrying — and sized by
    // ASKING, not by a formula, so the answer is a guarantee and not an estimate.
    const seats = Array(raftRowsFor(riders) * 4).fill(null); let chosen = null;
    const grid = el('div', { class: 'raft-seats' }); const dock = el('div', { class: 'exp-dock' });
    let chosenTile = null;
    progressLabel = () => `Seated: ${seats.filter(Boolean).length} of ${riders.length}`;
    const draw = () => {
      grid.innerHTML = '';
      seats.forEach((boo, index) => {
        const neighbours = [index % 4 ? seats[index - 1] : null, index % 4 < 3 ? seats[index + 1] : null, index >= 4 ? seats[index - 4] : null, index < seats.length - 4 ? seats[index + 4] : null].filter(Boolean);
        const state = neighbours.reduce((worst, neighbour) => { const edge = raftEdge(boo, neighbour); return edge === 'red' ? 'red' : edge === 'amber' && worst !== 'red' ? 'amber' : worst; }, 'green');
        grid.appendChild(el('button', {
          class: `raft-seat ${boo ? state : 'empty'}`,
          'aria-label': boo ? `${boo.name} is in seat ${index + 1}` : `Empty seat ${index + 1}`,
          onclick: event => {
            if (boo) { seats[index] = null; sfx.tap(); draw(); tickProgress(); return; }
            if (!chosen) { status.textContent = 'Pick a Boo below first!'; shake(event.currentTarget); return; }
            const rider = chosen, tile = chosenTile;
            seats[index] = rider; chosen = null; chosenTile = null;
            crossTo(rider, tile, event.currentTarget, 'glide');
            sfx.tap(); draw(); tickProgress();
          }
        }, boo
          ? [el('span', { class: 'rs-art', html: renderItem(boo, { size: 44 }) }), el('b', { class: 'rs-name', text: boo.name })]
          : [el('span', { class: 'rs-art', html: renderExpGlyph('seat', { size: 34 }) })]));
      });
      dock.querySelectorAll('button').forEach(button => button.disabled = seats.some(boo => boo?.id === button.dataset.id));
    };
    riders.forEach(boo => dock.appendChild(dockTile(boo, (picked, tile) => {
      chosen = picked; chosenTile = tile; selectIn(dock, tile);
      status.textContent = `${picked.name} is waiting — tap a seat.`;
    })));
    const sail = () => {
      if (seats.filter(Boolean).length < riders.length) { fail(`SPLASH! ${riders.length - seats.filter(Boolean).length} more to seat before the raft can go.`, grid); sfx.oops(); return; }
      if (!raftValid(seats)) { fail('SPLASH! The raft gives a wobbly little bob — some neighbours are too alike, or not alike at all.', grid); sfx.oops(); return; }
      solved = riders.map(boo => boo.id); right('The sail catches a friendly breeze!'); board.classList.add('raft-sails');
      setTimeout(finish, REDUCED ? 150 : 700);
    };
    board.append(grid, dock, el('button', { class: 'btn big exp-sail', onclick: sail }, [
      el('span', { class: 'es-art', html: renderExpGlyph('raft', { size: 30 }) }), el('span', { text: 'Pull the sail' })
    ])); draw();
    status.textContent = 'Tap a Boo, then tap a seat.';
    // A seating that satisfies the law, found by backtracking down the seats: at each one,
    // either sit a rider whose placed neighbours all share exactly one thing with them, or
    // leave it empty. Twelve seats and eight riders make this cheap. It exists so `try`
    // can actually FINISH the raft — it was the only node whose hook pulled the sail on an
    // empty deck and called that a solve, which is why no scripted run had ever completed
    // a whole trail. It is a test hook, not a hint: nothing in the UI calls it.
    const solveSeats = () => {
      const packing = packRaft(riders, seats.length);
      if (!packing) return false;
      packing.forEach((boo, idx) => { seats[idx] = boo; });
      draw(); tickProgress();
      return true;
    };
    // The raft has no generated rule — its rule is the seating law itself, so the hint
    // states that law rather than pointing at a Boo.
    return { rules: () => [], hintLine: () => 'Sit Boos who share exactly ONE thing next to each other.',
      solve: solveSeats, try: () => { solveSeats(); sail(); }, seats: () => seats.slice(), valid: () => raftValid(seats) };
  }

  function hotelPuzzle() {
    let rules = genExclusiveRules(people, 3, { tier }) || [];
    const housed = [[], [], []]; let chosen = null, chosenTile = null, shifted = false;
    progressLabel = () => `Housed: ${solved.length} of ${people.length}`;
    const floors = el('div', { class: 'hotel-floors' }); const dock = el('div', { class: 'exp-dock' });
    const draw = () => {
      floors.innerHTML = '';
      [2, 1, 0].forEach(floor => {
        const rooms = el('div', { class: `hotel-floor floor-${floor}` });
        rooms.append(el('strong', { text: `Floor ${floor + 1}` }));
        for (let room = 0; room < 4; room++) {
          const guest = housed[floor][room];
          rooms.appendChild(el('button', {
            class: `hotel-room${guest ? ' warm' : ''}`,
            'aria-label': guest ? `${guest.name} is in room ${room + 1} on floor ${floor + 1}` : `Empty room ${room + 1} on floor ${floor + 1}`,
            onclick: event => house(floor, room, event.currentTarget)
          }, guest
            ? [el('span', { class: 'hr-art', html: renderItem(guest, { size: 40 }) }), el('b', { class: 'hr-name', text: guest.name })]
            : [el('span', { class: 'hr-art', html: renderExpGlyph('door', { size: 34 }) })]));
        }
        floors.appendChild(rooms);
      });
      dock.querySelectorAll('button').forEach(button => button.disabled = housed.flat().some(boo => boo?.id === button.dataset.id));
    };
    const house = (floor, room, target) => {
      if (!chosen) { if (!housed[floor][room]) { status.textContent = 'Pick a Boo below first!'; shake(target); } return; }
      if (housed[floor][room]) return;
      const boo = chosen, tile = chosenTile;
      if (rules[floor]?.pred(boo)) {
        housed[floor][room] = boo; solved.push(boo.id); chosen = null; chosenTile = null;
        crossTo(boo, tile, target, 'hop');
        right('Ding! A window warms up.');
      }
      else { wrongAt(boo, tile, target, 'The doorman politely sends that Boo back.'); }
      if (tier === 4 && !shifted && solved.length >= Math.ceil(people.length / 2)) {
        shifted = true; const changed = 1; rules[changed] = rules[changed]?.swap?.() || rules[changed]; housed[changed] = []; solved = housed.flat().filter(Boolean).map(boo => boo.id); status.textContent = 'NEW SHIFT! One floor changed its mind!';
      }
      draw(); if (solved.length === people.length) setTimeout(finish, REDUCED ? 0 : CROSS_MS);
    };
    people.forEach(boo => dock.appendChild(dockTile(boo, (picked, tile) => {
      chosen = picked; chosenTile = tile; selectIn(dock, tile);
      status.textContent = `${picked.name} is at the desk — which floor?`;
    })));
    board.append(floors, dock); draw();
    // The generated rule, on the banner, the way bridges does it (RUN18A H2): name what the
    // floors WANT without naming which floor wants which — that is the thing she is here to
    // discover. Rung 0 of the wonder ladder stays as the fallback for a party too thin to
    // generate three rules from.
    const wants = rules.filter(Boolean).map(rule => rule.text);
    if (wants.length >= 2) lines[0] = `The floors like ${listOf(wants)} — but which floor likes which?`;
    status.textContent = 'Tap a Boo, then tap a room.';
    return {
      rules: () => rules,
      hintLine: (boo) => {
        const floor = boo ? rules.findIndex(rule => rule && rule.pred(boo)) : -1;
        return floor >= 0 ? `${boo.name} belongs on Floor ${floor + 1} — that floor likes ${rules[floor].text}!` : null;
      },
      wrongLine: (boo) => {
        const floor = boo ? rules.findIndex(rule => rule && rule.pred(boo)) : -1;
        return floor >= 0 ? `Not that floor — ${boo.name} belongs on Floor ${floor + 1}, which likes ${rules[floor].text}!` : null;
      },
      try: index => { chosen = people[index]; chosenTile = dock.querySelector(`[data-id="${people[index].id}"]`); const floor = rules.findIndex(rule => rule.pred(chosen)); const target = floors.querySelector(`.floor-${floor < 0 ? 0 : floor} .hotel-room:not(.warm)`); house(floor < 0 ? 0 : floor, target ? [...target.parentNode.querySelectorAll('.hotel-room')].indexOf(target) : 0, target); } };
  }
}
