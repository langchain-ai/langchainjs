#!/usr/bin/env bash

set -euxo pipefail

export CI=true

corepack enable

monorepo_dir="/app/monorepo"
monorepo_openai_dir="/app/monorepo/libs/providers/langchain-openai"
updater_script_dir="/app/updater_script"
original_updater_script_dir="/scripts/with_standard_tests/openai/node"

# Run the shared script to copy all necessary folders/files and create mock tsconfig files
bash /scripts/with_standard_tests/shared.sh providers/langchain-openai

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
pnpm install --no-frozen-lockfile

# Navigate into `@langchain/package` to build and run tests
# We need to run inside the package directory so turbo repo does
# not try to build the package/its workspace dependencies.
cd "$monorepo_openai_dir"

# Read the @langchain/core version from peerDependencies
core_version=$(node -p "require('./package.json').peerDependencies?.['@langchain/core']")

# Install @langchain/core at the specified version
pnpm add @langchain/core@$core_version langsmith
pnpm test
