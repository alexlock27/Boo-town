// RUN10 P6 — saved jams as a dedicated library with visible layers and deliberate deletion.

import { el, clear, backControl, suppressContextMenu } from '../ui.js';
import { getState, mutate } from '../state.js';
import { sfx, music } from '../sfx.js';
import { idbDelete, idbPut } from '../idb.js';
import { listJams, jamEvents, startBandWatch } from '../band.js';
import { INSTRUMENTS } from './shared.js';

const EVENT_ICON = { drum: '🥁', key: '🎹', guitar: '🎸', xylo: '🌈' };

function densitySvg(jam) {
  const events = jamEvents(jam);
  const dur = Math.max(1, jam.dur || events.reduce((m, e) => Math.max(m, e.t), 0));
  const dots = events.slice(0, 40).map((e, i) => {
    const x = 5 + (e.t / dur) * 90;
    const y = 22 - ((i * 7) % 15);
    return `<circle cx="${x.toFixed(1)}" cy="${y}" r="1.8" fill="${['#FF7AC6','#FFC93C','#35D0BA','#8FC7FF'][i % 4]}"/>`;
  }).join('');
  return `<svg viewBox="0 0 100 28" aria-hidden="true">${dots || '<path d="M5 20h90" stroke="#C6A9F0" stroke-width="2" stroke-dasharray="4 4"/>'}</svg>`;
}

export function mount(container, params, ctx) {
  music.stop();
  const root = el('div', { class: 'screen band-library band-jams-screen' });
  const header = el('header', { class: 'band-scene-header' }, [
    backControl(() => ctx.go('band')),
    el('h2', { text: 'My Jams' }),
    el('span', { class: 'band-header-spacer' })
  ]);
  const list = el('div', { class: 'band-jam-list' });
  root.append(header, list);
  container.appendChild(root);

  let player = null;
  let alive = true;
  render();

  async function render() {
    const jams = await listJams();
    if (!alive) return;
    clear(list);
    if (!jams.length) {
      list.appendChild(el('button', {
        class: 'band-first-jam',
        onclick: () => ctx.go('band-drums', { record: true })
      }, [
        el('span', { text: '🥁' }),
        el('strong', { text: 'Record your first jam!' }),
        el('small', { text: 'Start with the drums' })
      ]));
      return;
    }
    for (const jam of jams) list.appendChild(jamCard(jam));
  }

  function jamCard(jam) {
    const layers = Array.isArray(jam.layers)
      ? jam.layers
      : [{ instrument: 'drum', events: jam.events || [] }];
    const layerRow = el('div', { class: 'band-jam-layers' });
    layers.forEach((layer, idx) => {
      const chip = el('span', { class: 'band-jam-layer' }, [
        el('span', { text: EVENT_ICON[layer.instrument] || '🎵' }),
        el('small', { text: `${Math.max(1, Math.round((layer.events || []).reduce((m, e) => Math.max(m, e.t), 0) / 1000))}s` }),
        el('button', {
          'aria-label': `Re-record layer ${idx + 1}`,
          text: '↻',
          onclick: () => chooseInstrument(jam.id, idx)
        }),
        el('button', {
          'aria-label': `Remove layer ${idx + 1}`,
          text: '×',
          onclick: async () => {
            const next = layers.filter((_, i) => i !== idx);
            if (!next.length) { await deleteJam(jam); return; }
            await idbPut('jams', { ...jam, layers: next });
            render();
          }
        })
      ]);
      layerRow.appendChild(chip);
    });
    const add = el('div', { class: 'band-add-layer-row' });
    const card = el('article', { class: 'band-jam-card', dataset: { id: jam.id } }, [
      el('div', { class: 'band-jam-title' }, [
        el('h3', { text: jam.name || 'My Jam' }),
        el('div', { class: 'band-jam-sparkline', html: densitySvg(jam) })
      ]),
      layerRow,
      el('div', { class: 'band-jam-actions' }, [
        el('button', { class: 'btn soft', text: '▶ Play', onclick: () => play(jam) }),
        el('button', { class: 'btn soft', text: '+ Add a layer', disabled: layers.length >= 3, onclick: () => chooseInstrument(jam.id) }),
        el('button', {
          class: `btn soft${getState().bandSong === jam.id ? ' active' : ''}`,
          text: getState().bandSong === jam.id ? '★ Band song' : 'Set as band song',
          onclick: () => { mutate(st => { st.bandSong = jam.id; }); sfx.star(); render(); }
        })
      ]),
      add,
      el('button', { class: 'band-jam-delete', text: 'Hold to delete', 'aria-label': `Hold to delete ${jam.name}` })
    ]);
    const del = card.querySelector('.band-jam-delete');
    let timer = null;
    del.addEventListener('pointerdown', e => {
      e.stopPropagation();
      del.classList.add('holding');
      timer = setTimeout(() => deleteJam(jam), 600);
    });
    const cancel = () => { if (timer) clearTimeout(timer); timer = null; del.classList.remove('holding'); };
    del.addEventListener('pointerup', cancel);
    del.addEventListener('pointercancel', cancel);
    del.addEventListener('pointerleave', cancel);
    suppressContextMenu(del);
    return card;
  }

  function play(jam) {
    if (player) { player.stop(); player = null; }
    player = startBandWatch(jam);
    sfx.tap();
  }

  function chooseInstrument(jamId, replaceLayer) {
    const card = list.querySelector(`[data-id="${jamId}"]`);
    if (!card) return;
    const row = card.querySelector('.band-add-layer-row');
    clear(row);
    for (const [key, meta] of Object.entries(INSTRUMENTS)) {
      row.appendChild(el('button', {
        class: 'band-instrument-choice',
        text: `${meta.icon} ${meta.label}`,
        onclick: () => ctx.go(meta.route, { jamId, replaceLayer })
      }));
    }
  }

  async function deleteJam(jam) {
    if (player) { player.stop(); player = null; }
    await idbDelete('jams', jam.id);
    if (getState().bandSong === jam.id) mutate(st => { st.bandSong = null; });
    sfx.tap();
    render();
  }

  window.__bandJams = {
    count: async () => (await listJams()).length,
    play,
    remove: deleteJam
  };
  return { unmount() { alive = false; if (player) player.stop(); } };
}
