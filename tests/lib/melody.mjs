// tests/lib/melody.mjs — the Boo Pop Hit melody validator (RUN9 C6, binding).
// Every Hit must pass. Melodies are [{ note|'rest', beats }] over EXACTLY 16 bars of 4
// beats (64 beats). The checks implement the C6 composition rules machine-checkably:
//  1. beats64        total beats === 64
//  2. tempo          112 ≤ bpm ≤ 124
//  3. progression    one of I-V-vi-IV, vi-IV-I-V, I-vi-IV-V (in C: see PROGRESSIONS)
//  4. hookRecurs     bars 1-2 recur VERBATIM at bars 5-6 and 9-10 (same notes + beats)
//  5. offbeat        ≥25% of sounded notes start off the beat
//  6. durations      ≥3 distinct durations; never >4 consecutive sounded notes of one duration
//  7. hookLeap       the hook contains an adjacent leap ≥ a fourth (≥5 semitones).
//                    For a hook AUTHORED verbatim in the brief (Golden Boo) the authored
//                    content wins per the standing rule; the leap is then required anywhere
//                    in the melody instead (documented in PROGRESS.md).
//  8. hookRun        the hook contains a stepwise run of ≥3 notes (each step 1-2 semitones)
//  9. peak           the melody's highest note occurs in bars 9-12 and never in bar 1
// 10. rests          ≥2 rests
// 11. chordTones     ≥60% of on-beat sounded notes are tones of the underlying chord
//                    (one chord per bar, the 4-chord loop cycling every 4 bars)
// 12. finalChordTone the final sounded note is a tone of the final (4th) chord
// 13. range          all notes within C4..E5 (semis 0..16)
// 14. loopSmooth     the loop end leads back without a jolt: the final note is within a
//                    fourth (≤5 semitones) of the melody's first note AND lasts ≥1 beat

export const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11, "C'": 12, "D'": 14, "E'": 16 };
export const CHORD_TONES = { C: [0, 4, 7], G: [7, 11, 2], Am: [9, 0, 4], F: [5, 9, 0] };
export const PROGRESSIONS = {
  'I-V-vi-IV': ['C', 'G', 'Am', 'F'],
  'vi-IV-I-V': ['Am', 'F', 'C', 'G'],
  'I-vi-IV-V': ['C', 'Am', 'F', 'G']
};

// annotate: [{note,beats}] → sounded notes with { semi, start, beats } + rest list
export function annotate(melody) {
  let t = 0; const sounded = [], rests = [];
  for (const m of melody) {
    if (m.note === 'rest') rests.push({ start: t, beats: m.beats });
    else sounded.push({ note: m.note, semi: NOTE[m.note], start: t, beats: m.beats });
    t += m.beats;
  }
  return { sounded, rests, total: t };
}
const isOn = (t) => Math.abs(t - Math.round(t)) < 1e-6;
const tone = (semi, chord) => CHORD_TONES[chord].includes(((semi % 12) + 12) % 12);

// slice the entries covering [a,b) beats; returns null if an entry straddles the boundary
function slice(melody, a, b) {
  let t = 0; const out = [];
  for (const m of melody) {
    const s = t, e = t + m.beats; t = e;
    if (e <= a || s >= b) continue;
    if (s < a || e > b) return null;   // straddles — the hook must align to bar boundaries
    out.push({ note: m.note, beats: m.beats });
  }
  return out;
}

export function validateHit(hit, { authoredHook = false } = {}) {
  const checks = {};
  const ok = (k, pass, detail) => { checks[k] = { ok: !!pass, detail: detail || '' }; };
  const { sounded, rests, total } = annotate(hit.melody);

  ok('beats64', Math.abs(total - 64) < 1e-6, `${total} beats`);
  ok('tempo', hit.bpm >= 112 && hit.bpm <= 124, `${hit.bpm} bpm`);
  const progKey = Object.keys(PROGRESSIONS).find(k => JSON.stringify(PROGRESSIONS[k]) === JSON.stringify(hit.progression));
  ok('progression', !!progKey, progKey || hit.progression.join(' '));

  const hook = slice(hit.melody, 0, 8);
  const at5 = slice(hit.melody, 16, 24);
  const at9 = slice(hit.melody, 32, 40);
  ok('hookRecurs', hook && at5 && at9 && JSON.stringify(hook) === JSON.stringify(at5) && JSON.stringify(hook) === JSON.stringify(at9),
    hook ? `${hook.length} entries` : 'hook straddles a bar boundary');

  const offbeat = sounded.filter(n => !isOn(n.start)).length;
  ok('offbeat', sounded.length > 0 && offbeat / sounded.length >= 0.25, `${offbeat}/${sounded.length} = ${Math.round(offbeat / sounded.length * 100)}%`);

  const durs = new Set(sounded.map(n => n.beats));
  let run = 0, maxRun = 0, lastD = null, lastEnd = -1;
  for (const m of hit.melody) {   // rests break the run
    if (m.note === 'rest') { run = 0; lastD = null; continue; }
    if (m.beats === lastD) run++; else run = 1;
    lastD = m.beats; maxRun = Math.max(maxRun, run);
  }
  ok('durations', durs.size >= 3 && maxRun <= 4, `${durs.size} distinct, max run ${maxRun}`);

  const hookSounded = sounded.filter(n => n.start < 8);
  const leapIn = (list) => { for (let i = 1; i < list.length; i++) if (Math.abs(list[i].semi - list[i - 1].semi) >= 5) return true; return false; };
  const hookLeap = leapIn(hookSounded);
  ok('hookLeap', authoredHook ? (hookLeap || leapIn(sounded)) : hookLeap,
    hookLeap ? 'in hook' : (authoredHook && leapIn(sounded) ? 'authored hook exempt; leap in melody' : 'none'));

  let runOk = false;
  for (let i = 2; i < hookSounded.length; i++) {
    const d1 = hookSounded[i - 1].semi - hookSounded[i - 2].semi, d2 = hookSounded[i].semi - hookSounded[i - 1].semi;
    const st = (d) => Math.abs(d) >= 1 && Math.abs(d) <= 2;
    if (st(d1) && st(d2)) { runOk = true; break; }
  }
  ok('hookRun', runOk, runOk ? 'stepwise run of 3+' : 'none');

  const maxSemi = Math.max(...sounded.map(n => n.semi));
  const peakIn912 = sounded.some(n => n.semi === maxSemi && n.start >= 32 && n.start < 48);
  const peakInBar1 = sounded.some(n => n.semi === maxSemi && n.start < 4);
  ok('peak', peakIn912 && !peakInBar1, `max semi ${maxSemi}${peakInBar1 ? ' (in bar 1!)' : ''}`);

  ok('rests', rests.length >= 2, `${rests.length} rests`);

  const chords = hit.progression;
  const onBeats = sounded.filter(n => isOn(n.start));
  const chordAt = (t) => chords[Math.floor(t / 4) % 4];
  const good = onBeats.filter(n => tone(n.semi, chordAt(n.start))).length;
  ok('chordTones', onBeats.length > 0 && good / onBeats.length >= 0.6, `${good}/${onBeats.length} = ${Math.round(good / onBeats.length * 100)}%`);

  const last = sounded[sounded.length - 1];
  ok('finalChordTone', last && tone(last.semi, chords[3]), last ? `${last.note} over ${chords[3]}` : 'no notes');

  ok('range', sounded.every(n => n.semi >= 0 && n.semi <= 16), `semis ${Math.min(...sounded.map(n => n.semi))}..${maxSemi}`);

  const first = sounded[0];
  ok('loopSmooth', last && first && Math.abs(last.semi - first.semi) <= 5 && last.beats >= 1,
    last && first ? `|${last.note}−${first.note}| = ${Math.abs(last.semi - first.semi)}, final ${last.beats} beats` : '');

  const names = Object.keys(checks);
  const passed = names.filter(k => checks[k].ok);
  return { pass: passed.length === names.length, score: passed.length, of: names.length, checks };
}

// The three composed Hits must differ pairwise in progression, bpm, and hook-first-4-notes.
export function validateTrio(hits) {
  const out = { ok: true, details: [] };
  for (let i = 0; i < hits.length; i++) for (let j = i + 1; j < hits.length; j++) {
    const a = hits[i], b = hits[j];
    const f4 = (h) => annotate(h.melody).sounded.slice(0, 4).map(n => n.note).join(',');
    const progDiff = JSON.stringify(a.progression) !== JSON.stringify(b.progression);
    const bpmDiff = a.bpm !== b.bpm;
    const hookDiff = f4(a) !== f4(b);
    if (!(progDiff && bpmDiff && hookDiff)) { out.ok = false; }
    out.details.push(`${a.name} vs ${b.name}: prog ${progDiff ? '≠' : '='} bpm ${bpmDiff ? '≠' : '='} hook4 ${hookDiff ? '≠' : '='}`);
  }
  return out;
}
