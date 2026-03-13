# @langchain/openrouter

This package contains the LangChain.js integrations for [OpenRouter](https://openrouter.ai/).

## Installation

```bash npm2yarn
npm install @langchain/openrouter @langchain/core
```

This package, along with the main LangChain package, depends on [`@langchain/core`](https://npmjs.com/package/@langchain/core/).
If you are using this package with other LangChain packages, you should make sure that all of the packages depend on the same instance of @langchain/core.
You can do so by adding appropriate fields to your project's `package.json` like this:

```json
{
  "name": "your-project",
  "version": "0.0.0",
  "dependencies": {
    "@langchain/openrouter": "^0.0.1",
    "@langchain/core": "^1.0.0"
  },
  "resolutions": {
    "@langchain/core": "^1.0.0"
  },
  "overrides": {
    "@langchain/core": "^1.0.0"
  },
  "pnpm": {
    "overrides": {
      "@langchain/core": "^1.0.0"
    }
  }
}
```

The field you need depends on the package manager you're using, but we recommend adding a field for the common `pnpm`, `npm`, and `yarn` to maximize compatibility.

## Chat Models

This package contains the `ChatOpenRouter` class, which is the recommended way to interface with any model available on OpenRouter. Pass any OpenRouter model identifier (e.g. `"anthropic/claude-4-sonnet"`, `"openai/gpt-4o"`) as the `model` param.

Set the necessary environment variable (or pass it in via the constructor):

```bash
export OPENROUTER_API_KEY=your-api-key
```

Then initialize

```typescript
import { ChatOpenRouter } from "@langchain/openrouter";

const model = new ChatOpenRouter({
  model: "openai/gpt-4o",
});
const response = await model.invoke([{ role: "user", content: "Hello world!" }]);
```

### Streaming

```typescript
import { ChatOpenRouter } from "@langchain/openrouter";

const model = new ChatOpenRouter({
  model: "openai/gpt-4o",
});
const stream = await model.stream([{ role: "user", content: "Hello world!" }]);
for await (const chunk of stream) {
  console.log(chunk.content);
}
```

### Tool Calling

```typescript
import { ChatOpenRouter } from "@langchain/openrouter";
import { tool } from "@langchain/core/tools";
import { z } from "zod";

const adder = tool(async ({ a, b }) => `${a + b}`, {
  name: "add",
  description: "Add two numbers",
  schema: z.object({ a: z.number(), b: z.number() }),
});

const model = new ChatOpenRouter({
  model: "openai/gpt-4o",
}).bindTools([adder]);

const response = await model.invoke("What is 2 + 3?");
```

### Structured Output

```typescript
import { ChatOpenRouter } from "@langchain/openrouter";
import { z } from "zod";

const model = new ChatOpenRouter({
  model: "openai/gpt-4o",
});

const structured = model.withStructuredOutput(
  z.object({
    answer: z.string(),
    confidence: z.number(),
  })
);

const response = await structured.invoke("What is the capital of France?");
```

### OpenRouter-Specific Features

OpenRouter supports model routing, provider preferences, and plugins:

```typescript
import { ChatOpenRouter } from "@langchain/openrouter";

const model = new ChatOpenRouter({
  model: "openai/gpt-4o",
  models: ["openai/gpt-4o", "anthropic/claude-4-sonnet"],
  route: "fallback",
  provider: {
    allow_fallbacks: true,
  },
  transforms: ["middle-out"],
});
```

## Development

To develop the `@langchain/openrouter` package, you'll need to follow these instructions:

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
pnpm build --filter @langchain/openrouter
```

### Run tests

Test files should live within a `tests/` file in the `src/` folder. Unit tests should end in `.test.ts` and integration tests should
end in `.int.test.ts`:

```bash
pnpm test
pnpm test:int
```

### Lint & Format

Run the linter & formatter to ensure your code is up to standard:

```bash
pnpm lint && pnpm format
```

### Adding new entrypoints

If you add a new file to be exported, either import & re-export from `src/index.ts`, or add it to the `exports` field in the `package.json` file and run `pnpm build` to generate the new entrypoint.
