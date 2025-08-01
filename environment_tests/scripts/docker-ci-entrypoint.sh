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

# Helper function to check if directory exists and has content  
has_content() {
  test -d "$1" && test "$(ls -1A "$1" 2>/dev/null | wc -l)" -gt 0
}

# Copy package contents, but only if directories have content
has_content ../langchain-core && cp -r ../langchain-core/!(node_modules) ./libs/langchain-core
has_content ../langchain-openai && cp -r ../langchain-openai/!(node_modules) ./libs/langchain-openai
has_content ../langchain-anthropic && cp -r ../langchain-anthropic/!(node_modules) ./libs/langchain-anthropic
has_content ../langchain-community && cp -r ../langchain-community/!(node_modules) ./libs/langchain-community
has_content ../langchain-cohere && cp -r ../langchain-cohere/!(node_modules) ./libs/langchain-cohere
has_content ../langchain-ollama && cp -r ../langchain-ollama/!(node_modules) ./libs/langchain-ollama
has_content ../langchain-google-gauth && cp -r ../langchain-google-gauth/!(node_modules) ./libs/langchain-google-gauth
has_content ../langchain && cp -r ../langchain/!(node_modules) ./libs/langchain

# Replace workspace dependencies with published versions for missing packages
! has_content ../langchain-core && find . -name "package.json" -exec sed -i 's/"@langchain\/core": "workspace:\*"/"@langchain\/core": ">=0.3.58 <0.4.0"/g' {} \;
! has_content ../langchain-openai && find . -name "package.json" -exec sed -i 's/"@langchain\/openai": "workspace:\*"/"@langchain\/openai": "*"/g' {} \;
! has_content ../langchain-anthropic && find . -name "package.json" -exec sed -i 's/"@langchain\/anthropic": "workspace:\*"/"@langchain\/anthropic": "*"/g' {} \;
! has_content ../langchain-community && find . -name "package.json" -exec sed -i 's/"@langchain\/community": "workspace:\*"/"@langchain\/community": "*"/g' {} \;
! has_content ../langchain-cohere && find . -name "package.json" -exec sed -i 's/"@langchain\/cohere": "workspace:\*"/"@langchain\/cohere": "*"/g' {} \;
! has_content ../langchain-ollama && find . -name "package.json" -exec sed -i 's/"@langchain\/ollama": "workspace:\*"/"@langchain\/ollama": "*"/g' {} \;
! has_content ../langchain-google-gauth && find . -name "package.json" -exec sed -i 's/"@langchain\/google-gauth": "workspace:\*"/"@langchain\/google-gauth": "*"/g' {} \;
! has_content ../langchain && find . -name "package.json" -exec sed -i 's/"langchain": "workspace:\*"/"langchain": "^0.3.30"/g' {} \;

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
