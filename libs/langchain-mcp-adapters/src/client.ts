import {
  MCPClientError,
  getHttpErrorCode,
  createAuthenticationErrorMessage,
} from "./utils/errors.js";
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
import { LoggingLevelSchema } from "@modelcontextprotocol/core";
import type { DynamicStructuredTool } from "@langchain/core/tools";
import { convertMcpTools } from "./tools.js";
import { _resolveAndApplyOverrideHandlingOverrides } from "./content.js";
import { ConnectionManager, type Client } from "./connection.js";
import { mergeHeaders } from "./utils/misc.js";
import {
  CustomHTTPTransportParams,
  MCPAdapterConfig,
  MCPAdapterInit,
  MCPAdapterParams,
  SSEConnection,
  ToolDiscoveryParams,
  _MCPAliases,
  isDescriptorConnection,
  type Connection,
  type ConnectionErrorHandler,
  type LoadMcpToolsParams,
  type StdioConnection,
  type ToolDiscoveryOptions,
} from "./types.js";

const toolSelectionSchema = createServerSelectionSchema(ToolDiscoveryParams);
const transportSelectionSchema = createServerSelectionSchema(
  CustomHTTPTransportParams
);

export { MCPClientError } from "./utils/errors.js";

/**
 * Client for connecting to multiple MCP servers and loading LangChain-compatible tools.
 */
export class MCPAdapter {
  /**
   * Cancellation for the current connection epoch. `close()` aborts it, which
   * cancels in-flight SDK requests and wakes any pending reconnect backoff, and
   * installs a fresh controller so a reused adapter starts a clean epoch.
   */
  #epoch = new AbortController();
  /**
   * The in-flight `close()`, so a concurrent close reuses it rather than
   * tearing down twice, and work arriving mid-close can wait for the new epoch
   * instead of failing.
   */
  #closing?: Promise<void>;
  /**
   * Cached tools per connected client, keyed by the descriptor set they were
   * built from.
   */
  #toolsByClient = new WeakMap<
    Client,
    {
      descriptorKey: string;
      tools: Promise<DynamicStructuredTool[]>;
    }
  >();
  /**
   * Per-client discovery bookkeeping. `inFlight` counts concurrent
   * `_loadToolsForServer` calls; `ready` records whether any of them has
   * handed tools to a caller. A client is only released when the last
   * discovery fails and none ever succeeded.
   */
  #toolDiscoveryState = new WeakMap<
    Client,
    { inFlight: number; ready: boolean }
  >();

  /**
   * Configured MCP servers
   */
  #mcpServers?: Record<string, Connection>;

  /** True when constructed with a direct connection rather than a named server map. */
  #isDirectConnection = false;

  /**
   * Cached map of server names to load tools options
   */
  #loadToolsOptions: Record<string, LoadMcpToolsParams> = {};

  /**
   * Connection manager
   */
  #clientConnections: ConnectionManager;

  /** Parsed named-server configuration, if the adapter was constructed with one. */
  #config?: MCPAdapterConfig;

  /** Parsed direct connection, if the adapter was constructed with one. */
  #directConnection?: Connection;

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
  get config(): MCPAdapterConfig | Connection {
    return this.#config ?? this.#directConnection!;
  }

  /**
   * Create an MCP adapter. Construction does not open connections.
   *
   * Direct connections remain distinct from named server maps. Internally they
   * use a stable key because discovery and connection pooling are server-keyed.
   */
  constructor(config: MCPAdapterInit) {
    const parsed = MCPAdapterInit.parse(config);
    const isNamedMap =
      parsed !== null && typeof parsed === "object" && "servers" in parsed;
    const parsedServerConfig = isNamedMap
      ? parsed
      : MCPAdapterConfig.parse({
          ...MCPAdapterParams.parse({}),
          servers: { direct: parsed },
        });

    this.#isDirectConnection = !isNamedMap;
    this.#config = isNamedMap ? parsed : undefined;
    this.#directConnection = isNamedMap ? undefined : parsed;

    for (const [serverName, serverConfig] of Object.entries(
      parsedServerConfig.servers
    )) {
      const descriptor = isDescriptorConnection(serverConfig)
        ? serverConfig
        : undefined;
      const outputHandling = _resolveAndApplyOverrideHandlingOverrides(
        parsedServerConfig.outputHandling,
        descriptor?.outputHandling
      );
      const defaultToolTimeout =
        parsedServerConfig.defaultToolTimeout ?? descriptor?.defaultToolTimeout;

      this.#loadToolsOptions[serverName] = {
        logLevel: descriptor?.logLevel,
        elicitation:
          descriptor && "elicitation" in descriptor
            ? descriptor.elicitation
            : undefined,
        throwOnLoadError: parsedServerConfig.throwOnLoadError,
        prefixToolNameWithServerName: this.#isDirectConnection
          ? false
          : parsedServerConfig.prefixToolNameWithServerName,
        additionalToolNamePrefix: parsedServerConfig.additionalToolNamePrefix,
        ...(Object.keys(outputHandling).length > 0 ? { outputHandling } : {}),
        ...(defaultToolTimeout ? { defaultToolTimeout } : {}),
        onProgress: descriptor?.onProgress,
        beforeToolCall: parsedServerConfig.beforeToolCall,
        afterToolCall: parsedServerConfig.afterToolCall,
      };
    }

    this.#mcpServers = parsedServerConfig.servers;
    this.#clientConnections = new ConnectionManager((options) => {
      const client = this.#clientConnections.get(options);

      if (client) {
        this.#toolsByClient.delete(client);
      }
    });
    this.#onConnectionError = parsedServerConfig.onConnectionError;
  }

  /**
   * Discover executable LangChain tools grouped by server name.
   * Opens connections as needed and honors the SDK discovery cache.
   *
   * When a server fails to connect, the client will throw an error if `onConnectionError` is "throw",
   * otherwise it will skip the server and continue with the remaining servers.
   *
   * @returns A map of server names to arrays of tools
   * @throws {MCPClientError} If initialization fails and `onConnectionError` is "throw" (default)
   */
  async listToolsets(
    customTransportOptions?: ToolDiscoveryOptions
  ): Promise<Record<string, DynamicStructuredTool[]>> {
    return this.#discoverToolsets(
      ToolDiscoveryParams.parse(customTransportOptions ?? {})
    );
  }

  /** @deprecated Use listToolsets(). This method also discovers tools. */
  async initializeConnections(
    options?: ToolDiscoveryOptions
  ): Promise<Record<string, DynamicStructuredTool[]>> {
    return this.listToolsets(options);
  }

  async #discoverToolsets(
    customTransportOptions?: ToolDiscoveryOptions
  ): Promise<Record<string, DynamicStructuredTool[]>> {
    if (!this.#mcpServers || Object.keys(this.#mcpServers).length === 0) {
      throw new MCPClientError("No connections to initialize");
    }

    // A discovery that arrives mid-close waits for teardown and then runs
    // against the fresh epoch, which matches the documented reuse contract
    // better than failing a caller for a close it never saw.
    if (this.#closing) {
      await this.#closing.catch(() => undefined);
    }

    const { signal } = this.#epoch;
    const catalog: Record<string, DynamicStructuredTool[]> = {};

    for (const [serverName, connection] of Object.entries(this.#mcpServers)) {
      const key = this.#clientConnections.identity(
        this.#transportOptions(serverName, customTransportOptions)
      );

      if (this.#failedServers.has(key)) {
        continue;
      }

      try {
        await this._initializeConnection(
          serverName,
          connection,
          customTransportOptions
        );

        const client = this.#clientConnections.get(
          this.#transportOptions(serverName, customTransportOptions)
        );

        if (client) {
          catalog[serverName] = await this._loadToolsForServer(
            serverName,
            client,
            customTransportOptions?.cacheMode,
            signal
          );
        }
      } catch (error) {
        if (this.#onConnectionError === "throw") {
          throw error;
        }

        if (typeof this.#onConnectionError === "function") {
          await this.#onConnectionError({ serverName, error });
        }
        this.#failedServers.add(key);
      }
    }

    // The per-server policy above swallows failures, an aborted request
    // included, so cancellation has to be re-checked here or a close during
    // discovery would surface as a successful partial catalog.
    if (signal.aborted) {
      throw new MCPClientError(
        "MCP connections closed during discovery",
        undefined,
        { cause: signal.reason }
      );
    }

    return catalog;
  }

  #transportOptions(serverName: string, options?: CustomHTTPTransportParams) {
    const connection = this.#mcpServers?.[serverName];

    return !connection ||
      !isDescriptorConnection(connection) ||
      (connection.transport !== "http" && connection.transport !== "sse")
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
   * const tools = await client.listTools();
   * ```
   *
   * @example
   * ```ts
   * // Get tools from specific servers
   * const tools = await client.listTools("server1", "server2");
   * ```
   *
   * @example
   * ```ts
   * // Get tools from specific servers with custom connection options
   * const tools = await client.listTools(["server1", "server2"], {
   *   headers: { "X-Custom-Header": "value" },
   * });
   * ```
   */
  async listTools(...servers: string[]): Promise<DynamicStructuredTool[]>;
  async listTools(
    servers: string[],
    options?: ToolDiscoveryOptions
  ): Promise<DynamicStructuredTool[]>;
  async listTools(...args: unknown[]): Promise<DynamicStructuredTool[]> {
    const { servers, options } = toolSelectionSchema.parse(args);
    const catalog = await this.#discoverToolsets(options);

    return (servers.length ? servers : Object.keys(catalog)).flatMap(
      (name) => catalog[name] ?? []
    );
  }

  /**
   * @deprecated Protocol logging is deprecated; prefer OpenTelemetry or stderr.
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
   * @deprecated Protocol logging is deprecated; prefer OpenTelemetry or stderr.
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
          .tuple([LoggingLevelSchema])
          .transform(([level]) => ({ serverName: undefined, level })),
        z
          .tuple([z.string(), LoggingLevelSchema])
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
    options?: CustomHTTPTransportParams
  ): Promise<Client | undefined> {
    const parsedOptions = CustomHTTPTransportParams.parse(options ?? {});
    await this.#discoverToolsets(parsedOptions);

    return this.#clientConnections.get(
      this.#transportOptions(serverName, parsedOptions)
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
  ): Promise<Record<string, _MCPAliases.MCPResource[]>>;
  async listResources(
    servers: string[],
    options?: CustomHTTPTransportParams
  ): Promise<Record<string, _MCPAliases.MCPResource[]>>;
  async listResources(
    ...args: unknown[]
  ): Promise<Record<string, _MCPAliases.MCPResource[]>> {
    const { servers, options } = transportSelectionSchema.parse(args);
    await this.#discoverToolsets(options);

    const targetServers =
      servers.length > 0 ? servers : Object.keys(this.#mcpServers ?? {});

    const result: Record<string, _MCPAliases.MCPResource[]> = {};

    for (const serverName of targetServers) {
      const client = this.#clientConnections.get(
        this.#transportOptions(serverName, options)
      );
      if (!client) {
        continue;
      }

      const resourcesList = await client.listResources();
      result[serverName] = resourcesList.resources.map((resource) => ({
        ...resource,
        uri: resource.uri,
        name: resource.title ?? resource.name,
        description: resource.description,
        mimeType: resource.mimeType,
      }));
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
  ): Promise<Record<string, _MCPAliases.MCPResourceTemplate[]>>;
  async listResourceTemplates(
    servers: string[],
    options?: CustomHTTPTransportParams
  ): Promise<Record<string, _MCPAliases.MCPResourceTemplate[]>>;
  async listResourceTemplates(
    ...args: unknown[]
  ): Promise<Record<string, _MCPAliases.MCPResourceTemplate[]>> {
    const { servers, options } = transportSelectionSchema.parse(args);
    await this.#discoverToolsets(options);

    const targetServers =
      servers.length > 0 ? servers : Object.keys(this.#mcpServers ?? {});

    const result: Record<string, _MCPAliases.MCPResourceTemplate[]> = {};

    for (const serverName of targetServers) {
      const client = this.#clientConnections.get(
        this.#transportOptions(serverName, options)
      );
      if (!client) {
        continue;
      }

      const templatesList = await client.listResourceTemplates();
      result[serverName] = templatesList.resourceTemplates.map((template) => ({
        ...template,
        uriTemplate: template.uriTemplate,
        name: template.title ?? template.name,
        description: template.description,
        mimeType: template.mimeType,
      }));
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
    options?: CustomHTTPTransportParams
  ): Promise<_MCPAliases.MCPResourceContent[]> {
    const client = await this.getClient(serverName, options);
    if (!client) {
      throw new MCPClientError(
        `Server "${serverName}" not found or not connected`,
        serverName
      );
    }

    try {
      const result = await client.readResource({ uri });

      return result.contents;
    } catch (error) {
      throw new MCPClientError(
        `Failed to read resource "${uri}" from server "${serverName}": ${error}`,
        serverName,
        { cause: error }
      );
    }
  }

  /**
   * Close all connections and clear the discovery caches.
   *
   * Cancels the current epoch, so in-flight requests reject and a reconnect
   * waiting on its backoff wakes and gives up instead of resurrecting a
   * connection. Concurrent calls share one teardown.
   *
   * Descriptor-based server configuration remains reusable afterwards, so a
   * later `listTools()` discovers again and builds fresh clients. Supplied
   * transports and in-process servers are one-shot instances and cannot be
   * reconnected after they are closed. A discovery that arrives mid-close waits
   * for teardown and then runs in the new epoch.
   */
  async close(): Promise<void> {
    if (this.#closing) {
      return this.#closing;
    }

    this.#closing = (async () => {
      try {
        // Abort before draining so in-flight requests reject here rather than
        // completing against connections that are going away.
        this.#epoch.abort(new MCPClientError("MCP adapter closed"));
        await this.#clientConnections.delete();
      } finally {
        this.#toolsByClient = new WeakMap();
        this.#failedServers.clear();
        this.#epoch = new AbortController();
        this.#closing = undefined;
      }
    })();

    return this.#closing;
  }

  /** Sleep that resolves early when `signal` aborts. */
  static #sleep(ms: number, signal: AbortSignal): Promise<void> {
    if (signal.aborted) return Promise.resolve();

    return new Promise<void>((resolve) => {
      const pending: { timer?: ReturnType<typeof setTimeout> } = {};
      const settle = () => {
        clearTimeout(pending.timer);
        signal.removeEventListener("abort", settle);
        resolve();
      };

      pending.timer = setTimeout(settle, ms);
      signal.addEventListener("abort", settle, { once: true });
    });
  }

  /**
   * Initialize a connection to a specific server
   */
  private async _initializeConnection(
    serverName: string,
    connection: Connection,
    customTransportOptions?: CustomHTTPTransportParams
  ): Promise<void> {
    if (!isDescriptorConnection(connection)) {
      await this.#clientConnections.getOrCreateClient(serverName, connection);
      return;
    }

    if (connection.transport === "stdio") {
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

      if (updatedConnection.transport === "sse") {
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
    connection: StdioConnection
  ): Promise<void> {
    const { restart } = connection;

    try {
      await this.#clientConnections.getOrCreateClient(serverName, connection);
      const transport = this.#clientConnections.getTransport({
        serverName,
      }) as StdioClientTransport;

      // Set up auto-restart if configured
      if (restart?.enabled) {
        this._setupStdioRestart(serverName, transport, connection, restart);
      }
    } catch (error) {
      throw new MCPClientError(
        `Failed to connect to stdio server "${serverName}" in ${connection.mode} mode: ${error}`,
        serverName,
        { cause: error }
      );
    }
  }

  /**
   * Set up stdio restart handling
   */
  private _setupStdioRestart(
    serverName: string,
    transport: StdioClientTransport,
    connection: StdioConnection,
    restart: NonNullable<StdioConnection["restart"]>
  ): void {
    const originalOnClose = transport.onclose;
    const handleClose = async () => {
      if (originalOnClose) {
        await originalOnClose();
      }

      // Only attempt restart if we haven't cleaned up
      if (this.#clientConnections.get(serverName)) {
        await this._attemptReconnect(
          serverName,
          connection,
          restart.maxAttempts,
          restart.delayMs
        );
      }
    };
    transport.onclose = () => {
      handleClose().catch(() => {});
    };
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
    connection: SSEConnection
  ): Promise<void> {
    const { url, transport: transportType } = connection;

    const automaticSSEFallback = connection.mode === "auto";

    // Falling back to SSE settles the era as legacy. The simplified schema
    // permits the connection options in either protocol branch, so the
    // fallback can reuse the descriptor unchanged.
    const fallback = connection;

    if (transportType === "http" || transportType == null) {
      try {
        await this.#clientConnections.getOrCreateClient(serverName, connection);
      } catch (error) {
        const code = getHttpErrorCode(error);
        if (
          automaticSSEFallback &&
          code != null &&
          (connection.mode === "auto"
            ? code === 404 || code === 405
            : code >= 400 && code < 500)
        ) {
          // Streamable HTTP error is a 4xx, so fall back to SSE
          try {
            await this._initializeSSEConnection(
              serverName,
              SSEConnection.parse({ ...fallback, transport: "sse" })
            );
          } catch (firstSSEError) {
            // try one more time, but modify the URL to end with `/sse`
            const sseUrl = this._toSSEConnectionURL(url);

            if (sseUrl !== url) {
              try {
                await this._initializeSSEConnection(
                  serverName,
                  SSEConnection.parse({
                    ...fallback,
                    transport: "sse",
                    url: sseUrl,
                  })
                );
              } catch (secondSSEError) {
                // Provide specific error message for authentication failures
                if (code === 401) {
                  throw new MCPClientError(
                    createAuthenticationErrorMessage(
                      serverName,
                      url,
                      "HTTP",
                      `${error}. Also tried SSE fallback at ${url} and ${sseUrl}, but both failed with authentication errors.`
                    ),
                    serverName,
                    { cause: secondSSEError }
                  );
                }
                throw new MCPClientError(
                  `Failed to connect to streamable HTTP server "${serverName}, url: ${url}": ${error}. Additionally, tried falling back to SSE at ${url} and ${sseUrl}, but this also failed: ${secondSSEError}`,
                  serverName,
                  { cause: secondSSEError }
                );
              }
            } else {
              // Provide specific error message for authentication failures
              if (code === 401) {
                throw new MCPClientError(
                  createAuthenticationErrorMessage(
                    serverName,
                    url,
                    "HTTP",
                    `${error}. Also tried SSE fallback at ${url}, but it failed with authentication error: ${firstSSEError}`
                  ),
                  serverName,
                  { cause: firstSSEError }
                );
              }
              throw new MCPClientError(
                `Failed to connect to streamable HTTP server after trying to fall back to SSE: "${serverName}, url: ${url}": ${error} (SSE fallback failed with error ${firstSSEError})`,
                serverName,
                { cause: firstSSEError }
              );
            }
          }
        } else {
          // Provide specific error message for authentication failures
          if (code === 401) {
            throw new MCPClientError(
              createAuthenticationErrorMessage(
                serverName,
                url,
                "HTTP",
                `${error}`
              ),
              serverName,
              { cause: error }
            );
          }
          throw new MCPClientError(
            `Failed to connect to streamable HTTP server "${serverName}, url: ${url}" in ${connection.mode} mode: ${error}`,
            serverName,
            { cause: error }
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
    connection: SSEConnection
  ): Promise<void> {
    const { url, headers, reconnect, authProvider } = connection;

    try {
      await this.#clientConnections.getOrCreateClient(serverName, connection);
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
      if (MCPClientError.isInstance(error)) {
        throw error;
      }

      // Check if this is an authentication error that needs better messaging
      const isAuthError = error && getHttpErrorCode(error) === 401;

      if (isAuthError) {
        throw new MCPClientError(
          createAuthenticationErrorMessage(serverName, url, "SSE", `${error}`),
          serverName,
          { cause: error }
        );
      }

      throw new MCPClientError(
        `Failed to create SSE transport for server "${serverName}, url: ${url}": ${error}`,
        serverName,
        { cause: error }
      );
    }
  }

  /**
   * Set up reconnect handling for SSE (Streamable HTTP reconnects are more complex and are handled internally by the SDK)
   */
  private _setupSSEReconnect(
    serverName: string,
    transport: SSEClientTransport | StreamableHTTPClientTransport,
    connection: SSEConnection,
    reconnect: NonNullable<SSEConnection["reconnect"]>
  ): void {
    const originalOnClose = transport.onclose;
    const handleClose = async () => {
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
        await this._attemptReconnect(
          serverName,
          connection,
          reconnect.maxAttempts,
          reconnect.delayMs
        );
      }
    };
    transport.onclose = () => {
      handleClose().catch(() => {});
    };
  }

  /**
   * Load tools for a specific server
   */
  private async _loadToolsForServer(
    serverName: string,
    client: Client,
    cacheMode: CacheMode = "use",
    signal?: AbortSignal
  ): Promise<DynamicStructuredTool[]> {
    const existing = this.#toolsByClient.get(client);
    let previous = existing;
    let replacement:
      | { descriptorKey: string; tools: Promise<DynamicStructuredTool[]> }
      | undefined;
    const state = this.#toolDiscoveryState.get(client) ?? {
      inFlight: 0,
      ready: false,
    };
    let failure: unknown;
    state.inFlight += 1;
    this.#toolDiscoveryState.set(client, state);

    try {
      const { tools: descriptors } = await client.listTools(undefined, {
        cacheMode,
        signal,
      });

      const descriptorKey = JSON.stringify(descriptors);

      if (existing?.descriptorKey === descriptorKey) {
        const tools = await existing.tools;
        state.ready = true;
        return tools;
      }

      const tools = convertMcpTools(
        serverName,
        client,
        descriptors,
        this.#loadToolsOptions[serverName]
      );

      if (cacheMode !== "bypass") {
        previous = this.#toolsByClient.get(client);
        replacement = { descriptorKey, tools };
        this.#toolsByClient.set(client, replacement);
      }

      const loaded = await tools;
      state.ready = true;
      return loaded;
    } catch (error) {
      failure = error;
      // Only roll back the cache entry this call installed; a concurrent
      // discovery may have replaced it with a working catalog.
      if (replacement && this.#toolsByClient.get(client) === replacement) {
        if (previous) {
          this.#toolsByClient.set(client, previous);
        } else {
          this.#toolsByClient.delete(client);
        }
      }
    } finally {
      state.inFlight -= 1;
    }

    // Keep the connection alive while another discovery is still running, or
    // when tools from this client were already issued to a caller.
    if (state.inFlight === 0 && !state.ready) {
      this.#toolDiscoveryState.delete(client);

      try {
        await this.#clientConnections.release(client);
      } catch (cleanupError) {
        throw new AggregateError(
          [failure, cleanupError],
          `MCP discovery and cleanup failed for "${serverName}"`
        );
      }
    }

    throw new MCPClientError(
      `Failed to load tools from server "${serverName}": ${failure}`,
      serverName,
      { cause: failure }
    );
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
    connection: StdioConnection | SSEConnection,
    maxAttempts = 3,
    delayMs = 1000
  ): Promise<void> {
    const { signal } = this.#epoch;
    let connected = false;
    let attempts = 0;
    let lastError: unknown;

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

      try {
        // Wait before attempting to reconnect. A close during the backoff
        // wakes this immediately rather than letting the delay run out.
        if (delayMs) {
          await MCPAdapter.#sleep(delayMs, signal);
        }

        if (signal.aborted) {
          return;
        }

        // Initialize just this connection based on its type
        if (connection.transport === "stdio") {
          await this._initializeStdioConnection(serverName, connection);
        } else {
          await this._initializeSSEConnection(serverName, connection);
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
          this.#failedServers.delete(this.#clientConnections.identity(key));
        }
      } catch (error) {
        lastError = error;
      }
    }

    // Reconnection runs detached, so there is no caller to throw at and a
    // string policy has nowhere to surface this. Report an exhausted budget
    // through the handler when one is configured rather than failing silently.
    if (
      !connected &&
      !signal.aborted &&
      typeof this.#onConnectionError === "function"
    ) {
      await this.#onConnectionError({
        serverName,
        error:
          lastError ??
          new MCPClientError(
            `Failed to reconnect to MCP server "${serverName}" after ${attempts} attempts`,
            serverName
          ),
      });
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

    if (client) {
      this.#toolsByClient.delete(client);
    }
    await this.#clientConnections.delete({ serverName, authProvider, headers });
  }
}

/** @deprecated Use MCPAdapter. This alias shares the same implementation. */
export { MCPAdapter as MultiServerMCPClient };

function createServerSelectionSchema<Options extends z.ZodType>(
  optionsSchema: Options
) {
  return z.union([
    z
      .array(z.string())
      .transform((servers) => ({ servers, options: undefined })),
    z
      .tuple([z.array(z.string()), optionsSchema.optional()])
      .transform(([servers, options]) => ({ servers, options })),
  ]);
}
