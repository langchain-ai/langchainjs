# @langchain/perplexity

This package provides a [LangChain.js](https://github.com/langchain-ai/langchainjs) integration for [Perplexity AI](https://www.perplexity.ai/) chat models.

## Installation

```bash
npm install @langchain/perplexity @langchain/core
```

## Setup

You need a Perplexity API key. Set the `PERPLEXITY_API_KEY` environment variable or pass it directly to the constructor.

```bash
export PERPLEXITY_API_KEY="your-api-key"
```

## Usage

### Basic Chat

```typescript
import { ChatPerplexity } from "@langchain/perplexity";

const model = new ChatPerplexity({
  model: "sonar",
});

const response = await model.invoke([
  ["human", "What is the capital of France?"],
]);

console.log(response.content);
// Citations are available in additional_kwargs
console.log(response.additional_kwargs.citations);
```

### Streaming

```typescript
import { ChatPerplexity } from "@langchain/perplexity";

const model = new ChatPerplexity({
  model: "sonar",
  streaming: true,
});

const stream = await model.stream([["human", "Explain quantum computing"]]);

for await (const chunk of stream) {
  process.stdout.write(chunk.content as string);
}
```

### Structured Output

Perplexity supports structured output via JSON Schema:

```typescript
import { ChatPerplexity } from "@langchain/perplexity";
import { z } from "zod";

const model = new ChatPerplexity({
  model: "sonar",
});

const structured = model.withStructuredOutput(
  z.object({
    capital: z.string(),
    country: z.string(),
    population: z.number().optional(),
  }),
);

const result = await structured.invoke("What is the capital of India?");

console.log(result);
// { capital: "New Delhi", country: "India", population: ... }
```

### Reasoning Models

Perplexity offers reasoning models (e.g. `sonar-reasoning`) that provide step-by-step thinking. The package includes specialised output parsers that automatically strip `<think>` tags from reasoning model responses:

```typescript
import { ChatPerplexity } from "@langchain/perplexity";

const model = new ChatPerplexity({
  model: "sonar-reasoning",
});

const result = await model.invoke([
  ["human", "What are the most popular LLM frameworks?"],
]);

console.log(result.content);
```

### Search Configuration

Perplexity models can search the web. You can configure search behaviour:

```typescript
import { ChatPerplexity } from "@langchain/perplexity";

const model = new ChatPerplexity({
  model: "sonar-pro",
  searchDomainFilter: ["wikipedia.org", "arxiv.org"],
  searchRecencyFilter: "week",
  searchMode: "academic",
  webSearchOptions: {
    search_context_size: "high",
    user_location: {
      latitude: 37.7749,
      longitude: -122.4194,
      country: "US",
    },
  },
});
```

You can also disable web search entirely:

```typescript
const model = new ChatPerplexity({
  model: "sonar",
  disableSearch: true,
});
```

## Configuration Reference

| Parameter                 | Type        | Description                                                                    |
| ------------------------- | ----------- | ------------------------------------------------------------------------------ |
| `model`                   | `string`    | **Required.** Model name (e.g. `"sonar"`, `"sonar-pro"`, `"sonar-reasoning"`). |
| `apiKey`                  | `string`    | API key. Defaults to `PERPLEXITY_API_KEY` env var.                             |
| `temperature`             | `number`    | Sampling temperature (0–2).                                                    |
| `maxTokens`               | `number`    | Maximum tokens to generate.                                                    |
| `topP`                    | `number`    | Nucleus sampling parameter (0–1).                                              |
| `topK`                    | `number`    | Top-k sampling parameter (1–2048).                                             |
| `presencePenalty`         | `number`    | Presence penalty (-2 to 2).                                                    |
| `frequencyPenalty`        | `number`    | Frequency penalty (> 0).                                                       |
| `streaming`               | `boolean`   | Enable streaming responses.                                                    |
| `timeout`                 | `number`    | Request timeout in milliseconds.                                               |
| `searchDomainFilter`      | `unknown[]` | Limit citations to specific domains.                                           |
| `searchRecencyFilter`     | `string`    | Time filter: `"month"`, `"week"`, `"day"`, `"hour"`.                           |
| `searchMode`              | `string`    | `"academic"` or `"web"`.                                                       |
| `returnImages`            | `boolean`   | Include images in response.                                                    |
| `returnRelatedQuestions`  | `boolean`   | Return related questions.                                                      |
| `reasoningEffort`         | `string`    | `"low"`, `"medium"`, or `"high"` (for deep-research models).                   |
| `disableSearch`           | `boolean`   | Disable web search entirely.                                                   |
| `enableSearchClassifier`  | `boolean`   | Auto-detect if search is needed.                                               |
| `webSearchOptions`        | `object`    | Search context size and user location.                                         |
| `searchAfterDateFilter`   | `string`    | Only include content after this date.                                          |
| `searchBeforeDateFilter`  | `string`    | Only include content before this date.                                         |
| `lastUpdatedAfterFilter`  | `string`    | Only include content updated after this date.                                  |
| `lastUpdatedBeforeFilter` | `string`    | Only include content updated before this date.                                 |

## License

MIT
