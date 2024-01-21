#!/usr/bin/env bash

set -euxo pipefail

export CI=true

# enable extended globbing for omitting build artifacts
shopt -s extglob

# avoid copying build artifacts from the host
cp -r ../langchain/!(node_modules|dist|dist-cjs|dist-esm|build|.next|.turbo) ./

# Copy the yarn.lock file from the host
cp -r ../langchain-core/!(node_modules|dist|dist-cjs|dist-esm|build|.next|.turbo) ./
cp -r ../libs/!(node_modules|dist|dist-cjs|dist-esm|build|.next|.turbo) ./
cp ../yarn.lock ./
cp ../package.json ./

yarn

# Check the test command completes successfully
NODE_OPTIONS=--experimental-vm-modules yarn run jest --testPathIgnorePatterns=\\.int\\.test.ts --testTimeout 30000 --maxWorkers=50%
