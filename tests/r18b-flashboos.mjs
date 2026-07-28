// tests/r18b-flashboos.mjs — RUN18B Y4: Flash Boos scenes are composed pictures.
//
// What this suite exists to stop coming back: a scene used to be a row of Boos with a strip
// of 36px icons underneath, and the generator FORCED a ball/swing/bench link whether or not
// the prop was drawn — so "Who sat on the bench?" could be asked of a picture with no bench
// in it. Every assertion below is a form of the same claim: the question may only ask about
// something the picture actually showed, and the picture has to be big enough to see.
//
// Expected runtime: ~25s (measured). Not @serial — nothing here samples frames.

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import {
  flashScene, flashQuestion, flashRelationHolds, validateFlashQuestion,
  FLASH_PROP_BY_KEY, FLASH_TIER_RULES, FLASH_VARIATIONS
} from '../js/brainhelpers.js';

const RAW = process.env.BASE || 'http://127.0.0.1:8000';
const BASE = RAW.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
const RESOLVE = ['--host-resolver-rules=MAP app.localhost 127.0.0.1'];
const SHOTS = 'screenshots/run18b/y4';
mkdirSync(SHOTS, { recursive: true });
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };

const PROP_MIN_PX = 56;
const AK = ['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground', 'boohouse', 'gallery'];
const save = (content, { introSeen = true } = {}) => JSON.stringify({
  version: 17, name: 'Ada', ageAsked: true,
  guide: { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'T' },
  inventory: { boo_inky: 1 },
  stars: { total: 300, byType: { maths: 60, word: 60, puzzle: 60, creative: 60, lesson: 60 }, spent: {}, legacy: 0, byGame: {} },
  trophies: {}, boxes: 0,
  town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 3 },
  seen: { trophyRetro: true, lastStarsShown: 300, introSeen: introSeen ? { flashboos: true } : {}, whatsnewVersion: 'x' },
  settings: { sound: false, music: false, voice: false, content }
});

// ---- 1. 400 generated scenes: every asked relation is depicted --------------------------
console.log('== 1. 400 scenes: no question ever asks about something the picture did not show ==');
{
  const bad = [];
  const kinds = new Set();
  for (let i = 0; i < 400; i++) {
    const tier = ['light', 'medium', 'full'][i % 3];
    const scene = flashScene(tier);
    const q = flashQuestion(scene);
    kinds.add(q.kind);
    if (!flashRelationHolds(scene, q)) bad.push({ tier, q: q.template, items: scene.items });
    if (!validateFlashQuestion(scene, q)) bad.push({ tier, q: q.template, why: 'answers' });
    if (q.answers.includes(undefined)) bad.push({ tier, q: q.template, why: 'undefined answer' });
    if (q.kind === 'nextTo' && q.answers.includes(q.targetId)) {
      bad.push({ tier, q: q.template, why: 'offered the Boo it named as an answer' });
    }
  }
  assert(bad.length === 0, '400 scenes: every asked relation is one the scene composed'
    + (bad.length ? ': ' + JSON.stringify(bad.slice(0, 3)) : ''));
  // and the six authored question types are all reachable
  for (const k of ['on', 'holding', 'wearing', 'colour', 'nextTo', 'count']) {
    assert(kinds.has(k), `question type "${k}" is generated`);
  }
}

// ---- 2. the words only appear when the prop is composed ---------------------------------
console.log('== 2. "swing/bench/ball/balloon/hat" only ever appear when that prop is in the picture ==');
{
  const WORDS = ['swing', 'bench', 'ball', 'balloon', 'hat'];
  const leaks = [];
  for (let i = 0; i < 400; i++) {
    const scene = flashScene(['light', 'medium', 'full'][i % 3]);
    const q = flashQuestion(scene);
    const prompt = q.prompt.toLowerCase();
    const composed = scene.items.map(it => FLASH_PROP_BY_KEY[it.prop].label.toLowerCase());
    for (const word of WORDS) {
      // whole words only: "What colour was Dot?" is not a question about a hat
      if (!new RegExp(`\\b${word}\\b`).test(prompt)) continue;
      // "balloon" contains "ball": the word is only present if a composed prop's LABEL
      // contains it, and the prop that label belongs to is on a Boo in this scene.
      const backed = composed.some(label => label.includes(word) && prompt.includes(label));
      if (!backed) leaks.push({ word, prompt: q.prompt, composed });
    }
    // and every named prop is genuinely on a named Boo
    for (const it of scene.items) {
      if (!scene.boos.some(b => b.id === it.booId)) leaks.push({ why: 'prop on no Boo', it });
    }
  }
  assert(leaks.length === 0, 'a prop word in a question always means that prop is composed with a Boo'
    + (leaks.length ? ': ' + JSON.stringify(leaks.slice(0, 3)) : ''));
}

// ---- 3. scene rules per tier ------------------------------------------------------------
console.log('== 3. Boos and propped counts per tier, colour variation across all ==');
{
  for (const [tier, want] of Object.entries({ light: 1, medium: 2, full: 3 })) {
    const rules = FLASH_TIER_RULES[tier];
    let boosOk = true, proppedOk = true, coloursOk = true, variationOk = true;
    const seenPropped = new Set();
    for (let i = 0; i < 200; i++) {
      const s = flashScene(tier);
      if (s.boos.length !== rules.boos) boosOk = false;
      const propped = new Set(s.items.map(it => it.booId));
      seenPropped.add(propped.size);
      if (propped.size < rules.propped[0] || propped.size > rules.propped[1]) proppedOk = false;
      if (propped.size !== s.items.length) proppedOk = false;      // one prop per Boo
      if (new Set(s.boos.map(b => b.colour)).size !== s.boos.length) coloursOk = false;
      const varied = s.boos.filter(b => b.variation);
      if (rules.variation ? varied.length !== 1 : varied.length !== 0) variationOk = false;
      if (varied.length && !FLASH_VARIATIONS.includes(varied[0].variation)) variationOk = false;
    }
    assert(boosOk, `tier ${want}: ${rules.boos} Boos every time`);
    assert(proppedOk, `tier ${want}: ${rules.propped[0]}${rules.propped[1] > rules.propped[0] ? '–' + rules.propped[1] : ''} propped, one prop each (saw ${[...seenPropped].sort().join('/')})`);
    assert(coloursOk, `tier ${want}: colour variation across ALL of them`);
    assert(variationOk, `tier ${want}: ${rules.variation ? 'exactly one feature variation' : 'no feature variation'}`);
  }
  // counting is a tier-3 question only
  const lightCount = Array.from({ length: 200 }, () => flashQuestion(flashScene('light'))).some(q => q.kind === 'count');
  const fullCount = Array.from({ length: 200 }, () => flashQuestion(flashScene('full'))).some(q => q.kind === 'count');
  assert(!lightCount && fullCount, '"how many Boos" is asked at tier 3+ only');

  // ...and the composed relations are actually asked about. A scene offers one colour
  // question per Boo against two or three prop questions, so sampling instances rather than
  // TYPES would make the poses this packet builds a rarity: the critic measured 20.5%.
  const kinds = Array.from({ length: 600 }, () => flashQuestion(flashScene('full')).kind);
  const propShare = kinds.filter(k => k === 'on' || k === 'holding' || k === 'wearing').length / kinds.length;
  assert(propShare >= 0.3, `a composed prop is what most rounds ask about (${Math.round(propShare * 100)}% of questions)`);
}

const browser = await chromium.launch({ args: RESOLVE });
const errors = [];
async function open(width, height, content, opts = {}) {
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push(String(e).split('\n')[0]));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 140)); });
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), save(content, opts));
  await page.goto(BASE + '/index.html', { waitUntil: 'load', timeout: 25000 });
  await page.waitForFunction(() => window.BooTown && document.getElementById('screen').dataset.screen, null, { timeout: 20000 });
  await page.evaluate(() => window.BooTown.go('flashboos'));
  return { ctx, page };
}

// ---- 4. every prop renders at PROP_MIN_PX or larger, at every width ---------------------
console.log('== 4. a prop is never smaller than 56px, at 390 / 768 / 1024 ==');
{
  const small = [], missed = [], overflow = [];
  for (const [w, h] of [[390, 844], [768, 1024], [1024, 768]]) {
    const { ctx, page } = await open(w, h, 'full');
    await page.waitForSelector('.flash-boo', { timeout: 15000 });
    for (const prop of ['swing', 'bench', 'ball', 'balloon', 'partyhat', 'sunhat']) {
      const got = await page.evaluate(key =>
        window.__flashboos.force(s => s.items.some(it => it.prop === key)), prop);
      if (!got) { missed.push({ w, prop }); continue; }
      const seen = await page.evaluate(() => ({
        props: [...document.querySelectorAll('.flash-seat-art,.flash-hold-art')]
          .map(n => ({ cls: n.classList[0], w: Math.round(n.getBoundingClientRect().width) })),
        // a worn prop is drawn ON the Boo at the Boo's own size, so the Boo is what is measured
        boos: [...document.querySelectorAll('.flash-boo[data-pose="wearing"] .flash-boo-art')]
          .map(n => Math.round(n.getBoundingClientRect().width)),
        // and a Boo seated on a prop still has to read as a Boo beside its standing friends
        seatedRatio: (() => {
          const seat = document.querySelector('.flash-boo-art.seated');
          const stand = document.querySelector('.flash-boo-art:not(.seated)');
          return seat && stand ? seat.getBoundingClientRect().width / stand.getBoundingClientRect().width : null;
        })(),
        docW: document.documentElement.scrollWidth, clientW: document.documentElement.clientWidth
      }));
      seen.props.forEach(p => { if (p.w < PROP_MIN_PX) small.push({ w, prop, ...p }); });
      seen.boos.forEach(bw => { if (bw < PROP_MIN_PX) small.push({ w, prop, cls: 'worn-on-boo', bw }); });
      if (seen.seatedRatio != null && seen.seatedRatio < 0.6) {
        small.push({ w, prop, cls: 'seated-boo-vs-standing', ratio: +seen.seatedRatio.toFixed(2) });
      }
      if (seen.docW > seen.clientW) overflow.push({ w, prop, docW: seen.docW });
    }
    await page.screenshot({ path: `${SHOTS}/scene-${w}x${h}.png` });
    await ctx.close();
  }
  assert(missed.length === 0, 'every prop in the pool can be composed at every width'
    + (missed.length ? ': ' + JSON.stringify(missed) : ''));
  assert(small.length === 0, 'every seated, held and worn prop renders at 56px or more'
    + (small.length ? ': ' + JSON.stringify(small.slice(0, 3)) : ''));
  assert(overflow.length === 0, 'a composed scene never pushes the page sideways'
    + (overflow.length ? ': ' + JSON.stringify(overflow.slice(0, 2)) : ''));
}

// ---- 4b. a held prop is HELD, not worn on the face --------------------------------------
// The critic's first verdict on this packet: the ball and the balloon landed over an eye,
// and a child read it as an eyepatch rather than as something the Boo was holding. The face
// band below is renderBoo's own geometry (eyes at cx 45/75, cy 80, r 14 in the shared
// 120x130 viewBox) turned into fractions of the rendered Boo.
console.log('== 4b. a held prop never crosses the Boo\'s face ==');
{
  // renderBoo's own eye geometry in the shared 120x130 viewBox: two circles at cx 45 / 75,
  // cy 80, r 14. Measured against the prop's largest INK shape (its own <ellipse>), not the
  // svg box — an svg box is mostly empty space and would fail a picture that reads fine.
  const EYES = [{ cx: 45 / 120, cy: 80 / 130, r: 14 / 120 }, { cx: 75 / 120, cy: 80 / 130, r: 14 / 120 }];
  const onEye = [];
  for (const [w, h] of [[390, 844], [768, 1024], [1024, 768]]) {
    const { ctx, page } = await open(w, h, 'full');
    await page.waitForSelector('.flash-boo', { timeout: 15000 });
    for (const prop of ['ball', 'balloon']) {
      const got = await page.evaluate(key =>
        window.__flashboos.force(s => s.items.some(it => it.prop === key)), prop);
      if (!got) continue;
      const hit = await page.evaluate(([key, eyes]) => {
        const boo = window.__flashboos.scene().boos.find(b => b.holding === key);
        const cell = document.querySelector(`.flash-boo[data-id="${boo.id}"]`);
        const b = cell.querySelector('.flash-boo-art').getBoundingClientRect();
        // the prop's biggest drawn shape: the ball itself, or the balloon (not its string)
        const ink = [...cell.querySelectorAll('.flash-hold-art svg > *')]
          .map(n => n.getBoundingClientRect())
          .sort((p, q) => q.width * q.height - p.width * p.height)[0];
        const worst = eyes.map(e => {
          const ex = b.left + e.cx * b.width, ey = b.top + e.cy * b.height;
          const er = e.r * b.width;
          const dx = Math.abs(ink.left + ink.width / 2 - ex), dy = Math.abs(ink.top + ink.height / 2 - ey);
          // normalised ellipse separation: < 1 means the two shapes intersect
          return (dx / (ink.width / 2 + er)) ** 2 + (dy / (ink.height / 2 + er)) ** 2;
        }).sort((p, q) => p - q)[0];
        return { sep: +worst.toFixed(2), inkW: Math.round(ink.width) };
      }, [prop, EYES]);
      if (hit.sep < 1) onEye.push({ w, prop, ...hit });
    }
    await page.screenshot({ path: `${SHOTS}/held-${w}x${h}.png` });
    await ctx.close();
  }
  assert(onEye.length === 0, 'a held ball or balloon never covers an eye at any width'
    + (onEye.length ? ': ' + JSON.stringify(onEye) : ''));
}

// ---- 5. the badge row is gone, and the answers never give the prop away -----------------
console.log('== 5. no icon badges anywhere; the answer buttons draw a plain Boo ==');
{
  const { ctx, page } = await open(1024, 768, 'full');
  await page.waitForSelector('.flash-boo', { timeout: 15000 });
  const badges = await page.evaluate(() =>
    document.querySelectorAll('.flash-owned-props,.flash-prop-icon,.flash-props,.flash-prop').length);
  assert(badges === 0, 'no owned-props badge row survives anywhere');

  // a scene with a hat on a Boo, and a question whose answers are Boos
  const staged = await page.evaluate(() => window.__flashboos.force(
    (s, q) => s.boos.some(b => b.wearing) && q.answerType === 'boo'));
  assert(staged, 'staged a scene with a worn hat and a "who" question');
  const wearer = await page.evaluate(() => {
    const w = window.__flashboos.scene().boos.find(b => b.wearing);
    const cell = document.querySelector(`.flash-boo[data-id="${w.id}"]`);
    return { id: w.id, len: cell.querySelector('.flash-boo-art').innerHTML.length, pose: cell.dataset.pose };
  });
  assert(wearer.pose === 'wearing', 'the wearing Boo is marked as composed with its hat');
  await page.evaluate(() => window.__flashboos.hide());
  await page.waitForSelector('.flash-answer', { timeout: 8000 });
  const btn = await page.evaluate(id => {
    const b = [...document.querySelectorAll('.flash-answer')].find(x => x.dataset.answer === id);
    return b ? b.querySelector('span').innerHTML.length : null;
  }, wearer.id);
  if (btn == null) assert(true, 'the hat wearer was not among this question\'s answers — nothing to give away');
  // the composed Boo carries the hat's extra markup; a plain answer button must be shorter
  else assert(btn < wearer.len, 'the answer button draws that Boo WITHOUT the hat it was wearing');

  await page.evaluate(() => window.__flashboos.answer(window.__flashboos.question().correct));
  await page.waitForTimeout(400);
  const proof = await page.evaluate(() => ({
    rings: document.querySelectorAll('.flash-boo.answer-ring').length,
    curtain: !!document.querySelector('.flash-curtain.down')
  }));
  assert(proof.rings > 0 && !proof.curtain, 'the look-again reveal circles the evidence with the curtain up');
  const seatedOk = await page.evaluate(() => {
    if (!window.__flashboos.force(s => s.items.some(it => it.pose === 'on'))) return null;
    const b = window.__flashboos.scene().boos.find(x => x.seatedOn);
    const cell = document.querySelector(`.flash-boo[data-id="${b.id}"]`);
    const boo = cell.querySelector('.flash-boo-art.seated').getBoundingClientRect();
    const seat = cell.querySelector('.flash-seat-art').getBoundingClientRect();
    // feet on the seat: the Boo's box sits inside the prop's, not beside or below it
    return { inside: boo.left >= seat.left - 2 && boo.right <= seat.right + 2 && boo.bottom <= seat.bottom + 1 };
  });
  assert(seatedOk && seatedOk.inside, 'a seated Boo sits within its prop, feet on the socket');
  await ctx.close();
}

// ---- 6. the first-run intro freezes the memorise timer ----------------------------------
console.log('== 6. the memorise timer does not run behind the first-play intro ==');
{
  const { ctx, page } = await open(1024, 768, 'full', { introSeen: false });
  await page.waitForSelector('.intro-overlay', { timeout: 15000 });
  const revealMs = await page.evaluate(() => window.__flashboos.revealMs);
  assert(revealMs === 3000, 'memorise time is unchanged (full tier: 3000ms)');
  await page.waitForTimeout(revealMs + 900);
  const held = await page.evaluate(() => ({
    phase: window.__flashboos.phase(),
    curtainDown: !!document.querySelector('.flash-curtain.down'),
    intro: !!document.querySelector('.intro-overlay')
  }));
  assert(held.intro && held.phase === 'reveal' && !held.curtainDown,
    'with the intro up, the scene is still on show after the whole memorise time');
  await page.screenshot({ path: `${SHOTS}/intro-freeze.png` });
  await page.click('.intro-skip');
  await page.waitForSelector('.flash-answer', { timeout: revealMs + 6000 });
  assert(true, 'closing the intro starts the memorise time, and the question follows');
  await ctx.close();
}

// ---- 7. a full round, cold, with no console errors --------------------------------------
console.log('== 7. eight rounds end to end ==');
{
  const before = errors.length;
  const { ctx, page } = await open(390, 844, 'medium');
  await page.waitForSelector('.flash-boo', { timeout: 15000 });
  for (let i = 0; i < 8; i++) {
    await page.evaluate(() => window.__flashboos.hide());
    await page.waitForSelector('.flash-answer', { timeout: 8000 });
    if (i === 0) await page.screenshot({ path: `${SHOTS}/question-390x844.png` });
    await page.evaluate(() => window.__flashboos.answer(window.__flashboos.question().correct));
    if (i === 0) { await page.waitForTimeout(300); await page.screenshot({ path: `${SHOTS}/proof-390x844.png` }); }
    await page.waitForTimeout(1600);
  }
  await page.waitForFunction(() => document.getElementById('screen').dataset.screen === 'results', null, { timeout: 12000 });
  assert(true, 'eight rounds of composed scenes reach the results screen');
  assert(errors.length === before, 'no console errors across the round' + (errors.length > before ? ': ' + errors.slice(before, before + 2) : ''));
  await ctx.close();
}

await browser.close();
console.log(failed ? '\nFAIL' : '\nALL PASS');
process.exit(failed ? 1 : 0);
