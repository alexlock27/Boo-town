// Band Room (RUN10 P6): the friendly front door to every Band scene.
import { el, backControl } from '../ui.js';
import { bandTrio } from '../band.js';
import { resolveItem } from '../customs.js';
import { renderItem } from '../art.js';

const CARDS = [
  ['drums', '🥁', 'Drums'], ['keys', '🎹', 'Keys'], ['guitar', '🎸', 'Guitar'],
  ['xylo', '🎼', 'Xylophone'], ['songs', '🎵', 'Songs'], ['jams', '✨', 'My Jams']
];

export function mount(container, params, ctx) {
  const root = el('div', { class: 'screen bandroom' });
  const trio = bandTrio();
  const roles = ['drummer', 'keys', 'guitarist'];
  const band = el('div', { class: 'bandroom-trio' });
  roles.forEach(role => {
    const item = resolveItem(trio[role]);
    band.appendChild(el('div', { class: 'bandroom-boo' }, [el('div', { html: item ? renderItem(item, { size: 66 }) : '' }), el('span', { text: role === 'drummer' ? '🥁' : role === 'keys' ? '🎹' : '🎸' })]));
  });
  const grid = el('div', { class: 'bandroom-grid' });
  CARDS.forEach(([key, icon, label]) => grid.appendChild(el('button', {
    class: 'bandroom-card', dataset: { scene: key }, onclick: () => {
      const route = { drums: 'banddrums', keys: 'bandkeys', guitar: 'bandguitar', xylo: 'bandxylo', songs: 'bandsongs', jams: 'bandjams' }[key];
      ctx.go(route);
    }
  }, [el('span', { class: 'bandroom-icon', text: icon }), el('span', { text: label })])));
  root.append(el('header', { class: 'bandroom-header' }, [backControl(() => ctx.go('town', { area: 'funfair' })), el('h2', { text: 'The Boo Band' })]), band, grid);
  container.appendChild(root);
  return {};
}
