// js/hub.js — the home screen (spec §2, §5.2).

import { el, clear, giftSVG, starsRow } from './ui.js';
import { getState, mutate } from './state.js';
import { createGuideBubble, guideLine } from './guide.js';
import { music, sfx } from './sfx.js';
import { meterState, METER_CAP } from './rewards.js';
import { setSoundEnabled, setMusicEnabled, getSoundEnabled } from './sfx.js';
import { questState } from './quests.js';

const GAMES = [
  { id: 'teachme',   name: 'Teach Me',     tag: 'Little lessons', accent: 'var(--zing)', icon: teachIcon, group: 'Learn' },
  { id: 'bubblepop', name: 'Bubble Pop',   tag: 'Times tables',  accent: 'var(--pop)',  icon: bubbleIcon, group: 'Learn' },
  { id: 'feedboos',  name: 'Feed the Boos', tag: 'Number sense',  accent: 'var(--zing)', icon: feedIcon, group: 'Learn' },
  { id: 'spellboo',  name: 'Spell Boo',    tag: 'Spelling',      accent: 'var(--star)', icon: spellIcon, group: 'Learn' },
  { id: 'clockshop', name: 'Clock Shop',   tag: 'Telling time',  accent: 'var(--pop)',  icon: clockIcon, group: 'Learn' },
  { id: 'blocks',    name: 'Boo Blocks',   tag: 'Build & clear', accent: 'var(--zing)', icon: blocksIcon, group: 'Play' },
  { id: 'bounce',    name: 'Boo Bounce',   tag: 'Bounce & break', accent: 'var(--pop)', icon: bounceIcon, group: 'Play' },
  { id: 'beat',      name: 'Boo Beat',     tag: 'Tap to the beat', accent: 'var(--star)', icon: beatIcon, group: 'Play' },
  { id: 'dash',      name: 'Boo Dash',     tag: 'Fluency run',   accent: 'var(--pop)',  icon: dashIcon, group: 'Play' }
];

export function mount(container, params, ctx) {
  const s = getState();
  music.play('calm');

  const root = el('div', { class: 'hub' });
  container.appendChild(root);

  // ---- top bar: speaker + star meter + gift ----
  const speaker = el('button', { class: 'icon-btn speaker', 'aria-label': 'Sound on or off' });
  updateSpeaker();
  speaker.addEventListener('click', () => {
    const anyOn = s.settings.sound || s.settings.music;
    const next = !anyOn;
    mutate(st => { st.settings.sound = next; st.settings.music = next; });
    setSoundEnabled(next); setMusicEnabled(next);
    if (next) music.play('calm');
    updateSpeaker();
  });

  const meterWrap = el('div', { class: 'meter-wrap' });
  const top = el('header', { class: 'hub-top' }, [speaker, meterWrap]);

  // ---- guide + bubble ----
  const gb = createGuideBubble({ view: 'full', size: 150, side: 'left' });
  const guideSection = el('section', { class: 'hub-guide' }, [gb.root]);
  // Long-press the guide to open the character creator (spec RUN2 C1).
  attachLongPress(gb.art, 550, () => { sfx.tap(); ctx.go('editguide', { from: 'hub' }); });
  gb.art.setAttribute('aria-label', 'Your character — press and hold to change');

  // ---- game cards, grouped Learn / Play (RUN2 part D) ----
  const cards = el('section', { class: 'game-cards-groups' });
  const makeCard = (g) => {
    const best = s.stars.byGame[g.id] ? s.stars.byGame[g.id].best : 0;
    return el('button', { class: 'game-card', style: { '--accent': g.accent }, onclick: () => ctx.go(g.id) }, [
      el('div', { class: 'gc-icon', html: g.icon() }),
      el('div', { class: 'gc-name', text: g.name }),
      el('div', { class: 'gc-tag', text: g.tag }),
      el('div', { class: 'gc-stars', html: starsRow(best, { size: 22 }) })
    ]);
  };
  for (const groupName of ['Learn', 'Play']) {
    const row = el('div', { class: 'game-cards' });
    GAMES.filter(g => g.group === groupName).forEach(g => row.appendChild(makeCard(g)));
    cards.append(el('div', { class: 'group-label', text: groupName }), row);
  }

  // ---- bottom bar ----
  const townBtn = el('button', { class: 'bar-btn', onclick: () => ctx.go('town') }, [
    el('span', { class: 'bar-ic', html: '🏡' }), el('span', { text: 'Town' })
  ]);
  const collBtn = el('button', { class: 'bar-btn', onclick: () => ctx.go('collection') }, [
    el('span', { class: 'bar-ic', html: '📖' }), el('span', { text: 'Collection' })
  ]);
  const studioBtn = el('button', { class: 'bar-btn', onclick: () => ctx.go('studio') }, [
    el('span', { class: 'bar-ic', html: '🎨' }), el('span', { text: 'Studio' })
  ]);
  const cog = makeCog(() => ctx.go('grownups'));
  const bar = el('nav', { class: 'bottom-bar' }, [townBtn, collBtn, studioBtn, cog]);

  // ---- Golden Round + daily quests cards (RUN3 C3/C4) ----
  const specials = el('section', { class: 'hub-specials' });

  // Daily quests card with a 0–3 badge (no streaks, no missed-day guilt — rule 1).
  const qs = questState();
  const questCard = el('button', { class: 'quest-card' + (qs.allDone ? ' all-done' : ''), onclick: () => { sfx.tap(); showQuests(); } }, [
    el('span', { class: 'quest-ic', text: '🎯' }),
    el('span', { class: 'quest-body' }, [
      el('span', { class: 'quest-title', text: 'Today\'s quests' }),
      el('span', { class: 'quest-sub', text: qs.allDone ? 'All done — bonus box earned!' : 'Three little things to try' })
    ]),
    el('span', { class: 'quest-badge', text: qs.doneCount + '/3' })
  ]);
  specials.appendChild(questCard);

  function showQuests() {
    const st = questState();
    const ov = el('div', { class: 'overlay quests-overlay', onclick: (e) => { if (e.target === ov) ov.remove(); } });
    const panel = el('div', { class: 'card quests-panel' }, [
      el('h3', { text: `Today's quests · ${st.doneCount}/3` }),
      ...st.items.map(it => el('div', { class: 'quest-row' + (it.done ? ' done' : '') }, [
        el('span', { class: 'qr-ic', text: it.done ? '✅' : it.icon }),
        el('span', { class: 'qr-label', text: it.label }),
        el('span', { class: 'qr-prog', text: it.need > 1 ? `${it.progress}/${it.need}` : (it.done ? '✓' : '') })
      ])),
      el('p', { class: 'quests-note', text: st.allDone ? '🎁 All three done — a bonus box is on your meter!' : 'Do all three for a bonus box. Fresh quests tomorrow!' }),
      el('button', { class: 'btn', text: 'Close', onclick: () => ov.remove() })
    ]);
    ov.appendChild(panel);
    root.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add('show'));
  }

  const g = s.golden;
  if (g && ((g.words || []).length || (g.choices || []).length)) {
    const wc = (g.words || []).length, cc = (g.choices || []).length;
    specials.appendChild(el('button', { class: 'golden-card', onclick: () => { sfx.tap(); ctx.go('golden'); } }, [
      el('span', { class: 'golden-star', text: '⭐' }),
      el('span', { class: 'golden-body' }, [
        el('span', { class: 'golden-title', text: 'Golden Round' }),
        el('span', { class: 'golden-sub', text: `${wc} word${wc === 1 ? '' : 's'}${cc ? ` · ${cc} question${cc === 1 ? '' : 's'}` : ''} · double stars!` })
      ]),
      el('span', { class: 'golden-star', text: '⭐' })
    ]));
  }

  root.append(top, guideSection, specials, cards, bar);

  renderMeter();

  // greeting
  const greetKey = params && params.greeting ? params.greeting : 'welcome';
  gb.say(greetKey);

  // rotate idle / boxReady lines
  const rotate = setInterval(() => {
    const st = getState();
    gb.sayText(st.boxes > 0 ? guideLine('boxReady') : guideLine('idle'), { voice: false });
  }, 7000);

  function renderMeter() {
    clear(meterWrap);
    const { meter, boxes } = meterState();
    const track = el('div', { class: 'meter-track' });
    for (let i = 0; i < METER_CAP; i++) {
      track.appendChild(el('span', { class: 'meter-seg' + (i < meter ? ' on' : '') }));
    }
    const gift = el('button', {
      class: 'gift-btn' + (boxes > 0 ? ' ready' : ''),
      'aria-label': boxes > 0 ? 'Open your box' : 'Star meter',
      html: giftSVG(46),
      onclick: () => { if (getState().boxes > 0) ctx.go('ceremony'); }
    });
    if (boxes > 1) gift.appendChild(el('span', { class: 'box-badge', text: 'x' + boxes }));
    meterWrap.append(track, gift);
  }

  function updateSpeaker() {
    const anyOn = s.settings.sound || s.settings.music;
    speaker.innerHTML = anyOn
      ? '<svg viewBox="0 0 24 24" width="30" height="30"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="var(--card)"/><path d="M16 8c1.5 1.5 1.5 6.5 0 8" stroke="var(--card)" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M18.5 6c3 3 3 9 0 12" stroke="var(--card)" stroke-width="2" fill="none" stroke-linecap="round"/></svg>'
      : '<svg viewBox="0 0 24 24" width="30" height="30"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="var(--card)"/><path d="M16 9l6 6M22 9l-6 6" stroke="var(--card)" stroke-width="2" stroke-linecap="round"/></svg>';
  }

  return {
    unmount() { clearInterval(rotate); }
  };
}

// 3-second press-and-hold cog with a filling progress ring (spec §5.7).
function makeCog(onOpen) {
  const HOLD = 3000;
  const ring = `<svg viewBox="0 0 44 44" width="40" height="40" class="cog-svg">
      <circle cx="22" cy="22" r="19" fill="none" stroke="rgba(255,255,255,0.18)" stroke-width="3"/>
      <circle class="cog-prog" cx="22" cy="22" r="19" fill="none" stroke="var(--star)" stroke-width="3.5"
        stroke-linecap="round" stroke-dasharray="119.4" stroke-dashoffset="119.4" transform="rotate(-90 22 22)"/>
      <g transform="translate(22,22)"><path d="M-2-9h4l1 3 3 1 3-2 3 3-2 3 1 3 3 1v4l-3 1-1 3 2 3-3 3-3-2-3 1-1 3h-4l-1-3-3-1-3 2-3-3 2-3-1-3-3-1v-4l3-1 1-3-2-3 3-3 3 2 3-1z" fill="var(--card)" opacity="0.85"/><circle r="3.2" fill="var(--sky-mid)"/></g>
    </svg>`;
  const btn = el('button', { class: 'bar-btn cog-btn', 'aria-label': 'Grown-ups corner (press and hold)', html: ring });
  const prog = () => btn.querySelector('.cog-prog');
  let raf = null, start = 0, done = false;
  function begin(e) {
    e.preventDefault();
    done = false; start = performance.now();
    step();
  }
  function step() {
    raf = requestAnimationFrame(() => {
      const t = Math.min(1, (performance.now() - start) / HOLD);
      const p = prog();
      if (p) p.setAttribute('stroke-dashoffset', String(119.4 * (1 - t)));
      if (t >= 1 && !done) { done = true; cancel(); onOpen(); }
      else if (!done) step();
    });
  }
  function cancel() {
    if (raf) cancelAnimationFrame(raf); raf = null;
    const p = prog(); if (p) p.setAttribute('stroke-dashoffset', '119.4');
  }
  btn.addEventListener('pointerdown', begin);
  btn.addEventListener('pointerup', cancel);
  btn.addEventListener('pointerleave', cancel);
  btn.addEventListener('pointercancel', cancel);
  return btn;
}

// Fire onHold after `ms` of a steady press; cancel on release or drift.
function attachLongPress(node, ms, onHold) {
  if (!node) return;
  let timer = null, sx = 0, sy = 0;
  const clear = () => { if (timer) { clearTimeout(timer); timer = null; } };
  node.addEventListener('pointerdown', (e) => {
    sx = e.clientX; sy = e.clientY;
    clear();
    timer = setTimeout(() => { timer = null; onHold(); }, ms);
  });
  node.addEventListener('pointermove', (e) => {
    if (timer && Math.hypot(e.clientX - sx, e.clientY - sy) > 12) clear();
  });
  node.addEventListener('pointerup', clear);
  node.addEventListener('pointerleave', clear);
  node.addEventListener('pointercancel', clear);
}

// ---- tiny card icons ----
function bubbleIcon() {
  return `<svg viewBox="0 0 60 60" width="56" height="56"><circle cx="24" cy="30" r="16" fill="var(--pop)" stroke="var(--ink)" stroke-width="3"/><circle cx="42" cy="20" r="9" fill="var(--zing)" stroke="var(--ink)" stroke-width="3"/><text x="24" y="36" font-family="Fredoka,sans-serif" font-size="16" font-weight="700" fill="#fff" text-anchor="middle">7×</text></svg>`;
}
function feedIcon() {
  return `<svg viewBox="0 0 60 60" width="56" height="56"><ellipse cx="30" cy="34" rx="20" ry="18" fill="var(--zing)" stroke="var(--ink)" stroke-width="3"/><circle cx="23" cy="30" r="4" fill="#fff" stroke="var(--ink)" stroke-width="1.5"/><circle cx="37" cy="30" r="4" fill="#fff" stroke="var(--ink)" stroke-width="1.5"/><circle cx="23" cy="31" r="2" fill="var(--ink)"/><circle cx="37" cy="31" r="2" fill="var(--ink)"/><path d="M22 40 Q30 48 38 40 Q30 44 22 40Z" fill="var(--ink)"/><circle cx="14" cy="16" r="6" fill="var(--star)" stroke="var(--ink)" stroke-width="2.5"/></svg>`;
}
function spellIcon() {
  return `<svg viewBox="0 0 60 60" width="56" height="56"><rect x="8" y="20" width="16" height="16" rx="4" fill="var(--pop)" stroke="var(--ink)" stroke-width="3"/><rect x="26" y="20" width="16" height="16" rx="4" fill="var(--star)" stroke="var(--ink)" stroke-width="3"/><rect x="44" y="20" width="10" height="16" rx="4" fill="var(--zing)" stroke="var(--ink)" stroke-width="3"/><text x="16" y="33" font-family="Fredoka,sans-serif" font-size="13" font-weight="700" fill="#fff" text-anchor="middle">A</text><text x="34" y="33" font-family="Fredoka,sans-serif" font-size="13" font-weight="700" fill="#fff" text-anchor="middle">B</text></svg>`;
}
function blocksIcon() {
  return `<svg viewBox="0 0 60 60" width="56" height="56"><rect x="10" y="10" width="16" height="16" rx="3" fill="var(--pop)" stroke="var(--ink)" stroke-width="3"/><rect x="28" y="10" width="16" height="16" rx="3" fill="var(--zing)" stroke="var(--ink)" stroke-width="3"/><rect x="10" y="28" width="16" height="16" rx="3" fill="var(--star)" stroke="var(--ink)" stroke-width="3"/><rect x="28" y="28" width="16" height="16" rx="3" fill="var(--lilac,#C6A9F0)" stroke="var(--ink)" stroke-width="3"/><rect x="37" y="37" width="14" height="14" rx="3" fill="var(--pop)" stroke="var(--ink)" stroke-width="3"/></svg>`;
}
function bounceIcon() {
  return `<svg viewBox="0 0 60 60" width="56" height="56"><rect x="10" y="12" width="12" height="8" rx="2" fill="var(--pop)" stroke="var(--ink)" stroke-width="2.5"/><rect x="24" y="12" width="12" height="8" rx="2" fill="var(--zing)" stroke="var(--ink)" stroke-width="2.5"/><rect x="38" y="12" width="12" height="8" rx="2" fill="var(--star)" stroke="var(--ink)" stroke-width="2.5"/><circle cx="34" cy="36" r="6" fill="var(--card)" stroke="var(--ink)" stroke-width="2.5"/><rect x="20" y="46" width="22" height="6" rx="3" fill="var(--pop)" stroke="var(--ink)" stroke-width="2.5"/></svg>`;
}
function beatIcon() {
  return `<svg viewBox="0 0 60 60" width="56" height="56"><rect x="10" y="10" width="10" height="40" rx="4" fill="var(--pop)" stroke="var(--ink)" stroke-width="2.5"/><rect x="25" y="10" width="10" height="40" rx="4" fill="var(--zing)" stroke="var(--ink)" stroke-width="2.5"/><rect x="40" y="10" width="10" height="40" rx="4" fill="var(--star)" stroke="var(--ink)" stroke-width="2.5"/><circle cx="30" cy="40" r="7" fill="var(--card)" stroke="var(--ink)" stroke-width="3"/><path d="M15 40h30" stroke="#fff" stroke-width="2.5" opacity="0.7"/></svg>`;
}
function teachIcon() {
  return `<svg viewBox="0 0 60 60" width="56" height="56"><path d="M12 18 L30 12 L48 18 L30 24 Z" fill="var(--star)" stroke="var(--ink)" stroke-width="3" stroke-linejoin="round"/><path d="M18 22 L18 36 Q30 44 42 36 L42 22" fill="var(--zing)" stroke="var(--ink)" stroke-width="3" stroke-linejoin="round"/><path d="M48 18 L48 30" stroke="var(--ink)" stroke-width="3" stroke-linecap="round"/><circle cx="48" cy="32" r="3" fill="var(--pop)"/></svg>`;
}
function dashIcon() {
  return `<svg viewBox="0 0 60 60" width="56" height="56"><path d="M8 46 Q30 40 52 46" stroke="var(--ink)" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M16 44 Q16 26 30 26 Q44 26 44 44" fill="none" stroke="var(--star)" stroke-width="4"/><circle cx="30" cy="40" r="9" fill="var(--pop)" stroke="var(--ink)" stroke-width="3"/><circle cx="27" cy="39" r="1.8" fill="#fff"/><circle cx="33" cy="39" r="1.8" fill="#fff"/><path d="M6 20 h10 M4 28 h8" stroke="var(--zing)" stroke-width="3" stroke-linecap="round"/></svg>`;
}
function clockIcon() {
  return `<svg viewBox="0 0 60 60" width="56" height="56"><circle cx="30" cy="30" r="22" fill="var(--card)" stroke="var(--ink)" stroke-width="3"/><circle cx="30" cy="30" r="22" fill="none" stroke="var(--star)" stroke-width="3" opacity="0.5"/><line x1="30" y1="30" x2="30" y2="17" stroke="var(--ink)" stroke-width="3.5" stroke-linecap="round"/><line x1="30" y1="30" x2="40" y2="34" stroke="var(--pop)" stroke-width="3" stroke-linecap="round"/><circle cx="30" cy="30" r="2.5" fill="var(--ink)"/></svg>`;
}
