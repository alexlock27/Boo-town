#!/usr/bin/env node
// tools/gen-state.mjs — RUN21F F3. Writes PROJECT_STATE.md at the repo root.
//
// LOCAL-ONLY DEV TOOL (tools/ stays out of sw.js ASSETS[] and is never linked from
// the app). Pure node stdlib — no dependencies. Everything is read STATICALLY by
// regex over the source files, never by importing app modules (they are browser ES
// modules that touch the DOM).
//
// Usage: node tools/gen-state.mjs
// The output is committed, and regenerated at every RUN's final gate (see the
// deploy-gate bullet in CLAUDE.md). It is deterministic — no timestamps — so
// running it twice in an unchanged tree is byte-identical (idempotent), and any
// diff it produces is a REAL state change.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

// Slice the source text between a start marker and the next end marker after it,
// so counts never leak matches from elsewhere in the file.
function block(text, start, end) {
  const i = text.indexOf(start);
  if (i < 0) return '';
  const j = text.indexOf(end, i + start.length);
  return j < 0 ? text.slice(i) : text.slice(i, j + end.length);
}
const all = (re, text) => [...text.matchAll(re)];
// Counted blocks must not count matches inside `//` comments (data/catalogue.js has
// header comments like "kind:'furniture' contract" that inflated counts by 3).
const stripComments = (text) => text.split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n');

// ---- build id + save version ----------------------------------------------------
const sw = read('sw.js');
const buildStamp = (/const BUILD_STAMP = '([^']+)'/.exec(sw) || [, 'UNKNOWN'])[1];
const assetCount = all(/^\s*'[^']+',?\s*(?:\/\/.*)?$/gm, block(sw, 'const ASSETS = [', '\n];')).length;

const stateSrc = read('js/state.js');
const saveVersion = (/export const VERSION = (\d+)/.exec(stateSrc) || [, 'UNKNOWN'])[1];

// ---- screen registry (js/main.js) -----------------------------------------------
const mainSrc = read('js/main.js');
const registryBlock = block(mainSrc, 'const registry = {', '\n};');
const screens = all(/^\s*'?([A-Za-z0-9_-]+)'?:\s*\(\)\s*=>\s*import\(/gm, registryBlock).map(m => m[1]);

// ---- areas (js/areas.js) --------------------------------------------------------
const areasSrc = read('js/areas.js');
const areas = all(/\{\s*key:\s*'([^']+)',\s*name:\s*'([^']+)',\s*kind:\s*'([^']+)'/g,
  block(areasSrc, 'export const AREAS = [', '\n];')).map(m => ({ key: m[1], name: m[2], kind: m[3] }));

// ---- catalogue counts by kind (data/catalogue.js) -------------------------------
const catBlock = stripComments(block(read('data/catalogue.js'), 'export const CATALOGUE = [', '\n];'));
const kindCounts = {};
for (const m of all(/\bkind:\s*'([a-z]+)'/g, catBlock)) kindCounts[m[1]] = (kindCounts[m[1]] || 0) + 1;
const catalogueTotal = Object.values(kindCounts).reduce((a, b) => a + b, 0);

// ---- wishes + dressings ---------------------------------------------------------
const wishCount = all(/'[a-z]+'/g, stripComments(block(read('data/wishes.js'), 'export const WISH_WORDS = [', '];'))).length;
const dressingCount = all(/\{\s*id:\s*'/g, stripComments(block(read('data/dressings.js'), 'export const DRESSINGS = [', '\n];'))).length;

// ---- tests ----------------------------------------------------------------------
// What `_runall.sh` leaves out of the board is listed here but flagged, so the suite count
// states what the board actually runs. It must match the runner's own filter: the excluded
// prefixes from CLAUDE.md's testing law (shoot, sim-blocks, device-qa) plus `walk` — the
// minutes-long pre-merge smoke that runs alone (RUN21F F10) — plus `run.mjs` itself, which
// is the board's ENTRY POINT (what `npm test` executes), not a suite.
const EXCLUDED = /^(shoot|sim-blocks|device-qa|walk)|^run\.mjs$/;
const suites = fs.readdirSync(path.join(ROOT, 'tests')).filter(f => f.endsWith('.mjs')).sort();
const boardSuites = suites.filter(f => !EXCLUDED.test(f));
const excludedSuites = suites.filter(f => EXCLUDED.test(f));

const pkg = JSON.parse(read('package.json'));
const testScript = (pkg.scripts && pkg.scripts.test) || '';
const testEntry = (/node\s+(\S+)/.exec(testScript) || [])[1] || null;
const testResolves = testEntry ? fs.existsSync(path.join(ROOT, testEntry)) : false;

// ---- RUN reports + BLOCKED items -------------------------------------------------
const rootFiles = fs.readdirSync(ROOT).sort();
const runReports = rootFiles.filter(f => /^RUN.*_REPORT\.md$/.test(f));
// Known blocked/gated items, harvested from every RUN21*-PROGRESS file present.
// A line counts when BLOCKED / SKIPPED-GATED is used as a STATUS MARKER; "BLOCKED"
// flowing straight into lowercase prose ("...harvests BLOCKED items...") is a
// description of the word, not a blocked item, and is skipped.
const isBlockedLine = (l) =>
  /SKIPPED-GATED/.test(l) || (/\bBLOCKED\b/.test(l) && !/\bBLOCKED\s+[a-z]/.test(l));
const blocked = [];
for (const f of rootFiles.filter(f => /^RUN21.*-PROGRESS.*\.md$/i.test(f))) {
  for (const line of read(f).split(/\r?\n/)) {
    if (isBlockedLine(line)) blocked.push({ file: f, line: line.trim() });
  }
}

// ---- emit -----------------------------------------------------------------------
const L = [];
L.push('# PROJECT_STATE');
L.push('');
L.push('Generated by `node tools/gen-state.mjs` — DO NOT EDIT BY HAND. Committed output,');
L.push("regenerated at every RUN's final gate (see the deploy-gate bullet in CLAUDE.md).");
L.push('Deterministic: no timestamps, so an unchanged tree regenerates byte-identically.');
L.push('');
L.push('## Build');
L.push('');
L.push(`- BUILD_STAMP: \`${buildStamp}\` (sw.js; ${assetCount} precached assets)`);
L.push(`- SAVE VERSION: ${saveVersion} (js/state.js)`);
L.push('');
L.push(`## Screens — ${screens.length} routes (js/main.js registry)`);
L.push('');
L.push(screens.map(s => '`' + s + '`').join(' · '));
L.push('');
L.push(`## Areas — ${areas.length} (js/areas.js AREAS)`);
L.push('');
for (const a of areas) L.push(`- \`${a.key}\` — ${a.name} (${a.kind})`);
L.push('');
L.push(`## Catalogue — ${catalogueTotal} items by kind (data/catalogue.js)`);
L.push('');
for (const k of Object.keys(kindCounts).sort()) L.push(`- ${k}: ${kindCounts[k]}`);
L.push('');
L.push('## Content counts');
L.push('');
L.push(`- wishes: ${wishCount} (data/wishes.js WISH_WORDS)`);
L.push(`- dressings: ${dressingCount} (data/dressings.js DRESSINGS, free defaults included)`);
L.push('');
L.push(`## Tests — ${suites.length} files under tests/`);
L.push('');
L.push(`- board suites: ${boardSuites.length} (+ ${excludedSuites.length} not on the board: shoot*, sim-blocks*, device-qa*, walk*, and run.mjs, the runner itself)`);
L.push(`- \`npm test\` runs \`${testScript}\` — ${testEntry ? `\`${testEntry}\` ${testResolves ? 'EXISTS (resolves)' : 'MISSING (does NOT resolve)'}` : 'no node entry file detected'}`);
L.push('');
L.push('### Suite list');
L.push('');
for (const s of suites) L.push(`- ${s}${EXCLUDED.test(s) ? '  *(excluded from board)*' : ''}`);
L.push('');
L.push(`## RUN reports present — ${runReports.length}`);
L.push('');
for (const r of runReports) L.push(`- ${r}`);
L.push('');
L.push('## Known BLOCKED / gated items (from RUN21*-PROGRESS files)');
L.push('');
if (blocked.length) for (const b of blocked) L.push(`- ${b.file}: ${b.line}`);
else L.push('- none recorded');
L.push('');

fs.writeFileSync(path.join(ROOT, 'PROJECT_STATE.md'), L.join('\n'));
console.log(`PROJECT_STATE.md written: ${screens.length} screens, ${areas.length} areas, ` +
  `${catalogueTotal} catalogue items, ${wishCount} wishes, ${dressingCount} dressings, ` +
  `${suites.length} suites, ${runReports.length} RUN reports, ${blocked.length} blocked/gated lines.`);
