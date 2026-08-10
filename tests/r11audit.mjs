// tests/r11audit.mjs — audit-pass fixes, kept as permanent guards.
//  1) the service worker must serve cache-busted URLs from the PRECACHE (js/hub.js?v=5 was
//     504-ing offline, so the home screen never loaded on a cold cache);
//  2) every visible control carries an accessible name and a 44px touch target;
//  3) the Expedition picker has a real first-run state instead of a dead Start button.
// Expected runtime: ~7s (measured 2026-08-10, serial). Not @serial.
import { chromium } from 'playwright';
const RAW = process.env.BASE || 'http://127.0.0.1:8000';
const BASE = RAW.replace('127.0.0.1', 'app.localhost').replace('//localhost', '//app.localhost');
let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };

const AK = ['meadow','riverside','hilltop','beach','funfair','playground','boohouse','gallery'];
const SAVE = (inv, stars) => JSON.stringify({ version: 14, name: 'Ada', ageAsked: true,
  guide: { species:'giraffe', body:'sunshine', pattern:'spots', patternColour:'cocoa', eyes:'round', acc:'none', name:'T' },
  inventory: inv, stars: { total: stars, byGame: {} }, trophies: {},
  town: { areas: Object.fromEntries(AK.map(k => [k, { items: [], paths: [] }])) },
  care: { bonds: {}, treats: 0 }, expedition: { party: [], tiers: {}, progress: {} },
  seen: { trophyRetro: true, lastStarsShown: stars },
  settings: { sound:false, music:false, voice:false, content:'full' } });

// app.localhost must reach THIS dev server. It is only a loopback alias, so anything else
// bound to the port (Docker Desktop binds 0.0.0.0:8000 on this machine) can answer first and
// serve 404s from the wrong directory. Pin the resolution so the suite is not hostage to it.
const RESOLVE = ['--host-resolver-rules=MAP app.localhost 127.0.0.1'];
const browser = await chromium.launch({ args: RESOLVE });

console.log('== cache-busted module URLs are served from the precache offline ==');
{
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/index.html`, { waitUntil: 'load', timeout: 15000 });
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1200);
  // drop any RUNTIME-cached query variants so this proves the PRECACHE, not a lucky re-fetch
  await page.evaluate(async () => {
    for (const k of await caches.keys()) { const c = await caches.open(k);
      for (const r of await c.keys()) if (r.url.includes('?v=')) await c.delete(r); }
  });
  await ctx.setOffline(true);
  const r = await page.evaluate(async () => {
    const g = async (u) => { try { const res = await fetch(u); return res.ok; } catch { return false; } };
    return { hub: await g('js/hub.js?v=5'), main: await g('js/main.js?v=6'), plain: await g('js/town.js') };
  });
  assert(r.hub, 'js/hub.js?v=5 resolves offline (the home screen loads on a cold cache)');
  assert(r.main, 'js/main.js?v=6 resolves offline');
  assert(r.plain, 'an unversioned module still resolves offline');
  await ctx.close();
}

console.log('== every visible control is named and big enough to tap ==');
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), SAVE({ boo_inky: 1, boo_plum: 1 }, 300));
  await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.BooTown, null, { timeout: 12000 });
  for (const route of ['hub', 'town', 'grownups', 'collection', 'worldmap']) {
    await page.evaluate(r => window.BooTown.go(r), route);
    await page.waitForTimeout(700);
    const d = await page.evaluate(() => {
      const bad = { nameless: [], small: [] };
      for (const b of document.querySelectorAll('button, [role=button]')) {
        const rc = b.getBoundingClientRect(), st = getComputedStyle(b);
        if (st.visibility === 'hidden' || st.display === 'none' || rc.width === 0) continue;
        if (!((b.getAttribute('aria-label') || '').trim() || b.textContent.trim())) bad.nameless.push(b.className || b.tagName);
        // the switch grows its hit area with a pseudo-element, so measure that too
        const pb = getComputedStyle(b, '::before');
        const grow = pb.content !== 'none' ? Math.abs(parseFloat(pb.top) || 0) * 2 : 0;
        if (rc.height + grow < 40 || rc.width < 40) bad.small.push(`${b.className}:${Math.round(rc.width)}x${Math.round(rc.height)}`);
      }
      return bad;
    });
    assert(d.nameless.length === 0, `${route}: every control has an accessible name ${d.nameless.slice(0,3).join(',')}`);
    assert(d.small.length === 0, `${route}: every control meets the 44px touch target ${d.small.slice(0,3).join(',')}`);
  }
  await ctx.close();
}

console.log('== the Expedition picker has a real first-run state ==');
// RUN18C C1 rebuilt the party select as a screen: the short-party explanation moved from
// the .exp-guests banner (whose old "win some stars" copy died with 1965e44) into the
// .exp-need card, whose line is authored in trail.js (NEED_MORE_BOOS, pack C6 verbatim)
// and whose one useful action is "See my Boos" -> the collection. Assert THAT state.
{
  for (const inv of [{}, { boo_inky: 1, boo_plum: 1, boo_pippin: 1 }]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    page.on('pageerror', e => { failed = true; console.log('  ✗ PAGE ERROR:', e.message); });
    await page.addInitScript(s => localStorage.setItem('bootown.save.v1', s), SAVE(inv, 100));
    await page.goto(`${BASE}/index.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => window.BooTown, null, { timeout: 12000 });
    await page.evaluate(() => window.BooTown.go('expedition'));
    await page.waitForSelector('.exp-picker', { timeout: 8000 });
    await page.waitForSelector('.exp-need:not([hidden])', { timeout: 8000 });
    const d = await page.evaluate(async () => {
      const { NEED_MORE_BOOS } = await import('./js/expedition/trail.js');
      const btn = document.querySelector('.exp-need .exp-see-boos');
      return {
        line: (document.querySelector('.exp-need .exp-need-line') || {}).textContent || '',
        authored: NEED_MORE_BOOS,
        action: !!btn && btn.offsetParent !== null
      };
    });
    assert(d.line === d.authored && d.line.length > 0, `a short party is explained warmly, verbatim from the pack ("${d.line}")`);
    assert(d.action, 'and offers the one useful action (See my Boos)');
    // the door really opens: the one action lands on the collection
    await page.click('.exp-need .exp-see-boos');
    await page.waitForFunction(() => document.getElementById('screen').dataset.screen === 'collection', null, { timeout: 8000 });
    assert(true, 'and it opens the collection');
    await ctx.close();
  }
}

await browser.close();
console.log('RESULT: ' + (failed ? 'FAIL' : 'PASS'));
process.exit(failed ? 1 : 0);
