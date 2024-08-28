#!/usr/bin/env bash

set -euxo pipefail

export CI=true

# New monorepo directory paths
monorepo_dir="/app/monorepo"
monorepo_anthropic_dir="/app/monorepo/libs/langchain-anthropic"

# Updater script will not live inside the monorepo
updater_script_dir="/app/updater_script"

# Original directory paths
original_updater_script_dir="/scripts/with_standard_tests/anthropic/node"

# Run the shared script to copy all necessary folders/files
bash /scripts/with_standard_tests/shared.sh anthropic

mkdir -p "$updater_script_dir"
cp "$original_updater_script_dir"/* "$updater_script_dir/"
cd "$updater_script_dir"
# Update any workspace dep to the latest version since not all workspaces are
# available in the test enviroment.
node "update_workspace_deps.js"

# Navigate back to monorepo root and install dependencies
cd "$monorepo_dir"
yarn

# Navigate into `@langchain/anthropic` to build and run tests
# We need to run inside the anthropic directory so turbo repo does
# not try to build the package/its workspace dependencies.
cd "$monorepo_anthropic_dir"
yarn test
