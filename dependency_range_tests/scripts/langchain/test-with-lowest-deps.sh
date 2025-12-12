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

mkdir -p /updater_script
cp -r /scripts/langchain/node/!(node_modules|dist|dist-cjs|dist-esm|build|.next|.turbo) /updater_script/

cd /updater_script
npm install

cd /app
node /updater_script/update_resolutions_lowest.js
pnpm install

# Check the test command completes successfully
pnpm run test
