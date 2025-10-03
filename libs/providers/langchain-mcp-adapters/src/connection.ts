import {
  SSEClientTransport,
  SSEClientTransportOptions,
} from "@modelcontextprotocol/sdk/client/sse.js";

import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import type {
  StreamableHTTPClientTransportOptions,
  StreamableHTTPReconnectionOptions,
} from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

import { getDebugLog } from "./logging.js";
import type {
  ResolvedStreamableHTTPConnection,
  ResolvedStdioConnection,
} from "./types.js";

const debugLog = getDebugLog("connection");

export interface TransportOptions {
  serverName: string;
  headers?: Record<string, string>;
  authProvider?: OAuthClientProvider;
}

type ClientKeyObject = Omit<TransportOptions, "headers"> & {
  headers?: string;
};

interface Connection {
  transport:
    | StreamableHTTPClientTransport
    | SSEClientTransport
    | StdioClientTransport;
  client: Client;
  closeCallback: () => Promise<void>;
}

const transportTypes = ["streamable-http", "sse", "stdio"] as const;

/**
 * Manages a pool of MCP clients with different transport, server name and connection configurations.
 * This ensures we don't create multiple connections for the same server with the same configuration.
 */
export class ConnectionManager {
  #connections: Map<ClientKeyObject, Connection> = new Map();

  async createClient(
    type: "stdio",
    serverName: string,
    options: ResolvedStdioConnection
  ): Promise<Client>;
  async createClient(
    type: "streamable-http",
    serverName: string,
    options: ResolvedStreamableHTTPConnection
  ): Promise<Client>;
  async createClient(
    type: "sse",
    serverName: string,
    options: ResolvedStreamableHTTPConnection
  ): Promise<Client>;
  async createClient(
    ...args:
      | ["stdio", string, ResolvedStdioConnection]
      | ["sse", string, ResolvedStreamableHTTPConnection]
      | ["streamable-http", string, ResolvedStreamableHTTPConnection]
  ): Promise<Client> {
    const [type, serverName, options] = args;
    if (!transportTypes.includes(type)) {
      throw new Error(`Invalid transport type: ${type}`);
    }

    const transport =
      type === "streamable-http"
        ? await this.#createStreamableHTTPTransport(serverName, options)
        : type === "sse"
        ? await this.#createSSETransport(serverName, options)
        : await this.#createStdioTransport(options);
    const client = new Client({
      name: "langchain-mcp-adapter",
      version: "0.1.0",
    });
    await client.connect(transport);

    const key: ClientKeyObject =
      type === "stdio"
        ? { serverName }
        : {
            serverName,
            headers: serializeHeaders(options.headers),
            authProvider: options.authProvider,
          };

    this.#connections.set(key, {
      transport,
      client,
      closeCallback: async () => client.close(),
    });
    return client;
  }

  /**
   * Get the transport based on server name and connection configuration.
   * @param options - The options for the transport
   * @returns The transport
   */
  get(serverName: string): Client | undefined;
  get(options: TransportOptions): Client | undefined;
  get(options: TransportOptions | string): Client | undefined {
    if (typeof options === "string") {
      return this.#queryConnection({ serverName: options })?.connection.client;
    }

    return this.#queryConnection(options)?.connection.client;
  }

  /**
   * Find the connection based on the parameter provided. This approach makes sure
   * that `this.get({ serverName })` and `this.get({ serverName, headers: undefined, authProvider: undefined })`
   * will return the same connection.
   *
   * @param options - The options for the transport
   * @returns The connection and the key
   */
  #queryConnection(
    options: TransportOptions
  ): { key: ClientKeyObject; connection: Connection } | undefined {
    const headers = serializeHeaders(options.headers);
    const [key, connection] =
      [...this.#connections.entries()].find(([key]) => {
        if (options.headers && options.authProvider) {
          return (
            key.serverName === options.serverName &&
            key.headers === headers &&
            key.authProvider === options.authProvider
          );
        }
        if (options.headers && !options.authProvider) {
          return (
            key.serverName === options.serverName && key.headers === headers
          );
        }
        if (options.authProvider && !options.headers) {
          return (
            key.serverName === options.serverName &&
            key.authProvider === options.authProvider
          );
        }
        return key.serverName === options.serverName;
      }) ?? [];

    if (key && connection) {
      return { key, connection };
    }

    return undefined;
  }

  /**
   * Check if a client exists based on server name and connection configuration.
   * @param options - The options for the transport
   * @returns True if the client exists, false otherwise
   */
  has(serverName: string): boolean;
  has(options: TransportOptions): boolean;
  has(options: TransportOptions | string): boolean {
    return Boolean(
      typeof options === "string" ? this.get(options) : this.get(options)
    );
  }

  /**
   * Delete the transport based on server name and connection configuration.
   * @param options - The options for the transport, if not provided, all transports are deleted
   */
  async delete(options?: TransportOptions) {
    if (!options) {
      await Promise.all(
        Array.from(this.#connections.values()).map((connection) =>
          connection.closeCallback()
        )
      );
      this.#connections.clear();
      return;
    }

    const result = this.#queryConnection(options);
    if (result) {
      await result.connection.closeCallback();
      this.#connections.delete(result.key);
    }
  }

  getTransport(
    options: TransportOptions
  ):
    | StreamableHTTPClientTransport
    | SSEClientTransport
    | StdioClientTransport
    | undefined {
    const result = this.#queryConnection(options);
    if (result) {
      return result.connection.transport;
    }
    return undefined;
  }

  async #createStreamableHTTPTransport(
    serverName: string,
    args: ResolvedStreamableHTTPConnection
  ): Promise<StreamableHTTPClientTransport> {
    const { url, headers, reconnect, authProvider } = args;

    const options: StreamableHTTPClientTransportOptions = {
      ...(authProvider ? { authProvider } : {}),
      ...(headers ? { requestInit: { headers } } : {}),
    };

    if (reconnect != null) {
      const reconnectionOptions: StreamableHTTPReconnectionOptions = {
        initialReconnectionDelay: reconnect?.delayMs ?? 1000, // MCP default
        maxReconnectionDelay: reconnect?.delayMs ?? 30000, // MCP default
        maxRetries: reconnect?.maxAttempts ?? 2, // MCP default
        reconnectionDelayGrowFactor: 1.5, // MCP default
      };

      if (reconnect.enabled === false) {
        reconnectionOptions.maxRetries = 0;
      }

      options.reconnectionOptions = reconnectionOptions;
    }

    if (options.requestInit?.headers) {
      debugLog(
        `DEBUG: Using custom headers for SSE transport to server "${serverName}"`
      );
    }

    if (options.authProvider) {
      debugLog(
        `DEBUG: Using OAuth authentication for Streamable HTTP transport to server "${serverName}"`
      );
    }

    if (options.reconnectionOptions) {
      if (options.reconnectionOptions.maxRetries === 0) {
        debugLog(
          `DEBUG: Disabling reconnection for Streamable HTTP transport to server "${serverName}"`
        );
      } else {
        debugLog(
          `DEBUG: Using custom reconnection options for Streamable HTTP transport to server "${serverName}"`
        );
      }
    }

    // Only pass options if there are any, otherwise use default constructor
    return Object.keys(options).length > 0
      ? new StreamableHTTPClientTransport(new URL(url), options)
      : new StreamableHTTPClientTransport(new URL(url));
  }

  /**
   * Create an SSE transport with appropriate EventSource implementation
   *
   * @param serverName - The name of the server
   * @param url - The URL of the server
   * @param headers - The headers to send with the request
   * @param authProvider - The OAuth client provider to use for authentication
   * @returns The SSE transport
   */
  async #createSSETransport(
    serverName: string,
    args: ResolvedStreamableHTTPConnection
  ): Promise<SSEClientTransport> {
    const { url, headers, authProvider } = args;
    const options: SSEClientTransportOptions = {};

    if (authProvider) {
      options.authProvider = authProvider;
      debugLog(
        `DEBUG: Using OAuth authentication for SSE transport to server "${serverName}"`
      );
    }

    if (headers) {
      // For SSE, we need to pass headers via eventSourceInit.fetch for the initial connection
      // and also via requestInit.headers for subsequent POST requests
      options.eventSourceInit = {
        fetch: async (url, init) => {
          const requestHeaders = new Headers(init?.headers);

          // Add OAuth token if authProvider is available
          // This is necessary because setting eventSourceInit.fetch prevents automatic Authorization header
          if (authProvider) {
            const tokens = await authProvider.tokens();
            if (tokens) {
              requestHeaders.set(
                "Authorization",
                `Bearer ${tokens.access_token}`
              );
            }
          }

          // Add our custom headers
          Object.entries(headers).forEach(([key, value]) => {
            requestHeaders.set(key, value);
          });
          // Always include Accept header for SSE
          requestHeaders.set("Accept", "text/event-stream");

          return fetch(url, {
            ...init,
            headers: requestHeaders,
          });
        },
      };

      // Also include headers for POST requests
      options.requestInit = { headers };

      debugLog(
        `DEBUG: Using custom headers for SSE transport to server "${serverName}"`
      );
    }

    return new SSEClientTransport(new URL(url), options);
  }

  #createStdioTransport(
    options: ResolvedStdioConnection
  ): StdioClientTransport {
    const { command, args, env, stderr } = options;
    return new StdioClientTransport({
      command,
      args,
      stderr,
      // eslint-disable-next-line no-process-env
      ...(env ? { env: { PATH: process.env.PATH!, ...env } } : {}),
    });
  }
}

/**
 * A utility function that serializes the headers object to a string
 * and orders the keys alphabetically so that the same headers object
 * will always produce the same string.
 * @param headers - The headers object to serialize
 * @returns The serialized headers object
 */
function serializeHeaders(
  headers?: Record<string, string>
): string | undefined {
  if (!headers) {
    return;
  }
  return Object.entries(headers)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n");
}
