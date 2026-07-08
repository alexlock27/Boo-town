// js/booquest.js — Boo Quest, chapter 1 (RUN6 C6). Answers power an adventure.
// A storybook map of The Sparkle Meadow (data/quests.js): six nodes she walks with
// her guide. Encounters reuse the existing question engines in quest skins, with
// difficulty drawn from her Smart Mix ledger (autoQuestion). Progress saves per node;
// finishing the land grants Scout, the Quest Flag, a Journal stamp and a trophy.

import { el, clear, confetti, sparkleAt, backControl, REDUCED } from './ui.js';
import { getState, mutate, recordResult } from './state.js';
import { renderGuide, renderItem } from './art.js';
import { speakMaybe } from './guide.js';
import { sfx, music } from './sfx.js';
import { autoQuestion } from './questions.js';
import { makeSpeller, typeInto } from './speller.js';
import { QUEST_LANDS, RUNE_WORDS, GRUMP_MOODS } from '../data/quests.js';
import { stampJournal, noteQuest } from './quests.js';
import { checkAndCelebrate } from './trophies.js';
import { BY_ID } from '../data/catalogue.js';

const LAND = QUEST_LANDS[0];   // chapter 1 (the only land for now)
const rand = (n) => (Math.random() * n) | 0;

export function mount(container, params, ctx) {
  const root = el('div', { class: 'screen booquest' });
  container.appendChild(root);
  music.play('calm');
  const s = getState();
  const landDone = () => !!(getState().quest && getState().quest.lands && getState().quest.lands[LAND.id]);
  let active = null;   // the running encounter (for QA hooks)

  function nodeIdx() { const q = getState().quest || {}; return landDone() ? LAND.nodes.length : Math.min(q.node || 0, LAND.nodes.length); }
  function saveNode(n) { mutate(st => { st.quest.node = n; }); }

  renderMap();

  // ---- the storybook map ----
  function renderMap() {
    clear(root);
    active = null;
    root.appendChild(backControl(() => ctx.go('hub'), { floating: true }));
    const cur = nodeIdx();
    const finished = landDone();
    const wrap = el('div', { class: 'bq-wrap' });
    wrap.appendChild(el('h2', { class: 'bq-title', text: LAND.name }));
    const guide = getState().guide;
    // the path, newest node at the bottom, misty horizon at the top ("more coming soon")
    const path = el('div', { class: 'bq-path' });
    path.appendChild(el('div', { class: 'bq-horizon', text: '⋯ more lands coming soon ⋯' }));
    LAND.nodes.forEach((nd, i) => {
      const state = finished || i < cur ? 'done' : i === cur ? 'current' : 'future';
      const node = el('div', { class: 'bq-node ' + state + (i % 2 ? ' right' : ' left') });
      node.appendChild(el('div', { class: 'bq-marker', html: NODE_ICON[nd.type] || '⭐' }));
      node.appendChild(el('div', { class: 'bq-node-title', text: nd.title }));
      if (state === 'done') node.appendChild(el('div', { class: 'bq-tick', text: '✓' }));
      if (state === 'current') {
        node.appendChild(el('div', { class: 'bq-guide', html: renderGuide(guide, { view: 'head', size: 56 }) }));
        node.appendChild(el('button', { class: 'btn bq-play', text: 'Go! ▶', onclick: () => { sfx.tap(); openNode(i); } }));
        node.addEventListener('click', (e) => { if (!e.target.closest('.bq-play')) openNode(i); });
      }
      path.appendChild(node);
    });
    wrap.appendChild(path);
    if (finished) {
      wrap.appendChild(el('div', { class: 'bq-complete', text: '🎉 Sparkle Meadow complete! Scout and your Quest Flag are in your collection.' }));
    }
    root.appendChild(wrap);
    // reverse the visual order so node 0 sits at the bottom (she climbs toward the horizon)
    path.style.flexDirection = 'column-reverse';

    if (typeof window !== 'undefined') window.__booquest = hooks();
  }

  // ---- a node's encounter ----
  function openNode(i) {
    saveNode(i);   // leaving mid-node resumes here (progress saves per node)
    const nd = LAND.nodes[i];
    clear(root);
    active = null;
    root.appendChild(backControl(() => renderMap(), { floating: true }));
    const panel = el('div', { class: 'bq-encounter bq-' + nd.type });
    root.appendChild(panel);
    panel.appendChild(el('div', { class: 'bq-narrate' }, [
      el('div', { class: 'bq-narrate-guide', html: renderGuide(getState().guide, { view: 'head', size: 60 }) }),
      el('p', { class: 'bq-narrate-line', text: nd.narrate })
    ]));
    speakMaybe(nd.narrate);
    const hearts = makeHearts(panel);
    if (nd.type === 'bridge') runBridge(nd, i, panel, hearts);
    else if (nd.type === 'rune') runRune(nd, i, panel, hearts);
    else if (nd.type === 'grump' || nd.type === 'boss') runGrump(nd, i, panel, hearts);
    else if (nd.type === 'chest') runChest(nd, i, panel);
    if (typeof window !== 'undefined') window.__booquest = hooks();
  }

  function makeHearts(panel) {
    let left = 3;
    const row = el('div', { class: 'bq-hearts' });
    const draw = () => { row.innerHTML = ''; for (let i = 0; i < 3; i++) row.appendChild(el('span', { class: 'bq-heart' + (i < left ? '' : ' out'), text: '💜' })); };
    draw(); panel.appendChild(row);
    return { dim() { left = Math.max(0, left - 1); draw(); }, left: () => left };
  }

  // ---- multiple-choice quiz block (bridge / grump / boss) ----
  function quizCard(panel, onAnswer) {
    const card = el('div', { class: 'bq-quiz' });
    const prompt = el('div', { class: 'bq-prompt' });
    const opts = el('div', { class: 'bq-options' });
    card.append(prompt, opts);
    panel.appendChild(card);
    let q = null, locked = false;
    function ask(prevKey) {
      q = autoQuestion(prevKey, 3);   // ledger-weighted difficulty (Smart Mix)
      locked = false;
      prompt.textContent = q.prompt;
      if (q.speak) speakMaybe(q.speak);
      clear(opts);
      q.options.forEach((o, idx) => opts.appendChild(el('button', { class: 'btn bq-opt', text: String(o), onclick: () => choose(idx, opts.children[idx]) })));
      if (typeof window !== 'undefined') window.__booQuestion = q;
    }
    function choose(idx, node) {
      if (locked) return;
      const correct = idx === q.correct;
      recordResult(q.key, correct);
      if (correct) { locked = true; onAnswer(true, q); }
      else { if (node) { node.classList.remove('wrong'); void node.offsetWidth; node.classList.add('wrong'); } onAnswer(false, q); }
    }
    return { ask, question: () => q, answer: (correct) => { if (correct) { const b = opts.children[q.correct]; choose(q.correct, b); } else { const wi = q.options.findIndex((_, i) => i !== q.correct); choose(wi, opts.children[wi]); } } };
  }

  // ---- Bridge Builder: each correct answer lays the next plank; 6 crosses ----
  function runBridge(nd, i, panel, hearts) {
    let planks = 0; const need = nd.planks || 6;
    const gap = el('div', { class: 'bq-bridge-gap' });
    const plankEls = [];
    for (let p = 0; p < need; p++) { const pl = el('div', { class: 'bq-plank' }); plankEls.push(pl); gap.appendChild(pl); }
    panel.appendChild(gap);
    const quiz = quizCard(panel, (correct) => {
      if (correct) {
        sfx.pop();   // a satisfying plank thunk
        plankEls[planks].classList.add('laid');
        const r = plankEls[planks].getBoundingClientRect(); if (!REDUCED) sparkleAt(r.left + r.width / 2, r.top);
        planks++;
        if (planks >= need) { setTimeout(() => completeNode(nd, i), 500); return; }
        setTimeout(() => quiz.ask(quiz.question().key), 350);
      } else {
        sfx.oops(); hearts.dim();
        // the plank wobbles back — nothing falls
        const pl = plankEls[planks]; pl.classList.remove('wobble'); void pl.offsetWidth; pl.classList.add('wobble');
        setTimeout(() => quiz.ask(quiz.question().key), 300);
      }
    });
    quiz.ask(null);
    active = { type: 'bridge', answer: (c) => quiz.answer(c), info: () => ({ planks, need, key: quiz.question() && quiz.question().key }) };
  }

  // ---- Rune Door: spell the word to light the runes ----
  function runRune(nd, i, panel, hearts) {
    const word = RUNE_WORDS[rand(RUNE_WORDS.length)];
    const door = el('div', { class: 'bq-door' });
    for (const ch of word) door.appendChild(el('span', { class: 'bq-rune', text: ch }));
    panel.appendChild(door);
    const area = el('div', { class: 'bq-spellarea' });
    panel.appendChild(area);
    speakMaybe(`Spell... ${word}?`);
    const speller = makeSpeller(area, word, {
      onCorrect: () => { door.classList.add('open'); [...door.children].forEach(r => r.classList.add('lit')); sfx.star(); if (!REDUCED) confetti({ count: 40, power: 0.7 }); setTimeout(() => completeNode(nd, i), 900); },
      onWrongCheck: () => { hearts.dim(); }
    });
    active = { type: 'rune', word: () => word, spell: () => typeInto(area, word), info: () => ({ word }) };
  }

  // ---- Grump Cheer-Off / Boss Grump: correct answers charge cheers that lift its mood ----
  function runGrump(nd, i, panel, hearts) {
    const stages = nd.stages || 3;
    let cheers = 0, moodIdx = 0;
    const grumpEl = el('div', { class: 'bq-grump' + (nd.type === 'boss' ? ' boss' : ''), html: grumpSVG(GRUMP_MOODS[0], nd.type === 'boss') });
    const meter = el('div', { class: 'bq-cheer-meter' });
    const segs = [];
    for (let seg = 0; seg < stages; seg++) { const b = el('i', { class: 'bq-cheer-seg' }); segs.push(b); meter.appendChild(b); }
    panel.append(grumpEl, el('div', { class: 'bq-cheer-label', text: '✨ Sparkle Cheer' }), meter);
    const quiz = quizCard(panel, (correct) => {
      if (correct) {
        cheers++;
        segs[cheers - 1] && segs[cheers - 1].classList.add('full');
        moodIdx = Math.min(GRUMP_MOODS.length - 1, moodIdx + 1);
        grumpEl.innerHTML = grumpSVG(GRUMP_MOODS[moodIdx], nd.type === 'boss');
        grumpEl.classList.remove('cheered'); void grumpEl.offsetWidth; grumpEl.classList.add('cheered');
        sfx.star(); if (!REDUCED) confetti({ count: 30, power: 0.6, origin: pointOf(grumpEl) });
        if (cheers >= stages) { grumpEl.classList.add('floataway'); setTimeout(() => completeNode(nd, i), 900); return; }
        setTimeout(() => quiz.ask(quiz.question().key), 400);
      } else {
        sfx.oops(); hearts.dim();
        grumpEl.classList.remove('huff'); void grumpEl.offsetWidth; grumpEl.classList.add('huff');   // a little rain, nothing more
        setTimeout(() => quiz.ask(quiz.question().key), 350);
      }
    });
    quiz.ask(null);
    active = { type: nd.type, answer: (c) => quiz.answer(c), info: () => ({ cheers, stages, mood: GRUMP_MOODS[moodIdx], key: quiz.question() && quiz.question().key }) };
  }

  // ---- Chest: a free reward moment using the box ceremony ----
  function runChest(nd, i, panel) {
    const chest = el('button', { class: 'bq-chest', html: '🎁', 'aria-label': 'Open the treasure chest', onclick: () => {
      sfx.fanfare();
      saveNode(i + 1);                         // advance past the chest so the quest resumes at the boss
      mutate(st => { st.boxes = (st.boxes || 0) + 1; });   // a free box
      ctx.go('ceremony');                      // reuse the signature ceremony; returns to the hub
    } });
    panel.appendChild(el('p', { class: 'bq-chest-hint', text: 'Tap the chest for a free treasure!' }));
    panel.appendChild(chest);
    active = { type: 'chest', answer: () => chest.click(), info: () => ({}) };
  }

  // ---- node + land completion ----
  function completeNode(nd, i) {
    const next = i + 1;
    if (next >= LAND.nodes.length) return completeLand(nd);
    saveNode(next);
    // pays stars into the normal economy through the results screen (crediting invariant)
    ctx.go('results', { game: 'booquest', gameName: 'Boo Quest', stars: nd.stars || 2, cat: null, mix: false, replay: () => ctx.go('booquest') });
  }
  function completeLand(nd) {
    let firstTime = false;
    mutate(st => {
      if (!st.quest.lands[LAND.id]) {
        firstTime = true;
        st.quest.lands[LAND.id] = true;
        st.inventory[LAND.reward.boo] = (st.inventory[LAND.reward.boo] || 0) + 1;
        st.inventory[LAND.reward.deco] = (st.inventory[LAND.reward.deco] || 0) + 1;
      }
      st.quest.node = LAND.nodes.length;
    });
    if (firstTime) { stampJournal(LAND.reward.stamp); noteQuest('townVisit'); }
    // award the land trophy now (its condition — quest.lands — is met); the ceremony rides on top
    try { checkAndCelebrate(); } catch (e) { console.warn(e); }
    // a short reward reveal, then results (credits the boss stars)
    clear(root);
    const boo = BY_ID[LAND.reward.boo], deco = BY_ID[LAND.reward.deco];
    const ov = el('div', { class: 'bq-landcomplete' }, [
      el('h2', { text: '🎉 Sparkle Meadow complete!' }),
      el('div', { class: 'bq-reward-row' }, [
        el('div', { class: 'bq-reward' }, [el('div', { html: boo ? renderItem(boo, { size: 96, cls: 'art-idle' }) : '' }), el('span', { text: 'Scout joins you!' })]),
        el('div', { class: 'bq-reward' }, [el('div', { html: deco ? renderItem(deco, { size: 88 }) : '' }), el('span', { text: 'Quest Flag earned!' })])
      ]),
      el('button', { class: 'btn big', text: 'Hooray! 🎉', onclick: () => ctx.go('results', { game: 'booquest', gameName: 'Boo Quest', stars: nd.stars || 3, cat: null, mix: false, replay: () => ctx.go('hub') }) })
    ]);
    root.appendChild(ov);
    if (!REDUCED) confetti({ count: 140, power: 1.2 });
    sfx.fanfare();
  }

  function pointOf(node) { const r = node.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }

  function hooks() {
    return {
      state: () => ({ node: nodeIdx(), done: landDone(), landId: LAND.id, nodes: LAND.nodes.length }),
      curType: () => (active ? active.type : (nodeIdx() < LAND.nodes.length ? LAND.nodes[nodeIdx()].type : 'done')),
      open: () => openNode(nodeIdx()),
      answer: (correct) => active && active.answer && active.answer(correct),
      spellRune: () => active && active.spell && active.spell(),
      info: () => (active && active.info ? active.info() : null),
      questionKey: () => (typeof window !== 'undefined' && window.__booQuestion ? window.__booQuestion.key : null),
      owns: (id) => (getState().inventory[id] || 0)
    };
  }

  return { unmount() {} };
}

const NODE_ICON = { bridge: '🌉', rune: '🚪', grump: '☁️', boss: '⛈️', chest: '🎁' };

// A little cloud Grump with a mood face (grumpy → unsure → smile → beaming).
function grumpSVG(mood, boss) {
  const scale = boss ? 1.25 : 1;
  const w = Math.round(150 * scale), h = Math.round(120 * scale);
  const face = {
    grumpy: '<path d="M56 82 Q75 72 94 82" fill="none" stroke="#2A1B4E" stroke-width="4" stroke-linecap="round"/><path d="M50 60 l14 5 M100 60 l-14 5" stroke="#2A1B4E" stroke-width="4" stroke-linecap="round"/>',
    unsure: '<path d="M58 80 h34" fill="none" stroke="#2A1B4E" stroke-width="4" stroke-linecap="round"/>',
    smile: '<path d="M56 76 Q75 88 94 76" fill="none" stroke="#2A1B4E" stroke-width="4" stroke-linecap="round"/>',
    beaming: '<path d="M54 74 Q75 96 96 74 Z" fill="#2A1B4E"/>'
  }[mood] || '';
  return `<svg viewBox="0 0 150 120" width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <g class="bq-grump-cloud">
    <path d="M30 88 Q10 88 14 68 Q6 50 28 48 Q30 26 56 34 Q70 18 96 32 Q124 26 124 54 Q144 58 134 80 Q140 96 116 92 Z" fill="#C9CCE6" stroke="#2A1B4E" stroke-width="4"/>
    <circle cx="60" cy="60" r="5" fill="#2A1B4E"/><circle cx="90" cy="60" r="5" fill="#2A1B4E"/>
    ${face}
    </g>
    <g class="bq-grump-rain"><line x1="50" y1="98" x2="46" y2="112" stroke="#8FC7FF" stroke-width="3" stroke-linecap="round"/><line x1="75" y1="100" x2="71" y2="114" stroke="#8FC7FF" stroke-width="3" stroke-linecap="round"/><line x1="100" y1="98" x2="96" y2="112" stroke="#8FC7FF" stroke-width="3" stroke-linecap="round"/></g>
  </svg>`;
}
