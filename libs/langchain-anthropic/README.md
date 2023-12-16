# @langchain/anthropic

This package contains the LangChainJS integrations for Anthropic through their SDK.

## Installation

```bash npm2yarn
npm install @langchain/anthropic
```

## Chat Models

This package contains the `ChatAnthropic` class, which is the recommended way to interface with the Anthropic series of models.

To use, install the requirements, and configure your environment.

```bash
export ANTHROPIC_API_KEY=your-api-key
```

Then initialize

```typescript
import { ChatAnthropic } from "@langchain/anthropic";

const model = new ChatAnthropic({
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
});
const response = await model.invoke(new HumanMessage("Hello world!"));
```

### Streaming

```typescript
import { ChatAnthropic } from "@langchain/anthropic";

const model = new ChatAnthropic({
  anthropicApiKey: process.env.ANTHROPIC_API_KEY,
  modelName: "claude-2",
});
const response = await model.stream(new HumanMessage("Hello world!"));
```

## Development

To develop the Anthropic package, you'll need to follow these instructions:

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
yarn build --filter=@langchain/anthropic
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

If you add a new file to be exported, either import & re-export from `src/index.ts`, or add it to `scripts/create-entrypoints.js` and run `yarn build` to generate the new entrypoint.

## Publishing

After running `yarn build`, publish a new version with:

```bash
$ npm publish
```