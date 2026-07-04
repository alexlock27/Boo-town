// js/golden.js — the Golden Round (RUN3 C3). Parent-typed weekly challenge.
// Spelling words run through the tile flow; twin-flagged words run as a Sound-Twins item
// (pick the right spelling, then spell it from memory); choice questions are big-button picks.
// Worth double stars + a +2 meter bonus on a 3-star clear, ONCE per local day; replays after
// that earn normal stars. No AI anywhere — this is parent-typed content only.

import { el, clear, starsRow } from './ui.js';
import { getState, mutate, todayKey } from './state.js';
import { createGameShell } from './gameshell.js';
import { renderGuide } from './art.js';
import { guideLine, speakMaybe } from './guide.js';
import { sfx, music } from './sfx.js';
import * as tts from './tts.js';
import { makeSpeller, typeInto } from './speller.js';

const MAX_HINTS = 2;
const rand = (n) => (Math.random() * n) | 0;
const starsFor = (wrong, hints) => (hints === 0 && wrong <= 1) ? 3 : (wrong <= 3 ? 2 : 1);
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

export function mount(container, params, ctx) {
  const root = el('div', { class: 'screen golden' });
  container.appendChild(root);
  const s = getState();
  const golden = s.golden;
  let shell = null;

  if (!golden || (!(golden.words || []).length && !(golden.choices || []).length)) {
    // nothing published yet — shouldn't happen (card is hidden), but fail gently
    root.appendChild(el('div', { class: 'card', style: { margin: '40px', padding: '24px' } }, [
      el('p', { text: 'No Golden Round yet! A grown-up can add one in the cog corner.' }),
      el('button', { class: 'btn', text: 'Back', onclick: () => ctx.go('hub') })
    ]));
    return { unmount() {} };
  }

  // build the item list: spelling words first (word / twin), then choice questions
  const items = [];
  for (const w of (golden.words || [])) {
    if (w.twin && w.rival) items.push({ kind: 'twin', word: w.w, rival: w.rival, clue: w.clue || '' });
    else items.push({ kind: 'word', word: w.w, clue: w.clue || '' });
  }
  for (const c of (golden.choices || [])) items.push({ kind: 'choice', q: c.q, right: c.right, wrong: (c.wrong || []).filter(Boolean) });

  // test hook must exist before play() runs the first item (which sets _cur)
  if (typeof window !== 'undefined') window.__golden = { itemCount: () => items.length, cur: () => window.__golden._cur, _cur: null };

  play();

  function play() {
    clear(root);
    music.play('game');
    let idx = 0, wrong = 0, hintsUsed = 0, curHint = null;
    shell = createGameShell({
      title: 'Golden Round', rounds: items.length, accent: 'var(--star)',
      onBack: () => { tts.cancel(); ctx.go('hub'); },
      onHint: () => { if (curHint) curHint(); }
    });
    shell.root.classList.add('golden-shell');
    root.appendChild(shell.root);
    const guide = getState().guide;
    const stage = el('div', { class: 'spell-stage' });
    shell.area.appendChild(stage);

    const canHint = () => hintsUsed < MAX_HINTS;
    const spendHint = () => { hintsUsed++; if (!canHint()) shell.enableHint(false); };

    runNext();
    function runNext() { if (idx >= items.length) return finish(); clear(stage); curHint = null; const it = items[idx]; ({ word: runWord, twin: runTwin, choice: runChoice }[it.kind])(it); }
    function itemDone() { idx++; shell.advance(); setTimeout(runNext, 250); }

    function runWord(it) {
      const clue = it.clue;
      const promptCard = el('div', { class: 'spell-prompt' });
      const clueEl = el('div', { class: 'spell-clue', style: { display: clue ? '' : 'none' } });
      if (clue) clueEl.textContent = clue;
      const peekWord = el('div', { class: 'peek-word', style: { visibility: 'hidden' } });
      const area = el('div', { class: 'spell-area' });
      const speaker = el('button', { class: 'icon-btn speak-btn', 'aria-label': 'Say again', html: speakerIcon(), onclick: () => say() });
      const peekBtn = el('button', { class: 'btn soft peek-btn', text: '👀 Peek (hint)', onclick: () => peekHint() });
      if (!canHint()) peekBtn.disabled = true;
      promptCard.append(el('div', { class: 'spell-guide', html: renderGuide(guide, { view: 'head', size: 72 }) }), el('div', { class: 'spell-say' }, [el('span', { text: 'Golden word — spell it!' }), speaker]), peekBtn);
      stage.append(promptCard, peekWord, clueEl, area);
      const speller = makeSpeller(area, it.word, { onCorrect: () => { shell.react('Golden! 🌟', { voice: false, hold: 1400 }); speakMaybe(`${it.word}. Brilliant!`); setTimeout(itemDone, 1200); }, onWrongCheck: () => { wrong++; shell.dimHeart(); } });
      curHint = () => { if (canHint() && speller.hintNextLetter()) { spendHint(); shell.react(guideLine('hintSpell')); if (!canHint()) peekBtn.disabled = true; } };
      function peekHint() { if (!canHint() || speller.isLocked()) return; spendHint(); sfx.tap(); reveal(); if (!canHint()) peekBtn.disabled = true; }
      function reveal() { peekWord.textContent = it.word; peekWord.style.visibility = 'visible'; peekWord.classList.remove('pop'); void peekWord.offsetWidth; peekWord.classList.add('pop'); clearTimeout(reveal._t); reveal._t = setTimeout(() => { peekWord.style.visibility = 'hidden'; }, 2000); }
      function say() { if (clue) speakMaybe(clue.replace(/_+/g, 'blank')); else speakMaybe(`Can you spell... ${it.word}?`); }
      if (!clue) reveal();
      say();
      window.__golden && (window.__golden._cur = { kind: 'word', answer: () => it.word, typeCorrect: () => typeInto(area, it.word) });
    }

    function runTwin(it) {
      let phase = 'pick';
      const head = el('div', { class: 'twin-head' }, [el('div', { class: 'spell-guide', html: renderGuide(guide, { view: 'head', size: 64 }) })]);
      const sentenceCard = el('div', { class: 'twin-sentence' });
      head.appendChild(sentenceCard);
      const btnRow = el('div', { class: 'twin-options' });
      const explainEl = el('div', { class: 'twin-explain', style: { display: 'none' } });
      const area = el('div', { class: 'spell-area', style: { display: 'none' } });
      stage.append(head, btnRow, explainEl, area);
      const sentence = it.clue || `Which spelling is right: ___ ?`;
      const parts = sentence.split(/_+/);
      sentenceCard.append(el('span', { text: parts[0] }), el('span', { class: 'twin-blank', text: '?' }), el('span', { text: parts[1] || '' }));
      speakMaybe(sentence.replace(/_+/g, 'blank'));
      shuffle([it.word, it.rival]).forEach(opt => btnRow.appendChild(el('button', { class: 'btn twin-opt', text: opt, onclick: () => pick(opt) })));
      function pick(opt) {
        if (phase !== 'pick') return;
        if (opt === it.word) { sfx.correct(); toSpell(false); return; }
        wrong++; sfx.oops(); shell.dimHeart();
        explainEl.textContent = `'${it.word}' is the one that fits here.`; explainEl.style.display = '';
        [...btnRow.querySelectorAll('.twin-opt')].forEach(b => { b.disabled = true; b.classList.toggle('right', b.textContent === it.word); });
        setTimeout(() => toSpell(true), 1500);
      }
      function toSpell(afterWrong) {
        phase = 'spell'; btnRow.style.display = 'none'; area.style.display = '';
        shell.react(afterWrong ? 'Now spell it!' : 'Right! Now spell it.', { voice: false, hold: 1400 });
        const speller = makeSpeller(area, it.word, { onCorrect: () => { shell.react('Golden! 🌟', { voice: false, hold: 1400 }); setTimeout(itemDone, 1200); }, onWrongCheck: () => { wrong++; shell.dimHeart(); } });
        curHint = () => { if (canHint() && speller.hintNextLetter()) { spendHint(); shell.react(guideLine('hintSpell')); } };
      }
      window.__golden && (window.__golden._cur = { kind: 'twin', phase: () => phase, pick, answer: () => it.word, typeCorrect: () => typeInto(area, it.word) });
    }

    function runChoice(it) {
      const card = el('div', { class: 'golden-choice' }, [
        el('div', { class: 'spell-guide', html: renderGuide(guide, { view: 'head', size: 64 }) }),
        el('div', { class: 'gc-q', text: it.q })
      ]);
      const opts = el('div', { class: 'gc-options' });
      const all = shuffle([it.right, ...it.wrong]);
      all.forEach(o => opts.appendChild(el('button', { class: 'btn gc-opt', text: o, onclick: (e) => choose(o, e.currentTarget) })));
      stage.append(card, opts);
      speakMaybe(it.q);
      curHint = null; // choice questions have no letter hint
      function choose(o, btn) {
        if (o === it.right) { sfx.correct(); btn.classList.add('right'); [...opts.querySelectorAll('.gc-opt')].forEach(b => b.disabled = true); setTimeout(itemDone, 700); }
        else { wrong++; sfx.oops(); shell.dimHeart(); btn.classList.add('wrong'); btn.disabled = true; }
      }
      window.__golden && (window.__golden._cur = { kind: 'choice', right: it.right, choose: (o) => { const btn = [...opts.querySelectorAll('.gc-opt')].find(b => b.textContent === o); if (btn) choose(o, btn); } });
    }

    function finish() {
      tts.cancel(); shell.cleanup();
      const stars = starsFor(wrong, hintsUsed);
      // double stars + 2-on-3star once per local day; replays earn normal stars.
      const st = getState();
      const firstDaily = todayKey() !== st.goldenLastDouble;
      let meterOverride;
      if (firstDaily) { mutate(x => { x.goldenLastDouble = todayKey(); }); meterOverride = stars * 2 + (stars >= 3 ? 2 : 0); }
      else meterOverride = stars + (stars >= 3 ? 1 : 0);
      ctx.go('results', { game: 'golden', gameName: firstDaily ? 'Golden Round (double stars!)' : 'Golden Round', stars, meterOverride, golden: true, replay: () => ctx.go('golden') });
    }
  }

  return { unmount() { if (shell) shell.cleanup(); tts.cancel(); } };
}

function speakerIcon() { return `<svg viewBox="0 0 24 24" width="26" height="26"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="var(--ink)"/><path d="M16 8c1.5 1.5 1.5 6.5 0 8" stroke="var(--ink)" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`; }
