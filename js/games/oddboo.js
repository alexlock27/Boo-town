// RUN10 P19 — Odd Boo Out: one true violator, no timer and no wrong-answer reveal.
import { el, clear, wobble, sparkleAt } from '../ui.js';
import { createGameShell } from '../gameshell.js';
import { renderBoo } from '../art.js';
import { sfx, music } from '../sfx.js';
import { contentTier } from '../content.js';
import { maybeIntro, replayIntro } from '../intro.js';
import { recordResult } from '../state.js';
import { oddGrid, violatesOddPredicate, ODD_FEATURES } from '../brainhelpers.js';

export const ODD_INTRO = [
  { text: 'Most Boos match one secret rule.' },
  { text: 'Find the one Boo who is different.' },
  { text: 'A wrong tap just means keep looking!' }
];
const ROUNDS = 10;
// The rotation is the generator's own answer pool — 'shine' is deliberately not in it
// (RUN12 S3.3: sparkle is decoration OR the answer, never ambiguously both).
const FEATURE_ROTATION = ODD_FEATURES;

function booHTML(boo) {
  return renderBoo({
    species: boo.species, colors: { body: boo.colour },
    // no accessory variety inside a grid: every hatted Boo wears the identical cap, and
    // shimmer never renders here at all, so nothing decorative can look like the answer
    acc: boo.hat ? 'cap' : null, fx: null
  }, { size: 128, cls: 'odd-boo-svg' });
}

export function mount(container, params, ctx) {
  music.play('game');
  const root = el('div', { class: 'screen oddboo' });
  const tier = contentTier();
  const featureOffset = Math.floor(Math.random() * FEATURE_ROTATION.length);
  let index = 0, wrong = 0, streak = 0, locked = false, grid, timer = null;
  const shell = createGameShell({
    title: 'Odd Boo Out', rounds: ROUNDS, accent: 'var(--zing)', hideHearts: true,
    onBack: () => ctx.go('hub'), onHint: () => shell.react("Look at their colours, their hats — and each Boo's own little details."),
    onHelp: () => replayIntro('oddboo', ODD_INTRO)
  });
  const title = el('div', { class: 'odd-find', text: 'WHICH BOO BREAKS THE PATTERN?' });
  const board = el('div', { class: 'odd-grid' });
  shell.area.append(title, board);
  root.appendChild(shell.root); container.appendChild(root);
  maybeIntro('oddboo', ODD_INTRO);
  next();

  function next() {
    locked = false;
    grid = oddGrid(tier, Math.random, {
      oddFeature: FEATURE_ROTATION[(featureOffset + index) % FEATURE_ROTATION.length]
    });
    board.dataset.count = String(grid.items.length);
    clear(board);
    grid.items.forEach((boo, i) => {
      const button = el('button', {
        class: 'odd-choice', dataset: { index: i, odd: i === grid.oddIndex ? 'true' : 'false' },
        'aria-label': `Boo ${i + 1}`, onclick: e => choose(i, e.currentTarget)
      }, [el('span', { class: 'odd-art', html: booHTML(boo) })]);
      if (boo.hat) button.classList.add('has-hat');
      board.appendChild(button);
    });
  }
  function choose(i, button) {
    if (locked) return;
    const key = `oddboo:${grid.predicateFeatures.join('+')}`;
    if (i !== grid.oddIndex) {
      wrong++; streak = 0; recordResult(key, false);
      wobble(button); sfx.oops();
      shell.react(`Good looking — compare their ${grid.oddLabel}!`);
      locked = true;
      timer = setTimeout(() => {
        locked = false;
        Array.from(board.children).forEach(child => {
          child.style.order = Math.floor(Math.random() * 100);
        });
      }, 1500);
      return;
    }
    locked = true; streak++; recordResult(key, true); sfx.star();
    button.classList.add('odd-found');
    const r = button.getBoundingClientRect();
    sparkleAt(r.left + r.width / 2, r.top + r.height / 2);
    if (streak >= 3) button.classList.add('odd-streak');
    const found = `Yes — the ${grid.oddLabel} was different!`;
    shell.react(streak >= 3 ? `${found} ${streak} in a row!` : found);
    timer = setTimeout(() => {
      index++; shell.advance();
      if (index >= ROUNDS) finish(); else next();
    }, 720);
  }
  function finish() {
    const stars = wrong <= 1 ? 3 : wrong <= 4 ? 2 : 1;
    ctx.go('results', { game: 'oddboo', gameName: 'Odd Boo Out', stars, replay: () => ctx.go('oddboo') });
  }
  window.__oddboo = {
    grid: () => grid,
    violators: () => grid.items.map((b, i) => violatesOddPredicate(b, grid) ? i : -1).filter(i => i >= 0),
    choose, round: () => index, wrong: () => wrong,
    locked: () => locked   // QA: the 1.5s anti-brute-force lockout after a wrong tap
  };
  return { unmount() { clearTimeout(timer); shell.cleanup(); delete window.__oddboo; } };
}
