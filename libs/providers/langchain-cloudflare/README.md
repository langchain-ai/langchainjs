# @langchain/cloudflare

This package contains the LangChain.js integrations for Cloudflare through their SDK.

## Installation

```bash npm2yarn
npm install @langchain/cloudflare @langchain/core
```

## Chat models in Cloudflare Workers

Pass a Workers AI binding to use `ChatCloudflareWorkersAI` without an account ID
or API token. Configure an AI binding named `AI` in your Wrangler configuration,
then pass it from your Worker:

```typescript
import { ChatCloudflareWorkersAI } from "@langchain/cloudflare";

const model = new ChatCloudflareWorkersAI({
  binding: env.AI,
  model: "@cf/meta/llama-3.1-8b-instruct",
});

const response = await model.invoke("Hello!");
// Streaming is also supported:
const stream = await model.stream("Hello!");
```

When `binding` is supplied, it takes precedence over REST credentials and
`baseUrl`. Binding-backed models cannot be serialized. This transport option
does not add tool calling or structured output support.

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
