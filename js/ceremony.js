// js/ceremony.js — the box-opening ceremony (spec §5.5). The signature moment.

import { el, clear, confetti, backControl } from './ui.js';
import { haptic } from './haptics.js';
import { getState } from './state.js';
import { renderItem } from './art.js';
import { RARITY } from '../data/catalogue.js';
import { guideLine, speakMaybe } from './guide.js';
import { sfx, music } from './sfx.js';
import { openOneBox } from './rewards.js';
import { openChest } from './shiny.js';
import { openEquipPicker } from './accessories.js';
import { noteQuest, stampJournal } from './quests.js';
import { applyRarityFx } from './rarityfx.js';
import { noteRequest } from './requests.js';
import { checkAndCelebrate } from './trophies.js';
import { tickGrowth } from './growth.js';

// Reveal cards announce what the item is (spec RUN2 C2).
const TYPE_BANNER = { boo: 'A BOO!', deco: 'A DECORATION!', accessory: 'AN ACCESSORY!' };
const TYPE_LINE = {
  boo: 'Boos live in your town!',
  deco: 'Place it in your town!',
  accessory: 'Dress up any Boo, or your own character!'
};

export function mount(container, params, ctx) {
  const chestMode = !!(params && params.chest);   // the Star Chest golden variant (RUN4 C8)
  const root = el('div', { class: 'ceremony' + (chestMode ? ' chest-reveal' : '') });
  // shared back control (job 3) — safe here: the box is already opened+applied at mount
  const backB = backControl(() => ctx.go('hub'), { floating: true });
  container.appendChild(root);
  openSequence();

  // Adapt an openChest() result to the reveal card's shape (RUN4 C8).
  function chestResult() {
    const r = openChest();
    if (!r) return null;
    return { item: r.boo, rarity: r.boo.rarity, duplicate: false, isCustom: false, shiny: r.shiny, chestAcc: r.acc, bonusPoints: 0, extraBoxes: 0 };
  }

  function openSequence() {
    // The Star Chest (RUN4 C8) rides the same signature ceremony in gold: a
    // guaranteed Rare-or-better Boo (triple shiny odds) plus an accessory.
    const result = chestMode ? chestResult() : openOneBox();
    if (!result) { ctx.go('hub'); return; }
    clear(root);
    root.appendChild(backB);
    music.play('calm');
    // daily quest + Journal (RUN3 C4/C6) + request (RUN3 C8)
    noteQuest('boxOpen');
    noteRequest('boxOpen');
    if (result.shiny) stampJournal('firstShiny');   // shinies stamp the Journal (C8)
    if (result.isCustom) stampJournal('firstCustomWin');
    else if (result.rarity === 'rare') stampJournal('firstRare');
    else if (result.rarity === 'ultra') stampJournal('firstUltra');
    else if (result.rarity === 'secret') stampJournal('firstSecret');

    let taps = 0;
    const box = el('button', { class: 'gift-box wobble-idle', 'aria-label': 'Tap the box to open it', html: bigGift() });
    const hint = el('p', { class: 'ceremony-hint', text: 'Tap the box 3 times!' });
    const stage = el('div', { class: 'ceremony-stage' }, [box, hint]);
    // floating sparkles around the box (the signature moment)
    const sparkPos = [[-150, -60], [150, -50], [-130, 90], [140, 100], [0, -140]];
    sparkPos.forEach(([x, y], i) => {
      const sp = el('div', { class: 'cer-spark', text: '✦', style: { left: `calc(50% + ${x}px)`, top: `calc(46% + ${y}px)` } });
      sp.style.animationDelay = (i * 0.35) + 's';
      stage.appendChild(sp);
    });
    root.appendChild(stage);

    box.addEventListener('click', () => {
      if (taps >= 3) return;
      taps++;
      sfx.boxTap(taps - 1);
      box.classList.remove('wobble-idle');
      box.classList.add('squash-' + taps);
      if (taps === 3) { setTimeout(reveal, 220); hint.textContent = ''; }
      else hint.textContent = ['Tap the box 3 times!', 'Two more!', 'One more!'][taps];
    });

    function reveal() {
      const rar = RARITY[result.rarity] || { label: 'Your very own Boo!' };
      sfx.fanfare();
      try { haptic('open'); } catch {}   // a tiny double-buzz on a box / chest opening (RUN9 C7)
      confetti({ count: result.isCustom || result.rarity === 'secret' ? 160 : result.rarity === 'ultra' ? 120 : 80, power: result.isCustom || result.rarity === 'secret' ? 1.3 : 1 });
      // a shiny (or the golden chest) gets an EXTRA golden confetti layer (C8)
      if (result.shiny || chestMode) setTimeout(() => confetti({ count: 70, power: 1.1 }), 300);
      clear(root);
      root.appendChild(backB);

      const kind = result.item.kind;
      const glowClass = (result.isCustom ? 'glow-secret' : 'glow-' + result.rarity) + (result.shiny ? ' shiny' : '');
      const banner = result.shiny ? '✨ A SHINY BOO! ✨' : result.isCustom ? "IT'S YOUR BOO! 🎨" : (TYPE_BANNER[kind] || 'A TREASURE!');
      const revealArt = el('div', { class: 'reveal-art', html: renderItem(result.item, { size: 172, cls: result.item.fx ? '' : 'art-idle' }) });
      const card = el('div', { class: 'reveal-card ' + glowClass }, [
        el('div', { class: 'reveal-banner type-' + kind + (result.shiny ? ' shiny-banner' : ''), text: banner }),
        revealArt,
        el('div', { class: 'reveal-rarity', text: (result.shiny ? 'SHINY · ' : '') + rar.label }),
        el('h2', { class: 'reveal-name', text: result.duplicate ? `Another ${result.item.name}!` : result.item.name }),
        el('p', { class: 'reveal-oneliner', text: TYPE_LINE[kind] || '' }),
        result.chestAcc ? el('p', { class: 'chest-acc', text: `…and a ${result.chestAcc.name}! 🎀` }) : null,
        el('p', { class: 'reveal-blurb', text: result.item.blurb })
      ]);

      const guideBubble = el('div', { class: 'speech-bubble reveal-guide-bubble' });
      const buttons = el('div', { class: 'reveal-btns' });

      const wrap = el('div', { class: 'reveal-wrap' }, [card, guideBubble, buttons]);
      root.appendChild(wrap);
      // shared rarity VFX (C2): the full effect on the reveal art (rare glint / ultra
      // shimmer+motes / secret aura / shiny sparkle), consistent with everywhere else
      applyRarityFx(revealArt, result.item, { context: 'full', shiny: result.shiny });
      requestAnimationFrame(() => card.classList.add('flip-in'));

      // Collector medals can land right after a reveal (RUN4 C4) — celebrate
      // once the reveal moment has had its beat (shinies get a longer beat, C8).
      // A new Boo may also cross a growth milestone (RUN4 C6): start the
      // Builders' clock right away.
      setTimeout(() => { try { checkAndCelebrate(); } catch (e) { console.warn(e); } }, result.shiny ? 3000 : 1400);
      try { tickGrowth(); } catch (e) { console.warn(e); }

      if (result.duplicate) {
        // duplicate -> +2 meter points, with a small star animation
        guideBubble.textContent = guideLine('duplicate');
        speakMaybe(guideBubble.textContent);
        const dup = el('div', { class: 'dup-points', html: `+${result.bonusPoints} <span class="dup-star">★</span> to your meter!` });
        card.appendChild(dup);
        flyStars(card);
        buttons.appendChild(el('button', { class: 'btn big', text: 'Yay! 🎉', onclick: next }));
      } else {
        const seasonLine = { summer: 'summerReveal', spooky: 'spookyReveal', winter: 'winterReveal' };
        const key = result.shiny ? 'boxShiny'
          : chestMode ? 'chestOpen'
          : result.isCustom ? 'boxCustom'
          : result.item.id === 'boo_twiglet' ? 'twigletReveal'
          : kind === 'accessory' ? 'revealAccessory'
          : result.item.season ? seasonLine[result.item.season]
          : result.rarity === 'secret' ? 'boxSecret' : result.rarity === 'ultra' ? 'boxUltra'
          : result.rarity === 'rare' ? 'boxRare' : 'boxCommon';
        guideBubble.textContent = guideLine(key);
        speakMaybe(guideBubble.textContent);
        // A matching action button that lands where it says.
        if (kind === 'accessory') {
          buttons.appendChild(el('button', { class: 'btn big', text: 'Wear it 👒', onclick: () => {
            sfx.tap(); openEquipPicker(result.item, { onDone: next });
          } }));
        } else {
          const label = kind === 'boo' ? 'Meet them 🏡' : 'Place it 🏡';
          buttons.appendChild(el('button', { class: 'btn big', text: label, onclick: () => { sfx.tap(); ctx.go('town', { place: result.item.id, from: 'ceremony' }); } }));
        }
        buttons.appendChild(el('button', { class: 'btn soft', text: 'Keep for later', onclick: next }));
      }
    }

    function next() {
      sfx.tap();
      if (!chestMode && getState().boxes > 0) openSequence();
      else ctx.go('hub');
    }
  }

  return { unmount() {} };
}

function flyStars(card) {
  for (let i = 0; i < 5; i++) {
    const s = el('div', { class: 'fly-star', text: '★', style: { left: (30 + Math.random() * 40) + '%' } });
    s.style.animationDelay = (i * 90) + 'ms';
    card.appendChild(s);
    setTimeout(() => s.remove(), 1200 + i * 90);
  }
}

function bigGift() {
  return `<svg viewBox="0 0 200 200" width="200" height="200">
    <rect x="34" y="80" width="132" height="96" rx="12" fill="var(--pop)" stroke="var(--ink)" stroke-width="5"/>
    <rect x="24" y="58" width="152" height="34" rx="10" fill="var(--zing)" stroke="var(--ink)" stroke-width="5"/>
    <rect x="86" y="58" width="28" height="118" fill="var(--star)" stroke="var(--ink)" stroke-width="4"/>
    <path d="M100 54 C70 14 34 34 100 54 Z" fill="var(--star)" stroke="var(--ink)" stroke-width="4.5" stroke-linejoin="round"/>
    <path d="M100 54 C130 14 166 34 100 54 Z" fill="var(--star)" stroke="var(--ink)" stroke-width="4.5" stroke-linejoin="round"/>
    <circle cx="100" cy="54" r="11" fill="var(--star)" stroke="var(--ink)" stroke-width="4.5"/>
    <circle cx="70" cy="120" r="5" fill="#fff" opacity="0.6"/>
    <circle cx="128" cy="140" r="4" fill="#fff" opacity="0.5"/>
  </svg>`;
}
