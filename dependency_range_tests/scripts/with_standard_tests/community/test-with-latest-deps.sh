#!/usr/bin/env bash

set -euxo pipefail

export CI=true

# New monorepo directory paths
monorepo_dir="/app/monorepo"
monorepo_libs_dir="$monorepo_dir/libs"
monorepo_community_dir="$monorepo_libs_dir/langchain-community"
monorepo_standard_tests_dir="$monorepo_libs_dir/langchain-standard-tests"

# Updater script will not live inside the monorepo
updater_script_dir="/app/updater_script"

# Original directory paths
original_community_dir="/libs/langchain-community"
original_standard_tests_dir="/libs/langchain-standard-tests"
original_package_json_dir="/package.json"
original_turbo_json_dir="/turbo.json"
original_updater_script_dir="/scripts/community/node"

# enable extended globbing for omitting build artifacts
shopt -s extglob

# Create the top level monorepo directory
mkdir -p "$monorepo_dir"

# Copy `@langchain/standard-tests` WITH build artifacts from the host.
# This is because we build @langchain/standard-tests before running this script.
mkdir -p "$monorepo_standard_tests_dir/"
cp -r "$original_standard_tests_dir"/* "$monorepo_standard_tests_dir/"

# Copy `@langchain/community` WITHOUT build artifacts from the host.
mkdir -p "$monorepo_community_dir/"
cp -r "$original_community_dir"/!(node_modules|dist|dist-cjs|dist-esm|build|.next|.turbo) "$monorepo_community_dir/"

# Copy the turbo and package.json files for monorepo
cp "$original_turbo_json_dir" "$monorepo_dir/"
cp "$original_package_json_dir" "$monorepo_dir/"

# Replace any workspace dependencies in `@langchain/standard-tests`
# with "latest" for the version.
mkdir -p "$updater_script_dir"
cp "$original_updater_script_dir"/* "$updater_script_dir/"

# Install deps (e.g semver) for the updater script
cd "$updater_script_dir"
yarn
# Run the updater scripts
node "update_workspace_dependencies.js"

# Navigate back to monorepo root and install dependencies
cd "$monorepo_dir"
yarn

# Navigate into `@langchain/community` and run tests
# We need to run inside the community directory so turbo repo does
# not try to build the package/it's workspace dependencies.
cd "$monorepo_community_dir"
yarn test
