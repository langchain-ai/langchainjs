# Contributing third-party LLMs

This page contains some specific guidelines and examples for contributing integrations with third-party LLM providers.

**Make sure you read the [general guidelines page](https://github.com/langchain-ai/langchainjs/blob/main/.github/contributing/INTEGRATIONS.md) first!**


## Example PR

We'll be referencing this PR adding Amazon SageMaker endpoints as an example: https://github.com/langchain-ai/langchainjs/pull/1267

## General ideas

The general idea for adding new third-party LLMs is to subclass the `LLM` class and implement the `_call` method. As the name suggests, this method should call the LLM with the given prompt and transform the LLM response into some generated string output.

The example PR for Amazon SageMaker is an interesting example of this because SageMaker endpoints can host a wide variety of models with non-standard input and output formats. Therefore, the contributor added a [simple abstract class](https://github.com/langchain-ai/langchainjs/pull/1267/files#diff-4496012d30c03b969546b14039f8deee1b5ba9152a86222100d76c4da77f060cR35) that a user can implement depending on which specific model they are hosting that transforms input from LangChain into a format expected by the model and output into a plain string.

Other third-party providers like OpenAI and Anthropic will have a defined input and output format, and in those cases, the input and output transformations should happen within the `_call` method.

## Wrap LLM requests in this.caller

The base LLM class contains an instance property called `caller` that will automatically handle retries, errors, timeouts, and more. You should wrap calls to the LLM in `this.caller.call` [as shown here](https://github.com/langchain-ai/langchainjs/pull/1267/files#diff-4496012d30c03b969546b14039f8deee1b5ba9152a86222100d76c4da77f060cR148)
