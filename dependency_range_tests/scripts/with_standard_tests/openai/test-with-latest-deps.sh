#!/usr/bin/env bash

set -euxo pipefail

export CI=true

corepack enable

# New monorepo directory paths
monorepo_dir="/app/monorepo"
monorepo_openai_dir="/app/monorepo/libs/providers/langchain-openai"

# Updater script will not live inside the monorepo
updater_script_dir="/app/updater_script"

# Original directory paths
original_updater_script_dir="/scripts/with_standard_tests/openai/node"

# Run the shared script to copy all necessary folders/files and create mock tsconfig files
bash /scripts/with_standard_tests/shared.sh providers/langchain-openai

mkdir -p "$updater_script_dir"
cp "$original_updater_script_dir"/* "$updater_script_dir/"
cd "$updater_script_dir"
# Update any workspace dep to the latest version since not all workspaces are
# available in the test environment.
node "update_resolutions_latest.js"

# Navigate back to monorepo root and install dependencies
cd "$monorepo_dir"
pnpm install --no-frozen-lockfile

# Navigate into `@langchain/openai` to build and run tests
# We need to run inside the openai directory so turbo repo does
# not try to build the package/its workspace dependencies.
cd "$monorepo_openai_dir"

# Clean and reinstall to avoid dependency conflicts
pnpm install --no-frozen-lockfile
pnpm add @langchain/core langsmith
pnpm test
