// RUN10 P20 — the Wish Well spelling tray. It never writes to the learning ledger.
import { el, clear, confetti, REDUCED } from './ui.js';
import { createDrawer } from './drawer.js';
import { renderGuide, renderItem } from './art.js';
import { getState, mutate } from './state.js';
import { contentTier } from './content.js';
import { guideLine, speakMaybe } from './guide.js';
import { showToast } from './resilience.js';
import { sfx } from './sfx.js';
import { WISH_WORDS, SHORT_WISHES, nearestWish, wishItem } from '../data/wishes.js';

const KEYROWS = ['qwertyuiop','asdfghjkl','zxcvbnm'];
// The brief says a 3–8 tile tray but also includes BUTTERFLY (9 letters).
// Keep eight empty tiles normally and reveal one overflow tile only for a ninth letter.
const MAX = 9;

export function openWishWell({ onSpawn = null, onClose = null } = {}) {
  const state = getState();
  let current = '', misses = 0, locked = false, resetTimer = null;
  const overlay = el('div', { class:'overlay wish-overlay', role:'dialog', 'aria-label':'Wish Well' });
  const panel = el('div', { class:'wish-panel' });
  const top = el('header', { class:'wish-head' }, [
    el('div', { class:'wish-guide', html:renderGuide(state.guide, { view:'head', size:82 }) }),
    el('div', {}, [
      el('h2', { text:'The Wish Well' }),
      el('p', { class:'wish-line', text:'Spell a wish, then press WISH to make it appear!' })
    ]),
    el('button', { class:'wish-close', text:'×', 'aria-label':'Close Wish Well', onclick:close })
  ]);
  const hint = el('div', { class:'wish-ghost', 'aria-live':'polite' });
  const slots = el('div', { class:'wish-slots', 'aria-label':'Your wish' });
  const magic = el('div', { class:'wish-magic' }, [el('div', { class:'wish-well-mini', text:'✦' })]);
  const suggestions = el('div', { class:'wish-suggestions' });
  const keyboard = el('div', { class:'wish-keyboard' });
  KEYROWS.forEach((row, ri) => {
    const rowNode = el('div', { class:'det-kb-row' });
    if (ri === 2) rowNode.appendChild(el('button', { class:'det-key wide wish-enter', text:'WISH', 'aria-label':'Make wish', onclick:submit }));
    [...row].forEach(ch => rowNode.appendChild(el('button', { class:'det-key', text:ch.toUpperCase(), dataset:{key:ch}, onclick:() => type(ch) })));
    if (ri === 2) rowNode.appendChild(el('button', { class:'det-key wide', text:'⌫', 'aria-label':'Backspace', onclick:backspace }));
    keyboard.appendChild(rowNode);
  });
  const drawer = createDrawer({ tabs:[{id:'letters',label:'Letters',node:keyboard}], ariaLabel:'Wish letters' });
  drawer.setCurrent(el('span', { class:'wish-current', text:'Tap letters · then press WISH' }));
  panel.append(top, hint, slots, magic, suggestions, drawer.root);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('show'));
  drawer.open();
  renderSlots();
  renderSuggestions();
  speakMaybe(guideLine('L_WISH_OPEN'));

  function renderSlots() {
    clear(slots);
    const visible = current.length > 8 ? 9 : 8;
    for (let i = 0; i < visible; i++) slots.appendChild(el('div', { class:'wish-slot' + (i < 3 ? ' needed' : '') + (current[i] ? ' filled' : ''), text:(current[i] || '').toUpperCase() }));
    slots.dataset.length = String(current.length);
  }
  function renderSuggestions() {
    clear(suggestions);
    if (!['toddler','light'].includes(contentTier())) return;
    SHORT_WISHES.slice(0, 10).forEach(word => suggestions.appendChild(el('button', {
      class:'wish-chip', text:word.toUpperCase(), onclick:() => { current = word; renderSlots(); submit(); }
    })));
  }
  function type(ch) {
    if (locked || current.length >= MAX) return;
    current += ch; sfx.chime(current.length - 1); hint.textContent = ''; renderSlots();
  }
  function backspace() {
    if (locked) return;
    current = current.slice(0, -1); hint.textContent = ''; renderSlots();
  }
  function submit() {
    if (locked) return false;
    const word = current.toLowerCase();
    if (!WISH_WORDS.includes(word)) { miss(word); return false; }
    locked = true;
    const item = wishItem(word);
    slots.querySelectorAll('.wish-slot.filled').forEach((tile, i) => {
      setTimeout(() => tile.classList.add('gold'), REDUCED ? 0 : i * 45);
    });
    const wasNew = !(((getState().wishes || {}).unlocked || {})[word]);
    mutate(st => {
      st.wishes = st.wishes || { unlocked:{} };
      st.wishes.unlocked = st.wishes.unlocked || {};
      st.wishes.unlocked[word] = true;
    });
    const puff = el('div', { class:'wish-poof', text:'POOF!' });
    const art = el('div', { class:`wish-made wish-${word}`, html:renderItem(item, {size:115}) });
    magic.append(puff, art);
    sfx.fanfare();
    if (!REDUCED) confetti({ count:36, power:.75, origin:{x:.5,y:.45} });
    if (wasNew) showToast(`New wish: ${word.toUpperCase()}! (in your Build drawer)`, { autoHideMs:4500, className:'wish-toast' });
    if (onSpawn) onSpawn(word, item, { wasNew });
    resetTimer = setTimeout(resetWish, 1500);
    return true;
  }
  function resetWish() {
    clearTimeout(resetTimer);
    magic.querySelectorAll('.wish-poof,.wish-made').forEach(n => n.remove());
    current = ''; misses = 0; locked = false; hint.textContent = ''; hint.classList.remove('copy-word'); renderSlots();
  }
  function miss(value) {
    misses++; sfx.hum();
    const line = guideLine('L_WISH_NEARLY');
    panel.classList.remove('listening'); void panel.offsetWidth; panel.classList.add('listening');
    hint.textContent = misses >= 2 ? nearestWish(value).toUpperCase() : line;
    hint.classList.toggle('copy-word', misses >= 2);
    if (misses < 2) speakMaybe(line);
  }
  function close() {
    clearTimeout(resetTimer);
    overlay.classList.remove('show');
    setTimeout(() => overlay.remove(), 220);
    if (window.__wishwell && window.__wishwell.close === close) delete window.__wishwell;
    if (onClose) onClose();
  }
  window.__wishwell = {
    type, backspace, submit, spell(word) { current=''; for (const ch of String(word).toLowerCase().slice(0, MAX)) type(ch); return submit(); },
    spellInstant(word) { current=''; locked=false; for (const ch of String(word).toLowerCase().slice(0, MAX)) type(ch); const ok=submit(); resetWish(); return ok; },
    value:() => current, misses:() => misses, hint:() => hint.textContent,
    unlocked:() => ({...((getState().wishes || {}).unlocked || {})}), close,
    usesDrawer:() => panel.querySelector('.boo-drawer') != null,
    suggestions:() => [...suggestions.querySelectorAll('.wish-chip')].map(n => n.textContent.toLowerCase())
  };
  return { close };
}
