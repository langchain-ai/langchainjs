<div align="center">
  <a href="https://www.langchain.com/">
    <picture>
      <source media="(prefers-color-scheme: light)" srcset=".github/images/logo-light.svg">
      <source media="(prefers-color-scheme: dark)" srcset=".github/images/logo-dark.svg">
      <img alt="LangChain Logo" src=".github/images/logo-dark.svg" width="50%">
    </picture>
  </a>
</div>

<div align="center">
  <h3>The agent engineering platform.</h3>
</div>

![npm](https://img.shields.io/npm/dm/langchain) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) [![Twitter](https://img.shields.io/twitter/url/https/twitter.com/langchain_js.svg?style=social&label=Follow%20%40LangChain)](https://x.com/langchain_js)

LangChain is a framework for building LLM-powered applications. It helps you chain together interoperable components and third-party integrations to simplify AI application development — all while future-proofing decisions as the underlying technology evolves.

> [!TIP]
> Just getting started? Check out **[Deep Agents](http://docs.langchain.com/oss/python/deepagents/)** — a higher-level package built on LangChain for agents that have built-in capabilites for common usage patterns such as planning, subagents, file system usage, and more.

**Documentation**: To learn more about LangChain, check out [the docs](https://docs.langchain.com/oss/javascript/langchain/overview).

If you're looking for more advanced customization or agent orchestration, check out [LangGraph.js](https://docs.langchain.com/oss/javascript/langgraph/overview) - our framework for building agents and controllable workflows.

For an equivalent Python library, check out [LangChain](https://github.com/langchain-ai/langchain).

To help you ship LangChain apps to production faster, check out [LangSmith](https://smith.langchain.com).
[LangSmith](https://smith.langchain.com) is a unified developer platform for building, testing, and monitoring LLM applications.

## ⚡️ Quick Install

You can use npm, pnpm, or yarn to install LangChain.js

`npm install -S langchain` or `pnpm install langchain` or `yarn add langchain`

## 🚀 Why use LangChain?

LangChain helps developers build applications powered by LLMs through a standard interface for agents, models, embeddings, vector stores, and more.

Use LangChain for:

- **Real-time data augmentation**. Easily connect LLMs to diverse data sources and external/internal systems, drawing from LangChain’s vast library of integrations with model providers, tools, vector stores, retrievers, and more.
- **Model interoperability**. Swap models in and out as your engineering team experiments to find the best choice for your application’s needs. As the industry frontier evolves, adapt quickly — LangChain’s abstractions keep you moving without losing momentum.
- **Rapid prototyping**. Quickly build and iterate on LLM applications with LangChain's modular, component-based architecture. Test different approaches and workflows without rebuilding from scratch, accelerating your development cycle.
- **Production-ready features**. Deploy reliable applications with built-in support for monitoring, evaluation, and debugging through integrations like LangSmith. Scale with confidence using battle-tested patterns and best practices.
- **Vibrant community and ecosystem**. Leverage a rich ecosystem of integrations, templates, and community-contributed components. Benefit from continuous improvements and stay up-to-date with the latest AI developments through an active open-source community.
- **Flexible abstraction layers**. Work at the level of abstraction that suits your needs - from high-level chains for quick starts to low-level components for fine-grained control. LangChain grows with your application's complexity.

## 📦 LangChain's ecosystem

- [Deep Agents (JS)](https://docs.langchain.com/oss/javascript/deepagents/overview) - Build agents that can plan, use subagents, and leverage file systems for complex tasks. A higher-level package built on top of LangChain.
- [LangSmith](https://www.langchain.com/langsmith) - Unified developer platform for building, testing, and monitoring LLM applications. With LangSmith, you can debug poor-performing LLM app runs, evaluate agent trajectories, gain visibility in production, and deploy agents with confidence.
- [LangSmith Deployment](https://docs.langchain.com/langsmith/deployments) — Deploy and scale agents with a purpose-built platform for long-running, stateful workflows
- [LangGraph](https://docs.langchain.com/oss/javascript/langgraph/overview) - Build agents that can reliably handle complex tasks with LangGraph, our low-level agent orchestration framework. LangGraph offers customizable architecture, long-term memory, and human-in-the-loop workflows — and is trusted in production by companies like LinkedIn, Uber, Klarna, and GitLab.
- [Integrations](https://docs.langchain.com/oss/javascript/integrations/providers/overview) — Chat & embedding models, tools & toolkits, and more

## 🌐 Supported Environments

LangChain.js is written in TypeScript and can be used in:

- Node.js (ESM and CommonJS) - 20.x, 22.x, 24.x
- Cloudflare Workers
- Vercel / Next.js (Browser, Serverless and Edge functions)
- Supabase Edge Functions
- Browser
- Deno
- Bun

## 📖 Additional Resources

- [Getting started](https://docs.langchain.com/oss/javascript/langchain/overview): Installation, setting up the environment, simple examples
- [Learn](https://docs.langchain.com/oss/javascript/learn): Learn about the core concepts of LangChain.
- [LangChain Forum](https://forum.langchain.com): Connect with the community and share all of your technical questions, ideas, and feedback.
- [Chat LangChain](https://chat.langchain.com): Ask questions & chat with our documentation.

## 💁 Contributing

As an open-source project in a rapidly developing field, we are extremely open to contributions, whether it be in the form of a new feature, improved infrastructure, or better documentation.

For detailed information on how to contribute, see [`CONTRIBUTING.md`](https://github.com/langchain-ai/langchainjs/blob/main/CONTRIBUTING.md).

Please report any security issues or concerns following our [security guidelines](https://github.com/langchain-ai/.github/blob/main/SECURITY.md).
