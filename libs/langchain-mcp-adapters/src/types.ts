import type { MCPElicitationHandler } from "./elicitation.js";
import { z } from "zod";
import {
  LoggingLevelSchema,
  SubscriptionFilterSchema,
} from "@modelcontextprotocol/core";
import type {
  CacheMode,
  ListResourcesResult,
  ListResourceTemplatesResult,
  ReadResourceResult,
  OAuthClientProvider as _MCPOAuthClientProvider,
  LoggingMessageNotificationParams,
  Progress,
  ResourceUpdatedNotificationParams,
  Client as MCPClient,
  Transport,
} from "@modelcontextprotocol/client";

import { toolHooksSchema } from "./hooks.js";
import { outputHandlingSchema } from "./content.js";
export {
  callToolResultContentTypes,
  outputHandlingSchema,
  type CallToolResultContentType,
  type DetailedOutputHandling,
  type OutputHandling,
} from "./content.js";

export namespace _MCPAliases {
  export type MCPResource = ListResourcesResult["resources"][number];
  export type MCPResourceTemplate =
    ListResourceTemplatesResult["resourceTemplates"][number];
  export type MCPResourceContent = ReadResourceResult["contents"][number];
}

export const OAuthClientProvider = z
  .custom<_MCPOAuthClientProvider>(
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

export type OAuthClientProvider = z.infer<typeof OAuthClientProvider>;

export interface ServerMessageSource {
  server: string;
  options: Connection;
}

const NotificationCallbacks = z.object({
  /**
   * @deprecated Protocol logging is deprecated; prefer OpenTelemetry or stderr.
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
   *   servers: {
   *     local: {
   *       command: "node",
   *       args: ["server.js"],
   *       onMessage: (logMessage) => {
   *         console.log(logMessage);
   *       },
   *     },
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
   * Observers do not block tool execution. A callback that throws or rejects
   * is ignored rather than failing the tool call; the adapter does not log
   * observer failures.
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
   *   servers: {
   *     local: {
   *       command: "node",
   *       args: ["server.js"],
   *       onProgress: (progress, source) => {
   *         if (source.type === "tool") {
   *           console.log(source.name, progress.progress, progress.total);
   *         }
   *       },
   *     },
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
   *   servers: {
   *     local: {
   *       mode: "legacy",
   *       command: "node",
   *       args: ["server.js"],
   *       onInitialized: (source) => {
   *         console.log(source);
   *       },
   *     },
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
   *   servers: {
   *     local: {
   *       command: "node",
   *       args: ["server.js"],
   *       onPromptsListChanged: (source) => {
   *         console.log(source);
   *       },
   *     },
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
   *   servers: {
   *     local: {
   *       command: "node",
   *       args: ["server.js"],
   *       onResourcesListChanged: (source) => {
   *         console.log(source);
   *       },
   *     },
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
   *   servers: {
   *     local: {
   *       command: "node",
   *       args: ["server.js"],
   *       onResourcesUpdated: (updatedResource, source) => {
   *         console.log(`Resource ${updatedResource.uri} updated`);
   *       },
   *     },
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
   * Called when the tools list is changed.
   *
   * @param source - The source of the tools list changed message
   * @param source.server - The server of the source, e.g. "my-server"
   * @param source.options - The connection options of the source, e.g. `{ transport: "stdio", command: "node", args: ["server.js"] }`, see {@link ServerMessageSource}
   *
   * @example
   * ```ts
   * const client = new MCPAdapter({
   *   servers: {
   *     local: {
   *       command: "node",
   *       args: ["server.js"],
   *       onToolsListChanged: (source) => {
   *         console.log(source);
   *       },
   *     },
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

export type NotificationCallbacks = z.output<typeof NotificationCallbacks>;

const ConnectionPolicy = z.object({
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

type ConnectionPolicy = z.infer<typeof ConnectionPolicy>;

const AutomaticPolicy = ConnectionPolicy.extend(
  NotificationCallbacks.omit({ onInitialized: true }).shape
)
  .extend(SubscriptionFilterSchema.pick({ resourceSubscriptions: true }).shape)
  .extend({
    /**
     * MCP protocol negotiation strategy.
     *
     * - `"auto"` tries the current MCP protocol and falls back when the server
     *   only supports the legacy protocol.
     * - `"modern"` requires the current MCP protocol and fails instead of
     *   connecting to a legacy server.
     *
     * @default "auto"
     */
    mode: z.enum(["auto", "modern"]).optional().default("auto"),
    /**
     * Whether in-band MCP elicitation requests should suspend a LangGraph run
     * and surface as graph interrupts.
     *
     * This requires a modern MCP server and a LangGraph checkpointer.
     *
     * @default false
     */
    elicitation: z.boolean().default(false),
    logLevel: LoggingLevelSchema.optional(),
  });

type AutomaticPolicy = z.infer<typeof AutomaticPolicy>;

const LegacyPolicy = ConnectionPolicy.extend(NotificationCallbacks.shape)
  .extend(SubscriptionFilterSchema.pick({ resourceSubscriptions: true }).shape)
  .extend({
    /**
     * Use the legacy MCP client interface without protocol auto-negotiation.
     *
     * Select this mode for SDK 1 servers or when startup probing is undesirable.
     */
    mode: z.literal("legacy"),
    /**
     * Handles elicitation requests from a legacy MCP server.
     *
     * Modern servers use `elicitation: true` and LangGraph interrupts instead.
     */
    onElicitation: z
      .custom<MCPElicitationHandler>(
        (value) => typeof value === "function",
        "Expected an elicitation callback"
      )
      .optional(),
    logLevel: LoggingLevelSchema.optional(),
  });

type LegacyPolicy = z.infer<typeof LegacyPolicy>;

function connectionObject<T extends z.ZodRawShape>(shape: T) {
  return z.discriminatedUnion("mode", [
    AutomaticPolicy.extend(shape).strict(),
    LegacyPolicy.extend(shape).strict(),
  ]);
}

export const StdioConnection = connectionObject({
  /**
   * Optional transport type, inferred from the structure of the config if not provided. Included
   * for compatibility with common MCP client config file formats.
   */
  transport: z.literal("stdio").default("stdio"),
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
  restart: z
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
        .int()
        .nonnegative()
        .describe("The maximum number of restart attempts")
        .optional(),
      /**
       * Delay in milliseconds between restart attempts
       */
      delayMs: z
        .number()
        .nonnegative()
        .describe("The delay in milliseconds between restart attempts")
        .optional(),
    })
    .describe("Configuration for stdio transport restart")
    .optional(),
}).describe("Configuration for stdio transport connection");

export type StdioConnection = z.output<typeof StdioConnection>;
export type StdioConnectionInit = z.input<typeof StdioConnection>;

const HTTPConnectionParams = z.object({
  /**
   * The URL to connect to
   */
  url: z.string().url(),
  /**
   * Additional headers to send with the request, useful for authentication
   */
  headers: z
    .record(z.string(), z.string())
    .transform((headers) => {
      return Object.fromEntries(
        Object.entries(headers).map(([name, value]) => [
          name.toLowerCase() === "authorization" ? "Authorization" : name,
          value,
        ])
      );
    })
    .optional(),
  /**
   * OAuth client provider for automatic authentication handling.
   * When provided, the transport will automatically handle token refresh,
   * 401 error retries, and OAuth 2.0 flows according to RFC 6750.
   * This is the recommended approach for authentication instead of manual headers.
   */
  authProvider: OAuthClientProvider.optional(),
});

export const SSEConnection = connectionObject({
  /**
   * Optional transport type, inferred from the structure of the config. If "sse", will not attempt
   * to connect using streamable HTTP.
   */
  transport: z
    .union([z.literal("http"), z.literal("sse")])
    .optional()
    .default("http"),
  ...HTTPConnectionParams.shape,
  /**
   * Additional reconnection settings.
   */
  reconnect: z
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
        .int()
        .nonnegative()
        .describe("The maximum number of reconnection attempts")
        .optional(),
      /**
       * Delay in milliseconds between reconnection attempts
       */
      delayMs: z
        .number()
        .nonnegative()
        .describe("The delay in milliseconds between reconnection attempts")
        .optional(),
    })
    .describe("Configuration for streamable HTTP transport reconnection")
    .optional(),
}).describe("Configuration for streamable HTTP transport connection");

export type SSEConnection = z.output<typeof SSEConnection>;
export type SSEConnectionInit = z.input<typeof SSEConnection>;

export const ClientConnection = z.custom<MCPClient>(
  (value) =>
    value !== null &&
    typeof value === "object" &&
    "listTools" in value &&
    typeof value.listTools === "function" &&
    "callTool" in value &&
    typeof value.callTool === "function" &&
    "close" in value &&
    typeof value.close === "function",
  "Expected a connected MCP Client"
);

export type ClientConnection = z.infer<typeof ClientConnection>;

export interface MCPServerLike {
  connect(transport: Transport): Promise<void>;
  close(): Promise<void>;
}

export const InProcessConnection = z.custom<MCPServerLike>(
  (value) =>
    value !== null &&
    typeof value === "object" &&
    "connect" in value &&
    typeof value.connect === "function" &&
    "close" in value &&
    typeof value.close === "function" &&
    !ClientConnection.safeParse(value).success,
  "Expected an in-process MCP server"
);

export type InProcessConnection = z.infer<typeof InProcessConnection>;

export const Connection = z.union([
  StdioConnection,
  SSEConnection,
  ClientConnection,
  InProcessConnection,
  z
    .string()
    .refine((value) => /^https?:\/\//iu.test(value), {
      error: "MCPAdapter string inputs must use http: or https:",
    })
    .transform((value) => SSEConnection.parse({ url: value })),
  z
    .instanceof(URL)
    .refine((url) => url.protocol === "http:" || url.protocol === "https:", {
      error: "MCPAdapter URL inputs must use http: or https:",
    })
    .transform((url) => SSEConnection.parse({ url: url.toString() })),
]);

export type Connection = z.output<typeof Connection>;
export type ConnectionInit = z.input<typeof Connection>;

export type DescriptorConnection =
  | z.output<typeof StdioConnection>
  | z.output<typeof SSEConnection>;

export function isDescriptorConnection(
  value: Connection
): value is DescriptorConnection {
  return (
    value !== null &&
    typeof value === "object" &&
    "transport" in value &&
    (value.transport === "stdio" ||
      value.transport === "http" ||
      value.transport === "sse")
  );
}

export type ConnectionErrorHandler = (params: {
  serverName: string;
  error: unknown;
}) => void | Promise<void>;

export const MCPAdapterParams = z
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
     * @default false
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
     * @default ""
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
  .extend(ConnectionPolicy.shape)
  .extend(toolHooksSchema.shape)
  .strict();

export type MCPAdapterParams = z.input<typeof MCPAdapterParams>;

export const MCPAdapterConfig = MCPAdapterParams.extend({
  servers: z
    .record(z.string(), Connection)
    .refine((servers) => Object.keys(servers).length > 0, {
      error: "No MCP servers provided",
    }),
});

/** Accept either one direct connection or a named server map without normalizing one into the other. */
export const MCPAdapterInit = z.union([Connection, MCPAdapterConfig]);

export type MCPAdapterConfig = z.output<typeof MCPAdapterConfig>;
export type MCPAdapterConfigInit = z.input<typeof MCPAdapterConfig>;
export type MCPAdapterInit = z.input<typeof MCPAdapterInit>;

export const EventContext = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("tool"),
    name: z.string(),
    args: z.unknown(),
    server: z.string(),
  }),
  z.object({ type: z.literal("unknown") }),
]);

export type EventContext = z.output<typeof EventContext>;

export const LoadMcpToolsParams = MCPAdapterParams.pick({
  throwOnLoadError: true,
  prefixToolNameWithServerName: true,
  additionalToolNamePrefix: true,
  outputHandling: true,
  defaultToolTimeout: true,
  beforeToolCall: true,
  afterToolCall: true,
})
  .partial()
  .extend(NotificationCallbacks.pick({ onProgress: true }).shape)
  .extend({
    logLevel: LoggingLevelSchema.optional(),
    /** Answer in-band input requests with LangGraph interrupts. */
    elicitation: z.boolean().optional(),
  });

export type LoadMcpToolsParams = z.input<typeof LoadMcpToolsParams>;

export const CustomHTTPTransportParams = HTTPConnectionParams.pick({
  authProvider: true,
  headers: true,
}).strict();

export type CustomHTTPTransportParams = z.input<
  typeof CustomHTTPTransportParams
>;

export const ToolDiscoveryParams = CustomHTTPTransportParams.extend({
  cacheMode: z
    .enum(["use", "refresh", "bypass"] satisfies CacheMode[])
    .optional(),
});

export type ToolDiscoveryOptions = z.input<typeof ToolDiscoveryParams>;
