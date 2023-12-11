# Contributing third-party memory

This page contains some specific guidelines and examples for contributing integrations with third-party memory providers.

In LangChain, memory differs from [message stores](https://github.com/langchain-ai/langchainjs/blob/main/.github/contributing/integrations/MESSAGE_STORES.md) in that memory does not actually handle persistently storing messages, but acts as a representation of the LLM or chat model's awareness of past conversations, while message stores handle the actual message data persistence. For example, memory may perform other transformations on the messages, like summarization, or may emphasize specific pieces of pertinent information. Memory may rely on message stores as a backing class.

Another key difference is that message stores are only used with chat models.

Before getting started, think about whether your planned integration would be more suited as a message store or as memory!

**Make sure you read the [general guidelines page](https://github.com/langchain-ai/langchainjs/blob/main/.github/contributing/INTEGRATIONS.md) first!**

## Example PR

You can use this PR adding Motorhead memory as a reference: https://github.com/langchain-ai/langchainjs/pull/598

## General ideas

LangChain memory at its core contains two important methods:

- `loadMemoryVariables`, which loads memory from a message store or other source and formats it.
- `saveContext`, which stores a representation of the current input and output values in the message store.

As previously mentioned, saving context does not need to involve storing a verbatim transcript of the back-and-forth with the LLM (though you can certainly do that!). It can also involve summarizing or emphasizing different parts of memory, like certain words, mentioned people, or key phrases to prompt the LLM to "remember" details in a different way.
