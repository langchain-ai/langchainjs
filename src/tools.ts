import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StructuredTool } from '@langchain/core/tools';
import { z } from 'zod';
import logger from './logger.js';

// Define the types that were previously imported from the SDK
interface ContentItem {
  type: string;
  text?: string;
  [key: string]: any;
}

// Custom error class for tool exceptions
class ToolException extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ToolException';
  }
}

/**
 * Process the result from calling an MCP tool.
 *
 * @param result - The result from the MCP tool call
 * @returns The processed result
 */
function _convertCallToolResult(result: any): any {
  // Check for error in the response
  if (result.isError) {
    // Find the first text content for error message
    if (Array.isArray(result.content)) {
      const textContent = result.content.find((item: ContentItem) => item.type === 'text');
      if (textContent && textContent.text) {
        throw new ToolException(textContent.text);
      }
    }
    throw new ToolException('Tool execution failed');
  }

  // Handle content array from the new SDK format
  if (Array.isArray(result.content)) {
    // Find the first text content
    const textContent = result.content.find((item: ContentItem) => item.type === 'text');
    if (textContent) {
      return textContent.text;
    }
    // If there's only one content item, return it
    if (result.content.length === 1) {
      return result.content[0];
    }
    // Return the whole content array if no text found
    return result.content;
  }

  // Handle old format or other formats
  return result;
}

/**
 * Convert an MCP tool to a LangChain tool.
 *
 * @param client - The MCP client
 * @param toolName - The name of the tool
 * @param toolDescription - The description of the tool
 * @param toolSchema - The schema of the tool
 * @returns A LangChain tool
 */
export function convertMcpToolToLangchainTool(
  client: Client,
  toolName: string,
  toolDescription: string,
  toolSchema: any
): StructuredTool {
  // Convert the JSON schema to a Zod schema
  let zodSchema: z.ZodObject<any>;

  try {
    // Create a Zod schema based on the tool's schema
    if (toolSchema && toolSchema.type === 'object' && toolSchema.properties) {
      const schemaShape: Record<string, z.ZodType> = {};

      // Convert each property to a Zod type
      Object.entries(toolSchema.properties).forEach(([key, value]: [string, any]) => {
        if (value.type === 'string') {
          schemaShape[key] = z.string();
        } else if (value.type === 'number') {
          schemaShape[key] = z.number();
        } else if (value.type === 'boolean') {
          schemaShape[key] = z.boolean();
        } else if (value.type === 'array') {
          schemaShape[key] = z.array(z.any());
        } else {
          schemaShape[key] = z.any();
        }
      });

      // Check if the schema is empty after conversion
      if (Object.keys(schemaShape).length === 0) {
        logger.warn(
          `Tool "${toolName}" has an empty input schema. Some LLMs and agent implementations (especially React agents and Gemini models) require tools to have parameters.`
        );
      }

      zodSchema = z.object(schemaShape);
    } else {
      logger.warn(
        `Tool "${toolName}" has no input schema definition. Some LLMs and agent implementations (especially React agents and Gemini models) require tools to have parameters.`
      );
      zodSchema = z.object({});
    }
  } catch (error) {
    logger.warn(`Error creating Zod schema for tool ${toolName}:`, error);
    zodSchema = z.object({});
  }

  // Create a class that extends StructuredTool
  class MCPTool extends StructuredTool {
    name = toolName;
    description = toolDescription;
    schema = zodSchema;

    constructor() {
      super();
    }

    protected async _call(input: Record<string, any>): Promise<string> {
      try {
        logger.debug(`Calling MCP tool ${toolName} with input:`, input);
        // Use the new SDK format for calling tools
        const result = await client.callTool({
          name: toolName,
          arguments: input,
        });
        const processedResult = _convertCallToolResult(result);
        logger.debug(`MCP tool ${toolName} returned:`, processedResult);
        return String(processedResult);
      } catch (error) {
        logger.error(`Error calling tool ${toolName}:`, error);
        throw new ToolException(`Error calling tool ${toolName}: ${error}`);
      }
    }
  }

  return new MCPTool();
}

/**
 * Load all tools from an MCP client.
 *
 * @param client - The MCP client
 * @returns A list of LangChain tools
 */
export async function loadMcpTools(client: Client): Promise<StructuredTool[]> {
  const tools: StructuredTool[] = [];
  logger.debug('Listing available MCP tools...');
  const toolsResponse = await client.listTools();
  const toolsInfo = toolsResponse.tools;

  logger.info(`Found ${toolsInfo.length} MCP tools`);

  for (const toolInfo of toolsInfo) {
    logger.debug(`Converting MCP tool "${toolInfo.name}" to LangChain tool`);
    const tool = convertMcpToolToLangchainTool(
      client,
      toolInfo.name,
      toolInfo.description || '',
      toolInfo.inputSchema
    );
    tools.push(tool);
  }

  return tools;
}
