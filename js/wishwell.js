// js/wishwell.js — a gentle, finite spelling toy (RUN10 P20).
// There is no free-text field: the child chooses detective-style letter keys and sees
// their word build in tiles. Every success creates a real, placeable town wish.

import { el, clear, confetti, REDUCED } from './ui.js';
import { getState, mutate } from './state.js';
import { createDrawer } from './drawer.js';
import { contentTier } from './content.js';
import { showToast } from './resilience.js';
import { guideLine } from './guide.js';
import { sfx } from './sfx.js';
import { WISHES, wishItem } from '../data/wishes.js';

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
  const typed = String(word).toLowerCase();
  const close = WISHES.filter(wish => distance(typed, wish) <= 2);
  if (close.length) return close.reduce((best, wish) => distance(typed, wish) < distance(typed, best) ? wish : best, close[0]);
  // For a more distant miss, preserve the start of the child's attempt where possible.
  const prefix = (a, b) => { let i = 0; while (a[i] && a[i] === b[i]) i++; return i; };
  return WISHES.reduce((best, wish) => {
    const score = prefix(typed, wish), bestScore = prefix(typed, best);
    return score > bestScore || (score === bestScore && distance(typed, wish) < distance(typed, best)) ? wish : best;
  }, WISHES[0]);
}

const LIVING = { fish: '🐟', butterfly: '🦋', frog: '🐸' };
const SIMPLE_HINTS = WISHES.filter(wish => wish.length <= 4).slice(0, 8);
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');

export function mount(container, params, ctx) {
  const root = el('div', { class: 'screen wishwell' });
  const title = el('h2', { text: 'The Wish Well' });
  const prompt = el('p', { class: 'wish-prompt', text: 'Tap the letter keys to spell a little wish.' });
  const well = el('div', { class: 'wish-well', html: '🪣<span aria-hidden="true">✨</span>' });
  const tiles = el('div', { class: 'wish-tiles', role: 'status', 'aria-label': 'Your wish' });
  const status = el('p', { class: 'wish-status', text: 'Pick letters, then ask the well!' });
  const spawn = el('div', { class: 'wish-spawn', 'aria-live': 'polite' });
  const ghost = el('div', { class: 'wish-ghost', 'aria-live': 'polite' });
  const stage = el('div', { class: 'wish-card card' }, [title, prompt, well, spawn, ghost, tiles, status]);
  const keyPad = el('div', { class: 'wish-keys', 'aria-label': 'Letter keys' });
  const hintPad = el('div', { class: 'wish-suggestions' });
  const drawerApi = createDrawer({
    ariaLabel: 'Wish Well letter tray', initial: 0,
    tabs: [
      { id: 'letters', label: 'Letter keys', node: keyPad },
      { id: 'clues', label: 'Little clues', node: hintPad }
    ]
  });
  drawerApi.setCurrent(el('span', { class: 'bd-cur-label', text: 'Letter keys — spell a wish' }));
  const back = el('button', { class: 'btn soft wish-back', text: 'Back to Boo Town', onclick: () => ctx.go('hub') });
  root.append(stage, drawerApi.root, back);
  container.appendChild(root);

  let letters = [];
  let misses = 0;
  let poofTimer = null;

  const updateTiles = () => {
    clear(tiles);
    // The packet's exact lexicon contains the deliberate nine-letter exception
    // “butterfly”; the tray grows one tile only for that word rather than rejecting it.
    for (let i = 0; i < Math.max(8, letters.length); i++) tiles.appendChild(el('span', {
      class: 'wish-tile' + (letters[i] ? ' filled' : ''), text: letters[i] ? letters[i].toUpperCase() : '·',
      'aria-hidden': 'true'
    }));
    tiles.setAttribute('aria-label', letters.length ? `Your wish: ${letters.join('')}` : 'Your wish is empty');
  };
  const press = (letter) => {
    if (letters.length >= 9) { status.textContent = 'This well holds up to eight letters — and one butterfly-sized wish!'; return; }
    letters.push(String(letter).toLowerCase()); updateTiles();
    ghost.textContent = '';
    status.textContent = 'Lovely. Add another letter, or make your wish!';
  };
  const erase = () => { letters.pop(); updateTiles(); status.textContent = letters.length ? 'One letter splashed back into the well.' : 'Pick letters, then ask the well!'; };
  const reset = () => { letters = []; updateTiles(); ghost.textContent = ''; status.textContent = 'A fresh little wish is ready.'; };
  const cast = () => {
    const word = letters.join('');
    if (word.length < 3) { status.textContent = 'This well knows wishes with three to eight letters.'; return false; }
    if (WISHES.includes(word)) {
      let fresh = false;
      mutate(save => { save.wishes = save.wishes || {}; fresh = !save.wishes[word]; save.wishes[word] = true; });
      const item = wishItem(word);
      tiles.classList.remove('wish-gold'); void tiles.offsetWidth; tiles.classList.add('wish-gold');
      status.textContent = 'The Well is thinking…'; ghost.textContent = '';
      if (fresh) showToast(`New wish: ${word.toUpperCase()}! (in your Build drawer)`, { autoHideMs: 5000 });
      setTimeout(() => {
        spawn.textContent = LIVING[word] || item.icon || '✨';
        spawn.className = 'wish-spawn wish-poof wish-item-pop' + (LIVING[word] ? ` wish-living wish-living-${word}` : '');
        status.textContent = fresh
          ? `POOF! ${word.toUpperCase()} is ready in Build → Wishes.`
          : `POOF! Your ${word.toUpperCase()} wish is already waiting in Build → Wishes.`;
        if (!REDUCED) confetti({ count: 22, power: .45 });
        letters = []; misses = 0; updateTiles();
        if (poofTimer) clearTimeout(poofTimer);
        poofTimer = setTimeout(() => { spawn.textContent = ''; spawn.className = 'wish-spawn'; }, 20000);
      }, REDUCED ? 0 : 400);
      return true;
    }
    misses++;
    const match = nearest(word);
    sfx.tap();
    status.textContent = guideLine('L_WISH_NEARLY') || 'Ooh, nearly! The well is listening…';
    ghost.textContent = misses >= 2 ? `Try ${match.toUpperCase()}` : '';
    return false;
  };

  for (const letter of ALPHABET) keyPad.appendChild(el('button', {
    class: 'wish-key', text: letter.toUpperCase(), type: 'button', 'aria-label': `Letter ${letter.toUpperCase()}`,
    onclick: () => press(letter)
  }));
  // These controls deliberately live INSIDE the raised tray: on a small touch screen
  // the tray overlaps the card, so a cast button below it would be visible but untappable.
  keyPad.appendChild(el('div', { class: 'wish-key-actions' }, [
    el('button', { class: 'btn soft', text: '⌫ Back', type: 'button', onclick: erase }),
    el('button', { class: 'btn soft', text: 'Clear', type: 'button', onclick: reset }),
    el('button', { class: 'btn big', text: '✨ Make a wish', type: 'button', onclick: cast })
  ]));
  const tier = contentTier();
  if (tier === 'toddler' || tier === 'light') {
    hintPad.appendChild(el('p', { class: 'wish-clue-copy', text: 'Try one of these short wishes:' }));
    for (const word of SIMPLE_HINTS) hintPad.appendChild(el('button', {
      class: 'btn soft wish-hint', text: word, type: 'button', onclick: () => { letters = [...word]; updateTiles(); cast(); }
    }));
  } else {
    hintPad.appendChild(el('p', { class: 'wish-clue-copy', text: 'No clues this time — you are the Well Detective!' }));
  }
  status.textContent = guideLine('L_WISH_OPEN') || 'Spell what you wish for!';
  updateTiles();
  requestAnimationFrame(() => drawerApi.open());

  const onKey = (event) => {
    if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return;
    if (/^[a-z]$/i.test(event.key)) { event.preventDefault(); press(event.key); }
    else if (event.key === 'Backspace') { event.preventDefault(); erase(); }
    else if (event.key === 'Enter') { event.preventDefault(); cast(); }
  };
  window.addEventListener('keydown', onKey);
  if (typeof window !== 'undefined') window.__wishwell = {
    cast: (word) => { letters = [...String(word || '').toLowerCase().replace(/[^a-z]/g, '')].slice(0, 9); updateTiles(); return cast(); },
    press, erase, nearest, state: () => ({ misses, wishes: getState().wishes || {}, letters: letters.join('') })
  };
  return { unmount() { if (poofTimer) clearTimeout(poofTimer); window.removeEventListener('keydown', onKey); } };
}
