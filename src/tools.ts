import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type {
  CallToolResult,
  TextContent,
  ImageContent,
  EmbeddedResource,
  ReadResourceResult,
} from '@modelcontextprotocol/sdk/types.js';
import {
  DynamicStructuredTool,
  type DynamicStructuredToolInput,
  type StructuredToolInterface,
} from '@langchain/core/tools';
import {
  MessageContent,
  MessageContentComplex,
  MessageContentImageUrl,
  MessageContentText,
} from '@langchain/core/messages';
import { JSONSchema, JSONSchemaToZod } from '@dmitryrechkin/json-schema-to-zod';

import debug from 'debug';
import { z } from 'zod';

const {
  default: { name: packageName },
} = await import('../package.json');
const moduleName = 'tools';

const debugLog = debug(`${packageName}:${moduleName}`);

export type CallToolResultContentType = CallToolResult['content'][number]['type'];
export type CallToolResultContent = TextContent | ImageContent | EmbeddedResource;

async function _embeddedResourceToArtifact(
  resource: EmbeddedResource,
  client: Client
): Promise<EmbeddedResource[]> {
  if (!resource.blob && !resource.text && resource.uri) {
    const response: ReadResourceResult = await client.readResource({
      uri: resource.resource.uri,
    });

    return response.contents.map(content => ({
      type: 'resource',
      resource: {
        ...content,
      },
    }));
  }
  return [resource];
}

/**
 * Custom error class for tool exceptions
 */
export class ToolException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ToolException';
  }
}

/**
 * Process the result from calling an MCP tool.
 * Extracts text content and non-text content for better agent compatibility.
 *
 * @param result - The result from the MCP tool call
 * @returns A tuple of [textContent, nonTextContent]
 */
async function _convertCallToolResult(
  serverName: string,
  toolName: string,
  result: CallToolResult,
  client: Client
): Promise<[MessageContent, EmbeddedResource[]]> {
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
      `MCP tool '${toolName}' on server '${serverName}' returned an error: ${result.content.map(content => content.text).join('\n')}`
    );
  }

  const mcpTextAndImageContent: MessageContentComplex[] = result.content
    .filter(content => content.type === 'text' || content.type === 'image')
    .map(content => {
      switch (content.type) {
        case 'text':
          return {
            type: 'text',
            text: content.text,
          } as MessageContentText;
        case 'image':
          return {
            type: 'image_url',
            image_url: {
              url: `data:${content.mimeType};base64,${content.data}`,
            },
          } as MessageContentImageUrl;
      }
    });

  // Create the text content output
  const artifacts = (
    await Promise.all(
      result.content
        .filter(content => content.type === 'resource')
        .map(content => _embeddedResourceToArtifact(content, client))
    )
  ).flat();

  if (mcpTextAndImageContent.length === 1 && mcpTextAndImageContent[0].type === 'text') {
    return [mcpTextAndImageContent[0].text, artifacts];
  }

  return [mcpTextAndImageContent, artifacts];
}

/**
 * Call an MCP tool.
 *
 * Use this with `.bind` to capture the fist three arguments, then pass to the constructor of DynamicStructuredTool.
 *
 * @internal
 *
 * @param client - The MCP client
 * @param toolName - The name of the tool (forwarded to the client)
 * @param args - The arguments to pass to the tool
 * @returns A tuple of [textContent, nonTextContent]
 */
async function _callTool(
  serverName: string,
  toolName: string,
  client: Client,
  args: Record<string, unknown>
): Promise<[MessageContent, EmbeddedResource[]]> {
  let result: CallToolResult;
  try {
    debugLog(`INFO: Calling tool ${toolName}(${JSON.stringify(args)})`);
    result = (await client.callTool({
      name: toolName,
      arguments: args,
    })) as CallToolResult;
  } catch (error) {
    debugLog(`Error calling tool ${toolName}: ${String(error)}`);
    if (error instanceof ToolException) {
      throw error;
    }
    throw new ToolException(`Error calling tool ${toolName}: ${String(error)}`);
  }

  return _convertCallToolResult(serverName, toolName, result, client);
}

/**
 * Load all tools from an MCP client.
 *
 * @param client - The MCP client
 * @returns A list of LangChain tools
 */
export async function loadMcpTools(
  serverName: string,
  client: Client,
  throwOnLoadError: boolean = true
): Promise<StructuredToolInterface[]> {
  // Get tools in a single operation
  const toolsResponse = await client.listTools();
  debugLog(`INFO: Found ${toolsResponse.tools?.length || 0} MCP tools`);

  // Filter out tools without names and convert in a single map operation
  return (toolsResponse.tools || [])
    .filter(tool => !!tool.name)
    .map(tool => {
      try {
        const dst = new DynamicStructuredTool({
          name: tool.name,
          description: tool.description || '',
          schema: JSONSchemaToZod.convert(
            (tool.inputSchema ?? { type: 'object', properties: {} }) as JSONSchema
          ),
          responseFormat: 'content_and_artifact',
          func: _callTool.bind(
            null,
            serverName,
            tool.name,
            client
          ) as DynamicStructuredToolInput<z.AnyZodObject>['func'],
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
    .filter(Boolean) as StructuredToolInterface[];
}
