#!/usr/bin/env python3
"""Build tests/board-serial-baseline.md from the completed clean serial board run.

TIMING METHOD — mtime chain, not birth times.
  The obvious approach (per-suite duration = log mtime - log birth) is WRONG on this
  filesystem for the first few suites: NTFS file tunneling restores a deleted file's
  original creation timestamp when a file of the same name is recreated within ~15s, and
  `_runall.sh` recreates every /tmp/reg_<suite>.log immediately after they were cleared.
  `reg_audit.log` came back with a birth time from a previous day to prove it.

  Because the board runs strictly SERIALLY, the mtime chain is exact and immune:
      suite N duration = mtime(N) - mtime(N-1),  first suite = mtime(1) - board start
  where board start is the birth of /tmp/board_clean.log (created once, never recreated,
  so tunneling cannot touch it). Completion order is the mtime order itself.

  Birth times are still read where they look sane, purely to cross-check the chain, and
  any suite where the two disagree by more than a second is reported rather than hidden.
"""
import io
import os
import re
import subprocess
from datetime import datetime

ROOT = r"C:\Users\Alexl\Documents\Bootown-Project\Boo-town"
BOARD_LOG = "/tmp/board_clean.log"
OUT = os.path.join(ROOT, "tests", "board-serial-baseline.md")


def stat_time(path, fmt):
    r = subprocess.run(["stat", "-c", fmt, path], capture_output=True, text=True)
    if r.returncode != 0:
        return None
    s = r.stdout.strip()
    if not s or s == "-":
        return None
    s = re.sub(r"\s*[+-]\d{4}$", "", s)
    s = re.sub(r"(\.\d{6})\d+", r"\1", s)
    for f in ("%Y-%m-%d %H:%M:%S.%f", "%Y-%m-%d %H:%M:%S"):
        try:
            return datetime.strptime(s, f)
        except ValueError:
            continue
    return None


def hms(seconds):
    seconds = int(round(seconds))
    h, rem = divmod(seconds, 3600)
    m, s = divmod(rem, 60)
    return f"{h}h {m:02d}m {s:02d}s" if h else f"{m}m {s:02d}s"


def sh(cmd):
    return subprocess.run(["bash", "-lc", cmd], capture_output=True, text=True).stdout.strip()


# ---- the board's own verdicts ---------------------------------------------------------
board = io.open(BOARD_LOG, encoding="utf-8", errors="replace").read()
m = re.search(r"TOTAL PASS=(\d+) FAIL=(\d+)", board)
if not m:
    raise SystemExit("board_clean.log has no TOTAL line — the run has not finished")
total_pass, total_fail = int(m.group(1)), int(m.group(2))
failed_names = []
fm = re.search(r"^FAILED:(.*)$", board, re.M)
if fm:
    failed_names = fm.group(1).split()

suites = sh('cd "%s" && ls tests/*.mjs | grep -v "shoot\\|sim-blocks\\|device-qa" | sed "s#tests/##;s#.mjs##"'
            % ROOT.replace("\\", "/")).split()

board_start = stat_time(BOARD_LOG, "%w")
board_end = stat_time(BOARD_LOG, "%y")
total_seconds = (board_end - board_start).total_seconds()

# ---- gather, then order by completion (mtime) -----------------------------------------
recs = []
for name in suites:
    log = f"/tmp/reg_{name}.log"
    if not os.path.exists(log):
        recs.append({"name": name, "mtime": None})
        continue
    text = io.open(log, encoding="utf-8", errors="replace").read()
    recs.append({
        "name": name,
        "mtime": stat_time(log, "%y"),
        "birth": stat_time(log, "%w"),
        "ticks": text.count("\u2713"),
        "crosses": text.count("\u2717"),
        "has_result": "RESULT:" in text,
        "verdict": "FAIL" if name in failed_names else "PASS",
    })

ordered = sorted([r for r in recs if r["mtime"]], key=lambda r: r["mtime"])
prev = board_start
for r in ordered:
    r["dur"] = (r["mtime"] - prev).total_seconds()
    prev = r["mtime"]

# cross-check the chain against birth times where birth falls inside the run window
disagree = []
for r in ordered:
    b = r.get("birth")
    if not b or b < board_start or b > board_end:
        continue                                  # tunneled or unusable — skip silently
    birth_dur = (r["mtime"] - b).total_seconds()
    if abs(birth_dur - r["dur"]) > 1.0:
        disagree.append((r["name"], r["dur"], birth_dur))

by_slow = sorted(ordered, key=lambda r: r["dur"], reverse=True)
accounted = sum(r["dur"] for r in ordered)
tick_suites = [r for r in ordered if r["ticks"] > 0]
assertions = sum(r["ticks"] for r in tick_suites)
no_tick = [r["name"] for r in ordered if r["ticks"] == 0]
missing = [r["name"] for r in recs if not r["mtime"]]

commit = sh('git -C "%s" rev-parse HEAD' % ROOT.replace("\\", "/"))[:12]
stamp = re.search(r"BUILD_STAMP = '([^']+)'",
                  io.open(os.path.join(ROOT, "sw.js"), encoding="utf-8").read()).group(1)

L = []
A = L.append
A("# Boo Town — OFFICIAL serial full-board baseline")
A("")
A("> **This file is the official serial comparison baseline for RUN14 packet U-0's sharding")
A("> acceptance.** A sharded run is accepted only if it reproduces the PASS and FAIL verdicts")
A("> below **exactly**: the same suites passing, the same suites failing, and the same number")
A("> of suites executed. Wall-clock time is what sharding exists to beat; the verdicts are")
A("> what it must not change.")
A(">")
A("> **This was the last serial full board this project ran.** After U-0 there is no second")
A("> chance to take this measurement, so it is recorded here in full.")
A("")
A("## Run identity")
A("")
A("| | |")
A("|---|---|")
A(f"| Commit | `{commit}` |")
A(f"| BUILD_STAMP | `{stamp}` |")
A("| Save VERSION | 15 |")
A("| Runner | `./_runall.sh` — serial, one suite at a time, no retries |")
A("| Server | `python scripts/serve.py 8123` (HTTP/1.1 keep-alive) |")
A("| Base URL | `http://127.0.0.1:8123` |")
A("| Machine state | quiet — nothing else running, no concurrent suites |")
A(f"| Started | {board_start.strftime('%Y-%m-%d %H:%M:%S')} |")
A(f"| Finished | {board_end.strftime('%Y-%m-%d %H:%M:%S')} |")
A(f"| **Total wall time** | **{hms(total_seconds)}** ({total_seconds:.0f}s) |")
A(f"| Suites enumerated | {len(suites)} |")
A(f"| Suites with a result log | {len(ordered)} |")
A(f"| **Board result** | **PASS={total_pass}  FAIL={total_fail}** |")
A("")
A("### Failing suites in this baseline")
A("")
if failed_names:
    A("A sharded run must reproduce these **exactly** — neither fewer nor more:")
    A("")
    for n in failed_names:
        A(f"- `{n}`")
else:
    A("**None.** A sharded run must reproduce a clean board. Any failure under sharding is a")
    A("regression in the sharding until proven otherwise — the serial board was green here.")
A("")
if missing:
    A("### Suites with no log")
    A("")
    for n in missing:
        A(f"- `{n}`")
    A("")
A("## Provenance — why this is the second run")
A("")
A("A clean serial board was run first, at commit `4e4e270`, and finished **PASS=124 FAIL=1**.")
A("The single failure was real, not a flake: `r5p6-intros` hardcoded `texts.length === 34`")
A("for the total number of authored intro steps in `js/intro.js`, and RUN13 T2 gave Boo Care")
A("a three-step intro of its own, making it 37. The suite now derives the count from")
A("`INTRO_SCRIPTS` and asserts only a floor (plus that `care` carries a script at all).")
A("")
A("That fix changed the tree, so the first run no longer described what RUN14 will shard —")
A("a sharded run against the fixed tree would have come back green and been **rejected for")
A("being correct**. The baseline below is therefore the run taken AFTER the fix. The first")
A("run is recorded here rather than discarded, because a baseline that appears from nowhere")
A("is harder to trust than one that shows its own history.")
A("")
A("## Timing method, and the trap in it")
A("")
A("No instrumentation was added, so the measured run is the real one, unperturbed.")
A("")
A("The obvious method — per-suite duration = log `mtime` − log `birth` — is **wrong on this")
A("filesystem**. NTFS *file tunneling* restores a deleted file's original creation timestamp")
A("when a file of the same name is recreated within about fifteen seconds, and `_runall.sh`")
A("recreates every `/tmp/reg_<suite>.log` immediately after they were cleared. `reg_audit.log`")
A("came back carrying a birth time from a previous day, which is how this was caught.")
A("")
A("Because the board runs **strictly serially**, the mtime chain is exact and immune to it:")
A("")
A("```")
A("suite N duration = mtime(N) - mtime(N-1)      # completion to completion")
A("first suite      = mtime(1) - birth(board log)")
A("```")
A("")
A("`/tmp/board_clean.log` is created once by the `>` redirect and never recreated, so its")
A("birth time is a sound anchor. Completion order below is the mtime order itself.")
A("")
if disagree:
    A(f"Cross-check against birth times where those were usable: **{len(disagree)} suite(s)**")
    A("disagreed with the chain by more than a second, listed here rather than hidden —")
    A("each is a suite whose log was tunneled or whose process lingered after its last write:")
    A("")
    A("| Suite | chain | birth-based |")
    A("|---|---:|---:|")
    for n, c, b in disagree[:12]:
        A(f"| `{n}` | {c:.1f}s | {b:.1f}s |")
else:
    A("Cross-checked against birth times wherever those were usable: no suite disagreed with")
    A("the chain by more than a second.")
A("")
A(f"Per-suite durations sum to {hms(accounted)} against a {hms(total_seconds)} total; the")
A("difference is process spawn and teardown between suites.")
A("")
A("## Assertion counts, and what they do and do not mean")
A("")
A(f"{len(tick_suites)} of {len(ordered)} suites report per-assertion `✓` marks, totalling")
A(f"**{assertions}** passing assertions. The remainder use their own output conventions and")
A("are not counted — an assertion total is a rough weight, never an acceptance criterion.")
if no_tick:
    A("")
    A("Suites using another convention (no `✓` marks):")
    A("")
    for n in no_tick:
        A(f"- `{n}`")
A("")
A("## Per-suite results, slowest first")
A("")
A("| # | Suite | Verdict | Duration | ✓ | ✗ |")
A("|---:|---|---|---:|---:|---:|")
for i, r in enumerate(by_slow, 1):
    A(f"| {i} | `{r['name']}` | {r['verdict']} | {r['dur']:.1f}s | {r['ticks'] or '—'} | {r['crosses'] or '—'} |")
A("")
A("## Per-suite results, in the order the board ran them")
A("")
A("| # | Suite | Verdict | Duration | Finished |")
A("|---:|---|---|---:|---|")
for i, r in enumerate(ordered, 1):
    A(f"| {i} | `{r['name']}` | {r['verdict']} | {r['dur']:.1f}s | {r['mtime'].strftime('%H:%M:%S')} |")
A("")
A("## Where the time went")
A("")
top = by_slow[:10]
share = (sum(r["dur"] for r in top) / accounted * 100) if accounted else 0
A(f"The ten slowest suites account for **{share:.0f}%** of the accounted runtime:")
A("")
for r in top:
    A(f"- `{r['name']}` — {hms(r['dur'])}")
A("")
A("These are where sharding has the most to win, and their cost is real work rather than")
A("page-load overhead: full-viewport pixel audits, multi-minute containment runs,")
A("frame-sampled motion evidence and multi-viewport sweeps. **A shard plan that puts two of")
A("them in one lane will be bounded by that lane** — balance by these measured durations,")
A("not by suite count.")
A("")
A("## What a sharded run must reproduce")
A("")
A(f"1. **All {len(ordered)} suites execute.** Check the count first: a sharding bug that drops")
A("   a suite is indistinguishable from a faster board.")
A(f"2. **PASS={total_pass}, FAIL={total_fail}**, with the same suites on each side of the line.")
A("3. **No suite may be skipped, quarantined, or retried-until-green** to reach that number.")
A("   Where CLAUDE.md's flake rule was applied during RUN13, the batch verdict is what is")
A("   recorded above — re-run results are noted in RUN13_REPORT.md and are NOT folded in here.")
A("   A baseline that launders a flake into a pass is worse than no baseline.")
A("4. **Timing is not part of acceptance.** It will change, and it is meant to.")
A("5. Suites are enumerated by `_runall.sh` as `ls tests/*.mjs` minus the `shoot`,")
A("   `sim-blocks` and `device-qa` prefixes. A sharder must use the same enumeration or it")
A("   is not running the same board.")
A("")

io.open(OUT, "w", encoding="utf-8", newline="").write("\n".join(L) + "\n")
print("wrote", OUT)
print(f"PASS={total_pass} FAIL={total_fail} total={hms(total_seconds)} "
      f"suites_enumerated={len(suites)} suites_logged={len(ordered)} assertions={assertions}")
if failed_names:
    print("FAILED:", " ".join(failed_names))
