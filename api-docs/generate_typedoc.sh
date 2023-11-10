#!/bin/bash

# copy ../langchain/src into ../langchain/docs_dist/src

mkdir -p ../langchain/docs_dist/
cp -r ../langchain/src ../langchain/docs_dist/src
echo "Copied ../langchain/src into ../langchain/docs_dist/src"

# Check if NODE_ENV is set to production or staging
if [[ "$NODE_ENV" == "production" || "$NODE_ENV" == "staging" ]]; then
    echo "NODE_ENV is set to $NODE_ENV"
    # Run the command if NODE_ENV is production or staging
    yarn add-ignore-comments
fi

# Run this command regardless of the NODE_ENV value
yarn typedoc

# delete ../langchain/docs_dist

echo "Deleting ../langchain/docs_dist"
rm -rf ../langchain/docs_dist
