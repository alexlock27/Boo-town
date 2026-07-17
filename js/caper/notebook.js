import { el, backControl, confetti } from '../ui.js';
import { getState, mutate } from '../state.js';
import { cluesFor } from '../attrengine.js';
import { renderBoo } from '../art.js';
import { stampJournal } from '../quests.js';
import { SUSPECTS, freshCaper } from './state.js';

export { SUSPECTS };

export function ensureCaper() {
  let caper = getState().caper;
  if (!caper || !caper.open) {
    mutate(save => { save.caper = freshCaper(); });
    caper = getState().caper;
  }
  return caper;
}

export function mount(container, params, ctx) {
  const root = el('div', { class: 'screen caper' }); container.appendChild(root);
  let caper = ensureCaper(), marked = new Set(caper.marked || []);
  const culprit = SUSPECTS.find(suspect => suspect.id === caper.culprit) || SUSPECTS[0];
  const clues = cluesFor(culprit, SUSPECTS, 4).slice(0, Math.max(0, caper.clues || 0));
  const status = el('p', { class: 'caper-status', text: clues.length ? 'The clue cards are starting to tell a story…' : 'Finish a learning round to earn a clue card.' });
  const grid = el('div', { class: 'caper-suspects' });
  const clueFan = el('div', { class: 'caper-clues' });
  const accuse = el('button', { class: 'btn big', text: 'ACCUSE!', onclick: () => accuseMarked() });

  const draw = () => {
    grid.innerHTML = '';
    for (const suspect of SUSPECTS) {
      const down = marked.has(suspect.id);
      grid.appendChild(el('button', { class: 'caper-suspect' + (down ? ' down' : ''), onclick: () => {
        down ? marked.delete(suspect.id) : marked.add(suspect.id);
        mutate(save => { save.caper.marked = [...marked]; }); draw();
      } }, down ? [el('b', { text: 'NOT ME' })] : [
        el('span', { class: 'caper-art', html: renderBoo(suspect, { size: 62 }) }), el('b', { text: suspect.name })
      ]));
    }
    clueFan.innerHTML = '';
    clues.forEach((clue, index) => clueFan.appendChild(el('span', { class: 'caper-clue-card', text: `Clue ${index + 1}: ${clue.describe()}` })));
    accuse.disabled = clues.length < 1 || marked.size !== SUSPECTS.length - 1;
  };
  const accuseMarked = (forcedId = null) => {
    const candidate = forcedId ? SUSPECTS.find(suspect => suspect.id === forcedId) : SUSPECTS.find(suspect => !marked.has(suspect.id));
    if (!candidate) { status.textContent = 'Turn over the Boos who cannot be the trickster.'; return; }
    mutate(save => { save.caper.guesses = (save.caper.guesses || 0) + 1; });
    if (candidate.id !== culprit.id) { status.textContent = '“Not me, guv!” Have another look.'; return; }
    status.textContent = 'POOF! Snaffle was the trickster all along! Everyone fits at OUR picnic.';
    confetti({ count: 55, power: .8 });
    mutate(save => { save.caper.open = false; save.caper.nextAt = Date.now() + 86400000; save.caper.resolved = true; });
    stampJournal('caper_snaffle');
    accuse.disabled = true;
  };
  root.append(el('div', { class: 'caper-board card' }, [
    el('h2', { text: "Snaffle's Notebook" }), status, grid, clueFan, accuse
  ]), backControl(() => ctx.go('hub'), { floating: true }));
  draw();
  if (typeof window !== 'undefined') window.__caper = { state: () => getState().caper, suspects: () => SUSPECTS, mark: id => { marked.add(id); draw(); }, accuse: accuseMarked };
  return { unmount() {} };
}
