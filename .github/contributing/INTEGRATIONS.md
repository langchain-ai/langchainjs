# Contributing Integrations to LangChain

In addition to the [general contribution guidelines](https://github.com/langchain-ai/langchainjs/blob/main/CONTRIBUTING.md), there are a few extra things to consider when contributing third-party integrations to LangChain that will be covered here. The goal of this page is to help you draft PRs that take these considerations into account, and can therefore be merged sooner.

Integrations tend to fall into a set number of categories, each of which will have their own section below. Please read the [general guidelines](#general-concepts), then see the [integration-specific guidelines and example PRs](#integration-specific-guidelines-and-example-prs) section at the end of this page for additional information and examples.

## General concepts

The following guidelines apply broadly to all type of integrations:

### Creating a separate entrypoint

You should generally not export your new module from an `index.ts` file that contains many other exports. Instead, you should add a separate entrypoint for your integration in [`langchain/scripts/create-entrypoints.js`](https://github.com/langchain-ai/langchainjs/blob/main/langchain/scripts/create-entrypoints.js) within the `entrypoints` object:

```js
import * as fs from "fs";
import * as path from "path";

// This lists all the entrypoints for the library. Each key corresponds to an
// importable path, eg. `import { AgentExecutor } from "langchain/agents"`.
// The value is the path to the file in `src/` that exports the entrypoint.
// This is used to generate the `exports` field in package.json.
// Order is not important.
const entrypoints = {
  // agents
  agents: "agents/index",
  "agents/load": "agents/load",
  ...
  "vectorstores/chroma": "vectorstores/chroma",
  "vectorstores/hnswlib": "vectorstores/hnswlib",
  ...
};
```

The entrypoint name should conform to its path in the repo. For example, if you were adding a new vector store for a hypothetical provider "langco", you might create it under `vectorstores/langco.ts`. You should add it above as:

```js
import * as fs from "fs";
import * as path from "path";

// This lists all the entrypoints for the library. Each key corresponds to an
// importable path, eg. `import { AgentExecutor } from "langchain/agents"`.
// The value is the path to the file in `src/` that exports the entrypoint.
// This is used to generate the `exports` field in package.json.
// Order is not important.
const entrypoints = {
  // agents
  agents: "agents/index",
  "agents/load": "agents/load",
  ...
  "vectorstores/chroma": "vectorstores/chroma",
  "vectorstores/hnswlib": "vectorstores/hnswlib",
  "vectorstores/langco": "vectorstores/langco",
  ...
};
```

A user would then import your new vector store as `import { LangCoVectorStore } from "langchain/vectorstores/langco";`.

### Third-party dependencies

You may use third-party dependencies in new integrations, but they should be added as `peerDependencies` and `devDependencies` with an entry under `peerDependenciesMeta` in [`langchain/package.json`](https://github.com/langchain-ai/langchainjs/blob/main/langchain/package.json), **not under any core `dependencies` list**. This keeps the overall package size small, as only people who are using your integration will need to install, and allows us to support a wider range of runtimes.

We suggest using caret syntax (`^`) for peer dependencies to support a wider range of people trying to use them as well as to be somewhat tolerant to non-major version updates, which should (theoretically) be the only breaking ones.

Please make sure all introduced dependencies are permissively licensed (MIT is recommended) and well-supported and maintained.

You must also add your new entrypoint under `requiresOptionalDependency` in the [`create-entrypoints.js`](https://github.com/langchain-ai/langchainjs/blob/main/langchain/scripts/create-entrypoints.js) file to avoid breaking the build:

```js
// Entrypoints in this list require an optional dependency to be installed.
// Therefore they are not tested in the generated test-exports-* packages.
const requiresOptionalDependency = [
  "agents/load",
  ...
  "vectorstores/chroma",
  "vectorstores/hnswlib",
  "vectorstores/langco",
  ...
];
```

If you have conformed to all of the above guidelines, you can just import your dependency as normal in your integration's file in the LangChain repo. Developers who import your entrypoint will then see an error message if they are missing the required peer dependency.

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

New docs pages should be added as `.mdx` files in the appropriate location under `docs/` (`.mdx` is an extended markdown format that allows use of additional statements like `import`). Code examples within docs pages should be under `examples` and imported like this:

```md
import CodeBlock from "@theme/CodeBlock";
import LangCoExample from "@examples/document_loaders/langco.ts";

<CodeBlock language="typescript">{LangCoExample}</CodeBlock>
```

This allows the linter and formatter to pick up example code blocks within docs as well.

### Linting and formatting

As with all contributions, make sure you run `yarn lint` and `yarn format` so that everything conforms to our established style.

## Integration-specific guidelines and example PRs

Below are links to guides with advice and tips for specific types of integrations:

- [LLM providers](https://github.com/langchain-ai/langchainjs/blob/main/.github/contributing/integrations/LLMS.md) (e.g. OpenAI's GPT-3)
- Chat model providers (TODO) (e.g. Anthropic's Claude, OpenAI's GPT-4)
- [Memory](https://github.com/langchain-ai/langchainjs/blob/main/.github/contributing/integrations/MEMORY.md) (used to give an LLM or chat model context of past conversations, e.g. Motörhead)
- [Vector stores](https://github.com/langchain-ai/langchainjs/blob/main/.github/contributing/integrations/VECTOR_STORES.md) (e.g. Pinecone)
- [Persistent message stores](https://github.com/langchain-ai/langchainjs/blob/main/.github/contributing/integrations/MESSAGE_STORES.md) (used to persistently store and load raw chat histories, e.g. Redis)
- [Document loaders](https://github.com/langchain-ai/langchainjs/blob/main/.github/contributing/integrations/DOCUMENT_LOADERS.md) (used to load documents for later storage into vector stores, e.g. Apify)
- Embeddings (TODO) (e.g. Cohere)
- [Tools](https://github.com/langchain-ai/langchainjs/blob/main/.github/contributing/integrations/TOOLS.md) (used for agents, e.g. the SERP API tool)

This is a living document, so please make a pull request if we're missing anything useful!
