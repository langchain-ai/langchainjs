# @langchain/nomic

This package contains the LangChain.js integrations for Nomic via the @nomic-ai/atlas package.

## Installation

```bash npm2yarn
npm install @langchain/nomic @langchain/core
```

## Embeddings

This package adds support for Nomic embeddings.

Currently, they offer two embeddings models:
- `nomic-embed-text-v1`
- `nomic-embed-text-v1.5`

`nomic-embed-text-v1.5` allows for you to customize the number of dimensions returned. It defaults to the largest possible number of dimensions (768), or you can select 64, 128, 256, or 512.

Now set the necessary environment variable (or pass it in via the constructor):

```bash
export NOMIC_API_KEY=
```

```typescript
import { NomicEmbeddings } from "@langchain/nomic";

const nomicEmbeddings = new NomicEmbeddings({
  apiKey: process.env.NOMIC_API_KEY, // Default value.
  modelName: "nomic-embed-text-v1",  // Default value.
});

const docs = [
  "hello world",
  "nomic embeddings!",
  "super special langchain integration package",
  "what color is the sky?",
];

const embeddings = await nomicEmbeddings.embedDocuments(docs);
```

## Development

To develop the `@langchain/nomic` package, you'll need to follow these instructions:

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
yarn build --filter=@langchain/nomic
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
