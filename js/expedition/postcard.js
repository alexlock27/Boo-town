// RUN10 P21 — a full Expedition trail leaves a real postcard in the Studio Gallery.
// It is composed locally on an offscreen canvas: no uploads and no save-data bloat.

import { renderItem, renderExpGlyph } from '../art.js';
import { saveArtwork } from '../studio.js';

const SCENE = {
  bridges: { sky: '#B8E9FF', ground: '#7FC85F', detail: '🌉', title: 'Sneezy Bridges' },
  picnic: { sky: '#FFE7AD', ground: '#91C96B', detail: '🧺', title: "Picky Grumps' Picnic" },
  raft: { sky: '#C9F0FF', ground: '#76C7E6', detail: '⛵', title: 'Ferry Raft' },
  hotel: { sky: '#DCCBFF', ground: '#7FBD73', detail: '🏨', title: 'Boo Hotel' }
};

export function postcardPlan(party = [], node = 'hotel', date = new Date()) {
  const scene = SCENE[node] || SCENE.hotel;
  // RUN18C C4: the back row stood at y 188 — ABOVE the ground band, which starts at 208 —
  // so six of the eight Boos floated in the sky. Nobody had seen it, because until C4 the
  // postcard went straight into the Gallery and was never put in front of her. Both rows
  // stand on the grass now, the near one overlapping the far one, which reads as depth.
  const rows = party.map((boo, index) => ({
    boo, x: 70 + (index % 6) * 96 + (Math.floor(index / 6) ? 42 : 0), y: Math.floor(index / 6) ? 284 : 250
  }));
  return {
    width: 640, height: 400, scene, sprites: rows,
    stamp: `${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} · Boo Expedition`
  };
}

function svgImage(svg) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image); image.onerror = reject;
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
}

export async function composePostcard(party = [], node = 'hotel', date = new Date()) {
  if (typeof document === 'undefined') throw new Error('canvas-unavailable');
  const plan = postcardPlan(party, node, date);
  const canvas = document.createElement('canvas'); canvas.width = plan.width; canvas.height = plan.height;
  const c = canvas.getContext('2d');
  c.fillStyle = '#FFF8E9'; c.fillRect(0, 0, plan.width, plan.height);
  c.fillStyle = plan.scene.sky; c.fillRect(18, 18, 604, 270);
  c.fillStyle = plan.scene.ground; c.fillRect(18, 208, 604, 80);
  c.fillStyle = 'rgba(255,255,255,.65)';
  for (let x = 38; x < 600; x += 106) { c.beginPath(); c.arc(x, 72 + (x % 3) * 8, 17, 0, Math.PI * 2); c.fill(); }
  // The node's landmark, drawn in the house sticker style. It was the emoji from SCENE
  // above painted with fillText — emoji-as-art in a scene, which house law forbids, and
  // C4 is what puts this scene on a child's screen for the first time.
  try { const mark = await svgImage(renderExpGlyph(SCENE[node] ? node : 'hotel', { size: 96 })); c.drawImage(mark, 506, 74, 96, 96); }
  catch { c.font = '56px sans-serif'; c.fillText(plan.scene.detail, 520, 132); }
  c.strokeStyle = '#2A1B4E'; c.lineWidth = 6; c.strokeRect(18, 18, 604, 364);
  c.fillStyle = '#2A1B4E'; c.font = '700 25px sans-serif'; c.fillText(`Boo Expedition — ${plan.scene.title}`, 36, 330);
  c.save(); c.translate(470, 364); c.rotate(-8 * Math.PI / 180);
  c.fillStyle = '#FFFDF1'; c.fillRect(-130, -22, 260, 44); c.strokeStyle = '#2A1B4E'; c.lineWidth = 2; c.strokeRect(-130, -22, 260, 44);
  c.fillStyle = '#2A1B4E'; c.font = '700 13px sans-serif'; c.fillText(plan.stamp, -118, 5); c.restore();
  await Promise.all(plan.sprites.map(async ({ boo, x, y }) => {
    try { const image = await svgImage(renderItem(boo, { size: 72 })); c.drawImage(image, x - 36, y - 72, 72, 78); } catch {}
  }));
  return { png: canvas.toDataURL('image/png'), plan };
}

export async function saveExpeditionPostcard(party = [], node = 'hotel', date = new Date()) {
  const { png, plan } = await composePostcard(party, node, date);
  return { ...(await saveArtwork(png, 'expedition-postcard')), png, plan };
}
