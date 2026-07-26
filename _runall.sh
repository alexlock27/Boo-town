#!/bin/bash
# Boo Town test board — sharded (RUN14 U-0).
#
#   ./_runall.sh                   full board: parallel lanes, then the @serial set alone
#   ./_runall.sh --smoke           the fast packet gate (Board Law): routes + contrast +
#                                  era migrations + $SMOKE_EXTRA (suites for the packets
#                                  touched this session), sharded the same way
#   ./_runall.sh --workers N       lane count (default 3; auto 4 when >=8 cores)
#   ./_runall.sh --serial          old behaviour: everything one at a time (baseline mode)
#
# @serial suites — frame-sampling, audio-timing and device-simulation evidence — are
# tagged with a "// @serial" line in their headers. They run ALONE at the end, one at a
# time, because parallel load starves the rAF/clock evidence they sample (the exact
# flake mode CLAUDE.md warns about). Only @serial frame-evidence suites may exceed the
# 120s per-suite budget, justified in tests/board-serial-baseline.md.
#
# Every suite's verdict comes from its own exit code; a sharded board runs the SAME
# enumeration as the serial baseline (ls tests/*.mjs minus shoot/sim-blocks/device-qa).

WORKERS=0
MODE=full
FORCE_SERIAL=0
while [ $# -gt 0 ]; do
  case "$1" in
    --smoke) MODE=smoke ;;
    --workers) shift; WORKERS=$1 ;;
    --serial) FORCE_SERIAL=1 ;;
  esac
  shift
done

CORES=${NUMBER_OF_PROCESSORS:-$(nproc 2>/dev/null || echo 4)}
if [ "$WORKERS" = "0" ]; then
  WORKERS=3
  [ "$CORES" -ge 8 ] && WORKERS=4
fi

if [ "$MODE" = "smoke" ]; then
  ALL="r12s1-routes r12s4-contrast r8p1-migrations $SMOKE_EXTRA"
else
  ALL=$(ls tests/*.mjs | grep -v "shoot\|sim-blocks\|device-qa" | sed 's#tests/##;s#.mjs##')
fi

# split @serial (tagged in-file) from the parallel pool
SERIAL=""
PARALLEL=""
for t in $ALL; do
  if head -n 6 "tests/$t.mjs" 2>/dev/null | grep -q "^// @serial"; then
    SERIAL="$SERIAL $t"
  else
    PARALLEL="$PARALLEL $t"
  fi
done
if [ "$FORCE_SERIAL" = "1" ]; then SERIAL="$PARALLEL $SERIAL"; PARALLEL=""; fi

mkdir -p /tmp/board
rm -f /tmp/board/lane_* /tmp/board/exit_* /tmp/board/time_*
T_START=$(date +%s)

run_suite() {  # $1 = suite name
  local s0=$(date +%s)
  node "tests/$1.mjs" > "/tmp/reg_$1.log" 2>&1
  local code=$?
  echo $code > "/tmp/board/exit_$1"
  echo $(( $(date +%s) - s0 )) > "/tmp/board/time_$1"
  [ $code -ne 0 ] && echo "FAIL: $1"
  return $code
}

# ---- parallel phase: N lanes balanced by measured durations ----
if [ -n "$(echo $PARALLEL | tr -d ' ')" ]; then
  node tests/lib/shard_plan.mjs "$WORKERS" $PARALLEL 2>/dev/null | while read lane suite; do
    echo "$suite" >> "/tmp/board/lane_$lane"
  done
  for lane_file in /tmp/board/lane_*; do
    [ -f "$lane_file" ] || continue
    (
      while read suite; do run_suite "$suite"; done < "$lane_file"
    ) &
  done
  wait
fi
T_PAR=$(date +%s)

# ---- @serial phase: alone, one at a time, longest first ----
if [ -n "$(echo $SERIAL | tr -d ' ')" ]; then
  ORDERED=$(node tests/lib/shard_plan.mjs 1 $SERIAL 2>/dev/null | awk '{print $2}')
  for t in $ORDERED; do run_suite "$t"; done
fi
T_END=$(date +%s)

# ---- verdicts, from exit codes ----
pass=0; fail=0; failed=""; total=0
for t in $ALL; do
  total=$((total+1))
  code=$(cat "/tmp/board/exit_$t" 2>/dev/null || echo 99)
  if [ "$code" = "0" ]; then pass=$((pass+1)); else fail=$((fail+1)); failed="$failed $t"; fi
done
echo "=========================="
echo "SUITES=$total  WORKERS=$WORKERS  parallel $(( T_PAR - T_START ))s + serial $(( T_END - T_PAR ))s = $(( T_END - T_START ))s"
echo "TOTAL PASS=$pass FAIL=$fail"
echo "FAILED:$failed"
[ $fail -eq 0 ]
