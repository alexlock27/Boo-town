// js/jokeboo.js — the Joke Boo's little stage (RUN17 X1).
//
// Feel goal: a child telling one of these at the dinner table. So the rhythm matters more
// than the screen does — setup, a beat of anticipation with an eyebrow up, then the
// punchline on a rimshot and a giggle. Nothing here is scored, timed or lost.
//
// The jokes are AUTHORED in CONTENT_JOKES.md and live in data/jokes.js. This file tells
// them; it never writes one.
//
// Two rhythms:
//   • setup jokes (animal / silly / boo): setup -> eyebrow beat -> punchline.
//   • knock knock: the authored FOUR-LINE exchange, advanced by her taps, so the
//     back-and-forth lands the way it does out loud. `interrupt:true` (Interrupting Boo)
//     fires its punchline EARLY, over her "Interrupting Boo who?" — that early beat is
//     the whole joke, so it is not a tap she has to make.
//
// Toddler tier draws ONLY from the authored simple:true subset, is fully spoken, and
// advances itself on timers — a three-year-old should never be stranded mid-joke waiting
// for a tap she does not know to make.

import { el, clear, backControl, REDUCED } from './ui.js';
import { getState } from './state.js';
import { renderBoo } from './art.js';
import { speakMaybe } from './guide.js';
import { sfx, band } from './sfx.js';
import { contentTier } from './content.js';
import { stampJournal, hasStamp } from './quests.js';
import { maybeIntro, replayIntro, createRoundTimers } from './intro.js';
import { BY_ID } from '../data/catalogue.js';
import { JOKE_TYPES, poolFor, createJokeBag, jokeId, jokeTitle } from '../data/jokes.js';

// Three short steps, under 12 words each (CLAUDE.md: every game teaches itself). Held
// here rather than in js/intro.js so the Joke Boo owns its own words.
const INTRO_STEPS = [
  { text: 'Pick a kind of joke and I’ll tell you one!' },
  { text: 'Tap to hear each line. Knock knock jokes take turns!' },
  { text: 'Tap the heart to keep a joke in your Journal.' }
];

// A rimshot, built from the existing drum pads (CLAUDE.md: all audio routes through
// js/sfx.js — no new audio primitives, just a new arrangement of the old ones).
function rimshot() {
  try {
    band.drum('tom1', { vel: 0.9 });
    setTimeout(() => band.drum('snare', { vel: 1 }), 130);
    setTimeout(() => band.drum('cymbal', { vel: 0.8 }), 260);
  } catch { /* audio not started yet — the joke still reads */ }
}

// Whose Boo is telling it: the first Boo she actually owns, else a catalogue regular so
// the stage is never empty on a brand-new save.
function tellerItem() {
  const s = getState();
  const inv = (s && s.inventory) || {};
  const owned = Object.keys(inv).filter(id => inv[id] > 0 && BY_ID[id] && BY_ID[id].kind === 'boo');
  return BY_ID[owned[0]] || BY_ID.boo_inky;
}

export function mount(container, params, ctx) {
  const tier = contentTier();
  const toddler = tier === 'toddler';
  const clock = createRoundTimers();   // freezes whole while the intro / "?" overlay is up

  const root = el('div', { class: 'screen jokeboo' });
  container.appendChild(root);

  const teller = tellerItem();

  // ---- chrome ----
  const help = el('button', { class: 'help-btn jb-help', 'aria-label': 'How to play', text: '?',
    onclick: () => replayIntro('jokeboo', INTRO_STEPS) });
  // Back goes where she CAME FROM. Until RUN18A H3 the stage in the Meadow was the only
  // door, so "back" could safely mean the Meadow — but H3 adds a card to the hub's Play
  // grid, and a front door whose Back drops her out of a different door strands her in a
  // field with no idea how she got there. The in-world door says so (`from: 'town'`);
  // every other way in — the hub card, What's New — lands back on the hub.
  const cameFromTown = (params && params.from) === 'town';
  const top = el('header', { class: 'jb-top' }, [
    backControl(() => (cameFromTown ? ctx.go('town', { area: 'meadow' }) : ctx.go('hub')), { label: 'Back' }),
    el('h1', { class: 'jb-title', text: 'The Joke Boo' }),
    help
  ]);

  // ---- the picker: four type cards ----
  const picker = el('div', { class: 'jb-picker' });
  const pickerLead = el('p', { class: 'jb-lead', text: 'What kind of joke do you fancy?' });

  // ---- the stage ----
  const booArt = el('div', { class: 'jb-boo-art', html: renderBoo(teller, { size: 150, cls: 'art-idle' }) });
  const brow = el('span', { class: 'jb-brow', 'aria-hidden': 'true' });
  const booWrap = el('div', { class: 'jb-boo' }, [booArt, brow]);
  const bubble = el('div', { class: 'jb-bubble', 'aria-live': 'polite' });
  const speakerTag = el('span', { class: 'jb-who' });
  const tapHint = el('span', { class: 'jb-tap-hint', text: 'tap to carry on' });
  const stageInner = el('div', { class: 'jb-stage-inner' }, [
    el('div', { class: 'jb-said' }, [speakerTag, bubble]),
    booWrap
  ]);
  // The whole stage is the tap target — a child should not have to find a small button
  // to hear the next line.
  const stage = el('button', {
    class: 'jb-stage', 'aria-label': 'Tap for the next line',
    onclick: () => advance()
  }, [stageInner, tapHint]);

  const heart = el('button', { class: 'jb-heart', 'aria-label': 'Keep this joke in your Journal', onclick: favourite },
    [el('span', { class: 'jb-heart-ic', text: '♡' })]);
  const againBtn = el('button', { class: 'btn jb-again', text: 'Tell me another!', onclick: () => tellAnother() });
  const backToTypes = el('button', { class: 'btn soft jb-types', text: 'Another kind of joke', onclick: () => showPicker() });
  const stageBtns = el('div', { class: 'jb-btns' }, [heart, againBtn, backToTypes]);
  const stageWrap = el('section', { class: 'jb-stage-wrap', style: { display: 'none' } }, [stage, stageBtns]);

  root.append(top, pickerLead, picker, stageWrap);

  // ---- state ----
  // One bag per type, held for the life of the screen: a joke never repeats until its
  // type's pool has cycled. Nothing about which jokes she heard is ever saved.
  const bags = {};
  let type = null, joke = null, script = [], beat = 0, timer = null, ended = false;

  for (const t of JOKE_TYPES) {
    const pool = poolFor(t.key, tier);
    if (!pool.length) continue;   // defensive: a tier with nothing to tell shows no card
    bags[t.key] = createJokeBag(pool);
    picker.appendChild(el('button', { class: 'jb-card jb-card-' + t.key, dataset: { type: t.key }, onclick: () => { sfx.tap(); start(t.key); } }, [
      el('span', { class: 'jb-card-ic', text: t.icon }),
      el('span', { class: 'jb-card-name', text: t.name }),
      el('span', { class: 'jb-card-sub', text: t.blurb })
    ]));
  }

  function showPicker() {
    sfx.tap();
    stop();
    stageWrap.style.display = 'none';
    picker.style.display = '';
    pickerLead.style.display = '';
    type = null; joke = null;
  }

  function start(t) {
    type = t;
    picker.style.display = 'none';
    pickerLead.style.display = 'none';
    stageWrap.style.display = '';
    tellAnother();
  }

  // ---- building the script for one joke -------------------------------------------
  // Every beat is { who:'boo'|'child', text, pose, punch? }. The knock-knock exchange is
  // the authored four lines plus the response; a setup joke is setup -> beat -> punchline.
  function scriptFor(j) {
    if (j.type === 'knock') {
      const lines = [
        { who: 'boo',   text: 'Knock knock!',        pose: 'tell' },
        { who: 'child', text: 'Who’s there?',        pose: 'wait' },
        { who: 'boo',   text: j.name + '.',          pose: 'tell' },
        { who: 'child', text: j.name + ' who?',      pose: 'beat', interrupted: !!j.interrupt },
        { who: 'boo',   text: j.response,            pose: 'punch', punch: true }
      ];
      // Interrupting Boo cuts her off: she gets as far as "Interrupting Boo wh—".
      if (j.interrupt) lines[3].text = j.name + ' wh—';
      return lines;
    }
    return [
      { who: 'boo', text: j.setup,     pose: 'tell' },
      { who: 'boo', text: j.setup,     pose: 'beat' },   // the eyebrow goes up; the setup stays
      { who: 'boo', text: j.punchline, pose: 'punch', punch: true }
    ];
  }

  function tellAnother() {
    stop();
    const bag = bags[type];
    if (!bag) return;
    joke = bag.draw();
    script = scriptFor(joke);
    beat = -1;
    ended = false;
    renderHeart();
    advance();
  }

  function stop() {
    if (timer) { clock.cancel(timer); timer = null; }
  }

  function advance() {
    if (!joke) return;
    if (ended) { tellAnother(); return; }   // a tap after the punchline asks for another
    stop();
    beat++;
    if (beat >= script.length) { finish(); return; }
    render(script[beat]);
  }

  function render(b) {
    speakerTag.textContent = b.who === 'boo' ? 'Boo' : 'You';
    speakerTag.className = 'jb-who ' + b.who;
    bubble.textContent = b.text;
    bubble.classList.remove('pop'); void bubble.offsetWidth; bubble.classList.add('pop');
    booWrap.dataset.pose = b.pose;
    brow.style.display = b.pose === 'beat' ? '' : 'none';
    speakMaybe(b.text);

    if (b.punch) {
      rimshot();
      booWrap.classList.remove('giggle'); void booWrap.offsetWidth; booWrap.classList.add('giggle');
      sfx.giggle();
      finishAfter();
      return;
    }
    // The interrupted line does NOT wait for a tap — the punchline lands on top of it.
    if (b.interrupted) { timer = clock.after(REDUCED ? 260 : 520, () => advance()); return; }
    // A setup joke keeps its own rhythm: the eyebrow beat and the punchline arrive on
    // their own so the timing is the joke's, not the child's. She can always tap ahead.
    if (joke.type !== 'knock') { timer = clock.after(beat === 0 ? (REDUCED ? 700 : 1500) : (REDUCED ? 400 : 900), () => advance()); return; }
    // Knock knock is a conversation: she takes her turn. Toddler advances itself.
    if (toddler) timer = clock.after(REDUCED ? 700 : 1500, () => advance());
  }

  function finishAfter() {
    ended = true;
    tapHint.textContent = 'tap for another';
  }

  function finish() { finishAfter(); }

  // ---- the Journal joke book -------------------------------------------------------
  function renderHeart() {
    const on = joke && hasStamp('joke_' + jokeId(joke));
    heart.classList.toggle('on', !!on);
    heart.querySelector('.jb-heart-ic').textContent = on ? '♥' : '♡';
    heart.setAttribute('aria-pressed', String(!!on));
    heart.setAttribute('aria-label', on ? 'Kept in your Journal' : 'Keep this joke in your Journal');
  }
  function favourite() {
    if (!joke) return;
    const fresh = stampJournal('joke_' + jokeId(joke));
    renderHeart();
    if (fresh) { sfx.star(); heart.classList.remove('bump'); void heart.offsetWidth; heart.classList.add('bump'); }
    else sfx.tap();
  }

  maybeIntro('jokeboo', INTRO_STEPS);

  // ---- test hook -------------------------------------------------------------------
  if (typeof window !== 'undefined') window.__jokeboo = {
    types: () => [...picker.querySelectorAll('.jb-card')].map(c => c.dataset.type),
    pick: (t) => { start(t); return true; },
    // the joke currently being told, by its stable authored id
    current: () => (joke ? { id: jokeId(joke), type: joke.type, simple: !!joke.simple, interrupt: !!joke.interrupt } : null),
    beat: () => beat,
    beats: () => script.map(b => ({ who: b.who, text: b.text, pose: b.pose, punch: !!b.punch })),
    said: () => bubble.textContent,
    who: () => speakerTag.textContent,
    pose: () => booWrap.dataset.pose,
    ended: () => ended,
    tap: () => { advance(); return bubble.textContent; },
    // run a whole joke to its punchline without waiting on the timers
    run: () => { let guard = 0; while (!ended && guard++ < 12) advance(); return bubble.textContent; },
    another: () => { tellAnother(); return jokeId(joke); },
    favourite: () => { favourite(); return heart.classList.contains('on'); },
    favourited: () => heart.classList.contains('on'),
    // draw N jokes of a type and report their ids, for the no-repeat cycle assertion
    drawIds: (t, n) => {
      const bag = bags[t]; const out = [];
      for (let i = 0; i < n; i++) { const j = bag.draw(); out.push(jokeId(j)); }
      return out;
    },
    poolSize: (t) => (bags[t] ? bags[t].size : 0),
    tier: () => tier
  };

  return {
    unmount() {
      stop();
      clock.dispose();
      if (typeof window !== 'undefined' && window.__jokeboo) delete window.__jokeboo;
    }
  };
}

export { jokeTitle };
