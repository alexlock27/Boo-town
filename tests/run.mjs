#!/usr/bin/env node
// tests/run.mjs — what `npm test` runs.
//
// This is NOT a second test runner. The board engine is `./_runall.sh` (RUN14 U-0): it
// enumerates tests/*.mjs minus the excluded prefixes, shards them across worker lanes
// balanced by tests/lib/board-durations.json, then runs the `@serial` set alone at the
// end. CLAUDE.md's engine-reuse law says use the engine that exists rather than build a
// parallel one, so this file adds only the two things that shell script deliberately
// does not do:
//
//   1. finds a POSIX shell to run it with. On Windows the `bash` on PATH is WSL's, which
//      sees a different filesystem entirely; the Git Bash beside `git` is the one that
//      can run the script against this checkout.
//   2. makes sure something is SERVING the app at $BASE. Every suite drives a real
//      browser against a real URL (`process.env.BASE || 'http://127.0.0.1:8000'`) and
//      `_runall.sh` assumes the server is already up — which is why every run so far has
//      started one by hand.
//
// Arguments are forwarded to `_runall.sh` unchanged, so the modes are its modes:
//
//   npm test                        the full board  (minutes — see the board law)
//   npm test -- --smoke             the packet gate: routes + contrast + migrations
//                                   + copyguard + $SMOKE_EXTRA
//   npm test -- --workers 4         lane count
//   npm test -- --serial            one suite at a time
//   SMOKE_EXTRA="m3-pwa" npm test -- --smoke
//   BASE=http://127.0.0.1:8071 npm test -- --smoke   reuse a server already running
//
// A server this script starts is stopped again when the board finishes; a server that was
// already answering on $BASE is left exactly as it was found.
//
// This is a TEST file. It never ships to the app and it is NOT in sw.js ASSETS[] — the
// offline law covers js/ and data/.

import { spawn, spawnSync } from 'child_process';
import { existsSync } from 'fs';
import { connect } from 'net';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const BASE = process.env.BASE || 'http://127.0.0.1:8000';
const PORT = Number(new URL(BASE).port || 80);
const HOST = new URL(BASE).hostname;

const listening = () => new Promise((resolve) => {
  const s = connect({ host: HOST, port: PORT });
  const done = (ok) => { s.destroy(); resolve(ok); };
  s.setTimeout(600);
  s.once('connect', () => done(true));
  s.once('timeout', () => done(false));
  s.once('error', () => done(false));
});

// Git Bash, not WSL's bash: the script has to see THIS checkout at THIS path.
function findBash() {
  if (process.platform !== 'win32') return 'bash';
  const candidates = [
    process.env.BOOTOWN_BASH,
    'C:\\Program Files\\Git\\bin\\bash.exe',
    'C:\\Program Files\\Git\\usr\\bin\\bash.exe',
    'C:\\Program Files (x86)\\Git\\bin\\bash.exe'
  ].filter(Boolean);
  for (const c of candidates) if (existsSync(c)) return c;
  return 'bash';   // last resort; if it is WSL's the script will say so loudly
}

function findPython() {
  return process.platform === 'win32' ? 'python' : 'python3';
}

let server = null;
let serverErr = '';

async function ensureServer() {
  if (await listening()) {
    console.log(`[run.mjs] reusing the server already answering on ${BASE}`);
    return false;
  }
  console.log(`[run.mjs] nothing on ${BASE} — starting python _serve.py ${PORT}`);
  // stderr is CAPTURED, not inherited: a Playwright suite aborts requests by design, and the
  // resulting ConnectionAbortedError tracebacks would bury the board's own verdict lines.
  // It is replayed only if the server fails to come up, which is when it is worth reading.
  server = spawn(findPython(), [join(ROOT, '_serve.py'), String(PORT)], {
    cwd: ROOT, stdio: ['ignore', 'ignore', 'pipe']
  });
  server.stderr.on('data', (d) => { serverErr += d; });
  server.on('error', (e) => {
    console.error(`[run.mjs] could not start the server: ${e.message}`);
    console.error(`[run.mjs] start one yourself and re-run:  python _serve.py ${PORT}`);
  });
  for (let i = 0; i < 40; i++) {                      // up to ~20s
    await new Promise(r => setTimeout(r, 500));
    if (await listening()) { console.log(`[run.mjs] serving ${BASE}`); return true; }
    if (server.exitCode !== null) break;
  }
  console.error(`[run.mjs] the server never came up on ${BASE}. Aborting.`);
  if (serverErr.trim()) console.error(serverErr.trim());
  stopServer();
  process.exit(1);
}

function stopServer() {
  if (!server || server.exitCode !== null) return;
  console.log('[run.mjs] stopping the server it started');
  // SYNCHRONOUS on purpose. An async kill followed by process.exit() races and loses: node
  // dies first, the python server outlives the run, and it holds the inherited stdio pipes
  // open — so the caller's shell never sees the board finish either.
  if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(server.pid), '/f', '/t'], { stdio: 'ignore' });
  else server.kill('SIGTERM');
  server = null;
}

const started = await ensureServer();
const bash = findBash();
const args = process.argv.slice(2);
console.log(`[run.mjs] ./_runall.sh ${args.join(' ')}`.trimEnd());

const board = spawn(bash, ['./_runall.sh', ...args], {
  cwd: ROOT, stdio: 'inherit', env: { ...process.env, BASE }
});
board.on('error', (e) => {
  console.error(`[run.mjs] could not run _runall.sh with "${bash}": ${e.message}`);
  if (started) stopServer();
  process.exit(1);
});
board.on('exit', (code, signal) => {
  if (started) stopServer();
  process.exit(code === null ? (signal ? 1 : 0) : code);
});
for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { if (started) stopServer(); process.exit(130); });
