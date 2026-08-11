// tests/r11q9-zeronet.mjs — RUN11 Q9 / F-10: the share path's zero-network guard, plus a
// standing grep that js/ contains no other fetch/XHR/WebSocket egress.
import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { assertDataUrl } from '../js/gallery.js';

let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };

console.log('== the share guard accepts only local data: URLs ==');
{
  assert(assertDataUrl('data:image/png;base64,AAAA') === 'data:image/png;base64,AAAA', 'a data: URL passes through unchanged');
  const throwsOn = (v) => { try { assertDataUrl(v); return false; } catch { return true; } };
  assert(throwsOn('https://example.com/art.png'), 'an https URL throws');
  assert(throwsOn('http://127.0.0.1:8000/art.png'), 'a same-origin http URL still throws (no network, ever)');
  assert(throwsOn('//evil.test/x.png'), 'a protocol-relative URL throws');
  assert(throwsOn('blob:https://example.com/abc'), 'a blob: URL throws');
  assert(throwsOn(undefined) && throwsOn(null) && throwsOn(42), 'non-strings throw');
}

console.log('== the guard actually gates the only fetch() in js/ ==');
{
  const src = readFileSync('js/gallery.js', 'utf8');
  const guardIdx = src.indexOf('assertDataUrl(a.png)');
  const fetchIdx = src.indexOf('await fetch(a.png)');
  assert(guardIdx > 0 && fetchIdx > 0 && guardIdx < fetchIdx, 'assertDataUrl runs before the fetch call');
  assert(/ZERO-NETWORK INVARIANT/.test(src), 'the invariant is stated in a comment for future greppers');
}

console.log('== no other network egress anywhere in js/ ==');
{
  const files = execSync('git ls-files js', { encoding: 'utf8' }).split('\n').filter(f => f.endsWith('.js'));
  const offenders = [];
  for (const f of files) {
    const src = readFileSync(f, 'utf8');
    src.split('\n').forEach((ln, i) => {
      if (/\bnew WebSocket\b|\bXMLHttpRequest\b|\bnavigator\.sendBeacon\b|\bEventSource\b/.test(ln)) offenders.push(`${f}:${i + 1} ${ln.trim().slice(0, 70)}`);
      // RUN21H B3 (RULE CHANGED — see below): sfx.js may fetch, but ONLY the sample files,
      // and §4 proves every one of them is same-origin and precached.
      if (/\bfetch\s*\(/.test(ln) && !/gallery\.js$/.test(f) && !/sfx\.js$/.test(f)) offenders.push(`${f}:${i + 1} ${ln.trim().slice(0, 70)}`);
    });
  }
  if (offenders.length) offenders.forEach(o => console.log('   ' + o));
  assert(offenders.length === 0, `js/ contains no fetch/XHR/WebSocket/beacon outside the guarded share path and the sample loader (found ${offenders.length})`);
}

// ---------------------------------------------------------------------------------------
// RUN21H B3 — RULE CHANGED, and it STRENGTHENS this suite rather than relaxing it.
//
// Before tonight the rule was "js/ contains no fetch at all outside gallery.js". Real
// recorded sounds (GOVERNANCE §3a') mean js/sfx.js now fetches its sample files. The rule
// is therefore restated, and the new form is stricter about what it permits:
//
//   a same-origin request for a path that is present in sw.js ASSETS[] is lawful;
//   ANYTHING else is still a failure.
//
// That is a stronger guarantee than "no fetch", because "no fetch" said nothing about
// WHERE a future fetch might point. This says: every byte the app can ever ask for is a
// byte it already shipped and precached, so the app still works with the network unplugged.
// A sample id added without a matching ASSETS entry now fails HERE as well as in
// tests/r21h-ears.mjs.
//
// ---------------------------------------------------------------------------------------
// LANE B — RULE CHANGED again, and again it is a restatement rather than a relaxation.
//
// OLD: js/sfx.js has exactly ONE fetch, and it is fetch(sampleURL(id)).
// NEW: js/sfx.js has exactly TWO fetches — fetch(sampleURL(id)) and fetch(manifestURL()).
//      Each takes a MODULE-CONSTRUCTED url and never a caller-supplied string; each
//      resolves same-origin via import.meta.url; and every path either is a SAMPLES entry
//      or is MANIFEST_PATH, all of which are present in sw.js ASSETS[].
// WHY: some of the recordings are now CC-BY, whose one condition is that the author is
//      named. The Grown-ups corner's "Sound credits" card meets that condition, and it is
//      generated from assets/sfx/manifest.json at render time — the only form of a credits
//      list that cannot drift from the files it describes.
//
// The GUARANTEE is untouched: every byte the app can ever ask for is a byte it already
// shipped and precached. What changed is the count, and the count is asserted exactly, so
// a third fetch appearing tomorrow still fails here.
console.log('== the sample loader can only ever reach precached, same-origin files ==');
{
  const sfxSrc = readFileSync('js/sfx.js', 'utf8');
  const swSrc = readFileSync('sw.js', 'utf8');
  const assets = new Set([...swSrc.matchAll(/^\s*'([^']+)',?\s*$/gm)].map(m => m[1]));

  // every fetch in sfx.js goes through sampleURL() or manifestURL(); neither takes input
  const fetches = sfxSrc.split('\n').map((ln, i) => ({ ln: ln.trim(), n: i + 1 })).filter(x => /\bfetch\s*\(/.test(x.ln));
  assert(fetches.length === 2, `js/sfx.js has exactly two fetch calls (found ${fetches.length})`);
  assert(fetches.some(f => /fetch\(sampleURL\(id\)\)/.test(f.ln)),
    'the sample fetch takes sampleURL(id) — never a caller-supplied string');
  assert(fetches.some(f => /fetch\(manifestURL\(\)\)/.test(f.ln)),
    'the manifest fetch takes manifestURL() — no argument at all, so no caller can steer it');
  assert(fetches.every(f => /fetch\((sampleURL\(id\)|manifestURL\(\))\)/.test(f.ln)),
    'there is no third fetch taking anything else');
  assert(/new URL\('\.\.\/' \+ rel, import\.meta\.url\)/.test(sfxSrc),
    'sampleURL resolves against import.meta.url, so a sample path is always same-origin');
  assert(/new URL\('\.\.\/' \+ MANIFEST_PATH, import\.meta\.url\)/.test(sfxSrc),
    'manifestURL resolves against import.meta.url too, from a module constant');
  assert(/const MANIFEST_PATH = 'assets\/sfx\/manifest\.json'/.test(sfxSrc),
    'MANIFEST_PATH is a literal constant, not built from anything');
  assert(assets.has('assets/sfx/manifest.json'),
    'the manifest is itself precached, so the credits render offline like everything else');
  assert(!/https?:/.test(sfxSrc.slice(sfxSrc.indexOf('export const SAMPLES'), sfxSrc.indexOf('export const SAMPLE_IDS'))),
    'no absolute URL appears in the SAMPLES table');

  // and every declared sample really is precached
  const block = sfxSrc.slice(sfxSrc.indexOf('export const SAMPLES'), sfxSrc.indexOf('export const SAMPLE_IDS'));
  const paths = [...block.matchAll(/'(assets\/sfx\/[^']+)'/g)].map(m => m[1]);
  assert(paths.length > 0, `the SAMPLES table lists files (${paths.length})`);
  const unprecached = paths.filter(p => !assets.has(p));
  if (unprecached.length) unprecached.forEach(p => console.log('   not in ASSETS: ' + p));
  assert(unprecached.length === 0, 'every sample path is present in sw.js ASSETS[] — offline holds');
}

console.log('RESULT: ' + (failed ? 'FAIL' : 'PASS'));
process.exit(failed ? 1 : 0);
