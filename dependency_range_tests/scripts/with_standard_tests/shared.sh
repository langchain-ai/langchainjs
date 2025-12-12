#!/usr/bin/env bash

# Extract the package name from the first argument
package_path=$1

# Check if this is a provider package or a regular package
if [[ "$package_path" == providers/* ]]; then
  # For provider packages, use the full path as-is
  package_dir="$package_path"
  # Extract just the package name for monorepo directory structure
  package_name=$(basename "$package_path")
else
  # For regular packages, apply the mapping
  package_name="$package_path"
  case "$package_name" in
    "community")
      package_dir="langchain-community"
      ;;
    "openai")
      package_dir="langchain-openai"
      ;;
    "anthropic")
      package_dir="langchain-anthropic"
      ;;
    "cohere")
      package_dir="langchain-cohere"
      ;;
    "google-vertexai")
      package_dir="langchain-google-vertexai"
      ;;
    *)
      package_dir="langchain-$package_name"
      ;;
  esac
fi

# New monorepo directory paths
monorepo_dir="/app/monorepo"
monorepo_libs_dir="$monorepo_dir/libs"
monorepo_package_dir="$monorepo_libs_dir/$package_dir"
monorepo_standard_tests_dir="$monorepo_libs_dir/langchain-standard-tests"

# Updater script will not live inside the monorepo
standard_tests_updater_script_dir="/app/with_standard_script"

# Original directory paths
original_package_dir="/libs/$package_dir"
original_standard_tests_dir="/libs/langchain-standard-tests"
original_package_json_dir="/package.json"
original_turbo_json_dir="/turbo.json"
original_standard_tests_updater_script_dir="/scripts/with_standard_tests/node"

# enable extended globbing for omitting build artifacts
shopt -s extglob

# Create the top level monorepo directory
mkdir -p "$monorepo_dir"

# Copy `@langchain/standard-tests` WITH build artifacts from the host.
# This is because we build @langchain/standard-tests before running this script.
mkdir -p "$monorepo_standard_tests_dir/"
cp -r "$original_standard_tests_dir"/* "$monorepo_standard_tests_dir/"

# Copy `@langchain/package` WITHOUT build artifacts from the host.
mkdir -p "$monorepo_package_dir/"
cp -r "$original_package_dir"/!(node_modules|dist|dist-cjs|dist-esm|build|.next|.turbo) "$monorepo_package_dir/"

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

# Create mock tsconfig.json files without project references since we're testing against NPM packages
bash /scripts/create-mock-tsconfigs.sh "$package_dir" "$monorepo_dir"

# Navigate back to root
cd "/app"
