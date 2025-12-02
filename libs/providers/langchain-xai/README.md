# @langchain/xai

This package contains the LangChain.js integrations for xAI.

## Installation

```bash npm2yarn
npm install @langchain/xai @langchain/core
```

## Chat models

This package adds support for xAI chat model inference.

Set the necessary environment variable (or pass it in via the constructor):

```bash
export XAI_API_KEY=
```

```typescript
import { ChatXAI } from "@langchain/xai";
import { HumanMessage } from "@langchain/core/messages";

const model = new ChatXAI({
  apiKey: process.env.XAI_API_KEY, // Default value.
});

const message = new HumanMessage("What color is the sky?");

const res = await model.invoke([message]);
```

## Server Tool Calling (Live Search)

xAI supports server-side tools that are executed by the API rather than requiring client-side execution. The `live_search` tool enables the model to search the web for real-time information.

### Using the built-in live_search tool

```typescript
import { ChatXAI } from "@langchain/xai";

const model = new ChatXAI({
  model: "grok-2-1212",
});

// Bind the live_search tool
const modelWithSearch = model.bindTools([{ type: "live_search" }]);

// The model will search the web for real-time information
const result = await modelWithSearch.invoke(
  "What happened in tech news today?"
);
console.log(result.content);
```

### Using searchParameters for more control

```typescript
import { ChatXAI } from "@langchain/xai";

const model = new ChatXAI({
  model: "grok-2-1212",
  searchParameters: {
    mode: "auto", // "auto" | "on" | "off"
    max_search_results: 5,
    from_date: "2024-01-01", // ISO date string
    return_citations: true,
  },
});

const result = await model.invoke("What are the latest AI developments?");
```

### Override search parameters per request

```typescript
const result = await model.invoke("Find recent news about SpaceX", {
  searchParameters: {
    mode: "on",
    max_search_results: 10,
    allowed_domains: ["spacex.com", "nasa.gov"],
  },
});
```

### Combining live_search with custom tools

```typescript
import { ChatXAI } from "@langchain/xai";

const model = new ChatXAI({ model: "grok-2-1212" });

const modelWithTools = model.bindTools([
  { type: "live_search" }, // Built-in server tool
  {
    // Custom function tool
    type: "function",
    function: {
      name: "get_stock_price",
      description: "Get the current stock price",
      parameters: {
        type: "object",
        properties: {
          symbol: { type: "string" },
        },
        required: ["symbol"],
      },
    },
  },
]);
```

## Development

To develop the `@langchain/xai` package, you'll need to follow these instructions:

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
pnpm build --filter @langchain/xai
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
