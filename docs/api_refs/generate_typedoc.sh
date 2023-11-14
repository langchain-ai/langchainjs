#!/bin/bash

BASE_DIR="../../langchain"

# Create a directory to temp hold the files in src
# `api_refs_docs_build` is gitignored by default.
mkdir -p "$BASE_DIR/api_refs_docs_build/dist"

# Copy the contents of src to docs/dist
cp -r "$BASE_DIR/src/." "$BASE_DIR/api_refs_docs_build/dist/"

# This command will add `@ignore` to JSDoc comments
# for properties which should be ignored.
yarn add-ignore-comments

# This command will generate the docs
yarn typedoc

# Remove the current contents of langchain/src
rm -rf "$BASE_DIR/api_refs_docs_build/*"

# Copy the unedited contents from docs/dist to langchain/src
cp -r "$BASE_DIR/api_refs_docs_build/dist/." "$BASE_DIR/src/"
