export { MCPAdapter, MultiServerMCPClient } from "./client.js";

export { MCPClientError } from "./utils/errors.js";

export type { OAuthClientProvider } from "@modelcontextprotocol/client";

export type {
  ClientConfig,
  MCPAdapterConfig,
  ResolvedMCPAdapterConfig,
  Connection,
  LoadMcpToolsOptions,
  OutputHandling,
  StdioConnection,
  StreamableHTTPConnection,
  ResolvedStreamableHTTPConnection,
  SSEConnection,
  ResolvedSSEConnection,
  MCPResource,
  MCPResourceTemplate,
  MCPResourceContent,
} from "./types.js";

export { loadMcpTools, ToolException, isToolException } from "./tools.js";

export type {
  ToolHooks,
  ToolCallRequest,
  ToolCallModification,
  ToolResult,
} from "./hooks.js";

export type { Notifications, ConnectionErrorHandler } from "./types.js";
