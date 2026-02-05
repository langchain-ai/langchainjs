#!/usr/bin/env bash

set -euxo pipefail

export CI=true
export BUN_ENV=true

# Bun can run TypeScript files directly
bun /scripts/test-runner.ts