# 🦜️🔗 LangChain.js

⚡ Building applications with LLMs through composability ⚡

[![CI](https://github.com/langchain-ai/langchainjs/actions/workflows/ci.yml/badge.svg)](https://github.com/langchain-ai/langchainjs/actions/workflows/ci.yml) ![npm](https://img.shields.io/npm/dm/langchain) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) [![Twitter](https://img.shields.io/twitter/url/https/twitter.com/langchainai.svg?style=social&label=Follow%20%40LangChainAI)](https://twitter.com/langchainai) [![Open in Dev Containers](https://img.shields.io/static/v1?label=Dev%20Containers&message=Open&color=blue&logo=visualstudiocode)](https://vscode.dev/redirect?url=vscode://ms-vscode-remote.remote-containers/cloneInVolume?url=https://github.com/langchain-ai/langchainjs)
[<img src="https://github.com/codespaces/badge.svg" title="Open in Github Codespace" width="150" height="20">](https://codespaces.new/langchain-ai/langchainjs)

Looking for the Python version? Check out [LangChain](https://github.com/langchain-ai/langchain).

To help you ship LangChain apps to production faster, check out [LangSmith](https://smith.langchain.com).
[LangSmith](https://smith.langchain.com) is a unified developer platform for building, testing, and monitoring LLM applications.

## ⚡️ Quick Install

You can use npm, yarn, or pnpm to install LangChain.js

`npm install -S langchain` or `yarn add langchain` or `pnpm add langchain`

## 🌐 Supported Environments

LangChain is written in TypeScript and can be used in:

- Node.js (ESM and CommonJS) - 18.x, 19.x, 20.x
- Cloudflare Workers
- Vercel / Next.js (Browser, Serverless and Edge functions)
- Supabase Edge Functions
- Browser
- Deno

## 🤔 What is LangChain?

**LangChain** is a framework for developing applications powered by language models. It enables applications that:
- **Are context-aware**: connect a language model to sources of context (prompt instructions, few shot examples, content to ground its response in, etc.)
- **Reason**: rely on a language model to reason (about how to answer based on provided context, what actions to take, etc.)

This framework consists of several parts.
- **Open-source libraries**: Build your applications using LangChain's open-source [building blocks](https://js.langchain.com/docs/concepts/lcel), [components](https://js.langchain.com/docs/concepts), and [third-party integrations](https://js.langchain.com/docs/integrations/platforms/).
Use [LangGraph.js](https://js.langchain.com/docs/concepts/#langgraphjs) to build stateful agents with first-class streaming and human-in-the-loop support.
- **Productionization**: Use [LangSmith](https://docs.smith.langchain.com/) to inspect, monitor and evaluate your chains, so that you can continuously optimize and deploy with confidence.
- **Deployment**: Turn your LangGraph applications into production-ready APIs and Assistants with [LangGraph Cloud](https://langchain-ai.github.io/langgraph/cloud/).

The LangChain libraries themselves are made up of several different packages.
- **[`@langchain/core`](https://github.com/langchain-ai/langchainjs/blob/main/langchain-core)**: Base abstractions and LangChain Expression Language.
- **[`@langchain/community`](https://github.com/langchain-ai/langchainjs/blob/main/libs/langchain-community)**: Third party integrations.
- **[`langchain`](https://github.com/langchain-ai/langchainjs/blob/main/langchain)**: Chains, agents, and retrieval strategies that make up an application's cognitive architecture.
- **[LangGraph.js](https://langchain-ai.github.io/langgraphjs/)**: A library for building robust and stateful multi-actor applications with LLMs by modeling steps as edges and nodes in a graph. Integrates smoothly with LangChain, but can be used without it.

Integrations may also be split into their own compatible packages.

![LangChain Stack](https://github.com/langchain-ai/langchainjs/blob/main/docs/core_docs/static/svg/langchain_stack_062024.svg)

This library aims to assist in the development of those types of applications. Common examples of these applications include:

**❓Question Answering over specific documents**

- [Documentation](https://js.langchain.com/docs/tutorials/rag)
- End-to-end Example: [Doc-Chatbot](https://github.com/dissorial/doc-chatbot)


**💬 Chatbots**

- [Documentation](https://js.langchain.com/docs/how_to/#chatbots)
- End-to-end Example: [Chat-LangChain](https://github.com/langchain-ai/chat-langchainjs)

## 🚀 How does LangChain help?

The main value props of the LangChain libraries are:
1. **Components**: composable tools and integrations for working with language models. Components are modular and easy-to-use, whether you are using the rest of the LangChain framework or not
2. **Off-the-shelf chains**: built-in assemblages of components for accomplishing higher-level tasks

Off-the-shelf chains make it easy to get started. Components make it easy to customize existing chains and build new ones. 

Components fall into the following **modules**:

**📃 Model I/O:**

This includes prompt management, prompt optimization, a generic interface for all LLMs, and common utilities for working with LLMs.

**📚 Retrieval:**

Data Augmented Generation involves specific types of chains that first interact with an external data source to fetch data for use in the generation step. Examples include summarization of long pieces of text and question/answering over specific data sources.

**🤖 Agents:**

Agents allow an LLM autonomy over how a task is accomplished. Agents make decisions about which Actions to take, then take that Action, observe the result, and repeat until the task is complete. LangChain provides a [standard interface for agents](https://js.langchain.com/docs/concepts/#agents), along with [LangGraph.js](https://github.com/langchain-ai/langgraphjs/) for building custom agents.

## 📖 Documentation

Please see [here](https://js.langchain.com) for full documentation, which includes:

- [Getting started](https://js.langchain.com/docs/introduction): installation, setting up the environment, simple examples
- Overview of the [interfaces](https://js.langchain.com/docs/how_to/lcel_cheatsheet/), [modules](https://js.langchain.com/docs/concepts) and [integrations](https://js.langchain.com/docs/integrations/platforms/)
- [Tutorial](https://js.langchain.com/docs/tutorials/) walkthroughs
- [Reference](https://api.js.langchain.com): full API docs

## 💁 Contributing

As an open-source project in a rapidly developing field, we are extremely open to contributions, whether it be in the form of a new feature, improved infrastructure, or better documentation.

For detailed information on how to contribute, see [here](https://github.com/langchain-ai/langchainjs/blob/main/CONTRIBUTING.md).

Please report any security issues or concerns following our [security guidelines](https://github.com/langchain-ai/langchainjs/blob/main/SECURITY.md).

## 🖇️ Relationship with Python LangChain

This is built to integrate as seamlessly as possible with the [LangChain Python package](https://github.com/langchain-ai/langchain). Specifically, this means all objects (prompts, LLMs, chains, etc) are designed in a way where they can be serialized and shared between languages.
