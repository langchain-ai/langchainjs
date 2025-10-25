# LangChain Serpex Integration

Official Serpex search integration for LangChain.js

## Installation

```bash
npm install @langchain/community
```

## Setup

Get your API key from [Serpex](https://serpex.dev) and set it as an environment variable:

```bash
export SERPEX_API_KEY="your-api-key-here"
```

## Usage

### Basic Example

```typescript
import { Serpex } from "@langchain/community/tools/serpex";

const tool = new Serpex(process.env.SERPEX_API_KEY);

const result = await tool.invoke("latest AI developments");
console.log(result);
```

### With Custom Parameters

```typescript
import { Serpex } from "@langchain/community/tools/serpex";

const tool = new Serpex(process.env.SERPEX_API_KEY, {
  engine: "google",        // auto, google, bing, duckduckgo, brave, yahoo, yandex
  category: "web",         // currently only "web" supported
  time_range: "day"        // all, day, week, month, year (not supported by Brave)
});

const result = await tool.invoke("coffee shops near me");
console.log(result);
```

### With LangChain Agent

```typescript
import { Serpex } from "@langchain/community/tools/serpex";
import { ChatOpenAI } from "@langchain/openai";
import { AgentExecutor, createReactAgent } from "langchain/agents";
import { pull } from "langchain/hub";

const searchTool = new Serpex(process.env.SERPEX_API_KEY, {
  engine: "auto",
  time_range: "week"
});

const model = new ChatOpenAI({
  model: "gpt-4",
  temperature: 0,
});

const prompt = await pull("hwchase17/react");

const agent = await createReactAgent({
  llm: model,
  tools: [searchTool],
  prompt,
});

const agentExecutor = new AgentExecutor({
  agent,
  tools: [searchTool],
});

const result = await agentExecutor.invoke({
  input: "What are the latest developments in AI?"
});

console.log(result.output);
```

## API Parameters

### Supported Parameters

- **`engine`** (optional): Search engine to use
  - Options: `"auto"`, `"google"`, `"bing"`, `"duckduckgo"`, `"brave"`, `"yahoo"`, `"yandex"`
  - Default: `"auto"` (automatically routes with retry logic)

- **`category`** (optional): Search category
  - Options: `"web"` (more categories coming soon)
  - Default: `"web"`

- **`time_range`** (optional): Filter results by time
  - Options: `"all"`, `"day"`, `"week"`, `"month"`, `"year"`
  - Note: Not supported by Brave engine

### Response Format

The tool returns formatted search results as a string containing:

1. **Instant Answers**: Direct answers from knowledge panels
2. **Infoboxes**: Knowledge panel descriptions
3. **Organic Results**: Web search results with titles, URLs, and snippets
4. **Suggestions**: Related search queries
5. **Corrections**: Suggested query corrections

Example response:
```
Found 10 results:

[1] Starbucks - Coffee Shop
URL: https://www.starbucks.com/store-locator/store/1234
Premium coffee, perfect lattes, and great atmosphere in the heart of downtown...

[2] Local Coffee Roasters
URL: https://localcoffee.com
Artisanal coffee beans, locally sourced and expertly roasted daily...
```

## Features

- **Multi-Engine Support**: Automatically routes requests across multiple search engines
- **Smart Retry Logic**: Built-in retry mechanism for failed requests
- **Real-Time Results**: Get fresh search results from the web
- **Simple Integration**: Easy to use with LangChain agents and chains
- **Structured Output**: Clean, formatted search results ready for LLM consumption

## Cost

All search engines cost 1 credit per successful request. Credits never expire.

## Rate Limits

- 300 requests per second
- No daily limits

## Documentation

For detailed API documentation, visit: [https://serpex.dev/docs](https://serpex.dev/docs)

## Support

- Email: support@serpex.dev
- Documentation: https://serpex.dev/docs
- Dashboard: https://serpex.dev/dashboard

## License

MIT
