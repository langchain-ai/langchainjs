#!/usr/bin/env bash

set -euxo pipefail

export CI=true

# Install tsx to run TypeScript files
npm install -g tsx

# Run the TypeScript test runner
tsx /scripts/test-runner.ts