// js/games/teachme.js — Teach Me (EXPANSION_2 frame 1; rebuilt as Teach Me 2.0, RUN16 W5).
//
// THE PROBLEM RUN16 W5 SET OUT TO FIX: lessons read as homework sitting beside games. The
// FORMAT is what changed, not the teaching:
//
//   HOOK  — a ten-second animated scene posing the idea as a problem the Boos have, so a
//           lesson opens with a reason to care instead of with a definition.
//   SHOW  — the existing two-ways explanation, KEPT. It is genuinely good pedagogy and the
//           brief says to keep it: same cards, same words, same worked examples.
//   TRY   — three steps where she DOES the thing by direct manipulation: drags the answer
//           into the gap, sorts the pictures, orders the panels. Never multiple choice.
//           (The three primitives live in js/lessonstages.js.)
//   WIN   — the ceremony shipped in RUN15 V3, REUSED as-is with its Lesson Stars and its
//           Journal stamp. It is not rebuilt here.
//
// AND THE SILENT REWIND IS GONE. The old behaviour — a wrong answer jumps back to the
// worked example with no message — is the specific thing RUN12 asked to have fixed and
// RUN16 W5 names again. A wrong move now springs the piece back, the step stays exactly
// where it is, and the guide explains. If she is stuck after two goes the lesson's own
// authored variant is offered, and she is TOLD that is what is happening. Nothing rewinds;
// nothing is silent.

import { el, clear, starsRow, sparkleAt, REDUCED, backControl } from '../ui.js';
import { getState } from '../state.js';
import { createGameShell } from '../gameshell.js';
import { maybeIntro, replayIntro } from '../intro.js';
import { renderGuide } from '../art.js';
import { speakMaybe } from '../guide.js';
import { sfx, music } from '../sfx.js';
import { LESSONS } from '../../data/lessons.js';
import { bestStars, recordBest, saveLastPick } from '../picker.js';
import { stampJournal } from '../quests.js';
import { confetti } from '../ui.js';
import { mountHook, mountTryStep } from '../lessonstages.js';

const LESSON_ICON = {
  tower: '🗼', spring: '🌀', footsteps: '👣', cakeslice: '🍰', dotsgrid: '⚄', clock: '🕒',
  // RUN16 W5: the three literacy lessons
  mouth: '👄', twins: '👯', hill: '⛰️'
};
export const LESSON_CEREMONY_MS = 2200;   // the beat a finished lesson gets, matching a game's
const STUCK_AT = 2;                       // wrong tries on ONE step before the variant is offered

// RUN15 V3.2 — a lesson finishes like an achievement, not like homework. The guide names
// what she learned, a badge stamps in, and the whole thing has the weight of a game's
// celebration before the results screen takes over.
// RUN16 W5 REUSES this ceremony rather than building a second one; the only change is that
// the Journal line now shows the lesson's own authored stamp where it has one.
function lessonCeremony(lesson, stars, isRecap, onDone) {
  const stamp = (lesson.win && lesson.win.stamp) || null;
  const wrap = el('div', { class: 'lesson-ceremony', role: 'dialog', 'aria-label': 'Lesson complete' });
  const panel = el('div', { class: 'card lc-panel' }, [
    el('div', { class: 'lc-badge', text: LESSON_ICON[lesson.icon] || '📘' }),
    el('h2', { class: 'lc-title', text: isRecap ? 'Nice recap!' : 'Lesson learned!' }),
    el('p', { class: 'lc-name', text: lesson.name }),
    el('div', { class: 'lc-stars', html: starsRow(stars, { size: 30 }) }),
    el('p', { class: 'lc-journal', text: stamp ? `📓 ${stamp}` : '📓 A badge for your Journal' })
  ]);
  wrap.appendChild(panel);
  document.body.appendChild(wrap);
  requestAnimationFrame(() => wrap.classList.add('show'));
  sfx.star();
  if (!REDUCED) confetti({ count: stars >= 3 ? 90 : 60, power: 1 });
  speakMaybe(isRecap ? `Nice recap of ${lesson.name}!` : `You learned ${lesson.name}!`);
  // close() must be idempotent and must cancel its own timer. It was not: only the click
  // handler cleared the auto-close timeout, so closing the ceremony ANY other way left the
  // timer armed and fired onDone a second time — a second ctx.go('results') landing
  // seconds later, on top of whatever the child had started next. (Found by RUN16 W5's
  // suite, which plays nine lessons back to back; the second navigation unmounted the
  // lesson she had just opened.)
  let closed = false, t = null;
  const close = () => {
    if (closed) return;
    closed = true;
    clearTimeout(t);
    wrap.classList.remove('show');
    setTimeout(() => wrap.remove(), 220);
    onDone();
  };
  t = setTimeout(close, REDUCED ? 900 : LESSON_CEREMONY_MS);
  wrap.addEventListener('click', close);
  if (typeof window !== 'undefined') window.__lessonCeremony = { shown: true, recap: isRecap, close };
}

// The SHOW stage, normalised. The six maths lessons carry `cards` (talk | visual |
// workedStep, unchanged since EXPANSION_2); the three literacy lessons carry the pack's own
// `show` blocks — two ways, each either a line to say or a picture to look at. Both become
// the same card list, so the renderer has one path and the authored words are untouched.
export function showCardsOf(lesson) {
  if (lesson.cards) return lesson.cards;
  const out = [];
  for (const s of (lesson.show || [])) {
    if (s.kind === 'baskets') {
      out.push({ type: 'visual', kind: 'baskets', title: s.title, spec: {
        baskets: s.baskets,
        caption: s.baskets.map(b => `${b.label}: ${b.example}`).join('  ·  '),
        say: s.baskets.map(b => b.example).join('. ') + '.'
      } });
    } else if (s.kind === 'hill') {
      out.push({ type: 'visual', kind: 'hill', title: s.title, spec: { caption: s.text, say: s.text } });
    } else {
      out.push({ type: 'talk', title: s.title, text: s.text });
    }
    // lesson B's second way carries an extra authored paragraph; it gets its own card
    if (s.also) out.push({ type: 'talk', title: s.title, text: s.also });
  }
  return out;
}

// The stages a lesson walks, in order. Exported so a suite can assert the four-stage shape
// of all nine lessons without playing all nine.
export function stagesOf(lesson) {
  return [
    { type: 'hook' },
    ...showCardsOf(lesson).map(c => ({ type: c.type, card: c })),
    ...(lesson.try || []).map((step, i) => ({ type: 'try', step, i }))
  ];
}

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
      el('p', { class: 'sc-intro', text: "Little lessons, explained two ways — then you have a go. Pick one!" })
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
    root.appendChild(backControl(() => ctx.go('hub'), { floating: true }));
  }

  function playLesson(lesson) {
    clear(root); music.play('game');
    const stages = stagesOf(lesson);
    const tryTotal = (lesson.try || []).length;
    let stageIdx = 0, slips = 0, ended = false;
    let live = null;                        // the mounted TRY step, when we are on one
    let stepWrongs = 0, usingVariant = false;

    shell = createGameShell({
      title: lesson.name, rounds: Math.max(1, tryTotal), accent: 'var(--zing)',
      onBack: () => ctx.go('hub'), hintEnabled: false, onHelp: () => replayIntro('teachme'),
      bank: () => ({ correct: doneSteps(), of: Math.max(1, tryTotal) })
    });
    root.appendChild(shell.root);
    const stage = el('div', { class: 'tm-stage' });
    shell.area.appendChild(stage);

    renderStage();

    function doneSteps() { return stages.slice(0, stageIdx).filter(s => s.type === 'try').length; }
    function stageChip(n, label) { return el('div', { class: 'tm-stage-chip', text: `${n} · ${label}` }); }

    function renderStage() {
      if (stageIdx >= stages.length) return finish();
      if (live && live.destroy) live.destroy();
      live = null;
      const s = stages[stageIdx];
      shell.setProgress(doneSteps());
      clear(stage);
      if (s.type === 'hook') return renderHook();
      if (s.type === 'try') return renderTry(s);
      return renderShow(s.card);
    }
    function nextStage() { stageIdx++; renderStage(); }

    // ---- HOOK ----
    function renderHook() {
      // RUN18D D3: the hook's beats ride the SHELL's clock, so the first-play intro freezes
      // the scene it is introducing instead of letting it play out behind itself.
      live = mountHook(stage, lesson, { onDone: nextStage, say: (t) => speakMaybe(t), after: shell.after, cancel: shell.cancel });
    }

    // ---- SHOW (the two-ways explanation, unchanged) ----
    function guideRow(text) {
      const row = el('div', { class: 'tm-guide-row' }, [
        el('div', { class: 'tm-guide', html: renderGuide(getState().guide, { view: 'head', size: 84 }) }),
        el('div', { class: 'speech-bubble tm-bubble', text })
      ]);
      speakMaybe(text);
      return row;
    }
    function renderShow(c) {
      stage.appendChild(stageChip(2, c.title || 'Two ways to see it'));
      if (c.type === 'workedStep') return renderWorked(c);
      if (c.type === 'talk') stage.appendChild(guideRow(c.text));
      else if (c.type === 'visual') {
        stage.appendChild(el('div', { class: 'tm-visual', html: renderPrimitive(c.kind, c.spec) }));
        if (c.spec.caption) stage.appendChild(el('p', { class: 'tm-caption', text: c.spec.caption }));
        // a picture card the guide names aloud (the pack asks for this on the baskets card)
        if (c.spec.say) speakMaybe(c.spec.say);
      }
      stage.appendChild(el('button', { class: 'btn big tm-next', text: 'Next ➜', onclick: () => { sfx.tap(); nextStage(); } }));
    }
    function renderWorked(c) {
      let step = 0;
      const title = el('div', { class: 'tm-worked-title', text: c.title || 'Watch closely' });
      const steps = el('div', { class: 'tm-steps' });
      c.steps.forEach((t, i) => steps.appendChild(el('div', { class: 'tm-step' + (i === 0 ? ' on' : ''), text: t })));
      const btn = el('button', { class: 'btn big tm-next', text: 'Tap 👆', onclick: advance });
      stage.append(title, steps, btn);
      speakMaybe(c.steps[0]);
      function advance() {
        sfx.tap();
        step++;
        if (step < c.steps.length) {
          steps.children[step].classList.add('on');
          [...steps.children].forEach((n, i) => n.classList.toggle('cur', i === step));
          speakMaybe(c.steps[step]);
          if (step === c.steps.length - 1) btn.textContent = 'Next ➜';
        } else nextStage();
      }
    }

    // ---- TRY ----
    function renderTry(s) { stepWrongs = 0; usingVariant = false; mountStep(s.step, s.i); }
    function mountStep(step, i) {
      clear(stage);
      stage.appendChild(stageChip(3, `Your turn — ${i + 1} of ${tryTotal}`));
      if (step.title) stage.appendChild(el('div', { class: 'tm-worked-title', text: step.title }));
      live = mountTryStep(stage, step, {
        onDone: () => {
          sfx.star();
          const box = stage.getBoundingClientRect();
          if (!REDUCED) sparkleAt(box.left + box.width / 2, box.top + 60);
          shell.react('You did it! 🌟', { voice: false, hold: 1200 });
          shell.advance();
          shell.timeout(nextStage, REDUCED ? 400 : 900);
        },
        onWrong: (line, isTrap) => {
          // NOT a rewind: the step stays exactly where it is and the guide explains.
          if (!isTrap) slips++;      // making a real word in the ship/chip trap is not a slip
          stepWrongs++;
          shell.dimHeart();
          shell.react(line, { voice: false, hold: 3200 });
          if (stepWrongs >= STUCK_AT && step.variant && !usingVariant) offerVariant(step, i);
        },
        say: (t) => speakMaybe(t),
        react: (t) => speakMaybe(t)
      });
    }
    // Stuck twice? She is offered the lesson's own authored variant — a different question
    // of the same shape — and she is told out loud that that is what just happened.
    function offerVariant(step, i) {
      usingVariant = true;
      const merged = { ...step, ...step.variant, variant: null };
      const line = "Let's try another one like it.";
      shell.timeout(() => {
        shell.react(line, { voice: false, hold: 2200 });
        speakMaybe(line);
        stepWrongs = 0;
        mountStep(merged, i);
      }, REDUCED ? 300 : 1400);
    }

    function finish() {
      if (ended) return; ended = true;
      if (live && live.destroy) live.destroy();
      shell.cleanup();
      const stars = slips === 0 ? 3 : slips === 1 ? 2 : 1;
      // RUN15 V3.3: a lesson replayed AFTER mastery is a "quick recap" — welcome, warm and
      // un-farmable. It still pays (nothing is ever taken away) but at the cosy award.
      const wasMastered = bestStars('teachme', lesson.id) >= 3;
      recordBest('teachme', lesson.id, stars);
      stampJournal('lesson_' + lesson.id);
      lessonCeremony(lesson, stars, wasMastered, () => {
        ctx.go('results', {
          game: 'teachme', gameName: lesson.name, stars,
          starType: 'lesson',                    // V1: lessons always pay Lesson Stars
          extraCosy: wasMastered,
          recap: wasMastered,
          replay: () => ctx.go('teachme')
        });
      });
    }

    // test hook — the same shape the older suites drive, with `try` where `check` was.
    if (typeof window !== 'undefined') window.__teachme = {
      card: () => ({ idx: stageIdx, type: stages[stageIdx] && stages[stageIdx].type, total: stages.length }),
      stages: () => stages.map(s => s.type),
      tapNext: () => { const b = stage.querySelector('.tm-next'); if (b) b.click(); },
      tapWorked: () => { const b = stage.querySelector('.tm-next'); if (b) b.click(); },
      // answer(true) completes the current TRY step the way she would; answer(false) makes
      // a genuine wrong move — a real drop onto a real wrong target, not a simulated one.
      answer: (wantCorrect) => {
        const h = live && live.hooks;
        if (!h || !h.kind) { const b = stage.querySelector('.tm-next'); if (b) b.click(); return; }
        if (wantCorrect) return h.solve && h.solve();
        return wrongMove(h);
      },
      solveStep: () => live && live.hooks && live.hooks.solve && live.hooks.solve(),
      wrongStep: () => live && live.hooks && wrongMove(live.hooks),
      stepHooks: () => live && live.hooks,
      stepKind: () => live && live.hooks && live.hooks.kind,
      feedback: () => (live && live.hooks && live.hooks.feedback) ? live.hooks.feedback() : '',
      usingVariant: () => usingVariant,
      state: () => ({ slips, cardIdx: stageIdx, stageIdx, ended, stepWrongs }),
      ended: () => ended
    };
    function wrongMove(h) {
      const s = stages[stageIdx];
      const step = s && s.step;
      if (!step) return false;
      if (h.kind === 'sort') {
        const bin = h.binsOf()[0];
        const bad = (step.items || []).find(it => it.bin !== bin);
        if (bad) return h.drop(bad.key, bin);
      } else if (h.kind === 'place') {
        const answers = h.answers();
        const tiles = (usingVariant && step.variant && step.variant.tiles) ? step.variant.tiles : step.tiles;
        const bad = (tiles || []).find(t => t.key !== answers[0]);
        if (bad) return h.drop(bad.key, 0);
      }
      return false;   // `order` has no wrong move, by design
    }
  }

  return { unmount() { if (shell) shell.cleanup(); } };
}

// ===================== visual primitives (implemented once) =====================
export function renderPrimitive(kind, spec) {
  if (kind === 'baskets') return basketsSVG(spec);
  if (kind === 'hill') return storyHillSVG(spec);
  if (kind === 'placeValue') return placeValueSVG(spec);
  if (kind === 'numberLine') return numberLineSVG(spec);
  if (kind === 'fractionCircle') return fractionCircleSVG(spec);
  if (kind === 'array') return arraySVG(spec);
  if (kind === 'clock') return clockSVG(spec);
  return '';
}
const INK = '#2A1B4E';

// RUN16 W5 — the two literacy SHOW pictures.
// baskets: the pack's "three baskets, each with its grapheme card, each holding one example".
function basketsSVG(spec) {
  const bs = spec.baskets || [];
  const W = bs.length * 120 + 20, H = 190;
  let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-height:34vh;" xmlns="http://www.w3.org/2000/svg">`;
  s += drawBoard(W, H);
  bs.forEach((b, i) => {
    const x = 20 + i * 120;
    s += `<path d="M${x} 74 L${x + 100} 74 L${x + 88} 162 Q${x + 50} 172 ${x + 12} 162 Z" fill="#F0D28C" stroke="${INK}" stroke-width="3"/>`;
    for (let k = 0; k < 4; k++) s += `<path d="M${x + 14 + k * 22} 76 L${x + 20 + k * 20} 160" stroke="#8A5A44" stroke-width="2.5" fill="none"/>`;
    s += `<rect x="${x + 22}" y="16" width="56" height="46" rx="10" fill="#FFC93C" stroke="${INK}" stroke-width="3"/>`;
    s += `<text x="${x + 50}" y="50" text-anchor="middle" font-family="Fredoka,sans-serif" font-size="28" font-weight="700" fill="${INK}">${b.label}</text>`;
    s += `<text x="${x + 50}" y="184" text-anchor="middle" font-family="Fredoka,sans-serif" font-size="17" font-weight="700" fill="#fff">${b.example}</text>`;
  });
  return s + '</svg>';
}
// hill: "a simple hill diagram, the story climbing up to the problem at the top".
function storyHillSVG() {
  const W = 460, H = 200;
  let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-height:32vh;" xmlns="http://www.w3.org/2000/svg">`;
  s += drawBoard(W, H);
  s += `<path d="M40 160 Q140 30 230 30 Q320 30 420 160" fill="none" stroke="#FFC93C" stroke-width="6" stroke-linecap="round"/>`;
  const pts = [[40, 160, 'beginning'], [230, 30, 'middle'], [420, 160, 'end']];
  pts.forEach(([x, y, label]) => {
    s += `<circle cx="${x}" cy="${y}" r="11" fill="#FF7AC6" stroke="${INK}" stroke-width="3"/>`;
    s += `<text x="${x}" y="${y > 100 ? y + 30 : y - 20}" text-anchor="middle" font-family="Fredoka,sans-serif" font-size="17" font-weight="700" fill="#fff">${label}</text>`;
  });
  s += `<text x="230" y="${H - 8}" text-anchor="middle" font-family="Fredoka,sans-serif" font-size="15" fill="#FFC93C">the problem sits at the top</text>`;
  return s + '</svg>';
}

function drawBoard(W, H) {
  return `<rect x="2" y="2" width="${W-4}" height="${H-4}" rx="16" fill="#1E143A" stroke="#3A2863" stroke-width="4"/>` + 
         `<pattern id="tgrid" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="1"/></pattern>` +
         `<rect x="2" y="2" width="${W-4}" height="${H-4}" rx="16" fill="url(#tgrid)"/>`;
}

function placeValueSVG(spec) {
  const cols = spec.cols; const cw = 90, gap = 16, W = cols.length * (cw + gap) + gap, H = 220;
  let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-height:38vh; filter: drop-shadow(0 8px 16px rgba(0,0,0,0.15));" xmlns="http://www.w3.org/2000/svg">`;
  s += drawBoard(W, H);
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
  let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-height:34vh; filter: drop-shadow(0 8px 16px rgba(0,0,0,0.15));" xmlns="http://www.w3.org/2000/svg">`;
  s += drawBoard(W, H);
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
  let s = `<svg viewBox="0 0 180 180" width="100%" style="max-height:34vh; filter: drop-shadow(0 8px 16px rgba(0,0,0,0.15));" xmlns="http://www.w3.org/2000/svg">`;
  s += drawBoard(180, 180);
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
  let s = `<svg viewBox="0 0 ${W} ${H}" width="100%" style="max-height:34vh; filter: drop-shadow(0 8px 16px rgba(0,0,0,0.15));" xmlns="http://www.w3.org/2000/svg">`;
  s += drawBoard(W, H);
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
  let s = `<svg viewBox="0 0 180 190" width="100%" style="max-height:36vh; filter: drop-shadow(0 8px 16px rgba(0,0,0,0.15));" xmlns="http://www.w3.org/2000/svg">`;
  s += drawBoard(180, 190);
  s += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#FFF8F0" stroke="${INK}" stroke-width="4"/>`;
  for (let i = 1; i <= 12; i++) { const a = (i / 12) * Math.PI * 2 - Math.PI / 2; s += `<text x="${(cx + (r - 16) * Math.cos(a)).toFixed(1)}" y="${(cy + (r - 16) * Math.sin(a) + 6).toFixed(1)}" text-anchor="middle" font-family="Fredoka,sans-serif" font-size="15" font-weight="700" fill="${INK}">${i}</text>`; }
  s += `<line x1="${cx}" y1="${cy}" x2="${(cx + r * 0.5 * Math.cos(hourA)).toFixed(1)}" y2="${(cy + r * 0.5 * Math.sin(hourA)).toFixed(1)}" stroke="${INK}" stroke-width="6" stroke-linecap="round"/>`;
  s += `<line x1="${cx}" y1="${cy}" x2="${(cx + r * 0.78 * Math.cos(minA)).toFixed(1)}" y2="${(cy + r * 0.78 * Math.sin(minA)).toFixed(1)}" stroke="#FF7AC6" stroke-width="4" stroke-linecap="round"/>`;
  s += `<circle cx="${cx}" cy="${cy}" r="5" fill="${INK}"/></svg>`;
  return s;
}
