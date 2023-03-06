---
sidebar_position: 1
---

# LLM Overview

Large Language Models (LLMs) are a core component of LangChain. LangChain is not a provider of LLMs, but rather provides a standard interface through which you can interact with a variety of LLMs.

See the documentation for each LLM on the left sidebar for more information on how to use them.

## Caching

LangChain provides an optional caching layer for LLMs. This is useful for two reasons:

1. It can save you money by reducing the number of API calls you make to the LLM provider, if you're often requesting the same completion multiple times.
2. It can speed up your application by reducing the number of API calls you make to the LLM provider.

Currently, the cache is stored in-memory. This means that if you restart your application, the cache will be cleared. We're working on adding support for persistent caching.

To enable it you can pass `cache: true` when you instantiate the LLM. For example:

```typescript
import { OpenAI } from "langchain/llms";

const model = new OpenAI({ cache: true });
```

## Dealing with rate limits

Some LLM providers have rate limits. If you exceed the rate limit, you'll get an error. To help you deal with this, LangChain provides a `concurrency` option when instantiating an LLM. This option allows you to specify the maximum number of concurrent requests you want to make to the LLM provider. If you exceed this number, LangChain will automatically queue up your requests to be sent as previous requests complete.

For example, if you set `concurrency: 5`, then LangChain will only send 5 requests to the LLM provider at a time. If you send 10 requests, the first 5 will be sent immediately, and the next 5 will be queued up. Once one of the first 5 requests completes, the next request in the queue will be sent.

To use this feature, simply pass `concurrency: <number>` when you instantiate the LLM. For example:

```typescript
import { OpenAI } from "langchain/llms";

const model = new OpenAI({ concurrency: 5 });
```

## Logging for Debugging

Especially when using an agent, there can be a lot of back-and-forth going on behind the scenes as a LLM processes a chain. For agents, the response object contains an intermediateSteps object that you can print to see an overview of the steps it took to get there. If that's not enough and you want to see every exchange with the LLM, you can use the LLMCallbackManager to write yourself custom logging (or anything else you want to do) as the model goes through the steps:

```typescript
import { LLMCallbackManager } from "langchain/llms";

//create our callback manager

const callbackManager = {
  handleStart: (..._args) => {
    console.log(JSON.stringify(_args, null, 2));
  },
  handleEnd: (..._args) => {
    console.log(JSON.stringify(_args, null, 2));
  },
  handleError: (..._args) => {
    console.log(JSON.stringify(_args, null, 2));
  },
} as LLMCallbackManager;

//create our model and pass it the callback manager

const model = new OpenAIChat({
  openAIApiKey: process.env.OPENAI_API_KEY,
  modelName: "gpt-3.5-turbo",
  prefixMessages: history,
  temperature: 1,
  verbose: true,
  callbackManager: callbackManager,
});
```
