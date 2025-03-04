import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StructuredTool } from '@langchain/core/tools';
import { loadMcpTools } from './tools.js';
import * as fs from 'fs';
import * as path from 'path';
import logger from './logger.js';

type StdioConnection = {
  transport: 'stdio';
  command: string;
  args: string[];
  env?: Record<string, string>;
  encoding?: string;
  encodingErrorHandler?: 'strict' | 'ignore' | 'replace';
};

type SSEConnection = {
  transport: 'sse';
  url: string;
  headers?: Record<string, string>;
  useNodeEventSource?: boolean;
};

type Connection = StdioConnection | SSEConnection;

type MCPConfig = {
  servers: Record<string, Connection>;
};

/**
 * Client for connecting to multiple MCP servers and loading LangChain-compatible tools.
 */
export class MultiServerMCPClient {
  private clients: Map<string, Client> = new Map();
  private serverNameToTools: Map<string, StructuredTool[]> = new Map();
  private connections?: Record<string, Connection>;
  private cleanupFunctions: Array<() => Promise<void>> = [];

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

            processedConnections[serverName] = sseConfig;
          } else {
            logger.warn(`Server "${serverName}" has invalid configuration. Skipping.`);
            continue;
          }
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
   */
  static fromConfigFile(configPath: string): MultiServerMCPClient {
    try {
      const configData = fs.readFileSync(configPath, 'utf8');
      const config = JSON.parse(configData) as MCPConfig;
      logger.info(`Loaded MCP configuration from ${configPath}`);
      return new MultiServerMCPClient(config.servers);
    } catch (error) {
      logger.error(`Failed to load MCP configuration from ${configPath}: ${error}`);
      throw new Error(`Failed to load MCP configuration: ${error}`);
    }
  }

  /**
   * Initialize connections to all servers.
   *
   * @returns A map of server names to arrays of tools
   */
  async initializeConnections(): Promise<Map<string, StructuredTool[]>> {
    if (!this.connections) {
      logger.warn('No connections to initialize');
      return new Map();
    }

    for (const [serverName, connection] of Object.entries(this.connections)) {
      try {
        logger.info(`Initializing connection to server "${serverName}"...`);

        let client: Client;
        let cleanup: () => Promise<void>;

        if (connection.transport === 'stdio') {
          const { command, args, env } = connection;

          logger.debug(
            `Creating stdio transport for server "${serverName}" with command: ${command} ${args.join(' ')}`
          );

          const transport = new StdioClientTransport({
            command,
            args,
            env,
          });

          client = new Client({
            name: 'langchain-mcp-adapter',
            version: '0.1.0',
          });
          await client.connect(transport);

          cleanup = async () => {
            logger.debug(`Closing stdio transport for server "${serverName}"`);
            await transport.close();
          };
        } else if (connection.transport === 'sse') {
          const { url, headers, useNodeEventSource } = connection;

          logger.debug(`Creating SSE transport for server "${serverName}" with URL: ${url}`);

          let transport;

          if (headers) {
            logger.debug(`Using custom headers for SSE transport to server "${serverName}"`);

            const transportOptions: any = {
              requestInit: {
                headers: headers,
              },
            };

            // If useNodeEventSource is true, set up the EventSource for Node.js
            if (useNodeEventSource) {
              try {
                // Dynamically import the eventsource package
                const EventSource = require('eventsource');

                // Define EventSource globally
                (globalThis as any).EventSource = EventSource;

                logger.debug(`Using Node.js EventSource for server "${serverName}"`);

                // Add eventSourceInit with fetch function for Node.js
                transportOptions.eventSourceInit = {
                  headers: headers,
                };
              } catch (error) {
                logger.warn(
                  `Failed to load eventsource package for server "${serverName}". Headers may not be applied to SSE connection: ${error}`
                );
              }
            }

            transport = new SSEClientTransport(new URL(url), transportOptions);
          } else {
            transport = new SSEClientTransport(new URL(url));
          }

          client = new Client({
            name: 'langchain-mcp-adapter',
            version: '0.1.0',
          });
          await client.connect(transport);

          cleanup = async () => {
            logger.debug(`Closing SSE transport for server "${serverName}"`);
            await transport.close();
          };
        } else {
          // This should never happen due to the validation in the constructor
          logger.error(`Unsupported transport type for server "${serverName}"`);
          continue;
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
        }
      } catch (error) {
        logger.error(`Failed to connect to server "${serverName}": ${error}`);
      }
    }

    return this.serverNameToTools;
  }

  /**
   * Get all tools from all servers.
   *
   * @returns A map of server names to arrays of tools
   */
  getTools(): Map<string, StructuredTool[]> {
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

    logger.info('All MCP connections closed');
  }

  /**
   * Connect to an MCP server via stdio transport.
   *
   * @param serverName - A name to identify this server
   * @param command - The command to run
   * @param args - Arguments for the command
   * @param env - Optional environment variables
   * @returns A map of server names to arrays of tools
   */
  async connectToServerViaStdio(
    serverName: string,
    command: string,
    args: string[],
    env?: Record<string, string>
  ): Promise<Map<string, StructuredTool[]>> {
    const connections: Record<string, Connection> = {
      [serverName]: {
        transport: 'stdio',
        command,
        args,
        env,
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
   * @returns A map of server names to arrays of tools
   */
  async connectToServerViaSSE(
    serverName: string,
    url: string,
    headers?: Record<string, string>,
    useNodeEventSource?: boolean
  ): Promise<Map<string, StructuredTool[]>> {
    const connection: SSEConnection = {
      transport: 'sse',
      url,
    };

    if (headers) {
      connection.headers = headers;
    }

    if (useNodeEventSource) {
      connection.useNodeEventSource = useNodeEventSource;
    }

    const connections: Record<string, Connection> = {
      [serverName]: connection,
    };

    this.connections = connections;
    return this.initializeConnections();
  }
}
