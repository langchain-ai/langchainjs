---
sidebar_position: 1
---

# Setup and Installation

:::info
Updating from <0.0.52? See [this section](#updating-from-0052) for instructions.
:::

## Quickstart

If you want to get started quickly on using LangChain in Node.js, [clone this repository](https://github.com/domeccleston/langchain-ts-starter) and follow the README instructions for a boilerplate project with those dependencies set up.

If you prefer to set things up yourself, or you want to run LangChain in other environments, read on for instructions.

## Installation

To get started, install LangChain with the following command:

```bash npm2yarn
npm install -S langchain
```

### TypeScript

LangChain is written in TypeScript and provides type definitions for all of its public APIs.

## Loading the library

### ESM

LangChain provides an ESM build targeting Node.js environments. You can import it using the following syntax:

```typescript
import { OpenAI } from "langchain/llms/openai";
```

If you are using TypeScript in an ESM project we suggest updating your `tsconfig.json` to include the following:

```json
{
  "compilerOptions": {
    ...
    "target": "ES2020", // or higher
    "module": "nodenext",
  }
}
```

### CommonJS

LangChain provides a CommonJS build targeting Node.js environments. You can import it using the following syntax:

```typescript
const { OpenAI } = require("langchain/llms/openai");
```

### Cloudflare Workers

LangChain can be used in Cloudflare Workers. You can import it using the following syntax:

```typescript
import { OpenAI } from "langchain/llms/openai";
```

### Vercel / Next.js

LangChain can be used in Vercel / Next.js. We support using LangChain in frontend components, in Serverless functions and in Edge functions. You can import it using the following syntax:

```typescript
import { OpenAI } from "langchain/llms/openai";
```

If you want to use LangChain in frontend pages, in order to support the tokenizer library `@dqbd/tiktoken`, you need to add the following to your `next.config.js` to enable support for WebAssembly modules:

```js
const nextConfig = {
  webpack(config) {
    config.experiments = {
      asyncWebAssembly: true,
      layers: true,
    };

    return config;
  },
};
```

## Updating from <0.0.52

If you are updating from a version of LangChain prior to 0.0.52, you will need to update your imports to use the new path structure. For example, if you were previously importing `OpenAI` from `langchain/llms`, you will now need to import it from `langchain/llms/openai`. This applies to all imports from

- `langchain/llms`, see [LLMs](../modules/models/llms/integrations)
- `langchain/chat_models`, see [Chat Models](../modules/models/chat/integrations)
- `langchain/embeddings`, see [Embeddings](../modules/models/embeddings/integrations)
- `langchain/vectorstores`, see [Vector Stores](../modules/indexes/vector_stores/integrations/)
- `langchain/document_loaders`, see [Document Loaders](../modules/indexes/document_loaders/examples/)
- `langchain/retrievers`, see [Retrievers](../modules/indexes/retrievers/)

## Unsupported: Node.js 16

We do not support Node.js 16, but if you still want to run LangChain on Node.js 16, you will need to follow the instructions in this section. We do not guarantee that these instructions will continue to work in the future.

You will have to make `fetch` available globally, either:

- run your application with `NODE_OPTIONS='--experimental-fetch' node ...`, or
- install `node-fetch` and follow the instructions [here](https://github.com/node-fetch/node-fetch#providing-global-access)

Additionally you'll have to polyfill `unstructuredClone`, eg. by installing `core-js` and following the instructions [here](https://github.com/zloirock/core-js).

If you are running this on Node.js 18 or 19, you do not need to do anything.
