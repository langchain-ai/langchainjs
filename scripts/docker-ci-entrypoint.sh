#!/usr/bin/env bash

set -euxo pipefail

export CI=true

# enable extended globbing for omitting build artifacts
shopt -s extglob

# avoid copying build artifacts from the host
cp -r ../package/!(node_modules|dist|dist-cjs|dist-esm|build|.next|.turbo) .

# copy cache
mkdir -p ./.yarn
cp -r ../root/.yarn/!(berry|cache) ./.yarn
cp ../root/yarn.lock ../root/.yarnrc.yml .

# Replace the workspace dependency with the local copy, and install all others
# Avoid calling "yarn add ../langchain" as yarn berry does seem to hang for ~30s
# before installation actually occurs
sed -i 's/"langchain": "workspace:\*"/"langchain": "..\/langchain"/g' package.json
yarn install --no-immutable

# Check the build command completes successfully
yarn build

# Check the test command completes successfully
yarn test
