# 🦜️🔗 @langchain/core

:::note
This package is experimental at the moment and may change.
:::

`@langchain/core` contains the core abstractions and schemas of LangChain.js, including base classes for language models,
chat models, vectorstores, retrievers, and runnables.

## 🔧 Usage

Install core like this:

```bash
$ yarn add @langchain/core
```

Then, you can install other provider-specific packages like this:

```bash
$ yarn add @langchain/openai
```

And use them as follows:

```typescript
import { StringOutputParser } from "@langchain/core/output_parsers";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { ChatOpenAI } from "@langchain/openai";

const prompt = ChatPromptTemplate.fromTemplate(
  `Answer the following question to the best of your ability:\n{question}`
);

const model = new ChatOpenAI({
  temperature: 0.8,
});

const outputParser = new StringOutputParser();

const chain = prompt.pipe(model).pipe(outputParser);

const stream = await chain.stream({
  question: "Why is the sky blue?",
});

for await (const chunk of stream) {
  console.log(chunk);
}

/*
The
 sky
 appears
 blue
 because
 of
 a
 phenomenon
 known
 as
 Ray
leigh
 scattering
*/
```

Note that for compatibility, all used LangChain packages (including the base LangChain package, which itself depends on core!) must share the same version of `@langchain/core`.
This means that you may need to install a specific version of `@langchain/core` that matches the dependencies of your used packages.

## 📦 Creating your own package

Other LangChain packages should add this package as a dependency and extend the classes within. 
For an example, see the [@langchain/anthropic](https://github.com/langchain-ai/langchainjs/tree/main/libs/langchain-anthropic) in this repo.

Because all used packages must share the same version of core, we suggest using a tilde dependency to allow for different (backwards-compatible) patch versions:

```json
{
  "name": "@langchain/anthropic",
  "version": "0.0.3",
  "description": "Anthropic integrations for LangChain.js",
  "type": "module",
  "author": "LangChain",
  "license": "MIT",
  "dependencies": {
    "@anthropic-ai/sdk": "^0.10.0",
    "@langchain/core": "~0.0.1"
  }
}
```

This recommendation will change to a caret once a major version (1.x.x) release has occurred.

API reference docs for core are in progress. For now we recommend looking directly at the source code to find the necessary abstractions for your use case.

We suggest making all packages cross-compatible with ESM and CJS using a build step like the one in 
[@langchain/anthropic](https://github.com/langchain-ai/langchainjs/tree/main/libs/langchain-anthropic), then running `yarn build` before running `npm publish`.

We will be exploring how to make this process easier in the future.

## 💁 Contributing

Because `@langchain/core` is a low-level package whose abstractions will change infrequently, most contributions should be made in the higher-level LangChain package.

Bugfixes or suggestions should be made using the same guidelines as the main package.
See [here](https://github.com/langchain-ai/langchainjs/tree/main/CONTRIBUTING.md) for detailed information.

Please report any security issues or concerns following our [security guidelines](https://github.com/langchain-ai/langchainjs/tree/main/SECURITY.md).
