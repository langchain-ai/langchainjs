import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { convertMcpToLangchainTools } from "@langchain/mcp-adapters";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

/**
 * This example demonstrates how to connect a LangChain agent to the PkgDiet MCP server.
 * PkgDiet is a local-first dependency guardrail that stops AI agents from hallucinating 
 * or installing bloated, insecure, or deprecated npm packages.
 */
async function run() {
  // Initialize the PkgDiet MCP Server using npx
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["-y", "pkgdiet@2.0.1", "mcp"],
  });

  const client = new Client(
    { name: "langchain-pkgdiet-agent", version: "1.0.0" },
    { capabilities: {} }
  );
  await client.connect(transport);

  // Convert the MCP tools to LangChain compatible tools
  // This allows the LangChain agent to natively call check_dependency, suggest_alternative, etc.
  const mcpTools = await convertMcpToLangchainTools(client);

  const llm = new ChatOpenAI({
    modelName: "gpt-4o",
    temperature: 0,
  });

  const agent = createReactAgent({
    llm,
    tools: mcpTools,
  });

  console.log("Asking agent to evaluate 'request' using PkgDiet...");
  const result = await agent.invoke({
    messages: [
      {
        role: "user",
        content: "Check if the npm package 'request' is safe to use in a new project.",
      },
    ],
  });

  console.log("\nAgent Response:");
  console.log(result.messages[result.messages.length - 1].content);
  
  // Cleanup
  await transport.close();
}

run().catch(console.error);
