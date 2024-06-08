#!/usr/bin/env bash

set -euxo pipefail

export CI=true

# enable extended globbing for omitting build artifacts
shopt -s extglob

# avoid copying build artifacts from the host
mkdir -p ./libs/langchain-community/ ./libs/langchain-standard-tests/
cp -r ../libs/langchain-community/!(node_modules|dist|dist-cjs|dist-esm|build|.next|.turbo) ./libs/langchain-community/
cp -r ../libs/langchain-standard-tests ./libs/langchain-standard-tests/
cp ../turbo.json ./
cp ../package.json ./

ls ./libs
# ls ./libs/langchain-community
ls ./libs/langchain-standard-tests/langchain-standard-tests

# Copy all contents from ./libs/langchain-standard-tests/langchain-standard-tests to ./libs/langchain-standard-tests
cp -r ./libs/langchain-standard-tests/langchain-standard-tests/* ./libs/langchain-standard-tests/

# Delete the ./libs/langchain-standard-tests/langchain-standard-tests directory
rm -rf ./libs/langchain-standard-tests/langchain-standard-tests

ls ./libs/langchain-standard-tests

# Replace any workspace dependencies in `@langchain/standard-tests`
# with "latest" for the version.
mkdir -p /updater_script
cp /scripts/community/node/update_workspace_dependencies.js /updater_script/
node /updater_script/update_workspace_dependencies.js

yarn

# Check the test command completes successfully
ls
ls ./libs
cd ./libs/langchain-community && yarn test
# yarn run jest --testPathIgnorePatterns=\\.int\\.test.ts --testTimeout 30000 --maxWorkers=50%
