# @langchain/ollama

This package contains the LangChain.js integrations for Ollama via the `ollama` TypeScript SDK.

## Installation

```bash npm2yarn
npm install @langchain/ollama @langchain/core
```

## Setup

To use this package, you need to have Ollama running locally:

1. Download and install Ollama from [ollama.com](https://ollama.com/)
2. Pull a model: `ollama pull llama3`
3. Ensure the Ollama server is running (it starts automatically after installation)

By default, the package connects to `http://localhost:11434`. You can customize this by setting the `baseUrl` option when instantiating the model.

## Chat Models

```typescript
import { ChatOllama } from "@langchain/ollama";

const model = new ChatOllama({
  model: "llama3", // Default value.
});

const result = await model.invoke(["human", "Hello, how are you?"]);
```

### Image inputs

With a vision model such as `llava`, `ChatOllama` accepts standard `image` content blocks containing a base64 string, a `Uint8Array`, or a base64 data URL. HTTP URLs and file IDs are not supported; supply the image data instead. Existing `image_url` blocks containing data URLs remain supported.

```typescript
import { HumanMessage } from "@langchain/core/messages";
import { ChatOllama } from "@langchain/ollama";

const model = new ChatOllama({ model: "llava" });
const result = await model.invoke([
  new HumanMessage({
    contentBlocks: [
      { type: "text", text: "What is in this image?" },
      { type: "image", data: imageBase64, mimeType: "image/png" },
    ],
  }),
]);
```

Here, `imageBase64` is the base64-encoded image without a data URL prefix. The same input works with `stream()` and `streamEvents()`.

## Development

To develop the `@langchain/ollama` package, you'll need to follow these instructions:

### Install dependencies

```bash
pnpm install
```

### Build the package

```bash
pnpm build
```

Or from the repo root:

```bash
pnpm build --filter @langchain/ollama
```

### Run tests

Test files should live within a `tests/` file in the `src/` folder. Unit tests should end in `.test.ts` and integration tests should
end in `.int.test.ts`:

```bash
$ pnpm test
$ pnpm test:int
```

### Lint & Format

Run the linter & formatter to ensure your code is up to standard:

```bash
pnpm lint && pnpm format
```

### Adding new entrypoints

If you add a new file to be exported, either import & re-export from `src/index.ts`, or add it to the `exports` field in the `package.json` file and run `pnpm build` to generate the new entrypoint.
