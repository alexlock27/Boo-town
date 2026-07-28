// js/lessonstages.js — RUN16 W5: the HOOK scene and the three TRY primitives.
//
// Teach Me 2.0's shape is hook → show → try×3 → win. SHOW and WIN already existed (the
// two-ways cards and the RUN15 V3 ceremony); this file is the two new stages.
//
// THE HOOK is a ten-second animated scene that poses the idea as a problem the Boos have,
// so a lesson opens with a reason to care rather than with a definition. It is skippable
// at any moment — a child who has seen it four times should never be trapped by it.
//
// THE TRY STEPS are direct manipulation, never multiple choice (RUN16 W5, explicit). Nine
// lessons' worth of "do the thing" turned out to be three primitives:
//   sort  — drag items into bins (baskets, graphemes, story panels, or the guide herself)
//   place — drag tiles into gaps (in a sentence, a word frame, or an unfinished story)
//   order — drag panels into sequence
// Everything else is data. Each one reports back through the same small contract:
//   mount(container, step, { onDone, onWrong, say, react }) -> { hooks }
//
// A WRONG MOVE NEVER REWINDS. The piece springs back, the step stays exactly where it is,
// and the guide explains — with the authored line where the pack wrote one (the chips/sh
// line, the CHIP/SHIP trap, the hear/ear trick). Nothing here can send her backwards
// through the lesson, which was the specific complaint RUN12 and RUN16 both raise.

import { el, clear, REDUCED } from './ui.js';
import { renderGuide } from './art.js';
import { getState } from './state.js';
import { sfx } from './sfx.js';
import { renderWordArt } from './wordart.js';
import { renderStoryArt } from './storyart.js';
import { makeDraggable, makeDropTargets, clearLift } from './dragdrop.js';

export const HOOK_MS = 10000;   // the ten-second scene the brief asks for

// ---------------------------------------------------------------------------------------
// THE HOOK
// ---------------------------------------------------------------------------------------
// One scene shape covers all nine lessons: a Boo holds up what it has got wrong, the wrong
// thing sits there long enough to be read, and then it corrects itself while the guide
// says the line. `before` and `after` are authored per lesson.
// RUN18D D3: `after`/`cancel` are the SHELL's pause-aware pair. Without them the hook ran on
// bare setTimeout, so a child opening Teach Me for the very first time read the intro while
// the ten-second scene that poses the lesson's problem played out, resolved and finished
// behind the overlay — she met the answer before she had been shown the question. They
// default to setTimeout so a caller with no shell (there is none today) still works.
export function mountHook(container, lesson, { onDone, say, after = null, cancel = null }) {
  const hook = lesson.hook || { kind: 'sign', before: lesson.name, after: lesson.name, line: '' };
  const wrap = el('div', { class: 'tm-hook' });
  const scene = el('div', { class: 'tm-hook-scene' });
  const guide = (getState() || {}).guide;

  const board = el('div', { class: 'tm-hook-board', 'aria-live': 'polite' }, [
    el('span', { class: 'tm-hook-text', text: hook.before })
  ]);
  const cast = el('div', { class: 'tm-hook-cast' }, [
    el('div', { class: 'tm-hook-boo', html: booSVG(hook.scene) }),
    board
  ]);
  scene.appendChild(cast);
  if (hook.kind === 'panels') scene.appendChild(el('div', { class: 'tm-hook-panels', html: hookPanels() }));

  const bubble = el('div', { class: 'speech-bubble tm-bubble', style: { visibility: 'hidden' } });
  const guideRow = el('div', { class: 'tm-guide-row' }, [
    el('div', { class: 'tm-guide', html: renderGuide(guide, { view: 'head', size: 78 }) }),
    bubble
  ]);
  const next = el('button', { class: 'btn big tm-next', text: 'Show me ➜', onclick: () => finish() });
  wrap.append(el('div', { class: 'tm-stage-chip', text: '1 · The problem' }), scene, guideRow, next);
  container.appendChild(wrap);

  let ended = false;
  const timers = [];
  const schedule = after ? ((ms, fn) => after(ms, fn)) : ((ms, fn) => setTimeout(fn, ms));
  const unschedule = cancel || clearTimeout;
  const at = (ms, fn) => timers.push(schedule(REDUCED ? Math.min(ms, 400) : ms, fn));

  // beat 1: the muddle sits there. beat 2: it fixes itself and the guide names the idea.
  at(REDUCED ? 200 : 2600, () => {
    board.classList.add('fix');
    board.querySelector('.tm-hook-text').textContent = hook.after;
    sfx.tap();
  });
  at(REDUCED ? 260 : 3200, () => {
    bubble.textContent = hook.line;
    bubble.style.visibility = '';
    bubble.classList.add('pop');
    say(hook.line);
  });
  at(HOOK_MS, () => finish());

  function finish() {
    if (ended) return;
    ended = true;
    timers.forEach(unschedule);
    onDone();
  }
  return {
    skip: finish,
    hooks: { text: () => board.querySelector('.tm-hook-text').textContent, line: () => bubble.textContent }
  };
}

function hookPanels() {
  // the "story told backwards" hook: the last panel first, with the others behind it
  return ['kite5', 'kite1', 'kite3'].map((k, i) =>
    `<span class="tm-hook-panel${i === 0 ? ' first' : ''}">${renderStoryArt(k, { w: 92 })}</span>`).join('');
}
function booSVG(scene) {
  const g = (getState() || {}).guide;
  // the guide's own face fronts the scene, so the Boo in trouble is someone she knows
  return renderGuide(g, { view: 'head', size: 74 }) +
    `<span class="tm-hook-scene-tag" aria-hidden="true">${SCENE_TAG[scene] || ''}</span>`;
}
const SCENE_TAG = {
  boat: '⛵', confused: '❓', backwards: '🔁', muddle: '🔢', hop: '🦘',
  shop: '🛍️', share: '🍰', long: '📜', clock: '🕒'
};

// ---------------------------------------------------------------------------------------
// TRY 1: sort — drag items into bins
// ---------------------------------------------------------------------------------------
// Bins can be labelled baskets (sh / ch / th), story panels (find the middle) or the guide
// herself (odd one out). Items can be pictures or a flag. `mode:'odd'` means only the items
// that carry a bin belong anywhere at all.
export function mountSort(container, step, { onDone, onWrong, say, react }) {
  const wrap = el('div', { class: 'tm-try' });
  const bins = [];
  const placed = new Set();
  const needs = step.needs != null ? step.needs : step.items.filter(i => i.bin).length;

  const binRow = el('div', { class: 'tm-baskets' });
  step.bins.forEach(b => {
    const holds = el('div', { class: 'tm-basket-holds' });
    const node = el('div', { class: 'tm-basket' + (b.isGuide ? ' guide' : ''), dataset: { bin: b.key }, 'aria-label': b.label || b.key }, [
      b.art ? el('span', { html: renderStoryArt(b.art, { w: 104 }) })
        : b.isGuide ? el('span', { class: 'tm-basket-guide', html: renderGuide((getState() || {}).guide, { view: 'head', size: 64 }) })
          : el('span', { class: 'tm-basket-label', text: b.label }),
      holds
    ]);
    binRow.appendChild(node);
    bins.push({ key: b.key, node, holds, spec: b });
  });

  const tray = el('div', { class: 'tm-drags' });
  const pieces = [];
  step.items.forEach(item => {
    const node = el('div', {
      class: 'tm-drag' + (item.isFlag ? ' word tm-flag' : ''), dataset: { item: item.key },
      role: 'button', tabindex: '0', 'aria-label': item.word || item.label || item.key
    }, item.isFlag
      ? [el('span', { text: item.label })]
      : [el('span', { html: renderWordArt(item.art || item.key, { size: 68, label: item.word || item.key }) })]);
    tray.appendChild(node);
    const drag = makeDraggable(node, {
      targets: () => bins.map(b => ({ node: b.node, key: b.key })),
      data: item,
      disabled: () => placed.has(item.key),
      onDrop: (binKey) => drop(item, binKey, node),
      onLift: () => say('Now tap a basket.')
    });
    pieces.push({ item, node, drag });
    node.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); drag.lift(); } });
  });
  const untangle = makeDropTargets(bins.map(b => ({ node: b.node, key: b.key })));

  wrap.append(
    el('p', { class: 'tm-try-instruction', text: step.instruction }),
    binRow, tray, el('div', { class: 'tm-feedback', 'aria-live': 'polite' })
  );
  container.appendChild(wrap);
  say(step.instruction);

  function feedback(t) { wrap.querySelector('.tm-feedback').textContent = t || ''; }

  function drop(item, binKey, node) {
    if (placed.has(item.key)) return false;
    const bin = bins.find(b => b.key === binKey);
    if (item.bin === binKey) {
      placed.add(item.key);
      node.classList.add('placed');
      sfx.correct();
      feedback('');
      bin.holds.appendChild(el('span', { class: 'tm-held', html: item.isFlag ? '' : renderWordArt(item.art || item.key, { size: 34, label: item.word || item.key }) }));
      if (item.isFlag) bin.node.classList.add('flagged');
      if (placed.size >= needs) { untangle(); clearLift(); onDone(); }
      return true;
    }
    // wrong: the basket wobbles and the guide names what she dropped (the authored line)
    sfx.oops();
    bin.node.classList.remove('wobble'); void bin.node.offsetWidth; bin.node.classList.add('wobble');
    const line = typeof step.wrong === 'function' ? step.wrong(item, binKey) : (step.wrong || 'Not that one — listen again!');
    feedback(line);
    react(line);
    onWrong(line);
    return false;
  }

  return {
    hooks: {
      kind: 'sort',
      placed: () => [...placed],
      binsOf: () => bins.map(b => b.key),
      drop: (itemKey, binKey) => { const p = pieces.find(x => x.item.key === itemKey); return p ? drop(p.item, binKey, p.node) : false; },
      tapDrop: (itemKey, binKey) => { const p = pieces.find(x => x.item.key === itemKey); if (!p) return false; p.drag.lift(); bins.find(b => b.key === binKey).node.click(); return true; },
      solve: () => { for (const p of pieces) if (p.item.bin && !placed.has(p.item.key)) drop(p.item, p.item.bin, p.node); },
      feedback: () => wrap.querySelector('.tm-feedback').textContent
    },
    destroy: () => { untangle(); clearLift(); }
  };
}

// ---------------------------------------------------------------------------------------
// TRY 2: place — drag tiles into gaps
// ---------------------------------------------------------------------------------------
// A frame is a sentence with a gap ("Come over ___ and sit down."), a word frame with a
// picture above it ("_ _ ip" over a ship), a bare question with the gap at the end (the
// maths steps), or a row of story panels ending in a gap (what happens next).
export function mountPlace(container, step, { onDone, onWrong, say, react }) {
  const wrap = el('div', { class: 'tm-try' });
  const frames = [];
  const filled = new Set();

  const sentences = el('div', { class: 'tm-sentences' });
  step.frames.forEach((f, i) => {
    // no placeholder character: a '?' straight after a question mark reads as "worth??".
    // The dashed slot is the affordance; the accessible name carries the meaning.
    const gap = el('div', { class: 'tm-gap', dataset: { frame: String(i) }, 'aria-label': 'drop your answer here' });
    const row = el('div', { class: f.panels ? 'tm-sentence panels' : 'tm-sentence' });
    if (f.pic) row.appendChild(el('span', { class: 'tm-frame-pic', html: renderWordArt(f.pic, { size: 62, label: f.pic }) }));
    if (f.panels) f.panels.forEach(k => row.appendChild(el('span', { class: 'tm-mini-panel', html: renderStoryArt(k, { w: 92 }) })));
    if (f.pre) row.appendChild(el('span', { text: f.pre }));
    row.appendChild(gap);
    if (f.post) row.appendChild(el('span', { text: f.post }));
    sentences.appendChild(row);
    frames.push({ spec: f, gap, row, index: i });
  });

  const tray = el('div', { class: 'tm-drags' });
  const pieces = [];
  step.tiles.forEach(tile => {
    const node = el('div', {
      class: 'tm-drag' + (tile.art ? '' : ' word'), dataset: { tile: tile.key },
      role: 'button', tabindex: '0', 'aria-label': tile.label || tile.key
    }, tile.art
      ? [el('span', { html: renderStoryArt(tile.art, { w: 92, label: tile.label || tile.key }) }), el('span', { class: 'tm-tile-word', text: tile.label || '' })]
      : [el('span', { text: tile.label })]);
    tray.appendChild(node);
    const drag = makeDraggable(node, {
      targets: () => frames.filter(f => !filled.has(f.index)).map(f => ({ node: f.gap, key: f.index })),
      data: tile,
      onDrop: (frameIdx) => drop(tile, frameIdx, node),
      onLift: () => say('Now tap the gap it belongs in.')
    });
    pieces.push({ tile, node, drag });
    node.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); drag.lift(); } });
  });
  let untangle = makeDropTargets(frames.map(f => ({ node: f.gap, key: f.index })));

  wrap.append(
    el('p', { class: 'tm-try-instruction', text: step.instruction }),
    sentences, tray, el('div', { class: 'tm-feedback', 'aria-live': 'polite' })
  );
  container.appendChild(wrap);
  say(step.instruction);

  function feedback(t) { wrap.querySelector('.tm-feedback').textContent = t || ''; }

  function drop(tile, frameIdx, node) {
    const f = frames[frameIdx];
    if (!f || filled.has(frameIdx)) return false;
    if (tile.key === f.spec.answer) {
      filled.add(frameIdx);
      f.gap.textContent = tile.label || tile.key;
      f.gap.classList.add('filled');
      if (tile.art) { f.gap.textContent = ''; f.gap.appendChild(el('span', { html: renderStoryArt(tile.art, { w: 84, label: tile.label }) })); }
      sfx.correct();
      feedback('');
      // a tile is used up only when every gap that wants it is filled
      if (step.frames.every((fr, i) => filled.has(i) || fr.answer !== tile.key)) node.classList.add('placed');
      if (filled.size >= frames.length) { untangle(); clearLift(); onDone(); }
      return true;
    }
    // wrong: spring back and EXPLAIN. An authored trap line wins over the generic why,
    // because a child who made a real word deserves to be told she made a real word.
    sfx.oops();
    const trap = f.spec.traps && f.spec.traps[tile.key];
    const why = step.why || {};
    const line = trap || why[tile.key] || why['*'] || f.spec.why || 'Not that one — have another look!';
    feedback(line);
    react(line);
    onWrong(line, !!trap);
    return false;
  }

  return {
    hooks: {
      kind: 'place',
      filled: () => [...filled],
      gapText: (i) => frames[i].gap.textContent,
      drop: (tileKey, frameIdx) => { const p = pieces.find(x => x.tile.key === tileKey); return p ? drop(p.tile, frameIdx, p.node) : false; },
      tapDrop: (tileKey, frameIdx) => { const p = pieces.find(x => x.tile.key === tileKey); if (!p) return false; p.drag.lift(); frames[frameIdx].gap.click(); return true; },
      solve: () => { frames.forEach((f, i) => { if (!filled.has(i)) { const p = pieces.find(x => x.tile.key === f.spec.answer); if (p) drop(p.tile, i, p.node); } }); },
      answers: () => frames.map(f => f.spec.answer),
      feedback: () => wrap.querySelector('.tm-feedback').textContent
    },
    destroy: () => { untangle(); clearLift(); }
  };
}

// ---------------------------------------------------------------------------------------
// TRY 3: order — drag panels into sequence
// ---------------------------------------------------------------------------------------
export function mountOrder(container, step, { onDone, say }) {
  const wrap = el('div', { class: 'tm-try' });
  const n = step.panels.length;
  let order = shuffleNoSolve(n);
  const strip = el('div', { class: 'so-strip tm-order' });
  wrap.append(el('p', { class: 'tm-try-instruction', text: step.instruction }), strip, el('div', { class: 'tm-feedback', 'aria-live': 'polite' }));
  container.appendChild(wrap);
  say(step.instruction);
  let nodes = [], untangle = null, finished = false;
  draw();

  function draw() {
    clear(strip);
    if (untangle) { untangle(); untangle = null; }
    nodes = order.map((p, slot) => {
      const panel = step.panels[p];
      const node = el('div', { class: 'so-panel', dataset: { panel: String(p), slot: String(slot) }, role: 'button', tabindex: '0', 'aria-label': `${slot + 1}: ${panel.caption}` }, [
        el('span', { class: 'so-slot-n', text: String(slot + 1) }),
        el('span', { html: renderStoryArt(panel.art, { w: 116, label: panel.caption }) }),
        el('span', { class: 'so-caption', text: panel.caption })
      ]);
      strip.appendChild(node);
      return node;
    });
    const targets = () => nodes.map((node, i) => ({ node, key: i }));
    nodes.forEach((node, i) => {
      const drag = makeDraggable(node, { targets, disabled: () => finished, onDrop: (b) => { if (b === i) return false; swap(i, b); return true; } });
      node.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); drag.lift(); } });
    });
    untangle = makeDropTargets(targets());
  }
  function swap(a, b) {
    if (finished) return;
    [order[a], order[b]] = [order[b], order[a]];
    sfx.tap();
    draw();
    if (order.every((v, i) => v === i)) {
      finished = true;
      sfx.correct();
      if (untangle) untangle();
      clearLift();
      onDone();
    }
  }
  return {
    hooks: {
      kind: 'order',
      order: () => order.slice(),
      swap: (a, b) => swap(a, b),
      tapSwap: (a, b) => { nodes[a].dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); nodes[a].dispatchEvent(new PointerEvent('pointerup', { bubbles: true })); nodes[b].click(); },
      solve: () => { for (let i = 0; i < n && !finished; i++) { if (order[i] !== i) swap(i, order.indexOf(i)); } }
    },
    destroy: () => { if (untangle) untangle(); clearLift(); }
  };
}

function shuffleNoSolve(n) {
  const a = Array.from({ length: n }, (_, i) => i);
  let guard = 0;
  do {
    for (let i = a.length - 1; i > 0; i--) { const j = (Math.random() * (i + 1)) | 0; [a[i], a[j]] = [a[j], a[i]]; }
  } while (guard++ < 100 && a.every((v, i) => v === i));
  return a;
}

// The one door every TRY step comes through, so teachme.js does not care which it got.
export function mountTryStep(container, step, handlers) {
  if (step.kind === 'sort') return mountSort(container, step, handlers);
  if (step.kind === 'order') return mountOrder(container, step, handlers);
  return mountPlace(container, step, handlers);
}
