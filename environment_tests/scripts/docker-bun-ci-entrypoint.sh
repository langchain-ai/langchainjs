#!/usr/bin/env bash

set -euxo pipefail

export CI=true

# enable extended globbing for omitting build artifacts
shopt -s extglob

# avoid copying build artifacts from the host
cp -r ../package/!(node_modules|dist|dist-cjs|dist-esm|build|.next|.turbo) .

mkdir ../langchain-core
cp -r ../langchain-core-workspace/!(node_modules|build|.next|.turbo) ../langchain-core

mkdir ../langchain
cp -r ../langchain-workspace/!(node_modules|build|.next|.turbo) ../langchain

# Link the package locally
cd ../langchain-core
bun link

# Reinstall deps with bun because bun doesn't install deps of linked deps
bun install --no-save

# Link the package locally
cd ../langchain
sed -i 's/"@langchain\/core": "[^\"]*"/"@langchain\/core": "link:@langchain\/core"/g' package.json
bun link

# Reinstall deps with bun because bun doesn't install deps of linked deps
bun install --no-save

cd ../app

# Replace the workspace dependency with the local copy, and install all others
sed -i 's/"@langchain\/core": "workspace:\*"/"@langchain\/core": "link:@langchain\/core"/g' package.json
sed -i 's/"langchain": "workspace:\*"/"langchain": "link:langchain"/g' package.json
bun install --no-save

# Check the build command completes successfully
bun run build

# Check the test command completes successfully
bun run test
