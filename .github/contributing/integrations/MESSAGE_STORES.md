# Contributing third-party persistent message stores

This page contains some specific guidelines and examples for contributing integrations with third-party message stores.

In LangChain, message stores differ from [memory](https://github.com/langchain-ai/langchainjs/blob/main/.github/contributing/integrations/MEMORY.md) in that they simply serialize and persistently store chat messages, while memory, despite its name, does not actually handle persistently storing messages, but acts as a representation of the LLM or chat model's awareness of past conversations. For example, memory may perform other transformations on the messages, like summarization, or may emphasize specific pieces of pertinent information. Memory may rely on message stores as a backing class.

Another key difference is that message stores are only used with chat models.

Before getting started, think about whether your planned integration would be more suited as a message store or as memory!

**Make sure you read the [general guidelines page](https://github.com/langchain-ai/langchainjs/blob/main/.github/contributing/INTEGRATIONS.md) first!**

## Example PR

We'll be referencing this PR adding a Redis-backed message store as an example: https://github.com/langchain-ai/langchainjs/pull/951

## Serializing and deserializing chat messages

LangChain messages implement a `BaseMessage` class that contains information like the message's content and role of the speaker. In order to provide a standard way to map these messages to a storable JSON format, you should use the utility `mapChatMessagesToStoredMessages` and `mapStoredMessagesToChatMessages` functions as [shown here](https://github.com/langchain-ai/langchainjs/pull/951/files#diff-4c638d231a5e5bb29a149c6fb7d8f4b24aaf1b6fcc2cc2a728346eaebb6c9c47R17).
