import { MCPClientError } from "./utils/errors.js";
import { configureElicitation } from "./elicitation.js";
import { StdioClientTransport } from "@modelcontextprotocol/client/stdio";
import {
  SSEClientTransport,
  SSEClientTransportOptions,
  StreamableHTTPClientTransport,
  Client as MCPClient,
} from "@modelcontextprotocol/client";
import type {
  ClientOptions,
  OAuthClientProvider,
  StreamableHTTPClientTransportOptions,
  StreamableHTTPReconnectionOptions,
  Transport,
} from "@modelcontextprotocol/client";
import {
  ClientConnection,
  Connection as ConnectionSchema,
  InProcessConnection,
  isDescriptorConnection,
} from "./types.js";
import type {
  Connection as ResolvedConnection,
  DescriptorConnection as ResolvedDescriptorConnection,
  SSEConnection as ResolvedSSEConnection,
  StdioConnection as ResolvedStdioConnection,
} from "./types.js";
import { connectInProcessServer } from "./in-process.js";
import { iife, mergeHeaders, serializeHeaders } from "./utils/misc.js";

export interface Client extends MCPClient {
  /**
   * Fork the client with a new set of headers, it either returns a new client or the same client if the headers are the same
   * @param headers - The headers to fork the client with
   * @returns The forked client
   */
  fork?: (headers: Record<string, string>) => Promise<Client>;
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
  transport?: Transport;
  client: Client;
  transportOptions: ResolvedConnection;
  closeCallback: () => Promise<void>;
}

function connectionTransportOptions(
  serverName: string,
  connection: ResolvedConnection
): TransportOptions {
  return isDescriptorConnection(connection) && connection.transport !== "stdio"
    ? {
        serverName,
        headers: connection.headers,
        authProvider: connection.authProvider,
      }
    : { serverName };
}

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

  async getOrCreateClient(
    serverName: string,
    connection: ResolvedConnection
  ): Promise<Client> {
    if (this.#closing) throw new Error("MCP connections are closing");
    const key = this.identity(
      connectionTransportOptions(serverName, connection)
    );
    const existing = this.#connections.get(key)?.client;
    if (existing) return existing;

    const pending = this.#pending.get(key);
    if (pending) return pending;

    const opening = this.#openAndStore(serverName, connection, key);
    this.#pending.set(key, opening);

    return opening.finally(() => {
      this.#pending.delete(key);
    });
  }

  async #openAndStore(
    serverName: string,
    options: ResolvedConnection,
    key: ClientKeyObject
  ): Promise<Client> {
    let connection: Connection;
    if (isDescriptorConnection(options)) {
      connection = await this.#openDescriptor(serverName, options, key);
    } else {
      const client = ClientConnection.safeParse(options);
      if (client.success) {
        connection = {
          client: client.data,
          transportOptions: client.data,
          closeCallback: async () => {},
        };
      } else {
        const server = InProcessConnection.parse(options);
        connection = await connectInProcessServer(server, {
          serverName,
          onToolsChanged: this.onToolsChanged
            ? () => this.onToolsChanged?.({ serverName })
            : undefined,
        });
      }
    }

    this.#connections.set(key, connection);
    return connection.client;
  }

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

  async #openDescriptor(
    serverName: string,
    options: ResolvedDescriptorConnection,
    key: ClientKeyObject
  ): Promise<Connection> {
    const transport =
      options.transport === "http"
        ? await this.#createStreamableHTTPTransport(
            options as ResolvedSSEConnection
          )
        : options.transport === "sse"
          ? await this.#createSSETransport(options as ResolvedSSEConnection)
          : await this.#createStdioTransport(
              options as ResolvedStdioConnection
            );

    const identity = {
      name: "@langchain/mcp-adapters",
      version: __PKG_VERSION__,
    };
    const clientOptions = iife<ClientOptions>(() => {
      if (options.mode === "legacy" || options.transport === "sse") {
        if (options.mode === "legacy" && options.onElicitation) {
          return {
            versionNegotiation: { mode: "legacy" },
            capabilities: { elicitation: { form: {}, url: {} } },
          };
        }

        return { versionNegotiation: { mode: "legacy" } };
      }

      return {
        versionNegotiation: {
          mode: options.mode === "modern" ? { pin: "2026-07-28" } : "auto",
        },
      };
    });

    const mcpClient = new MCPClient(identity, clientOptions);

    if (options.mode === "legacy")
      configureElicitation(mcpClient, serverName, options.onElicitation);

    if (options.onMessage) {
      mcpClient.setNotificationHandler(
        "notifications/message",
        (notification) =>
          options.onMessage?.(notification.params, {
            server: serverName,
            options: ConnectionSchema.parse(options),
          })
      );
    }

    if (options.mode === "legacy" && options.onInitialized) {
      mcpClient.setNotificationHandler("notifications/initialized", () =>
        options.onInitialized?.({
          server: serverName,
          options: ConnectionSchema.parse(options),
        })
      );
    }

    if (options.onPromptsListChanged) {
      mcpClient.setNotificationHandler(
        "notifications/prompts/list_changed",
        () =>
          options.onPromptsListChanged?.({
            server: serverName,
            options: ConnectionSchema.parse(options),
          })
      );
    }

    if (options.onResourcesListChanged) {
      mcpClient.setNotificationHandler(
        "notifications/resources/list_changed",
        () =>
          options.onResourcesListChanged?.({
            server: serverName,
            options: ConnectionSchema.parse(options),
          })
      );
    }

    if (options.onResourcesUpdated) {
      mcpClient.setNotificationHandler(
        "notifications/resources/updated",
        (notification) =>
          options.onResourcesUpdated?.(notification.params, {
            server: serverName,
            options: ConnectionSchema.parse(options),
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
            options: ConnectionSchema.parse(options),
          });
        }
      );
    }

    try {
      await mcpClient.connect(transport);

      const resourceSubscriptions = options.resourceSubscriptions ?? [];

      if (
        resourceSubscriptions.length > 0 &&
        !mcpClient.getServerCapabilities()?.resources?.subscribe
      ) {
        throw new MCPClientError(
          `MCP server "${serverName}" does not support resource subscriptions`,
          serverName
        );
      }

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

        if (
          Object.values(filter).some(Boolean) ||
          resourceSubscriptions.length > 0
        ) {
          await mcpClient.listen({ ...filter, resourceSubscriptions });
        }
      } else {
        await Promise.all(
          resourceSubscriptions.map((uri) =>
            mcpClient.subscribeResource({ uri })
          )
        );
      }
    } catch (error) {
      await Promise.allSettled([mcpClient.close(), transport.close()]);
      throw error;
    }

    const forkClient = (headers: Record<string, string>): Promise<Client> => {
      return this.#forkClient(key, headers);
    };

    const client = Object.assign(mcpClient, { fork: forkClient });

    return {
      transport,
      client,
      transportOptions: options,
      closeCallback: async () => client.close(),
    };
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

    if (!isDescriptorConnection(options)) {
      throw new Error("Forking a supplied MCP source is not supported");
    }
    if (options.transport !== "http" && options.transport !== "sse") {
      throw new Error(
        `Forking ${options.transport} transport is not supported`
      );
    }

    // Both HTTP transports merge. SSE used to replace the whole set, so forking an
    // SSE connection to add one header silently dropped its credentials.
    // `createClient` is overloaded per transport, so the literal has to reach
    // it narrowed rather than through a shared variable.
    const merged = mergeHeaders(options.headers, headers);

    return this.getOrCreateClient(key.serverName, {
      ...options,
      headers: merged,
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
  getTransport(client: Client): Transport | undefined;
  /**
   * Get the transport for a specific connection combination
   * @param options - The options to get the transport for
   */
  getTransport(options: TransportOptions): Transport | undefined;
  getTransport(opts: Client | TransportOptions): Transport | undefined {
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
    args: ResolvedSSEConnection
  ): Promise<StreamableHTTPClientTransport> {
    const { url, headers, reconnect, authProvider } = args;

    const options: StreamableHTTPClientTransportOptions = {
      ...(authProvider ? { authProvider } : {}),
      ...(headers ? { requestInit: { headers } } : {}),
    };

    if (args.mode !== "legacy") {
      options.reconnectionOptions = {
        maxRetries: 0,
        initialReconnectionDelay: 1000,
        maxReconnectionDelay: 30000,
        reconnectionDelayGrowFactor: 1.5,
      };
    } else if (reconnect != null) {
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

    // Only pass options if there are any, otherwise use default constructor
    return Object.keys(options).length > 0
      ? new StreamableHTTPClientTransport(new URL(url), options)
      : new StreamableHTTPClientTransport(new URL(url));
  }

  /**
   * Create an SSE transport with appropriate EventSource implementation
   *
   * @param url - The URL of the server
   * @param headers - The headers to send with the request
   * @param authProvider - The OAuth client provider to use for authentication
   * @returns The SSE transport
   */
  async #createSSETransport(
    args: ResolvedSSEConnection
  ): Promise<SSEClientTransport> {
    const { url, headers, authProvider } = args;

    // The transport authorizes the stream, applies `requestInit.headers` and
    // sets `Accept: text/event-stream` itself. SDK 1 skipped all three when a
    // caller supplied `eventSourceInit.fetch`, so the adapter reproduced them
    // by hand; SDK 2 wraps that fetch instead of replacing it.
    const options: SSEClientTransportOptions = {
      ...(authProvider ? { authProvider } : {}),
      ...(headers ? { requestInit: { headers } } : {}),
    };

    return new SSEClientTransport(new URL(url), options);
  }

  #createStdioTransport(
    options: ResolvedStdioConnection
  ): StdioClientTransport {
    const { command, args, env, stderr, cwd } = options;
    return new StdioClientTransport({
      command,
      args,
      env,
      stderr,
      cwd,
    });
  }
}
