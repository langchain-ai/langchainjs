#!/usr/bin/env bash

set -euxo pipefail

export CI=true

# New monorepo directory paths
monorepo_dir="/app/monorepo"
monorepo_cohere_dir="/app/monorepo/libs/langchain-cohere"

# Updater script will not live inside the monorepo
updater_script_dir="/app/updater_script"

# Original directory paths
original_updater_script_dir="/scripts/with_standard_tests/cohere/node"

# Run the shared script to copy all necessary folders/files
bash /scripts/with_standard_tests/shared.sh cohere

mkdir -p "$updater_script_dir"
cp "$original_updater_script_dir"/* "$updater_script_dir/"
cd "$updater_script_dir"
# Update any workspace dep to the latest version since not all workspaces are
# available in the test enviroment.
node "update_resolutions_latest.js"

# Navigate back to monorepo root and install dependencies
cd "$monorepo_dir"
yarn

# Navigate into `@langchain/cohere` to build and run tests
# We need to run inside the cohere directory so turbo repo does
# not try to build the package/its workspace dependencies.
cd "$monorepo_cohere_dir"

yarn add @langchain/core
yarn test
