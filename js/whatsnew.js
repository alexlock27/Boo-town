// js/whatsnew.js — "Something new arrived!" (RUN17 X4).
//
// The problem this solves is the cheapest win in the project: the app has grown enormously
// and the children had no way to discover any of it. A feature nobody finds may as well not
// have been built.
//
// The manners are the whole design:
//   • ONE card, on the hub, in the hub's own flow. NEVER a modal, never an overlay, never
//     anything she has to dismiss before she can play.
//   • It cannot appear mid-round, structurally: the only caller is the hub.
//   • Seen or dismissed once, it never returns for that version.
//   • Every entry's "Show me!" goes STRAIGHT to the thing. A list of things she cannot
//     reach would be worse than no list.
//
// The content is data/whatsnew.js, which every future run appends to as part of its deploy
// gate (CLAUDE.md house law).

import { el, clear } from './ui.js';
import { getState, mutate, commit } from './state.js';
import { sfx } from './sfx.js';
import { WHATSNEW, LATEST_VERSION, entriesSince } from '../data/whatsnew.js';

// The version she has already been shown. Absent on every existing save, which is correct:
// a save that predates this feature has seen nothing, and gets the whole catch-up once.
export function seenVersion(state = getState()) {
  return (state && state.seen && state.seen.whatsnewVersion) || '';
}

export function newsFor(state = getState()) {
  if (!LATEST_VERSION) return [];
  if (seenVersion(state) === LATEST_VERSION) return [];
  return entriesSince(seenVersion(state));
}

export function hasNews(state = getState()) { return newsFor(state).length > 0; }

// Recording that she has seen it is the ONLY thing this feature writes, and it writes a
// version string — never which entries she read or which she tapped.
//
// Committed IMMEDIATELY rather than left to the 2s autosave debounce. Being told about
// something new is a one-shot event: if she opens the card and the tablet is closed a
// second later, the debounce never fires, the flag is lost, and the card comes back
// tomorrow claiming the same things are new. Same reasoning as the round-end commit in
// js/results.js (RUN11 Q9) — a milestone is saved when it happens.
export function markSeen() {
  mutate(st => { st.seen = st.seen || {}; st.seen.whatsnewVersion = LATEST_VERSION; });
  commit();
}

// Build the card, or return null when there is no news. The hub appends whatever comes
// back into its own specials section — so this is page content, not a layer over the page.
export function createWhatsNewCard(ctx) {
  const entries = newsFor();
  if (!entries.length) return null;

  const list = el('div', { class: 'wn-list' });
  const card = el('section', { class: 'card wn-card', 'aria-label': 'Something new arrived' });

  // Collapsed: one line and a way in. Expanding is what marks it seen — she has now been
  // told, so it does not follow her into tomorrow.
  const open = el('button', {
    class: 'wn-open', onclick: () => { sfx.tap(); expand(); }
  }, [
    el('span', { class: 'wn-spark', text: '✨' }),
    el('span', { class: 'wn-open-txt' }, [
      el('strong', { class: 'wn-title', text: 'Something new arrived!' }),
      el('span', { class: 'wn-sub', text: entries.length === 1 ? 'Come and see' : `${entries.length} things to see` })
    ]),
    el('span', { class: 'wn-chev', text: '›' })
  ]);

  const dismiss = el('button', {
    class: 'wn-x', 'aria-label': 'Hide this', text: '×',
    onclick: () => { sfx.tap(); markSeen(); card.remove(); }
  });

  card.append(open, dismiss);

  function expand() {
    markSeen();                       // shown once, and only once, for this version
    clear(card);
    card.classList.add('open');
    const head = el('div', { class: 'wn-head' }, [
      el('strong', { class: 'wn-title', text: 'Something new arrived!' }),
      el('button', { class: 'wn-x', 'aria-label': 'Close', text: '×', onclick: () => { sfx.tap(); card.remove(); } })
    ]);
    clear(list);
    for (const e of entries) {
      const row = el('div', { class: 'wn-item', dataset: { route: e.route || '' } }, [
        el('span', { class: 'wn-ic', text: e.icon || '✨' }),
        el('div', { class: 'wn-txt' }, [
          el('strong', { class: 'wn-item-title', text: e.title }),
          el('span', { class: 'wn-blurb', text: e.blurb })
        ]),
        e.route ? el('button', {
          class: 'btn wn-go', text: 'Show me!',
          onclick: () => { sfx.tap(); ctx.go(e.route, e.params || {}); }
        }) : null
      ]);
      list.appendChild(row);
    }
    card.append(head, list);
  }

  if (typeof window !== 'undefined') window.__whatsnew = {
    shown: () => !!card.isConnected,
    count: entries.length,
    entries: () => entries.map(e => ({ title: e.title, route: e.route, params: e.params || null })),
    expand: () => { expand(); return list.querySelectorAll('.wn-item').length; },
    dismiss: () => { dismiss.click(); },
    go: (i) => { const b = list.querySelectorAll('.wn-go')[i]; if (b) b.click(); return !!b; },
    isModal: () => !!card.closest('.overlay, .intro-overlay, [role="dialog"]'),
    seen: () => seenVersion(),
    latest: LATEST_VERSION
  };

  return card;
}

export { WHATSNEW, LATEST_VERSION };
