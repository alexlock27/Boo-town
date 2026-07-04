// js/gallery.js — the Studio gallery (RUN3 C6). Grid of saved artworks; tap to view full
// screen; press and hold to delete. Artworks come from IndexedDB.

import { el, clear } from './ui.js';
import { sfx, music } from './sfx.js';
import { listArtworks, GALLERY_CAP } from './studio.js';
import { idbDelete } from './idb.js';

export function mount(container, params, ctx) {
  music.play('calm');
  const root = el('div', { class: 'gallery-screen' });
  const header = el('header', { class: 'studio-header' }, [
    el('button', { class: 'icon-btn back-btn', html: backArrow(), 'aria-label': 'Back', onclick: () => { sfx.tap(); ctx.go('studio'); } }),
    el('h2', { text: '🌟 My Gallery' }),
    el('span', { class: 'gallery-count' })
  ]);
  const grid = el('div', { class: 'gallery-grid' });
  root.append(header, grid);
  container.appendChild(root);

  render();
  async function render() {
    const arts = await listArtworks();
    header.querySelector('.gallery-count').textContent = `${arts.length} of ${GALLERY_CAP}`;
    clear(grid);
    if (!arts.length) { grid.appendChild(el('div', { class: 'gallery-empty' }, [el('div', { class: 'ge-big', text: '🎨' }), el('p', { text: 'Paint, collage or build to fill your gallery!' })])); return; }
    for (const a of arts) {
      const tile = el('button', { class: 'gallery-tile', 'aria-label': 'artwork', onclick: () => view(a) });
      tile.appendChild(el('img', { src: a.png, alt: 'artwork', class: 'gallery-img' }));
      attachHold(tile, () => confirmDelete(a));
      grid.appendChild(tile);
    }
  }
  function view(a) {
    const ov = el('div', { class: 'overlay gallery-view', onclick: (e) => { if (e.target === ov) ov.remove(); } });
    ov.appendChild(el('div', { class: 'gv-inner' }, [
      el('img', { src: a.png, class: 'gv-img', alt: 'artwork' }),
      el('button', { class: 'btn', text: 'Close', onclick: () => ov.remove() })
    ]));
    root.appendChild(ov);
  }
  function confirmDelete(a) {
    const ov = el('div', { class: 'overlay', onclick: (e) => { if (e.target === ov) ov.remove(); } });
    ov.appendChild(el('div', { class: 'card', style: { padding: '20px', maxWidth: '360px', textAlign: 'center' } }, [
      el('img', { src: a.png, style: { width: '120px', borderRadius: '12px' } }),
      el('p', { text: 'Delete this artwork?' }),
      el('div', { class: 'gu-row', style: { justifyContent: 'center' } }, [
        el('button', { class: 'btn danger', text: 'Delete', onclick: async () => { await idbDelete('artworks', a.id); ov.remove(); render(); } }),
        el('button', { class: 'btn soft', text: 'Keep', onclick: () => ov.remove() })
      ])
    ]));
    root.appendChild(ov);
  }
  return { unmount() {} };
}

// Fire onHold after a steady press; cancel on release/drift.
function attachHold(node, onHold) {
  let timer = null, sx = 0, sy = 0;
  const clear = () => { if (timer) { clearTimeout(timer); timer = null; } };
  node.addEventListener('pointerdown', (e) => { sx = e.clientX; sy = e.clientY; clear(); timer = setTimeout(() => { timer = null; sfx.tap(); onHold(); }, 600); });
  node.addEventListener('pointermove', (e) => { if (timer && Math.hypot(e.clientX - sx, e.clientY - sy) > 12) clear(); });
  node.addEventListener('pointerup', clear); node.addEventListener('pointerleave', clear); node.addEventListener('pointercancel', clear);
}
function backArrow() { return `<svg viewBox="0 0 24 24" width="26" height="26"><path d="M15 5l-7 7 7 7" fill="none" stroke="var(--card)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>`; }
