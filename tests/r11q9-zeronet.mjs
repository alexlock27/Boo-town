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
      if (/\bfetch\s*\(/.test(ln) && !/gallery\.js$/.test(f)) offenders.push(`${f}:${i + 1} ${ln.trim().slice(0, 70)}`);
    });
  }
  if (offenders.length) offenders.forEach(o => console.log('   ' + o));
  assert(offenders.length === 0, `js/ contains no fetch/XHR/WebSocket/beacon outside the guarded share path (found ${offenders.length})`);
}

console.log('RESULT: ' + (failed ? 'FAIL' : 'PASS'));
process.exit(failed ? 1 : 0);
