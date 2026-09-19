# Contributing Integrations to LangChain

In addition to the [general contribution guidelines](https://github.com/langchain-ai/langchainjs/blob/main/CONTRIBUTING.md), there are a few extra things to consider when contributing third-party integrations to LangChain that will be covered here. The goal of this page is to help you draft PRs that take these considerations into account, and can therefore be merged sooner.

Integrations tend to fall into a set number of categories, each of which will have their own section below. Please read the [general guidelines](#general-concepts), then see the [integration-specific guidelines and example PRs](#integration-specific-guidelines-and-example-prs) section at the end of this page for additional information and examples.

## General concepts

The following guidelines apply broadly to all type of integrations:

### Standalone provider packages

New integrations are published as **standalone packages** under `libs/providers/` (for example [`@langchain/openai`](https://github.com/langchain-ai/langchainjs/tree/main/libs/providers/langchain-openai)). The monolithic `@langchain/community` package was removed in [PR #10600](https://github.com/langchain-ai/langchainjs/pull/10600).

When adding a new integration:

1. Create a new package under `libs/providers/langchain-<provider>/` following the layout of an existing provider such as `@langchain/openai`.
2. Export public APIs from that package's `src/index.ts` (or equivalent entrypoint defined in its `package.json`).
3. Declare third-party dependencies in that package's `package.json` — not in `@langchain/core` or legacy community paths.

See [`CONTRIBUTING.md`](https://github.com/langchain-ai/langchainjs/blob/main/CONTRIBUTING.md) for the canonical standalone-integration policy.

### Third-party dependencies

You may use third-party dependencies in new integrations, but they should be declared in your **standalone provider package's** `package.json` as `dependencies`, `peerDependencies`, and/or `devDependencies` as appropriate — **not** under any core `@langchain/core` dependency list. This keeps install sizes small and allows us to support a wider range of runtimes.

We suggest using caret syntax (`^`) for peer dependencies to support a wider range of people trying to use them as well as to be somewhat tolerant to non-major version updates, which should (theoretically) be the only breaking ones.

Please make sure all introduced dependencies are permissively licensed (MIT is recommended) and well-supported and maintained.

Developers who import your package will install its declared dependencies directly from npm.

### Prioritize using exported third-party types for client config

Many integrations initialize instances of third-party clients, which often require vendor-specific configuration and options in addition to LangChain specific configuration. To avoid unnecessary repetition and desyncing, we suggest using imported third-party configuration types whenever available, unless there's a specific reason to only support a subset of these options.

Here's a simplified example:

```ts
import {
  LangCoClient,
  LangCoClientOptions,
} from "langco-client";

import { BaseDocumentLoader, DocumentLoader } from "../base.js";

export class LangCoDatasetLoader
  extends BaseDocumentLoader
  implements DocumentLoader
{
  protected langCoClient: LangCoClient;

  protected datasetId: string;

  protected verbose: boolean;

  constructor(
    datasetId: string,
    config: {
      verbose: boolean;
      clientOptions?: LangCoClientOptions;
    }
  ) {
    super();
    this.langCoClient = new LangCoClient(config.clientOptions ?? {});
    this.verbose = config.verbose ?? false;
  }
...
}
```

Above, we have a document loader that we're sure will always require a specific `datasetId`, and then some `config` properties that could change in the future containing a LangChain specific configuration property, `verbose`. We have also put a `clientOptions` parameter within that `config` that is passed directly into the third party client. With this structure, if the underlying client adds new options, all we need to do is bump the version.

### Documentation and integration tests

We highly appreciate documentation and integration tests showing how to set up and use your integration. Providing this will make it much easier for reviewers to verify that your integration works and will streamline the review process.

### Linting and formatting

As with all contributions, make sure you run `pnpm lint` and `pnpm format` so that everything conforms to our established style.

## Integration-specific guidelines and example PRs

Below are links to guides with advice and tips for specific types of integrations:

- [LLM providers](https://github.com/langchain-ai/langchainjs/blob/main/.github/contributing/integrations/LLMS.md) (e.g. OpenAI's GPT-3)
- Chat model providers (TODO) (e.g. Anthropic's Claude, OpenAI's GPT-4)
- [Memory](https://github.com/langchain-ai/langchainjs/blob/main/.github/contributing/integrations/MEMORY.md) (used to give an LLM or chat model context of past conversations, e.g. Motörhead)
- [Vector stores](https://github.com/langchain-ai/langchainjs/blob/main/.github/contributing/integrations/VECTOR_STORES.md) (e.g. Pinecone)
- [Persistent message stores](https://github.com/langchain-ai/langchainjs/blob/main/.github/contributing/integrations/MESSAGE_STORES.md) (used to persistently store and load raw chat histories, e.g. Redis)
- [Document loaders](https://github.com/langchain-ai/langchainjs/blob/main/.github/contributing/integrations/DOCUMENT_LOADERS.md) (used to load documents for later storage into vector stores, e.g. Apify)
- [Embeddings](https://github.com/langchain-ai/langchainjs/blob/main/.github/contributing/integrations/EMBEDDINGS.md) (used to create embeddings of text documents or strings e.g. Cohere)
- [Tools](https://github.com/langchain-ai/langchainjs/blob/main/.github/contributing/integrations/TOOLS.md) (used for agents, e.g. the SERP API tool)

This is a living document, so please make a pull request if we're missing anything useful!
