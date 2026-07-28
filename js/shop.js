// js/shop.js — RUN15 V4: the Boo Shop.
// Feel goals: seeing something she wants and knowing exactly how to get it; saving up
// feeling like anticipation, not a wall. Anti-patterns guarded against: anything that
// reads as "buy the fun", a shop that makes boxes pointless, an empty-looking shelf.
//
// G11 is structural here, not a convention: buyItem() deducts from stars.spent ONLY.
// stars.total and stars.byType are lifetime and are never written by this file.

import { el, clear, backControl, confetti, sparkleAt, REDUCED } from './ui.js';
import { getState, mutate, commit } from './state.js';
import { createDrawer } from './drawer.js';
import { renderItem, renderGuide } from './art.js';
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
const SHOP_BOUGHT_CLEAR = 14;

export const SHOP_INTRO = [
  { text: 'Welcome to my shop! Everything here is bought with stars.' },
  { text: 'Each shelf likes a different kind of star. Look for the little icon!' },
  { text: 'Tap the heart on something to save up for it. No rush at all.' }
];

// ---- the purchase engine (the ONLY route from a wish to an owned thing) --------------
// Returns { ok, reason?, paid? }. Every refusal is a reason, never a silent no-op.
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
    const node = el('div', { class: 'shop-shelf', dataset: { shelf: shelf.id } });
    shelfNodes[shelf.id] = node;
    return { id: shelf.id, label: shelf.label, node };
  });
  const drawerApi = createDrawer({ tabs, initial: 0, ariaLabel: 'Shop shelves' });
  drawerApi.root.classList.add('shop-drawer');
  root.append(header, purse, drawerApi.root, backControl(() => ctx.go('hub'), { floating: true }));

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
      // The shelf always says what boxes are still for — the shop must never read as
      // "buy the fun", and boxes must never look pointless.
      node.appendChild(el('p', { class: 'shelf-ribbon', text: `🎁 ${UNLOCK_ONLY_RIBBON} Every Boo, every costume set, shoes and shinies.` }));
    }
  }

  function doBuy(id) {
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
    showBought(item);
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
  function showBought(item) {
    const card = el('div', { class: 'sb-card', role: 'status' }, [
      el('div', { class: 'sb-art', html: renderItem(item, { size: 96 }) }),
      el('p', { class: 'sb-line', text: `${item.name} is yours! Find it in Build.` })
    ]);
    const wrap = el('div', { class: 'shop-bought' }, [card]);
    root.appendChild(wrap);
    // Measure the tab row rather than guessing a constant: the tabs are 52px at desktop
    // and 102px at phone width, so any single hard-coded gap is wrong somewhere.
    const tabs = drawerApi.root.querySelector('.bd-tabs');
    const clearance = tabs
      ? Math.round(Math.max(0, window.innerHeight - tabs.getBoundingClientRect().top)) + SHOP_BOUGHT_CLEAR
      : 90;
    wrap.style.setProperty('--sb-bottom', clearance + 'px');
    requestAnimationFrame(() => wrap.classList.add('show'));
    speakMaybe(`${item.name} is yours!`);
    let gone = false;
    const dismiss = () => {
      if (gone) return;
      gone = true;
      wrap.classList.remove('show');
      timers.after(220, () => wrap.remove());
    };
    card.addEventListener('click', () => { try { sfx.tap(); } catch {} dismiss(); });
    timers.after(SHOP_BOUGHT_MS, dismiss);
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
        el('button', { class: 'btn big', text: 'Thank you!', onclick: () => { sfx.tap(); w.remove(); renderPurse(); } })
      ])
    ]);
    root.appendChild(w);
    sfx.star();
    if (!REDUCED) confetti({ count: 70, power: 1 });
  }
  maybeIntro('shop', SHOP_INTRO);

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
    welcomed: () => !!(getState().shop || {}).welcomed
  };
  return { unmount() { timers.dispose(); delete window.__shop; } };
}
