/* __LC_ALLOW_ENTRYPOINT_SIDE_EFFECTS__ */
import {
  z,
  ZodTypeAny,
  ZodObject,
  ZodLiteral,
  ZodRawShape,
  UnknownKeysParam,
  Primitive,
} from "zod";
import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import { CallToolResultSchema } from "@modelcontextprotocol/sdk/types.js";
import type { UnionToTuple } from "./util.js";

export type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

function isZodObject(
  schema: unknown
): schema is ZodObject<ZodRawShape, UnknownKeysParam, ZodTypeAny> {
  return (
    typeof schema === "object" &&
    schema !== null &&
    "_def" in schema &&
    (schema as { _def: { typeName: string } })._def.typeName === "ZodObject"
  );
}

function isZodLiteral(schema: unknown): schema is ZodLiteral<Primitive> {
  return (
    typeof schema === "object" &&
    schema !== null &&
    "_def" in schema &&
    (schema as { _def: { typeName: string } })._def.typeName === "ZodLiteral"
  );
}

/**
 * Zod schema for an individual content item within a CallToolResult.
 */
const callToolResultContentSchema =
  CallToolResultSchema.shape.content._def.innerType.element;
export type CallToolResultContent = z.output<
  typeof callToolResultContentSchema
>;

const callToolResultContentTypes = callToolResultContentSchema.options.map(
  (option) => {
    if (
      isZodObject(option) &&
      "type" in option.shape &&
      isZodLiteral(option.shape.type)
    ) {
      return option.shape.type.value;
    }
    throw new Error(
      "Internal error: Invalid option found in CallToolResultContentSchema's union. Expected ZodObject with ZodLiteral 'type'."
    );
  }
) as UnionToTuple<
  (typeof callToolResultContentSchema.options)[number]["shape"]["type"]["value"]
>;

const callToolResultContentTypeZodLiterals = callToolResultContentTypes.map(
  (t) => z.literal(t)
) as UnionToTuple<
  (typeof callToolResultContentSchema.options)[number]["shape"]["type"]
>;

/**
 * Zod schema for the 'type' field of a CallToolResultContent item.
 * This will be a union of literals like "text", "image", "audio", and "resource".
 */
export const callToolResultContentTypeSchema = z.union(
  callToolResultContentTypeZodLiterals
);
export type CallToolResultContentType = z.output<
  typeof callToolResultContentTypeSchema
>;

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
  })
  .and(baseConfigSchema)
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
