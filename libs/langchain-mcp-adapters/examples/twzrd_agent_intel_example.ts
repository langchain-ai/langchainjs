/**
 * TWZRD Agent Intel — Remote Streamable-HTTP MCP Example
 *
 * Demonstrates connecting a LangGraph.js agent to TWZRD Agent Intel
 * (https://intel.twzrd.xyz), a production remote MCP server that
 * trust-scores Solana wallets before x402 micropayments.
 *
 * No local server setup required — the MCP endpoint is live at
 * https://intel.twzrd.xyz/mcp (Streamable-HTTP, no API key needed for free tools).
 *
 * Available tools:
 *   - score_agent(wallet)   — Free. On-chain trust score (0–100) for a Solana wallet.
 *   - preflight_check(wallet) — Free. Boolean readiness check before sending a payment.
 *   - get_trust_receipt(wallet) — Paid (HTTP 402). Signed receipt via USDC micropayment.
 *
 * Usage:
 *   npm install @langchain/mcp-adapters @langchain/openai @langchain/langgraph langchain
 *   export OPENAI_API_KEY=<your_key>
 *   npx ts-node twzrd_agent_intel_example.ts
 */

import { ChatOpenAI } from "@langchain/openai";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { HumanMessage } from "@langchain/core/messages";
import { MultiServerMCPClient } from "../src/index.js";

const TWZRD_MCP_URL = "https://intel.twzrd.xyz/mcp";

async function runExample() {
  let client: MultiServerMCPClient | null = null;

  try {
    // --- 1. Connect to TWZRD Agent Intel MCP server ---
    client = new MultiServerMCPClient({
      mcpServers: {
        "twzrd-agent-intel": {
          transport: "streamable_http",
          url: TWZRD_MCP_URL,
        },
      },
      useStandardContentBlocks: true,
    });

    const tools = await client.getTools();
    console.log(
      "Loaded TWZRD tools:",
      tools.map((t) => t.name)
    );

    // --- 2. Build a trust-gated payment agent ---
    const model = new ChatOpenAI({
      model: "gpt-4o-mini",
      temperature: 0,
    });

    const agent = createReactAgent({
      llm: model,
      tools,
      messageModifier:
        "You are a payment safety agent. Before approving any USDC transfer, " +
        "you MUST call preflight_check on the recipient wallet. " +
        "If preflight passes, call score_agent and include the trust score in your response. " +
        "If preflight fails, decline and explain why.",
    });

    // --- 3. Example 1: Check a wallet before paying ---
    const wallet = "4LkEFjwNNg6XRSXqD6UFMB6neLEQPKFSVBRzXQo8kNgf";

    console.log("\n=== Example 1: Trust check before payment ===");
    const response1 = await agent.invoke({
      messages: [
        new HumanMessage(
          `I want to send 5 USDC to ${wallet}. Should I proceed?`
        ),
      ],
    });
    const lastMessage1 = response1.messages[response1.messages.length - 1];
    console.log("Agent response:", lastMessage1.content);

    // --- 4. Example 2: Score multiple wallets ---
    console.log("\n=== Example 2: Score multiple wallets ===");
    const wallets = [
      "4LkEFjwNNg6XRSXqD6UFMB6neLEQPKFSVBRzXQo8kNgf",
      "DJsfAHjRomMhE7tTfQnFyGKhVVNQHBBXoHF3Rq1uKkVz",
    ];

    for (const w of wallets) {
      const response = await agent.invoke({
        messages: [new HumanMessage(`What is the trust score for wallet ${w}?`)],
      });
      const last = response.messages[response.messages.length - 1];
      console.log(`Wallet ${w.slice(0, 8)}...: ${last.content}`);
    }

    // --- 5. Example 3: Free-only filtered tools ---
    console.log("\n=== Example 3: Free tools only ===");
    const freeClient = new MultiServerMCPClient({
      mcpServers: {
        "twzrd-agent-intel": {
          transport: "streamable_http",
          url: TWZRD_MCP_URL,
        },
      },
    });
    const allTools = await freeClient.getTools();
    const freeTools = allTools.filter((t) =>
      ["score_agent", "preflight_check"].includes(t.name)
    );
    console.log(
      "Free tools only:",
      freeTools.map((t) => t.name)
    );
    await freeClient.close();
  } finally {
    await client?.close();
  }
}

runExample().catch(console.error);
