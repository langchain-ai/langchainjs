#!/usr/bin/env bash

set -euxo pipefail

corepack enable

export CI=true
export LC_DEPENDENCY_RANGE_TESTS=true

# enable extended globbing for omitting build artifacts
shopt -s extglob

# avoid copying build artifacts from the host
cp -r ../langchain/!(node_modules|dist|dist-cjs|dist-esm|build|.next|.turbo) ./

mkdir -p /updater_script
cp -r /scripts/langchain/node/!(node_modules|dist|dist-cjs|dist-esm|build|.next|.turbo) /updater_script/

cd /updater_script

pnpm install --prod

cd /app

node /updater_script/update_resolutions_lowest.js

# Read the @langchain/core version from peerDependencies
core_version=$(node -p "require('./package.json').peerDependencies?.['@langchain/core']")
openai_version=$(node -p "require('./package.json').peerDependencies?.['@langchain/openai']")
textsplitters_version=$(node -p "require('./package.json').peerDependencies?.['@langchain/textsplitters']")
anthropic_version=$(node -p "require('./package.json').peerDependencies?.['@langchain/anthropic']")
cohere_version=$(node -p "require('./package.json').peerDependencies?.['@langchain/cohere']")

pnpm install
pnpm add @langchain/core@$core_version @langchain/openai@$openai_version @langchain/textsplitters@$textsplitters_version @langchain/anthropic@$anthropic_version @langchain/cohere@$cohere_version

# Check the test command completes successfully
pnpm run test
