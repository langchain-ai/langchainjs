#!/usr/bin/env bash
# Fail if a workspace package with a tsconfig.json has no `typecheck` script
# and isn't listed in typecheck-exemptions.txt. `pnpm typecheck` runs each
# package's own `typecheck` script, so a package without one would be skipped
# silently. Also fail if the list names a package that has the script, or that
# isn't a workspace package with a tsconfig.json, so the list can only shrink.
set -euo pipefail

exemptions_file="$(dirname "$0")/typecheck-exemptions.txt"
exempt=$(sed -e 's/#.*//' -e 's/[[:space:]]*$//' -e '/^$/d' "$exemptions_file")

failed=0
listed=""
while IFS= read -r dir; do
  [ -f "$dir/tsconfig.json" ] || continue
  name=$(jq -r .name "$dir/package.json")
  if jq -e '.scripts.typecheck' "$dir/package.json" > /dev/null; then
    has_script=1
  else
    has_script=0
  fi
  if grep -Fxq -- "$name" <<< "$exempt"; then
    listed+="$name"$'\n'
    if [ "$has_script" = 1 ]; then
      echo "::error file=${exemptions_file}::${name} has a \"typecheck\" script, so remove it from typecheck-exemptions.txt"
      failed=1
    fi
  elif [ "$has_script" = 0 ]; then
    echo "::error file=${dir#"$PWD"/}/package.json::${name} has a tsconfig.json but no \"typecheck\" script"
    failed=1
  fi
done < <(pnpm ls -r --depth -1 --json | jq -r '.[].path')

while IFS= read -r name; do
  [ -n "$name" ] || continue
  if ! grep -Fxq -- "$name" <<< "$listed"; then
    echo "::error file=${exemptions_file}::${name} isn't a workspace package with a tsconfig.json, so remove it from typecheck-exemptions.txt"
    failed=1
  fi
done <<< "$exempt"

exit "$failed"
