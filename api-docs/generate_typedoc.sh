#!/bin/bash

BASE_DIR="../langchain"

# Create a directory to use for docs.
# `docs_dist` is gitignored by default.
mkdir -p "$BASE_DIR/docs_dist/src"

# Copy the contents of src to docs_dist/src
cp -r "$BASE_DIR/src/." "$BASE_DIR/docs_dist/src/"

# Add `@ignore` to JSDoc comments for properties which should be ignored.
yarn add-ignore-comments

# This command will generate the docs
yarn typedoc

# Remove the current contents of langchain/src
rm -rf "$BASE_DIR/src/*"

# Copy the unedited contents from docs_dist/src to langchain/src
cp -r "$BASE_DIR/docs_dist/src/." "$BASE_DIR/src/"
