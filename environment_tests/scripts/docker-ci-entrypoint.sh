#!/usr/bin/env bash

set -euxo pipefail

export CI=true

# enable extended globbing for omitting build artifacts
shopt -s extglob

# avoid copying build artifacts from the host
cp -r ../package/!(node_modules|dist|dist-cjs|dist-esm|build|.next|.turbo) .

# make sure the .eslintrc makes it over
if [ -f ../package/.eslintrc.json ]; then
  cp ../package/.eslintrc.json .
fi

mkdir -p ./libs/langchain-core/
mkdir -p ./libs/langchain-openai/
mkdir -p ./libs/langchain-anthropic/
mkdir -p ./libs/langchain-community/
mkdir -p ./libs/langchain-cohere/
mkdir -p ./libs/langchain-ollama/
mkdir -p ./libs/langchain-google-gauth/
mkdir -p ./libs/langchain/

cp -r ../langchain-core/!(node_modules) ./libs/langchain-core
cp -r ../langchain-openai/!(node_modules) ./libs/langchain-openai
cp -r ../langchain-anthropic/!(node_modules) ./libs/langchain-anthropic
cp -r ../langchain-community/!(node_modules) ./libs/langchain-community
cp -r ../langchain-cohere/!(node_modules) ./libs/langchain-cohere
cp -r ../langchain-ollama/!(node_modules) ./libs/langchain-ollama
cp -r ../langchain-google-gauth/!(node_modules) ./libs/langchain-google-gauth
cp -r ../langchain/!(node_modules) ./libs/langchain

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
