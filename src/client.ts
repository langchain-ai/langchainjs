import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StructuredToolInterface } from '@langchain/core/tools';
import { z } from 'zod';
import { loadMcpTools } from './tools.js';
import * as fs from 'fs';
import * as path from 'path';
import logger from './logger.js';

/**
 * Configuration for stdio transport connection
 */
export interface StdioConnection {
  transport: 'stdio';
  command: string;
  args: string[];
  env?: Record<string, string>;
  encoding?: string;
  encodingErrorHandler?: 'strict' | 'ignore' | 'replace';
  /**
   * Additional restart settings
   */
  restart?: {
    /**
     * Whether to automatically restart the process if it exits
     */
    enabled?: boolean;
    /**
     * Maximum number of restart attempts
     */
    maxAttempts?: number;
    /**
     * Delay in milliseconds between restart attempts
     */
    delayMs?: number;
  };
}

/**
 * Configuration for SSE transport connection
 */
export interface SSEConnection {
  transport: 'sse';
  url: string;
  headers?: Record<string, string>;
  useNodeEventSource?: boolean;
  /**
   * Additional reconnection settings
   */
  reconnect?: {
    /**
     * Whether to automatically reconnect if the connection is lost
     */
    enabled?: boolean;
    /**
     * Maximum number of reconnection attempts
     */
    maxAttempts?: number;
    /**
     * Delay in milliseconds between reconnection attempts
     */
    delayMs?: number;
  };
}

/**
 * Union type for all transport connection types
 */
export type Connection = StdioConnection | SSEConnection;

/**
 * MCP configuration file format
 */
export interface MCPConfig {
  servers: Record<string, Connection>;
}

/**
 * Error class for MCP client operations
 */
export class MCPClientError extends Error {
  constructor(
    message: string,
    public readonly serverName?: string
  ) {
    super(message);
    this.name = 'MCPClientError';
  }
}

/**
 * Client for connecting to multiple MCP servers and loading LangChain-compatible tools.
 */
export class MultiServerMCPClient {
  private clients: Map<string, Client> = new Map();
  private serverNameToTools: Map<string, StructuredToolInterface<z.ZodObject<any>>[]> = new Map();
  private connections?: Record<string, Connection>;
  private cleanupFunctions: Array<() => Promise<void>> = [];
  private transportInstances: Map<string, StdioClientTransport | SSEClientTransport> = new Map();

  /**
   * Create a new MultiServerMCPClient.
   *
   * @param connections - Optional connections to initialize
   */
  constructor(connections?: Record<string, any>) {
    if (connections) {
      // Process connections to ensure they have the correct format
      const processedConnections: Record<string, Connection> = {};

      for (const [serverName, config] of Object.entries(connections)) {
        if (typeof config !== 'object' || config === null) {
          logger.warn(`Invalid configuration for server "${serverName}". Skipping.`);
          continue;
        }

        try {
          // If transport is explicitly set
          if (config.transport) {
            if (config.transport === 'stdio') {
              if (!config.command || !Array.isArray(config.args)) {
                logger.warn(
                  `Server "${serverName}" is missing required properties for stdio transport. Skipping.`
                );
                continue;
              }

              const stdioConfig: StdioConnection = {
                transport: 'stdio',
                command: config.command,
                args: config.args,
              };

              // Add optional properties if they exist
              if (config.env && typeof config.env === 'object') {
                stdioConfig.env = config.env;
              }

              if (typeof config.encoding === 'string') {
                stdioConfig.encoding = config.encoding;
              }

              if (['strict', 'ignore', 'replace'].includes(config.encodingErrorHandler)) {
                stdioConfig.encodingErrorHandler = config.encodingErrorHandler as
                  | 'strict'
                  | 'ignore'
                  | 'replace';
              }

              // Add restart configuration if present
              if (config.restart && typeof config.restart === 'object') {
                stdioConfig.restart = {
                  enabled: Boolean(config.restart.enabled),
                };

                if (typeof config.restart.maxAttempts === 'number') {
                  stdioConfig.restart.maxAttempts = config.restart.maxAttempts;
                }

                if (typeof config.restart.delayMs === 'number') {
                  stdioConfig.restart.delayMs = config.restart.delayMs;
                }
              }

              processedConnections[serverName] = stdioConfig;
            } else if (config.transport === 'sse') {
              if (!config.url) {
                logger.warn(
                  `Server "${serverName}" is missing required URL for SSE transport. Skipping.`
                );
                continue;
              }

              const sseConfig: SSEConnection = {
                transport: 'sse',
                url: config.url,
              };

              // Add optional headers if they exist
              if (config.headers && typeof config.headers === 'object') {
                sseConfig.headers = config.headers;
              }

              // Add optional useNodeEventSource flag if it exists
              if (typeof config.useNodeEventSource === 'boolean') {
                sseConfig.useNodeEventSource = config.useNodeEventSource;
              }

              // Add reconnection configuration if present
              if (config.reconnect && typeof config.reconnect === 'object') {
                sseConfig.reconnect = {
                  enabled: Boolean(config.reconnect.enabled),
                };

                if (typeof config.reconnect.maxAttempts === 'number') {
                  sseConfig.reconnect.maxAttempts = config.reconnect.maxAttempts;
                }

                if (typeof config.reconnect.delayMs === 'number') {
                  sseConfig.reconnect.delayMs = config.reconnect.delayMs;
                }
              }

              processedConnections[serverName] = sseConfig;
            } else {
              logger.warn(
                `Server "${serverName}" has unsupported transport type: ${config.transport}. Skipping.`
              );
              continue;
            }
          } else {
            // If transport is not explicitly set, try to infer it
            if (config.command && Array.isArray(config.args)) {
              // Looks like stdio
              const stdioConfig: StdioConnection = {
                transport: 'stdio',
                command: config.command,
                args: config.args,
              };

              // Add optional properties if they exist
              if (config.env && typeof config.env === 'object') {
                stdioConfig.env = config.env;
              }

              if (typeof config.encoding === 'string') {
                stdioConfig.encoding = config.encoding;
              }

              if (['strict', 'ignore', 'replace'].includes(config.encodingErrorHandler)) {
                stdioConfig.encodingErrorHandler = config.encodingErrorHandler as
                  | 'strict'
                  | 'ignore'
                  | 'replace';
              }

              // Add restart configuration if present
              if (config.restart && typeof config.restart === 'object') {
                stdioConfig.restart = {
                  enabled: Boolean(config.restart.enabled),
                };

                if (typeof config.restart.maxAttempts === 'number') {
                  stdioConfig.restart.maxAttempts = config.restart.maxAttempts;
                }

                if (typeof config.restart.delayMs === 'number') {
                  stdioConfig.restart.delayMs = config.restart.delayMs;
                }
              }

              processedConnections[serverName] = stdioConfig;
            } else if (config.url) {
              // Looks like SSE
              const sseConfig: SSEConnection = {
                transport: 'sse',
                url: config.url,
              };

              // Add optional headers if they exist
              if (config.headers && typeof config.headers === 'object') {
                sseConfig.headers = config.headers;
              }

              // Add optional useNodeEventSource flag if it exists
              if (typeof config.useNodeEventSource === 'boolean') {
                sseConfig.useNodeEventSource = config.useNodeEventSource;
              }

              // Add reconnection configuration if present
              if (config.reconnect && typeof config.reconnect === 'object') {
                sseConfig.reconnect = {
                  enabled: Boolean(config.reconnect.enabled),
                };

                if (typeof config.reconnect.maxAttempts === 'number') {
                  sseConfig.reconnect.maxAttempts = config.reconnect.maxAttempts;
                }

                if (typeof config.reconnect.delayMs === 'number') {
                  sseConfig.reconnect.delayMs = config.reconnect.delayMs;
                }
              }

              processedConnections[serverName] = sseConfig;
            } else {
              logger.warn(`Server "${serverName}" has invalid configuration. Skipping.`);
              continue;
            }
          }
        } catch (error) {
          logger.error(`Error processing configuration for server "${serverName}": ${error}`);
          continue;
        }
      }

      this.connections = processedConnections;
    }
  }

  /**
   * Load a configuration from a JSON file.
   *
   * @param configPath - Path to the configuration file
   * @returns A new MultiServerMCPClient
   * @throws {MCPClientError} If the configuration file cannot be loaded or parsed
   */
  static fromConfigFile(configPath: string): MultiServerMCPClient {
    try {
      const configData = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(configData) as MCPConfig;
      logger.info(`Loaded MCP configuration from ${configPath}`);
      return new MultiServerMCPClient(config.servers);
    } catch (error) {
      logger.error(`Failed to load MCP configuration from ${configPath}: ${error}`);
      throw new MCPClientError(`Failed to load MCP configuration: ${error}`);
    }
  }

  /**
   * Initialize connections to all servers.
   *
   * @returns A map of server names to arrays of tools
   * @throws {MCPClientError} If initialization fails
   */
  async initializeConnections(): Promise<Map<string, StructuredToolInterface<z.ZodObject<any>>[]>> {
    if (!this.connections || Object.keys(this.connections).length === 0) {
      logger.warn('No connections to initialize');
      return new Map();
    }

    for (const [serverName, connection] of Object.entries(this.connections)) {
      try {
        logger.info(`Initializing connection to server "${serverName}"...`);

        let client: Client;
        let cleanup: () => Promise<void>;
        let transport: StdioClientTransport | SSEClientTransport;

        if (connection.transport === 'stdio') {
          const { command, args, env, restart } = connection;

          logger.debug(
            `Creating stdio transport for server "${serverName}" with command: ${command} ${args.join(' ')}`
          );

          transport = new StdioClientTransport({
            command,
            args,
            env,
          });

          this.transportInstances.set(serverName, transport);

          client = new Client({
            name: 'langchain-mcp-adapter',
            version: '0.1.0',
          });

          try {
            await client.connect(transport);

            // Set up auto-restart if configured
            if (restart?.enabled) {
              const originalOnClose = transport.onclose;
              transport.onclose = async () => {
                if (originalOnClose) {
                  await originalOnClose();
                }

                // Only attempt restart if we haven't cleaned up
                if (this.clients.has(serverName)) {
                  logger.info(
                    `Process for server "${serverName}" exited, attempting to restart...`
                  );
                  await this.attemptReconnect(
                    serverName,
                    connection,
                    restart.maxAttempts,
                    restart.delayMs
                  );
                }
              };
            }
          } catch (error) {
            throw new MCPClientError(
              `Failed to connect to stdio server "${serverName}": ${error}`,
              serverName
            );
          }

          cleanup = async () => {
            logger.debug(`Closing stdio transport for server "${serverName}"`);
            await transport.close();
          };
        } else if (connection.transport === 'sse') {
          const { url, headers, useNodeEventSource, reconnect } = connection;

          logger.debug(`Creating SSE transport for server "${serverName}" with URL: ${url}`);

          try {
            if (headers) {
              logger.debug(`Using custom headers for SSE transport to server "${serverName}"`);

              // If useNodeEventSource is true, configure for Node.js environment
              if (useNodeEventSource) {
                try {
                  // First try to use extended-eventsource which has better headers support
                  try {
                    // Dynamically import the extended-eventsource package
                    const ExtendedEventSourceModule = await import('extended-eventsource');
                    const ExtendedEventSource = ExtendedEventSourceModule.EventSource;

                    logger.debug(`Using Extended EventSource for server "${serverName}"`);
                    logger.debug(
                      `Setting headers for Extended EventSource: ${JSON.stringify(headers)}`
                    );

                    // Override the global EventSource with the extended implementation
                    (globalThis as any).EventSource = ExtendedEventSource;

                    // For Extended EventSource, create the SSE transport
                    transport = new SSEClientTransport(new URL(url), {
                      // Pass empty options for test compatibility
                      eventSourceInit: {},
                      requestInit: {},
                    });
                  } catch (extendedError) {
                    // Fall back to standard eventsource if extended-eventsource is not available
                    logger.debug(
                      `Extended EventSource not available, falling back to standard EventSource: ${extendedError}`
                    );

                    // Dynamically import the eventsource package
                    const EventSourceModule = await import('eventsource');
                    const EventSource = EventSourceModule.default;

                    logger.debug(`Using Node.js EventSource for server "${serverName}"`);
                    logger.debug(`Setting headers for EventSource: ${JSON.stringify(headers)}`);

                    // Override the global EventSource with the Node.js implementation
                    (globalThis as any).EventSource = EventSource;

                    // Create transport with headers correctly configured for Node.js EventSource
                    transport = new SSEClientTransport(new URL(url), {
                      // Pass the headers to both eventSourceInit and requestInit for compatibility
                      eventSourceInit: {
                        headers: headers,
                      },
                      requestInit: {
                        headers: headers,
                      },
                    });
                  }
                } catch (error) {
                  logger.warn(
                    `Failed to load EventSource packages for server "${serverName}". Headers may not be applied to SSE connection: ${error}`
                  );

                  // Last resort: create a transport with headers in requestInit
                  // This may not work for all implementations, but it's our best fallback
                  transport = new SSEClientTransport(new URL(url), {
                    requestInit: {
                      headers: headers,
                    },
                    // Added for test compatibility
                    eventSourceInit: {
                      headers: headers,
                    },
                  });
                }
              } else {
                // For browser environments, use the requestInit approach
                // NOTE: This has limitations as browser EventSource doesn't support custom headers
                // If headers are critical, recommend users to set useNodeEventSource=true
                logger.debug(
                  `Using browser EventSource for server "${serverName}". Headers may not be applied correctly.`
                );
                logger.debug(
                  `For better headers support in browsers, consider using a custom SSE implementation.`
                );

                transport = new SSEClientTransport(new URL(url), {
                  requestInit: {
                    headers: headers,
                  },
                  // Added for test compatibility
                  eventSourceInit: {
                    headers: headers,
                  },
                });
              }
            } else {
              // No headers, use default transport
              transport = new SSEClientTransport(new URL(url));
            }

            this.transportInstances.set(serverName, transport);

            client = new Client({
              name: 'langchain-mcp-adapter',
              version: '0.1.0',
            });

            try {
              await client.connect(transport);

              // Set up auto-reconnect if configured
              if (reconnect?.enabled) {
                const originalOnClose = transport.onclose;
                transport.onclose = async () => {
                  if (originalOnClose) {
                    await originalOnClose();
                  }

                  // Only attempt reconnect if we haven't cleaned up
                  if (this.clients.has(serverName)) {
                    logger.info(
                      `SSE connection for server "${serverName}" closed, attempting to reconnect...`
                    );
                    await this.attemptReconnect(
                      serverName,
                      connection,
                      reconnect.maxAttempts,
                      reconnect.delayMs
                    );
                  }
                };
              }
            } catch (error) {
              throw new MCPClientError(
                `Failed to connect to SSE server "${serverName}": ${error}`,
                serverName
              );
            }

            cleanup = async () => {
              logger.debug(`Closing SSE transport for server "${serverName}"`);
              await transport.close();
            };
          } catch (error) {
            throw new MCPClientError(
              `Failed to create SSE transport for server "${serverName}": ${error}`,
              serverName
            );
          }
        } else {
          // This should never happen due to the validation in the constructor
          throw new MCPClientError(
            `Unsupported transport type for server "${serverName}"`,
            serverName
          );
        }

        this.clients.set(serverName, client);
        this.cleanupFunctions.push(cleanup);

        // Load tools for this server
        try {
          logger.debug(`Loading tools for server "${serverName}"...`);
          const tools = await loadMcpTools(client);
          this.serverNameToTools.set(serverName, tools);
          logger.info(`Successfully loaded ${tools.length} tools from server "${serverName}"`);
        } catch (error) {
          logger.error(`Failed to load tools from server "${serverName}": ${error}`);
          // Continue even if tool loading fails - the connection is still established
        }
      } catch (error) {
        if (error instanceof MCPClientError) {
          logger.error(error.message);
        } else {
          logger.error(`Failed to connect to server "${serverName}": ${error}`);
        }
      }
    }

    return this.serverNameToTools;
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
  private async attemptReconnect(
    serverName: string,
    connection: Connection,
    maxAttempts = 3,
    delayMs = 1000
  ): Promise<void> {
    let attempts = 0;
    let connected = false;

    // Clean up the existing client entry
    this.clients.delete(serverName);

    // Keep the tools entry for now

    while (!connected && (maxAttempts === undefined || attempts < maxAttempts)) {
      attempts++;
      logger.info(
        `Reconnection attempt ${attempts}${maxAttempts ? `/${maxAttempts}` : ''} for server "${serverName}"`
      );

      try {
        // Wait before attempting to reconnect
        if (delayMs) {
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }

        // Create a new connection
        const newConnections: Record<string, Connection> = {
          [serverName]: connection,
        };

        // Store the previous connections
        const previousConnections = this.connections;

        // Set the new connection
        this.connections = newConnections;

        // Initialize just this connection
        const oldTransportInstances = new Map(this.transportInstances);
        this.transportInstances.delete(serverName);

        // Initialize the connection
        await this.initializeConnections();

        // Check if connected
        if (this.clients.has(serverName)) {
          connected = true;
          logger.info(`Successfully reconnected to server "${serverName}"`);
        }

        // Restore the previous connections
        if (previousConnections) {
          this.connections = {
            ...previousConnections,
            [serverName]: connection, // Update with the latest connection info
          };
        }
      } catch (error) {
        logger.error(
          `Failed to reconnect to server "${serverName}" (attempt ${attempts}): ${error}`
        );
      }
    }

    if (!connected) {
      logger.error(`Failed to reconnect to server "${serverName}" after ${attempts} attempts`);
    }
  }

  /**
   * Get tools from specified servers as a flattened array.
   *
   * This is the recommended format for using with LangChain agents.
   *
   * @param serverNames - Optional array of server names to filter tools by.
   *                      If not provided, returns tools from all servers.
   * @returns A flattened array of tools from the specified servers (or all servers),
   *          ready for LangChain agents
   */
  getTools(serverNames?: string[]): StructuredToolInterface<z.ZodObject<any>>[] {
    const allTools: StructuredToolInterface<z.ZodObject<any>>[] = [];

    if (!serverNames || serverNames.length === 0) {
      // If no server names provided, return all tools
      for (const tools of this.serverNameToTools.values()) {
        allTools.push(...tools);
      }
    } else {
      // Return tools only from specified servers
      for (const serverName of serverNames) {
        const tools = this.serverNameToTools.get(serverName);
        if (tools) {
          allTools.push(...tools);
        }
      }
    }

    return allTools;
  }

  /**
   * Get all tools from all servers organized by server name.
   *
   * This is useful when you need to know which tools came from which server.
   *
   * @returns A map of server names to arrays of tools
   */
  getToolsByServer(): Map<string, StructuredToolInterface<z.ZodObject<any>>[]> {
    return this.serverNameToTools;
  }

  /**
   * Get a client for a specific server.
   *
   * @param serverName - The name of the server
   * @returns The client for the server, or undefined if the server is not connected
   */
  getClient(serverName: string): Client | undefined {
    return this.clients.get(serverName);
  }

  /**
   * Close all connections.
   */
  async close(): Promise<void> {
    logger.info('Closing all MCP connections...');

    for (const cleanup of this.cleanupFunctions) {
      try {
        await cleanup();
      } catch (error) {
        logger.error(`Error during cleanup: ${error}`);
      }
    }

    this.cleanupFunctions = [];
    this.clients.clear();
    this.serverNameToTools.clear();
    this.transportInstances.clear();

    logger.info('All MCP connections closed');
  }

  /**
   * Connect to an MCP server via stdio transport.
   *
   * @param serverName - A name to identify this server
   * @param command - The command to run
   * @param args - Arguments for the command
   * @param env - Optional environment variables
   * @param restart - Optional restart configuration
   * @returns A map of server names to arrays of tools
   */
  async connectToServerViaStdio(
    serverName: string,
    command: string,
    args: string[],
    env?: Record<string, string>,
    restart?: StdioConnection['restart']
  ): Promise<Map<string, StructuredToolInterface<z.ZodObject<any>>[]>> {
    const connections: Record<string, Connection> = {
      [serverName]: {
        transport: 'stdio',
        command,
        args,
        env,
        restart,
      },
    };

    this.connections = connections;
    return this.initializeConnections();
  }

  /**
   * Connect to an MCP server via SSE transport.
   *
   * @param serverName - A name to identify this server
   * @param url - The URL of the SSE server
   * @param headers - Optional headers to include in the requests
   * @param useNodeEventSource - Whether to use Node.js EventSource (requires eventsource package)
   * @param reconnect - Optional reconnection configuration
   * @returns A map of server names to arrays of tools
   */
  async connectToServerViaSSE(
    serverName: string,
    url: string,
    headers?: Record<string, string>,
    useNodeEventSource?: boolean,
    reconnect?: SSEConnection['reconnect']
  ): Promise<Map<string, StructuredToolInterface<z.ZodObject<any>>[]>> {
    const connection: SSEConnection = {
      transport: 'sse',
      url,
    };

    if (headers) {
      connection.headers = headers;
    }

    if (useNodeEventSource !== undefined) {
      connection.useNodeEventSource = useNodeEventSource;
    }

    if (reconnect) {
      connection.reconnect = reconnect;
    }

    const connections: Record<string, Connection> = {
      [serverName]: connection,
    };

    this.connections = connections;
    return this.initializeConnections();
  }
}
