# @langchain/infomaniak

This package contains the LangChain.js integrations for [Infomaniak AI](https://developer.infomaniak.com/) through their OpenAI-compatible API.

## Installation

```bash
npm install @langchain/infomaniak @langchain/core
```

## Configuration

You need an Infomaniak API token and a product ID. Set the following environment variables:

```bash
export INFOMANIAK_API_KEY="your-api-token"
export INFOMANIAK_PRODUCT_ID="your-product-id"
```

## Chat Models

```typescript
import { ChatInfomaniak } from "@langchain/infomaniak";

const model = new ChatInfomaniak({
  model: "qwen3",
  temperature: 0.7,
});

const response = await model.invoke("Hello, how are you?");
console.log(response.content);
```

## Embeddings

```typescript
import { InfomaniakEmbeddings } from "@langchain/infomaniak";

const embeddings = new InfomaniakEmbeddings({
  model: "bge_multilingual_gemma2",
});

const vector = await embeddings.embedQuery("Hello world");
console.log(vector.length);
```

## LLM (Text Completion)

```typescript
import { InfomaniakLLM } from "@langchain/infomaniak";

const llm = new InfomaniakLLM({
  model: "qwen3",
});

const result = await llm.invoke("Tell me a joke");
console.log(result);
```

## Streaming

```typescript
import { ChatInfomaniak } from "@langchain/infomaniak";

const model = new ChatInfomaniak({ model: "qwen3" });

for await (const chunk of await model.stream("Tell me a story")) {
  process.stdout.write(chunk.content as string);
}
```

## Tool Calling

```typescript
import { ChatInfomaniak } from "@langchain/infomaniak";

const model = new ChatInfomaniak({ model: "qwen3" });

const llmWithTools = model.bindTools([
  {
    name: "get_weather",
    description: "Get the current weather in a given location",
    schema: {
      type: "object",
      properties: {
        location: { type: "string", description: "The city name" },
      },
      required: ["location"],
    },
  },
]);

const result = await llmWithTools.invoke("What is the weather in Geneva?");
console.log(result.tool_calls);
```

## Development

### Setup

```bash
# From the monorepo root
pnpm install

# Build dependencies first
pnpm --filter @langchain/core build
pnpm --filter @langchain/openai build

# Build this package
pnpm --filter @langchain/infomaniak build
```

### Testing

```bash
# Unit tests (no API key needed)
pnpm --filter @langchain/infomaniak test

# Integration tests (requires API credentials)
export INFOMANIAK_API_KEY="your-api-token"
export INFOMANIAK_PRODUCT_ID="your-product-id"
pnpm --filter @langchain/infomaniak test:int

# Standard integration tests
pnpm --filter @langchain/infomaniak test:standard:int
```

You can also use `bun` instead of `pnpm`:

```bash
cd libs/providers/langchain-infomaniak
bun run test          # unit tests
bun run test:int      # integration tests
```

### Linting

```bash
pnpm --filter @langchain/infomaniak lint
```

## API Reference

- **Base URL**: `https://api.infomaniak.com/2/ai/{product_id}/openai/v1`
- **Authentication**: Bearer token via `Authorization` header
- **Docs**: https://developer.infomaniak.com/getting-started
