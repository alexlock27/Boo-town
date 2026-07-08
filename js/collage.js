// js/collage.js — Collage maker (RUN3 C6). Choose a background, place stickers of her own
// Boos (with accessories), props and text; drag to move, scale + rotate; save to the gallery.
// The scene is authored as inline SVG so it rasterises to PNG cleanly (no tainted canvas).

import { el, clear, backControl } from './ui.js';
import { getState } from './state.js';
import { sfx, music } from './sfx.js';
import { renderItem, renderGuide } from './art.js';
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
  { id: 'purple', name: 'Purple', sky: ['#6B4BA8', '#6B4BA8'], ground: '#6B4BA8' },
  // RUN5 C6: four new places to make scenes in
  { id: 'bedroom', name: 'Bedroom', sky: ['#F3E7FE', '#E4D3F7'], ground: '#C6A9F0', bedroom: true },
  { id: 'space', name: 'Space', sky: ['#0D0A2E', '#241B5E'], ground: '#3B2E7E', space: true, stars: true },
  { id: 'undersea', name: 'Under the sea', sky: ['#1B7FC4', '#0E4E86'], ground: '#F2DDA6', undersea: true },
  { id: 'white', name: 'Blank', sky: ['#FFFFFF', '#FFFFFF'], ground: '#FFFFFF' }
];

// RUN5 C6: ~36 props in themed drawers. Emoji stand-ins (the established sticker
// style); a couple of drawers use tiny inline SVG where no emoji reads right.
const buntingSVG = `<g><path d="M5 20 Q45 34 85 20" stroke="#8A5A44" stroke-width="3" fill="none"/>${[0,1,2,3,4].map(i => `<path d="M${10 + i * 16} ${22 + Math.sin(i / 4 * Math.PI) * 8} l12 0 l-6 15 z" fill="${['#FF7AC6','#FFC93C','#35D0BA','#8FC7FF','#C6A9F0'][i]}" stroke="#2A1B4E" stroke-width="1.6"/>`).join('')}</g>`;
const partyHatSVG = `<g><path d="M45 12 L68 68 L22 68 Z" fill="#FF7AC6" stroke="#2A1B4E" stroke-width="3"/><circle cx="45" cy="12" r="7" fill="#FFC93C" stroke="#2A1B4E" stroke-width="2.4"/><path d="M28 52 q17 10 34 0" stroke="#FFC93C" stroke-width="4" fill="none"/></g>`;
const beachBallSVG = `<g><circle cx="45" cy="45" r="32" fill="#fff" stroke="#2A1B4E" stroke-width="3"/><path d="M45 13 A32 32 0 0 1 45 77 A50 50 0 0 0 45 13" fill="#FF7AC6"/><path d="M45 13 A32 32 0 0 0 45 77 A50 50 0 0 1 45 13" fill="#35D0BA"/><circle cx="45" cy="45" r="32" fill="none" stroke="#2A1B4E" stroke-width="3"/></g>`;
const glitterSVG = `<g fill="#FFC93C" stroke="#2A1B4E" stroke-width="1.4">${[[45,20,10],[22,48,7],[66,52,8],[38,66,5],[60,26,5]].map(([x,y,r]) => `<path d="M${x} ${y - r} L${x + r * 0.3} ${y - r * 0.3} L${x + r} ${y} L${x + r * 0.3} ${y + r * 0.3} L${x} ${y + r} L${x - r * 0.3} ${y + r * 0.3} L${x - r} ${y} L${x - r * 0.3} ${y - r * 0.3} Z"/>`).join('')}</g>`;
const PROP_DRAWERS = [
  { name: 'Party',    props: ['🎈', { svg: buntingSVG }, '🎂', '🎁', { svg: partyHatSVG }, '🎉'] },
  { name: 'Seaside',  props: ['🏰', '🪣', '🐚', '🦀', '🍦', { svg: beachBallSVG }] },
  { name: 'Nature',   props: ['🌸', '🍄', '🦋', '🌈', '☁️', '🐞'] },
  { name: 'Sparkle',  props: ['⭐', '💖', { svg: glitterSVG }, '👑', '💎', '🌙'] },
  { name: 'Favourites', props: ['🌟', '🍰', '🎀', '☀️', '🌳', '💜', '🌼', '🎵', '🍓', '🧁', '🪁', '🫧'] }
];

// Sticker letters (RUN5 C6): chunky A–Z in four colours for spelling onto collages.
const LETTER_COLOURS = ['#FF7AC6', '#35D0BA', '#FFC93C', '#8FC7FF'];
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
    // the four new scenes (RUN5 C6)
    if (bg.bedroom) extra += `
      <rect x="60" y="120" width="150" height="110" rx="8" fill="#FFF8F0" stroke="#2A1B4E" stroke-width="4"/>
      <rect x="75" y="135" width="55" height="80" fill="#BDE3FF"/><rect x="140" y="135" width="55" height="80" fill="#BDE3FF"/>
      <rect x="380" y="${H * 0.62 - 78}" width="200" height="80" rx="12" fill="#FF9FD2" stroke="#2A1B4E" stroke-width="4"/>
      <rect x="392" y="${H * 0.62 - 108}" width="58" height="42" rx="10" fill="#FFF8F0" stroke="#2A1B4E" stroke-width="4"/>
      <circle cx="300" cy="90" r="26" fill="#FFC93C" opacity="0.5"/>`;
    if (bg.space) extra += `
      <circle cx="120" cy="110" r="42" fill="#FF9F68" stroke="#2A1B4E" stroke-width="3"/><ellipse cx="120" cy="110" rx="64" ry="14" fill="none" stroke="#FFC93C" stroke-width="5"/>
      <circle cx="520" cy="80" r="24" fill="#8FC7FF" stroke="#2A1B4E" stroke-width="3"/>
      <circle cx="440" cy="200" r="10" fill="#C6A9F0"/><path d="M60 260 l16 6 -16 6 -6 16 -6 -16 -16 -6 16 -6 6 -16 z" fill="#FFF3B0"/>`;
    if (bg.undersea) {
      for (let i = 0; i < 12; i++) extra += `<circle cx="${(i * 91 + 40) % W}" cy="${(i * 67 + 30) % (H - 120)}" r="${4 + (i % 3) * 3}" fill="#BDE9FF" opacity="0.5"/>`;
      extra += `<path d="M80 ${H} q-14 -60 8 -110 q18 -42 2 -80" stroke="#2E9B6E" stroke-width="10" fill="none" stroke-linecap="round"/>
      <path d="M560 ${H} q16 -50 -6 -96 q-16 -36 0 -74" stroke="#35D0BA" stroke-width="10" fill="none" stroke-linecap="round"/>
      <circle cx="480" cy="330" r="5" fill="#BDE9FF" opacity="0.6"/>`;
    }
    const groundR = bg.id === 'white' ? '' : `<rect y="${H * 0.62}" width="${W}" height="${H * 0.38}" fill="${bg.ground}"/>`;
    bgLayer.innerHTML = grad + `<rect width="${W}" height="${H}" fill="url(#csky)"/>` + groundR + extra;
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
    if (!selected) { handles.appendChild(el('span', { class: 'collage-hint', text: 'Tap a Boo, prop or letter below to add it. Tap a sticker to move or resize it.' })); return; }
    const s = selected;
    // clearer labelled handles + a duplicate button (RUN5 C6)
    const mk = (cls, ic, label, fn) => el('button', { class: 'btn ' + cls + ' ch-btn', 'aria-label': label, onclick: fn }, [
      el('span', { class: 'ch-ic', text: ic }), el('span', { class: 'ch-lbl', text: label })
    ]);
    handles.append(
      mk('soft', '➖', 'Smaller', () => { s.scale = Math.max(0.4, s.scale - 0.15); apply(s); }),
      mk('soft', '➕', 'Bigger', () => { s.scale = Math.min(3, s.scale + 0.15); apply(s); }),
      mk('soft', '↻', 'Turn', () => { s.rot = (s.rot + 20) % 360; apply(s); }),
      mk('soft', '⧉', 'Copy', () => {
        const d = addSticker(s.g.innerHTML, s.w);
        d.scale = s.scale; d.rot = s.rot; d.x = Math.min(W - 30, s.x + 34); d.y = Math.min(H - 30, s.y + 26);
        apply(d); sfx.pop();
      }),
      mk('danger', '🗑', 'Remove', () => { s.g.remove(); stickers.splice(stickers.indexOf(s), 1); select(null); })
    );
  }
  renderHandles();

  // ---- palettes ----
  const bgRow = el('div', { class: 'collage-bgs' });
  BACKGROUNDS.forEach(b => bgRow.appendChild(el('button', { class: 'collage-bg' + (b === bg ? ' sel' : ''), text: b.name, onclick: () => { bg = b; sfx.tap(); [...bgRow.children].forEach(x => x.classList.remove('sel')); bgRow.children[BACKGROUNDS.indexOf(b)].classList.add('sel'); drawBg(); } })));

  const booRow = el('div', { class: 'collage-stickers' });
  const s = getState();
  // her own guide is a placeable sticker too (RUN5 C6), first in the row
  const guideBtn = el('button', { class: 'collage-pick', html: renderGuide(s.guide, { view: 'full', size: 44 }), 'aria-label': 'add my character',
    onclick: () => { sfx.tap(); addSticker(renderGuide(s.guide, { view: 'full', size: 90 }), 90); } });
  booRow.appendChild(guideBtn);
  const ownedBoos = [...COLLECTIBLES.filter(it => it.kind === 'boo' && s.inventory[it.id] > 0).map(it => resolveItem(it.id)), ...ownedCustomItems()];
  if (!ownedBoos.length) booRow.appendChild(el('span', { class: 'collage-hint', text: 'Win some Boos to add them here!' }));
  ownedBoos.forEach(item => { const btn = el('button', { class: 'collage-pick', html: renderItem(item, { size: 44, equipArt: item.kind === 'boo' && !item.custom ? equippedArt(item.id) : null }), 'aria-label': 'add Boo', onclick: () => { sfx.tap(); addSticker(renderItem(item, { size: 90, equipArt: item.kind === 'boo' && !item.custom ? equippedArt(item.id) : null }), 90); } }); booRow.appendChild(btn); });

  // ---- themed prop drawers (RUN5 C6): tabs above one sticker row ----
  let drawerIdx = 0;
  const drawerTabs = el('div', { class: 'collage-drawer-tabs' });
  const propRow = el('div', { class: 'collage-stickers' });
  function renderDrawerTabs() {
    clear(drawerTabs);
    PROP_DRAWERS.forEach((d, i) => drawerTabs.appendChild(el('button', {
      class: 'collage-bg drawer-tab' + (i === drawerIdx ? ' sel' : ''), text: d.name,
      onclick: () => { drawerIdx = i; sfx.tap(); renderDrawerTabs(); renderProps(); }
    })));
  }
  function renderProps() {
    clear(propRow);
    for (const p of PROP_DRAWERS[drawerIdx].props) {
      if (typeof p === 'string') {
        propRow.appendChild(el('button', { class: 'collage-pick emoji', text: p, onclick: () => { sfx.tap(); addSticker(`<text font-size="60" text-anchor="middle" x="45" y="60">${p}</text>`, 90); } }));
      } else {
        propRow.appendChild(el('button', { class: 'collage-pick', html: `<svg viewBox="0 0 90 90" width="44" height="44">${p.svg}</svg>`, 'aria-label': 'add prop', onclick: () => { sfx.tap(); addSticker(p.svg, 90); } }));
      }
    }
  }
  renderDrawerTabs(); renderProps();

  // ---- sticker letters (RUN5 C6): chunky A–Z in four colours ----
  let letterColour = LETTER_COLOURS[0];
  const letterColours = el('div', { class: 'collage-letter-colours' });
  LETTER_COLOURS.forEach(c => {
    const b = el('button', { class: 'paint-swatch letter-colour' + (c === letterColour ? ' sel' : ''), style: { background: c }, 'aria-label': 'letter colour',
      onclick: () => { letterColour = c; sfx.tap(); [...letterColours.children].forEach(x => x.classList.remove('sel')); b.classList.add('sel'); } });
    letterColours.appendChild(b);
  });
  const letterRow = el('div', { class: 'collage-stickers letters' });
  for (let i = 0; i < 26; i++) {
    const ch = String.fromCharCode(65 + i);
    letterRow.appendChild(el('button', { class: 'collage-pick letter', text: ch, onclick: () => {
      sfx.tap();
      addSticker(`<text font-family="Fredoka, sans-serif" font-weight="700" font-size="64" fill="${letterColour}" stroke="#2A1B4E" stroke-width="2.4" paint-order="stroke" text-anchor="middle" x="45" y="66">${ch}</text>`, 90);
    } }));
  }

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
      el('div', { class: 'cp-label', text: 'Props' }), drawerTabs, propRow,
      el('div', { class: 'cp-label', text: 'Letters' }), letterColours, letterRow,
      el('div', { class: 'collage-actions' }, [textBtn, saveBtn, saveMsg])
    ]));
  container.appendChild(root);

  if (typeof window !== 'undefined') window.__collage = {
    addProp: () => addSticker(`<text font-size="60" text-anchor="middle" x="45" y="60">🌟</text>`, 90),
    count: () => stickers.length, save: doSave,
    // RUN5 C6 QA hooks
    drawers: () => PROP_DRAWERS.map(d => ({ name: d.name, n: d.props.length })),
    setDrawer: (i) => { drawerIdx = i; renderDrawerTabs(); renderProps(); },
    backgrounds: () => BACKGROUNDS.map(b => b.id),
    selected: () => selected ? { x: selected.x, y: selected.y, scale: selected.scale, rot: selected.rot, w: selected.w, inner: selected.g.innerHTML.slice(0, 400) } : null,
    selectLast: () => { if (stickers.length) select(stickers[stickers.length - 1]); }
  };
  return { unmount() {} };
}

function escapeXml(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
