# @langchain/seltz

[![NPM - Version](https://img.shields.io/npm/v/@langchain/seltz?style=flat-square&label=%20)](https://www.npmjs.com/package/@langchain/seltz)

This package contains the LangChain.js integrations for [Seltz](https://www.seltz.ai/) — fast, up-to-date web knowledge with context-engineered web content and sources for real-time AI reasoning.

## Installation

```bash
npm install @langchain/seltz @langchain/core
```

You'll need a Seltz API key. Set it as an environment variable:

```bash
export SELTZ_API_KEY=your-api-key
```

## Usage

### As a Tool

```typescript
import { SeltzSearchResults } from "@langchain/seltz";
import { Seltz } from "seltz";

const client = new Seltz({ apiKey: process.env.SELTZ_API_KEY });

const tool = new SeltzSearchResults({
  client,
  searchArgs: {
    maxDocuments: 5,
  },
});

const results = await tool.invoke("latest developments in AI");
console.log(results);
```

### As a Retriever

```typescript
import { SeltzRetriever } from "@langchain/seltz";
import { Seltz } from "seltz";

const client = new Seltz({ apiKey: process.env.SELTZ_API_KEY });

const retriever = new SeltzRetriever({
  client,
  searchArgs: {
    maxDocuments: 5,
    context: "Looking for technical documentation",
  },
});

const docs = await retriever.invoke("machine learning basics");
console.log(docs);
```

## Development

To develop the Seltz package, you'll need to follow these instructions:

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
pnpm build --filter @langchain/seltz
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
