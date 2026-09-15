import {
  supportsMCPInterrupts,
  PendingMCPInput,
  type MCPContinuation,
} from "./continuation.js";
import { ToolException, isToolException } from "./utils/errors.js";
import { z } from "zod";
import {
  fromJsonSchema,
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
  CallToolResult,
  ContentBlock as MCPContentBlock,
  Client as MCPClient,
  Tool as MCPTool,
  RequestOptions,
} from "@modelcontextprotocol/client";
import { DynamicStructuredTool } from "@langchain/core/tools";
import type { ContentBlock } from "@langchain/core/messages";
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
  _resolveDetailedOutputHandling,
  callToolResultContentTypes,
  loadMcpToolsOptionsSchema,
  type CallToolResultContentType,
  type LoadMcpToolsOptions,
  type OutputHandling,
} from "./types.js";
import type { ToolHooks, ToolCallModification } from "./hooks.js";
import type { Client } from "./connection.js";
import debug from "debug";

const debugLog = debug("@langchain/mcp-adapters:tools");

type MCPInstance = Client | MCPClient;
type ToolArguments = NonNullable<CallToolRequest["params"]["arguments"]>;

export { ToolException, isToolException } from "./utils/errors.js";

/** Terminal conversion never dereferences resource URIs or performs network IO. */
function _toolOutputToContentBlocks(
  content: MCPContentBlock,
  toolName: string,
  serverName: string
): ContentBlock.Standard[] {
  const contentType = content.type;

  switch (content.type) {
    case "text":
      return [{ type: "text", text: content.text }];
    case "image":
      return [
        {
          type: "image",
          data: content.data,
          mimeType: content.mimeType,
        } satisfies ContentBlock.Multimodal.Image,
      ];
    case "audio":
      return [
        {
          type: "audio",
          data: content.data,
          mimeType: content.mimeType,
        } satisfies ContentBlock.Multimodal.Audio,
      ];
    case "resource": {
      const resource = content.resource;
      const metadata = { uri: resource.uri };

      if ("text" in resource) {
        return [{ type: "text", text: resource.text, metadata }];
      }

      const mimeType = resource.mimeType ?? "application/octet-stream";

      return [
        {
          type: mimeType.startsWith("image/")
            ? "image"
            : mimeType.startsWith("audio/")
              ? "audio"
              : "file",
          data: resource.blob,
          mimeType,
          metadata,
        } satisfies ContentBlock.Multimodal.Standard,
      ];
    }

    case "resource_link": {
      const metadata =
        content.title === undefined
          ? { uri: content.uri, name: content.name }
          : { uri: content.uri, name: content.name, title: content.title };

      return [
        {
          type: "file",
          url: content.uri,
          mimeType: content.mimeType,
          metadata,
        } satisfies ContentBlock.Multimodal.File,
      ];
    }
    default:
      throw new ToolException(
        `MCP tool '${toolName}' on server '${serverName}' returned unexpected content type "${contentType}". Expected ${callToolResultContentTypes.join(", ")}.`
      );
  }
}

/**
 * Special artifact type for structured content from MCP tool results
 * @internal
 */
type MCPStructuredContentArtifact = {
  type: "mcp_structured_content";
  data: Exclude<CallToolResult["structuredContent"], undefined>;
};

/**
 * Special artifact type for meta information from MCP tool results
 * @internal
 */
type MCPMetaArtifact = {
  type: "mcp_meta";
  data: NonNullable<CallToolResult["_meta"]>;
};

/**
 * Extended artifact type that includes MCP-specific artifacts
 * @internal
 */
type ExtendedArtifact =
  | MCPContentBlock
  | ContentBlock
  | { type: "mcp_content"; data: MCPContentBlock }
  | MCPStructuredContentArtifact
  | MCPMetaArtifact;

/**
 * Model-visible content; protocol metadata belongs in artifacts.
 * @internal
 */
type ExtendedContent = ContentBlock[] | string;

/**
 * @internal
 */
type ConvertCallToolResultArgs = {
  /**
   * The name of the server to call the tool on (used for error messages and logging)
   */
  serverName: string;
  /**
   * The name of the tool that was called
   */
  toolName: string;
  /**
   * The result from the MCP tool call
   */
  result: CallToolResult;
  /**
   * Defines where to place each tool output type in the LangChain ToolMessage.
   */
  outputHandling?: OutputHandling;
};

function _getOutputTypeForContentType(
  contentType: CallToolResultContentType,
  outputHandling?: OutputHandling
): "content" | "artifact" {
  if (outputHandling === "content" || outputHandling === "artifact") {
    return outputHandling;
  }

  const resolved = _resolveDetailedOutputHandling(outputHandling);

  return (
    resolved[contentType] ??
    (contentType === "resource" ? "artifact" : "content")
  );
}

/**
 * Process the result from calling an MCP tool.
 * Extracts text content and non-text content for better agent compatibility.
 *
 * @internal
 *
 * @param args - The arguments to pass to the tool
 * @returns A tuple of [textContent, nonTextContent]
 */
function _convertCallToolResult({
  serverName,
  toolName,
  result,
  outputHandling,
}: ConvertCallToolResultArgs): [ExtendedContent, ExtendedArtifact[]] {
  if (result.isError) {
    throw new ToolException(
      `MCP tool '${toolName}' on server '${serverName}' returned an error: ${result.content
        .map((content: MCPContentBlock) =>
          content.type === "text" ? content.text : ""
        )
        .join("\n")}`,
      undefined,
      result
    );
  }

  const convertedContent = result.content
    .filter(
      (block) =>
        _getOutputTypeForContentType(block.type, outputHandling) === "content"
    )
    .flatMap((block) =>
      _toolOutputToContentBlocks(block, toolName, serverName)
    );

  const artifacts = result.content.filter(
    (block) =>
      _getOutputTypeForContentType(block.type, outputHandling) === "artifact"
  );

  // Extract structuredContent and _meta from result
  // These are optional fields that are part of the CallToolResult type
  const structuredContent = result.structuredContent;
  const meta = result._meta;

  // Add structuredContent and meta as special artifacts
  const enhancedArtifacts: ExtendedArtifact[] = [...artifacts];

  for (const block of result.content) {
    const retainedKeys =
      block.type === "text" ? ["type", "text"] : ["type", "data", "mimeType"];

    if (
      !artifacts.includes(block) &&
      (block.type === "resource" ||
        block.type === "resource_link" ||
        Object.keys(block).some((key) => !retainedKeys.includes(key)))
    ) {
      enhancedArtifacts.push({ type: "mcp_content", data: block });
    }
  }

  if (structuredContent !== undefined) {
    enhancedArtifacts.push({
      type: "mcp_structured_content",
      data: structuredContent,
    });
  }
  if (meta) {
    enhancedArtifacts.push({
      type: "mcp_meta",
      data: meta,
    });
  }

  // Preserve the plain-text convenience without dropping resource provenance.
  const firstBlock = convertedContent[0];

  if (
    convertedContent.length === 1 &&
    firstBlock.type === "text" &&
    !("metadata" in firstBlock)
  ) {
    return [firstBlock.text, enhancedArtifacts];
  }

  return [convertedContent, enhancedArtifacts];
}

/**
 * @internal
 */
type CallToolArgs = {
  invocation: ReturnType<ReturnType<typeof createToolInvocationFactory>>;
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
  inputSchema: ReturnType<typeof createToolInputSchema>;
  continuation?: MCPContinuation;
  hookState?: unknown;
};

type ContentBlocksWithArtifacts = [
  ExtendedContent | ToolMessage | Command,
  ExtendedArtifact[],
];

type InvokeToolRound = (
  continuation?: MCPContinuation,
  hookState?: unknown
) => Promise<ContentBlocksWithArtifacts>;

function createToolInvocationFactory(
  client: MCPInstance,
  serverName: string,
  toolName: string,
  logLevel?: LoggingLevel
) {
  const modern = client.getProtocolEra() === "modern";

  function executor(connectedClient: MCPInstance, modernProtocol: boolean) {
    const metadata =
      logLevel !== undefined && modernProtocol
        ? { [LOG_LEVEL_META_KEY]: logLevel }
        : undefined;

    return (request: CallToolRequest["params"], options: RequestOptions) => {
      const params = { ...request, _meta: metadata };

      return Object.keys(options).length > 0
        ? connectedClient.callTool(params, options)
        : connectedClient.callTool(params);
    };
  }

  const direct = executor(client, modern);

  const runInterrupts =
    modern && supportsMCPInterrupts(client)
      ? client.withInterrupts.bind(client)
      : undefined;

  function selectHeaderPolicy() {
    if ("fork" in client && typeof client.fork === "function") {
      const fork = client.fork.bind(client);

      return async (headers: NonNullable<ToolCallModification["headers"]>) => {
        const connectedClient = await fork(headers);

        return executor(
          connectedClient,
          connectedClient.getProtocolEra() === "modern"
        );
      };
    }

    return async (_headers: NonNullable<ToolCallModification["headers"]>) => {
      throw new ToolException(
        `MCP client for server "${serverName}" does not support header changes`
      );
    };
  }

  return () => {
    let executeRound = direct;

    const execute = async (
      request: CallToolRequest["params"],
      options: RequestOptions,
      headers: ToolCallModification["headers"]
    ) => {
      if (headers && Object.keys(headers).length > 0) {
        executeRound = await selectHeaderPolicy()(headers);
      }

      return executeRound(request, options);
    };

    if (runInterrupts) {
      return {
        execute,
        async run(call: InvokeToolRound, config?: RunnableConfig) {
          return runInterrupts((continuation) => call(continuation), {
            server: serverName,
            tool: toolName,
            signal: config?.signal,
          });
        },
      };
    }

    return { execute, run: (call: InvokeToolRound) => call() };
  };
}

/** Keep the SDK's JSON Schema semantics while exposing a Zod parsing boundary. */
function createToolInputSchema(jsonSchema: z.output<typeof JSONObjectSchema>) {
  // Scope the SDK engine to this descriptor: its shared cache keys by $id.
  const validator = fromJsonSchema<ToolArguments>(
    jsonSchema,
    new DefaultJsonSchemaValidator()
  );

  return z.transform(async (input: ToolArguments, ctx) => {
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
async function prepareToolCall({
  serverName,
  toolName,
  args,
  config,
  onProgress,
  beforeToolCall,
  inputSchema,
  continuation,
  hookState,
}: CallToolArgs) {
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
        .catch((error) => {
          debugLog(
            `Progress callback failed for tool "${toolName}" on server "${serverName}":`,
            error
          );
        });
    };
  }

  let state: unknown = {};

  try {
    state = hookState === undefined ? getCurrentTaskInput(config) : hookState;
  } catch (error) {
    debugLog(`LangGraph task input is unavailable: ${String(error)}`);
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

  const request = continuation
    ? {
        ...initialRequest,
        inputResponses: continuation.inputResponses,
        requestState: continuation.requestState,
      }
    : initialRequest;

  return {
    request,
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
    debugLog(`INFO: Calling tool ${toolName}(${JSON.stringify(call.args)})`);
    const prepared = await prepareToolCall(call);

    const result = await invocation.execute(
      prepared.request,
      prepared.requestOptions,
      prepared.headers
    );

    const { args: finalArgs, state } = prepared;

    const [content, artifacts] = _convertCallToolResult({
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
    if (
      isGraphInterrupt(error) ||
      PendingMCPInput.isInstance(error) ||
      config?.signal?.aborted
    )
      throw error;

    debugLog(`Error calling tool ${toolName}: ${String(error)}`);
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
  const {
    throwOnLoadError,
    prefixToolNameWithServerName,
    additionalToolNamePrefix,
    outputHandling,
    defaultToolTimeout,
  } = {
    ...defaultLoadMcpToolsOptions,
    ...options,
  };

  debugLog(`INFO: Found ${mcpTools.length} MCP tools`);

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

            const inputSchema = createToolInputSchema(originalSchema);

            const createInvocation = createToolInvocationFactory(
              client,
              serverName,
              tool.name,
              options?.logLevel
            );

            const dst = new DynamicStructuredTool({
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
                const invocation = createInvocation();

                const call = (
                  continuation?: MCPContinuation,
                  hookState?: unknown
                ) =>
                  _callTool({
                    invocation,
                    serverName,
                    inputSchema,
                    toolName: tool.name,
                    args: continuation?.request.arguments ?? args,
                    continuation,
                    hookState,
                    config,
                    outputHandling,
                    onProgress: options?.onProgress,
                    beforeToolCall: continuation
                      ? undefined
                      : options?.beforeToolCall,
                    afterToolCall: options?.afterToolCall,
                  });

                return invocation.run(call, config);
              },
            });
            debugLog(`INFO: Successfully loaded tool: ${dst.name}`);
            return dst;
          } catch (error) {
            debugLog(`ERROR: Failed to load tool "${tool.name}":`, error);
            if (throwOnLoadError) {
              throw error;
            }
            return null;
          }
        })
    )
  ).filter((tool) => tool !== null);
}
