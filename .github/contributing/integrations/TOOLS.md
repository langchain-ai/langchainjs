# Contributing third-party tools

This page contains some specific guidelines and examples for contributing integrations with third-party APIs within tools.

**Make sure you read the [general guidelines page](https://github.com/langchain-ai/langchainjs/blob/main/.github/contributing/INTEGRATIONS.md) first!**

## Example PR

You can use this PR adding an AWSLambda tool as a reference when creating your own tools (minus the dynamic import!): https://github.com/langchain-ai/langchainjs/pull/727

## Guidelines

Because tools are relatively simple (only requiring a well-thought out description and a single function), and `DynamicTools` and `StructuredDynamicTools` offer developers a high degree of flexibility for specific tasks, submitted tools should be useful to a broad group of developers and have solid use-cases.
