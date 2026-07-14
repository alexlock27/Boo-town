#!/bin/bash
SUITES=$(ls tests/*.mjs | grep -v "shoot\|sim-blocks\|device-qa" | sed 's#tests/##;s#.mjs##')
pass=0; fail=0; failed=""
for t in $SUITES; do
  node tests/$t.mjs > /tmp/reg_$t.log 2>&1
  if [ $? -eq 0 ]; then pass=$((pass+1)); else fail=$((fail+1)); failed="$failed $t"; echo "FAIL: $t"; fi
done
echo "=========================="
echo "TOTAL PASS=$pass FAIL=$fail"
echo "FAILED:$failed"
