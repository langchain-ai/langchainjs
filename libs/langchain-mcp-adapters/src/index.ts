export { MCPAdapter, MultiServerMCPClient } from "./client.js";

export { MCPClientError } from "./utils/errors.js";

export type { OAuthClientProvider } from "@modelcontextprotocol/client";

export { ToolDiscoveryParams, isDescriptorConnection } from "./types.js";

export type {
  ClientConnection,
  Connection,
  ConnectionErrorHandler,
  ConnectionInit,
  CustomHTTPTransportParams,
  DescriptorConnection,
  InProcessConnection,
  LoadMcpToolsParams,
  MCPAdapterConfig,
  MCPAdapterConfigInit,
  MCPAdapterInit,
  MCPAdapterParams,
  MCPServerLike,
  NotificationCallbacks,
  SSEConnection,
  SSEConnectionInit,
  StdioConnection,
  StdioConnectionInit,
  ToolDiscoveryOptions,
  _MCPAliases,
} from "./types.js";

export { loadMcpTools, ToolException, isToolException } from "./tools.js";

export type {
  ToolHooks,
  ToolCallRequest,
  ToolCallModification,
  ToolResult,
} from "./hooks.js";

export type {
  MCPElicitationRequest,
  MCPElicitationAnswer,
  MCPElicitationContext,
  MCPElicitationHandler,
} from "./elicitation.js";

export { createMCPElicitationResume } from "./elicitation.js";

export type {
  MCPElicitationInterrupt,
  MCPElicitationResponses,
  MCPElicitationResume,
} from "./elicitation.js";
