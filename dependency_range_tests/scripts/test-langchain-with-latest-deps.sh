#!/usr/bin/env bash

set -euxo pipefail

export CI=true

# enable extended globbing for omitting build artifacts
shopt -s extglob

# Build LangChain
yarn build --filter=langchain

# avoid copying unwanted artifacts from the host
rsync -av --exclude={node_modules/,.yarn/,src/} --include={langchain/,langchain-core/,libs/,package.json,yarn.lock} ../ /Users/bracesproul/code/lang-chain-ai/tmp-projects/test-lc-deps/

yarn

# Check the test command completes successfully
NODE_OPTIONS=--experimental-vm-modules yarn run jest --testPathIgnorePatterns=\\.int\\.test.ts --testTimeout 30000 --maxWorkers=50%
