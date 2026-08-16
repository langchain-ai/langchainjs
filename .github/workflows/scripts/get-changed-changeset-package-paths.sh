#!/usr/bin/env bash
set -euo pipefail

BASE_SHA="${1:-}"
HEAD_SHA="${2:-}"

if [ -z "$BASE_SHA" ] || [ -z "$HEAD_SHA" ]; then
  echo "Usage: .github/workflows/scripts/get-changed-changeset-package-paths.sh <baseSha> <headSha>" >&2
  exit 1
fi

set_github_output() {
  local key="$1"
  local value="$2"
  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    echo "$key=$value" >> "$GITHUB_OUTPUT"
  else
    echo "$key=$value"
  fi
}

echo "Comparing changed changesets between $BASE_SHA and $HEAD_SHA"
changed_changesets="$(git diff --name-only "$BASE_SHA" "$HEAD_SHA" -- '.changeset/*.md' ':!.changeset/README.md')"

if [ -z "$changed_changesets" ]; then
  echo "No changed changeset files found."
  set_github_output "paths" ""
  exit 0
fi

paths="$(
  CHANGESET_FILES="$changed_changesets" node <<'NODE'
  const fs = require("fs");
  const path = require("path");

  const files = (process.env.CHANGESET_FILES ?? "")
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);

  const packageNameToPath = new Map();
  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const full = path.join(dir, entry.name);
      const pkgJsonPath = path.join(full, "package.json");
      if (fs.existsSync(pkgJsonPath)) {
        const pkgJson = JSON.parse(fs.readFileSync(pkgJsonPath, "utf8"));
        if (pkgJson.name && !pkgJson.private) {
          packageNameToPath.set(pkgJson.name, `./${full}`);
        }
        continue;
      }
      walk(full);
    }
  }

  walk("libs");

  const packageNames = new Set();
  for (const file of files) {
    const content = fs.readFileSync(file, "utf8");
    const match = content.match(/^---\n([\s\S]*?)\n---/);
    if (!match) continue;
    for (const line of match[1].split("\n")) {
      const key = line.match(/^\s*["']?([^"':]+)["']?\s*:/);
      if (key) packageNames.add(key[1].trim());
    }
  }

  const paths = [...packageNames]
    .map((name) => packageNameToPath.get(name))
    .filter(Boolean)
    .sort();

  process.stdout.write(paths.join(" "));
NODE
)"

if [ -z "$paths" ]; then
  echo "No publishable package paths were found in changed changesets."
  set_github_output "paths" ""
  exit 0
fi

echo "Publishing package paths from changed changesets: $paths"
set_github_output "paths" "$paths"
