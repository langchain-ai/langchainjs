import { ns, LangChainError } from "@langchain/core/errors";
import { z } from "zod";
import { fromJsonSchema } from "@modelcontextprotocol/client";
import { DefaultJsonSchemaValidator } from "@modelcontextprotocol/client/_shims";
import { isInteropZodError } from "@langchain/core/utils/types";
import {
  toolCallModificationSchema,
  toolCallResultModificationSchema,
} from "./hooks.js";
import type {
  LoggingLevel,
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
import { ToolMessage } from "@langchain/core/messages";
import {
  isCommand,
  isGraphInterrupt,
  getCurrentTaskInput,
  type Command,
} from "@langchain/langgraph";

import type { Notifications } from "./types.js";

import {
  _resolveDetailedOutputHandling,
  callToolResultContentTypes,
  type CallToolResultContentType,
  type LoadMcpToolsOptions,
  type OutputHandling,
} from "./types.js";
import type { ToolHooks } from "./hooks.js";
import type { Client } from "./connection.js";
import debug from "debug";

const debugLog = debug("@langchain/mcp-adapters:tools");

type MCPInstance = Client | MCPClient;

// Parse only the Zod issue fields needed for formatting, without depending
// on a particular Zod version or constructor.
const errorPathKeySchema = z.union([z.string(), z.number(), z.symbol()]);

const zodErrorDetailsSchema = z.object({
  issues: z.array(
    z.object({
      message: z.string(),
      path: z.array(errorPathKeySchema).optional(),
    })
  ),
});

function parseZodErrorDetails(error: unknown) {
  if (!isInteropZodError(error)) return undefined;
  const parsed = zodErrorDetailsSchema.safeParse(error);

  return parsed.success ? parsed.data : undefined;
}

/**
 * Custom error class for tool exceptions
 */
export class ToolException extends ns.sub("mcp").brand(LangChainError, "tool") {
  readonly name = "ToolException";
  readonly result?: CallToolResult;

  constructor(message: string, cause?: unknown, result?: CallToolResult) {
    super(message);
    this.result = result;

    if (cause !== undefined) this.cause = cause;
  }
}

export function isToolException(error: unknown): error is ToolException {
  return ToolException.isInstance(error);
}

/** Terminal conversion never dereferences resource URIs or performs network IO. */
function _toolOutputToContentBlocks(
  content: MCPContentBlock,
  toolName: string,
  serverName: string
): ContentBlock[] {
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
  if (!result) {
    throw new ToolException(
      `MCP tool '${toolName}' on server '${serverName}' returned an invalid result - tool call response was undefined`
    );
  }

  if (!Array.isArray(result.content)) {
    throw new ToolException(
      `MCP tool '${toolName}' on server '${serverName}' returned an invalid result - expected an array of content, but was ${typeof result.content}`
    );
  }

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
    "text" in firstBlock &&
    typeof firstBlock.text === "string" &&
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
  logLevel?: LoggingLevel;
  /**
   * The name of the server to call the tool on (used for error messages and logging)
   */
  serverName: string;
  /**
   * The name of the tool to call
   */
  toolName: string;
  /**
   * The MCP client to call the tool on
   */
  client: Client | MCPClient;
  /**
   * The arguments to pass to the tool - must conform to the tool's input schema
   */
  args: Record<string, unknown>;
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
  inputValidator: ReturnType<typeof fromJsonSchema>;
};

type ContentBlocksWithArtifacts = [
  ExtendedContent | ToolMessage | Command,
  ExtendedArtifact[],
];

/**
 * Call an MCP tool.
 *
 * Use this with `.bind` to capture the fist three arguments, then pass to the constructor of DynamicStructuredTool.
 *
 * @internal
 * @param args - The arguments to pass to the tool
 * @returns A tuple of [textContent, nonTextContent]
 */
async function _callTool({
  logLevel,
  serverName,
  toolName,
  client,
  args,
  config,
  outputHandling,
  onProgress,
  beforeToolCall,
  afterToolCall,
  inputValidator,
}: CallToolArgs): Promise<ContentBlocksWithArtifacts> {
  try {
    debugLog(`INFO: Calling tool ${toolName}(${JSON.stringify(args)})`);

    // Extract timeout from RunnableConfig and pass to MCP SDK
    // Note: ensureConfig() converts timeout into an AbortSignal and deletes the timeout field.
    // To preserve the numeric timeout for SDKs that accept an explicit timeout value, we read
    // it from metadata.timeoutMs if present, falling back to any direct timeout.
    const numericTimeout =
      z.number().nullish().parse(config?.metadata?.timeoutMs) ??
      config?.timeout;

    const requestOptions: RequestOptions = {
      ...(numericTimeout ? { timeout: numericTimeout } : {}),
      ...(config?.signal ? { signal: config.signal } : {}),
      ...(onProgress
        ? {
            onprogress: (progress) => {
              // oxlint-disable-next-line @typescript-eslint/no-floating-promises
              onProgress?.(progress, {
                type: "tool",
                name: toolName,
                args,
                server: serverName,
              });
            },
          }
        : {}),
    };

    let state: unknown = {};

    try {
      state = getCurrentTaskInput(config);
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

    const finalArgs = { ...args, ...beforeToolCallInterception?.args };

    const validation = await inputValidator["~standard"].validate(finalArgs);

    if (validation.issues) {
      throw new ToolException(
        `Invalid arguments for MCP tool "${toolName}": ${validation.issues.map((issue) => issue.message).join("; ")}`,
        new z.ZodError(
          validation.issues.map((issue) => ({
            code: "custom",
            message: issue.message,
            path:
              issue.path?.map((segment) =>
                typeof segment === "object" ? segment.key : segment
              ) ?? [],
          }))
        )
      );
    }

    const headers = beforeToolCallInterception?.headers || {};
    const hasHeaderChanges = Object.entries(headers).length > 0;

    if (
      hasHeaderChanges &&
      !("fork" in client && typeof client.fork === "function")
    ) {
      throw new ToolException(
        `MCP client for server "${serverName}" does not support header changes`
      );
    }

    const finalClient =
      hasHeaderChanges && "fork" in client && typeof client.fork === "function"
        ? await client.fork(headers)
        : client;

    // v2 callTool(params, options?) — no result-schema argument in between.
    const callToolArgs: Parameters<typeof finalClient.callTool> = [
      {
        name: toolName,
        arguments: finalArgs,
        _meta:
          logLevel !== undefined && finalClient.getProtocolEra() === "modern"
            ? { "io.modelcontextprotocol/logLevel": logLevel }
            : undefined,
      },
    ];

    if (Object.keys(requestOptions).length > 0) {
      callToolArgs.push(requestOptions);
    }

    const result = await finalClient.callTool(...callToolArgs);

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

    if (typeof interceptedResult.result === "string") {
      return [interceptedResult.result, []];
    }

    if (Array.isArray(interceptedResult.result)) {
      return interceptedResult.result;
    }

    if (ToolMessage.isInstance(interceptedResult.result)) {
      return [interceptedResult.result, []];
    }

    if (isCommand(interceptedResult.result)) {
      return [interceptedResult.result, []];
    }

    throw new Error(
      `Unexpected result value type from afterToolCall: expected either a Command, a ToolMessage or a tuple of ContentBlock and Artifact, but got ${interceptedResult.result}`
    );
  } catch (error) {
    if (isGraphInterrupt(error) || config?.signal?.aborted) throw error;
    const details = parseZodErrorDetails(error);

    if (details) {
      throw new ToolException(z.prettifyError(details), error);
    }

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
  const { tools } = await client.listTools();

  return convertMcpTools(serverName, client, tools, options);
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
    ...(options ?? {}),
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
            const originalSchema = z
              .record(z.string(), z.json())
              .parse(tool.inputSchema);

            // Scope the SDK engine to this descriptor: its default shared cache keys by $id.
            // The SDK export selects the same engine as Client for Node/browser/workerd.
            const inputValidator = fromJsonSchema(
              originalSchema,
              new DefaultJsonSchemaValidator()
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
                args: Record<string, unknown>,
                _runManager?: CallbackManagerForToolRun,
                config?: RunnableConfig
              ) => {
                return _callTool({
                  logLevel: options?.logLevel,
                  serverName,
                  inputValidator,
                  toolName: tool.name,
                  client,
                  args,
                  config,
                  outputHandling,
                  onProgress: options?.onProgress,
                  beforeToolCall: options?.beforeToolCall,
                  afterToolCall: options?.afterToolCall,
                });
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
