// js/ui.js — shared UI: buttons, cards, dialogs, confetti, stars, hearts, meter.

import { sfx } from './sfx.js';

// RUN18B Y15: REDUCED is a LIVE BINDING (`let`, not `const`) so "Calm motion" can force the
// reduced path app-wide the moment it is switched on. ES module exports are live: every one
// of the ~30 modules that does `import { REDUCED } from './ui.js'` reads the current value
// on its next use, with no plumbing and no re-import. It is only ever written by
// setCalmMotion() below.
function osReducedMotion() {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
}
export let REDUCED = osReducedMotion();
let calmMotion = false;

// The grown-ups' switch. ON forces REDUCED regardless of the device setting; OFF hands the
// decision back to the device rather than overriding it the other way — a grown-up turning a
// comfort OFF must never take away a comfort the tablet itself was already providing.
export function setCalmMotion(on) {
  calmMotion = !!on;
  REDUCED = calmMotion || osReducedMotion();
  try { document.documentElement.classList.toggle('calm-motion', calmMotion); } catch {}
  return REDUCED;
}
export function calmMotionOn() { return calmMotion; }

// One step, off or on, at the authored 112.5%.
//
// THE MECHANISM IS NOT THE AUTHORED ONE, and here is why. The pack says "root font-size
// 112.5%", which assumes a rem-based sheet. css/styles.css is not one: it carries 435 px
// font-size declarations against 69 rem/em usages, and `:root` already sets 18px — so
// `font-size: 112.5%` computes against the browser's 16px default and lands on the SAME 18px
// it already had. Measured on the hub: forcing the root to 20.25px (a true +12.5%) moved the
// average rendered text from 17.78px to 18.15px — a 2% change from a switch that promises
// 12.5%. A control that does almost nothing is a lying control.
// The authored MAGNITUDE ships exactly: 112.5%, one step, off or on. It is applied as a zoom
// on the app's own root in css/styles.css, which scales the px type with everything else and
// therefore cannot put type out of proportion with the boxes around it.
export const BIGGER_TEXT_SCALE = '112.5%';
let biggerText = false;
export function setBiggerText(on) {
  biggerText = !!on;
  try { document.documentElement.classList.toggle('bigger-text', biggerText); } catch {}
  return biggerText;
}
export function biggerTextOn() { return biggerText; }

// Dev = served from a local machine. The guard below is loud here and silent in
// production: a developer wants the stack trace, a child must never see the word
// "undefined" on her screen because of it. `app.localhost` is the host the test board
// maps to 127.0.0.1, so suites get the strict behaviour too. (RUN18A H6)
export const IS_DEV = (() => {
  try { return /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname) || /\.localhost$/.test(location.hostname); }
  catch { return false; }
})();

// ---- DOM helper ----------------------------------------------------------
export function el(tag, props = {}, children = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k === 'text') n.textContent = v;
    // Object.assign onto a CSSStyleDeclaration SILENTLY DROPS custom properties: --foo is
    // not a settable IDL attribute, only setProperty() reaches it. Fourteen call sites were
    // passing --accent / --boo / --cols / --petal / --i this way and getting nothing, which
    // is why Echo Boos' lit state rendered no colour flash at all (RUN12 S0/S4).
    else if (k === 'style' && typeof v === 'object') {
      for (const [prop, val] of Object.entries(v)) {
        if (val === null || val === undefined) continue;
        if (prop.startsWith('--')) n.style.setProperty(prop, String(val));
        else n.style[prop] = val;
      }
    }
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(n.dataset, v);
    else if (v !== null && v !== undefined && v !== false) n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    // RUN18A H6 — THE TEMPLATE-LEAKAGE GUARD. `null` and `undefined` reaching a child as
    // the literal STRING is the shape of every leak this programme found: a template that
    // interpolated a missing value, or a ternary handed to the DOM's own append(), which
    // coerces null to the word "null" (el() skips it, append() prints it — that is exactly
    // how "null" ended up under the Expedition's campfire). In dev this throws, loudly, at
    // the moment of the mistake; in production it renders nothing, because a child must
    // never be shown the word "undefined" no matter what went wrong upstream.
    if (c === 'null' || c === 'undefined' || c === '[object Object]' || c === 'NaN') {
      if (IS_DEV) throw new Error(`el(): refusing to render the literal string "${c}" as a text child of <${tag}> — a value did not survive its template`);
      continue;
    }
    n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return n;
}

export function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }

// ---- HTML escaping (Security) --------------------------------------------
export function escapeHTML(str) {
  if (str == null) return '';
  return String(str).replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[m]);
}

// ---- long-press hardening (RUN6 C0.1) ------------------------------------
// On Amazon Silk / iOS Safari a steady press fires the native context menu
// (download / print / share) and a text-callout. Every press-and-hold target
// must suppress both so the hold reads as a hold. `.no-callout` carries the
// touch-callout / user-select CSS; this kills the contextmenu event, and the
// hold itself is driven by pointer events (never the native gesture).
export function suppressContextMenu(node) {
  if (!node) return node;
  node.classList.add('no-callout');
  node.addEventListener('contextmenu', e => { e.preventDefault(); e.stopPropagation(); });
  return node;
}

// ---- the shared back control (DASH_PATCH job 3 + RUN4 C1) -----------------
// One back button for every screen below the hub: a soft round control in the same
// top-left corner, returning exactly one level. `floating` pins it to the corner on
// screens without their own header row.
//
// Hardware/gesture back (RUN4 C1): each backControl registers its handler as THE
// current back action; the router clears it on every navigation. The popstate
// handler in main.js invokes it, so the Android back button/gesture does exactly
// what the on-screen control does — one level, confirm-on-leave kept, nothing at
// the hub (no action registered there).
//
// RUN18B Y11: a back action can be GUARDED — it asks before it acts (the game shell's
// "Leave this round?"). The router needs to know, because a browser/gesture back that lands
// on a round must raise that dialog rather than silently route away from a round in play.
let _backAction = null, _backGuarded = false;
export function setBackAction(fn, guarded = false) { _backAction = fn; _backGuarded = !!guarded; }
export function getBackAction() { return _backAction; }
export function backActionGuarded() { return _backGuarded; }

export function backControl(onBack, { floating = false, label = 'Back', guarded = false } = {}) {
  _backAction = onBack || null;
  _backGuarded = !!guarded;
  return el('button', {
    class: 'icon-btn back-btn' + (floating ? ' screen-back' : ''),
    'aria-label': label,
    html: `<svg viewBox="0 0 24 24" width="26" height="26"><path d="M15 5l-7 7 7 7" fill="none" stroke="var(--card)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    onclick: (e) => { e.stopPropagation(); try { sfx.tap(); } catch {} onBack && onBack(); }
  });
}

// ---- starfield -----------------------------------------------------------
export function starField(container, count = 50) {
  const frag = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    const s = document.createElement('i');
    const z = Math.random() * 2 + 1;
    s.style.width = s.style.height = z + 'px';
    s.style.left = (Math.random() * 100).toFixed(2) + '%';
    s.style.top = (Math.random() * 100).toFixed(2) + '%';
    s.style.setProperty('--o', (Math.random() * 0.6 + 0.3).toFixed(2));
    s.style.setProperty('--d', (Math.random() * 3 + 2).toFixed(1) + 's');
    frag.appendChild(s);
  }
  container.appendChild(frag);
}

// ---- star SVG (filled / outline) ----------------------------------------
function starSVG(filled, size) {
  const fill = filled ? 'var(--star)' : 'none';
  const stroke = filled ? '#E0A81E' : 'rgba(255,255,255,0.55)';
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" class="star-ic ${filled ? 'on' : 'off'}">
    <path d="M12 2.5l2.9 5.9 6.5.95-4.7 4.6 1.1 6.45L12 17.9l-5.8 3.05 1.1-6.45-4.7-4.6 6.5-.95z"
      fill="${fill}" stroke="${stroke}" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
}
export function starsRow(count, { max = 3, size = 34 } = {}) {
  let s = '';
  for (let i = 0; i < max; i++) s += starSVG(i < count, size);
  return `<span class="stars-row">${s}</span>`;
}

// RUN18B Y7 removed the hearts row from every tier: it counted down while the round carried
// on regardless, telling a child she was running out of something she was not. RUN18D
// deletes what was left of it — an unused renderer still carrying the aria-label "tries
// left", which is the exact wording RUN12 flagged as saying the opposite of the truth.
// (.hearts-row survives in css/styles.css only as a shared flex rule with .stars-row, and
// two suites assert the row is never drawn, which is the guarantee worth keeping.)

// ---- gift icon -----------------------------------------------------------
export function giftSVG(size = 44) {
  return `<svg viewBox="0 0 48 48" width="${size}" height="${size}" class="gift-ic">
    <rect x="9" y="21" width="30" height="21" rx="4" fill="var(--pop)" stroke="var(--ink)" stroke-width="2.4"/>
    <rect x="7" y="15" width="34" height="9" rx="3" fill="var(--zing)" stroke="var(--ink)" stroke-width="2.4"/>
    <rect x="21" y="15" width="6" height="27" fill="var(--star)" stroke="var(--ink)" stroke-width="2"/>
    <path d="M24 14 L13 8 L13 19 Z" fill="var(--star)" stroke="var(--ink)" stroke-width="2" stroke-linejoin="round"/>
    <path d="M24 14 L35 8 L35 19 Z" fill="var(--star)" stroke="var(--ink)" stroke-width="2" stroke-linejoin="round"/>
    <circle cx="24" cy="14" r="4" fill="var(--star)" stroke="var(--ink)" stroke-width="2"/>
  </svg>`;
}

// ---- confetti (one shared helper; canvas particles) ----------------------
let confettiCanvas = null;
export function confetti({ count = 90, power = 1, duration = 1600, origin } = {}) {
  if (REDUCED) return; // respect reduced motion: no particle storm
  if (!confettiCanvas) {
    confettiCanvas = el('canvas', { id: 'confetti-canvas', style: {
      position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '9000'
    }});
    document.body.appendChild(confettiCanvas);
  }
  const cv = confettiCanvas;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = window.innerWidth * dpr; cv.height = window.innerHeight * dpr;
  const cx = cv.getContext('2d');
  cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const W = window.innerWidth, H = window.innerHeight;
  const ox = origin ? origin.x : W / 2, oy = origin ? origin.y : H * 0.4;
  const colors = ['#FF7AC6', '#35D0BA', '#FFC93C', '#C6A9F0', '#8FC7FF', '#FFF8F0'];
  const parts = [];
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = (Math.random() * 6 + 3) * power;
    parts.push({
      x: ox, y: oy,
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 5 * power,
      g: 0.18 + Math.random() * 0.12,
      s: Math.random() * 7 + 4,
      rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.3,
      c: colors[(Math.random() * colors.length) | 0],
      life: 1
    });
  }
  confetti._active = true;
  const t0 = performance.now();
  function frame(t) {
    if (!confetti._active) { cx.clearRect(0, 0, W, H); return; }
    const dt = Math.min(32, t - (frame._last || t)); frame._last = t;
    cx.clearRect(0, 0, W, H);
    let alive = false;
    const elapsed = t - t0;
    for (const p of parts) {
      p.vy += p.g; p.x += p.vx; p.y += p.vy; p.rot += p.vr;
      p.life = Math.max(0, 1 - elapsed / duration);
      if (p.life > 0 && p.y < H + 20) {
        alive = true;
        cx.save();
        cx.translate(p.x, p.y); cx.rotate(p.rot);
        cx.globalAlpha = p.life;
        cx.fillStyle = p.c;
        cx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6);
        cx.restore();
      }
    }
    if (alive) requestAnimationFrame(frame);
    else cx.clearRect(0, 0, W, H);
  }
  requestAnimationFrame(frame);
}

// Stop and clear any in-flight confetti (called on screen navigation).
export function clearConfetti() {
  confetti._active = false;
  if (confettiCanvas) { const cx = confettiCanvas.getContext('2d'); cx && cx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height); }
}

// ---- modal dialog --------------------------------------------------------
// buttons: [{ label, value, kind }]. Returns a promise resolving to value.
export function dialog({ title, body, buttons = [{ label: 'OK', value: true }], dismissable = false }) {
  return new Promise(resolve => {
    const overlay = el('div', { class: 'overlay' });
    const card = el('div', { class: 'card dialog' });
    if (title) card.appendChild(el('h2', { text: title }));
    if (body) card.appendChild(typeof body === 'string' ? el('p', { html: body }) : body);
    const row = el('div', { class: 'dialog-btns' });
    for (const b of buttons) {
      row.appendChild(el('button', {
        class: 'btn ' + (b.kind || (b.value ? '' : 'soft')),
        text: b.label,
        onclick: () => { close(b.value); }
      }));
    }
    card.appendChild(row);
    overlay.appendChild(card);
    if (dismissable) overlay.addEventListener('click', e => { if (e.target === overlay) close(null); });
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('show'));
    function close(v) {
      overlay.classList.remove('show');
      setTimeout(() => overlay.remove(), 180);
      resolve(v);
    }
  });
}

// ---- gentle wobble on a wrong element ------------------------------------
export function wobble(node) {
  if (!node || REDUCED) return;
  node.classList.remove('wobble');
  void node.offsetWidth;
  node.classList.add('wobble');
  setTimeout(() => node.classList.remove('wobble'), 500);
}

// ---- small pop/sparkle at a point ----------------------------------------
export function sparkleAt(x, y) {
  if (REDUCED) return;
  const s = el('div', { class: 'sparkle-burst', style: { left: x + 'px', top: y + 'px' } });
  document.body.appendChild(s);
  setTimeout(() => s.remove(), 600);
}
