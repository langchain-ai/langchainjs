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

node "update_resolutions_npm.js"

# Navigate back to monorepo root and install dependencies
cd "$monorepo_dir"
npm install @langchain/core --production
npm install --production
