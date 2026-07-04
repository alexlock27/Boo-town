// js/games/dash.js — Boo Dash (EXPANSION_2 frame 4).
// A gentle fluency runner: the player's character trots along a path; a gate approaches
// showing a fact; three arches span the path, one correct. Tap the correct arch to steer
// through. A wrong arch is a soft bonk — the Boo shakes it off and the same fact returns,
// slower. No death, no countdown, no falling behind. A round is 12 gates.

import { el, clear, starsRow, sparkleAt, REDUCED } from '../ui.js';
import { getState } from '../state.js';
import { createGameShell } from '../gameshell.js';
import { renderGuide } from '../art.js';
import { guideLine } from '../guide.js';
import { sfx, music } from '../sfx.js';
import { BUBBLE_BY_KEY, genQuestion, LEVEL_NAME } from '../../data/bubbleCategories.js';
import { buildPicker, recordBest } from '../picker.js';

const GATES = 12;
const rand = (n) => (Math.random() * n) | 0;
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// Boo Dash reuses the Bubble Pop generators (tables, bonds, add & subtract, doubles).
const DASH_CATS = ['tables', 'bonds', 'addsub', 'doubles'];

export function mount(container, params, ctx) {
  const root = el('div', { class: 'screen dash' });
  container.appendChild(root);
  let shell = null;

  startCard();

  function startCard() {
    clear(root); music.play('game');
    const card = el('div', { class: 'start-card card' }, [
      el('div', { class: 'sc-guide', html: renderGuide(getState().guide, { view: 'head', size: 100 }) }),
      el('h2', { text: 'Boo Dash' }),
      el('p', { class: 'sc-intro', text: 'Trot through the arch with the right answer!' })
    ]);
    const picker = buildPicker({
      game: 'dash',
      choices: DASH_CATS.map(k => ({ key: k, name: BUBBLE_BY_KEY[k].name })),
      levelsFor: (key) => BUBBLE_BY_KEY[key].levels,
      levelName: LEVEL_NAME,
      onStart: (catKey, level) => play(catKey, level)
    });
    card.appendChild(picker.node);
    card.appendChild(el('div', { class: 'star-rule' }, [el('div', { html: starsRow(3, { size: 24 }) }), el('p', { text: 'Three stars: a clean run, no bonks.' })]));
    root.appendChild(card);
  }

  function play(catKey, level) {
    clear(root);
    let gate = 0, bonks = 0, streak = 0, locked = false, ended = false;
    let question = null;

    shell = createGameShell({ title: 'Boo Dash', rounds: GATES, accent: 'var(--pop)', onBack: () => ctx.go('hub'), hintEnabled: false });
    root.appendChild(shell.root);

    const track = el('div', { class: 'dash-track' });
    const factCard = el('div', { class: 'dash-fact' });
    const arches = el('div', { class: 'dash-arches' });
    const runner = el('div', { class: 'dash-runner', html: renderGuide(getState().guide, { view: 'head', size: 84 }) });
    track.append(factCard, arches, runner);
    shell.area.appendChild(track);

    nextGate();

    function nextGate() {
      if (ended) return;
      locked = false;
      question = genQuestion(catKey, level, question && question.key);
      factCard.textContent = question.display;
      const fmt = question.fmt || String;
      const opts = shuffle([{ v: question.answer, correct: true }, ...pickWrong(question).map(v => ({ v, correct: false }))]);
      clear(arches);
      opts.forEach(o => {
        const arch = el('button', { class: 'dash-arch', onclick: () => tap(o, arch) }, [
          el('div', { class: 'arch-top' }),
          el('div', { class: 'arch-label', text: fmt(o.v) })
        ]);
        arches.appendChild(arch);
      });
      runner.classList.toggle('fast', streak >= 3 && !REDUCED);   // quickens after streaks
      if (typeof window !== 'undefined') window.__dashCorrect = question.answer;
    }

    function tap(o, arch) {
      if (locked || ended) return;
      if (o.correct) {
        locked = true; streak++; sfx.correct();
        arch.classList.add('through');
        runner.classList.remove('bonk'); void runner.offsetWidth; runner.classList.add('run');
        const r = arch.getBoundingClientRect(); if (!REDUCED) sparkleAt(r.left + r.width / 2, r.top + r.height * 0.3);
        gate++; shell.setProgress(gate);
        setTimeout(() => { runner.classList.remove('run'); if (gate >= GATES) finish(); else nextGate(); }, 460);
      } else {
        bonks++; streak = 0; sfx.oops();
        arch.classList.add('bonked'); setTimeout(() => arch.classList.remove('bonked'), 400);
        runner.classList.remove('run'); void runner.offsetWidth; runner.classList.add('bonk');
        track.classList.add('slow'); setTimeout(() => track.classList.remove('slow'), 600);
        shell.react(guideLine('oops'), { voice: false, hold: 1400 });
        // same fact re-approaches slower — re-enable taps (no new gate)
        setTimeout(() => { runner.classList.remove('bonk'); }, 500);
      }
    }

    function pickWrong(q) {
      const pool = q.distractors.filter(v => v !== q.answer);
      return shuffle(pool.slice()).slice(0, 2);
    }

    function finish() {
      if (ended) return; ended = true; shell.cleanup();
      const stars = bonks === 0 ? 3 : bonks <= 3 ? 2 : 1;
      recordBest('dash', catKey, stars);
      ctx.go('results', { game: 'dash', gameName: 'Boo Dash', stars, replay: () => ctx.go('dash') });
    }

    // test hook
    if (typeof window !== 'undefined') window.__dash = {
      correct: () => question.answer,
      tap: (wantCorrect) => { const btns = [...arches.querySelectorAll('.dash-arch')]; const t = btns.find(b => (b.querySelector('.arch-label').textContent === String((question.fmt || String)(question.answer))) === wantCorrect); if (t) t.click(); },
      state: () => ({ gate, bonks, streak, ended }),
      ended: () => ended
    };
  }

  return { unmount() { if (shell) shell.cleanup(); } };
}
