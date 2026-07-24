// tests/r11q1-privacy-guard.mjs — RUN11 Q1/G9 permanent privacy guard.
// Fails if any retired real name, age, or family-detail pattern appears in ANY tracked
// file (working tree only; git history is out of scope per G10-adjacent rules). Patterns
// are word-boundaried so legitimate words (Styler, flexible, twinkle, Sound Twins) pass.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };

const SELF = 'tests/r11q1-privacy-guard.mjs';   // this file names the patterns; never scan it
const BINARY = /\.(png|jpe?g|gif|ico|webp|woff2?|ttf|otf|zip|mp3|wav|pdf)$/i;

// Authored from the names/ages found in Q1, plus generic first-name-plus-age shapes.
// Boundaries use letter-only lookarounds (not \b) so snake_case names like
// boo_birthday_lexie ARE caught (underscore is a regex word char) while legitimate words
// (Styler, flexible) and name-free ids (boo_birthday_one) pass.
const L = '(?<![a-z])', R = '(?![a-z])';
const PATTERNS = [
  { re: new RegExp(L + 'lexie' + R, 'i'), what: 'a retired first name' },
  { re: new RegExp(L + 'tyler' + R, 'i'), what: 'a retired first name' },
  { re: /\beleventh birthday\b/i, what: 'a retired age phrase' },
  { re: /\b11th birthday\b/i, what: 'a retired age phrase' },
  { re: /\b[A-Z][a-z]+['’]s eleventh\b/, what: 'a generic name+age shape' }
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

// sanity: the guard actually catches something (so a silent regex break can't pass it)
const canary = 'Lexie is eleven';
assert(PATTERNS.some(p => p.re.test(canary)), 'the guard patterns still match a known name (self-check)');

console.log('RESULT: ' + (failed ? 'FAIL' : 'PASS'));
process.exit(failed ? 1 : 0);
