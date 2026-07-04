// tests/lib/motion.mjs — motion-evidence helpers (RUN3 QA standard).
// Captures a series of frames over time and measures change between them, so a
// "static sequence" fails even when the logic passes. Uses sharp (dev-only) to
// decode PNGs to raw RGBA and count pixels that changed beyond a threshold.
import sharp from 'sharp';
import { mkdirSync, writeFileSync } from 'fs';

// Count pixels whose max channel delta exceeds `thresh` between two PNG buffers.
export async function pngDelta(bufA, bufB, thresh = 24) {
  const a = await sharp(bufA).raw().toBuffer({ resolveWithObject: true });
  const b = await sharp(bufB).raw().toBuffer({ resolveWithObject: true });
  const da = a.data, db = b.data;
  const n = Math.min(da.length, db.length);
  let changed = 0, px = 0;
  for (let i = 0; i < n; i += a.info.channels) {
    px++;
    const dr = Math.abs(da[i] - db[i]);
    const dg = Math.abs(da[i + 1] - db[i + 1]);
    const dbl = Math.abs(da[i + 2] - db[i + 2]);
    if (dr > thresh || dg > thresh || dbl > thresh) changed++;
  }
  return { changed, total: px, ratio: px ? changed / px : 0 };
}

// Capture `count` frames spaced `gapMs` apart (spanning count*gapMs of wall time).
// clip: optional {x,y,width,height} region. probe: async (page)=>value sampled each frame.
// Saves PNGs to screenshots/<dir>/<prefix>-N.png. Returns {frames, probes, deltas}.
export async function captureSeries(page, { dir = 'audit', prefix, count = 7, gapMs = 500, clip = null, probe = null }) {
  const outDir = `screenshots/${dir}`;
  mkdirSync(outDir, { recursive: true });
  const frames = [], probes = [], deltas = [];
  for (let i = 0; i < count; i++) {
    const buf = await page.screenshot(clip ? { clip } : {});
    frames.push(buf);
    writeFileSync(`${outDir}/${prefix}-${i}.png`, buf);
    if (probe) probes.push(await probe(page));
    if (i > 0) deltas.push(await pngDelta(frames[i - 1], frames[i]));
    if (i < count - 1) await page.waitForTimeout(gapMs);
  }
  return { frames, probes, deltas };
}

// Summarise a delta series: how many consecutive pairs actually changed, and the
// span (min..max changed-pixel counts). A motion pass requires most pairs > minPx.
export function summariseDeltas(deltas, minPx = 40) {
  const moved = deltas.filter(d => d.changed >= minPx).length;
  const counts = deltas.map(d => d.changed);
  return { pairs: deltas.length, moved, counts, allMoved: moved === deltas.length, anyStatic: moved < deltas.length };
}

export function line(label, ok, detail = '') {
  return `  ${ok ? '✓' : '✗ FAIL:'} ${label}${detail ? '  — ' + detail : ''}`;
}
