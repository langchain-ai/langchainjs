#!/bin/bash

# Check if an argument is provided
if [ $# -eq 0 ]; then
    echo "Error: Please provide a version string as an argument."
    exit 1
fi

inputString=$1

# Check if VERCEL_TOKEN is set
if [ -z "$VERCEL_TOKEN" ]; then
    echo "Error: VERCEL_TOKEN is not set."
    exit 1
fi

# save stdout and stderr to files
vercel deploy --prebuilt --token="$VERCEL_TOKEN" >deployment-url.txt 2>error.txt

# check the exit code
code=$?
if [ $code -eq 0 ]; then
    # Set the deploymentUrl using the input string
    deploymentUrl="${inputString}.api.js.langchain.com"
    vercel alias $(cat deployment-url.txt) $deploymentUrl --token="$VERCEL_TOKEN" --scope="langchain"
else
    # Handle the error
    errorMessage=$(cat error.txt)
    echo "There was an error: $errorMessage"
fi