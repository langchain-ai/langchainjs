import { type StreamableHTTPConnection } from "./types.js";

export { MCPAdapter, MultiServerMCPClient } from "./client.js";

export type { OAuthClientProvider } from "@modelcontextprotocol/client";

export type {
  ClientConfig,
  MCPAdapterConfig,
  Connection,
  LoadMcpToolsOptions,
  OutputHandling,
  StdioConnection,
  StreamableHTTPConnection,
  MCPResource,
  MCPResourceTemplate,
  MCPResourceContent,
} from "./types.js";

/**
 * Type alias for backward compatibility with previous versions of the package.
 */
export type SSEConnection = StreamableHTTPConnection;

export { loadMcpTools, ToolException, isToolException } from "./tools.js";

export type {
  ToolHooks,
  ToolCallRequest,
  ToolCallModification,
  ToolResult,
} from "./hooks.js";

export type { Notifications, ConnectionErrorHandler } from "./types.js";
