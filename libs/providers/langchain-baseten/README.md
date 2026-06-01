# @langchain/baseten

This package contains the LangChain.js integration for Baseten.

## Installation

```bash npm2yarn
npm install @langchain/baseten @langchain/core
```

This package depends on [`@langchain/core`](https://npmjs.com/package/@langchain/core/).
If you use it together with other LangChain packages, make sure they all resolve
to the same `@langchain/core` version.

## Chat Models

Use `ChatBaseten` for chat-completions style models exposed by Baseten's
OpenAI-compatible APIs.

```bash
export BASETEN_API_KEY="your-api-key"
```

```typescript
import { ChatBaseten } from "@langchain/baseten";

const model = new ChatBaseten({
  model: "deepseek-ai/DeepSeek-V3.1",
  temperature: 0,
});

const response = await model.invoke("Tell me a short joke.");
console.log(response.content);
```

For dedicated/self-deployed Baseten models, pass `modelUrl`:

```typescript
import { ChatBaseten } from "@langchain/baseten";

const model = new ChatBaseten({
  modelUrl:
    "https://model-abc123.api.baseten.co/environments/production/predict",
});
```

## Development

Install dependencies from the monorepo root:

```bash
pnpm install
```

Build this package:

```bash
pnpm --filter @langchain/baseten build
```

Run unit tests:

```bash
pnpm --filter @langchain/baseten test
```

Run integration tests:

```bash
pnpm --filter @langchain/baseten test:int
```

Run standard tests:

```bash
pnpm --filter @langchain/baseten test:standard
```
