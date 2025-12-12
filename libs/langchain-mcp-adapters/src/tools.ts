import { z, ZodError as ZodErrorV4 } from "zod/v4";
import { ZodError as ZodErrorV3 } from "zod/v3";
import {
  type CallToolResult,
  type ContentBlock as MCPContentBlock,
} from "@modelcontextprotocol/sdk/types.js";
import type { Client as MCPClient } from "@modelcontextprotocol/sdk/client/index.js";
import type {
  EmbeddedResource,
  ReadResourceResult,
  Tool as MCPTool,
  ListToolsResult,
} from "@modelcontextprotocol/sdk/types.js";
import type { RequestOptions } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { DynamicStructuredTool } from "@langchain/core/tools";
import type { ContentBlock } from "@langchain/core/messages";
import { RunnableConfig } from "@langchain/core/runnables";
import type { CallbackManagerForToolRun } from "@langchain/core/callbacks/manager";
import { ToolMessage } from "@langchain/core/messages";
import { Command, getCurrentTaskInput } from "@langchain/langgraph";

import type { Notifications } from "./types.js";

import {
  _resolveDetailedOutputHandling,
  type CallToolResultContentType,
  type LoadMcpToolsOptions,
  type OutputHandling,
} from "./types.js";
import type { ToolHooks, State } from "./hooks.js";
import type { Client } from "./connection.js";
import { getDebugLog } from "./logging.js";

const debugLog = getDebugLog("tools");

/**
 * JSON Schema type definitions for dereferencing $defs.
 */
type JsonSchemaObject = {
  type?: string;
  properties?: Record<string, JsonSchemaObject>;
  items?: JsonSchemaObject | JsonSchemaObject[];
  additionalProperties?: boolean | JsonSchemaObject;
  $ref?: string;
  $defs?: Record<string, JsonSchemaObject>;
  definitions?: Record<string, JsonSchemaObject>;
  allOf?: JsonSchemaObject[];
  anyOf?: JsonSchemaObject[];
  oneOf?: JsonSchemaObject[];
  not?: JsonSchemaObject;
  if?: JsonSchemaObject;
  then?: JsonSchemaObject;
  else?: JsonSchemaObject;
  required?: string[];
  description?: string;
  default?: unknown;
  enum?: unknown[];
  const?: unknown;
  [key: string]: unknown;
};

/**
 * Dereferences $ref pointers in a JSON Schema by inlining the definitions from $defs.
 * This is necessary because some JSON Schema validators (like @cfworker/json-schema)
 * don't automatically resolve $ref references to $defs.
 *
 * @param schema - The JSON Schema to dereference
 * @returns A new schema with all $ref pointers resolved
 */
function dereferenceJsonSchema(schema: JsonSchemaObject): JsonSchemaObject {
  const definitions = schema.$defs ?? schema.definitions ?? {};

  /**
   * Recursively resolve $ref pointers in the schema.
   * Tracks visited refs to prevent infinite recursion with circular references.
   */
  function resolveRefs(
    obj: JsonSchemaObject,
    visitedRefs: Set<string> = new Set()
  ): JsonSchemaObject {
    if (typeof obj !== "object" || obj === null) {
      return obj;
    }

    // Handle $ref
    if (obj.$ref && typeof obj.$ref === "string") {
      const refPath = obj.$ref;

      // Only handle local references to $defs or definitions
      const defsMatch = refPath.match(/^#\/\$defs\/(.+)$/);
      const definitionsMatch = refPath.match(/^#\/definitions\/(.+)$/);
      const match = defsMatch || definitionsMatch;

      if (match) {
        const defName = match[1];
        const definition = definitions[defName];

        if (definition) {
          // Check for circular reference
          if (visitedRefs.has(refPath)) {
            // Return a placeholder for circular refs to avoid infinite loop
            debugLog(
              `WARNING: Circular reference detected for ${refPath}, using empty object`
            );
            return { type: "object" };
          }

          // Track this ref as visited
          const newVisitedRefs = new Set(visitedRefs);
          newVisitedRefs.add(refPath);

          // Merge the resolved definition with any other properties from the original object
          // (excluding $ref itself)
          const { $ref: _, ...restOfObj } = obj;
          const resolvedDef = resolveRefs(definition, newVisitedRefs);
          return { ...resolvedDef, ...restOfObj };
        } else {
          debugLog(`WARNING: Could not resolve $ref: ${refPath}`);
        }
      }
      // For non-local refs, return as-is
      return obj;
    }

    // Recursively process all properties
    const result: JsonSchemaObject = {};

    for (const [key, value] of Object.entries(obj)) {
      // Skip $defs and definitions as they're no longer needed after dereferencing
      if (key === "$defs" || key === "definitions") {
        continue;
      }

      if (Array.isArray(value)) {
        result[key] = value.map((item) =>
          typeof item === "object" && item !== null
            ? resolveRefs(item as JsonSchemaObject, visitedRefs)
            : item
        );
      } else if (typeof value === "object" && value !== null) {
        result[key] = resolveRefs(value as JsonSchemaObject, visitedRefs);
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  return resolveRefs(schema);
}

/**
 * MCP instance is either a Client or a MCPClient.
 *
 * `MCPClient`: is the base instance from the `@modelcontextprotocol/sdk` package.
 * `Client`: is an extension of the `MCPClient` that adds the `fork` method to easier create a new client with different headers.
 *
 * This distinction is necessary to keep the interface of the `getTools` method simple.
 */
type MCPInstance = Client | MCPClient;

/**
 * Custom error class for tool exceptions
 */
export class ToolException extends Error {
  constructor(message: string, cause?: Error) {
    super(message);
    this.name = "ToolException";

    /**
     * don't display the large ZodError stack trace
     */
    if (
      cause &&
      // eslint-disable-next-line no-instanceof/no-instanceof
      (cause instanceof ZodErrorV4 || cause instanceof ZodErrorV3)
    ) {
      const minifiedZodError = new Error(z.prettifyError(cause));
      const stackByLine = cause.stack?.split("\n") || [];
      minifiedZodError.stack = cause.stack
        ?.split("\n")
        .slice(stackByLine.findIndex((l) => l.includes("    at")))
        .join("\n");
      this.cause = minifiedZodError;
    } else if (cause) {
      this.cause = cause;
    }
  }
}

export function isToolException(error: unknown): error is ToolException {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "ToolException"
  );
}

function isResourceReference(
  resource:
    | EmbeddedResource["resource"]
    | ReadResourceResult["contents"][number]
) {
  return (
    typeof resource === "object" &&
    resource !== null &&
    resource.uri != null &&
    resource.blob == null &&
    resource.text == null
  );
}

async function* _embeddedResourceToStandardFileBlocks(
  resource:
    | EmbeddedResource["resource"]
    | ReadResourceResult["contents"][number],
  client: MCPInstance
): AsyncGenerator<
  | (ContentBlock.Data.StandardFileBlock & ContentBlock.Data.Base64ContentBlock)
  | (ContentBlock.Data.StandardFileBlock &
      ContentBlock.Data.PlainTextContentBlock)
> {
  if (isResourceReference(resource)) {
    const response: ReadResourceResult = await client.readResource({
      uri: resource.uri,
    });
    for (const content of response.contents) {
      yield* _embeddedResourceToStandardFileBlocks(content, client);
    }
    return;
  }

  if (resource.blob != null) {
    yield {
      type: "file",
      source_type: "base64",
      data: resource.blob,
      mime_type: resource.mimeType,
      ...(resource.uri != null ? { metadata: { uri: resource.uri } } : {}),
    } as ContentBlock.Data.StandardFileBlock &
      ContentBlock.Data.Base64ContentBlock;
  }
  if (resource.text != null) {
    yield {
      type: "file",
      source_type: "text",
      mime_type: resource.mimeType,
      text: resource.text,
      ...(resource.uri != null ? { metadata: { uri: resource.uri } } : {}),
    } as ContentBlock.Data.StandardFileBlock &
      ContentBlock.Data.PlainTextContentBlock;
  }
}

async function _toolOutputToContentBlocks(
  content: MCPContentBlock,
  useStandardContentBlocks: true,
  client: MCPInstance,
  toolName: string,
  serverName: string
): Promise<ContentBlock.Multimodal.Standard[]>;
async function _toolOutputToContentBlocks(
  content: MCPContentBlock,
  useStandardContentBlocks: false | undefined,
  client: MCPInstance,
  toolName: string,
  serverName: string
): Promise<ContentBlock[]>;
async function _toolOutputToContentBlocks(
  content: MCPContentBlock,
  useStandardContentBlocks: boolean | undefined,
  client: MCPInstance,
  toolName: string,
  serverName: string
): Promise<(ContentBlock | ContentBlock.Multimodal.Standard)[]>;
async function _toolOutputToContentBlocks(
  content: MCPContentBlock,
  useStandardContentBlocks: boolean | undefined,
  client: MCPInstance,
  toolName: string,
  serverName: string
): Promise<(ContentBlock | ContentBlock.Multimodal.Standard)[]> {
  const blocks: ContentBlock.Data.StandardFileBlock[] = [];
  switch (content.type) {
    case "text":
      return [
        {
          type: "text",
          ...(useStandardContentBlocks
            ? {
                source_type: "text",
              }
            : {}),
          text: content.text,
        } as ContentBlock.Text,
      ];
    case "image":
      if (useStandardContentBlocks) {
        return [
          {
            type: "image",
            source_type: "base64",
            data: content.data,
            mime_type: content.mimeType,
          } as ContentBlock.Data.StandardImageBlock,
        ];
      }
      return [
        {
          type: "image_url",
          image_url: {
            url: `data:${content.mimeType};base64,${content.data}`,
          },
        } as ContentBlock,
      ];
    case "audio":
      // We don't check `useStandardContentBlocks` here because we only support audio via
      // standard content blocks
      return [
        {
          type: "audio",
          source_type: "base64",
          data: content.data,
          mime_type: content.mimeType,
        } as ContentBlock.Data.StandardAudioBlock,
      ];
    case "resource":
      for await (const block of _embeddedResourceToStandardFileBlocks(
        content.resource,
        client
      )) {
        blocks.push(block);
      }
      return blocks;
    default:
      throw new ToolException(
        `MCP tool '${toolName}' on server '${serverName}' returned a content block with unexpected type "${
          (content as { type: string }).type
        }." Expected one of "text", "image", or "audio".`
      );
  }
}

async function _embeddedResourceToArtifact(
  resource: EmbeddedResource,
  useStandardContentBlocks: boolean | undefined,
  client: MCPInstance,
  toolName: string,
  serverName: string
): Promise<(EmbeddedResource | ContentBlock.Multimodal.Standard)[]> {
  if (useStandardContentBlocks) {
    return _toolOutputToContentBlocks(
      resource,
      useStandardContentBlocks,
      client,
      toolName,
      serverName
    );
  }

  if (!resource.blob && !resource.text && resource.uri) {
    const response: ReadResourceResult = await client.readResource({
      uri: resource.resource.uri,
    });

    return response.contents.map(
      (content: ReadResourceResult["contents"][number]) => ({
        type: "resource",
        resource: {
          ...content,
        },
      })
    );
  }
  return [resource];
}

/**
 * Special artifact type for structured content from MCP tool results
 * @internal
 */
type MCPStructuredContentArtifact = {
  type: "mcp_structured_content";
  data: NonNullable<CallToolResult["structuredContent"]>;
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
  | EmbeddedResource
  | ContentBlock.Multimodal.Standard
  | MCPStructuredContentArtifact
  | MCPMetaArtifact;

/**
 * Content type that may include structuredContent and meta
 * @internal
 */
type ExtendedContent =
  | (ContentBlock | ContentBlock.Multimodal.Standard)[]
  | (ContentBlock.Text & {
      structuredContent?: NonNullable<CallToolResult["structuredContent"]>;
      meta?: NonNullable<CallToolResult["_meta"]>;
    })
  | string;

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
   * The MCP client that was used to call the tool
   */
  client: Client | MCPClient;
  /**
   * If true, the tool will use LangChain's standard multimodal content blocks for tools that output
   * image or audio content. This option has no effect on handling of embedded resource tool output.
   */
  useStandardContentBlocks?: boolean;
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
async function _convertCallToolResult({
  serverName,
  toolName,
  result,
  client,
  useStandardContentBlocks,
  outputHandling,
}: ConvertCallToolResultArgs): Promise<[ExtendedContent, ExtendedArtifact[]]> {
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
        .map((content: MCPContentBlock) => content.text)
        .join("\n")}`
    );
  }

  const convertedContent: (ContentBlock | ContentBlock.Multimodal.Standard)[] =
    (
      await Promise.all(
        result.content
          .filter(
            (content: MCPContentBlock) =>
              _getOutputTypeForContentType(content.type, outputHandling) ===
              "content"
          )
          .map((content: MCPContentBlock) =>
            _toolOutputToContentBlocks(
              content,
              useStandardContentBlocks,
              client,
              toolName,
              serverName
            )
          )
      )
    ).flat();

  // Create the text content output
  const artifacts = (
    await Promise.all(
      (
        result.content.filter(
          (content: MCPContentBlock) =>
            _getOutputTypeForContentType(content.type, outputHandling) ===
            "artifact"
        ) as EmbeddedResource[]
      ).map((content: EmbeddedResource) => {
        return _embeddedResourceToArtifact(
          content,
          useStandardContentBlocks,
          client,
          toolName,
          serverName
        );
      })
    )
  ).flat();

  // Extract structuredContent and _meta from result
  // These are optional fields that are part of the CallToolResult type
  const structuredContent = result.structuredContent;
  const meta = result._meta;

  // Add structuredContent and meta as special artifacts
  const enhancedArtifacts: ExtendedArtifact[] = [...artifacts];
  if (structuredContent) {
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

  // If we have structuredContent or meta, create an enhanced content that includes all info
  if (convertedContent.length === 1 && convertedContent[0].type === "text") {
    const textBlock = convertedContent[0] as ContentBlock.Text;
    const textContent = textBlock.text;

    // If we have structuredContent or meta, wrap the content with additional info
    if (structuredContent || meta) {
      return [
        {
          ...textBlock,
          ...(structuredContent ? { structuredContent } : {}),
          ...(meta ? { meta } : {}),
        } as ExtendedContent,
        enhancedArtifacts,
      ];
    }

    return [textContent as ExtendedContent, enhancedArtifacts];
  }

  return [convertedContent as ExtendedContent, enhancedArtifacts];
}

/**
 * @internal
 */
type CallToolArgs = {
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
   * If true, the tool will use LangChain's standard multimodal content blocks for tools that output
   * image or audio content. This option has no effect on handling of embedded resource tool output.
   */
  useStandardContentBlocks?: boolean;
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
};

type ContentBlocksWithArtifacts =
  | [ExtendedContent, ExtendedArtifact[]]
  | Command;

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
  serverName,
  toolName,
  client,
  args,
  config,
  useStandardContentBlocks,
  outputHandling,
  onProgress,
  beforeToolCall,
  afterToolCall,
}: CallToolArgs): Promise<ContentBlocksWithArtifacts> {
  try {
    debugLog(`INFO: Calling tool ${toolName}(${JSON.stringify(args)})`);

    // Extract timeout from RunnableConfig and pass to MCP SDK
    // Note: ensureConfig() converts timeout into an AbortSignal and deletes the timeout field.
    // To preserve the numeric timeout for SDKs that accept an explicit timeout value, we read
    // it from metadata.timeoutMs if present, falling back to any direct timeout.
    const numericTimeout =
      (config?.metadata?.timeoutMs as number | undefined) ?? config?.timeout;
    const requestOptions: RequestOptions = {
      ...(numericTimeout ? { timeout: numericTimeout } : {}),
      ...(config?.signal ? { signal: config.signal } : {}),
      ...(onProgress
        ? {
            onprogress: (progress) => {
              // eslint-disable-next-line @typescript-eslint/no-floating-promises
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

    let state: State = {};
    try {
      state = getCurrentTaskInput(config) as State;
    } catch (error) {
      debugLog(
        `State can't be derrived as LangGraph is not used: ${String(error)}`
      );
    }

    const beforeToolCallInterception = await beforeToolCall?.(
      {
        name: toolName,
        args,
        serverName,
      },
      state,
      config ?? {}
    );

    const finalArgs = Object.assign(
      args,
      beforeToolCallInterception?.args || {}
    );

    const headers = beforeToolCallInterception?.headers || {};
    const hasHeaderChanges = Object.entries(headers).length > 0;
    if (hasHeaderChanges && typeof (client as Client).fork !== "function") {
      throw new ToolException(
        `MCP client for server "${serverName}" does not support header changes`
      );
    }

    const finalClient =
      hasHeaderChanges && typeof (client as Client).fork === "function"
        ? await (client as Client).fork(headers)
        : client;

    const callToolArgs: Parameters<typeof finalClient.callTool> = [
      {
        name: toolName,
        arguments: finalArgs,
      },
    ];

    if (Object.keys(requestOptions).length > 0) {
      callToolArgs.push(undefined); // optional output schema arg
      callToolArgs.push(requestOptions);
    }

    const result = (await finalClient.callTool(
      ...callToolArgs
    )) as CallToolResult;
    const [content, artifacts] = await _convertCallToolResult({
      serverName,
      toolName,
      result,
      client: finalClient,
      useStandardContentBlocks,
      outputHandling,
    });

    // Convert ExtendedContent to the format expected by afterToolCall
    // afterToolCall expects: string | (ContentBlock | ContentBlock.Data.DataContentBlock)[]
    // ExtendedContent can be: string | ContentBlock[] | (ContentBlock.Text & {...})
    const normalizedContent:
      | string
      | (ContentBlock | ContentBlock.Data.DataContentBlock)[] =
      typeof content === "string"
        ? content
        : Array.isArray(content)
          ? (content as (ContentBlock | ContentBlock.Data.DataContentBlock)[])
          : ([content] as (
              | ContentBlock
              | ContentBlock.Data.DataContentBlock
            )[]);

    // Filter artifacts to only include types expected by afterToolCall
    // afterToolCall expects: (EmbeddedResource | ContentBlock.Multimodal.Standard)[]
    // ExtendedArtifact includes additional types (MCPStructuredContentArtifact, MCPMetaArtifact)
    // which need to be filtered out
    const normalizedArtifacts: (
      | EmbeddedResource
      | ContentBlock.Multimodal.Standard
    )[] = artifacts.filter(
      (
        artifact
      ): artifact is EmbeddedResource | ContentBlock.Multimodal.Standard =>
        artifact.type === "resource" ||
        (artifact.type !== "mcp_structured_content" &&
          artifact.type !== "mcp_meta" &&
          typeof artifact === "object" &&
          artifact !== null &&
          "source_type" in artifact)
    ) as (EmbeddedResource | ContentBlock.Multimodal.Standard)[];

    const interceptedResult = await afterToolCall?.(
      {
        name: toolName,
        args: finalArgs,
        result: [normalizedContent, normalizedArtifacts],
        serverName,
      },
      state,
      config ?? {}
    );

    if (!interceptedResult) {
      return [content, artifacts];
    }

    if (typeof interceptedResult.result === "string") {
      return [interceptedResult.result, []];
    }

    if (Array.isArray(interceptedResult.result)) {
      return interceptedResult.result as ContentBlocksWithArtifacts;
    }

    if (ToolMessage.isInstance(interceptedResult.result)) {
      return [interceptedResult.result.contentBlocks, []];
    }

    // eslint-disable-next-line no-instanceof/no-instanceof
    if (interceptedResult?.result instanceof Command) {
      return interceptedResult.result;
    }

    throw new Error(
      `Unexpected result value type from afterToolCall: expected either a Command, a ToolMessage or a tuple of ContentBlock and Artifact, but got ${interceptedResult.result}`
    );
  } catch (error) {
    // eslint-disable-next-line no-instanceof/no-instanceof
    if (error instanceof ZodErrorV4 || error instanceof ZodErrorV3) {
      throw new ToolException(z.prettifyError(error), error);
    }

    debugLog(`Error calling tool ${toolName}: ${String(error)}`);
    if (isToolException(error)) {
      throw error;
    }
    throw new ToolException(`Error calling tool ${toolName}: ${String(error)}`);
  }
}

const defaultLoadMcpToolsOptions: LoadMcpToolsOptions = {
  throwOnLoadError: true,
  prefixToolNameWithServerName: false,
  additionalToolNamePrefix: "",
  useStandardContentBlocks: false,
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
  const {
    throwOnLoadError,
    prefixToolNameWithServerName,
    additionalToolNamePrefix,
    useStandardContentBlocks,
    outputHandling,
    defaultToolTimeout,
  } = {
    ...defaultLoadMcpToolsOptions,
    ...(options ?? {}),
  };

  const mcpTools: MCPTool[] = [];

  // Get tools in a single operation
  let toolsResponse: ListToolsResult | undefined;
  do {
    toolsResponse = await client.listTools({
      ...(toolsResponse?.nextCursor
        ? { cursor: toolsResponse.nextCursor }
        : {}),
    });
    mcpTools.push(...(toolsResponse.tools || []));
  } while (toolsResponse.nextCursor);

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
            if (!tool.inputSchema.properties) {
              // Workaround for MCP SDK not consistently providing properties
              tool.inputSchema.properties = {};
            }

            // Dereference $defs/$ref in the schema to support Pydantic v2 schemas
            // and other JSON schemas that use $defs for nested type definitions
            const dereferencedSchema = dereferenceJsonSchema(
              tool.inputSchema as JsonSchemaObject
            );

            const dst = new DynamicStructuredTool({
              name: `${toolNamePrefix}${tool.name}`,
              description: tool.description || "",
              schema: dereferencedSchema,
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
                  serverName,
                  toolName: tool.name,
                  client,
                  args,
                  config,
                  useStandardContentBlocks,
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
  ).filter(Boolean) as DynamicStructuredTool[];
}
