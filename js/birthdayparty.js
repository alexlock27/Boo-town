// Lexie & Tyler's Twin Party Garden — a self-contained, saved birthday celebration.
import { el, clear, confetti, REDUCED, backControl } from './ui.js';
import { getState, mutate } from './state.js';
import { BY_ID, BIRTHDAY_BOOS } from '../data/catalogue.js';
import { resolveItem } from './customs.js';
import { renderItem } from './art.js';
import { equippedArt, getDisplayName } from './accessories.js';
import { sfx, music } from './sfx.js';
import { speakMaybe } from './guide.js';

export const PARTY_GUEST_MESSAGES = [
  'Best party ever!', 'Eleven looks brilliant!', 'Cake first, dancing second!',
  'Make a giant wish!', 'The balloons know your name!', 'Birthday Boo reporting in!'
];
export const PARTY_CONFIG = {
  lexie: {
    name:'LEXIE', colour:'#FF72C6', deep:'#8A3D91', soft:'#FFE0F4',
    icon:'⭐', booId:'boo_birthday_lexie', booName:'Lexie Starshine',
    booLine:'Crown bright, starry and made only for Lexie.',
    cake:'Strawberry Star Cake', cakeIcon:'🍓', theme:'Starshine Palace'
  },
  tyler: {
    name:'TYLER', colour:'#28C9C1', deep:'#2566A8', soft:'#D9FBF8',
    icon:'🚀', booId:'boo_birthday_tyler', booName:'Tyler Turbo',
    booLine:'Fast, musical and made only for Tyler.',
    cake:'Turbo Rocket Cake', cakeIcon:'🚀', theme:'Turbo Party Base'
  }
};

export function mount(container, params, ctx) {
  music.play('fair');
  mutate(st => {
    st.birthdayParty = st.birthdayParty || { opened:{lexie:false,tyler:false}, visits:0 };
    st.birthdayParty.opened = st.birthdayParty.opened || { lexie:false,tyler:false };
    st.birthdayParty.visits = (st.birthdayParty.visits || 0) + 1;
  });
  const root = el('div', { class:'birthday-party' });
  const header = el('header', { class:'birthday-header' }, [
    backControl(() => ctx.go('worldmap')),
    el('div', { class:'birthday-title' }, [
      el('h2', { text:'Twin Party Garden' }),
      el('p', { text:'Two parties. Two presents. One brilliant eleventh birthday.' })
    ]),
    el('div', { class:'birthday-eleven', text:'11' })
  ]);
  const jump = el('nav', { class:'birthday-jump', 'aria-label':'Choose a party' });
  const garden = el('main', { class:'party-garden' });
  const finale = el('button', { class:'twin-finale', onclick:showFinale }, [
    el('span', { text:'✨' }), el('strong', { text:'TWIN FINALE' }), el('small', { text:'Open both presents to unlock' })
  ]);
  root.append(header, jump, garden, finale);
  container.appendChild(root);

  const zones = {};
  const timers = [];
  const ownedGuestIds = Object.keys(getState().inventory || {}).filter(id => {
    const item = resolveItem(id);
    return (getState().inventory[id] || 0) > 0 && item && item.kind === 'boo' && !item.birthdayOnly;
  });
  const fallbackGuests = ['boo_inky','boo_pippin','boo_plum','boo_wisp','boo_beam','boo_peppy','boo_bubbles','boo_minty'];
  const guestIds = [...new Set([...ownedGuestIds, ...fallbackGuests])].slice(0, 8);

  Object.entries(PARTY_CONFIG).forEach(([key, config], partyIndex) => {
    const button = el('button', {
      class:`birthday-jump-btn party-${key}`, onclick:() => scrollToParty(key)
    }, [el('span', { text:config.icon }), el('strong', { text:config.name }), el('small', { text:'PARTY' })]);
    button.style.setProperty('--party', config.colour);
    jump.appendChild(button);
    const zone = buildPartyZone(key, config, partyIndex);
    zones[key] = zone;
    garden.appendChild(zone);
    renderPresent(key);
  });
  refreshFinale();
  if (params && PARTY_CONFIG[params.party]) requestAnimationFrame(() => scrollToParty(params.party));

  function buildPartyZone(key, config, partyIndex) {
    const zone = el('section', { class:`party-zone party-${key}`, dataset:{party:key} });
    zone.style.setProperty('--party', config.colour);
    zone.style.setProperty('--party-deep', config.deep);
    zone.style.setProperty('--party-soft', config.soft);
    const sky = el('div', { class:'party-sky' });
    const bunting = el('div', { class:'party-bunting', 'aria-hidden':'true' });
    for (let i = 0; i < 15; i++) bunting.appendChild(el('i', { style:{'--i':i} }));
    const balloons = el('div', { class:'party-balloons', 'aria-hidden':'true' });
    for (let i = 0; i < 14; i++) {
      balloons.appendChild(el('i', {
        class:`party-balloon balloon-${i % 4}`,
        style:{'--x':`${4 + (i * 17) % 92}%`,'--delay':`${(i % 7) * .13}s`,'--drift':`${-20 + (i % 5) * 10}px`}
      }));
    }
    const marquee = el('div', { class:'party-marquee' }, [
      el('small', { text:config.theme }),
      el('strong', { text:config.name }),
      el('span', { text:'HAPPY 11TH BIRTHDAY' })
    ]);
    const cake = el('div', { class:'party-cake-wrap' }, [
      el('div', { class:'party-cake-label', text:`${config.cakeIcon} ${config.cake}` }),
      cakeHTML()
    ]);
    const guests = el('div', { class:'party-guests' });
    const selected = guestIds.slice(partyIndex * 4, partyIndex * 4 + 4);
    while (selected.length < 4) selected.push(guestIds[selected.length % guestIds.length]);
    selected.forEach((id, i) => {
      const item = resolveItem(id);
      const guest = el('button', {
        class:'party-guest', dataset:{id},
        'aria-label':`${getDisplayName(id)} says a birthday message`,
        onclick:() => guestMessage(guest, (i + partyIndex * 2) % PARTY_GUEST_MESSAGES.length)
      }, [el('span', { html:renderItem(item, {size:94,equipArt:equippedArt(id)}) })]);
      guests.appendChild(guest);
    });
    const danceFloor = el('div', { class:'party-dance-floor', 'aria-hidden':'true' });
    for (let i = 0; i < 12; i++) danceFloor.appendChild(el('i', {style:{'--i':i}}));
    const celebrate = el('button', { class:'party-celebrate', onclick:() => celebrateParty(key) }, [
      el('span', { text:'🎉' }), el('strong', { text:`Celebrate ${titleCase(key)}!` }), el('small', { text:'Music · lights · confetti' })
    ]);
    const presentSpot = el('div', { class:'party-present-spot' });
    const message = el('div', { class:'party-message', 'aria-live':'polite' });
    zone.append(sky, bunting, balloons, marquee, cake, guests, danceFloor, celebrate, presentSpot, message);
    return zone;
  }

  function cakeHTML() {
    const candles = el('div', { class:'party-candles', 'aria-label':'11 birthday candles' });
    for (let i = 0; i < 11; i++) candles.appendChild(el('i', {style:{'--i':i}}));
    return el('div', { class:'party-cake' }, [
      candles, el('div', {class:'cake-top',text:'11'}), el('div',{class:'cake-middle'}), el('div',{class:'cake-bottom'})
    ]);
  }

  function renderPresent(key) {
    const config = PARTY_CONFIG[key], zone = zones[key] || garden.querySelector(`[data-party="${key}"]`);
    const spot = zone && zone.querySelector('.party-present-spot');
    if (!spot) return;
    clear(spot);
    const opened = !!getState().birthdayParty.opened[key];
    if (opened) {
      spot.appendChild(el('div', { class:'party-opened-friend' }, [
        el('div', { html:renderItem(BY_ID[config.booId], {size:116}) }),
        el('strong', { text:config.booName }),
        el('small', { text:'Birthday present opened ✓' })
      ]));
    } else {
      spot.appendChild(el('button', {
        class:'party-present', 'aria-label':`Open ${config.name}'s birthday present`, onclick:() => openPresent(key)
      }, [
        el('span', { class:'present-bow', text:'✦' }),
        el('strong', { text:`${config.name}'S PRESENT` }),
        el('small', { text:'Tap to open' })
      ]));
    }
  }

  function celebrateParty(key) {
    const config = PARTY_CONFIG[key], zone = zones[key];
    zone.classList.remove('celebrating'); void zone.offsetWidth; zone.classList.add('celebrating');
    sfx.fanfare();
    const rect = zone.getBoundingClientRect();
    if (!REDUCED) confetti({count:110,power:1.15,origin:{x:(rect.left+rect.width/2)/innerWidth,y:.35}});
    const line = `Happy eleventh birthday, ${titleCase(key)}!`;
    zone.querySelector('.party-message').textContent = `${config.icon} ${line} ${config.icon}`;
    speakMaybe(line);
    timers.push(setTimeout(() => zone.classList.remove('celebrating'), 6000));
  }

  function guestMessage(guest, messageIndex) {
    sfx.pop();
    guest.querySelectorAll('.guest-says').forEach(n => n.remove());
    const bubble = el('span', { class:'guest-says', text:PARTY_GUEST_MESSAGES[messageIndex] });
    guest.appendChild(bubble);
    timers.push(setTimeout(() => bubble.remove(), 2400));
  }

  function openPresent(key) {
    const config = PARTY_CONFIG[key];
    if (getState().birthdayParty.opened[key]) return showGift(key, false);
    mutate(st => {
      st.birthdayParty.opened[key] = true;
      st.inventory[config.booId] = Math.max(1, st.inventory[config.booId] || 0);
      st.journal = st.journal || {};
      st.journal[`birthday_${key}_11`] = new Date().toISOString().slice(0,10);
    });
    sfx.fanfare();
    if (!REDUCED) confetti({count:140,power:1.25,origin:{x:.5,y:.44}});
    renderPresent(key);
    showGift(key, true);
    refreshFinale();
  }

  function showGift(key, firstOpen) {
    const config = PARTY_CONFIG[key];
    const overlay = el('div', { class:`overlay party-gift-overlay party-${key}` });
    overlay.style.setProperty('--party', config.colour);
    const card = el('div', { class:'party-gift-card' }, [
      el('div', { class:'gift-rays', 'aria-hidden':'true' }),
      el('div', { class:'gift-ribbon', text:firstOpen ? 'A BRAND-NEW BIRTHDAY BOO!' : 'YOUR BIRTHDAY BOO' }),
      el('div', { class:'gift-boo', html:renderItem(BY_ID[config.booId], {size:210}) }),
      el('h2', { text:config.booName }),
      el('p', { text:config.booLine }),
      el('div', { class:'gift-keepsake', text:'✓ Now in the Collection and Town drawer forever' }),
      el('button', { class:'btn party-gift-done', text:'Join the party!', onclick:() => overlay.remove() })
    ]);
    overlay.appendChild(card); document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('show'));
  }

  function refreshFinale() {
    const opened = getState().birthdayParty.opened;
    const ready = opened.lexie && opened.tyler;
    finale.disabled = !ready;
    finale.classList.toggle('ready', ready);
    finale.querySelector('small').textContent = ready ? 'Both Birthday Boos are ready!' : `${Number(opened.lexie)+Number(opened.tyler)} of 2 presents opened`;
  }

  function showFinale() {
    const opened = getState().birthdayParty.opened;
    if (!(opened.lexie && opened.tyler)) return;
    sfx.fanfare();
    if (!REDUCED) confetti({count:180,power:1.4,origin:{x:.5,y:.42}});
    const overlay = el('div', { class:'overlay twin-finale-overlay' });
    const card = el('div', { class:'twin-finale-card' }, [
      el('div', { class:'finale-eleven', text:'11' }),
      el('h1', { text:'LEXIE + TYLER' }),
      el('p', { text:'TWO BIRTHDAYS. TWO PARTY BOOS. ONE AMAZING TEAM.' }),
      el('div', { class:'finale-boos' }, BIRTHDAY_BOOS.map(item => el('div', { html:renderItem(item,{size:190}) }))),
      el('strong', { text:'HAPPY BIRTHDAY, TWINS! 🎉' }),
      el('button', { class:'btn finale-again', text:'Celebrate again!', onclick:() => { overlay.remove(); celebrateParty('lexie'); celebrateParty('tyler'); } }),
      el('button', { class:'btn soft', text:'Back to the parties', onclick:() => overlay.remove() })
    ]);
    overlay.appendChild(card); document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('show'));
    speakMaybe('Happy eleventh birthday, Lexie and Tyler!');
  }

  function scrollToParty(key) {
    zones[key].scrollIntoView({behavior:REDUCED?'auto':'smooth',inline:'center',block:'nearest'});
  }

  window.__birthdayParty = {
    celebrate:celebrateParty, openPresent, finale:showFinale,
    opened:() => ({...getState().birthdayParty.opened}),
    candleCounts:() => Object.fromEntries(Object.keys(zones).map(key => [key,zones[key].querySelectorAll('.party-candles i').length])),
    guestCounts:() => Object.fromEntries(Object.keys(zones).map(key => [key,zones[key].querySelectorAll('.party-guest').length])),
    names:() => [...root.querySelectorAll('.party-marquee strong')].map(n => n.textContent),
    jump:scrollToParty
  };
  return {
    unmount() {
      timers.forEach(clearTimeout);
      document.querySelectorAll('.party-gift-overlay,.twin-finale-overlay').forEach(n => n.remove());
      delete window.__birthdayParty;
    }
  };
}

function titleCase(s) { return s[0].toUpperCase() + s.slice(1); }
