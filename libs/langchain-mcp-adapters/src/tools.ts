import {
  callToolWithElicitation,
  type ElicitationRoundParams,
} from "./elicitation.js";
import { ToolException, isToolException } from "./utils/errors.js";
import {
  convertCallToolResult,
  type ExtendedArtifact,
  type ExtendedContent,
  type OutputHandling,
} from "./content.js";
import { z } from "zod";
import {
  CLIENT_CAPABILITIES_META_KEY,
  fromJsonSchema,
  isInputRequiredResult,
  LOG_LEVEL_META_KEY,
} from "@modelcontextprotocol/client";
import { JSONObjectSchema } from "@modelcontextprotocol/core";
import { DefaultJsonSchemaValidator } from "@modelcontextprotocol/client/_shims";
import {
  toolCallModificationSchema,
  toolCallResultModificationSchema,
} from "./hooks.js";
import type {
  LoggingLevel,
  CallToolRequest,
  CallToolRequestOptions,
  CallToolResult,
  InputRequiredResult,
  Client as MCPClient,
  Tool as MCPTool,
  RequestOptions,
} from "@modelcontextprotocol/client";
import { DynamicStructuredTool } from "@langchain/core/tools";
import { RunnableConfig } from "@langchain/core/runnables";
import type { CallbackManagerForToolRun } from "@langchain/core/callbacks/manager";
import type { ToolMessage } from "@langchain/core/messages";
import {
  isGraphInterrupt,
  getCurrentTaskInput,
  type Command,
} from "@langchain/langgraph";

import type { Notifications } from "./types.js";

import {
  loadMcpToolsOptionsSchema,
  type LoadMcpToolsOptions,
} from "./types.js";
import type { ToolHooks, ToolCallModification } from "./hooks.js";
import type { Client } from "./connection.js";

type MCPInstance = Client | MCPClient;
type ToolArguments = NonNullable<CallToolRequest["params"]["arguments"]>;

export { ToolException, isToolException } from "./utils/errors.js";

/**
 * @internal
 */
type CallToolArgs = {
  invocation: ToolInvocation;
  /**
   * The name of the server to call the tool on (used for error messages and logging)
   */
  serverName: string;
  /**
   * The name of the tool to call
   */
  toolName: string;
  /**
   * The arguments to pass to the tool - must conform to the tool's input schema
   */
  args: ToolArguments;
  /**
   * Optional RunnableConfig with timeout settings
   */
  config?: RunnableConfig;
  /**
   * Defines where to place each tool output type in the LangChain ToolMessage.
   */
  outputHandling?: OutputHandling;

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
  inputSchema: ToolInputSchema;
};

type ContentBlocksWithArtifacts = [
  ExtendedContent | ToolMessage | Command,
  ExtendedArtifact[],
];

type ToolInputSchema = z.ZodTransform<ToolArguments, ToolArguments>;

type ToolRound = (
  params: ElicitationRoundParams,
  options: CallToolRequestOptions
) => Promise<CallToolResult | InputRequiredResult>;

interface ToolInvocation {
  /** True when this tool answers requested input with graph interrupts. */
  readonly elicitation: boolean;
  /** Parses the terminal result when the rounds were not given the schema. */
  readonly output?: z.ZodType<unknown>;
  /** Resolve the client this execution's rounds are sent through. */
  bind(headers: ToolCallModification["headers"]): Promise<ToolRound>;
}

/** Graph task state for this invocation; `{}` for a direct tool call. */
function graphTaskState(config?: RunnableConfig): unknown {
  try {
    return getCurrentTaskInput(config);
  } catch {
    return {};
  }
}

function createToolInvocation(
  client: MCPInstance,
  serverName: string,
  descriptor: MCPTool,
  logLevel: LoggingLevel | undefined,
  elicitation: boolean
): ToolInvocation {
  const modern = client.getProtocolEra() === "modern";
  // Legacy servers answer elicitation through `onElicitation`, never in band.
  const inBand = modern && elicitation;

  // An `input_required` round carries no structured content, which the SDK's
  // output validator rejects before the caller can see the question. Withhold
  // the schema from the rounds and validate the terminal result here instead.
  const { outputSchema, ...withoutOutputSchema } = descriptor;
  const roundDefinition =
    inBand && outputSchema ? withoutOutputSchema : descriptor;

  // Advertised per request rather than as a declared capability: declared
  // capabilities are sent during initialization, before negotiation settles
  // the era, so an `auto` connection landing on legacy would advertise
  // elicitation to a server that must not see it. A user-supplied `_meta` key
  // takes precedence over the SDK's auto-attached envelope.
  const metadata = {
    ...(logLevel !== undefined && modern
      ? { [LOG_LEVEL_META_KEY]: logLevel }
      : {}),
    ...(inBand
      ? {
          [CLIENT_CAPABILITIES_META_KEY]: {
            elicitation: { form: {}, url: {} },
          },
        }
      : {}),
  };
  const _meta = Object.keys(metadata).length > 0 ? metadata : undefined;

  /**
   * Bind the wire call to a client.
   *
   * Only the client varies: a forked connection must serve the era tools were
   * discovered under, which `selectHeaderPolicy` enforces before calling here.
   */
  const executor =
    (connectedClient: MCPInstance): ToolRound =>
    (request, options) =>
      // `callTool` deliberately does not widen its return type for
      // `allowInputRequired`; `isInputRequiredResult` does the narrowing.
      connectedClient.callTool(
        { ...request, _meta },
        {
          ...options,
          toolDefinition: roundDefinition,
          ...(inBand ? { allowInputRequired: true } : {}),
        }
      ) as Promise<CallToolResult | InputRequiredResult>;

  const unbound = executor(client);

  /** Header-bound clients remain runtime resources, never checkpointed state. */
  function selectHeaderPolicy() {
    if ("fork" in client && typeof client.fork === "function") {
      const fork = client.fork.bind(client);

      return async (headers: NonNullable<ToolCallModification["headers"]>) => {
        const connectedClient = await fork(headers);
        const connectedModern = connectedClient.getProtocolEra() === "modern";
        if (connectedModern !== modern)
          throw new ToolException(
            `MCP connection for server "${serverName}" changed protocol era after tool discovery.`
          );

        return executor(connectedClient);
      };
    }

    return async (_headers: NonNullable<ToolCallModification["headers"]>) => {
      throw new ToolException(
        `MCP client for server "${serverName}" does not support header changes`
      );
    };
  }

  const headerPolicy = selectHeaderPolicy();

  return {
    elicitation: inBand,
    // Compiled once per tool, not per call.
    output:
      inBand && outputSchema
        ? z.object({
            structuredContent: jsonSchemaParser(
              JSONObjectSchema.parse(outputSchema)
            ),
          })
        : undefined,
    async bind(headers: ToolCallModification["headers"]) {
      if (headers && Object.keys(headers).length > 0)
        return headerPolicy(headers);

      return unbound;
    },
  };
}

/** Keep the SDK's JSON Schema semantics while exposing a Zod parsing boundary. */
function jsonSchemaParser<T>(
  jsonSchema: z.output<typeof JSONObjectSchema>
): z.ZodTransform<T, T> {
  // Scope the SDK engine to this descriptor: its shared cache keys by $id.
  const validator = fromJsonSchema<T>(
    jsonSchema,
    new DefaultJsonSchemaValidator()
  );

  return z.transform(async (input: T, ctx) => {
    const result = await validator["~standard"].validate(input);

    if (result.issues) {
      ctx.issues.push(
        ...result.issues.map(
          (issue) =>
            ({
              code: "custom",
              input,
              message: issue.message,
              path:
                issue.path?.map((segment) =>
                  typeof segment === "object" ? segment.key : segment
                ) ?? [],
            }) satisfies z.core.$ZodRawIssue
        )
      );

      return z.NEVER;
    }

    return result.value;
  });
}

/** Parse hook output and effective arguments before choosing a wire request. */
async function prepareToolCall(
  {
    serverName,
    toolName,
    args,
    config,
    onProgress,
    beforeToolCall,
    inputSchema,
  }: CallToolArgs,
  state: unknown
) {
  // Extract timeout from RunnableConfig and pass to MCP SDK
  // Note: ensureConfig() converts timeout into an AbortSignal and deletes the timeout field.
  // To preserve the numeric timeout for SDKs that accept an explicit timeout value, we read
  // it from metadata.timeoutMs if present, falling back to any direct timeout.
  const numericTimeout =
    z.number().nullish().parse(config?.metadata?.timeoutMs) ?? config?.timeout;

  const requestOptions: RequestOptions = {};

  if (numericTimeout) requestOptions.timeout = numericTimeout;

  if (config?.signal) requestOptions.signal = config.signal;

  if (onProgress) {
    requestOptions.onprogress = (progress) => {
      Promise.resolve()
        .then(() =>
          onProgress(progress, {
            type: "tool",
            name: toolName,
            args,
            server: serverName,
          })
        )
        .catch(() => {});
    };
  }

  const beforeToolCallInterception = toolCallModificationSchema
    .optional()
    .parse(
      await beforeToolCall?.(
        {
          name: toolName,
          args,
          serverName,
        },
        state,
        config ?? {}
      )
    );

  const parsed = await inputSchema.safeParseAsync({
    ...args,
    ...beforeToolCallInterception?.args,
  });

  if (!parsed.success) {
    throw new ToolException(
      `Invalid arguments for MCP tool "${toolName}": ${parsed.error.issues.map((issue) => issue.message).join("; ")}`,
      parsed.error
    );
  }

  const finalArgs = parsed.data;
  const initialRequest = {
    name: toolName,
    arguments: finalArgs,
  } satisfies CallToolRequest["params"];

  return {
    request: initialRequest,
    requestOptions,
    headers: beforeToolCallInterception?.headers,
    args: finalArgs,
    state,
  };
}

/** Execute a prepared call; only terminal SDK results reach content conversion. */
async function _callTool(
  call: CallToolArgs
): Promise<ContentBlocksWithArtifacts> {
  const {
    serverName,
    toolName,
    invocation,
    config,
    outputHandling,
    afterToolCall,
  } = call;

  try {
    const prepared = await prepareToolCall(call, graphTaskState(config));
    const execute = await invocation.bind(prepared.headers);
    const round = (params: ElicitationRoundParams) =>
      execute(params, prepared.requestOptions);

    const result = invocation.elicitation
      ? await callToolWithElicitation(
          round,
          prepared.request,
          serverName,
          toolName,
          config?.signal
        )
      : await round(prepared.request);

    // The SDK refuses `input_required` unless asked to allow it, but a client
    // passed to `loadMcpTools` need not be the SDK's, so narrow rather than cast.
    if (isInputRequiredResult(result))
      throw new ToolException(
        `MCP tool "${toolName}" on server "${serverName}" asked for input, which only a modern server with elicitation enabled can answer`
      );

    if (invocation.output && !result.isError) {
      const parsed = await invocation.output.safeParseAsync(result);
      if (!parsed.success)
        throw new ToolException(
          `MCP tool "${toolName}" on server "${serverName}" returned output its schema rejects: ${z.prettifyError(parsed.error)}`
        );
    }

    const { args: finalArgs, state } = prepared;

    const [content, artifacts] = convertCallToolResult({
      serverName,
      toolName,
      result,
      outputHandling,
    });

    const interceptedResult = toolCallResultModificationSchema.optional().parse(
      await afterToolCall?.(
        {
          name: toolName,
          args: finalArgs,
          result: [content, artifacts],
          serverName,
        },
        state,
        config ?? {}
      )
    );

    if (!interceptedResult) {
      return [content, artifacts];
    }

    if (Array.isArray(interceptedResult.result)) {
      return interceptedResult.result;
    }

    return [interceptedResult.result, []];
  } catch (error) {
    if (isGraphInterrupt(error) || config?.signal?.aborted) throw error;

    if (isToolException(error)) {
      throw error;
    }

    throw new ToolException(
      `Error calling tool ${toolName}: ${String(error)}`,
      error
    );
  }
}

const defaultLoadMcpToolsOptions: LoadMcpToolsOptions = {
  throwOnLoadError: true,
  prefixToolNameWithServerName: false,
  additionalToolNamePrefix: "",
};

/**
 * Load all tools from an MCP client.
 *
 * @param serverName - The name of the server to load tools from
 * @param client - The MCP client
 * @returns A list of LangChain tools
 */
export async function loadMcpTools(
  serverName: string,
  client: MCPInstance,
  options?: LoadMcpToolsOptions
): Promise<DynamicStructuredTool[]> {
  const parsedOptions = loadMcpToolsOptionsSchema.parse(options ?? {});
  const { tools } = await client.listTools();

  return convertMcpTools(serverName, client, tools, parsedOptions);
}

/** @internal Adapt SDK-validated descriptors without issuing another discovery request. */
export async function convertMcpTools(
  serverName: string,
  client: MCPInstance,
  mcpTools: MCPTool[],
  options?: LoadMcpToolsOptions
): Promise<DynamicStructuredTool[]> {
  const parsedOptions = loadMcpToolsOptionsSchema.parse(options ?? {});
  const {
    throwOnLoadError,
    prefixToolNameWithServerName,
    additionalToolNamePrefix,
    outputHandling,
    defaultToolTimeout,
    logLevel,
    elicitation,
  } = {
    ...defaultLoadMcpToolsOptions,
    ...parsedOptions,
  };

  const initialPrefix = additionalToolNamePrefix
    ? `${additionalToolNamePrefix}__`
    : "";
  const serverPrefix = prefixToolNameWithServerName ? `${serverName}__` : "";
  const toolNamePrefix = `${initialPrefix}${serverPrefix}`;

  // Filter out tools without names and convert in a single map operation
  return (
    await Promise.all(
      mcpTools
        .filter((tool: MCPTool) => !!tool.name)
        .map(async (tool: MCPTool) => {
          try {
            const originalSchema = JSONObjectSchema.parse(tool.inputSchema);

            const inputSchema = jsonSchemaParser<ToolArguments>(originalSchema);

            const invocation = createToolInvocation(
              client,
              serverName,
              tool,
              logLevel,
              elicitation
            );

            return new DynamicStructuredTool({
              name: `${toolNamePrefix}${tool.name}`,
              description: tool.description || "",
              schema: structuredClone(originalSchema),
              responseFormat: "content_and_artifact",
              metadata: { annotations: tool.annotations },
              defaultConfig: defaultToolTimeout
                ? { timeout: defaultToolTimeout }
                : undefined,
              func: async (
                args: ToolArguments,
                _runManager?: CallbackManagerForToolRun,
                config?: RunnableConfig
              ) => {
                return _callTool({
                  invocation,
                  serverName,
                  inputSchema,
                  toolName: tool.name,
                  args,
                  config,
                  outputHandling,
                  onProgress: parsedOptions.onProgress,
                  beforeToolCall: parsedOptions.beforeToolCall,
                  afterToolCall: parsedOptions.afterToolCall,
                });
              },
            });
          } catch (error) {
            if (throwOnLoadError) {
              throw error;
            }
            return null;
          }
        })
    )
  ).filter((tool) => tool !== null);
}
