#!/bin/bash
# Boo Town test board.
#   ./_runall.sh          — every suite, serial (the full board)
#   ./_runall.sh --smoke  — the fast packet gate (Board Law): routes + contrast audit +
#                           era migrations, plus $SMOKE_EXTRA (space-separated suite
#                           names for the packets touched this session).
#                           RUN14 U-0 expands this further (sharding, auto-detection).
if [ "$1" == "--smoke" ]; then
  SUITES="r12s1-routes r12s4-contrast r8p1-migrations $SMOKE_EXTRA"
else
  SUITES=$(ls tests/*.mjs | grep -v "shoot\|sim-blocks\|device-qa" | sed 's#tests/##;s#.mjs##')
fi
pass=0; fail=0; failed=""
for t in $SUITES; do
  node tests/$t.mjs > /tmp/reg_$t.log 2>&1
  if [ $? -eq 0 ]; then pass=$((pass+1)); else fail=$((fail+1)); failed="$failed $t"; echo "FAIL: $t"; fi
done
echo "=========================="
echo "TOTAL PASS=$pass FAIL=$fail"
echo "FAILED:$failed"
