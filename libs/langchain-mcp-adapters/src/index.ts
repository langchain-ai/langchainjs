export { MCPAdapter, MultiServerMCPClient } from "./client.js";

export { MCPClientError } from "./utils/errors.js";

export type {
  AuthProvider,
  OAuthClientProvider,
} from "@modelcontextprotocol/client";

export { UnauthorizedError } from "@modelcontextprotocol/client";

export type {
  ClientConfig,
  MCPAdapterConfig,
  ResolvedMCPAdapterConfig,
  ConnectionErrorHandler,
  Connection,
  ResolvedConnection,
  LoadMcpToolsOptions,
  ToolDiscoveryOptions,
  OutputHandling,
  StdioConnection,
  HTTPConnection,
  StreamableHTTPConnection,
  SSEConnection,
  MCPResource,
  MCPResourceTemplate,
  MCPResourceContent,
} from "./types.js";

export { HTTPConnectionSchema } from "./types.js";

export { loadMcpTools, ToolException } from "./tools.js";

export type { ToolHooks } from "./hooks.js";

export type {
  MCPElicitationHandler,
  MCPElicitationInterrupt,
  MCPElicitationResponses,
  MCPElicitationResume,
} from "./elicitation.js";

export { createMCPElicitationResume } from "./elicitation.js";
