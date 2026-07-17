import { el, clear, backControl } from '../ui.js';
import { getState, mutate } from '../state.js';
import { BY_ID } from '../../data/catalogue.js';
import { NODES, GUESTS } from '../../data/expedition.js';
import { genRule, featuresOf } from '../attrengine.js';
import { renderItem } from '../art.js';

const partyFromSave = () => Object.keys(getState().inventory).filter(id => getState().inventory[id] > 0 && BY_ID[id]?.kind === 'boo').map(id => ({ ...BY_ID[id], id }));
export function mount(container, params, ctx) {
  const root = el('div', { class: 'screen expedition' }); container.appendChild(root);
  let selected = new Set((getState().expedition || {}).party || []);
  const all = () => partyFromSave();
  function picker() {
    clear(root); const grid = el('div', { class: 'exp-party-grid' }), count = el('p', { class: 'exp-counter' }); const banner = el('p', { class: 'exp-guests' });
    const draw = () => { grid.innerHTML = ''; const party = all(); for (const boo of party) { const on = selected.has(boo.id); grid.appendChild(el('button', { class: 'exp-chip' + (on ? ' sel' : ''), onclick: () => { if (on) selected.delete(boo.id); else if (selected.size < 12) selected.add(boo.id); draw(); } }, [el('span', { html: renderItem(boo, { size: 46 }) }), el('b', { text: boo.name }), el('small', { text: `${boo.species} · ${featuresOf(boo).colour}` })])); }
      const picked = party.filter(x => selected.has(x.id)); let filled = false; if (picked.length >= 8 && !genRule(picked, { tier: 1 })) { for (const g of GUESTS) { if (selected.size >= 12) break; selected.add(g.id); } filled = true; }
      count.textContent = `${selected.size} / 8–12 explorers`; banner.textContent = filled ? 'The trail needs more variety — friends are joining!' : ''; start.disabled = selected.size < 8;
    };
    const start = el('button', { class: 'btn big', text: 'Start the trail', onclick: () => { const own = all(), party = [...own, ...GUESTS].filter(x => selected.has(x.id)); mutate(s => { s.expedition = s.expedition || { tiers:{}, progress:{}, party:[] }; s.expedition.party = party.map(x => x.id); }); trail(); } });
    root.append(el('div', { class:'exp-picker card' }, [el('h2', { text:'Boo Expedition' }), el('p', { text:'Choose a party for the trail.' }), count, banner, grid, start]), backControl(() => ctx.go('hub'), { floating:true })); draw();
  }
  function trail() { clear(root); const s = getState(), ex = s.expedition || { tiers:{}, progress:{} }; const party = [...all(), ...GUESTS].filter(x => (ex.party || []).includes(x.id)); const nodes = el('div', { class:'exp-trail' });
    NODES.forEach(node => { const tier = (ex.tiers || {})[node.key] || 1, done = (ex.progress || {})[node.key]; nodes.appendChild(el('button', { class:'exp-node' + (done ? ' done' : ''), onclick: () => ctx.go('expeditionpuzzle', { node:node.key }) }, [el('span', { class:'exp-node-icon', text:node.icon }), el('b', { text:node.name }), el('small', { text:`Tier ${'ⅠⅡⅢⅣ'[tier-1]} ${done ? '★'.repeat(done) : ''}` })])); });
    const camp = el('div', { class:'exp-camp' }, [el('span', { text:'🔥' }), el('span', { text: party.map(p => p.name).join(' · ') || 'Your explorers' }), el('small', { text:'Cosy cocoa at camp' })]); root.append(el('h2', { text:'The Expedition Trail' }), nodes, camp, backControl(picker, { floating:true }));
  }
  if (params?.trail) trail(); else picker(); return { unmount() {} };
}
