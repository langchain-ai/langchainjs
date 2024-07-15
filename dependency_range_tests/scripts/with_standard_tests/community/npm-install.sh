#!/usr/bin/env bash

set -euxo pipefail

export CI=true

# New monorepo directory paths
monorepo_dir="/app/monorepo"
monorepo_community_dir="/app/monorepo/libs/langchain-community"

# Run the shared script to copy all necessary folders/files
bash /scripts/with_standard_tests/shared.sh community

# Navigate back to monorepo root and install dependencies
cd "$monorepo_dir"
npm install

