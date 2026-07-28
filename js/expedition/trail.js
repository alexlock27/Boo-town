import { el, clear, backControl, REDUCED, wobble, starsRow } from '../ui.js';
import { getState, mutate, todayKey } from '../state.js';
import { BY_ID } from '../../data/catalogue.js';
import { NODES, GUESTS } from '../../data/expedition.js';
import { genRule } from '../attrengine.js';
import { renderItem, renderExpGlyph, renderTrailScene, TRAIL_VIEWS, TRAIL_NODE_ATS } from '../art.js';
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
  let trailCleanup = null;

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

  // RUN18C C2 — THE TRAIL IS A PLACE. Four buttons in a column became one drawn hillside
  // with the party standing on it. Every position on this screen comes from the real SVG
  // path via getPointAtLength, so the art and the choreography can never drift apart.
  function trail(opts = {}) {
    clear(root);
    let walking = false;
    const save = getState(), ex = save.expedition || { tiers: {}, progress: {} };
    const explorers = partyFor(new Set(ex.party || []));
    const progress = ex.progress || {}, tiers = ex.tiers || {};
    const doneOf = node => progress[node.key] || 0;
    // The current node is the first she has not finished; when the trail is done, the last.
    const currentIndex = Math.max(0, (() => { const i = NODES.findIndex(node => !doneOf(node)); return i < 0 ? NODES.length - 1 : i; })());

    // A phone held upright gets the portrait hillside; everything wider (tablets, desktop,
    // and a phone on its side, which is wide and short) gets the landscape one.
    const portraitMode = () => { try { return window.matchMedia('(max-width: 600px) and (min-height: 501px)').matches; } catch { return false; } };
    let mode = portraitMode() ? 'port' : 'land';
    const map = el('div', { class: 'exp-map ' + mode, html: renderTrailScene(mode) });
    const nodes = el('div', { class: 'exp-trail' });
    const walkers = el('div', { class: 'exp-walkers' });
    const camp = campNode(explorers);
    map.append(nodes, camp, walkers);

    const guide = createGuideBubble({ view: 'head', size: 62, side: 'left' });
    guide.root.classList.add('exp-guide');
    guide.root.hidden = true;
    const say = text => { guide.root.hidden = false; guide.sayText(text); };

    const doneAll = NODES.every(node => doneOf(node) > 0);
    const markers = NODES.map((node, index) => {
      const done = doneOf(node), tier = Math.max(1, Math.min(4, tiers[node.key] || 1));
      const locked = index > currentIndex;
      const marker = el('button', {
        class: 'exp-node' + (done ? ' done' : '') + (index === currentIndex ? ' current' : '') + (locked ? ' locked' : ''),
        dataset: { node: node.key },
        'aria-label': `${node.name}${done ? `, finished with ${done} star${done === 1 ? '' : 's'}` : locked ? `, locked — finish ${NODES[currentIndex].short} first` : ', ready to play'}`,
        onclick: event => {
          if (walking) return;
          if (locked) { wobble(event.currentTarget); say(`Finish ${NODES[currentIndex].short} first!`); return; }
          ctx.go('expeditionpuzzle', { node: node.key });
        }
      }, [
        el('span', { class: 'exp-node-art', html: renderExpGlyph(node.key, { size: 72 }) }),
        el('span', { class: 'exp-node-star', html: starsRow(done, { max: 3, size: 15 }) }),
        el('b', { class: 'exp-node-name', text: node.name }),
        // A locked node explains ITSELF, without waiting to be tapped — "Locked" tells a
        // child nothing she can act on; the pack's own sentence tells her what to do next.
        el('small', { class: 'exp-node-tier', text: done ? `Tier ${'ⅠⅡⅢⅣ'[tier - 1]} · tap to play again` : locked ? `Finish ${NODES[currentIndex].short} first` : `Tier ${'ⅠⅡⅢⅣ'[tier - 1]} · tap to begin` })
      ]);
      nodes.appendChild(marker);
      return marker;
    });

    if (doneAll) grantTrailRewards(ex);
    root.append(
      el('div', { class: 'exp-trailwrap' }, [
        el('h2', { class: 'exp-title', text: 'The Expedition Trail' }),
        guide.root, map,
        doneAll ? el('p', { class: 'exp-complete', text: 'The whole trail is glowing with stars!' }) : null
      ].filter(Boolean)),
      backControl(picker, { floating: true })
    );

    // ---- geometry: everything is placed from the drawn path, never from guesses --------
    let view = TRAIL_VIEWS[mode], nodeAt = TRAIL_NODE_ATS[mode];
    let path = map.querySelector('.exp-path');
    let len = path ? path.getTotalLength() : 0;
    const at = fraction => {
      if (!path || !len) return { x: view.w * fraction, y: view.h * 0.5 };
      const p = path.getPointAtLength(len * Math.max(0, Math.min(1, fraction)));
      return { x: p.x, y: p.y };
    };
    const pct = p => ({ left: `${(p.x / view.w) * 100}%`, top: `${(p.y / view.h) * 100}%` });
    const place = (node, p) => { const c = pct(p); node.style.left = c.left; node.style.top = c.top; };
    // A marker is a fixed-size card on a map that is not: on a narrow screen the sign for
    // the last node hung off the edge of the country it names. Nudge any marker that lands
    // outside back inside, the same way the town's item menu clamps itself (RUN4 hotfix 3).
    const clampMarkers = () => {
      const box = map.getBoundingClientRect();
      if (!box.width) return;
      markers.forEach(marker => {
        marker.style.marginLeft = ''; marker.style.marginTop = '';
        const r = marker.getBoundingClientRect();
        let dx = 0, dy = 0;
        if (r.left < box.left + 4) dx = box.left + 4 - r.left;
        else if (r.right > box.right - 4) dx = box.right - 4 - r.right;
        if (r.top < box.top + 4) dy = box.top + 4 - r.top;
        else if (r.bottom > box.bottom - 4) dy = box.bottom - 4 - r.bottom;
        if (dx) marker.style.marginLeft = `${Math.round(dx)}px`;
        if (dy) marker.style.marginTop = `${Math.round(dy)}px`;
      });
    };
    // The map's box must match its viewBox EXACTLY — every marker and every walker is
    // positioned as a percentage of it, so a letterboxed container would put the party
    // beside the path instead of on it. So the width is capped from the height available
    // rather than the height from the width. Measured, not `vh`: `vh` ignores the Bigger
    // text zoom (RUN18B Y15) and would overflow a screen that had asked for larger type.
    const sizeMap = () => {
      const wrap = map.parentElement;
      if (!wrap || !wrap.clientHeight) return;
      const style = getComputedStyle(wrap);
      const padding = parseFloat(style.paddingTop || 0) + parseFloat(style.paddingBottom || 0);
      let used = 0;
      [...wrap.children].forEach(child => { if (child !== map) used += child.getBoundingClientRect().height + 8; });
      const avail = Math.max(180, wrap.clientHeight - padding - used - 8);
      map.style.maxWidth = `${Math.floor(avail * (view.w / view.h))}px`;
    };
    const layOut = () => { sizeMap(); markers.forEach((marker, index) => place(marker, at(nodeAt[index]))); clampMarkers(); };
    layOut();

    // the party: 48px portraits in a loose cluster, jittered so they read as a group of
    // friends standing about rather than a rank of soldiers
    // Biased DOWN the path so the party stands below its signpost rather than over the
    // marker's own name — spread wide and shallow so they read as walking in a line.
    const JITTER = [[-64, 2], [-38, 12], [-14, -6], [10, 8], [34, -4], [58, 10], [-52, 18], [-24, 22], [22, 22], [48, 20], [-6, 30], [72, 4]];
    const CLUSTER_DROP = 20;
    const cluster = explorers.slice(0, 12).map((boo, index) => {
      const j = JITTER[index % JITTER.length];
      const dot = el('div', { class: 'exp-walker', title: boo.name, html: renderItem(boo, { size: 48 }) });
      dot.dataset.jx = String(j[0] + (index % 3) * 3 - 3);
      dot.dataset.jy = String(j[1] + (index % 2) * 4 - 2 + CLUSTER_DROP);
      dot.style.setProperty('--jx', `${dot.dataset.jx}px`);
      dot.style.setProperty('--jy', `${dot.dataset.jy}px`);
      walkers.appendChild(dot);
      return dot;
    });
    const standAt = fraction => { const p = at(fraction); cluster.forEach(dot => { place(dot, p); dot.style.transform = ''; }); };

    // ---- the walk: 3000ms along the path curve, with 2000ms of cocoa in the middle -----
    const fromIndex = NODES.findIndex(node => node.key === opts.from);
    const canWalk = fromIndex >= 0 && fromIndex < NODES.length - 1 && doneOf(NODES[fromIndex]) > 0 && cluster.length;
    standAt(nodeAt[canWalk ? fromIndex : currentIndex]);
    if (canWalk && !REDUCED) walkTo(fromIndex);
    else if (canWalk) { standAt(nodeAt[fromIndex + 1]); popStar(markers[fromIndex]); }
    else if (opts.from && fromIndex === NODES.length - 1) popStar(markers[fromIndex]);

    function walkTo(index) {
      walking = true;
      markers.forEach(marker => marker.classList.add('walking'));
      const startF = nodeAt[index], endF = nodeAt[index + 1], midF = (startF + endF) / 2;
      const start = at(startF);
      const rect = () => map.getBoundingClientRect();
      const scale = () => rect().width / view.w;
      const step = (fromF, toF, ms) => new Promise(resolve => {
        const t0 = performance.now(), k = scale();
        const tick = now => {
          const raw = Math.min(1, (now - t0) / ms);
          const eased = raw < 0.5 ? 2 * raw * raw : 1 - Math.pow(-2 * raw + 2, 2) / 2;
          const p = at(fromF + (toF - fromF) * eased);
          const bob = Math.sin(raw * Math.PI * 8) * 3;
          cluster.forEach((dot, i) => {
            dot.style.transform = `translate3d(${(p.x - start.x) * k}px, ${(p.y - start.y) * k + (i % 2 ? bob : -bob)}px, 0)`;
          });
          if (raw < 1) requestAnimationFrame(tick); else resolve();
        };
        requestAnimationFrame(tick);
      });
      const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
      place(camp, at(midF));
      camp.classList.remove('show');
      step(startF, midF, 1400)
        // The camp card IS the party at cocoa — its own portraits are theirs. Fading the
        // cluster for its two seconds stops eight heads poking out from behind the card.
        .then(() => { camp.classList.add('show'); walkers.classList.add('at-camp'); return wait(2000); })
        .then(() => { camp.classList.remove('show'); walkers.classList.remove('at-camp'); return step(midF, endF, 1600); })
        .then(() => {
          standAt(endF);
          walking = false;
          markers.forEach(marker => marker.classList.remove('walking'));
          popStar(markers[index]);
        });
    }
    function popStar(marker) {
      if (!marker) return;
      marker.classList.add('star-pop');
      sfx.chime();
      setTimeout(() => marker.classList.remove('star-pop'), 400);
    }
    // Turning a tablet, or a phone, swaps which hillside is the right one — and every
    // position on this screen is derived, so re-deriving them is the whole of the fix.
    const onResize = () => {
      if (walking) return;
      const want = portraitMode() ? 'port' : 'land';
      if (want !== mode) {
        mode = want; view = TRAIL_VIEWS[mode]; nodeAt = TRAIL_NODE_ATS[mode];
        map.className = 'exp-map ' + mode;
        map.innerHTML = renderTrailScene(mode);
        map.append(nodes, camp, walkers);
        path = map.querySelector('.exp-path');
        len = path ? path.getTotalLength() : 0;
      }
      layOut();
      standAt(nodeAt[currentIndex]);
    };
    window.addEventListener('resize', onResize);
    trailCleanup = () => window.removeEventListener('resize', onResize);
    if (typeof window !== 'undefined') window.__expeditionTrail = {
      current: () => currentIndex, walking: () => walking, mode: () => mode,
      walkerBoxes: () => cluster.map(dot => { const r = dot.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y) }; }),
      campShown: () => camp.classList.contains('show'),
      escaping: () => { const b = map.getBoundingClientRect(); return markers.filter(m => { const r = m.getBoundingClientRect(); return r.left < b.left - 1 || r.right > b.right + 1 || r.top < b.top - 1 || r.bottom > b.bottom + 1; }).length; }
    };
  }

  // The cocoa camp — the interstitial beat between two nodes. Same content it always had
  // (the party, a fire, a line), drawn instead of typed, with a steam wisp on a loop.
  function campNode(explorers) {
    const mugs = el('div', { class: 'exp-camp-mugs' });
    explorers.slice(0, 8).forEach(boo => mugs.appendChild(el('span', { class: 'exp-camp-boo', title: boo.name, html: renderItem(boo, { size: 34 }) })));
    return el('div', { class: 'exp-camp' }, [
      el('div', { class: 'exp-camp-fire' }, [
        el('span', { class: 'exp-camp-flame', html: renderExpGlyph('campfire', { size: 44 }) }),
        el('span', { class: 'exp-camp-steam', html: '<svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true"><path class="wisp w1" d="M8 20 q-4 -5 0 -9 q4 -5 0 -9" fill="none" stroke="#7FA8C8" stroke-width="2" stroke-linecap="round"/><path class="wisp w2" d="M16 20 q4 -5 0 -9 q-4 -5 0 -9" fill="none" stroke="#7FA8C8" stroke-width="2" stroke-linecap="round"/></svg>' })
      ]),
      mugs,
      el('small', { class: 'exp-camp-line', text: 'Cosy cocoa at camp' })
    ]);
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

  if (params?.trail) trail({ from: params.from }); else picker();
  return { unmount() { if (trailCleanup) trailCleanup(); trailCleanup = null; } };
}
