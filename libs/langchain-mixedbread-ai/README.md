# @langchain/mixedbread-ai

This package contains the LangChain.js integrations for the [Mixedbread AI API](https://mixedbread.ai/).

## Installation

```bash
npm install @langchain/mixedbread-ai
```

This package, along with the main LangChain package, depends on [`@langchain/core`](https://npmjs.com/package/@langchain/core/). If you are using this package with other LangChain packages, you should make sure that all of the packages depend on the same instance of `@langchain/core`.

## Authentication

To use this package, you need a Mixedbread AI API key. You can obtain your API key by signing up at [Mixedbread AI](https://mixedbread.ai).

Either set the `MXBAI_API_KEY` environment variable to your Mixedbread AI API key, or pass it as the `apiKey` option to the constructor of the class you are using.

## Embeddings

This package provides access to the different embedding models provided by the Mixedbread AI API, such as the "mixedbread-ai/mxbai-embed-large-v1" model.

Learn more: [Embeddings API](https://mixedbread.ai/docs/embeddings)

```typescript
const embeddings = new MixedbreadAIEmbeddings({ apiKey: "your-api-key" });
const texts = ["Baking bread is fun", "I love baking"];
const result = await embeddings.embedDocuments(texts);
console.log(result);
```

## Reranking

This package provides access to the reranking API provided by Mixedbread AI. It allows you to rerank a list of documents based on a query. Available models include "mixedbread-ai/mxbai-rerank-large-v1".

Learn more: [Reranking API](https://mixedbread.ai/docs/reranking)

```typescript
const reranker = new MixedbreadAIReranker({ apiKey: "your-api-key" });
const documents = [
  { pageContent: "To bake bread you need flour" },
  { pageContent: "To bake bread you need yeast" },
];
const query = "What do you need to bake bread?";
const result = await reranker.compressDocuments(documents, query);
console.log(result);
```

## Development

To develop the `@langchain/mixedbread-ai` package, follow these instructions:

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
pnpm build --filter @langchain/mixedbread-ai
```

### Run tests

Test files should live within a `tests/` folder in the `src/` directory. Unit tests should end in `.test.ts` and integration tests should end in `.int.test.ts`:

```bash
yarn test
yarn test:int
```

### Lint & Format

Run the linter & formatter to ensure your code is up to standard:

```bash
yarn lint && yarn format
```

### Adding new entry points

If you add a new file to be exported, either import & re-export from `src/index.ts`, or add it to the `exports` field in the `package.json` file and run `yarn build` to generate the new entry point.
