// js/drawer.js — shared bottom drawer with tabbed trays (RUN9 C1, the tidy sweep).
// One component tidies every cramped tool screen without removing anything. Collapsed,
// it shows the current selection large plus a grab handle; tapping or dragging up opens
// the tray with its tabs. Used by Paint (Tools | Colours | Stamps) and Collage
// (Boos | Party | Seaside | Nature | Sparkle | Letters | Backgrounds | Text).
//
// API: createDrawer({ tabs, initial, ariaLabel, onOpen, onTab }) → {
//   root,               the element to append to the screen (pins to the bottom)
//   open(), close(), toggle(),
//   showTab(id),        switch active tab (no open/close side effects)
//   setCurrent(node|html),  update the large collapsed preview
//   isOpen(), activeTab()
// }
// tabs: [{ id, label, node }] — each tab owns a prebuilt content node the caller keeps
// a reference to and mutates live (swatch selection, tool highlight, …). The drawer just
// shows the active tab's node in the tray body. Nothing is destroyed on tab switch.

import { el, clear, REDUCED } from './ui.js';
import { sfx } from './sfx.js';

export function createDrawer({ tabs = [], initial = 0, ariaLabel = 'Tools', onOpen = null, onTab = null } = {}) {
  let idx = Math.max(0, Math.min(initial, tabs.length - 1));
  let open = false;

  const root = el('div', { class: 'boo-drawer closed' });

  // ---- collapsed handle bar (always visible) ----
  const collapsed = el('button', { class: 'bd-collapsed', 'aria-label': 'Open ' + ariaLabel, type: 'button' });
  const grab = el('span', { class: 'bd-grab', 'aria-hidden': 'true' });
  const current = el('div', { class: 'bd-current' });
  const chevron = el('span', { class: 'bd-chevron', 'aria-hidden': 'true', text: '▲' });
  collapsed.append(grab, current, chevron);

  // ---- the tray that slides up ----
  const tray = el('div', { class: 'bd-tray', role: 'region', 'aria-label': ariaLabel });
  const tabRow = el('div', { class: 'bd-tabs', role: 'tablist' });
  const bodyWrap = el('div', { class: 'bd-body' });
  tray.append(tabRow, bodyWrap);
  root.append(tray, collapsed);

  const tabBtns = [];
  tabs.forEach((t, i) => {
    const b = el('button', {
      class: 'bd-tab' + (i === idx ? ' sel' : ''), text: t.label, type: 'button',
      role: 'tab', 'aria-selected': i === idx ? 'true' : 'false',
      onclick: () => { sfx.tap(); showTab(t.id); if (!open) openDrawer(); }
    });
    tabBtns.push(b); tabRow.appendChild(b);
  });

  // Every tab's node stays mounted (wrapped in a panel) and inactive panels are just
  // hidden — so nothing rebuilds on switch, scroll is preserved, and every control is
  // queryable/reachable even when its tab isn't the visible one.
  const panels = [];
  tabs.forEach((t, i) => {
    const p = el('div', { class: 'bd-panel', role: 'tabpanel' });
    if (t.node) p.appendChild(t.node);
    if (i !== idx) p.hidden = true;
    panels.push(p); bodyWrap.appendChild(p);
  });

  function showTab(id) {
    const i = tabs.findIndex(t => t.id === id);
    if (i < 0 || i === idx) return;
    idx = i;
    tabBtns.forEach((b, k) => { const on = k === idx; b.classList.toggle('sel', on); b.setAttribute('aria-selected', on ? 'true' : 'false'); });
    panels.forEach((p, k) => { p.hidden = k !== idx; });
    if (onTab) try { onTab(tabs[idx].id); } catch {}
  }

  function openDrawer() {
    if (open) return;
    open = true; root.classList.remove('closed'); root.classList.add('open');
    collapsed.setAttribute('aria-label', 'Close ' + ariaLabel);
    if (onOpen) try { onOpen(true); } catch {}
  }
  function closeDrawer() {
    if (!open) return;
    open = false; root.classList.remove('open'); root.classList.add('closed');
    collapsed.setAttribute('aria-label', 'Open ' + ariaLabel);
    if (onOpen) try { onOpen(false); } catch {}
  }
  function toggle() { sfx.tap(); open ? closeDrawer() : openDrawer(); }

  collapsed.addEventListener('click', (e) => {
    // a drag that already toggled sets this flag; ignore the trailing click
    if (collapsed._dragToggled) { collapsed._dragToggled = false; return; }
    toggle();
  });

  // ---- drag-up / drag-down gesture on the handle ----
  let downY = null, moved = false;
  collapsed.addEventListener('pointerdown', (e) => { downY = e.clientY; moved = false; });
  collapsed.addEventListener('pointermove', (e) => {
    if (downY == null) return;
    const dy = e.clientY - downY;
    if (Math.abs(dy) > 24 && !moved) {
      moved = true;
      if (dy < 0) { if (!open) { openDrawer(); collapsed._dragToggled = true; } }
      else { if (open) { closeDrawer(); collapsed._dragToggled = true; } }
    }
  });
  const endDrag = () => { downY = null; };
  collapsed.addEventListener('pointerup', endDrag);
  collapsed.addEventListener('pointercancel', endDrag);

  return {
    root,
    open: openDrawer, close: closeDrawer, toggle, showTab,
    setCurrent(content) {
      clear(current);
      if (content == null) return;
      if (typeof content === 'string') current.innerHTML = content;
      else current.appendChild(content);
    },
    isOpen: () => open,
    activeTab: () => tabs[idx] && tabs[idx].id,
    reduced: REDUCED
  };
}
