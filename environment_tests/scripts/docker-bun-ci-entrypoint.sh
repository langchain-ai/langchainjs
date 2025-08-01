#!/usr/bin/env bash

set -euxo pipefail

export CI=true

# enable extended globbing for omitting build artifacts
shopt -s extglob

# avoid copying build artifacts from the host
cp -r ../package/!(node_modules|dist|dist-cjs|dist-esm|build|.next|.turbo) .

rm -rf ../langchain-core-copy
mkdir ../langchain-core-copy
# Check if langchain-core has content before copying
if [ "$(ls -A ../langchain-core)" ]; then
    cp -r ../langchain-core/!(node_modules|build|.next|.turbo) ../langchain-core-copy
else
    echo "Warning: ../langchain-core is empty, skipping copy"
fi

rm -rf ../langchain-copy
mkdir ../langchain-copy
# Check if langchain has content before copying
if [ "$(ls -A ../langchain)" ]; then
    cp -r ../langchain/!(node_modules|build|.next|.turbo) ../langchain-copy
else
    echo "Warning: ../langchain is empty, skipping copy"
fi

# Track whether packages were successfully linked
LANGCHAIN_CORE_LINKED=false
LANGCHAIN_LINKED=false

# Link the package locally
if [ -f ../langchain-core-copy/package.json ]; then
    cd ../langchain-core-copy
    bun link
    # Reinstall deps with bun because bun doesn't install deps of linked deps
    bun install --no-save --ignore-scripts
    LANGCHAIN_CORE_LINKED=true
else
    echo "Warning: No package.json found in langchain-core-copy, skipping bun link"
fi

# Link the package locally
if [ -f ../langchain-copy/package.json ]; then
    cd ../langchain-copy
    # Only modify the core dependency if core was actually linked
    if [ "$LANGCHAIN_CORE_LINKED" = true ]; then
        echo "Updating langchain to use linked @langchain/core"
        sed -i 's/"@langchain\/core": "[^\"]*"/"@langchain\/core": "link:@langchain\/core"/g' package.json
    else
        echo "Replacing workspace dependencies with published versions"
        sed -i 's/"@langchain\/core": "workspace:\*"/"@langchain\/core": ">=0.3.58 <0.4.0"/g' package.json
        # Replace other common workspace dependencies
        sed -i 's/"@langchain\/anthropic": "workspace:\*"/"@langchain\/anthropic": "*"/g' package.json
        sed -i 's/"@langchain\/cohere": "workspace:\*"/"@langchain\/cohere": "*"/g' package.json
        sed -i 's/"@langchain\/openai": "workspace:\*"/"@langchain\/openai": "*"/g' package.json
        sed -i 's/"@langchain\/community": "workspace:\*"/"@langchain\/community": "*"/g' package.json
    fi
    bun link
    # Reinstall deps with bun because bun doesn't install deps of linked deps
    bun install --no-save --ignore-scripts
    LANGCHAIN_LINKED=true
else
    echo "Warning: No package.json found in langchain-copy, skipping bun link"
fi

cd ../app

# Replace the workspace dependency with the local copy, and install all others
if [ "$LANGCHAIN_CORE_LINKED" = true ]; then
    echo "Replacing @langchain/core workspace dependency with link"
    sed -i 's/"@langchain\/core": "workspace:\*"/"@langchain\/core": "link:@langchain\/core"/g' package.json
else
    echo "Replacing @langchain/core workspace dependency with published version"
    sed -i 's/"@langchain\/core": "workspace:\*"/"@langchain\/core": ">=0.3.58 <0.4.0"/g' package.json
    # Replace other common workspace dependencies in app
    sed -i 's/"@langchain\/anthropic": "workspace:\*"/"@langchain\/anthropic": "*"/g' package.json
    sed -i 's/"@langchain\/cohere": "workspace:\*"/"@langchain\/cohere": "*"/g' package.json
    sed -i 's/"@langchain\/openai": "workspace:\*"/"@langchain\/openai": "*"/g' package.json
    sed -i 's/"@langchain\/community": "workspace:\*"/"@langchain\/community": "*"/g' package.json
fi

if [ "$LANGCHAIN_LINKED" = true ]; then
    echo "Replacing langchain workspace dependency with link"
    sed -i 's/"langchain": "workspace:\*"/"langchain": "link:langchain"/g' package.json
else
    echo "Replacing langchain workspace dependency with published version"
    sed -i 's/"langchain": "workspace:\*"/"langchain": "^0.3.30"/g' package.json
fi

bun install --no-save --ignore-scripts

# Check the build command completes successfully
bun run build

# Check the test command completes successfully
bun run test
