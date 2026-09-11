import { z } from "zod";
import type {
  CacheMode,
  CallToolResult,
  ListResourcesResult,
  ListResourceTemplatesResult,
  ReadResourceResult,
  OAuthClientProvider,
  LoggingMessageNotificationParams,
  Progress,
  CancelledNotificationParams,
  ResourceUpdatedNotificationParams,
} from "@modelcontextprotocol/client";
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

const callToolResultContentTypeSchema = z.enum([
  "audio",
  "image",
  "resource",
  "resource_link",
  "text",
] satisfies CallToolResult["content"][number]["type"][]);

export const callToolResultContentTypes =
  callToolResultContentTypeSchema.options;

export type CallToolResultContentType = z.output<
  typeof callToolResultContentTypeSchema
>;

const outputTypesUnion = z.enum(["content", "artifact"]);

const detailedOutputHandlingSchema = z.partialRecord(
  callToolResultContentTypeSchema,
  outputTypesUnion.optional()
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
 * Preserve the SDK-owned service and its prototype. Property checks validate
 * callable methods without replacing them or evaluating metadata getters.
 * The SDK remains responsible for parsing OAuth metadata and method results.
 */
export const oAuthClientProviderSchema = z
  .custom<OAuthClientProvider>(
    (value) =>
      value !== null &&
      typeof value === "object" &&
      "redirectUrl" in value &&
      "clientMetadata" in value,
    {
      error:
        "Expected an OAuthClientProvider with redirectUrl and clientMetadata",
    }
  )
  .check(
    z.property("clientInformation", z.function()),
    z.property("tokens", z.function()),
    z.property("saveTokens", z.function()),
    z.property("redirectToAuthorization", z.function()),
    z.property("saveCodeVerifier", z.function()),
    z.property("codeVerifier", z.function())
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
const stdioOptionsSchema = z
  .object({
    /**
     * Optional transport type, inferred from the structure of the config if not provided. Included
     * for compatibility with common MCP client config file formats.
     */
    transport: z.literal("stdio").default("stdio"),
    /**
     * Optional transport type, inferred from the structure of the config if not provided. Included
     * for compatibility with common MCP client config file formats.
     */
    type: z.literal("stdio").optional(),
    /**
     * The executable to run the server (e.g. `node`, `npx`, etc)
     */
    command: z.string().describe("The executable to run the server"),
    url: z
      .never({ error: "Specify a stdio command or an HTTP URL, not both" })
      .optional(),
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
      .record(z.string(), z.string())
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
  .extend(baseConfigSchema.shape)
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
const httpOptionsSchema = z
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
    command: z
      .never({ error: "Specify a stdio command or an HTTP URL, not both" })
      .optional(),
    /**
     * Additional headers to send with the request, useful for authentication
     */
    headers: z.record(z.string(), z.string()).optional(),
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
  .extend(baseConfigSchema.shape)
  .describe("Configuration for streamable HTTP transport connection");

/** Parse legacy aliases once and retain a concrete transport discriminator. */
export const stdioConnectionSchema = stdioOptionsSchema.transform(
  ({ type: _type, url: _url, ...options }) => options
);

const httpConnectionSchema = httpOptionsSchema
  .extend({
    transport: z.literal("http").default("http"),
    type: z
      .literal("http", {
        error: "type conflicts with transport; use transport only",
      })
      .optional(),
  })
  .transform(({ type: _type, command: _command, ...options }) => options);

const sseConnectionSchema = httpOptionsSchema
  .extend({
    transport: z.literal("sse").default("sse"),
    type: z
      .literal("sse", {
        error: "type conflicts with transport; use transport only",
      })
      .optional(),
  })
  .transform(({ type: _type, command: _command, ...options }) => options);

export const streamableHttpConnectionSchema = z.union([
  httpConnectionSchema,
  sseConnectionSchema,
]);

export const connectionSchema = z.union([
  stdioConnectionSchema,
  streamableHttpConnectionSchema,
]);

export type EventContext =
  | { type: "tool"; name: string; args: unknown; server: string }
  | { type: "unknown" };

/** Origin of a server notification. */
export interface ServerMessageSource {
  /** Configured server name, rather than the server's self-reported name. */
  server: string;
  /** A per-notification snapshot; callbacks and OAuth providers retain identity. */
  options: ResolvedConnection;
}

// SDK payloads are already parsed by the SDK. Keep callbacks as opaque runtime
// services; parsing a function schema would replace their identity with a wrapper.
const notifications = z.object({
  /**
   * Called when a log message is received.
   *
   * @param logMessage - The log message
   * @param logMessage.data - The data logged by the server
   * @param logMessage.level - The log level
   * @param logMessage.logger - Optional logger name
   * @param source - The source of the log message
   * @param source.server - The server of the source, e.g. "my-server"
   * @param source.options - The connection options of the source, e.g. `{ transport: "stdio", command: "node", args: ["server.js"] }`
   *
   * @example
   * ```ts
   * const client = new MCPAdapter({
   *   servers: { local: { command: "node", args: ["server.js"] } },
   *   onMessage: (logMessage) => {
   *     console.log(logMessage);
   *   },
   * });
   * ```
   */
  onMessage: z
    .custom<
      (
        message: LoggingMessageNotificationParams,
        source: ServerMessageSource
      ) => void | Promise<void>
    >((value) => typeof value === "function", "Expected a callback")
    .optional(),
  /**
   * Called when a progress message is received.
   *
   * @param progress - The progress message
   * @param progress.progress - Progress completed so far
   * @param progress.total - Total progress, if known
   * @param progress.message - Optional progress message
   * @param source - The source of the progress message
   * @param source.type - The type of the source, e.g. "tool"
   * @param source.server - The server of the source, e.g. "my-server"
   * @param source.name - The name of the source, e.g. "my-name"
   * @param source.args - The arguments of the source, e.g. { a: 1, b: 2 }
   *
   * @example
   * ```ts
   * const client = new MCPAdapter({
   *   servers: { local: { command: "node", args: ["server.js"] } },
   *   onProgress: (progress, source) => {
   *     if (source.type === "tool") {
   *       console.log(source.name, progress.progress, progress.total);
   *     }
   *   },
   * });
   * ```
   */
  onProgress: z
    .custom<(progress: Progress, source: EventContext) => void | Promise<void>>(
      (value) => typeof value === "function",
      "Expected a callback"
    )
    .optional(),
  /**
   * Observes server cancellation of a request it previously issued.
   * @param notification - Request ID and optional cancellation reason
   * @param source - Server identity and connection-options snapshot
   */
  onCancelled: z
    .custom<
      (
        notification: CancelledNotificationParams,
        source: ServerMessageSource
      ) => void | Promise<void>
    >((value) => typeof value === "function", "Expected a callback")
    .optional(),
  /**
   * Called when an initialized notification is received from the server.
   * This is a notification observer, not a connection-ready callback.
   *
   * @param source - The source of the initialized message
   * @param source.server - The server of the source, e.g. "my-server"
   * @param source.options - The connection options of the source, e.g. `{ transport: "stdio", command: "node", args: ["server.js"] }`, see {@link ServerMessageSource}
   *
   * @example
   * ```ts
   * const client = new MCPAdapter({
   *   servers: { local: { command: "node", args: ["server.js"] } },
   *   onInitialized: (source) => {
   *     console.log(source);
   *   },
   * });
   * ```
   */
  onInitialized: z
    .custom<(source: ServerMessageSource) => void | Promise<void>>(
      (value) => typeof value === "function",
      "Expected a callback"
    )
    .optional(),
  /**
   * Called when the prompts list is changed.
   *
   * @param source - The source of the prompts list changed message
   * @param source.server - The server of the source, e.g. "my-server"
   * @param source.options - The connection options of the source, e.g. `{ transport: "stdio", command: "node", args: ["server.js"] }`, see {@link ServerMessageSource}
   *
   * @example
   * ```ts
   * const client = new MCPAdapter({
   *   servers: { local: { command: "node", args: ["server.js"] } },
   *   onPromptsListChanged: (source) => {
   *     console.log(source);
   *   },
   * });
   * ```
   */
  onPromptsListChanged: z
    .custom<(source: ServerMessageSource) => void | Promise<void>>(
      (value) => typeof value === "function",
      "Expected a callback"
    )
    .optional(),
  /**
   * Called when the resources list is changed.
   *
   * @param source - The source of the resources list changed message
   * @param source.server - The server of the source, e.g. "my-server"
   * @param source.options - The connection options of the source, e.g. `{ transport: "stdio", command: "node", args: ["server.js"] }`, see {@link ServerMessageSource}
   *
   * @example
   * ```ts
   * const client = new MCPAdapter({
   *   servers: { local: { command: "node", args: ["server.js"] } },
   *   onResourcesListChanged: (source) => {
   *     console.log(source);
   *   },
   * });
   * ```
   */
  onResourcesListChanged: z
    .custom<(source: ServerMessageSource) => void | Promise<void>>(
      (value) => typeof value === "function",
      "Expected a callback"
    )
    .optional(),
  /**
   * Called when the resources are updated.
   *
   * @param updatedResource - The updated resource
   * @param updatedResource.uri - The URI of the resource that has been updated. This might be a sub-resource of the one that the client actually subscribed to.
   * @param source - The source of the resources updated message
   * @param source.server - The server of the source, e.g. "my-server"
   * @param source.options - The connection options of the source, e.g. `{ transport: "stdio", command: "node", args: ["server.js"] }`, see {@link ServerMessageSource}
   *
   * @example
   * ```ts
   * const client = new MCPAdapter({
   *   servers: { local: { command: "node", args: ["server.js"] } },
   *   onResourcesUpdated: (updatedResource, source) => {
   *     console.log(`Resource ${updatedResource.uri} updated`);
   *   },
   * });
   * ```
   */
  onResourcesUpdated: z
    .custom<
      (
        resource: ResourceUpdatedNotificationParams,
        source: ServerMessageSource
      ) => void | Promise<void>
    >((value) => typeof value === "function", "Expected a callback")
    .optional(),
  /**
   * Called when the roots list is changed.
   *
   * @param source - The source of the roots list changed message
   * @param source.server - The server of the source, e.g. "my-server"
   * @param source.options - The connection options of the source, e.g. `{ transport: "stdio", command: "node", args: ["server.js"] }`, see {@link ServerMessageSource}
   *
   * @example
   * ```ts
   * const client = new MCPAdapter({
   *   servers: { local: { command: "node", args: ["server.js"] } },
   *   onRootsListChanged: (source) => {
   *     console.log(source);
   *   },
   * });
   * ```
   */
  onRootsListChanged: z
    .custom<(source: ServerMessageSource) => void | Promise<void>>(
      (value) => typeof value === "function",
      "Expected a callback"
    )
    .optional(),
  /**
   * Called when the tools list is changed.
   *
   * @param source - The source of the tools list changed message
   * @param source.server - The server of the source, e.g. "my-server"
   * @param source.options - The connection options of the source, e.g. `{ transport: "stdio", command: "node", args: ["server.js"] }`, see {@link ServerMessageSource}
   *
   * @example
   * ```ts
   * const client = new MCPAdapter({
   *   servers: { local: { command: "node", args: ["server.js"] } },
   *   onToolsListChanged: (source) => {
   *     console.log(source);
   *   },
   * });
   * ```
   */
  onToolsListChanged: z
    .custom<(source: ServerMessageSource) => void | Promise<void>>(
      (value) => typeof value === "function",
      "Expected a callback"
    )
    .optional(),
});

export type Notifications = z.output<typeof notifications>;

/**
 * {@link MultiServerMCPClient} configuration
 */
const clientOptionsSchema = z
  .object({
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
        z.custom<ConnectionErrorHandler>(
          (value) => typeof value === "function",
          "Expected a connection error handler"
        ),
      ])
      .describe(
        "Behavior when a server fails to connect: 'throw' to error immediately, 'ignore' to skip failed servers, or a function for custom error handling"
      )
      .optional()
      .default("throw"),
  })
  .extend(baseConfigSchema.shape)
  .extend(toolHooksSchema.shape)
  .extend(notifications.shape)
  .describe("Configuration for the MCP client");

const serverMapSchema = z.record(z.string(), connectionSchema);

const exclusiveServerMap = z
  .never({ error: "Specify servers or legacy mcpServers, not both" })
  .optional();

/** Resolved legacy-shaped configuration also provides isolated public snapshots. */
export const clientConfigSchema = clientOptionsSchema.extend({
  mcpServers: serverMapSchema,
});

const canonicalConfigSchema = clientOptionsSchema.extend({
  servers: serverMapSchema,
  mcpServers: exclusiveServerMap,
});

const legacyConfigSchema = clientConfigSchema
  .extend({ servers: exclusiveServerMap })
  .transform(({ servers: _canonical, ...options }) => options);

/** All supported external shapes produce the same resolved configuration. */
export const adapterConfigSchema = z.union([
  canonicalConfigSchema.transform(
    ({ servers, mcpServers: _legacy, ...options }) => ({
      ...options,
      mcpServers: servers,
    })
  ),
  legacyConfigSchema,
  serverMapSchema.transform((mcpServers) => ({
    ...clientOptionsSchema.parse({}),
    mcpServers,
  })),
]);

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

/** Canonical adapter options. */
export type MCPAdapterConfig = z.input<typeof canonicalConfigSchema>;

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

export const customHTTPTransportOptionsSchema = httpOptionsSchema.pick({
  authProvider: true,
  headers: true,
});

export type CustomHTTPTransportOptions = z.input<
  typeof customHTTPTransportOptionsSchema
>;

/**
 * Represents a resource provided by an MCP server.
 */
export type MCPResource = ListResourcesResult["resources"][number];

/**
 * Represents a resource template provided by an MCP server.
 * Resource templates are used for dynamic resources with parameterized URIs.
 */
export type MCPResourceTemplate =
  ListResourceTemplatesResult["resourceTemplates"][number];

/**
 * Represents the content of a resource retrieved from an MCP server.
 */
export type MCPResourceContent = ReadResourceResult["contents"][number];

/** SDK cache policy for discovery; the SDK owns TTL and storage semantics. */
export const toolDiscoveryOptionsSchema =
  customHTTPTransportOptionsSchema.extend({
    cacheMode: z
      .enum(["use", "refresh", "bypass"] satisfies CacheMode[])
      .optional(),
  });
export type ToolDiscoveryOptions = z.input<typeof toolDiscoveryOptionsSchema>;
