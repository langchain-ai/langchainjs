#!/bin/bash

if [ "$SKIP_API_DOCS" != "true" ]; then
  cd ../docs/api_refs && yarn build:typedoc
fi
