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
import { createTrickyCollector, choiceMiss, pileBoost } from '../trickypile.js';
import { filterLevels } from '../content.js';
import { renderWordArt } from '../wordart.js';
import { BLEND_LEVELS, BLEND_LEVEL_NUMBERS, blendLevel, blendEntry, ALL_BLEND_WORDS } from '../../data/blending.js';
import { FACTORY_LEVEL_NUMBERS, factoryLevel, ALL_FACTORY_ITEMS, factoryItem } from '../../data/wordfactory.js';
import { contentTier } from '../content.js';

const ROUND_WORDS = 8;
const MAX_HINTS = 2;
const START_GAP = 30;          // px between tiles before the Blend button closes them
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
  // RUN18E Part B: at Medium/Full the card becomes the Word Factory (morpheme mode).
  // Light/Toddler keep the grapheme-blend game exactly as RUN16 built it. One card, one
  // route — the tier decides which game answers it.
  const t = contentTier();
  if (t === 'medium' || t === 'full') return mountFactory(container, params, ctx);
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
      el('p', { class: 'sc-intro', text: 'Tap Blend and watch the sounds slide together!' })
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
    const pool = ALL_BLEND_WORDS.map(w => ({ id: 'blendit:' + w, word: w, boost: pileBoost('blendit:' + w) }));
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
        'aria-label': 'Blend the sounds into a word', onclick: () => runBlend()
      });
      const picks = el('div', { class: 'bl-picks', style: { display: 'none' } });
      stage.append(el('p', { class: 'tm-try-instruction', text: 'Tap Blend and watch the sounds slide together!' }), tiles, word, blendBtn, picks);

      // RUN18B Y13: the pinch STAYS — dragging the tiles together still closes the gaps and
      // fires the same blend — but nothing tells her to any more. Every instruction now names
      // the Blend button, because a drag she was TOLD to make and could not land read as a
      // game that would not respond. Found by hand, it is a delight; required, it was a wall.
      wirePinch(tiles);
      shell.setProgress(idx);
      speakMaybe('Tap Blend and watch the sounds slide together!');

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
          recordResult('blendit:' + item.w, true);
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
          recordResult('blendit:' + item.w, false);
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

// ===================== RUN18E L2/Part B: THE WORD FACTORY (Medium/Full) =====================
// Fiction: Boos queue at the hatch with orders; she builds the word from the parts shelf;
// the machine stamps it. Order-fulfilment, not fill-the-gap — see RUN18E.md L2 for the DNA.

const FACTORY_ROUND = 8;
const FACTORY_MAX_HINTS = 2;
export const GAUGE_MAX = 3;              // stage that counts as "the red puff"
const RUSH_CHANCE = 0.3;                 // L3+ only

// A shelf for one order: its own true parts, plus 2-4 distractor morphemes drawn from the
// same level (other items' parts, deduped by label so two identical decoys never appear).
export function buildShelf(item, levelItems) {
  const correct = item.parts.map((p, i) => ({ id: item.id + ':c' + i, k: p.k, correct: true, slot: i }));
  const pool = [];
  for (const other of levelItems) {
    if (other.id === item.id) continue;
    for (const p of other.parts) { if (!item.parts.some(cp => cp.k === p.k) && !pool.some(x => x.k === p.k)) pool.push(p.k); }
  }
  shuffle(pool);
  const nDecoy = Math.min(pool.length, 2 + rand(3));   // 2-4
  const decoys = pool.slice(0, nDecoy).map((k, i) => ({ id: item.id + ':d' + i, k, correct: false }));
  return shuffle([...correct, ...decoys]);
}

export function buildFactoryRound(level, n = FACTORY_ROUND) {
  const lvl = factoryLevel(level);
  const items = lvl.items;
  const out = []; let guard = 0;
  while (out.length < Math.min(n, items.length * 3) && guard++ < n * 20) {
    const it = items[rand(items.length)];
    if (out.length && out[out.length - 1].id === it.id && items.length > 1) continue;
    out.push(it);
    if (out.length >= n) break;
  }
  return out.map(it => ({ ...it, shelf: buildShelf(it, items), rush: level >= 3 && Math.random() < RUSH_CHANCE }));
}

export function mountFactory(container, params, ctx) {
  const root = el('div', { class: 'screen blendit wordfactory' });
  container.appendChild(root);
  let shell = null;

  const rz = params && params.resume;
  if (rz && rz.mix) playMix();
  else if (rz && rz.level) play(rz.level);
  else startCard();
  maybeIntro('wordfactory');

  function startCard() {
    clear(root);
    music.play('game');
    const s = getState();
    const card = el('div', { class: 'start-card card' }, [
      el('div', { class: 'sc-guide', html: renderGuide(s.guide, { view: 'head', size: 96 }) }),
      el('h2', { text: 'The Word Factory' }),
      el('p', { class: 'sc-intro', text: 'Boos are queuing with orders — build them, stamp them, keep the combo alive!' })
    ]);
    card.appendChild(buildPicker({
      game: 'wordfactory',
      choices: [{ key: 'factory', name: 'The Word Factory', sub: 'build the order' }],
      levelsFor: () => FACTORY_LEVEL_NUMBERS,
      levelName: (l) => factoryLevel(l).name,
      onStart: (key, level) => (key === MIX_KEY ? playMix() : play(level))
    }).node);
    card.appendChild(el('div', { class: 'star-rule' }, [
      el('div', { html: starsRow(3, { size: 24 }) }),
      el('p', { text: 'Three stars: at most one wrong part, no hints — and keep the steam gauge out of the red!' })
    ]));
    root.appendChild(card);
    root.appendChild(backControl(() => ctx.go('hub'), { floating: true }));
  }

  function play(level) { startRound(buildFactoryRound(level), { badgeKey: 'L' + level, level, title: 'The Word Factory' }); }
  function playMix() {
    const pool = ALL_FACTORY_ITEMS.map(it => ({ id: 'wordfactory:' + it.id, item: it.id, boost: pileBoost('wordfactory:' + it.id) }));
    const picked = buildSmartMix(pool, FACTORY_ROUND).map(p => factoryItem(p.item)).filter(Boolean);
    const items = picked.map(it => ({ ...it, shelf: buildShelf(it, ALL_FACTORY_ITEMS), rush: Math.random() < RUSH_CHANCE }));
    startRound(items.length ? items : buildFactoryRound(1), { badgeKey: MIX_KEY, level: null, title: 'Smart Mix', mix: true });
  }

  function startRound(items, { badgeKey, level, title, mix = false }) {
    clear(root);
    if (!items.length) return startCard();
    let idx = 0, wrong = 0, hintsUsed = 0, combo = 0, bestCombo = 0, scoreUnits = 0;
    let queueDepth = 1, gaugeStage = 0, goldBlocked = false, rushAccepted = false, ticketTimer = null;
    let placed = 0, phase = 'build', curShelf = null, curNodes = null, itemHadWrong = false;

    shell = createGameShell({
      title, rounds: items.length, accent: 'var(--zing)',
      onHelp: () => replayIntro('wordfactory'),
      onBack: () => { tts.cancel(); ctx.go('hub'); },
      onHint: () => useHint(),
      bank: () => ({ correct: scoreUnits, of: items.length })
    });
    root.appendChild(shell.root);
    const guide = getState().guide;
    const stage = el('div', { class: 'wf-stage' });
    shell.area.appendChild(stage);
    const gauge = el('div', { class: 'wf-gauge', 'aria-label': 'Steam pressure' }, [
      el('span', { class: 'wf-gauge-fill' }), el('span', { class: 'wf-gauge-puff', text: '💨' })
    ]);
    shell.area.appendChild(gauge);
    const collector = createTrickyCollector(shell.area);

    function ticketMs() { return (typeof window !== 'undefined' && window.__wfTicketMs) || 12000; }
    function armTicket() {
      shell.cancel(ticketTimer);
      ticketTimer = shell.timeout(() => {
        if (idx < items.length - 1) { queueDepth = Math.min(4, queueDepth + 1); paintGauge(); }
        armTicket();
      }, ticketMs());
    }
    function paintGauge() {
      gaugeStage = Math.min(GAUGE_MAX, Math.max(0, queueDepth - 1));
      if (gaugeStage >= GAUGE_MAX) goldBlocked = true;
      gauge.className = 'wf-gauge stage-' + gaugeStage + (goldBlocked ? ' blocked' : '');
      gauge.querySelector('.wf-gauge-fill').style.width = Math.round((gaugeStage / GAUGE_MAX) * 100) + '%';
    }
    function serveTicket() { queueDepth = Math.max(1, queueDepth - 1); paintGauge(); }

    renderItem();
    armTicket();
    function cur() { return items[idx]; }

    function renderItem() {
      phase = 'build'; placed = 0; itemHadWrong = false;
      const item = cur();
      rushAccepted = false;
      clear(stage);
      const rail = el('div', { class: 'wf-rail' }, [
        el('div', { class: 'wf-ticket' }, [
          el('div', { class: 'wf-guide', html: renderGuide(guide, { view: 'head', size: 60 }) }),
          el('div', { class: 'wf-order', text: item.order })
        ]),
        ...(item.rush ? [el('button', {
          class: 'btn soft wf-rush', text: '✨ Rush! (double)',
          onclick: (e) => { rushAccepted = true; e.currentTarget.disabled = true; e.currentTarget.classList.add('taken'); sfx.tap(); shell.react('Rush accepted — worth double!', { voice: false, hold: 1400 }); }
        })] : [])
      ]);
      const plate = el('div', { class: 'wf-plate' });
      for (let i = 0; i < item.parts.length; i++) plate.appendChild(el('span', { class: 'wf-slot', dataset: { i: String(i) } }));
      const ruleCard = el('div', { class: 'wf-rule', style: { visibility: 'hidden' } }, [el('span', { class: 'wf-rule-type', text: item.ruleType }), el('span', { class: 'wf-rule-line' })]);
      const shelf = el('div', { class: 'wf-shelf' });
      curShelf = item.shelf;
      curNodes = {};
      for (const tile of curShelf) {
        const b = el('button', { class: 'btn wf-tile', dataset: { id: tile.id }, text: tile.k, onclick: () => tapTile(tile, b) });
        curNodes[tile.id] = b;
        shelf.appendChild(b);
      }
      stage.append(rail, plate, ruleCard, shelf);
      shell.setProgress(idx);
      speakMaybe(item.order);
    }

    function tapTile(tile, node) {
      if (phase !== 'build') return;
      const need = cur().parts[placed];
      if (tile.k === need.k && tile.correct) {
        // right part: seats onto the plate; the seam join (if any) shows as the tile lands
        sfx.tap();
        node.disabled = true; node.classList.add('placed');
        const slot = stage.querySelectorAll('.wf-slot')[placed];
        if (slot) slot.textContent = need.l;
        placed++;
        if (placed >= cur().parts.length) shell.timeout(stamp, 220);
      } else {
        // wrong part: sneezes back, the rule line fires, the order never leaves
        wrong++; combo = 0; itemHadWrong = true;
        shell.dimHeart();
        sfx.oops();
        node.classList.remove('sneeze'); void node.offsetWidth; node.classList.add('sneeze');
        shell.timeout(() => node.classList.remove('sneeze'), 360);
        const rc = stage.querySelector('.wf-rule');
        rc.style.visibility = ''; rc.querySelector('.wf-rule-line').textContent = cur().rule;
        speakMaybe(cur().rule);
        recordResult('wordfactory:' + cur().id, false);
        collector.addAttempted(factoryMiss(cur()));
      }
    }

    function stamp() {
      phase = 'stamping';
      const plate = stage.querySelector('.wf-plate');
      plate.classList.add('stamping');
      sfx.correct();
      shell.timeout(() => {
        plate.classList.add('stamped');
        plate.textContent = '';
        plate.appendChild(el('span', { class: 'wf-stamped-word', text: cur().build }));
        sfx.star();
        finishItem();
      }, 300);
    }

    function finishItem() {
      const item = cur();
      const perfect = !itemHadWrong;
      if (perfect) { combo++; bestCombo = Math.max(bestCombo, combo); } else combo = 0;
      const units = rushAccepted ? 2 : 1;
      scoreUnits += (perfect ? units : units * 0.5);
      recordResult('wordfactory:' + item.id, perfect);
      const comboNote = combo >= 8 ? ' 🎉' : combo >= 5 ? ' 🚩' : combo >= 3 ? ' ✨' : '';
      shell.react(`${item.build}! Stamped and done!${comboNote}`, { voice: false, hold: 1500 });
      speakMaybe(`${item.build}! Stamped and done!`);
      serveTicket();
      shell.advance();
      idx++;
      shell.timeout(() => (idx >= items.length ? finish() : renderItem()), 1300);
    }

    function useHint() {
      if (hintsUsed >= FACTORY_MAX_HINTS || phase !== 'build') return;
      hintsUsed++;
      if (hintsUsed >= FACTORY_MAX_HINTS) shell.enableHint(false);
      const decoyNode = Object.values(curNodes).find(n => !n.disabled && curShelf.find(t => t.id === n.dataset.id && !t.correct));
      if (decoyNode) { decoyNode.disabled = true; decoyNode.style.opacity = '.35'; }
      shell.react('I moved a wrong part out of the way!', { voice: false, hold: 1600 });
    }

    function finish() {
      shell.cancel(ticketTimer);
      tts.cancel();
      shell.cleanup();
      const of = items.length;
      let stars = (hintsUsed === 0 && wrong <= 1) ? 3 : (wrong <= 3 ? 2 : 1);
      if (goldBlocked && stars > 2) stars = 2;
      recordBest('blendit', 'factory:' + (badgeKey || 'L'), stars);
      ctx.go('results', {
        game: 'blendit', gameName: mix ? 'Smart Mix' : 'The Word Factory', stars, level,
        cat: mix ? null : badgeKey, mix, tricky: collector.items(),
        replay: () => ctx.go('blendit')
      });
    }

    if (typeof window !== 'undefined') window.__factory = {
      state: () => ({ idx, wrong, hintsUsed, combo, bestCombo, scoreUnits, total: items.length, placed, phase }),
      item: () => ({ id: cur().id, build: cur().build, order: cur().order, parts: cur().parts.map(p => p.k), rule: cur().rule }),
      shelf: () => curShelf.map(t => ({ id: t.id, k: t.k, correct: t.correct })),
      tapCorrect: () => { const need = cur().parts[placed]; const t = curShelf.find(x => x.k === need.k && x.correct); if (t) tapTile(t, curNodes[t.id]); },
      tapWrong: () => { const need = cur().parts[placed]; const t = curShelf.find(x => !(x.k === need.k && x.correct)); if (t) tapTile(t, curNodes[t.id]); },
      finishItem: () => { while (placed < cur().parts.length) window.__factory.tapCorrect(); },
      gaugeStage: () => gaugeStage, goldBlocked: () => goldBlocked, queueDepth: () => queueDepth,
      forceTicket: () => { queueDepth = Math.min(4, queueDepth + 1); paintGauge(); },
      rushVisible: () => !!stage.querySelector('.wf-rush'), acceptRush: () => { const b = stage.querySelector('.wf-rush'); if (b) b.click(); },
      collected: () => collector.items().length,
      hint: () => useHint()
    };
  }

  return { unmount() { if (shell) shell.cleanup(); tts.cancel(); } };
}

export function factoryMiss(item) {
  return {
    id: 'wordfactory:' + item.id, game: 'blendit', prompt: item.order,
    options: item.parts.map(p => p.k), answer: item.parts.map(p => p.k).join('+'),
    say: item.order
  };
}

// A mis-blended word goes to the Tricky Pile as three pictures, one of which is the word.
export function blendMiss(item) {
  const decoys = item.options.filter(o => o !== item.w).slice(0, 2);
  const options = [item.w, ...decoys];
  return {
    ...choiceMiss({ id: 'blendit:' + item.w, game: 'blendit', prompt: `Which picture is ${item.w}?`, options, answer: item.w }),
    pics: Object.fromEntries(options.map(w => [w, renderWordArt(w, { size: 74, label: w })])),
    say: `Which picture is ${item.w}?`
  };
}
export { BLEND_LEVELS };
