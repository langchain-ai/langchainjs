# @langchain/groq

This package contains the LangChain.js integrations for Groq via the groq/sdk package.

## Installation

```bash npm2yarn
npm install @langchain/groq @langchain/core
```

## Chat models

This package adds support for Groq chat model inference.

Set the necessary environment variable (or pass it in via the constructor):

```bash
export GROQ_API_KEY=
```

```typescript
import { ChatGroq } from "@langchain/groq";
import { HumanMessage } from "@langchain/core/messages";

const model = new ChatGroq({
  apiKey: process.env.GROQ_API_KEY, // Default value.
});

const message = new HumanMessage("What color is the sky?");

const res = await model.invoke([message]);
```

## Development

To develop the `@langchain/groq` package, you'll need to follow these instructions:

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
yarn build --filter=@langchain/groq
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
