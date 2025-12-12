import { z } from "zod/v3";
import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import type {
  ContentBlock,
  ToolMessage,
  MessageStructure,
} from "@langchain/core/messages";
import type { RunnableConfig } from "@langchain/core/runnables";
import type { Command, CommandParams } from "@langchain/langgraph";

import { toolHooksSchema, type ToolHooks } from "./hooks.js";

export type {
  Command,
  ContentBlock,
  ToolMessage,
  MessageStructure,
  RunnableConfig,
  CommandParams,
};

const callToolResultContentTypes = [
  "audio",
  "image",
  "resource",
  "resource_link",
  "text",
] as const;
export type CallToolResultContentType =
  (typeof callToolResultContentTypes)[number];

/**
 * The severity of a log message.
 * @see {@link https://github.com/modelcontextprotocol/typescript-sdk/blob/main/src/types.ts#L1067}
 */
export const LoggingLevelSchema = z.enum([
  "debug",
  "info",
  "notice",
  "warning",
  "error",
  "critical",
  "alert",
  "emergency",
]);

/**
 * A uniquely identifying ID for a request in JSON-RPC.
 * @see {@link https://github.com/modelcontextprotocol/typescript-sdk/blob/main/src/types.ts#L71C1-L74C72}
 */
export const RequestIdSchema = z.union([z.string(), z.number().int()]);

const outputTypesUnion = z.union([
  z
    .literal("content")
    .describe("Put tool output into the ToolMessage.content array"),
  z
    .literal("artifact")
    .describe("Put tool output into the ToolMessage.artifact array"),
]);

const detailedOutputHandlingSchema = z.object(
  Object.fromEntries(
    callToolResultContentTypes.map((contentType) => [
      contentType,
      z
        .union([
          z
            .literal("content")
            .describe(
              `Put all ${contentType} tool output into the ToolMessage.content array`
            ),
          z
            .literal("artifact")
            .describe(
              `Put all ${contentType} tool output into the ToolMessage.artifact array`
            ),
        ])
        .describe(
          `Where to place ${contentType} tool output in the LangChain ToolMessage`
        )
        .optional(),
    ])
  ) as {
    [K in CallToolResultContentType]: z.ZodOptional<
      z.ZodUnion<[z.ZodLiteral<"content">, z.ZodLiteral<"artifact">]>
    >;
  }
);

export type DetailedOutputHandling = z.output<
  typeof detailedOutputHandlingSchema
>;

export const outputHandlingSchema = z
  .union([outputTypesUnion, detailedOutputHandlingSchema])
  .describe(
    "Defines where to place each tool output type in the LangChain ToolMessage.\n\n" +
      "Items in the `content` field will be used as input context for the LLM, while the artifact field is\n" +
      "used for capturing tool output that won't be shown to the model, to be used in some later workflow\n" +
      "step.\n\n" +
      "For example, imagine that you have a SQL query tool that can return huge result sets. Rather than\n" +
      "sending these large outputs directly to the model, perhaps you want the model to be able to inspect\n" +
      "the output in a code execution environment. In this case, you would set the output handling for the\n" +
      "`resource` type to `artifact` (it's default value), and then upon initialization of your code\n" +
      "execution environment, you would look through your message history for `ToolMessage`s with the\n" +
      "`artifact` field set to `resource`, and use the `content` field during initialization of the\n" +
      "environment."
  );

/**
 * Defines where to place each tool output type in the LangChain ToolMessage.
 *
 * Can be set to `content` or `artifact` to send all tool output into the ToolMessage.content or
 * ToolMessage.artifact array, respectively, or you can assign an object that maps each content type
 * to `content` or `artifact`.
 *
 * @default {
 *   "text": "content",
 *   "image": "content",
 *   "audio": "content",
 *   "resource": "artifact"
 * }
 *
 * Items in the `content` field will be used as input context for the LLM, while the artifact field is
 * used for capturing tool output that won't be shown to the model, to be used in some later workflow
 * step.
 *
 * For example, imagine that you have a SQL query tool that can return huge result sets. Rather than
 * sending these large outputs directly to the model, perhaps you want the model to be able to inspect
 * the output in a code execution environment. In this case, you would set the output handling for the
 * `resource` type to `artifact` (its default value), and then upon initialization of your code
 * execution environment, you would look through your message history for `ToolMessage`s with the
 * `artifact` field set to `resource`, and use the `content` field during initialization of the
 * environment.
 */
export type OutputHandling = z.output<typeof outputHandlingSchema>;

/**
 * Zod schema for validating OAuthClientProvider interface
 * Since OAuthClientProvider has methods, we create a custom validator
 */
export const oAuthClientProviderSchema = z.custom<OAuthClientProvider>(
  (val) => {
    if (!val || typeof val !== "object") return false;

    // Check required properties and methods exist
    const requiredMethods = [
      "redirectUrl",
      "clientMetadata",
      "clientInformation",
      "tokens",
      "saveTokens",
    ];

    // redirectUrl can be a string, URL, or getter returning string/URL
    if (!("redirectUrl" in val)) return false;

    // clientMetadata can be an object or getter returning an object
    if (!("clientMetadata" in val)) return false;

    // Check that required methods exist (they can be functions or getters)
    for (const method of requiredMethods) {
      if (!(method in val)) return false;
    }

    return true;
  },
  {
    message:
      "Must be a valid OAuthClientProvider implementation with required properties: redirectUrl, clientMetadata, clientInformation, tokens, saveTokens",
  }
);

export const baseConfigSchema = z.object({
  /**
   * Defines where to place each tool output type in the LangChain ToolMessage.
   *
   * Can be set to `content` or `artifact` to send all tool output into the ToolMessage.content or
   * ToolMessage.artifact array, respectively, or you can assign an object that maps each content type
   * to `content` or `artifact`.
   *
   * @default {
   *   "text": "content",
   *   "image": "content",
   *   "audio": "content",
   *   "resource": "artifact"
   * }
   *
   * Items in the `content` field will be used as input context for the LLM, while the artifact field is
   * used for capturing tool output that won't be shown to the model, to be used in some later workflow
   * step.
   *
   * For example, imagine that you have a SQL query tool that can return huge result sets. Rather than
   * sending these large outputs directly to the model, perhaps you want the model to be able to inspect
   * the output in a code execution environment. In this case, you would set the output handling for the
   * `resource` type to `artifact` (its default value), and then upon initialization of your code
   * execution environment, you would look through your message history for `ToolMessage`s with the
   * `artifact` field set to `resource`, and use the `content` field during initialization of the
   * environment.
   */
  outputHandling: outputHandlingSchema.optional(),

  /**
   * Default timeout in milliseconds for tool execution. Must be greater than 0.
   * If not specified, tools will use their own configured timeout values.
   */
  defaultToolTimeout: z.number().min(1).optional(),
});

/**
 * Stdio transport restart configuration
 */
export const stdioRestartSchema = z
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

/**
 * Stdio transport connection
 */
export const stdioConnectionSchema = z
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
    restart: stdioRestartSchema.optional(),
  })
  .and(baseConfigSchema)
  .describe("Configuration for stdio transport connection");

/**
 * Streamable HTTP transport reconnection configuration
 */
export const streamableHttpReconnectSchema = z
  .object({
    /**
     * Whether to automatically reconnect if the connection is lost
     */
    enabled: z
      .boolean()
      .describe("Whether to automatically reconnect if the connection is lost")
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

/**
 * Streamable HTTP transport connection
 */
export const streamableHttpConnectionSchema = z
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
     * OAuth client provider for automatic authentication handling.
     * When provided, the transport will automatically handle token refresh,
     * 401 error retries, and OAuth 2.0 flows according to RFC 6750.
     * This is the recommended approach for authentication instead of manual headers.
     */
    authProvider: oAuthClientProviderSchema.optional(),
    /**
     * Additional reconnection settings.
     */
    reconnect: streamableHttpReconnectSchema.optional(),
    /**
     * Whether to automatically fallback to SSE if Streamable HTTP is not available or not supported
     *
     * @default true
     */
    automaticSSEFallback: z.boolean().optional().default(true),
  })
  .and(baseConfigSchema)
  .describe("Configuration for streamable HTTP transport connection");

/**
 * Create combined schema for all transport connection types
 */
export const connectionSchema = z
  .union([stdioConnectionSchema, streamableHttpConnectionSchema])
  .describe("Configuration for a single MCP server");

const toolSourceSchema = z.object({
  type: z.literal("tool"),
  name: z.string(),
  args: z.unknown(),
  server: z.string(),
});
/**
 * we don't know yet what other types of sources may send progress messages
 */
const unknownSourceSchema = z.object({
  type: z.literal("unknown"),
});
const eventContextSchema = z.union([toolSourceSchema, unknownSourceSchema]);
export type EventContext = z.output<typeof eventContextSchema>;

const serverMessageSourceSchema = z.object({
  server: z.string(),
  options: connectionSchema,
});
export type ServerMessageSource = z.output<typeof serverMessageSourceSchema>;

export const notifications = z.object({
  /**
   * Called when a log message is received.
   *
   * @param logMessage - The log message
   * @param logMessage.message - The log message
   * @param logMessage.level - The log level
   * @param logMessage.timestamp - The log timestamp
   * @param source - The source of the log message
   * @param source.server - The server of the source, e.g. "my-server"
   * @param source.option - The connection options of the source, e.g. `{ transport: "stdio", command: "node", args: ["server.js"] }`
   * @returns The log message
   *
   * @example
   * ```ts
   * const client = new MultiServerMCPClient({
   *   // ...
   *   onLog: (logMessage) => {
   *     console.log(logMessage);
   *   },
   * });
   * ```
   */
  onMessage: z
    .function()
    .args(
      z.object({
        /**
         * The severity of this log message.
         */
        level: LoggingLevelSchema,
        /**
         * An optional name of the logger issuing this message.
         */
        logger: z.optional(z.string()),
        /**
         * The data to be logged, such as a string message or an object. Any JSON serializable type is allowed here.
         */
        data: z.unknown(),
      }),
      serverMessageSourceSchema
    )
    .returns(z.union([z.void(), z.promise(z.void())]))
    .optional(),
  /**
   * Called when a progress message is received.
   *
   * @param progress - The progress message
   * @param progress.message - The progress message
   * @param progress.percentage - The progress percentage
   * @param progress.timestamp - The progress timestamp
   * @param source - The source of the progress message
   * @param source.type - The type of the source, e.g. "tool"
   * @param source.server - The server of the source, e.g. "my-server"
   * @param source.name - The name of the source, e.g. "my-name"
   * @param source.args - The arguments of the source, e.g. { a: 1, b: 2 }
   * @returns The progress message
   *
   * @example
   * ```ts
   * const client = new MultiServerMCPClient({
   *   // ...
   *   onProgress: (progress, source) => {
   *     if (source.type === "tool") {
   *     console.log(progress);
   *   },
   * });
   * ```
   */
  onProgress: z
    .function()
    .args(
      z.object({
        /**
         * The progress thus far. This should increase every time progress is made, even if the total is unknown.
         */
        progress: z.number(),
        /**
         * Total number of items to process (or total progress required), if known.
         */
        total: z.optional(z.number()),
        /**
         * An optional message describing the current progress.
         */
        message: z.optional(z.string()),
      }),
      eventContextSchema
    )
    .returns(z.union([z.void(), z.promise(z.void())]))
    .optional(),
  onCancelled: z
    .function()
    .args(
      z.object({
        /**
         * The ID of the request to cancel.
         *
         * This MUST correspond to the ID of a request previously issued in the same direction.
         */
        requestId: RequestIdSchema,

        /**
         * An optional string describing the reason for the cancellation. This MAY be logged or presented to the user.
         */
        reason: z.string().optional(),
      }),
      serverMessageSourceSchema
    )
    .returns(z.union([z.void(), z.promise(z.void())]))
    .optional(),
  /**
   * Called when the server is initialized.
   *
   * @param source - The source of the initialized message
   * @param source.server - The server of the source, e.g. "my-server"
   * @param source.options - The connection options of the source, e.g. `{ transport: "stdio", command: "node", args: ["server.js"] }`, see {@link ServerMessageSource}
   * @returns The initialized message
   *
   * @example
   * ```ts
   * const client = new MultiServerMCPClient({
   *   // ...
   *   onInitialized: (source) => {
   *     console.log(source);
   *   },
   * });
   * ```
   */
  onInitialized: z
    .function()
    .args(serverMessageSourceSchema)
    .returns(z.union([z.void(), z.promise(z.void())]))
    .optional(),
  /**
   * Called when the prompts list is changed.
   *
   * @param source - The source of the prompts list changed message
   * @param source.server - The server of the source, e.g. "my-server"
   * @param source.options - The connection options of the source, e.g. `{ transport: "stdio", command: "node", args: ["server.js"] }`, see {@link ServerMessageSource}
   * @returns The prompts list changed message
   *
   * @example
   * ```ts
   * const client = new MultiServerMCPClient({
   *   // ...
   *   onPromptsListChanged: (source) => {
   *     console.log(source);
   *   },
   * });
   * ```
   */
  onPromptsListChanged: z
    .function()
    .args(serverMessageSourceSchema)
    .returns(z.union([z.void(), z.promise(z.void())]))
    .optional(),
  /**
   * Called when the resources list is changed.
   *
   * @param source - The source of the resources list changed message
   * @param source.server - The server of the source, e.g. "my-server"
   * @param source.options - The connection options of the source, e.g. `{ transport: "stdio", command: "node", args: ["server.js"] }`, see {@link ServerMessageSource}
   * @returns The resources list changed message
   *
   * @example
   * ```ts
   * const client = new MultiServerMCPClient({
   *   // ...
   *   onResourcesListChanged: (source) => {
   *     console.log(source);
   *   },
   * });
   * ```
   */
  onResourcesListChanged: z
    .function()
    .args(serverMessageSourceSchema)
    .returns(z.union([z.void(), z.promise(z.void())]))
    .optional(),
  /**
   * Called when the resources are updated.
   *
   * @param updatedResource - The updated resource
   * @param updatedResource.uri - The URI of the resource that has been updated. This might be a sub-resource of the one that the client actually subscribed to.
   * @param source - The source of the resources updated message
   * @param source.server - The server of the source, e.g. "my-server"
   * @param source.options - The connection options of the source, e.g. `{ transport: "stdio", command: "node", args: ["server.js"] }`, see {@link ServerMessageSource}
   * @returns The resources updated message
   *
   * @example
   * ```ts
   * const client = new MultiServerMCPClient({
   *   // ...
   *   onResourcesUpdated: (updatedResource, source) => {
   *     console.log(`Resource ${updatedResource.uri} updated`);
   *   },
   * });
   * ```
   */
  onResourcesUpdated: z
    .function()
    .args(
      z.object({
        /**
         * The URI of the resource that has been updated. This might be a sub-resource of the one that the client actually subscribed to.
         */
        uri: z.string(),
      }),
      serverMessageSourceSchema
    )
    .returns(z.union([z.void(), z.promise(z.void())]))
    .optional(),
  /**
   * Called when the roots list is changed.
   *
   * @param source - The source of the roots list changed message
   * @param source.server - The server of the source, e.g. "my-server"
   * @param source.options - The connection options of the source, e.g. `{ transport: "stdio", command: "node", args: ["server.js"] }`, see {@link ServerMessageSource}
   * @returns The roots list changed message
   *
   * @example
   * ```ts
   * const client = new MultiServerMCPClient({
   *   // ...
   *   onRootsListChanged: (source) => {
   *     console.log(source);
   *   },
   * });
   * ```
   */
  onRootsListChanged: z
    .function()
    .args(serverMessageSourceSchema)
    .returns(z.union([z.void(), z.promise(z.void())]))
    .optional(),
  /**
   * Called when the tools list is changed.
   *
   * @param source - The source of the tools list changed message
   * @param source.server - The server of the source, e.g. "my-server"
   * @param source.options - The connection options of the source, e.g. `{ transport: "stdio", command: "node", args: ["server.js"] }`, see {@link ServerMessageSource}
   * @returns The tools list changed message
   *
   * @example
   * ```ts
   * const client = new MultiServerMCPClient({
   *   // ...
   *   onToolsListChanged: (source) => {
   *     console.log(source);
   *   },
   * });
   * ```
   */
  onToolsListChanged: z
    .function()
    .args(serverMessageSourceSchema)
    .returns(z.union([z.void(), z.promise(z.void())]))
    .optional(),
});
export type Notifications = z.output<typeof notifications>;

/**
 * {@link MultiServerMCPClient} configuration
 */
export const clientConfigSchema = z
  .object({
    /**
     * A map of server names to their configuration
     */
    mcpServers: z
      .record(connectionSchema)
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
      .default(false),
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
      .default(""),
    /**
     * If true, the tool will use LangChain's standard multimodal content blocks for tools that output
     * image or audio content, and embedded resources will be converted to `StandardFileBlock` objects.
     * When `false`, all artifacts are left in their MCP format, but embedded resources will be
     * converted to `StandardFileBlock` objects if {@link ClientConfig#outputHandling} causes embedded resources to
     * be treated as content, as otherwise ChatModel providers will not be able to interpret them.
     *
     * @default false
     */
    useStandardContentBlocks: z
      .boolean()
      .describe(
        "If true, the tool will use LangChain's standard multimodal content blocks for tools that output\n" +
          "image or audio content. When true, embedded resources will be converted to `StandardFileBlock`\n" +
          "objects. When `false`, all artifacts are left in their MCP format, but embedded resources will\n" +
          "be converted to `StandardFileBlock` objects if `outputHandling` causes embedded resources to be\n" +
          "treated as content, as otherwise ChatModel providers will not be able to interpret them."
      )
      .optional()
      .default(false),
    /**
     * Behavior when a server fails to connect.
     * - "throw": Throw an error immediately if any server fails to connect (default)
     * - "ignore": Skip failed servers and continue with successfully connected ones
     * - Function: Custom error handler. If the function throws, the error is bubbled through.
     *   If it returns normally, the server is treated as ignored and skipped.
     *
     * @default "throw"
     */
    onConnectionError: z
      .union([
        z.enum(["throw", "ignore"]),
        z
          .function()
          .args(
            z.object({
              serverName: z.string(),
              error: z.unknown(),
            })
          )
          .returns(z.void()),
      ])
      .describe(
        "Behavior when a server fails to connect: 'throw' to error immediately, 'ignore' to skip failed servers, or a function for custom error handling"
      )
      .optional()
      .default("throw"),
  })
  .and(baseConfigSchema)
  .and(toolHooksSchema)
  .and(notifications)
  .describe("Configuration for the MCP client");

/**
 * Configuration for stdio transport connection
 */
export type StdioConnection = z.input<typeof stdioConnectionSchema>;

/**
 * Type for {@link StdioConnection} with default values applied.
 */
export type ResolvedStdioConnection = z.output<typeof stdioConnectionSchema>;

/**
 * Configuration for streamable HTTP transport connection
 */
export type StreamableHTTPConnection = z.input<
  typeof streamableHttpConnectionSchema
>;

/**
 * Type for {@link StreamableHTTPConnection} with default values applied.
 */
export type ResolvedStreamableHTTPConnection = z.output<
  typeof streamableHttpConnectionSchema
>;

/**
 * Union type for all transport connection types
 */
export type Connection = z.input<typeof connectionSchema>;

/**
 * Type for {@link MultiServerMCPClient} configuration
 */
export type ClientConfig = z.input<typeof clientConfigSchema>;

/**
 * Type for {@link Connection} with default values applied.
 */
export type ResolvedConnection = z.output<typeof connectionSchema>;

/**
 * Type for {@link MultiServerMCPClient} configuration, with default values applied.
 */
export type ResolvedClientConfig = z.output<typeof clientConfigSchema>;

/**
 * Custom error handler function for connection errors.
 * If the function throws, the error is bubbled through.
 * If it returns normally, the server is treated as ignored and skipped.
 *
 * @param params - Error handler parameters
 * @param params.serverName - The name of the server that failed to connect
 * @param params.error - The error that occurred during connection
 */
export type ConnectionErrorHandler = (params: {
  serverName: string;
  error: unknown;
}) => void;

export type LoadMcpToolsOptions = {
  /**
   * If true, throw an error if a tool fails to load.
   *
   * @default true
   */
  throwOnLoadError?: boolean;

  /**
   * If true, the tool name will be prefixed with the server name followed by a double underscore.
   * This is useful if you want to avoid tool name collisions across servers.
   *
   * @default false
   */
  prefixToolNameWithServerName?: boolean;

  /**
   * An additional prefix to add to the tool name. Will be added at the very beginning of the tool
   * name, separated by a double underscore.
   *
   * For example, if `additionalToolNamePrefix` is `"mcp"`, and `prefixToolNameWithServerName` is
   * `true`, the tool name `"my-tool"` provided by server `"my-server"` will become
   * `"mcp__my-server__my-tool"`.
   *
   * Similarly, if `additionalToolNamePrefix` is `mcp` and `prefixToolNameWithServerName` is false,
   * the tool name would be `"mcp__my-tool"`.
   *
   * @default ""
   */
  additionalToolNamePrefix?: string;

  /**
   * If true, the tool will use LangChain's standard multimodal content blocks for tools that output
   * image or audio content, and embedded resources will be converted to `StandardFileBlock` objects.
   * When `false`, all artifacts are left in their MCP format, but embedded resources will be
   * converted to `StandardFileBlock` objects if {@link outputHandling} causes embedded resources to
   * be treated as content, as otherwise ChatModel providers will not be able to interpret them.
   *
   * @default false
   */
  useStandardContentBlocks?: boolean;

  /**
   * Defines where to place each tool output type in the LangChain ToolMessage.
   *
   * @default {
   *   "text": "content",
   *   "image": "content",
   *   "audio": "content",
   *   "resource": "artifact"
   * }
   */
  outputHandling?: OutputHandling;

  /**
   * Default timeout in milliseconds for tool execution. Must be greater than 0.
   * If not specified, tools will use their own configured timeout values.
   */
  defaultToolTimeout?: number;

  /**
   * `onProgress` callbacks used for tool calls.
   */
  onProgress?: Notifications["onProgress"];

  /**
   * `beforeToolCall` callbacks used for tool calls.
   */
  beforeToolCall?: ToolHooks["beforeToolCall"];

  /**
   * `afterToolCall` callbacks used for tool calls.
   */
  afterToolCall?: ToolHooks["afterToolCall"];
};

/**
 * Helper function that expands a string literal OutputHandling to an object with all content types.
 * Used when applying server-level overrides to the top-level config.
 *
 * @internal
 */
export function _resolveDetailedOutputHandling(
  outputHandling: OutputHandling | undefined,
  applyDefaults: boolean = false
): DetailedOutputHandling {
  if (outputHandling == null) {
    return {};
  }
  if (typeof outputHandling === "string") {
    return Object.fromEntries(
      callToolResultContentTypes.map((contentType) => [
        contentType,
        outputHandling,
      ])
    );
  }

  const resolved: DetailedOutputHandling = {};
  for (const contentType of callToolResultContentTypes) {
    if (outputHandling[contentType] || applyDefaults) {
      resolved[contentType] =
        outputHandling[contentType] ??
        (contentType === "resource" ? "artifact" : "content");
    }
  }
  return resolved;
}

/**
 * Given a base {@link OutputHandling}, apply any overrides from the override {@link OutputHandling}.
 *
 * @internal
 */
export function _resolveAndApplyOverrideHandlingOverrides(
  base: OutputHandling | undefined,
  override: OutputHandling | undefined
): OutputHandling {
  const expandedBase = _resolveDetailedOutputHandling(base);
  const expandedOverride = _resolveDetailedOutputHandling(override);

  return {
    ...expandedBase,
    ...expandedOverride,
  };
}

export interface CustomHTTPTransportOptions {
  authProvider?: OAuthClientProvider;
  headers?: Record<string, string>;
}

/**
 * Represents a resource provided by an MCP server.
 */
export type MCPResource = {
  /**
   * The URI of the resource
   */
  uri: string;
  /**
   * Human-readable name of the resource
   */
  name: string;
  /**
   * Optional description of what the resource represents
   */
  description?: string;
  /**
   * Optional MIME type of the resource content
   */
  mimeType?: string;
};

/**
 * Represents a resource template provided by an MCP server.
 * Resource templates are used for dynamic resources with parameterized URIs.
 */
export type MCPResourceTemplate = {
  /**
   * The URI template with parameter placeholders (e.g., "users://{userId}/profile")
   */
  uriTemplate: string;
  /**
   * Human-readable name of the resource template
   */
  name: string;
  /**
   * Optional description of what the resource template represents
   */
  description?: string;
  /**
   * Optional MIME type of the resource content
   */
  mimeType?: string;
};

/**
 * Represents the content of a resource retrieved from an MCP server.
 */
export type MCPResourceContent = {
  /**
   * The URI of the resource
   */
  uri: string;
  /**
   * Optional MIME type of the content
   */
  mimeType?: string;
  /**
   * Optional text content of the resource
   */
  text?: string;
  /**
   * Optional base64-encoded binary content of the resource
   */
  blob?: string;
};
