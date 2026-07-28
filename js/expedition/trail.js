import { el, clear, backControl } from '../ui.js';
import { getState, mutate, todayKey } from '../state.js';
import { BY_ID } from '../../data/catalogue.js';
import { NODES, GUESTS } from '../../data/expedition.js';
import { genRule, featuresOf } from '../attrengine.js';
import { renderItem } from '../art.js';
import { guideLine } from '../guide.js';

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
    const gotoGames = el('button', { class: 'btn secondary exp-goto-games', text: 'Go and win some stars', hidden: true, onclick: () => ctx.go('hub') });
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
      // First-run: a player who has not met eight Boos yet would otherwise face an empty
      // grid and a dead Start button with no idea why. Say so warmly and point at the one
      // useful action — go and win some stars. (Audit; house law: never a bare blank.)
      const shortBy = 8 - own.length;
      if (shortBy > 0) {
        banner.textContent = own.length === 0
          ? 'The trail needs eight friends. Win some stars and Boos will come to live here!'
          : `${shortBy} more ${shortBy === 1 ? 'friend' : 'friends'} and the trail can set off!`;
        gotoGames.hidden = false;
      } else {
        banner.textContent = needsFriends ? guideLine('L_EXP_GUESTS') : '';
        gotoGames.hidden = true;
      }
      start.disabled = selected.size < 8;
    };
    root.append(el('div', { class: 'exp-picker card' }, [
      el('h2', { text: 'Boo Expedition' }), el('p', { text: 'Choose a party for the trail.' }),
      count, banner, grid, start, gotoGames
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
    if (doneAll) grantTrailRewards(ex);
    // RUN18A H2: this line used to pass the ternary's `null` straight into append(), which
    // is NOT el() — el() skips null children, but the DOM's own append() coerces null to
    // the string "null" and prints it. So every child who had not yet finished the trail
    // was shown the word "null" under the campfire. Filter, then spread.
    root.append(...[
      el('h2', { text: 'The Expedition Trail' }), nodes, camp,
      doneAll ? el('p', { class: 'exp-complete', text: 'The whole trail is glowing with stars!' }) : null,
      backControl(picker, { floating: true })
    ].filter(Boolean));
  }
  // RUN10 P15 rewards: a full trail grants the "First Expedition" trophy; a full trail at
  // tier ≥2 grants the exclusive Boo Wander (never in box rolls); all nodes at tier 4 grant
  // "Tier 4 Master". The Snaffle reveal plays once. All idempotent via save flags.
  function grantTrailRewards(ex) {
    const s = getState();
    const tiers = ex.tiers || {};
    const allTier2 = NODES.every(n => (tiers[n.key] || 1) >= 2);
    const allTier4 = NODES.every(n => (tiers[n.key] || 1) >= 4);
    let gotWander = false, firstTrail = false;
    mutate(save => {
      save.trophies = save.trophies || {};
      if (!save.trophies.exp_first) { save.trophies.exp_first = todayKey(); firstTrail = true; }
      if (allTier4 && !save.trophies.exp_tier4) save.trophies.exp_tier4 = todayKey();
      save.inventory = save.inventory || {};
      if (allTier2 && !(save.inventory.boo_wander > 0)) { save.inventory.boo_wander = 1; gotWander = true; }
    });
    if ((firstTrail || gotWander) && !(s.seen && s.seen.expReveal)) {
      mutate(save => { save.seen = save.seen || {}; save.seen.expReveal = true; });
      showReveal(gotWander);
    }
  }
  function showReveal(gotWander) {
    const card = el('div', { class: 'exp-reveal card' }, [
      el('p', { class: 'exp-snaffle', text: guideLine('L_EXP_SNAFFLE') }),
      gotWander ? el('div', { class: 'exp-reward' }, [el('span', { html: renderItem(BY_ID['boo_wander'], { size: 72 }) }), el('b', { text: 'Wander joins your Boos!' })]) : null,
      el('button', { class: 'btn', text: 'Hooray!', onclick: () => overlay.remove() })
    ]);
    const overlay = el('div', { class: 'overlay exp-reveal-overlay' }, [card]);
    root.appendChild(overlay);
  }

  if (params?.trail) trail(); else picker();
  return { unmount() {} };
}
