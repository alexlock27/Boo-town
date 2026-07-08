// js/hub.js — the home screen (spec §2, §5.2).

import { el, clear, giftSVG, starsRow, REDUCED, suppressContextMenu } from './ui.js';
import { getState, mutate } from './state.js';
import { createGuideBubble, guideLine } from './guide.js';
import { music, sfx } from './sfx.js';
import { meterState, METER_CAP } from './rewards.js';
import { setSoundEnabled, setMusicEnabled, getSoundEnabled } from './sfx.js';
import { questState } from './quests.js';
import { checkRequestOpen } from './requests.js';
import { tierForAge, AGE_CHOICES, contentTier } from './content.js';
import { renderGuide } from './art.js';
import { ZONES } from './town.js';
import { retroAwardOnce } from './trophies.js';
import { tickGrowth } from './growth.js';
import { tickFunfair } from './funfair.js';
import { chestState, CHEST_EVERY } from './shiny.js';
import { booOfTheDay } from './delights.js';
import { renderItem } from './art.js';
import { getDisplayName } from './accessories.js';
import { hasUpdateWaiting, onUpdateWaiting, activateUpdate, showToast } from './resilience.js';
import { applyRarityFx } from './rarityfx.js';
import { TODDLER_GAMES } from './toddler.js';
import { speakMaybe } from './guide.js';

// Near-unlock nudge (RUN4 C1): one gentle heads-up when a locked town zone is
// within this many stars, at most once per session (module state resets on load).
const NUDGE_WITHIN = 10;
let nudgedThisSession = false;

const GAMES = [
  { id: 'teachme',   name: 'Teach Me',     tag: 'Little lessons', accent: 'var(--zing)', icon: teachIcon, group: 'Learn' },
  { id: 'bubblepop', name: 'Bubble Pop',   tag: 'Times tables',  accent: 'var(--pop)',  icon: bubbleIcon, group: 'Learn' },
  { id: 'feedboos',  name: 'Feed the Boos', tag: 'Number sense',  accent: 'var(--zing)', icon: feedIcon, group: 'Learn' },
  { id: 'spellboo',  name: 'Spell Boo',    tag: 'Spelling',      accent: 'var(--star)', icon: spellIcon, group: 'Learn' },
  { id: 'clockshop', name: 'Clock Shop',   tag: 'Telling time',  accent: 'var(--pop)',  icon: clockIcon, group: 'Learn' },
  { id: 'blocks',    name: 'Boo Blocks',   tag: 'Build & clear', accent: 'var(--zing)', icon: blocksIcon, group: 'Play' },
  { id: 'bounce',    name: 'Boo Bounce',   tag: 'Bounce & break', accent: 'var(--pop)', icon: bounceIcon, group: 'Play' },
  { id: 'beat',      name: 'Boo Beat',     tag: 'Tap to the beat', accent: 'var(--star)', icon: beatIcon, group: 'Play' },
  { id: 'dash',      name: 'Boo Dash',     tag: 'Fluency run',   accent: 'var(--pop)',  icon: dashIcon, group: 'Play' },
  { id: 'boopop',    name: 'Boo Pop',      tag: 'Match & pop',   accent: 'var(--zing)', icon: popIcon, group: 'Play' }
];

export function mount(container, params, ctx) {
  // Toddler mode (RUN5 C7): a calm hub of four giant cards. Quests, Golden Round,
  // Smart Mix, Sound Twins and Trophies are hidden; rewards stay the shared universe.
  if (contentTier() === 'toddler') return mountToddlerHub(container, params, ctx);
  const s = getState();
  music.play('calm');
  // Occasional Boo requests appear only at app open (RUN3 C8).
  checkRequestOpen((s.town || []).filter(t => (t.item || '').startsWith('boo_') || (t.item || '').startsWith('custom:')).map(t => t.item));

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

  // ---- total stars beside the meter (job 5): a small chip that counts up when it grows ----
  const totalChip = el('div', { class: 'stars-total', 'aria-label': 'your total stars' }, [
    el('span', { class: 'st-ic', html: chipStar() }),
    el('span', { class: 'st-n', text: '0' })
  ]);
  {
    const target = s.stars.total;
    const from = Math.min((s.seen.lastStarsShown != null ? s.seen.lastStarsShown : target), target);
    const nEl = totalChip.querySelector('.st-n');
    if (from < target && !REDUCED) {
      // brief count-up (read-only juice; no economy change)
      totalChip.classList.add('grow');
      const t0 = performance.now(), dur = 900;
      const tick = (now) => {
        const p = Math.min(1, (now - t0) / dur);
        const e = 1 - Math.pow(1 - p, 3);
        nEl.textContent = String(Math.round(from + (target - from) * e));
        if (p < 1) requestAnimationFrame(tick); else totalChip.classList.remove('grow');
      };
      requestAnimationFrame(tick);
    } else nEl.textContent = String(target);
    mutate(st => { st.seen.lastStarsShown = target; });
  }

  // The Star Chest (RUN4 C8): a golden chest beside the meter with its own mini
  // progress track tied to the visible star total. Every CHEST_EVERY stars past
  // the anchor earns one; migrated saves start with a single welcome chest.
  const cs = chestState();
  const chestBtn = el('button', {
    class: 'star-chest' + (cs.ready ? ' ready' : ''),
    'aria-label': cs.ready ? 'Open your Star Chest!' : `Star Chest: ${cs.progress} of ${CHEST_EVERY} stars`,
    onclick: () => { if (chestState().ready) { sfx.tap(); ctx.go('ceremony', { chest: true }); } }
  }, [
    el('span', { class: 'chest-ic', html: chestSVG(cs.ready) }),
    el('span', { class: 'chest-track' }, [
      el('span', { class: 'chest-fill', style: { width: Math.round(cs.progress / CHEST_EVERY * 100) + '%' } })
    ])
  ]);

  const meterWrap = el('div', { class: 'meter-wrap' });
  const top = el('header', { class: 'hub-top' }, [speaker, totalChip, meterWrap, chestBtn]);

  // ---- guide + bubble ----
  const gb = createGuideBubble({ view: 'full', size: 150, side: 'left' });
  const guideSection = el('section', { class: 'hub-guide' }, [gb.root]);

  // Boo of the Day (RUN4 C9): a little podium beside the guide. Pure decoration,
  // rotates at local midnight, wears a random owned accessory (or none, gracefully).
  const botd = booOfTheDay();
  if (botd) {
    const boodayArt = el('div', { class: 'booday-art', html: renderItem(botd.item, { size: 74, equipArt: botd.accArt, cls: 'art-idle' }) });
    guideSection.appendChild(el('div', { class: 'booday' }, [
      boodayArt,
      el('div', { class: 'booday-podium' }, [el('span', { class: 'booday-star', text: '★' })]),
      el('div', { class: 'booday-line', text: `Today's star: ${getDisplayName(botd.id) || botd.item.name}!` })
    ]));
    // shared rarity VFX (C2): Boo of the Day shows its rarity too
    applyRarityFx(boodayArt, botd.item, { context: 'full', shiny: ((s.shinies && s.shinies[botd.id]) || 0) > 0 });
  }
  // Long-press the guide to open the character creator (spec RUN2 C1).
  attachLongPress(gb.art, 550, () => { sfx.tap(); ctx.go('editguide', { from: 'hub' }); });
  gb.art.setAttribute('aria-label', 'Your character — press and hold to change');
  suppressContextMenu(gb.art);   // hold target: no native callout/context menu (C0.1)

  // Jump back in (RUN5 C0b): once any round has ever been played, the very first
  // card (right under the guide) replays her last game and mode in one tap.
  let jumpBackNode = null;
  const lp = s.seen && s.seen.lastPlay;
  if (lp && lp.game && GAMES.some(g => g.id === lp.game)) {
    const g = GAMES.find(x => x.id === lp.game);
    const modeLabel = lp.mix ? 'Smart Mix'
      : (lp.gameName && lp.gameName !== g.name ? lp.gameName : '')
        + (lp.level != null ? (lp.gameName && lp.gameName !== g.name ? ' · ' : '') + 'Level ' + lp.level : '');
    const resume = { cat: lp.cat, level: lp.level, mix: !!lp.mix };
    const jumpCard = el('button', { class: 'jumpback-card',
      onclick: () => { sfx.tap(); ctx.go(lp.game, { resume }); } }, [
      el('span', { class: 'jb-badge', text: 'Jump back in' }),
      el('span', { class: 'jb-icon', html: g.icon() }),
      el('span', { class: 'jb-body' }, [
        el('span', { class: 'jb-name', text: g.name }),
        el('span', { class: 'jb-mode', text: modeLabel || g.tag })
      ]),
      el('span', { class: 'jb-play', html: '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M8 5l11 7-11 7z" fill="currentColor"/></svg>' })
    ]);
    // el() drops custom props via Object.assign, so set --accent explicitly.
    jumpCard.style.setProperty('--accent', g.accent);
    jumpBackNode = el('section', { class: 'jumpback-wrap' }, [jumpCard]);
  }

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

  // One-time age question for saves from before the age step existed (job 4).
  // A friendly inline card — it never blocks anything; answer or skip sets the flag
  // and it never appears again. The grown-ups tier setting always overrides later.
  if (!s.ageAsked) {
    const chipRow = el('div', { class: 'age-chips' });
    const ageCard = el('div', { class: 'age-card card' }, [
      el('div', { class: 'age-head' }, [
        el('div', { class: 'age-guide', html: renderGuide(s.guide, { view: 'head', size: 64 }) }),
        el('div', { class: 'age-q' }, [
          el('div', { class: 'age-title', text: 'Quick question! How old are you?' }),
          el('div', { class: 'age-sub', text: 'So the games fit you just right.' })
        ])
      ]),
      chipRow,
      el('button', { class: 'age-skip', text: 'skip', onclick: () => { sfx.tap(); mutate(st => { st.ageAsked = true; }); ageCard.remove(); } })
    ]);
    for (const c of AGE_CHOICES) {
      chipRow.appendChild(el('button', { class: 'acc-chip age-chip', text: c.label, onclick: () => {
        sfx.star ? sfx.star() : sfx.tap();
        mutate(st => { st.age = c.age; st.ageAsked = true; st.settings.content = tierForAge(c.age); });
        ageCard.remove();
      } }));
    }
    specials.appendChild(ageCard);
  }

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

  // Boo Quest card (RUN6 C6) — a storybook adventure. Never shown in Toddler mode
  // (that hub is a separate render that omits it entirely).
  {
    const q = s.quest || { node: 0, lands: {} };
    const landDone = !!(q.lands && q.lands.sparkle_meadow);
    const prog = landDone ? 'Complete! ✓' : `Node ${Math.min((q.node || 0) + 1, 6)} of 6`;
    specials.appendChild(el('button', { class: 'quest-card', onclick: () => { sfx.tap(); ctx.go('booquest'); } }, [
      el('span', { class: 'quest-ic', text: '🗺️' }),
      el('span', { class: 'quest-body' }, [
        el('span', { class: 'quest-title', text: 'Boo Quest' }),
        el('span', { class: 'quest-sub', text: `The Sparkle Meadow · ${prog}` })
      ]),
      el('span', { class: 'quest-ic', text: '✨' })
    ]));
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

  root.append(top, guideSection, ...(jumpBackNode ? [jumpBackNode] : []), specials, cards, bar);

  renderMeter();

  // One-time retroactive trophy award for existing saves (RUN4 C4): everything
  // derivable lands at once in a single gentle cabinet-opening ceremony.
  setTimeout(() => { try { retroAwardOnce(); } catch (e) { console.warn(e); } }, 400);
  // Growth milestones (RUN4 C6): the Builders' clock starts when she crosses a
  // milestone, not when she next visits the town.
  try { tickGrowth(); } catch (e) { console.warn(e); }
  try { tickFunfair(); } catch (e) { console.warn(e); }   // advance funfair builds (RUN6 C1b)

  // Update toast (RUN5 C0b): shown ONLY on the hub, never mid-round. Tapping
  // activates the waiting service worker (user-initiated — the SW never
  // auto-activates). A build that finishes installing while she is on the hub
  // triggers the same toast via onUpdateWaiting.
  let updateToast = null;
  function offerUpdate() {
    if (updateToast || !hasUpdateWaiting()) return;
    updateToast = showToast('Something new arrived! Tap to get it!', {
      actionLabel: 'Update ✨', autoHideMs: 0, className: 'update',
      onAction: () => { sfx.tap(); activateUpdate(); }
    });
  }
  offerUpdate();
  const dropUpdateListener = onUpdateWaiting(offerUpdate);

  // greeting — or the one-per-session near-unlock nudge (RUN4 C1). A ready box
  // wins: celebration first, and the nudge never stacks onto other prompts.
  const greetKey = params && params.greeting ? params.greeting : 'welcome';
  const nearZone = ZONES.find(z => s.stars.total < z.unlock && z.unlock - s.stars.total <= NUDGE_WITHIN);
  if (nearZone && !nudgedThisSession && !(s.boxes > 0)) {
    nudgedThisSession = true;
    gb.sayText(guideLine('nearUnlock')
      .replace(/\{zone\}/g, nearZone.name)
      .replace(/\{n\}/g, String(nearZone.unlock - s.stars.total)), { voice: false });
  } else {
    gb.say(greetKey);
  }

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
    unmount() {
      clearInterval(rotate);
      dropUpdateListener();
      if (updateToast) { updateToast.remove(); updateToast = null; }
    }
  };
}

// ---- the Toddler hub (RUN5 C7) ---------------------------------------------
function mountToddlerHub(container, params, ctx) {
  const s = getState();
  music.play('calm');
  const root = el('div', { class: 'hub toddler-hub' });
  container.appendChild(root);

  // top bar: speaker + star meter + gift + chest (the same shared rewards)
  const speaker = el('button', { class: 'icon-btn speaker', 'aria-label': 'Sound on or off' });
  const paintSpeaker = () => {
    const anyOn = s.settings.sound || s.settings.music;
    speaker.innerHTML = anyOn
      ? '<svg viewBox="0 0 24 24" width="30" height="30"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="var(--card)"/><path d="M16 8c1.5 1.5 1.5 6.5 0 8" stroke="var(--card)" stroke-width="2" fill="none" stroke-linecap="round"/></svg>'
      : '<svg viewBox="0 0 24 24" width="30" height="30"><path d="M4 9v6h4l5 4V5L8 9H4z" fill="var(--card)"/><path d="M16 9l6 6M22 9l-6 6" stroke="var(--card)" stroke-width="2" stroke-linecap="round"/></svg>';
  };
  paintSpeaker();
  speaker.addEventListener('click', () => {
    const next = !(s.settings.sound || s.settings.music);
    mutate(st => { st.settings.sound = next; st.settings.music = next; });
    setSoundEnabled(next); setMusicEnabled(next);
    if (next) music.play('calm');
    paintSpeaker();
  });
  const meterWrap = el('div', { class: 'meter-wrap' });
  const cs = chestState();
  const chestBtn = el('button', { class: 'star-chest' + (cs.ready ? ' ready' : ''), 'aria-label': cs.ready ? 'Open your Star Chest!' : 'Star Chest',
    onclick: () => { if (chestState().ready) { sfx.tap(); ctx.go('ceremony', { chest: true }); } } }, [
    el('span', { class: 'chest-ic', html: chestSVG(cs.ready) }),
    el('span', { class: 'chest-track' }, [el('span', { class: 'chest-fill', style: { width: Math.round(cs.progress / CHEST_EVERY * 100) + '%' } })])
  ]);
  const top = el('header', { class: 'hub-top' }, [speaker, meterWrap, chestBtn]);

  function renderMeter() {
    clear(meterWrap);
    const { meter, boxes } = meterState();
    const track = el('div', { class: 'meter-track' });
    for (let i = 0; i < METER_CAP; i++) track.appendChild(el('span', { class: 'meter-seg' + (i < meter ? ' on' : '') }));
    const gift = el('button', { class: 'gift-btn' + (boxes > 0 ? ' ready' : ''), 'aria-label': boxes > 0 ? 'Open your box' : 'Star meter', html: giftSVG(46),
      onclick: () => { if (getState().boxes > 0) ctx.go('ceremony'); } });
    if (boxes > 1) gift.appendChild(el('span', { class: 'box-badge', text: 'x' + boxes }));
    meterWrap.append(track, gift);
  }

  // the guide greets, spoken aloud when voice is available
  const gb = createGuideBubble({ view: 'full', size: 140, side: 'left' });
  const guideSection = el('section', { class: 'hub-guide' }, [gb.root]);

  // four giant game cards: icon + ONE word; tapping speaks the name and starts a round
  const cards = el('section', { class: 'toddler-cards' });
  for (const g of TODDLER_GAMES) {
    cards.appendChild(el('button', { class: 'toddler-card', 'aria-label': g.word, onclick: () => {
      sfx.tap(); speakMaybe(g.word);
      ctx.go('toddlergame', { game: g.key });
    } }, [
      el('span', { class: 'tc-icon', text: g.icon }),
      el('span', { class: 'tc-word', text: g.word })
    ]));
  }

  // bottom bar: Town, Collection, Studio + the cog behind its long-press, as ever
  const say = (word, fn) => () => { sfx.tap(); speakMaybe(word); fn(); };
  const bar = el('nav', { class: 'bottom-bar' }, [
    el('button', { class: 'bar-btn', onclick: say('Town', () => ctx.go('town')) }, [el('span', { class: 'bar-ic', html: '🏡' }), el('span', { text: 'Town' })]),
    el('button', { class: 'bar-btn', onclick: say('Collection', () => ctx.go('collection')) }, [el('span', { class: 'bar-ic', html: '📖' }), el('span', { text: 'Collection' })]),
    el('button', { class: 'bar-btn', onclick: say('Studio', () => ctx.go('studio')) }, [el('span', { class: 'bar-ic', html: '🎨' }), el('span', { text: 'Studio' })]),
    makeCog(() => ctx.go('grownups'))
  ]);

  root.append(top, guideSection, cards, bar);
  renderMeter();
  gb.say('welcome');   // spoken when voice is on

  return { unmount() {} };
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
  suppressContextMenu(btn);   // hold target: suppress Silk/Safari native context menu on the 3s hold (C0.1)
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
function popIcon() {
  return `<svg viewBox="0 0 60 60" width="56" height="56"><circle cx="20" cy="22" r="11" fill="var(--pop)" stroke="var(--ink)" stroke-width="3"/><circle cx="42" cy="24" r="10" fill="var(--star)" stroke="var(--ink)" stroke-width="3"/><circle cx="30" cy="42" r="11" fill="var(--zing)" stroke="var(--ink)" stroke-width="3"/><text x="20" y="27" font-family="Fredoka,sans-serif" font-size="13" font-weight="700" fill="#fff" text-anchor="middle">3</text><text x="42" y="29" font-family="Fredoka,sans-serif" font-size="13" font-weight="700" fill="#fff" text-anchor="middle">7</text><text x="30" y="47" font-family="Fredoka,sans-serif" font-size="13" font-weight="700" fill="#fff" text-anchor="middle">10</text><path d="M50 8 l2 4 4 2 -4 2 -2 4 -2 -4 -4 -2 4 -2z" fill="var(--star)"/></svg>`;
}
function clockIcon() {
  return `<svg viewBox="0 0 60 60" width="56" height="56"><circle cx="30" cy="30" r="22" fill="var(--card)" stroke="var(--ink)" stroke-width="3"/><circle cx="30" cy="30" r="22" fill="none" stroke="var(--star)" stroke-width="3" opacity="0.5"/><line x1="30" y1="30" x2="30" y2="17" stroke="var(--ink)" stroke-width="3.5" stroke-linecap="round"/><line x1="30" y1="30" x2="40" y2="34" stroke="var(--pop)" stroke-width="3" stroke-linecap="round"/><circle cx="30" cy="30" r="2.5" fill="var(--ink)"/></svg>`;
}

// the Star Chest (RUN4 C8): closed gold chest; lid pops + glow when ready
function chestSVG(ready) {
  return `<svg viewBox="0 0 48 40" width="34" height="28" class="${ready ? 'chest-ready-anim' : ''}">
    <rect x="4" y="16" width="40" height="20" rx="5" fill="#C98A2B" stroke="#7A4E14" stroke-width="2.5"/>
    <path d="M4 20 Q4 8 24 8 Q44 8 44 20 L44 22 L4 22 Z" fill="#E8B04B" stroke="#7A4E14" stroke-width="2.5"/>
    <rect x="20" y="18" width="8" height="10" rx="2" fill="${ready ? '#FFC93C' : '#8A5A44'}" stroke="#7A4E14" stroke-width="2"/>
    ${ready ? '<circle cx="24" cy="6" r="2.4" fill="#FFC93C"/><circle cx="12" cy="10" r="1.8" fill="#FFF3B0"/><circle cx="37" cy="9" r="1.8" fill="#FFF3B0"/>' : ''}
  </svg>`;
}

// small star for the total-stars chip (job 5)
function chipStar() {
  return `<svg viewBox="0 0 24 24" width="20" height="20"><path d="M12 2l2.9 5.9 6.5.9-4.7 4.6 1.1 6.4L12 16.8 6.2 19.8l1.1-6.4L2.6 8.8l6.5-.9z" fill="var(--star)" stroke="#E0A81E" stroke-width="1.4" stroke-linejoin="round"/></svg>`;
}
