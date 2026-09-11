import { z } from "zod";
import {
  SSEClientTransport,
  StreamableHTTPClientTransport,
} from "@modelcontextprotocol/client";
import type {
  CacheMode,
  OAuthClientProvider,
  LoggingLevel,
} from "@modelcontextprotocol/client";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import type { DynamicStructuredTool } from "@langchain/core/tools";
import { convertMcpTools } from "./tools.js";
import { ConnectionManager, mergeHeaders, type Client } from "./connection.js";
import debug from "debug";
import {
  type ClientConfig,
  type MCPAdapterConfig,
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
  toolDiscoveryOptionsSchema,
  type ToolDiscoveryOptions,
  adapterConfigSchema,
  loggingLevelSchema,
  type LoadMcpToolsOptions,
  _resolveAndApplyOverrideHandlingOverrides,
} from "./types.js";

const debugLog = debug("@langchain/mcp-adapters:client");

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
 * Client for connecting to multiple MCP servers and loading LangChain-compatible tools.
 */
export class MCPAdapter {
  /**
   * Cached map of server names to tools
   */
  #generation = 0;
  #closing = false;
  #toolsByClient = new WeakMap<
    Client,
    {
      descriptorKey: string;
      tools: Promise<DynamicStructuredTool[]>;
    }
  >();

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
  #failedServers = new Set<ReturnType<ConnectionManager["identity"]>>();

  /**
   * Returns a configuration snapshot. Callbacks and OAuth providers retain their identity.
   * This is runtime configuration, not a redacted or JSON-serializable diagnostic view.
   *
   * Client does not support config modifications.
   */
  get config(): ResolvedClientConfig {
    return clientConfigSchema.parse(this.#config);
  }

  /**
   * Create an MCP adapter. Construction does not open connections.
   *
   * @param config - Configuration object
   */
  constructor(config: MCPAdapterConfig);
  /** @deprecated Use `{ servers: { ... } }`. */
  constructor(config: ClientConfig | Record<string, Connection>);
  constructor(
    config: MCPAdapterConfig | ClientConfig | Record<string, Connection>
  ) {
    const parsedServerConfig = adapterConfigSchema.parse(config);

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
        logLevel: serverConfig.logLevel ?? parsedServerConfig.logLevel,
        throwOnLoadError: parsedServerConfig.throwOnLoadError,
        prefixToolNameWithServerName:
          parsedServerConfig.prefixToolNameWithServerName,
        additionalToolNamePrefix: parsedServerConfig.additionalToolNamePrefix,
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
    this.#clientConnections = new ConnectionManager({
      ...parsedServerConfig,
      onToolsListChanged: (source) => {
        const connection = source.options;

        const client = this.#clientConnections.get(
          connection.transport === "stdio"
            ? { serverName: source.server }
            : {
                serverName: source.server,
                headers: connection.headers,
                authProvider: connection.authProvider,
              }
        );

        if (client) this.#toolsByClient.delete(client);

        return parsedServerConfig.onToolsListChanged?.(source);
      },
    });
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
    customTransportOptions?: ToolDiscoveryOptions
  ): Promise<Record<string, DynamicStructuredTool[]>> {
    if (!this.#mcpServers || Object.keys(this.#mcpServers).length === 0) {
      throw new MCPClientError("No connections to initialize");
    }

    if (this.#closing) throw new MCPClientError("MCP connections are closing");
    const generation = this.#generation;
    const catalog: Record<string, DynamicStructuredTool[]> = {};

    for (const [serverName, connection] of Object.entries(this.#mcpServers)) {
      const key = this.#clientConnections.identity(
        this.#transportOptions(serverName, customTransportOptions)
      );

      if (this.#failedServers.has(key)) continue;

      try {
        await this._initializeConnection(
          serverName,
          connection,
          customTransportOptions
        );

        const client = this.#clientConnections.get(
          this.#transportOptions(serverName, customTransportOptions)
        );

        if (client)
          catalog[serverName] = await this._loadToolsForServer(
            serverName,
            client,
            customTransportOptions?.cacheMode
          );
      } catch (error) {
        if (this.#onConnectionError === "throw") throw error;

        if (typeof this.#onConnectionError === "function")
          this.#onConnectionError({ serverName, error });
        this.#failedServers.add(key);
        debugLog(
          `WARN: Failed to initialize connection to server "${serverName}": ${String(error)}`
        );
      }
    }

    if (generation !== this.#generation)
      throw new MCPClientError("MCP connections closed during discovery");

    return catalog;
  }

  #transportOptions(serverName: string, options?: CustomHTTPTransportOptions) {
    const connection = this.#config.mcpServers[serverName];

    return !connection || connection.transport === "stdio"
      ? { serverName }
      : {
          serverName,
          headers: mergeHeaders(options?.headers, connection.headers),
          authProvider: options?.authProvider ?? connection.authProvider,
        };
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
    options?: ToolDiscoveryOptions
  ): Promise<DynamicStructuredTool[]>;
  async getTools(...args: unknown[]): Promise<DynamicStructuredTool[]> {
    const { servers, options } = parseServerSelection(args);
    const catalog = await this.initializeConnections(options);

    return (servers.length ? servers : Object.keys(catalog)).flatMap(
      (name) => catalog[name] ?? []
    );
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
    const parsed = z
      .union([
        z
          .tuple([loggingLevelSchema])
          .transform(([level]) => ({ serverName: undefined, level })),
        z
          .tuple([z.string(), loggingLevelSchema])
          .transform(([serverName, level]) => ({ serverName, level })),
      ])
      .parse(args);

    const clients =
      parsed.serverName === undefined
        ? this.#clientConnections.getAllClients()
        : [
            this.#clientConnections.get(
              this.#transportOptions(parsed.serverName)
            ),
          ].filter((client) => client !== undefined);

    if (clients.some((client) => client.getProtocolEra() === "modern")) {
      throw new MCPClientError(
        "setLoggingLevel is legacy-only; configure logLevel for modern tool requests"
      );
    }

    await Promise.all(
      clients.map((client) => client.setLoggingLevel(parsed.level))
    );
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

    return this.#clientConnections.get(
      this.#transportOptions(serverName, options)
    );
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
    const { servers, options } = parseServerSelection(args);
    await this.initializeConnections(options);

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
        const { resources } = await client.listResources();

        result[serverName] = resources.map((resource) => ({
          ...resource,
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
        throw error;
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
    const { servers, options } = parseServerSelection(args);
    await this.initializeConnections(options);

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
        const { resourceTemplates: templates } =
          await client.listResourceTemplates();

        result[serverName] = templates.map((template) => ({
          ...template,
          uriTemplate: template.uriTemplate,
          name: template.title ?? template.name,
          description: template.description,
          mimeType: template.mimeType,
        }));
        debugLog(
          `INFO: Listed ${result[serverName].length} resource templates from server "${serverName}"`
        );
      } catch (error) {
        debugLog(
          `ERROR: Failed to list resource templates from server "${serverName}": ${error}`
        );
        throw error;
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

      return result.contents;
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
    this.#generation += 1;
    this.#closing = true;

    try {
      await this.#clientConnections.delete();
    } finally {
      this.#toolsByClient = new WeakMap();
      this.#failedServers.clear();
      this.#closing = false;
    }
  }

  /**
   * Initialize a connection to a specific server
   */
  private async _initializeConnection(
    serverName: string,
    connection: ResolvedConnection,
    customTransportOptions?: CustomHTTPTransportOptions
  ): Promise<void> {
    if (connection.transport === "stdio") {
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
    } else if (
      connection.transport === "http" ||
      connection.transport === "sse"
    ) {
      /**
       * Users may want to use different connection options for tool calls or tool discovery.
       */
      const { authProvider, headers } = customTransportOptions ?? {};
      const updatedConnection = {
        ...connection,
        authProvider: authProvider ?? connection.authProvider,
        headers: mergeHeaders(headers, connection.headers),
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

      if (connection.transport === "sse") {
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
      await this.#clientConnections.createClient(
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
    // oxlint-disable-next-line @typescript-eslint/no-misused-promises
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
    if (typeof error !== "object" || error === null) return undefined;

    const isHttpStatus = (value: unknown): value is number =>
      typeof value === "number" &&
      Number.isInteger(value) &&
      value >= 100 &&
      value <= 599;

    // SDK 2 HTTP errors use status; SSE errors use a numeric code.
    if ("status" in error && isHttpStatus(error.status)) return error.status;

    if ("code" in error && isHttpStatus(error.code)) return error.code;

    if (!("message" in error) || typeof error.message !== "string") {
      return undefined;
    }

    const match = error.message.match(/\(HTTP (\d{3})\)/);
    const status = match ? Number(match[1]) : undefined;

    return isHttpStatus(status) ? status : undefined;
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
    const { url, transport: transportType } = connection;
    const automaticSSEFallback = connection.automaticSSEFallback ?? true;

    debugLog(
      `DEBUG: Creating Streamable HTTP transport for server "${serverName}" with URL: ${url}`
    );

    if (transportType === "http" || transportType == null) {
      try {
        await this.#clientConnections.createClient(
          "http",
          serverName,
          connection
        );
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
      await this.#clientConnections.createClient("sse", serverName, connection);

      const transport = this.#clientConnections.getTransport({
        serverName,
        headers,
        authProvider,
      }) as SSEClientTransport;

      // Set up auto-reconnect if configured
      if (reconnect?.enabled) {
        this._setupSSEReconnect(serverName, transport, connection, reconnect);
      }
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
    // oxlint-disable-next-line @typescript-eslint/no-misused-promises
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
    client: Client,
    cacheMode: CacheMode = "use"
  ): Promise<DynamicStructuredTool[]> {
    const existing = this.#toolsByClient.get(client);

    try {
      const { tools: descriptors } = await client.listTools(undefined, {
        cacheMode,
      });

      const descriptorKey = JSON.stringify(descriptors);

      if (existing?.descriptorKey === descriptorKey)
        return await existing.tools;

      const tools = convertMcpTools(
        serverName,
        client,
        descriptors,
        this.#loadToolsOptions[serverName]
      );

      if (cacheMode !== "bypass")
        this.#toolsByClient.set(client, { descriptorKey, tools });

      return await tools;
    } catch (error) {
      this.#toolsByClient.delete(client);

      try {
        await this.#clientConnections.release(client);
      } catch (cleanupError) {
        throw new AggregateError(
          [error, cleanupError],
          `MCP discovery and cleanup failed for "${serverName}"`
        );
      }

      throw new MCPClientError(
        `Failed to load tools from server "${serverName}": ${error}`,
        serverName
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
    const generation = this.#generation;
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

        if (generation !== this.#generation || this.#closing) return;

        // Initialize just this connection based on its type
        if (connection.transport === "stdio") {
          await this._initializeStdioConnection(serverName, connection);
        } else if (
          connection.transport === "http" ||
          connection.transport === "sse"
        ) {
          if (connection.transport === "sse") {
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
    const client = this.#clientConnections.get(transportOptions);

    if (client) this.#toolsByClient.delete(client);
    await this.#clientConnections.delete({ serverName, authProvider, headers });
  }
}

/** @deprecated Use MCPAdapter. This alias shares the same implementation. */
export { MCPAdapter as MultiServerMCPClient };

const serverSelectionSchema = z.union([
  z.array(z.string()).transform((servers) => ({ servers, options: undefined })),
  z
    .tuple([z.array(z.string()), toolDiscoveryOptionsSchema.optional()])
    .transform(([servers, options]) => ({ servers, options })),
]);

function parseServerSelection(args: unknown[]) {
  return serverSelectionSchema.parse(args);
}
