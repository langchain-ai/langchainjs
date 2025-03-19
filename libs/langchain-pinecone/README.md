# @langchain/pinecone

This package contains the LangChain.js integrations for  through their SDK.

## Installation

```bash npm2yarn
npm install @langchain/pinecone @langchain/core
```

## Development

To develop the Pinecone package, you'll need to follow these instructions:

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
yarn build --filter=@langchain/pinecone
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
