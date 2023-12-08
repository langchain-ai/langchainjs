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

ls ./libs/

cp -r ../langchain-core ./libs/
cp -r ../langchain-openai ./libs/
cp -r ../langchain-anthropic ./libs/
cp -r ../langchain-community ./libs/
cp -r ../langchain ./libs/

ls ../langchain-anthropic
ls ./libs/langchain-anthropic/

# copy cache
mkdir -p ./.yarn
cp -r ../root/.yarn/!(berry|cache) ./.yarn
cp ../root/yarn.lock ../root/.yarnrc.yml .

# Replace the workspace dependency with the local copy, and install all others
# Avoid calling "yarn add ../langchain" as yarn berry does seem to hang for ~30s
# before installation actually occurs
# sed -i 's/"@langchain\/core": "workspace:\*"/"@langchain\/core": "..\/langchain-core"/g' package.json
# sed -i 's/"@langchain\/community": "workspace:\*"/"@langchain\/community": "..\/langchain-community"/g' package.json
# sed -i 's/"@langchain\/anthropic": "workspace:\*"/"@langchain\/anthropic": "..\/langchain-anthropic"/g' package.json
# sed -i 's/"@langchain\/openai": "workspace:\*"/"@langchain\/openai": "..\/langchain-openai"/g' package.json
# sed -i 's/"langchain": "workspace:\*"/"langchain": "..\/langchain"/g' package.json

yarn install --no-immutable

# Check the build command completes successfully
yarn build

# Check the test command completes successfully
yarn test
