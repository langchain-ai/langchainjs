import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import {
  SSEClientTransport,
  type SseError,
} from "@modelcontextprotocol/sdk/client/sse.js";
import {
  StreamableHTTPClientTransport,
  StreamableHTTPError,
  type StreamableHTTPReconnectionOptions,
} from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { StructuredToolInterface } from "@langchain/core/tools";
import debug from "debug";
import { z } from "zod";
import { loadMcpTools, LoadMcpToolsOptions } from "./tools.js";

// Read package name from package.json
let debugLog: debug.Debugger;
function getDebugLog() {
  if (!debugLog) {
    debugLog = debug("@langchain/mcp-adapters:client");
  }
  return debugLog;
}

/**
 * Stdio transport restart configuration
 */
export function createStdioRestartSchema() {
  return z
    .object({
      /**
       * Whether to automatically restart the process if it exits
       */
      enabled: z
        .boolean()
        .describe("Whether to automatically restart the process if it exits")
        .optional(),
      /**
       * Maximum number of restart attempts
       */
      maxAttempts: z
        .number()
        .describe("The maximum number of restart attempts")
        .optional(),
      /**
       * Delay in milliseconds between restart attempts
       */
      delayMs: z
        .number()
        .describe("The delay in milliseconds between restart attempts")
        .optional(),
    })
    .describe("Configuration for stdio transport restart");
}

/**
 * Stdio transport connection
 */
export function createStdioConnectionSchema() {
  return z
    .object({
      /**
       * Optional transport type, inferred from the structure of the config if not provided. Included
       * for compatibility with common MCP client config file formats.
       */
      transport: z.literal("stdio").optional(),
      /**
       * Optional transport type, inferred from the structure of the config if not provided. Included
       * for compatibility with common MCP client config file formats.
       */
      type: z.literal("stdio").optional(),
      /**
       * The executable to run the server (e.g. `node`, `npx`, etc)
       */
      command: z.string().describe("The executable to run the server"),
      /**
       * Array of command line arguments to pass to the executable
       */
      args: z
        .array(z.string())
        .describe("Command line arguments to pass to the executable"),
      /**
       * Environment variables to set when spawning the process.
       */
      env: z
        .record(z.string())
        .describe("The environment to use when spawning the process")
        .optional(),
      /**
       * The encoding to use when reading from the process
       */
      encoding: z
        .string()
        .describe("The encoding to use when reading from the process")
        .optional(),
      /**
       * How to handle stderr of the child process. This matches the semantics of Node's `child_process.spawn`
       *
       * The default is "inherit", meaning messages to stderr will be printed to the parent process's stderr.
       *
       * @default "inherit"
       */
      stderr: z
        .union([
          z.literal("overlapped"),
          z.literal("pipe"),
          z.literal("ignore"),
          z.literal("inherit"),
        ])
        .describe(
          "How to handle stderr of the child process. This matches the semantics of Node's `child_process.spawn`"
        )
        .optional()
        .default("inherit"),
      /**
       * The working directory to use when spawning the process.
       */
      cwd: z
        .string()
        .describe("The working directory to use when spawning the process")
        .optional(),
      /**
       * Additional restart settings
       */
      restart: createStdioRestartSchema()
        .describe("Settings for automatically restarting the server")
        .optional(),
    })
    .describe("Configuration for stdio transport connection");
}

/**
 * Streamable HTTP transport reconnection configuration
 */
export function createStreamableReconnectSchema() {
  return z
    .object({
      /**
       * Whether to automatically reconnect if the connection is lost
       */
      enabled: z
        .boolean()
        .describe(
          "Whether to automatically reconnect if the connection is lost"
        )
        .optional(),
      /**
       * Maximum number of reconnection attempts
       */
      maxAttempts: z
        .number()
        .describe("The maximum number of reconnection attempts")
        .optional(),
      /**
       * Delay in milliseconds between reconnection attempts
       */
      delayMs: z
        .number()
        .describe("The delay in milliseconds between reconnection attempts")
        .optional(),
    })
    .describe("Configuration for streamable HTTP transport reconnection");
}

/**
 * Streamable HTTP transport connection
 */
export function createStreamableHTTPConnectionSchema() {
  return z
    .object({
      /**
       * Optional transport type, inferred from the structure of the config. If "sse", will not attempt
       * to connect using streamable HTTP.
       */
      transport: z.union([z.literal("http"), z.literal("sse")]).optional(),
      /**
       * Optional transport type, inferred from the structure of the config. If "sse", will not attempt
       * to connect using streamable HTTP.
       */
      type: z.union([z.literal("http"), z.literal("sse")]).optional(),
      /**
       * The URL to connect to
       */
      url: z.string().url(),
      /**
       * Additional headers to send with the request, useful for authentication
       */
      headers: z.record(z.string()).optional(),
      /**
       * Whether to use Node's EventSource for SSE connections (not applicable to streamable HTTP)
       *
       * @default false
       */
      useNodeEventSource: z.boolean().optional().default(false),
      /**
       * Additional reconnection settings.
       */
      reconnect: createStreamableReconnectSchema().optional(),
      /**
       * Whether to automatically fallback to SSE if Streamable HTTP is not available or not supported
       *
       * @default true
       */
      automaticSSEFallback: z.boolean().optional().default(true),
    })
    .describe("Configuration for streamable HTTP transport connection");
}

/**
 * Create combined schema for all transport connection types
 */
export function createConnectionSchema() {
  return z
    .union([
      createStdioConnectionSchema(),
      createStreamableHTTPConnectionSchema(),
    ])
    .describe("Configuration for a single MCP server");
}

/**
 * {@link MultiServerMCPClient} configuration
 */
export function createClientConfigSchema() {
  return z
    .object({
      /**
       * A map of server names to their configuration
       */
      mcpServers: z
        .record(createConnectionSchema())
        .describe("A map of server names to their configuration"),
      /**
       * Whether to throw an error if a tool fails to load
       *
       * @default true
       */
      throwOnLoadError: z
        .boolean()
        .describe("Whether to throw an error if a tool fails to load")
        .optional()
        .default(true),
      /**
       * Whether to prefix tool names with the server name. Prefixes are separated by double
       * underscores (example: `calculator_server_1__add`).
       *
       * @default true
       */
      prefixToolNameWithServerName: z
        .boolean()
        .describe("Whether to prefix tool names with the server name")
        .optional()
        .default(true),
      /**
       * An additional prefix to add to the tool name Prefixes are separated by double underscores
       * (example: `mcp__add`).
       *
       * @default "mcp"
       */
      additionalToolNamePrefix: z
        .string()
        .describe("An additional prefix to add to the tool name")
        .optional()
        .default("mcp"),
    })
    .describe("Configuration for the MCP client");
}

/**
 * Configuration for stdio transport connection
 */
export type StdioConnection = z.input<
  ReturnType<typeof createStdioConnectionSchema>
>;

/**
 * Type for {@link StdioConnection} with default values applied.
 */
export type ResolvedStdioConnection = z.infer<
  ReturnType<typeof createStdioConnectionSchema>
>;

/**
 * Configuration for streamable HTTP transport connection
 */
export type StreamableHTTPConnection = z.input<
  ReturnType<typeof createStreamableHTTPConnectionSchema>
>;

/**
 * Type for {@link StreamableHTTPConnection} with default values applied.
 */
export type ResolvedStreamableHTTPConnection = z.infer<
  ReturnType<typeof createStreamableHTTPConnectionSchema>
>;

/**
 * Union type for all transport connection types
 */
export type Connection = z.input<ReturnType<typeof createConnectionSchema>>;

/**
 * Type for {@link MultiServerMCPClient} configuration
 */
export type ClientConfig = z.input<ReturnType<typeof createClientConfigSchema>>;

/**
 * Type for {@link Connection} with default values applied.
 */
export type ResolvedConnection = z.infer<
  ReturnType<typeof createConnectionSchema>
>;

/**
 * Type for {@link MultiServerMCPClient} configuration, with default values applied.
 */
export type ResolvedClientConfig = z.infer<
  ReturnType<typeof createClientConfigSchema>
>;

/**
 * Error class for MCP client operations
 */
export class MCPClientError extends Error {
  constructor(message: string, public readonly serverName?: string) {
    super(message);
    this.name = "MCPClientError";
  }
}

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
      // eslint-disable-next-line no-new
      new URL(connection.url);
      return true;
    } catch (error) {
      return false;
    }
  }

  return false;
}

/**
 * Client for connecting to multiple MCP servers and loading LangChain-compatible tools.
 */
export class MultiServerMCPClient {
  private _clients: Record<string, Client> = {};

  private _serverNameToTools: Record<string, StructuredToolInterface[]> = {};

  private _connections?: Record<string, ResolvedConnection>;

  private _loadToolsOptions: LoadMcpToolsOptions;

  private _cleanupFunctions: Array<() => Promise<void>> = [];

  private _transportInstances: Record<
    string,
    StdioClientTransport | SSEClientTransport | StreamableHTTPClientTransport
  > = {};

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
   * @param connections - Optional connections to initialize
   */
  constructor(config: ClientConfig | Record<string, Connection>) {
    let parsedServerConfig: ResolvedClientConfig;

    const configSchema = createClientConfigSchema();

    if ("mcpServers" in config) {
      parsedServerConfig = configSchema.parse(config);
    } else {
      // two step parse so parse errors are referencing the correct object paths
      const parsedMcpServers = z.record(createConnectionSchema()).parse(config);

      parsedServerConfig = configSchema.parse({ mcpServers: parsedMcpServers });
    }

    if (Object.keys(parsedServerConfig.mcpServers).length === 0) {
      throw new MCPClientError("No MCP servers provided");
    }

    this._loadToolsOptions = {
      throwOnLoadError: parsedServerConfig.throwOnLoadError,
      prefixToolNameWithServerName:
        parsedServerConfig.prefixToolNameWithServerName,
      additionalToolNamePrefix: parsedServerConfig.additionalToolNamePrefix,
    };

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
  async initializeConnections(): Promise<
    Record<string, StructuredToolInterface[]>
  > {
    if (!this._connections || Object.keys(this._connections).length === 0) {
      throw new MCPClientError("No connections to initialize");
    }

    const connectionsToInit: [string, ResolvedConnection][] = Array.from(
      Object.entries(this._connections).filter(
        ([serverName]) => this._clients[serverName] === undefined
      )
    );

    for (const [serverName, connection] of connectionsToInit) {
      getDebugLog()(
        `INFO: Initializing connection to server "${serverName}"...`
      );

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
   * @returns A flattened array of tools from the specified servers (or all servers)
   */
  async getTools(...servers: string[]): Promise<StructuredToolInterface[]> {
    await this.initializeConnections();
    if (servers.length === 0) {
      return this._getAllToolsAsFlatArray();
    }
    return this._getToolsFromServers(servers);
  }

  /**
   * Get a the MCP client for a specific server. Useful for fetching prompts or resources from that server.
   *
   * @param serverName - The name of the server
   * @returns The client for the server, or undefined if the server is not connected
   */
  async getClient(serverName: string): Promise<Client | undefined> {
    await this.initializeConnections();
    return this._clients[serverName];
  }

  /**
   * Close all connections.
   */
  async close(): Promise<void> {
    getDebugLog()(`INFO: Closing all MCP connections...`);

    for (const cleanup of this._cleanupFunctions) {
      try {
        await cleanup();
      } catch (error) {
        getDebugLog()(`ERROR: Error during cleanup: ${error}`);
      }
    }

    this._cleanupFunctions = [];
    this._clients = {};
    this._serverNameToTools = {};
    this._transportInstances = {};

    getDebugLog()(`INFO: All MCP connections closed`);
  }

  /**
   * Initialize a stdio connection
   */
  private async _initializeStdioConnection(
    serverName: string,
    connection: ResolvedStdioConnection
  ): Promise<void> {
    const { command, args, env, restart, stderr } = connection;

    getDebugLog()(
      `DEBUG: Creating stdio transport for server "${serverName}" with command: ${command} ${args.join(
        " "
      )}`
    );

    const transport = new StdioClientTransport({
      command,
      args,
      env,
      stderr,
    });

    this._transportInstances[serverName] = transport;

    const client = new Client({
      name: "langchain-mcp-adapter",
      version: "0.1.0",
    });

    try {
      await client.connect(transport);

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

    this._clients[serverName] = client;

    const cleanup = async () => {
      getDebugLog()(
        `DEBUG: Closing stdio transport for server "${serverName}"`
      );
      await transport.close();
    };

    this._cleanupFunctions.push(cleanup);

    // Load tools for this server
    await this._loadToolsForServer(serverName, client);
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
    // eslint-disable-next-line no-param-reassign, @typescript-eslint/no-misused-promises
    transport.onclose = async () => {
      if (originalOnClose) {
        await originalOnClose();
      }

      // Only attempt restart if we haven't cleaned up
      if (this._clients[serverName]) {
        getDebugLog()(
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
    const {
      url,
      headers,
      reconnect,
      type: typeField,
      transport: transportField,
    } = connection;

    const automaticSSEFallback = connection.automaticSSEFallback ?? true;

    const transportType = typeField || transportField;

    getDebugLog()(
      `DEBUG: Creating SSE transport for server "${serverName}" with URL: ${url}`
    );

    if (transportType === "http" || transportType == null) {
      const transport = await this._createStreamableHTTPTransport(
        serverName,
        url,
        headers,
        reconnect
      );
      this._transportInstances[serverName] = transport;

      const client = new Client({
        name: "langchain-mcp-adapter",
        version: "0.1.0",
      });

      try {
        await client.connect(transport);

        this._clients[serverName] = client;

        const cleanup = async () => {
          getDebugLog()(
            `DEBUG: Closing streamable HTTP transport for server "${serverName}"`
          );
          await transport.close();
        };

        this._cleanupFunctions.push(cleanup);

        // Load tools for this server
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
                throw new MCPClientError(
                  `Failed to connect to streamable HTTP server "${serverName}, url: ${url}": ${error}. Additionally, tried falling back to SSE at ${url} and ${sseUrl}, but this also failed: ${secondSSEError}`,
                  serverName
                );
              }
            } else {
              throw new MCPClientError(
                `Failed to connect to streamable HTTP server after trying to fall back to SSE: "${serverName}, url: ${url}": ${error} (SSE fallback failed with error ${firstSSEError})`,
                serverName
              );
            }
          }
        } else {
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
   */
  private async _initializeSSEConnection(
    serverName: string,
    connection: ResolvedStreamableHTTPConnection // used for both SSE and streamable HTTP
  ): Promise<void> {
    const { url, headers, useNodeEventSource, reconnect } = connection;

    try {
      const transport = await this._createSSETransport(
        serverName,
        url,
        headers,
        useNodeEventSource
      );
      this._transportInstances[serverName] = transport;

      const client = new Client({
        name: "langchain-mcp-adapter",
        version: "0.1.0",
      });

      try {
        await client.connect(transport);

        // Set up auto-reconnect if configured
        if (reconnect?.enabled) {
          this._setupSSEReconnect(serverName, transport, connection, reconnect);
        }
      } catch (error) {
        throw new MCPClientError(
          `Failed to connect to SSE server "${serverName}": ${error}`,
          serverName
        );
      }

      this._clients[serverName] = client;

      const cleanup = async () => {
        getDebugLog()(
          `DEBUG: Closing SSE transport for server "${serverName}"`
        );
        await transport.close();
      };

      this._cleanupFunctions.push(cleanup);

      // Load tools for this server
      await this._loadToolsForServer(serverName, client);
    } catch (error) {
      throw new MCPClientError(
        `Failed to create SSE transport for server "${serverName}, url: ${url}": ${error}`,
        serverName
      );
    }
  }

  /**
   * Create an SSE transport with appropriate EventSource implementation
   */
  private async _createSSETransport(
    serverName: string,
    url: string,
    headers?: Record<string, string>,
    useNodeEventSource?: boolean
  ): Promise<SSEClientTransport> {
    if (!headers) {
      // Simple case - no headers, use default transport
      return new SSEClientTransport(new URL(url));
    }

    getDebugLog()(
      `DEBUG: Using custom headers for SSE transport to server "${serverName}"`
    );

    // If useNodeEventSource is true, try Node.js implementations
    if (useNodeEventSource) {
      return await this._createNodeEventSourceTransport(
        serverName,
        url,
        headers
      );
    }

    // For browser environments, use the basic requestInit approach
    getDebugLog()(
      `DEBUG: Using browser EventSource for server "${serverName}". Headers may not be applied correctly.`
    );
    getDebugLog()(
      `DEBUG: For better headers support in browsers, consider using a custom SSE implementation.`
    );

    return new SSEClientTransport(new URL(url), {
      requestInit: { headers },
    });
  }

  private async _createStreamableHTTPTransport(
    serverName: string,
    url: string,
    headers?: Record<string, string>,
    reconnect?: ResolvedStreamableHTTPConnection["reconnect"]
  ): Promise<StreamableHTTPClientTransport> {
    if (!headers) {
      // Simple case - no headers, use default transport
      return new StreamableHTTPClientTransport(new URL(url));
    } else {
      getDebugLog()(
        `DEBUG: Using custom headers for SSE transport to server "${serverName}"`
      );

      // partial options object for setting up reconnections
      const r: {
        reconnectionOptions: StreamableHTTPReconnectionOptions;
      } = {
        reconnectionOptions: {
          initialReconnectionDelay: reconnect?.delayMs ?? 1000, // MCP default
          maxReconnectionDelay: reconnect?.delayMs ?? 30000, // MCP default
          maxRetries: reconnect?.maxAttempts ?? 2, // MCP default
          reconnectionDelayGrowFactor: 1.5, // MCP default
        },
      };

      if (reconnect != null && reconnect.enabled === false) {
        r.reconnectionOptions.maxRetries = 0;
      }

      return new StreamableHTTPClientTransport(new URL(url), {
        requestInit: { headers },
        // don't set if reconnect is null so we rely on SDK defaults
        ...(reconnect == null ? {} : r),
      });
    }
  }

  /**
   * Create an EventSource transport for Node.js environments
   */
  private async _createNodeEventSourceTransport(
    serverName: string,
    url: string,
    headers: Record<string, string>
  ): Promise<SSEClientTransport> {
    // First try to use extended-eventsource which has better headers support
    try {
      const ExtendedEventSourceModule = await import("extended-eventsource");
      const ExtendedEventSource = ExtendedEventSourceModule.EventSource;

      getDebugLog()(
        `DEBUG: Using Extended EventSource for server "${serverName}"`
      );
      getDebugLog()(
        `DEBUG: Setting headers for Extended EventSource: ${JSON.stringify(
          headers
        )}`
      );

      // Override the global EventSource with the extended implementation
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).EventSource = ExtendedEventSource;

      // For Extended EventSource, create the SSE transport
      return new SSEClientTransport(new URL(url), {
        eventSourceInit: {},
        requestInit: { headers },
      });
    } catch (extendedError) {
      // Fall back to standard eventsource if extended-eventsource is not available
      getDebugLog()(
        `DEBUG: Extended EventSource not available, falling back to standard EventSource: ${extendedError}`
      );

      try {
        // Dynamically import the eventsource package
        // eslint-disable-next-line import/no-extraneous-dependencies
        const EventSourceModule = await import("eventsource");
        const EventSource =
          "default" in EventSourceModule
            ? EventSourceModule.default
            : EventSourceModule.EventSource;

        getDebugLog()(
          `DEBUG: Using Node.js EventSource for server "${serverName}"`
        );
        getDebugLog()(
          `DEBUG: Setting headers for EventSource: ${JSON.stringify(headers)}`
        );

        // Override the global EventSource with the Node.js implementation
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (globalThis as any).EventSource = EventSource;

        // Create transport with headers correctly configured for Node.js EventSource
        return new SSEClientTransport(new URL(url), {
          // Pass the headers to both eventSourceInit and requestInit for compatibility
          requestInit: { headers },
        });
      } catch (nodeError) {
        getDebugLog()(
          `WARN: Failed to load EventSource packages for server "${serverName}". Headers may not be applied to SSE connection: ${nodeError}`
        );

        // Last resort fallback
        return new SSEClientTransport(new URL(url), {
          requestInit: { headers },
        });
      }
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
    // eslint-disable-next-line @typescript-eslint/no-misused-promises, no-param-reassign
    transport.onclose = async () => {
      if (originalOnClose) {
        await originalOnClose();
      }

      // Only attempt reconnect if we haven't cleaned up
      if (this._clients[serverName]) {
        getDebugLog()(
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
      getDebugLog()(`DEBUG: Loading tools for server "${serverName}"...`);
      const tools = await loadMcpTools(
        serverName,
        client,
        this._loadToolsOptions
      );
      this._serverNameToTools[serverName] = tools;
      getDebugLog()(
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
    this._cleanupServerResources(serverName);

    while (
      !connected &&
      (maxAttempts === undefined || attempts < maxAttempts)
    ) {
      attempts += 1;
      getDebugLog()(
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
        if (this._clients[serverName]) {
          connected = true;
          getDebugLog()(
            `INFO: Successfully reconnected to server "${serverName}"`
          );
        }
      } catch (error) {
        getDebugLog()(
          `ERROR: Failed to reconnect to server "${serverName}" (attempt ${attempts}): ${error}`
        );
      }
    }

    if (!connected) {
      getDebugLog()(
        `ERROR: Failed to reconnect to server "${serverName}" after ${attempts} attempts`
      );
    }
  }

  /**
   * Clean up resources for a specific server
   */
  private _cleanupServerResources(serverName: string): void {
    delete this._clients[serverName];
    delete this._serverNameToTools[serverName];
    delete this._transportInstances[serverName];
  }

  /**
   * Get all tools from all servers as a flat array.
   *
   * @returns A flattened array of all tools
   */
  private _getAllToolsAsFlatArray(): StructuredToolInterface[] {
    const allTools: StructuredToolInterface[] = [];
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
  private _getToolsFromServers(
    serverNames: string[]
  ): StructuredToolInterface[] {
    const allTools: StructuredToolInterface[] = [];
    for (const serverName of serverNames) {
      const tools = this._serverNameToTools[serverName];
      if (tools) {
        allTools.push(...tools);
      }
    }
    return allTools;
  }
}
