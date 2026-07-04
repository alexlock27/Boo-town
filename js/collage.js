// js/collage.js — Collage maker (RUN3 C6). Choose a background, place stickers of her own
// Boos (with accessories), props and text; drag to move, scale + rotate; save to the gallery.
// The scene is authored as inline SVG so it rasterises to PNG cleanly (no tainted canvas).

import { el, clear, backControl } from './ui.js';
import { getState } from './state.js';
import { sfx, music } from './sfx.js';
import { renderItem } from './art.js';
import { resolveItem, ownedCustomItems } from './customs.js';
import { COLLECTIBLES } from '../data/catalogue.js';
import { equippedArt } from './accessories.js';
import { saveArtwork } from './studio.js';

const W = 640, H = 480;
const BACKGROUNDS = [
  { id: 'meadowDay', name: 'Meadow', sky: ['#8FC7FF', '#C9EBff'], ground: '#9AE6B4' },
  { id: 'meadowNight', name: 'Night', sky: ['#1E1550', '#3B2E7E'], ground: '#2E7D5B', stars: true },
  { id: 'beach', name: 'Beach', sky: ['#8FD3FF', '#FFF3C9'], ground: '#FFE29A' },
  { id: 'stage', name: 'Stage', sky: ['#3B2E7E', '#6B4BA8'], ground: '#5A3E8E', spot: true },
  { id: 'hilltop', name: 'Hilltop', sky: ['#B39DFF', '#E9DEFF'], ground: '#7FD8C3' },
  { id: 'purple', name: 'Purple', sky: ['#6B4BA8', '#6B4BA8'], ground: '#6B4BA8' }
];
const PROPS = ['🌸', '🌟', '🎈', '🍰', '🌈', '🍄', '🎀', '☀️', '🌙', '🦋', '🌳', '💜'];
const TEXT_COLOURS = ['#FF7AC6', '#35D0BA', '#FFC93C', '#2A1B4E'];

export function mount(container, params, ctx) {
  music.play('calm');
  const root = el('div', { class: 'collage-screen' });
  const header = el('header', { class: 'studio-header' }, [
    backControl(() => ctx.go('studio')),
    el('h2', { text: '🖼️ Collage' })
  ]);

  let bg = BACKGROUNDS[0];
  const stickers = [];   // { g, x, y, scale, rot }
  let selected = null;

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('class', 'collage-svg');
  const bgLayer = document.createElementNS(svgNS, 'g');
  const artLayer = document.createElementNS(svgNS, 'g');
  svg.append(bgLayer, artLayer);
  drawBg();

  function drawBg() {
    bgLayer.innerHTML = '';
    const grad = `<defs><linearGradient id="csky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bg.sky[0]}"/><stop offset="1" stop-color="${bg.sky[1]}"/></linearGradient></defs>`;
    let extra = '';
    if (bg.stars) for (let i = 0; i < 26; i++) extra += `<circle cx="${(i * 53 % W)}" cy="${(i * 37 % 300)}" r="2" fill="#fff" opacity="0.7"/>`;
    if (bg.spot) extra += `<polygon points="${W / 2},60 ${W / 2 - 140},${H} ${W / 2 + 140},${H}" fill="#FFF3C9" opacity="0.25"/>`;
    bgLayer.innerHTML = grad + `<rect width="${W}" height="${H}" fill="url(#csky)"/>` + `<rect y="${H * 0.62}" width="${W}" height="${H * 0.38}" fill="${bg.ground}"/>` + extra;
  }

  function addSticker(inner, w) {
    const g = document.createElementNS(svgNS, 'g');
    g.innerHTML = inner;
    const s = { g, x: W / 2 + (Math.random() * 80 - 40), y: H / 2 + (Math.random() * 60 - 30), scale: 1, rot: 0, w: w || 90 };
    stickers.push(s); artLayer.appendChild(g);
    apply(s); attachDrag(s); select(s);
    return s;
  }
  function apply(s) { s.g.setAttribute('transform', `translate(${s.x} ${s.y}) rotate(${s.rot}) scale(${s.scale}) translate(${-s.w / 2} ${-s.w / 2})`); }
  function select(s) { selected = s; stickers.forEach(x => x.g.classList.toggle('sel', x === s)); renderHandles(); }

  function attachDrag(s) {
    let dragging = false, ox = 0, oy = 0;
    s.g.style.cursor = 'grab';
    s.g.addEventListener('pointerdown', e => { e.stopPropagation(); s.g.setPointerCapture(e.pointerId); dragging = true; select(s); const p = pt(e); ox = p.x - s.x; oy = p.y - s.y; });
    s.g.addEventListener('pointermove', e => { if (!dragging) return; const p = pt(e); s.x = p.x - ox; s.y = p.y - oy; apply(s); });
    const end = () => { dragging = false; }; s.g.addEventListener('pointerup', end); s.g.addEventListener('pointercancel', end);
  }
  function pt(e) { const r = svg.getBoundingClientRect(); return { x: (e.clientX - r.left) / r.width * W, y: (e.clientY - r.top) / r.height * H }; }
  svg.addEventListener('pointerdown', () => { select(null); });

  // ---- controls for the selected sticker ----
  const handles = el('div', { class: 'collage-handles' });
  function renderHandles() {
    clear(handles);
    if (!selected) { handles.appendChild(el('span', { class: 'collage-hint', text: 'Tap a Boo, prop or ABC below to add it. Tap a sticker to move or resize it.' })); return; }
    const s = selected;
    handles.append(
      el('button', { class: 'btn soft', text: '➖', 'aria-label': 'smaller', onclick: () => { s.scale = Math.max(0.4, s.scale - 0.15); apply(s); } }),
      el('button', { class: 'btn soft', text: '➕', 'aria-label': 'bigger', onclick: () => { s.scale = Math.min(3, s.scale + 0.15); apply(s); } }),
      el('button', { class: 'btn soft', text: '↻', 'aria-label': 'rotate', onclick: () => { s.rot = (s.rot + 20) % 360; apply(s); } }),
      el('button', { class: 'btn danger', text: '🗑', 'aria-label': 'remove', onclick: () => { s.g.remove(); stickers.splice(stickers.indexOf(s), 1); select(null); } })
    );
  }
  renderHandles();

  // ---- palettes ----
  const bgRow = el('div', { class: 'collage-bgs' });
  BACKGROUNDS.forEach(b => bgRow.appendChild(el('button', { class: 'collage-bg' + (b === bg ? ' sel' : ''), text: b.name, onclick: () => { bg = b; sfx.tap(); [...bgRow.children].forEach(x => x.classList.remove('sel')); bgRow.children[BACKGROUNDS.indexOf(b)].classList.add('sel'); drawBg(); } })));

  const booRow = el('div', { class: 'collage-stickers' });
  const s = getState();
  const ownedBoos = [...COLLECTIBLES.filter(it => it.kind === 'boo' && s.inventory[it.id] > 0).map(it => resolveItem(it.id)), ...ownedCustomItems()];
  if (!ownedBoos.length) booRow.appendChild(el('span', { class: 'collage-hint', text: 'Win some Boos to add them here!' }));
  ownedBoos.forEach(item => { const btn = el('button', { class: 'collage-pick', html: renderItem(item, { size: 44, equipArt: item.kind === 'boo' && !item.custom ? equippedArt(item.id) : null }), 'aria-label': 'add Boo', onclick: () => { sfx.tap(); addSticker(renderItem(item, { size: 90, equipArt: item.kind === 'boo' && !item.custom ? equippedArt(item.id) : null }), 90); } }); booRow.appendChild(btn); });

  const propRow = el('div', { class: 'collage-stickers' });
  PROPS.forEach(p => propRow.appendChild(el('button', { class: 'collage-pick emoji', text: p, onclick: () => { sfx.tap(); addSticker(`<text font-size="60" text-anchor="middle" x="45" y="60">${p}</text>`, 90); } })));

  const textBtn = el('button', { class: 'btn soft', text: '🔤 Add text', onclick: () => addText() });
  function addText() {
    const t = (prompt ? prompt('Type a word or two:') : '') || '';
    if (!t.trim()) return;
    const col = TEXT_COLOURS[(Math.random() * TEXT_COLOURS.length) | 0];
    addSticker(`<text font-family="Fredoka, sans-serif" font-weight="700" font-size="40" fill="${col}" stroke="#2A1B4E" stroke-width="1" text-anchor="middle" x="60" y="50">${escapeXml(t.slice(0, 18))}</text>`, 120);
  }

  const saveBtn = el('button', { class: 'btn', text: '💾 Save to gallery', onclick: () => doSave() });
  const saveMsg = el('span', { class: 'gu-msg' });
  async function doSave() {
    select(null);
    const png = await rasterise();
    const res = await saveArtwork(png, 'collage');
    if (res.full) { saveMsg.textContent = 'Gallery is full (20)! Delete one first.'; saveMsg.classList.add('err'); }
    else { saveMsg.classList.remove('err'); saveMsg.textContent = 'Saved! 🌟'; sfx.star(); }
    setTimeout(() => saveMsg.textContent = '', 2600);
  }
  function rasterise() {
    return new Promise((resolve) => {
      const clone = svg.cloneNode(true);
      clone.setAttribute('xmlns', svgNS); clone.setAttribute('width', W); clone.setAttribute('height', H);
      const data = new XMLSerializer().serializeToString(clone);
      const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(data);
      const img = new Image();
      img.onload = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; const cx = c.getContext('2d'); cx.drawImage(img, 0, 0); resolve(c.toDataURL('image/png')); };
      img.onerror = () => resolve(svgToFallback());
      img.src = url;
    });
  }
  function svgToFallback() { const c = document.createElement('canvas'); c.width = W; c.height = H; const cx = c.getContext('2d'); cx.fillStyle = bg.sky[0]; cx.fillRect(0, 0, W, H); return c.toDataURL('image/png'); }

  root.append(header,
    el('div', { class: 'collage-stage' }, [svg]),
    handles,
    el('div', { class: 'collage-palette' }, [
      el('div', { class: 'cp-label', text: 'Background' }), bgRow,
      el('div', { class: 'cp-label', text: 'Your Boos' }), booRow,
      el('div', { class: 'cp-label', text: 'Props' }), propRow,
      el('div', { class: 'collage-actions' }, [textBtn, saveBtn, saveMsg])
    ]));
  container.appendChild(root);

  if (typeof window !== 'undefined') window.__collage = { addProp: () => addSticker(`<text font-size="60" text-anchor="middle" x="45" y="60">🌟</text>`, 90), count: () => stickers.length, save: doSave };
  return { unmount() {} };
}

function escapeXml(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
