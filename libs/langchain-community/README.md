# 🦜️🧑‍🤝‍🧑 LangChain Community

[![CI](https://github.com/langchain-ai/langchainjs/actions/workflows/ci.yml/badge.svg)](https://github.com/langchain-ai/langchainjs/actions/workflows/ci.yml) ![npm](https://img.shields.io/npm/dw/@langchain/community) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) [![Twitter](https://img.shields.io/twitter/url/https/twitter.com/langchainai.svg?style=social&label=Follow%20%40LangChainAI)](https://twitter.com/langchainai) [![](https://dcbadge.vercel.app/api/server/6adMQxSpJS?compact=true&style=flat)](https://discord.gg/6adMQxSpJS)

## Quick Install

```bash
$ yarn add @langchain/community
```

This package, along with the main LangChain package, depends on [`@langchain/core`](https://npmjs.com/package/@langchain/core/).
If you are using this package with other LangChain packages, you should make sure that all of the packages depend on the same instance of @langchain/core.
You can do so by adding appropriate field to your project's `package.json` like this:

```json
{
  "name": "your-project",
  "version": "0.0.0",
  "dependencies": {
    "@langchain/<ADD_PACKAGE_NAME_HERE>": "^0.0.0",
    "langchain": "0.0.207"
  },
  "resolutions": {
    "@langchain/core": "0.1.5"
  },
  "overrides": {
    "@langchain/core": "0.1.5"
  },
  "pnpm": {
    "overrides": {
      "@langchain/core": "0.1.5"
    }
  }
}
```

The field you need depends on the package manager you're using, but we recommend adding a field for the common `yarn`, `npm`, and `pnpm` to maximize compatibility.

## 🤔 What is this?

LangChain Community contains third-party integrations that implement the base interfaces defined in LangChain Core, making them ready-to-use in any LangChain application.

![LangChain Stack](../../docs/core_docs/static/img/langchain_stack.png)

## 📕 Releases & Versioning

`@langchain/community` is currently on version `0.0.x`

All changes will be accompanied by a patch version increase.

## 💁 Contributing

As an open-source project in a rapidly developing field, we are extremely open to contributions, whether it be in the form of a new feature, improved infrastructure, or better documentation.

For detailed information on how to contribute, see [here](../../CONTRIBUTING.md).