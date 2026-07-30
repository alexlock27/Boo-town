// js/games/apostrophepatrol.js — RUN18E L4: Apostrophe Patrol.
//
// Two modes, one card. "Flying Comma" (possession): a sign shows an apostrophe-less phrase
// beside an owner count; she flicks the glowing comma onto the right landing spot (before an
// added s, after an s the word already has, or — level 3 — "no comma needed"). "The Squeeze
// Machine" (contractions, kept from v1): two word-tiles squeeze together, the surplus
// letters pop out, an apostrophe drops into the gap.

import { el, clear, starsRow, sparkleAt, backControl, REDUCED } from '../ui.js';
import { getState, recordResult } from '../state.js';
import { createGameShell } from '../gameshell.js';
import { renderGuide } from '../art.js';
import { speakMaybe } from '../guide.js';
import { sfx, music } from '../sfx.js';
import * as tts from '../tts.js';
import { buildPicker, recordBest, MIX_KEY } from '../picker.js';
import { maybeIntro, replayIntro } from '../intro.js';
import { createTrickyCollector, choiceMiss, pileBoost } from '../trickypile.js';
import { buildSmartMix } from '../smartmix.js';
import { SQUEEZE, POSSESSION, NO_COMMA_DECOYS, VAN_PX_S, commaWhyLine, commaRightLine, squeezeRightLine } from '../../data/apostrophe.js';
import { explainPanel } from '../celebrate.js';

const rand = (n) => (Math.random() * n) | 0;
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rand(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
function pickN(pool, n) { return shuffle(pool.slice()).slice(0, Math.min(n, pool.length)); }
export { VAN_PX_S };

export function mount(container, params, ctx) {
  const root = el('div', { class: 'screen apostrophepatrol' });
  container.appendChild(root);
  let shell = null;

  const rz = params && params.resume;
  if (rz && rz.mix) playMix();
  else if (rz && rz.cat === 'comma') play('comma', rz.level);
  else if (rz && rz.cat === 'squeeze') play('squeeze', 1);
  else startCard();
  maybeIntro('apostrophepatrol');

  function startCard() {
    clear(root);
    music.play('game');
    const s = getState();
    const card = el('div', { class: 'start-card card' }, [
      el('div', { class: 'sc-guide', html: renderGuide(s.guide, { view: 'head', size: 96 }) }),
      el('h2', { text: 'Apostrophe Patrol' }),
      el('p', { class: 'sc-intro', text: 'Flick the flying comma into place, or squeeze two words into one!' })
    ]);
    card.appendChild(buildPicker({
      game: 'apostrophepatrol',
      choices: [
        { key: 'comma', name: 'Flying Comma', sub: 'whose is it?' },
        { key: 'squeeze', name: 'The Squeeze Machine', sub: "don't, can't…" }
      ],
      levelsFor: (key) => (key === 'comma' ? [1, 2, 3] : [1]),
      levelName: (l) => (l === 1 ? 'Level 1' : l === 2 ? 'Level 2' : 'Level 3 (the van)'),
      onStart: (key, level) => (key === MIX_KEY ? playMix() : play(key, level))
    }).node);
    card.appendChild(el('div', { class: 'star-rule' }, [
      el('div', { html: starsRow(3, { size: 24 }) }),
      el('p', { text: 'Three stars: at most one wrong flick, no hints.' })
    ]));
    root.appendChild(card);
    root.appendChild(backControl(() => ctx.go('hub'), { floating: true }));
  }

  function play(mode, level) {
    if (mode === 'squeeze') startSqueezeRound(pickN(SQUEEZE, 8), { badgeKey: 'squeeze', level: 1 });
    else {
      let items = pickN(POSSESSION, level === 3 ? 7 : 8).map(it => ({ ...it, kind: 'possession' }));
      if (level === 3) items = shuffle([...items, ...pickN(NO_COMMA_DECOYS, 3).map(it => ({ ...it, kind: 'decoy' }))]);
      startCommaRound(items, { badgeKey: 'comma:L' + level, level, van: level === 3 });
    }
  }
  function playMix() {
    const pool = [
      ...SQUEEZE.map(it => ({ id: 'apostrophe:sq:' + it.id, kind: 'squeeze', item: it, boost: pileBoost('apostrophe:sq:' + it.id) })),
      ...POSSESSION.map(it => ({ id: 'apostrophe:ps:' + it.id, kind: 'possession', item: it, boost: pileBoost('apostrophe:ps:' + it.id) }))
    ];
    const picked = buildSmartMix(pool, 8);
    const squeezeItems = picked.filter(p => p.kind === 'squeeze').map(p => p.item);
    const commaItems = picked.filter(p => p.kind === 'possession').map(p => ({ ...p.item, kind: 'possession' }));
    if (commaItems.length >= squeezeItems.length) startCommaRound(commaItems.length ? commaItems : pickN(POSSESSION, 8).map(it => ({ ...it, kind: 'possession' })), { badgeKey: MIX_KEY, level: null, mix: true, van: false });
    else startSqueezeRound(squeezeItems.length ? squeezeItems : pickN(SQUEEZE, 8), { badgeKey: MIX_KEY, level: null, mix: true });
  }

  // ================= Flying Comma =================
  function startCommaRound(items, { badgeKey, level, van = false, mix = false }) {
    clear(root);
    if (!items.length) return startCard();
    let idx = 0, wrong = 0, hintsUsed = 0, phase = 'flick';
    shell = createGameShell({
      title: 'Flying Comma', rounds: items.length, accent: 'var(--star)',
      onHelp: () => replayIntro('apostrophepatrol'),
      onBack: () => { tts.cancel(); ctx.go('hub'); },
      onHint: () => useHint()
    });
    root.appendChild(shell.root);
    const guide = getState().guide;
    const stage = el('div', { class: 'ap-stage' });
    shell.area.appendChild(stage);
    const collector = createTrickyCollector(shell.area);

    renderItem();
    function cur() { return items[idx]; }

    function renderItem() {
      phase = 'flick';
      clear(stage);
      const item = cur();
      const sign = item.kind === 'possession'
        ? item.sentence.replace('___', item.word).toUpperCase()
        : item.sentence.toUpperCase();
      const track = el('div', { class: 'ap-track' + (van && !REDUCED ? ' driving' : '') });
      const signEl = el('div', { class: 'ap-sign', text: sign });
      track.appendChild(signEl);
      const badge = item.kind === 'possession'
        ? el('div', { class: 'ap-owner', html: ownerDots(item.many) + `<span class="ap-owner-line">${item.count}</span>` })
        : el('div', { class: 'ap-owner', html: `<span class="ap-owner-line">Whose is it?</span>` });
      const options = el('div', { class: 'ap-options' });
      const bWord = item.kind === 'possession' ? item.word : item.word;
      const beforeForm = bWord + "'s", afterForm = bWord + "'";
      options.append(
        el('button', { class: 'btn ap-slot', dataset: { slot: 'before' }, text: beforeForm, onclick: () => flick('before') }),
        el('button', { class: 'btn ap-slot', dataset: { slot: 'after' }, text: afterForm, onclick: () => flick('after') })
      );
      if (van) options.appendChild(el('button', { class: 'btn ap-slot ap-none', dataset: { slot: 'none' }, text: 'No comma needed', onclick: () => flick('none') }));
      stage.append(badge, track, options);
      shell.setProgress(idx);
      if (van && !REDUCED) {
        const dur = Math.max(3, Math.round(360 / VAN_PX_S));
        track.style.setProperty('--van-dur', dur + 's');
      }
      speakMaybe(item.kind === 'possession' ? `${item.count}. ${sign}.` : sign);
    }

    function correctSlot(item) {
      if (item.kind === 'decoy') return 'none';
      return item.form;   // 'before' | 'after'
    }

    function flick(slot) {
      if (phase !== 'flick') return;
      const item = cur();
      const right = slot === correctSlot(item);
      if (right) {
        // Alex, 2026-07-30: a RIGHT flick explains itself too — the mended sentence AND
        // the why, in a panel she reads at her pace, gated by Next (not a 1500ms timer).
        phase = 'done';
        sfx.correct();
        const signEl = stage.querySelector('.ap-sign');
        signEl.classList.add('shine');
        signEl.textContent = (item.kind === 'possession' ? item.sentence.replace('___', item.build) : item.sentence).toUpperCase();
        recordResult('apostrophepatrol:' + item.id, true);
        if (!REDUCED) { const r = signEl.getBoundingClientRect(); sparkleAt(r.left + r.width / 2, r.top + r.height / 2); }
        stage.appendChild(explainPanel(commaRightLine(item), () => {
          shell.advance();
          idx++;
          if (idx >= items.length) finish(); else renderItem();
        }, { correct: true }));
      } else {
        // A wrong flick locks the slots behind "Got it ›" so the explanation is read, not
        // tapped past — the brute-force route through two or three buttons taught nothing.
        phase = 'explain';
        wrong++;
        shell.dimHeart();
        sfx.oops();
        const btn = stage.querySelector(`.ap-slot[data-slot="${slot}"]`);
        if (btn) { btn.classList.remove('boing'); void btn.offsetWidth; btn.classList.add('boing'); }
        recordResult('apostrophepatrol:' + item.id, false);
        collector.addAttempted(commaMiss(item));
        const slots = [...stage.querySelectorAll('.ap-slot')];
        slots.forEach(b => b.disabled = true);
        const panel = explainPanel(commaWhyLine(item), () => {
          panel.remove();
          slots.forEach(b => b.disabled = false);
          phase = 'flick';
        }, { label: 'Got it ›' });
        stage.appendChild(panel);
      }
    }

    function useHint() {
      if (hintsUsed >= 2 || phase !== 'flick') return;
      hintsUsed++;
      if (hintsUsed >= 2) shell.enableHint(false);
      const item = cur();
      const line = item.kind === 'decoy' ? `${capitalize(item.word)} already owns it!` : `${item.count}. Think about how many.`;
      shell.react(line, { voice: false, hold: 2000 });
      speakMaybe(line);
    }

    function finish() {
      tts.cancel();
      shell.cleanup();
      const stars = (hintsUsed === 0 && wrong <= 1) ? 3 : (wrong <= 3 ? 2 : 1);
      recordBest('apostrophepatrol', badgeKey, stars);
      ctx.go('results', {
        game: 'apostrophepatrol', gameName: mix ? 'Smart Mix' : 'Flying Comma', stars, level,
        cat: mix ? null : badgeKey, mix, tricky: collector.items(),
        replay: () => ctx.go('apostrophepatrol')
      });
    }

    if (typeof window !== 'undefined') window.__aphub = { comma: {
      state: () => ({ idx, wrong, hintsUsed, total: items.length, phase }),
      item: () => ({ ...cur() }),
      flickCorrect: () => flick(correctSlot(cur())),
      flickWrong: () => { const wrongOpts = ['before', 'after', 'none'].filter(o => o !== correctSlot(cur()) && (o !== 'none' || van)); flick(wrongOpts[0]); },
      tapNext: () => { const b = stage.querySelector('.explain-next'); if (b) b.click(); },
      hint: () => useHint(),
      collected: () => collector.items().length
    } };
  }

  // ================= The Squeeze Machine =================
  function startSqueezeRound(items, { badgeKey }) {
    clear(root);
    if (!items.length) return startCard();
    let idx = 0, wrong = 0, hintsUsed = 0, phase = 'wait-a', tappedA = false;
    shell = createGameShell({
      title: 'The Squeeze Machine', rounds: items.length, accent: 'var(--zing)',
      onHelp: () => replayIntro('apostrophepatrol'),
      onBack: () => { tts.cancel(); ctx.go('hub'); },
      onHint: () => useHint()
    });
    root.appendChild(shell.root);
    const guide = getState().guide;
    const stage = el('div', { class: 'ap-stage sq' });
    shell.area.appendChild(stage);
    const collector = createTrickyCollector(shell.area);

    renderItem();
    function cur() { return items[idx]; }

    function renderItem() {
      phase = 'wait-a'; tappedA = false;
      clear(stage);
      const item = cur();
      const rail = el('div', { class: 'ap-sq-rail' }, [
        el('div', { class: 'sq-guide', html: renderGuide(guide, { view: 'head', size: 60 }) }),
        el('div', { class: 'ap-sq-prompt', text: `Squeeze "${item.a}" and "${item.b}" together!` })
      ]);
      const tiles = el('div', { class: 'ap-sq-tiles' }, [
        el('button', { class: 'btn ap-sq-tile', text: item.a, onclick: () => tapWord('a') }),
        el('span', { class: 'ap-sq-plus', text: '+' }),
        el('button', { class: 'btn ap-sq-tile', text: item.b, onclick: () => tapWord('b') })
      ]);
      const result = el('div', { class: 'ap-sq-result' });
      stage.append(rail, tiles, result);
      shell.setProgress(idx);
      speakMaybe(`${item.a} and ${item.b}.`);
    }

    function tapWord(which) {
      if (phase === 'wait-a' && which === 'a') { tappedA = true; phase = 'wait-b'; stage.querySelector('.ap-sq-tiles').children[0].classList.add('held'); sfx.tap(); return; }
      if (phase === 'wait-b' && which === 'b') { squeeze(); return; }
      // wrong order: nothing budges, no penalty
      shell.react(`Try ${cur().a} first!`, { voice: false, hold: 1400 });
    }

    function squeeze() {
      phase = 'squeezing';
      const item = cur();
      const tilesEl = stage.querySelector('.ap-sq-tiles');
      tilesEl.classList.add('squeezing');
      sfx.tap();
      shell.timeout(() => {
        const resultEl = stage.querySelector('.ap-sq-result');
        resultEl.textContent = item.build;
        resultEl.classList.add('pop');
        sfx.star();
        recordResult('apostrophepatrol:sq:' + item.id, true);
        // Alex, 2026-07-30: the squeeze explains itself in a panel behind Next — what
        // popped out and why the apostrophe stands there — not a vanishing toast.
        stage.appendChild(explainPanel(squeezeRightLine(item), () => {
          shell.advance();
          idx++;
          if (idx >= items.length) finish(); else renderItem();
        }, { correct: true }));
      }, REDUCED ? 150 : 400);
    }

    function useHint() {
      if (hintsUsed >= 2) return;
      hintsUsed++;
      if (hintsUsed >= 2) shell.enableHint(false);
      shell.react(`${cur().a}, then ${cur().b} — squeeze them together!`, { voice: false, hold: 2000 });
    }

    function finish() {
      tts.cancel();
      shell.cleanup();
      const stars = (hintsUsed === 0) ? 3 : 2;
      recordBest('apostrophepatrol', badgeKey, stars);
      ctx.go('results', {
        game: 'apostrophepatrol', gameName: 'The Squeeze Machine', stars, level: 1,
        cat: badgeKey, mix: false, tricky: collector.items(),
        replay: () => ctx.go('apostrophepatrol')
      });
    }

    if (typeof window !== 'undefined') window.__aphub = window.__aphub || {};
    if (typeof window !== 'undefined') window.__aphub.squeeze = {
      state: () => ({ idx, wrong, hintsUsed, total: items.length, phase }),
      item: () => ({ ...cur() }),
      tapA: () => tapWord('a'), tapB: () => tapWord('b'),
      tapNext: () => { const b = stage.querySelector('.explain-next'); if (b) b.click(); },
      hint: () => useHint(),
      collected: () => collector.items().length
    };
  }

  return { unmount() { if (shell) shell.cleanup(); tts.cancel(); } };
}

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
function ownerDots(many) {
  const n = many ? 3 : 1;
  let out = '<span class="ap-dots">';
  for (let i = 0; i < n; i++) out += '<i class="ap-dot"></i>';
  return out + '</span>';
}
function commaMiss(item) {
  const answer = item.kind === 'decoy' ? 'none' : item.form;
  const options = item.kind === 'decoy' ? ['before', 'after', 'none'] : ['before', 'after'];
  return {
    ...choiceMiss({ id: 'apostrophepatrol:' + item.id, game: 'apostrophepatrol', prompt: item.sentence, options, answer }),
    say: item.sentence
  };
}
