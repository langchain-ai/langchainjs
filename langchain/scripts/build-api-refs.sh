#!/bin/bash

if [ "$SKIP_API_DOCS" != "true" ]; then
  cd ../api-docs && yarn gen:typedoc
fi
