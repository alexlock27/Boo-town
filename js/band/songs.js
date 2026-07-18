// RUN10 P6 — songs are their own readable screen, never an overlay over the keys.

import { el, clear, backControl } from '../ui.js';
import { sfx, music, band as voices, KEY_SEMIS } from '../sfx.js';
import { LITTLE_BOO_SONGS, BOO_POP_HITS } from '../../data/songs.js';
import { contentTier } from '../content.js';

export function mount(container, params, ctx) {
  music.stop();
  const toddler = contentTier() === 'toddler';
  const songs = [
    ...LITTLE_BOO_SONGS.map(s => ({ ...s, little: true, bpm: 92 })),
    ...(toddler ? [] : BOO_POP_HITS.map(s => ({ ...s, little: false })))
  ];
  const root = el('div', { class: 'screen band-library band-songs-screen' });
  const header = el('header', { class: 'band-scene-header' }, [
    backControl(() => ctx.go('band')),
    el('h2', { text: 'Songs' }),
    el('span', { class: 'band-header-spacer' })
  ]);
  const intro = el('p', { class: 'band-library-intro', text: 'Hear a little preview, then follow the sparkles on the keys.' });
  const list = el('div', { class: 'band-song-list' });
  root.append(header, intro, list);
  container.appendChild(root);

  let timers = [];
  let previewing = null;

  function stopPreview() {
    timers.forEach(clearTimeout);
    timers = [];
    previewing = null;
    list.querySelectorAll('.previewing').forEach(n => n.classList.remove('previewing'));
  }

  for (const song of songs) {
    let tempo = 'gentle';
    const tempoBtn = el('button', { class: 'band-tempo-toggle', text: 'Gentle', onclick: e => {
      e.stopPropagation();
      tempo = tempo === 'gentle' ? 'steady' : 'gentle';
      tempoBtn.textContent = tempo[0].toUpperCase() + tempo.slice(1);
      sfx.tap();
    } });
    const previewBtn = el('button', { class: 'btn soft band-preview-btn', text: '▶ Preview', onclick: e => {
      e.stopPropagation();
      if (previewing === song.id) { stopPreview(); previewBtn.textContent = '▶ Preview'; return; }
      stopPreview();
      previewing = song.id;
      card.classList.add('previewing');
      previewBtn.textContent = '■ Stop';
      const beat = 60000 / ((song.bpm || 112) * (tempo === 'gentle' ? 0.78 : 1));
      let t = 0;
      const notes = song.melody.slice(0, 16);
      notes.forEach(n => {
        if (n.semi != null && KEY_SEMIS.includes(n.semi)) timers.push(setTimeout(() => voices.key(n.semi), t));
        t += (n.beats || 1) * beat;
      });
      timers.push(setTimeout(() => { stopPreview(); previewBtn.textContent = '▶ Preview'; }, t + 80));
    } });
    const card = el('article', { class: 'band-song-card' }, [
      el('div', { class: 'band-song-copy' }, [
        el('h3', { text: song.name }),
        el('span', { class: 'band-song-kind', text: song.little ? 'for little Boos' : `${song.bpm || 116} bpm` })
      ]),
      el('div', { class: 'band-song-actions' }, [
        tempoBtn,
        previewBtn,
        el('button', { class: 'btn band-song-play', text: 'Play it ✨', onclick: () => { stopPreview(); sfx.tap(); ctx.go('band-keys', { song: song.id }); } })
      ])
    ]);
    list.appendChild(card);
  }

  window.__bandSongs = {
    count: () => songs.length,
    ids: () => songs.map(s => s.id),
    previewing: () => previewing
  };
  return { unmount() { stopPreview(); } };
}
