// js/games/blendit.js — RUN16 W2: Blend It (blending).
//
// Feel goal: watching letters slide together into a word is the moment reading clicks.
// So the slide is the whole show — the tiles do not snap instantly, they close one part at
// a time WHILE the guide sounds that part, and the finished word lands as one piece.
//
// Mechanic (RUN16 W2, exactly): three to five grapheme tiles sit apart; she drags them
// together (or taps Blend) and they slide into place while the guide sounds each part then
// the whole word; then she taps which of three pictures the word makes. Level scales word
// length and includes the digraphs from W1.
//
// G14: the tiles are letters, but nothing in the round requires READING them — the guide
// says each part aloud, and the answer is chosen from three pictures. With sound off the
// slide-together still shows the parts becoming one word, and the pictures still carry the
// meaning.

import { el, clear, starsRow, sparkleAt, backControl, REDUCED } from '../ui.js';
import { getState, recordResult } from '../state.js';
import { createGameShell } from '../gameshell.js';
import { renderGuide } from '../art.js';
import { speakMaybe } from '../guide.js';
import { sfx, music } from '../sfx.js';
import * as tts from '../tts.js';
import { buildPicker, recordBest, MIX_KEY } from '../picker.js';
import { maybeIntro, replayIntro } from '../intro.js';
import { buildSmartMix } from '../smartmix.js';
import { createTrickyCollector, choiceMiss } from '../trickypile.js';
import { filterLevels } from '../content.js';
import { renderWordArt } from '../wordart.js';
import { BLEND_LEVELS, BLEND_LEVEL_NUMBERS, blendLevel, blendEntry, ALL_BLEND_WORDS } from '../../data/blending.js';

const ROUND_WORDS = 8;
const MAX_HINTS = 2;
const START_GAP = 30;          // px between tiles before she pulls them together
const PART_MS = 760;           // how long each part is sounded and slid in
const VOWELS = new Set(['a', 'e', 'i', 'o', 'u', 'ai', 'ee', 'oa', 'oo', 'ar', 'or', 'igh', 'ow', 'air', 'ea']);
const rand = (n) => (Math.random() * n) | 0;
const starsFor = (wrong, hints) => (hints === 0 && wrong <= 1) ? 3 : (wrong <= 3 ? 2 : 1);
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// The three pictures: the word, plus two others from the same level. They must be three
// DIFFERENT pictures — a round where two cards look the same has no right answer.
export function pickPictures(word, level) {
  const pool = blendLevel(level).words.map(w => w.w).filter(w => w !== word);
  const others = shuffle(pool).slice(0, 2);
  return shuffle([word, ...others]);
}

export function buildBlendRound(level, n = ROUND_WORDS) {
  const words = shuffle(blendLevel(level).words.slice()).slice(0, n);
  return words.map(e => ({ ...e, options: pickPictures(e.w, level) }));
}

export function mount(container, params, ctx) {
  const root = el('div', { class: 'screen blendit' });
  container.appendChild(root);
  let shell = null;

  const rz = params && params.resume;
  if (rz && rz.mix) playMix();
  else if (rz && rz.level) play(rz.level);
  else startCard();
  maybeIntro('blendit');

  function startCard() {
    clear(root);
    music.play('game');
    const s = getState();
    const card = el('div', { class: 'start-card card' }, [
      el('div', { class: 'sc-guide', html: renderGuide(s.guide, { view: 'head', size: 96 }) }),
      el('h2', { text: 'Blend It' }),
      el('p', { class: 'sc-intro', text: 'Slide the sounds together and hear the word appear!' })
    ]);
    card.appendChild(buildPicker({
      game: 'blendit',
      choices: [{ key: 'blend', name: 'Blend It', sub: 'sound them together' }],
      levelsFor: () => filterLevels(BLEND_LEVEL_NUMBERS),
      levelName: (l) => blendLevel(l).name,
      onStart: (key, level) => (key === MIX_KEY ? playMix() : play(level))
    }).node);
    card.appendChild(el('div', { class: 'star-rule' }, [
      el('div', { html: starsRow(3, { size: 24 }) }),
      el('p', { text: 'Three stars: at most one wrong picture, and no hints. Blend as many times as you like — that never costs anything.' })
    ]));
    root.appendChild(card);
    root.appendChild(backControl(() => ctx.go('hub'), { floating: true }));
  }

  function play(level) {
    startRound(buildBlendRound(level), { badgeKey: 'L' + level, level, title: 'Blend It' });
  }
  // Smart Mix: every word from every level, weighted by the mistake ledger.
  function playMix() {
    const pool = ALL_BLEND_WORDS.map(w => ({ id: 'bl:' + w, word: w, boost: 1 }));
    const items = buildSmartMix(pool, ROUND_WORDS).map(it => {
      const e = blendEntry(it.word);
      return { ...e, options: pickPictures(e.w, e.level) };
    });
    startRound(items, { badgeKey: MIX_KEY, level: null, title: 'Smart Mix', mix: true });
  }

  function startRound(items, { badgeKey, level, title, mix = false }) {
    clear(root);
    if (!items.length) return startCard();
    let idx = 0, wrong = 0, hintsUsed = 0, right = 0;
    let phase = 'tiles';           // tiles -> blending -> pick
    let tileNodes = [], gap = START_GAP, blended = false;

    shell = createGameShell({
      title, rounds: items.length, accent: 'var(--zing)',
      onHelp: () => replayIntro('blendit'),
      onBack: () => { tts.cancel(); ctx.go('hub'); },
      onHint: () => useHint(),
      bank: () => ({ correct: right, of: items.length })
    });
    root.appendChild(shell.root);
    const guide = getState().guide;

    const stage = el('div', { class: 'bl-stage' });
    shell.area.appendChild(stage);
    const collector = createTrickyCollector(shell.area);

    let curHooks = null;
    renderItem();

    function cur() { return items[idx]; }

    function renderItem() {
      phase = 'tiles'; blended = false; gap = START_GAP;
      clear(stage);
      const item = cur();
      const tiles = el('div', { class: 'bl-tiles' });
      tileNodes = item.g.map((g, i) => {
        const t = el('div', {
          class: 'bl-tile' + (VOWELS.has(g) ? ' vowel' : ''), text: g,
          'aria-label': `the ${g} sound`, dataset: { g, i: String(i) }
        });
        tiles.appendChild(t);
        return t;
      });
      // gap is expressed as a per-tile translateX, so nothing here touches layout
      const spread = (g) => {
        gap = Math.max(0, Math.min(START_GAP, g));
        const mid = (tileNodes.length - 1) / 2;
        tileNodes.forEach((n, i) => n.style.setProperty('--dx', ((i - mid) * gap).toFixed(1) + 'px'));
      };
      spread(START_GAP);
      const word = el('div', { class: 'bl-word', 'aria-live': 'polite' });
      const blendBtn = el('button', {
        class: 'btn big bl-blend-btn', text: '👐 Blend',
        'aria-label': 'Slide the sounds together', onclick: () => runBlend()
      });
      const picks = el('div', { class: 'bl-picks', style: { display: 'none' } });
      stage.append(el('p', { class: 'tm-try-instruction', text: 'Pull the sounds together!' }), tiles, word, blendBtn, picks);

      // drag-them-together: pulling any tile toward the others closes the gaps live, so
      // the join is something she DOES rather than something she watches.
      wirePinch(tiles);
      shell.setProgress(idx);
      speakMaybe('Pull the sounds together.');

      function wirePinch(tilesEl) {
        let down = false, sx = 0, startGap = START_GAP;
        const setGap = (g) => spread(g);
        tilesEl.addEventListener('pointerdown', (e) => {
          if (phase !== 'tiles') return;
          down = true; sx = e.clientX; startGap = gap;
          tilesEl.classList.add('pinching');
          tilesEl.setPointerCapture && tilesEl.setPointerCapture(e.pointerId);
        });
        tilesEl.addEventListener('pointermove', (e) => {
          if (!down || phase !== 'tiles') return;
          setGap(startGap - Math.abs(e.clientX - sx) * 1.4);
          if (gap <= 0.5) { down = false; tilesEl.classList.remove('pinching'); runBlend(); }
        });
        const up = () => { if (!down) return; down = false; tilesEl.classList.remove('pinching'); if (gap > 0.5) setGap(START_GAP); };
        tilesEl.addEventListener('pointerup', up);
        tilesEl.addEventListener('pointercancel', up);
      }

      // The blend itself: one part at a time, sounded and slid in together, then the whole
      // word. Free and repeatable — hearing it again never costs a star.
      function runBlend() {
        if (phase !== 'tiles' && phase !== 'blending') return;
        if (phase === 'blending') return;
        phase = 'blending';
        blendBtn.disabled = true;
        const parts = item.g;
        const step = (i) => {
          if (i >= parts.length) return whole();
          tileNodes.forEach(n => n.classList.remove('saying'));
          tileNodes[i].classList.add('saying');
          speakMaybe(parts[i]);
          spread(REDUCED ? 0 : START_GAP * (1 - (i + 1) / parts.length));
          shell.timeout(() => step(i + 1), REDUCED ? 260 : PART_MS);
        };
        const whole = () => {
          tileNodes.forEach(n => n.classList.remove('saying'));
          tiles.classList.add('joined');
          spread(0);
          blended = true;
          word.textContent = item.w;
          speakMaybe(item.w);
          sfx.correct();
          shell.timeout(toPick, REDUCED ? 300 : 900);
        };
        step(0);
      }

      function toPick() {
        phase = 'pick';
        blendBtn.textContent = '🔊 Blend it again';
        blendBtn.disabled = false;
        blendBtn.onclick = () => { sfx.tap(); replay(); };
        picks.style.display = '';
        clear(picks);
        stage.querySelector('.tm-try-instruction').textContent = 'Which picture is it?';
        speakMaybe(`Which one is ${item.w}?`);
        item.options.forEach(opt => {
          const b = el('button', {
            class: 'pic-card bl-pick', 'aria-label': opt, dataset: { word: opt },
            onclick: () => choose(opt, b)
          }, [el('span', { html: renderWordArt(opt, { size: 92, label: opt }) })]);
          picks.appendChild(b);
        });
      }
      function replay() {
        tileNodes.forEach((n, i) => shell.timeout(() => {
          tileNodes.forEach(m => m.classList.remove('saying'));
          n.classList.add('saying');
          speakMaybe(item.g[i]);
          if (i === item.g.length - 1) shell.timeout(() => { n.classList.remove('saying'); speakMaybe(item.w); }, PART_MS);
        }, i * PART_MS));
      }

      function choose(opt, node) {
        if (phase !== 'pick') return;
        if (opt === item.w) {
          phase = 'done';
          right++;
          node.classList.add('right');
          sfx.star();
          recordResult('bl:' + item.w, true);
          const r = node.getBoundingClientRect();
          if (!REDUCED) sparkleAt(r.left + r.width / 2, r.top + r.height / 2);
          shell.react(`${item.w}! You read it! 🌟`, { voice: false, hold: 1500 });
          speakMaybe(`${item.w}. You read it!`);
          shell.advance();
          idx++;
          shell.timeout(() => (idx >= items.length ? finish() : renderItem()), 1300);
        } else {
          wrong++;
          shell.dimHeart();
          sfx.oops();
          node.classList.remove('wrong'); void node.offsetWidth; node.classList.add('wrong');
          recordResult('bl:' + item.w, false);
          collector.addAttempted(blendMiss(item));
          const line = `That's ${opt}. Listen again — ${item.g.join(', ')} — ${item.w}!`;
          shell.react(line, { voice: false, hold: 2800 });
          speakMaybe(line);
        }
      }

      // hooks for this item (tests + the hint button)
      curHooks = {
        runBlend, toPick, choose,
        gap: () => gap, blended: () => blended, phase: () => phase,
        pinchTo: (g) => { spread(g); if (g <= 0.5) runBlend(); },
        tiles: () => item.g.slice(), options: () => item.options.slice(), word: () => item.w
      };
    }

    function useHint() {
      if (hintsUsed >= MAX_HINTS || !curHooks || curHooks.phase() !== 'pick') return;
      hintsUsed++;
      if (hintsUsed >= MAX_HINTS) shell.enableHint(false);
      const wrongNode = [...stage.querySelectorAll('.bl-pick')].find(n => n.dataset.word !== cur().w && !n.classList.contains('dimmed'));
      if (wrongNode) { wrongNode.classList.add('dimmed'); wrongNode.style.opacity = '.35'; wrongNode.disabled = true; }
      shell.react('Not that one — I took it away!', { voice: false, hold: 1600 });
    }

    function finish() {
      tts.cancel();
      shell.cleanup();
      const stars = starsFor(wrong, hintsUsed);
      recordBest('blendit', badgeKey, stars);
      ctx.go('results', {
        game: 'blendit', gameName: mix ? 'Smart Mix' : 'Blend It', stars, level,
        cat: mix ? null : badgeKey, mix, tricky: collector.items(),
        replay: () => ctx.go('blendit')
      });
    }

    if (typeof window !== 'undefined') window.__blend = {
      state: () => ({ idx, wrong, hintsUsed, right, total: items.length }),
      word: () => curHooks && curHooks.word(),
      tiles: () => curHooks && curHooks.tiles(),
      options: () => curHooks && curHooks.options(),
      phase: () => curHooks && curHooks.phase(),
      gap: () => curHooks && curHooks.gap(),
      blended: () => !!(curHooks && curHooks.blended()),
      blend: () => curHooks && curHooks.runBlend(),
      pinch: (g) => curHooks && curHooks.pinchTo(g),
      pick: (w) => { const n = [...stage.querySelectorAll('.bl-pick')].find(b => b.dataset.word === w); if (n) n.click(); },
      pickCorrect: () => window.__blend.pick(cur().w),
      pickWrong: () => { const w = cur().options.find(o => o !== cur().w); window.__blend.pick(w); },
      hint: () => useHint(),
      collected: () => collector.items().length
    };
  }

  return { unmount() { if (shell) shell.cleanup(); tts.cancel(); } };
}

// A mis-blended word goes to the Tricky Pile as three pictures, one of which is the word.
export function blendMiss(item) {
  const decoys = item.options.filter(o => o !== item.w).slice(0, 2);
  return {
    ...choiceMiss({
      id: 'bl:' + item.w, game: 'blendit',
      prompt: `Which picture is ${item.w}?`, options: [item.w, ...decoys], answer: item.w
    }),
    art: true, say: `Which picture is ${item.w}?`
  };
}
export { BLEND_LEVELS };
