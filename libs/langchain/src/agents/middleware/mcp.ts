import { z } from "zod/v3";
import { createMiddleware } from "../middleware.js";
import { tool, type DynamicStructuredTool } from "@langchain/core/tools";
import {
  interopParse,
  InferInteropZodOutput,
  InferInteropZodInput,
} from "@langchain/core/utils/types";

/**
 * Configuration for pure MCP integration middleware
 */
const contextSchema = z.object({
  /**
   * MCP client configuration - can be either:
   * - A ClientConfig object from @langchain/mcp-adapters
   * - A record of server names to connection configs
   */
  mcpConfig: z.custom<Record<string, unknown>>(),
});

/**
 * State schema for MCP integration middleware
 */
const stateSchema = z.object({
  /**
   * Whether MCP adapters have been loaded
   */
  adaptersLoaded: z.boolean().default(false),
  /**
   * Unique ID for the MCP client instance (used for cleanup)
   */
  clientId: z.string().optional(),
  /**
   * MCP client configuration (stored for recreating client if needed)
   */
  mcpConfig: z.custom<Record<string, unknown>>().optional(),
});

type MCPMiddlewareState = InferInteropZodOutput<typeof stateSchema>;
export type MCPMiddlewareConfig = InferInteropZodInput<typeof contextSchema>;

type MCPClientInstance = {
  getTools: (servers?: string[]) => Promise<DynamicStructuredTool[]>;
  close: () => Promise<void>;
};

/**
 * Map to store MCP client instances by unique ID
 * This allows us to track and close clients properly without storing them in state
 * Exported so code execution middleware can access tools
 */
export const mcpClientInstances = new Map<string, MCPClientInstance>();

/**
 * Generate a unique client ID based on config
 */
function generateClientId(config: Record<string, unknown>): string {
  // Create a simple hash of the config for uniqueness
  const configStr = JSON.stringify(config);
  return `mcp-client-${Buffer.from(configStr).toString("base64").slice(0, 16)}`;
}

/**
 * Dynamically load the @langchain/mcp-adapters package
 */
async function loadMCPAdapters(): Promise<{
  MultiServerMCPClient: new (
    config: Record<string, unknown>
  ) => MCPClientInstance;
}> {
  try {
    // @ts-expect-error - @langchain/mcp-adapters is an optional dependency
    const adapters = await import("@langchain/mcp-adapters");
    return {
      MultiServerMCPClient: adapters.MultiServerMCPClient,
    };
  } catch (error) {
    throw new Error(
      `Failed to load @langchain/mcp-adapters. Please install it: pnpm add @langchain/mcp-adapters\nOriginal error: ${String(
        error
      )}`
    );
  }
}

/**
 * Pure MCP middleware that loads tools from MCP servers
 * and exposes them directly to the agent.
 *
 * This middleware connects to MCP servers and makes their tools available
 * as direct tool calls. Use this when you want traditional tool calling
 * without code execution.
 *
 * @param options Configuration options
 * @returns A middleware instance
 *
 * @example
 * ```ts
 * import { mcpMiddleware } from "langchain/agents/middleware";
 *
 * const middleware = mcpMiddleware({
 *   mcpConfig: {
 *     mcpServers: {
 *       "google-drive": {
 *         transport: "stdio",
 *         command: "npx",
 *         args: ["-y", "@modelcontextprotocol/server-google-drive"],
 *       },
 *     },
 *   },
 * });
 *
 * const agent = createAgent({
 *   model: "openai:gpt-4o",
 *   middleware: [middleware],
 * });
 * ```
 */
export function mcpMiddleware(options: MCPMiddlewareConfig) {
  return createMiddleware({
    name: "MCPMiddleware",
    stateSchema,
    contextSchema,
    tools: [
      tool(
        () => {
          /* no-op */
        },
        {
          name: "__noop__",
          description: "No-op tool",
          schema: z.object({}),
        }
      ),
    ],
    beforeAgent: async (state) => {
      const currentState = state as Partial<MCPMiddlewareState>;
      const config = interopParse(contextSchema, options);

      // Initialize state if needed
      if (currentState.adaptersLoaded) {
        return undefined;
      }

      try {
        const { MultiServerMCPClient } = await loadMCPAdapters();
        const client = new MultiServerMCPClient(config.mcpConfig);
        const clientId = generateClientId(config.mcpConfig);

        // Store client instance in Map for later cleanup
        mcpClientInstances.set(clientId, client);

        return {
          adaptersLoaded: true,
          clientId,
          mcpConfig: config.mcpConfig,
        };
      } catch (error) {
        console.error(
          "Failed to initialize MCP integration middleware:",
          error
        );
      }

      return {
        adaptersLoaded: false,
      };
    },
    wrapModelCall: async (request, handler) => {
      if (!request.state.adaptersLoaded || !request.state.clientId) {
        return handler(request);
      }

      /**
       * Get the client instance
       */
      const clientInstance = mcpClientInstances.get(request.state.clientId);
      if (!clientInstance) {
        return handler(request);
      }

      try {
        // Load tools from all servers
        const mcpTools = await clientInstance.getTools();

        // Add MCP tools to the request
        return handler({
          ...request,
          tools: [
            ...(request.tools || []).filter((t) => t.name !== "__noop__"),
            ...mcpTools,
          ],
        });
      } catch (error) {
        console.error("Failed to load MCP tools:", error);
        return handler(request);
      }
    },
    afterAgent: async (state) => {
      // Close MCP client connections if clientId is present
      if (state.clientId && mcpClientInstances.has(state.clientId)) {
        try {
          const clientInstance = mcpClientInstances.get(state.clientId);
          if (clientInstance && typeof clientInstance.close === "function") {
            await clientInstance.close();
          }
          // Remove from Map after closing
          mcpClientInstances.delete(state.clientId);
        } catch (error) {
          console.error("Error closing MCP client:", error);
          // Still remove from Map even if close failed
          mcpClientInstances.delete(state.clientId);
        }
      }

      return undefined;
    },
  });
}
