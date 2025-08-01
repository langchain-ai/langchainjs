# @langchain/deepseek

This package contains the LangChain.js integrations for DeepSeek.

## Installation

```bash npm2yarn
npm install @langchain/deepseek @langchain/core
```

## Chat models

This package adds support for DeepSeek's chat model inference.

Set the necessary environment variable (or pass it in via the constructor):

```bash
export DEEPSEEK_API_KEY=
```

```typescript
import { ChatDeepSeek } from "@langchain/deepseek";
import { HumanMessage } from "@langchain/core/messages";

const model = new ChatDeepSeek({
  apiKey: process.env.DEEPSEEK_API_KEY, // Default value.
  model: "<model_name>",
});

const res = await model.invoke([
  {
    role: "user",
    content: message,
  },
]);
```

## Development

To develop the `@langchain/deepseek` package, you'll need to follow these instructions:

### Install dependencies

```bash
yarn install
```

### Build the package

```bash
yarn build
```

Or from the repo root:

```bash
pnpm build --filter @langchain/deepseek
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

If you add a new file to be exported, either import & re-export from `src/index.ts`, or add it to the `exports` field in the `package.json` file and run `yarn build` to generate the new entrypoint.
