// js/a11y.js — RUN12 S13, the accessibility pack.
// Five deliberately-scoped items, all device-local and all opt-out-able:
//   1. an A-Z letter layout, defaulted ON below age 8 (Toddler and Light content tiers);
//   2. read-aloud for questions, as a CONTROL beside the question, never autoplay;
//   3. a keyboard/screen-reader route into the grown-ups corner (js/hub.js);
//   4. accessible names that carry their VALUE ("bubble, 27"), not just their kind;
//   5. hearing something again is free — only hints that reveal ANSWERS cost a star.
import { getState, mutate } from './state.js';
import { contentTier } from './content.js';
import { speakMaybe } from './guide.js';
import { el } from './ui.js';

export const QWERTY_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
// A-Z in reading order, in rows that fit the same keyboard frame.
export const ALPHA_ROWS = ['abcdefghi', 'jklmnopqr', 'stuvwxyz'];

// Below age 8 — content tiers Toddler and Light — a child is still learning the alphabet
// and has no reason to know where QWERTY hides its letters. Switchable for everyone in the
// grown-ups corner; the saved setting always wins over the default.
export function alphaKeysDefault() { return ['toddler', 'light'].includes(contentTier()); }
export function alphaKeysOn() {
  const s = getState();
  const v = s && s.settings && s.settings.alphaKeys;
  return v == null ? alphaKeysDefault() : !!v;
}
export function setAlphaKeys(on) { mutate(s => { s.settings.alphaKeys = !!on; }); }
export function keyRows() { return alphaKeysOn() ? ALPHA_ROWS : QWERTY_ROWS; }

// Read-aloud: remembered per device, off by default (it is a control, not autoplay).
export function readAloudOn() {
  const s = getState();
  return !!(s && s.settings && s.settings.readAloud);
}
export function setReadAloud(on) { mutate(s => { s.settings.readAloud = !!on; }); }

// The speaker control that sits beside a question. `text()` is read at press time so the
// control always speaks the CURRENT question rather than the one it was built with.
export function readAloudButton(text, { label = 'Read the question aloud' } = {}) {
  const btn = el('button', {
    class: 'read-aloud-btn', 'aria-label': label,
    onclick: () => { const t = typeof text === 'function' ? text() : text; if (t) speakMaybe(String(t), true); }
  }, [el('span', { class: 'ra-ic', html: speakerSVG(), 'aria-hidden': 'true' })]);
  return btn;
}

export function speakerSVG() {
  const INK = 'currentColor';
  return `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
    <path d="M4 9h3l5-4v14l-5-4H4z" fill="${INK}"/>
    <path d="M16 8.5a5 5 0 0 1 0 7" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>
    <path d="M18.6 6a8.5 8.5 0 0 1 0 12" fill="none" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>
  </svg>`;
}

// Item 4: an accessible name that carries the value a sighted child can see.
// "bubble" tells a screen-reader user nothing they can act on; "bubble, 27" does.
export function nameWithValue(kind, value) {
  const v = value == null ? '' : String(value).trim();
  return v ? `${kind}, ${v}` : kind;
}
