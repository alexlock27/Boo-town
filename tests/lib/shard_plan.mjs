// tests/lib/shard_plan.mjs — RUN14 U-0: balance board suites across N worker lanes.
// Longest-processing-time greedy against MEASURED durations (board-durations.json;
// 15s fallback for unknowns), because the baseline showed the ten slowest suites carry
// half the runtime: a plan that puts two of them in one lane is bounded by that lane.
//
// Usage: node tests/lib/shard_plan.mjs <workers> <suite> <suite> ...
// Output: one line per suite, "<lane> <suite>", lanes 0..workers-1.
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const here = dirname(fileURLToPath(import.meta.url));
const durations = JSON.parse(readFileSync(join(here, 'board-durations.json'), 'utf8'));
const workers = Math.max(1, parseInt(process.argv[2], 10) || 1);
const suites = process.argv.slice(3);
const dur = (s) => (typeof durations[s] === 'number' ? durations[s] : 15);

const lanes = Array.from({ length: workers }, () => ({ total: 0, suites: [] }));
for (const s of [...suites].sort((a, b) => dur(b) - dur(a))) {
  lanes.sort((a, b) => a.total - b.total);
  lanes[0].total += dur(s);
  lanes[0].suites.push(s);
}
// re-sort lanes into a stable order for readable output
lanes.sort((a, b) => b.total - a.total);
lanes.forEach((lane, i) => {
  for (const s of lane.suites) console.log(`${i} ${s}`);
  console.error(`lane ${i}: ~${Math.round(lane.total)}s across ${lane.suites.length} suites`);
});
