// RUN10 P19 — Flash Boos: reveal, recall, then reveal again with proof.
import { el, clear } from '../ui.js';
import { createGameShell } from '../gameshell.js';
import { renderBoo, renderDeco } from '../art.js';
import { sfx, music } from '../sfx.js';
import { contentTier } from '../content.js';
import { maybeIntro, replayIntro } from '../intro.js';
import { recordResult } from '../state.js';
import { speakMaybe } from '../guide.js';
import { flashScene, flashQuestion, FLASH_PROP_BY_KEY } from '../brainhelpers.js';
import { SOCKETS, BOO_FOOT_FRAC } from '../../data/sockets.js';

export const FLASH_INTRO = [
  { text: 'Watch the Boos before the curtain closes.' },
  { text: 'Remember who, what and where you saw.' },
  { text: 'Answer, then peek again to check!' }
];
const ROUNDS = 8;
const COLOUR_HEX = { indigo:'#55409A', lilac:'#C6A9F0', teal:'#35D0BA', bubblegum:'#FF7AC6', gold:'#FFC93C', aqua:'#69DDE0' };
// A prop is never smaller than this on screen, at any width. Below it a ball stops being a
// ball and becomes a coloured dot — which is exactly what the old 36px badge row was.
export const PROP_MIN_PX = 56;
const HOLD_SCALE = 0.55;          // a held prop against the BOO's own width, as authored
const BOO_CELL_FRAC = 0.82;       // a standing Boo across its cell (matches .flash-boo-art)
const MIN_CELL_PX = 96;           // narrower than this and PROP_MIN_PX cannot be honoured
const CELL_GAP_PX = 8;
const DECO_GROUND_FRAC = 120 / 130;   // every deco's own ground line inside its viewBox
// The scene draws a Boo composed with its prop. The ANSWER buttons draw the same Boo plain:
// a button that renders the party hat is a button that gives away who was wearing it.
function booHTML(boo, size = 112, { composed = false } = {}) {
  const worn = composed && boo.wearing ? FLASH_PROP_BY_KEY[boo.wearing] : null;
  return renderBoo({
    species: boo.species, colors: { body: boo.colour },
    eyes: composed && boo.variation === 'eyesClosed' ? 'closed' : null,
    pose: composed && boo.variation === 'waving' ? 'wave' : null
  }, { size, equipArt: worn ? { hat: worn.acc } : null });
}
function propHTML(propKey, size) {
  const prop = FLASH_PROP_BY_KEY[propKey];
  return renderDeco({ deco: prop.deco, name: prop.label }, { size });
}

export function mount(container, params, ctx) {
  music.play('game');
  const root = el('div', { class: 'screen flashboos' });
  const tier = contentTier(), toddler = tier === 'toddler';
  const revealMs = toddler ? 5000 : tier === 'full' ? 3000 : tier === 'medium' ? 4000 : 5000;
  let round = 0, wrong = 0, scene, question, timer = null, phase = 'idle', lastCircles = [];
  const shell = createGameShell({
    title: 'Flash Boos', rounds: ROUNDS, accent: 'var(--pop)', hideHearts: true,
    bank: () => ({ correct: round, of: ROUNDS }),
    onBack: (b) => { if (b && b.stars > 0) ctx.go('results', { game: 'flashboos', gameName: 'Flash Boos', stars: b.stars, partial: b, replay: () => ctx.go('flashboos') }); else ctx.go('hub'); }, onHint: () => shell.react('Picture the scene, then choose what you remember.'),
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
  // A composed figure: the Boo, plus whatever it is sitting on or holding, in one picture.
  function figureNode(boo) {
    const fig = el('div', { class: 'flash-figure' });
    if (boo.seatedOn) {
      // Seated through the prop's OWN socket (data/sockets.js) — the same seat geometry the
      // town sits Boos with, so the contact point is the one that was measured, not eyeballed.
      const prop = FLASH_PROP_BY_KEY[boo.seatedOn];
      const sockets = SOCKETS[prop.socket] || [{ x: 0, yFrac: 0 }];
      // A LONE rider on a two-seater takes the middle of it — sitting on one end with the
      // other end empty reads as falling off. The seat LINE is still the measured one:
      // yFrac is what puts the feet in contact, and that is what a socket is for.
      const sock = sockets.length > 1 ? { x: 0, yFrac: sockets[0].yFrac } : sockets[0];
      const f = prop.booFrac;
      // Both boxes share the 120x130 viewBox, so every offset below is a fraction of the
      // PROP's rendered height: the Boo's feet land exactly on the socket's seat line.
      const top = ((DECO_GROUND_FRAC + (sock.yFrac || 0)) - BOO_FOOT_FRAC * f) * 100;
      const left = 50 + (sock.x || 0) * 100 - f * 50;
      fig.appendChild(el('span', { class: 'flash-seat-art', html: propHTML(boo.seatedOn, 120) }));
      fig.appendChild(el('span', {
        class: 'flash-boo-art seated', html: booHTML(boo, 112, { composed: true }),
        style: { width: f * 100 + '%', left: left + '%', top: top + '%' }
      }));
    } else {
      fig.appendChild(el('span', { class: 'flash-boo-art', html: booHTML(boo, 112, { composed: true }) }));
    }
    if (boo.holding) {
      const prop = FLASH_PROP_BY_KEY[boo.holding];
      fig.appendChild(el('span', {
        class: 'flash-hold-art', dataset: { prop: boo.holding }, html: propHTML(boo.holding, 80),
        style: { bottom: prop.holdBottomPct + '%', width: `max(${PROP_MIN_PX}px, ${(HOLD_SCALE * BOO_CELL_FRAC * 100).toFixed(1)}%)` }
      }));
    }
    return fig;
  }
  // How many Boos fit across before the picture has to become two rows. A prop that has
  // shrunk under PROP_MIN_PX is not a prop any more, so the line breaks instead — into
  // BALANCED rows, which is what keeps each end Boo's neighbour on its own row and makes
  // "who was NEXT TO Pip?" true of what she saw.
  function columnsFor(n) {
    const width = sceneNode.clientWidth || 842;
    return (n * MIN_CELL_PX + (n - 1) * CELL_GAP_PX) <= width ? n : Math.ceil(n / 2);
  }
  function renderScene(circleIds = []) {
    clear(sceneNode);
    lastCircles = Array.isArray(circleIds) ? circleIds : [circleIds];
    const circled = new Set(lastCircles);
    const cols = columnsFor(scene.boos.length);
    let row = null;
    scene.boos.forEach((boo, i) => {
      if (i % cols === 0) {
        row = el('div', { class: 'flash-boo-row' });
        row.style.setProperty('--flash-cols', String(cols));
        sceneNode.appendChild(row);
      }
      row.appendChild(el('div', {
        class: 'flash-boo' + (circled.has(boo.id) ? ' answer-ring' : ''),
        dataset: { id: boo.id, pose: boo.seatedOn ? 'on' : boo.holding ? 'holding' : boo.wearing ? 'wearing' : '' }
      }, [figureNode(boo), el('small', { text: boo.name })]));
    });
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
    // The LEDGER remembers the type of question, not which Boo happened to be asked about:
    // "colour:flash-3" is a different string every scene and would teach the mix nothing.
    recordResult(`flashboos:${question.kind}`, correct);
    correct ? sfx.star() : sfx.oops();
    shell.react(correct ? 'Yes — let’s look again!' : 'Let’s look again together!');
    // Circle the evidence: the Boo the answer is about, or all of them when we counted.
    let proofIds = [];
    if (question.kind === 'count') proofIds = scene.boos.map(boo => boo.id);
    else if (question.kind === 'colour') proofIds = [question.targetId];
    else proofIds = [question.correct];
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
  // Turning a tablet sideways changes how many Boos fit on a line. Redraw the same scene
  // rather than leaving a picture laid out for a width that is gone.
  const onResize = () => { if (phase === 'reveal' || phase === 'answer') renderScene(lastCircles); };
  window.addEventListener('resize', onResize);

  window.__flashboos = {
    scene: () => scene, question: () => question, phase: () => phase,
    hide: hideAndAsk, answer: answerQuestion, revealMs, round: () => round,
    cols: () => columnsFor(scene.boos.length), propMinPx: PROP_MIN_PX,
    // QA: draw a scene that satisfies a predicate, so a suite can check a pose that the
    // generator would otherwise only reach by luck. Composition and question come from the
    // real generator — this picks WHICH of its outputs to show, and nothing else.
    force(pred, tries = 600) {
      for (let i = 0; i < tries; i++) {
        const s = flashScene(tier, Math.random, { toddler });
        const q = flashQuestion(s);
        if (pred(s, q)) { scene = s; question = q; renderScene(); return true; }
      }
      return false;
    }
  };
  return {
    unmount() {
      window.removeEventListener('resize', onResize);
      shell.cancel(timer); shell.cleanup(); delete window.__flashboos;
    }
  };
}
