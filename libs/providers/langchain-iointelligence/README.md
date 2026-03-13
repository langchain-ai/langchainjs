# @langchain/iointelligence

This package contains the LangChain.js integrations for IO Intelligence.

## Installation

```bash npm2yarn
npm install @langchain/iointelligence @langchain/core
```

## Chat models

This package adds support for IO Intelligence chat model inference via their OpenAI-compatible API.

Set the necessary environment variable (or pass it in via the constructor):

```bash
export IO_INTELLIGENCE_API_KEY=
```

```typescript
import { ChatIOIntelligence } from "@langchain/iointelligence";

const model = new ChatIOIntelligence({
  apiKey: process.env.IO_INTELLIGENCE_API_KEY, // Default value.
  model: "meta-llama/Llama-3.3-70B-Instruct",
});

const res = await model.invoke([
  {
    role: "user",
    content: "What is the capital of France?",
  },
]);
```

## Development

To develop the `@langchain/iointelligence` package, you'll need to follow these instructions:

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
pnpm build --filter @langchain/iointelligence
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
