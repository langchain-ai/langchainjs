import { configureElicitation } from "./elicitation.js";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import {
  SSEClientTransport,
  SSEClientTransportOptions,
  StreamableHTTPClientTransport,
  Client as MCPClient,
} from "@modelcontextprotocol/client";
import type {
  OAuthClientProvider,
  StreamableHTTPClientTransportOptions,
  StreamableHTTPReconnectionOptions,
} from "@modelcontextprotocol/client";
import { connectionSchema } from "./types.js";
import debug from "debug";
import type {
  ResolvedStreamableHTTPConnection,
  ResolvedStdioConnection,
} from "./types.js";

/**
 * TSDown automatically creates a JS file that allows us to consume the package.json file
 * within ESM and CJS modules.
 */
import packageJson from "../package.json" with { type: "json" };

const debugLog = debug("@langchain/mcp-adapters:connection");

export interface Client extends MCPClient {
  /**
   * Fork the client with a new set of headers, it either returns a new client or the same client if the headers are the same
   * @param headers - The headers to fork the client with
   * @returns The forked client
   */
  fork: (headers: Record<string, string>) => Promise<Client>;
}

export interface TransportOptions {
  serverName: string;
  headers?: Record<string, string>;
  authProvider?: OAuthClientProvider;
}

type ClientKeyObject = Omit<TransportOptions, "headers"> & {
  headers?: string;
};

export interface Connection {
  transport:
    | StreamableHTTPClientTransport
    | SSEClientTransport
    | StdioClientTransport;
  client: Client;
  transportOptions: ResolvedStdioConnection | ResolvedStreamableHTTPConnection;
  closeCallback: () => Promise<void>;
}

const transportTypes = ["http", "sse", "stdio"] as const;

/**
 * Manages a pool of MCP clients with different transport, server name and connection configurations.
 * This ensures we don't create multiple connections for the same server with the same configuration.
 */
export class ConnectionManager {
  #connections: Map<ClientKeyObject, Connection> = new Map();
  #identities: ClientKeyObject[] = [];
  #pending = new Map<ClientKeyObject, Promise<Client>>();
  #closing?: Promise<void>;

  constructor(
    private readonly onToolsChanged?: (options: TransportOptions) => void
  ) {}

  identity(options: TransportOptions): ClientKeyObject {
    const headers = serializeHeaders(options.headers);

    const existing = this.#identities.find(
      (key) =>
        key.serverName === options.serverName &&
        key.headers === headers &&
        key.authProvider === options.authProvider
    );

    if (existing) return existing;

    const key = {
      serverName: options.serverName,
      headers,
      authProvider: options.authProvider,
    };

    this.#identities.push(key);

    return key;
  }

  async createClient(
    type: "stdio",
    serverName: string,
    options: ResolvedStdioConnection
  ): Promise<Client>;
  async createClient(
    type: "http" | "sse",
    serverName: string,
    options: ResolvedStreamableHTTPConnection
  ): Promise<Client>;
  async createClient(
    ...args:
      | ["stdio", string, ResolvedStdioConnection]
      | ["sse", string, ResolvedStreamableHTTPConnection]
      | ["http", string, ResolvedStreamableHTTPConnection]
  ): Promise<Client> {
    if (this.#closing) throw new Error("MCP connections are closing");
    const [type, serverName, options] = args;

    const key = this.identity(
      type === "stdio"
        ? { serverName }
        : {
            serverName,
            headers: options.headers,
            authProvider: options.authProvider,
          }
    );

    const existing = this.#connections.get(key)?.client;

    if (existing) return existing;
    const pending = this.#pending.get(key);

    if (pending) return pending;
    const acquisition = this.#connect(args, key);
    this.#pending.set(key, acquisition);

    try {
      return await acquisition;
    } finally {
      this.#pending.delete(key);
    }
  }

  async #connect(
    args:
      | ["stdio", string, ResolvedStdioConnection]
      | ["sse", string, ResolvedStreamableHTTPConnection]
      | ["http", string, ResolvedStreamableHTTPConnection],
    key: ClientKeyObject
  ): Promise<Client> {
    const [type, serverName, options] = args;
    if (!transportTypes.includes(type)) {
      throw new Error(`Invalid transport type: ${type}`);
    }

    const transport =
      type === "http"
        ? await this.#createStreamableHTTPTransport(serverName, options)
        : type === "sse"
          ? await this.#createSSETransport(serverName, options)
          : await this.#createStdioTransport(options);

    // SDK LATEST_PROTOCOL_VERSION still names the legacy revision; pin the
    // modern revision explicitly so negotiation cannot fall back to legacy.
    const mcpClient = new MCPClient(
      {
        name: packageJson.name,
        version: packageJson.version,
      },
      {
        versionNegotiation: {
          mode: options.mode === "legacy" ? "legacy" : { pin: "2026-07-28" },
        },
        ...(options.mode === "legacy" && options.onElicitation
          ? {
              capabilities: { elicitation: { form: {}, url: {} } },
            }
          : {}),
        ...(options.mode === "modern"
          ? { inputRequired: { maxRounds: options.maxElicitationRounds } }
          : {}),
      }
    );

    if (options.mode === "legacy")
      configureElicitation(mcpClient, serverName, options.onElicitation);

    if (options.onMessage) {
      mcpClient.setNotificationHandler(
        "notifications/message",
        (notification) =>
          options.onMessage?.(notification.params, {
            server: serverName,
            options: connectionSchema.parse(options),
          })
      );
    }

    if (options.onInitialized) {
      mcpClient.setNotificationHandler("notifications/initialized", () =>
        options.onInitialized?.({
          server: serverName,
          options: connectionSchema.parse(options),
        })
      );
    }

    if (options.onCancelled) {
      mcpClient.setNotificationHandler(
        "notifications/cancelled",
        (notification) => {
          const { requestId, reason } = notification.params;

          if (requestId == null) {
            return;
          }

          const result = options.onCancelled?.(
            { requestId, reason },
            {
              server: serverName,
              options: connectionSchema.parse(options),
            }
          );

          if (result && typeof result.catch === "function") {
            result.catch(() => {
              /* ignore hook errors */
            });
          }
        }
      );
    }

    if (options.onPromptsListChanged) {
      mcpClient.setNotificationHandler(
        "notifications/prompts/list_changed",
        () =>
          options.onPromptsListChanged?.({
            server: serverName,
            options: connectionSchema.parse(options),
          })
      );
    }

    if (options.onResourcesListChanged) {
      mcpClient.setNotificationHandler(
        "notifications/resources/list_changed",
        () =>
          options.onResourcesListChanged?.({
            server: serverName,
            options: connectionSchema.parse(options),
          })
      );
    }

    if (options.onResourcesUpdated) {
      mcpClient.setNotificationHandler(
        "notifications/resources/updated",
        (notification) =>
          options.onResourcesUpdated?.(notification.params, {
            server: serverName,
            options: connectionSchema.parse(options),
          })
      );
    }

    if (options.onToolsListChanged || this.onToolsChanged) {
      mcpClient.setNotificationHandler(
        "notifications/tools/list_changed",
        () => {
          this.onToolsChanged?.(
            options.transport === "stdio"
              ? { serverName }
              : {
                  serverName,
                  headers: options.headers,
                  authProvider: options.authProvider,
                }
          );

          return options.onToolsListChanged?.({
            server: serverName,
            options: connectionSchema.parse(options),
          });
        }
      );
    }

    try {
      await mcpClient.connect(transport);

      if (mcpClient.getProtocolEra() === "modern") {
        const capabilities = mcpClient.getServerCapabilities();

        const filter = {
          toolsListChanged: Boolean(
            (this.onToolsChanged || options.onToolsListChanged) &&
            capabilities?.tools?.listChanged
          ),
          promptsListChanged: Boolean(
            options.onPromptsListChanged && capabilities?.prompts?.listChanged
          ),
          resourcesListChanged: Boolean(
            options.onResourcesListChanged &&
            capabilities?.resources?.listChanged
          ),
        };

        if (Object.values(filter).some(Boolean)) await mcpClient.listen(filter);
      }
    } catch (error) {
      await Promise.allSettled([mcpClient.close(), transport.close()]);
      throw error;
    }

    const forkClient = (headers: Record<string, string>): Promise<Client> => {
      return this.#forkClient(key, headers);
    };

    const client = Object.assign(mcpClient, { fork: forkClient });

    this.#connections.set(key, {
      transport,
      client,
      transportOptions: options,
      closeCallback: async () => client.close(),
    });

    return client;
  }

  /**
   * Allows to fork a client with a new set of headers
   */
  #forkClient(
    key: ClientKeyObject,
    headers: Record<string, string>
  ): Promise<Client> {
    const [, connection] =
      [...this.#connections.entries()].find(([k]) => key === k) ?? [];

    if (!connection) {
      throw new Error("Transport not found");
    }

    if (Object.keys(headers).length === 0)
      return Promise.resolve(connection.client);
    const options = connection.transportOptions;

    if (options.transport === "stdio") {
      throw new Error("Forking stdio transport is not supported");
    }

    return this.createClient(options.transport, key.serverName, {
      ...options,
      headers: mergeHeaders(options.headers, headers),
    });
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
   * Get all clients
   * @returns All clients
   */
  getAllClients(): Client[] {
    return Array.from(this.#connections.values()).map(
      (connection) => connection.client
    );
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
    const key = this.identity(options);
    const connection = this.#connections.get(key);

    return connection ? { key, connection } : undefined;
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
  async delete(options?: TransportOptions): Promise<void> {
    if (this.#closing) return this.#closing;

    if (options) {
      const key = this.identity(options);
      await this.#pending.get(key)?.catch(() => undefined);
      const connection = this.#connections.get(key);
      this.#connections.delete(key);
      await connection?.closeCallback();

      return;
    }

    this.#closing = this.#closeAll();

    try {
      await this.#closing;
    } finally {
      this.#closing = undefined;
    }
  }

  async release(client: Client): Promise<void> {
    const entry = [...this.#connections.entries()].find(
      ([, connection]) => connection.client === client
    );

    if (!entry) return;
    this.#connections.delete(entry[0]);
    await entry[1].closeCallback();
  }

  async #closeAll(): Promise<void> {
    await Promise.allSettled(this.#pending.values());
    const connections = [...this.#connections.values()];
    this.#connections.clear();
    this.#identities = [];

    const results = await Promise.allSettled(
      connections.map((connection) => connection.closeCallback())
    );

    const errors = results.flatMap((result) =>
      result.status === "rejected" ? [result.reason] : []
    );

    if (errors.length)
      throw new AggregateError(errors, "Failed to close MCP connections");
  }

  /**
   * Get the transport for a specific client
   * @param client - The client to get the transport for
   */
  getTransport(
    client: Client
  ):
    | StreamableHTTPClientTransport
    | SSEClientTransport
    | StdioClientTransport
    | undefined;
  /**
   * Get the transport for a specific connection combination
   * @param options - The options to get the transport for
   */
  getTransport(
    options: TransportOptions
  ):
    | StreamableHTTPClientTransport
    | SSEClientTransport
    | StdioClientTransport
    | undefined;
  getTransport(
    opts: Client | TransportOptions
  ):
    | StreamableHTTPClientTransport
    | SSEClientTransport
    | StdioClientTransport
    | undefined {
    /**
     * if a client instance is passed in
     */
    if ("listTools" in opts) {
      const connection = [...this.#connections.values()].find(
        (connection) => connection.client === opts
      );
      return connection?.transport;
    }

    const result = this.#queryConnection(opts);
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
    const { command, args, env, stderr, cwd } = options;
    return new StdioClientTransport({
      command,
      args,
      stderr,
      cwd,
      // oxlint-disable-next-line no-process-env
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
  if (!headers || Object.keys(headers).length === 0) {
    return;
  }

  return JSON.stringify([...new Headers(headers)]);
}

/** HTTP header names are case-insensitive; later sources take precedence. */
export function mergeHeaders(
  base: Record<string, string> | undefined,
  overrides: Record<string, string> | undefined
): Record<string, string> {
  const headers = new Headers(base);

  for (const [name, value] of Object.entries(overrides ?? {}))
    headers.set(name, value);

  return Object.fromEntries(headers);
}
