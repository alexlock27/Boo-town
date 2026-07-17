#!/usr/bin/env bash
# Cross-platform full regression runner. Keep every suite's own log so a single
# failure can be rerun directly without hiding the original evidence.
set -uo pipefail

pass=0
fail=0
failed=""
# WSL's /bin/bash is available on this Windows workspace but does not carry a Linux
# Node install. It can invoke the project’s Windows Node executable directly.
NODE_BIN="${NODE_BIN:-node}"
if ! command -v "$NODE_BIN" >/dev/null 2>&1 && command -v node.exe >/dev/null 2>&1; then NODE_BIN="node.exe"; fi
for test_file in tests/*.mjs; do
  test_name="${test_file##*/}"
  test_name="${test_name%.mjs}"
  case "$test_name" in *shoot*|*sim-blocks*|*device-qa*) continue ;; esac
  if "$NODE_BIN" "$test_file" > "/tmp/reg_${test_name}.log" 2>&1; then
    pass=$((pass + 1))
  else
    fail=$((fail + 1))
    failed="$failed $test_name"
    echo "FAIL: $test_name"
  fi
done

echo "=========================="
echo "TOTAL PASS=$pass FAIL=$fail"
echo "FAILED:$failed"
exit "$fail"
