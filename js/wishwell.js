import { el, confetti, REDUCED } from './ui.js';
import { getState, mutate } from './state.js';
import { WISHES } from '../data/wishes.js';

export { WISHES };

export function distance(a, b) {
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) rows[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) {
    rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  }
  return rows[a.length][b.length];
}

export function nearest(word = '') {
  return WISHES.reduce((best, wish) => distance(word, wish) < distance(word, best) ? wish : best, WISHES[0]);
}

const living = { fish: '🐟', butterfly: '🦋', frog: '🐸' };

export function mount(container, params, ctx) {
  const root = el('div', { class: 'screen wishwell' });
  container.appendChild(root);
  let misses = 0;
  const status = el('p', { class: 'wish-status', text: 'Spell what you wish for!' });
  const input = el('input', { class: 'wish-input', maxlength: '8', autocomplete: 'off', placeholder: 'a wish…' });
  const spawn = el('div', { class: 'wish-spawn' });
  const suggestions = el('div', { class: 'wish-suggestions' });

  const cast = () => {
    const word = input.value.trim().toLowerCase();
    if (WISHES.includes(word)) {
      let fresh = false;
      mutate(save => { save.wishes = save.wishes || {}; fresh = !save.wishes[word]; save.wishes[word] = true; });
      status.textContent = fresh ? `POOF! ${word.toUpperCase()} appeared — it is in your wishes now!` : `POOF! ${word.toUpperCase()} appeared!`;
      spawn.textContent = living[word] || '✨';
      spawn.classList.remove('wish-poof'); void spawn.offsetWidth; spawn.classList.add('wish-poof');
      if (!REDUCED) confetti({ count: 22, power: .45 });
      input.value = ''; misses = 0;
    } else {
      misses++;
      const match = nearest(word);
      status.textContent = misses >= 2 ? `Ooh, nearly! Maybe “${match}”?` : 'Ooh, nearly! The well is listening…';
    }
  };

  for (const word of WISHES.filter(wish => wish.length <= 4).slice(0, 8)) {
    suggestions.appendChild(el('button', { class: 'btn soft', text: word, onclick: () => { input.value = word; cast(); } }));
  }
  const card = el('div', { class: 'wish-card card' }, [
    el('h2', { text: 'The Wish Well' }),
    el('div', { class: 'wish-well', text: '🫧' }, [spawn]), status, input,
    el('button', { class: 'btn big', text: '✨ Make a wish', onclick: cast }), suggestions
  ]);
  root.append(card, el('button', { class: 'btn soft', text: 'Back', onclick: () => ctx.go('hub') }));
  if (typeof window !== 'undefined') window.__wishwell = { cast: word => { input.value = word; cast(); }, nearest, state: () => ({ misses, wishes: getState().wishes || {} }) };
  return { unmount() {} };
}
