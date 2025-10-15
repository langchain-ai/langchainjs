#!/usr/bin/env bash

set -euxo pipefail

export CI=true

corepack enable

# New monorepo directory paths
monorepo_dir="/app/monorepo"
monorepo_cohere_dir="/app/monorepo/libs/providers/langchain-cohere"

# Update script will not live inside the monorepo
updater_script_dir="/app/updater_script"

# Original directory paths
original_updater_script_dir="/scripts/with_standard_tests/cohere/node"

# Run the shared script to copy all necessary folders/files
bash /scripts/with_standard_tests/shared.sh providers/langchain-cohere

# Copy the updater script to the monorepo
mkdir -p "$updater_script_dir"
cp "$original_updater_script_dir"/* "$updater_script_dir/"
cd "$updater_script_dir"
# Run the updater script
node "update_resolutions_lowest.js"

# Navigate back to monorepo root and install dependencies
cd "$monorepo_dir"
pnpm install --prod --no-frozen-lockfile

# Navigate into `@langchain/cohere` to build and run tests
# We need to run inside the cohere directory so turbo repo does
# not try to build the package/its workspace dependencies.
cd "$monorepo_cohere_dir"

# Read the @langchain/core version from peerDependencies
core_version=$(node -p "require('./package.json').peerDependencies?.['@langchain/core']")

# Install @langchain/core at the specified version
pnpm install --no-frozen-lockfile
pnpm add @langchain/core@$core_version
pnpm test
