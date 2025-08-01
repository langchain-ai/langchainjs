# @langchain/cloudflare

This package contains the LangChain.js integrations for Cloudflare through their SDK.

## Installation

```bash npm2yarn
npm install @langchain/cloudflare @langchain/core
```

## Development

To develop the Cloudflare package, you'll need to follow these instructions:

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

If you add a new file to be exported, either import & re-export from `src/index.ts`, or add it to the `exports` field in the `package.json` file and run `yarn build` to generate the new entrypoint.
