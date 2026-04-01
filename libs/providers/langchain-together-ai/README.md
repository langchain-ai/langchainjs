# @langchain/together-ai

This package contains the LangChain.js integrations for [Together AI](https://www.together.ai/).

## Installation

```bash npm2yarn
npm install @langchain/together-ai @langchain/core
```

This package, along with the main LangChain package, depends on [`@langchain/core`](https://npmjs.com/package/@langchain/core/). If you are using this package with other LangChain packages, make sure they all resolve to the same version of `@langchain/core`.

## Authentication

Set the `TOGETHER_AI_API_KEY` environment variable or pass `apiKey` to the constructor.

```bash
export TOGETHER_AI_API_KEY="your-api-key"
```

## Chat models

`ChatTogetherAI` is the recommended Together AI integration for chat and instruct models.

```typescript
import { ChatTogetherAI } from "@langchain/together-ai";
import { HumanMessage } from "@langchain/core/messages";

const model = new ChatTogetherAI({
  model: "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
  temperature: 0,
});

const response = await model.invoke([new HumanMessage("Hello there!")]);
console.log(response.content);
```

## Embeddings

```typescript
import { TogetherAIEmbeddings } from "@langchain/together-ai";

const embeddings = new TogetherAIEmbeddings({
  model: "togethercomputer/m2-bert-80M-8k-retrieval",
});

const vector = await embeddings.embedQuery(
  "What would be a good company name for a colorful socks startup?"
);
console.log(vector.length);
```

## Legacy completions LLM

```typescript
import { TogetherAI } from "@langchain/together-ai";
import { PromptTemplate } from "@langchain/core/prompts";

const model = new TogetherAI({
  model: "togethercomputer/StripedHyena-Nous-7B",
});

const prompt = PromptTemplate.fromTemplate("Answer briefly: {input}");
const response = await prompt.pipe(model).invoke({
  input: "Tell me a joke about bears",
});

console.log(response);
```

For chat or instruct models, prefer `ChatTogetherAI` over the legacy `TogetherAI` completions class.

## Development

To develop the `@langchain/together-ai` package, follow these instructions:

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
pnpm build --filter @langchain/together-ai
```

### Run tests

Test files should live within a `tests/` folder in the `src/` directory. Unit tests should end in `.test.ts` and integration tests should end in `.int.test.ts`:

```bash
pnpm test
pnpm test:int
pnpm test:standard:unit
```

### Lint & Format

```bash
pnpm lint && pnpm format
```

### Adding new entry points

If you add a new file to be exported, either import and re-export it from `src/index.ts`, or add it to the `exports` field in `package.json` and run `pnpm build` to generate the new entry point.
