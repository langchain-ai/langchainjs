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
      this.connections = this.processConnections(connections);
    } else {
      // Try to load from default mcp.json if no connections are provided
      this.tryLoadDefaultConfig();
    }
  }

  /**
   * Try to load the default configuration file (mcp.json) from the root directory
   */
  private tryLoadDefaultConfig(): void {
    try {
      const defaultConfigPath = path.join(process.cwd(), 'mcp.json');
      if (fs.existsSync(defaultConfigPath)) {
        logger.info(`Found default configuration at ${defaultConfigPath}, loading automatically`);
        const config = this.loadConfigFromFile(defaultConfigPath);
        this.connections = this.processConnections(config.servers);
      } else {
        logger.debug('No default mcp.json found in root directory');
      }
    } catch (error) {
      logger.warn(`Failed to load default configuration: ${error}`);
      // Do not throw here, just continue with no configs
    }
  }

  /**
   * Load a configuration from a file
   *
   * @param configPath - Path to the configuration file
   * @returns The parsed configuration
   */
  private loadConfigFromFile(configPath: string): MCPConfig {
    const configData = fs.readFileSync(configPath, 'utf8');
    const config = JSON.parse(configData);

    // Validate that config has a servers property
    if (!config || typeof config !== 'object' || !('servers' in config)) {
      logger.error(`Invalid MCP configuration from ${configPath}: missing 'servers' property`);
      throw new MCPClientError(`Invalid MCP configuration: missing 'servers' property`);
    }

    // Process environment variables in the configuration
    this.processEnvVarsInConfig(config.servers);

    return config;
  }

  /**
   * Process environment variables in configuration
   * Replaces ${ENV_VAR} with the actual environment variable value
   *
   * @param servers - The servers configuration object
   */
  private processEnvVarsInConfig(servers: Record<string, any>): void {
    for (const [serverName, config] of Object.entries(servers)) {
      if (typeof config !== 'object' || config === null) continue;

      // Process env object if it exists
      if (config.env && typeof config.env === 'object') {
        for (const [key, value] of Object.entries(config.env)) {
          if (typeof value === 'string' && value.startsWith('${') && value.endsWith('}')) {
            const envVar = value.slice(2, -1);
            const envValue = process.env[envVar];
            if (envValue) {
              config.env[key] = envValue;
            } else {
              logger.warn(`Environment variable ${envVar} not found for server "${serverName}"`);
            }
          }
        }
      }

      // Process any other string properties recursively
      this.processEnvVarsRecursively(config);
    }
  }

  /**
   * Process environment variables recursively in an object
   *
   * @param obj - The object to process
   */
  private processEnvVarsRecursively(obj: any): void {
    if (typeof obj !== 'object' || obj === null) return;

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string' && value.startsWith('${') && value.endsWith('}')) {
        const envVar = value.slice(2, -1);
        const envValue = process.env[envVar];
        if (envValue) {
          obj[key] = envValue;
        }
      } else if (typeof value === 'object' && value !== null && key !== 'env') {
        // Skip env object as it's handled separately
        this.processEnvVarsRecursively(value);
      }
    }
  }

  /**
   * Process connection configurations
   *
   * @param connections - Raw connection configurations
   * @returns Processed connection configurations
   */
  private processConnections(connections: Record<string, any>): Record<string, Connection> {
    const processedConnections: Record<string, Connection> = {};

    for (const [serverName, config] of Object.entries(connections)) {
      if (typeof config !== 'object' || config === null) {
        logger.warn(`Invalid configuration for server "${serverName}". Skipping.`);
        continue;
      }

      try {
        // Determine the connection type and process accordingly
        if (this.isStdioConnection(config)) {
          processedConnections[serverName] = this.processStdioConfig(serverName, config);
        } else if (this.isSSEConnection(config)) {
          processedConnections[serverName] = this.processSSEConfig(serverName, config);
        } else {
          logger.warn(`Server "${serverName}" has invalid or unsupported configuration. Skipping.`);
        }
      } catch (error) {
        logger.error(`Error processing configuration for server "${serverName}": ${error}`);
      }
    }

    return processedConnections;
  }

  /**
   * Check if a configuration is for a stdio connection
   */
  private isStdioConnection(config: any): boolean {
    // When transport is missing, default to stdio if it has command and args
    // OR when transport is explicitly set to 'stdio'
    return (
      (config.transport === 'stdio' || !config.transport) &&
      config.command &&
      Array.isArray(config.args)
    );
  }

  /**
   * Check if a configuration is for an SSE connection
   */
  private isSSEConnection(config: any): boolean {
    // Only consider it an SSE connection if transport is explicitly set to 'sse'
    return config.transport === 'sse' && typeof config.url === 'string';
  }

  /**
   * Process stdio connection configuration
   */
  private processStdioConfig(serverName: string, config: any): StdioConnection {
    // Always set transport to 'stdio' regardless of whether it was in the original config
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

    return stdioConfig;
  }

  /**
   * Process SSE connection configuration
   */
  private processSSEConfig(serverName: string, config: any): SSEConnection {
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

    return sseConfig;
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
      const client = new MultiServerMCPClient();
      const config = client.loadConfigFromFile(configPath);

      // Merge with existing connections if any
      if (client.connections) {
        client.connections = {
          ...client.connections,
          ...client.processConnections(config.servers),
        };
      } else {
        client.connections = client.processConnections(config.servers);
      }

      logger.info(`Loaded MCP configuration from ${configPath}`);
      return client;
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

        if (connection.transport === 'stdio') {
          await this.initializeStdioConnection(serverName, connection);
        } else if (connection.transport === 'sse') {
          await this.initializeSSEConnection(serverName, connection);
        } else {
          // This should never happen due to the validation in the constructor
          throw new MCPClientError(
            `Unsupported transport type for server "${serverName}"`,
            serverName
          );
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
   * Initialize a stdio connection
   */
  private async initializeStdioConnection(
    serverName: string,
    connection: StdioConnection
  ): Promise<void> {
    const { command, args, env, restart } = connection;

    logger.debug(
      `Creating stdio transport for server "${serverName}" with command: ${command} ${args.join(' ')}`
    );

    const transport = new StdioClientTransport({
      command,
      args,
      env,
    });

    this.transportInstances.set(serverName, transport);

    const client = new Client({
      name: 'langchain-mcp-adapter',
      version: '0.1.0',
    });

    try {
      await client.connect(transport);

      // Set up auto-restart if configured
      if (restart?.enabled) {
        this.setupStdioRestart(serverName, transport, connection, restart);
      }
    } catch (error) {
      throw new MCPClientError(
        `Failed to connect to stdio server "${serverName}": ${error}`,
        serverName
      );
    }

    this.clients.set(serverName, client);

    const cleanup = async () => {
      logger.debug(`Closing stdio transport for server "${serverName}"`);
      await transport.close();
    };

    this.cleanupFunctions.push(cleanup);

    // Load tools for this server
    await this.loadToolsForServer(serverName, client);
  }

  /**
   * Set up stdio restart handling
   */
  private setupStdioRestart(
    serverName: string,
    transport: StdioClientTransport,
    connection: StdioConnection,
    restart: NonNullable<StdioConnection['restart']>
  ): void {
    const originalOnClose = transport.onclose;
    transport.onclose = async () => {
      if (originalOnClose) {
        await originalOnClose();
      }

      // Only attempt restart if we haven't cleaned up
      if (this.clients.has(serverName)) {
        logger.info(`Process for server "${serverName}" exited, attempting to restart...`);
        await this.attemptReconnect(serverName, connection, restart.maxAttempts, restart.delayMs);
      }
    };
  }

  /**
   * Initialize an SSE connection
   */
  private async initializeSSEConnection(
    serverName: string,
    connection: SSEConnection
  ): Promise<void> {
    const { url, headers, useNodeEventSource, reconnect } = connection;

    logger.debug(`Creating SSE transport for server "${serverName}" with URL: ${url}`);

    try {
      const transport = await this.createSSETransport(serverName, url, headers, useNodeEventSource);
      this.transportInstances.set(serverName, transport);

      const client = new Client({
        name: 'langchain-mcp-adapter',
        version: '0.1.0',
      });

      try {
        await client.connect(transport);

        // Set up auto-reconnect if configured
        if (reconnect?.enabled) {
          this.setupSSEReconnect(serverName, transport, connection, reconnect);
        }
      } catch (error) {
        throw new MCPClientError(
          `Failed to connect to SSE server "${serverName}": ${error}`,
          serverName
        );
      }

      this.clients.set(serverName, client);

      const cleanup = async () => {
        logger.debug(`Closing SSE transport for server "${serverName}"`);
        await transport.close();
      };

      this.cleanupFunctions.push(cleanup);

      // Load tools for this server
      await this.loadToolsForServer(serverName, client);
    } catch (error) {
      throw new MCPClientError(
        `Failed to create SSE transport for server "${serverName}": ${error}`,
        serverName
      );
    }
  }

  /**
   * Create an SSE transport with appropriate EventSource implementation
   */
  private async createSSETransport(
    serverName: string,
    url: string,
    headers?: Record<string, string>,
    useNodeEventSource?: boolean
  ): Promise<SSEClientTransport> {
    if (!headers) {
      // Simple case - no headers, use default transport
      return new SSEClientTransport(new URL(url));
    }

    logger.debug(`Using custom headers for SSE transport to server "${serverName}"`);

    // If useNodeEventSource is true, try Node.js implementations
    if (useNodeEventSource) {
      return await this.createNodeEventSourceTransport(serverName, url, headers);
    }

    // For browser environments, use the basic requestInit approach
    logger.debug(
      `Using browser EventSource for server "${serverName}". Headers may not be applied correctly.`
    );
    logger.debug(
      `For better headers support in browsers, consider using a custom SSE implementation.`
    );

    return new SSEClientTransport(new URL(url), {
      requestInit: { headers },
      eventSourceInit: { headers }, // Added for test compatibility
    });
  }

  /**
   * Create an EventSource transport for Node.js environments
   */
  private async createNodeEventSourceTransport(
    serverName: string,
    url: string,
    headers: Record<string, string>
  ): Promise<SSEClientTransport> {
    // First try to use extended-eventsource which has better headers support
    try {
      const ExtendedEventSourceModule = await import('extended-eventsource');
      const ExtendedEventSource = ExtendedEventSourceModule.EventSource;

      logger.debug(`Using Extended EventSource for server "${serverName}"`);
      logger.debug(`Setting headers for Extended EventSource: ${JSON.stringify(headers)}`);

      // Override the global EventSource with the extended implementation
      (globalThis as any).EventSource = ExtendedEventSource;

      // For Extended EventSource, create the SSE transport
      return new SSEClientTransport(new URL(url), {
        // Pass empty options for test compatibility
        eventSourceInit: {},
        requestInit: {},
      });
    } catch (extendedError) {
      // Fall back to standard eventsource if extended-eventsource is not available
      logger.debug(
        `Extended EventSource not available, falling back to standard EventSource: ${extendedError}`
      );

      try {
        // Dynamically import the eventsource package
        const EventSourceModule = await import('eventsource');
        const EventSource = EventSourceModule.default;

        logger.debug(`Using Node.js EventSource for server "${serverName}"`);
        logger.debug(`Setting headers for EventSource: ${JSON.stringify(headers)}`);

        // Override the global EventSource with the Node.js implementation
        (globalThis as any).EventSource = EventSource;

        // Create transport with headers correctly configured for Node.js EventSource
        return new SSEClientTransport(new URL(url), {
          // Pass the headers to both eventSourceInit and requestInit for compatibility
          eventSourceInit: { headers },
          requestInit: { headers },
        });
      } catch (nodeError) {
        logger.warn(
          `Failed to load EventSource packages for server "${serverName}". Headers may not be applied to SSE connection: ${nodeError}`
        );

        // Last resort fallback
        return new SSEClientTransport(new URL(url), {
          requestInit: { headers },
          eventSourceInit: { headers },
        });
      }
    }
  }

  /**
   * Set up SSE reconnect handling
   */
  private setupSSEReconnect(
    serverName: string,
    transport: SSEClientTransport,
    connection: SSEConnection,
    reconnect: NonNullable<SSEConnection['reconnect']>
  ): void {
    const originalOnClose = transport.onclose;
    transport.onclose = async () => {
      if (originalOnClose) {
        await originalOnClose();
      }

      // Only attempt reconnect if we haven't cleaned up
      if (this.clients.has(serverName)) {
        logger.info(`SSE connection for server "${serverName}" closed, attempting to reconnect...`);
        await this.attemptReconnect(
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
  private async loadToolsForServer(serverName: string, client: Client): Promise<void> {
    try {
      logger.debug(`Loading tools for server "${serverName}"...`);
      const tools = await loadMcpTools(client);
      this.serverNameToTools.set(serverName, tools);
      logger.info(`Successfully loaded ${tools.length} tools from server "${serverName}"`);
    } catch (error) {
      logger.error(`Failed to load tools from server "${serverName}": ${error}`);
      // Continue even if tool loading fails - the connection is still established
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
  private async attemptReconnect(
    serverName: string,
    connection: Connection,
    maxAttempts = 3,
    delayMs = 1000
  ): Promise<void> {
    let connected = false;
    let attempts = 0;

    // Clean up previous connection resources
    this.cleanupServerResources(serverName);

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

        // Initialize just this connection based on its type
        if (connection.transport === 'stdio') {
          await this.initializeStdioConnection(serverName, connection);
        } else if (connection.transport === 'sse') {
          await this.initializeSSEConnection(serverName, connection);
        }

        // Check if connected
        if (this.clients.has(serverName)) {
          connected = true;
          logger.info(`Successfully reconnected to server "${serverName}"`);
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
   * Clean up resources for a specific server
   */
  private cleanupServerResources(serverName: string): void {
    this.clients.delete(serverName);
    this.serverNameToTools.delete(serverName);
    this.transportInstances.delete(serverName);
  }

  /**
   * Get tools from specified servers as a flattened array.
   *
   * @param servers - Optional array of server names to filter tools by.
   *                 If not provided, returns tools from all servers.
   * @returns A flattened array of tools from the specified servers (or all servers)
   */
  getTools(servers?: string[]): StructuredToolInterface<z.ZodObject<any>>[] {
    if (!servers || servers.length === 0) {
      return this.getAllToolsAsFlatArray();
    }
    return this.getToolsFromServers(servers);
  }

  /**
   * Get all tools from all servers as a flat array.
   *
   * @returns A flattened array of all tools
   */
  private getAllToolsAsFlatArray(): StructuredToolInterface<z.ZodObject<any>>[] {
    const allTools: StructuredToolInterface<z.ZodObject<any>>[] = [];
    for (const tools of this.serverNameToTools.values()) {
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
  private getToolsFromServers(serverNames: string[]): StructuredToolInterface<z.ZodObject<any>>[] {
    const allTools: StructuredToolInterface<z.ZodObject<any>>[] = [];
    for (const serverName of serverNames) {
      const tools = this.serverNameToTools.get(serverName);
      if (tools) {
        allTools.push(...tools);
      }
    }
    return allTools;
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

  /**
   * Add configuration from a JSON file to the existing configuration.
   *
   * @param configPath - Path to the configuration file
   * @returns This client instance for method chaining
   * @throws {MCPClientError} If the configuration file cannot be loaded or parsed
   */
  addConfigFromFile(configPath: string): MultiServerMCPClient {
    try {
      const config = this.loadConfigFromFile(configPath);

      // Merge with existing connections if any
      if (this.connections) {
        this.connections = {
          ...this.connections,
          ...this.processConnections(config.servers),
        };
      } else {
        this.connections = this.processConnections(config.servers);
      }

      logger.info(`Added MCP configuration from ${configPath}`);
      return this;
    } catch (error) {
      logger.error(`Failed to add MCP configuration from ${configPath}: ${error}`);
      throw new MCPClientError(`Failed to add MCP configuration: ${error}`);
    }
  }

  /**
   * Add server configurations directly to the existing configuration.
   *
   * @param connections - Server connections to add
   * @returns This client instance for method chaining
   */
  addConnections(connections: Record<string, any>): MultiServerMCPClient {
    const processedConnections = this.processConnections(connections);

    // Merge with existing connections if any
    if (this.connections) {
      this.connections = {
        ...this.connections,
        ...processedConnections,
      };
    } else {
      this.connections = processedConnections;
    }

    logger.info(`Added ${Object.keys(processedConnections).length} connections to client`);
    return this;
  }

  /**
   * Get the server name for a specific tool.
   *
   * @param toolName - The name of the tool
   * @returns The server name or undefined if the tool is not found
   */
  getServerForTool(toolName: string): string | undefined {
    for (const [serverName, tools] of this.serverNameToTools.entries()) {
      if (tools.some(tool => tool.name === toolName)) {
        return serverName;
      }
    }
    return undefined;
  }
}
