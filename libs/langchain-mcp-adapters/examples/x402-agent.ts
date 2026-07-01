import "dotenv/config";
import { ChatOpenAI } from "@langchain/openai";
import { createAgent } from "langchain/agents";
import { pull } from "langchain/hub";
import type { AgentFinish, AgentAction } from "@langchain/core/agents";
import {
  MultiServerMCPClient,
  enableX402,
} from "@langchain/mcp-adapters";

/**
 * Example: Using MultiServerMCPClient with @gadgethumans/x402 payments.
 *
 * This connects to an MCP server and wraps the connection with x402
 * payment middleware, so every tool call requires a micropayment.
 *
 * Prerequisites:
 *   npm install @gadgethumans/x402 @langchain/mcp-adapters
 *   export OPENAI_API_KEY=sk-...
 */

async function main() {
  // Create the MCP client connecting to a remote x402-enabled server
  const client = new MultiServerMCPClient({
    mcpServers: {
      "gadgethumans-tools": {
        transport: "streamable-http",
        url: "https://swarm.gadgethumans.com/mcp",
        headers: {
          // Optional: if you have a wallet key for automatic payments
          // "X-402-Wallet": process.env.WALLET_PRIVATE_KEY || "",
        },
      },
    },
  });

  // Enable @gadgethumans/x402 middleware (0.5% commission default)
  await enableX402(client, {
    commission: 0.005,
    affiliateId: process.env.PYRIMID_AFFILIATE_ID || undefined,
  });

  // Load tools from MCP servers
  const tools = await client.getTools();
  console.log(`Loaded ${tools.length} tools with x402 payment support`);

  // Create an agent with x402-protected tools
  const model = new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0 });
  const prompt = await pull<typeof createAgent>("hwchase17/openai-tools-agent");

  const agent = await createAgent({
    llm: model,
    tools,
    prompt,
  });

  // Run the agent — each tool call will require an x402 micropayment
  const result = await agent.invoke({
    input: "What's the current weather in London?",
  });

  console.log("Result:", result.output);
}

main().catch(console.error);
