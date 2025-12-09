import Anthropic from "@anthropic-ai/sdk";
import { type ServerTool } from "@langchain/core/tools";

/**
 * Configuration for a single tool in the MCP toolset.
 */
export interface MCPToolConfig {
  /**
   * Whether this tool is enabled.
   * @default true
   */
  enabled?: boolean;
  /**
   * If true, tool description is not sent to the model initially.
   * Used with Tool Search Tool for on-demand loading.
   * @default false
   */
  deferLoading?: boolean;
}

/**
 * Per-tool configuration overrides.
 * Keys are tool names, values are configuration objects.
 */
export type MCPToolConfigs = Record<string, MCPToolConfig>;

/**
 * Options for creating an MCP toolset.
 */
export interface MCPToolsetOptions {
  /**
   * Must match a server name defined in the `mcp_servers` array in call options.
   */
  serverName: string;
  /**
   * Default configuration applied to all tools in this toolset.
   * Individual tool configs will override these defaults.
   */
  defaultConfig?: MCPToolConfig;
  /**
   * Per-tool configuration overrides.
   * Keys are tool names, values are configuration objects.
   */
  configs?: MCPToolConfigs;
  /**
   * Create a cache control breakpoint at this content block.
   */
  cacheControl?: Anthropic.Beta.BetaCacheControlEphemeral;
}

/**
 * Creates an MCP toolset that connects to a remote MCP server to access its tools.
 * This enables Claude to use tools from MCP servers without implementing a separate MCP client.
 *
 * @note This tool requires the beta header `mcp-client-2025-11-20` in API requests.
 * The header is automatically added when using this tool.
 *
 * @see {@link https://docs.anthropic.com/en/docs/agents-and-tools/mcp-connector | Anthropic MCP Connector Documentation}
 * @param options - Configuration options for the MCP toolset
 * @returns An MCP toolset definition to be passed to the Anthropic API tools array
 *
 * @example
 * ```typescript
 * import { ChatAnthropic, tools } from "@langchain/anthropic";
 *
 * const model = new ChatAnthropic({
 *   model: "claude-sonnet-4-5-20250929",
 * });
 *
 * // Basic usage - enable all tools from an MCP server
 * const response = await model.invoke("What tools do you have available?", {
 *   mcp_servers: [{
 *     type: "url",
 *     url: "https://example-server.modelcontextprotocol.io/sse",
 *     name: "example-mcp",
 *     authorization_token: "YOUR_TOKEN",
 *   }],
 *   tools: [
 *     tools.mcpToolset_20251120({ serverName: "example-mcp" }),
 *   ],
 * });
 *
 * // Allowlist pattern - enable only specific tools
 * const responseAllowlist = await model.invoke("Search for events", {
 *   mcp_servers: [{
 *     type: "url",
 *     url: "https://calendar.example.com/sse",
 *     name: "google-calendar-mcp",
 *     authorization_token: "YOUR_TOKEN",
 *   }],
 *   tools: [
 *     tools.mcpToolset_20251120({
 *       serverName: "google-calendar-mcp",
 *       defaultConfig: { enabled: false },
 *       configs: {
 *         search_events: { enabled: true },
 *         create_event: { enabled: true },
 *       },
 *     }),
 *   ],
 * });
 *
 * // Denylist pattern - disable specific tools
 * const responseDenylist = await model.invoke("List my events", {
 *   mcp_servers: [{
 *     type: "url",
 *     url: "https://calendar.example.com/sse",
 *     name: "google-calendar-mcp",
 *     authorization_token: "YOUR_TOKEN",
 *   }],
 *   tools: [
 *     tools.mcpToolset_20251120({
 *       serverName: "google-calendar-mcp",
 *       configs: {
 *         delete_all_events: { enabled: false },
 *         share_calendar_publicly: { enabled: false },
 *       },
 *     }),
 *   ],
 * });
 *
 * // With deferred loading for use with Tool Search Tool
 * const responseDeferred = await model.invoke("Search for tools", {
 *   mcp_servers: [{
 *     type: "url",
 *     url: "https://example.com/sse",
 *     name: "example-mcp",
 *   }],
 *   tools: [
 *     tools.toolSearchRegex_20251119(),
 *     tools.mcpToolset_20251120({
 *       serverName: "example-mcp",
 *       defaultConfig: { deferLoading: true },
 *     }),
 *   ],
 * });
 * ```
 */
export function mcpToolset_20251120(options: MCPToolsetOptions): ServerTool {
  const defaultConfig =
    options.defaultConfig?.enabled !== undefined ||
    options.defaultConfig?.deferLoading !== undefined
      ? {
          enabled: options.defaultConfig?.enabled,
          defer_loading: options.defaultConfig?.deferLoading,
        }
      : undefined;

  const configs = options.configs
    ? Object.fromEntries(
        Object.entries(options.configs).map(([toolName, config]) => [
          toolName,
          {
            enabled: config.enabled,
            defer_loading: config.deferLoading,
          },
        ])
      )
    : undefined;

  return {
    type: "mcp_toolset",
    mcp_server_name: options.serverName,
    default_config: defaultConfig,
    configs,
    cache_control: options.cacheControl,
  } satisfies Anthropic.Beta.BetaMCPToolset;
}
