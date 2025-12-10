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
import { ChatXAI, xaiLiveSearch } from "@langchain/xai";

const model = new ChatXAI({
  model: "grok-2-1212",
});

// Create the built-in live_search tool with optional parameters
const searchTool = xaiLiveSearch({
  max_search_results: 5,
  return_citations: true,
});

// Bind the live_search tool to the model
const modelWithSearch = model.bindTools([searchTool]);

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
    sources: [
      {
        type: "web",
        allowed_websites: ["spacex.com", "nasa.gov"],
      },
    ],
  },
});
```

### Configuring data sources with `sources`

You can configure which data sources Live Search should use via the `sources` field
in `searchParameters`. Each entry corresponds to one of the sources described in the
official xAI Live Search docs (`web`, `news`, `x`, `rss`).

```typescript
const result = await model.invoke(
  "What are the latest updates from xAI and related news?",
  {
    searchParameters: {
      mode: "on",
      sources: [
        {
          type: "web",
          // Only search on these websites
          allowed_websites: ["x.ai"],
        },
        {
          type: "news",
          // Exclude specific news websites
          excluded_websites: ["bbc.co.uk"],
        },
        {
          type: "x",
          // Focus on specific X handles
          included_x_handles: ["xai"],
        },
      ],
    },
  }
);
```

You can also use RSS feeds as a data source:

```typescript
const result = await model.invoke("Summarize the latest posts from this feed", {
  searchParameters: {
    mode: "on",
    sources: [
      {
        type: "rss",
        links: ["https://example.com/feed.rss"],
      },
    ],
  },
});
```

> Notes:
>
> - The previous `allowed_domains` / `excluded_domains` fields are not
>   supported in this provider. Use `sources` with `allowed_websites` and
>   `excluded_websites` instead.
> - In TypeScript, the `XAISearchParameters` and `sources` types use the same
>   `snake_case` field names as the underlying JSON API (for example
>   `allowed_websites`, `excluded_websites`, `included_x_handles`). There are no
>   separate camelCase aliases (`allowedWebsites`, etc.), which keeps the
>   provider aligned with the official xAI documentation.

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
