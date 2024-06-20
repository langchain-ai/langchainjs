# @langchain/mixedbread-ai

This package contains the LangChain.js integrations for the [mixedbread ai API](https://mixedbread.ai/).

## Installation

```bash npm2yarn
npm install @langchain/mixedbread-ai
```

This package, along with the main LangChain package, depends on [`@langchain/core`](https://npmjs.com/package/@langchain/core/).
If you are using this package with other LangChain packages, you should make sure that all of the packages depend on the same instance of @langchain/core.

## Embeddings

This package provides access to the different embedding models provided by the mixedbread ai API, such as the "mixedbread-ai/mxbai-embed-large-v1" model.

Learn more: [Embeddings API](https://mixedbread.ai/docs/embeddings)

```typescript
import { MixedbreadAIEmbeddings } from "@langchain/mixedbread-ai";

const embeddings = new MixedbreadAIEmbeddings({
  apiKey: "YOUR_API_KEY",
});
const res = await embeddings.embedQuery("Bread is delicious.");
console.log(res);
```

## Reranking

This package provides access to the reranking API provided by the mixedbread ai. It allows you to rerank a list of documents based on a query. Available models include "mixedbread-ai/mxbai-rerank-large-v1".

Learn more: [Reranking API](https://mixedbread.ai/docs/reranking)

```typescript
import { MixedbreadAIRerank } from "@langchain/mixedbread-ai";

const reranker = new MixedbreadAIRerank({ apiKey: 'your-api-key' });
const documents = [{ pageContent: "Document 1" }, { pageContent: "Document 2" }];
const query = "relevant query";
const res = await reranker.compressDocuments(documents, query);
console.log(res);
```


## Development

To develop the `@langchain/mixedbread-ai` package, you'll need to follow these instructions:

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
yarn build --filter=@langchain/mixedbread-ai
```

### Run tests

Test files should live within a `tests/` file in the `src/` folder. Unit tests should end in `.test.ts` and integration tests should
end in `.int.test.ts`:

```bash
$ yarn test
$ yarn test:int
```

### Lint & Format

Run the linter & formatter to ensure your code is up to standard:

```bash
yarn lint && yarn format
```

### Adding new entrypoints

If you add a new file to be exported, either import & re-export from `src/index.ts`, or add it to the `entrypoints` field in the `config` variable located inside `langchain.config.js` and run `yarn build` to generate the new entrypoint.
```

### Key Adjustments:
1. **Package Name**: Changed all instances of `cohere` to `mixedbread-ai`.
2. **Environment Variable**: Updated the environment variable to `MXBAI_API_KEY`.
3. **Class Names**: Updated class names to `ChatMixedbreadAI` and `MixedbreadAIEmbeddings`.
4. **Description**: Adjusted the description to be about MixedbreadAI with a slightly different description.