// js/editguide.js — the re-enterable "My character" creator (spec RUN2 C1).
// Reached from the Collection card and the hub long-press. Changing species mid-game
// changes nothing else; all speech and progress carry over.

import { el, backControl } from './ui.js';
import { getState, mutate } from './state.js';
import { buildCreator } from './creator.js';

export function mount(container, params, ctx) {
  const before = { ...getState().guide };
  const back = (params && params.from) || 'collection';

  const creator = buildCreator(before, {
    doneLabel: 'Save ✨',
    onDone(guide) {
      const speciesChanged = guide.species !== before.species;
      // RUN19 Z4: a restyle is anything she changed about her guide's LOOK, not only the
      // species — recolouring it is just as much a new look to the child who did it. The flag
      // is session-only (module state in js/ack.js is not enough: the hub has not mounted
      // yet), so it lives in `seen` and is cleared the moment the line is said or declined.
      const restyled = JSON.stringify({ ...guide, name: '' }) !== JSON.stringify({ ...before, name: '' });
      mutate(s => { s.guide = { ...guide }; if (restyled) s.seen = Object.assign(s.seen || {}, { guideRestyled: true }); });
      // Returning to the hub after a species change earns the special line.
      if (back === 'hub' && speciesChanged) ctx.go('hub', { greeting: 'speciesChange' });
      else ctx.go(back);
    }
  });

  const root = el('div', { class: 'onboard creator' }, [
    el('h2', { text: 'My character' }),
    ...creator.nodes
  ]);
  // shared back control (job 3): one level up, discarding unsaved tweaks
  root.appendChild(backControl(() => ctx.go(back), { floating: true }));
  container.appendChild(root);

  return { unmount() {} };
}
