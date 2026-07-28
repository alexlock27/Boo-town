// @serial
// tests/r18c-expedition.mjs — RUN18C's gate: THE EXPEDITION, PRESENTED.
//
// The run built the presentation layer the Expedition never had. This suite drives the
// whole thing the way a child does — select eight, walk the trail, solve four puzzles,
// receive the postcard — and then measures the things the pack made promises about.
//
// What it will not accept, in order of how badly it burned before:
//   • a Boo rendered as TEXT. The dock was a row of names in default grey buttons, on a
//     screen whose entire puzzle is what Boos LOOK like. Every Boo anywhere in the
//     feature must be real art.
//   • a selection a child cannot see. The pack's 4px --zing ring measures 1.85:1 against
//     the cream tile it sits on, so this asserts the >=3:1 the pack requires against
//     EVERY adjacent colour, not just against one convenient one.
//   • a marker, walker or control outside the box it belongs to, at any of the four
//     viewports. The trail is a fixed-size card on a map that is not.
//   • a walk that is a still. Motion is 6+ frames across 3+ seconds, per the evidence law.
//
// @serial because sections 4 and 6 sample animation frames, which starve under parallel
// board load (CLAUDE.md's documented flake mode). Expected runtime ~75s.

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const SHOTS = 'screenshots/run18c/gate';
mkdirSync(SHOTS, { recursive: true });

let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };

const PARTY = ['boo_inky', 'boo_plum', 'boo_pippin', 'boo_lolly', 'boo_chomp', 'boo_mallow', 'boo_curly', 'boo_wisp'];
const SIXTEEN = PARTY.concat(['boo_beam', 'boo_dot', 'boo_fuzz', 'boo_splash', 'boo_bubbles', 'boo_minty', 'boo_skye', 'boo_candy']);
const save = (inv, extra = {}) => ({
  version: 7, name: 'Ada', guide: {}, ageAsked: true,
  inventory: Object.fromEntries(inv.map(id => [id, 1])),
  // party EMPTY by default: the picker restores a saved party, so a fixture that carries
  // one opens the screen already solved and there is nothing left to choose.
  expedition: { party: [], tiers: {}, progress: {}, ...(extra.expedition || {}) },
  care: { bonds: {}, treats: 0 },
  stars: { total: 60, byGame: {} }, town: { areas: {} },
  seen: { trophyRetro: true, welcomeTour: true, expReveal: true, whatsnewVersion: 'zz' },
  settings: { sound: false, music: false, voice: false }
});

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 768 } });
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

const seed = async (data) => {
  await page.goto(BASE + '/index.html');
  await page.evaluate(s => localStorage.setItem('bootown.save.v1', JSON.stringify(s)), data);
  await page.reload();
  await page.waitForSelector('.hub');
};
const go = async (route, params, sel) => {
  await page.evaluate(([r, p]) => window.BooTown.go(r, p || {}), [route, params]);
  await page.waitForSelector(sel, { timeout: 12000 });
};

// contrast helpers — computed from the REAL rendered colours, blended onto what is behind
const lum = ([r, g, b]) => { const f = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const rgb = str => { const m = String(str).match(/[\d.]+/g) || []; return [+m[0] || 0, +m[1] || 0, +m[2] || 0, m[3] === undefined ? 1 : +m[3]]; };

// ---------------------------------------------------------------------------------------
console.log('== 1. a scripted full expedition: select 8 -> trail -> four puzzles -> postcard ==');
{
  await seed(save(PARTY));
  await go('expedition', {}, '.exp-picker');
  assert(await page.locator('.exp-chip').count() === 8, `the picker shows her ${await page.locator('.exp-chip').count()} Boos as tiles`);
  // the grid rebuilds on every pick, so re-resolve the first UNCHOSEN tile each time —
  // holding a handle across a redraw is holding a node that is no longer on the page
  for (let i = 0; i < 8; i++) { await page.locator('.exp-chip:not(.sel)').first().click(); await page.waitForTimeout(40); }
  const chip = await page.textContent('.exp-count-text');
  assert(chip === 'Explorers: 8 of 8', `the chip counts them in the pack's words: "${chip}"`);
  assert(!(await page.isDisabled('.exp-go')), '"Off we go!" is live at eight');
  await page.click('.exp-go');
  await page.waitForSelector('.exp-trail', { timeout: 12000 });
  assert(true, 'the party departs and the trail opens');
  const nodes = await page.$$('.exp-node');
  assert(nodes.length === 4, `the trail carries its four nodes (${nodes.length})`);

  // four puzzles, in order, each solved through its own api — the same calls the older
  // suites use, so this proves the REBUILT screens still finish.
  for (const node of ['bridges', 'picnic', 'raft', 'hotel']) {
    await go('expeditionpuzzle', { node }, '.exp-puzzle');
    await page.waitForTimeout(150);
    const before = await page.evaluate(() => window.__expeditionPuzzle.state());
    await page.evaluate(async () => {
      const api = window.__expeditionPuzzle;
      const n = document.querySelectorAll('.exp-dock .exp-puzzle-boo').length || 1;
      for (let i = 0; i < Math.max(n, 3); i++) { try { api.try(i); } catch {} await new Promise(r => setTimeout(r, 40)); }
    });
    // the last Boo's 900ms crossing plays before the screen changes under them
    await page.waitForTimeout(1100);
    if (node === 'hotel') break;
    await page.waitForSelector('.exp-trail', { timeout: 14000 });
    const done = await page.evaluate(k => (window.BooTown.State.getState().expedition.progress || {})[k] || 0, node);
    assert(done > 0, `${node}: solved and banked (${done} star${done === 1 ? '' : 's'}), budget was ${before.budget}`);
  }
  // the fourth node ends in the ceremony, not in a return to a list of buttons
  await page.waitForSelector('.exp-postcard-overlay', { timeout: 14000 });
  await page.waitForTimeout(1500);
  const ending = await page.evaluate(() => ({
    guide: window.__expeditionEnding.guideLine(),
    bond: window.__expeditionEnding.bondLine(),
    keep: document.querySelector('.exp-postcard-keep').textContent,
    done: document.querySelector('.exp-postcard-done').textContent,
    img: !!document.querySelector('.exp-postcard-img'),
    bonds: window.BooTown.State.getState().care.bonds
  }));
  assert(ending.guide === 'What an adventure! The Boos sent you a postcard.', `Twiggy says the authored line: "${ending.guide}"`);
  assert(/^Everyone's friendship grew!/.test(ending.bond), `the bond is announced once, about all of them: "${ending.bond}"`);
  assert((ending.bond.match(/\+6/g) || []).length === 1, 'and +6 appears ONCE, not per Boo');
  assert(PARTY.every(id => ending.bonds[id] === 6), 'every party member banked the authored +6 (POINTS.expedition)');
  assert(ending.keep === 'Keep it in the Journal' && ending.done === 'Done', `both authored buttons, verbatim: "${ending.keep}" / "${ending.done}"`);
  assert(ending.img, 'the postcard picture itself is on screen');
  await page.screenshot({ path: SHOTS + '/ending-1024.png' });

  // and every Boo actually arrives on it — six of eight used to be missing
  const drawn = await page.evaluate(async () => {
    const { composePostcard } = await import('./js/expedition/postcard.js');
    const { BY_ID } = await import('./data/catalogue.js');
    const party = ['boo_inky', 'boo_plum', 'boo_pippin', 'boo_lolly', 'boo_chomp', 'boo_mallow', 'boo_curly', 'boo_wisp'].map(id => ({ ...BY_ID[id], id }));
    const { png, plan } = await composePostcard(party, 'hotel');
    const img = await new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = png; });
    const c = document.createElement('canvas'); c.width = plan.width; c.height = plan.height;
    const cx = c.getContext('2d'); cx.drawImage(img, 0, 0);
    const ground = cx.getImageData(40, 300, 1, 1).data;
    return plan.sprites.map(({ x, y }) => { const d = cx.getImageData(Math.round(x), Math.round(y - 36), 1, 1).data; return d[0] !== ground[0] || d[1] !== ground[1] || d[2] !== ground[2]; });
  });
  assert(drawn.length === 8 && drawn.every(Boolean), `all eight Boos are painted on the postcard (${drawn.filter(Boolean).length}/8)`);

  await page.evaluate(() => window.__expeditionEnding.keep());
  await page.waitForTimeout(200);
  const stamped = await page.evaluate(() => !!(window.BooTown.State.getState().journal || {}).expedition_postcard);
  assert(stamped, '[Keep it in the Journal] stamps it');
  await page.evaluate(() => window.__expeditionEnding.done());
  await page.waitForSelector('.exp-trail', { timeout: 12000 });
  await page.waitForTimeout(700);
  const finale = await page.evaluate(() => ({
    lit: document.querySelectorAll('.exp-node.done').length,
    line: (document.querySelector('.exp-complete') || {}).textContent
  }));
  assert(finale.lit === 4, `[Done] returns to a trail with all four stars lit (${finale.lit})`);
  assert(finale.line === 'The whole trail is glowing with stars!', `and the authored line: "${finale.line}"`);
  await page.screenshot({ path: SHOTS + '/trail-complete-1024.png' });
}

// ---------------------------------------------------------------------------------------
console.log('== 2. no text-only Boo survives anywhere in the feature ==');
{
  await seed(save(PARTY, { expedition: { party: PARTY, tiers: {}, progress: {} } }));
  const surfaces = [];
  await go('expedition', {}, '.exp-picker');
  surfaces.push(['party picker', await page.evaluate(() => [...document.querySelectorAll('.exp-chip')].map(b => ({ art: !!b.querySelector('svg'), text: b.textContent.trim() })))]);
  await go('expedition', { trail: true }, '.exp-trail');
  surfaces.push(['trail party', await page.evaluate(() => [...document.querySelectorAll('.exp-walker')].map(b => ({ art: !!b.querySelector('svg'), text: b.textContent.trim() })))]);
  // the Picky Grumps' Picnic is deliberately absent from this loop: its pieces are
  // TOPPINGS, not Boos — it is the one node of the four where the party is not what she
  // is arranging. Its own emoji problem (three faces) is checked straight after.
  for (const node of ['bridges', 'raft', 'hotel']) {
    await go('expeditionpuzzle', { node }, '.exp-puzzle');
    await page.waitForTimeout(120);
    surfaces.push([`${node} dock`, await page.evaluate(() => [...document.querySelectorAll('.exp-dock .exp-puzzle-boo')].map(b => ({ art: !!b.querySelector('svg'), text: b.textContent.trim() })))]);
  }
  await go('expeditionpuzzle', { node: 'picnic' }, '.exp-puzzle');
  await page.waitForTimeout(120);
  const EMOJI = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
  const picnic = await page.evaluate(() => ({
    docks: document.querySelectorAll('.exp-dock .exp-puzzle-boo').length,
    grumps: [...document.querySelectorAll('.picnic-plate')].map(p => ({
      art: !!p.querySelector('.pp-grump svg'),
      text: ((p.querySelector('.pp-grump') || {}).textContent || '')
    })),
    tray: document.querySelectorAll('.picnic-tray .topping').length
  }));
  assert(picnic.docks === 0, 'picnic: no Boo dock, because its pieces are toppings, not Boos');
  assert(picnic.grumps.length > 0 && picnic.grumps.every(g => g.art && !EMOJI.test(g.text)),
    `picnic: every Grump is drawn and none is an emoji (${picnic.grumps.length} plate(s))`);
  assert(picnic.tray === 8, `picnic: the authored eight toppings are on the tray (${picnic.tray})`);
  for (const [where, list] of surfaces) {
    const bare = list.filter(x => !x.art);
    assert(list.length > 0 && bare.length === 0, `${where}: ${list.length} Boos, all real art${bare.length ? ' — text-only: ' + bare.map(b => b.text).join(', ') : ''}`);
  }
  // the markers too: the four nodes were emoji in a text node
  await go('expedition', { trail: true }, '.exp-trail');
  const markers = await page.evaluate(() => [...document.querySelectorAll('.exp-node')].map(n => ({
    art: !!n.querySelector('.exp-node-art svg'),
    emoji: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(n.textContent)
  })));
  assert(markers.length === 4 && markers.every(m => m.art && !m.emoji), 'every trail marker is a drawing, and no emoji is left on one');
}

// ---------------------------------------------------------------------------------------
console.log('== 3. the selected state is >=3:1 against the unselected one, on every side ==');
{
  await seed(save(PARTY));
  await go('expedition', {}, '.exp-picker');
  await page.click('.exp-chip');
  await page.waitForTimeout(120);
  const colours = await page.evaluate(() => {
    const sel = document.querySelector('.exp-chip.sel'), un = document.querySelector('.exp-chip:not(.sel)');
    const cs = getComputedStyle(sel), cu = getComputedStyle(un);
    const card = getComputedStyle(document.querySelector('.exp-party-card'));
    return { ring: cs.boxShadow, selBorder: cs.borderTopColor, unBorder: cu.borderTopColor,
      selBg: cs.backgroundColor, unBg: cu.backgroundColor, cardBg: card.backgroundColor,
      ringWidths: cs.boxShadow.match(/(\d+)px/g) };
  });
  // the pack's ring is 4px --zing (#35D0BA). It is bounded by ink on both sides because
  // teal on cream is 1.85:1 — so the indicator is judged at EVERY adjacency it has.
  const zing = [53, 208, 186], ink = [42, 27, 78];
  assert(/rgb\(53, 208, 186\)/.test(colours.ring), `the ring is the pack's --zing (${colours.ring.slice(0, 60)}…)`);
  assert(ratio(zing, ink) >= 3, `--zing against the ink that bounds it: ${ratio(zing, ink).toFixed(2)}:1`);
  assert(ratio(ink, rgb(colours.cardBg)) >= 3, `that ink against the card behind it: ${ratio(ink, rgb(colours.cardBg)).toFixed(2)}:1`);
  const selB = rgb(colours.selBorder), unB = rgb(colours.unBorder);
  const blend = (fg, bg) => fg.slice(0, 3).map((c, i) => Math.round(c * fg[3] + bg[i] * (1 - fg[3])));
  const unOnCard = blend(unB, rgb(colours.cardBg));
  assert(ratio(selB.slice(0, 3), unOnCard) >= 3, `and the selected tile's own border against the unselected one's: ${ratio(selB.slice(0, 3), unOnCard).toFixed(2)}:1`);
}

// ---------------------------------------------------------------------------------------
console.log('== 4. the walk between nodes is motion, not a still (6+ frames, 3+ seconds) ==');
{
  await seed(save(PARTY, { expedition: { party: PARTY, tiers: {}, progress: { bridges: 3 } } }));
  const t0 = Date.now();
  await go('expedition', { trail: true, from: 'bridges' }, '.exp-trail');
  const frames = [];
  for (let i = 0; i < 14; i++) {
    frames.push({ t: Date.now() - t0, ...await page.evaluate(() => {
      const b = window.__expeditionTrail.walkerBoxes()[0] || { x: 0, y: 0 };
      return { x: b.x, y: b.y, camp: window.__expeditionTrail.campShown() };
    }) });
    await page.waitForTimeout(420);
  }
  const span = frames[frames.length - 1].t - frames[0].t;
  const distinct = new Set(frames.map(f => `${f.x},${f.y}`)).size;
  const dx = Math.max(...frames.map(f => f.x)) - Math.min(...frames.map(f => f.x));
  assert(span >= 3000, `the walk was sampled across ${span}ms`);
  assert(distinct >= 6, `${distinct} distinct positions — this is a walk, not a jump`);
  assert(dx > 60, `and the party actually travelled (${dx}px of x)`);
  const campFrames = frames.filter(f => f.camp).length;
  assert(campFrames >= 3, `the cocoa camp holds its own beat in the middle (${campFrames} frames, ~${campFrames * 420}ms)`);
  const arrived = await page.evaluate(() => window.__expeditionTrail.walking());
  assert(arrived === false, 'and the party arrives and stops');
}

// ---------------------------------------------------------------------------------------
console.log('== 5. every screen, every viewport: nothing escapes, nothing is under 56px ==');
{
  const VIEWS = [[1024, 768], [768, 1024], [390, 844], [844, 390]];
  for (const [w, h] of VIEWS) {
    await page.setViewportSize({ width: w, height: h });
    await seed(save(SIXTEEN, { expedition: { party: PARTY, tiers: { picnic: 4, hotel: 4 }, progress: { bridges: 2 } } }));
    const screens = [['expedition', {}, '.exp-picker'], ['expedition', { trail: true }, '.exp-trail'],
      ['expeditionpuzzle', { node: 'bridges' }, '.exp-puzzle'], ['expeditionpuzzle', { node: 'picnic' }, '.exp-puzzle'],
      ['expeditionpuzzle', { node: 'raft' }, '.exp-puzzle'], ['expeditionpuzzle', { node: 'hotel' }, '.exp-puzzle']];
    for (const [route, params, sel] of screens) {
      await go(route, params, sel);
      await page.waitForTimeout(220);
      const r = await page.evaluate(() => {
        const vis = el => { const b = el.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
        const btns = [...document.querySelectorAll('#screen button')].filter(vis);
        const small = btns.filter(b => { const r = b.getBoundingClientRect(); return r.width < 56 || r.height < 56; })
          .map(b => `${(b.className || '').split(' ')[0] || b.tagName}:${Math.round(b.getBoundingClientRect().width)}x${Math.round(b.getBoundingClientRect().height)}`);
        const offscreen = btns.filter(b => { const r = b.getBoundingClientRect(); return r.right > window.innerWidth + 1 || r.left < -1; })
          .map(b => (b.className || '').split(' ')[0]);
        const map = document.querySelector('.exp-map');
        const escaping = map ? [...document.querySelectorAll('.exp-node')].filter(n => {
          const a = n.getBoundingClientRect(), m = map.getBoundingClientRect();
          return a.left < m.left - 1 || a.right > m.right + 1 || a.top < m.top - 1 || a.bottom > m.bottom + 1;
        }).length : 0;
        return { small, offscreen, escaping, hscroll: document.documentElement.scrollWidth > window.innerWidth };
      });
      const tag = `${w}x${h} ${route}${params.node ? ':' + params.node : params.trail ? ':trail' : ''}`;
      assert(r.small.length === 0, `${tag}: every control is a real target${r.small.length ? ' — ' + r.small.slice(0, 4).join(', ') : ''}`);
      assert(r.offscreen.length === 0, `${tag}: nothing is off the side of the screen${r.offscreen.length ? ' — ' + r.offscreen.slice(0, 4).join(', ') : ''}`);
      assert(r.escaping === 0, `${tag}: no trail marker escapes its map`);
      assert(!r.hscroll, `${tag}: the page does not scroll sideways`);
    }
  }
  await page.setViewportSize({ width: 1024, height: 768 });
}

// ---------------------------------------------------------------------------------------
console.log('== 6. the rule stays, and a wrong guess names the Boo AND the rule ==');
{
  await seed(save(PARTY, { expedition: { party: PARTY, tiers: {}, progress: {} } }));
  await go('expeditionpuzzle', { node: 'bridges' }, '.exp-puzzle');
  await page.waitForTimeout(180);
  const opening = await page.evaluate(() => ({ rule: window.__expeditionPuzzle.ruleText(), live: window.__expeditionPuzzle.liveText(), rules: window.__expeditionPuzzle.rules().map(r => r.text) }));
  assert(/^One bridge sneezes at /.test(opening.rule), `the banner states the generated rule: "${opening.rule}"`);
  assert(opening.rules.length && opening.rule.includes(opening.rules[0]), 'and it quotes the engine\'s own description of it');
  assert(opening.live !== opening.rule, `the live line is its own sentence, not an echo: "${opening.live}"`);

  const wrong = await page.evaluate(async () => {
    const { BY_ID } = await import('./data/catalogue.js');
    const rules = window.__expeditionPuzzle.rules();
    const tiles = [...document.querySelectorAll('.exp-dock .exp-puzzle-boo')];
    const i = tiles.findIndex(t => rules[0].pred({ ...BY_ID[t.dataset.id], id: t.dataset.id }));
    const name = tiles[i].querySelector('.epb-name').textContent;
    tiles[i].click();
    await new Promise(r => setTimeout(r, 40));
    document.querySelectorAll('.bridge-guardian')[1].click();     // the other bridge: wrong
    await new Promise(r => setTimeout(r, 80));
    return { name, live: window.__expeditionPuzzle.liveText(), rule: window.__expeditionPuzzle.ruleText(),
      wobbling: !!document.querySelector('.exp-puzzle-boo.wobble'), ruleText: rules[0].text };
  });
  assert(wrong.live.includes(wrong.name), `the wrong-guess line names the Boo she picked: "${wrong.live}"`);
  assert(wrong.live.includes(wrong.ruleText), 'and names the rule it broke');
  assert(wrong.wobbling, 'the guessed Boo wobbles, as the pack writes it');
  assert(/^One bridge sneezes at /.test(wrong.rule), 'and the RULE IS STILL ON SCREEN after the mistake');
}

// ---------------------------------------------------------------------------------------
console.log('== 7. the front door, and the offline law ==');
{
  await seed(save(PARTY));
  const contained = await page.evaluate(async () => (await import('./data/expedition.js')).CONTAINED);
  assert(contained === '', 'the containment switch is empty — every door is open');
  const card = await page.evaluate(() => {
    const b = [...document.querySelectorAll('.game-card')].find(x => /Boo Expedition/.test(x.textContent));
    return b ? { disabled: b.disabled, tag: (b.querySelector('.gc-tag') || {}).textContent, art: !!b.querySelector('.gc-icon svg') } : null;
  });
  assert(card && !card.disabled, 'the hub card opens');
  assert(card.tag === 'Pick 8 brave Boos and solve the trail!', `and wears the pack's blurb: "${card.tag}"`);
  assert(card.art, 'with the trail in miniature, drawn');
  // RUN18C added no new js/ or data/ file, so the offline law is a check that the files it
  // DID change are still all precached — a file that leaves ASSETS breaks offline silently.
  const missing = await page.evaluate(async () => {
    const text = await (await fetch('./sw.js')).text();
    return ['js/expedition/trail.js', 'js/expedition/puzzle.js', 'js/expedition/postcard.js', 'js/art.js', 'data/expedition.js', 'css/styles.css']
      .filter(f => !text.includes(f));
  });
  assert(missing.length === 0, `every file this run touched is still in sw.js ASSETS${missing.length ? ' — missing: ' + missing.join(', ') : ''}`);
}

assert(errors.length === 0, `zero console errors across the whole run${errors.length ? ' — ' + errors.slice(0, 3).join(' | ') : ''}`);
await browser.close();
console.log('RESULT: ' + (failed ? 'FAIL' : 'PASS'));
process.exit(failed ? 1 : 0);
