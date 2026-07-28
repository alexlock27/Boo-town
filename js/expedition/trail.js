import { el, clear, backControl, REDUCED } from '../ui.js';
import { getState, mutate, todayKey } from '../state.js';
import { BY_ID } from '../../data/catalogue.js';
import { NODES, GUESTS } from '../../data/expedition.js';
import { genRule } from '../attrengine.js';
import { renderItem, renderExpGlyph } from '../art.js';
import { guideLine, createGuideBubble } from '../guide.js';
import { sfx } from '../sfx.js';

// RUN18C C1 — the party is EIGHT. The engine has always been able to run a party of up to
// twelve, and it still does: the extra places are the visitors it invites itself when eight
// owned Boos cannot be told apart by any rule. She picks eight; the trail borrows the rest.
export const PARTY_SIZE = 8;
export const PARTY_MAX = 12;
export const NEED_MORE_BOOS = 'An expedition needs 8 brave Boos — open a few more mystery boxes first!';
export const DEPART_LINE = 'The expedition sets off!';
const DEPART_MS = 1200;

const partyFromSave = () => Object.keys(getState().inventory || {})
  .filter(id => getState().inventory[id] > 0 && BY_ID[id]?.kind === 'boo')
  .map(id => ({ ...BY_ID[id], id }));

export function mount(container, params, ctx) {
  const root = el('div', { class: 'screen expedition' });
  container.appendChild(root);
  const savedParty = new Set((getState().expedition || {}).party || []);
  let selected = new Set(), autoGuests = new Set();
  const owned = () => partyFromSave();
  // A saved party is restored, but only the Boos she actually owns — the visitors are
  // recomputed each time, because whether the trail needs them depends on who is in it.
  owned().forEach(boo => { if (savedParty.has(boo.id) && selected.size < PARTY_SIZE) selected.add(boo.id); });
  const partyFor = ids => [...owned(), ...GUESTS].filter(boo => ids.has(boo.id));

  function picker() {
    clear(root);
    let departing = false;
    const grid = el('div', { class: 'exp-party-grid' });
    // "Explorers: n of 8" — the boots fill left-to-right as she picks, so the chip is a
    // progress bar and a label at once.
    const countFill = el('span', { class: 'exp-count-fill' });
    const countText = el('span', { class: 'exp-count-text' });
    const count = el('div', { class: 'exp-count-chip', role: 'status', 'aria-live': 'polite' }, [
      countFill, el('span', { class: 'exp-count-boots', html: renderExpGlyph('boots', { size: 20 }) }), countText
    ]);
    const banner = el('p', { class: 'exp-guests' });
    const empty = el('div', { class: 'exp-need card', hidden: true }, [
      el('p', { class: 'exp-need-line', text: NEED_MORE_BOOS }),
      el('button', { class: 'btn exp-see-boos', text: 'See my Boos', onclick: () => ctx.go('collection') })
    ]);
    // Twiggy waits off-screen until she has something to say — a guide head beside an empty
    // bubble is a prop, and the pack gives her exactly one line here.
    const guide = createGuideBubble({ view: 'head', size: 66, side: 'left' });
    guide.root.classList.add('exp-guide');
    guide.root.hidden = true;
    guide.hide();
    const start = el('button', { class: 'btn big exp-go', text: 'Off we go!', disabled: '', onclick: () => depart() });
    const goWrap = el('div', { class: 'exp-go-wrap' }, [start]);

    const depart = () => {
      if (departing || selected.size < PARTY_SIZE) return;
      departing = true;
      start.disabled = true;
      guide.root.hidden = false;
      guide.sayText(DEPART_LINE);
      const explorers = partyFor(new Set([...selected, ...autoGuests]));
      mutate(save => { save.expedition = save.expedition || { tiers: {}, progress: {}, party: [] }; save.expedition.party = explorers.map(boo => boo.id); });
      grid.classList.add('exp-departing');
      grid.querySelectorAll('.exp-chip').forEach(tile => { tile.disabled = true; });
      setTimeout(trail, REDUCED ? 320 : DEPART_MS);
    };

    const draw = () => {
      const own = owned();
      const picked = own.filter(boo => selected.has(boo.id));
      // The visitors are not a consolation prize — they exist because a rule needs a party
      // it can divide, and eight identical Boos cannot be divided. Invited only then.
      const needsFriends = picked.length >= PARTY_SIZE && !genRule(picked, { tier: 1 });
      if (needsFriends) {
        autoGuests = new Set();
        for (const guest of GUESTS) { if (picked.length + autoGuests.size >= PARTY_MAX) break; autoGuests.add(guest.id); }
      } else if (autoGuests.size) autoGuests = new Set();
      grid.innerHTML = '';
      const visible = [...own, ...GUESTS.filter(guest => autoGuests.has(guest.id))];
      for (const boo of visible) {
        const guest = autoGuests.has(boo.id), on = selected.has(boo.id);
        const tile = el('button', {
          class: 'exp-chip exp-tile' + (on ? ' sel' : '') + (guest ? ' visitor' : ''),
          disabled: guest ? '' : undefined,
          'aria-pressed': guest ? undefined : (on ? 'true' : 'false'),
          'aria-label': guest ? `${boo.name}, a visitor joining the trail` : `${boo.name}${on ? ', chosen' : ''}`,
          onclick: event => {
            if (departing) return;
            if (on) selected.delete(boo.id);
            else if (selected.size >= PARTY_SIZE) { banner.textContent = 'That is eight already — tap one to swap it out!'; return; }
            else { selected.add(boo.id); event.currentTarget.classList.add('hop'); }
            sfx.tap();
            draw();
          }
        }, [
          el('span', { class: 'exp-tile-art', html: renderItem(boo, { size: 88 }) }),
          el('b', { class: 'exp-tile-name', text: boo.name }),
          el('span', { class: 'exp-tick', html: renderExpGlyph('tick', { size: 24 }) }),
          guest ? el('em', { class: 'exp-visitor-flag', text: 'VISITOR' }) : null
        ]);
        grid.appendChild(tile);
      }
      const n = selected.size;
      countText.textContent = `Explorers: ${n} of ${PARTY_SIZE}`;
      countFill.style.width = `${Math.round((Math.min(n, PARTY_SIZE) / PARTY_SIZE) * 100)}%`;
      count.classList.remove('pulse'); void count.offsetWidth; if (n) count.classList.add('pulse');
      // Never a bare blank: a player who has not met eight Boos yet is told why and handed
      // the one useful door. Copy verbatim from the pack (C6).
      const short = own.length < PARTY_SIZE;
      empty.hidden = !short;
      banner.textContent = short ? '' : (needsFriends ? guideLine('L_EXP_GUESTS') : '');
      start.disabled = n < PARTY_SIZE;
      goWrap.classList.toggle('up', n >= PARTY_SIZE);
    };

    root.append(
      el('div', { class: 'exp-picker' }, [
        el('div', { class: 'exp-head' }, [
          el('h2', { class: 'exp-title', text: 'Boo Expedition' }),
          el('p', { class: 'exp-sub', text: 'Choose eight brave Boos for the trail.' }),
          count
        ]),
        guide.root, empty, banner,
        el('div', { class: 'exp-party-card card' }, [grid]),
        goWrap
      ]),
      backControl(() => ctx.go('hub'), { floating: true })
    );
    draw();
    if (typeof window !== 'undefined') window.__expedition = { picked: () => [...selected], guests: () => [...autoGuests], depart };
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
