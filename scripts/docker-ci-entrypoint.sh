#!/usr/bin/env bash

set -euxo pipefail

export CI=true

cp -r ../package/* .

cp ../root/yarn.lock .

# Replace the workspace dependency with the local copy, and install all others
yarn add ../langchain

# Check the build command completes successfully
yarn build

# Check the test command completes successfully
yarn test
