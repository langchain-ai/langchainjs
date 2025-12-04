# @langchain/openai

This package contains the LangChain.js integrations for OpenAI through their SDK.

## Installation

```bash npm2yarn
npm install @langchain/openai @langchain/core
```

This package, along with the main LangChain package, depends on [`@langchain/core`](https://npmjs.com/package/@langchain/core/).
If you are using this package with other LangChain packages, you should make sure that all of the packages depend on the same instance of @langchain/core.
You can do so by adding appropriate fields to your project's `package.json` like this:

```json
{
  "name": "your-project",
  "version": "0.0.0",
  "dependencies": {
    "@langchain/core": "^0.3.0",
    "@langchain/openai": "^0.0.0"
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

The field you need depends on the package manager you're using, but we recommend adding a field for the common `pnpm`, `npm`, and `yarn` to maximize compatibility.

## Chat Models

This package contains the `ChatOpenAI` class, which is the recommended way to interface with the OpenAI series of models.

To use, install the requirements, and configure your environment.

```bash
export OPENAI_API_KEY=your-api-key
```

Then initialize

```typescript
import { ChatOpenAI } from "@langchain/openai";

const model = new ChatOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  model: "gpt-4-1106-preview",
});
const response = await model.invoke(new HumanMessage("Hello world!"));
```

### Streaming

```typescript
import { ChatOpenAI } from "@langchain/openai";

const model = new ChatOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  model: "gpt-4-1106-preview",
});
const response = await model.stream(new HumanMessage("Hello world!"));
```

## Tools

This package provides LangChain-compatible wrappers for OpenAI's built-in tools for the Responses API.

### Web Search Tool

The web search tool allows OpenAI models to search the web for up-to-date information before generating a response. Web search supports three main types:

1. **Non-reasoning web search**: Quick lookups where the model passes queries directly to the search tool
2. **Agentic search with reasoning models**: The model actively manages the search process, analyzing results and deciding whether to keep searching
3. **Deep research**: Extended investigations using models like `o3-deep-research` or `gpt-5` with high reasoning effort

```typescript
import { ChatOpenAI, tools } from "@langchain/openai";

const model = new ChatOpenAI({
  model: "gpt-4o",
});

// Basic usage
const response = await model.invoke(
  "What was a positive news story from today?",
  {
    tools: [tools.webSearch()],
  }
);
```

**Domain filtering** - Limit search results to specific domains (up to 100):

```typescript
const response = await model.invoke("Latest AI research news", {
  tools: [
    tools.webSearch({
      filters: {
        allowedDomains: ["arxiv.org", "nature.com", "science.org"],
      },
    }),
  ],
});
```

**User location** - Refine search results based on geography:

```typescript
const response = await model.invoke("What are the best restaurants near me?", {
  tools: [
    tools.webSearch({
      userLocation: {
        type: "approximate",
        country: "US",
        city: "San Francisco",
        region: "California",
        timezone: "America/Los_Angeles",
      },
    }),
  ],
});
```

**Cache-only mode** - Disable live internet access:

```typescript
const response = await model.invoke("Find information about OpenAI", {
  tools: [
    tools.webSearch({
      externalWebAccess: false,
    }),
  ],
});
```

For more information, see [OpenAI's Web Search Documentation](https://platform.openai.com/docs/guides/tools-web-search).

## Embeddings

This package also adds support for OpenAI's embeddings model.

```typescript
import { OpenAIEmbeddings } from "@langchain/openai";

const embeddings = new OpenAIEmbeddings({
  apiKey: process.env.OPENAI_API_KEY,
});
const res = await embeddings.embedQuery("Hello world");
```

## Development

To develop the OpenAI package, you'll need to follow these instructions:

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
pnpm build --filter=@langchain/openai
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
