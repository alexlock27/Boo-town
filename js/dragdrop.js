// js/dragdrop.js — RUN16: one drag-and-drop implementation for the literacy games and
// Teach Me 2.0's TRY steps.
//
// Four screens need "pick this up, put it there" (Blend It's tiles, Story Order's panels,
// the lesson sort/place/order steps). Writing that four times would give four sets of
// pointer bugs, so it lives here once.
//
// TWO WAYS TO MOVE EVERY PIECE, ALWAYS. Dragging is the nice way, but a drag is a hard
// motor skill for a small hand, impossible with a switch or a keyboard, and awkward on a
// trackpad. So every draggable is ALSO tappable: tap the piece to pick it up (it lifts and
// says so), tap a target to drop it. Neither path is a fallback bolted on afterwards —
// both run through the same onDrop, so a feature that works one way works both ways, and
// the tests exercise the tap path precisely because a child might only ever use that one.

import { REDUCED } from './ui.js';
import { sfx } from './sfx.js';

const TAP_SLOP = 8;        // px of movement below which a pointer gesture is a tap
let liftedGlobal = null;   // only one piece is ever lifted at a time, app-wide

export function clearLift() {
  if (liftedGlobal) { liftedGlobal.node.classList.remove('lifted'); liftedGlobal = null; }
}

/**
 * node       — the element the child moves
 * targets()  — [{ node, key }] drop zones, re-read on every gesture so a re-render is safe
 * onDrop(key, node, targetNode) — she put it somewhere. Return false to spring it back.
 * onNoDrop(node) — she let go over nothing.
 * onLift(node) — she picked it up (either way).
 * data       — anything; handed back through the api for the caller's own bookkeeping.
 */
export function makeDraggable(node, { targets, onDrop, onNoDrop = null, onLift = null, data = null, disabled = null } = {}) {
  let dragging = false, moved = false, sx = 0, sy = 0, pid = null;
  const isOff = () => (typeof disabled === 'function' ? disabled() : !!disabled);

  const zonesUnder = (x, y) => {
    for (const t of (targets() || [])) {
      if (!t || !t.node) continue;
      const r = t.node.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return t;
    }
    return null;
  };
  const clearOver = () => (targets() || []).forEach(t => t && t.node && t.node.classList.remove('over'));

  function reset() {
    node.style.transform = '';
    node.classList.remove('dragging');
    clearOver();
  }

  node.addEventListener('pointerdown', (e) => {
    if (isOff()) return;
    dragging = true; moved = false; pid = e.pointerId;
    sx = e.clientX; sy = e.clientY;
    try { node.setPointerCapture(e.pointerId); } catch { /* capture is a nicety, not a requirement */ }
    node.classList.add('dragging');
  });

  node.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - sx, dy = e.clientY - sy;
    if (!moved && Math.hypot(dx, dy) > TAP_SLOP) moved = true;
    if (!moved) return;
    node.style.transform = `translate(${dx}px, ${dy}px) scale(1.06)`;
    clearOver();
    const t = zonesUnder(e.clientX, e.clientY);
    if (t) t.node.classList.add('over');
  });

  function finish(e) {
    if (!dragging) return;
    dragging = false;
    try { node.releasePointerCapture(pid); } catch { /* already gone */ }
    if (!moved) { reset(); lift(); return; }          // a tap, not a drag
    const t = zonesUnder(e.clientX, e.clientY);
    reset();
    if (!t) { springBack(); onNoDrop && onNoDrop(node); return; }
    const ok = onDrop(t.key, node, t.node);
    if (ok === false) springBack();
  }
  node.addEventListener('pointerup', finish);
  node.addEventListener('pointercancel', () => { if (!dragging) return; dragging = false; reset(); springBack(); });

  function springBack() {
    if (REDUCED) return;
    node.classList.remove('springback'); void node.offsetWidth; node.classList.add('springback');
  }

  // ---- the tap path -------------------------------------------------------------------
  // Tap the piece: it lifts. Tap a target: it lands. Tap the piece again: it puts itself
  // back down. Nothing here is modal — she can always just drag instead.
  function lift() {
    if (liftedGlobal && liftedGlobal.node === node) { clearLift(); return; }
    clearLift();
    liftedGlobal = api;
    node.classList.add('lifted');
    sfx.tap();
    onLift && onLift(node);
  }
  function dropOn(key) {
    const t = (targets() || []).find(z => z && z.key === key);
    if (!t) return false;
    clearLift();
    const ok = onDrop(key, node, t.node);
    if (ok === false) springBack();
    return ok !== false;
  }

  const api = { node, data, lift, dropOn, isLifted: () => liftedGlobal === api, destroy() { if (liftedGlobal === api) clearLift(); } };
  return api;
}

/**
 * Wire a set of drop targets so tapping one lands whatever is currently lifted.
 * Returns a teardown. Call it once per TRY step / round, after the targets exist.
 */
export function makeDropTargets(targets) {
  const offs = [];
  for (const t of targets) {
    if (!t || !t.node) continue;
    const handler = () => { if (liftedGlobal) liftedGlobal.dropOn(t.key); };
    t.node.addEventListener('click', handler);
    offs.push(() => t.node.removeEventListener('click', handler));
  }
  return () => offs.forEach(f => f());
}

export function liftedPiece() { return liftedGlobal; }
