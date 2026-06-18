#!/usr/bin/env bash

set -euxo pipefail

corepack enable

export CI=true
export LC_DEPENDENCY_RANGE_TESTS=true

# enable extended globbing for omitting build artifacts
shopt -s extglob

# avoid copying build artifacts from the host
cp -r ../langchain/!(node_modules|dist|dist-cjs|dist-esm|build|.next|.turbo) ./

# Create mock tsconfig.json files without project references
bash /scripts/create-mock-tsconfigs.sh . /app

# The shared tsconfig base (internal/tsconfig/base.json) pulls in
# internal/tsconfig/vitest-matchers.d.ts, which augments Vitest's matcher types via a
# monorepo-relative import: ../../libs/langchain-core/src/testing/matchers.js (resolved
# relative to /app/internal/tsconfig). In this partial-workspace harness langchain-core is
# mounted at /libs/langchain-core, so expose it at /app/libs/langchain-core for the
# augmentation to resolve. Without this, custom matchers (e.g. toBeAIMessage) are dropped
# and `vitest` typecheck fails.
mkdir -p /app/libs
ln -sfn /libs/langchain-core /app/libs/langchain-core

mkdir -p /updater_script
cp -r /scripts/langchain/node/!(node_modules|dist|dist-cjs|dist-esm|build|.next|.turbo) /updater_script/

cd /updater_script
npm install

cd /app
node /updater_script/update_resolutions_lowest.js
pnpm install

# Check the test command completes successfully
pnpm run test
