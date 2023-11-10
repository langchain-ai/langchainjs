#!/bin/bash

BASE_DIR="../langchain"

# Create a directory to use for docs.
# `docs_dist` is gitignored by default.
mkdir -p "$BASE_DIR/docs_dist/src"

# Copy the contents of src to docs_dist/src
cp -r "$BASE_DIR/src/." "$BASE_DIR/docs_dist/src/"

# Add `@ignore` to JSDoc comments for properties which should be ignored.
yarn add-ignore-comments

# Run this command regardless of the NODE_ENV value
# This command will generate the docs
yarn typedoc

rsync -av --delete "$BASE_DIR/docs_dist/src/" "$BASE_DIR/"
