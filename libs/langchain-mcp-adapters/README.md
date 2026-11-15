# LangChain.js MCP Adapters

[![npm version](https://img.shields.io/npm/v/@langchain/mcp-adapters.svg)](https://www.npmjs.com/package/@langchain/mcp-adapters)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Give your LangChain agents access to tools from [Model Context Protocol (MCP)](https://modelcontextprotocol.io)
servers. `@langchain/mcp-adapters` manages connections and converts MCP tools
and results into LangChain formats, ready to use with `createAgent` or a custom
LangGraph workflow.

- **Connect your tools**: discover tools from multiple local or remote servers.
- **Control tool execution**: authenticate connections, customize arguments and
  results with hooks, and receive progress updates.
- **Choose what the model sees**: use text and multimodal results as model input,
  or keep outputs in artifacts for your application to process.
- **Ask for user input**: pause an agent when a modern MCP server requests a form
  response or a URL visit, then resume with the user's response.

**[Read the MCP guide](https://docs.langchain.com/oss/javascript/langchain/mcp)**
for concepts, configuration, and advanced usage.

## Install

Requires Node.js 20.10 or later. Install the adapter and its LangChain peers:

```bash
npm install @langchain/mcp-adapters @langchain/core @langchain/langgraph
```

The adapter requires `@langchain/core ^1.2.6` and `@langchain/langgraph ^1.4.13`.
It includes the MCP SDK client; install the SDK separately only if your application
imports it directly.

## Quickstart: give an agent MCP tools

This example connects an agent to the public [LangChain docs MCP server](https://docs.langchain.com/use-these-docs)
so it can look up documentation. You do not need to run a server or configure
authentication for this MCP endpoint.

Install LangChain and the model integration used below:

```bash
npm install langchain @langchain/openai
```

Set `OPENAI_API_KEY` in your environment, then run:

```ts
import { createAgent } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { MCPAdapter } from "@langchain/mcp-adapters";

const adapter = new MCPAdapter({
  servers: {
    docs: { url: "https://docs.langchain.com/mcp" },
  },
});

try {
  const tools = await adapter.listTools();
  const agent = createAgent({
    model: new ChatOpenAI({ model: "gpt-4.1-mini" }),
    tools,
  });

  const result = await agent.invoke({
    messages: [
      {
        role: "user",
        content: "How do I add short-term memory to a LangChain agent?",
      },
    ],
  });
  console.log(result.messages.at(-1)?.content);
} finally {
  await adapter.close();
}
```

Keep the adapter open while your agent uses its tools, then call `close()` when
finished. Connections open as needed. `listTools()` returns executable LangChain
tools, which you can also invoke directly without a model or use in a custom
LangGraph workflow.

## Tools that request user input

MCP tools can ask users to complete a form or visit a URL before continuing.
For modern MCP servers, the adapter pauses the agent through a LangGraph
interrupt so your application can collect a response and resume the run.

Configure a checkpointer for these workflows. Tools that do not request input
can run without one. See the [tools guide](https://docs.langchain.com/oss/javascript/langchain/mcp/tools)
for handling requests and resuming execution.

## Documentation and examples

| I want to…                                                           | Start here                                                                                                                           |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Connect local or remote servers, manage connections, or select tools | [Connections](https://docs.langchain.com/oss/javascript/langchain/mcp/connections)                                                   |
| Authenticate with tokens or OAuth                                    | [Authentication](https://docs.langchain.com/oss/javascript/langchain/mcp/auth)                                                       |
| Customize tool calls, handle results, or collect user input          | [Tools](https://docs.langchain.com/oss/javascript/langchain/mcp/tools)                                                               |
| Modify tool arguments and results                                    | [Hooks example](https://github.com/langchain-ai/langchainjs/blob/main/libs/langchain-mcp-adapters/examples/hooks.ts)                 |
| Work with multimodal content and artifacts                           | [Content example](https://github.com/langchain-ai/langchainjs/blob/main/libs/langchain-mcp-adapters/examples/content.ts)             |
| Receive server messages and tool progress                            | [Notifications example](https://github.com/langchain-ai/langchainjs/blob/main/libs/langchain-mcp-adapters/examples/notifications.ts) |
| Run a local example without model credentials                        | [Example setup and walkthroughs](https://github.com/langchain-ai/langchainjs/tree/main/libs/langchain-mcp-adapters/examples)         |

If you already manage an MCP SDK client, use `loadMcpTools()` to adapt its tools
without handing connection management to `MCPAdapter`.

## Upgrading from 1.x

Use `MCPAdapter`, `{ servers: { ... } }`, and `listTools()` for new code.
`MultiServerMCPClient`, `mcpServers`, and `getTools()` remain available as
deprecated compatibility APIs.

Version 2 also changes tool-name defaults, configuration, connection behavior,
and tool results. Review the [migration guide](https://docs.langchain.com/oss/javascript/migrate/langchain-mcp-adapters)
before upgrading, including any approval rules that refer to tool names.

## Acknowledgements

Big thanks to [@vrknetha](https://github.com/vrknetha), [@knacklabs](https://www.knacklabs.ai) for the initial implementation!

## Contributing

Contributions are welcome! See the [contributing guidelines](https://github.com/langchain-ai/langchainjs/blob/main/CONTRIBUTING.md).

## License

MIT
