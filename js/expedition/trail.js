import { el, clear, backControl } from '../ui.js';
import { getState, mutate } from '../state.js';
import { BY_ID } from '../../data/catalogue.js';
import { NODES, GUESTS } from '../../data/expedition.js';
import { genRule, featuresOf } from '../attrengine.js';
import { renderItem } from '../art.js';

const partyFromSave = () => Object.keys(getState().inventory || {})
  .filter(id => getState().inventory[id] > 0 && BY_ID[id]?.kind === 'boo')
  .map(id => ({ ...BY_ID[id], id }));
const featureStrip = boo => `${boo.species || boo.kind} · ${featuresOf(boo).colour} ${featuresOf(boo).accessory ? '🎩' : ''}${featuresOf(boo).shiny ? ' ✨' : ''}`;

export function mount(container, params, ctx) {
  const root = el('div', { class: 'screen expedition' });
  container.appendChild(root);
  let selected = new Set((getState().expedition || {}).party || []);
  let autoGuests = new Set();
  const owned = () => partyFromSave();
  const partyFor = ids => [...owned(), ...GUESTS].filter(boo => ids.has(boo.id));

  function picker() {
    clear(root);
    const grid = el('div', { class: 'exp-party-grid' });
    const count = el('p', { class: 'exp-counter' });
    const banner = el('p', { class: 'exp-guests' });
    const start = el('button', { class: 'btn big', text: 'Start the trail', onclick: () => {
      const explorers = partyFor(selected);
      mutate(save => { save.expedition = save.expedition || { tiers: {}, progress: {}, party: [] }; save.expedition.party = explorers.map(boo => boo.id); });
      trail();
    } });
    const draw = () => {
      const own = owned();
      const picked = own.filter(boo => selected.has(boo.id));
      const needsFriends = picked.length >= 8 && !genRule(picked, { tier: 1 });
      if (needsFriends) {
        autoGuests = new Set();
        for (const guest of GUESTS) { if (selected.size >= 12) break; selected.add(guest.id); autoGuests.add(guest.id); }
      } else if (autoGuests.size) {
        autoGuests.forEach(id => selected.delete(id)); autoGuests = new Set();
      }
      grid.innerHTML = '';
      const visible = [...own, ...GUESTS.filter(guest => autoGuests.has(guest.id))];
      for (const boo of visible) {
        const guest = autoGuests.has(boo.id), on = selected.has(boo.id);
        grid.appendChild(el('button', { class: 'exp-chip' + (on ? ' sel' : '') + (guest ? ' visitor' : ''), disabled: guest ? '' : undefined, onclick: () => {
          if (on) selected.delete(boo.id); else if (selected.size < 12) selected.add(boo.id);
          draw();
        } }, [
          el('span', { html: renderItem(boo, { size: 46 }) }), el('b', { text: boo.name }),
          el('small', { text: featureStrip(boo) }), guest ? el('em', { text: 'VISITOR' }) : null
        ]));
      }
      count.textContent = `${selected.size} / 8–12 explorers`;
      banner.textContent = needsFriends ? 'The trail needs more variety — friends are joining!' : '';
      start.disabled = selected.size < 8;
    };
    root.append(el('div', { class: 'exp-picker card' }, [
      el('h2', { text: 'Boo Expedition' }), el('p', { text: 'Choose a party for the trail.' }),
      count, banner, grid, start
    ]), backControl(() => ctx.go('hub'), { floating: true }));
    draw();
  }

  function trail() {
    clear(root);
    const save = getState(), ex = save.expedition || { tiers: {}, progress: {} };
    const explorers = partyFor(new Set(ex.party || []));
    const nodes = el('div', { class: 'exp-trail' });
    NODES.forEach(node => {
      const tier = (ex.tiers || {})[node.key] || 1, done = (ex.progress || {})[node.key] || 0;
      nodes.appendChild(el('button', { class: 'exp-node' + (done ? ' done' : ''), onclick: () => ctx.go('expeditionpuzzle', { node: node.key }) }, [
        el('span', { class: 'exp-node-icon', text: node.icon }), el('b', { text: node.name }),
        el('small', { text: `Tier ${'ⅠⅡⅢⅣ'[tier - 1]} ${'★'.repeat(done)}` })
      ]));
    });
    const mugs = el('div', { class: 'exp-camp-mugs' });
    explorers.forEach(boo => mugs.appendChild(el('span', { class: 'exp-camp-boo', title: boo.name, html: renderItem(boo, { size: 40 }) })));
    const camp = el('div', { class: 'exp-camp' }, [el('span', { text: '🔥' }), mugs, el('small', { text: 'Cosy cocoa at camp' })]);
    const doneAll = NODES.every(node => (ex.progress || {})[node.key] > 0);
    root.append(el('h2', { text: 'The Expedition Trail' }), nodes, camp,
      doneAll ? el('p', { class: 'exp-complete', text: 'The whole trail is glowing with stars!' }) : null,
      backControl(picker, { floating: true }));
  }
  if (params?.trail) trail(); else picker();
  return { unmount() {} };
}
