import { el, confetti, REDUCED, backControl, wobble } from '../ui.js';

const SPECIES = ['pip', 'nova', 'munch', 'bloop'];
const COLOURS = ['teal', 'lilac', 'gold', 'bubblegum'];
const pick = list => list[Math.floor(Math.random() * list.length)];

// A generated grid has one, and only one, visible rule-breaker. The exported shape
// stays intentionally small so its truth table can be tested without a browser.
export function makeRound(tier = 1) {
  const n = tier === 1 ? 4 : tier === 2 ? 9 : 12;
  const path = tier === 1 ? 'species' : pick(['species', 'colour']);
  const value = pick(path === 'species' ? SPECIES : COLOURS);
  const other = (path === 'species' ? SPECIES : COLOURS).find(item => item !== value);
  const odd = Math.floor(Math.random() * n);
  const items = Array.from({ length: n }, (_, index) => ({
    id: index, species: path === 'species' ? (index === odd ? other : value) : 'pip',
    colors: { body: path === 'colour' ? (index === odd ? other : value) : 'teal' }
  }));
  return { items, odd, path, value };
}

export function mount(container, params, ctx) {
  const root = el('div', { class: 'screen oddboo' }); container.appendChild(root);
  let tier = 1, found = 0, streak = 0, round;
  const status = el('p', { class: 'odd-status' }); const grid = el('div', { class: 'odd-grid' });
  const next = () => {
    round = makeRound(tier); grid.innerHTML = ''; status.textContent = `Find the Odd Boo! ${found}/10`;
    round.items.forEach((item, index) => {
      const button = el('button', { class: 'odd-boo', style: { '--boo': item.colors.body }, text: '👻', onclick: event => {
        if (index !== round.odd) { streak = 0; status.textContent = 'Have another look — it is hiding in plain sight.'; wobble(event.currentTarget); return; }
        found++; streak++; status.textContent = streak >= 3 ? `POP! A ${streak}-in-a-row sparkle!` : 'POP! You found it!';
        if (streak >= 3 && !REDUCED) confetti({ count: 20, power: .4 });
        tier = Math.min(3, 1 + Math.floor(found / 3));
        if (found >= 10) { setTimeout(() => ctx.go('results', { game: 'oddboo', gameName: 'Odd Boo Out', stars: 3, replay: () => ctx.go('oddboo') }), 500); return; }
        setTimeout(next, 450);
      } });
      grid.appendChild(button);
    });
  };
  root.append(el('h2', { text: 'Odd Boo Out' }), status, grid,
    el('button', { class: 'btn soft', text: '?', onclick: () => status.textContent = 'Most Boos share something. One is different.' }),
    backControl(() => ctx.go('hub'), { floating: true }));
  next(); return { unmount() {} };
}
