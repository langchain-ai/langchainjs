---
sidebar_label: Additional Functionality
---

import CodeBlock from "@theme/CodeBlock";
import Example from "@examples/models/llm/llm.ts";
import DebuggingExample from "@examples/models/llm/llm_debugging.ts";
import StreamingExample from "@examples/models/llm/llm_streaming.ts";
import TimeoutExample from "@examples/models/llm/llm_timeout.ts";
import CancellationExample from "@examples/models/llm/llm_cancellation.ts";

# Additional Functionality: LLMs

We offer a number of additional features for LLMs. In most of the examples below, we'll be using the `OpenAI` LLM. However, all of these features are available for all LLMs.

## Additional Methods

LangChain provides a number of additional methods for interacting with LLMs:

<CodeBlock language="typescript">{Example}</CodeBlock>

## Streaming Responses

Some LLMs provide a streaming response. This means that instead of waiting for the entire response to be returned, you can start processing it as soon as it's available. This is useful if you want to display the response to the user as it's being generated, or if you want to process the response as it's being generated.
LangChain currently provides streaming for the `OpenAI` LLM:

<CodeBlock language="typescript">{StreamingExample}</CodeBlock>

## Caching

LangChain provides an optional caching layer for LLMs. This is useful for two reasons:

1. It can save you money by reducing the number of API calls you make to the LLM provider, if you're often requesting the same completion multiple times.
2. It can speed up your application by reducing the number of API calls you make to the LLM provider.

### Caching in-memory

The default cache is stored in-memory. This means that if you restart your application, the cache will be cleared.

To enable it you can pass `cache: true` when you instantiate the LLM. For example:

```typescript
import { OpenAI } from "langchain/llms/openai";

const model = new OpenAI({ cache: true });
```

### Caching with Redis

LangChain also provides a Redis-based cache. This is useful if you want to share the cache across multiple processes or servers. To use it, you'll need to install the `redis` package:

```bash npm2yarn
npm install redis
```

Then, you can pass a `cache` option when you instantiate the LLM. For example:

```typescript
import { OpenAI } from "langchain/llms/openai";
import { RedisCache } from "langchain/cache/redis";
import { createClient } from "redis";

// See https://github.com/redis/node-redis for connection options
const client = createClient();
const cache = new RedisCache(client);

const model = new OpenAI({ cache });
```

## Adding a timeout

By default, LangChain will wait indefinitely for a response from the model provider. If you want to add a timeout, you can pass a `timeout` option, in milliseconds, when you call the model. For example, for OpenAI:

<CodeBlock language="typescript">{TimeoutExample}</CodeBlock>

## Cancelling requests

You can cancel a request by passing a `signal` option when you call the model. For example, for OpenAI:

<CodeBlock language="typescript">{CancellationExample}</CodeBlock>

Note, this will only cancel the outgoing request if the underlying provider exposes that option. LangChain will cancel the underlying request if possible, otherwise it will cancel the processing of the response.

## Dealing with Rate Limits

Some LLM providers have rate limits. If you exceed the rate limit, you'll get an error. To help you deal with this, LangChain provides a `maxConcurrency` option when instantiating an LLM. This option allows you to specify the maximum number of concurrent requests you want to make to the LLM provider. If you exceed this number, LangChain will automatically queue up your requests to be sent as previous requests complete.

For example, if you set `maxConcurrency: 5`, then LangChain will only send 5 requests to the LLM provider at a time. If you send 10 requests, the first 5 will be sent immediately, and the next 5 will be queued up. Once one of the first 5 requests completes, the next request in the queue will be sent.

To use this feature, simply pass `maxConcurrency: <number>` when you instantiate the LLM. For example:

```typescript
import { OpenAI } from "langchain/llms/openai";

const model = new OpenAI({ maxConcurrency: 5 });
```

## Dealing with API Errors

If the model provider returns an error from their API, by default LangChain will retry up to 6 times on an exponential backoff. This enables error recovery without any additional effort from you. If you want to change this behavior, you can pass a `maxRetries` option when you instantiate the model. For example:

```typescript
import { OpenAI } from "langchain/llms/openai";

const model = new OpenAI({ maxRetries: 10 });
```

## Subscribing to events

Especially when using an agent, there can be a lot of back-and-forth going on behind the scenes as a LLM processes a prompt. For agents, the response object contains an intermediateSteps object that you can print to see an overview of the steps it took to get there. If that's not enough and you want to see every exchange with the LLM, you can pass callbacks to the LLM for custom logging (or anything else you want to do) as the model goes through the steps:

For more info on the events available see the [Callbacks](/docs/production/callbacks/) section of the docs.

<CodeBlock language="typescript">{DebuggingExample}</CodeBlock>
