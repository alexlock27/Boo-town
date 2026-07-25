// tests/r11q1-privacy-guard.mjs — RUN11 Q1/G9 permanent privacy guard.
// Fails if any retired real name, age, or family-detail pattern appears in ANY tracked file
// (working tree only; git history is out of scope per G10-adjacent rules).
//
// The patterns are stored ENCODED and decoded at runtime, never as literals. A guard that
// spelled out the very strings it forbids would publish them on a public repo — defeating
// its own purpose, and making itself the top grep/search hit for those names. Encoding keeps
// the file readable to a maintainer while leaving nothing plaintext to find or index.
//
// Word boundaries use letter-only lookarounds rather than \b, so snake_case identifiers are
// caught (underscore is a regex word char) while legitimate app vocabulary passes — the
// pathStyleRow variable, flexible, twinkle, Sound Twins — as does the app's own 'birthday'
// collectible rarity. Those lookalikes are asserted below rather than just claimed here.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };

const SELF = 'tests/r11q1-privacy-guard.mjs';   // never scan the file that defines the rules
const BINARY = /\.(png|jpe?g|gif|ico|webp|woff2?|ttf|otf|zip|mp3|wav|pdf)$/i;

// Encoded so the forbidden strings never appear in the source. Decoded only in memory.
const d = (t) => Buffer.from(t, 'base64').toString('utf8');
const T = {
  nameA:    'bGV4aWU=',
  nameB:    'dHlsZXI=',
  agePhrase: 'ZWxldmVudGggYmlydGhkYXk=',
  ageNumeric: 'MTF0aCBiaXJ0aGRheQ==',
  ageWord:  'ZWxldmVudGg=',
  canaryTail: 'IGlzIGVsZXZlbg=='
};

// Letter-only boundaries: catches boo_<name>_x, misses the innocents asserted below.
const L = '(?<![a-z])', R = '(?![a-z])';
const word = (token) => new RegExp(L + d(token) + R, 'i');
const phrase = (token) => new RegExp('\\b' + d(token) + '\\b', 'i');

const PATTERNS = [
  { re: word(T.nameA), what: 'a retired first name' },
  { re: word(T.nameB), what: 'a retired first name' },
  { re: phrase(T.agePhrase), what: 'a retired age phrase' },
  { re: phrase(T.ageNumeric), what: 'a retired age phrase' },
  // a generic "<Name>'s <age-word>" shape, so a NEW name in the same construction is caught
  { re: new RegExp("\\b[A-Z][a-z]+['\u2019]s " + d(T.ageWord) + '\\b'), what: 'a generic name+age shape' }
];

let files = [];
try { files = execSync('git ls-files', { encoding: 'utf8' }).split('\n').filter(Boolean); }
catch (e) { console.log('  ✗ FAIL: could not list tracked files:', e.message); process.exit(1); }
files = files.filter(f => f !== SELF && !BINARY.test(f));

const hits = [];
for (const f of files) {
  let txt; try { txt = readFileSync(f, 'utf8'); } catch { continue; }
  txt.split('\n').forEach((ln, i) => {
    for (const p of PATTERNS) if (p.re.test(ln)) hits.push(`${f}:${i + 1}  (${p.what})  ${ln.trim().slice(0, 90)}`);
  });
}

console.log(`== scanned ${files.length} tracked files for retired name/age patterns ==`);
if (hits.length) { console.log('  offending lines:'); hits.forEach(h => console.log('   ' + h)); }
assert(hits.length === 0, `no retired name/age/family pattern survives in any tracked file (found ${hits.length})`);

// Self-check: a constructed sample must still trip the patterns, so a broken regex (or a
// mangled token) can never let the guard pass silently by matching nothing.
const canary = d(T.nameA) + d(T.canaryTail);
assert(PATTERNS.some(p => p.re.test(canary)), 'the guard patterns still match a known sample (self-check)');
// and the guard must NOT fire on lookalikes that are legitimate app vocabulary
const innocents = ['const pathStyleRow = el(', 'animation: twinkle 3s', 'Sound Twins picker', "rarity: 'birthday'"];
assert(!innocents.some(s => PATTERNS.some(p => p.re.test(s))), 'the guard ignores legitimate lookalike words');

// And the guard must hold itself to its own rule: this file is excluded from the sweep, so
// check it explicitly. Judged by the PATTERNS rather than a raw substring — a coincidental
// fragment inside an unrelated identifier (the app's own pathStyleRow ends "...styleRow")
// is not a name, which is precisely what the letter-boundary logic exists to distinguish.
const selfLines = readFileSync(SELF, 'utf8').split('\n');
const selfHits = [];
selfLines.forEach((ln, i) => { for (const p of PATTERNS) if (p.re.test(ln)) selfHits.push(`${i + 1}: ${ln.trim().slice(0, 60)}`); });
assert(selfHits.length === 0, `the guard stores its patterns encoded, never in plaintext (${selfHits.join(' | ') || 'clean'})`);

console.log('RESULT: ' + (failed ? 'FAIL' : 'PASS'));
process.exit(failed ? 1 : 0);
