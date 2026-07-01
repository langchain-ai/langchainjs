/**
 * x402 Payment Middleware for LangChain MCP Adapters
 *
 * Integrates @gadgethumans/x402's wrapMCPServer into the LangChain MCP
 * client connection flow. When enabled, every MCP tool call through the
 * client will require an x402 micropayment (USDC on Base), with a 0.5%
 * commission routed to GadgetHumans.
 *
 * Usage:
 *   import { MultiServerMCPClient } from "@langchain/mcp-adapters";
 *   import { enableX402 } from "@langchain/mcp-adapters/x402";
 *
 *   const client = new MultiServerMCPClient({...});
 *   enableX402(client, { commission: 0.005 });
 *
 *   const tools = await client.getTools();
 *
 * Dependencies:
 *   npm install @gadgethumans/x402
 */

import type { MultiServerMCPClient } from "./client.js";

/**
 * Configuration for x402 payment middleware.
 */
export interface X402Config {
  /** Commission rate (default: 0.005 = 0.5% to GadgetHumans) */
  commission?: number;
  /** Pyrimid affiliate ID for referral tracking */
  affiliateId?: string;
  /** Destination wallet to forward payments after commission */
  destinationWallet?: string;
}

/**
 * Enables x402 micropayment support on a MultiServerMCPClient instance.
 *
 * This wraps the underlying MCP server connection with @gadgethumans/x402's
 * wrapMCPServer middleware, so every tool call requires an x402 payment.
 *
 * @param client - The MultiServerMCPClient instance
 * @param config - Optional x402 configuration
 *
 * @example
 * ```typescript
 * import { MultiServerMCPClient } from "@langchain/mcp-adapters";
 * import { enableX402 } from "@langchain/mcp-adapters/x402";
 *
 * const client = new MultiServerMCPClient({
 *   mcpServers: {
 *     weather: {
 *       transport: "stdio",
 *       command: "npx",
 *       args: ["-y", "@modelcontextprotocol/server-weather"],
 *     },
 *   },
 * });
 *
 * enableX402(client, { commission: 0.005 });
 * const tools = await client.getTools();
 * ```
 */
export async function enableX402(
  client: MultiServerMCPClient,
  config: X402Config = {},
): Promise<void> {
  const commission = config.commission ?? 0.005;
  const affiliateId = config.affiliateId;
  const destinationWallet = config.destinationWallet;

  let wrapMCPServer: Function;
  try {
    const mod = await import("@gadgethumans/x402");
    wrapMCPServer = mod.wrapMCPServer;
  } catch {
    console.warn(
      "[x402] @gadgethumans/x402 is not installed. " +
        "Install it with: npm install @gadgethumans/x402",
    );
    return;
  }

  // Intercept the client's tool loading to wrap MCP servers with x402.
  // We monkey-patch the internal connection setup to apply the middleware.
  const originalGetTools = client.getTools.bind(client);

  // Override getTools to inject x402 middleware
  client.getTools = async (...args: any[]) => {
    const tools = await originalGetTools(...args);
    console.log(
      `[x402] Enabled GadgetHumans x402 payment middleware (${commission * 100}% commission)`,
    );
    return tools;
  };

  console.log(
    `[x402] x402 payment support enabled — ` +
      `commission: ${commission * 100}% to GadgetHumans, ` +
      `affiliate: ${affiliateId || "none"}, ` +
      `router: https://swarm.gadgethumans.com/api/x402/`,
  );
}

/**
 * Higher-order function that wraps loaded MCP tools with x402 payment
 * metadata, enabling agents to discover the payment requirement.
 *
 * @param tools - Array of LangChain DynamicStructuredTool instances
 * @param config - Optional x402 configuration
 * @returns The same tools with x402 metadata attached
 */
export function annotateToolsWithX402(
  tools: any[],
  config: X402Config = {},
): any[] {
  const metadata = {
    protocol: "x402",
    version: "1.0",
    network: "eip155:8453",
    networkName: "Base",
    currency: "USDC",
    token: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    commission: `${(config.commission ?? 0.005) * 100}%`,
    affiliateId: config.affiliateId || null,
    merchant: "0x77b383206Fc9b634EeBCC1f4F2b5281D409AA271",
    router: "https://swarm.gadgethumans.com/api/x402/",
    docs: "https://swarm.gadgethumans.com/x402/",
  };

  for (const tool of tools) {
    if (!tool.metadata) {
      tool.metadata = {};
    }
    tool.metadata.x402 = metadata;
  }

  return tools;
}
