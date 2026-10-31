/**
 * AgentScrape x402 MCP Example
 *
 * Connect LangChain to AgentScrape, a pay-per-call web-scraping MCP server that
 * uses the x402 payment protocol on Base USDC. Agents pay autonomously per call,
 * no signup or API keys required.
 *
 * AgentScrape exposes six tools as a remote MCP server via Streamable HTTP:
 *   - scrape_webpage          ($0.003) — markdown/html/text/json scrape
 *   - extract_structured_data ($0.005) — AI extraction via Groq + Llama 4 Scout
 *   - screenshot_webpage      ($0.003) — PNG screenshot with viewport control
 *   - extract_metadata        ($0.002) — title, OG, Twitter, JSON-LD
 *   - create_browser_session  ($0.001) — stateful browser session
 *   - run_workflow            ($0.008) — multi-step atomic workflow up to 20 steps
 *
 * Free tier: 10 calls per wallet in the first 30 days. Beyond that, payment in
 * USDC on Base mainnet (eip155:8453). The first 402 Payment Required response
 * carries the canonical x402 payment requirements header; this example shows the
 * unpaid (free-tier) usage. For paid usage, integrate with Coinbase AgentKit's
 * `x402ActionProvider` and supply the payment header on retry.
 *
 * Service URLs:
 *   - Worker:    https://agent-scrape.healingsunhaven.workers.dev
 *   - MCP:       https://agent-scrape.healingsunhaven.workers.dev/mcp
 *   - x402:      https://agent-scrape.healingsunhaven.workers.dev/.well-known/x402.json
 *   - A2A card:  https://agent-scrape.healingsunhaven.workers.dev/.well-known/agent.json
 *   - GitHub:    https://github.com/hshintelligence/agent-scrape
 *
 * Run:
 *   tsx examples/agentscrape_x402_example.ts
 */

import { createAgent } from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import { MultiServerMCPClient } from "@langchain/mcp-adapters";

async function main(): Promise<void> {
  // Connect to AgentScrape's remote MCP endpoint over Streamable HTTP.
  // AgentScrape gracefully falls back to SSE for legacy clients via the
  // standard MCP transport-negotiation handshake.
  const client = new MultiServerMCPClient({
    throwOnLoadError: true,
    prefixToolNameWithServerName: true,
    useStandardContentBlocks: true,

    mcpServers: {
      agentscrape: {
        url: "https://agent-scrape.healingsunhaven.workers.dev/mcp",
        // Default transport: streamable_http (auto-detected). Add headers
        // here if you wire up x402 payment proofs for paid calls.
        // headers: {
        //   "X-PAYMENT-RESPONSE": "<base64-encoded x402 payment receipt>",
        // },
      },
    },
  });

  // Pull all of AgentScrape's tools as LangChain tools.
  const tools = await client.getTools();

  console.log(
    `Loaded ${tools.length} tools from AgentScrape:`,
    tools.map((t) => t.name)
  );

  // Build a LangGraph agent that uses these tools.
  const model = new ChatOpenAI({ model: "gpt-4o-mini", temperature: 0 });
  const agent = createAgent({ llm: model, tools });

  // Ask the agent to scrape a page.
  const result = await agent.invoke({
    messages: [
      {
        role: "user",
        content:
          "Scrape https://www.x402.org and tell me the headline plus a 2-sentence summary.",
      },
    ],
  });

  console.log(
    "\nAgent response:\n",
    result.messages[result.messages.length - 1].content
  );

  await client.close();
}

main().catch((err) => {
  console.error("AgentScrape example failed:", err);
  process.exit(1);
});
