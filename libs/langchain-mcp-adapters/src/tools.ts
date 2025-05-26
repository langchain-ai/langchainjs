import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import type {
  TextContent,
  ImageContent,
  EmbeddedResource,
  ReadResourceResult,
  Tool as MCPTool,
  AudioContent,
} from "@modelcontextprotocol/sdk/types.js";
import type { RequestOptions } from "@modelcontextprotocol/sdk/shared/protocol.js";
import {
  DynamicStructuredTool,
  type StructuredToolInterface,
} from "@langchain/core/tools";
import {
  DataContentBlock,
  MessageContentComplex,
  MessageContentImageUrl,
  MessageContentText,
  StandardAudioBlock,
  StandardImageBlock,
} from "@langchain/core/messages";
import { RunnableConfig } from "@langchain/core/runnables";
import type { CallbackManagerForToolRun } from "@langchain/core/callbacks/manager";
import debug from "debug";

// Replace direct initialization with lazy initialization
let debugLog: debug.Debugger;
function getDebugLog() {
  if (!debugLog) {
    debugLog = debug("@langchain/mcp-adapters:tools");
  }
  return debugLog;
}

export type CallToolResult = Awaited<
  ReturnType<typeof Client.prototype.callTool>
>;

export type CallToolResultContent =
  | TextContent
  | ImageContent
  | AudioContent
  | EmbeddedResource;

export type CallToolResultContentType = CallToolResultContent["type"];

async function _embeddedResourceToArtifact(
  resource: EmbeddedResource,
  client: Client
): Promise<EmbeddedResource[]> {
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
};

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
}: ConvertCallToolResultArgs): Promise<
  [(MessageContentComplex | DataContentBlock)[], EmbeddedResource[]]
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
        .map((content) => content.text)
        .join("\n")}`
    );
  }

  const convertedContent: (MessageContentComplex | DataContentBlock)[] =
    result.content
      .filter((content) => content.type !== "resource")
      .map((content) => {
        switch (content.type) {
          case "text":
            return {
              type: "text",
              ...(useStandardContentBlocks
                ? {
                    source_type: "text",
                  }
                : {}),
              text: content.text,
            } as MessageContentText;
          case "image":
            if (useStandardContentBlocks) {
              return {
                type: "image",
                source_type: "base64",
                data: content.data,
                mime_type: content.mimeType,
              } as StandardImageBlock;
            }
            return {
              type: "image_url",
              image_url: {
                url: `data:${content.mimeType};base64,${content.data}`,
              },
            } as MessageContentImageUrl;
          case "audio":
            // We don't check `useStandardContentBlocks` here because we only support audio via
            // standard content blocks
            return {
              type: "audio",
              source_type: "base64",
              data: content.data,
              mime_type: content.mimeType,
            } as StandardAudioBlock;
          default:
            throw new ToolException(
              `MCP tool '${toolName}' on server '${serverName}' returned a content block with unexpected type "${content.type}." Expected one of "text", "image", or "audio".`
            );
        }
      });

  // Create the text content output
  const artifacts = (
    await Promise.all(
      (
        result.content.filter(
          (content) => content.type === "resource"
        ) as EmbeddedResource[]
      ).map((content: EmbeddedResource) => {
        console.warn(`Found resource: ${content.resource.uri}`);
        return _embeddedResourceToArtifact(content, client);
      })
    )
  ).flat() as EmbeddedResource[];

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
}: CallToolArgs): Promise<
  [(MessageContentComplex | DataContentBlock)[], EmbeddedResource[]]
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
    return await _convertCallToolResult({
      serverName,
      toolName,
      result,
      client,
      useStandardContentBlocks,
    });
  } catch (error) {
    getDebugLog()(`Error calling tool ${toolName}: ${String(error)}`);
    if (isToolException(error)) {
      throw error;
    }
    throw new ToolException(`Error calling tool ${toolName}: ${String(error)}`);
  }
}

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
   * image or audio content. This option has no effect on handling of embedded resource tool output.
   *
   * @default false
   */
  useStandardContentBlocks?: boolean;
};

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
): Promise<StructuredToolInterface[]> {
  const {
    throwOnLoadError,
    prefixToolNameWithServerName,
    additionalToolNamePrefix,
    useStandardContentBlocks,
  } = {
    ...defaultLoadMcpToolsOptions,
    ...(options ?? {}),
  };

  // Get tools in a single operation
  const toolsResponse = await client.listTools();
  getDebugLog()(`INFO: Found ${toolsResponse.tools?.length || 0} MCP tools`);

  const initialPrefix = additionalToolNamePrefix
    ? `${additionalToolNamePrefix}__`
    : "";
  const serverPrefix = prefixToolNameWithServerName ? `${serverName}__` : "";
  const toolNamePrefix = `${initialPrefix}${serverPrefix}`;

  // Filter out tools without names and convert in a single map operation
  return (
    await Promise.all(
      (toolsResponse.tools || [])
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
  ).filter(Boolean) as StructuredToolInterface[];
}
