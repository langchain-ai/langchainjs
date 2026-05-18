# @langchain/fireworks

This package contains the LangChain.js integrations for Fireworks AI.

## Installation

```bash npm2yarn
npm install @langchain/fireworks @langchain/core
```

This package depends on [`@langchain/core`](https://npmjs.com/package/@langchain/core/).
If you use it together with other LangChain packages, make sure they all resolve
to the same `@langchain/core` version.

## Chat models

Use `ChatFireworks` for chat-completions style models exposed by Fireworks'
OpenAI-compatible API.

```bash
export FIREWORKS_API_KEY="your-api-key"
```

```typescript
import { ChatFireworks } from "@langchain/fireworks";

const model = new ChatFireworks({
  model: "accounts/fireworks/models/firefunction-v2",
  temperature: 0,
});

const response = await model.invoke("Tell me a joke about rockets.");
console.log(response.content);
```

## LLMs

Use `Fireworks` for text-completion style models.

```typescript
import { Fireworks } from "@langchain/fireworks";

const model = new Fireworks({
  model: "accounts/fireworks/models/llama-v2-13b",
  temperature: 0,
});

const response = await model.invoke("1 + 1 =");
console.log(response);
```

## Embeddings

Use `FireworksEmbeddings` for embedding models exposed by Fireworks.

```typescript
import { FireworksEmbeddings } from "@langchain/fireworks";

const embeddings = new FireworksEmbeddings({
  model: "nomic-ai/nomic-embed-text-v1.5",
});

const vector = await embeddings.embedQuery("hello world");
console.log(vector);
```

## Development

Install dependencies from the monorepo root:

```bash
pnpm install
```

Build this package:

```bash
pnpm --filter @langchain/fireworks build
```

Run unit tests:

```bash
pnpm --filter @langchain/fireworks test
```

Run integration tests:

```bash
pnpm --filter @langchain/fireworks test:int
```

Run standard tests:

```bash
pnpm --filter @langchain/fireworks test:standard
```
