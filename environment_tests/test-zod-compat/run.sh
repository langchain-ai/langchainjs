#!/usr/bin/env bash
#
# Zod compatibility tests for @langchain/core and langchain
#
# Tests that exported types work correctly with:
#   1. zod@3.25.x (v3-only consumer)
#   2. zod@4.x (v4 consumer)
#   3. zod version mismatch (consumer has zod@3.25.x, core built with zod@4.x)
#
# Each test exercises both @langchain/core primitives (tool, StructuredOutputParser,
# InteropZodType) and langchain agent APIs (createAgent, createMiddleware,
# toolStrategy, providerStrategy).
#
# Each test creates an isolated directory, installs packages from local
# tarballs alongside a specific zod version, and runs `tsc --noEmit`.
#
# Usage:
#   ./environment_tests/test-zod-compat/run.sh
#   # or from monorepo root:
#   bash environment_tests/test-zod-compat/run.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MONOREPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CORE_DIR="$MONOREPO_ROOT/libs/langchain-core"
LANGCHAIN_DIR="$MONOREPO_ROOT/libs/langchain"
WORK_DIR=$(mktemp -d)

cleanup() {
  echo "Cleaning up $WORK_DIR"
  rm -rf "$WORK_DIR"
}
trap cleanup EXIT

echo "=== Building packages ==="
cd "$MONOREPO_ROOT"
pnpm build --filter langchain 2>&1 | tail -3

echo "=== Packing @langchain/core ==="
CORE_TARBALL=$(cd "$CORE_DIR" && pnpm pack --pack-destination "$WORK_DIR" 2>/dev/null | tail -1)
if [ ! -f "$CORE_TARBALL" ]; then
  CORE_TARBALL=$(ls "$WORK_DIR"/langchain-core-*.tgz 2>/dev/null | head -1)
fi
echo "Core tarball: $CORE_TARBALL"

echo "=== Packing langchain ==="
LANGCHAIN_TARBALL=$(cd "$LANGCHAIN_DIR" && pnpm pack --pack-destination "$WORK_DIR" 2>/dev/null | tail -1)
if [ ! -f "$LANGCHAIN_TARBALL" ]; then
  LANGCHAIN_TARBALL=$(ls "$WORK_DIR"/langchain-[0-9]*.tgz 2>/dev/null | head -1)
fi
echo "Langchain tarball: $LANGCHAIN_TARBALL"

TESTS=("zod-v3" "zod-v4" "zod-mismatch")
PASS=0
FAIL=0

for test_name in "${TESTS[@]}"; do
  echo ""
  echo "=== Test: $test_name ==="
  TEST_SRC="$SCRIPT_DIR/$test_name"
  TEST_WORK="$WORK_DIR/$test_name"

  mkdir -p "$TEST_WORK/src"
  cp "$TEST_SRC/tsconfig.json" "$TEST_WORK/"
  cp "$TEST_SRC/src/test.ts" "$TEST_WORK/src/"
  cp "$TEST_SRC/package.json" "$TEST_WORK/"

  cd "$TEST_WORK"

  npm install --no-package-lock "$CORE_TARBALL" "$LANGCHAIN_TARBALL" 2>&1 | tail -3
  npm install --no-package-lock 2>&1 | tail -3

  echo "Installed zod version(s):"
  node -e "try{const z=require('zod/v3');console.log('  zod/v3:',z.z?.string?'available':'unavailable')}catch(e){console.log('  zod/v3: not found')}"
  node -e "try{const p=require.resolve('zod');const j=require(require('path').join(require('path').dirname(p),'package.json'));console.log('  zod:',j.version)}catch(e){console.log('  zod: not found')}"

  echo "Running tsc --noEmit (timeout 120s, max 512MB heap)..."
  if timeout 120 node --max-old-space-size=512 ./node_modules/.bin/tsc --noEmit 2>&1; then
    echo "PASS: $test_name"
    PASS=$((PASS + 1))
  else
    echo "FAIL: $test_name"
    FAIL=$((FAIL + 1))
  fi
done

echo ""
echo "=== Results ==="
echo "Passed: $PASS / ${#TESTS[@]}"
echo "Failed: $FAIL / ${#TESTS[@]}"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
