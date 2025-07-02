# `@langchain/tavily`

[![NPM - Version](https://img.shields.io/npm/v/@langchain/tavily?style=flat-square&label=%20)](https://www.npmjs.com/package/@langchain/tavily)

This package provides integrations for the [Tavily](https://tavily.com/) search engine within LangChain.js. Tavily is a search engine built specifically for AI agents (LLMs), delivering real-time, accurate, and factual results at speed.

This package exposes four tools:

- `TavilySearch`: Performs a search optimized for LLMs and RAG.
- `TavilyExtract`: Extracts raw content from a list of URLs.
- `TavilyCrawl`: Initiates a structured web crawl starting from a specified base URL.
- `TavilyMap`: Generates a site map starting from a specified base URL.

## Installation

```bash
npm install @langchain/tavily
```

## Setup

You need a Tavily API key to use these tools. You can get one [here](https://app.tavily.com). Set it as an environment variable:

```typescript
process.env.TAVILY_API_KEY = "YOUR_API_KEY";
```

## Usage

### TavilySearch

```typescript
import { TavilySearch } from "@langchain/tavily";

const tool = new TavilySearch({
  maxResults: 5,
  // You can set other constructor parameters here, e.g.:
  // topic: "general",
  // includeAnswer: false,
  // includeRawContent: false,
  // includeImages: false,
  // searchDepth: "basic",
});

// Invoke with a query
const results = await tool.invoke({
  query: "what is the current weather in SF?",
});

console.log(results);
```

### TavilyExtract

```typescript
import { TavilyExtract } from "@langchain/tavily";

const tool = new TavilyExtract({
  // Constructor parameters:
  // extractDepth: "basic",
  // includeImages: false,
});

// Invoke with a list of URLs
const results = await tool.invoke({
  urls: ["https://en.wikipedia.org/wiki/Lionel_Messi"],
});

console.log(results);
```

### TavilyCrawl

```typescript
import { TavilyCrawl } from "@langchain/tavily";

const tool = new TavilyCrawl({
  // Constructor parameters:
  // extractDepth: "basic",
  // format: "markdown",
  // maxDepth: 3,
  // maxBreadth: 50,
  // limit: 100,
  // includeImages: false,
  // allowExternal: false,
});

// Invoke with a URL and optional parameters
const results = await tool.invoke({
  url: "https://docs.tavily.com/",
  instructions: "Find information about the LangChain integration.",
});

console.log(results);
```

### TavilyMap

```typescript
import { TavilyMap } from "@langchain/tavily";

const tool = new TavilyMap({
  // Constructor parameters:
  // maxDepth: 3,
  // maxBreadth: 50,
  // limit: 100,
  // allowExternal: false,
});

// Invoke with a URL and optional parameters
const results = await tool.invoke({
  url: "https://docs.tavily.com/",
});

console.log(results);
```

## Documentation

For more detailed information, check out the documentation pages:

- **TavilySearch**: [http://js.langchain.com/docs/integrations/tools/tavily_search/](http://js.langchain.com/docs/integrations/tools/tavily_search/)
- **TavilyExtract**: [http://js.langchain.com/docs/integrations/tools/tavily_extract/](http://js.langchain.com/docs/integrations/tools/tavily_extract/)
- **TavilyCrawl**: [http://js.langchain.com/docs/integrations/tools/tavily_crawl/](http://js.langchain.com/docs/integrations/tools/tavily_crawl/)
- **TavilyMap**: [http://js.langchain.com/docs/integrations/tools/tavily_map/](http://js.langchain.com/docs/integrations/tools/tavily_map/)

## License

This package is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
