#!/usr/bin/env bash

set -euxo pipefail

export CI=true

# enable extended globbing for omitting build artifacts
shopt -s extglob

# Function to replace workspace dependencies with either links or published versions
replace_workspace_deps() {
    local file="$1"
    local use_links="$2"
    
    if [ "$use_links" = true ]; then
        echo "Replacing workspace dependencies with links in $file"
        sed -i 's/"@langchain\/core": "workspace:\*"/"@langchain\/core": "link:@langchain\/core"/g' "$file"
        sed -i 's/"langchain": "workspace:\*"/"langchain": "link:langchain"/g' "$file"
    else
        echo "Replacing workspace dependencies with published versions in $file"
        sed -i 's/"@langchain\/core": "workspace:\*"/"@langchain\/core": ">=0.3.58 <0.4.0"/g' "$file"
        sed -i 's/"langchain": "workspace:\*"/"langchain": "^0.3.30"/g' "$file"
    fi
    
    # Always use published versions for other @langchain/* packages (not available in Docker context)
    sed -i 's/"@langchain\/anthropic": "workspace:\*"/"@langchain\/anthropic": "*"/g' "$file"
    sed -i 's/"@langchain\/cohere": "workspace:\*"/"@langchain\/cohere": "*"/g' "$file"
    sed -i 's/"@langchain\/openai": "workspace:\*"/"@langchain\/openai": "*"/g' "$file"
    sed -i 's/"@langchain\/community": "workspace:\*"/"@langchain\/community": "*"/g' "$file"
}

# Function to copy and link a package
link_package() {
    local source_dir="$1"
    local copy_dir="$2"
    local package_name="$3"
    
    rm -rf "$copy_dir"
    mkdir "$copy_dir"
    
    if [ "$(ls -A "$source_dir" 2>/dev/null)" ]; then
        cp -r "$source_dir"/!(node_modules|build|.next|.turbo) "$copy_dir"
        cd "$copy_dir"
        bun link
        bun install --no-save --ignore-scripts
        echo "Successfully linked $package_name"
        return 0
    else
        echo "Warning: $source_dir is empty, skipping $package_name"
        return 1
    fi
}

# Copy the test package files
cp -r ../package/!(node_modules|dist|dist-cjs|dist-esm|build|.next|.turbo) .

# Track whether core packages were successfully linked
LANGCHAIN_CORE_LINKED=false
LANGCHAIN_LINKED=false

# Link @langchain/core
if link_package "../langchain-core" "../langchain-core-copy" "@langchain/core"; then
    LANGCHAIN_CORE_LINKED=true
fi

# Link langchain (and update its @langchain/core dependency if needed)
if link_package "../langchain" "../langchain-copy" "langchain"; then
    if [ "$LANGCHAIN_CORE_LINKED" = true ]; then
        echo "Updating langchain to use linked @langchain/core"
        sed -i 's/"@langchain\/core": "[^\"]*"/"@langchain\/core": "link:@langchain\/core"/g' ../langchain-copy/package.json
        cd ../langchain-copy
        bun install --no-save --ignore-scripts
    else
        replace_workspace_deps "../langchain-copy/package.json" false
        cd ../langchain-copy
        bun install --no-save --ignore-scripts
    fi
    LANGCHAIN_LINKED=true
fi

# Prepare the test app
cd ../app
replace_workspace_deps "package.json" "$LANGCHAIN_LINKED"

bun install --no-save --ignore-scripts

# Check the build command completes successfully
bun run build

# Check the test command completes successfully
bun run test
