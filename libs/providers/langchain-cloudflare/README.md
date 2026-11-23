# @langchain/cloudflare

This package contains the LangChain.js integrations for Cloudflare through their SDK.

## Installation

```bash npm2yarn
npm install @langchain/cloudflare @langchain/core
```

## EmbeddingGemma 2

`CloudflareWorkersAIEmbeddings` supports text embeddings with
`@cf/google/embeddinggemma-2` through a Workers AI binding:

```typescript
import { CloudflareWorkersAIEmbeddings } from "@langchain/cloudflare";

const embeddings = new CloudflareWorkersAIEmbeddings({
  binding: env.AI,
  model: "@cf/google/embeddinggemma-2",
  dimensions: 768, // Optional: 128, 256, 512, or 768 (the model default).
});

const query = await embeddings.embedQuery(
  "task: search result | query: waterproof trail shoes"
);
const documents = await embeddings.embedDocuments([
  "title: Trail shoes | text: Waterproof shoes for running on trails.",
]);
```

Task prefixes are supplied by the caller. For retrieval, Cloudflare recommends
`task: search result | query: ...` for queries and `title: ... | text: ...` for
documents (`title: none` when there is no title). Use the same model and dimensions
for queries and documents. Other models retain their existing request format;
`dimensions` is only sent to EmbeddingGemma 2.

See the [Cloudflare model documentation](https://developers.cloudflare.com/workers-ai/models/embeddinggemma-2/).
This integration accepts text only; multimodal inputs are outside the LangChain
`Embeddings` string interface.

## Development

To develop the Cloudflare package, you'll need to follow these instructions:

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
pnpm build --filter @langchain/cloudflare
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
