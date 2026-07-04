// js/ui.js — shared UI: buttons, cards, dialogs, confetti, stars, hearts, meter.

export const REDUCED = (() => {
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; }
})();

// ---- DOM helper ----------------------------------------------------------
export function el(tag, props = {}, children = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k === 'text') n.textContent = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(n.style, v);
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(n.dataset, v);
    else if (v !== null && v !== undefined && v !== false) n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of [].concat(children)) {
    if (c == null) continue;
    n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return n;
}

export function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); return node; }

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

// ---- hearts row (forgiveness indicator) ----------------------------------
export function heartsRow(remaining, { max = 3, size = 26 } = {}) {
  let s = '';
  for (let i = 0; i < max; i++) {
    const on = i < remaining;
    s += `<svg viewBox="0 0 24 24" width="${size}" height="${size}" class="heart-ic ${on ? 'on' : 'off'}">
      <path d="M12 21s-7.5-4.9-9.6-9.2C1 8.6 2.6 5.5 5.7 5.5c1.9 0 3.2 1.1 4.3 2.6C11 6.6 12.4 5.5 14.3 5.5c3.1 0 4.7 3.1 3.3 6.3C19.5 16.1 12 21 12 21z"
        fill="${on ? 'var(--pop)' : 'rgba(255,255,255,0.16)'}" stroke="${on ? '#D85AA6' : 'rgba(255,255,255,0.28)'}" stroke-width="1.4"/></svg>`;
  }
  return `<span class="hearts-row" aria-label="tries left ${remaining}">${s}</span>`;
}

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
  const t0 = performance.now();
  function frame(t) {
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
