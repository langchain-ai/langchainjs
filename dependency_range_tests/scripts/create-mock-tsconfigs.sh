#!/usr/bin/env bash

# Helper script to create mock tsconfig.json files without project references
# Usage: create-mock-tsconfigs.sh <package_dir> [monorepo_dir]
# Example: create-mock-tsconfigs.sh libs/langchain /app/monorepo
#          create-mock-tsconfigs.sh . /app  (for langchain scripts)

package_dir="$1"
monorepo_dir="${2:-/app/monorepo}"

# Handle case where package_dir is "." (langchain scripts)
if [ "$package_dir" = "." ]; then
  package_dir=""
  monorepo_dir="/app"
fi

# Copy internal/tsconfig (needed for @langchain/tsconfig workspace dependency)
monorepo_internal_dir="$monorepo_dir/internal"
original_internal_dir="/internal"
mkdir -p "$monorepo_internal_dir/tsconfig"
cp -r "$original_internal_dir/tsconfig"/* "$monorepo_internal_dir/tsconfig/" 2>/dev/null || true

# Also create it at /internal/tsconfig for langchain scripts that reference /internal/tsconfig directly
if [ "$monorepo_dir" = "/app" ]; then
  mkdir -p "/internal/tsconfig"
  cp -r "$original_internal_dir/tsconfig"/* "/internal/tsconfig/" 2>/dev/null || true
fi

# Calculate relative path from package to internal/tsconfig
if [ -z "$package_dir" ] || [ "$package_dir" = "." ]; then
  # Langchain scripts copy to /app directly, use absolute path since vite has issues with relative paths
  package_extends_path="/app/internal/tsconfig/base.json"
elif [[ "$package_dir" == *"providers"* ]]; then
  # Provider packages are at libs/providers/langchain-xxx, so go up 3 levels
  package_extends_path="../../../internal/tsconfig/base.json"
elif [[ "$package_dir" == "libs/langchain" ]]; then
  # Langchain package is at libs/langchain, so go up 2 levels
  package_extends_path="../../internal/tsconfig/base.json"
else
  # Regular packages are at libs/langchain-xxx, so go up 2 levels
  package_extends_path="../../internal/tsconfig/base.json"
fi

# Create mock tsconfig.json for the package
if [ -n "$package_dir" ]; then
  monorepo_package_dir="$monorepo_dir/$package_dir"
else
  monorepo_package_dir="$monorepo_dir"
fi

if [ -d "$monorepo_package_dir" ]; then
  # Check if this is the langchain package (needs JSON files included)
  if [ -z "$package_dir" ] || [ "$package_dir" = "." ] || [ "$package_dir" = "libs/langchain" ]; then
    include_pattern='["src/**/*", "src/**/*.json"]'
  else
    include_pattern='["src/**/*"]'
  fi
  
  cat > "$monorepo_package_dir/tsconfig.json" << EOF
{
  "extends": "$package_extends_path",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": $include_pattern,
  "exclude": ["dist", "node_modules"]
}
EOF
fi

# Create mock tsconfig.json for langchain-standard-tests if it exists
# Create it both in the monorepo location and at the original mounted location
monorepo_standard_tests_dir="$monorepo_dir/libs/langchain-standard-tests"
if [ -d "$monorepo_standard_tests_dir" ]; then
  cat > "$monorepo_standard_tests_dir/tsconfig.json" << 'EOF'
{
  "extends": "../../internal/tsconfig/base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*"],
  "exclude": ["dist", "node_modules"]
}
EOF
fi

# Also create it at the original mounted location since vite resolves relative to source files
mkdir -p /libs/langchain-standard-tests
cat > /libs/langchain-standard-tests/tsconfig.json << 'EOF'
{
  "extends": "../../internal/tsconfig/base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*"],
  "exclude": ["dist", "node_modules"]
}
EOF

# Create a mock tsconfig.json at the expected langchain-core location to prevent vite from looking for it
# Create it both at the original mount location and in the monorepo if it's a monorepo setup
mkdir -p /libs/langchain-core
cat > /libs/langchain-core/tsconfig.json << 'EOF'
{
  "extends": "../../internal/tsconfig/base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*"],
  "exclude": ["dist", "node_modules"]
}
EOF

# Also create it in the monorepo location if using monorepo structure
if [ "$monorepo_dir" != "/app" ]; then
  mkdir -p "$monorepo_dir/libs/langchain-core"
  cat > "$monorepo_dir/libs/langchain-core/tsconfig.json" << 'EOF'
{
  "extends": "../../internal/tsconfig/base.json",
  "compilerOptions": {
    "rootDir": "src",
    "outDir": "dist"
  },
  "include": ["src/**/*"],
  "exclude": ["dist", "node_modules"]
}
EOF
fi

