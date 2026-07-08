// js/games/teachme.js — Teach Me (EXPANSION_2 frame 1).
// Short guide-led mini-lessons: the guide walks a sequence of cards (hook, explanation
// style A, a worked example tapped step by step, explanation style B, then a 3-question
// quick check). Five visual primitives are implemented once; all lessons are data.

import { el, clear, starsRow, sparkleAt, REDUCED, backControl } from '../ui.js';
import { getState } from '../state.js';
import { createGameShell } from '../gameshell.js';
import { maybeIntro, replayIntro } from '../intro.js';
import { renderGuide } from '../art.js';
import { guideLine, speakMaybe } from '../guide.js';
import { sfx, music } from '../sfx.js';
import { LESSONS } from '../../data/lessons.js';
import { bestStars, recordBest, saveLastPick } from '../picker.js';

const rand = (n) => (Math.random() * n) | 0;
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const LESSON_ICON = { tower: '🗼', spring: '🌀', footsteps: '👣', cakeslice: '🍰', dotsgrid: '⚄', clock: '🕒' };

export function mount(container, params, ctx) {
  const root = el('div', { class: 'screen teachme' });
  container.appendChild(root);
  let shell = null;

  lessonList();
  maybeIntro('teachme');   // single welcome line on the first-ever open (RUN5 C5)

  function lessonList() {
    clear(root); music.play('calm');
    const s = getState();
    const card = el('div', { class: 'start-card card teachme-list' }, [
      el('div', { class: 'sc-guide', html: renderGuide(s.guide, { view: 'head', size: 96 }) }),
      el('h2', { text: 'Teach Me' }),
      el('p', { class: 'sc-intro', text: "Little lessons, explained two ways. Pick one to learn!" })
    ]);
    const grid = el('div', { class: 'lesson-grid' });
    for (const lesson of LESSONS) {
      const best = bestStars('teachme', lesson.id);
      grid.appendChild(el('button', { class: 'lesson-card', onclick: () => { sfx.tap(); saveLastPick('teachme', lesson.id, 1); playLesson(lesson); } }, [
        el('div', { class: 'lesson-ic', text: LESSON_ICON[lesson.icon] || '📘' }),
        el('div', { class: 'lesson-name', text: lesson.name }),
        best > 0 ? el('div', { class: 'lesson-badge', html: starsRow(best, { size: 15 }) }) : null
      ]));
    }
    card.appendChild(grid);
    root.appendChild(card);
    root.appendChild(backControl(() => ctx.go('hub'), { floating: true }));   // shared back (job 3)
  }

  function playLesson(lesson) {
    clear(root); music.play('game');
    const cards = lesson.cards;
    const checkIdxs = cards.map((c, i) => c.type === 'check' ? i : -1).filter(i => i >= 0);
    let cardIdx = 0, slips = 0, ended = false;
    const useVariant = {};   // check card index -> show its variant
    const firstTry = {};     // check card index -> still first attempt

    shell = createGameShell({ title: lesson.name, rounds: checkIdxs.length, accent: 'var(--zing)', onBack: () => ctx.go('hub'), hintEnabled: false, onHelp: () => replayIntro('teachme') });
    root.appendChild(shell.root);
    const stage = el('div', { class: 'tm-stage' });
    shell.area.appendChild(stage);

    renderCard();

    function progressForCard(i) { return checkIdxs.filter(ci => ci < i).length; }

    function renderCard() {
      if (cardIdx >= cards.length) return finish();
      const c = cards[cardIdx];
      shell.setProgress(progressForCard(cardIdx));
      clear(stage);
      if (c.type === 'talk') return renderTalk(c);
      if (c.type === 'visual') return renderVisual(c);
      if (c.type === 'workedStep') return renderWorked(c);
      if (c.type === 'check') return renderCheck(cardIdx, c);
    }
    function nextCard() { cardIdx++; renderCard(); }

    function guideRow(text) {
      const row = el('div', { class: 'tm-guide-row' }, [
        el('div', { class: 'tm-guide', html: renderGuide(getState().guide, { view: 'head', size: 84 }) }),
        el('div', { class: 'speech-bubble tm-bubble', text })
      ]);
      speakMaybe(text);
      return row;
    }

    function renderTalk(c) {
      stage.appendChild(guideRow(c.text));
      stage.appendChild(el('button', { class: 'btn big tm-next', text: 'Next ➜', onclick: () => { sfx.tap(); nextCard(); } }));
    }

    function renderVisual(c) {
      stage.appendChild(el('div', { class: 'tm-visual', html: renderPrimitive(c.kind, c.spec) }));
      if (c.spec.caption) stage.appendChild(el('p', { class: 'tm-caption', text: c.spec.caption }));
      stage.appendChild(el('button', { class: 'btn big tm-next', text: 'Next ➜', onclick: () => { sfx.tap(); nextCard(); } }));
    }

    function renderWorked(c) {
      let step = 0;
      const title = el('div', { class: 'tm-worked-title', text: c.title || 'Watch closely' });
      const steps = el('div', { class: 'tm-steps' });
      c.steps.forEach((t, i) => steps.appendChild(el('div', { class: 'tm-step' + (i === 0 ? ' on' : ''), text: t })));
      const btn = el('button', { class: 'btn big tm-next', text: 'Tap 👆', onclick: advance });
      stage.append(title, steps, btn);
      function advance() {
        sfx.tap();
        step++;
        if (step < c.steps.length) {
          steps.children[step].classList.add('on');
          [...steps.children].forEach((n, i) => n.classList.toggle('cur', i === step));
          if (step === c.steps.length - 1) btn.textContent = 'Next ➜';
        } else nextCard();
      }
    }

    function renderCheck(idx, c) {
      if (firstTry[idx] === undefined) firstTry[idx] = true;
      const q = useVariant[idx] && c.variant ? c.variant : c;
      const opts = q.options.map((text, i) => ({ text, correct: i === q.correct }));
      shuffle(opts);
      stage.appendChild(el('div', { class: 'tm-check-q', text: q.q }));
      const optWrap = el('div', { class: 'tm-check-opts' });
      opts.forEach(o => optWrap.appendChild(el('button', { class: 'btn tm-opt', text: o.text, onclick: (e) => onAnswer(idx, c, o, e.currentTarget) })));
      stage.appendChild(optWrap);
      speakMaybe(q.q);
    }
    function onAnswer(idx, c, opt, node) {
      if (opt.correct) {
        sfx.correct();
        node.classList.add('right');
        const r = node.getBoundingClientRect(); if (!REDUCED) sparkleAt(r.left + r.width / 2, r.top + r.height / 2);
        setTimeout(nextCard, 420);
      } else {
        sfx.oops();
        node.classList.add('wrong');
        if (firstTry[idx]) { slips++; firstTry[idx] = false; useVariant[idx] = true; }
        // route back to the relevant explanation card, guide encourages, then re-ask
        shell.react(guideLine('encourage'), { hold: 1800 });
        setTimeout(() => { cardIdx = (c.backTo != null ? c.backTo : cardIdx); renderCard(); }, 700);
      }
    }

    function finish() {
      if (ended) return; ended = true; shell.cleanup();
      const stars = slips === 0 ? 3 : slips === 1 ? 2 : 1;
      recordBest('teachme', lesson.id, stars);
      ctx.go('results', { game: 'teachme', gameName: lesson.name, stars, replay: () => ctx.go('teachme') });
    }

    // test hook
    if (typeof window !== 'undefined') window.__teachme = {
      card: () => ({ idx: cardIdx, type: cards[cardIdx] && cards[cardIdx].type, total: cards.length }),
      tapNext: () => { const b = stage.querySelector('.tm-next'); if (b) b.click(); },
      tapWorked: () => { const b = stage.querySelector('.tm-next'); if (b) b.click(); },
      answer: (wantCorrect) => { const btns = [...stage.querySelectorAll('.tm-opt')]; const c = cards[cardIdx]; const q = (useVariant[cardIdx] && c.variant) ? c.variant : c; const correctText = q.options[q.correct]; const t = wantCorrect ? btns.find(b => b.textContent === correctText) : btns.find(b => b.textContent !== correctText); if (t) t.click(); },
      state: () => ({ slips, cardIdx, ended }),
      ended: () => ended
    };
  }

  return { unmount() { if (shell) shell.cleanup(); } };
}

// ===================== visual primitives (implemented once) =====================
export function renderPrimitive(kind, spec) {
  if (kind === 'placeValue') return placeValueSVG(spec);
  if (kind === 'numberLine') return numberLineSVG(spec);
  if (kind === 'fractionCircle') return fractionCircleSVG(spec);
  if (kind === 'array') return arraySVG(spec);
  if (kind === 'clock') return clockSVG(spec);
  return '';
}
const INK = '#2A1B4E';

function placeValueSVG(spec) {
  const cols = spec.cols; const cw = 90, gap = 16, W = cols.length * (cw + gap) + gap, H = 220;
  let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-height:38vh" xmlns="http://www.w3.org/2000/svg">`;
  const colours = ['#FF7AC6', '#35D0BA', '#FFC93C', '#C6A9F0'];
  cols.forEach((col, i) => {
    const x = gap + i * (cw + gap);
    s += `<rect x="${x}" y="14" width="${cw}" height="${H - 60}" rx="10" fill="rgba(255,255,255,0.07)" stroke="${INK}" stroke-width="2"/>`;
    for (let k = 0; k < col.digit; k++) {
      const cy = H - 66 - k * 20;
      s += `<circle cx="${x + cw / 2}" cy="${cy}" r="8" fill="${colours[i % colours.length]}" stroke="${INK}" stroke-width="2"/>`;
    }
    s += `<text x="${x + cw / 2}" y="${H - 24}" text-anchor="middle" font-family="Fredoka,sans-serif" font-size="16" font-weight="700" fill="#fff">${col.label}</text>`;
    if (col.worth != null) s += `<text x="${x + cw / 2}" y="${H - 6}" text-anchor="middle" font-family="Fredoka,sans-serif" font-size="15" fill="#FFC93C">worth ${col.worth}</text>`;
    s += `<text x="${x + cw / 2}" y="10" text-anchor="middle" font-family="Fredoka,sans-serif" font-size="22" font-weight="700" fill="#fff">${col.digit}</text>`;
  });
  s += `</svg>`;
  return s;
}

function numberLineSVG(spec) {
  const from = spec.from, to = spec.to, W = 520, H = 150, pad = 40;
  const span = to - from;
  const xOf = (v) => pad + (v - from) / span * (W - 2 * pad);
  let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-height:34vh" xmlns="http://www.w3.org/2000/svg">`;
  s += `<line x1="${pad}" y1="100" x2="${W - pad}" y2="100" stroke="#fff" stroke-width="4" stroke-linecap="round"/>`;
  for (let v = from; v <= to; v++) {
    const x = xOf(v); const major = (v === from || v === to || v % 5 === 0);
    s += `<line x1="${x}" y1="${major ? 90 : 95}" x2="${x}" y2="110" stroke="#fff" stroke-width="${major ? 3 : 1.5}"/>`;
    if (major) s += `<text x="${x}" y="128" text-anchor="middle" font-family="Fredoka,sans-serif" font-size="15" fill="#fff">${v}</text>`;
  }
  (spec.hops || []).forEach((h, i) => {
    const x1 = xOf(h.from), x2 = xOf(h.to), mid = (x1 + x2) / 2;
    const col = ['#FF7AC6', '#35D0BA', '#FFC93C'][i % 3];
    s += `<path d="M${x1} 100 Q ${mid} ${50} ${x2} 100" fill="none" stroke="${col}" stroke-width="4"/>`;
    s += `<path d="M${x2 - 6} 94 L ${x2} 100 L ${x2 - 6} 106 Z" fill="${col}"/>`;
    s += `<text x="${mid}" y="46" text-anchor="middle" font-family="Fredoka,sans-serif" font-size="18" font-weight="700" fill="${col}">${h.label}</text>`;
  });
  if (spec.circleGap != null) { const x = xOf(to); s += `<text x="${(xOf(from) + x) / 2}" y="150" text-anchor="middle" font-family="Fredoka,sans-serif" font-size="16" fill="#FFC93C">gap = ${spec.circleGap}</text>`; }
  s += `</svg>`;
  return s;
}

function fractionCircleSVG(spec) {
  const parts = spec.parts, shaded = spec.shaded, cx = 90, cy = 90, r = 74;
  let s = `<svg viewBox="0 0 180 180" width="100%" style="max-height:34vh" xmlns="http://www.w3.org/2000/svg">`;
  for (let i = 0; i < parts; i++) {
    const a0 = (i / parts) * Math.PI * 2 - Math.PI / 2, a1 = ((i + 1) / parts) * Math.PI * 2 - Math.PI / 2;
    const x0 = cx + r * Math.cos(a0), y0 = cy + r * Math.sin(a0), x1 = cx + r * Math.cos(a1), y1 = cy + r * Math.sin(a1);
    const large = (a1 - a0) > Math.PI ? 1 : 0;
    s += `<path d="M${cx} ${cy} L${x0.toFixed(1)} ${y0.toFixed(1)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)} Z" fill="${i < shaded ? '#FF7AC6' : 'rgba(255,255,255,0.12)'}" stroke="${INK}" stroke-width="2.5"/>`;
  }
  s += `<text x="90" y="172" text-anchor="middle" font-family="Fredoka,sans-serif" font-size="20" font-weight="700" fill="#fff">${shaded}/${parts}</text></svg>`;
  return s;
}

function arraySVG(spec) {
  const rows = spec.rows, cols = spec.cols, cell = 34, pad = 16;
  const W = cols * cell + 2 * pad, H = rows * cell + 2 * pad + 24;
  let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-height:34vh" xmlns="http://www.w3.org/2000/svg">`;
  for (let r = 0; r < rows; r++) for (let cN = 0; cN < cols; cN++) {
    s += `<circle cx="${pad + cN * cell + cell / 2}" cy="${pad + r * cell + cell / 2}" r="11" fill="#35D0BA" stroke="${INK}" stroke-width="2.5"/>`;
  }
  const label = (spec.counts || []).length ? spec.counts.join(', ') : `${rows} × ${cols}`;
  s += `<text x="${W / 2}" y="${H - 6}" text-anchor="middle" font-family="Fredoka,sans-serif" font-size="18" font-weight="700" fill="#FFC93C">${label}</text></svg>`;
  return s;
}

function clockSVG(spec) {
  const cx = 90, cy = 90, r = 78, h = spec.h % 12, m = spec.m;
  const hourA = ((h + m / 60) / 12) * Math.PI * 2 - Math.PI / 2;
  const minA = (m / 60) * Math.PI * 2 - Math.PI / 2;
  let s = `<svg viewBox="0 0 180 190" width="100%" style="max-height:36vh" xmlns="http://www.w3.org/2000/svg">`;
  s += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#FFF8F0" stroke="${INK}" stroke-width="4"/>`;
  for (let i = 1; i <= 12; i++) { const a = (i / 12) * Math.PI * 2 - Math.PI / 2; s += `<text x="${(cx + (r - 16) * Math.cos(a)).toFixed(1)}" y="${(cy + (r - 16) * Math.sin(a) + 6).toFixed(1)}" text-anchor="middle" font-family="Fredoka,sans-serif" font-size="15" font-weight="700" fill="${INK}">${i}</text>`; }
  s += `<line x1="${cx}" y1="${cy}" x2="${(cx + r * 0.5 * Math.cos(hourA)).toFixed(1)}" y2="${(cy + r * 0.5 * Math.sin(hourA)).toFixed(1)}" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>`;
  s += `<line x1="${cx}" y1="${cy}" x2="${(cx + r * 0.78 * Math.cos(minA)).toFixed(1)}" y2="${(cy + r * 0.78 * Math.sin(minA)).toFixed(1)}" stroke="#FF7AC6" stroke-width="4" stroke-linecap="round"/>`;
  s += `<circle cx="${cx}" cy="${cy}" r="5" fill="${INK}"/></svg>`;
  return s;
}
