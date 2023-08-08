# 🦜️🔗 LangChain.js

⚡ Building applications with LLMs through composability ⚡

[![CI](https://github.com/hwchase17/langchainjs/actions/workflows/ci.yml/badge.svg)](https://github.com/hwchase17/langchainjs/actions/workflows/ci.yml) ![npm](https://img.shields.io/npm/dw/langchain) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) [![Twitter](https://img.shields.io/twitter/url/https/twitter.com/langchainai.svg?style=social&label=Follow%20%40LangChainAI)](https://twitter.com/langchainai) [![](https://dcbadge.vercel.app/api/server/6adMQxSpJS?compact=true&style=flat)](https://discord.gg/6adMQxSpJS) [![Open in Dev Containers](https://img.shields.io/static/v1?label=Dev%20Containers&message=Open&color=blue&logo=visualstudiocode)](https://vscode.dev/redirect?url=vscode://ms-vscode-remote.remote-containers/cloneInVolume?url=https://github.com/hwchase17/langchainjs)
[<img src="https://github.com/codespaces/badge.svg" title="Open in Github Codespace" width="150" height="20">](https://codespaces.new/hwchase17/langchainjs)

Looking for the Python version? Check out [LangChain](https://github.com/hwchase17/langchain).

**Production Support:** As you move your LangChains into production, we'd love to offer more hands-on support.
Fill out [this form](https://airtable.com/appwQzlErAS2qiP0L/shrGtGaVBVAz7NcV2) to share more about what you're building, and our team will get in touch.

## Quick Install

`yarn add langchain`

```typescript
import { OpenAI } from "langchain/llms/openai";
```

## Supported Environments

LangChain is written in TypeScript and can be used in:

- Node.js (ESM and CommonJS) - 18.x, 19.x, 20.x
- Cloudflare Workers
- Vercel / Next.js (Browser, Serverless and Edge functions)
- Supabase Edge Functions
- Browser
- Deno

## 🤔 What is this?

Large language models (LLMs) are emerging as a transformative technology, enabling
developers to build applications that they previously could not.
But using these LLMs in isolation is often not enough to
create a truly powerful app - the real power comes when you can combine them with other sources of computation or knowledge.

This library is aimed at assisting in the development of those types of applications.

## 📖 Full Documentation

For full documentation of prompts, chains, agents and more, please see [here](https://js.langchain.com/docs/).

## Relationship with Python LangChain

This is built to integrate as seamlessly as possible with the [LangChain Python package](https://github.com/hwchase17/langchain). Specifically, this means all objects (prompts, LLMs, chains, etc) are designed in a way where they can be serialized and shared between languages.

The [LangChainHub](https://github.com/hwchase17/langchain-hub) is a central place for the serialized versions of these prompts, chains, and agents.

## 💁 Contributing

As an open source project in a rapidly developing field, we are extremely open to contributions, whether it be in the form of a new feature, improved infra, or better documentation.

Check out [our contributing guidelines](https://github.com/hwchase17/langchainjs/blob/main/CONTRIBUTING.md) for instructions on how to contribute.
