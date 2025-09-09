import { type StreamableHTTPConnection } from "./types.js";

export { MultiServerMCPClient } from "./client.js";

export type {
  ClientConfig,
  Connection,
  LoadMcpToolsOptions,
  OutputHandling,
  StdioConnection,
  StreamableHTTPConnection,
} from "./types.js";

/**
 * Type alias for backward compatibility with previous versions of the package.
 */
export type SSEConnection = StreamableHTTPConnection;

export { loadMcpTools } from "./tools.js";
