import { z } from "zod/v3";
import { tool, type ToolRuntime } from "@langchain/core/tools";
import { createMiddleware } from "../middleware.js";
import {
  interopParse,
  InferInteropZodOutput,
  InferInteropZodInput,
} from "@langchain/core/utils/types";

/**
 * Memory-based file system for storing MCP tool definitions
 */
interface MemoryFileSystem {
  [path: string]: string | MemoryFileSystem;
}

/**
 * MCP tool definition from the MCP server
 */
interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: string;
    properties: Record<string, unknown>;
    required?: string[];
  };
  serverName: string;
}

/**
 * Configuration for MCP middleware
 */
const contextSchema = z.object({
  /**
   * MCP client configuration - can be either:
   * - A ClientConfig object from @langchain/mcp-adapters
   * - A record of server names to connection configs
   */
  mcpConfig: z.custom<Record<string, unknown>>().optional(),
  /**
   * Base path for the virtual file system
   * @default "./servers"
   */
  basePath: z.string().default("./servers"),
  /**
   * Custom system prompt to guide the agent on using MCP tools.
   * If not provided, uses the default system prompt explaining the virtual file system approach.
   */
  systemPrompt: z.string().optional(),
});

/**
 * Generate the default system prompt for MCP middleware
 */
function getDefaultMCPSystemPrompt(basePath: string): string {
  return `You have access to MCP (Model Context Protocol) tools through a virtual file system. This approach is more efficient than loading all tool definitions upfront.

## How to Access MCP Tools

1. **Explore the file system**: Use the \`mcp_list_directory\` tool to browse available MCP servers and tools.
   - Start by listing the base directory: \`${basePath}\`
   - Each server has its own directory with tool definitions

2. **Read tool definitions**: Use the \`mcp_read_file\` tool to read specific tool files when you need them.
   - Tool files are TypeScript files located at: \`${basePath}/<server-name>/<tool-name>.ts\`
   - Each file contains a function interface and description
   - Only read the tools you actually need for the current task

3. **Execute MCP tool calls**: Use the \`execute_mcp_code\` tool to execute code that calls MCP tools.
   - Write TypeScript/JavaScript code that imports and calls the MCP tool functions
   - Provide an array of tool calls that will be made
   - Tool names follow the format: \`serverName__toolName\`

## Benefits of This Approach

- **Progressive disclosure**: Load only the tool definitions you need, reducing token usage
- **Context efficiency**: Filter and transform data in code before returning results
- **Better control flow**: Use loops, conditionals, and error handling in familiar code patterns
- **Privacy**: Intermediate results stay in the execution environment by default

## Example Workflow

1. List available servers: \`mcp_list_directory({ path: "${basePath}" })\`
2. List tools in a server: \`mcp_list_directory({ path: "${basePath}/google-drive" })\`
3. Read a specific tool: \`mcp_read_file({ path: "${basePath}/google-drive/getDocument.ts" })\`
4. Execute code using the tool: \`execute_mcp_code({ toolCalls: [{ toolName: "google-drive__getDocument", args: { documentId: "abc123" } }] })\`

Remember: Only load the tool definitions you need for your current task to minimize token usage.`;
}

export type MCPMiddlewareConfig = InferInteropZodInput<typeof contextSchema>;

/**
 * State schema for MCP middleware
 */
const stateSchema = z.object({
  /**
   * Virtual file system storing MCP tool definitions
   */
  fileSystem: z.custom<MemoryFileSystem>().default({}),
  /**
   * Map of server names to their tool definitions
   */
  serverTools: z.record(z.array(z.custom<MCPToolDefinition>())).default({}),
  /**
   * Map of server names to tool name mappings (for looking up tools)
   */
  serverToolMappings: z.record(z.record(z.string())).default({}),
  /**
   * MCP client configuration (stored for recreating client if needed)
   */
  mcpConfig: z.custom<Record<string, unknown>>().optional(),
  /**
   * Whether MCP adapters have been loaded
   */
  adaptersLoaded: z.boolean().default(false),
  /**
   * Unique ID for the MCP client instance (used for cleanup)
   */
  clientId: z.string().optional(),
});

type MCPMiddlewareState = InferInteropZodOutput<typeof stateSchema>;

/**
 * Map to store MCP client instances by unique ID
 * This allows us to track and close clients properly without storing them in state
 */
const clientInstances = new Map<
  string,
  {
    getTools: (servers?: string[]) => Promise<
      Array<{
        name: string;
        invoke: (args: Record<string, unknown>) => Promise<unknown>;
      }>
    >;
    close: () => Promise<void>;
  }
>();

/**
 * Generate a unique client ID based on config
 */
function generateClientId(config: Record<string, unknown>): string {
  // Create a simple hash of the config for uniqueness
  const configStr = JSON.stringify(config);
  return `mcp-client-${Buffer.from(configStr).toString("base64").slice(0, 16)}`;
}

/**
 * Dynamically load the @langchain/mcp-adapters package
 */
async function loadMCPAdapters(): Promise<{
  MultiServerMCPClient: new (config: Record<string, unknown>) => {
    getTools: (servers?: string[]) => Promise<
      Array<{
        name: string;
        description: string;
        schema: unknown;
        invoke: (args: Record<string, unknown>) => Promise<unknown>;
      }>
    >;
    close: () => Promise<void>;
  };
}> {
  try {
    // @ts-expect-error - @langchain/mcp-adapters is an optional dependency
    const adapters = await import("@langchain/mcp-adapters");
    return {
      MultiServerMCPClient: adapters.MultiServerMCPClient,
    };
  } catch (error) {
    throw new Error(
      `Failed to load @langchain/mcp-adapters. Please install it: pnpm add @langchain/mcp-adapters\nOriginal error: ${String(
        error
      )}`
    );
  }
}

/**
 * Generate TypeScript code for a single MCP tool
 */
function generateToolFile(tool: MCPToolDefinition, basePath: string): string {
  const toolName = tool.name.replace(/[^a-zA-Z0-9]/g, "_");
  const functionName = toolName.charAt(0).toLowerCase() + toolName.slice(1);

  // Generate TypeScript interface for input
  const properties = tool.inputSchema.properties || {};
  const required = tool.inputSchema.required || [];

  const interfaceProps = Object.entries(properties)
    .map(([key, value]) => {
      const prop = value as Record<string, unknown>;
      const type =
        prop.type === "string"
          ? "string"
          : prop.type === "number"
          ? "number"
          : prop.type === "integer"
          ? "number"
          : prop.type === "boolean"
          ? "boolean"
          : prop.type === "array"
          ? "unknown[]"
          : prop.type === "object"
          ? "Record<string, unknown>"
          : "unknown";
      const optional = required.includes(key) ? "" : "?";
      return `  ${key}${optional}: ${type};`;
    })
    .join("\n");

  const inputInterface = interfaceProps
    ? `interface ${toolName}Input {\n${interfaceProps}\n}`
    : `interface ${toolName}Input {}`;

  // Generate the tool function
  const toolCallName = `${tool.serverName}__${tool.name}`;

  return `// ${tool.description || `Tool: ${tool.name}`}
import { callMCPTool } from "${basePath}/client.js";

${inputInterface}

interface ${toolName}Response {
  [key: string]: unknown;
}

/**
 * ${tool.description || `Call ${tool.name} on ${tool.serverName}`}
 */
export async function ${functionName}(input: ${toolName}Input): Promise<${toolName}Response> {
  return callMCPTool<${toolName}Response>('${toolCallName}', input);
}
`;
}

/**
 * Generate index.ts file for a server
 */
function generateServerIndex(
  serverName: string,
  tools: MCPToolDefinition[]
): string {
  const exports = tools
    .map((tool) => {
      const toolName = tool.name.replace(/[^a-zA-Z0-9]/g, "_");
      const functionName = toolName.charAt(0).toLowerCase() + toolName.slice(1);
      return `export { ${functionName} } from './${toolName}.js';`;
    })
    .join("\n");

  return `// Auto-generated index for ${serverName} server
${exports}
`;
}

/**
 * Generate client.ts file that provides the callMCPTool function
 */
const CLIENT_FILE_CONTENT = `// MCP Tool Call Client
// This file provides the callMCPTool function used by all MCP tool wrappers

export async function callMCPTool<T = unknown>(
  toolName: string,
  input: Record<string, unknown>
): Promise<T> {
  // This function is intercepted by the MCP middleware
  // The actual implementation is handled by the middleware's executeMCPTool
  throw new Error(
    'callMCPTool should be called through code execution. ' +
    'Use the execute_mcp_code tool to execute code that calls MCP tools.'
  );
}`;

/**
 * Build the virtual file system from server tools
 */
function buildFileSystem(
  serverTools: Record<string, MCPToolDefinition[]>,
  basePath: string
): MemoryFileSystem {
  const fs: MemoryFileSystem = {};

  // Normalize basePath (remove leading ./ if present for consistency)
  const normalizedBasePath = basePath.replace(/^\.\//, "");

  // Create servers directory structure
  const serversDir: MemoryFileSystem = {};

  // Store both normalized and original paths for compatibility
  fs[normalizedBasePath] = serversDir;
  if (basePath !== normalizedBasePath) {
    fs[basePath] = serversDir;
  }

  // Create client.ts - store with both paths
  fs[`${normalizedBasePath}/client.ts`] = CLIENT_FILE_CONTENT;
  if (basePath !== normalizedBasePath) {
    fs[`${basePath}/client.ts`] = CLIENT_FILE_CONTENT;
  }

  // For each server, create its directory and tool files
  for (const [serverName, tools] of Object.entries(serverTools)) {
    const serverPath = serverName.replace(/[^a-zA-Z0-9]/g, "-");
    const serverDir: MemoryFileSystem = {};
    serversDir[serverPath] = serverDir;

    // Create index.ts for the server
    serverDir["index.ts"] = generateServerIndex(serverName, tools);

    // Create individual tool files
    for (const tool of tools) {
      const toolName = tool.name.replace(/[^a-zA-Z0-9]/g, "_");
      serverDir[`${toolName}.ts`] = generateToolFile(tool, basePath);
    }
  }

  return fs;
}

/**
 * Normalize a path by removing leading ./ and ../, and handling root path
 */
function normalizePath(path: string): string[] {
  // Handle root path
  if (path === "/" || path === "") {
    return [];
  }

  // Remove leading ./ or ./
  const normalized = path.replace(/^\.\//, "").replace(/^\.$/, "");

  // Split and filter out empty parts
  const parts = normalized.split("/").filter(Boolean);

  return parts;
}

/**
 * Resolve a path in the file system, handling both flat keys and nested structure
 */
function resolvePath(
  fs: MemoryFileSystem,
  pathParts: string[]
): MemoryFileSystem | string | null {
  // If no parts, return root
  if (pathParts.length === 0) {
    return fs;
  }

  // First, try to find a matching key at root level (for flat paths like "./servers/client.ts")
  const fullPath = pathParts.join("/");
  const altPaths = [`./${fullPath}`, fullPath, `/${fullPath}`];

  for (const altPath of altPaths) {
    if (altPath in fs) {
      return fs[altPath];
    }
  }

  // Otherwise, traverse the nested structure
  let current: MemoryFileSystem | string = fs;

  for (const part of pathParts) {
    if (typeof current === "string") {
      return null;
    }

    // Try direct key first
    if (part in current) {
      current = current[part];
      continue;
    }

    // Try with ./ prefix
    const altKey = `./${part}`;
    if (altKey in current) {
      current = current[altKey];
      continue;
    }

    return null;
  }

  return current;
}

/**
 * Get file from virtual file system
 */
function getFile(fs: MemoryFileSystem, path: string): string | null {
  const parts = normalizePath(path);
  const resolved = resolvePath(fs, parts);

  if (resolved === null) {
    return null;
  }

  return typeof resolved === "string" ? resolved : null;
}

/**
 * List directory contents
 */
function listDirectory(fs: MemoryFileSystem, path: string): string[] {
  const parts = normalizePath(path);
  const resolved = resolvePath(fs, parts);

  if (resolved === null || typeof resolved === "string") {
    return [];
  }

  // Return keys, but normalize them for display
  return Object.keys(resolved).map((key) => {
    // If it's a nested directory, return just the key name
    if (typeof resolved[key] === "object") {
      return key.replace(/^\.\//, "");
    }
    return key.replace(/^\.\//, "");
  });
}

/**
 * MCP middleware that provides code execution interface for MCP tools
 *
 * This middleware creates a virtual file system where MCP tools are represented
 * as TypeScript functions. Instead of loading all tool definitions into context,
 * agents can explore the file system and load only the tools they need.
 *
 * @param options Configuration options
 * @returns A middleware instance
 *
 * @example
 * ```ts
 * import { mcpMiddleware } from "langchain/agents/middleware";
 *
 * const middleware = mcpMiddleware({
 *   mcpConfig: {
 *     mcpServers: {
 *       "google-drive": {
 *         transport: "stdio",
 *         command: "npx",
 *         args: ["-y", "@modelcontextprotocol/server-google-drive"],
 *       },
 *     },
 *   },
 * });
 *
 * const agent = createAgent({
 *   model: "openai:gpt-4o",
 *   middleware: [middleware],
 * });
 * ```
 */
export function mcpMiddleware(options: MCPMiddlewareConfig) {
  const config = interopParse(contextSchema, options);

  // File system read tool
  const readFileTool = tool(
    async ({ path }, runtime: ToolRuntime<typeof stateSchema>) => {
      const middlewareState = runtime.state;
      if (!middlewareState?.fileSystem) {
        return "File system not initialized. MCP servers need to be connected first.";
      }

      const content = getFile(middlewareState.fileSystem, path);
      if (content === null) {
        return `File not found: ${path}`;
      }

      return content;
    },
    {
      name: "mcp_read_file",
      description: `Read a file from the MCP virtual file system. Files are located at ${config.basePath}/servers/<server-name>/<tool-name>.ts`,
      schema: z.object({
        path: z.string().describe("Path to the file to read"),
      }),
    }
  );

  // File system list tool
  const listDirectoryTool = tool(
    async ({ path }, runtime: ToolRuntime<typeof stateSchema>) => {
      const middlewareState = runtime.state as MCPMiddlewareState;
      if (!middlewareState?.fileSystem) {
        return "File system not initialized. MCP servers need to be connected first.";
      }

      const entries = listDirectory(middlewareState.fileSystem, path);
      if (entries.length === 0) {
        return `Directory not found or empty: ${path}`;
      }

      return entries.join("\n");
    },
    {
      name: "mcp_list_directory",
      description: `List the contents of a directory in the MCP virtual file system. Start exploring from ${config.basePath}`,
      schema: z.object({
        path: z.string().describe("Path to the directory to list"),
      }),
    }
  );

  // MCP code execution tool
  const executeMCPCodeTool = tool(
    async ({ toolCalls }, runtime: ToolRuntime<typeof stateSchema>) => {
      const middlewareState = runtime.state as MCPMiddlewareState;
      if (!middlewareState) {
        throw new Error("MCP middleware state not initialized");
      }

      // This should have been initialized in beforeAgent
      if (!middlewareState.adaptersLoaded) {
        throw new Error(
          "MCP middleware not initialized. Please ensure mcpConfig is provided in the middleware context."
        );
      }

      // Execute MCP tool calls from the code
      // Parse toolCalls to extract MCP tool invocations
      // Format: { toolName: string, args: Record<string, unknown> }[]
      if (!Array.isArray(toolCalls)) {
        throw new Error(
          "toolCalls must be an array of { toolName, args } objects"
        );
      }

      const results: unknown[] = [];
      for (const toolCall of toolCalls) {
        if (
          typeof toolCall !== "object" ||
          !toolCall.toolName ||
          !toolCall.args
        ) {
          throw new Error(
            "Each toolCall must have toolName (string) and args (object) properties"
          );
        }

        // Find the tool instance by name
        // Tool names are in format: serverName__toolName
        const [serverName, toolName] = toolCall.toolName.split("__");
        if (!serverName || !toolName) {
          results.push({
            error: `Invalid tool name format: "${toolCall.toolName}". Expected format: "serverName__toolName"`,
          });
          continue;
        }

        // Get the mapping to find the actual tool name on the server
        const serverMapping = middlewareState.serverToolMappings[serverName];
        if (!serverMapping) {
          results.push({
            error: `Server "${serverName}" not found. Available servers: ${Object.keys(
              middlewareState.serverToolMappings
            ).join(", ")}`,
          });
          continue;
        }

        // Get or create the MCP client and get the tool
        try {
          if (!middlewareState.mcpConfig) {
            results.push({
              error: `MCP configuration not available for tool "${toolCall.toolName}"`,
            });
            continue;
          }

          // Try to reuse existing client from Map, or create a new one
          let client: {
            getTools: (servers?: string[]) => Promise<
              Array<{
                name: string;
                invoke: (args: Record<string, unknown>) => Promise<unknown>;
              }>
            >;
          };

          if (
            middlewareState.clientId &&
            clientInstances.has(middlewareState.clientId)
          ) {
            // Reuse existing client
            const clientInstance = clientInstances.get(
              middlewareState.clientId
            );
            if (clientInstance && "getTools" in clientInstance) {
              client = clientInstance as typeof client;
            } else {
              // Fallback: create new client
              const { MultiServerMCPClient } = await loadMCPAdapters();
              client = new MultiServerMCPClient(middlewareState.mcpConfig);
            }
          } else {
            // Create new client
            const { MultiServerMCPClient } = await loadMCPAdapters();
            client = new MultiServerMCPClient(middlewareState.mcpConfig);
          }

          const tools = await client.getTools([serverName]);

          // Try to find the tool - it might be prefixed or not depending on client config
          let tool = tools.find((t) => t.name === toolName);

          // If not found, try finding by full prefixed name (in case client prefixes tools)
          if (!tool) {
            tool = tools.find((t) => t.name === toolCall.toolName);
          }

          // If still not found, try finding any tool that ends with the tool name
          if (!tool) {
            tool = tools.find(
              (t) => t.name.endsWith(`__${toolName}`) || t.name === toolName
            );
          }

          if (!tool) {
            results.push({
              error: `Tool "${toolName}" not found on server "${serverName}". Searched for: "${toolName}", "${
                toolCall.toolName
              }". Available tools: ${tools.map((t) => t.name).join(", ")}`,
            });
            continue;
          }

          // Invoke the tool
          const result = await tool.invoke(toolCall.args);
          results.push(result);
        } catch (error) {
          results.push({
            error: `Error invoking tool "${toolCall.toolName}": ${String(
              error
            )}`,
          });
        }
      }

      return JSON.stringify(results, null, 2);
    },
    {
      name: "execute_mcp_code",
      description: `Execute code that calls MCP tools. The code should import and call functions from ${config.basePath}/servers/<server-name>/*.ts. Provide an array of tool calls that will be made.`,
      schema: z.object({
        toolCalls: z
          .array(
            z.object({
              toolName: z
                .string()
                .describe(
                  "Full tool name in format serverName__toolName (e.g., google-drive__getDocument)"
                ),
              args: z
                .record(z.unknown())
                .describe("Arguments to pass to the tool"),
            })
          )
          .describe("Array of MCP tool calls that will be made by the code"),
      }),
    }
  );

  return createMiddleware({
    name: "MCPMiddleware",
    stateSchema,
    contextSchema,
    tools: [readFileTool, listDirectoryTool, executeMCPCodeTool],
    wrapModelCall: (request, handler) =>
      handler({
        ...request,
        systemPrompt:
          (request.systemPrompt ? `${request.systemPrompt}\n\n` : "") +
          (config.systemPrompt ??
            getDefaultMCPSystemPrompt(config.basePath ?? "./servers")),
      }),
    beforeAgent: async (state) => {
      const config = interopParse(contextSchema, options);

      // Initialize state if needed
      const currentState = state as Partial<MCPMiddlewareState>;
      if (!currentState.fileSystem) {
        const initialState: Partial<MCPMiddlewareState> = {
          fileSystem: {},
          serverTools: {},
          serverToolMappings: {},
          adaptersLoaded: false,
        };

        // If adapters are not loaded and config is provided, load them
        if (config.mcpConfig) {
          try {
            const { MultiServerMCPClient } = await loadMCPAdapters();
            const client = new MultiServerMCPClient(config.mcpConfig);
            const clientId = generateClientId(config.mcpConfig);

            // Store client instance in Map for later cleanup
            clientInstances.set(clientId, client);

            // Load tools from all servers
            const serverTools: Record<string, MCPToolDefinition[]> = {};
            const serverToolMappings: Record<
              string,
              Record<string, string>
            > = {};
            const serverNames = Object.keys(config.mcpConfig.mcpServers || {});

            for (const serverName of serverNames) {
              try {
                // Get tools for this specific server
                const tools = await client.getTools([serverName]);

                // Store tool definitions
                serverTools[serverName] = tools.map(
                  (tool: {
                    name: string;
                    description: string;
                    schema: unknown;
                  }) => ({
                    name: tool.name,
                    description: tool.description || "",
                    inputSchema:
                      tool.schema as MCPToolDefinition["inputSchema"],
                    serverName,
                  })
                );

                // Store tool name mappings (fullName -> serverToolName)
                serverToolMappings[serverName] = {};
                for (const tool of tools) {
                  const fullToolName = `${serverName}__${tool.name}`;
                  serverToolMappings[serverName][fullToolName] = tool.name;
                }
              } catch (error) {
                console.warn(
                  `Failed to load tools from server ${serverName}:`,
                  error
                );
              }
            }

            // Build file system
            const fileSystem = buildFileSystem(
              serverTools,
              config.basePath || "./servers"
            );

            return {
              ...initialState,
              adaptersLoaded: true,
              serverTools,
              serverToolMappings,
              mcpConfig: config.mcpConfig,
              fileSystem,
              clientId,
            };
          } catch (error) {
            console.error("Failed to initialize MCP middleware:", error);
            return initialState;
          }
        }

        return initialState;
      }

      // If adapters are not loaded and config is provided, load them
      if (!currentState.adaptersLoaded && config.mcpConfig) {
        try {
          const { MultiServerMCPClient } = await loadMCPAdapters();
          const client = new MultiServerMCPClient(config.mcpConfig);
          const clientId = generateClientId(config.mcpConfig);

          // Store client instance in Map for later cleanup
          clientInstances.set(clientId, client);

          // Load tools from all servers
          const serverTools: Record<string, MCPToolDefinition[]> = {};
          const serverToolMappings: Record<string, Record<string, string>> = {};
          const serverNames = Object.keys(config.mcpConfig.mcpServers || {});

          for (const serverName of serverNames) {
            try {
              // Get tools for this specific server
              const tools = await client.getTools([serverName]);

              // Store tool definitions
              serverTools[serverName] = tools.map(
                (tool: {
                  name: string;
                  description: string;
                  schema: unknown;
                }) => ({
                  name: tool.name,
                  description: tool.description || "",
                  inputSchema: tool.schema as MCPToolDefinition["inputSchema"],
                  serverName,
                })
              );

              // Store tool name mappings (fullName -> serverToolName)
              serverToolMappings[serverName] = {};
              for (const tool of tools) {
                const fullToolName = `${serverName}__${tool.name}`;
                serverToolMappings[serverName][fullToolName] = tool.name;
              }
            } catch (error) {
              console.warn(
                `Failed to load tools from server ${serverName}:`,
                error
              );
            }
          }

          // Build file system
          const fileSystem = buildFileSystem(
            serverTools,
            config.basePath || "./servers"
          );

          return {
            ...currentState,
            adaptersLoaded: true,
            serverTools,
            serverToolMappings,
            mcpConfig: config.mcpConfig,
            fileSystem,
            clientId,
          };
        } catch (error) {
          console.error("Failed to initialize MCP middleware:", error);
          return currentState;
        }
      }

      return undefined;
    },
    afterAgent: async (state) => {
      const middlewareState = state as Partial<MCPMiddlewareState>;

      // Close MCP client connections if clientId is present
      if (
        middlewareState.clientId &&
        clientInstances.has(middlewareState.clientId)
      ) {
        try {
          const clientInstance = clientInstances.get(middlewareState.clientId);
          if (clientInstance && typeof clientInstance.close === "function") {
            await clientInstance.close();
          }
          // Remove from Map after closing
          clientInstances.delete(middlewareState.clientId);
        } catch (error) {
          console.error("Error closing MCP client:", error);
          // Still remove from Map even if close failed
          clientInstances.delete(middlewareState.clientId);
        }
      }

      return undefined;
    },
  });
}
