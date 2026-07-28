// js/games/feedboos.js — Game 2: Feed the Boos (sorting & reasoning, spec §7).

import { el, clear, starsRow, wobble, backControl, REDUCED } from '../ui.js';
import { getState, recordResult, ledgerClass } from '../state.js';
import { createGameShell } from '../gameshell.js';
import { renderGuide, renderBoo } from '../art.js';
import { guideLine } from '../guide.js';
import { sfx, music } from '../sfx.js';
import { TEMPLATES } from '../../data/sorting.js';
import { TEMPLATES_EXTRA } from '../../data/sortingExtra.js';
import { buildPicker, recordBest, MIX_KEY } from '../picker.js';
import { createTrickyCollector, choiceMiss } from '../trickypile.js';
import { contentTier, filterLevels, FEED_GROUPS, feedGroupOf } from '../content.js';
import { maybeIntro, replayIntro } from '../intro.js';
import { nameWithValue, readAloudButton, readAloudOn } from '../a11y.js';

const MAX_HINTS = 2;
const rand = (n) => (Math.random() * n) | 0;
const starsFor = (wrong, hints) => (hints === 0 && wrong <= 1) ? 3 : (wrong <= 3 ? 2 : 1);
// Juice pass (RUN6 C5)
const NOM_STREAK = 4;          // a run of this many happy noms sets both Boos drumming the table
const NOM_ARC_MS = 380;        // a fed item arcs into the mouth over this long
// RUN18B Y5 — the Boo EATS it. Every number below is the pack's.
const CHOMP_FLY_PX = 80;       // the last stretch into the mouth...
const CHOMP_FLY_MS = 180;      // ...takes this long, whatever the arc before it did
const CHOMP_GULP_MS = 160;     // the item scales to nothing INSIDE the mouth
const CHEEK_PUFF_MS = 200;
const HAPPY_BOUNCE_MS = 250;   // translateY -8px, in css
const RULE_SHIFT_AT = [5, 9];  // the 5th and 9th items: the rule moves under her
const RULE_PULSE_MS = 400;

// English templates (EXPANSION_1 §3.2) are "Words"; everything else is "Maths".
const WORD_TEMPLATE_IDS = new Set(['nounVerbAdjective', 'pluralRules', 'theirThereTheyre', 'toTooTwo']);
const ALL_TEMPLATES = [...TEMPLATES, ...TEMPLATES_EXTRA];
function subjectOf(t) { return WORD_TEMPLATE_IDS.has(t.id) ? 'words' : 'maths'; }
// A friendly display name for a template id (Full tier lists every template).
const FEED_NAME_OVERRIDES = { oddEven: 'Odd & even', compare50: 'More or less than 50', compare500: 'More or less than 500', compare5000: 'More or less than 5000', round10: 'Round to 10', round100: 'Round to 100', halfEquivalent: 'Equal to a half?', fractionSize: 'Fraction sizes', shapeSides: 'Shape sides', units1: 'Measure units', units2: 'Measure units 2', nounVerbAdjective: 'Nouns, verbs, adjectives', pluralRules: 'Plural rules', theirThereTheyre: 'their / there / they\'re', toTooTwo: 'to / too / two', tableMemberY4: 'Times tables (Y4)', twoRule: 'Two rules at once' };
function prettyTemplateName(id) { if (FEED_NAME_OVERRIDES[id]) return FEED_NAME_OVERRIDES[id]; return id.replace(/([a-z])([A-Z0-9])/g, '$1 $2').replace(/^./, c => c.toUpperCase()); }
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

  // Jump back in / level-up (RUN5 C0b).
  const rz = params && params.resume;
  if (rz) { rz.mix ? startFromChoice(MIX_KEY, null) : startFromChoice(rz.cat, rz.level); }
  else startCard();
  maybeIntro('feedboos');   // first-ever open: the guided intro (RUN5 C5)

  function startCard() {
    clear(root);
    music.play('game');
    const card = el('div', { class: 'start-card card' }, [
      el('div', { class: 'sc-guide', html: renderGuide(getState().guide, { view: 'head', size: 100 }) }),
      el('h2', { text: 'Feed the Boos' }),
      el('p', { class: 'sc-intro', text: guideLine('gameIntroFeed') })
    ]);
    // Content tier shapes the choices: Light = Subject; Medium = grouped topics; Full = every template.
    const tier = contentTier();
    let choices, levelsFor;
    if (tier === 'light') {
      choices = [
        { key: 'maths', name: '🔢 Maths', sub: '47 — odd or even?' },
        { key: 'words', name: '🔤 Words', sub: 'their / there' }
      ];
      levelsFor = (subject) => filterLevels(levelsForSubject(subject));
    } else if (tier === 'medium') {
      choices = FEED_GROUPS.filter(g => ALL_TEMPLATES.some(t => feedGroupOf(t.id) === g.key)).map(g => ({ key: 'g:' + g.key, name: g.name, sub: g.sample }));
      levelsFor = (gk) => [...new Set(ALL_TEMPLATES.filter(t => feedGroupOf(t.id) === gk.slice(2)).map(t => t.level))].sort();
    } else {
      choices = ALL_TEMPLATES.map(t => ({ key: 't:' + t.id, name: prettyTemplateName(t.id) }));
      levelsFor = (tk) => { const t = ALL_TEMPLATES.find(x => x.id === tk.slice(2)); return t ? [t.level] : [1]; };
    }
    const picker = buildPicker({
      game: 'feedboos', choices, levelsFor, levelName: (l) => 'Level ' + l,
      onStart: (key, level) => startFromChoice(key, level)
    });
    card.appendChild(picker.node);
    card.appendChild(el('div', { class: 'star-rule' }, [
      el('div', { html: starsRow(3, { size: 24 }) }),
      el('p', { text: 'Three stars: at most one wrong feed, and no hints.' })
    ]));
    root.appendChild(card);
    root.appendChild(backControl(() => ctx.go('hub'), { floating: true }));   // shared back (job 3)
  }

  // Dispatch a picker choice (Smart Mix / subject / group / template) to a concrete template.
  function startFromChoice(key, level) {
    if (key === MIX_KEY) return play(pickMixTemplate(), { mix: true, badgeKey: MIX_KEY });
    if (key === 'maths' || key === 'words') return play(pickTemplateFor(key, level), { badgeKey: key });
    if (key.startsWith('g:')) { const gk = key.slice(2); const pool = ALL_TEMPLATES.filter(t => feedGroupOf(t.id) === gk && t.level === level); return play((pool.length ? pool : ALL_TEMPLATES.filter(t => feedGroupOf(t.id) === gk))[rand(Math.max(1, pool.length))] || ALL_TEMPLATES[0], { badgeKey: key }); }
    if (key.startsWith('t:')) { const t = ALL_TEMPLATES.find(x => x.id === key.slice(2)); return play(t || ALL_TEMPLATES[0], { badgeKey: key }); }
    return play(pickTemplateFor('maths', level || 1), { badgeKey: 'maths' });
  }

  function play(template, { mix = false, badgeKey } = {}) {
    clear(root);
    const roundData = template.make();
    const items = roundData.items;
    const buckets = roundData.buckets;
    const ledgerId = 'feed:' + template.id;

    let idx = 0, wrongDrops = 0, hintsUsed = 0, missesThisItem = 0, locked = false, nomStreak = 0;

    shell = createGameShell({
      title: mix ? 'Smart Mix' : 'Feed the Boos', rounds: roundData.length, accent: 'var(--zing)',
      onHelp: () => replayIntro('feedboos'),
      bank: () => ({ correct: idx, of: roundData.length }),
      onBack: (b) => { if (b && b.stars > 0) ctx.go('results', { game: 'feedboos', gameName: mix ? 'Smart Mix' : 'Feed the Boos', stars: b.stars, level: template.level, cat: mix ? null : (badgeKey || 'maths'), mix, tricky: collector.items(), partial: b, replay: () => ctx.go('feedboos') }); else ctx.go('hub'); },
      onHint: manualHint
    });
    root.appendChild(shell.root);
    const collector = createTrickyCollector(shell.area);

    // feeders row
    const feedersWrap = el('div', { class: 'feeders' });
    let bucketLabels = buckets.slice();
    const feederEls = bucketLabels.map((label, i) => {
      const look = FEEDERS[i % FEEDERS.length];
      const boo = el('div', { class: 'feeder-boo feed-chew', html: booArt(look, label, 'closed') });
      const sign = el('div', { class: 'signpost', text: label });
      const zone = el('div', { class: 'feeder', dataset: { bucket: String(i) } }, [boo, sign]);
      zone._look = look;
      return zone;
    });
    feederEls.forEach(f => feedersWrap.appendChild(f));
    // The mouth is drawn by art.js, so an open mouth is a re-render of that Boo, not a
    // second sprite that could drift from it.
    function booArt(look, label, mouthState) {
      return renderBoo({ ...look, name: label, mouth: mouthState }, { size: 120, cls: 'art-idle' });
    }
    function setMouth(fz, mouthState) {
      const boo = fz.querySelector('.feeder-boo');
      boo.innerHTML = booArt(fz._look, bucketLabels[Number(fz.dataset.bucket)], mouthState);
      fz.dataset.mouth = mouthState;
    }

    // The rule card: a round whose rule can MOVE (compare) or has two halves (twoRule) says
    // so out loud, in one place, and that place is what pulses when the rule changes.
    const ruleCard = el('div', { class: 'feed-rule', role: 'status' });
    if (roundData.rule) ruleCard.textContent = roundData.rule; else ruleCard.hidden = true;

    const tray = el('div', { class: 'food-tray' });
    const queueTag = el('div', { class: 'queue-tag' });

    let shiftsDone = 0;
    shell.area.append(ruleCard, feedersWrap, tray, queueTag);
    if (roundData.predicates && roundData.predicates.length === 2) {
      // level 3: the two-part rule is spoken as written before the first item
      shell.react(roundData.rule, { hold: 3200 });
    }
    showItem();

    function maybeShiftRule() {
      const plan = roundData.shifts;
      if (!plan || shiftsDone >= plan.length) return;
      if (!RULE_SHIFT_AT.includes(idx + 1)) return;
      const shift = plan[shiftsDone++];
      bucketLabels = shift.buckets.slice();
      feederEls.forEach((f, i) => {
        f.querySelector('.signpost').textContent = bucketLabels[i];
        setMouth(f, 'closed');
      });
      for (let i = idx; i < items.length; i++) items[i].bucket = shift.rebucket(items[i]);
      if (shift.hintFor) roundData.hintFor = shift.hintFor;
      ruleCard.hidden = false;
      ruleCard.textContent = shift.rule;
      ruleCard.classList.remove('pulse'); void ruleCard.offsetWidth; ruleCard.classList.add('pulse');
      shell.timeout(() => ruleCard.classList.remove('pulse'), RULE_PULSE_MS);
      shell.react(shift.rule, { hold: 3000 });   // spoken and shown
    }

    function showItem() {
      clear(tray);
      missesThisItem = 0;
      if (idx >= items.length) return finish();
      maybeShiftRule();
      queueTag.textContent = `${items.length - idx} to go`;
      const item = items[idx];
      // RUN12 S13.4: the draggable says what it is, not just that it is food
      const food = el('div', { class: 'food-item', html: foodHTML(item), role: 'img',
        'aria-label': nameWithValue('food', itemLabel(item)), dataset: { bucket: String(item.bucket) } });
      tray.appendChild(food);
      attachDrag(food, item);
    }

    function attachDrag(food, item) {
      let dragging = false, ox = 0, oy = 0, startRect = null, scale = 1;
      food.addEventListener('pointerdown', e => {
        if (locked) return;
        dragging = true;
        food.setPointerCapture(e.pointerId);
        startRect = food.getBoundingClientRect();
        ox = e.clientX - (startRect.left + startRect.width / 2);
        oy = e.clientY - (startRect.top + startRect.height / 2);
        const pt = tray.getBoundingClientRect();
        scale = pt.width / (tray.offsetWidth || 1);
        food.classList.add('dragging');
      });
      food.addEventListener('pointermove', e => {
        if (!dragging) return;
        // Anchored to the food's OWN untransformed centre (captured at pointerdown), not to
        // the tray's centre. The tray stopped centring its child when Y5 pulled the food up
        // under the feeders for the reach rule, and a transform measured from the tray's
        // middle then threw the card ~185px above the finger — off the top edge at 768x1024,
        // so she was dragging nothing. The card must sit under the finger at every layout.
        const x = (e.clientX - ox - (startRect.left + startRect.width / 2)) / scale;
        const y = (e.clientY - oy - (startRect.top + startRect.height / 2)) / scale;
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
      nomStreak++;
      sfx.correct();
      recordResult(ledgerId, true);
      const fz = feederEls[bucket];
      // The whole point of Y5: the food does not vanish into a shrinking sprite beside a
      // Boo that never reacted. It flies in, the mouth OPENS, it is bitten, swallowed,
      // and the Boo is visibly pleased about it.
      flyToMouth(food, fz, () => chomp(food, fz));
    }
    // The last CHOMP_FLY_PX into the mouth take CHOMP_FLY_MS; whatever distance came
    // before that is covered first, at the arc's own speed.
    function flyToMouth(food, feeder, done) {
      // Clear the drag transform BEFORE measuring, and clear it FOR REAL. `.food-item` has a
      // 200ms transform transition, so dropping the inline transform does not move the box
      // synchronously — it starts easing back, and a rect read on the next line is still the
      // DRAGGED rect. That is what made a dragged item vanish at a fixed point on the empty
      // floor: measured at the mouth she had dragged it to, the delta came out as zero, and
      // the reset then teleported it home to fly nowhere. Suppress the transition, flush the
      // layout, then measure the origin the fly classes will actually animate from.
      food.style.transition = 'none';
      food.style.transform = '';
      void food.offsetWidth;
      const fr = food.getBoundingClientRect();
      // ...and aim at the BOO's mouth, not at 0.42 of a zone that also contains a signpost.
      const boo = feeder.querySelector('.feeder-boo') || feeder;
      const tr = boo.getBoundingClientRect();
      const dx = (tr.left + tr.width / 2) - (fr.left + fr.width / 2);
      const dy = (tr.top + tr.height * (96 / 130)) - (fr.top + fr.height / 2);   // mouth y in the Boo viewBox
      food.style.transition = '';                            // the fly classes own it again
      if (REDUCED) { done(); return; }                       // reduced: mouth swap + sfx only
      const d = Math.hypot(dx, dy) || 1;
      const k = Math.max(0, (d - CHOMP_FLY_PX) / d);         // where the final stretch begins
      food.style.setProperty('--x1', (dx * k).toFixed(0) + 'px');
      food.style.setProperty('--y1', (dy * k).toFixed(0) + 'px');
      food.style.setProperty('--x2', dx.toFixed(0) + 'px');
      food.style.setProperty('--y2', dy.toFixed(0) + 'px');
      const t1 = Math.round(NOM_ARC_MS * k);
      food.style.setProperty('--t1', t1 + 'ms');
      food.classList.add('fly-1');
      shell.timeout(() => { food.classList.add('fly-2'); shell.timeout(done, CHOMP_FLY_MS); }, Math.max(16, t1));
    }
    function chomp(food, fz) {
      setMouth(fz, 'open');                                  // mouth opens as it arrives
      sfx.chomp();                                           // CHOMP
      if (REDUCED) {
        food.remove();
        shell.timeout(() => { setMouth(fz, 'closed'); nextItem(); }, CHOMP_GULP_MS);
        return;
      }
      food.classList.add('gulped');                          // scales to 0 INSIDE the mouth
      shell.timeout(() => {
        food.remove();
        setMouth(fz, 'closed');
        fz.classList.add('puff');                            // cheeks puff
        shell.timeout(() => {
          fz.classList.remove('puff');
          fz.classList.add('yum');                           // a happy bounce
          if (nomStreak >= NOM_STREAK) drumTable();
          shell.timeout(() => { fz.classList.remove('yum'); nextItem(); }, HAPPY_BOUNCE_MS);
        }, CHEEK_PUFF_MS);
      }, CHOMP_GULP_MS);
    }
    function nextItem() { idx++; shell.advance(); locked = false; showItem(); }
    function drumTable() {
      feederEls.forEach(f => { f.classList.remove('drum'); void f.offsetWidth; f.classList.add('drum'); setTimeout(() => f.classList.remove('drum'), 1200); });
      shell.react('Drum roll! 🥁', { voice: false, hold: 1200 });
    }

    function onWrong(food, item, bucket) {
      wrongDrops++; missesThisItem++; nomStreak = 0;
      sfx.oops();
      recordResult(ledgerId, false);
      if (missesThisItem === 1) collector.addAttempted(choiceMiss({ id: ledgerId + ':' + idx, game: 'feedboos', prompt: `Where does ${itemLabel(item)} go?`, options: buckets, answer: buckets[item.bucket] }));
      const fz = feederEls[bucket];
      // Y5 authors ONE wrong reaction: the Boo turns its head away. (It replaces the three
      // random ones — and with them a raw 😮‍💨 glyph used as art in a game scene.)
      fz.classList.add('turn-away');
      fz._lastReact = 'turn-away';
      setTimeout(() => fz.classList.remove('turn-away'), 600);
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

    // Test hook (invisible): drive + inspect the juice.
    if (typeof window !== 'undefined') window.__feedboos = {
      state: () => ({ idx, wrongDrops, nomStreak, locked, hearts: shell.heartsLeft() }),
      feedCorrect: () => { const item = items[idx]; const food = tray.querySelector('.food-item'); if (food && !locked) onCorrect(food, item, item.bucket); },
      feedWrong: () => { const item = items[idx]; const food = tray.querySelector('.food-item'); if (food && !locked) onWrong(food, item, (item.bucket + 1) % buckets.length); },
      arcing: () => !!tray.querySelector('.food-item.fly-1,.food-item.fly-2'),
      mouths: () => feederEls.map(f => f.dataset.mouth || 'closed'),
      rule: () => ruleCard.hidden ? null : ruleCard.textContent,
      rulePulsing: () => ruleCard.classList.contains('pulse'),
      shifts: () => shiftsDone,
      buckets: () => bucketLabels.slice(),
      itemBuckets: () => items.map(i => i.bucket),
      puffing: () => feederEls.some(f => f.classList.contains('puff')),
      bouncing: () => feederEls.some(f => f.classList.contains('yum')),
      drumming: () => feederEls.some(f => f.classList.contains('drum')),
      lastReaction: () => { for (const f of feederEls) if (f._lastReact) return f._lastReact; return null; },
      chewing: () => document.querySelectorAll('.feeder-boo.feed-chew').length
    };

    function finish() {
      shell.cleanup();
      const stars = starsFor(wrongDrops, hintsUsed);
      recordBest('feedboos', badgeKey || 'maths', stars);
      ctx.go('results', { game: 'feedboos', gameName: mix ? 'Smart Mix' : 'Feed the Boos', stars, level: template.level, cat: mix ? null : (badgeKey || 'maths'), mix, tricky: collector.items(), replay: () => ctx.go('feedboos') });
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
