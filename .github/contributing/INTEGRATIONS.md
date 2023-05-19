# Contributing Integrations to LangChain

In addition to the [general contribution guidelines](https://github.com/hwchase17/langchainjs/blob/main/CONTRIBUTING.md), there are a few extra things to consider when contributing third-party integrations to LangChain that will be covered here. The goal of this page is to help you draft PRs that take these considerations into account, and can therefore be merged sooner.

Integrations tend to fall into one of the following categories, each of which will have their own section below. Please read the [general guidelines](#general-concepts), then see the section specific to what you're building for additional information and examples.

- [LLM providers](#llm-providers) (e.g. OpenAI's GPT-3)
- [Chat model providers](#chat-model-providers) (e.g. Anthropic's Claude, OpenAI's GPT-4)
- [Memory](#memory) (used to give an LLM or chat model context of past conversations, e.g. Motörhead)
- [Vector stores](#vector-stores) (e.g. Pinecone)
- [Persistent message stores](#persistent-message-stores) (used to persistently store and load raw chat histories, e.g. Redis)
- [Document loaders](#document-loaders) (used to load documents for later storage into vector stores, e.g. Apify)
- [Tools](#tools) (used for agents, e.g. the SERP API)

## General concepts

The following guidelines apply broadly to all type of integrations:

### Creating a separate entrypoint

You should generally not export your new module from an `index.ts` file that contains many other exports. Instead, you should add a separate entrypoint for your integration in `langchain/scripts/create-entrypoints.js` within the `entrypoints` object:

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

You may use third-party dependencies in new integrations, but they should be added as `peerDependencies` and `devDependencies` with an entry under `optionalDependenciesMeta` in `langchain/package.js`, **not under any core `dependencies` list**. This keeps the overall package size small, as only people who are using your integration will need to install, and allows us to support a wider range of runtimes.

Please make sure all introduced dependencies are permissively licensed (MIT is recommended) and well-supported and maintained.

If your integration also uses a third-party library, you must add it under `requiresOptionalDependency` in the `create-entrypoints.js` file to avoid breaking the build:

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

If you have conformed to all of the above guidelines, you can just import your dependency as normal in your integration's file in the LangChain repo.

### Prioritize using third-party types

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

Above, we have a document loader that we're sure will always require a specific `datasetId`, and then some `config` properties that could change in the future containing a LangChain specific configuration property, `verbose`, and a `clientOptions` parameter within that `config` that is passed directly into the third party client.

### Documentation and integration tests

We highly appreciate documentation and integration tests showing how to set up and use your integration. Providing this will make it much easier for reviewers to verify that your integration works and will streamline the review process.

Docs pages should be added as `.mdx` files in the appropriate location under `docs/` (`.mdx` is an extended markdown format that allows use of additional statements like `import`). Code examples within docs pages should be under `examples` and imported like this:

```md
import CodeBlock from "@theme/CodeBlock";
import LangCoExample from "@examples/document_loaders/langco.ts";

<CodeBlock language="typescript">{LangCoExample}</CodeBlock>
```

This allows the linter and formatter to pick up example code blocks within docs as well.

### Linting and formatting

As with all contributions, make sure you run `yarn lint` and `yarn format` so that everything conforms to our established style.

## LLM providers

## Chat model providers

## Memory

## Vector stores

## Persistent message stores

## Document loaders

## Tools
