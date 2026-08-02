// js/shop.js — RUN15 V4: the Boo Shop.
// Feel goals: seeing something she wants and knowing exactly how to get it; saving up
// feeling like anticipation, not a wall. Anti-patterns guarded against: anything that
// reads as "buy the fun", a shop that makes boxes pointless, an empty-looking shelf.
//
// G11 is structural here, not a convention: buyItem() deducts from stars.spent ONLY.
// stars.total and stars.byType are lifetime and are never written by this file.

import { el, clear, backControl, confetti, sparkleAt, dialog, REDUCED } from './ui.js';
import { getState, mutate, commit } from './state.js';
import { createDrawer } from './drawer.js';
import { renderItem, renderGuide, renderDressingSwatch } from './art.js';
// RUN19 Z6: the room dressings share the House shelf (creative stars), grouped under room-name
// chips. They are not catalogue items — they are never placed, they are APPLIED — so they get
// their own listing rather than being forced into the item-card shape.
import { DRESSINGS_FOR_SALE, DRESSING_ROOMS, DRESSING_BY_ID } from '../data/dressings.js';
import { BY_ID } from '../data/catalogue.js';
import { SHELVES, priceOf, isUnlockOnly, UNLOCK_ONLY_RIBBON, WELCOME_PURSE } from '../data/shop.js';
import { STAR_TYPES, typeByKey, spendableOf, spendableAll, canAfford, planPayment, LEGACY_KEY, LEGACY_LABEL } from '../data/startypes.js';
import { sfx, music } from './sfx.js';
import { guideLine, speakMaybe } from './guide.js';
import { maybeIntro, replayIntro, createRoundTimers } from './intro.js';
import { stampJournal } from './quests.js';

// RUN18A H4. The confirmation card is held long enough to actually read — the old toast
// was gone in 1.8s including its fade — and it sits this far clear of the shelf tab row.
export const SHOP_BOUGHT_MS = 2500;
const SHOP_BOUGHT_MIN_BAND = 250;   // the card is ~213px tall; never centre it in less
const SHOP_BOUGHT_CLEAR = 14;

// ---- RUN18B Y2: the handoff ------------------------------------------------------------
// "Find it in Build" was a set of directions, not a door. The confirmation card now offers
// the VERB the thing wants — pop it in a room, find it a spot, put it on a Boo — and takes
// her there with the item already selected in the right drawer tab.
//
// Keyed by SHELF first (the Special shelf has its own line whatever kind its stock is this
// month) and then by the item's KIND. `[Not now] is always second`, per the pack.
export const USE_VERBS = {
  special:   { line: (n) => `${n} is yours — something truly special! Where will it live?`, label: 'Take me there', to: 'town-meadow' },
  furniture: { line: (n) => `${n} is yours! Pop it in a room?`, label: 'Take me there', to: 'house-lounge' },
  accessory: { line: (n) => `${n} is yours! Who's wearing it?`, label: 'Dress a Boo', to: 'dress' },
  place:     { line: (n) => `${n} is yours! Where shall it go?`, label: 'Take me there', to: 'town-here' }
};
// deco, landscape and the playground shelf's stock all want the same verb: somewhere outside.
export function useVerbFor(itemId, shelfId) {
  const item = BY_ID[itemId];
  const kind = item && item.kind;
  // The Special shelf keeps its authored LINE but takes the destination its KIND needs.
  //
  // RUN18B Y2 says "Special shelf → build mode, Meadow", and every one of the three items
  // that shelf actually stocks (projector lamp, grand bookshelf, telescope) is INDOOR-ONLY
  // furniture. Following the pack literally lands her in the Meadow holding something the
  // Meadow refuses — "Cosy things like a roof!" — twice, with no way forward. That is
  // "working-but-dead", which CLAUDE.md's quality bar makes a FAIL, and CLAUDE.md binds
  // over a pack. So this applies the pack's OWN adjacent rule (furniture → the Lounge)
  // rather than inventing a third one. Recorded in NEEDS_ALEX.md as a pack correction.
  // (Found by the playtest critic, who called it an escalation rather than a deviation.)
  const line = shelfId === 'special' ? USE_VERBS.special.line : null;
  const base = kind === 'furniture' ? USE_VERBS.furniture
    : kind === 'accessory' ? USE_VERBS.accessory
      : USE_VERBS.place;   // deco · landscape · playground
  return line ? { ...base, line } : base;
}

export const SHOP_INTRO = [
  { text: 'Welcome to my shop! Everything here is bought with stars.' },
  { text: 'Each shelf likes a different kind of star. Look for the little icon!' },
  { text: 'Tap the heart on something to save up for it. No rush at all.' }
];

// ---- the purchase engine (the ONLY route from a wish to an owned thing) --------------
// Returns { ok, reason?, paid? }. Every refusal is a reason, never a silent no-op.
// RUN18B Y14: at or above this, a purchase is confirmed before it is spent.
export const CONFIRM_AT_STARS = 10;

// RUN19 Z6 — buying a room dressing. Deliberately the same shape as buyItem below: the same
// planPayment, the same SPENDING-ledger-only rule (lifetime totals are never touched), the same
// goal clear. It writes `dressingsOwned` rather than `inventory`, because a dressing is not a
// thing you own one of and place — it is an option you unlock and can apply as often as you like.
export function buyDressing(dressingId) {
  const d = DRESSING_BY_ID[dressingId];
  if (!d) return { ok: false, reason: 'notForSale' };
  if (d.cost === 0) return { ok: false, reason: 'alreadyFree' };
  const s = getState();
  if ((s.dressingsOwned || {})[dressingId]) return { ok: false, reason: 'alreadyOwned' };
  const plan = planPayment(s, 'creative', d.cost);
  if (!plan) return { ok: false, reason: 'cannotAfford' };
  mutate(st => {
    st.stars.spent = st.stars.spent || {};
    st.stars.spent.creative = (st.stars.spent.creative || 0) + plan.fromType;
    st.stars.spent[LEGACY_KEY] = (st.stars.spent[LEGACY_KEY] || 0) + plan.fromLegacy;
    st.dressingsOwned = st.dressingsOwned || {};
    st.dressingsOwned[dressingId] = true;
    if (st.shop && st.shop.goal === dressingId) st.shop.goal = null;
  });
  commit();
  stampJournal('firstPurchase');
  return { ok: true, paid: plan, price: { cost: d.cost, currency: 'creative' } };
}

export function buyItem(itemId) {
  // The unlock-only gate is asked FIRST so the refusal carries the true reason — a Boo is
  // not "not for sale today", she is never for sale, and the shop says so warmly.
  if (isUnlockOnly(itemId)) return { ok: false, reason: 'unlockOnly' };
  const price = priceOf(itemId);
  if (!price) return { ok: false, reason: 'notForSale' };
  const s = getState();
  const plan = planPayment(s, price.currency, price.cost);
  if (!plan) return { ok: false, reason: 'cannotAfford' };
  mutate(st => {
    st.stars.spent = st.stars.spent || {};
    // SPENDING ledger only. Lifetime totals are not touched here, by construction.
    st.stars.spent[price.currency] = (st.stars.spent[price.currency] || 0) + plan.fromType;
    st.stars.spent[LEGACY_KEY] = (st.stars.spent[LEGACY_KEY] || 0) + plan.fromLegacy;
    st.inventory = st.inventory || {};
    st.inventory[itemId] = (st.inventory[itemId] || 0) + 1;
    // a bought thing clears the save-up goal if it WAS the goal
    if (st.shop && st.shop.goal === itemId) st.shop.goal = null;
  });
  commit();
  stampJournal('firstPurchase');
  return { ok: true, paid: plan, price };
}
export function setGoal(itemId) {
  mutate(st => { st.shop = st.shop || {}; st.shop.goal = itemId || null; });
  return itemId;
}
export function currentGoal() { const s = getState(); return (s.shop && s.shop.goal) || null; }
// The hub's Today rail asks this: {item, cost, currency, have, pct} or null. One chip,
// no reminders, never a nag — the anticipation mechanic and nothing more.
export function goalProgress() {
  const id = currentGoal();
  if (!id) return null;
  const price = priceOf(id), item = BY_ID[id];
  if (!price || !item) return null;
  const s = getState();
  const have = spendableOf(s, price.currency) + spendableOf(s, LEGACY_KEY);
  return { id, item, cost: price.cost, currency: price.currency,
    have: Math.min(have, price.cost), pct: Math.max(0, Math.min(100, Math.round(have / price.cost * 100))) };
}
// The Welcome purse: first visit only, a small ceremony, 20 legacy stars.
export function grantWelcomePurse() {
  const s = getState();
  if (s.shop && s.shop.welcomed) return false;
  mutate(st => {
    st.shop = st.shop || {};
    st.shop.welcomed = true;
    st.stars.legacy = (st.stars.legacy || 0) + WELCOME_PURSE;
  });
  commit();
  return true;
}

export function mount(container, params, ctx) {
  const root = el('div', { class: 'screen shop' });
  container.appendChild(root);
  music.play('calm');
  // RUN12 S6's law: a screen that runs an intro must not run itself behind the intro's
  // back. The shop has no round to freeze, but its timed flourishes (the bought-card, the
  // welcome ceremony) route through these timers so they wait for the overlay too.
  const timers = createRoundTimers();

  const s0 = getState();
  const header = el('div', { class: 'shop-header' }, [
    el('div', { class: 'shop-keeper', html: renderGuide(s0.guide, { view: 'head', size: 76 }) }),
    el('div', { class: 'shop-title-wrap' }, [
      el('h2', { class: 'shop-title', text: '🛒 The Boo Shop' }),
      el('p', { class: 'shop-sub', text: 'Spend the stars you have earned. Boos and costumes still come from boxes!' })
    ]),
    el('button', { class: 'shop-help', text: '?', 'aria-label': 'How the shop works', onclick: () => replayIntro('shop', SHOP_INTRO) })
  ]);
  const purse = el('div', { class: 'shop-purse', 'aria-label': 'Your stars' });
  const shelfNodes = {};
  const tabs = SHELVES.map(shelf => {
    const node = el('div', { class: 'shop-shelf screen-content', dataset: { shelf: shelf.id } });
    shelfNodes[shelf.id] = node;
    return { id: shelf.id, label: shelf.label, node };
  });
  // RUN18D (playtest critic, D1 pass): the shop arrived as a blank purple screen with one
  // unlabelled grey pill at the bottom. Three things were wrong and all three were here.
  //  1. The drawer starts CLOSED. Paint and Collage have a canvas above theirs; the shop
  //     has nothing at all — the shelves ARE the screen, so it opens on arrival.
  //  2. `setCurrent()` was never called, so the collapsed bar was a skeleton pill and a ▲.
  //     Paint and Collage both call it; the shop simply never did. It says which shelf is
  //     open and which star it likes, and it is kept in step by onTab.
  //  3. The tray was capped at 48vh — 399px of an 831px tablet with 370px of purple above
  //     it — so one and a half rows of a five-row shelf were visible. See the CSS.
  const shelfCurrent = (id) => {
    const sh = SHELVES.find(x => x.id === id) || SHELVES[0];
    const t = STAR_TYPES.find(x => x.key === sh.currency);
    return `<span class="bd-cur-ic">${t ? t.icon : '⭐'}</span>` +
      `<span class="bd-cur-label">${sh.label} shelf<small> · ${t ? t.name : 'stars'}</small></span>`;
  };
  const drawerApi = createDrawer({
    tabs, initial: 0, ariaLabel: 'Shop shelves',
    onTab: (id) => drawerApi.setCurrent(shelfCurrent(id))
  });
  drawerApi.setCurrent(shelfCurrent(SHELVES[0].id));
  drawerApi.root.classList.add('shop-drawer');
  drawerApi.open();
  // RUN21A-9: Back goes where she came from. A town door passes from:'town' (+fromArea,
  // and fromRoom for a Boo House room); every other entry — Collection's shop link, QA
  // hooks, anything paramless — keeps the hub exactly as before.
  root.append(header, purse, drawerApi.root, backControl(() => {
    if (params && params.from === 'town') {
      ctx.go('town', params.fromRoom
        ? { area: 'boohouse', room: params.fromRoom }
        : { area: params.fromArea || 'meadow' });
    } else ctx.go('hub');
  }, { floating: true }));

  function renderPurse() {
    clear(purse);
    const s = getState();
    const wallet = spendableAll(s);
    for (const t of STAR_TYPES) {
      purse.appendChild(el('div', { class: 'purse-chip', title: t.name }, [
        el('span', { class: 'pc-ic', text: t.icon }),
        el('span', { class: 'pc-n', text: String(wallet[t.key]) })
      ]));
    }
    if (wallet[LEGACY_KEY] > 0) {
      purse.appendChild(el('div', { class: 'purse-chip legacy', title: LEGACY_LABEL }, [
        el('span', { class: 'pc-ic', text: '⭐' }),
        el('span', { class: 'pc-n', text: String(wallet[LEGACY_KEY]) }),
        el('span', { class: 'pc-lbl', text: 'from before' })
      ]));
    }
  }

  // RUN19 Z6: the dressings listing. One block per room, walls and floors together.
  function dressingSection(s, shelf) {
    const t = typeByKey(shelf.currency);
    const wrap = el('section', { class: 'shop-dressings' }, [
      el('h3', { class: 'sd-title', text: '🎨 Room decorating' }),
      el('p', { class: 'sd-blurb', text: 'Wallpaper and floors for the rooms of the Boo House. Once one is yours you can switch back and forth as often as you like, for free.' })
    ]);
    for (const room of DRESSING_ROOMS) {
      const mine = DRESSINGS_FOR_SALE.filter(d => d.room === room.id);
      if (!mine.length) continue;
      const grid = el('div', { class: 'shop-grid sd-grid' });
      for (const d of mine) {
        const owned = !!(s.dressingsOwned || {})[d.id];
        const afford = canAfford(s, shelf.currency, d.cost);
        const card = el('div', { class: 'shop-card sd-card' + (owned ? ' owned' : '') + (!owned && !afford ? ' saving' : ''), dataset: { dressing: d.id } }, [
          el('div', { class: 'sc-art', html: renderDressingSwatch(d, { size: 76 }) }),
          el('div', { class: 'sc-name', text: d.name }),
          el('div', { class: 'sd-slot', text: d.slot === 'walls' ? 'Wallpaper' : 'Floor' }),
          // RUN21A-2: the room lives on the CARD too — a deep-link highlight can land
          // mid-grid with the room group chip scrolled out of view.
          el('div', { class: 'sd-for-room', text: `For the ${room.name}` }),
          owned
            ? el('div', { class: 'sc-owned', text: '✓ Yours' })
            : el('div', { class: 'sc-price' }, [
                el('span', { class: 'sc-ic', text: t.icon }),
                el('span', { class: 'sc-cost', text: String(d.cost) })
              ])
        ]);
        if (!owned) {
          card.appendChild(el('button', {
            class: 'btn sc-buy' + (afford ? '' : ' soft'),
            text: afford ? 'Buy' : 'Save up',
            'aria-label': afford ? `Buy ${d.name} for ${d.cost} ${t.name}` : `Save up for ${d.name}`,
            onclick: () => { if (afford) buyDressingHere(d, shelf); }
          }));
        }
        grid.appendChild(card);
      }
      wrap.appendChild(el('div', { class: 'sd-room' }, [
        el('div', { class: 'sd-room-chip', text: room.name }),
        grid
      ]));
    }
    return wrap;
  }
  // Buying a dressing. Y14's confirm rule applies at CONFIRM_AT_STARS exactly as it does for
  // an item — a 10-star dressing is a 10-star decision — and the spend goes through the same
  // ledger, so the purse and the shop's own totals cannot disagree.
  async function buyDressingHere(d, shelf) {
    if (d.cost >= CONFIRM_AT_STARS) {
      const t = typeByKey(shelf.currency) || { name: 'Stars' };
      const typeWord = String(t.name).replace(/\s*Stars$/, '');
      const yes = await dialog({
        title: `Spend ${d.cost} ${typeWord} Stars on ${d.name}?`,
        buttons: [{ label: 'Yes please!', value: true }, { label: 'Not yet', value: false, kind: 'soft' }]
      });
      if (!yes) { sfx.tap(); return; }
    }
    const r = buyDressing(d.id);
    if (!r.ok) { sfx.oops(); return; }
    sfx.star();
    if (!REDUCED) confetti({ count: 42, power: 0.8 });
    renderPurse(); renderShelves();
    const wrap = el('div', { class: 'shop-bought' }, [
      el('div', { class: 'sb-card', role: 'status' }, [
        el('div', { class: 'sb-art', html: renderDressingSwatch(d, { size: 96 }) }),
        el('p', { class: 'sb-line', text: `${d.name} is yours! Put it up in the ${roomNameOf(d.room)} — tap Build, then Decorate.` })
      ])
    ]);
    root.querySelectorAll('.shop-bought').forEach(old => old.remove());
    root.appendChild(wrap);
    speakMaybe(`${d.name} is yours!`);
    setTimeout(() => wrap.remove(), 5200);
    wrap.addEventListener('click', () => wrap.remove());
  }
  const roomNameOf = (id) => (DRESSING_ROOMS.find(r => r.id === id) || {}).name || 'Boo House';

  function renderShelves() {
    const s = getState();
    const goal = currentGoal();
    for (const shelf of SHELVES) {
      const node = shelfNodes[shelf.id];
      clear(node);
      node.appendChild(el('p', { class: 'shelf-blurb', text: shelf.blurb }));
      const grid = el('div', { class: 'shop-grid' });
      for (const [id, cost] of shelf.items) {
        const item = BY_ID[id];
        if (!item) continue;
        const owned = (s.inventory && s.inventory[id]) > 0;
        const t = typeByKey(shelf.currency);
        const afford = canAfford(s, shelf.currency, cost);
        const card = el('div', { class: 'shop-card' + (owned ? ' owned' : '') + (!owned && !afford ? ' saving' : ''), dataset: { item: id } }, [
          el('div', { class: 'sc-art', html: renderItem(item, { size: 76 }) }),
          el('div', { class: 'sc-name', text: item.name }),
          owned
            ? el('div', { class: 'sc-owned', text: '✓ Yours' })
            : el('div', { class: 'sc-price' }, [
                el('span', { class: 'sc-ic', text: t.icon }),
                el('span', { class: 'sc-cost', text: String(cost) })
              ])
        ]);
        if (!owned) {
          const buy = el('button', {
            class: 'btn sc-buy' + (afford ? '' : ' soft'),
            text: afford ? 'Buy' : 'Save up',
            'aria-label': afford ? `Buy ${item.name} for ${cost} ${t.name}` : `Save up for ${item.name}`,
            onclick: () => afford ? doBuy(id) : toggleGoal(id)
          });
          card.appendChild(buy);
          const heart = el('button', {
            class: 'sc-heart' + (goal === id ? ' on' : ''), text: goal === id ? '💖' : '🤍',
            'aria-label': goal === id ? `Stop saving up for ${item.name}` : `Save up for ${item.name}`,
            onclick: () => toggleGoal(id)
          });
          card.appendChild(heart);
        }
        grid.appendChild(card);
      }
      node.appendChild(grid);
      // RUN19 Z6 — the room dressings, on the Creative (House) shelf, grouped under room-name
      // chips exactly as the pack's addendum describes.
      if (shelf.id === 'house') node.appendChild(dressingSection(s, shelf));
      // The shelf always says what boxes are still for — the shop must never read as
      // "buy the fun", and boxes must never look pointless.
      node.appendChild(el('p', { class: 'shelf-ribbon', text: `🎁 ${UNLOCK_ONLY_RIBBON} Every Boo, every costume set, shoes and shinies.` }));
    }
  }

  // RUN18B Y14: a big spend gets asked about first. Ten stars is several rounds' work, and
  // the Buy button sits under her thumb on a scrolling shelf — a mis-tap used to be final and
  // silent. Below ten, and for anything free, nothing changes: a small purchase she meant to
  // make should not have to be made twice.
  async function doBuy(id) {
    const price = priceOf(id);
    if (price && price.cost >= CONFIRM_AT_STARS) {
      const t = typeByKey(price.currency) || { name: 'Stars' };
      const typeWord = String(t.name).replace(/\s*Stars$/, '');
      const yes = await dialog({
        title: `Spend ${price.cost} ${typeWord} Stars on ${(BY_ID[id] || {}).name}?`,
        buttons: [
          { label: 'Yes please!', value: true },
          { label: 'Not yet', value: false, kind: 'soft' }
        ]
      });
      // Declining spends nothing and changes nothing — she is still on the shelf she was on.
      if (!yes) { sfx.tap(); return { ok: false, reason: 'declined' }; }
    }
    const r = buyItem(id);
    if (!r.ok) {
      // never a silent refusal
      sfx.oops();
      return r;
    }
    sfx.star();
    if (!REDUCED) confetti({ count: 55, power: 0.9 });
    const card = root.querySelector(`.shop-card[data-item="${id}"]`);
    if (card && !REDUCED) { const b = card.getBoundingClientRect(); sparkleAt(b.left + b.width / 2, b.top + b.height / 2); }
    const item = BY_ID[id];
    // Which shelf sold it: the Special shelf has its own line whatever it is stocking.
    const shelf = SHELVES.find(sh => sh.items.some(([iid]) => iid === id));
    showBought(item, shelf && shelf.id);
    renderPurse(); renderShelves();
    return r;
  }
  function toggleGoal(id) {
    sfx.tap();
    setGoal(currentGoal() === id ? null : id);
    renderShelves();
  }
  // RUN18A H4: the confirmation is a CARD now, not a caption over the middle of the
  // screen — same words (RUN18B Y2 replaces those wholesale; only the container is this
  // packet's business), but on a real surface, sitting clear of the shelf tabs, held long
  // enough to read, and dismissible by tapping it.
  function showBought(item, shelfId) {
    // RUN18B Y2: the card offers the VERB the thing wants, and takes her there. The spoken
    // line stays the short one — "«name» is yours!" — because the written line carries the
    // question and the buttons answer it.
    const verb = useVerbFor(item.id, shelfId);
    const card = el('div', { class: 'sb-card', role: 'status' }, [
      el('div', { class: 'sb-art', html: renderItem(item, { size: 96 }) }),
      el('p', { class: 'sb-line', text: verb.line(item.name) })
    ]);
    const wrap = el('div', { class: 'shop-bought' }, [card]);
    // ONE card at a time. Two purchases in quick succession used to leave two live cards
    // stacked, and because the second is often a different size the older one's cream rim
    // showed around all four edges like a shadow that did not fit. Buying twice quickly is
    // exactly what a child with a full purse does.
    root.querySelectorAll('.shop-bought').forEach(old => old.remove());
    root.appendChild(wrap);
    // Measure the tab row rather than guessing a constant: the tabs are 52px at desktop
    // and 102px at phone width, so any single hard-coded gap is wrong somewhere.
    const tabs = drawerApi.root.querySelector('.bd-tabs');
    // RUN18D (critic fix follow-on): the drawer OPENS on arrival now, so the tab row sits
    // near the TOP of the screen rather than near the bottom. The old measurement — "how far
    // up the screen are the tabs" — then swallowed the whole band the card is centred in and
    // the card hung 37px off the top of the screen.
    // The authored intent is unchanged and now stated directly: the card is centred in the
    // band BELOW the tab row and ABOVE the collapsed handle, so the shelf tabs stay visible
    // and untouched whether the drawer is open or shut.
    const bar = drawerApi.root.querySelector('.bd-collapsed');
    const top = tabs ? Math.round(Math.max(0, tabs.getBoundingClientRect().bottom)) + SHOP_BOUGHT_CLEAR : 0;
    const bottom = bar ? Math.round(Math.max(0, window.innerHeight - bar.getBoundingClientRect().top)) : 90;
    // …unless that band is too thin to hold the card, in which case the card wins: a
    // celebration she cannot read is worse than a tab row she cannot see for two seconds.
    const room = window.innerHeight - top - bottom;
    wrap.style.setProperty('--sb-top', (room >= SHOP_BOUGHT_MIN_BAND ? top : 0) + 'px');
    wrap.style.setProperty('--sb-bottom', (room >= SHOP_BOUGHT_MIN_BAND ? bottom : Math.max(0, Math.min(bottom, window.innerHeight - SHOP_BOUGHT_MIN_BAND))) + 'px');
    requestAnimationFrame(() => wrap.classList.add('show'));
    speakMaybe(`${item.name} is yours!`);
    let gone = false;
    const dismiss = () => {
      if (gone) return;
      gone = true;
      wrap.classList.remove('show');
      timers.after(220, () => wrap.remove());
    };
    // The two buttons. [Not now] is ALWAYS second, per the pack — the offer first, the
    // way out second, so the way out is never the thing her thumb lands on.
    const go = el('button', {
      class: 'btn sb-go', text: verb.label,
      onclick: (e) => { e.stopPropagation(); try { sfx.tap(); } catch {} dismiss(); takeHer(verb.to, item.id); }
    });
    const notNow = el('button', {
      class: 'btn soft sb-later', text: 'Not now',
      onclick: (e) => { e.stopPropagation(); try { sfx.tap(); } catch {} dismiss(); }
    });
    card.appendChild(el('div', { class: 'sb-actions' }, [go, notNow]));

    // Tapping the CARD still dismisses (RUN18A H4), but not when the tap was a button.
    card.addEventListener('click', () => { try { sfx.tap(); } catch {} dismiss(); });
    timers.after(SHOP_BOUGHT_MS, dismiss);
  }

  // Where each verb goes, with the item already selected in the right drawer tab. The
  // outdoor destination is the area she came into the shop FROM, so "where shall it go?"
  // means the place she was just looking at — falling back to the Meadow when she arrived
  // by a route with no area of its own (the Collection's shop link).
  function takeHer(to, itemId) {
    if (to === 'dress') return ctx.go('collection', { from: 'shop', dressWith: itemId });
    if (to === 'house-lounge') return ctx.go('town', { area: 'boohouse', room: 'lounge', build: true, place: itemId });
    const area = to === 'town-meadow' ? 'meadow' : ((params && params.fromArea) || 'meadow');
    return ctx.go('town', { area, build: true, place: itemId });
  }

  // First visit: the Welcome purse, with a small ceremony, so day one is browsing with
  // money in hand rather than window-shopping.
  const welcomed = grantWelcomePurse();
  renderPurse();
  renderShelves();
  if (welcomed) {
    const w = el('div', { class: 'shop-welcome', role: 'dialog', 'aria-label': 'A welcome present' }, [
      el('div', { class: 'card sw-panel' }, [
        el('div', { class: 'sw-keeper', html: renderGuide(s0.guide, { view: 'head', size: 84 }) }),
        el('h3', { text: 'A welcome present!' }),
        el('p', { class: 'sw-amount', text: `⭐ ${WELCOME_PURSE} stars` }),
        el('p', { class: 'sw-note', text: 'To start you off. Have a good look round!' }),
        // RUN21A-8: the first-play intro waits until this present is read and dismissed —
        // two overlapping dialogs on a first visit is one too many.
        el('button', { class: 'btn big', text: 'Thank you!', onclick: () => { sfx.tap(); w.remove(); renderPurse(); maybeIntro('shop', SHOP_INTRO); } })
      ])
    ]);
    root.appendChild(w);
    sfx.star();
    if (!REDUCED) confetti({ count: 70, power: 1 });
  }
  // RUN19 Z6 — the Decorate tab's deep-link. A locked wallpaper swatch in a room sends her
  // HERE, so "tap to see it in the shop" has to actually land on the right shelf with the right
  // thing ringed, or the swatch is telling her something the shop does not do.
  if (params && (params.shelf || params.highlight)) {
    const wanted = params.shelf || 'house';
    if (SHELVES.some(sh => sh.id === wanted)) { try { drawerApi.showTab(wanted); } catch {} }
    if (params.highlight) requestAnimationFrame(() => {
      const card = root.querySelector(`.shop-card[data-dressing="${params.highlight}"]`)
        || root.querySelector(`.shop-card[data-item="${params.highlight}"]`);
      if (!card) return;
      card.classList.add('sc-highlight');
      card.scrollIntoView({ block: 'center', behavior: REDUCED ? 'auto' : 'smooth' });
      setTimeout(() => card.classList.remove('sc-highlight'), 2600);
    });
  }
  if (!welcomed) maybeIntro('shop', SHOP_INTRO);   // RUN21A-8: else it runs on the present's dismiss

  if (typeof window !== 'undefined') window.__shop = {
    shelves: () => SHELVES.map(s => s.id),
    cards: (shelfId) => [...(shelfNodes[shelfId] || root).querySelectorAll('.shop-card')].map(c => c.dataset.item),
    buy: (id) => doBuy(id),
    buyDirect: (id) => buyItem(id),          // bypasses the UI entirely — the guard test
    wallet: () => spendableAll(getState()),
    goal: () => currentGoal(),
    setGoal: (id) => { setGoal(id); renderShelves(); return currentGoal(); },
    goalProgress: () => goalProgress(),
    showTab: (id) => drawerApi.showTab(id),
    affordableCount: () => {
      const s = getState();
      return SHELVES.reduce((n, sh) => n + sh.items.filter(([id, cost]) =>
        !(s.inventory && s.inventory[id]) && canAfford(s, sh.currency, cost)).length, 0);
    },
    welcomed: () => !!(getState().shop || {}).welcomed,
    // RUN19 Z6
    dressingCards: () => [...root.querySelectorAll('.sd-card')].map(c => c.dataset.dressing),
    highlighted: () => { const n = root.querySelector('.sc-highlight'); return n ? (n.dataset.dressing || n.dataset.item) : null; },
    currentShelf: () => { const t = root.querySelector('.bd-tab.sel, .bd-tab[aria-selected="true"]'); return t ? t.textContent : null; }
  };
  return { unmount() { timers.dispose(); delete window.__shop; } };
}
