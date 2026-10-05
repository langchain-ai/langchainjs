#!/usr/bin/env bash
# Fail if a workspace package with a tsconfig.json has no `typecheck` script.
# `pnpm typecheck` runs each package's own `typecheck` script, so a package
# without one would be skipped silently.
set -euo pipefail

missing=0
while IFS= read -r dir; do
  [ -f "$dir/tsconfig.json" ] || continue
  if ! jq -e '.scripts.typecheck' "$dir/package.json" > /dev/null; then
    name=$(jq -r .name "$dir/package.json")
    echo "::error file=${dir#"$PWD"/}/package.json::${name} has a tsconfig.json but no \"typecheck\" script"
    missing=1
  fi
done < <(pnpm ls -r --depth -1 --json | jq -r '.[].path')

exit "$missing"
