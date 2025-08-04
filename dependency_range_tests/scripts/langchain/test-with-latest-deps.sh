#!/usr/bin/env bash

set -euxo pipefail

corepack enable

export CI=true

# enable extended globbing for omitting build artifacts
shopt -s extglob

# avoid copying build artifacts from the host
cp -r ../langchain/!(node_modules|dist|dist-cjs|dist-esm|build|.next|.turbo) ./

mkdir -p /updater_script
cp -r /scripts/langchain/node/!(node_modules|dist|dist-cjs|dist-esm|build|.next|.turbo) /updater_script/

cd /updater_script

pnpm install --prod

cd /app

corepack enable
node /updater_script/update_resolutions_latest.js

pnpm install
pnpm add @langchain/core

# Check the test command completes successfully
NODE_OPTIONS=--experimental-vm-modules pnpm run jest --testPathIgnorePatterns=\\.int\\.test.ts --testTimeout 30000 --maxWorkers=50%
