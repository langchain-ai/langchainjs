#!/usr/bin/env bash

set -euxo pipefail

export CI=true

# enable extended globbing for omitting build artifacts
shopt -s extglob

# avoid copying build artifacts from the host
cp -r ../package/!(node_modules|dist|dist-cjs|dist-esm|build|.next|.turbo) .

mkdir -p ./libs/langchain-core/
mkdir -p ./libs/langchain-openai/
mkdir -p ./libs/langchain-anthropic/
mkdir -p ./libs/langchain-community/
mkdir -p ./libs/langchain/

cp -r ../langchain-core ./libs/
cp -r ../langchain-openai ./libs/
cp -r ../langchain-anthropic ./libs/
cp -r ../langchain-community ./libs/
cp -r ../langchain ./libs/

# copy cache
mkdir -p ./.yarn
cp -r ../root/.yarn/!(berry|cache) ./.yarn
cp ../root/yarn.lock ../root/.yarnrc.yml .

yarn plugin import workspace-tools
yarn workspaces focus --production

# Check the build command completes successfully
yarn build

# Check the test command completes successfully
yarn test
