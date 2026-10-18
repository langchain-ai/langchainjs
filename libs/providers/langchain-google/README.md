# @langchain/google

This package supports access to a variety of Google's models, including the Gemini
family of models and their Nano Banana image generation model. You can access these
models through either Google's [Google AI](https://ai.google.dev/) API (sometimes also
called the Generative AI API or the AI Studio API) or through the Google Cloud Platform
[Vertex AI](https://cloud.google.com/vertex-ai) service. It does not rely
on the "genai" library from Google, but rather uses direct REST calls.

This package will be replacing the [ChatGoogleGenerativeAI](google_generative_ai)
and [ChatVertex](google_vertex_ai) libraries.

## Installation

```bash
pnpm install @langchain/core @langchain/google
```

This package, along with the main LangChain package, depends on [`@langchain/core`](https://npmjs.com/package/@langchain/core/).
If you are using this package with other LangChain packages, you should make sure that
all the packages depend on the same instance of @langchain/core.

## Chat Models

This package contains the `ChatGoogle` class, which is the recommended way
to interface with Google's models.

For detailed configuration and use, including how to get credentials, see the
[LangChain.js documentation](https://docs.langchain.com/oss/javascript/integrations/chat/google).

## Tools

`ChatGoogle` supports standard LangChain tool calling as
well as Gemini-specific "Specialty Tools" (like Code Execution and Grounding).

See the [LangChain.js documentation](https://docs.langchain.com/oss/javascript/integrations/chat/google).
for details.

## Long Decode

Models such as `gemini-4-argon` support
[Long Decode](https://ai.google.dev/gemini-api/docs/generate-content/long-decode),
which produces very long outputs across several requests ("hops"). Set
`maxOutputTokens` above 65,536 (it is the total for all hops) and continue
manually: `ChatGoogle` never sends a follow-up request on its own.

```typescript
import { ChatGoogle } from "@langchain/google";
import { HumanMessage } from "@langchain/core/messages";

const model = new ChatGoogle({
  model: "gemini-4-argon",
  maxOutputTokens: 262_144,
});
// Send the same messages and settings on every hop. Do not add the partial
// output to the messages; the token carries the model's progress.
const messages = [new HumanMessage("Write the complete report.")];

let text = "";
let continuationToken: string | undefined;
for (;;) {
  const result = await model.invoke(messages, { continuationToken });
  text += result.text;
  continuationToken = result.response_metadata.continuationToken as
    string | undefined;
  if (result.response_metadata.finishReason !== "CONTINUATION") break;
}
```

- A hop may return empty `text` while the model is thinking. That is normal
  progress; keep going while `finishReason` is `"CONTINUATION"`.
- `MAX_TOKENS` can also return a token. Resuming it requires a higher
  `maxOutputTokens` than the tokens used so far. Check Google's
  `finishReason` to tell the two apart; LangChain's normalized
  `finish_reason` may be `"length"` for both.
- With `model.stream()`, combine the chunks (`chunk.concat(...)`); the combined
  message carries the latest token in `response_metadata.continuationToken`.
- Each hop is billed, including hops that only think.
- The token you pass in is redacted from LangChain traces. The token returned
  in `response_metadata` is part of the traced response; to keep it out,
  give the LangSmith `Client` a `hideOutputs` function that removes it.

### Timeouts

Each call has a `timeout` (milliseconds) covering the request, its retries and
reading a streamed response. It defaults to 20 minutes, the longest Google lets
a single Long Decode request run. Set it in the constructor
(`new ChatGoogle({ ..., timeout: 600_000 })`) or `0` to disable. A per-call
`timeout` or `signal` can shorten it, but not extend it.

On Node.js, the built-in `fetch` also gives up if the server sends no response
headers, or no streamed data, for 5 minutes. Google allows a non-streaming hop
to run for up to 10 minutes, so on Node.js either stream Long Decode requests,
or raise Node's limits using its supported mechanism: install
[`undici`](https://undici.nodejs.org) in your application and set a global
dispatcher once at startup.

```typescript
import { Agent, setGlobalDispatcher } from "undici";

setGlobalDispatcher(
  new Agent({ headersTimeout: 1_200_000, bodyTimeout: 1_200_000 })
);
```

This changes every `fetch` in the process. Other runtimes have their own
network timeouts; check them for long non-streaming hops.

## Reporting issues

Please report any problems encountered with the library in the
[LangChain.js github repository](https://github.com/langchain-ai/langchainjs/issues).

Please provide as many details as possible and make sure the title
references the @langchain/google library. A code sample that can reproduce
the issue is very welcome.

## Development

Contributions are welcome! You may wish to [open an issue](https://github.com/langchain-ai/langchainjs/issues)
before you begin and tag [@hntrl](https://github.com/hntrl) and
[@afirstenberg](https://github.com/afirstenberg) with your plans.

To develop the Google package, you'll need to follow these instructions:

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
pnpm build --filter=@langchain/google
```

### Run tests

Test files should live within a `tests/` file in the `src/` folder. Unit tests should end in `.test.ts` and integration tests should
end in `.int.test.ts`:

```bash
pnpm test
pnpm test:int
```

Note that the integration tests run against currently supported models and
platforms.

### Lint & Format

Run the linter & formatter to ensure your code is up to standard:

```bash
pnpm lint && pnpm format
```

### Adding new entrypoints

If you add a new file to be exported, either import & re-export from `src/index.ts`, or add it to the `exports` field in the `package.json` file and run `pnpm build` to generate the new entrypoint.
