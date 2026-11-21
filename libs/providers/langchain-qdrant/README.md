# @langchain/qdrant

This package contains the LangChain.js integration for the [Qdrant](https://qdrant.tech/) vector database.

## Installation

```bash
npm install @langchain/qdrant
```

## Custom payload fields

Extra fields passed in `customPayload` are stored under the point's
`customPayload` key by default. Set `customPayloadAtTopLevel: true` in the
`QdrantVectorStore` constructor or `fromDocuments` configuration to store those
fields directly on the point's payload.

For example, filter on `customPayload.status` with the default layout and
`status` with the top-level layout. Top-level custom fields must have different
names from the configured `contentPayloadKey` and `metadataPayloadKey`.
The option applies to writes made through the configured store. Existing points
retain their stored layout until rewritten.

## Development

To develop the this package, you'll need to follow these instructions:

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
pnpm build --filter @langchain/qdrant
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
