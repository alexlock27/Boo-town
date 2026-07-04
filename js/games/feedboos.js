// js/games/feedboos.js — Game 2: Feed the Boos (sorting & reasoning, spec §7).

import { el, clear, starsRow, wobble } from '../ui.js';
import { getState, recordResult, ledgerClass } from '../state.js';
import { createGameShell } from '../gameshell.js';
import { renderGuide, renderBoo } from '../art.js';
import { guideLine } from '../guide.js';
import { sfx, music } from '../sfx.js';
import { TEMPLATES } from '../../data/sorting.js';
import { TEMPLATES_EXTRA } from '../../data/sortingExtra.js';
import { buildPicker, recordBest, MIX_KEY } from '../picker.js';
import { createTrickyCollector, choiceMiss } from '../trickypile.js';

const MAX_HINTS = 2;
const rand = (n) => (Math.random() * n) | 0;
const starsFor = (wrong, hints) => (hints === 0 && wrong <= 1) ? 3 : (wrong <= 3 ? 2 : 1);

// English templates (EXPANSION_1 §3.2) are "Words"; everything else is "Maths".
const WORD_TEMPLATE_IDS = new Set(['nounVerbAdjective', 'pluralRules', 'theirThereTheyre', 'toTooTwo']);
const ALL_TEMPLATES = [...TEMPLATES, ...TEMPLATES_EXTRA];
function subjectOf(t) { return WORD_TEMPLATE_IDS.has(t.id) ? 'words' : 'maths'; }
function levelsForSubject(subject) {
  const set = new Set(ALL_TEMPLATES.filter(t => subjectOf(t) === subject).map(t => t.level));
  return [...set].sort();
}
function pickTemplateFor(subject, level) {
  const pool = ALL_TEMPLATES.filter(t => t.level === level && subjectOf(t) === subject);
  return pool[rand(pool.length)];
}
// Smart Mix: pick a template from ALL installed content, preferring weak (recently missed),
// then not-yet-mastered, then any. Feed the Boos is template-shaped, so the mix is per template.
function pickMixTemplate() {
  const weak = ALL_TEMPLATES.filter(t => ledgerClass('feed:' + t.id) === 'weak');
  const fresh = ALL_TEMPLATES.filter(t => ledgerClass('feed:' + t.id) === 'middle');
  const pool = weak.length ? weak : fresh.length ? fresh : ALL_TEMPLATES;
  return pool[rand(pool.length)];
}
function itemLabel(item) {
  if (item.kind === 'num') return String(item.value);
  if (item.kind === 'frac') return item.num + '/' + item.den;
  if (item.kind === 'unit') return item.caption;
  if (item.kind === 'shape') return item.name;
  if (item.kind === 'letter') return item.ch;
  if (item.kind === 'angle') return item.deg + '°';
  if (item.kind === 'text') return item.text;
  return 'this one';
}

// distinct feeder Boo looks (cute, varied) assigned by index
const FEEDERS = [
  { species: 'munch', colors: { body: 'teal' } },
  { species: 'bloop', colors: { body: 'bubblegum' } },
  { species: 'pip',   colors: { body: 'lilac' } }
];

export function mount(container, params, ctx) {
  const root = el('div', { class: 'screen feedboos' });
  container.appendChild(root);
  let shell = null;

  startCard();

  function startCard() {
    clear(root);
    music.play('game');
    const card = el('div', { class: 'start-card card' }, [
      el('div', { class: 'sc-guide', html: renderGuide(getState().guide, { view: 'head', size: 100 }) }),
      el('h2', { text: 'Feed the Boos' }),
      el('p', { class: 'sc-intro', text: guideLine('gameIntroFeed') })
    ]);
    const picker = buildPicker({
      game: 'feedboos',
      choices: [{ key: 'maths', name: '🔢 Maths' }, { key: 'words', name: '🔤 Words' }],
      levelsFor: levelsForSubject,
      levelName: (l) => 'Level ' + l,
      onStart: (subject, level) => play(subject, level)
    });
    card.appendChild(picker.node);
    card.appendChild(el('div', { class: 'star-rule' }, [
      el('div', { html: starsRow(3, { size: 24 }) }),
      el('p', { text: 'Three stars: at most one wrong feed, and no hints.' })
    ]));
    root.appendChild(card);
  }

  function play(subject, level) {
    clear(root);
    const mix = subject === MIX_KEY;
    const template = mix ? pickMixTemplate() : pickTemplateFor(subject, level);
    const roundData = template.make();
    const items = roundData.items;
    const buckets = roundData.buckets;
    const ledgerId = 'feed:' + template.id;

    let idx = 0, wrongDrops = 0, hintsUsed = 0, missesThisItem = 0, locked = false;

    shell = createGameShell({
      title: mix ? 'Smart Mix' : 'Feed the Boos', rounds: roundData.length, accent: 'var(--zing)',
      onBack: () => ctx.go('hub'),
      onHint: manualHint
    });
    root.appendChild(shell.root);
    const collector = createTrickyCollector(shell.area);

    // feeders row
    const feedersWrap = el('div', { class: 'feeders' });
    const feederEls = buckets.map((label, i) => {
      const look = FEEDERS[i % FEEDERS.length];
      const boo = el('div', { class: 'feeder-boo', html: renderBoo({ ...look, name: label }, { size: 120, cls: 'art-idle' }) });
      const sign = el('div', { class: 'signpost', text: label });
      const zone = el('div', { class: 'feeder', dataset: { bucket: String(i) } }, [boo, sign]);
      return zone;
    });
    feederEls.forEach(f => feedersWrap.appendChild(f));

    const tray = el('div', { class: 'food-tray' });
    const queueTag = el('div', { class: 'queue-tag' });

    shell.area.append(feedersWrap, tray, queueTag);
    showItem();

    function showItem() {
      clear(tray);
      missesThisItem = 0;
      if (idx >= items.length) return finish();
      queueTag.textContent = `${items.length - idx} to go`;
      const item = items[idx];
      const food = el('div', { class: 'food-item', html: foodHTML(item), 'aria-label': 'food to feed a Boo', dataset: { bucket: String(item.bucket) } });
      tray.appendChild(food);
      attachDrag(food, item);
    }

    function attachDrag(food, item) {
      let dragging = false, ox = 0, oy = 0, startRect = null;
      food.addEventListener('pointerdown', e => {
        if (locked) return;
        dragging = true;
        food.setPointerCapture(e.pointerId);
        startRect = food.getBoundingClientRect();
        ox = e.clientX - (startRect.left + startRect.width / 2);
        oy = e.clientY - (startRect.top + startRect.height / 2);
        food.classList.add('dragging');
      });
      food.addEventListener('pointermove', e => {
        if (!dragging) return;
        const parent = tray.getBoundingClientRect();
        const x = e.clientX - ox - (parent.left + parent.width / 2);
        const y = e.clientY - oy - (parent.top + parent.height / 2);
        food.style.transform = `translate(${x}px, ${y}px) scale(1.05)`;
        highlight(e.clientX, e.clientY);
      });
      food.addEventListener('pointerup', e => {
        if (!dragging) return;
        dragging = false;
        food.classList.remove('dragging');
        clearHighlight();
        const target = feederUnder(e.clientX, e.clientY);
        if (target == null) { snapBack(food); return; }
        if (target === item.bucket) onCorrect(food, item, target);
        else onWrong(food, item, target);
      });
      food.addEventListener('pointercancel', () => { dragging = false; snapBack(food); clearHighlight(); });
    }

    function highlight(x, y) {
      const item = items[idx];
      feederEls.forEach(f => {
        const b = Number(f.dataset.bucket);
        const over = hitTest(f, x, y);
        f.classList.toggle('valid-glow', over && b === item.bucket);
        f.classList.toggle('over', over);
      });
    }
    function clearHighlight() { feederEls.forEach(f => f.classList.remove('valid-glow', 'over')); }

    function feederUnder(x, y) {
      for (const f of feederEls) if (hitTest(f, x, y)) return Number(f.dataset.bucket);
      return null;
    }
    function hitTest(node, x, y) {
      const r = node.getBoundingClientRect();
      const pad = 24; // generous drop zone
      return x >= r.left - pad && x <= r.right + pad && y >= r.top - pad && y <= r.bottom + pad;
    }

    function snapBack(food) { food.style.transform = ''; }

    function onCorrect(food, item, bucket) {
      locked = true;
      sfx.correct();
      recordResult(ledgerId, true);
      const fz = feederEls[bucket];
      fz.classList.add('nom');
      food.classList.add('eaten');
      setTimeout(() => fz.classList.remove('nom'), 500);
      setTimeout(() => { idx++; shell.advance(); locked = false; showItem(); }, 360);
    }

    function onWrong(food, item, bucket) {
      wrongDrops++; missesThisItem++;
      sfx.oops();
      recordResult(ledgerId, false);
      if (missesThisItem === 1) collector.add(choiceMiss({ id: ledgerId + ':' + idx, game: 'feedboos', prompt: `Where does ${itemLabel(item)} go?`, options: buckets, answer: buckets[item.bucket] }));
      const fz = feederEls[bucket];
      fz.classList.add('raspberry');
      setTimeout(() => fz.classList.remove('raspberry'), 500);
      wobble(food);
      snapBack(food);
      shell.dimHeart();
      if (missesThisItem >= 2) { autoHint(item); }
    }

    function autoHint(item) {
      hintsUsed = Math.max(hintsUsed, 1);
      shell.react(roundData.hintFor(item), { hold: 3600 });
    }
    function manualHint() {
      if (hintsUsed >= MAX_HINTS) return;
      hintsUsed++;
      shell.react(roundData.hintFor(items[idx]), { hold: 3600 });
      if (hintsUsed >= MAX_HINTS) shell.enableHint(false);
    }

    function finish() {
      shell.cleanup();
      const stars = starsFor(wrongDrops, hintsUsed);
      recordBest('feedboos', mix ? MIX_KEY : subject, stars);
      ctx.go('results', { game: 'feedboos', gameName: mix ? 'Smart Mix' : 'Feed the Boos', stars, level, tricky: collector.items(), replay: () => ctx.go('feedboos') });
    }
  }

  return { unmount() { if (shell) shell.cleanup(); } };
}

// ---- food rendering by kind ----
function foodHTML(item) {
  if (item.kind === 'num') return `<span class="food-num">${item.value}</span>`;
  if (item.kind === 'frac') return `<span class="food-frac"><span class="fr-num">${item.num}</span><span class="fr-bar"></span><span class="fr-den">${item.den}</span></span>`;
  if (item.kind === 'unit') return `<span class="food-unit"><span class="fu-emoji">${item.emoji}</span><span class="fu-cap">${item.caption}</span></span>`;
  if (item.kind === 'shape') return `<span class="food-shape">${polygonSVG(item.sides)}<span class="fs-name">${item.name}</span></span>`;
  if (item.kind === 'letter') return `<span class="food-letter">${item.ch}</span>`;
  if (item.kind === 'angle') return `<span class="food-angle">${angleSVG(item.deg)}</span>`;
  if (item.kind === 'text') return `<span class="food-text${item.text.length > 14 ? ' long' : ''}">${escapeText(item.text)}</span>`;
  return '';
}

function escapeText(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

// A little angle icon: two arms from a vertex, with a corner marker.
function angleSVG(deg) {
  const cx = 12, cy = 52, len = 46;
  const a2 = -deg * Math.PI / 180;   // second arm rotated up by `deg` from the horizontal arm
  const x1 = cx + len, y1 = cy;
  const x2 = cx + len * Math.cos(a2), y2 = cy + len * Math.sin(a2);
  const right = Math.abs(deg - 90) < 0.5
    ? `<rect x="${cx + 2}" y="${cy - 12}" width="10" height="10" fill="none" stroke="var(--ink)" stroke-width="2"/>`
    : `<path d="M${cx + 14} ${cy} A 14 14 0 0 0 ${cx + 14 * Math.cos(a2)} ${cy + 14 * Math.sin(a2)}" fill="none" stroke="var(--ink)" stroke-width="2"/>`;
  return `<svg viewBox="0 0 66 66" width="60" height="60">` +
    `<line x1="${cx}" y1="${cy}" x2="${x1}" y2="${y1}" stroke="var(--pop)" stroke-width="5" stroke-linecap="round"/>` +
    `<line x1="${cx}" y1="${cy}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="var(--pop)" stroke-width="5" stroke-linecap="round"/>` +
    right + `<circle cx="${cx}" cy="${cy}" r="3" fill="var(--ink)"/></svg>`;
}

function polygonSVG(sides) {
  const cx = 34, cy = 34, r = 26;
  let pts = '';
  const rot = sides % 2 ? -90 : -90 + 180 / sides;
  for (let i = 0; i < sides; i++) {
    const a = (rot + i * 360 / sides) * Math.PI / 180;
    pts += `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)} `;
  }
  return `<svg viewBox="0 0 68 68" width="60" height="60"><polygon points="${pts.trim()}" fill="var(--pop)" stroke="var(--ink)" stroke-width="3.5" stroke-linejoin="round"/></svg>`;
}
