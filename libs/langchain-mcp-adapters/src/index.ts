export { MCPAdapter, MultiServerMCPClient } from "./client.js";

export { MCPClientError } from "./utils/errors.js";

export type {
  AuthProvider,
  OAuthClientProvider,
} from "@modelcontextprotocol/client";

export type {
  ClientConfig,
  MCPAdapterConfig,
  ResolvedMCPAdapterConfig,
  Connection,
  ResolvedConnection,
  LoadMcpToolsOptions,
  ToolDiscoveryOptions,
  OutputHandling,
  StdioConnection,
  ResolvedStdioConnection,
  HTTPConnection,
  ResolvedHTTPConnection,
  StreamableHTTPConnection,
  ResolvedStreamableHTTPConnection,
  SSEConnection,
  ResolvedSSEConnection,
  MCPResource,
  MCPResourceTemplate,
  MCPResourceContent,
} from "./types.js";

export {
  StdioConnectionSchema,
  HTTPConnectionSchema,
  ConnectionSchema,
} from "./types.js";

export { loadMcpTools, ToolException, isToolException } from "./tools.js";

export type {
  ToolHooks,
  ToolCallRequest,
  ToolCallModification,
  ToolResult,
} from "./hooks.js";

export type { Notifications, ConnectionErrorHandler } from "./types.js";

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
