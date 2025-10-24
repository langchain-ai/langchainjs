#!/usr/bin/env bash

set -euxo pipefail

export CI=true

# New monorepo directory paths
monorepo_dir="/app/monorepo"
monorepo_community_dir="/app/monorepo/libs/langchain-community"

# Updater script will not live inside the monorepo
updater_script_dir="/app/updater_script"

# Original directory paths
original_updater_script_dir="/scripts/with_standard_tests/community/node"

# Run the shared script to copy all necessary folders/files
bash /scripts/with_standard_tests/shared.sh community

mkdir -p "$updater_script_dir"
cp "$original_updater_script_dir"/* "$updater_script_dir/"
cd "$updater_script_dir"
# Update any workspace dep to the latest version since not all workspaces are
# available in the test enviroment.
node "update_resolutions_latest.js"

# Navigate back to monorepo root and install dependencies
cd "$monorepo_dir"
touch yarn.lock
yarn

# Navigate into `@langchain/community` to build and run tests
# We need to run inside the community directory so turbo repo does
# not try to build the package/its workspace dependencies.
cd "$monorepo_community_dir"

yarn add @langchain/core
yarn test
