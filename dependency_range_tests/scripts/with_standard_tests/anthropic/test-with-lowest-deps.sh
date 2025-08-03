#!/usr/bin/env bash

set -euxo pipefail

export CI=true

monorepo_dir="/app/monorepo"
monorepo_anthropic_dir="/app/monorepo/libs/langchain-anthropic"
updater_script_dir="/app/updater_script"
original_updater_script_dir="/scripts/with_standard_tests/anthropic/node"

# Run the shared script to copy all necessary folders/files
bash /scripts/with_standard_tests/shared.sh anthropic

# Copy the updater script to the monorepo
mkdir -p "$updater_script_dir"
cp "$original_updater_script_dir"/* "$updater_script_dir/"

# Install deps (e.g semver) for the updater script
cd "$updater_script_dir"
pnpm install --production
# Run the updater script
node "update_workspace_deps.js"
node "update_resolutions_lowest.js"

# Navigate back to monorepo root and install dependencies
cd "$monorepo_dir"
touch pnpm.lock
pnpm install --production

# Navigate into `@langchain/anthropic` to build and run tests
# We need to run inside the package directory so turbo repo does
# not try to build the package/its workspace dependencies.
cd "$monorepo_anthropic_dir"

# Read the @langchain/core version from peerDependencies
core_version=$(node -p "require('./package.json').peerDependencies?.['@langchain/core']")

# Install @langchain/core at the specified version
pnpm add @langchain/core@$core_version
pnpm test
