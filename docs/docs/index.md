# Welcome to LangChain

LangChain is a framework for developing applications powered by language models. We believe that the most powerful and differentiated applications will not only call out to a language model via an api, but will also:

- _Be data-aware_: connect a language model to other sources of data
- _Be agentic_: allow a language model to interact with its environment

The LangChain framework is designed with the above principles in mind.

## Getting Started

Checkout the below guide for a walkthrough of how to get started using LangChain to create an Language Model application.

- [Getting Started Documentation](./getting-started/guide-llm.mdx)

## Components

There are several main modules that LangChain provides support for. For each module we provide some examples to get started and get familiar with some of the concepts. These modules are, in increasing order of complexity:

- Prompts: This includes prompt management, prompt optimization, and prompt serialization.

- LLMs: This includes a generic interface for all LLMs, and common utilities for working with LLMs.

- Indexes: This includes patterns and functionality for structuring your own text data so it can interact with language models (including embeddings, vectorstores, text splitters, retrievers, etc).

- Memory: Memory is the concept of persisting state between calls of a chain/agent. LangChain provides a standard interface for memory, a collection of memory implementations, and examples of chains/agents that use memory.

- Chains: Chains go beyond just a single LLM call, and are sequences of calls (whether to an LLM or a different utility). LangChain provides a standard interface for chains, lots of integrations with other tools, and end-to-end chains for common applications.

- Agents: Agents involve an LLM making decisions about which Actions to take, taking that Action, seeing an Observation, and repeating that until done. LangChain provides a standard interface for agents, a selection of agents to choose from, and examples of end to end agents.

## Reference Docs

---

All of LangChain's reference documentation, in one place. Full documentation on all methods and classes.

## Production

---

As you move from prototyping into production, we're developing resources to help you do so.
These including:

- Deployment: resources on how to deploy your end application.
- Tracing: resouces on how to use tracing to log and debug your applications.

## Additional Resources

---

Additional collection of resources we think may be useful as you develop your application!

- [LangChainHub](https://github.com/hwchase17/langchain-hub): The LangChainHub is a place to share and explore other prompts, chains, and agents.

- [Discord](https://discord.gg/6adMQxSpJS): Join us on our Discord to discuss all things LangChain!

- [Production Support](https://forms.gle/57d8AmXBYp8PP8tZA): As you move your LangChains into production, we'd love to offer more comprehensive support. Please fill out this form and we'll set up a dedicated support Slack channel.
