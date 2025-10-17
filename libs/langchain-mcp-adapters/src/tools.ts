import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type {
  EmbeddedResource,
  ReadResourceResult,
  Tool as MCPTool,
  ListToolsResult,
} from "@modelcontextprotocol/sdk/types.js";
import type { RequestOptions } from "@modelcontextprotocol/sdk/shared/protocol.js";
import { DynamicStructuredTool } from "@langchain/core/tools";
import {
  Base64ContentBlock,
  DataContentBlock,
  MessageContentComplex,
  MessageContentImageUrl,
  MessageContentText,
  PlainTextContentBlock,
  StandardAudioBlock,
  StandardFileBlock,
  StandardImageBlock,
} from "@langchain/core/messages";
import { RunnableConfig } from "@langchain/core/runnables";
import type { CallbackManagerForToolRun } from "@langchain/core/callbacks/manager";
import debug from "debug";
import {
  _resolveDetailedOutputHandling,
  type CallToolResult,
  type CallToolResultContent,
  type CallToolResultContentType,
  type LoadMcpToolsOptions,
  type OutputHandling,
} from "./types.js";

// Replace direct initialization with lazy initialization
let debugLog: debug.Debugger;
function getDebugLog() {
  if (!debugLog) {
    debugLog = debug("@langchain/mcp-adapters:tools");
  }
  return debugLog;
}

/**
 * Custom error class for tool exceptions
 */
export class ToolException extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ToolException";
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
  client: Client
): AsyncGenerator<
  | (StandardFileBlock & Base64ContentBlock)
  | (StandardFileBlock & PlainTextContentBlock)
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
    } as StandardFileBlock & Base64ContentBlock;
  }
  if (resource.text != null) {
    yield {
      type: "file",
      source_type: "text",
      mime_type: resource.mimeType,
      text: resource.text,
      ...(resource.uri != null ? { metadata: { uri: resource.uri } } : {}),
    } as StandardFileBlock & PlainTextContentBlock;
  }
}

async function _toolOutputToContentBlocks(
  content: CallToolResultContent,
  useStandardContentBlocks: true,
  client: Client,
  toolName: string,
  serverName: string
): Promise<DataContentBlock[]>;
async function _toolOutputToContentBlocks(
  content: CallToolResultContent,
  useStandardContentBlocks: false | undefined,
  client: Client,
  toolName: string,
  serverName: string
): Promise<MessageContentComplex[]>;
async function _toolOutputToContentBlocks(
  content: CallToolResultContent,
  useStandardContentBlocks: boolean | undefined,
  client: Client,
  toolName: string,
  serverName: string
): Promise<(MessageContentComplex | DataContentBlock)[]>;
async function _toolOutputToContentBlocks(
  content: CallToolResultContent,
  useStandardContentBlocks: boolean | undefined,
  client: Client,
  toolName: string,
  serverName: string
): Promise<(MessageContentComplex | DataContentBlock)[]> {
  const blocks: StandardFileBlock[] = [];
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
        } as MessageContentText,
      ];
    case "image":
      if (useStandardContentBlocks) {
        return [
          {
            type: "image",
            source_type: "base64",
            data: content.data,
            mime_type: content.mimeType,
          } as StandardImageBlock,
        ];
      }
      return [
        {
          type: "image_url",
          image_url: {
            url: `data:${content.mimeType};base64,${content.data}`,
          },
        } as MessageContentImageUrl,
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
        } as StandardAudioBlock,
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
  client: Client,
  toolName: string,
  serverName: string
): Promise<(EmbeddedResource | DataContentBlock)[]> {
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
  client: Client;
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
}: ConvertCallToolResultArgs): Promise<
  [
    (MessageContentComplex | DataContentBlock)[],
    (EmbeddedResource | DataContentBlock)[]
  ]
> {
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
        .map((content: CallToolResultContent) => content.text)
        .join("\n")}`
    );
  }

  const convertedContent: (MessageContentComplex | DataContentBlock)[] = (
    await Promise.all(
      result.content
        .filter(
          (content: CallToolResultContent) =>
            _getOutputTypeForContentType(content.type, outputHandling) ===
            "content"
        )
        .map((content: CallToolResultContent) =>
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
          (content: CallToolResultContent) =>
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

  if (convertedContent.length === 1 && convertedContent[0].type === "text") {
    return [convertedContent[0].text, artifacts];
  }

  return [convertedContent, artifacts];
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
  client: Client;
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
};

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
}: CallToolArgs): Promise<
  [
    (MessageContentComplex | DataContentBlock)[],
    (EmbeddedResource | DataContentBlock)[]
  ]
> {
  try {
    getDebugLog()(`INFO: Calling tool ${toolName}(${JSON.stringify(args)})`);

    // Extract timeout from RunnableConfig and pass to MCP SDK
    const requestOptions: RequestOptions = {
      ...(config?.timeout ? { timeout: config.timeout } : {}),
      ...(config?.signal ? { signal: config.signal } : {}),
    };

    const callToolArgs: Parameters<typeof client.callTool> = [
      {
        name: toolName,
        arguments: args,
      },
    ];

    if (Object.keys(requestOptions).length > 0) {
      callToolArgs.push(undefined); // optional output schema arg
      callToolArgs.push(requestOptions);
    }

    const result = await client.callTool(...callToolArgs);
    return _convertCallToolResult({
      serverName,
      toolName,
      result: result as CallToolResult,
      client,
      useStandardContentBlocks,
      outputHandling,
    });
  } catch (error) {
    getDebugLog()(`Error calling tool ${toolName}: ${String(error)}`);
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
  client: Client,
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

  getDebugLog()(`INFO: Found ${mcpTools.length} MCP tools`);

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
              // eslint-disable-next-line no-param-reassign
              tool.inputSchema.properties = {};
            }

            const dst = new DynamicStructuredTool({
              name: `${toolNamePrefix}${tool.name}`,
              description: tool.description || "",
              schema: tool.inputSchema,
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
                });
              },
            });
            getDebugLog()(`INFO: Successfully loaded tool: ${dst.name}`);
            return dst;
          } catch (error) {
            getDebugLog()(`ERROR: Failed to load tool "${tool.name}":`, error);
            if (throwOnLoadError) {
              throw error;
            }
            return null;
          }
        })
    )
  ).filter(Boolean) as DynamicStructuredTool[];
}
