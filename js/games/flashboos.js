import { el, backControl } from '../ui.js';
import { contentTier } from '../content.js';

const NAMES = ['Pip', 'Nova', 'Munch', 'Bloop', 'Twirl', 'Sunny'];
const COLOURS = ['teal', 'lilac', 'gold', 'bubblegum', 'cream', 'indigo'];
const PROPS = ['ball', 'hat-stand', 'swing', 'bench'];
const pick = list => list[Math.floor(Math.random() * list.length)];

function nearOptions(answer) {
  if (typeof answer === 'number') return [...new Set([Math.max(0, answer - 1), answer, answer + 1])];
  const options = [answer, ...COLOURS.filter(colour => colour !== answer).slice(0, 2)];
  return options.sort(() => Math.random() - .5);
}

export function makeScene(tier = 1, { toddler = false } = {}) {
  const count = toddler ? 2 : 2 + tier;
  const props = PROPS.slice(0, Math.min(2, tier));
  const boos = Array.from({ length: count }, (_, index) => ({ name: NAMES[index], colour: COLOURS[index], hat: index % 2 === 0, shiny: index === count - 1, prop: index === 0 && props.includes('ball') ? 'ball' : null, sit: props[index % props.length] || null }));
  const kinds = ['total', 'hats', 'shiny', 'colour', 'sit', 'ball'];
  const kind = toddler ? 'total' : pick(kinds);
  let question, answer;
  if (kind === 'hats') { question = 'How many were wearing hats?'; answer = boos.filter(boo => boo.hat).length; }
  else if (kind === 'shiny') { question = 'How many were shiny?'; answer = boos.filter(boo => boo.shiny).length; }
  else if (kind === 'colour') { const which = tier % 2 ? boos[0] : boos.at(-1); question = `What colour was the ${tier % 2 ? 'leftmost' : 'rightmost'} Boo?`; answer = which.colour; }
  else if (kind === 'sit') { const prop = props.includes('swing') ? 'swing' : 'bench'; const who = boos.find(boo => boo.sit === prop) || boos[0]; question = `Who sat on the ${prop}?`; answer = who.name; }
  else if (kind === 'ball') { question = 'Who held the ball?'; answer = (boos.find(boo => boo.prop === 'ball') || boos[0]).name; }
  else { question = 'How many Boos did you see?'; answer = count; }
  const options = typeof answer === 'string' && NAMES.includes(answer) ? [answer, ...NAMES.filter(name => name !== answer).slice(0, 2)].sort(() => Math.random() - .5) : nearOptions(answer);
  return { boos, props, question, answer, options, kind };
}

export function mount(container, params, ctx) {
  const root = el('div', { class: 'screen flashboos' }); container.appendChild(root);
  let tier = 1, completed = 0, scene, revealTimer = null;
  const curtain = el('div', { class: 'flash-scene' }); const question = el('p', { class: 'flash-question' }); const options = el('div', { class: 'flash-options' });
  const drawScene = (circle = null) => {
    curtain.innerHTML = '';
    scene.boos.forEach(boo => curtain.appendChild(el('span', { class: circle === boo.name || circle === boo.colour ? 'flash-circled' : '', style: { '--boo': boo.colour }, text: `${boo.hat ? '🎩' : ''}👻${boo.prop === 'ball' ? '⚽' : ''}` })));
  };
  const ask = () => {
    curtain.classList.add('hidden'); question.textContent = scene.question; options.innerHTML = '';
    scene.options.forEach(option => {
      const button = el('button', { class: 'btn', text: String(option), onclick: () => {
        drawScene(option); curtain.classList.remove('hidden');
        if (option === scene.answer) { completed++; question.textContent = 'That is right — look, there it is!'; tier = Math.min(3, 1 + Math.floor(completed / 3)); if (completed >= 8) { setTimeout(() => ctx.go('results', { game: 'flashboos', gameName: 'Flash Boos', stars: 3, replay: () => ctx.go('flashboos') }), 750); } else setTimeout(begin, 900); }
        else question.textContent = 'Look again — the curtain rose with the answer circled.';
      } });
      options.appendChild(button);
    });
  };
  const begin = () => { scene = makeScene(tier, { toddler: contentTier() === 'toddler' }); drawScene(); curtain.classList.remove('hidden'); options.innerHTML = ''; question.textContent = `Look closely… ${completed}/8`; revealTimer = setTimeout(ask, [3000, 4000, 5000][tier - 1]); };
  root.append(el('h2', { text: 'Flash Boos' }), curtain, question, options,
    el('button', { class: 'btn soft', text: '?', onclick: () => question.textContent = 'Look, remember, then choose.' }),
    backControl(() => ctx.go('hub'), { floating: true }));
  begin(); return { unmount() { if (revealTimer) clearTimeout(revealTimer); } };
}
