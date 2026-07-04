// js/ceremony.js — the box-opening ceremony (spec §5.5). The signature moment.

import { el, clear, confetti } from './ui.js';
import { getState } from './state.js';
import { renderItem } from './art.js';
import { RARITY } from '../data/catalogue.js';
import { guideLine, speakMaybe } from './guide.js';
import { sfx, music } from './sfx.js';
import { openOneBox } from './rewards.js';
import { openEquipPicker } from './accessories.js';

// Reveal cards announce what the item is (spec RUN2 C2).
const TYPE_BANNER = { boo: 'A BOO!', deco: 'A DECORATION!', accessory: 'AN ACCESSORY!' };
const TYPE_LINE = {
  boo: 'Boos live in your town!',
  deco: 'Place it in your town!',
  accessory: 'Dress up any Boo, or your own character!'
};

export function mount(container, params, ctx) {
  const root = el('div', { class: 'ceremony' });
  container.appendChild(root);
  openSequence();

  function openSequence() {
    const result = openOneBox();
    if (!result) { ctx.go('hub'); return; }
    clear(root);
    music.play('calm');

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
      const rar = RARITY[result.rarity];
      sfx.fanfare();
      confetti({ count: result.rarity === 'secret' ? 160 : result.rarity === 'ultra' ? 120 : 80, power: result.rarity === 'secret' ? 1.3 : 1 });
      clear(root);

      const kind = result.item.kind;
      const glowClass = 'glow-' + result.rarity;
      const card = el('div', { class: 'reveal-card ' + glowClass }, [
        el('div', { class: 'reveal-banner type-' + kind, text: TYPE_BANNER[kind] || 'A TREASURE!' }),
        el('div', { class: 'reveal-art', html: renderItem(result.item, { size: 172, cls: result.item.fx ? '' : 'art-idle' }) }),
        el('div', { class: 'reveal-rarity', text: rar.label }),
        el('h2', { class: 'reveal-name', text: result.duplicate ? `Another ${result.item.name}!` : result.item.name }),
        el('p', { class: 'reveal-oneliner', text: TYPE_LINE[kind] || '' }),
        el('p', { class: 'reveal-blurb', text: result.item.blurb })
      ]);

      const guideBubble = el('div', { class: 'speech-bubble reveal-guide-bubble' });
      const buttons = el('div', { class: 'reveal-btns' });

      const wrap = el('div', { class: 'reveal-wrap' }, [card, guideBubble, buttons]);
      root.appendChild(wrap);
      requestAnimationFrame(() => card.classList.add('flip-in'));

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
        const key = result.item.id === 'boo_twiglet' ? 'twigletReveal'
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
      if (getState().boxes > 0) openSequence();
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
