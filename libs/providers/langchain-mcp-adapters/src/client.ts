import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import {
  SSEClientTransport,
  type SseError,
} from "@modelcontextprotocol/sdk/client/sse.js";
import {
  StreamableHTTPClientTransport,
  type StreamableHTTPError,
} from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import type { DynamicStructuredTool } from "@langchain/core/tools";

import { z } from "zod/v3";
import { loadMcpTools } from "./tools.js";
import { ConnectionManager } from "./connection.js";
import { getDebugLog } from "./logging.js";
import {
  type ClientConfig,
  type Connection,
  type ResolvedClientConfig,
  type ResolvedConnection,
  type ResolvedStdioConnection,
  type ResolvedStreamableHTTPConnection,
  type CustomHTTPTransportOptions,
  clientConfigSchema,
  connectionSchema,
  type LoadMcpToolsOptions,
  _resolveAndApplyOverrideHandlingOverrides,
} from "./types.js";

const debugLog = getDebugLog();

/**
 * Error class for MCP client operations
 */
export class MCPClientError extends Error {
  constructor(message: string, public readonly serverName?: string) {
    super(message);
    this.name = "MCPClientError";
  }
}

/**
 * Checks if the connection configuration is for a stdio transport
 * @param connection - The connection configuration
 * @returns True if the connection configuration is for a stdio transport
 */
function isResolvedStdioConnection(
  connection: unknown
): connection is ResolvedStdioConnection {
  if (
    typeof connection !== "object" ||
    connection === null ||
    Array.isArray(connection)
  ) {
    return false;
  }

  if ("transport" in connection && connection.transport === "stdio") {
    return true;
  }

  if ("type" in connection && connection.type === "stdio") {
    return true;
  }

  if ("command" in connection && typeof connection.command === "string") {
    return true;
  }

  return false;
}

/**
 * Checks if the connection configuration is for a streamable HTTP transport
 * @param connection - The connection configuration
 * @returns True if the connection configuration is for a streamable HTTP transport
 */
function isResolvedStreamableHTTPConnection(
  connection: unknown
): connection is ResolvedStreamableHTTPConnection {
  if (
    typeof connection !== "object" ||
    connection === null ||
    Array.isArray(connection)
  ) {
    return false;
  }

  if (
    ("transport" in connection &&
      typeof connection.transport === "string" &&
      ["http", "sse"].includes(connection.transport)) ||
    ("type" in connection &&
      typeof connection.type === "string" &&
      ["http", "sse"].includes(connection.type))
  ) {
    return true;
  }

  if ("url" in connection && typeof connection.url === "string") {
    try {
      new URL(connection.url);
      return true;
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Client for connecting to multiple MCP servers and loading LangChain-compatible tools.
 */
export class MultiServerMCPClient {
  private _serverNameToTools: Record<string, DynamicStructuredTool[]> = {};

  private _connections?: Record<string, ResolvedConnection>;

  private _loadToolsOptions: Record<string, LoadMcpToolsOptions> = {};

  #clientConnections = new ConnectionManager();

  private _config: ResolvedClientConfig;

  /**
   * Returns clone of server config for inspection purposes.
   *
   * Client does not support config modifications.
   */
  get config(): ClientConfig {
    // clone config so it can't be mutated
    return JSON.parse(JSON.stringify(this._config));
  }

  /**
   * Create a new MultiServerMCPClient.
   *
   * @param config - Configuration object
   */
  constructor(config: ClientConfig | Record<string, Connection>) {
    let parsedServerConfig: ResolvedClientConfig;

    const configSchema = clientConfigSchema;

    if ("mcpServers" in config) {
      parsedServerConfig = configSchema.parse(config);
    } else {
      // two step parse so parse errors are referencing the correct object paths
      const parsedMcpServers = z.record(connectionSchema).parse(config);

      parsedServerConfig = configSchema.parse({ mcpServers: parsedMcpServers });
    }

    if (Object.keys(parsedServerConfig.mcpServers).length === 0) {
      throw new MCPClientError("No MCP servers provided");
    }

    for (const [serverName, serverConfig] of Object.entries(
      parsedServerConfig.mcpServers
    )) {
      const outputHandling = _resolveAndApplyOverrideHandlingOverrides(
        parsedServerConfig.outputHandling,
        serverConfig.outputHandling
      );
      const defaultToolTimeout =
        parsedServerConfig.defaultToolTimeout ??
        serverConfig.defaultToolTimeout;

      this._loadToolsOptions[serverName] = {
        throwOnLoadError: parsedServerConfig.throwOnLoadError,
        prefixToolNameWithServerName:
          parsedServerConfig.prefixToolNameWithServerName,
        additionalToolNamePrefix: parsedServerConfig.additionalToolNamePrefix,
        useStandardContentBlocks: parsedServerConfig.useStandardContentBlocks,
        ...(Object.keys(outputHandling).length > 0 ? { outputHandling } : {}),
        ...(defaultToolTimeout ? { defaultToolTimeout } : {}),
      };
    }

    this._config = parsedServerConfig;
    this._connections = parsedServerConfig.mcpServers;
  }

  /**
   * Proactively initialize connections to all servers. This will be called automatically when
   * methods requiring an active connection (like {@link getTools} or {@link getClient}) are called,
   * but you can call it directly to ensure all connections are established before using the tools.
   *
   * @returns A map of server names to arrays of tools
   * @throws {MCPClientError} If initialization fails
   */
  async initializeConnections(
    customTransportOptions?: CustomHTTPTransportOptions
  ): Promise<Record<string, DynamicStructuredTool[]>> {
    if (!this._connections || Object.keys(this._connections).length === 0) {
      throw new MCPClientError("No connections to initialize");
    }

    for (const [serverName, connection] of Object.entries(this._connections)) {
      if (isResolvedStdioConnection(connection)) {
        debugLog(
          `INFO: Initializing stdio connection to server "${serverName}"...`
        );

        /**
         * check if we already initialized this stdio connection
         */
        if (this.#clientConnections.has(serverName)) {
          continue;
        }

        await this._initializeStdioConnection(serverName, connection);
      } else if (isResolvedStreamableHTTPConnection(connection)) {
        /**
         * Users may want to use different connection options for tool calls or tool discovery.
         */
        const { authProvider, headers } = customTransportOptions ?? {};
        const updatedConnection = {
          ...connection,
          authProvider: authProvider ?? connection.authProvider,
          headers: { ...headers, ...connection.headers },
        };

        /**
         * check if we already initialized this streamable HTTP connection
         */
        const key = {
          serverName,
          headers: updatedConnection.headers,
          authProvider: updatedConnection.authProvider,
        };
        if (this.#clientConnections.has(key)) {
          continue;
        }

        if (connection.type === "sse" || connection.transport === "sse") {
          await this._initializeSSEConnection(serverName, updatedConnection);
        } else {
          await this._initializeStreamableHTTPConnection(
            serverName,
            updatedConnection
          );
        }
      } else {
        // This should never happen due to the validation in the constructor
        throw new MCPClientError(
          `Unsupported transport type for server "${serverName}"`,
          serverName
        );
      }
    }

    return this._serverNameToTools;
  }

  /**
   * Get tools from specified servers as a flattened array.
   *
   * @param servers - Optional array of server names to filter tools by.
   *                 If not provided, returns tools from all servers.
   * @param options - Optional connection options for the tool calls, e.g. custom auth provider or headers.
   * @returns A flattened array of tools from the specified servers (or all servers)
   *
   * @example
   * ```ts
   * // Get tools from all servers
   * const tools = await client.getTools();
   * ```
   *
   * @example
   * ```ts
   * // Get tools from specific servers
   * const tools = await client.getTools("server1", "server2");
   * ```
   *
   * @example
   * ```ts
   * // Get tools from specific servers with custom connection options
   * const tools = await client.getTools(["server1", "server2"], {
   *   authProvider: new OAuthClientProvider(),
   *   headers: { "X-Custom-Header": "value" },
   * });
   * ```
   */
  async getTools(...servers: string[]): Promise<DynamicStructuredTool[]>;
  async getTools(
    servers: string[],
    options?: CustomHTTPTransportOptions
  ): Promise<DynamicStructuredTool[]>;
  async getTools(...args: unknown[]): Promise<DynamicStructuredTool[]> {
    if (args.length === 0 || args.every((arg) => typeof arg === "string")) {
      await this.initializeConnections();

      const servers = args as string[];
      return servers.length === 0
        ? this._getAllToolsAsFlatArray()
        : this._getToolsFromServers(servers);
    }

    const [servers, options] = args as [
      string[],
      CustomHTTPTransportOptions | undefined
    ];
    await this.initializeConnections(options);
    return servers.length === 0
      ? this._getAllToolsAsFlatArray()
      : this._getToolsFromServers(servers);
  }

  /**
   * Get a the MCP client for a specific server. Useful for fetching prompts or resources from that server.
   *
   * @param serverName - The name of the server
   * @returns The client for the server, or undefined if the server is not connected
   */
  async getClient(
    serverName: string,
    options?: CustomHTTPTransportOptions
  ): Promise<Client | undefined> {
    await this.initializeConnections(options);
    return this.#clientConnections.get({
      serverName,
      headers: options?.headers,
      authProvider: options?.authProvider,
    });
  }

  /**
   * Close all connections.
   */
  async close(): Promise<void> {
    debugLog(`INFO: Closing all MCP connections...`);
    this._serverNameToTools = {};
    await this.#clientConnections.delete();
    debugLog(`INFO: All MCP connections closed`);
  }

  /**
   * Initialize a stdio connection
   */
  private async _initializeStdioConnection(
    serverName: string,
    connection: ResolvedStdioConnection
  ): Promise<void> {
    const { command, args, restart } = connection;

    debugLog(
      `DEBUG: Creating stdio transport for server "${serverName}" with command: ${command} ${args.join(
        " "
      )}`
    );

    try {
      const client = await this.#clientConnections.createClient(
        "stdio",
        serverName,
        connection
      );
      const transport = this.#clientConnections.getTransport({
        serverName,
      }) as StdioClientTransport;

      // Set up auto-restart if configured
      if (restart?.enabled) {
        this._setupStdioRestart(serverName, transport, connection, restart);
      }

      // Load tools for this server
      await this._loadToolsForServer(serverName, client);
    } catch (error) {
      throw new MCPClientError(
        `Failed to connect to stdio server "${serverName}": ${error}`,
        serverName
      );
    }
  }

  /**
   * Set up stdio restart handling
   */
  private _setupStdioRestart(
    serverName: string,
    transport: StdioClientTransport,
    connection: ResolvedStdioConnection,
    restart: NonNullable<ResolvedStdioConnection["restart"]>
  ): void {
    const originalOnClose = transport.onclose;
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    transport.onclose = async () => {
      if (originalOnClose) {
        await originalOnClose();
      }

      // Only attempt restart if we haven't cleaned up
      if (this.#clientConnections.get(serverName)) {
        debugLog(
          `INFO: Process for server "${serverName}" exited, attempting to restart...`
        );
        await this._attemptReconnect(
          serverName,
          connection,
          restart.maxAttempts,
          restart.delayMs
        );
      }
    };
  }

  private _getHttpErrorCode(error: unknown): number | undefined {
    const streamableError = error as StreamableHTTPError | SseError;
    let { code } = streamableError;
    // try parsing from error message if code is not set
    if (code == null) {
      const m = streamableError.message.match(/\(HTTP (\d\d\d)\)/);
      if (m && m.length > 1) {
        code = parseInt(m[1], 10);
      }
    }
    return code;
  }

  private _createAuthenticationErrorMessage(
    serverName: string,
    url: string,
    transport: "HTTP" | "SSE",
    originalError: string
  ): string {
    return (
      `Authentication failed for ${transport} server "${serverName}" at ${url}. ` +
      `Please check your credentials, authorization headers, or OAuth configuration. ` +
      `Original error: ${originalError}`
    );
  }

  private _toSSEConnectionURL(url: string): string {
    const urlObj = new URL(url);
    const pathnameParts = urlObj.pathname.split("/");
    const lastPart = pathnameParts.at(-1);
    if (lastPart && lastPart === "mcp") {
      pathnameParts[pathnameParts.length - 1] = "sse";
    }
    urlObj.pathname = pathnameParts.join("/");
    return urlObj.toString();
  }

  /**
   * Initialize a streamable HTTP connection
   */
  private async _initializeStreamableHTTPConnection(
    serverName: string,
    connection: ResolvedStreamableHTTPConnection
  ): Promise<void> {
    const { url, type: typeField, transport: transportField } = connection;
    const automaticSSEFallback = connection.automaticSSEFallback ?? true;
    const transportType = typeField || transportField;

    debugLog(
      `DEBUG: Creating Streamable HTTP transport for server "${serverName}" with URL: ${url}`
    );

    if (transportType === "http" || transportType == null) {
      try {
        const client = await this.#clientConnections.createClient(
          "streamable-http",
          serverName,
          connection
        );

        await this._loadToolsForServer(serverName, client);
      } catch (error) {
        const code = this._getHttpErrorCode(error);
        if (automaticSSEFallback && code != null && code >= 400 && code < 500) {
          // Streamable HTTP error is a 4xx, so fall back to SSE
          try {
            await this._initializeSSEConnection(serverName, connection);
          } catch (firstSSEError) {
            // try one more time, but modify the URL to end with `/sse`
            const sseUrl = this._toSSEConnectionURL(url);

            if (sseUrl !== url) {
              try {
                await this._initializeSSEConnection(serverName, {
                  ...connection,
                  url: sseUrl,
                });
              } catch (secondSSEError) {
                // Provide specific error message for authentication failures
                if (code === 401) {
                  throw new MCPClientError(
                    this._createAuthenticationErrorMessage(
                      serverName,
                      url,
                      "HTTP",
                      `${error}. Also tried SSE fallback at ${url} and ${sseUrl}, but both failed with authentication errors.`
                    ),
                    serverName
                  );
                }
                throw new MCPClientError(
                  `Failed to connect to streamable HTTP server "${serverName}, url: ${url}": ${error}. Additionally, tried falling back to SSE at ${url} and ${sseUrl}, but this also failed: ${secondSSEError}`,
                  serverName
                );
              }
            } else {
              // Provide specific error message for authentication failures
              if (code === 401) {
                throw new MCPClientError(
                  this._createAuthenticationErrorMessage(
                    serverName,
                    url,
                    "HTTP",
                    `${error}. Also tried SSE fallback at ${url}, but it failed with authentication error: ${firstSSEError}`
                  ),
                  serverName
                );
              }
              throw new MCPClientError(
                `Failed to connect to streamable HTTP server after trying to fall back to SSE: "${serverName}, url: ${url}": ${error} (SSE fallback failed with error ${firstSSEError})`,
                serverName
              );
            }
          }
        } else {
          // Provide specific error message for authentication failures
          if (code === 401) {
            throw new MCPClientError(
              this._createAuthenticationErrorMessage(
                serverName,
                url,
                "HTTP",
                `${error}`
              ),
              serverName
            );
          }
          throw new MCPClientError(
            `Failed to connect to streamable HTTP server "${serverName}, url: ${url}": ${error}`,
            serverName
          );
        }
      }
    }
  }

  /**
   * Initialize an SSE connection
   *
   * Don't call this directly unless SSE transport is explicitly requested. Otherwise,
   * use _initializeStreamableHTTPConnection and it'll fall back to SSE if needed for
   * backwards compatibility.
   *
   * @param serverName - The name of the server
   * @param connection - The connection configuration
   */
  private async _initializeSSEConnection(
    serverName: string,
    connection: ResolvedStreamableHTTPConnection // used for both SSE and streamable HTTP
  ): Promise<void> {
    const { url, headers, reconnect, authProvider } = connection;

    try {
      const client = await this.#clientConnections.createClient(
        "sse",
        serverName,
        connection
      );
      const transport = this.#clientConnections.getTransport({
        serverName,
        headers,
        authProvider,
      }) as SSEClientTransport;

      // Set up auto-reconnect if configured
      if (reconnect?.enabled) {
        this._setupSSEReconnect(serverName, transport, connection, reconnect);
      }

      // Load tools for this server
      await this._loadToolsForServer(serverName, client);
    } catch (error) {
      // Check if this is already a wrapped error that should be re-thrown
      if (error && (error as Error).name === "MCPClientError") {
        throw error;
      }

      // Check if this is an authentication error that needs better messaging
      const isAuthError = error && this._getHttpErrorCode(error) === 401;

      if (isAuthError) {
        throw new MCPClientError(
          this._createAuthenticationErrorMessage(
            serverName,
            url,
            "SSE",
            `${error}`
          ),
          serverName
        );
      }

      throw new MCPClientError(
        `Failed to create SSE transport for server "${serverName}, url: ${url}": ${error}`,
        serverName
      );
    }
  }

  /**
   * Set up reconnect handling for SSE (Streamable HTTP reconnects are more complex and are handled internally by the SDK)
   */
  private _setupSSEReconnect(
    serverName: string,
    transport: SSEClientTransport | StreamableHTTPClientTransport,
    connection: ResolvedStreamableHTTPConnection,
    reconnect: NonNullable<ResolvedStreamableHTTPConnection["reconnect"]>
  ): void {
    const originalOnClose = transport.onclose;
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    transport.onclose = async () => {
      if (originalOnClose) {
        await originalOnClose();
      }

      // Only attempt reconnect if we haven't cleaned up
      if (
        this.#clientConnections.get({
          serverName,
          headers: connection.headers,
          authProvider: connection.authProvider,
        })
      ) {
        debugLog(
          `INFO: HTTP connection for server "${serverName}" closed, attempting to reconnect...`
        );
        await this._attemptReconnect(
          serverName,
          connection,
          reconnect.maxAttempts,
          reconnect.delayMs
        );
      }
    };
  }

  /**
   * Load tools for a specific server
   */
  private async _loadToolsForServer(
    serverName: string,
    client: Client
  ): Promise<void> {
    try {
      debugLog(`DEBUG: Loading tools for server "${serverName}"...`);
      const tools = await loadMcpTools(
        serverName,
        client,
        this._loadToolsOptions[serverName]
      );
      this._serverNameToTools[serverName] = tools;
      debugLog(
        `INFO: Successfully loaded ${tools.length} tools from server "${serverName}"`
      );
    } catch (error) {
      throw new MCPClientError(
        `Failed to load tools from server "${serverName}": ${error}`
      );
    }
  }

  /**
   * Attempt to reconnect to a server after a connection failure.
   *
   * @param serverName - The name of the server to reconnect to
   * @param connection - The connection configuration
   * @param maxAttempts - Maximum number of reconnection attempts
   * @param delayMs - Delay in milliseconds between reconnection attempts
   * @private
   */
  private async _attemptReconnect(
    serverName: string,
    connection: ResolvedConnection,
    maxAttempts = 3,
    delayMs = 1000
  ): Promise<void> {
    let connected = false;
    let attempts = 0;

    // Clean up previous connection resources
    if ("headers" in connection || "authProvider" in connection) {
      const { headers, authProvider } = connection;
      await this.#cleanupServerResources({ serverName, authProvider, headers });
    } else {
      await this.#cleanupServerResources({ serverName });
    }

    while (
      !connected &&
      (maxAttempts === undefined || attempts < maxAttempts)
    ) {
      attempts += 1;
      debugLog(
        `INFO: Reconnection attempt ${attempts}${
          maxAttempts ? `/${maxAttempts}` : ""
        } for server "${serverName}"`
      );

      try {
        // Wait before attempting to reconnect
        if (delayMs) {
          await new Promise((resolve) => {
            setTimeout(resolve, delayMs);
          });
        }

        // Initialize just this connection based on its type
        if (isResolvedStdioConnection(connection)) {
          await this._initializeStdioConnection(serverName, connection);
        } else if (isResolvedStreamableHTTPConnection(connection)) {
          if (connection.type === "sse" || connection.transport === "sse") {
            await this._initializeSSEConnection(serverName, connection);
          } else {
            await this._initializeStreamableHTTPConnection(
              serverName,
              connection
            );
          }
        }

        // Check if connected
        const key =
          "headers" in connection
            ? {
                serverName,
                headers: connection.headers,
                authProvider: connection.authProvider,
              }
            : { serverName };
        if (this.#clientConnections.has(key)) {
          connected = true;
          debugLog(`INFO: Successfully reconnected to server "${serverName}"`);
        }
      } catch (error) {
        debugLog(
          `ERROR: Failed to reconnect to server "${serverName}" (attempt ${attempts}): ${error}`
        );
      }
    }

    if (!connected) {
      debugLog(
        `ERROR: Failed to reconnect to server "${serverName}" after ${attempts} attempts`
      );
    }
  }

  /**
   * Clean up resources for a specific server
   */
  async #cleanupServerResources(transportOptions: {
    serverName: string;
    authProvider?: OAuthClientProvider;
    headers?: Record<string, string>;
  }): Promise<void> {
    const { serverName, authProvider, headers } = transportOptions;
    delete this._serverNameToTools[serverName];
    await this.#clientConnections.delete({ serverName, authProvider, headers });
  }

  /**
   * Get all tools from all servers as a flat array.
   *
   * @returns A flattened array of all tools
   */
  private _getAllToolsAsFlatArray(): DynamicStructuredTool[] {
    const allTools: DynamicStructuredTool[] = [];
    for (const tools of Object.values(this._serverNameToTools)) {
      allTools.push(...tools);
    }
    return allTools;
  }

  /**
   * Get tools from specific servers as a flat array.
   *
   * @param serverNames - Names of servers to get tools from
   * @returns A flattened array of tools from the specified servers
   */
  private _getToolsFromServers(serverNames: string[]): DynamicStructuredTool[] {
    const allTools: DynamicStructuredTool[] = [];
    for (const serverName of serverNames) {
      const tools = this._serverNameToTools[serverName];
      if (tools) {
        allTools.push(...tools);
      }
    }
    return allTools;
  }
}
