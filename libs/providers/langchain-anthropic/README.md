# @langchain/anthropic

This package contains the LangChain.js integrations for Anthropic through their SDK.

## Installation

```bash npm2yarn
npm install @langchain/anthropic @langchain/core
```

This package, along with the main LangChain package, depends on [`@langchain/core`](https://npmjs.com/package/@langchain/core/).
If you are using this package with other LangChain packages, you should make sure that all of the packages depend on the same instance of @langchain/core.
You can do so by adding appropriate fields to your project's `package.json` like this:

```json
{
  "name": "your-project",
  "version": "0.0.0",
  "dependencies": {
    "@langchain/anthropic": "^0.0.9",
    "@langchain/core": "^0.3.0"
  },
  "resolutions": {
    "@langchain/core": "^0.3.0"
  },
  "overrides": {
    "@langchain/core": "^0.3.0"
  },
  "pnpm": {
    "overrides": {
      "@langchain/core": "^0.3.0"
    }
  }
}
```

The field you need depends on the package manager you're using, but we recommend adding a field for the common `yarn`, `npm`, and `pnpm` to maximize compatibility.

## Chat Models

This package contains the `ChatAnthropic` class, which is the recommended way to interface with the Anthropic series of models.

To use, install the requirements, and configure your environment.

```bash
export ANTHROPIC_API_KEY=your-api-key
```

Then initialize

```typescript
import { ChatAnthropic } from "@langchain/anthropic";

const model = new ChatAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});
const response = await model.invoke({
  role: "user",
  content: "Hello world!",
});
```

### Streaming

```typescript
import { ChatAnthropic } from "@langchain/anthropic";

const model = new ChatAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: "claude-3-sonnet-20240229",
});
const response = await model.stream({
  role: "user",
  content: "Hello world!",
});
```

## Middleware

This package exports middleware that can be used with [`createAgent`](https://docs.langchain.com/oss/javascript/langchain/agents) to extend agent functionality.

### Anthropic Prompt Caching

Reduce API costs by caching repetitive prompt prefixes with Anthropic models. This middleware is perfect for:

- Applications with long, repeated system prompts
- Agents that reuse the same context across invocations
- Reducing API costs for high-volume deployments

> **Note:** Learn more about [Anthropic Prompt Caching](https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching#cache-limitations) strategies and limitations.

#### Usage

```typescript
import { createAgent } from "langchain";
import { promptCachingMiddleware } from "@langchain/anthropic";
import { HumanMessage } from "@langchain/core/messages";

const LONG_PROMPT = `
You are a helpful assistant with extensive knowledge.
<Lots more context that you want to cache...>
`;

const agent = createAgent({
  model: "anthropic:claude-sonnet-4-latest",
  systemPrompt: LONG_PROMPT,
  middleware: [promptCachingMiddleware({ ttl: "5m" })],
});

// First call: cache is created
await agent.invoke({
  messages: [new HumanMessage("Hi, my name is Bob")],
});

// Second call: cache hit, system prompt is reused from cache
const result = await agent.invoke({
  messages: [new HumanMessage("What's my name?")],
});
```

#### Configuration Options

| Parameter                  | Description                                                         | Default  |
| -------------------------- | ------------------------------------------------------------------- | -------- |
| `enableCaching`            | Whether to enable prompt caching                                    | `true`   |
| `ttl`                      | Cache time-to-live (`"5m"` or `"1h"`)                               | `"5m"`   |
| `minMessagesToCache`       | Minimum number of messages before caching starts                    | `3`      |
| `unsupportedModelBehavior` | Behavior for non-Anthropic models (`"ignore"`, `"warn"`, `"raise"`) | `"warn"` |

## Development

To develop the Anthropic package, you'll need to follow these instructions:

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
pnpm build --filter @langchain/anthropic
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

## Publishing

After running `pnpm build`, publish a new version with:

```bash
npm publish
```
