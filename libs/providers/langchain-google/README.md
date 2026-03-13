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
