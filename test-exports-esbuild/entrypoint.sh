#!/usr/bin/env bash

set -euxo pipefail

DIR=$1

for file in $DIR/*; do
  if [[ $file == 'dist-esm/require.js' ]]; then
    continue;
  fi
  node $file;
done
