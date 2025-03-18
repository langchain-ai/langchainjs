import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import {
  DynamicStructuredTool,
  ResponseFormat,
  StructuredToolInterface,
} from '@langchain/core/tools';
import { JSONSchema, JSONSchemaToZod } from '@dmitryrechkin/json-schema-to-zod';

import logger from './logger.js';

interface TextContent {
  type: 'text';
  text: string;
}

interface NonTextContent {
  type: string;
  [key: string]: unknown;
}

interface CallToolResult {
  isError?: boolean;
  content?: (TextContent | NonTextContent)[] | string | object;
  type?: string;
  [key: string]: unknown;
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
function _convertCallToolResult(
  result: CallToolResult
): [string | string[], NonTextContent[] | null] {
  if (!result || !Array.isArray(result.content)) {
    return ['', null];
  }

  const textContents: TextContent[] = [];
  const nonTextContents: NonTextContent[] = [];

  // Separate text and non-text content
  for (const content of result.content) {
    if (content.type === 'text' && 'text' in content) {
      textContents.push(content as TextContent);
    } else {
      nonTextContents.push(content as NonTextContent);
    }
  }

  // Create the text content output
  const textOutput = textContents.map(content => content.text);
  const finalTextOutput = textOutput.length === 1 ? textOutput[0] : textOutput;

  // Check for errors
  if (result.isError) {
    logger.error('MCP tool returned an error result');
    throw new ToolException(
      typeof finalTextOutput === 'string' ? finalTextOutput : textOutput.join('\n')
    );
  }

  return [finalTextOutput, nonTextContents.length > 0 ? nonTextContents : null];
}

/**
 * Call an MCP tool.
 *
 * Use this with `.bind` to capture the fist three arguments, then pass to the constructor of DynamicStructuredTool.
 *
 * @internal
 *
 * @param client - The MCP client
 * @param name - The name of the tool (forwarded to the client)
 * @param responseFormat - The response format
 * @param args - The arguments to pass to the tool
 * @returns A tuple of [textContent, nonTextContent]
 */
async function _callTool(
  client: Client,
  name: string,
  responseFormat: ResponseFormat,
  args: Record<string, unknown>
): Promise<string | [string | string[], NonTextContent[] | null]> {
  try {
    logger.info(`Calling tool ${name}(${JSON.stringify(args)})`);
    const result = await client.callTool({
      name,
      arguments: args,
    });

    const [textContent, nonTextContent] = _convertCallToolResult({
      ...result,
      isError: result.isError === true,
      content: result.content || [],
    });

    logger.info(`Tool ${name} returned: ${JSON.stringify({ textContent, nonTextContent })}`);

    // Return based on the response format
    if (responseFormat === 'content_and_artifact') {
      return [textContent, nonTextContent];
    }

    // Default to returning just the text content
    return typeof textContent === 'string' ? textContent : textContent.join('\n');
  } catch (error) {
    logger.error(`Error calling tool ${name}: ${String(error)}`);
    if (error instanceof ToolException) {
      throw error;
    }
    throw new ToolException(`Error calling tool ${name}: ${String(error)}`);
  }
}

/**
 * Load all tools from an MCP client.
 *
 * @param client - The MCP client
 * @param responseFormat - Response format ('text' or 'content_and_artifact')
 * @returns A list of LangChain tools
 */
export async function loadMcpTools(
  client: Client,
  responseFormat: ResponseFormat = 'content',
  throwOnLoadError: boolean = true
): Promise<StructuredToolInterface[]> {
  // Get tools in a single operation
  const toolsResponse = await client.listTools();
  logger.info(`Found ${toolsResponse.tools?.length || 0} MCP tools`);

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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          func: _callTool.bind(null, client, tool.name, responseFormat) as any,
        });
        logger.debug(`Successfully loaded tool: ${dst.name}`);
        return dst;
      } catch (error) {
        logger.error(`Failed to load tool "${tool.name}":`, error);
        if (throwOnLoadError) {
          throw error;
        }
        return null;
      }
    })
    .filter(Boolean) as StructuredToolInterface[];
}
