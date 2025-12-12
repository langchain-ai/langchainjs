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
import type { LoggingLevel } from "@modelcontextprotocol/sdk/types.js";

import { z } from "zod/v3";
import { loadMcpTools } from "./tools.js";
import { ConnectionManager, type Client } from "./connection.js";
import { getDebugLog } from "./logging.js";
import {
  type ClientConfig,
  type Connection,
  type ResolvedClientConfig,
  type ResolvedConnection,
  type ResolvedStdioConnection,
  type ResolvedStreamableHTTPConnection,
  type CustomHTTPTransportOptions,
  type MCPResource,
  type MCPResourceTemplate,
  type MCPResourceContent,
  type ConnectionErrorHandler,
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
  constructor(
    message: string,
    public readonly serverName?: string
  ) {
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
  /**
   * Cached map of server names to tools
   */
  #serverNameToTools: Record<string, DynamicStructuredTool[]> = {};

  /**
   * Configured MCP servers
   */
  #mcpServers?: Record<string, ResolvedConnection>;

  /**
   * Cached map of server names to load tools options
   */
  #loadToolsOptions: Record<string, LoadMcpToolsOptions> = {};

  /**
   * Connection manager
   */
  #clientConnections: ConnectionManager;

  /**
   * Resolved client config
   */
  #config: ResolvedClientConfig;

  /**
   * Behavior when a server fails to connect
   */
  #onConnectionError: "throw" | "ignore" | ConnectionErrorHandler;

  /**
   * Set of server names that have failed to connect (when onConnectionError is "ignore")
   */
  #failedServers: Set<string> = new Set();

  /**
   * Returns clone of server config for inspection purposes.
   *
   * Client does not support config modifications.
   */
  get config(): ClientConfig {
    // clone config so it can't be mutated
    return JSON.parse(JSON.stringify(this.#config));
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

      this.#loadToolsOptions[serverName] = {
        throwOnLoadError: parsedServerConfig.throwOnLoadError,
        prefixToolNameWithServerName:
          parsedServerConfig.prefixToolNameWithServerName,
        additionalToolNamePrefix: parsedServerConfig.additionalToolNamePrefix,
        useStandardContentBlocks: parsedServerConfig.useStandardContentBlocks,
        ...(Object.keys(outputHandling).length > 0 ? { outputHandling } : {}),
        ...(defaultToolTimeout ? { defaultToolTimeout } : {}),
        onProgress: parsedServerConfig.onProgress,
        /**
         * make sure to place global hooks (e.g. parsedServerConfig) first before
         * server-specific hooks (e.g. serverConfig) so they can override tool call
         * configuration.
         */
        beforeToolCall: parsedServerConfig.beforeToolCall,
        afterToolCall: parsedServerConfig.afterToolCall,
      };
    }

    this.#config = parsedServerConfig;
    this.#mcpServers = parsedServerConfig.mcpServers;
    this.#clientConnections = new ConnectionManager(parsedServerConfig);
    this.#onConnectionError = parsedServerConfig.onConnectionError;
  }

  /**
   * Proactively initialize connections to all servers. This will be called automatically when
   * methods requiring an active connection (like {@link getTools} or {@link getClient}) are called,
   * but you can call it directly to ensure all connections are established before using the tools.
   *
   * When a server fails to connect, the client will throw an error if `onConnectionError` is "throw",
   * otherwise it will skip the server and continue with the remaining servers.
   *
   * @returns A map of server names to arrays of tools
   * @throws {MCPClientError} If initialization fails and `onConnectionError` is "throw" (default)
   */
  async initializeConnections(
    customTransportOptions?: CustomHTTPTransportOptions
  ): Promise<Record<string, DynamicStructuredTool[]>> {
    if (!this.#mcpServers || Object.keys(this.#mcpServers).length === 0) {
      throw new MCPClientError("No connections to initialize");
    }

    for (const [serverName, connection] of Object.entries(this.#mcpServers)) {
      // Skip servers that have already failed (when onConnectionError is "ignore")
      if (
        (this.#onConnectionError === "ignore" ||
          typeof this.#onConnectionError === "function") &&
        this.#failedServers.has(serverName)
      ) {
        continue;
      }

      try {
        await this._initializeConnection(
          serverName,
          connection,
          customTransportOptions
        );
        // If we successfully initialized, remove from failed set (in case it was there before)
        this.#failedServers.delete(serverName);
      } catch (error) {
        if (this.#onConnectionError === "throw") {
          throw error;
        }

        // Handle custom error handler function
        if (typeof this.#onConnectionError === "function") {
          this.#onConnectionError({ serverName, error });
          // If we get here, the handler didn't throw, so treat as ignored
          this.#failedServers.add(serverName);
          debugLog(
            `WARN: Failed to initialize connection to server "${serverName}": ${String(error)}`
          );
          continue;
        }

        // Default "ignore" behavior
        // Mark this server as failed so we don't try again
        this.#failedServers.add(serverName);
        debugLog(
          `WARN: Failed to initialize connection to server "${serverName}": ${String(error)}`
        );
        continue;
      }
    }

    // Warn if no servers successfully connected when using "ignore" mode
    if (
      this.#onConnectionError === "ignore" &&
      Object.keys(this.#serverNameToTools).length === 0
    ) {
      debugLog(
        `WARN: No servers successfully connected. All connection attempts failed.`
      );
    }

    return this.#serverNameToTools;
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
      CustomHTTPTransportOptions | undefined,
    ];
    await this.initializeConnections(options);
    return servers.length === 0
      ? this._getAllToolsAsFlatArray()
      : this._getToolsFromServers(servers);
  }

  /**
   * Set the logging level for all servers
   * @param level - The logging level
   *
   * @example
   * ```ts
   * await client.setLoggingLevel("debug");
   * ```
   */
  async setLoggingLevel(level: LoggingLevel): Promise<void>;
  /**
   * Set the logging level for a specific server
   * @param serverName - The name of the server
   * @param level - The logging level
   *
   * @example
   * ```ts
   * await client.setLoggingLevel("server1", "debug");
   * ```
   */
  async setLoggingLevel(serverName: string, level: LoggingLevel): Promise<void>;
  async setLoggingLevel(...args: unknown[]): Promise<void> {
    if (args.length === 1 && typeof args[0] === "string") {
      const level = args[0] as LoggingLevel;
      await Promise.all(
        this.#clientConnections
          .getAllClients()
          .map((client) => client.setLoggingLevel(level))
      );
      return;
    }

    const [serverName, level] = args as [string, LoggingLevel];
    await this.#clientConnections.get(serverName)?.setLoggingLevel(level);
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
   * List resources from specified servers.
   *
   * @param servers - Optional array of server names to filter resources by.
   *                 If not provided, returns resources from all servers.
   * @param options - Optional connection options for the resource listing, e.g. custom auth provider or headers.
   * @returns A map of server names to their resources
   *
   * @example
   * ```ts
   * // List resources from all servers
   * const resources = await client.listResources();
   * ```
   *
   * @example
   * ```ts
   * // List resources from specific servers
   * const resources = await client.listResources("server1", "server2");
   * ```
   */
  async listResources(
    ...servers: string[]
  ): Promise<Record<string, MCPResource[]>>;
  async listResources(
    servers: string[],
    options?: CustomHTTPTransportOptions
  ): Promise<Record<string, MCPResource[]>>;
  async listResources(
    ...args: unknown[]
  ): Promise<Record<string, MCPResource[]>> {
    let servers: string[];
    let options: CustomHTTPTransportOptions | undefined;

    if (args.length === 0 || args.every((arg) => typeof arg === "string")) {
      servers = args as string[];
      await this.initializeConnections();
    } else {
      [servers, options] = args as [
        string[],
        CustomHTTPTransportOptions | undefined,
      ];
      await this.initializeConnections(options);
    }

    const targetServers =
      servers.length > 0 ? servers : Object.keys(this.#config.mcpServers);

    const result: Record<string, MCPResource[]> = {};

    for (const serverName of targetServers) {
      const client = await this.getClient(serverName, options);
      if (!client) {
        debugLog(`WARN: Server "${serverName}" not found or not connected`);
        continue;
      }

      try {
        const resourcesList = await client.listResources();
        result[serverName] = resourcesList.resources.map((resource) => ({
          uri: resource.uri,
          name: resource.title ?? resource.name,
          description: resource.description,
          mimeType: resource.mimeType,
        }));
        debugLog(
          `INFO: Listed ${result[serverName].length} resources from server "${serverName}"`
        );
      } catch (error) {
        debugLog(
          `ERROR: Failed to list resources from server "${serverName}": ${error}`
        );
        result[serverName] = [];
      }
    }

    return result;
  }

  /**
   * List resource templates from specified servers.
   *
   * Resource templates are used for dynamic resources with parameterized URIs.
   *
   * @param servers - Optional array of server names to filter resource templates by.
   *                 If not provided, returns resource templates from all servers.
   * @param options - Optional connection options for the resource template listing, e.g. custom auth provider or headers.
   * @returns A map of server names to their resource templates
   *
   * @example
   * ```ts
   * // List resource templates from all servers
   * const templates = await client.listResourceTemplates();
   * ```
   *
   * @example
   * ```ts
   * // List resource templates from specific servers
   * const templates = await client.listResourceTemplates("server1", "server2");
   * ```
   */
  async listResourceTemplates(
    ...servers: string[]
  ): Promise<Record<string, MCPResourceTemplate[]>>;
  async listResourceTemplates(
    servers: string[],
    options?: CustomHTTPTransportOptions
  ): Promise<Record<string, MCPResourceTemplate[]>>;
  async listResourceTemplates(
    ...args: unknown[]
  ): Promise<Record<string, MCPResourceTemplate[]>> {
    let servers: string[];
    let options: CustomHTTPTransportOptions | undefined;

    if (args.length === 0 || args.every((arg) => typeof arg === "string")) {
      servers = args as string[];
      await this.initializeConnections();
    } else {
      [servers, options] = args as [
        string[],
        CustomHTTPTransportOptions | undefined,
      ];
      await this.initializeConnections(options);
    }

    const targetServers =
      servers.length > 0 ? servers : Object.keys(this.#config.mcpServers);

    const result: Record<string, MCPResourceTemplate[]> = {};

    for (const serverName of targetServers) {
      const client = await this.getClient(serverName, options);
      if (!client) {
        debugLog(`WARN: Server "${serverName}" not found or not connected`);
        continue;
      }

      try {
        const templatesList = await client.listResourceTemplates();
        result[serverName] = templatesList.resourceTemplates.map(
          (template) => ({
            uriTemplate: template.uriTemplate,
            name: template.title ?? template.name,
            description: template.description,
            mimeType: template.mimeType,
          })
        );
        debugLog(
          `INFO: Listed ${result[serverName].length} resource templates from server "${serverName}"`
        );
      } catch (error) {
        debugLog(
          `ERROR: Failed to list resource templates from server "${serverName}": ${error}`
        );
        result[serverName] = [];
      }
    }

    return result;
  }

  /**
   * Read a resource from a specific server.
   *
   * @param serverName - The name of the server to read the resource from
   * @param uri - The URI of the resource to read
   * @param options - Optional connection options for reading the resource, e.g. custom auth provider or headers.
   * @returns The resource contents
   *
   * @example
   * ```ts
   * const content = await client.readResource("server1", "file://path/to/resource");
   * ```
   */
  async readResource(
    serverName: string,
    uri: string,
    options?: CustomHTTPTransportOptions
  ): Promise<MCPResourceContent[]> {
    await this.initializeConnections(options);

    const client = await this.getClient(serverName, options);
    if (!client) {
      throw new MCPClientError(
        `Server "${serverName}" not found or not connected`,
        serverName
      );
    }

    try {
      debugLog(`INFO: Reading resource "${uri}" from server "${serverName}"`);
      const result = await client.readResource({ uri });
      return result.contents.map((content) => ({
        uri: content.uri,
        mimeType: content.mimeType,
        text: content.text as string | undefined,
        blob: content.blob as string | undefined,
      }));
    } catch (error) {
      throw new MCPClientError(
        `Failed to read resource "${uri}" from server "${serverName}": ${error}`,
        serverName
      );
    }
  }

  /**
   * Close all connections.
   */
  async close(): Promise<void> {
    debugLog(`INFO: Closing all MCP connections...`);
    this.#serverNameToTools = {};
    this.#failedServers.clear();
    await this.#clientConnections.delete();
    debugLog(`INFO: All MCP connections closed`);
  }

  /**
   * Initialize a connection to a specific server
   */
  private async _initializeConnection(
    serverName: string,
    connection: ResolvedConnection,
    customTransportOptions?: CustomHTTPTransportOptions
  ): Promise<void> {
    if (isResolvedStdioConnection(connection)) {
      debugLog(
        `INFO: Initializing stdio connection to server "${serverName}"...`
      );

      /**
       * check if we already initialized this stdio connection
       */
      if (this.#clientConnections.has(serverName)) {
        return;
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
        return;
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
          "http",
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
        this.#loadToolsOptions[serverName]
      );
      this.#serverNameToTools[serverName] = tools;
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
    delete this.#serverNameToTools[serverName];
    await this.#clientConnections.delete({ serverName, authProvider, headers });
  }

  /**
   * Get all tools from all servers as a flat array.
   *
   * @returns A flattened array of all tools
   */
  private _getAllToolsAsFlatArray(): DynamicStructuredTool[] {
    const allTools: DynamicStructuredTool[] = [];
    for (const tools of Object.values(this.#serverNameToTools)) {
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
      const tools = this.#serverNameToTools[serverName];
      if (tools) {
        allTools.push(...tools);
      }
    }
    return allTools;
  }
}
