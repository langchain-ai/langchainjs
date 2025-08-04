#!/usr/bin/env bash

set -euxo pipefail

export CI=true

monorepo_dir="/app/monorepo"
monorepo_vertexai_dir="/app/monorepo/libs/providers/langchain-google-vertexai"
updater_script_dir="/app/updater_script"
updater_script_dir="/app/updater_script"
original_updater_script_dir="/scripts/with_standard_tests/google-vertexai/node"

# Run the shared script to copy all necessary folders/files
bash /scripts/with_standard_tests/shared.sh providers/langchain-google-vertexai

# Copy the updater script to the monorepo
mkdir -p "$updater_script_dir"
cp "$original_updater_script_dir"/* "$updater_script_dir/"

# Install deps (e.g semver) for the updater script
cd "$updater_script_dir"
pnpm install
# Run the updater script
node "update_resolutions_lowest.js"


# Navigate back to monorepo root and install dependencies
cd "$monorepo_dir"
pnpm install

# Navigate into `@langchain/package` to build and run tests
# We need to run inside the package directory so turbo repo does
# not try to build the package/its workspace dependencies.
cd "$monorepo_vertexai_dir"

pnpm test
