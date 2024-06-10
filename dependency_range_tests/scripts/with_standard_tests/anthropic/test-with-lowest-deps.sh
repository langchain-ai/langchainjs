#!/usr/bin/env bash

set -euxo pipefail

export CI=true

# New monorepo directory paths
monorepo_dir="/app/monorepo"
monorepo_libs_dir="$monorepo_dir/libs"
monorepo_anthropic_dir="$monorepo_libs_dir/langchain-anthropic"
monorepo_standard_tests_dir="$monorepo_libs_dir/langchain-standard-tests"

# Updater script will not live inside the monorepo
updater_script_dir="/app/updater_script"
standard_tests_updater_script_dir="/app/with_standard_script"

# Original directory paths
original_anthropic_dir="/libs/langchain-anthropic"
original_standard_tests_dir="/libs/langchain-standard-tests"
original_package_json_dir="/package.json"
original_turbo_json_dir="/turbo.json"
original_updater_script_dir="/scripts/with_standard_tests/anthropic/node"
original_standard_tests_updater_script_dir="/scripts/with_standard_tests/node"

# enable extended globbing for omitting build artifacts
shopt -s extglob

# Create the top level monorepo directory
mkdir -p "$monorepo_dir"

# Copy `@langchain/standard-tests` WITH build artifacts from the host.
# This is because we build @langchain/standard-tests before running this script.
mkdir -p "$monorepo_standard_tests_dir/"
cp -r "$original_standard_tests_dir"/* "$monorepo_standard_tests_dir/"

# Copy `@langchain/anthropic` WITHOUT build artifacts from the host.
mkdir -p "$monorepo_anthropic_dir/"
cp -r "$original_anthropic_dir"/!(node_modules|dist|dist-cjs|dist-esm|build|.next|.turbo) "$monorepo_anthropic_dir/"

# Copy the turbo and package.json files for monorepo
cp "$original_turbo_json_dir" "$monorepo_dir/"
cp "$original_package_json_dir" "$monorepo_dir/"

# Replace any workspace dependencies in `@langchain/standard-tests`
# with "latest" for the version.
mkdir -p "$standard_tests_updater_script_dir"
cp "$original_standard_tests_updater_script_dir"/* "$standard_tests_updater_script_dir/"
cd "$standard_tests_updater_script_dir"
# Run the updater script
node "update_workspace_dependencies.js"

# Navigate back to root
cd "/app"

mkdir -p "$updater_script_dir"
cp "$original_updater_script_dir"/* "$updater_script_dir/"
# Install deps (e.g semver) for the updater script
cd "$updater_script_dir"
yarn
# Run the updater script
node "update_resolutions_lowest.js"
node "update_workspace_deps.js"

# Navigate back to monorepo root and install dependencies
cd "$monorepo_dir"
yarn

# Navigate into `@langchain/anthropic` to build and run tests
# We need to run inside the anthropic directory so turbo repo does
# not try to build the package/it's workspace dependencies.
cd "$monorepo_anthropic_dir"
yarn test
