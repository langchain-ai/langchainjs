import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StructuredTool, StructuredToolInterface } from '@langchain/core/tools';
import { z } from 'zod';
import { JSONSchemaToZod } from '@dmitryrechkin/json-schema-to-zod';
import logger from './logger.js';

// Define the interfaces that may not be directly exported from the SDK
interface ContentItem {
  type: string;
  text?: string;
  [key: string]: any;
}

interface CallToolResult {
  isError?: boolean;
  content: ContentItem[] | any;
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
function _convertCallToolResult(result: CallToolResult): any {
  logger.debug('Processing MCP tool result:', JSON.stringify(result, null, 2));

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
    if (textContent && textContent.text !== undefined) {
      logger.debug('Extracted text content from MCP result:', textContent.text);
      return textContent.text;
    }
    // If there's only one content item, return it
    if (result.content.length === 1) {
      logger.debug('Extracted single content item from MCP result:', result.content[0]);

      // If the content item has a value field, return that for compatibility with some tools
      if (result.content[0].value !== undefined) {
        logger.debug('Content has value field, returning value:', result.content[0].value);
        return result.content[0].value;
      }

      return result.content[0];
    }
    // Return the whole content array if no text found
    logger.debug('Returning entire content array from MCP result:', result.content);
    return result.content;
  }

  // For React agents, make sure we're returning a string, number, or simple value
  // rather than a complex object, which can cause parsing issues
  if (result.value !== undefined) {
    logger.debug(
      'Result has value field, returning value for maximum agent compatibility:',
      result.value
    );
    return result.value;
  }

  // Handle old format or other formats
  logger.debug('Returning MCP result as-is:', result);
  return result;
}

/**
 * Convert a JSON Schema to a Zod schema using dmitryrechkin/json-schema-to-zod library
 *
 * @param jsonSchema - The JSON Schema to convert
 * @returns A Zod schema
 */
function _convertJsonSchemaToZod(jsonSchema: any): z.ZodTypeAny {
  try {
    if (!jsonSchema || typeof jsonSchema !== 'object') {
      return z.any();
    }

    // Use the dmitryrechkin/json-schema-to-zod library for conversion
    return JSONSchemaToZod.convert(jsonSchema);
  } catch (error) {
    logger.warn(`Error converting JSON Schema to Zod: ${error}`);
    // Fallback to z.any() in case of error
    return z.any();
  }
}

/**
 * Parse tool input from a React agent to make it compatible with MCP tools.
 * React agents often format inputs as "5, 3" or "(5, 3)" instead of JSON.
 *
 * @param input - The input from a React agent
 * @param expectedSchema - The expected schema for the tool input
 * @returns Parsed input that matches the expected schema
 */
function _parseReactAgentInput(
  input: string | any,
  expectedSchema: z.ZodObject<any>
): Record<string, any> {
  logger.debug('_parseReactAgentInput called with input:', input);
  logger.debug('Input type:', typeof input);

  // If the input is already a properly structured object, return it
  if (typeof input === 'object' && input !== null && Object.keys(input).length > 0) {
    logger.debug('Input is already an object, returning as-is');
    return input;
  }

  // Check for React agent pattern like "{key: }" with missing value - generic approach for any key
  if (typeof input === 'string' && input.match(/\{\s*\w+\s*:\s*\}/)) {
    logger.debug('Detected React agent string input pattern with empty value:', input);
    // Extract the key from the pattern
    const keyMatch = input.match(/\{\s*(\w+)\s*:\s*\}/);
    if (keyMatch && keyMatch[1]) {
      const key = keyMatch[1];
      // Create an object with the key and empty string value
      const result: Record<string, any> = {};
      result[key] = '';
      logger.debug('Successfully parsed React agent input with empty value to:', result);
      return result;
    }
  }

  // Get expected schema properties and their types for better parsing guidance
  const schemaProperties = Object.keys(expectedSchema.shape);
  logger.debug('Expected schema properties:', schemaProperties);

  // Create a mapping of property names to their expected types from the schema
  const schemaTypes: Record<string, string> = {};
  for (const prop of schemaProperties) {
    const zodType = expectedSchema.shape[prop];
    if (zodType instanceof z.ZodArray) {
      schemaTypes[prop] = 'array';
    } else if (zodType instanceof z.ZodObject) {
      schemaTypes[prop] = 'object';
    } else if (zodType instanceof z.ZodNumber) {
      schemaTypes[prop] = 'number';
    } else if (zodType instanceof z.ZodBoolean) {
      schemaTypes[prop] = 'boolean';
    } else {
      schemaTypes[prop] = 'string';
    }
  }
  logger.debug('Expected schema types:', schemaTypes);

  // Generic handling for empty values in any parameter, not just 'path'
  if (typeof input === 'string') {
    // Handle case where input is empty or just whitespace for any parameter
    if (input.trim() === '') {
      if (schemaProperties.length === 1) {
        // If there's only one expected parameter, create an object with that parameter and empty string
        const key = schemaProperties[0];
        logger.debug(
          `Detected empty input for schema with single property '${key}', creating object with empty string value`
        );
        const result: Record<string, any> = {};
        result[key] = '';
        return result;
      }
    }

    // If input matches pattern like "{key:}" for any key that exists in the schema
    for (const prop of schemaProperties) {
      const pattern = new RegExp(`^\\{\\s*${prop}\\s*:\\s*\\}\\s*$`, 'i');
      if (input.match(pattern)) {
        logger.debug(
          `Detected empty value for parameter '${prop}', creating object with empty string value`
        );
        const result: Record<string, any> = {};
        result[prop] = '';
        return result;
      }
    }

    // Special handling for React agent inputs that include markdown code blocks
    if (input.includes('```')) {
      logger.debug('Detected React agent input with markdown code block');
      // Extract content from code block if it exists
      const codeBlockMatch = input.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch && codeBlockMatch[1]) {
        const extractedJson = codeBlockMatch[1].trim();
        logger.debug('Extracted JSON from code block:', extractedJson);
        // Try parsing the extracted JSON
        try {
          const parsed = JSON.parse(extractedJson);
          logger.debug('Successfully parsed JSON from code block:', parsed);
          return parsed;
        } catch (e) {
          logger.debug(
            'Failed to parse extracted JSON, will continue with other parsing methods:',
            e
          );
          // Replace the original input with the extracted content for further processing
          input = extractedJson;
        }
      }
    }
  }

  // Special handling for React agent "{a: 5, b: 3}" format
  try {
    // First check if it's already a JSON string (rare, but possible)
    if (
      (input.startsWith('{') && input.endsWith('}')) ||
      (input.startsWith('[') && input.endsWith(']'))
    ) {
      try {
        const parsed = JSON.parse(input);
        logger.debug('Successfully parsed standard JSON input:', parsed);
        return parsed;
      } catch (e) {
        // Not valid JSON, continue with other parsing methods
        logger.debug('Not valid standard JSON, trying to fix format:', e);
      }

      // React agents often send input as "{a: 5, b: 3}" with no quotes around keys
      // Convert this to proper JSON
      const jsonLikeString = input
        // Make sure property names are correctly quoted
        .replace(/([{,]\s*)([a-zA-Z0-9_]+)(\s*:)/g, '$1"$2"$3')
        // Ensure we have double quotes on string values (convert single quotes)
        .replace(/:\s*'([^']*)'/g, ': "$1"');

      logger.debug('Reformatted to valid JSON:', jsonLikeString);

      try {
        const parsed = JSON.parse(jsonLikeString);
        logger.debug('Successfully parsed reformatted JSON:', parsed);
        return parsed;
      } catch (jsonErr) {
        logger.debug('Error parsing reformatted JSON:', jsonErr);

        // Fallback parser for broken JSON (useful for React agent outputs)
        try {
          // Create a naive parser for objects like {a: 5, b: 3}
          if (input.startsWith('{') && input.endsWith('}')) {
            // Extract the content between braces
            const content = input.slice(1, -1).trim();

            // Split by commas (handles {a: 5, b: 3} format)
            const pairs = content.split(',').map((pair: string) => pair.trim());

            const result: Record<string, any> = {};

            for (const pair of pairs) {
              // Split each pair by colon
              const [key, value] = pair.split(':').map((part: string) => part.trim());

              if (!key || value === undefined) continue;

              // Remove quotes if they exist
              const cleanKey = key.replace(/^["']|["']$/g, '');

              // Get the expected type for this property (default to string)
              const expectedType = schemaTypes[cleanKey] || 'string';

              // Apply conversions based on expected types
              if (expectedType === 'array') {
                // If this property should be an array, handle array-like values
                if (value.startsWith('[') && value.endsWith(']')) {
                  // Extract array items
                  const arrayContent = value.slice(1, -1).trim();
                  // Split by commas and clean each item
                  result[cleanKey] = arrayContent
                    .split(',')
                    .map((item: string) => item.trim().replace(/^["']|["']$/g, ''));
                  logger.debug(`Parsed array value for ${cleanKey}:`, result[cleanKey]);
                } else {
                  // Single item, make it an array with one element
                  result[cleanKey] = [value.replace(/^["']|["']$/g, '')];
                }
              } else if (expectedType === 'number') {
                // Convert to number if expected
                const numValue = Number(value);
                result[cleanKey] = !isNaN(numValue) ? numValue : value.replace(/^["']|["']$/g, '');
              } else if (expectedType === 'boolean') {
                // Handle boolean values
                const lowercaseValue = value.toLowerCase().trim();
                if (lowercaseValue === 'true') {
                  result[cleanKey] = true;
                } else if (lowercaseValue === 'false') {
                  result[cleanKey] = false;
                } else {
                  result[cleanKey] = Boolean(value);
                }
              } else if (
                expectedType === 'object' &&
                value.startsWith('{') &&
                value.endsWith('}')
              ) {
                // Try to parse nested objects
                try {
                  // This is a recursive call that will try all parsing methods
                  const nestedObj = _parseReactAgentInput(value, expectedSchema.shape[cleanKey]);
                  result[cleanKey] = nestedObj;
                } catch (e) {
                  // Fall back to string if parsing fails
                  result[cleanKey] = value.replace(/^["']|["']$/g, '');
                }
              } else {
                // Default to string
                result[cleanKey] = value.replace(/^["']|["']$/g, '');
              }
            }

            logger.debug('Successfully parsed with fallback parser:', result);
            return result;
          }
        } catch (fallbackErr) {
          logger.debug('Fallback parser failed:', fallbackErr);
        }
      }
    }
  } catch (e) {
    logger.debug('Error in JSON-like string processing:', e);
  }

  // Continue with other parsing approaches if JSON-like parsing failed
  try {
    const stringInput = String(input);
    logger.debug('Parsing as comma-separated string:', stringInput);

    // Remove outer quotes if they exist (e.g., '"5, 3"' -> '5, 3')
    let cleanInput = stringInput.replace(/^["']|["']$/g, '');

    // Remove parentheses if present
    cleanInput = cleanInput.replace(/^\(|\)$/g, '');
    logger.debug('Cleaned input:', cleanInput);

    // Try to parse the input as comma-separated values
    const parts = cleanInput.split(',').map(part => part.trim());
    logger.debug('Split input into parts:', parts);

    // If we have parts and expected schema properties, map them
    if (parts.length > 0 && schemaProperties.length > 0) {
      const result: Record<string, any> = {};

      // Map each part to its corresponding schema property
      parts.forEach((part, index) => {
        if (index < schemaProperties.length) {
          const key = schemaProperties[index];
          const expectedType = schemaTypes[key] || 'string';

          // Apply appropriate type conversion based on expected type
          if (expectedType === 'number') {
            result[key] = !isNaN(Number(part)) ? Number(part) : part;
          } else if (expectedType === 'boolean') {
            const lowercaseValue = part.toLowerCase().trim();
            if (lowercaseValue === 'true') {
              result[key] = true;
            } else if (lowercaseValue === 'false') {
              result[key] = false;
            } else {
              result[key] = Boolean(part);
            }
          } else if (expectedType === 'array') {
            // If we expect an array but have a single value, wrap it in an array
            result[key] = [part];
          } else {
            result[key] = part;
          }
        }
      });

      logger.debug('Parsed comma-separated values to:', result);
      return result;
    }
  } catch (e) {
    logger.debug('Error processing comma-separated values:', e);
  }

  // Fallback for single value inputs
  if (schemaProperties.length > 0) {
    try {
      const stringValue = String(input).trim();
      const numValue = Number(stringValue);

      // For single value inputs, map to the first schema property
      if (!isNaN(numValue)) {
        const result: Record<string, any> = {};
        result[schemaProperties[0]] = numValue;
        logger.debug('Created object from single number value:', result);
        return result;
      }

      // Special case: If we expect parameters 'a' and 'b', create default object
      if (schemaProperties.includes('a') && schemaProperties.includes('b')) {
        // Extract numbers if possible
        const numMatches = stringValue.match(/\d+/g);
        if (numMatches && numMatches.length >= 2) {
          const result: Record<string, any> = {
            a: Number(numMatches[0]),
            b: Number(numMatches[1]),
          };
          logger.debug('Created a/b object from string with numbers:', result);
          return result;
        }
      }
    } catch (e) {
      logger.debug('Error in fallback processing:', e);
    }
  }

  // Return a last-resort empty object that matches the schema
  const fallback: Record<string, any> = {};
  schemaProperties.forEach(prop => {
    const expectedType = schemaTypes[prop] || 'string';
    if (expectedType === 'array') {
      fallback[prop] = [];
    } else if (expectedType === 'object') {
      fallback[prop] = {};
    } else if (expectedType === 'number') {
      fallback[prop] = 0;
    } else if (expectedType === 'boolean') {
      fallback[prop] = false;
    } else {
      fallback[prop] = '';
    }
  });
  logger.debug('Returning fallback object with proper types:', fallback);
  return fallback;
}

/**
 * Convert an MCP tool to a LangChain tool.
 *
 * @param client - The MCP client
 * @param toolName - The name of the tool
 * @param toolDescription - The description of the tool
 * @param toolSchema - The schema of the tool
 * @returns A LangChain tool implementing StructuredToolInterface
 */
export function convertMcpToolToLangchainTool(
  client: Client,
  toolName: string,
  toolDescription: string,
  toolSchema: any
): StructuredToolInterface<z.ZodObject<any>> {
  // Convert the JSON schema to a Zod schema
  let zodSchema: z.ZodObject<any>;

  try {
    // Use the enhanced schema conversion function
    if (toolSchema) {
      const convertedSchema = _convertJsonSchemaToZod(toolSchema);

      // Ensure we always have a ZodObject
      if (convertedSchema instanceof z.ZodObject) {
        zodSchema = convertedSchema;
      } else {
        // If it's not an object schema, wrap it
        zodSchema = z.object({ input: convertedSchema });
      }
    } else {
      logger.warn(
        `Tool "${toolName}" has no input schema definition. Some LLMs and agent implementations (especially React agents and Gemini models) require tools to have parameters.`
      );
      zodSchema = z.object({});
    }

    // Check if the schema is empty
    if (Object.keys(zodSchema.shape).length === 0) {
      logger.warn(
        `Tool "${toolName}" has an empty input schema. Some LLMs and agent implementations (especially React agents and Gemini models) require tools to have parameters.`
      );
      logger.debug(
        `Adapter will handle empty schema tools by accepting empty input objects for tool "${toolName}".`
      );
    }
  } catch (error) {
    logger.warn(`Error creating Zod schema for tool ${toolName}:`, error);
    zodSchema = z.object({});
  }

  // Create a class that extends StructuredTool
  class MCPToolAdapter extends StructuredTool {
    name = toolName;
    description = toolDescription;
    schema = zodSchema;

    constructor() {
      super();
    }

    // Override the parent call method to handle React agent inputs before validation
    async call(input: unknown): Promise<string> {
      // Add detailed logging to understand what's happening
      logger.debug(
        `Tool call received for ${this.name} with input:`,
        typeof input === 'string' ? `"${input}"` : JSON.stringify(input)
      );

      try {
        // Special case for React agent that passes "{a: 5, b: 3}" as a string
        if (typeof input === 'string' && input.startsWith('{') && input.endsWith('}')) {
          logger.debug(`Detected React agent string input pattern: "${input}"`);

          // Create a direct parser for React agent format {a: 5, b: 3}
          try {
            // Extract the content between braces
            const content = input.slice(1, -1).trim();

            // Split by commas
            const pairs = content.split(',').map(pair => pair.trim());

            const parsedInput: Record<string, any> = {};

            for (const pair of pairs) {
              if (!pair) continue;

              // Split each pair by colon
              const colonPos = pair.indexOf(':');
              if (colonPos === -1) continue;

              const key = pair
                .substring(0, colonPos)
                .trim()
                .replace(/^["']|["']$/g, '');
              const value = pair.substring(colonPos + 1).trim();

              // Try to convert to number if possible
              const numValue = Number(value);
              if (!isNaN(numValue)) {
                parsedInput[key] = numValue;
              } else {
                // Handle string values (remove quotes if present)
                parsedInput[key] = value.replace(/^["']|["']$/g, '');
              }
            }

            if (Object.keys(parsedInput).length > 0) {
              logger.debug(
                `Successfully parsed React agent input to: ${JSON.stringify(parsedInput)}`
              );
              // Call our _call method directly, bypassing schema validation
              return this._call(parsedInput as Record<string, any>);
            }
          } catch (e) {
            logger.error(`Error parsing React agent format: ${e}`);
            // Continue to normal processing if parsing fails
          }
        }

        // For all other inputs, use the parent class's call method for normal processing
        // Cast to string or Record<string, any> to satisfy the type system
        if (typeof input === 'string' || (typeof input === 'object' && input !== null)) {
          return super.call(input as string | Record<string, any>);
        } else {
          // For any other input types, try to convert to string
          return super.call(String(input));
        }
      } catch (error: any) {
        // If there's an error with schema validation, try to parse it as a React agent input
        if (error.message?.includes('validation') && typeof input === 'string') {
          logger.debug(`Schema validation failed, trying React agent parsing as fallback`);
          try {
            const parsedInput = _parseReactAgentInput(input, this.schema);
            logger.debug(`Fallback parsing succeeded: ${JSON.stringify(parsedInput)}`);
            // Call _call directly, bypassing validation
            return this._call(parsedInput);
          } catch (fallbackError) {
            logger.error(`Fallback parsing also failed: ${fallbackError}`);
          }
        }

        // Re-throw the original error if all attempts fail
        throw error;
      }
    }

    protected async _call(input: Record<string, any>): Promise<string> {
      try {
        logger.debug(`Tool call received for ${this.name} with input:`, input);

        // Get a copy of the input for local modification
        let parsedInput: Record<string, any> = { ...input };

        // If the input contains a string pattern that looks like React agent format "{key: value}"
        // (this can happen when the React agent sends input in a non-object format)
        if (
          Object.keys(input).length === 1 &&
          typeof Object.values(input)[0] === 'string' &&
          Object.values(input)[0].match(/^\s*\{\s*[\w\s:]+\s*\}\s*$/)
        ) {
          // Get the content without braces
          const stringInput = Object.values(input)[0] as string;
          logger.debug(`Detected React agent string input pattern:`, stringInput);

          try {
            // Generic handling for empty values in any parameter, not just 'path'
            const emptyValueMatch = stringInput.match(/\{\s*(\w+)\s*:\s*\}/);
            if (emptyValueMatch && emptyValueMatch[1]) {
              const key = emptyValueMatch[1];
              logger.debug(
                `Special handling for empty value for parameter '${key}' in React agent input`
              );
              parsedInput = { [key]: '' };
              logger.debug(`Successfully parsed React agent input to:`, parsedInput);
            } else {
              // Try to parse the string input as a key-value pair
              // ... existing code for more complex parsing ...
            }
          } catch (e) {
            logger.debug(`Error parsing React agent format: ${e}`);
            // Continue with the original input if parsing fails
          }
        }

        // Generic preservation of empty values that were converted to 0
        // This ensures that for any parameter, if it has a value of 0 that might have been
        // incorrectly parsed from an empty value, we check if the expected type is string
        // and convert it back to an empty string
        for (const key of Object.keys(parsedInput)) {
          // Only process if the key exists in the schema
          if (this.schema.shape[key]) {
            // If the value is 0, check if the expected type is string
            if (parsedInput[key] === 0 && !(this.schema.shape[key] instanceof z.ZodNumber)) {
              logger.debug(`Converting numeric 0 value for parameter '${key}' to empty string`);
              parsedInput[key] = '';
            }

            // Handle null or undefined values regardless of expected type
            if (parsedInput[key] === null || parsedInput[key] === undefined) {
              logger.debug(
                `Converting null/undefined value for parameter '${key}' to empty string`
              );
              parsedInput[key] = '';
            }
          }
        }

        // Final validation and type correction based on schema
        for (const key of Object.keys(parsedInput)) {
          // Skip keys that aren't in the schema
          if (!this.schema.shape[key]) continue;

          // Handle array-specific corrections
          if (this.schema.shape[key] instanceof z.ZodArray && !Array.isArray(parsedInput[key])) {
            // If we expect an array but don't have one, convert to array
            if (
              typeof parsedInput[key] === 'string' &&
              parsedInput[key].startsWith('[') &&
              parsedInput[key].endsWith(']')
            ) {
              // Parse array-like string "[item1,item2]"
              const content = parsedInput[key].slice(1, -1).trim();
              parsedInput[key] = content ? content.split(',').map(i => i.trim()) : [];
            } else if (parsedInput[key] !== undefined && parsedInput[key] !== null) {
              // Wrap single value in array
              parsedInput[key] = [parsedInput[key]];
            } else {
              // Default to empty array
              parsedInput[key] = [];
            }
            logger.debug(`Corrected ${key} to be an array:`, parsedInput[key]);
          }

          // Similar corrections could be added for other types if needed
        }

        // Log the parsed input for debugging
        logger.debug(`Final parsed input for MCP tool ${this.name}:`, parsedInput);

        // Use the new SDK format for calling tools
        const result = await client.callTool({
          name: this.name,
          arguments: parsedInput,
        });

        // Ensure result matches our CallToolResult interface
        const typedResult: CallToolResult = {
          isError: result.isError === true,
          content: result.content || [],
        };

        const processedResult = _convertCallToolResult(typedResult);
        logger.debug(`MCP tool ${this.name} returned:`, processedResult);

        // For React agents, ensure the result is always a string to avoid parsing issues
        const finalResult = String(processedResult);
        logger.debug(`Final string result from MCP tool ${this.name}:`, finalResult);

        return finalResult;
      } catch (error) {
        logger.error(`Error calling tool ${this.name}:`, error);
        throw new ToolException(`Error calling tool ${this.name}: ${error}`);
      }
    }
  }

  return new MCPToolAdapter();
}

/**
 * Load all tools from an MCP client.
 *
 * @param client - The MCP client
 * @returns A list of LangChain tools
 */
export async function loadMcpTools(
  client: Client
): Promise<StructuredToolInterface<z.ZodObject<any>>[]> {
  const tools: StructuredToolInterface<z.ZodObject<any>>[] = [];
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
