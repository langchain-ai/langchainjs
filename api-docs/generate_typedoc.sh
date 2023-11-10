#!/bin/bash

# Create a directory to use for docs.
# `docs_dist` is gitignored by default.
mkdir -p ../langchain/docs_dist/
cp -r ../langchain/src ../langchain/docs_dist/src

# Add `@ignore` to JSDoc comments for properties which should be ignored.
yarn add-ignore-comments

# Run this command regardless of the NODE_ENV value
# This command will generate the docs
yarn typedoc

rm -rf ../langchain/docs_dist
