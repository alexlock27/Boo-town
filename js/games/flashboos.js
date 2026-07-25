// RUN10 P19 — Flash Boos: reveal, recall, then reveal again with proof.
import { el, clear } from '../ui.js';
import { createGameShell } from '../gameshell.js';
import { renderBoo, renderDeco } from '../art.js';
import { sfx, music } from '../sfx.js';
import { contentTier } from '../content.js';
import { maybeIntro, replayIntro } from '../intro.js';
import { recordResult } from '../state.js';
import { speakMaybe } from '../guide.js';
import { flashScene, flashQuestion } from '../brainhelpers.js';

export const FLASH_INTRO = [
  { text: 'Watch the Boos before the curtain closes.' },
  { text: 'Remember who, what and where you saw.' },
  { text: 'Answer, then peek again to check!' }
];
const ROUNDS = 8;
const DECO_MAP = { ball: 'deco_ball', 'hat-stand': 'deco_coatstand', swing: 'deco_swings', bench: 'deco_bench' };
const COLOUR_HEX = { indigo:'#55409A', lilac:'#C6A9F0', teal:'#35D0BA', bubblegum:'#FF7AC6', gold:'#FFC93C', aqua:'#69DDE0' };

function booHTML(boo, size = 112) {
  return renderBoo({ species: boo.species, colors: { body: boo.colour }, acc: boo.hat ? 'cap' : null, fx: boo.shine ? 'shimmer' : null }, { size });
}
function propHTML(prop, size = 36) {
  const id = DECO_MAP[prop] || 'deco_bench';
  return renderDeco(id, { size });
}

export function mount(container, params, ctx) {
  music.play('game');
  const root = el('div', { class: 'screen flashboos' });
  const tier = contentTier(), toddler = tier === 'toddler';
  const revealMs = toddler ? 5000 : tier === 'full' ? 3000 : tier === 'medium' ? 4000 : 5000;
  let round = 0, wrong = 0, scene, question, timer = null, phase = 'idle';
  const shell = createGameShell({
    title: 'Flash Boos', rounds: ROUNDS, accent: 'var(--pop)', hideHearts: true,
    onBack: () => ctx.go('hub'), onHint: () => shell.react('Picture the scene, then choose what you remember.'),
    onHelp: () => replayIntro('flashboos', FLASH_INTRO)
  });
  const stage = el('section', { class: 'flash-stage' });
  const sceneNode = el('div', { class: 'flash-scene' });
  const curtain = el('div', { class: 'flash-curtain' }, [el('strong', { text: 'FLASH BOOS' })]);
  const questionNode = el('section', { class: 'flash-question' });
  stage.append(sceneNode, curtain);
  shell.area.append(stage, questionNode);
  root.appendChild(shell.root); container.appendChild(root);
  maybeIntro('flashboos', FLASH_INTRO);
  begin();

  function begin() {
    phase = 'reveal'; clear(questionNode);
    scene = flashScene(tier, Math.random, { toddler });
    question = flashQuestion(scene);
    renderScene();
    curtain.classList.remove('down');
    stage.classList.add('revealing');
    // RUN12 S6: the reveal is the whole game. It must not start — let alone finish —
    // behind the first-play intro, which is exactly what shipped.
    shell.cancel(timer);
    timer = shell.after(revealMs, hideAndAsk);
  }
  function renderScene(circleIds = []) {
    clear(sceneNode);
    const circled = new Set(Array.isArray(circleIds) ? circleIds : [circleIds]);
    const booRow = el('div', { class: 'flash-boo-row' });
    scene.boos.forEach(boo => {
      const ownedProps = scene.props.filter(prop => scene.links[prop] === boo.id);
      const node = el('div', { class: 'flash-boo' + (circled.has(boo.id) ? ' answer-ring' : ''), dataset: { id: boo.id } }, [
        el('span', { class: 'flash-boo-art', html: booHTML(boo) }),
        el('small', { text: boo.name }),
        el('span', { class: 'flash-owned-props', html: ownedProps.map(p => `<span class="flash-prop-icon">${propHTML(p, 36)}</span>`).join('') })
      ]);
      booRow.appendChild(node);
    });
    sceneNode.append(booRow);
  }
  function hideAndAsk() {
    phase = 'question'; curtain.classList.add('down'); stage.classList.remove('revealing');
    shell.after(600, renderQuestion);
  }
  function renderQuestion() {
    clear(questionNode);
    const prompt = el('h2', { text: question.prompt });
    const answers = el('div', { class: 'flash-answers' });
    question.answers.forEach(answer => {
      const button = el('button', { class: 'flash-answer', dataset: { answer: String(answer) }, onclick: () => answerQuestion(answer) });
      if (question.answerType === 'boo') {
        const boo = scene.boos.find(b => b.id === answer);
        button.append(el('span', { html: booHTML(boo, 96) }), el('small', { text: boo.name }));
      } else if (question.answerType === 'colour') {
        button.append(el('i', { class: 'flash-swatch', style: { background: COLOUR_HEX[answer] } }), el('small', { text: answer }));
      } else button.appendChild(el('strong', { text: String(answer) }));
      answers.appendChild(button);
    });
    questionNode.append(prompt, answers);
    if (toddler) speakMaybe(question.prompt);
  }
  function answerQuestion(answer) {
    if (phase !== 'question') return;
    phase = 'answer'; const correct = answer === question.correct;
    if (!correct) wrong++;
    recordResult(`flashboos:${question.template}`, correct);
    correct ? sfx.star() : sfx.oops();
    shell.react(correct ? 'Yes — let’s look again!' : 'Let’s look again together!');
    let proofIds = [];
    if (question.answerType === 'boo' || question.answerType === 'colour') proofIds = [question.targetId || question.correct];
    else if (question.template.startsWith('countWearing:')) {
      const feature = question.template.split(':')[1];
      proofIds = scene.boos.filter(boo => boo[feature]).map(boo => boo.id);
    } else proofIds = scene.boos.map(boo => boo.id);
    renderScene(proofIds);
    if (question.answerType !== 'boo' && question.answerType !== 'colour') {
      sceneNode.dataset.answer = String(question.correct);
    }
    curtain.classList.remove('down');
    stage.classList.add('answer-reveal');
    clear(questionNode);
    questionNode.appendChild(el('div', { class: 'flash-proof', text: `The answer was ${answerLabel(question.correct)}!` }));
    timer = shell.after(1450, () => {
      round++; shell.advance();
      if (round >= ROUNDS) finish(); else begin();
    });
  }
  function answerLabel(answer) {
    if (question.answerType === 'boo') return scene.boos.find(b => b.id === answer).name;
    return String(answer);
  }
  function finish() {
    const stars = wrong <= 1 ? 3 : wrong <= 3 ? 2 : 1;
    ctx.go('results', { game: 'flashboos', gameName: 'Flash Boos', stars, replay: () => ctx.go('flashboos') });
  }
  window.__flashboos = {
    scene: () => scene, question: () => question, phase: () => phase,
    hide: hideAndAsk, answer: answerQuestion, revealMs, round: () => round
  };
  return { unmount() { shell.cancel(timer); shell.cleanup(); delete window.__flashboos; } };
}
