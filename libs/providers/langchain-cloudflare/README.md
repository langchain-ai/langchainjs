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
  model: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
});

const response = await model.invoke("Hello!");
// Streaming is also supported:
const stream = await model.stream("Hello!");
```

When `binding` is supplied, it takes precedence over REST credentials and
`baseUrl`. Binding-backed models cannot be serialized.

## Tool calling and structured output

Use a model that supports the requested feature. For example, Gemma supports
OpenAI-style tool calls, JSON Schema output, and image content blocks:

```typescript
import { z } from "zod/v4";
import { tool } from "@langchain/core/tools";
import { ToolMessage } from "@langchain/core/messages";

const model = new ChatCloudflareWorkersAI({
  binding: env.AI,
  model: "@cf/google/gemma-4-26b-a4b-it",
  maxTokens: 512,
  modelKwargs: { chat_template_kwargs: { enable_thinking: false } },
});
const lookup = tool(async ({ color }) => `A ${color} circle`, {
  name: "lookup",
  description: "Look up a shape by color",
  schema: z.object({ color: z.string() }),
});
const question = "Look up the red shape.";
const response = await model.bindTools([lookup]).invoke(question);
const toolResults = await Promise.all(
  (response.tool_calls ?? []).map(
    async (call) =>
      new ToolMessage({
        content: await lookup.invoke(call.args),
        tool_call_id: call.id!,
      })
  )
);
const answer = await model.invoke([
  ["human", question],
  response,
  ...toolResults,
]);

const structured = model.withStructuredOutput(
  z.object({ answer: z.string() }),
  {
    method: "jsonSchema",
    name: "answer",
  }
);
const result = await structured.invoke("Return the answer READY.");
```

`bindTools` accepts LangChain tools and OpenAI function definitions. Both
`stream` and `streamEvents` preserve tool calls, including split argument chunks.
`tool_choice` accepts `auto`, `none`, `required` (or `any`), and a function name.
Tool execution remains the application's or agent's responsibility.

`withStructuredOutput` supports `functionCalling` (default), `jsonMode`, and
`jsonSchema`. Zod v3/v4 schemas are validated by LangChain; a plain JSON Schema
uses LangChain's JSON parser. `includeRaw: true` returns the original message
alongside parsed output, or `parsed: null` if parsing fails. Native JSON Schema
requests use the OpenAI-compatible `json_schema: { name, schema, strict }` shape;
support for these modes, strict enforcement, tools plus JSON Schema, and
streaming depends on the selected Workers AI model. The integration does not
silently downgrade or retry requests with a different output method.

Messages may contain OpenAI-compatible text and `image_url` content blocks for
vision-capable models. Legacy native `response`/`tool_calls` and newer
`choices`/`delta` responses are supported. Token totals are available through
`usage_metadata`; cumulative native stream usage is emitted only once.

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

### Real Workers AI binding test

The opt-in binding integration test runs the chat model inside workerd and calls
real Workers AI inference. It incurs usage charges and sends only a fixed
synthetic prompt. It requires Wrangler and an authenticated Cloudflare account
with Workers AI access.

From this package directory, start the development-only fixture:

```bash
npx wrangler dev --config tests/binding/wrangler.jsonc --ip 127.0.0.1 --port 8891
```

In another terminal, run:

```bash
CLOUDFLARE_WORKERS_AI_BINDING_TEST_URL=http://127.0.0.1:8891 \
  pnpm exec vitest run --mode int src/tests/chat_models_binding.int.test.ts
```

Set `CLOUDFLARE_ACCOUNT_ID` when Wrangler needs an explicit account selection.
The fixture does not need to be deployed.

The Gemma capability tests use the same Worker fixture and two synthetic images:

```bash
CLOUDFLARE_WORKERS_AI_BINDING_TEST_URL=http://127.0.0.1:8891 \
  pnpm exec vitest run --mode int src/tests/chat_models_tools.int.test.ts
```

They check text, streamed tool calls and result replay, structured output, and
multiple-image input. These are billed opt-in tests and do not access user data.
